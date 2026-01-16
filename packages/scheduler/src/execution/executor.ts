/**
 * Execution Engine
 * Manages job execution context, parameter passing, result handling, timeouts, and resource management
 */

import {
  Job,
  JobHandler,
  JobExecutionContext,
  JobResult,
  JobStatus,
  Logger
} from '../types';

/**
 * Configuration for execution engine
 */
export interface ExecutionEngineConfig {
  maxConcurrentExecutions?: number;
  defaultTimeout?: number;
  enableMetrics?: boolean;
  enableProfiling?: boolean;
  logger?: Logger;
}

/**
 * Execution profile
 */
export interface ExecutionProfile {
  jobId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  memoryUsage: {
    start: number;
    peak: number;
    end: number;
  };
  cpuUsage: {
    start: number;
    end: number;
  };
  parameters: any;
  result: any;
  error?: Error;
}

/**
 * Resource pool
 */
export interface ResourcePool {
  id: string;
  type: 'memory' | 'cpu' | 'custom';
  total: number;
  used: number;
  available: number;
}

/**
 * Execution engine class
 */
export class ExecutionEngine {
  private config: ExecutionEngineConfig;
  private logger: Logger;
  private activeExecutions: Map<string, Job>;
  private executionProfiles: Map<string, ExecutionProfile>;
  private abortControllers: Map<string, AbortController>;
  private timeouts: Map<string, NodeJS.Timeout>;
  private resourcePools: Map<string, ResourcePool>;
  private executionCount: number;
  private isRunning: boolean;

  constructor(config: ExecutionEngineConfig = {}) {
    this.config = {
      maxConcurrentExecutions: config.maxConcurrentExecutions || 100,
      defaultTimeout: config.defaultTimeout || 300000, // 5 minutes
      enableMetrics: config.enableMetrics ?? true,
      enableProfiling: config.enableProfiling || false
    };

    this.logger = config.logger || this.createDefaultLogger();

    this.activeExecutions = new Map();
    this.executionProfiles = new Map();
    this.abortControllers = new Map();
    this.timeouts = new Map();
    this.resourcePools = new Map();

    this.executionCount = 0;
    this.isRunning = true;

    // Initialize default resource pools
    this.initializeResourcePools();
  }

  /**
   * Initialize default resource pools
   */
  private initializeResourcePools(): void {
    // Memory pool (in MB)
    this.resourcePools.set('memory', {
      id: 'memory',
      type: 'memory',
      total: 1024, // 1GB default
      used: 0,
      available: 1024
    });

    // CPU pool (percentage)
    this.resourcePools.set('cpu', {
      id: 'cpu',
      type: 'cpu',
      total: 100,
      used: 0,
      available: 100
    });
  }

  /**
   * Execute a job
   */
  async executeJob<T = any>(
    job: Job,
    handler: JobHandler<T>,
    parameters?: any
  ): Promise<JobResult<T>> {
    if (!this.isRunning) {
      throw new Error('Execution engine is not running');
    }

    // Check concurrency limit
    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions!) {
      throw new Error('Maximum concurrent executions reached');
    }

    // Allocate resources
    const allocated = await this.allocateResources(job);
    if (!allocated) {
      throw new Error('Failed to allocate resources for job execution');
    }

    // Create abort controller
    const abortController = new AbortController();
    this.abortControllers.set(job.id, abortController);

    // Start execution profile
    const profile: ExecutionProfile = {
      jobId: job.id,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      memoryUsage: {
        start: this.getMemoryUsage(),
        peak: this.getMemoryUsage(),
        end: 0
      },
      cpuUsage: {
        start: process.cpuUsage().user,
        end: 0
      },
      parameters,
      result: undefined
    };

    if (this.config.enableProfiling) {
      this.executionProfiles.set(job.id, profile);
    }

    // Track active execution
    this.activeExecutions.set(job.id, job);
    this.executionCount++;

    // Set timeout
    const timeoutDuration = this.config.defaultTimeout!;
    let timeoutHandle: NodeJS.Timeout | undefined;

