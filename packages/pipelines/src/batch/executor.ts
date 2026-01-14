/**
 * Batch Job Executor
 * Executes batch processing jobs with parallel processing and error handling
 */

import type {
  DataSource,
  DataDestination,
  TransformConfig,
  BatchJobConfig,
  ErrorHandlingConfig,
  ResourceLimitsConfig,
  ExecutionMetrics,
  PipelineError
} from '../types';

export interface BatchExecutorConfig {
  maxConcurrency?: number;
  maxRetries?: number;
  timeout?: number;
  progressCallback?: (progress: BatchProgress) => void;
}

export interface BatchProgress {
  jobId: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  percentage: number;
  startTime: Date;
}

export class BatchJobExecutor {
  private config: BatchExecutorConfig;
  private activeJobs: Map<string, BatchExecution> = new Map();
  private semaphore: Semaphore | null = null;

  constructor(config: BatchExecutorConfig = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency || 5,
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 300000, // 5 minutes
      progressCallback: config.progressCallback
    };

    if (this.config.maxConcurrency) {
      this.semaphore = new Semaphore(this.config.maxConcurrency);
    }
  }

  /**
   * Execute batch job
   */
  async execute(
    jobId: string,
    jobConfig: BatchJobConfig
  ): Promise<BatchResult> {
    const execution: BatchExecution = {
      jobId,
      status: 'running',
      startTime: new Date(),
      endTime: null,
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      errors: [],
      metrics: {
        throughput: 0,
        latency: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }
    };

    this.activeJobs.set(jobId, execution);

    try {
      // Apply resource limits if configured
      const resourceLimits = jobConfig.resourceLimits || {};
      if (resourceLimits.maxConcurrency) {
        this.semaphore = new Semaphore(resourceLimits.maxConcurrency);
      }

      // Fetch data from source
      const data = await this.fetchData(jobConfig.source);

      execution.recordsProcessed = data.length;

      // Process data in batches
      const batchSize = this.calculateBatchSize(data.length, resourceLimits);
      const batches = this.createBatches(data, batchSize);

      // Process batches with concurrency control
      const results = await this.processBatches(jobId, batches, jobConfig);

      // Aggregate results
      execution.recordsSucceeded = results.succeeded;
      execution.recordsFailed = results.failed;
      execution.errors = results.errors;

      execution.status = execution.recordsFailed === 0 ? 'completed' : 'completed';
      execution.endTime = new Date();

      // Calculate metrics
      const duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.metrics.throughput = execution.recordsProcessed / (duration / 1000);
      execution.metrics.latency = duration;

      return {
        status: execution.status,
        recordsProcessed: execution.recordsProcessed,
        recordsSucceeded: execution.recordsSucceeded,
        recordsFailed: execution.recordsFailed,
        errors: execution.errors,
        metrics: execution.metrics
      };
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();

      const errorObj: PipelineError = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };

      execution.errors.push(errorObj);

      throw error;
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Execute batch job with streaming
   */
  async *executeStream(
    jobId: string,
    jobConfig: BatchJobConfig
  ): AsyncGenerator<BatchRecordResult> {
    const execution: BatchExecution = {
      jobId,
      status: 'running',
      startTime: new Date(),
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      errors: [],
      metrics: {
        throughput: 0,
        latency: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }
    };

    this.activeJobs.set(jobId, execution);

    try {
      // Stream data from source
      const dataStream = await this.streamData(jobConfig.source);

      for await (const record of dataStream) {
        // Acquire semaphore if configured
        if (this.semaphore) {
          await this.semaphore.acquire();
        }

        try {
          // Process record
          const result = await this.processRecord(record, jobConfig);

          if (result.success) {
            execution.recordsSucceeded++;
          } else {
            execution.recordsFailed++;
            if (result.error) {
              execution.errors.push(result.error);
            }
          }

          execution.recordsProcessed++;

          // Report progress
          this.reportProgress(jobId, execution);

          yield result;
        } finally {
          // Release semaphore
          if (this.semaphore) {
            this.semaphore.release();
          }
        }
      }

      execution.status = 'completed';
      execution.endTime = new Date();
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      throw error;
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Cancel running job
   */
  cancel(jobId: string): void {
    const execution = this.activeJobs.get(jobId);
    if (execution) {
      execution.status = 'cancelled';
      execution.endTime = new Date();
    }
  }

  /**
   * Get job status
   */
  getStatus(jobId: string): BatchExecution | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Fetch data from source
   */
  private async fetchData(source: DataSource): Promise<unknown[]> {
    // In a real implementation, this would use the data ingestion layer
    // For now, return empty array
    return [];
  }

  /**
   * Stream data from source
   */
  private async *streamData(source: DataSource): AsyncGenerator<unknown> {
    // In a real implementation, this would use the data ingestion layer
    // For now, yield nothing
    return;
  }

  /**
   * Process batches
   */
  private async processBatches(
    jobId: string,
    batches: unknown[][],
    jobConfig: BatchJobConfig
  ): Promise<{ succeeded: number; failed: number; errors: PipelineError[] }> {
    let succeeded = 0;
    let failed = 0;
    const errors: PipelineError[] = [];

    for (const [index, batch] of batches.entries()) {
      // Acquire semaphore if configured
      if (this.semaphore) {
        await this.semaphore.acquire();
      }

      try {
        // Process batch
        const results = await this.processBatch(batch, jobConfig);

        for (const result of results) {
          if (result.success) {
            succeeded++;
          } else {
            failed++;
            if (result.error) {
              errors.push(result.error);
            }
          }
        }

        // Report progress
        const execution = this.activeJobs.get(jobId);
        if (execution) {
          execution.recordsProcessed += batch.length;
          execution.recordsSucceeded += succeeded;
          execution.recordsFailed += failed;
          this.reportProgress(jobId, execution);
        }
      } finally {
        // Release semaphore
        if (this.semaphore) {
          this.semaphore.release();
        }
      }
    }

    return { succeeded, failed, errors };
  }

  /**
   * Process batch
   */
  private async processBatch(
    batch: unknown[],
    jobConfig: BatchJobConfig
  ): Promise<BatchRecordResult[]> {
    const results: BatchRecordResult[] = [];

    for (const record of batch) {
      try {
        const result = await this.processRecord(record, jobConfig);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: {
            code: 'RECORD_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          }
        });
      }
    }

    return results;
  }

  /**
   * Process single record
   */
  private async processRecord(
    record: unknown,
    jobConfig: BatchJobConfig
  ): Promise<BatchRecordResult> {
    try {
      // Apply transforms
      let transformed = record;
      for (const transform of jobConfig.transforms) {
        transformed = await this.applyTransform(transformed, transform);
      }

      // Write to destination
      await this.writeToDestination(transformed, jobConfig.destination);

      return { success: true, record: transformed };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TRANSFORM_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Apply transform to record
   */
  private async applyTransform(
    record: unknown,
    transform: TransformConfig
  ): Promise<unknown> {
    // In a real implementation, this would apply the actual transform
    return record;
  }

  /**
   * Write record to destination
   */
  private async writeToDestination(
    record: unknown,
    destination: DataDestination
  ): Promise<void> {
    // In a real implementation, this would write to the actual destination
  }

  /**
   * Calculate batch size based on resource limits
   */
  private calculateBatchSize(totalRecords: number, limits: ResourceLimitsConfig): number {
    if (limits.maxMemory) {
      // Estimate memory per record and calculate batch size
      const estimatedSizePerRecord = 1024; // 1KB estimate
      const maxSize = Math.floor(limits.maxMemory / estimatedSizePerRecord);
      return Math.min(1000, maxSize);
    }

    return 1000; // Default batch size
  }

  /**
   * Create batches from data
   */
  private createBatches(data: unknown[], batchSize: number): unknown[][] {
    const batches: unknown[][] = [];

    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Report progress
   */
  private reportProgress(jobId: string, execution: BatchExecution): void {
    if (this.config.progressCallback) {
      const progress: BatchProgress = {
        jobId,
        total: execution.recordsProcessed + execution.recordsSucceeded + execution.recordsFailed,
        processed: execution.recordsProcessed,
        succeeded: execution.recordsSucceeded,
        failed: execution.recordsFailed,
        percentage: (execution.recordsProcessed /
          (execution.recordsProcessed + execution.recordsSucceeded + execution.recordsFailed || 1)) * 100,
        startTime: execution.startTime
      };

      this.config.progressCallback(progress);
    }
  }
}

/**
 * Batch execution state
 */
interface BatchExecution {
  jobId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime: Date | null;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  errors: PipelineError[];
  metrics: ExecutionMetrics;
}

/**
 * Batch result
 */
export interface BatchResult {
  status: 'completed' | 'failed';
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  errors: PipelineError[];
  metrics: ExecutionMetrics;
}

/**
 * Batch record result
 */
export interface BatchRecordResult {
  success: boolean;
  record?: unknown;
  error?: PipelineError;
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<(permit: () => void) => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waitQueue.push(() => {
        this.permits--;
        resolve();
      });
    });
  }

  release(): void {
    this.permits++;

    const next = this.waitQueue.shift();
    if (next) {
      next();
    }
  }
}
