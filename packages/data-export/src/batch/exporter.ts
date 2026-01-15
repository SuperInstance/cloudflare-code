import { EventEmitter } from 'eventemitter3';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ExportRecord,
  ExportOptions,
  BatchOptions,
  ExportJob,
  BatchResult,
  ExportResult,
  FormatEngine
} from '../types';
import { FormatEngineImpl } from '../formats/engine';
import { MemoryMonitorImpl, createMemoryAwareChunker } from '../utils/memory';

export interface BatchProgress {
  jobId: string;
  currentChunk: number;
  totalChunks: number;
  processedRecords: number;
  totalRecords: number;
  speed: number; // records per second
  estimatedTimeRemaining: number; // seconds
  memoryUsage: number;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
}

export class BatchExporter extends EventEmitter {
  private formatEngine: FormatEngine;
  private memoryMonitor: MemoryMonitorImpl;
  private activeJobs: Map<string, ExportJob> = new Map();
  private jobProgress: Map<string, BatchProgress> = new Map();

  constructor(
    formatEngine?: FormatEngine,
    memoryLimit: number = 1024 * 1024 * 500 // 500MB default
  ) {
    super();
    this.formatEngine = formatEngine || new FormatEngineImpl();
    this.memoryMonitor = new MemoryMonitorImpl(memoryLimit);

    this.setupMemoryMonitoring();
  }

  private setupMemoryMonitoring(): void {
    this.memoryMonitor.onMemoryLimit(() => {
      this.emit('memory-limit-exceeded');
      this.cancelAllJobs();
    });
  }

  async export(
    data: ExportRecord[],
    options: ExportOptions,
    batchOptions?: BatchOptions
  ): Promise<BatchResult> {
    const jobId = this.generateJobId();
    const startTime = Date.now();

    const job: ExportJob = {
      id: jobId,
      name: options.sheetName || `batch-export-${jobId}`,
      data,
      options,
      status: 'pending',
      progress: 0,
      startTime: new Date()
    };

    this.activeJobs.set(jobId, job);
    this.emit('job-start', job);

    try {
      const chunkSize = batchOptions?.chunkSize || this.calculateOptimalChunkSize(data.length, batchOptions?.memoryLimit);
      const chunks = createMemoryAwareChunker(data, (batchOptions?.memoryLimit || 100) / (1024 * 1024));
      const maxChunks = batchOptions?.maxChunks || chunks.length;

      const progress: BatchProgress = {
        jobId,
        currentChunk: 0,
        totalChunks: Math.min(chunks.length, maxChunks),
        processedRecords: 0,
        totalRecords: data.length,
        speed: 0,
        estimatedTimeRemaining: 0,
        memoryUsage: 0,
        status: 'processing'
      };

      this.jobProgress.set(jobId, progress);
      this.emit('job-progress', progress);

      job.status = 'processing';
      this.activeJobs.set(jobId, job);

      const processedChunks: any[] = [];
      const results: ExportResult[] = [];
      const errors: Error[] = [];
      let totalProcessedRecords = 0;

      for (let i = 0; i < Math.min(chunks.length, maxChunks); i++) {
        if (this.isJobCancelled(jobId)) {
          throw new Error('Job cancelled');
        }

        const chunk = chunks[i];
        const chunkStartTime = Date.now();

        try {
          const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `export-${jobId}-chunk-${i}-`));
          const chunkOptions = { ...options };

          const result = await this.formatEngine.export(chunk, chunkOptions);
          result.metadata = {
            ...result.metadata,
            chunkNumber: i + 1,
            totalChunks: Math.min(chunks.length, maxChunks)
          };

          results.push(result);
          processedChunks.push(result.path);
          totalProcessedRecords += chunk.length;

          progress.currentChunk = i + 1;
          progress.processedRecords = totalProcessedRecords;
          progress.speed = this.calculateSpeed(totalProcessedRecords, Date.now() - startTime);
          progress.estimatedTimeRemaining = this.calculateETA(progress.speed, data.length - totalProcessedRecords);
          progress.memoryUsage = this.memoryMonitor.getCurrentMemory();

          this.jobProgress.set(jobId, { ...progress });
          this.emit('chunk-complete', {
            chunkNumber: i + 1,
            chunkSize: chunk.length,
            duration: Date.now() - chunkStartTime,
            result
          });

          if (batchOptions?.progressInterval) {
            await this.delay(batchOptions.progressInterval);
          }

        } catch (error) {
          errors.push(error as Error);
          this.emit('chunk-error', { chunkNumber: i + 1, error });

          if (batchOptions?.retryAttempts && batchOptions.retryAttempts > 0) {
            await this.retryChunk(chunk, options, batchOptions, i, errors);
          }
        }
      }

