/**
 * Orchestration Engine
 * Coordinates request orchestration across multiple services with parallel and sequential execution
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CompositionPlan,
  CompositionContext,
  CompositionResult,
  OrchestrationPlan,
  OrchestrationStep,
  OrchestrationContext,
  OrchestrationResult,
  ServiceConfig,
  GatewayError,
} from '../types';

// ============================================================================
// Orchestration Engine
// ============================================================================

export class OrchestrationEngine {
  private services: Map<string, ServiceConfig>;
  private executionHistory: Map<string, OrchestrationResult>;

  constructor() {
    this.services = new Map();
    this.executionHistory = new Map();
  }

  /**
   * Register a service
   */
  registerService(service: ServiceConfig): void {
    this.services.set(service.name, service);
  }

  /**
   * Create orchestration plan
   */
  createPlan(
    steps: OrchestrationStep[],
    options?: Partial<OrchestrationPlan>
  ): OrchestrationPlan {
    return {
      id: uuidv4(),
      steps: this.validateSteps(steps),
      timeout: options?.timeout || 30000,
      maxParallelism: options?.maxParallelism || 10,
      retryPolicy: options?.retryPolicy,
    };
  }

  /**
   * Validate orchestration steps
   */
  private validateSteps(steps: OrchestrationStep[]): OrchestrationStep[] {
    const stepMap = new Map<string, OrchestrationStep>();

    for (const step of steps) {
      if (stepMap.has(step.id)) {
        throw new GatewayError(`Duplicate step ID: ${step.id}`, 'VALIDATION_ERROR', 400);
      }
      stepMap.set(step.id, step);

      if (!this.services.has(step.service)) {
        throw new GatewayError(
          `Service not found: ${step.service}`,
          'SERVICE_NOT_FOUND',
          404
        );
      }

      // Validate dependencies
      for (const depId of step.dependencies) {
        if (!steps.some(s => s.id === depId)) {
          throw new GatewayError(
            `Dependency not found: ${depId}`,
            'VALIDATION_ERROR',
            400
          );
        }
      }
    }

    this.checkCycles(steps);

    return steps;
  }

  /**
   * Check for cycles in step dependencies
   */
  private checkCycles(steps: OrchestrationStep[]): void {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;

    const color = new Map<string, number>();

    const dfs = (stepId: string): boolean => {
      if (color.get(stepId) === GRAY) return true; // Cycle detected
      if (color.get(stepId) === BLACK) return false; // Already processed

      color.set(stepId, GRAY);

      const step = steps.find(s => s.id === stepId);
      if (step) {
        for (const depId of step.dependencies) {
          if (dfs(depId)) return true;
        }
      }

      color.set(stepId, BLACK);
      return false;
    };

    for (const step of steps) {
      if (dfs(step.id)) {
        throw new GatewayError(
          'Circular dependency detected in orchestration plan',
          'VALIDATION_ERROR',
          400
        );
      }
    }
  }

  /**
   * Execute orchestration plan
   */
  async execute(
    plan: OrchestrationPlan,
    input: any,
    context?: Partial<OrchestrationContext>
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();

    const ctx: OrchestrationContext = {
      requestId: context?.requestId || uuidv4(),
      startTime,
      input,
      results: new Map(),
      metadata: context?.metadata || {},
      traceId: context?.traceId || uuidv4(),
    };

    try {
      // Execute steps
      const stepResults = await this.executePlan(plan, ctx);

      // Build final result
      const result = this.buildResult(plan, stepResults, ctx);

      // Store in history
      this.executionHistory.set(ctx.requestId, result);

      return result;
    } catch (error) {
      const errorResult: OrchestrationResult = {
        success: false,
        requestId: ctx.requestId,
        duration: Date.now() - startTime,
        steps: [],
        error: error instanceof Error ? error : new Error(String(error)),
      };

      this.executionHistory.set(ctx.requestId, errorResult);
      return errorResult;
    }
  }

  /**
   * Execute orchestration plan
   */
  private async executePlan(
    plan: OrchestrationPlan,
    context: OrchestrationContext
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const executed = new Set<string>();

    // Group steps by execution level
    const levels = this.buildExecutionLevels(plan.steps);

    // Execute each level
    for (const level of levels) {
      // Check if we should execute parallel or sequential
      const parallelSteps = level.filter(s => s.mode === 'parallel');
      const sequentialSteps = level.filter(s => s.mode === 'sequential');

      // Execute parallel steps with concurrency limit
      if (parallelSteps.length > 0) {
        const parallelResults = await this.executeParallel(
          parallelSteps,
          plan,
          context,
          executed
        );
        for (const [stepId, result] of parallelResults) {
          results.set(stepId, result);
          executed.add(stepId);
        }
      }

      // Execute sequential steps
      for (const step of sequentialSteps) {
        const result = await this.executeStep(step, plan, context);
        results.set(step.id, result);
        executed.add(step.id);
      }
    }

    return results;
  }

  /**
   * Build execution levels (topological sort)
   */
  private buildExecutionLevels(steps: OrchestrationStep[]): OrchestrationStep[][] {
    const levels: OrchestrationStep[][] = [];
    const executed = new Set<string>();
    const remaining = new Set(steps.map(s => s.id));

    while (remaining.size > 0) {
      const currentLevel: OrchestrationStep[] = [];

      for (const step of steps) {
        if (executed.has(step.id)) continue;

        const depsSatisfied = step.dependencies.every(dep => executed.has(dep));
        if (depsSatisfied) {
          currentLevel.push(step);
        }
      }

      if (currentLevel.length === 0 && remaining.size > 0) {
        throw new GatewayError(
          'Cannot resolve dependencies - possible cycle',
          'ORCHESTRATION_ERROR',
          500
        );
      }

      levels.push(currentLevel);

      for (const step of currentLevel) {
        executed.add(step.id);
        remaining.delete(step.id);
      }
    }

    return levels;
  }

  /**
   * Execute steps in parallel with concurrency limit
   */
  private async executeParallel(
    steps: OrchestrationStep[],
    plan: OrchestrationPlan,
    context: OrchestrationContext,
    executed: Set<string>
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const concurrencyLimit = plan.maxParallelism;

    for (let i = 0; i < steps.length; i += concurrencyLimit) {
      const batch = steps.slice(i, i + concurrencyLimit);

      const batchResults = await Promise.all(
        batch.map(async (step) => {
          try {
            const result = await this.executeStep(step, plan, context);
            return { stepId: step.id, result, success: true };
          } catch (error) {
            return {
              stepId: step.id,
              result: undefined,
              success: false,
              error,
            };
          }
        })
      );

      for (const batchResult of batchResults) {
        if (batchResult.success) {
          results.set(batchResult.stepId, batchResult.result);
        } else if (steps.find(s => s.id === batchResult.stepId)?.required !== false) {
          throw batchResult.error;
        }
      }
    }

    return results;
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: OrchestrationStep,
    plan: OrchestrationPlan,
    context: OrchestrationContext
  ): Promise<any> {
    const service = this.services.get(step.service)!;
    const startTime = Date.now();

    try {
      // Prepare input for step
      const input = this.prepareStepInput(step, context);

      // Execute with timeout
      const result = await this.executeWithTimeout(
        this.executeServiceCall(service, step.operation, input),
        step.timeout || plan.timeout
      );

      // Store result
      context.results.set(step.id, result);

      // Execute post-processing
      if (step.postProcess) {
        return this.executePostProcess(step.postProcess, result, context);
      }

      return result;
    } catch (error) {
      // Check if we should retry
      if (plan.retryPolicy && step.retryable !== false) {
        const maxRetries = plan.retryPolicy.maxAttempts || 1;
        let lastError = error;

        for (let attempt = 1; attempt < maxRetries; attempt++) {
          await this.sleep(plan.retryPolicy.backoffMs * attempt);
          try {
            const input = this.prepareStepInput(step, context);
            const result = await this.executeWithTimeout(
              this.executeServiceCall(service, step.operation, input),
              step.timeout || plan.timeout
            );
            context.results.set(step.id, result);
            return result;
          } catch (retryError) {
            lastError = retryError;
          }
        }
        throw lastError;
      }
      throw error;
    }
  }

  /**
   * Prepare input for step execution
   */
  private prepareStepInput(
    step: OrchestrationStep,
    context: OrchestrationContext
  ): any {
    if (typeof step.input === 'string') {
      // Reference to another step or context
      if (step.input === '$input') {
        return context.input;
      }
      return context.results.get(step.input);
    }

    if (typeof step.input === 'function') {
      return step.input(context);
    }

    if (typeof step.input === 'object') {
      // Template object with references
      return this.resolveInputTemplate(step.input, context);
    }

    return context.input;
  }

  /**
   * Resolve input template with context references
   */
  private resolveInputTemplate(
    template: any,
    context: OrchestrationContext
  ): any {
    if (typeof template === 'string' && template.startsWith('$')) {
      const ref = template.substring(1);
      if (ref === 'input') return context.input;
      return context.results.get(ref);
    }

    if (Array.isArray(template)) {
      return template.map(item => this.resolveInputTemplate(item, context));
    }

    if (typeof template === 'object' && template !== null) {
      const resolved: any = {};
      for (const [key, value] of Object.entries(template)) {
        resolved[key] = this.resolveInputTemplate(value, context);
      }
      return resolved;
    }

    return template;
  }

  /**
   * Execute service call
   */
  private async executeServiceCall(
    service: ServiceConfig,
    operation: string,
    input: any
  ): Promise<any> {
    const url = `${service.endpoint}/${operation}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...service.headers,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new GatewayError(
        `Service call failed: ${response.statusText}`,
        'SERVICE_ERROR',
        response.status
      );
    }

    return response.json();
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      return await promise;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute post-processing function
   */
  private executePostProcess(
    postProcess: (result: any, context: OrchestrationContext) => any,
    result: any,
    context: OrchestrationContext
  ): any {
    return postProcess(result, context);
  }

  /**
   * Build final result from plan execution
   */
  private buildResult(
    plan: OrchestrationPlan,
    stepResults: Map<string, any>,
    context: OrchestrationContext
  ): OrchestrationResult {
    // Find output step or aggregate all results
    const outputStep = plan.steps.find(s => s.output);

    if (outputStep) {
      const output = stepResults.get(outputStep.id);
      return {
        success: true,
        requestId: context.requestId,
        data: output,
        duration: Date.now() - context.startTime,
        steps: plan.steps.map(step => ({
          id: step.id,
          service: step.service,
          duration: 0, // Would need to track per-step timing
          success: stepResults.has(step.id),
        })),
      };
    }

    // Aggregate all results
    return {
      success: true,
      requestId: context.requestId,
      data: Object.fromEntries(stepResults),
      duration: Date.now() - context.startTime,
      steps: plan.steps.map(step => ({
        id: step.id,
        service: step.service,
        duration: 0,
        success: stepResults.has(step.id),
      })),
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get execution history
   */
  getHistory(requestId?: string): OrchestrationResult | Map<string, OrchestrationResult> {
    if (requestId) {
      const result = this.executionHistory.get(requestId);
      if (!result) {
        throw new GatewayError(
          `Execution not found: ${requestId}`,
          'NOT_FOUND',
          404
        );
      }
      return result;
    }
    return new Map(this.executionHistory);
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory.clear();
  }

  /**
   * Get registered services
   */
  getServices(): Map<string, ServiceConfig> {
    return new Map(this.services);
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Create orchestration step
 */
export function createOrchestrationStep(
  id: string,
  service: string,
  operation: string,
  options?: Partial<OrchestrationStep>
): OrchestrationStep {
  return {
    id,
    service,
    operation,
    mode: options?.mode || 'parallel',
    dependencies: options?.dependencies || [],
    input: options?.input || '$input',
    output: options?.output || false,
    required: options?.required !== false,
    timeout: options?.timeout,
    retryable: options?.retryable !== false,
    postProcess: options?.postProcess,
  };
}
