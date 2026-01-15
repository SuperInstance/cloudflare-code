import { createReadStream, promises as fs } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ParquetReader, ParquetWriter } from 'parquetjs';
import { SchemaInferenceOptions, FormatDetectionOptions, DataFormat } from '../types';
import { generateId, createMemoryStream } from '../utils';

export interface ParseResult {
  data: any[];
  metadata: {
    format: DataFormat;
    totalRecords: number;
    columns: string[];
    schema?: any;
    processingTime: number;
    fileSize?: number;
  };
}

export class FormatParser {
  private detectOptions: FormatDetectionOptions;
  private inferenceOptions: SchemaInferenceOptions;

  constructor(
    detectOptions: FormatDetectionOptions = {},
    inferenceOptions: SchemaInferenceOptions = {}
  ) {
    this.detectOptions = {
      sampleSize: 1000,
      strict: false,
      ...detectOptions,
    };
    this.inferenceOptions = {
      sampleSize: 1000,
      confidenceThreshold: 0.8,
      inferTypes: true,
      detectNulls: true,
      ...inferenceOptions,
    };
  }

  async parse(source: string, format?: DataFormat): Promise<ParseResult> {
    const startTime = Date.now();

    if (!format) {
      format = await this.detectFormat(source);
    }

    let data: any[] = [];
    let metadata: any = {
      format,
      totalRecords: 0,
      columns: [],
      processingTime: 0,
    };

    try {
      switch (format) {
        case 'csv':
          const csvResult = await this.parseCSV(source);
          data = csvResult.data;
          metadata.columns = csvResult.metadata.columns;
          break;
        case 'json':
          const jsonResult = await this.parseJSON(source);
          data = jsonResult.data;
          metadata.columns = jsonResult.metadata.columns;
          break;
        case 'parquet':
          const parquetResult = await this.parseParquet(source);
          data = parquetResult.data;
          metadata.columns = parquetResult.metadata.columns;
          break;
        case 'excel':
          const excelResult = await this.parseExcel(source);
          data = excelResult.data;
          metadata.columns = excelResult.metadata.columns;
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      metadata.totalRecords = data.length;
      metadata.processingTime = Date.now() - startTime;

      if (this.inferenceOptions.inferTypes) {
        metadata.schema = await this.inferSchema(data);
      }

      return { data, metadata };
    } catch (error) {
      throw new Error(`Failed to parse ${format} file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async detectFormat(source: string): Promise<DataFormat> {
    const stats = await fs.stat(source);

    if (stats.size === 0) {
      throw new Error('Source file is empty');
    }

    const sampleSize = Math.min(stats.size, this.detectOptions.sampleSize || 1000);
    const buffer = await fs.readFile(source, { encoding: 'utf8', length: sampleSize });

    const formatScores: Record<DataFormat, number> = {
      csv: 0,
      json: 0,
      parquet: 0,
      excel: 0,
      xml: 0,
    };

    if (this.isCSV(buffer)) {
      formatScores.csv += 10;
    }
    if (this.isJSON(buffer)) {
      formatScores.json += 10;
    }
    if (this.isXML(buffer)) {
      formatScores.xml += 10;
    }
    if (source.toLowerCase().endsWith('.csv')) {
      formatScores.csv += 5;
    }
    if (source.toLowerCase().endsWith('.json')) {
      formatScores.json += 5;
    }
    if (source.toLowerCase().endsWith('.parquet')) {
      formatScores.parquet += 5;
    }
    if (source.toLowerCase().endsWith('.xlsx') || source.toLowerCase().endsWith('.xls')) {
      formatScores.excel += 5;
    }

    if (this.detectOptions.strict) {
      const maxScore = Math.max(...Object.values(formatScores));
      const candidates = Object.entries(formatScores).filter(([_, score]) => score === maxScore);
      if (candidates.length === 1) {
        return candidates[0][0] as DataFormat;
      }
      throw new Error('Could not reliably detect file format');
    }

    return Object.entries(formatScores).reduce((a, b) => formatScores[a[0] as DataFormat] > formatScores[b[0] as DataFormat] ? a : b)[0] as DataFormat;
  }

  private isCSV(buffer: string): boolean {
    const lines = buffer.split('\n').filter(line => line.trim());
    if (lines.length < 2) return false;

    const firstLine = lines[0];
    const secondLine = lines[1];
    const delimiterMatches = [',', ';', '\t', '|'].map(delimiter => ({
      delimiter,
      first: firstLine.split(delimiter).length,
      second: secondLine.split(delimiter).length,
    }));

    const bestMatch = delimiterMatches.reduce((a, b) =>
      Math.abs(a.first - a.second) < Math.abs(b.first - b.second) ? a : b
    );

    return bestMatch.first > 1 && bestMatch.second > 1;
  }

  private isJSON(buffer: string): boolean {
    try {
      JSON.parse(buffer);
      return true;
    } catch {
      return false;
    }
  }

  private isXML(buffer: string): boolean {
    return /<[^>]+>/.test(buffer);
  }

  private async parseCSV(source: string): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
      const stream = createReadStream(source);
      const { stream: memoryStream, data } = createMemoryStream();

      stream.pipe(memoryStream);

      Papa.parse(data[0], {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        transform: (value: string) => {
          if (value === '' || value === null || value === undefined) {
            return null;
          }
          return value;
        },
        complete: (results) => {
          const columns = results.meta.fields || [];
          resolve({
            data: results.data,
            metadata: {
              format: 'csv',
              totalRecords: results.data.length,
              columns,
              processingTime: 0,
            },
          });
        },
        error: (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        },
      });
    });
  }

  private async parseJSON(source: string): Promise<ParseResult> {
    const content = await fs.readFile(source, 'utf8');
    let data: any[];

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        data = parsed;
      } else if (typeof parsed === 'object') {
        data = [parsed];
      } else {
        throw new Error('JSON must contain an array or object');
      }
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const columns = Array.from(new Set(
      data.flatMap((record: any) =>
        Object.keys(record).filter(key => record[key] !== null && record[key] !== undefined)
      )
    ));

    return {
      data,
      metadata: {
        format: 'json',
        totalRecords: data.length,
        columns,
        processingTime: 0,
      },
    };
  }

  private async parseParquet(source: string): Promise<ParseResult> {
    try {
      const reader = await ParquetReader.openFile(source);
      const schema = await reader.getSchema();
      const data: any[] = [];

      const cursor = await reader.getCursor();
      let record = await cursor.next();

      while (record) {
        data.push(record);
        record = await cursor.next();
      }

      const columns = Object.keys(schema.fields);

      return {
        data,
        metadata: {
          format: 'parquet',
          totalRecords: data.length,
          columns,
          schema,
          processingTime: 0,
        },
      };
    } catch (error) {
      throw new Error(`Parquet parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async parseExcel(source: string): Promise<ParseResult> {
    const workbook = XLSX.readFile(source, { sheetStubs: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const data: any[] = [];
    const columns: string[] = [];

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })];
      const colName = cell ? cell.v?.toString() : `Column${C + 1}`;
      columns.push(colName);
    }

    for (let R = 1; R <= range.e.r; ++R) {
      const row: any = {};
      let hasData = false;

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell) {
          const colName = columns[C];
          row[colName] = cell.v;
          hasData = true;
        } else {
          row[columns[C]] = null;
        }
      }

      if (hasData) {
        data.push(row);
      }
    }

    return {
      data,
      metadata: {
        format: 'excel',
        totalRecords: data.length,
        columns,
        processingTime: 0,
      },
    };
  }

