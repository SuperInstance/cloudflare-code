/**
 * Task Manager
 *
 * Manages task lifecycle including creation, assignment,
 * tracking, prioritization, and result aggregation.
 */

import type {
  TaskId,
  AgentId,
  Task,
  CreateTaskParams,
  UpdateTaskParams,
  TaskFilter,
  TaskQueryOptions,
  TaskQueryResult,
  TaskExecutionResult,
  TaskStats,
  TaskWorkflow,
  TaskEvent,
  QueuedTask
} from '../types';
import {
  TaskStatus,
  TaskPriority,
  FrameworkError,
  AgentFrameworkError
} from '../types';
import { createLogger } from '../utils/logger';
import { generateId, chunk, parallel } from '../utils/helpers';
import { EventEmitter } from 'eventemitter3';
import PQueue from 'p-queue';

/**
 * Task manager configuration
 */
export interface TaskManagerConfig {
  maxConcurrentTasks: number;
  defaultTimeout: number;
  enablePrioritization: boolean;
  enableMetrics: boolean;
  retentionDays: number;
  cleanupInterval: number;
}

/**
 * Task manager events
 */
export interface TaskManagerEvents {
  'task:created': (task: Task) => void;
  'task:assigned': (task: Task, agentId: AgentId) => void;
  'task:started': (task: Task) => void;
  'task:completed': (task: Task) => void;
  'task:failed': (task: Task, error: Error) => void;
  'task:cancelled': (task: Task) => void;
  'task:timeout': (task: Task) => void;
}

/**
 * Task Manager class
 */
