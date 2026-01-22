// @ts-nocheck
/**
 * Service Composition and Orchestration
 *
 * Advanced service composition with dependency resolution, parallel execution,
 * and retry policies.
 */

import type {
  ResourceId,
  OrchestrationPlan,
  OrchestrationStep,
  CompositionResult,
  CompositionStep,
  RetryPolicy,
  ComposedService,
} from '../types/core';

import { ServiceInstance } from '../types/core';

/**
 * Service orchestrator
 */
export class ServiceOrchestrator {
  private services: Map<ResourceId, ServiceInstance>;
  private compositions: Map<string, ComposedService>;
  private executionHistory: Array<OrchestrationExecution>;

  constructor() {
    this.services = new Map();
    this.compositions = new Map();
    this.executionHistory = [];
  }

  /**
   * Register a service for composition
   */
  registerService(service: ServiceInstance): void {
    this.services.set(service.metadata.id, service);
  }

  /**
   * Unregister a service
   */
  unregisterService(serviceId: ResourceId): void {
    this.services.delete(serviceId);
  }

  /**
   * Compose services into a single unit
   */
  async compose<T>(
    name: string,
    serviceIds: readonly ResourceId[],
    options: CompositionOptions = {}
  ): Promise<CompositionResult<T>> {
    const startTime = Date.now();
    const steps: CompositionStep[] = [];

    try {
      // Validate all services exist
      for (const serviceId of serviceIds) {
        if (!this.services.has(serviceId)) {
          throw new Error(`Service not found: ${serviceId}`);
        }
      }

      // Resolve dependencies in order
      const orderedServices = this.resolveDependencies(serviceIds);

      // Initialize services if needed
      for (const serviceId of orderedServices) {
        const service = this.services.get(serviceId)!;

        if (service.lifecycle !== 'started') {
          steps.push({
            serviceId,
            method: 'start',
            success: true,
            duration: 0,
          });

          await service.start();
        }
      }

      // Create composed service
      const composed = this.createComposedService(
        name,
        orderedServices,
        options
      );

      // Store composition
      if (options.persistent !== false) {
        this.compositions.set(name, composed);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        result: composed.service as T,
        duration,
        steps,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: error as Error,
        duration,
        steps,
      };
    }
  }

  /**
   * Execute an orchestration plan
   */
  async executePlan<T>(
    plan: OrchestrationPlan
  ): Promise<CompositionResult<T>> {
    const startTime = Date.now();
    const steps: CompositionStep[] = [];

    try {
      let result: T | undefined;

      if (plan.parallel) {
        // Execute steps in parallel
        const results = await Promise.all(
          plan.steps.map((step) =>
            this.executeStep(step, plan.retryPolicy).then((r) => ({
              step,
              result: r,
            }))
          )
        );

        for (const { step, result: stepResult } of results) {
          steps.push(stepResult);
          if (!stepResult.success) {
            throw stepResult.error;
          }
        }

        // Use last result as output
        result = results[results.length - 1]?.result as T;
      } else {
        // Execute steps sequentially
        for (const step of plan.steps) {
          const stepResult = await this.executeStep(step, plan.retryPolicy);
          steps.push(stepResult);

          if (!stepResult.success) {
            throw stepResult.error;
          }
        }

        result = steps[steps.length - 1]?.output as T;
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        result,
        duration,
        steps,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: error as Error,
        duration,
        steps,
      };
    }
  }

