/**
 * Transition Handler
 * Handles transition execution, validation, hooks, and optimization
 */

import { StateMachineEngine } from '../engine/engine.js';
import {
  State,
  StateContext,
  Transition,
  StateMachineError,
  TransitionError,
} from '../types/index.js';

/**
 * Transition hook type
 */
export type TransitionHook<TData = any> = (
  transition: Transition<TData>,
  context: StateContext<TData>
) => void | Promise<void>;

/**
 * Transition handler options
 */
export interface TransitionHandlerOptions<TData = any> {
  /** Enable transition caching */
  enableCaching?: boolean;
  /** Enable transition optimization */
  enableOptimization?: boolean;
  /** Maximum cache size */
  maxCacheSize?: number;
  /** Transition timeout */
  timeout?: number;
  /** Retry failed transitions */
  retryAttempts?: number;
  /** Retry delay */
  retryDelay?: number;
  /** Global before hooks */
  beforeHooks?: TransitionHook<TData>[];
  /** Global after hooks */
  afterHooks?: TransitionHook<TData>[];
  /** Global error hooks */
  errorHooks?: TransitionHook<TData>[];
}

/**
 * Cached transition result
 */
interface CachedTransition {
  result: any;
  timestamp: number;
  hits: number;
}

/**
 * Transition handler class
 */
export class TransitionHandler<TData = any> {
  private machine: StateMachineEngine<TData>;
  private options: Required<TransitionHandlerOptions<TData>>;
  private transitionCache: Map<string, CachedTransition> = new Map();
  private beforeHooks: TransitionHook<TData>[] = [];
  private afterHooks: TransitionHook<TData>[] = [];
  private errorHooks: TransitionHook<TData>[] = [];
  private metrics: TransitionHandlerMetrics = {
    totalTransitions: 0,
    successfulTransitions: 0,
    failedTransitions: 0,
    retriedTransitions: 0,
    cachedTransitions: 0,
    avgTransitionTime: 0,
    maxTransitionTime: 0,
    minTransitionTime: Infinity,
  };

  constructor(
    machine: StateMachineEngine<TData>,
    options: TransitionHandlerOptions<TData> = {}
  ) {
    this.machine = machine;
    this.options = this.normalizeOptions(options);

    // Add global hooks
    if (this.options.beforeHooks) {
      this.beforeHooks.push(...this.options.beforeHooks);
    }
    if (this.options.afterHooks) {
      this.afterHooks.push(...this.options.afterHooks);
    }
    if (this.options.errorHooks) {
      this.errorHooks.push(...this.options.errorHooks);
    }
  }

  /**
   * Execute a transition with full hook support
   */
  async executeTransition(
    transition: Transition<TData>,
    context: StateContext<TData>
  ): Promise<any> {
    const startTime = performance.now();
    this.metrics.totalTransitions++;

    try {
      // Check cache if enabled
      if (this.options.enableCaching) {
        const cacheKey = this.getCacheKey(transition, context);
        const cached = this.transitionCache.get(cacheKey);

        if (cached) {
          cached.hits++;
          this.metrics.cachedTransitions++;
          return cached.result;
        }
      }

      // Execute before hooks
      await this.executeHooks(this.beforeHooks, transition, context);

      // Execute transition with retry logic
      const result = await this.executeWithRetry(transition, context);

      // Execute after hooks
      await this.executeHooks(this.afterHooks, transition, context);

      // Cache result if enabled
      if (this.options.enableCaching) {
        this.cacheTransition(transition, context, result);
      }

      // Update metrics
      const duration = performance.now() - startTime;
      this.updateMetrics(true, duration);

      this.metrics.successfulTransitions++;

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.updateMetrics(false, duration);

      // Execute error hooks
      await this.executeHooks(this.errorHooks, transition, context);

      this.metrics.failedTransitions++;

      throw new TransitionError(
        `Transition execution failed: ${(error as Error).message}`,
        context,
        context.current,
        transition.to,
        context.event
      );
    }
  }

