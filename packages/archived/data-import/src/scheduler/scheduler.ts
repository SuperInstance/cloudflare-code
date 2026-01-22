// @ts-nocheck - External dependency (cron) doesn't have TypeScript types
import { EventEmitter } from 'events';
import { CronJob } from 'cron';
import { ImportJob, JobStatus } from '../types';
import { generateId } from '../utils';
import { ImportProcessor } from '../processor';

export interface ScheduledJob {
  id: string;
  jobId: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  maxRuns?: number;
  metadata: {
    description?: string;
    tags?: string[];
    createdBy?: string;
    createdAt: Date;
  };
}

export interface SchedulingOptions {
  timezone?: string;
  maxConcurrentScheduledJobs?: number;
  retryInterval?: number;
  enableLogging?: boolean;
}

export class ImportScheduler extends EventEmitter {
  private scheduledJobs = new Map<string, ScheduledJob>();
  private cronJobs = new Map<string, CronJob>();
  private processor: ImportProcessor;
  private options: Required<SchedulingOptions>;
  private retryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    processor: ImportProcessor,
    options: SchedulingOptions = {}
  ) {
    super();
    this.processor = processor;
    this.options = {
      timezone: 'UTC',
      maxConcurrentScheduledJobs: 10,
      retryInterval: 300000,
      enableLogging: true,
      ...options,
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.processor.on('jobCompleted', ({ jobId }) => {
      const scheduledJob = Array.from(this.scheduledJobs.values()).find(
        job => job.jobId === jobId
      );
      if (scheduledJob) {
        this.onScheduledJobCompleted(scheduledJob);
      }
    });

    this.processor.on('jobFailed', ({ jobId }) => {
      const scheduledJob = Array.from(this.scheduledJobs.values()).find(
        job => job.jobId === jobId
      );
      if (scheduledJob) {
        this.onScheduledJobFailed(scheduledJob);
      }
    });
  }

  scheduleJob(
    job: ImportJob,
    cronExpression: string,
    options: {
      id?: string;
      description?: string;
      tags?: string[];
      maxRuns?: number;
      createdBy?: string;
    } = {}
  ): string {
    const scheduledJobId = options.id || generateId();
    const enabled = job.status !== 'cancelled';

    const scheduledJob: ScheduledJob = {
      id: scheduledJobId,
      jobId: job.id,
      cronExpression,
      enabled,
      runCount: 0,
      nextRun: this.calculateNextRun(cronExpression),
      metadata: {
        description: options.description,
        tags: options.tags || [],
        createdBy: options.createdBy,
        createdAt: new Date(),
      },
      maxRuns: options.maxRuns,
    };

    if (this.scheduledJobs.has(scheduledJobId)) {
      throw new Error(`Scheduled job with ID ${scheduledJobId} already exists`);
    }

    this.scheduledJobs.set(scheduledJobId, scheduledJob);
    this.createCronJob(scheduledJob);

    if (this.options.enableLogging) {
      console.log(`Scheduled job created: ${scheduledJobId} with cron ${cronExpression}`);
    }

    this.emit('scheduledJobCreated', scheduledJob);
    return scheduledJobId;
  }

  private createCronJob(scheduledJob: ScheduledJob): void {
    const cronJob = new CronJob(
      scheduledJob.cronExpression,
      () => {
        this.executeScheduledJob(scheduledJob).catch(error => {
          this.emit('scheduledJobFailed', { ...scheduledJob, error });
        });
      },
      null,
      true,
      this.options.timezone
    );

    this.cronJobs.set(scheduledJob.id, cronJob);
  }

  private async executeScheduledJob(scheduledJob: ScheduledJob): Promise<void> {
    if (!scheduledJob.enabled) {
      return;
    }

    const job = this.processor.getJob(scheduledJob.jobId);
    if (!job) {
      throw new Error(`Job ${scheduledJob.jobId} not found`);
    }

    scheduledJob.lastRun = new Date();
    scheduledJob.runCount++;
    scheduledJob.nextRun = this.calculateNextRun(scheduledJob.cronExpression);

    this.scheduledJobs.set(scheduledJob.id, scheduledJob);

    if (scheduledJob.maxRuns && scheduledJob.runCount >= scheduledJob.maxRuns) {
      this.removeScheduledJob(scheduledJob.id);
      this.emit('scheduledJobCompleted', { ...scheduledJob, maxRunsReached: true });
      return;
    }

    try {
      const jobId = await this.processor.startJob(job);
      scheduledJob.jobId = jobId;
      this.scheduledJobs.set(scheduledJob.id, scheduledJob);

      this.emit('scheduledJobStarted', { ...scheduledJob, jobId });
    } catch (error) {
      throw new Error(`Failed to execute scheduled job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  unscheduleJob(scheduledJobId: string): boolean {
    const scheduledJob = this.scheduledJobs.get(scheduledJobId);
    if (!scheduledJob) {
      return false;
    }

    const cronJob = this.cronJobs.get(scheduledJobId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(scheduledJobId);
    }

    this.scheduledJobs.delete(scheduledJobId);

    if (this.options.enableLogging) {
      console.log(`Scheduled job unscheduled: ${scheduledJobId}`);
    }

    this.emit('scheduledJobRemoved', scheduledJob);
    return true;
  }

  enableScheduledJob(scheduledJobId: string): boolean {
    const scheduledJob = this.scheduledJobs.get(scheduledJobId);
    if (!scheduledJob) {
      return false;
    }

    scheduledJob.enabled = true;
    scheduledJob.nextRun = this.calculateNextRun(scheduledJob.cronExpression);
    this.scheduledJobs.set(scheduledJobId, scheduledJob);

    const cronJob = this.cronJobs.get(scheduledJobId);
    if (cronJob) {
      cronJob.start();
    }

    if (this.options.enableLogging) {
      console.log(`Scheduled job enabled: ${scheduledJobId}`);
    }

    this.emit('scheduledJobEnabled', scheduledJob);
    return true;
  }

  disableScheduledJob(scheduledJobId: string): boolean {
    const scheduledJob = this.scheduledJobs.get(scheduledJobId);
    if (!scheduledJob) {
      return false;
    }

    scheduledJob.enabled = false;
    scheduledJob.nextRun = undefined;
    this.scheduledJobs.set(scheduledJobId, scheduledJob);

    const cronJob = this.cronJobs.get(scheduledJobId);
    if (cronJob) {
      cronJob.stop();
    }

    if (this.options.enableLogging) {
      console.log(`Scheduled job disabled: ${scheduledJobId}`);
    }

    this.emit('scheduledJobDisabled', scheduledJob);
    return true;
  }

  updateCronExpression(scheduledJobId: string, newCronExpression: string): boolean {
    const scheduledJob = this.scheduledJobs.get(scheduledJobId);
    if (!scheduledJob) {
      return false;
    }

    const cronJob = this.cronJobs.get(scheduledJobId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(scheduledJobId);
    }

    scheduledJob.cronExpression = newCronExpression;
    scheduledJob.nextRun = this.calculateNextRun(newCronExpression);
    this.scheduledJobs.set(scheduledJobId, scheduledJob);

    this.createCronJob(scheduledJob);

    if (this.options.enableLogging) {
      console.log(`Scheduled job cron updated: ${scheduledJobId} to ${newCronExpression}`);
    }

    this.emit('scheduledJobUpdated', scheduledJob);
    return true;
  }

  private calculateNextRun(cronExpression: string): Date {
    const cronJob = new CronJob(
      cronExpression,
      () => {},
      null,
      true,
      this.options.timezone
    );

    const nextRun = cronJob.nextDates(1)[0];
    cronJob.stop();

    return nextRun;
  }

  private onScheduledJobCompleted(scheduledJob: ScheduledJob): void {
    if (this.options.enableLogging) {
      console.log(`Scheduled job completed: ${scheduledJob.id}`);
    }

    scheduledJob.lastRun = new Date();
    scheduledJob.nextRun = this.calculateNextRun(scheduledJob.cronExpression);
    this.scheduledJobs.set(scheduledJob.id, scheduledJob);

    this.emit('scheduledJobCompleted', scheduledJob);

    if (scheduledJob.maxRuns && scheduledJob.runCount >= scheduledJob.maxRuns) {
      this.removeScheduledJob(scheduledJob.id);
    }
  }

  private onScheduledJobFailed(scheduledJob: ScheduledJob): void {
    if (this.options.enableLogging) {
      console.log(`Scheduled job failed: ${scheduledJob.id}, will retry in ${this.options.retryInterval}ms`);
    }

    const timer = setTimeout(() => {
      this.executeScheduledJob(scheduledJob).catch(error => {
        this.emit('scheduledJobFailed', { ...scheduledJob, error });
      });
      this.retryTimers.delete(scheduledJob.id);
    }, this.options.retryInterval);

    this.retryTimers.set(scheduledJob.id, timer);
  }

  getScheduledJobs(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values());
  }

  getScheduledJob(scheduledJobId: string): ScheduledJob | undefined {
    return this.scheduledJobs.get(scheduledJobId);
  }

  getEnabledScheduledJobs(): ScheduledJob[] {
    return this.getScheduledJobs().filter(job => job.enabled);
  }

  getRunningScheduledJobs(): ScheduledJob[] {
    return this.getSchedulerStats().running;
  }

  getSchedulerStats(): {
    totalScheduledJobs: number;
    enabledScheduledJobs: number;
    disabledScheduledJobs: number;
    runningScheduledJobs: number;
    nextRunScheduledJobs: ScheduledJob[];
    mostRecentRun?: Date;
    totalRuns: number;
    failedRuns: number;
  } {
    const jobs = this.getScheduledJobs();
    const enabled = jobs.filter(job => job.enabled);
    const disabled = jobs.filter(job => !job.enabled);
    const running = this.getRunningScheduledJobs();

    const nextRunJobs = jobs
      .filter(job => job.nextRun)
      .sort((a, b) => a.nextRun!.getTime() - b.nextRun!.getTime())
      .slice(0, 10);

    const mostRecentRun = jobs.length > 0
      ? jobs.reduce((latest, job) =>
          job.lastRun && (!latest || job.lastRun > latest) ? job.lastRun : latest
        , undefined as Date | undefined)
      : undefined;

    return {
      totalScheduledJobs: jobs.length,
      enabledScheduledJobs: enabled.length,
      disabledScheduledJobs: disabled.length,
      runningScheduledJobs: running.length,
      nextRunScheduledJobs: nextRunJobs,
      mostRecentRun,
      totalRuns: jobs.reduce((sum, job) => sum + job.runCount, 0),
      failedRuns: this.retryTimers.size,
    };
  }

  validateCronExpression(cronExpression: string): { valid: boolean; error?: string } {
    try {
      const testJob = new CronJob(
        cronExpression,
        () => {},
        null,
        false
      );
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Invalid cron expression' };
    }
  }

  cleanup(): void {
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    for (const cronJob of this.cronJobs.values()) {
      cronJob.stop();
    }
    this.cronJobs.clear();

    this.scheduledJobs.clear();
    this.removeAllListeners();
  }
}

export class BulkOperation {
  private operations: Array<{
    type: 'import' | 'transform' | 'validate';
    data: any;
    options?: any;
  }> = [];
  private results: Array<{
    success: boolean;
    data?: any;
    error?: string;
  }> = [];

  addImport(job: ImportJob): void {
    this.operations.push({
      type: 'import',
      data: job,
    });
  }

  addTransformation(data: any, options?: any): void {
    this.operations.push({
      type: 'transform',
      data,
      options,
    });
  }

  addValidation(data: any, options?: any): void {
    this.operations.push({
      type: 'validate',
      data,
      options,
    });
  }

  async execute(
    processor: ImportProcessor,
    transformer: any,
    validator: any
  ): Promise<BulkOperationResult> {
    const startTime = performance.now();
    this.results = [];

    for (let i = 0; i < this.operations.length; i++) {
      const operation = this.operations[i];
      const result = await this.executeOperation(operation, processor, transformer, validator, i);
      this.results.push(result);
    }

    const endTime = performance.now();
    const successRate = this.results.filter(r => r.success).length / this.results.length;

    return {
      operationCount: this.operations.length,
      executedOperations: this.results.length,
      successRate: Math.round(successRate * 100) / 100,
      totalProcessingTime: endTime - startTime,
      results: this.results,
      summary: this.generateSummary(),
    };
  }

  private async executeOperation(
    operation: any,
    processor: ImportProcessor,
    transformer: any,
    validator: any,
    index: number
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      let result: any;

      switch (operation.type) {
        case 'import':
          const jobId = await processor.startJob(operation.data);
          result = { jobId, operation: index };
          break;
        case 'transform':
          result = await transformer.transformRecords(operation.data, operation.options.rules || []);
          break;
        case 'validate':
          result = await validator.validateRecords(operation.data, operation.options.rules || []);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private generateSummary(): string {
    const successCount = this.results.filter(r => r.success).length;
    const failureCount = this.results.length - successCount;
    const successRate = Math.round((successCount / this.results.length) * 100);

    return `Bulk operation completed: ${successCount} succeeded, ${failureCount} failed (${successRate}% success rate)`;
  }

  getOperations(): any[] {
    return [...this.operations];
  }

  getResults(): any[] {
    return [...this.results];
  }

  clear(): void {
    this.operations = [];
    this.results = [];
  }
}

export interface BulkOperationResult {
  operationCount: number;
  executedOperations: number;
  successRate: number;
  totalProcessingTime: number;
  results: Array<{
    success: boolean;
    data?: any;
    error?: string;
  }>;
  summary: string;
}