  private async inferSchema(data: any[]): Promise<any> {
    if (data.length === 0) {
      return { type: 'array', items: {} };
    }

    const sample = data.slice(0, this.inferenceOptions.sampleSize);
    const schemaFields: any = {};

    for (const record of sample) {
      for (const [key, value] of Object.entries(record)) {
        if (value !== null && value !== undefined && !schemaFields[key]) {
          schemaFields[key] = this.inferType(value);
        }
      }
    }

    return {
      type: 'object',
      properties: schemaFields,
      required: Object.keys(schemaFields).filter(key =>
        !this.inferenceOptions.detectNulls ||
        sample.every(record => record[key] !== null)
      ),
    };
  }

  private inferType(value: any): any {
    if (value === null || value === undefined) {
      return { type: 'null' };
    }

    const type = typeof value;

    switch (type) {
      case 'string':
        if (this.isDateString(value)) {
          return { type: 'string', format: 'date-time' };
        }
        if (this.isEmail(value)) {
          return { type: 'string', format: 'email' };
        }
        if (this.isUrl(value)) {
          return { type: 'string', format: 'uri' };
        }
        return { type: 'string' };

      case 'number':
        return Number.isInteger(value)
          ? { type: 'integer' }
          : { type: 'number' };

      case 'boolean':
        return { type: 'boolean' };

      case 'object':
        if (Array.isArray(value)) {
          if (value.length > 0) {
            const itemTypes = value.map(item => this.inferType(item));
            const firstType = itemTypes[0];
            if (itemTypes.every(t => JSON.stringify(t) === JSON.stringify(firstType))) {
              return { type: 'array', items: firstType };
            }
          }
          return { type: 'array', items: {} };
        }
        return {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, this.inferType(v)])
          ),
        };

      default:
        return { type: type };
    }
  }

  private isDateString(value: string): boolean {
    return !isNaN(Date.parse(value)) || /^\d{4}-\d{2}-\d{2}/.test(value);
  }

  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private isUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  async streamParse(source: string, format?: DataFormat): Promise<Readable> {
    if (!format) {
      format = await this.detectFormat(source);
    }

    switch (format) {
      case 'csv':
        return this.createCSVStream(source);
      case 'json':
        return this.createJSONStream(source);
      case 'parquet':
        return this.createParquetStream(source);
      case 'excel':
        throw new Error('Streaming not supported for Excel format');
      default:
        throw new Error(`Unsupported format for streaming: ${format}`);
    }
  }

  private createCSVStream(source: string): Readable {
    const stream = createReadStream(source);
    const { stream: memoryStream, data } = createMemoryStream();
    stream.pipe(memoryStream);

    const parser = Papa.parse(data[0], {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    const resultStream = new Readable({
      objectMode: true,
      read() {},
    });

    parser.on('data', (row: any) => {
      resultStream.push(row);
    });

    parser.on('end', () => {
      resultStream.push(null);
    });

    parser.on('error', (error) => {
      resultStream.destroy(new Error(`CSV stream error: ${error.message}`));
    });

    return resultStream;
  }

  private createJSONStream(source: string): Readable {
    const stream = createReadStream(source, { encoding: 'utf8' });
    let buffer = '';
    let inArray = false;
    let objectStart = 0;

    const resultStream = new Readable({
      objectMode: true,
      read() {},
    });

    stream.on('data', (chunk: string) => {
      buffer += chunk;
      processBuffer();
    });

    stream.on('end', () => {
      if (buffer.trim()) {
        try {
          const remaining = JSON.parse(buffer);
          if (Array.isArray(remaining)) {
            remaining.forEach(item => resultStream.push(item));
          } else {
            resultStream.push(remaining);
          }
        } catch {
          resultStream.destroy(new Error('Incomplete JSON data'));
        }
      }
      resultStream.push(null);
    });

    stream.on('error', (error) => {
      resultStream.destroy(error);
    });

    function processBuffer() {
      const arrayStart = buffer.indexOf('[');
      if (arrayStart !== -1 && !inArray) {
        inArray = true;
        buffer = buffer.slice(arrayStart + 1);
      }

      while (inArray) {
        let braceLevel = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '\\' && inString) {
            escapeNext = true;
            continue;
          }

          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === '{') {
              if (braceLevel === 0) {
                objectStart = i;
              }
              braceLevel++;
            } else if (char === '}') {
              braceLevel--;
              if (braceLevel === 0) {
                try {
                  const jsonString = buffer.slice(0, i + 1);
                  const obj = JSON.parse(jsonString);
                  resultStream.push(obj);
                  buffer = buffer.slice(i + 1);
                  break;
                } catch {
                  continue;
                }
              }
            } else if (char === ',' && braceLevel === 0) {
              try {
                const jsonString = buffer.slice(0, i);
                if (jsonString.trim()) {
                  const obj = JSON.parse(jsonString);
                  resultStream.push(obj);
                }
                buffer = buffer.slice(i + 1);
                break;
              } catch {
                continue;
              }
            }
          }
        }
      }
    }

    return resultStream;
  }

  private async createParquetStream(source: string): Promise<Readable> {
    const reader = await ParquetReader.openFile(source);
    const cursor = await reader.getCursor();

    const resultStream = new Readable({
      objectMode: true,
      read() {},
    });

    const processNext = async () => {
      try {
        const record = await cursor.next();
        if (record) {
          resultStream.push(record);
          setImmediate(processNext);
        } else {
          resultStream.push(null);
        }
      } catch (error) {
        resultStream.destroy(error as Error);
      }
    };

    processNext();

    return resultStream;
  }
}