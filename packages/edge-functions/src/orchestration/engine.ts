/**
 * Orchestration Engine
 *
 * Handles workflow execution, function chaining, parallel execution,
 * conditional routing, and data passing between functions.
 */

import {
  Workflow,
  WorkflowStep,
  WorkflowContext,
  WorkflowResult,
  StepResult,
  ExecutionStatus,
  StepType,
  EdgeFunction,
  EdgeEnv,
  ErrorHandlingStrategy,
  StepInput,
  StepOutput,
  StepConfig,
} from '../types/index.js';

// ============================================================================
// Orchestration Configuration
// ============================================================================

/**
 * Orchestration engine configuration
 */
export interface OrchestrationConfig {
  /**
   * Maximum concurrent step executions
   * @default 10
   */
  maxConcurrentSteps?: number;

  /**
   * Default step timeout (ms)
   * @default 30000
   */
  defaultStepTimeout?: number;

  /**
   * Workflow timeout (ms)
   * @default 300000 (5 minutes)
   */
  workflowTimeout?: number;

  /**
   * Enable step result caching
   * @default true
   */
  enableStepCaching?: boolean;

  /**
   * Enable tracing
   * @default false
   */
  enableTracing?: boolean;

  /**
   * Retry configuration for failed steps
   */
  retry?: {
    /**
     * Maximum retries
     * @default 3
     */
    maxRetries?: number;

    /**
     * Initial delay (ms)
     * @default 1000
     */
    initialDelay?: number;

    /**
     * Backoff multiplier
     * @default 2
     */
    backoffMultiplier?: number;
  };

  /**
   * Execution hooks
   */
  hooks?: OrchestrationHooks;
}

/**
 * Orchestration execution hooks
 */
export interface OrchestrationHooks {
  /**
   * Called before workflow starts
   */
  beforeWorkflow?: (workflow: Workflow, context: WorkflowContext) => Promise<void>;

  /**
   * Called after workflow completes
   */
  afterWorkflow?: (result: WorkflowResult) => Promise<void>;

  /**
   * Called before each step
   */
  beforeStep?: (step: WorkflowStep, context: WorkflowContext) => Promise<void>;

  /**
   * Called after each step
   */
  afterStep?: (step: WorkflowStep, result: StepResult, context: WorkflowContext) => Promise<void>;

  /**
   * Called on step error
   */
  onStepError?: (
    step: WorkflowStep,
    error: Error,
    context: WorkflowContext
  ) => Promise<void>;

  /**
   * Called on workflow error
   */
  onWorkflowError?: (error: Error, context: WorkflowContext) => Promise<void>;
}

// ============================================================================
// Orchestration Errors
// ============================================================================

/**
 * Base error for orchestration errors
 */
export class OrchestrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly workflowId?: string,
    public readonly executionId?: string
  ) {
    super(message);
    this.name = 'OrchestrationError';
  }
}

/**
 * Error thrown when workflow is not found
 */
export class WorkflowNotFoundError extends OrchestrationError {
  constructor(workflowId: string) {
    super(`Workflow not found: ${workflowId}`, 'WORKFLOW_NOT_FOUND', workflowId);
    this.name = 'WorkflowNotFoundError';
  }
}

/**
 * Error thrown when a step fails
 */
export class StepExecutionError extends OrchestrationError {
  constructor(
    message: string,
    workflowId?: string,
    executionId?: string,
    public readonly stepId?: string,
    public readonly originalError?: Error
  ) {
    super(message, 'STEP_EXECUTION_ERROR', workflowId, executionId);
    this.name = 'StepExecutionError';
  }
}

/**
 * Error thrown when workflow times out
 */
export class WorkflowTimeoutError extends OrchestrationError {
  constructor(
    workflowId: string,
    executionId: string,
    public readonly timeout: number
  ) {
    super(
      `Workflow timed out after ${timeout}ms`,
      'WORKFLOW_TIMEOUT',
      workflowId,
      executionId
    );
    this.name = 'WorkflowTimeoutError';
  }
}

/**
 * Error thrown when step execution times out
 */
export class StepTimeoutError extends OrchestrationError {
  constructor(
    stepId: string,
    workflowId: string,
    executionId: string,
    public readonly timeout: number
  ) {
    super(
      `Step timed out after ${timeout}ms: ${stepId}`,
      'STEP_TIMEOUT',
      workflowId,
      executionId
    );
    this.name = 'StepTimeoutError';
  }
}

// ============================================================================
// Orchestration Engine
// ============================================================================

