// @ts-nocheck
/**
 * File Data Ingestion
 * Handles data ingestion from various file formats (CSV, JSON, Parquet, Avro, XML)
 */

import type {
  FileConfig,
  StreamEvent
} from '../types';

export interface FileIngestorConfig {
  id: string;
  config: FileConfig;
}

export class FileIngestor {
  private config: FileIngestorConfig;

  constructor(config: FileIngestorConfig) {
    this.config = config;
  }

  /**
   * Fetch all records from file
   */
  async fetch(): Promise<StreamEvent[]> {
    const data = await this.readFile();

    let records: unknown[];
    switch (this.config.config.format) {
      case 'csv':
        records = this.parseCSV(data);
        break;
      case 'json':
        records = this.parseJSON(data);
        break;
      case 'parquet':
        records = await this.parseParquet(data);
        break;
      case 'avro':
        records = await this.parseAvro(data);
        break;
      case 'xml':
        records = this.parseXML(data);
        break;
      default:
        throw new Error(`Unsupported file format: ${this.config.config.format}`);
    }

    return records.map(record => this.createEvent(record));
  }

  /**
   * Stream records from file
   */
  async *stream(): AsyncGenerator<StreamEvent> {
    const data = await this.readFile();

    switch (this.config.config.format) {
      case 'csv':
        for await (const record of this.streamCSV(data)) {
          yield this.createEvent(record);
        }
        break;

      case 'json':
        for await (const record of this.streamJSON(data)) {
          yield this.createEvent(record);
        }
        break;

      case 'jsonlines':
        for await (const record of this.streamJSONLines(data)) {
          yield this.createEvent(record);
        }
        break;

      default:
        // For other formats, fall back to fetch
        const events = await this.fetch();
        for (const event of events) {
          yield event;
        }
    }
  }

  /**
   * Read file from path or URL
   */
  private async readFile(): Promise<string> {
    let fileData: string;

    if (this.config.config.path) {
      // Read from local file system (not available in Workers)
      throw new Error('Local file system access not available in Workers');
    } else if (this.config.config.url) {
      // Fetch from URL
      const response = await fetch(this.config.config.url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      fileData = await response.text();
    } else {
      throw new Error('Either path or url must be specified');
    }

    // Handle decompression if needed
    if (this.config.config.compression && this.config.config.compression !== 'none') {
      fileData = await this.decompress(fileData, this.config.config.compression);
    }

    return fileData;
  }

  /**
   * Parse CSV data
   */
  private parseCSV(data: string): unknown[] {
    const lines = data.split('\n');
    const records: unknown[] = [];

    const delimiter = this.config.config.delimiter || ',';
    const hasHeader = this.config.config.header !== false;

    if (lines.length === 0) {
      return records;
    }

    let headers: string[] = [];

    if (hasHeader) {
      headers = lines[0].split(delimiter).map(h => h.trim());
      lines.shift();
    } else {
      // Generate column names
      const firstLine = lines[0].split(delimiter);
      headers = firstLine.map((_, i) => `column_${i}`);
    }

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const values = line.split(delimiter).map(v => v.trim());
      const record: Record<string, unknown> = {};

      headers.forEach((header, i) => {
        record[header] = this.parseCSVValue(values[i]);
      });

      records.push(record);
    }

    return records;
  }

