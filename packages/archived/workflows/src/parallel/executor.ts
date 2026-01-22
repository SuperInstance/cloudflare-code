/**
 * Parallel Executor
 * Manages concurrent task execution with thread pool management and synchronization
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  NodeId,
  Node,
  Workflow,
  Connection
} from '../types';

export interface ParallelTask {
  id: string;
  name: string;
  execute: () => Promise<any>;
  priority: number;
  timeout?: number;
  dependencies: string[];
  metadata?: ParallelTaskMetadata;
}

export interface ParallelTaskMetadata {
  category?: string;
  estimatedDuration?: number;
  estimatedMemory?: number;
  retryable?: boolean;
}

export interface ParallelExecutionConfig {
  maxConcurrency?: number;
  timeout?: number;
  enableDeadlockDetection?: boolean;
  deadlockTimeout?: number;
  enableResultAggregation?: boolean;
  aggregationStrategy?: 'all' | 'first' | 'last' | 'custom';
  errorHandling?: 'fail-fast' | 'continue' | 'collect-all';
}

export interface ParallelExecutionResult {
  taskId: string;
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
  result?: any;
  error?: ParallelExecutionError;
  duration: number;
  startTime: Date;
  endTime: Date;
}

export interface ParallelExecutionError {
  code: string;
  message: string;
  stack?: string;
  retryable: boolean;
}

export interface ParallelExecutionSummary {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  timeoutTasks: number;
  cancelledTasks: number;
  totalDuration: number;
  results: ParallelExecutionResult[];
  aggregatedResult?: any;
}

export interface ThreadPoolConfig {
  minThreads?: number;
  maxThreads?: number;
  threadIdleTimeout?: number;
  taskQueueSize?: number;
}

export interface SynchronizationPrimitive {
  type: 'mutex' | 'semaphore' | 'barrier' | 'countdown';
  acquire(): Promise<void>;
  release(): void;
  wait(): Promise<void>;
}

export class ParallelExecutor {
  private config: Required<ParallelExecutionConfig>;
  private threadPool: ThreadPool;
  private taskQueue: TaskQueue;
  private synchronizationPrimitives: Map<string, SynchronizationPrimitive>;
  private executionHistory: ParallelExecutionResult[];
  private cancellationTokens: Map<string, CancellationToken>;

  constructor(config: ParallelExecutionConfig = {}) {
    this.config = {
      maxConcurrency: 10,
      timeout: 30000,
      enableDeadlockDetection: true,
      deadlockTimeout: 60000,
      enableResultAggregation: true,
      aggregationStrategy: 'all',
      errorHandling: 'continue',
      ...config
    };

    this.threadPool = new ThreadPool({
      minThreads: 2,
      maxThreads: this.config.maxConcurrency,
      threadIdleTimeout: 60000,
      taskQueueSize: 1000
    });

    this.taskQueue = new TaskQueue(1000);
    this.synchronizationPrimitives = new Map();
    this.executionHistory = [];
    this.cancellationTokens = new Map();
  }

  /**
   * Execute tasks in parallel
   */
  public async execute(tasks: ParallelTask[]): Promise<ParallelExecutionSummary> {
    const startTime = Date.now();
    const results: ParallelExecutionResult[] = [];
    const runningTasks = new Map<string, Promise<ParallelExecutionResult>>();

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(tasks);

    // Execute tasks in topological order (respecting dependencies)
    for (const taskId of this.topologicalSort(dependencyGraph)) {
      const task = tasks.find(t => t.id === taskId);
      if (!task) continue;

      // Wait for dependencies to complete
      const dependencyPromises = task.dependencies
        .map(depId => runningTasks.get(depId))
        .filter((p): p is Promise<ParallelExecutionResult> => !!p);

      await Promise.all(dependencyPromises);

      // Execute task
      const executionPromise = this.executeTask(task);
      runningTasks.set(taskId, executionPromise);

      // Add to results
      executionPromise.then(result => {
        results.push(result);
      });
    }

    // Wait for all tasks to complete
    const allResults = await Promise.all(runningTasks.values());

    // Calculate summary
    const summary: ParallelExecutionSummary = {
      totalTasks: tasks.length,
      completedTasks: allResults.filter(r => r.status === 'completed').length,
      failedTasks: allResults.filter(r => r.status === 'failed').length,
      timeoutTasks: allResults.filter(r => r.status === 'timeout').length,
      cancelledTasks: allResults.filter(r => r.status === 'cancelled').length,
      totalDuration: Date.now() - startTime,
      results: allResults,
      aggregatedResult: this.config.enableResultAggregation
        ? this.aggregateResults(allResults)
        : undefined
    };

    // Add to history
    this.executionHistory.push(...allResults);

    return summary;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: ParallelTask): Promise<ParallelExecutionResult> {
    const startTime = new Date();
    const cancellationToken = new CancellationToken();

    this.cancellationTokens.set(task.id, cancellationToken);

    try {
      // Execute with timeout
      const result = await Promise.race([
        this.threadPool.execute(task, cancellationToken),
        this.createTimeoutPromise(task.timeout || this.config.timeout, task.id)
      ]);

      return {
        taskId: task.id,
        status: 'completed',
        result,
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date()
      };
    } catch (error) {
      if (cancellationToken.isCancelled) {
        return {
          taskId: task.id,
          status: 'cancelled',
          error: this.createError('TASK_CANCELLED', 'Task was cancelled'),
          duration: Date.now() - startTime.getTime(),
          startTime,
          endTime: new Date()
        };
      }

      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          taskId: task.id,
          status: 'timeout',
          error: this.createError('TASK_TIMEOUT', `Task timed out after ${task.timeout || this.config.timeout}ms`),
          duration: Date.now() - startTime.getTime(),
          startTime,
          endTime: new Date()
        };
      }

      return {
        taskId: task.id,
        status: 'failed',
        error: this.createError(
          'TASK_FAILED',
          error instanceof Error ? error.message : String(error)
        ),
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date()
      };
    } finally {
      this.cancellationTokens.delete(task.id);
    }
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(tasks: ParallelTask[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const task of tasks) {
      graph.set(task.id, new Set(task.dependencies));
    }

    return graph;
  }

  /**
   * Topological sort of tasks
   */
  private topologicalSort(graph: Map<string, Set<string>>): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error(`Cycle detected in task dependencies: ${nodeId}`);
      }

      visiting.add(nodeId);

      const dependencies = graph.get(nodeId) || new Set();
      for (const depId of dependencies) {
        visit(depId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      sorted.push(nodeId);
    };

    for (const nodeId of graph.keys()) {
      visit(nodeId);
    }

    return sorted;
  }

  /**
   * Aggregate results
   */
  private aggregateResults(results: ParallelExecutionResult[]): any {
    switch (this.config.aggregationStrategy) {
      case 'first':
        return results.find(r => r.status === 'completed')?.result;

      case 'last':
        const completedResults = results.filter(r => r.status === 'completed');
        return completedResults[completedResults.length - 1]?.result;

      case 'all':
        return results.map(r => ({
          taskId: r.taskId,
          status: r.status,
          result: r.result,
          error: r.error
        }));

      case 'custom':
        // Custom aggregation would be provided by the user
        return results;

      default:
        return results;
    }
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number, taskId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task ${taskId} timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Create error object
   */
  private createError(code: string, message: string): ParallelExecutionError {
    return {
      code,
      message,
      retryable: code !== 'TASK_CANCELLED' && code !== 'TASK_TIMEOUT'
    };
  }

  /**
   * Cancel a running task
   */
  public cancelTask(taskId: string): void {
    const token = this.cancellationTokens.get(taskId);
    if (token) {
      token.cancel();
    }
  }

  /**
   * Cancel all running tasks
   */
  public cancelAll(): void {
    for (const token of this.cancellationTokens.values()) {
      token.cancel();
    }
  }

  /**
   * Get execution statistics
   */
  public getStatistics(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    threadPoolUtilization: number;
  } {
    const totalExecutions = this.executionHistory.length;
    const successfulExecutions = this.executionHistory.filter(
      r => r.status === 'completed'
    ).length;
    const failedExecutions = this.executionHistory.filter(
      r => r.status === 'failed'
    ).length;

    const totalTime = this.executionHistory.reduce(
      (sum, r) => sum + r.duration,
      0
    );

    const averageExecutionTime =
      totalExecutions > 0 ? totalTime / totalExecutions : 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      threadPoolUtilization: this.threadPool.getUtilization()
    };
  }

  /**
   * Create a mutex
   */
  public createMutex(name: string): Mutex {
    const mutex = new Mutex();
    this.synchronizationPrimitives.set(name, mutex);
    return mutex;
  }

  /**
   * Create a semaphore
   */
  public createSemaphore(name: string, permits: number): Semaphore {
    const semaphore = new Semaphore(permits);
    this.synchronizationPrimitives.set(name, semaphore);
    return semaphore;
  }

  /**
   * Create a barrier
   */
  public createBarrier(name: string, parties: number): Barrier {
    const barrier = new Barrier(parties);
    this.synchronizationPrimitives.set(name, barrier);
    return barrier;
  }

  /**
   * Clear history
   */
  public clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Shutdown the executor
   */
  public async shutdown(): Promise<void> {
    this.cancelAll();
    await this.threadPool.shutdown();
  }
}