      job.status = 'completed';
      job.endTime = new Date();
      job.progress = 100;
      job.result = this.mergeBatchResults(results, data.length);

      this.activeJobs.set(jobId, job);
      this.progress = { ...progress, status: 'completed' };
      this.jobProgress.set(jobId, this.progress);

      this.emit('job-complete', job);
      this.emit('batch-complete', {
        totalRecords: data.length,
        processedRecords: totalProcessedRecords,
        chunks: processedChunks.length,
        duration: Date.now() - startTime,
        results,
        errors
      });

      return {
        totalRecords: data.length,
        processedRecords: totalProcessedRecords,
        chunks: processedChunks.length,
        duration: Date.now() - startTime,
        results,
        errors
      };

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error instanceof Error ? error.message : String(error);

      this.activeJobs.set(jobId, job);
      this.emit('job-error', job);

      throw error;
    }
  }

  private async retryChunk(
    chunk: ExportRecord[],
    options: ExportOptions,
    batchOptions: BatchOptions,
    chunkNumber: number,
    errors: Error[]
  ): Promise<void> {
    const maxRetries = batchOptions.retryAttempts || 3;
    const retryDelay = batchOptions.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.emit('retry-attempt', { chunkNumber, attempt });
        await this.delay(retryDelay * attempt);

        const result = await this.formatEngine.export(chunk, options);
        this.emit('retry-success', { chunkNumber, attempt });
        return;
      } catch (error) {
        this.emit('retry-failure', { chunkNumber, attempt, error });
        if (attempt === maxRetries) {
          errors.push(error as Error);
        }
      }
    }
  }

  private mergeBatchResults(results: ExportResult[], totalRecords: number): ExportResult {
    if (results.length === 0) {
      throw new Error('No valid results to merge');
    }

    const firstResult = results[0];
    const totalSize = results.reduce((sum, result) => sum + result.size, 0);

    return {
      format: firstResult.format,
      size: totalSize,
      recordCount: totalRecords,
      path: 'batch-export-merged', // In a real implementation, this would be a merged file
      metadata: {
        ...firstResult.metadata,
        chunkCount: results.length,
        merged: true,
        originalPaths: results.map(r => r.path)
      }
    };
  }

  calculateOptimalChunkSize(
    totalRecords: number,
    memoryLimit?: number
  ): number {
    const targetMemory = memoryLimit || this.memoryMonitor.getMemoryLimit();
    const memoryPerRecord = 1024; // Conservative estimate: 1KB per record
    const safetyFactor = 0.7; // Use 70% of available memory

    return Math.floor((targetMemory * safetyFactor) / memoryPerRecord);
  }

  cancel(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    job.status = 'cancelled';
    job.endTime = new Date();
    this.activeJobs.set(jobId, job);

    const progress = this.jobProgress.get(jobId);
    if (progress) {
      progress.status = 'cancelled';
      this.jobProgress.set(jobId, progress);
    }

    this.emit('job-cancelled', job);
    this.emit('job-progress', progress);
    return true;
  }

  cancelAllJobs(): void {
    for (const [jobId] of this.activeJobs) {
      this.cancel(jobId);
    }
  }

  isJobCancelled(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    return job?.status === 'cancelled';
  }

  getStatus(jobId: string): ExportJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  getProgress(jobId: string): BatchProgress | null {
    return this.jobProgress.get(jobId) || null;
  }

  getAllJobs(): ExportJob[] {
    return Array.from(this.activeJobs.values());
  }

  async cleanup(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      // Clean up temporary files
      for (const result of job.result?.metadata?.originalPaths || []) {
        try {
          await fs.unlink(result);
        } catch (error) {
          // Ignore errors when cleaning up files
        }
      }

      this.activeJobs.delete(jobId);
      this.jobProgress.delete(jobId);
      this.emit('job-cleanup', job);
    } catch (error) {
      this.emit('cleanup-error', error);
    }
  }

  private generateJobId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateSpeed(processedRecords: number, duration: number): number {
    if (duration === 0) return 0;
    return processedRecords / (duration / 1000);
  }

  private calculateETA(speed: number, remainingRecords: number): number {
    if (speed === 0) return 0;
    return remainingRecords / speed;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateMemoryLimit(newLimit: number): void {
    this.memoryMonitor.setMemoryLimit(newLimit);
    this.emit('memory-limit-updated', { newLimit });
  }

  getMemoryUsage(): number {
    return this.memoryMonitor.getCurrentMemory();
  }

  isMemoryLimitExceeded(): boolean {
    return this.memoryMonitor.isMemoryLimitExceeded();
  }
}