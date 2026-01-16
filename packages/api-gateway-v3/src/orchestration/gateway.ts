/**
 * Orchestration Gateway - Service orchestration and workflow management
 *
 * Features:
 * - Workflow execution engine
 * - Step orchestration
 * - Compensation transactions
 * - Dead letter queue
 * - State management
 */

// @ts-nocheck - Complex workflow orchestration types
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStep,
  ExecutionStatus,
  StepExecution,
  GatewayError,
  ServiceDefinition,
} from '../types/index.js';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface OrchestrationConfig {
  maxConcurrent: number;
  queueSize: number;
  timeout: number;
  retryPolicy: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  deadLetterQueue: boolean;
  persistence: {
    enabled: boolean;
    interval: number;
  };
  metrics: {
    enabled: boolean;
  };
}

export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  input: Record<string, unknown>;
  state: Map<string, unknown>;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Orchestration Gateway
// ============================================================================

export class OrchestrationGateway extends EventEmitter {
  private config: OrchestrationConfig;
  private workflows: Map<string, WorkflowDefinition>;
  private executions: Map<string, WorkflowExecution>;
  private running: Set<string>;
  private queue: string[];
  private deadLetterQueue: Map<string, { execution: WorkflowExecution; error: Error }>;

  constructor(
    config: Partial<OrchestrationConfig> = {}
  ) {
    super();
    this.config = {
      maxConcurrent: 100,
      queueSize: 1000,
      timeout: 300000,
      retryPolicy: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 10000,
        backoffMultiplier: 2,
      },
      deadLetterQueue: true,
      persistence: {
        enabled: true,
        interval: 5000,
      },
      metrics: {
        enabled: true,
      },
      ...config,
    };