/**
 * Engine for orchestrating complex workflows with edge functions
 */
export class OrchestrationEngine {
  private readonly workflows: Map<string, Workflow>;
  private readonly functions: Map<string, EdgeFunction>;
  private readonly config: OrchestrationConfig;
  private readonly executions: Map<string, WorkflowExecutionState>;

  constructor(
    functions: Map<string, EdgeFunction>,
    config: OrchestrationConfig = {}
  ) {
    this.workflows = new Map();
    this.functions = functions;
    this.executions = new Map();
    this.config = {
      maxConcurrentSteps: 10,
      defaultStepTimeout: 30000,
      workflowTimeout: 300000,
      enableStepCaching: true,
      enableTracing: false,
      retry: {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
      },
      hooks: {},
      ...config,
    };
  }

  // ========================================================================
  // Workflow Registration
  // ========================================================================

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Unregister a workflow
   */
  unregisterWorkflow(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  /**
   * Get a workflow
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  // ========================================================================
  // Workflow Execution
  // ========================================================================

  /**
   * Execute a workflow
   */
  async execute(
    workflowId: string,
    input: Record<string, unknown>,
    context: ExecutionContext & { env: EdgeEnv }
  ): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }

    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    // Create workflow context
    const wfContext: WorkflowContext = {
      workflowId,
      executionId,
      input: { ...input, ...workflow.initialData },
      data: { ...workflow.initialData },
      steps: new Map(),
      metadata: {
        startTime,
        currentTime: startTime,
        attempt: 1,
      },
      env: context.env,
      ctx: context,
    };

    // Create execution state
    const execState: WorkflowExecutionState = {
      executionId,
      workflowId,
      status: 'running',
      startTime,
      endTime: 0,
      steps: [],
      context: wfContext,
    };

    this.executions.set(executionId, execState);

    try {
      // Call beforeWorkflow hook
      if (this.config.hooks?.beforeWorkflow) {
        await this.config.hooks.beforeWorkflow(workflow, wfContext);
      }

      // Execute workflow with timeout
      const result = await Promise.race([
        this.executeWorkflow(workflow, wfContext),
        this.createWorkflowTimeout(workflowId, executionId, workflow.timeout || this.config.workflowTimeout!),
      ]);

      // Update execution state
      execState.status = result.status;
      execState.endTime = Date.now();
      execState.steps = result.steps;

      // Call afterWorkflow hook
      if (this.config.hooks?.afterWorkflow) {
        await this.config.hooks.afterWorkflow(result);
      }

      return result;
    } catch (error) {
      execState.status = 'failed';
      execState.endTime = Date.now();

      const err = error instanceof Error ? error : new Error(String(error));

      // Call onWorkflowError hook
      if (this.config.hooks?.onWorkflowError) {
        await this.config.hooks.onWorkflowError(err, wfContext);
      }

      throw err;
    } finally {
      this.executions.delete(executionId);
    }
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflow(
    workflow: Workflow,
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const stepResults: StepResult[] = [];
    let hasErrors = false;

    // Group steps by type
    const sequentialSteps = workflow.steps.filter(s => s.type === 'sequential');
    const parallelSteps = workflow.steps.filter(s => s.type === 'parallel');

    // Execute sequential steps
    for (const step of sequentialSteps) {
      try {
        const result = await this.executeStep(step, context);
        stepResults.push(result);

        if (result.status === 'failed' && !step.continueOnError) {
          if (workflow.onError === 'stop') {
            hasErrors = true;
            break;
          }
        }
      } catch (error) {
        if (workflow.onError === 'stop') {
          throw error;
        }
      }
    }

    // Execute parallel steps
    if (parallelSteps.length > 0 && !hasErrors) {
      const parallelResults = await this.executeParallelSteps(parallelSteps, context);
      stepResults.push(...parallelResults);
    }

    // Determine workflow status
    const failedSteps = stepResults.filter(s => s.status === 'failed');
    const status: ExecutionStatus = hasErrors || failedSteps.length > 0 ? 'failed' : 'completed';

    const endTime = Date.now();
    const totalDuration = endTime - context.metadata.startTime;

    return {
      executionId: context.executionId,
      workflowId: context.workflowId,
      status,
      output: context.data,
      steps: stepResults,
      metrics: {
        startTime: context.metadata.startTime,
        endTime,
        duration: totalDuration,
        memoryUsed: 0, // Would be tracked in real implementation
        stepsExecuted: stepResults.length,
        stepsFailed: failedSteps.length,
      },
      error: failedSteps.length > 0 ? failedSteps[0].error : undefined,
    };
  }

