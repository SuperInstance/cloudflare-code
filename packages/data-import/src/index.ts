export { FormatParser, type ParseResult } from './formats';
export { DataValidator, type ValidationContext } from './validator';
export { DataTransformer, TransformationPipeline, type TransformationResult, type TransformationContext } from './transform';
export { ImportProcessor, type ImportResult, type ProcessorOptions } from './processor';
export { ImportScheduler, type ScheduledJob, type SchedulingOptions, BulkOperation, type BulkOperationResult } from './scheduler';
export { ImportAnalytics } from './analytics';
export * from './types';
export * from './utils';

export { createDataImportSystem } from './system';

import { FormatParser } from './formats';
import { DataValidator } from './validator';
import { DataTransformer } from './transform';
import { ImportProcessor } from './processor';
import { ImportScheduler, BulkOperation } from './scheduler';
import { ImportAnalytics } from './analytics';

export interface DataImportSystemConfig {
  processorOptions?: import('./processor').ProcessorOptions;
  schedulingOptions?: import('./scheduler').SchedulingOptions;
  enableAnalytics?: boolean;
  enableRealtimeProgress?: boolean;
}

export class DataImportSystem {
  private parser: FormatParser;
  private validator: DataValidator;
  private transformer: DataTransformer;
  private processor: ImportProcessor;
  private scheduler: ImportScheduler;
  private analytics: ImportAnalytics;

  constructor(config: DataImportSystemConfig = {}) {
    this.parser = new FormatParser();
    this.validator = new DataValidator();
    this.transformer = new DataTransformer();

    this.processor = new ImportProcessor({
      batchSize: 1000,
      maxConcurrentJobs: 5,
      enableRealtimeProgress: config.enableRealtimeProgress ?? true,
      ...config.processorOptions,
    });

    this.scheduler = new ImportScheduler(this.processor, config.schedulingOptions);

    if (config.enableAnalytics) {
      this.analytics = new ImportAnalytics();
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.processor.on('jobCompleted', (data) => {
      if (this.analytics) {
        this.analytics.recordJobCompletion(
          data.result.job,
          data.result.totalProcessingTime,
          0,
          0
        );
      }
    });

    this.processor.on('jobFailed', (data) => {
      if (this.analytics) {
        this.analytics.recordError(data.error.message || 'Unknown error');
      }
    });
  }

  get parser() {
    return this.parser;
  }

  get validator() {
    return this.validator;
  }

  get transformer() {
    return this.transformer;
  }

  get processor() {
    return this.processor;
  }

  get scheduler() {
    return this.scheduler;
  }

  get analytics() {
    return this.analytics;
  }

  async importFile(
    filePath: string,
    format?: import('./types').DataFormat,
    config?: import('./types').ImportConfig
  ): Promise<string> {
    const job: import('./types').ImportJob = {
      name: `Import from ${filePath}`,
      source: {
        type: 'file',
        format: format || 'csv',
        path: filePath,
      },
      config: config || {},
      status: 'pending',
      progress: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.analytics) {
      this.analytics.recordJobStart(job);
    }

    return this.processor.startJob(job);
  }

  async bulkImport(
    files: Array<{ path: string; format?: import('./types').DataFormat; config?: import('./types').ImportConfig }>
  ): Promise<BulkOperation> {
    const bulkOperation = new BulkOperation();

    files.forEach(file => {
      const job: import('./types').ImportJob = {
        name: `Import from ${file.path}`,
        source: {
          type: 'file',
          format: file.format || 'csv',
          path: file.path,
        },
        config: file.config || {},
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      bulkOperation.addImport(job);
    });

    return bulkOperation;
  }

  scheduleImport(
    filePath: string,
    cronExpression: string,
    format?: import('./types').DataFormat,
    options?: {
      description?: string;
      maxRuns?: number;
      tags?: string[];
    }
  ): string {
    const job: import('./types').ImportJob = {
      name: `Scheduled Import from ${filePath}`,
      source: {
        type: 'file',
        format: format || 'csv',
        path: filePath,
      },
      config: {},
      status: 'pending',
      progress: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.scheduler.scheduleJob(job, cronExpression, options);
  }

  getSystemStats() {
    return {
      processor: this.processor.getStats(),
      scheduler: this.scheduler.getSchedulerStats(),
      ...(this.analytics && { analytics: this.analytics.getHealthMetrics() }),
    };
  }

  cleanup(): void {
    this.processor.cleanup();
    this.scheduler.cleanup();
  }
}

export function createDataImportSystem(config?: DataImportSystemConfig): DataImportSystem {
  return new DataImportSystem(config);
}

export default createDataImportSystem;