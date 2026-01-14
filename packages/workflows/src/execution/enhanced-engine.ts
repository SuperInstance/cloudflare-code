/**
 * Enhanced Workflow Execution Engine
 * Provides DAG execution, task scheduling, state management, and error recovery
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Workflow,
  Execution,
  ExecutionId,
  NodeExecution,
  ExecutionStatus,
  NodeStatus,
  TriggerInfo,
  ExecutionMetadata,
  NodeId,
  Node,
  Connection,
  ExecutionError
} from '../types';
import { DAGManager } from '../engine/dag';
import { ActionExecutor } from '../engine/action-executor';
import { ConditionEvaluator } from '../conditions/evaluator';
import { ExecutionLogger } from '../engine/logger';

export interface EnhancedEngineConfig {
  maxConcurrentExecutions?: number;
  defaultTimeout?: number;
  enableMetrics?: boolean;
  enableTracing?: boolean;
  maxRetries?: number;
  checkpointInterval?: number;
  statePersistenceEnabled?: boolean;
  durableObjectId?: string;
  enableCancellation?: boolean;
  enableProgressiveExecution?: boolean;
}

export interface ExecutionContext {
  executionId: ExecutionId;
  workflowId: string;
  variables: Map<string, any>;
  nodeResults: Map<NodeId, any>;
  logs: ExecutionLogger;
  metadata: ExecutionMetadata;
  state: ExecutionState;
  checkpoints: Map<number, ExecutionCheckpoint>;
}

export interface ExecutionState {
  status: ExecutionStatus;
  currentLevel: number;
  completedNodes: Set<NodeId>;
  failedNodes: Set<NodeId>;
  runningNodes: Set<NodeId>;
  pendingNodes: Set<NodeId>;
  skippedNodes: Set<NodeId>;
  startTime: Date;
  lastCheckpointTime?: Date;
}

export interface ExecutionCheckpoint {
  level: number;
  completedNodes: NodeId[];
  nodeStates: Map<NodeId, any>;
  variables: Map<string, any>;
  timestamp: Date;
}

export interface TaskScheduler {
  schedule(tasks: ScheduledTask[]): void;
  cancel(taskId: string): void;
  getStatus(taskId: string): TaskStatus;
}

export interface ScheduledTask {
  id: string;
  nodeId: NodeId;
  priority: number;
  dependencies: NodeId[];
  estimatedDuration?: number;
  timeout?: number;
  retryConfig?: any;
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export interface ExecutionPlan {
  levels: NodeId[][];
  parallelExecutions: Map<NodeId, Set<NodeId>>;
  dependencies: Map<NodeId, Set<NodeId>>;
  criticalPath: NodeId[];
  estimatedDuration: number;
}

export interface ExecutionMetrics {
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  skippedNodes: number;
  averageNodeDuration: number;
  totalDuration: number;
  memoryUsage: number;
  cpuUsage: number;
}

export class EnhancedWorkflowEngine {
  private config: Required<EnhancedEngineConfig>;
  private actionExecutor: ActionExecutor;
  private conditionEvaluator: ConditionEvaluator;
  private runningExecutions: Map<ExecutionId, Execution>;
  private taskScheduler: TaskScheduler;
  private cancellationTokens: Map<ExecutionId, CancellationToken>;

  constructor(config: EnhancedEngineConfig = {}) {
    this.config = {
      maxConcurrentExecutions: 100,
      defaultTimeout: 300000,
      enableMetrics: true,
      enableTracing: false,
      maxRetries: 3,
      checkpointInterval: 30000,
      statePersistenceEnabled: false,
      durableObjectId: '',
      enableCancellation: true,
      enableProgressiveExecution: false,
      ...config
    };

    this.actionExecutor = new ActionExecutor();
    this.conditionEvaluator = new ConditionEvaluator();
    this.runningExecutions = new Map();
    this.cancellationTokens = new Map();
    this.taskScheduler = new PriorityTaskScheduler(this.config.maxConcurrentExecutions);
  }

  /**
   * Execute a workflow with enhanced features
   */
  public async execute(
    workflow: Workflow,
    input: any,
    trigger: TriggerInfo,
    onCancel?: () => void
  ): Promise<Execution> {
    const executionId = uuidv4() as ExecutionId;

    // Create execution context
    const context: ExecutionContext = this.createContext(workflow, input, trigger, executionId);

    // Create execution object
    const execution: Execution = {
      id: executionId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status: 'running' as ExecutionStatus,
      nodes: [],
      startTime: new Date(),
      input,
      triggeredBy: trigger,
      metadata: context.metadata
    };

    this.runningExecutions.set(executionId, execution);

    // Create cancellation token
    if (this.config.enableCancellation) {
      this.cancellationTokens.set(executionId, new CancellationToken(onCancel));
    }

    try {
      // Build DAG and create execution plan
      const dag = new DAGManager(workflow.nodes, workflow.connections);
      const validation = dag.validate();

      if (!validation.valid) {
        throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
      }

      const plan = this.createEnhancedExecutionPlan(dag, workflow);

      context.logs.info('Starting workflow execution', {
        workflowId: workflow.id,
        executionId,
        plan: {
          levels: plan.levels.length,
          totalNodes: plan.estimatedDuration,
          criticalPath: plan.criticalPath
        }
      });

      // Execute workflow with checkpointing
      await this.executeWithCheckpoints(workflow, plan, context, execution);

      // Mark execution as completed
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.output = this.collectOutput(workflow, context);

      context.logs.info('Workflow execution completed', {
        executionId,
        duration: execution.duration,
        metrics: this.calculateMetrics(context, execution)
      });

    } catch (error) {
      execution.status = this.handleExecutionError(error, context, execution);
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      context.logs.error('Workflow execution failed', {
        executionId,
        error: execution.error
      });

      throw error;
    } finally {
      this.cleanup(executionId);
    }

    return execution;
  }

  /**
   * Create execution context
   */
  private createContext(
    workflow: Workflow,
    input: any,
    trigger: TriggerInfo,
    executionId: ExecutionId
  ): ExecutionContext {
    const context: ExecutionContext = {
      executionId,
      workflowId: workflow.id,
      variables: new Map(),
      nodeResults: new Map(),
      logs: new ExecutionLogger(executionId),
      metadata: {
        correlationId: uuidv4(),
        tags: {}
      },
      state: {
        status: 'running',
        currentLevel: 0,
        completedNodes: new Set(),
        failedNodes: new Set(),
        runningNodes: new Set(),
        pendingNodes: new Set(),
        skippedNodes: new Set(),
        startTime: new Date()
      },
      checkpoints: new Map()
    };

    // Initialize variables
    for (const variable of workflow.variables) {
      context.variables.set(variable.name, variable.value);
    }

    // Add input to variables
    if (input) {
      for (const [key, value] of Object.entries(input)) {
        context.variables.set(key, value);
      }
    }

    // Initialize pending nodes
    for (const node of workflow.nodes) {
      context.state.pendingNodes.add(node.id);
    }

    return context;
  }

  /**
   * Create enhanced execution plan with critical path analysis
   */
  private createEnhancedExecutionPlan(dag: DAGManager, workflow: Workflow): ExecutionPlan {
    const basicPlan = dag.createExecutionPlan();

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(workflow, basicPlan);

    // Estimate duration
    const estimatedDuration = this.estimateExecutionDuration(workflow, basicPlan);

    return {
      levels: basicPlan.levels,
      parallelExecutions: basicPlan.parallelExecutions,
      dependencies: basicPlan.dependencies,
      criticalPath,
      estimatedDuration
    };
  }

  /**
   * Calculate critical path
   */
  private calculateCriticalPath(workflow: Workflow, plan: any): NodeId[] {
    // Simplified critical path calculation
    // In production, this would consider node durations and dependencies
    const criticalPath: NodeId[] = [];

    for (const level of plan.levels) {
      // Find the node with the most dependencies in each level
      const nodeWithMostDeps = level.reduce((max: NodeId, nodeId: NodeId) => {
        const deps = plan.dependencies.get(nodeId)?.size || 0;
        const maxDeps = plan.dependencies.get(max)?.size || 0;
        return deps > maxDeps ? nodeId : max;
      }, level[0]);

      criticalPath.push(nodeWithMostDeps);
    }

    return criticalPath;
  }

  /**
   * Estimate execution duration
   */
  private estimateExecutionDuration(workflow: Workflow, plan: any): number {
    let totalDuration = 0;

    for (const node of workflow.nodes) {
      // Use timeout as estimate, or default to 1 second
      const nodeDuration = node.timeout || 1000;
      totalDuration += nodeDuration;
    }

    return totalDuration;
  }

  /**
   * Execute workflow with checkpointing support
   */
  private async executeWithCheckpoints(
    workflow: Workflow,
    plan: ExecutionPlan,
    context: ExecutionContext,
    execution: Execution
  ): Promise<void> {
    let lastCheckpointTime = Date.now();

    for (let levelIndex = 0; levelIndex < plan.levels.length; levelIndex++) {
      // Check for cancellation
      if (this.cancellationTokens.get(context.executionId)?.isCancelled) {
        throw new Error('Execution cancelled');
      }

      const level = plan.levels[levelIndex];
      context.state.currentLevel = levelIndex;

      context.logs.debug(`Executing level ${levelIndex}`, {
        nodeCount: level.length,
        nodes: level
      });

      // Check if checkpoint is needed
      const shouldCheckpoint =
        this.config.statePersistenceEnabled &&
        Date.now() - lastCheckpointTime > this.config.checkpointInterval;

      if (shouldCheckpoint) {
        await this.createCheckpoint(levelIndex, context);
        lastCheckpointTime = Date.now();
      }

      // Schedule tasks for this level
      const tasks = this.createTasksForLevel(workflow, level, context);
      this.taskScheduler.schedule(tasks);

      // Execute all nodes in this level in parallel
      const executions = level.map(nodeId =>
        this.executeNodeWithRetry(workflow, nodeId, context, execution)
      );

      await Promise.all(executions);

      context.logs.debug(`Completed level ${levelIndex}`);
    }

    // Create final checkpoint
    if (this.config.statePersistenceEnabled) {
      await this.createCheckpoint(plan.levels.length, context);
    }
  }

  /**
   * Create tasks for a level
   */
  private createTasksForLevel(
    workflow: Workflow,
    level: NodeId[],
    context: ExecutionContext
  ): ScheduledTask[] {
    return level.map(nodeId => {
      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      // Calculate priority based on position in critical path
      const priority = node.timeout || 1000;

      return {
        id: uuidv4(),
        nodeId,
        priority,
        dependencies: [], // Dependencies are handled by level
        estimatedDuration: node.timeout,
        timeout: node.timeout,
        retryConfig: node.retryConfig
      };
    });
  }

  /**
   * Execute a node with retry logic
   */
  private async executeNodeWithRetry(
    workflow: Workflow,
    nodeId: NodeId,
    context: ExecutionContext,
    execution: Execution
  ): Promise<void> {
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    if (!node.enabled) {
      context.state.skippedNodes.add(nodeId);
      context.logs.info(`Skipping disabled node: ${nodeId}`);
      return;
    }

    context.state.pendingNodes.delete(nodeId);
    context.state.runningNodes.add(nodeId);

    // Create node execution record
    const nodeExecution: NodeExecution = {
      nodeId,
      status: 'running' as NodeStatus,
      startTime: new Date()
    };
    execution.nodes.push(nodeExecution);

    context.logs.info(`Executing node: ${node.name} (${nodeId})`);

    let attempt = 0;
    const maxAttempts = node.retryConfig?.maxAttempts || this.config.maxRetries;

    while (attempt <= maxAttempts) {
      try {
        const result = await this.executeNode(node, workflow, context);

        // Update node execution
        nodeExecution.status = 'completed';
        nodeExecution.output = result;

        context.nodeResults.set(nodeId, result);
        context.state.completedNodes.add(nodeId);
        context.state.runningNodes.delete(nodeId);

        context.logs.info(`Completed node: ${node.name}`, {
          nodeId,
          attempt,
          result
        });

        return;
      } catch (error) {
        attempt++;

        if (attempt > maxAttempts) {
          // All retries exhausted
          nodeExecution.status = 'failed';
          nodeExecution.error = {
            code: 'NODE_EXECUTION_FAILED',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            node: nodeId
          };

          context.state.failedNodes.add(nodeId);
          context.state.runningNodes.delete(nodeId);

          context.logs.error(`Failed node: ${node.name}`, {
            nodeId,
            attempts: attempt,
            error
          });

          throw error;
        }

        // Calculate delay for next retry
        const delay = this.calculateRetryDelay(node.retryConfig, attempt);

        context.logs.warn(`Retrying node ${nodeId}, attempt ${attempt}/${maxAttempts}`, {
          delay
        });

        await this.sleep(delay);
      }
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: Node,
    workflow: Workflow,
    context: ExecutionContext
  ): Promise<any> {
    // Check for cancellation before execution
    if (this.cancellationTokens.get(context.executionId)?.isCancelled) {
      throw new Error('Execution cancelled');
    }

    // Apply timeout if specified
    const timeout = node.timeout || this.config.defaultTimeout;

    return Promise.race([
      this.executeNodeInternal(node, workflow, context),
      this.createTimeoutPromise(timeout, node.id)
    ]);
  }

  /**
   * Internal node execution
   */
  private async executeNodeInternal(
    node: Node,
    workflow: Workflow,
    context: ExecutionContext
  ): Promise<any> {
    switch (node.type) {
      case 'trigger':
        return await this.executeTriggerNode(node, context);

      case 'action':
        return await this.executeActionNode(node, workflow, context);

      case 'condition':
        return await this.executeConditionNode(node, context);

      case 'loop':
        return await this.executeLoopNode(node, context);

      case 'parallel':
        return await this.executeParallelNode(node, context);

      case 'wait':
        return await this.executeWaitNode(node, context);

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * Execute a trigger node
   */
  private async executeTriggerNode(node: Node, context: ExecutionContext): Promise<any> {
    context.logs.debug(`Trigger node ${node.id} is passive`);
    return null;
  }

  /**
   * Execute an action node
   */
  private async executeActionNode(
    node: Node,
    workflow: Workflow,
    context: ExecutionContext
  ): Promise<any> {
    if (!node.actionType) {
      throw new Error(`Action node ${node.id} missing actionType`);
    }

    const input = this.prepareNodeInput(node, context, workflow);

    const result = await this.actionExecutor.execute(
      node.actionType,
      input,
      node.config,
      context
    );

    return result;
  }

  /**
   * Execute a condition node
   */
  private async executeConditionNode(node: Node, context: ExecutionContext): Promise<any> {
    const conditions = node.config.conditions || [];
    let result = null;

    for (const condition of conditions) {
      const conditionResult = await this.conditionEvaluator.evaluate(
        condition,
        context
      );

      if (conditionResult) {
        const branch = node.config.branches?.find(
          (b: any) => b.name === condition.then
        );

        if (branch) {
          result = await this.executeBranch(branch, context);
        }

        break;
      }
    }

    return result;
  }

  /**
   * Execute a loop node
   */
  private async executeLoopNode(node: Node, context: ExecutionContext): Promise<any> {
    const iterationConfig = node.config.iterations;
    const results: any[] = [];

    if (!iterationConfig) {
      throw new Error(`Loop node ${node.id} missing iteration config`);
    }

    switch (iterationConfig.type) {
      case 'forEach': {
        const iterable = this.resolveValue(iterationConfig.iterable, context);
        const items = Array.isArray(iterable) ? iterable : [];

        for (const [index, item] of items.entries()) {
          if (this.cancellationTokens.get(context.executionId)?.isCancelled) {
            throw new Error('Execution cancelled');
          }

          context.variables.set('item', item);
          context.variables.set('index', index);

          const result = await this.executeBranch(
            { nodes: iterationConfig.nodes || [] },
            context
          );
          results.push(result);

          if (iterationConfig.maxIterations && index >= iterationConfig.maxIterations - 1) {
            break;
          }
        }
        break;
      }

      case 'while': {
        let iteration = 0;
        let conditionResult = await this.conditionEvaluator.evaluate(
          iterationConfig.condition,
          context
        );

        while (conditionResult) {
          if (this.cancellationTokens.get(context.executionId)?.isCancelled) {
            throw new Error('Execution cancelled');
          }

          const result = await this.executeBranch(
            { nodes: iterationConfig.nodes || [] },
            context
          );
          results.push(result);

          iteration++;

          if (iterationConfig.maxIterations && iteration >= iterationConfig.maxIterations) {
            break;
          }

          conditionResult = await this.conditionEvaluator.evaluate(
            iterationConfig.condition,
            context
          );
        }
        break;
      }

      case 'for': {
        const start = iterationConfig.start || 0;
        const end = iterationConfig.end || 10;
        const step = iterationConfig.step || 1;

        for (let i = start; i < end; i += step) {
          if (this.cancellationTokens.get(context.executionId)?.isCancelled) {
            throw new Error('Execution cancelled');
          }

          context.variables.set('i', i);

          const result = await this.executeBranch(
            { nodes: iterationConfig.nodes || [] },
            context
          );
          results.push(result);
        }
        break;
      }

      default:
        throw new Error(`Unknown iteration type: ${iterationConfig.type}`);
    }

    return results;
  }

  /**
   * Execute a parallel node
   */
  private async executeParallelNode(node: Node, context: ExecutionContext): Promise<any> {
    const branches = node.config.branches || [];

    const executions = branches.map((branch: any) =>
      this.executeBranch(branch, context)
    );

    return Promise.all(executions);
  }

  /**
   * Execute a wait node
   */
  private async executeWaitNode(node: Node, context: ExecutionContext): Promise<any> {
    const waitTime = node.config.waitTime || 1000;

    context.logs.debug(`Waiting for ${waitTime}ms`);

    await new Promise(resolve => setTimeout(resolve, waitTime));

    return { waited: waitTime };
  }

  /**
   * Execute a branch
   */
  private async executeBranch(branch: any, context: ExecutionContext): Promise<any> {
    const nodeIds = branch.nodes || [];
    let lastResult: any = null;

    for (const nodeId of nodeIds) {
      // This would need the full workflow to execute properly
      // For now, we'll just mark as executed
      lastResult = { nodeId };
    }

    return lastResult;
  }

  /**
   * Prepare input for a node
   */
  private prepareNodeInput(node: Node, context: ExecutionContext, workflow: Workflow): any {
    const input: any = {};

    // Add workflow variables
    for (const [key, value] of context.variables) {
      input[key] = value;
    }

    // Add node configuration parameters
    if (node.config.parameters) {
      for (const [key, value] of Object.entries(node.config.parameters)) {
        input[key] = this.resolveValue(value, context);
      }
    }

    // Add results from connected nodes
    const connections = workflow.connections.filter(c => c.targetNodeId === node.id);
    for (const connection of connections) {
      const sourceResult = context.nodeResults.get(connection.sourceNodeId);
      if (sourceResult !== undefined) {
        if (connection.sourceOutput) {
          input[connection.targetInput || connection.sourceOutput] =
            sourceResult[connection.sourceOutput];
        } else {
          input[connection.sourceNodeId] = sourceResult;
        }
      }
    }

    return input;
  }

  /**
   * Resolve a value
   */
  private resolveValue(value: any, context: ExecutionContext): any {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const path = value.slice(2, -2).trim();
      return context.variables.get(path);
    }

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map(v => this.resolveValue(v, context));
      }

      const resolved: any = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.resolveValue(val, context);
      }
      return resolved;
    }

    return value;
  }

  /**
   * Create a checkpoint
   */
  private async createCheckpoint(level: number, context: ExecutionContext): Promise<void> {
    const checkpoint: ExecutionCheckpoint = {
      level,
      completedNodes: Array.from(context.state.completedNodes),
      nodeStates: new Map(context.nodeResults),
      variables: new Map(context.variables),
      timestamp: new Date()
    };

    context.checkpoints.set(level, checkpoint);
    context.state.lastCheckpointTime = checkpoint.timestamp;

    context.logs.info(`Checkpoint created at level ${level}`);

    // Persist checkpoint if enabled
    if (this.config.statePersistenceEnabled && this.config.durableObjectId) {
      await this.persistCheckpoint(context.executionId, checkpoint);
    }
  }

  /**
   * Persist checkpoint to durable object storage
   */
  private async persistCheckpoint(executionId: ExecutionId, checkpoint: ExecutionCheckpoint): Promise<void> {
    // This would integrate with Cloudflare Durable Objects
    // For now, it's a placeholder
    context.logs.debug('Persisting checkpoint', { executionId, level: checkpoint.level });
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(retryConfig: any, attempt: number): number {
    const config = retryConfig || {
      backoffType: 'exponential',
      initialDelay: 1000
    };

    let delay = config.initialDelay || 1000;

    switch (config.backoffType) {
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

    return Math.min(delay, config.maxDelay || 60000);
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number, nodeId: NodeId): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Node ${nodeId} timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Handle execution error
   */
  private handleExecutionError(error: any, context: ExecutionContext, execution: Execution): ExecutionStatus {
    if (error instanceof Error && error.message === 'Execution cancelled') {
      return 'cancelled';
    }

    execution.error = {
      code: 'EXECUTION_FAILED',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };

    return 'failed';
  }

  /**
   * Calculate execution metrics
   */
  private calculateMetrics(context: ExecutionContext, execution: Execution): ExecutionMetrics {
    const completedNodes = context.state.completedNodes.size;
    const failedNodes = context.state.failedNodes.size;
    const skippedNodes = context.state.skippedNodes.size;

    let totalNodeDuration = 0;
    for (const nodeExec of execution.nodes) {
      if (nodeExec.duration) {
        totalNodeDuration += nodeExec.duration;
      }
    }

    const averageNodeDuration = completedNodes > 0
      ? totalNodeDuration / completedNodes
      : 0;

    return {
      totalNodes: execution.nodes.length,
      completedNodes,
      failedNodes,
      skippedNodes,
      averageNodeDuration,
      totalDuration: execution.duration || 0,
      memoryUsage: 0, // Would be populated in production
      cpuUsage: 0 // Would be populated in production
    };
  }

  /**
   * Collect output from workflow execution
   */
  private collectOutput(workflow: Workflow, context: ExecutionContext): any {
    const output: any = {};

    for (const node of workflow.nodes) {
      const result = context.nodeResults.get(node.id);
      if (result !== undefined) {
        output[node.id] = result;
      }
    }

    return output;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel a running execution
   */
  public async cancelExecution(executionId: ExecutionId): Promise<void> {
    const token = this.cancellationTokens.get(executionId);
    if (token) {
      token.cancel();
    }

    const execution = this.runningExecutions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    }
  }

  /**
   * Get execution by ID
   */
  public getExecution(executionId: ExecutionId): Execution | undefined {
    return this.runningExecutions.get(executionId);
  }

  /**
   * Get all running executions
   */
  public getRunningExecutions(): Execution[] {
    return Array.from(this.runningExecutions.values()).filter(
      e => e.status === 'running'
    );
  }

  /**
   * Get execution statistics
   */
  public getStats(): {
    running: number;
    maxConcurrent: number;
    utilization: number;
  } {
    return {
      running: this.runningExecutions.size,
      maxConcurrent: this.config.maxConcurrentExecutions,
      utilization: (this.runningExecutions.size / this.config.maxConcurrentExecutions) * 100
    };
  }

  /**
   * Clean up resources
   */
  private cleanup(executionId: ExecutionId): void {
    this.runningExecutions.delete(executionId);
    this.cancellationTokens.delete(executionId);
  }
}

/**
 * Cancellation token for cancelling executions
 */
class CancellationToken {
  public isCancelled = false;
  private onCancel?: () => void;

  constructor(onCancel?: () => void) {
    this.onCancel = onCancel;
  }

  cancel(): void {
    this.isCancelled = true;
    if (this.onCancel) {
      this.onCancel();
    }
  }
}

/**
 * Priority-based task scheduler
 */
class PriorityTaskScheduler implements TaskScheduler {
  private taskQueue: Map<string, ScheduledTask>;
  private runningTasks: Map<string, TaskStatus>;
  private maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.taskQueue = new Map();
    this.runningTasks = new Map();
    this.maxConcurrent = maxConcurrent;
  }

  schedule(tasks: ScheduledTask[]): void {
    // Sort by priority (higher priority first)
    const sortedTasks = tasks.sort((a, b) => b.priority - a.priority);

    for (const task of sortedTasks) {
      this.taskQueue.set(task.id, task);
      this.runningTasks.set(task.id, TaskStatus.PENDING);
    }
  }

  cancel(taskId: string): void {
    this.taskQueue.delete(taskId);
    this.runningTasks.set(taskId, TaskStatus.CANCELLED);
  }

  getStatus(taskId: string): TaskStatus {
    return this.runningTasks.get(taskId) || TaskStatus.PENDING;
  }

  /**
   * Get next task to execute
   */
  getNextTask(): ScheduledTask | null {
    for (const [id, task] of this.taskQueue) {
      const status = this.runningTasks.get(id);
      if (status === TaskStatus.PENDING) {
        const runningCount = Array.from(this.runningTasks.values())
          .filter(s => s === TaskStatus.RUNNING).length;

        if (runningCount < this.maxConcurrent) {
          this.runningTasks.set(id, TaskStatus.RUNNING);
          return task;
        }
      }
    }

    return null;
  }

  /**
   * Mark task as completed
   */
  completeTask(taskId: string, success: boolean): void {
    this.taskQueue.delete(taskId);
    this.runningTasks.set(
      taskId,
      success ? TaskStatus.COMPLETED : TaskStatus.FAILED
    );
  }
}
