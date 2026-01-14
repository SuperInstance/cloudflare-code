/**
 * Batch Job Scheduler
 * Schedules and manages batch processing jobs with cron support
 */

import type {
  ScheduleConfig,
  ScheduleType,
  BatchJob,
  BatchJobConfig,
  BatchJobStatus,
  BatchJobRun
} from '../types';

export interface ScheduledJob {
  id: string;
  config: BatchJobConfig;
  nextRun: Date | null;
  lastRun: Date | null;
  runCount: number;
  status: BatchJobStatus;
}

export class BatchScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private runs: Map<string, BatchJobRun[]> = new Map();
  private timers: Map<string, number> = new Map();
  private isRunning = false;

  /**
   * Add a batch job
   */
  addJob(job: BatchJob): void {
    const scheduledJob: ScheduledJob = {
      id: job.id,
      config: job.config,
      nextRun: this.calculateNextRun(job.config.schedule),
      lastRun: null,
      runCount: 0,
      status: 'scheduled'
    };

    this.jobs.set(job.id, scheduledJob);
    this.runs.set(job.id, []);

    if (this.isRunning) {
      this.scheduleJob(job.id);
    }
  }

  /**
   * Remove a batch job
   */
  removeJob(jobId: string): void {
    const timer = this.timers.get(jobId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }

    this.jobs.delete(jobId);
    this.runs.delete(jobId);
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Schedule all jobs
    for (const jobId of this.jobs.keys()) {
      this.scheduleJob(jobId);
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.isRunning = false;

    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
  }

  /**
   * Get job status
   */
  getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job runs
   */
  getJobRuns(jobId: string): BatchJobRun[] {
    return this.runs.get(jobId) || [];
  }

  /**
   * Trigger a job manually
   */
  async triggerJob(jobId: string): Promise<BatchJobRun> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return this.executeJob(jobId);
  }

  /**
   * Schedule a job
   */
  private scheduleJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || !job.nextRun) {
      return;
    }

    // Clear existing timer
    const existingTimer = this.timers.get(jobId);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    // Calculate delay until next run
    const now = Date.now();
    const nextRunTime = job.nextRun.getTime();
    const delay = nextRunTime - now;

    if (delay <= 0) {
      // Run immediately
      this.executeJob(jobId);
      return;
    }

    // Schedule next run
    const timer = setTimeout(() => {
      this.executeJob(jobId);
    }, delay);

    this.timers.set(jobId, timer as unknown as number);
  }

  /**
   * Execute a job
   */
  private async executeJob(jobId: string): Promise<BatchJobRun> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = 'running';
    job.lastRun = new Date();
    job.runCount++;

    const run: BatchJobRun = {
      runId: `${jobId}-${job.runCount}`,
      startTime: new Date(),
      status: 'running',
      inputRecords: 0,
      outputRecords: 0,
      errorRecords: 0,
      metrics: {
        throughput: 0,
        latency: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }
    };

    const runs = this.runs.get(jobId) || [];
    runs.push(run);
    this.runs.set(jobId, runs);

    try {
      // Execute the job
      const executor = new BatchJobExecutor(job.config);
      const result = await executor.execute();

      // Update run with results
      run.status = 'completed';
      run.endTime = new Date();
      run.inputRecords = result.inputRecords;
      run.outputRecords = result.outputRecords;
      run.errorRecords = result.errorRecords;
      run.metrics = result.metrics;

      job.status = 'scheduled';
    } catch (error) {
      run.status = 'failed';
      run.endTime = new Date();
      job.status = 'failed';
    }

    // Calculate next run
    job.nextRun = this.calculateNextRun(job.config.schedule);

    // Reschedule if next run exists
    if (job.nextRun && this.isRunning) {
      this.scheduleJob(jobId);
    }

    return run;
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRun(schedule: ScheduleConfig): Date | null {
    const now = new Date();

    switch (schedule.type) {
      case 'interval':
        if (schedule.interval) {
          return new Date(now.getTime() + schedule.interval);
        }
        return null;

      case 'cron':
        if (schedule.expression) {
          return this.parseCronExpression(schedule.expression, now);
        }
        return null;

      case 'event-driven':
        // Event-driven jobs don't have scheduled runs
        return null;

      case 'manual':
        // Manual jobs don't have scheduled runs
        return null;

      default:
        return null;
    }
  }

  /**
   * Parse cron expression and calculate next run time
   * Simplified implementation - for production, use a proper cron library
   */
  private parseCronExpression(expression: string, from: Date): Date {
    // Cron expression format: minute hour day month day-of-week
    // Simplified implementation - supports basic patterns
    const parts = expression.split(' ');
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${expression}`);
    }

    const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;

    const next = new Date(from);

    // Parse minute
    if (minutePart !== '*') {
      const minutes = this.parseCronField(minutePart, 0, 59);
      const currentMinute = next.getMinutes();
      const nextMinute = minutes.find(m => m > currentMinute) || minutes[0];

      if (nextMinute <= currentMinute) {
        next.setHours(next.getHours() + 1);
      }
      next.setMinutes(nextMinute);
    }

    // Parse hour
    if (hourPart !== '*') {
      const hours = this.parseCronField(hourPart, 0, 23);
      const currentHour = next.getHours();
      const nextHour = hours.find(h => h > currentHour) || hours[0];

      if (nextHour <= currentHour) {
        next.setDate(next.getDate() + 1);
      }
      next.setHours(nextHour);
    }

    next.setSeconds(0);
    next.setMilliseconds(0);

    return next;
  }

  /**
   * Parse cron field (supports numbers, ranges, and wildcards)
   */
  private parseCronField(field: string, min: number, max: number): number[] {
    const values: number[] = [];

    if (field === '*') {
      for (let i = min; i <= max; i++) {
        values.push(i);
      }
      return values;
    }

    // Handle comma-separated values
    const parts = field.split(',');
    for (const part of parts) {
      // Handle ranges (e.g., 1-5)
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        for (let i = start; i <= end; i++) {
          values.push(i);
        }
      } else {
        // Single value
        values.push(parseInt(part, 10));
      }
    }

    return values;
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return {
      totalJobs: this.jobs.size,
      activeJobs: Array.from(this.jobs.values()).filter(j => j.status === 'running').length,
      scheduledJobs: Array.from(this.jobs.values()).filter(j => j.status === 'scheduled').length,
      failedJobs: Array.from(this.jobs.values()).filter(j => j.status === 'failed').length,
      totalRuns: Array.from(this.runs.values()).reduce((sum, runs) => sum + runs.length, 0),
      isRunning: this.isRunning
    };
  }
}

/**
 * Batch job executor
 */
class BatchJobExecutor {
  private config: BatchJobConfig;

  constructor(config: BatchJobConfig) {
    this.config = config;
  }

  async execute(): Promise<BatchJobExecutionResult> {
    const startTime = Date.now();
    let inputRecords = 0;
    let outputRecords = 0;
    let errorRecords = 0;

    try {
      // Fetch data from source
      // In a real implementation, this would use the data ingestion layer
      const data = await this.fetchData();
      inputRecords = data.length;

      // Apply transforms
      const transformed = await this.applyTransforms(data);

      // Write to destination
      await this.writeDestination(transformed);
      outputRecords = transformed.length;

      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        inputRecords,
        outputRecords,
        errorRecords,
        metrics: {
          throughput: inputRecords / (duration / 1000),
          latency: duration,
          memoryUsage: 0,
          cpuUsage: 0
        }
      };
    } catch (error) {
      errorRecords = inputRecords - outputRecords;
      throw error;
    }
  }

  private async fetchData(): Promise<unknown[]> {
    // Placeholder implementation
    return [];
  }

  private async applyTransforms(data: unknown[]): Promise<unknown[]> {
    // Placeholder implementation
    return data;
  }

  private async writeDestination(data: unknown[]): Promise<void> {
    // Placeholder implementation
  }
}

/**
 * Batch job execution result
 */
interface BatchJobExecutionResult {
  inputRecords: number;
  outputRecords: number;
  errorRecords: number;
  metrics: {
    throughput: number;
    latency: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
  totalJobs: number;
  activeJobs: number;
  scheduledJobs: number;
  failedJobs: number;
  totalRuns: number;
  isRunning: boolean;
}
