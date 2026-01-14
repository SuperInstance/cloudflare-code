/**
 * Main Workflow Execution Engine
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
  NodeId
} from '../types';
import { DAGManager } from './dag';
import { ActionExecutor } from './action-executor';
import { ConditionEvaluator } from '../conditions/evaluator';
import { ExecutionLogger } from './logger';

export interface EngineConfig {
  maxConcurrentExecutions?: number;
  defaultTimeout?: number;
  enableMetrics?: boolean;
  enableTracing?: boolean;
  maxRetries?: number;
}

export interface ExecutionContext {
  executionId: ExecutionId;
  workflowId: string;
  variables: Map<string, any>;
  nodeResults: Map<NodeId, any>;
  logs: ExecutionLogger;
  metadata: ExecutionMetadata;
}

export class WorkflowExecutionEngine {
  private config: EngineConfig;
  private actionExecutor: ActionExecutor;
  private conditionEvaluator: ConditionEvaluator;
  private runningExecutions: Map<ExecutionId, Execution>;

  constructor(config: EngineConfig = {}) {
    this.config = {
      maxConcurrentExecutions: 100,
      defaultTimeout: 300000, // 5 minutes
      enableMetrics: true,
      enableTracing: false,
      maxRetries: 3,
      ...config
    };
    this.actionExecutor = new ActionExecutor();
    this.conditionEvaluator = new ConditionEvaluator();
    this.runningExecutions = new Map();
  }

  /**
   * Start execution of a workflow
   */
  public async execute(
    workflow: Workflow,
    input: any,
    trigger: TriggerInfo
  ): Promise<Execution> {
    const executionId = uuidv4() as ExecutionId;

    // Create execution context
    const context: ExecutionContext = {
      executionId,
      workflowId: workflow.id,
      variables: new Map(),
      nodeResults: new Map(),
      logs: new ExecutionLogger(executionId),
      metadata: {
        correlationId: uuidv4(),
        tags: {}
      }
    };

    // Initialize variables
    for (const variable of workflow.variables) {
      context.variables.set(variable.name, variable.value);
    }

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

    try {
      // Build DAG and create execution plan
      const dag = new DAGManager(workflow.nodes, workflow.connections);
      const validation = dag.validate();

      if (!validation.valid) {
        throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
      }

      const plan = dag.createExecutionPlan();

      context.logs.info('Starting workflow execution', {
        workflowId: workflow.id,
        executionId,
        plan: plan.levels
      });

      // Execute workflow by levels
      await this.executeByLevels(workflow, plan, context);

      // Mark execution as completed
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.output = this.collectOutput(workflow, context);

      context.logs.info('Workflow execution completed', {
        executionId,
        duration: execution.duration
      });

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.error = {
        code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };

      context.logs.error('Workflow execution failed', {
        executionId,
        error: execution.error
      });

      throw error;
    } finally {
      this.runningExecutions.delete(executionId);
    }

    return execution;
  }

  /**
   * Execute workflow by levels (parallel execution within levels)
   */
  private async executeByLevels(
    workflow: Workflow,
    plan: ReturnType<DAGManager['createExecutionPlan']>,
    context: ExecutionContext
  ): Promise<void> {
    for (let levelIndex = 0; levelIndex < plan.levels.length; levelIndex++) {
      const level = plan.levels[levelIndex];

      context.logs.debug(`Executing level ${levelIndex}`, {
        nodeCount: level.length,
        nodes: level
      });

      // Execute all nodes in this level in parallel
      const executions = level.map(nodeId =>
        this.executeNode(workflow, nodeId, context)
      );

      await Promise.all(executions);

      context.logs.debug(`Completed level ${levelIndex}`);
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    workflow: Workflow,
    nodeId: NodeId,
    context: ExecutionContext
  ): Promise<void> {
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    if (!node.enabled) {
      context.logs.info(`Skipping disabled node: ${nodeId}`);
      return;
    }

    // Create node execution
    const nodeExecution: NodeExecution = {
      nodeId,
      status: 'running' as NodeStatus,
      startTime: new Date()
    };

    context.logs.info(`Executing node: ${node.name} (${nodeId})`);

    try {
      // Execute based on node type
      let result: any;

      switch (node.type) {
        case 'trigger':
          result = await this.executeTriggerNode(node, context);
          break;

        case 'action':
          result = await this.executeActionNode(node, context);
          break;

        case 'condition':
          result = await this.executeConditionNode(node, context);
          break;

        case 'loop':
          result = await this.executeLoopNode(node, context);
          break;

        case 'parallel':
          result = await this.executeParallelNode(node, context);
          break;

        case 'wait':
          result = await this.executeWaitNode(node, context);
          break;

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      // Store result
      context.nodeResults.set(nodeId, result);
      nodeExecution.output = result;
      nodeExecution.status = 'completed';

      context.logs.info(`Completed node: ${node.name}`, {
        nodeId,
        result
      });

    } catch (error) {
      nodeExecution.status = 'failed';
      nodeExecution.error = {
        code: 'NODE_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        node: nodeId
      };

      context.logs.error(`Failed node: ${node.name}`, {
        nodeId,
        error: nodeExecution.error
      });

      // Handle retry logic
      if (node.retryConfig) {
        await this.handleRetry(node, context, error);
      } else {
        throw error;
      }
    } finally {
      nodeExecution.endTime = new Date();
      nodeExecution.duration = nodeExecution.endTime.getTime() - nodeExecution.startTime.getTime();
    }
  }

  /**
   * Execute a trigger node
   */
  private async executeTriggerNode(
    node: any,
    context: ExecutionContext
  ): Promise<any> {
    // Trigger nodes are typically passive and don't execute
    context.logs.debug(`Trigger node ${node.id} is passive`);
    return null;
  }

  /**
   * Execute an action node
   */
  private async executeActionNode(
    node: any,
    context: ExecutionContext
  ): Promise<any> {
    if (!node.actionType) {
      throw new Error(`Action node ${node.id} missing actionType`);
    }

    // Prepare input from previous nodes
    const input = this.prepareNodeInput(node, context);

    // Execute action
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
  private async executeConditionNode(
    node: any,
    context: ExecutionContext
  ): Promise<any> {
    const conditions = node.config.conditions || [];
    let result = null;

    for (const condition of conditions) {
      const conditionResult = await this.conditionEvaluator.evaluate(
        condition,
        context
      );

      if (conditionResult) {
        // Execute the branch that matches
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
  private async executeLoopNode(
    node: any,
    context: ExecutionContext
  ): Promise<any> {
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
  private async executeParallelNode(
    node: any,
    context: ExecutionContext
  ): Promise<any> {
    const branches = node.config.branches || [];

    const executions = branches.map((branch: any) =>
      this.executeBranch(branch, context)
    );

    const results = await Promise.all(executions);
    return results;
  }

  /**
   * Execute a wait node
   */
  private async executeWaitNode(
    node: any,
    context: ExecutionContext
  ): Promise<any> {
    const waitTime = node.config.waitTime || 1000;

    context.logs.debug(`Waiting for ${waitTime}ms`);

    await new Promise(resolve => setTimeout(resolve, waitTime));

    return { waited: waitTime };
  }

  /**
   * Execute a branch (sequence of nodes)
   */
  private async executeBranch(
    branch: any,
    context: ExecutionContext
  ): Promise<any> {
    const nodeIds = branch.nodes || [];
    let lastResult: any = null;

    for (const nodeId of nodeIds) {
      // This would need the full workflow to execute
      // For now, we'll just mark as executed
      lastResult = { nodeId };
    }

    return lastResult;
  }

  /**
   * Prepare input for a node from previous results
   */
  private prepareNodeInput(node: any, context: ExecutionContext): any {
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

    return input;
  }

  /**
   * Resolve a value (supports variable references)
   */
  private resolveValue(value: any, context: ExecutionContext): any {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      // Variable reference
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
   * Handle retry logic for failed nodes
   */
  private async handleRetry(
    node: any,
    context: ExecutionContext,
    error: any
  ): Promise<void> {
    const retryConfig = node.retryConfig;
    if (!retryConfig) {
      throw error;
    }

    const maxAttempts = retryConfig.maxAttempts || this.config.maxRetries;
    let delay = retryConfig.initialDelay || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      context.logs.info(`Retrying node ${node.id}, attempt ${attempt}/${maxAttempts}`);

      await this.sleep(delay);

      try {
        await this.executeActionNode(node, context);
        return;
      } catch (retryError) {
        if (attempt === maxAttempts) {
          throw retryError;
        }

        // Calculate next delay
        switch (retryConfig.backoffType) {
          case 'exponential':
            delay = Math.min(delay * 2, retryConfig.maxDelay || 60000);
            break;
          case 'linear':
            delay = Math.min(delay + retryConfig.initialDelay, retryConfig.maxDelay || 60000);
            break;
          case 'fixed':
            // Keep the same delay
            break;
        }
      }
    }
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
   * Get execution by ID
   */
  public getExecution(executionId: ExecutionId): Execution | undefined {
    return this.runningExecutions.get(executionId);
  }

  /**
   * Cancel a running execution
   */
  public async cancelExecution(executionId: ExecutionId): Promise<void> {
    const execution = this.runningExecutions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    }
  }

  /**
   * Get all running executions
   */
  public getRunningExecutions(): Execution[] {
    return Array.from(this.runningExecutions.values());
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
      maxConcurrent: this.config.maxConcurrentExecutions || 100,
      utilization: (this.runningExecutions.size / (this.config.maxConcurrentExecutions || 100)) * 100
    };
  }
}