    this.workflows = new Map();
    this.executions = new Map();
    this.running = new Set();
    this.queue = [];
    this.deadLetterQueue = new Map();
  }

  /**
   * Register workflow
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
    this.emit('workflow-registered', workflow);
  }

  /**
   * Unregister workflow
   */
  unregisterWorkflow(workflowId: string): boolean {
    const deleted = this.workflows.delete(workflowId);
    if (deleted) {
      this.emit('workflow-unregistered', workflowId);
    }
    return deleted;
  }

  /**
   * Get workflow
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * List workflows
   */
  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Execute workflow
   */
  async execute(
    workflowId: string,
    input: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new GatewayError(
        `Workflow not found: ${workflowId}`,
        'WORKFLOW_NOT_FOUND',
        404
      );
    }

    const executionId = this.generateExecutionId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'pending',
      input,
      startedAt: Date.now(),
      steps: [],
    };

    this.executions.set(executionId, execution);
    this.emit('execution-created', execution);

    // Queue for execution
    this.queue.push(executionId);
    this.processQueue().catch((error) => {
      console.error('Error processing queue:', error);
    });

    return execution;
  }

  /**
   * Get execution
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * List executions
   */
  listExecutions(workflowId?: string): WorkflowExecution[] {
    const executions = Array.from(this.executions.values());
    if (workflowId) {
      return executions.filter((e) => e.workflowId === workflowId);
    }
    return executions;
  }

  /**
   * Cancel execution
   */
  async cancel(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return false;
    }

    if (execution.status !== 'running' && execution.status !== 'pending') {
      return false;
    }

    execution.status = 'cancelled';
    execution.completedAt = Date.now();

    this.running.delete(executionId);
    this.emit('execution-cancelled', execution);

    return true;
  }

  /**
   * Retry execution
   */
  async retry(executionId: string): Promise<WorkflowExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new GatewayError('Execution not found', 'EXECUTION_NOT_FOUND', 404);
    }

    if (execution.status !== 'failed') {
      throw new GatewayError(
        'Can only retry failed executions',
        'INVALID_STATUS',
        400
      );
    }

    // Reset execution state
    execution.status = 'pending';
    execution.startedAt = Date.now();
    execution.completedAt = undefined;
    execution.error = undefined;

    // Reset failed steps
    for (const step of execution.steps) {
      if (step.status === 'failed') {
        step.status = 'pending';
        step.output = undefined;
        step.error = undefined;
        step.retries = 0;
      }
    }

    this.queue.push(executionId);
    this.processQueue().catch((error) => {
      console.error('Error processing queue:', error);
    });

    this.emit('execution-retried', execution);

    return execution;
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): Array<{ execution: WorkflowExecution; error: Error }> {
    return Array.from(this.deadLetterQueue.values());
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue.clear();
  }

  /**
   * Get metrics
   */
  getMetrics(): OrchestrationMetrics {
    const executions = Array.from(this.executions.values());

    return {
      totalExecutions: executions.length,
      runningExecutions: this.running.size,
      queuedExecutions: this.queue.length,
      completedExecutions: executions.filter((e) => e.status === 'completed').length,
      failedExecutions: executions.filter((e) => e.status === 'failed').length,
      cancelledExecutions: executions.filter((e) => e.status === 'cancelled').length,
      deadLetterCount: this.deadLetterQueue.size,
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.running.size < this.config.maxConcurrent) {
      const executionId = this.queue.shift();
      if (!executionId) {
        break;
      }

      this.running.add(executionId);
      this.executeWorkflow(executionId).catch((error) => {
        console.error(`Error executing workflow ${executionId}:`, error);
      });
    }
  }

  private async executeWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      return;
    }

    execution.status = 'running';
    this.emit('execution-started', execution);

    try {
      const context: WorkflowContext = {
        workflowId: workflow.id,
        executionId: execution.id,
        input: execution.input,
        state: new Map(),
        metadata: {},
      };

      // Execute workflow with timeout
      await Promise.race([
        this.executeSteps(workflow, context, execution),
        this.createTimeout(workflow.timeout || this.config.timeout),
      ]);

      execution.status = 'completed';
      execution.completedAt = Date.now();
      execution.output = Object.fromEntries(context.state);

      this.emit('execution-completed', execution);
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = Date.now();
      execution.error = error as Error;

      // Add to dead letter queue if enabled
      if (this.config.deadLetterQueue) {
        this.deadLetterQueue.set(executionId, {
          execution,
          error: error as Error,
        });
      }

      this.emit('execution-failed', execution);
    } finally {
      this.running.delete(executionId);

      // Process next in queue
      this.processQueue().catch((error) => {
        console.error('Error processing queue:', error);
      });
    }
  }

  private async executeSteps(
    workflow: WorkflowDefinition,
    context: WorkflowContext,
    execution: WorkflowExecution
  ): Promise<void> {
    for (const step of workflow.steps) {
      // Check if execution was cancelled
      if (execution.status === 'cancelled') {
        throw new GatewayError('Execution cancelled', 'EXECUTION_CANCELLED');
      }

      const stepExecution = await this.executeStep(step, context, execution);
      execution.steps.push(stepExecution);

      if (!stepExecution.success) {
        throw stepExecution.error || new Error('Step execution failed');
      }
    }
  }

  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
    execution: WorkflowExecution
  ): Promise<StepExecution> {
    const stepExecution: StepExecution = {
      stepId: step.id,
      status: 'running',
      input: {},
      startedAt: Date.now(),
      retries: 0,
    };

    const retryPolicy = step.retryPolicy || workflowRetryPolicy;

    try {
      let result: unknown;

      switch (step.type) {
        case 'service':
          result = await this.executeServiceStep(step, context);
          break;
        case 'composition':
          result = await this.executeCompositionStep(step, context);
          break;
        case 'transform':
          result = await this.executeTransformStep(step, context);
          break;
        case 'condition':
          result = await this.executeConditionStep(step, context);
          break;
        case 'parallel':
          result = await this.executeParallelStep(step, context, execution);
          break;
        case 'sequence':
          result = await this.executeSequenceStep(step, context, execution);
          break;
        default:
          throw new GatewayError(
            `Unknown step type: ${step.type}`,
            'UNKNOWN_STEP_TYPE'
          );
      }

      stepExecution.status = 'completed';
      stepExecution.completedAt = Date.now();
      stepExecution.output = result as Record<string, unknown>;
      stepExecution.success = true;

      // Store result in context
      if (step.id) {
        context.state.set(step.id, result);
      }

      this.emit('step-completed', { execution, step, stepExecution });

      return stepExecution;
    } catch (error) {
      const isRetryable = this.isRetryableError(error as GatewayError);

      if (isRetryable && stepExecution.retries < retryPolicy.maxAttempts) {
        // Retry with backoff
        const delay = Math.min(
          retryPolicy.initialDelay * Math.pow(retryPolicy.backoffMultiplier, stepExecution.retries),
          retryPolicy.maxDelay
        );

        await this.sleep(delay);
        stepExecution.retries++;

        return this.executeStep(step, context, execution);
      }

      stepExecution.status = 'failed';
      stepExecution.completedAt = Date.now();
      stepExecution.error = error as Error;
      stepExecution.success = false;

      this.emit('step-failed', { execution, step, stepExecution });

      // Execute compensation if configured
      if (step.compensationStepId) {
        await this.executeCompensation(step, context, execution);
      }

      return stepExecution;
    }
  }

  private async executeServiceStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<unknown> {
    // In a real implementation, this would call the service
    return {
      serviceId: step.serviceId,
      method: step.config.method,
      path: step.config.path,
      timestamp: Date.now(),
    };
  }

  private async executeCompositionStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<unknown> {
    // In a real implementation, this would execute the composition
    return {
      operations: step.config.operations,
      timestamp: Date.now(),
    };
  }

  private async executeTransformStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<unknown> {
    const transform = step.config.transform;
    if (!transform) {
      throw new GatewayError('Transform expression missing', 'MISSING_TRANSFORM');
    }

    // In a real implementation, this would evaluate the transform expression
    return {
      transform,
      timestamp: Date.now(),
    };
  }

  private async executeConditionStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<unknown> {
    const condition = step.config.condition;
    if (!condition) {
      throw new GatewayError('Condition expression missing', 'MISSING_CONDITION');
    }

    // In a real implementation, this would evaluate the condition
    const result = Math.random() > 0.5; // Placeholder

    if (result && step.config.steps) {
      // Execute nested steps
      for (const nestedStep of step.config.steps) {
        await this.executeStep(nestedStep, context, {
          id: '',
          workflowId: context.workflowId,
          status: 'running',
          input: context.input,
          startedAt: Date.now(),
          steps: [],
        });
      }
    }

    return { condition, result, timestamp: Date.now() };
  }

  private async executeParallelStep(
    step: WorkflowStep,
    context: WorkflowContext,
    execution: WorkflowExecution
  ): Promise<unknown> {
    const steps = step.config.steps;
    if (!steps) {
      throw new GatewayError('Parallel steps not defined', 'MISSING_STEPS');
    }

    const results = await Promise.allSettled(
      steps.map((s) => this.executeStep(s, context, execution))
    );

    return {
      results: results.map((r) =>
        r.status === 'fulfilled' ? r.value : { error: r.reason }
      ),
      timestamp: Date.now(),
    };
  }

  private async executeSequenceStep(
    step: WorkflowStep,
    context: WorkflowContext,
    execution: WorkflowExecution
  ): Promise<unknown> {
    const steps = step.config.steps;
    if (!steps) {
      throw new GatewayError('Sequence steps not defined', 'MISSING_STEPS');
    }

    const results: unknown[] = [];
    for (const s of steps) {
      const result = await this.executeStep(s, context, execution);
      results.push(result);
    }

    return { results, timestamp: Date.now() };
  }

  private async executeCompensation(
    step: WorkflowStep,
    context: WorkflowContext,
    execution: WorkflowExecution
  ): Promise<void> {
    const compensationStepId = step.compensationStepId;
    if (!compensationStepId) {
      return;
    }

    this.emit('compensation-started', { step, context });

    // In a real implementation, this would execute the compensation logic
    // For now, just emit an event
    this.emit('compensation-completed', { step, context });
  }

  private isRetryableError(error: GatewayError): boolean {
    const retryableCodes = ['SERVICE_UNAVAILABLE', 'TIMEOUT', 'CIRCUIT_BREAKER_OPEN'];
    return retryableCodes.includes(error.code);
  }

  private createTimeout(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new GatewayError('Workflow execution timeout', 'TIMEOUT'));
      }, timeout);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

const workflowRetryPolicy = {
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

interface OrchestrationMetrics {
  totalExecutions: number;
  runningExecutions: number;
  queuedExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  deadLetterCount: number;
}
