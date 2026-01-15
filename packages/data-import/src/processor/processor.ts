import { EventEmitter } from 'events';
import {
  ImportJob,
  ImportRecord,
  ImportConfig,
  ConflictResolutionStrategy,
  JobStatus,
  RecordStatus,
  ValidationResult,
  Progress
} from '../types';
import { generateId } from '../utils';
import { FormatParser, ParseResult } from '../formats';
import { DataValidator } from '../validator';
import { DataTransformer, TransformationResult } from '../transform';

export interface ProcessorOptions {
  batchSize?: number;
  maxConcurrentJobs?: number;
  retryAttempts?: number;
  conflictResolution?: ConflictResolutionStrategy;
  enableRealtimeProgress?: boolean;
  enableLogging?: boolean;
}

export interface ImportResult {
  jobId: string;
  success: boolean;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  averageTimePerRecord: number;
  totalProcessingTime: number;
  errors: Array<{
    recordId: string;
    error: string;
    timestamp: Date;
  }>;
}

export class ImportProcessor extends EventEmitter {
  private jobs = new Map<string, ImportJob>();
  private parser = new FormatParser();
  private validator = new DataValidator();
  private transformer = new DataTransformer();
  private processing = new Map<string, Promise<void>>();
  private options: Required<ProcessorOptions>;
  private concurrencyLimiter: { count: number; max: number };

  constructor(options: ProcessorOptions = {}) {
    super();
    this.options = {
      batchSize: 1000,
      maxConcurrentJobs: 5,
      retryAttempts: 3,
      conflictResolution: 'skip',
      enableRealtimeProgress: true,
      enableLogging: true,
      ...options,
    };
    this.concurrencyLimiter = { count: 0, max: this.options.maxConcurrentJobs };
  }

  async startJob(job: ImportJob): Promise<string> {
    const jobId = job.id || generateId();

    if (this.jobs.has(jobId)) {
      throw new Error(`Job with ID ${jobId} already exists`);
    }

    const enhancedJob: ImportJob = {
      ...job,
      id: jobId,
      status: 'pending',
      progress: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, enhancedJob);
    this.emit('jobCreated', enhancedJob);

    if (this.options.enableLogging) {
      console.log(`Starting import job: ${jobId}`);
    }

    this.processJob(jobId).catch(error => {
      this.updateJobStatus(jobId, 'failed', error.message);
      this.emit('jobFailed', { jobId, error });
    });

    return jobId;
  }

  async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    this.updateJobStatus(jobId, 'processing');