export class TaskManager extends EventEmitter<TaskManagerEvents> {
  private config: TaskManagerConfig;
  private logger = createLogger('TaskManager');
  private tasks: Map<TaskId, Task>;
  private taskQueue: PQueue;
  private workflows: Map<string, TaskWorkflow>;
  private events: Map<TaskId, TaskEvent[]>;
  private stats: TaskStats;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<TaskManagerConfig> = {}) {
    super();

    this.config = {
      maxConcurrentTasks: 100,
      defaultTimeout: 30000,
      enablePrioritization: true,
      enableMetrics: true,
      retentionDays: 7,
      cleanupInterval: 3600000, // 1 hour
      ...config
    };

    this.tasks = new Map();
    this.workflows = new Map();
    this.events = new Map();
    this.taskQueue = new PQueue({
      concurrency: this.config.maxConcurrentTasks,
      autoStart: true
    });

    this.stats = this.initializeStats();
    this.startCleanupTimer();
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): TaskStats {
    return {
      totalTasks: 0,
      tasksByStatus: {} as Record<TaskStatus, number>,
      tasksByType: {},
      tasksByPriority: {} as Record<string, number>,
      averageExecutionTime: 0,
      successRate: 1,
      failureRate: 0,
      cancellationRate: 0,
      totalExecutionTime: 0,
      totalCompletedTasks: 0,
      totalFailedTasks: 0
    };
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Create a new task
   */
  async createTask(params: CreateTaskParams): Promise<Task> {
    this.logger.debug('Creating task', { type: params.type, name: params.name });

    const taskId = generateId('task');
    const now = Date.now();

    const task: Task = {
      id: taskId,
      type: params.type,
      name: params.name,
      description: params.description,
      status: TaskStatus.PENDING,
      priority: params.priority || TaskPriority.NORMAL,
      input: params.input,
      timeout: params.timeout || this.config.defaultTimeout,
      retryPolicy: {
        maxRetries: 3,
        currentRetry: 0,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        retryableErrors: ['timeout', 'network', 'temporary']
      },
      dependencies: params.dependencies || [],
      metadata: {
        tags: [],
        customFields: {},
        ...params.metadata
      },
      executionStrategy: params.executionStrategy,
      estimatedDuration: params.estimatedDuration,
      assignedAgent: params.assignedAgent,
      createdBy: params.metadata?.userId || 'system',
      createdAt: now,
      progress: {
        percentage: 0,
        currentStep: 'Initializing',
        totalSteps: 1,
        completedSteps: [],
        lastUpdated: now
      }
    };

    // Validate dependencies
    await this.validateDependencies(task);

    // Store task
    this.tasks.set(taskId, task);
    this.initializeEvents(taskId);

    // Update stats
    this.stats.totalTasks++;
    this.updateTaskStats(task);

    // Queue task for processing
    if (this.config.enablePrioritization) {
      this.queueTaskByPriority(task);
    } else {
      this.taskQueue.add(() => this.processTask(task));
    }

    this.emit('task:created', task);

    this.logger.debug('Task created successfully', { taskId, type: task.type });

    return task;
  }

  /**
   * Validate task dependencies
   */
  private async validateDependencies(task: Task): Promise<void> {
    for (const dep of task.dependencies) {
      const depTask = this.tasks.get(dep.taskId);
      if (!depTask) {
        throw new AgentFrameworkError(
          `Dependency task ${dep.taskId} not found`,
          FrameworkError.TASK_DEPENDENCY_FAILED,
          404
        );
      }
    }
  }

  /**
   * Queue task by priority
   */
  private queueTaskByPriority(task: Task): Promise<void> | undefined {
    return this.taskQueue.add(() => this.processTask(task), {
      priority: task.priority
    });
  }

  /**
   * Process task
   */
  private async processTask(task: Task): Promise<void> {
    try {
      // Check dependencies
      await this.waitForDependencies(task);

      // Update status to queued
      await this.updateTaskStatus(task.id, TaskStatus.QUEUED);

      // Wait for assignment (handled by orchestrator)
      // This is a placeholder - actual assignment happens in orchestrator
    } catch (error) {
      await this.handleTaskError(task.id, error as Error);
    }
  }

  /**
   * Wait for task dependencies to complete
   */
  private async waitForDependencies(task: Task): Promise<void> {
    const hardDependencies = task.dependencies.filter(d => d.type === 'hard');

    for (const dep of hardDependencies) {
      const depTask = this.tasks.get(dep.taskId);
      if (!depTask) {
        throw new Error(`Dependency task ${dep.taskId} not found`);
      }

      // Wait for dependency to complete
      if (depTask.status !== TaskStatus.COMPLETED) {
        await new Promise<void>((resolve, reject) => {
          const checkInterval = setInterval(() => {
            const currentTask = this.tasks.get(dep.taskId);
            if (!currentTask) {
              clearInterval(checkInterval);
              reject(new Error(`Dependency task ${dep.taskId} not found`));
              return;
            }

            if (currentTask.status === TaskStatus.COMPLETED) {
              clearInterval(checkInterval);
              resolve();
            } else if (
              currentTask.status === TaskStatus.FAILED ||
              currentTask.status === TaskStatus.CANCELLED
            ) {
              clearInterval(checkInterval);
              reject(new Error(`Dependency task ${dep.taskId} ${currentTask.status}`));
            }
          }, 100);
        });
      }

      // Check dependency condition
      if (dep.condition) {
        if (!this.checkDependencyCondition(depTask, dep.condition)) {
          throw new Error(`Dependency condition not met for task ${dep.taskId}`);
        }
      }
    }
  }

  /**
   * Check dependency condition
   */
  private checkDependencyCondition(task: Task, condition: any): boolean {
    const value = (task.output?.data as Record<string, unknown>)?.[condition.field];

    switch (condition.operator) {
      case '=':
        return value === condition.value;
      case '!=':
        return value !== condition.value;
      case '>':
        return typeof value === 'number' && value > condition.value;
      case '<':
        return typeof value === 'number' && value < condition.value;
      case '>=':
        return typeof value === 'number' && value >= condition.value;
      case '<=':
        return typeof value === 'number' && value <= condition.value;
      case 'contains':
        return Array.isArray(value) && value.includes(condition.value);
      case 'exists':
        return value !== undefined && value !== null;
      default:
        return false;
    }
  }

  /**
   * Assign task to an agent
   */
  async assignTask(taskId: TaskId, agentId: AgentId): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AgentFrameworkError(
        `Task ${taskId} not found`,
        FrameworkError.TASK_NOT_FOUND,
        404
      );
    }

    task.assignedAgent = agentId;
    task.status = TaskStatus.ASSIGNED;
    task.assignedAt = Date.now();

    this.emit('task:assigned', task, agentId);

    this.addEvent(taskId, {
      eventId: generateId('event'),
      taskId,
      eventType: 'assigned' as any,
      timestamp: Date.now(),
      data: { agentId },
      agentId
    });
  }

  /**
   * Start task execution
   */
  async startTask(taskId: TaskId): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AgentFrameworkError(
        `Task ${taskId} not found`,
        FrameworkError.TASK_NOT_FOUND,
        404
      );
    }

    task.status = TaskStatus.RUNNING;
    task.startedAt = Date.now();

    this.emit('task:started', task);

    this.addEvent(taskId, {
      eventId: generateId('event'),
      taskId,
      eventType: 'started' as any,
      timestamp: Date.now(),
      data: {},
      agentId: task.assignedAgent
    });

    // Set timeout
    setTimeout(() => {
      const currentTask = this.tasks.get(taskId);
      if (currentTask && currentTask.status === TaskStatus.RUNNING) {
        this.handleTaskTimeout(taskId);
      }
    }, task.timeout);
  }

  /**
   * Update task progress
   */
  async updateTaskProgress(
    taskId: TaskId,
    progress: Partial<{
      percentage: number;
      currentStep: string;
      totalSteps: number;
      completedSteps: string[];
      estimatedTimeRemaining: number;
      details: Record<string, unknown>;
    }>
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AgentFrameworkError(
        `Task ${taskId} not found`,
        FrameworkError.TASK_NOT_FOUND,
        404
      );
    }

    task.progress = {
      ...task.progress,
      ...progress,
      lastUpdated: Date.now()
    };

    this.addEvent(taskId, {
      eventId: generateId('event'),
      taskId,
      eventType: 'progress_update' as any,
      timestamp: Date.now(),
      data: { progress: task.progress },
      agentId: task.assignedAgent
    });
  }

  /**
   * Complete task with result
   */
  async completeTask(
    taskId: TaskId,
    output: any,
    agentId: AgentId
  ): Promise<TaskExecutionResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AgentFrameworkError(
        `Task ${taskId} not found`,
        FrameworkError.TASK_NOT_FOUND,
        404
      );
    }

    const now = Date.now();
    const executionTime = task.startedAt ? now - task.startedAt : 0;

    task.status = TaskStatus.COMPLETED;
    task.completedAt = now;
    task.output = output;
    task.actualDuration = executionTime;
    task.progress.percentage = 100;

    // Update stats
    this.stats.totalCompletedTasks++;
    this.stats.totalExecutionTime += executionTime;
    this.stats.averageExecutionTime =
      this.stats.totalExecutionTime / this.stats.totalCompletedTasks;
    this.stats.successRate =
      this.stats.totalCompletedTasks /
      (this.stats.totalCompletedTasks + this.stats.totalFailedTasks);
    this.updateTaskStats(task);

    this.emit('task:completed', task);

    this.addEvent(taskId, {
      eventId: generateId('event'),
      taskId,
      eventType: 'completed' as any,
      timestamp: now,
      data: { output, executionTime },
      agentId
    });

    return {
      taskId,
      success: true,
      output,
      executionTime,
      agentId,
      completedAt: now
    };
  }

  /**
   * Fail task with error
   */
  async failTask(taskId: TaskId, error: Error, agentId: AgentId): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AgentFrameworkError(
        `Task ${taskId} not found`,
        FrameworkError.TASK_NOT_FOUND,
        404
      );
    }

    await this.handleTaskError(taskId, error, agentId);
  }

  /**
   * Handle task error
   */
  private async handleTaskError(taskId: TaskId, error: Error, agentId?: AgentId): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    // Check if retryable
    const isRetryable = task.retryPolicy.retryableErrors.some(re =>
      error.message.toLowerCase().includes(re.toLowerCase())
    );

    if (isRetryable && task.retryPolicy.currentRetry < task.retryPolicy.maxRetries) {
      // Retry task
      task.retryPolicy.currentRetry++;
      task.status = TaskStatus.PENDING;

      const delay = Math.min(
        task.retryPolicy.initialDelay * Math.pow(task.retryPolicy.backoffMultiplier, task.retryPolicy.currentRetry),
        task.retryPolicy.maxDelay
      );

      setTimeout(() => {
        this.queueTaskByPriority(task);
      }, delay);

      this.logger.info('Retrying task', {
        taskId,
        attempt: task.retryPolicy.currentRetry,
        delay
      });

      this.addEvent(taskId, {
        eventId: generateId('event'),
        taskId,
        eventType: 'retried' as any,
        timestamp: Date.now(),
        data: { attempt: task.retryPolicy.currentRetry, delay },
        agentId: task.assignedAgent
      });

      return;
    }

    // Mark as failed
    const now = Date.now();
    task.status = TaskStatus.FAILED;
    task.completedAt = now;
    task.actualDuration = task.startedAt ? now - task.startedAt : 0;
    task.error = {
      code: error.name || 'TASK_ERROR',
      message: error.message,
      stack: error.stack,
      retryable: isRetryable,
      occurredAt: now
    };

    // Update stats
    this.stats.totalFailedTasks++;
    this.stats.failureRate = this.stats.totalFailedTasks / this.stats.totalTasks;
    this.stats.successRate =
      this.stats.totalCompletedTasks /
      (this.stats.totalCompletedTasks + this.stats.totalFailedTasks);
    this.updateTaskStats(task);

    this.emit('task:failed', task, error);

    this.addEvent(taskId, {
      eventId: generateId('event'),
      taskId,
      eventType: 'failed' as any,
      timestamp: now,
      data: { error: error.message },
      agentId: agentId || task.assignedAgent
    });
  }

  /**
   * Handle task timeout
   */
  private async handleTaskTimeout(taskId: TaskId): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    const error = new Error(`Task ${taskId} timed out after ${task.timeout}ms`);
    await this.handleTaskError(taskId, error);

    this.emit('task:timeout', task);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: TaskId): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AgentFrameworkError(
        `Task ${taskId} not found`,
        FrameworkError.TASK_NOT_FOUND,
        404
      );
    }

    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.FAILED ||
      task.status === TaskStatus.CANCELLED
    ) {
      throw new Error(`Cannot cancel task in status ${task.status}`);
    }

    task.status = TaskStatus.CANCELLED;
    task.completedAt = Date.now();

    // Update stats
    this.stats.cancellationRate =
      (this.stats.cancellationRate * (this.stats.totalTasks - 1) + 1) / this.stats.totalTasks;
    this.updateTaskStats(task);

    this.emit('task:cancelled', task);

    this.addEvent(taskId, {
      eventId: generateId('event'),
      taskId,
      eventType: 'cancelled' as any,
      timestamp: Date.now(),
      data: {},
      agentId: task.assignedAgent
    });
  }

  /**
   * Update task status
   */
  private async updateTaskStatus(taskId: TaskId, status: TaskStatus): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    task.status = status;
    this.updateTaskStats(task);
  }

  /**
   * Update task statistics
   */
  private updateTaskStats(task: Task): void {
    const status = task.status;
    this.stats.tasksByStatus[status] = (this.stats.tasksByStatus[status] || 0) + 1;
    this.stats.tasksByType[task.type] = (this.stats.tasksByType[task.type] || 0) + 1;
    this.stats.tasksByPriority[TaskPriority[task.priority]] =
      (this.stats.tasksByPriority[TaskPriority[task.priority]] || 0) + 1;
  }

  /**
   * Initialize events for a task
   */
  private initializeEvents(taskId: TaskId): void {
    this.events.set(taskId, []);
  }

  /**
   * Add event to task
   */
  private addEvent(taskId: TaskId, event: TaskEvent): void {
    const events = this.events.get(taskId);
    if (events) {
      events.push(event);
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: TaskId): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Query tasks
   */
  async queryTasks(options: TaskQueryOptions): Promise<TaskQueryResult> {
    let tasks = Array.from(this.tasks.values());

    // Apply filter
    if (options.filter) {
      tasks = this.applyFilter(tasks, options.filter);
    }

    // Apply sorting
    if (options.sort) {
      tasks = this.applySort(tasks, options.sort);
    }

    // Apply pagination
    const totalCount = tasks.length;
    if (options.pagination) {
      const { page, pageSize } = options.pagination;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      tasks = tasks.slice(start, end);

      return {
        tasks,
        totalCount,
        page,
        pageSize,
        hasMore: end < totalCount
      };
    }

    return {
      tasks,
      totalCount,
      page: 1,
      pageSize: totalCount,
      hasMore: false
    };
  }

  /**
   * Apply filter to tasks
   */
  private applyFilter(tasks: Task[], filter: TaskFilter): Task[] {
    return tasks.filter(task => {
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        if (!statuses.includes(task.status)) {
          return false;
        }
      }

      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(task.type)) {
          return false;
        }
      }

      if (filter.priority) {
        const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
        if (!priorities.includes(task.priority)) {
          return false;
        }
      }

      if (filter.assignedAgent) {
        const agents = Array.isArray(filter.assignedAgent) ? filter.assignedAgent : [filter.assignedAgent];
        if (!task.assignedAgent || !agents.includes(task.assignedAgent)) {
          return false;
        }
      }

      if (filter.createdAfter && task.createdAt < filter.createdAfter) {
        return false;
      }

      if (filter.createdBefore && task.createdAt > filter.createdBefore) {
        return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        if (!filter.tags.every(tag => task.metadata.tags.includes(tag))) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply sort to tasks
   */
  private applySort(tasks: Task[], sort: any): Task[] {
    return tasks.sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'priority':
          comparison = b.priority - a.priority;
          break;
        case 'estimatedDuration':
          comparison = (a.estimatedDuration || 0) - (b.estimatedDuration || 0);
          break;
        case 'progress':
          comparison = a.progress.percentage - b.progress.percentage;
          break;
        default:
          comparison = 0;
      }

      return sort.order === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Get task statistics
   */
  getStats(): TaskStats {
    return { ...this.stats };
  }

  /**
   * Get task events
   */
  getTaskEvents(taskId: TaskId): TaskEvent[] {
    return this.events.get(taskId) || [];
  }

  /**
   * Cleanup old tasks
   */
  private cleanup(): void {
    this.logger.debug('Cleaning up old tasks');

    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = now - retentionMs;

    let cleanedCount = 0;

    for (const [taskId, task] of this.tasks) {
      // Remove completed/failed/cancelled tasks older than retention period
      if (
        (task.status === TaskStatus.COMPLETED ||
          task.status === TaskStatus.FAILED ||
          task.status === TaskStatus.CANCELLED) &&
        task.completedAt &&
        task.completedAt < cutoffTime
      ) {
        this.tasks.delete(taskId);
        this.events.delete(taskId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Cleaned up old tasks', { count: cleanedCount });
    }
  }

  /**
   * Shutdown task manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down task manager');

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Wait for all queued tasks to complete
    await this.taskQueue.onIdle();

    this.removeAllListeners();
    this.tasks.clear();
    this.workflows.clear();
    this.events.clear();
  }
}