    if (timeoutDuration > 0) {
      timeoutHandle = setTimeout(() => {
        this.handleTimeout(job);
      }, timeoutDuration);

      this.timeouts.set(job.id, timeoutHandle);
    }

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
        metadata: job.metadata || {}
      };

      // Execute the handler
      const startTime = Date.now();
      const result = await this.executeWithIsolation(handler, context, parameters);
      const executionTime = Date.now() - startTime;

      // Clear timeout
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        this.timeouts.delete(job.id);
      }

      // Update profile
      if (this.config.enableProfiling) {
        profile.endTime = new Date();
        profile.duration = executionTime;
        profile.memoryUsage.end = this.getMemoryUsage();
        profile.cpuUsage.end = process.cpuUsage().user;
        profile.result = result;
      }

      // Create success result
      const jobResult: JobResult<T> = {
        success: true,
        data: result,
        executionTime,
        startedAt: context.startTime,
        completedAt: new Date(),
        attemptNumber: job.attemptNumber
      };

      this.logger.info(
        `Job completed: ${job.id} (${job.name}) in ${executionTime}ms`
      );

      return jobResult;
    } catch (error) {
      // Clear timeout
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        this.timeouts.delete(job.id);
      }

      // Update profile
      if (this.config.enableProfiling) {
        profile.endTime = new Date();
        profile.duration = Date.now() - profile.startTime.getTime();
        profile.memoryUsage.end = this.getMemoryUsage();
        profile.cpuUsage.end = process.cpuUsage().user;
        profile.error = error as Error;
      }

      this.logger.error(
        `Job failed: ${job.id} (${job.name}) - ${(error as Error).message}`
      );

      // Create failure result
      const jobResult: JobResult<T> = {
        success: false,
        error: error as Error,
        executionTime: Date.now() - profile.startTime.getTime(),
        startedAt: profile.startTime,
        completedAt: new Date(),
        attemptNumber: job.attemptNumber
      };

      return jobResult;
    } finally {
      // Clean up
      this.activeExecutions.delete(job.id);
      this.abortControllers.delete(job.id);

      // Release resources
      await this.releaseResources(job);
    }
  }

  /**
   * Execute handler with isolation
   */
  private async executeWithIsolation<T = any>(
    handler: JobHandler<T>,
    context: JobExecutionContext<T>,
    parameters?: any
  ): Promise<T> {
    // Check for abort signal
    if (context.signal.aborted) {
      throw new Error('Job execution was aborted');
    }

    // Execute the handler
    try {
      const result = await handler(context);
      return result;
    } catch (error) {
      // Re-throw with additional context
      const enhancedError = new Error(
        `Execution failed for job ${context.job.id}: ${(error as Error).message}`
      );
      (enhancedError as any).originalError = error;
      throw enhancedError;
    }
  }

  /**
   * Handle job timeout
   */
  private handleTimeout(job: Job): void {
    this.logger.warn(`Job timeout: ${job.id} (${job.name})`);

    const abortController = this.abortControllers.get(job.id);
    if (abortController) {
      abortController.abort();
    }

    // Remove from timeouts
    this.timeouts.delete(job.id);
  }

  /**
   * Allocate resources for a job
   */
  private async allocateResources(job: Job): Promise<boolean> {
    const requiredMemory = job.metadata?.memoryRequirement || 10; // 10MB default
    const requiredCpu = job.metadata?.cpuRequirement || 5; // 5% default

    const memoryPool = this.resourcePools.get('memory');
    const cpuPool = this.resourcePools.get('cpu');

    if (!memoryPool || !cpuPool) {
      return false;
    }

    // Check if resources are available
    if (memoryPool.available < requiredMemory || cpuPool.available < requiredCpu) {
      this.logger.warn(
        `Insufficient resources for job ${job.id}: ` +
          `memory ${memoryPool.available}/${requiredMemory}MB, ` +
          `cpu ${cpuPool.available}/${requiredCpu}%`
      );
      return false;
    }

    // Allocate resources
    memoryPool.used += requiredMemory;
    memoryPool.available -= requiredMemory;

    cpuPool.used += requiredCpu;
    cpuPool.available -= requiredCpu;

    this.logger.debug(
      `Resources allocated for job ${job.id}: ` +
        `${requiredMemory}MB memory, ${requiredCpu}% CPU`
    );

    return true;
  }

  /**
   * Release resources from a job
   */
  private async releaseResources(job: Job): Promise<void> {
    const requiredMemory = job.metadata?.memoryRequirement || 10;
    const requiredCpu = job.metadata?.cpuRequirement || 5;

    const memoryPool = this.resourcePools.get('memory');
    const cpuPool = this.resourcePools.get('cpu');

    if (memoryPool) {
      memoryPool.used = Math.max(0, memoryPool.used - requiredMemory);
      memoryPool.available = Math.min(
        memoryPool.total,
        memoryPool.available + requiredMemory
      );
    }

    if (cpuPool) {
      cpuPool.used = Math.max(0, cpuPool.used - requiredCpu);
      cpuPool.available = Math.min(cpuPool.total, cpuPool.available + requiredCpu);
    }

    this.logger.debug(
      `Resources released from job ${job.id}: ` +
        `${requiredMemory}MB memory, ${requiredCpu}% CPU`
    );
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024); // MB
    }
    return 0;
  }

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): boolean {
    const abortController = this.abortControllers.get(jobId);
    if (!abortController) {
      return false;
    }

    abortController.abort();
    this.logger.info(`Job cancelled: ${jobId}`);
    return true;
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): Job[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution profile
   */
  getExecutionProfile(jobId: string): ExecutionProfile | undefined {
    return this.executionProfiles.get(jobId);
  }

  /**
   * Get all execution profiles
   */
  getAllExecutionProfiles(): ExecutionProfile[] {
    return Array.from(this.executionProfiles.values());
  }

  /**
   * Get resource pool status
   */
  getResourcePoolStatus(): Map<string, ResourcePool> {
    return new Map(this.resourcePools);
  }

  /**
   * Get execution statistics
   */
  getStatistics(): {
    totalExecutions: number;
    activeExecutions: number;
    averageExecutionTime: number;
    resourceUtilization: {
      memory: number;
      cpu: number;
    };
  } {
    const profiles = Array.from(this.executionProfiles.values());
    const totalTime = profiles.reduce((sum, p) => sum + p.duration, 0);
    const avgTime = profiles.length > 0 ? totalTime / profiles.length : 0;

    const memoryPool = this.resourcePools.get('memory');
    const cpuPool = this.resourcePools.get('cpu');

    return {
      totalExecutions: this.executionCount,
      activeExecutions: this.activeExecutions.size,
      averageExecutionTime: avgTime,
      resourceUtilization: {
        memory: memoryPool ? (memoryPool.used / memoryPool.total) * 100 : 0,
        cpu: cpuPool ? (cpuPool.used / cpuPool.total) * 100 : 0
      }
    };
  }

  /**
   * Add custom resource pool
   */
  addResourcePool(pool: ResourcePool): void {
    this.resourcePools.set(pool.id, pool);
    this.logger.debug(`Resource pool added: ${pool.id}`);
  }

  /**
   * Remove resource pool
   */
  removeResourcePool(poolId: string): void {
    this.resourcePools.delete(poolId);
    this.logger.debug(`Resource pool removed: ${poolId}`);
  }

  /**
   * Start the execution engine
   */
  start(): void {
    this.isRunning = true;
    this.logger.info('Execution engine started');
  }

  /**
   * Stop the execution engine
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping execution engine...');

    // Cancel all active executions
    for (const jobId of this.activeExecutions.keys()) {
      this.cancelJob(jobId);
    }

    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }

    this.isRunning = false;
    this.logger.info('Execution engine stopped');
  }

  /**
   * Check if engine is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, ...args: any[]) => {
        if (process.env.DEBUG) {
          console.debug(`[ExecutionEngine] DEBUG: ${message}`, ...args);
        }
      },
      info: (message: string, ...args: any[]) => {
        console.info(`[ExecutionEngine] INFO: ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[ExecutionEngine] WARN: ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[ExecutionEngine] ERROR: ${message}`, ...args);
      }
    };
  }
}
