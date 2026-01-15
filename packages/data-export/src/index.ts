export { FormatEngine } from './formats/engine';
export { BatchExporter } from './batch/exporter';
export { Scheduler } from './scheduler/scheduler';
export { DataProcessor } from './processor/processor';

// Type exports
export type {
  ExportRecord,
  ExportOptions,
  BatchOptions,
  SchedulerOptions,
  ProcessorOptions,
  Filter,
  Transformation,
  Schema,
  Aggregation,
  ExportJob,
  ExportResult,
  BatchResult,
  ScheduledExport,
  ExportFormat,
  CompressionType,
  FormatEngine as IFormatEngine,
  BatchExporter as IBatchExporter,
  Scheduler as IScheduler,
  DataProcessor as IDataProcessor,
  ExportAnalytics,
  ExportStats,
  FormatUsageStats,
  ErrorReport,
  NotificationConfig,
  ExportNotification
} from './types';

// Utility exports
export { MemoryMonitorImpl, createMemoryAwareChunker, calculateChunkSize, estimateRecordSize } from './utils/memory';

// Convenience class that combines all components
import { FormatEngineImpl } from './formats/engine';
import { BatchExporterImpl } from './batch/exporter';
import { SchedulerImpl } from './scheduler/scheduler';
import { DataProcessorImpl } from './processor/processor';

export class DataExportSystem {
  private formatEngine: FormatEngineImpl;
  private batchExporter: BatchExporterImpl;
  private scheduler: SchedulerImpl;
  private dataProcessor: DataProcessorImpl;

  constructor(options?: {
    memoryLimit?: number;
    maxConcurrent?: number;
  }) {
    this.formatEngine = new FormatEngineImpl();
    this.batchExporter = new BatchExporterImpl(this.formatEngine, options?.memoryLimit);
    this.scheduler = new SchedulerImpl(this.formatEngine, this.batchExporter, options?.maxConcurrent);
    this.dataProcessor = new DataProcessorImpl();
  }

  async export(
    data: any[],
    format: 'csv' | 'json' | 'parquet' | 'excel',
    options?: {
      delimiter?: string;
      prettyPrint?: boolean;
      compression?: 'none' | 'gzip' | 'snappy' | 'brotli';
      sheets?: string[];
      includeHeaders?: boolean;
      sheetName?: string;
    }
  ): Promise<any> {
    const exportOptions = {
      format,
      delimiter: options?.delimiter,
      prettyPrint: options?.prettyPrint,
      compression: options?.compression,
      sheets: options?.sheets,
      includeHeaders: options?.includeHeaders,
      sheetName: options?.sheetName
    };

    const result = await this.formatEngine.export(data, exportOptions);
    return result;
  }

  async batchExport(
    data: any[],
    format: 'csv' | 'json' | 'parquet' | 'excel',
    batchOptions?: {
      chunkSize?: number;
      maxChunks?: number;
      memoryLimit?: number;
      progressInterval?: number;
      retryAttempts?: number;
      retryDelay?: number;
    },
    exportOptions?: {
      delimiter?: string;
      prettyPrint?: boolean;
      compression?: 'none' | 'gzip' | 'snappy' | 'brotli';
      sheets?: string[];
      includeHeaders?: boolean;
      sheetName?: string;
    }
  ): Promise<any> {
    const options = {
      format,
      delimiter: exportOptions?.delimiter,
      prettyPrint: exportOptions?.prettyPrint,
      compression: exportOptions?.compression,
      sheets: exportOptions?.sheets,
      includeHeaders: exportOptions?.includeHeaders,
      sheetName: exportOptions?.sheetName
    };

    const result = await this.batchExporter.export(data, options, batchOptions);
    return result;
  }

  process(
    data: any[],
    options?: {
      filters?: Array<{
        field: string;
        operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startsWith' | 'endsWith';
        value: any;
      }>;
      transformations?: Array<{
        field: string;
        type: 'rename' | 'format' | 'calculate' | 'map' | 'filter' | 'split';
        options: any;
      }>;
      schema?: {
        [key: string]: {
          type: 'string' | 'number' | 'boolean' | 'date' | 'object';
          required?: boolean;
          format?: string;
          pattern?: string;
          min?: number;
          max?: number;
        };
      };
      columns?: string[];
      aggregation?: {
        type: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'group';
        field?: string;
        groupBy?: string[];
      };
    }
  ): Promise<any[]> {
    return this.dataProcessor.process(data, options || {});
  }

  schedule(
    name: string,
    config: {
      frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
      cronExpression?: string;
      time?: string;
      dayOfWeek?: number;
      dayOfMonth?: number;
      timezone?: string;
    },
    data: any[] | (() => Promise<any[]>)
  ): string {
    const scheduleConfig = {
      name,
      config,
      data,
      status: 'active' as const,
      history: []
    };

    return this.scheduler.schedule(scheduleConfig);
  }

  startScheduler(): void {
    this.scheduler.start();
  }

  stopScheduler(): void {
    this.scheduler.stop();
  }

  getStats() {
    return {
      formatEngine: this.formatEngine.getSupportedFormats(),
      schedulerStats: this.scheduler.getStats(),
      processorStats: this.dataProcessor.getStats()
    };
  }

  async shutdown(): Promise<void> {
    await this.scheduler.shutdown();
  }
}

// Factory function for easy instantiation
export function createDataExportSystem(options?: {
  memoryLimit?: number;
  maxConcurrent?: number;
}): DataExportSystem {
  return new DataExportSystem(options);
}

// Version
export const version = '1.0.0';

// Default export
export default DataExportSystem;