/**
 * Thread pool for parallel execution
 */
class ThreadPool {
  private config: Required<ThreadPoolConfig>;
  private workers: Worker[];
  private taskQueue: TaskQueue;
  private activeWorkers: number;

  constructor(config: ThreadPoolConfig) {
    this.config = {
      minThreads: 2,
      maxThreads: 10,
      threadIdleTimeout: 60000,
      taskQueueSize: 1000,
      ...config
    };

    this.workers = [];
    this.taskQueue = new TaskQueue(this.config.taskQueueSize);
    this.activeWorkers = 0;

    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.config.minThreads; i++) {
      this.addWorker();
    }
  }

  private addWorker(): void {
    const worker: Worker = {
      id: uuidv4(),
      busy: false,
      lastActivity: new Date()
    };

    this.workers.push(worker);
  }

  async execute(
    task: ParallelTask,
    cancellationToken: CancellationToken
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const executeTask = async () => {
        if (cancellationToken.isCancelled) {
          reject(new Error('Task cancelled'));
          return;
        }

        try {
          const result = await task.execute();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeWorkers--;
        }
      };

      // Check if we can create more workers
      if (this.activeWorkers < this.workers.length &&
          this.activeWorkers < this.config.maxThreads) {
        this.activeWorkers++;
        executeTask();
      } else {
        // Queue the task
        this.taskQueue.enqueue({
          id: task.id,
          task,
          execute: executeTask
        });

        // Try to process queued tasks
        this.processQueue();
      }
    });
  }

  private processQueue(): void {
    while (this.taskQueue.size() > 0 && this.activeWorkers < this.config.maxThreads) {
      const queuedTask = this.taskQueue.dequeue();
      if (queuedTask) {
        this.activeWorkers++;
        queuedTask.execute();
      }
    }
  }

  getUtilization(): number {
    return (this.activeWorkers / this.config.maxThreads) * 100;
  }

  async shutdown(): Promise<void> {
    // Wait for all active workers to complete
    while (this.activeWorkers > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

interface Worker {
  id: string;
  busy: boolean;
  lastActivity: Date;
}

interface QueuedTask {
  id: string;
  task: ParallelTask;
  execute: () => void;
}

/**
 * Task queue
 */
class TaskQueue {
  private queue: QueuedTask[];
  private maxSize: number;

  constructor(maxSize: number) {
    this.queue = [];
    this.maxSize = maxSize;
  }

  enqueue(task: QueuedTask): void {
    if (this.queue.length >= this.maxSize) {
      throw new Error('Task queue is full');
    }

    // Sort by priority
    this.queue.push(task);
    this.queue.sort((a, b) => a.task.priority - b.task.priority);
  }

  dequeue(): QueuedTask | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }
}

/**
 * Cancellation token
 */
class CancellationToken {
  public isCancelled = false;

  cancel(): void {
    this.isCancelled = true;
  }
}

/**
 * Mutex for mutual exclusion
 */
export class Mutex implements SynchronizationPrimitive {
  type = 'mutex' as const;
  private locked = false;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.locked = false;
    }
  }

  async wait(): Promise<void> {
    // Not applicable for mutex
  }
}