    try {
      await this.waitForConcurrencySlot();
      this.concurrencyLimiter.count++;

      const result = await this.executeJob(job);

      this.updateJobStatus(jobId, 'completed', undefined, result);
      this.emit('jobCompleted', { jobId, result });

      if (this.options.enableLogging) {
        console.log(`Job ${jobId} completed successfully`);
      }
    } catch (error) {
      this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      this.emit('jobFailed', { jobId, error });
    } finally {
      this.concurrencyLimiter.count--;
    }
  }

  private async executeJob(job: ImportJob): Promise<ImportResult> {
    const startTime = performance.now();
    const records = await this.parseAndPrepareRecords(job);

    this.updateJobProgress(job.id, {
      total: records.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
    });

    const validationResults = await this.validateRecords(records, job);
    const transformedRecords = await this.transformRecords(records, validationResults, job);

    const result = await this.batchImportRecords(transformedRecords, job);

    const endTime = performance.now();
    result.totalProcessingTime = endTime - startTime;
    result.averageTimePerRecord = result.processedRecords > 0
      ? result.totalProcessingTime / result.processedRecords
      : 0;

    return result;
  }

  private async parseAndPrepareRecords(job: ImportJob): Promise<ImportRecord[]> {
    const { source, config } = job;
    const parseStartTime = performance.now();

    let parseResult: ParseResult;
    try {
      parseResult = await this.parser.parse(source.path, source.format);
    } catch (error) {
      throw new Error(`Failed to parse source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const parseEndTime = performance.now();
    if (this.options.enableLogging) {
      console.log(`Parsed ${parseResult.data.length} records in ${(parseEndTime - parseStartTime).toFixed(2)}ms`);
    }

    return parseResult.data.map((data, index) => ({
      id: generateId(),
      data,
      metadata: {
        source: source.path,
        format: source.format,
        index,
        originalSize: JSON.stringify(data).length,
      },
      status: 'pending',
    }));
  }

  private async validateRecords(
    records: ImportRecord[],
    job: ImportJob
  ): Promise<ValidationResult[]> {
    if (!job.config.validationRules || job.config.validationRules.length === 0) {
      return records.map(() => ({
        isValid: true,
        errors: [],
        warnings: [],
        score: 1,
      }));
    }

    const validationStartTime = performance.now();
    const results = await this.validator.validateRecords(
      records.map(r => r.data),
      job.config.validationRules
    );
    const validationEndTime = performance.now();

    if (this.options.enableLogging) {
      console.log(`Validated ${records.length} records in ${(validationEndTime - validationStartTime).toFixed(2)}ms`);
    }

    return results;
  }

  private async transformRecords(
    records: ImportRecord[],
    validationResults: ValidationResult[],
    job: ImportJob
  ): Promise<ImportRecord[]> {
    if (!job.config.transformations || job.config.transformations.length === 0) {
      return records;
    }

    const validRecords = records.filter((_, index) => validationResults[index].isValid);
    const transformationStartTime = performance.now();

    const transformationResult = await this.transformer.transformRecords(
      validRecords,
      job.config.transformations,
      {
        sourceSchema: job.metadata?.sourceSchema,
        targetSchema: job.metadata?.targetSchema,
      }
    );

    const transformationEndTime = performance.now();

    if (this.options.enableLogging) {
      console.log(`Transformed ${transformationResult.transformationMetrics.successful} records in ${(transformationEndTime - transformationStartTime).toFixed(2)}ms`);
    }

    return transformationResult.transformedRecords;
  }

  private async batchImportRecords(
    records: ImportRecord[],
    job: ImportJob
  ): Promise<ImportResult> {
    const { batchSize } = this.options;
    const totalBatches = Math.ceil(records.length / batchSize);
    let successful = 0;
    let failed = 0;
    const errors: ImportResult['errors'] = [];

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, records.length);
      const batch = records.slice(batchStart, batchEnd);

      const batchStartTime = performance.now();
      const batchResult = await this.processBatch(batch, job, batchIndex);
      const batchEndTime = performance.now();

      successful += batchResult.successful;
      failed += batchResult.failed;
      errors.push(...batchResult.errors);

      this.updateJobProgress(job.id, {
        processed: (batchIndex + 1) * Math.min(batchSize, records.length),
        successful,
        failed,
        percentage: Math.round(((batchIndex + 1) * Math.min(batchSize, records.length)) / records.length * 100),
      });

      if (this.options.enableLogging) {
        console.log(`Batch ${batchIndex + 1}/${totalBatches} processed in ${(batchEndTime - batchStartTime).toFixed(2)}ms`);
      }
    }

    return {
      jobId: job.id,
      success: failed === 0,
      processedRecords: records.length,
      successfulRecords: successful,
      failedRecords: failed,
      averageTimePerRecord: 0,
      totalProcessingTime: 0,
      errors,
    };
  }

  private async processBatch(
    batch: ImportRecord[],
    job: ImportJob,
    batchIndex: number
  ): Promise<{ successful: number; failed: number; errors: ImportResult['errors'] }> {
    let successful = 0;
    let failed = 0;
    const errors: ImportResult['errors'] = [];

    for (let i = 0; i < batch.length; i++) {
      const record = batch[i];
      const attempt = 0;

      try {
        await this.processRecordWithRetry(record, job, attempt);
        successful++;
        record.status = 'success';
      } catch (error) {
        failed++;
        record.status = 'failed';
        record.error = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          recordId: record.id,
          error: record.error,
          timestamp: new Date(),
        });
      }
    }

    return { successful, failed, errors };
  }

  private async processRecordWithRetry(
    record: ImportRecord,
    job: ImportJob,
    attempt: number
  ): Promise<void> {
    const maxAttempts = job.config.maxRetries || this.options.retryAttempts;

    try {
      await this.processRecord(record, job);
    } catch (error) {
      if (attempt < maxAttempts) {
        if (this.options.enableLogging) {
          console.log(`Retrying record ${record.id} (attempt ${attempt + 1}/${maxAttempts})`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        return this.processRecordWithRetry(record, job, attempt + 1);
      }
      throw error;
    }
  }

  private async processRecord(record: ImportRecord, job: ImportJob): Promise<void> {
    const { conflictResolution } = job.config;

    if (conflictResolution === 'error' && await this.recordExists(record)) {
      throw new Error('Record already exists and conflict resolution is set to error');
    }

    if (conflictResolution === 'skip' && await this.recordExists(record)) {
      record.status = 'skipped';
      return;
    }

    if (conflictResolution === 'update' && await this.recordExists(record)) {
      await this.updateRecord(record);
      return;
    }

    if (conflictResolution === 'merge' && await this.recordExists(record)) {
      await this.mergeRecords(record);
      return;
    }

    await this.insertRecord(record);
  }

  private async recordExists(record: ImportRecord): Promise<boolean> {
    const checkFunction = this.emit('checkRecordExists', record);
    return checkFunction ? await checkFunction : false;
  }

  private async insertRecord(record: ImportRecord): Promise<void> {
    const insertFunction = this.emit('insertRecord', record);
    if (insertFunction) {
      await insertFunction;
    }
  }

  private async updateRecord(record: ImportRecord): Promise<void> {
    const updateFunction = this.emit('updateRecord', record);
    if (updateFunction) {
      await updateFunction;
    }
  }

  private async mergeRecords(record: ImportRecord): Promise<void> {
    const mergeFunction = this.emit('mergeRecord', record);
    if (mergeFunction) {
      await mergeFunction;
    }
  }

  private updateJobStatus(
    jobId: string,
    status: JobStatus,
    error?: string,
    result?: ImportResult
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.updatedAt = new Date();

    if (error) {
      job.error = error;
    }

    if (result) {
      job.metadata = {
        ...job.metadata,
        processedRecords: result.processedRecords,
        successfulRecords: result.successfulRecords,
        failedRecords: result.failedRecords,
        totalProcessingTime: result.totalProcessingTime,
        averageTimePerRecord: result.averageTimePerRecord,
      };
    }

    this.jobs.set(jobId, job);
    this.emit('jobUpdated', job);
  }

  private updateJobProgress(jobId: string, progress: Partial<Progress>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.progress = {
      ...job.progress,
      ...progress,
    };

    this.jobs.set(jobId, job);

    if (this.options.enableRealtimeProgress) {
      this.emit('jobProgress', { jobId, progress: job.progress });
    }
  }

  private async waitForConcurrencySlot(): Promise<void> {
    return new Promise(resolve => {
      if (this.concurrencyLimiter.count < this.concurrencyLimiter.max) {
        resolve();
        return;
      }

      const check = () => {
        if (this.concurrencyLimiter.count < this.concurrencyLimiter.max) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };

      check();
    });
  }

  getJob(jobId: string): ImportJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): ImportJob[] {
    return Array.from(this.jobs.values());
  }

  getActiveJobs(): ImportJob[] {
    return Array.from(this.jobs.values()).filter(job =>
      job.status === 'processing'
    );
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    this.updateJobStatus(jobId, 'cancelled');
    this.emit('jobCancelled', { jobId });
    return true;
  }

  updateJobOptions(options: Partial<ProcessorOptions>): void {
    this.options = { ...this.options, ...options };
    this.concurrencyLimiter.max = this.options.maxConcurrentJobs;
  }

  getStats(): {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalRecordsProcessed: number;
    averageProcessingTime: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const completed = jobs.filter(j => j.status === 'completed');
    const failed = jobs.filter(j => j.status === 'failed');

    const totalRecords = completed.reduce((sum, job) =>
      sum + (job.metadata?.processedRecords || 0), 0
    );

    const totalTime = completed.reduce((sum, job) =>
      sum + (job.metadata?.totalProcessingTime || 0), 0
    );

    return {
      totalJobs: jobs.length,
      activeJobs: this.getActiveJobs().length,
      completedJobs: completed.length,
      failedJobs: failed.length,
      totalRecordsProcessed: totalRecords,
      averageProcessingTime: completed.length > 0 ? totalTime / completed.length : 0,
    };
  }

  cleanup(): void {
    this.jobs.clear();
    this.processing.clear();
    this.removeAllListeners();
  }
}