  /**
   * Execute a single orchestration step
   */
  private async executeStep(
    step: OrchestrationStep,
    retryPolicy: RetryPolicy
  ): Promise<CompositionStep & { output?: unknown }> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retryPolicy.maxAttempts; attempt++) {
      try {
        const service = this.services.get(step.serviceId);

        if (!service) {
          throw new Error(`Service not found: ${step.serviceId}`);
        }

        // Execute method
        const instance = service.instance as Record<string, unknown>;
        const method = instance[step.method] as (
          ...args: unknown[]
        ) => unknown;

        if (typeof method !== 'function') {
          throw new Error(
            `Method ${step.method} not found on service ${step.serviceId}`
          );
        }

        const output = await method(...step.params);

        const duration = Date.now() - startTime;

        return {
          serviceId: step.serviceId,
          method: step.method,
          success: true,
          duration,
          output,
        };
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (
          !retryPolicy.retryableErrors.some((err) =>
            lastError!.message.includes(err)
          )
        ) {
          break;
        }

        // Wait before retry with exponential backoff
        if (attempt < retryPolicy.maxAttempts - 1) {
          const delay = Math.min(
            retryPolicy.initialDelay *
              Math.pow(retryPolicy.backoffMultiplier, attempt),
            retryPolicy.maxDelay
          );
          await this.sleep(delay);
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      serviceId: step.serviceId,
      method: step.method,
      success: false,
      duration,
      error: lastError,
    };
  }

  /**
   * Get a composed service
   */
  getComposedService<T>(name: string): T | undefined {
    const composed = this.compositions.get(name);
    return composed?.service as T;
  }

  /**
   * Dispose a composed service
   */
  async disposeComposedService(name: string): Promise<void> {
    const composed = this.compositions.get(name);

    if (composed) {
      await composed.dispose();
      this.compositions.delete(name);
    }
  }

  /**
   * Dispose all composed services
   */
  async disposeAll(): Promise<void> {
    for (const [name, composed] of this.compositions.entries()) {
      await composed.dispose();
    }

    this.compositions.clear();
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): ReadonlyArray<OrchestrationExecution> {
    return this.executionHistory;
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  private resolveDependencies(
    serviceIds: readonly ResourceId[]
  ): ResourceId[] {
    const resolved: ResourceId[] = [];
    const visited = new Set<ResourceId>();

    const visit = (serviceId: ResourceId): void => {
      if (visited.has(serviceId)) {
        return;
      }

      visited.add(serviceId);

      const service = this.services.get(serviceId);
      if (!service) {
        return;
      }

      // Visit dependencies first
      for (const depId of service.metadata.dependencies) {
        if (serviceIds.includes(depId)) {
          visit(depId);
        }
      }

      resolved.push(serviceId);
    };

    for (const serviceId of serviceIds) {
      visit(serviceId);
    }

    return resolved;
  }

  private createComposedService(
    name: string,
    serviceIds: ResourceId[],
    options: CompositionOptions
  ): ComposedService {
    const services = serviceIds
      .map((id) => this.services.get(id))
      .filter((s) => s !== undefined) as ServiceInstance[];

    const service = Object.fromEntries(
      services.map((s) => [s.metadata.name, s.instance])
    );

    return {
      service,
      dependencies: serviceIds,
      dispose: async () => {
        if (options.disposeServices) {
          for (const serviceId of serviceIds.reverse()) {
            const service = this.services.get(serviceId);
            if (service) {
              await service.stop();
            }
          }
        }
      },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Composition options
 */
export interface CompositionOptions {
  readonly persistent?: boolean;
  readonly disposeServices?: boolean;
  readonly lazy?: boolean;
}

/**
 * Orchestration execution
 */
interface OrchestrationExecution {
  readonly id: string;
  readonly plan: OrchestrationPlan;
  readonly result: CompositionResult;
  readonly timestamp: number;
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'],
};

/**
 * Composition builder
 */
export class CompositionBuilder {
  private orchestrator: ServiceOrchestrator;
  private serviceIds: ResourceId[] = [];
  private options: CompositionOptions = {};

  constructor(orchestrator: ServiceOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Add a service to the composition
   */
  addService(serviceId: ResourceId): this {
    this.serviceIds.push(serviceId);
    return this;
  }

  /**
   * Add multiple services
   */
  addServices(serviceIds: readonly ResourceId[]): this {
    this.serviceIds.push(...serviceIds);
    return this;
  }

  /**
   * Set composition options
   */
  withOptions(options: CompositionOptions): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Build the composition
   */
  async build<T>(name: string): Promise<CompositionResult<T>> {
    return this.orchestrator.compose<T>(name, this.serviceIds, this.options);
  }
}

/**
 * Orchestration plan builder
 */
export class OrchestrationPlanBuilder {
  private steps: OrchestrationStep[] = [];
  private parallel = false;
  private retryPolicy: RetryPolicy = { ...DEFAULT_RETRY_POLICY };

  /**
   * Add a step to the plan
   */
  addStep(
    serviceId: ResourceId,
    method: string,
    params: unknown[] = [],
    dependencies: ResourceId[] = []
  ): this {
    this.steps.push({
      serviceId,
      method,
      params,
      dependencies,
    });
    return this;
  }

  /**
   * Execute steps in parallel
   */
  parallel(): this {
    this.parallel = true;
    return this;
  }

  /**
   * Execute steps sequentially
   */
  sequential(): this {
    this.parallel = false;
    return this;
  }

  /**
   * Set retry policy
   */
  withRetry(policy: Partial<RetryPolicy>): this {
    this.retryPolicy = { ...this.retryPolicy, ...policy };
    return this;
  }

  /**
   * Build the plan
   */
  build(): OrchestrationPlan {
    return {
      steps: this.steps,
      parallel: this.parallel,
      retryPolicy: this.retryPolicy,
    };
  }
}
