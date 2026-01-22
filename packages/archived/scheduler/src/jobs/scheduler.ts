/**
 * Job Scheduler
 * Manages job registration, queuing, execution, priorities, concurrency, timeouts, and retries
 */

import {
  Job,
  JobDefinition,
  JobHandler,
  JobStatus,
  JobPriority,
  JobResult,
  JobExecutionContext,
  QueuedJob,
  RetryPolicy,
  TimeoutConfig,
  ConcurrencyConfig,
  Logger
} from '../types';
import { CronParser } from '../cron/parser';

/**
 * Job scheduler class
 */
export class JobScheduler {
  private jobs: Map<string, JobDefinition>;
  private jobInstances: Map<string, Job>;
  private queue: QueuedJob[];
  private runningJobs: Set<string>;
  private completedJobs: Map<string, Job>;
  private failedJobs: Map<string, Job>;
  private concurrencyLimits: Map<string, number>;
  private currentConcurrency: Map<string, number>;
  private abortControllers: Map<string, AbortController>;
  private logger: Logger;
  private maxConcurrentJobs: number;
  private queueSizeLimit: number;
  private executionCallbacks: Map<string, Set<(result: JobResult) => void>>;
  private scheduledIntervals: Map<string, NodeJS.Timeout>;

  constructor(config?: {
    maxConcurrentJobs?: number;
    queueSizeLimit?: number;
    logger?: Logger;
  }) {
    this.jobs = new Map();
    this.jobInstances = new Map();
    this.queue = [];
    this.runningJobs = new Set();
    this.completedJobs = new Map();
    this.failedJobs = new Map();
    this.concurrencyLimits = new Map();
    this.currentConcurrency = new Map();
    this.abortControllers = new Map();
    this.executionCallbacks = new Map();
    this.scheduledIntervals = new Map();

    this.maxConcurrentJobs = config?.maxConcurrentJobs || 100;
    this.queueSizeLimit = config?.queueSizeLimit || 10000;

    this.logger = config?.logger || this.createDefaultLogger();
  }

