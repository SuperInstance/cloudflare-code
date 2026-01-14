/**
 * Agent Orchestrator
 *
 * Core orchestration engine for coordinating multiple agents,
 * handling task distribution, load balancing, and workflow management.
 */

import type {
  AgentId,
  AgentInfo,
  AgentSelectionCriteria,
  Task,
  TaskId,
  CreateTaskParams
} from '../types';
import { AgentState, AgentHealth, TaskStatus } from '../types';
import { AgentRegistry } from '../registry/registry';
import { TaskManager } from '../tasks/manager';
import { MessageBroker } from '../communication/protocol';
import { createLogger } from '../utils/logger';
import { generateId, parallel, chunk } from '../utils/helpers';
import { EventEmitter } from 'eventemitter3';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  maxConcurrentWorkflows: number;
  defaultTaskTimeout: number;
  loadBalancingStrategy: LoadBalancingStrategy;
  workflowTimeout: number;
  enableMonitoring: boolean;
  enableMetrics: boolean;
}

/**
 * Load balancing strategies
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_LOADED = 'least_loaded',
  RANDOM = 'random',
  CAPABILITY_BASED = 'capability_based',
  WEIGHTED = 'weighted'
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  workflowId: string;
  tasks: Task[];
  completedTasks: Set<TaskId>;
  failedTasks: Set<TaskId>;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

/**
 * Orchestrator metrics
 */
export interface OrchestratorMetrics {
  workflowsStarted: number;
  workflowsCompleted: number;
  workflowsFailed: number;
  tasksDistributed: number;
  tasksCompleted: number;
  tasksFailed: number;
  averageWorkflowDuration: number;
  currentActiveWorkflows: number;
  messageThroughput: number;
}

/**
 * Orchestrator events
 */
export interface OrchestratorEvents {
  'workflow:started': (context: WorkflowContext) => void;
  'workflow:completed': (context: WorkflowContext) => void;
  'workflow:failed': (context: WorkflowContext, error: Error) => void;
  'task:distributed': (task: Task, agentId: AgentId) => void;
  'task:completed': (task: Task, agentId: AgentId) => void;
  'task:failed': (task: Task, agentId: AgentId, error: Error) => void;
}

/**
 * Agent Orchestrator class
 */
export class AgentOrchestrator extends EventEmitter<OrchestratorEvents> {
  private registry: AgentRegistry;
  private taskManager: TaskManager;
  private messageBroker: MessageBroker;
  private config: OrchestratorConfig;
  private logger = createLogger('AgentOrchestrator');
  private workflows: Map<string, WorkflowContext>;
  private metrics: OrchestratorMetrics;
  private roundRobinIndex: Map<string, number>;

