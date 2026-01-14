/**
 * Dataset Manager
 * Handles dataset upload, validation, preprocessing, and storage
 */

import { z } from 'zod';
import type {
  Dataset,
  DatasetSource,
  DatasetFormat,
  DatasetStatus,
  DatasetValidationResult,
  DatasetSchema,
  DatasetStatistics,
  ValidationError,
  ValidationWarning,
  DatasetSplits,
  PaginatedResponse,
  FilterParams,
  Env,
} from '../types';

// ============================================================================
// Validation Schemas
// ============================================================================

const DatasetMetadataSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  format: z.enum(['jsonl', 'json', 'csv', 'parquet', 'custom']),
  source: z.enum(['upload', 'github', 'url', 'database', 'synthetic']),
  tags: z.array(z.string()).default([]),
});

const DatasetRowSchema = z.object({
  prompt: z.string().min(1),
  completion: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

// ============================================================================
// Dataset Manager Class
// ============================================================================

export class DatasetManager {
  private env: Env;
  private maxDatasetSize: number;

  constructor(env: Env) {
    this.env = env;
    this.maxDatasetSize = env.MAX_DATASET_SIZE || 1024 * 1024 * 1024; // 1GB default
  }

  /**
   * Upload a dataset
   */
  async uploadDataset(
    file: File | { data: ArrayBuffer; name: string; type: string },
    metadata: z.infer<typeof DatasetMetadataSchema>
  ): Promise<Dataset> {
    // Validate metadata
    const validatedMetadata = DatasetMetadataSchema.parse(metadata);

    // Get file data
    const data = file instanceof File
      ? await file.arrayBuffer()
      : file.data;

    const fileName = file instanceof File ? file.name : file.name;

    // Check file size
    if (data.byteLength > this.maxDatasetSize) {
      throw new Error(`Dataset size exceeds maximum allowed size of ${this.maxDatasetSize} bytes`);
    }

    // Generate dataset ID
    const datasetId = crypto.randomUUID();

    // Determine format from file extension if not provided
    let format = validatedMetadata.format;
    if (format === 'custom') {
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (ext === 'jsonl') format = 'jsonl';
      else if (ext === 'json') format = 'json';
      else if (ext === 'csv') format = 'csv';
      else if (ext === 'parquet') format = 'parquet';
    }

    // Calculate checksum
    const checksum = await this.calculateChecksum(data);

    // Create R2 key
    const r2Key = `datasets/${datasetId}/${fileName}`;

    // Upload to R2
    await this.env.R2.put(r2Key, data);

    // Create dataset record
    const dataset: Dataset = {
      id: datasetId,
      name: validatedMetadata.name,
      description: validatedMetadata.description,
      format,
      source: validatedMetadata.source,
      status: 'uploading',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      size: data.byteLength,
      rowCount: 0,
      checksum,
      path: r2Key,
      r2Bucket: this.env.R2_BUCKET,
      r2Key,
      tags: validatedMetadata.tags,
      metadata: {},
    };

    // Save to database
    await this.saveDatasetToDB(dataset);

    // Start validation
    this.validateDataset(datasetId).catch(error => {
      console.error(`Failed to validate dataset ${datasetId}:`, error);
    });

    return dataset;
  }

  /**
   * Import dataset from URL
   */
  async importFromUrl(
    url: string,
    metadata: z.infer<typeof DatasetMetadataSchema>
  ): Promise<Dataset> {
    // Fetch the dataset
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch dataset from URL: ${response.statusText}`);
    }

    const data = await response.arrayBuffer();
    const fileName = url.split('/').pop() || 'dataset.jsonl';

    return this.uploadDataset(
      { data, name: fileName, type: 'application/octet-stream' },
      { ...metadata, source: 'url' }
    );
  }

  /**
   * Import dataset from GitHub
   */
  async importFromGitHub(
    repo: string,
    path: string,
    metadata: z.infer<typeof DatasetMetadataSchema>
  ): Promise<Dataset> {
    const url = `https://raw.githubusercontent.com/${repo}/${path}`;
    return this.importFromUrl(url, { ...metadata, source: 'github' });
  }

  /**
   * Validate a dataset
   */
  async validateDataset(datasetId: string): Promise<DatasetValidationResult> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    // Update status
    dataset.status = 'validating';
    await this.saveDatasetToDB(dataset);

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const sampleRecords: Array<Record<string, any>> = [];

    try {
      // Download dataset from R2
      const object = await this.env.R2.get(dataset.r2Key);
      if (!object) {
        throw new Error('Dataset file not found in R2');
      }

      const data = await object.arrayBuffer();
      const text = new TextDecoder().decode(data);

      // Parse based on format
      let records: Array<Record<string, any>>;

      switch (dataset.format) {
        case 'jsonl':
          records = this.parseJSONL(text);
          break;
        case 'json':
          records = this.parseJSON(text);
          break;
        case 'csv':
          records = this.parseCSV(text);
          break;
        default:
          throw new Error(`Unsupported format: ${dataset.format}`);
      }

      // Validate each record
      for (let i = 0; i < records.length; i++) {
        const record = records[i];

        // Collect sample records
        if (i < 5) {
          sampleRecords.push(record);
        }

        try {
          // Validate record structure
          const validated = DatasetRowSchema.parse(record);

          // Validate content
          if (!validated.prompt.trim()) {
            errors.push({
              row: i,
              field: 'prompt',
              message: 'Prompt cannot be empty',
              severity: 'error',
            });
          }

          if (!validated.completion.trim()) {
            errors.push({
              row: i,
              field: 'completion',
              message: 'Completion cannot be empty',
              severity: 'error',
            });
          }

          // Check for excessively long prompts
          if (validated.prompt.length > 10000) {
            warnings.push({
              type: 'long_prompt',
              message: `Prompt at row ${i} is very long (${validated.prompt.length} characters)`,
              count: 1,
              suggestion: 'Consider truncating or splitting long prompts',
            });
          }

        } catch (error) {
          if (error instanceof z.ZodError) {
            for (const issue of error.issues) {
              errors.push({
                row: i,
                field: issue.path.join('.'),
                message: issue.message,
                severity: 'error',
              });
            }
          }
        }
      }

      // Calculate statistics
      const statistics = await this.calculateStatistics(records);

      // Update dataset
      dataset.rowCount = records.length;
      dataset.statistics = statistics;

      // Infer schema
      dataset.schema = this.inferSchema(records);

      // Update status
      if (errors.length === 0) {
        dataset.status = 'ready';
      } else {
        dataset.status = 'error';
      }

      dataset.updatedAt = Date.now();
      await this.saveDatasetToDB(dataset);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        statistics,
        sampleRecords,
      };

    } catch (error) {
      dataset.status = 'error';
      await this.saveDatasetToDB(dataset);

      throw error;
    }
  }

  /**
   * Preprocess dataset
   */
  async preprocessDataset(
    datasetId: string,
    options: {
      cleanText?: boolean;
      removeDuplicates?: boolean;
      minLength?: number;
      maxLength?: number;
      trainSplit?: number;
      valSplit?: number;
      testSplit?: number;
    } = {}
  ): Promise<Dataset> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    if (dataset.status !== 'ready') {
      throw new Error(`Dataset ${datasetId} is not ready`);
    }

    dataset.status = 'processing';
    await this.saveDatasetToDB(dataset);

    try {
      // Download dataset
      const object = await this.env.R2.get(dataset.r2Key);
      if (!object) {
        throw new Error('Dataset file not found in R2');
      }

      const data = await object.arrayBuffer();
      const text = new TextDecoder().decode(data);

      // Parse records
      let records: Array<Record<string, any>>;
      switch (dataset.format) {
        case 'jsonl':
          records = this.parseJSONL(text);
          break;
        case 'json':
          records = this.parseJSON(text);
          break;
        case 'csv':
          records = this.parseCSV(text);
          break;
        default:
          throw new Error(`Unsupported format: ${dataset.format}`);
      }

      let processedRecords = records;

      // Clean text if requested
      if (options.cleanText) {
        processedRecords = processedRecords.map(record => ({
          ...record,
          prompt: this.cleanText(record.prompt),
          completion: this.cleanText(record.completion),
        }));
      }

      // Remove duplicates if requested
      if (options.removeDuplicates) {
        const seen = new Set<string>();
        processedRecords = processedRecords.filter(record => {
          const key = `${record.prompt}|${record.completion}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      }

      // Filter by length if requested
      if (options.minLength || options.maxLength) {
        processedRecords = processedRecords.filter(record => {
          const promptLen = record.prompt.length;
          const completionLen = record.completion.length;
          const totalLen = promptLen + completionLen;

          if (options.minLength && totalLen < options.minLength) {
            return false;
          }
          if (options.maxLength && totalLen > options.maxLength) {
            return false;
          }
          return true;
        });
      }

      // Create splits if requested
      if (options.trainSplit || options.valSplit || options.testSplit) {
        const shuffled = this.shuffleArray(processedRecords);
        const total = shuffled.length;

        const trainSplit = options.trainSplit || 0.8;
        const valSplit = options.valSplit || 0.1;
        const testSplit = options.testSplit || 0.1;

        const trainEnd = Math.floor(total * trainSplit);
        const valEnd = trainEnd + Math.floor(total * valSplit);

        dataset.splits = {
          train: trainEnd,
          validation: valEnd - trainEnd,
          test: total - valEnd,
        };
      }

      // Convert back to original format
      let processedData: string;
      switch (dataset.format) {
        case 'jsonl':
          processedData = processedRecords.map(r => JSON.stringify(r)).join('\n');
          break;
        case 'json':
          processedData = JSON.stringify(processedRecords, null, 2);
          break;
        case 'csv':
          processedData = this.toCSV(processedRecords);
          break;
        default:
          throw new Error(`Unsupported format: ${dataset.format}`);
      }

      // Upload processed dataset
      const processedKey = `datasets/${datasetId}/processed-${Date.now()}.${dataset.format}`;
      await this.env.R2.put(processedKey, processedData);

      // Update dataset
      dataset.r2Key = processedKey;
      dataset.rowCount = processedRecords.length;
      dataset.size = processedData.length;
      dataset.updatedAt = Date.now();
      dataset.status = 'ready';

      // Recalculate statistics
      const statistics = await this.calculateStatistics(processedRecords);
      dataset.statistics = statistics;

      await this.saveDatasetToDB(dataset);

      return dataset;

    } catch (error) {
      dataset.status = 'error';
      await this.saveDatasetToDB(dataset);
      throw error;
    }
  }

  /**
   * Convert dataset format
   */
  async convertFormat(
    datasetId: string,
    targetFormat: DatasetFormat
  ): Promise<Dataset> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    if (dataset.format === targetFormat) {
      return dataset;
    }

    // Download and parse current dataset
    const object = await this.env.R2.get(dataset.r2Key);
    if (!object) {
      throw new Error('Dataset file not found in R2');
    }

    const data = await object.arrayBuffer();
    const text = new TextDecoder().decode(data);

    let records: Array<Record<string, any>>;
    switch (dataset.format) {
      case 'jsonl':
        records = this.parseJSONL(text);
        break;
      case 'json':
        records = this.parseJSON(text);
        break;
      case 'csv':
        records = this.parseCSV(text);
        break;
      default:
        throw new Error(`Unsupported source format: ${dataset.format}`);
    }

    // Convert to target format
    let convertedData: string;
    switch (targetFormat) {
      case 'jsonl':
        convertedData = records.map(r => JSON.stringify(r)).join('\n');
        break;
      case 'json':
        convertedData = JSON.stringify(records, null, 2);
        break;
      case 'csv':
        convertedData = this.toCSV(records);
        break;
      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }

    // Upload converted dataset
    const convertedKey = `datasets/${datasetId}/converted-${targetFormat}.${targetFormat}`;
    await this.env.R2.put(convertedKey, convertedData);

    // Update dataset
    dataset.format = targetFormat;
    dataset.r2Key = convertedKey;
    dataset.updatedAt = Date.now();

    await this.saveDatasetToDB(dataset);

    return dataset;
  }

  /**
   * Get a dataset by ID
   */
  async getDataset(datasetId: string): Promise<Dataset | undefined> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM datasets WHERE id = ?'
    ).bind(datasetId).first();

    if (!result) return undefined;

    return this.mapDbRowToDataset(result);
  }

  /**
   * List datasets with filtering and pagination
   */
  async listDatasets(
    filter?: FilterParams,
    pagination?: { page: number; pageSize: number }
  ): Promise<PaginatedResponse<Dataset>> {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = 'SELECT * FROM datasets WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.dateFrom) {
      query += ' AND created_at >= ?';
      params.push(filter.dateFrom);
    }

    if (filter?.dateTo) {
      query += ' AND created_at <= ?';
      params.push(filter.dateTo);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.env.DB.prepare(countQuery).bind(...params).first();
    const totalItems = (countResult?.count as number) || 0;

    // Get paginated data
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const result = await this.env.DB.prepare(query).bind(...params).all();
    const datasets = result.results.map((row: any) => this.mapDbRowToDataset(row));

    return {
      data: datasets,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        hasNext: page * pageSize < totalItems,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Delete a dataset
   */
  async deleteDataset(datasetId: string): Promise<void> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    // Delete from R2
    await this.env.R2.delete(dataset.r2Key);

    // Delete from database
    await this.env.DB.prepare('DELETE FROM datasets WHERE id = ?').bind(datasetId).run();
  }

  /**
   * Download dataset
   */
  async downloadDataset(datasetId: string): Promise<{ data: ArrayBuffer; filename: string }> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    const object = await this.env.R2.get(dataset.r2Key);
    if (!object) {
      throw new Error('Dataset file not found in R2');
    }

    const data = await object.arrayBuffer();
    const filename = `${dataset.name}.${dataset.format}`;

    return { data, filename };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private parseJSONL(text: string): Array<Record<string, any>> {
    const lines = text.trim().split('\n');
    const records: Array<Record<string, any>> = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line));
      } catch (error) {
        console.error('Failed to parse JSONL line:', line);
      }
    }

    return records;
  }

  private parseJSON(text: string): Array<Record<string, any>> {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  }

  private parseCSV(text: string): Array<Record<string, any>> {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const records: Array<Record<string, any>> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const record: Record<string, any> = {};

      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = values[j] || '';
      }

      records.push(record);
    }

    return records;
  }

  private toCSV(records: Array<Record<string, any>>): string {
    if (records.length === 0) return '';

    const headers = Object.keys(records[0]);
    const lines = [headers.join(',')];

    for (const record of records) {
      const values = headers.map(h => record[h] || '');
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  private async calculateStatistics(records: Array<Record<string, any>>): Promise<DatasetStatistics> {
    let totalTokens = 0;
    const promptLengths: number[] = [];
    const completionLengths: number[] = [];

    for (const record of records) {
      const promptTokens = this.estimateTokens(record.prompt);
      const completionTokens = this.estimateTokens(record.completion);

      totalTokens += promptTokens + completionTokens;
      promptLengths.push(promptTokens);
      completionLengths.push(completionTokens);
    }

    const avgPromptLength = promptLengths.reduce((a, b) => a + b, 0) / promptLengths.length;
    const avgCompletionLength = completionLengths.reduce((a, b) => a + b, 0) / completionLengths.length;

    const sortedPromptLengths = promptLengths.sort((a, b) => a - b);
    const sortedCompletionLengths = completionLengths.sort((a, b) => a - b);

    return {
      totalTokens,
      avgPromptLength,
      avgCompletionLength,
      minPromptLength: sortedPromptLengths[0] || 0,
      maxPromptLength: sortedPromptLengths[sortedPromptLengths.length - 1] || 0,
      minCompletionLength: sortedCompletionLengths[0] || 0,
      maxCompletionLength: sortedCompletionLengths[sortedCompletionLengths.length - 1] || 0,
      tokenDistribution: this.calculateDistribution(promptLengths.map(p => p + this.avg(completionLengths))),
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private calculateDistribution(values: number[]): any {
    const sorted = values.sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  private avg(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private inferSchema(records: Array<Record<string, any>>): DatasetSchema {
    if (records.length === 0) {
      return {
        fields: [],
        promptField: 'prompt',
        completionField: 'completion',
      };
    }

    const firstRecord = records[0];
    const fields = Object.keys(firstRecord).map(key => ({
      name: key,
      type: this.inferFieldType(firstRecord[key]),
      required: true,
    }));

    return {
      fields,
      promptField: 'prompt',
      completionField: 'completion',
    };
  }

  private inferFieldType(value: any): 'string' | 'number' | 'boolean' | 'array' | 'object' {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object' && value !== null) return 'object';
    return 'string';
  }

  private cleanText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\r\n]+/g, ' ');
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    // Simple checksum calculation (in production, use proper crypto)
    const view = new Uint8Array(data);
    let hash = 0;
    for (let i = 0; i < view.length; i++) {
      hash = ((hash << 5) - hash + view[i]) & 0xffffffff;
    }
    return Math.abs(hash).toString(16);
  }

  private async saveDatasetToDB(dataset: Dataset): Promise<void> {
    await this.env.DB.prepare(`
      INSERT OR REPLACE INTO datasets (
        id, name, description, format, source, status, created_at, updated_at,
        size, row_count, checksum, path, r2_bucket, r2_key, schema, statistics,
        splits, tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      dataset.id,
      dataset.name,
      dataset.description || null,
      dataset.format,
      dataset.source,
      dataset.status,
      dataset.createdAt,
      dataset.updatedAt,
      dataset.size,
      dataset.rowCount,
      dataset.checksum,
      dataset.path,
      dataset.r2Bucket,
      dataset.r2Key,
      JSON.stringify(dataset.schema),
      JSON.stringify(dataset.statistics),
      JSON.stringify(dataset.splits),
      JSON.stringify(dataset.tags),
      JSON.stringify(dataset.metadata)
    ).run();
  }

  private mapDbRowToDataset(row: any): Dataset {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      format: row.format,
      source: row.source,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      size: row.size,
      rowCount: row.row_count,
      checksum: row.checksum,
      path: row.path,
      r2Bucket: row.r2_bucket,
      r2Key: row.r2_key,
      schema: row.schema ? JSON.parse(row.schema) : undefined,
      statistics: row.statistics ? JSON.parse(row.statistics) : undefined,
      splits: row.splits ? JSON.parse(row.splits) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    };
  }
}