  /**
   * Validate a transition before execution
   */
  async validateTransition(
    transition: Transition<TData>,
    context: StateContext<TData>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check if target state exists
    const definition = (this.machine as any).definition;
    if (!definition.states[transition.to]) {
      errors.push(`Target state '${transition.to}' does not exist`);
    }

    // Check if source matches current state
    if (!this.matchesSource(transition.from, context.current)) {
      errors.push(
        `Transition source '${transition.from}' does not match current state '${context.current}'`
      );
    }

    // Check guard condition
    if (transition.guard) {
      try {
        const result = await transition.guard(context);
        if (result !== true) {
          errors.push('Guard condition returned false');
        }
      } catch (error) {
        errors.push(`Guard condition threw error: ${(error as Error).message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Add a before hook
   */
  addBeforeHook(hook: TransitionHook<TData>): void {
    this.beforeHooks.push(hook);
  }

  /**
   * Add an after hook
   */
  addAfterHook(hook: TransitionHook<TData>): void {
    this.afterHooks.push(hook);
  }

  /**
   * Add an error hook
   */
  addErrorHook(hook: TransitionHook<TData>): void {
    this.errorHooks.push(hook);
  }

  /**
   * Remove all hooks
   */
  clearHooks(): void {
    this.beforeHooks = [];
    this.afterHooks = [];
    this.errorHooks = [];
  }

  /**
   * Clear transition cache
   */
  clearCache(): void {
    this.transitionCache.clear();
  }

  /**
   * Get handler metrics
   */
  getMetrics(): TransitionHandlerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalTransitions: 0,
      successfulTransitions: 0,
      failedTransitions: 0,
      retriedTransitions: 0,
      cachedTransitions: 0,
      avgTransitionTime: 0,
      maxTransitionTime: 0,
      minTransitionTime: Infinity,
    };
  }

  /**
   * Optimize transitions by analyzing patterns
   */
  optimizeTransitions(): TransitionOptimizationReport {
    const report: TransitionOptimizationReport = {
      optimizations: [],
      cacheHitRate: 0,
      recommendations: [],
    };

    if (this.metrics.totalTransitions > 0) {
      report.cacheHitRate = this.metrics.cachedTransitions / this.metrics.totalTransitions;
    }

    // Analyze cache effectiveness
    if (report.cacheHitRate < 0.3 && this.options.enableCaching) {
      report.recommendations.push('Consider disabling caching - low hit rate');
    } else if (report.cacheHitRate > 0.7 && !this.options.enableCaching) {
      report.recommendations.push('Consider enabling caching - high hit rate potential');
    }

    // Analyze transition times
    if (this.metrics.avgTransitionTime > 100) {
      report.recommendations.push('High average transition time - consider optimizing actions');
    }

    // Analyze failure rate
    const failureRate = this.metrics.failedTransitions / this.metrics.totalTransitions;
    if (failureRate > 0.1) {
      report.recommendations.push('High failure rate - review guard conditions and actions');
    }

    return report;
  }

  /**
   * Execute hooks
   */
  private async executeHooks(
    hooks: TransitionHook<TData>[],
    transition: Transition<TData>,
    context: StateContext<TData>
  ): Promise<void> {
    for (const hook of hooks) {
      await hook(transition, context);
    }
  }

  /**
   * Execute transition with retry logic
   */
  private async executeWithRetry(
    transition: Transition<TData>,
    context: StateContext<TData>,
    attempt: number = 0
  ): Promise<any> {
    try {
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Transition timeout')),
          this.options.timeout
        );
      });

      // Execute transition action
      const actionPromise = transition.action
        ? transition.action(context)
        : Promise.resolve();

      return await Promise.race([actionPromise, timeoutPromise]);
    } catch (error) {
      if (attempt < this.options.retryAttempts) {
        this.metrics.retriedTransitions++;

        // Wait before retry
        await new Promise(resolve =>
          setTimeout(resolve, this.options.retryDelay)
        );

        return this.executeWithRetry(transition, context, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Cache transition result
   */
  private cacheTransition(
    transition: Transition<TData>,
    context: StateContext<TData>,
    result: any
  ): void {
    const cacheKey = this.getCacheKey(transition, context);

    // Prune cache if needed
    if (this.transitionCache.size >= this.options.maxCacheSize) {
      // Remove least recently used entry
      let oldestKey = '';
      let oldestTime = Infinity;

      for (const [key, value] of this.transitionCache) {
        if (value.timestamp < oldestTime) {
          oldestTime = value.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.transitionCache.delete(oldestKey);
      }
    }

    this.transitionCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Get cache key for transition
   */
  private getCacheKey(
    transition: Transition<TData>,
    context: StateContext<TData>
  ): string {
    return `${context.current}:${transition.to}:${context.event}:${JSON.stringify(context.payload || {})}`;
  }

  /**
   * Check if source matches current state
   */
  private matchesSource(
    source: State | State[] | '*',
    current: State
  ): boolean {
    if (source === '*') {
      return true;
    }
    if (Array.isArray(source)) {
      return source.includes(current);
    }
    return source === current;
  }

  /**
   * Update metrics
   */
  private updateMetrics(success: boolean, duration: number): void {
    // Update duration stats
    const total = this.metrics.totalTransitions;
    const avg = this.metrics.avgTransitionTime;
    this.metrics.avgTransitionTime = (avg * (total - 1) + duration) / total;
    this.metrics.maxTransitionTime = Math.max(this.metrics.maxTransitionTime, duration);
    this.metrics.minTransitionTime = Math.min(this.metrics.minTransitionTime, duration);
  }

  /**
   * Normalize options
   */
  private normalizeOptions(
    options: TransitionHandlerOptions<TData>
  ): Required<TransitionHandlerOptions<TData>> {
    return {
      enableCaching: options.enableCaching ?? false,
      enableOptimization: options.enableOptimization ?? true,
      maxCacheSize: options.maxCacheSize ?? 1000,
      timeout: options.timeout ?? 5000,
      retryAttempts: options.retryAttempts ?? 3,
      retryDelay: options.retryDelay ?? 100,
      beforeHooks: options.beforeHooks ?? [],
      afterHooks: options.afterHooks ?? [],
      errorHooks: options.errorHooks ?? [],
    };
  }

  /**
   * Destroy handler
   */
  destroy(): void {
    this.clearCache();
    this.clearHooks();
    this.resetMetrics();
  }
}

/**
 * Transition handler metrics
 */
export interface TransitionHandlerMetrics {
  totalTransitions: number;
  successfulTransitions: number;
  failedTransitions: number;
  retriedTransitions: number;
  cachedTransitions: number;
  avgTransitionTime: number;
  maxTransitionTime: number;
  minTransitionTime: number;
}

/**
 * Transition optimization report
 */
export interface TransitionOptimizationReport {
  optimizations: string[];
  cacheHitRate: number;
  recommendations: string[];
}

/**
 * Transition logger hook
 */
export function createTransitionLogger<TData = any>(
  logger: (message: string, data?: any) => void = console.log
): TransitionHook<TData> {
  return async (transition, context) => {
    logger('Transition executing', {
      from: context.current,
      to: transition.to,
      event: context.event,
      payload: context.payload,
    });
  };
}

/**
 * Transition metrics collector hook
 */
export function createMetricsCollector<TData = any>(
  metrics: Map<string, any>
): TransitionHook<TData> {
  return async (transition, context) => {
    const key = `${context.current}->${transition.to}`;
    const current = metrics.get(key) || { count: 0, totalTime: 0 };
    metrics.set(key, {
      count: current.count + 1,
      totalTime: current.totalTime,
    });
  };
}

/**
 * Transition validator hook
 */
export function createTransitionValidator<TData = any>(
  validators: Array<(transition: Transition<TData>, context: StateContext<TData>) => boolean>
): TransitionHook<TData> {
  return async (transition, context) => {
    for (const validator of validators) {
      if (!validator(transition, context)) {
        throw new TransitionError(
          'Transition validation failed',
          context,
          context.current,
          transition.to,
          context.event
        );
      }
    }
  };
}

/**
 * Transition rate limiter hook
 */
export class TransitionRateLimiter<TData = any> {
  private transitions: number[] = [];

  constructor(
    private maxTransitions: number,
    private windowMs: number
  ) {}

  createHook(): TransitionHook<TData> {
    return async () => {
      const now = Date.now();

      // Remove old transitions outside the window
      this.transitions = this.transitions.filter(
        t => now - t < this.windowMs
      );

      if (this.transitions.length >= this.maxTransitions) {
        throw new TransitionError(
          'Rate limit exceeded',
          { current: '', event: '', timestamp: now } as StateContext<TData>
        );
      }

      this.transitions.push(now);
    };
  }

  reset(): void {
    this.transitions = [];
  }
}

/**
 * Transition batch executor
 */
export class TransitionBatchExecutor<TData = any> {
  private queue: Array<{
    transition: Transition<TData>;
    context: StateContext<TData>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor(
    private handler: TransitionHandler<TData>,
    private batchSize: number = 10,
    private batchDelay: number = 10
  ) {}

  async execute(
    transition: Transition<TData>,
    context: StateContext<TData>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ transition, context, resolve, reject });

      if (this.queue.length >= this.batchSize) {
        this.processBatch();
      } else {
        setTimeout(() => this.processBatch(), this.batchDelay);
      }
    });
  }

  private async processBatch(): Promise<void> {
    const batch = this.queue.splice(0, this.batchSize);

    await Promise.all(
      batch.map(async ({ transition, context, resolve, reject }) => {
        try {
          const result = await this.handler.executeTransition(transition, context);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      })
    );
  }

  clear(): void {
    this.queue = [];
  }

  get pending(): number {
    return this.queue.length;
  }
}
