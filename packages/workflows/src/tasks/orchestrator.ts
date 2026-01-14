/**
 * Task Orchestrator
 * Manages task definitions, dependencies, execution, monitoring, and resource allocation
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  NodeId,
  Workflow,
  Node,
  Connection,
  RetryConfig
} from '../types';

export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'action' | 'condition' | 'loop' | 'parallel' | 'wait';
  actionType?: string;
  config: TaskConfig;
  requirements: TaskRequirements;
  priority: TaskPriority;
  dependencies: string[];
  timeout?: number;
  retryConfig?: RetryConfig;
  metadata: TaskMetadata;
}

export interface TaskConfig {
  [key: string]: any;
  action?: string;
  parameters?: Record<string, any>;
  conditions?: any[];
  branches?: any[];
  iterations?: any;
  waitTime?: number;
}

export interface TaskRequirements {
  cpu?: number;
  memory?: number;
  storage?: number;
  network?: boolean;
  services?: string[];
  capabilities?: string[];
}

export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  BACKGROUND = 4
}

export interface TaskMetadata {
  tags?: string[];
  category?: string;
  estimatedCost?: number;
  estimatedDuration?: number;
  owner?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskExecution {
  taskId: string;
  status: TaskExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: TaskError;
  retryCount: number;
  resourceUsage: ResourceUsage;
  logs: TaskLog[];
}

export enum TaskExecutionStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  SKIPPED = 'skipped'
}

export interface TaskError {
  code: string;
  message: string;
  stack?: string;
  details?: Record<string, any>;
  retryable: boolean;
}

export interface ResourceUsage {
  cpuTime: number;
  memoryBytes: number;
  storageBytes: number;
  networkBytes: number;
}

export interface TaskLog {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  data?: any;
}

export interface ResourcePool {
  id: string;
  name: string;
  type: 'cpu' | 'memory' | 'storage' | 'custom';
  capacity: number;
  available: number;
  allocated: number;
  reservations: Map<string, ResourceReservation>;
}

export interface ResourceReservation {
  taskId: string;
  amount: number;
  startTime: Date;
  endTime?: Date;
}

export interface TaskSchedule {
  taskId: string;
  scheduledTime: Date;
  priority: TaskPriority;
  dependencies: string[];
  estimatedDuration?: number;
  deadline?: Date;
}

export class TaskOrchestrator {
  private taskDefinitions: Map<string, TaskDefinition>;
  private taskExecutions: Map<string, TaskExecution>;
  private resourcePools: Map<string, ResourcePool>;
  private taskQueue: TaskQueue;
  private executionHistory: TaskExecution[];
  private monitors: TaskMonitor[];
  private loadBalancer: LoadBalancer;

  constructor(config: OrchestratorConfig = {}) {
    this.taskDefinitions = new Map();
    this.taskExecutions = new Map();
    this.resourcePools = new Map();
    this.executionHistory = [];
    this.monitors = [];
    this.taskQueue = new TaskQueue(config.maxQueueSize || 10000);
    this.loadBalancer = new LoadBalancer(config.loadBalancingStrategy || 'round-robin');

    this.initializeResourcePools(config);
  }

  /**
   * Initialize resource pools
   */
  private initializeResourcePools(config: OrchestratorConfig): void {
    // CPU pool
    this.createResourcePool({
      id: 'cpu-pool',
      name: 'CPU Pool',
      type: 'cpu',
      capacity: config.cpuCapacity || 100,
      available: config.cpuCapacity || 100
    });

    // Memory pool
    this.createResourcePool({
      id: 'memory-pool',
      name: 'Memory Pool',
      type: 'memory',
      capacity: config.memoryCapacity || 1024 * 1024 * 1024, // 1GB
      available: config.memoryCapacity || 1024 * 1024 * 1024
    });

    // Storage pool
    this.createResourcePool({
      id: 'storage-pool',
      name: 'Storage Pool',
      type: 'storage',
      capacity: config.storageCapacity || 10 * 1024 * 1024 * 1024, // 10GB
      available: config.storageCapacity || 10 * 1024 * 1024 * 1024
    });
  }

  /**
   * Register a task definition
   */
  public registerTaskDefinition(definition: TaskDefinition): void {
    definition.metadata.createdAt = new Date();
    definition.metadata.updatedAt = new Date();
    this.taskDefinitions.set(definition.id, definition);
  }

  /**
   * Get task definition
   */
  public getTaskDefinition(taskId: string): TaskDefinition | undefined {
    return this.taskDefinitions.get(taskId);
  }

  /**
   * Create task from workflow node
   */
  public createTaskFromNode(node: Node, workflow: Workflow): TaskDefinition {
    const definition: TaskDefinition = {
      id: node.id,
      name: node.name,
      description: node.description,
      type: node.type as any,
      actionType: node.actionType,
      config: node.config as TaskConfig,
      requirements: this.estimateTaskRequirements(node),
      priority: this.determineTaskPriority(node, workflow),
      dependencies: this.getTaskDependencies(node, workflow),
      timeout: node.timeout,
      retryConfig: node.retryConfig,
      metadata: {
        category: node.actionType ? this.getCategoryFromActionType(node.actionType) : 'custom',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    this.registerTaskDefinition(definition);
    return definition;
  }

  /**
   * Estimate task requirements
   */
  private estimateTaskRequirements(node: Node): TaskRequirements {
    const requirements: TaskRequirements = {
      cpu: 1,
      memory: 100 * 1024 * 1024, // 100MB
      network: false
    };

    // Estimate based on action type
    if (node.actionType) {
      switch (node.actionType) {
        case 'generate_code':
        case 'code_generation':
          requirements.cpu = 4;
          requirements.memory = 512 * 1024 * 1024; // 512MB
          break;

        case 'http_get':
        case 'http_post':
          requirements.cpu = 1;
          requirements.memory = 50 * 1024 * 1024;
          requirements.network = true;
          break;

        case 'kv_get':
        case 'kv_set':
          requirements.cpu = 0.5;
          requirements.memory = 20 * 1024 * 1024;
          break;

        case 'r2_upload':
        case 'r2_download':
          requirements.cpu = 2;
          requirements.memory = 200 * 1024 * 1024;
          requirements.network = true;
          requirements.storage = 1024 * 1024 * 1024; // 1GB
          break;
      }
    }

    return requirements;
  }

  /**
   * Determine task priority
   */
  private determineTaskPriority(node: Node, workflow: Workflow): TaskPriority {
    // Check if node is on critical path
    if (this.isCriticalNode(node, workflow)) {
      return TaskPriority.CRITICAL;
    }

    // Check if node has high priority tag
    if (node.config?.priority === 'high') {
      return TaskPriority.HIGH;
    }

    // Default priority
    return TaskPriority.MEDIUM;
  }

  /**
   * Check if node is critical
   */
  private isCriticalNode(node: Node, workflow: Workflow): boolean {
    // Simplified check - in production, this would analyze the DAG
    return workflow.nodes.filter(n => n.type === 'trigger').length === 0 &&
           workflow.connections.filter(c => c.targetNodeId === node.id).length === 0;
  }

  /**
   * Get task dependencies
   */
  private getTaskDependencies(node: Node, workflow: Workflow): string[] {
    const dependencies: string[] = [];

    for (const connection of workflow.connections) {
      if (connection.targetNodeId === node.id) {
        dependencies.push(connection.sourceNodeId);
      }
    }

    return dependencies;
  }

  /**
   * Get category from action type
   */
  private getCategoryFromActionType(actionType: string): string {
    const categories: Record<string, string> = {
      'generate_code': 'ai',
      'code_generation': 'ai',
      'chat_completion': 'ai',
      'http_get': 'network',
      'http_post': 'network',
      'kv_get': 'storage',
      'kv_set': 'storage',
      'r2_upload': 'storage',
      'r2_download': 'storage',
      'send_email': 'communication',
      'send_slack': 'communication'
    };

    return categories[actionType] || 'custom';
  }

  /**
   * Schedule a task for execution
   */
  public async scheduleTask(
    taskId: string,
    input?: any,
    schedule?: TaskSchedule
  ): Promise<string> {
    const definition = this.taskDefinitions.get(taskId);
    if (!definition) {
      throw new Error(`Task definition not found: ${taskId}`);
    }

    // Create task execution
    const execution: TaskExecution = {
      taskId,
      status: TaskExecutionStatus.PENDING,
      startTime: new Date(),
      input,
      retryCount: 0,
      resourceUsage: {
        cpuTime: 0,
        memoryBytes: 0,
        storageBytes: 0,
        networkBytes: 0
      },
      logs: []
    };

    this.taskExecutions.set(taskId, execution);

    // Add to queue
    this.taskQueue.enqueue({
      taskId,
      priority: definition.priority,
      dependencies: definition.dependencies,
      scheduledTime: schedule?.scheduledTime || new Date(),
      deadline: schedule?.deadline,
      estimatedDuration: definition.metadata.estimatedDuration
    });

    return taskId;
  }

  /**
   * Execute a task
   */
  public async executeTask(
    taskId: string,
    executor: TaskExecutor
  ): Promise<TaskExecution> {
    const execution = this.taskExecutions.get(taskId);
    if (!execution) {
      throw new Error(`Task execution not found: ${taskId}`);
    }

    const definition = this.taskDefinitions.get(taskId);
    if (!definition) {
      throw new Error(`Task definition not found: ${taskId}`);
    }

    // Allocate resources
    const allocated = await this.allocateResources(taskId, definition.requirements);
    if (!allocated) {
      execution.status = TaskExecutionStatus.QUEUED;
      return execution;
    }

    try {
      execution.status = TaskExecutionStatus.RUNNING;
      this.log(execution, 'info', `Starting task execution: ${definition.name}`);

      // Execute task
      const result = await executor.execute(definition, execution.input || {});

      execution.output = result;
      execution.status = TaskExecutionStatus.COMPLETED;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.log(execution, 'info', `Task completed successfully`, { result });

    } catch (error) {
      execution.error = {
        code: 'TASK_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        retryable: this.isErrorRetryable(error)
      };

      // Handle retry
      if (execution.error.retryable && definition.retryConfig) {
        execution.retryCount++;
        if (execution.retryCount <= definition.retryConfig.maxAttempts) {
          this.log(execution, 'warn', `Retrying task, attempt ${execution.retryCount}`);

          const delay = this.calculateRetryDelay(definition.retryConfig, execution.retryCount);
          await this.sleep(delay);

          return this.executeTask(taskId, executor);
        }
      }

      execution.status = TaskExecutionStatus.FAILED;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.log(execution, 'error', `Task failed`, { error });

    } finally {
      // Release resources
      this.releaseResources(taskId);

      // Add to history
      this.executionHistory.push(execution);
    }

    return execution;
  }

  /**
   * Allocate resources for a task
   */
  private async allocateResources(
    taskId: string,
    requirements: TaskRequirements
  ): Promise<boolean> {
    // Check and allocate CPU
    if (requirements.cpu) {
      const cpuPool = this.resourcePools.get('cpu-pool');
      if (!cpuPool || cpuPool.available < requirements.cpu) {
        return false;
      }
      cpuPool.available -= requirements.cpu;
      cpuPool.allocated += requirements.cpu;
      cpuPool.reservations.set(taskId, {
        taskId,
        amount: requirements.cpu,
        startTime: new Date()
      });
    }

    // Check and allocate memory
    if (requirements.memory) {
      const memoryPool = this.resourcePools.get('memory-pool');
      if (!memoryPool || memoryPool.available < requirements.memory) {
        // Rollback CPU allocation
        if (requirements.cpu) {
          this.releaseResources(taskId);
        }
        return false;
      }
      memoryPool.available -= requirements.memory;
      memoryPool.allocated += requirements.memory;
    }

    // Check and allocate storage
    if (requirements.storage) {
      const storagePool = this.resourcePools.get('storage-pool');
      if (!storagePool || storagePool.available < requirements.storage) {
        // Rollback previous allocations
        this.releaseResources(taskId);
        return false;
      }
      storagePool.available -= requirements.storage;
      storagePool.allocated += requirements.storage;
    }

    return true;
  }

  /**
   * Release resources allocated to a task
   */
  private releaseResources(taskId: string): void {
    for (const pool of this.resourcePools.values()) {
      const reservation = pool.reservations.get(taskId);
      if (reservation) {
        pool.available += reservation.amount;
        pool.allocated -= reservation.amount;
        pool.reservations.delete(taskId);
      }
    }
  }

  /**
   * Check if error is retryable
   */
  private isErrorRetryable(error: any): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'RATE_LIMIT_EXCEEDED'
    ];

    const errorCode = error?.code || error?.message;
    return retryableErrors.some(code => errorCode?.includes(code));
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(retryConfig: RetryConfig, attempt: number): number {
    let delay = retryConfig.initialDelay || 1000;

    switch (retryConfig.backoffType) {
      case 'exponential':
        delay = delay * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = delay * attempt;
        break;
      case 'fixed':
        // Keep the same delay
        break;
    }

    return Math.min(delay, retryConfig.maxDelay || 60000);
  }

  /**
   * Create a resource pool
   */
  public createResourcePool(config: {
    id: string;
    name: string;
    type: 'cpu' | 'memory' | 'storage' | 'custom';
    capacity: number;
    available?: number;
  }): void {
    const pool: ResourcePool = {
      id: config.id,
      name: config.name,
      type: config.type,
      capacity: config.capacity,
      available: config.available || config.capacity,
      allocated: 0,
      reservations: new Map()
    };

    this.resourcePools.set(config.id, pool);
  }

  /**
   * Get resource pool
   */
  public getResourcePool(poolId: string): ResourcePool | undefined {
    return this.resourcePools.get(poolId);
  }

  /**
   * Get all resource pools
   */
  public getResourcePools(): ResourcePool[] {
    return Array.from(this.resourcePools.values());
  }

  /**
   * Get resource utilization
   */
  public getResourceUtilization(): Record<string, number> {
    const utilization: Record<string, number> = {};

    for (const [id, pool] of this.resourcePools) {
      utilization[id] = (pool.allocated / pool.capacity) * 100;
    }

    return utilization;
  }

  /**
   * Add a task monitor
   */
  public addMonitor(monitor: TaskMonitor): void {
    this.monitors.push(monitor);
  }

  /**
   * Remove a task monitor
   */
  public removeMonitor(monitorId: string): void {
    this.monitors = this.monitors.filter(m => m.id !== monitorId);
  }

  /**
   * Notify monitors
   */
  private notifyMonitors(event: string, data: any): void {
    for (const monitor of this.monitors) {
      monitor.notify(event, data);
    }
  }

  /**
   * Log a message for a task execution
   */
  private log(execution: TaskExecution, level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const log: TaskLog = {
      level,
      message,
      timestamp: new Date(),
      data
    };

    execution.logs.push(log);

    // Notify monitors
    this.notifyMonitors('log', {
      taskId: execution.taskId,
      log
    });
  }

  /**
   * Get task execution
   */
  public getTaskExecution(taskId: string): TaskExecution | undefined {
    return this.taskExecutions.get(taskId);
  }

  /**
   * Get task execution status
   */
  public getTaskStatus(taskId: string): TaskExecutionStatus | undefined {
    return this.taskExecutions.get(taskId)?.status;
  }

  /**
   * Cancel a task
   */
  public async cancelTask(taskId: string): Promise<void> {
    const execution = this.taskExecutions.get(taskId);
    if (execution && (execution.status === TaskExecutionStatus.PENDING || execution.status === TaskExecutionStatus.RUNNING)) {
      execution.status = TaskExecutionStatus.CANCELLED;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.releaseResources(taskId);
      this.taskQueue.remove(taskId);

      this.log(execution, 'info', 'Task cancelled');
    }
  }

  /**
   * Get execution history
   */
  public getExecutionHistory(limit?: number): TaskExecution[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Get task queue status
   */
  public getQueueStatus(): {
    size: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    return {
      size: this.taskQueue.size(),
      pending: this.taskQueue.getPendingCount(),
      running: Array.from(this.taskExecutions.values()).filter(
        e => e.status === TaskExecutionStatus.RUNNING
      ).length,
      completed: Array.from(this.taskExecutions.values()).filter(
        e => e.status === TaskExecutionStatus.COMPLETED
      ).length,
      failed: Array.from(this.taskExecutions.values()).filter(
        e => e.status === TaskExecutionStatus.FAILED
      ).length
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  maxQueueSize?: number;
  cpuCapacity?: number;
  memoryCapacity?: number;
  storageCapacity?: number;
  loadBalancingStrategy?: 'round-robin' | 'least-loaded' | 'weighted';
}

/**
 * Task executor interface
 */
export interface TaskExecutor {
  execute(definition: TaskDefinition, input: any): Promise<any>;
}

/**
 * Task queue
 */
class TaskQueue {
  private queue: TaskSchedule[];
  private maxSize: number;

  constructor(maxSize: number) {
    this.queue = [];
    this.maxSize = maxSize;
  }

  enqueue(schedule: TaskSchedule): void {
    if (this.queue.length >= this.maxSize) {
      throw new Error('Task queue is full');
    }

    this.queue.push(schedule);
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  dequeue(): TaskSchedule | undefined {
    return this.queue.shift();
  }

  remove(taskId: string): void {
    this.queue = this.queue.filter(s => s.taskId !== taskId);
  }

  size(): number {
    return this.queue.length;
  }

  getPendingCount(): number {
    return this.queue.filter(s => s.scheduledTime <= new Date()).length;
  }

  peek(): TaskSchedule | undefined {
    return this.queue[0];
  }
}

/**
 * Task monitor
 */
export interface TaskMonitor {
  id: string;
  notify(event: string, data: any): void;
}

/**
 * Load balancer
 */
class LoadBalancer {
  private strategy: 'round-robin' | 'least-loaded' | 'weighted';
  private currentIndex: number = 0;

  constructor(strategy: 'round-robin' | 'least-loaded' | 'weighted') {
    this.strategy = strategy;
  }

  selectWorker(workers: any[]): any {
    if (workers.length === 0) {
      throw new Error('No workers available');
    }

    switch (this.strategy) {
      case 'round-robin':
        return workers[this.currentIndex++ % workers.length];

      case 'least-loaded':
        return workers.reduce((min, worker) =>
          worker.load < min.load ? worker : min
        );

      case 'weighted':
        // Simplified - would use actual weights in production
        return workers[Math.floor(Math.random() * workers.length)];

      default:
        return workers[0];
    }
  }
}