  /**
   * Stream CSV data
   */
  private async *streamCSV(data: string): AsyncGenerator<unknown> {
    const lines = data.split('\n');
    const delimiter = this.config.config.delimiter || ',';
    const hasHeader = this.config.config.header !== false;

    if (lines.length === 0) {
      return;
    }

    let headers: string[] = [];

    if (hasHeader) {
      headers = lines[0].split(delimiter).map(h => h.trim());
      lines.shift();
    } else {
      const firstLine = lines[0].split(delimiter);
      headers = firstLine.map((_, i) => `column_${i}`);
    }

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const values = line.split(delimiter).map(v => v.trim());
      const record: Record<string, unknown> = {};

      headers.forEach((header, i) => {
        record[header] = this.parseCSVValue(values[i]);
      });

      yield record;
    }
  }

  /**
   * Parse CSV value with type inference
   */
  private parseCSVValue(value: string): unknown {
    // Remove quotes if present
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    // Try to parse as number
    if (/^-?\d+\.?\d*$/.test(value)) {
      return parseFloat(value);
    }

    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Try to parse as null
    if (value.toLowerCase() === 'null' || value === '') return null;

    return value;
  }

  /**
   * Parse JSON data
   */
  private parseJSON(data: string): unknown[] {
    const parsed = JSON.parse(data);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    return [parsed];
  }

  /**
   * Stream JSON data
   */
  private async *streamJSON(data: string): AsyncGenerator<unknown> {
    const parsed = JSON.parse(data);

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        yield item;
      }
    } else {
      yield parsed;
    }
  }

  /**
   * Stream JSON Lines data
   */
  private async *streamJSONLines(data: string): AsyncGenerator<unknown> {
    const lines = data.split('\n');

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        yield JSON.parse(line);
      } catch (error) {
        console.error('Error parsing JSON line:', error);
      }
    }
  }

  /**
   * Parse Parquet data (placeholder)
   */
  private async parseParquet(data: string): Promise<unknown[]> {
    // In a real implementation, this would use a Parquet library
    // For now, return empty array
    console.warn('Parquet parsing not yet implemented');
    return [];
  }

  /**
   * Parse Avro data (placeholder)
   */
  private async parseAvro(data: string): Promise<unknown[]> {
    // In a real implementation, this would use an Avro library
    console.warn('Avro parsing not yet implemented');
    return [];
  }

  /**
   * Parse XML data
   */
  private parseXML(data: string): unknown[] {
    // Simple XML parser
    const parser = new XMLParser();
    const result = parser.parse(data);

    // Try to extract array of records
    if (typeof result === 'object' && result !== null) {
      const obj = result as Record<string, unknown>;
      for (const key of ['items', 'records', 'entries', 'row']) {
        if (Array.isArray(obj[key])) {
          return obj[key] as unknown[];
        }
      }
    }

    return [result];
  }

  /**
   * Decompress data (placeholder)
   */
  private async decompress(data: string, compression: string): Promise<string> {
    // In a real implementation, this would use compression libraries
    console.warn(`Decompression for ${compression} not yet implemented`);
    return data;
  }

  /**
   * Create stream event from record
   */
  private createEvent(record: unknown): StreamEvent {
    return {
      key: this.generateKey(record),
      value: record,
      timestamp: new Date(),
      headers: {},
      metadata: {
        source: this.config.id,
        sourceType: 'file',
        format: this.config.config.format
      }
    };
  }

  /**
   * Generate unique key for record
   */
  private generateKey(record: unknown): string {
    if (typeof record === 'object' && record !== null) {
      const obj = record as Record<string, unknown>;
      for (const key of ['id', '_id', 'uuid', 'key']) {
        if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
          return `${this.config.id}-${obj[key]}`;
        }
      }
    }

    return `${this.config.id}-${Date.now()}-${Math.random()}`;
  }
}

/**
 * Simple XML parser
 */
class XMLParser {
  parse(xml: string): unknown {
    // Remove XML declaration if present
    xml = xml.replace(/^<\?xml[^?]*\?>/, '');

    // Parse root element
    const match = xml.match(/^<([^>]+)>([\s\S]*)<\/\1>$/);
    if (!match) {
      throw new Error('Invalid XML format');
    }

    const [, tagName, content] = match;
    return this.parseElement(tagName, content);
  }

  private parseElement(tagName: string, content: string): unknown {
    // Check if it has child elements
    const childMatches = [...content.matchAll(/<([^>]+)>([\s\S]*?)<\/\1>/g)];

    if (childMatches.length > 0) {
      const obj: Record<string, unknown> = {};

      for (const [, childTag, childContent] of childMatches) {
        if (obj[childTag]) {
          // Convert to array if multiple elements with same tag
          if (!Array.isArray(obj[childTag])) {
            obj[childTag] = [obj[childTag]];
          }
          (obj[childTag] as unknown[]).push(this.parseElement(childTag, childContent));
        } else {
          obj[childTag] = this.parseElement(childTag, childContent);
        }
      }

      return obj;
    }

    // Return text content if no child elements
    return content.trim();
  }
}