/**
 * Semaphore for limiting concurrent access
 */
export class Semaphore implements SynchronizationPrimitive {
  type = 'semaphore' as const;
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.permits++;
    }
  }

  async wait(): Promise<void> {
    // Not applicable for semaphore
  }
}

/**
 * Barrier for synchronization
 */
export class Barrier implements SynchronizationPrimitive {
  type = 'barrier' as const;
  private parties: number;
  private waiting: number = 0;
  private resolve: (() => void) | null = null;

  constructor(parties: number) {
    this.parties = parties;
  }

  async acquire(): Promise<void> {
    // Not applicable for barrier
  }

  release(): void {
    // Not applicable for barrier
  }

  async wait(): Promise<void> {
    this.waiting++;

    if (this.waiting >= this.parties) {
      this.waiting = 0;
      if (this.resolve) {
        this.resolve();
        this.resolve = null;
      }
    } else {
      return new Promise(resolve => {
        this.resolve = resolve;
      });
    }
  }
}

/**
 * Countdown latch
 */
export class CountdownLatch implements SynchronizationPrimitive {
  type = 'countdown' as const;
  private count: number;
  private resolve: (() => void) | null = null;

  constructor(count: number) {
    this.count = count;
  }

  async acquire(): Promise<void> {
    // Not applicable for countdown latch
  }

  release(): void {
    this.count--;

    if (this.count <= 0 && this.resolve) {
      this.resolve();
      this.resolve = null;
    }
  }

  async wait(): Promise<void> {
    if (this.count <= 0) {
      return;
    }

    return new Promise(resolve => {
      this.resolve = resolve;
    });
  }
}