  /**
   * Register a job definition
   */
  registerJob<T = any>(definition: JobDefinition<T>): void {
    if (this.jobs.has(definition.id)) {
      throw new Error(`Job with ID ${definition.id} already registered`);
    }

    // Validate cron expression if provided
    if (definition.cronExpression || definition.schedule) {
      const expression = definition.cronExpression || definition.schedule!;
      const validation = CronParser.validate(expression);

      if (!validation.valid) {
        throw new Error(`Invalid cron expression: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        this.logger.warn(
          `Job ${definition.id} cron warnings: ${validation.warnings.join(', ')}`
        );
      }
    }

    this.jobs.set(definition.id, definition);

    // Set up scheduling if cron expression is provided
    if (definition.enabled !== false && (definition.cronExpression || definition.schedule)) {
      this.scheduleJob(definition.id);
    }

    this.logger.info(`Job registered: ${definition.id} (${definition.name})`);
  }

  /**
   * Unregister a job definition
   */
  unregisterJob(jobId: string): void {
    const definition = this.jobs.get(jobId);
    if (!definition) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Stop scheduling
    this.unscheduleJob(jobId);

    // Cancel running instances
    for (const [instanceId, job] of this.jobInstances) {
      if (job.definitionId === jobId && job.status === JobStatus.RUNNING) {
        this.cancelJob(instanceId);
      }
    }

    this.jobs.delete(jobId);
    this.logger.info(`Job unregistered: ${jobId}`);
  }

  /**
   * Schedule a job based on its cron expression
   */
  private scheduleJob(jobId: string): void {
    const definition = this.jobs.get(jobId);
    if (!definition) {
      throw new Error(`Job ${jobId} not found`);
    }

    const expression = definition.cronExpression || definition.schedule;
    if (!expression) {
      return;
    }

    // Clear existing schedule if any
    this.unscheduleJob(jobId);

    // Calculate initial delay
    const timeUntilNext = CronParser.getTimeUntilNextExecution(
      expression,
      new Date(),
      definition.timeZone || 'UTC'
    );

    // Schedule next execution
    const timeout = setTimeout(() => {
      this.enqueueJob(jobId);
      this.scheduleJob(jobId); // Reschedule next execution
    }, timeUntilNext);

    this.scheduledIntervals.set(jobId, timeout);

    this.logger.debug(`Job ${jobId} scheduled for next execution in ${timeUntilNext}ms`);
  }

  /**
   * Unschedule a job
   */
  private unscheduleJob(jobId: string): void {
    const timeout = this.scheduledIntervals.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledIntervals.delete(jobId);
      this.logger.debug(`Job ${jobId} unscheduled`);
    }
  }

  /**
   * Enqueue a job for execution
   */
  enqueueJob<T = any>(
    definitionId: string,
    params?: T,
    metadata?: Record<string, any>
  ): string {
    const definition = this.jobs.get(definitionId);
    if (!definition) {
      throw new Error(`Job definition ${definitionId} not found`);
    }

    // Check queue size limit
    if (this.queue.length >= this.queueSizeLimit) {
      throw new Error('Queue size limit reached');
    }

    const instanceId = this.generateInstanceId(definitionId);

    const job: Job<T> = {
      id: instanceId,
      definitionId,
      name: definition.name,
      status: JobStatus.PENDING,
      priority: definition.priority || JobPriority.NORMAL,
      scheduledTime: new Date(),
      attemptNumber: 1,
      maxAttempts: definition.retryPolicy?.maxRetries || 0 + 1,
      dependencies: definition.dependencies || [],
      dependentJobs: [],
      metadata: { ...definition.metadata, ...metadata },
      tags: definition.tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.jobInstances.set(instanceId, job);

    const queuedJob: QueuedJob = {
      job,
      queuedAt: new Date(),
      priority: job.priority,
      scheduledTime: job.scheduledTime
    };

    this.queue.push(queuedJob);
    this.sortQueue();

    this.logger.debug(`Job enqueued: ${instanceId} (${definition.name})`);

    // Try to execute if capacity available
    this.processQueue();

    return instanceId;
  }

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.runningJobs.size < this.maxConcurrentJobs) {
      const queuedJob = this.queue.shift();
      if (!queuedJob) {
        break;
      }

      const { job } = queuedJob;

      // Check if dependencies are satisfied
      if (!this.areDependenciesSatisfied(job)) {
        // Requeue for later
        this.queue.push(queuedJob);
        this.sortQueue();
        continue;
      }

      // Check concurrency limits
      if (!this.checkConcurrencyLimit(job)) {
        // Requeue for later
        this.queue.push(queuedJob);
        this.sortQueue();
        continue;
      }

      // Execute the job
      this.executeJob(job);
    }
  }

  /**
   * Check if job dependencies are satisfied
   */
  private areDependenciesSatisfied(job: Job): boolean {
    for (const depId of job.dependencies) {
      const depJob = this.jobInstances.get(depId);
      if (!depJob) {
        return false;
      }

      if (
        depJob.status !== JobStatus.COMPLETED &&
        depJob.status !== JobStatus.FAILED &&
        depJob.status !== JobStatus.CANCELLED
      ) {
        return false;
      }

      // If dependency failed, check if this job should still run
      if (depJob.status === JobStatus.FAILED) {
        // Soft dependency - still run
        // Hard dependency - don't run
        // For now, we'll fail the dependent job
        return false;
      }
    }

    return true;
  }

  /**
   * Check concurrency limits
   */
  private checkConcurrencyLimit(job: Job): boolean {
    const definition = this.jobs.get(job.definitionId);
    if (!definition) {
      return true;
    }

    const concurrency = definition.concurrency;
    if (!concurrency) {
      return true;
    }

    // Check global limit
    if (this.runningJobs.size >= concurrency.maxConcurrent) {
      return false;
    }

    // Check per-group limits
    if (concurrency.perGroup) {
      for (const [group, limit] of Object.entries(concurrency.perGroup)) {
        const current = this.currentConcurrency.get(group) || 0;
        if (current >= limit) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Execute a job
   */
  private async executeJob<T = any>(job: Job<T>): Promise<void> {
    const definition = this.jobs.get(job.definitionId);
    if (!definition) {
      this.logger.error(`Job definition not found: ${job.definitionId}`);
      return;
    }

    // Update job status
    job.status = JobStatus.RUNNING;
    job.startedAt = new Date();
    job.updatedAt = new Date();
    this.runningJobs.add(job.id);

    // Create abort controller for timeout
    const abortController = new AbortController();
    this.abortControllers.set(job.id, abortController);

    // Set timeout if configured
    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutDuration = definition.timeout?.duration || definition.maxExecutionTime || 300000; // 5 minutes default

    if (definition.timeout) {
      timeoutHandle = setTimeout(() => {
        this.handleTimeout(job, abortController);
      }, timeoutDuration);
    }

    // Increment concurrency counters
    this.incrementConcurrency(job);

    try {
      this.logger.info(`Executing job: ${job.id} (${job.name})`);

      // Create execution context
      const context: JobExecutionContext<T> = {
        job,
        attemptNumber: job.attemptNumber,
        startTime: new Date(),
        timeout: timeoutDuration,
        logger: this.logger,
        signal: abortController.signal,
        metadata: job.metadata
      };

      // Execute the job handler
      const startTime = Date.now();
      const result = await definition.handler(context);
      const executionTime = Date.now() - startTime;

      // Clear timeout
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // Update job with success result
      job.status = JobStatus.COMPLETED;
      job.completedAt = new Date();
      job.executionTime = executionTime;
      job.result = {
        success: true,
        data: result,
        executionTime,
        startedAt: context.startTime,
        completedAt: job.completedAt,
        attemptNumber: job.attemptNumber
      };
      job.updatedAt = new Date();

      this.completedJobs.set(job.id, job);
      this.runningJobs.delete(job.id);
      this.abortControllers.delete(job.id);

      this.logger.info(
        `Job completed: ${job.id} (${job.name}) in ${executionTime}ms`
      );

      // Trigger callbacks
      this.triggerCallbacks(job.id, job.result);

      // Decrement concurrency counters
      this.decrementConcurrency(job);

      // Process queue for dependent jobs
      this.processQueue();
    } catch (error) {
      // Clear timeout
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // Handle failure
      await this.handleFailure(job, error as Error, abortController);
    }
  }

  /**
   * Handle job timeout
   */
  private handleTimeout(job: Job, abortController: AbortController): void {
    this.logger.warn(`Job timeout: ${job.id} (${job.name})`);

    const definition = this.jobs.get(job.definitionId);
    if (definition?.timeout?.onTimeout) {
      definition.timeout.onTimeout(job);
    }

    abortController.abort();
  }

  /**
   * Handle job failure
   */
  private async handleFailure(
    job: Job,
    error: Error,
    abortController: AbortController
  ): Promise<void> {
    const definition = this.jobs.get(job.definitionId);

    this.logger.error(`Job failed: ${job.id} (${job.name}) - ${error.message}`);

    // Check if we should retry
    const retryPolicy = definition?.retryPolicy;
    const shouldRetry =
      retryPolicy &&
      job.attemptNumber < job.maxAttempts &&
      (!retryPolicy.retryableErrors ||
        retryPolicy.retryableErrors.some((err) => error.message.includes(err)));

    if (shouldRetry) {
      // Calculate retry delay
      const delay = this.calculateRetryDelay(job.attemptNumber, retryPolicy);
      job.nextRetryTime = new Date(Date.now() + delay);
      job.status = JobStatus.RETRYING;
      job.updatedAt = new Date();

      this.runningJobs.delete(job.id);
      this.abortControllers.delete(job.id);
      this.decrementConcurrency(job);

      // Schedule retry
      setTimeout(() => {
        job.attemptNumber++;
        job.status = JobStatus.PENDING;
        job.updatedAt = new Date();
        this.executeJob(job);
      }, delay);

      this.logger.info(`Job retry scheduled: ${job.id} in ${delay}ms`);
    } else {
      // Mark as failed
      job.status = JobStatus.FAILED;
      job.completedAt = new Date();
      job.executionTime = job.completedAt.getTime() - (job.startedAt?.getTime() || job.scheduledTime.getTime());
      job.error = error;
      job.result = {
        success: false,
        error,
        executionTime: job.executionTime,
        startedAt: job.startedAt || job.scheduledTime,
        completedAt: job.completedAt,
        attemptNumber: job.attemptNumber
      };
      job.updatedAt = new Date();

      this.failedJobs.set(job.id, job);
      this.runningJobs.delete(job.id);
      this.abortControllers.delete(job.id);
      this.decrementConcurrency(job);

      // Trigger callbacks
      this.triggerCallbacks(job.id, job.result);

      // Process queue
      this.processQueue();
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptNumber: number, policy: RetryPolicy): number {
    const delay = policy.initialDelay * Math.pow(policy.backoffMultiplier, attemptNumber - 1);
    return Math.min(delay, policy.maxDelay);
  }

  /**
   * Increment concurrency counters
   */
  private incrementConcurrency(job: Job): void {
    const definition = this.jobs.get(job.definitionId);
    if (!definition?.concurrency) {
      return;
    }

    const concurrency = definition.concurrency;

    if (concurrency.perGroup) {
      for (const group of Object.keys(concurrency.perGroup)) {
        const current = this.currentConcurrency.get(group) || 0;
        this.currentConcurrency.set(group, current + 1);
      }
    }
  }

  /**
   * Decrement concurrency counters
   */
  private decrementConcurrency(job: Job): void {
    const definition = this.jobs.get(job.definitionId);
    if (!definition?.concurrency) {
      return;
    }

    const concurrency = definition.concurrency;

    if (concurrency.perGroup) {
      for (const group of Object.keys(concurrency.perGroup)) {
        const current = this.currentConcurrency.get(group) || 0;
        this.currentConcurrency.set(group, Math.max(0, current - 1));
      }
    }
  }

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): void {
    const job = this.jobInstances.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === JobStatus.RUNNING) {
      const abortController = this.abortControllers.get(jobId);
      if (abortController) {
        abortController.abort();
      }

      job.status = JobStatus.CANCELLED;
      job.completedAt = new Date();
      job.updatedAt = new Date();

      this.runningJobs.delete(jobId);
      this.abortControllers.delete(jobId);
      this.decrementConcurrency(job);

      this.logger.info(`Job cancelled: ${jobId}`);
    } else if (job.status === JobStatus.PENDING || job.status === JobStatus.QUEUED) {
      // Remove from queue
      this.queue = this.queue.filter((qj) => qj.job.id !== jobId);
      job.status = JobStatus.CANCELLED;
      job.updatedAt = new Date();

      this.logger.info(`Queued job cancelled: ${jobId}`);
    } else {
      throw new Error(`Cannot cancel job in status: ${job.status}`);
    }

    this.processQueue();
  }

  /**
   * Register a callback for job completion
   */
  onJobComplete(jobId: string, callback: (result: JobResult) => void): void {
    if (!this.executionCallbacks.has(jobId)) {
      this.executionCallbacks.set(jobId, new Set());
    }

    this.executionCallbacks.get(jobId)!.add(callback);
  }

  /**
   * Trigger completion callbacks
   */
  private triggerCallbacks(jobId: string, result: JobResult): void {
    const callbacks = this.executionCallbacks.get(jobId);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(result);
        } catch (error) {
          this.logger.error(`Callback error for job ${jobId}:`, error);
        }
      }

      this.executionCallbacks.delete(jobId);
    }
  }

  /**
   * Sort queue by priority and scheduled time
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then by scheduled time
      return a.scheduledTime.getTime() - b.scheduledTime.getTime();
    });
  }

  /**
   * Generate unique instance ID
   */
  private generateInstanceId(definitionId: string): string {
    return `${definitionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, ...args: any[]) => {
        if (process.env.DEBUG) {
          console.debug(`[Scheduler] DEBUG: ${message}`, ...args);
        }
      },
      info: (message: string, ...args: any[]) => {
        console.info(`[Scheduler] INFO: ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[Scheduler] WARN: ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[Scheduler] ERROR: ${message}`, ...args);
      }
    };
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.jobInstances.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobInstances.values());
  }

  /**
   * Get running jobs
   */
  getRunningJobs(): Job[] {
    return Array.from(this.runningJobs)
      .map((id) => this.jobInstances.get(id))
      .filter((job): job is Job => job !== undefined);
  }

  /**
   * Get queued jobs
   */
  getQueuedJobs(): QueuedJob[] {
    return [...this.queue];
  }

  /**
   * Get completed jobs
   */
  getCompletedJobs(): Job[] {
    return Array.from(this.completedJobs.values());
  }

  /**
   * Get failed jobs
   */
  getFailedJobs(): Job[] {
    return Array.from(this.failedJobs.values());
  }

  /**
   * Get scheduler statistics
   */
  getStats(): {
    totalJobs: number;
    runningJobs: number;
    queuedJobs: number;
    completedJobs: number;
    failedJobs: number;
    registeredJobs: number;
  } {
    return {
      totalJobs: this.jobInstances.size,
      runningJobs: this.runningJobs.size,
      queuedJobs: this.queue.length,
      completedJobs: this.completedJobs.size,
      failedJobs: this.failedJobs.size,
      registeredJobs: this.jobs.size
    };
  }

  /**
   * Shutdown the scheduler
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down scheduler...');

    // Stop all scheduled jobs
    for (const [jobId, timeout] of this.scheduledIntervals) {
      clearTimeout(timeout);
    }
    this.scheduledIntervals.clear();

    // Cancel all running jobs
    for (const jobId of this.runningJobs) {
      try {
        this.cancelJob(jobId);
      } catch (error) {
        this.logger.error(`Error cancelling job ${jobId}:`, error);
      }
    }

    this.logger.info('Scheduler shutdown complete');
  }
}
