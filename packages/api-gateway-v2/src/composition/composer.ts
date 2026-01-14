/**
 * API Composition Engine
 * Orchestrates requests across multiple services with parallel and sequential execution
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CompositionConfig,
  CompositionPlan,
  CompositionStep,
  CompositionContext,
  CompositionResult,
  CompositionMetadata,
  StepResult,
  ServiceConfig,
  CompositionError,
  GatewayError,
  RetryPolicy,
} from '../types';

// ============================================================================
// API Composer
// ============================================================================

export class APIComposer {
  private config: CompositionConfig;
  private services: Map<string, ServiceConfig>;
  private cache?: Map<string, CacheEntry>;

  constructor(config: CompositionConfig) {
    this.config = config;
    this.services = new Map();
    if (config.cache?.enabled) {
      this.cache = new Map();
    }
  }

  /**
   * Register a service for composition
   */
  registerService(service: ServiceConfig): void {
    this.services.set(service.name, service);
  }

  /**
   * Unregister a service
   */
  unregisterService(name: string): void {
    this.services.delete(name);
  }

  /**
   * Create a composition plan
   */
  createPlan(
    steps: CompositionStep[],
    options?: Partial<CompositionPlan>
  ): CompositionPlan {
    return {
      id: uuidv4(),
      steps: this.validateSteps(steps),
      timeout: options?.timeout || this.config.orchestrationTimeout,
      retryPolicy: options?.retryPolicy,
    };
  }

  /**
   * Validate composition steps
   */
  private validateSteps(steps: CompositionStep[]): CompositionStep[] {
    const stepMap = new Map<string, CompositionStep>();

    // Build step map and validate step IDs
    for (const step of steps) {
      if (stepMap.has(step.id)) {
        throw new CompositionError(`Duplicate step ID: ${step.id}`);
      }
      stepMap.set(step.id, step);

      // Validate service exists
      if (!this.services.has(step.service)) {
        throw new CompositionError(
          `Service not found: ${step.service}`
        );
      }

      // Validate dependencies
      for (const depId of step.dependencies) {
        if (!stepMap.has(depId) && !steps.some(s => s.id === depId)) {
          throw new CompositionError(
            `Dependency not found: ${depId}`
          );
        }
      }

      // Validate inputs
      for (const input of step.inputs) {
        if (input.source === 'step' && !stepMap.has(input.value)) {
          throw new CompositionError(
            `Input step not found: ${input.value}`
          );
        }
      }
    }

    // Check for circular dependencies
    this.checkCircularDependencies(steps);

    return steps;
  }

  /**
   * Check for circular dependencies in steps
   */
  private checkCircularDependencies(steps: CompositionStep[]): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      if (visiting.has(stepId)) {
        throw new CompositionError(
          `Circular dependency detected involving step: ${stepId}`
        );
      }

      visiting.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step) {
        for (const depId of step.dependencies) {
          visit(depId);
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
    };

    for (const step of steps) {
      visit(step.id);
    }
  }

  /**
   * Execute composition plan
   */
  async execute(
    plan: CompositionPlan,
    request: any,
    context?: Partial<CompositionMetadata>
  ): Promise<CompositionResult> {
    const startTime = Date.now();

    // Create composition context
    const metadata: CompositionMetadata = {
      requestId: context?.requestId || uuidv4(),
      startTime,
      traceId: context?.traceId || uuidv4(),
      userId: context?.userId,
    };

    const ctx: CompositionContext = {
      request,
      results: new Map(),
      metadata,
    };

    try {
      // Execute steps in appropriate order
      const stepResults = await this.executeSteps(plan, ctx);

      // Aggregate results
      const data = this.aggregateResults(stepResults, plan);

      return {
        data,
        metadata: {
          duration: Date.now() - startTime,
          steps: stepResults,
          cacheHits: this.countCacheHits(stepResults),
          serviceCalls: stepResults.length,
        },
      };
    } catch (error) {
      throw new CompositionError(
        `Composition execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Execute composition steps
   */
  private async executeSteps(
    plan: CompositionPlan,
    context: CompositionContext
  ): Promise<StepResult[]> {
    const results: StepResult[] = [];

    // Group steps by execution level (topological order)
    const levels = this.groupStepsByLevel(plan.steps);

    // Execute each level
    for (const level of levels) {
      const levelResults = await Promise.all(
        level.map(step => this.executeStep(step, plan, context))
      );
      results.push(...levelResults);
    }

    return results;
  }

  /**
   * Group steps by execution level (topological sort)
   */
  private groupStepsByLevel(steps: CompositionStep[]): CompositionStep[][] {
    const levels: CompositionStep[][] = [];
    const executed = new Set<string>();
    const remaining = new Set(steps.map(s => s.id));

    while (remaining.size > 0) {
      const currentLevel: CompositionStep[] = [];

      for (const step of steps) {
        if (executed.has(step.id)) continue;

        // Check if all dependencies are executed
        const depsSatisfied = step.dependencies.every(dep =>
          executed.has(dep)
        );

        if (depsSatisfied) {
          currentLevel.push(step);
        }
      }

      if (currentLevel.length === 0) {
        throw new CompositionError(
          'Cannot resolve step dependencies - possible circular dependency'
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
   * Execute a single step
   */
  private async executeStep(
    step: CompositionStep,
    plan: CompositionPlan,
    context: CompositionContext
  ): Promise<StepResult> {
    const startTime = Date.now();
    const service = this.services.get(step.service)!;

    try {
      // Check cache first
      if (this.cache) {
        const cacheKey = this.buildCacheKey(step, context);
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
          context.results.set(step.id, cached.value);
          return {
            stepId: step.id,
            service: step.service,
            duration: Date.now() - startTime,
            success: true,
            cached: true,
          };
        }
      }

      // Prepare inputs
      const inputs = this.prepareInputs(step, context);

      // Execute with retry logic
      const result = await this.executeWithRetry(
        service,
        step,
        inputs,
        plan.retryPolicy
      );

      // Store result
      context.results.set(step.id, result);

      // Cache result if enabled
      if (this.cache && this.config.cache?.enabled) {
        const cacheKey = this.buildCacheKey(step, context);
        this.cache.set(cacheKey, {
          key: cacheKey,
          value: result,
          expiresAt: Date.now() + this.config.cache.ttl,
          metadata: {
            createdAt: Date.now(),
            accessedAt: Date.now(),
            hitCount: 0,
            size: JSON.stringify(result).length,
          },
        });

        // Enforce cache size limit
        this.enforceCacheLimit();
      }

      return {
        stepId: step.id,
        service: step.service,
        duration: Date.now() - startTime,
        success: true,
        cached: false,
      };
    } catch (error) {
      return {
        stepId: step.id,
        service: step.service,
        duration: Date.now() - startTime,
        success: false,
        cached: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Prepare inputs for step execution
   */
  private prepareInputs(
    step: CompositionStep,
    context: CompositionContext
  ): Record<string, any> {
    const inputs: Record<string, any> = {};

    for (const input of step.inputs) {
      let value: any;

      switch (input.source) {
        case 'request':
          value = this.getNestedValue(context.request, input.value);
          break;
        case 'step':
          const stepResult = context.results.get(input.value);
          value = stepResult;
          break;
        case 'constant':
          value = input.value;
          break;
      }

      // Apply transformation if specified
      if (input.transform) {
        value = this.applyTransform(value, input.transform);
      }

      inputs[input.value] = value;
    }

    return inputs;
  }

  /**
   * Execute service call with retry logic
   */
  private async executeWithRetry(
    service: ServiceConfig,
    step: CompositionStep,
    inputs: Record<string, any>,
    retryPolicy?: RetryPolicy
  ): Promise<any> {
    const policy = retryPolicy || service.retryPolicy;
    const maxAttempts = policy?.maxAttempts || 1;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.executeServiceCall(service, step, inputs);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.isRetryableError(lastError, policy)) {
          throw lastError;
        }

        // Wait before retrying
        if (attempt < maxAttempts - 1 && policy) {
          const delay = policy.backoffMs * Math.pow(policy.multiplier, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute actual service call
   */
  private async executeServiceCall(
    service: ServiceConfig,
    step: CompositionStep,
    inputs: Record<string, any>
  ): Promise<any> {
    const timeout = step.timeout || service.timeout || this.config.defaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(service.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...service.headers,
        },
        body: JSON.stringify({
          operation: step.operation,
          inputs,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new GatewayError(
          `Service call failed: ${response.statusText}`,
          'SERVICE_ERROR',
          response.status
        );
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(
    error: Error,
    policy?: RetryPolicy
  ): boolean {
    if (!policy) return false;

    // Check against retryable error patterns
    for (const pattern of policy.retryableErrors) {
      if (error.message.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Aggregate results from all steps
   */
  private aggregateResults(
    stepResults: StepResult[],
    plan: CompositionPlan
  ): any {
    const aggregated: any = {};

    for (const result of stepResults) {
      if (!result.success) continue;

      const step = plan.steps.find(s => s.id === result.stepId);
      if (!step) continue;

      // Merge outputs into aggregated result
      for (const output of step.outputs) {
        const value = this.getNestedValue(
          result,
          `stepId` // Would need to get actual result data
        );
        this.setNestedValue(aggregated, output.path, value);
      }
    }

    return aggregated;
  }

  /**
   * Build cache key for step
   */
  private buildCacheKey(
    step: CompositionStep,
    context: CompositionContext
  ): string {
    const parts = [
      step.id,
      step.service,
      step.operation,
      JSON.stringify(context.request),
    ];
    return parts.join(':');
  }

  /**
   * Enforce cache size limit
   */
  private enforceCacheLimit(): void {
    if (!this.cache || !this.config.cache) return;

    const maxSize = this.config.cache.maxSize;
    if (this.cache.size <= maxSize) return;

    // Remove oldest entries (LRU)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].metadata.accessedAt - b[1].metadata.accessedAt);

    const toRemove = this.cache.size - maxSize;
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Count cache hits in results
   */
  private countCacheHits(results: StepResult[]): number {
    return results.filter(r => r.cached).length;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  /**
   * Set nested value on object
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Apply transformation to value
   */
  private applyTransform(value: any, transform: string): any {
    // Simple transformation - in real implementation, use a proper expression evaluator
    if (transform.startsWith('json:')) {
      const field = transform.substring(5);
      return JSON.parse(value)[field];
    }
    return value;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get registered services
   */
  getServices(): Map<string, ServiceConfig> {
    return new Map(this.services);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number } | undefined {
    if (!this.cache) return undefined;

    return {
      size: this.cache.size,
      hits: Array.from(this.cache.values())
        .reduce((sum, entry) => sum + entry.metadata.hitCount, 0),
    };
  }
}

// ============================================================================
// Types
// ============================================================================

interface CacheEntry {
  key: string;
  value: any;
  expiresAt: number;
  metadata: {
    createdAt: number;
    accessedAt: number;
    hitCount: number;
    size: number;
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Create composition step
 */
export function createStep(
  id: string,
  service: string,
  operation: string,
  options?: Partial<CompositionStep>
): CompositionStep {
  return {
    id,
    service,
    operation,
    type: options?.type || 'query',
    execution: options?.execution || 'parallel',
    dependencies: options?.dependencies || [],
    inputs: options?.inputs || [],
    outputs: options?.outputs || [],
    timeout: options?.timeout,
  };
}

/**
 * Validate composition configuration
 */
export function validateCompositionConfig(
  config: CompositionConfig
): void {
  if (config.maxConcurrentRequests < 1) {
    throw new GatewayError(
      'maxConcurrentRequests must be at least 1',
      'INVALID_CONFIG',
      400
    );
  }

  if (config.defaultTimeout < 100) {
    throw new GatewayError(
      'defaultTimeout must be at least 100ms',
      'INVALID_CONFIG',
      400
    );
  }

  if (config.orchestrationTimeout < config.defaultTimeout) {
    throw new GatewayError(
      'orchestrationTimeout must be greater than defaultTimeout',
      'INVALID_CONFIG',
      400
    );
  }

  if (config.cache?.enabled) {
    if (config.cache.ttl < 0) {
      throw new GatewayError(
        'cache TTL must be non-negative',
        'INVALID_CONFIG',
        400
      );
    }
    if (config.cache.maxSize < 1) {
      throw new GatewayError(
        'cache maxSize must be at least 1',
        'INVALID_CONFIG',
        400
      );
    }
  }
}