  /**
   * Execute parallel steps
   */
  private async executeParallelSteps(
    steps: WorkflowStep[],
    context: WorkflowContext
  ): Promise<StepResult[]> {
    // Execute all steps in parallel with concurrency limit
    const maxConcurrent = this.config.maxConcurrentSteps!;
    const results: StepResult[] = [];

    for (let i = 0; i < steps.length; i += maxConcurrent) {
      const batch = steps.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map(step => this.executeStep(step, context))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create failed step result
          const step = batch[j];
          results.push({
            stepId: step.id,
            functionId: step.functionId,
            status: 'failed',
            error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
            metrics: {
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 0,
              memoryUsed: 0,
              cpuTime: 0,
            },
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    const startTime = Date.now();

    // Call beforeStep hook
    if (this.config.hooks?.beforeStep) {
      await this.config.hooks.beforeStep(step, context);
    }

    // Check condition
    if (step.condition) {
      const shouldExecute = this.evaluateCondition(step.condition, context);
      if (!shouldExecute) {
        return {
          stepId: step.id,
          functionId: step.functionId,
          status: 'completed',
          metrics: {
            startTime,
            endTime: Date.now(),
            duration: 0,
            memoryUsed: 0,
            cpuTime: 0,
          },
        };
      }
    }

    try {
      // Get step input
      const input = this.resolveStepInput(step.input, context);

      // Execute function
      const func = this.functions.get(step.functionId);
      if (!func) {
        throw new Error(`Function not found: ${step.functionId}`);
      }

      // Execute with timeout
      const timeout = step.timeout || this.config.defaultStepTimeout!;
      const output = await Promise.race([
        func.handler(input, context),
        this.createStepTimeout(step.id, context.workflowId, context.executionId, timeout),
      ]);

      // Handle step output
      this.handleStepOutput(step.output, output, context);

      const endTime = Date.now();

      const result: StepResult = {
        stepId: step.id,
        functionId: step.functionId,
        status: 'completed',
        output,
        metrics: {
          startTime,
          endTime,
          duration: endTime - startTime,
          memoryUsed: 0,
          cpuTime: 0,
        },
      };

      // Store step result in context
      context.steps.set(step.id, result);

      // Call afterStep hook
      if (this.config.hooks?.afterStep) {
        await this.config.hooks.afterStep(step, result, context);
      }

      return result;
    } catch (error) {
      const endTime = Date.now();
      const err = error instanceof Error ? error : new Error(String(error));

      // Call onStepError hook
      if (this.config.hooks?.onStepError) {
        await this.config.hooks.onStepError(step, err, context);
      }

      // Retry if configured
      if (step.retry || this.config.retry) {
        const retryConfig = { ...this.config.retry, ...step.retry };
        if (retryConfig.maxRetries && retryConfig.maxRetries > 0) {
          // Would implement retry logic here
        }
      }

      const result: StepResult = {
        stepId: step.id,
        functionId: step.functionId,
        status: 'failed',
        error: err,
        metrics: {
          startTime,
          endTime,
          duration: endTime - startTime,
          memoryUsed: 0,
          cpuTime: 0,
        },
      };

      // Store step result
      context.steps.set(step.id, result);

      if (!step.continueOnError) {
        throw new StepExecutionError(
          `Step failed: ${step.id}`,
          context.workflowId,
          context.executionId,
          step.id,
          err
        );
      }

      return result;
    }
  }

  /**
   * Resolve step input
   */
  private resolveStepInput(
    input: StepInput | undefined,
    context: WorkflowContext
  ): unknown {
    if (input === undefined) {
      return context.data;
    }

    if (typeof input === 'string') {
      // Reference to previous step or data
      return this.resolveReference(input, context);
    }

    if (typeof input === 'function') {
      return input(context);
    }

    if (typeof input === 'object') {
      // Map multiple inputs
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string') {
          resolved[key] = this.resolveReference(value, context);
        } else {
          resolved[key] = value;
        }
      }
      return resolved;
    }

    return input;
  }

  /**
   * Resolve a reference (e.g., '$.steps.stepId.output')
   */
  private resolveReference(
    reference: string,
    context: WorkflowContext
  ): unknown {
    if (!reference.startsWith('$.')) {
      return reference;
    }

    const parts = reference.substring(2).split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        if (part === 'steps') {
          current = context.steps;
        } else if (current instanceof Map) {
          current = current.get(part);
        } else if (part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Handle step output
   */
  private handleStepOutput(
    output: StepOutput | undefined,
    value: unknown,
    context: WorkflowContext
  ): void {
    if (output === undefined) {
      return;
    }

    if (typeof output === 'string') {
      // Store at path
      this.setAtPath(output, value, context.data);
    } else if (typeof output === 'function') {
      // Custom handler
      output(value, context);
    }
  }

  /**
   * Set value at path in object
   */
  private setAtPath(path: string, value: unknown, obj: Record<string, unknown>): void {
    if (!path.startsWith('$.')) {
      return;
    }

    const parts = path.substring(2).split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Evaluate step condition
   */
  private evaluateCondition(
    condition: string | ((context: WorkflowContext) => boolean),
    context: WorkflowContext
  ): boolean {
    if (typeof condition === 'function') {
      return condition(context);
    }

    // Simple condition evaluation
    // In real implementation, would use a proper expression parser
    return this.resolveReference(condition, context) === true;
  }

  /**
   * Create workflow timeout promise
   */
  private createWorkflowTimeout(
    workflowId: string,
    executionId: string,
    timeout: number
  ): Promise<WorkflowResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new WorkflowTimeoutError(workflowId, executionId, timeout));
      }, timeout);
    });
  }

  /**
   * Create step timeout promise
   */
  private createStepTimeout(
    stepId: string,
    workflowId: string,
    executionId: string,
    timeout: number
  ): Promise<unknown> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new StepTimeoutError(stepId, workflowId, executionId, timeout));
      }, timeout);
    });
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `wf_exec_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get execution state
   */
  getExecutionState(executionId: string): WorkflowExecutionState | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): WorkflowExecutionState[] {
    return Array.from(this.executions.values()).filter(e => e.status === 'running');
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Workflow execution state
 */
interface WorkflowExecutionState {
  executionId: string;
  workflowId: string;
  status: ExecutionStatus;
  startTime: number;
  endTime: number;
  steps: StepResult[];
  context: WorkflowContext;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a new orchestration engine
 */
export function createOrchestrationEngine(
  functions: Map<string, EdgeFunction>,
  config?: OrchestrationConfig
): OrchestrationEngine {
  return new OrchestrationEngine(functions, config);
}

/**
 * Create a workflow
 */
export function createWorkflow(
  id: string,
  name: string,
  steps: WorkflowStep[],
  overrides?: Partial<Workflow>
): Workflow {
  return {
    id,
    name,
    steps,
    onError: 'stop',
    ...overrides,
  };
}

/**
 * Create a workflow step
 */
export function createWorkflowStep(
  id: string,
  functionId: string,
  type: StepType,
  overrides?: Partial<WorkflowStep>
): WorkflowStep {
  return {
    id,
    name: id,
    functionId,
    type,
    ...overrides,
  };
}

/**
 * Create a sequential step
 */
export function sequentialStep(
  id: string,
  functionId: string,
  overrides?: Partial<WorkflowStep>
): WorkflowStep {
  return createWorkflowStep(id, functionId, 'sequential', overrides);
}

/**
 * Create a parallel step
 */
export function parallelStep(
  id: string,
  functionId: string,
  overrides?: Partial<WorkflowStep>
): WorkflowStep {
  return createWorkflowStep(id, functionId, 'parallel', overrides);
}

/**
 * Chain steps together (output of one becomes input of next)
 */
export function chainSteps(
  steps: WorkflowStep[],
  startData: Record<string, unknown> = {}
): WorkflowStep[] {
  const chained: WorkflowStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = { ...steps[i] };

    if (i > 0) {
      // Set input to previous step's output
      step.input = `$.steps.${steps[i - 1].id}.output`;
    } else {
      // Use initial data
      step.input = startData;
    }

    chained.push(step);
  }

  return chained;
}

/**
 * Execute steps in parallel and wait for all
 */
export function parallelSteps(
  steps: WorkflowStep[]
): WorkflowStep[] {
  return steps.map(step => ({
    ...step,
    type: 'parallel' as StepType,
  }));
}

/**
 * Create a conditional step
 */
export function conditionalStep(
  id: string,
  functionId: string,
  condition: string | ((context: WorkflowContext) => boolean),
  overrides?: Partial<WorkflowStep>
): WorkflowStep {
  return createWorkflowStep(id, functionId, 'sequential', {
    ...overrides,
    condition,
  });
}