  constructor(
    registry: AgentRegistry,
    taskManager: TaskManager,
    messageBroker: MessageBroker,
    config: Partial<OrchestratorConfig> = {}
  ) {
    super();

    this.registry = registry;
    this.taskManager = taskManager;
    this.messageBroker = messageBroker;
    this.workflows = new Map();
    this.roundRobinIndex = new Map();
    this.metrics = this.initializeMetrics();

    this.config = {
      maxConcurrentWorkflows: 100,
      defaultTaskTimeout: 30000,
      loadBalancingStrategy: LoadBalancingStrategy.LEAST_LOADED,
      workflowTimeout: 300000,
      enableMonitoring: true,
      enableMetrics: true,
      ...config
    };

    this.setupEventHandlers();
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): OrchestratorMetrics {
    return {
      workflowsStarted: 0,
      workflowsCompleted: 0,
      workflowsFailed: 0,
      tasksDistributed: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      averageWorkflowDuration: 0,
      currentActiveWorkflows: 0,
      messageThroughput: 0
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.messageBroker.on('message:received', async (message) => {
      if (message.type === 'task_completion') {
        await this.handleTaskCompletion(message);
      } else if (message.type === 'task_failure') {
        await this.handleTaskFailure(message);
      }
    });
  }

  /**
   * Execute a workflow with multiple tasks
   */
  async executeWorkflow(
    tasksParams: CreateTaskParams[],
    options: {
      strategy?: 'sequential' | 'parallel' | 'pipeline';
      maxConcurrency?: number;
      timeout?: number;
    } = {}
  ): Promise<WorkflowContext> {
    const workflowId = generateId('workflow');
    const { strategy = 'parallel', maxConcurrency = 10, timeout } = options;

    this.logger.info('Starting workflow', { workflowId, taskCount: tasksParams.length, strategy });

    // Check workflow limit
    if (this.workflows.size >= this.config.maxConcurrentWorkflows) {
      throw new Error('Maximum concurrent workflows exceeded');
    }

    // Create tasks
    const tasks: Task[] = [];
    for (const params of tasksParams) {
      const task = await this.taskManager.createTask(params);
      tasks.push(task);
    }

    // Create workflow context
    const context: WorkflowContext = {
      workflowId,
      tasks,
      completedTasks: new Set(),
      failedTasks: new Set(),
      startTime: Date.now(),
      status: 'running'
    };

    this.workflows.set(workflowId, context);
    this.metrics.workflowsStarted++;
    this.metrics.currentActiveWorkflows++;

    this.emit('workflow:started', context);

    try {
      // Execute based on strategy
      if (strategy === 'sequential') {
        await this.executeSequential(context);
      } else if (strategy === 'parallel') {
        await this.executeParallel(context, maxConcurrency);
      } else if (strategy === 'pipeline') {
        await this.executePipeline(context);
      }

      // Check for failures
      if (context.failedTasks.size > 0) {
        context.status = 'failed';
        this.metrics.workflowsFailed++;
        this.emit('workflow:failed', context, new Error('Some tasks failed'));
      } else {
        context.status = 'completed';
        this.metrics.workflowsCompleted++;
        this.emit('workflow:completed', context);
      }
    } catch (error) {
      context.status = 'failed';
      this.metrics.workflowsFailed++;
      this.emit('workflow:failed', context, error as Error);
      throw error;
    } finally {
      context.endTime = Date.now();
      this.metrics.currentActiveWorkflows--;
      this.updateWorkflowMetrics(context);
    }

    return context;
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(context: WorkflowContext): Promise<void> {
    for (const task of context.tasks) {
      const agentId = await this.selectAgentForTask(task);
      await this.distributeTask(task, agentId);
      await this.waitForTaskCompletion(task.id);
    }
  }

  /**
   * Execute tasks in parallel
   */
  private async executeParallel(context: WorkflowContext, maxConcurrency: number): Promise<void> {
    const taskPromises = context.tasks.map(async (task) => {
      const agentId = await this.selectAgentForTask(task);
      await this.distributeTask(task, agentId);
      return this.waitForTaskCompletion(task.id);
    });

    const chunks = chunk(taskPromises, maxConcurrency);
    for (const taskChunk of chunks) {
      await parallel(taskChunk, maxConcurrency);
    }
  }

  /**
   * Execute tasks as a pipeline
   */
  private async executePipeline(context: WorkflowContext): Promise<void> {
    for (let i = 0; i < context.tasks.length; i++) {
      const task = context.tasks[i];
      const agentId = await this.selectAgentForTask(task);

      // Pass output from previous task
      if (i > 0) {
        const previousTask = context.tasks[i - 1];
        task.input.data.previousOutput = previousTask.output?.data;
      }

      await this.distributeTask(task, agentId);
      await this.waitForTaskCompletion(task.id);

      if (context.failedTasks.has(task.id)) {
        break; // Stop pipeline on failure
      }
    }
  }

  /**
   * Select an agent for a task
   */
  async selectAgentForTask(task: Task, criteria?: AgentSelectionCriteria): Promise<AgentId> {
    const selectionCriteria: AgentSelectionCriteria = {
      capabilities: [task.type],
      minHealth: AgentHealth.HEALTHY,
      maxLoad: 0.8,
      priority: this.getPriorityFromStrategy(),
      ...criteria
    };

    const agents = await this.registry.discoverAgents(selectionCriteria);

    if (agents.length === 0) {
      throw new Error(`No suitable agents found for task type: ${task.type}`);
    }

    const selectedAgent = this.applyLoadBalancing(agents);
    this.logger.debug('Selected agent for task', {
      taskId: task.id,
      agentId: selectedAgent.id,
      strategy: this.config.loadBalancingStrategy
    });

    return selectedAgent.id;
  }

  /**
   * Get priority from load balancing strategy
   */
  private getPriorityFromStrategy(): 'load' | 'capability' | 'random' | 'round-robin' {
    switch (this.config.loadBalancingStrategy) {
      case LoadBalancingStrategy.LEAST_LOADED:
        return 'load';
      case LoadBalancingStrategy.CAPABILITY_BASED:
        return 'capability';
      case LoadBalancingStrategy.RANDOM:
        return 'random';
      case LoadBalancingStrategy.ROUND_ROBIN:
        return 'round-robin';
      default:
        return 'load';
    }
  }

  /**
   * Apply load balancing strategy to select agent
   */
  private applyLoadBalancing(agents: AgentInfo[]): AgentInfo {
    switch (this.config.loadBalancingStrategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.roundRobinSelect(agents);

      case LoadBalancingStrategy.LEAST_LOADED:
        return agents.reduce((min, agent) =>
          agent.load < min.load ? agent : min
        );

      case LoadBalancingStrategy.RANDOM:
        return agents[Math.floor(Math.random() * agents.length)];

      case LoadBalancingStrategy.CAPABILITY_BASED:
        return agents.reduce((best, agent) =>
          agent.capabilities.length > best.capabilities.length ? agent : best
        );

      case LoadBalancingStrategy.WEIGHTED:
        return this.weightedSelect(agents);

      default:
        return agents[0];
    }
  }

  /**
   * Round-robin agent selection
   */
  private roundRobinSelect(agents: AgentInfo[]): AgentInfo {
    const key = agents.map(a => a.id).sort().join(',');
    let index = this.roundRobinIndex.get(key) || 0;
    const agent = agents[index % agents.length];
    index++;
    this.roundRobinIndex.set(key, index);
    return agent;
  }

  /**
   * Weighted agent selection
   */
  private weightedSelect(agents: AgentInfo[]): AgentInfo {
    const totalWeight = agents.reduce((sum, agent) => sum + (1 - agent.load), 0);
    let random = Math.random() * totalWeight;

    for (const agent of agents) {
      random -= (1 - agent.load);
      if (random <= 0) {
        return agent;
      }
    }

    return agents[0];
  }

  /**
   * Distribute a task to an agent
   */
  private async distributeTask(task: Task, agentId: AgentId): Promise<void> {
    this.logger.debug('Distributing task to agent', { taskId: task.id, agentId });

    // Send task assignment message
    await this.messageBroker.send({
      id: generateId('msg'),
      type: 'task_assignment' as any,
      from: 'orchestrator',
      to: agentId,
      payload: {
        type: 'json',
        data: { task }
      },
      priority: 1,
      timestamp: Date.now(),
      deliveryGuarantee: 'at_least_once' as any,
      routingStrategy: 'direct' as any,
      headers: {
        contentType: 'application/json'
      },
      metadata: {}
    });

    this.metrics.tasksDistributed++;
    this.emit('task:distributed', task, agentId);
  }

  /**
   * Wait for task completion
   */
  private async waitForTaskCompletion(taskId: TaskId): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${taskId} timeout`));
      }, this.config.defaultTaskTimeout);

      const checkInterval = setInterval(() => {
        const task = this.taskManager.getTask(taskId);
        if (!task) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          reject(new Error(`Task ${taskId} not found`));
          return;
        }

        if (task.status === TaskStatus.COMPLETED) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve();
        } else if (task.status === TaskStatus.FAILED || task.status === TaskStatus.CANCELLED) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          reject(new Error(`Task ${taskId} ${task.status}`));
        }
      }, 100);
    });
  }

  /**
   * Handle task completion
   */
  private async handleTaskCompletion(message: any): Promise<void> {
    const { taskId, agentId } = message.payload.data;
    const context = this.findWorkflowByTask(taskId);

    if (context) {
      context.completedTasks.add(taskId);
      this.metrics.tasksCompleted++;
      this.emit('task:completed', this.taskManager.getTask(taskId)!, agentId);
    }
  }

  /**
   * Handle task failure
   */
  private async handleTaskFailure(message: any): Promise<void> {
    const { taskId, agentId, error } = message.payload.data;
    const context = this.findWorkflowByTask(taskId);

    if (context) {
      context.failedTasks.add(taskId);
      this.metrics.tasksFailed++;
      this.emit('task:failed', this.taskManager.getTask(taskId)!, agentId, error);
    }
  }

  /**
   * Find workflow by task ID
   */
  private findWorkflowByTask(taskId: TaskId): WorkflowContext | undefined {
    for (const context of this.workflows.values()) {
      if (context.tasks.some(t => t.id === taskId)) {
        return context;
      }
    }
    return undefined;
  }

  /**
   * Update workflow metrics
   */
  private updateWorkflowMetrics(context: WorkflowContext): void {
    const duration = context.endTime! - context.startTime;
    const totalWorkflows = this.metrics.workflowsCompleted + this.metrics.workflowsFailed;
    this.metrics.averageWorkflowDuration =
      (this.metrics.averageWorkflowDuration * (totalWorkflows - 1) + duration) / totalWorkflows;
  }

  /**
   * Get orchestrator metrics
   */
  getMetrics(): OrchestratorMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): WorkflowContext[] {
    return Array.from(this.workflows.values()).filter(w => w.status === 'running');
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    const context = this.workflows.get(workflowId);
    if (!context) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    context.status = 'cancelled';

    // Cancel all running tasks
    for (const task of context.tasks) {
      if (task.status === TaskStatus.RUNNING || task.status === TaskStatus.ASSIGNED) {
        await this.taskManager.cancelTask(task.id);
      }
    }

    this.metrics.currentActiveWorkflows--;
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down orchestrator');

    // Cancel all active workflows
    const activeWorkflows = this.getActiveWorkflows();
    await Promise.all(activeWorkflows.map(w => this.cancelWorkflow(w.workflowId)));

    this.removeAllListeners();
    this.workflows.clear();
  }
}
