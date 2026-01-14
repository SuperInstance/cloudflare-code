/**
 * Service Pipeline
 *
 * Pipeline processing for service composition with middleware support.
 */

import type { ResourceId } from '../types/core';

import { ServiceInstance } from '../types/core';

/**
 * Pipeline context
 */
export interface PipelineContext {
  readonly services: Map<ResourceId, ServiceInstance>;
  readonly metadata: Record<string, unknown>;
  data: Map<string, unknown>;
}

/**
 * Pipeline step
 */
export interface PipelineStep {
  readonly name: string;
  readonly serviceId: ResourceId;
  readonly method: string;
  readonly params: unknown[];
  readonly condition?: (context: PipelineContext) => boolean;
  readonly transform?: (
    result: unknown,
    context: PipelineContext
  ) => unknown;
}

/**
 * Pipeline middleware
 */
export type PipelineMiddleware = (
  context: PipelineContext,
  next: () => Promise<unknown>
) => Promise<unknown>;

/**
 * Pipeline result
 */
export interface PipelineResult {
  readonly success: boolean;
  readonly data: unknown;
  readonly error?: Error;
  readonly duration: number;
  readonly steps: ReadonlyArray<{
    readonly name: string;
    readonly success: boolean;
    readonly duration: number;
    readonly output?: unknown;
  }>;
}

/**
 * Service pipeline
 */
export class ServicePipeline {
  private services: Map<ResourceId, ServiceInstance>;
  private steps: PipelineStep[] = [];
  private middleware: PipelineMiddleware[] = [];
  private errorHandler?: (
    error: Error,
    context: PipelineContext
  ) => void;

  constructor(services: Map<ResourceId, ServiceInstance>) {
    this.services = services;
  }

  /**
   * Add a step to the pipeline
   */
  addStep(step: PipelineStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Add multiple steps
   */
  addSteps(steps: readonly PipelineStep[]): this {
    this.steps.push(...steps);
    return this;
  }

  /**
   * Add middleware
   */
  use(middleware: PipelineMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Set error handler
   */
  onError(handler: (error: Error, context: PipelineContext) => void): this {
    this.errorHandler = handler;
    return this;
  }

  /**
   * Execute the pipeline
   */
  async execute(
    initialData: Record<string, unknown> = {}
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const context: PipelineContext = {
      services: this.services,
      metadata: {},
      data: new Map(Object.entries(initialData)),
    };

    const stepResults: Array<{
      name: string;
      success: boolean;
      duration: number;
      output?: unknown;
    }> = [];

    try {
      // Execute middleware chain
      let result: unknown = undefined;

      const executeSteps = async (): Promise<unknown> => {
        for (const step of this.steps) {
          // Check condition
          if (step.condition && !step.condition(context)) {
            stepResults.push({
              name: step.name,
              success: true,
              duration: 0,
              output: undefined,
            });
            continue;
          }

          const stepStartTime = Date.now();

          try {
            // Get service
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

            let output = await method(...step.params);

            // Transform output if needed
            if (step.transform) {
              output = step.transform(output, context);
            }

            // Store in context
            context.data.set(step.name, output);

            result = output;

            stepResults.push({
              name: step.name,
              success: true,
              duration: Date.now() - stepStartTime,
              output,
            });
          } catch (error) {
            stepResults.push({
              name: step.name,
              success: false,
              duration: Date.now() - stepStartTime,
              error: error as Error,
            });
            throw error;
          }
        }

        return result;
      };

      // Build middleware chain
      let chain = executeSteps;
      for (let i = this.middleware.length - 1; i >= 0; i--) {
        const mw = this.middleware[i];
        const next = chain;
        chain = () => mw(context, next);
      }

      // Execute chain
      result = await chain();

      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
        steps: stepResults,
      };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(error as Error, context);
      }

      return {
        success: false,
        data: undefined,
        error: error as Error,
        duration: Date.now() - startTime,
        steps: stepResults,
      };
    }
  }

  /**
   * Clear pipeline
   */
  clear(): this {
    this.steps = [];
    this.middleware = [];
    this.errorHandler = undefined;
    return this;
  }

  /**
   * Clone pipeline
   */
  clone(): ServicePipeline {
    const pipeline = new ServicePipeline(this.services);
    pipeline.steps = [...this.steps];
    pipeline.middleware = [...this.middleware];
    pipeline.errorHandler = this.errorHandler;
    return pipeline;
  }
}

/**
 * Pipeline builder
 */
export class PipelineBuilder {
  private services: Map<ResourceId, ServiceInstance>;

  constructor(services: Map<ResourceId, ServiceInstance>) {
    this.services = services;
  }

  /**
   * Create a new pipeline
   */
  create(): ServicePipeline {
    return new ServicePipeline(this.services);
  }

  /**
   * Create a pipeline from steps
   */
  fromSteps(steps: readonly PipelineStep[]): ServicePipeline {
    return new ServicePipeline(this.services).addSteps(steps);
  }
}

/**
 * Common pipeline steps
 */
export const PipelineSteps = {
  /**
   * Create a data transformation step
   */
  transform: (
    name: string,
    transform: (data: unknown) => unknown
  ): PipelineStep => ({
    name,
    serviceId: '' as ResourceId,
    method: 'transform',
    params: [],
    transform: async (result) => transform(result),
  }),

  /**
   * Create a validation step
   */
  validate: (
    name: string,
    validate: (data: unknown) => boolean
  ): PipelineStep => ({
    name,
    serviceId: '' as ResourceId,
    method: 'validate',
    params: [],
    condition: (context) => {
      const data = context.data.get(name);
      return validate(data);
    },
  }),

  /**
   * Create a conditional step
   */
  conditional: (
    name: string,
    serviceId: ResourceId,
    method: string,
    condition: (context: PipelineContext) => boolean,
    params: unknown[] = []
  ): PipelineStep => ({
    name,
    serviceId,
    method,
    params,
    condition,
  }),

  /**
   * Create a parallel step group
   */
  parallel: (
    name: string,
    steps: readonly PipelineStep[]
  ): PipelineStep => ({
    name,
    serviceId: '' as ResourceId,
    method: 'parallel',
    params: [],
    transform: async () => {
      const pipeline = new ServicePipeline(new Map());
      pipeline.addSteps(steps);
      const result = await pipeline.execute();
      if (!result.success) {
        throw result.error;
      }
      return result.data;
    },
  }),
};

/**
 * Common middleware
 */
export const PipelineMiddleware = {
  /**
   * Logging middleware
   */
  logging: (prefix = '[Pipeline]'): PipelineMiddleware => {
    return async (context, next) => {
      console.log(`${prefix} Starting pipeline execution`);
      const startTime = Date.now();

      try {
        const result = await next();
        console.log(
          `${prefix} Completed in ${Date.now() - startTime}ms`
        );
        return result;
      } catch (error) {
        console.error(`${prefix} Failed:`, error);
        throw error;
      }
    };
  },

  /**
   * Metrics middleware
   */
  metrics: (metrics: {
    increment: (name: string, value?: number) => void;
    timing: (name: string, value: number) => void;
  }): PipelineMiddleware => {
    return async (context, next) => {
      const startTime = Date.now();

      try {
        const result = await next();
        metrics.timing('pipeline.duration', Date.now() - startTime);
        metrics.increment('pipeline.success');
        return result;
      } catch (error) {
        metrics.increment('pipeline.error');
        throw error;
      }
    };
  },

  /**
   * Caching middleware
   */
  caching: (
    cache: Map<string, unknown>,
    key: string
  ): PipelineMiddleware => {
    return async (context, next) => {
      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = await next();
      cache.set(key, result);
      return result;
    };
  },

  /**
   * Retry middleware
   */
  retry: (maxAttempts = 3, delay = 100): PipelineMiddleware => {
    return async (context, next) => {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await next();
        } catch (error) {
          lastError = error as Error;

          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, delay * Math.pow(2, attempt))
            );
          }
        }
      }

      throw lastError;
    };
  },

  /**
   * Timeout middleware
   */
  timeout: (ms: number): PipelineMiddleware => {
    return async (context, next) => {
      let timeoutHandle: ReturnType<typeof setTimeout>;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Pipeline timeout after ${ms}ms`));
        }, ms);
      });

      try {
        const result = await Promise.race([next(), timeoutPromise]);
        clearTimeout(timeoutHandle);
        return result;
      } catch (error) {
        clearTimeout(timeoutHandle);
        throw error;
      }
    };
  },
};
