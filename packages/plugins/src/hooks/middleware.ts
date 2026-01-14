/**
 * Hook middleware system
 */

import type { HookContext, HookHandler, PluginId } from '../types';
import { HookResult } from './dispatcher';

/**
 * Middleware function
 */
export type HookMiddleware = (
  context: HookContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Middleware stack
 */
export class MiddlewareStack {
  private middlewares: HookMiddleware[] = [];

  /**
   * Add middleware
   */
  use(middleware: HookMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Remove middleware
   */
  remove(middleware: HookMiddleware): void {
    const index = this.middlewares.indexOf(middleware);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
    }
  }

  /**
   * Execute middleware stack
   */
  async execute(
    context: HookContext,
    handler: HookHandler
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware(context, next);
      } else {
        await handler(context);
      }
    };

    await next();
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middlewares = [];
  }

  /**
   * Get middleware count
   */
  size(): number {
    return this.middlewares.length;
  }
}

/**
 * Built-in middleware factories
 */
export const Middleware = {
  /**
   * Logging middleware
   */
  logging(logger?: { info: (msg: string, ...args: unknown[]) => void }): HookMiddleware {
    return async (context, next) => {
      const startTime = Date.now();

      (logger || console).info(
        `[Hook] ${context.hookName} from ${context.sourcePlugin}`
      );

      try {
        await next();
        const duration = Date.now() - startTime;
        (logger || console).info(
          `[Hook] ${context.hookName} completed in ${duration}ms`
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        (logger || console).error(
          `[Hook] ${context.hookName} failed after ${duration}ms:`,
          error
        );
        throw error;
      }
    };
  },

  /**
   * Timing middleware
   */
  timing(timings: Map<string, number[]> = new Map()): HookMiddleware {
    return async (context, next) => {
      const startTime = Date.now();

      try {
        await next();
      } finally {
        const duration = Date.now() - startTime;

        if (!timings.has(context.hookName)) {
          timings.set(context.hookName, []);
        }
        timings.get(context.hookName)!.push(duration);
      }
    };
  },

  /**
   * Error handling middleware
   */
  errorHandling(handler: (error: Error, context: HookContext) => void | Promise<void>): HookMiddleware {
    return async (context, next) => {
      try {
        await next();
      } catch (error) {
        await handler(error as Error, context);
        throw error; // Re-throw to maintain error propagation
      }
    };
  },

  /**
   * Retry middleware
   */
  retry(maxRetries = 3, delay = 100): HookMiddleware {
    return async (context, next) => {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await next();
          return; // Success
        } catch (error) {
          lastError = error as Error;

          if (attempt < maxRetries) {
            // Wait before retry with exponential backoff
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
   * Rate limiting middleware
   */
  rateLimit(maxCalls: number, perMs: number): HookMiddleware {
    const calls: number[] = [];

    return async (context, next) => {
      const now = Date.now();

      // Remove old calls outside the window
      const cutoff = now - perMs;
      while (calls.length > 0 && calls[0] < cutoff) {
        calls.shift();
      }

      // Check if limit exceeded
      if (calls.length >= maxCalls) {
        throw new Error(
          `Rate limit exceeded for hook ${context.hookName}: ${maxCalls} calls per ${perMs}ms`
        );
      }

      calls.push(now);

      await next();
    };
  },

  /**
   * Caching middleware
   */
  cache(cache: Map<string, { value: unknown; expires: number }>, ttl = 5000): HookMiddleware {
    return async (context, next) => {
      const key = `${context.hookName}:${JSON.stringify(context.data)}`;
      const cached = cache.get(key);

      if (cached && cached.expires > Date.now()) {
        context.modify(cached.value);
        return;
      }

      await next();

      if (context.isModified()) {
        cache.set(key, {
          value: (context as any).getModifiedData(),
          expires: Date.now() + ttl,
        });
      }
    };
  },

  /**
   * Validation middleware
   */
  validation(validator: (data: unknown) => boolean | Promise<boolean>, errorMessage = 'Validation failed'): HookMiddleware {
    return async (context, next) => {
      const isValid = await validator(context.data);

      if (!isValid) {
        throw new Error(`${errorMessage} for hook ${context.hookName}`);
      }

      await next();
    };
  },

  /**
   * Transformation middleware
   */
  transform(transformer: (data: unknown) => unknown | Promise<unknown>): HookMiddleware {
    return async (context, next) => {
      const transformedData = await transformer(context.data);
      context.modify(transformedData);

      await next();
    };
  },

  /**
   * Filter middleware
   */
  filter(filter: (context: HookContext) => boolean | Promise<boolean>): HookMiddleware {
    return async (context, next) => {
      const shouldExecute = await filter(context);

      if (!shouldExecute) {
        context.cancel();
        return;
      }

      await next();
    };
  },

  /**
   * Timeout middleware
   */
  timeout(ms: number): HookMiddleware {
    return async (context, next) => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Hook ${context.hookName} timeout after ${ms}ms`)), ms)
      );

      await Promise.race([next(), timeoutPromise]);
    };
  },

  /**
   * Metrics middleware
   */
  metrics(metrics: {
    increment: (name: string, value?: number) => void;
    timing: (name: string, value: number) => void;
  }): HookMiddleware {
    return async (context, next) => {
      const startTime = Date.now();

      try {
        await next();
        metrics.increment(`hook.${context.hookName}.success`);
        metrics.timing(`hook.${context.hookName}.duration`, Date.now() - startTime);
      } catch (error) {
        metrics.increment(`hook.${context.hookName}.error`);
        metrics.timing(`hook.${context.hookName}.duration`, Date.now() - startTime);
        throw error;
      }
    };
  },

  /**
   * Conditional middleware
   */
  conditional(
    condition: (context: HookContext) => boolean | Promise<boolean>,
    middleware: HookMiddleware
  ): HookMiddleware {
    return async (context, next) => {
      const shouldApply = await condition(context);

      if (shouldApply) {
        await middleware(context, next);
      } else {
        await next();
      }
    };
  },

  /**
   * Composite middleware (combines multiple)
   */
  compose(...middlewares: HookMiddleware[]): HookMiddleware {
    return async (context, next) => {
      let index = 0;

      const composeNext = async (): Promise<void> => {
        if (index < middlewares.length) {
          await middlewares[index++](context, composeNext);
        } else {
          await next();
        }
      };

      await composeNext();
    };
  },
};

/**
 * Global middleware stack for hooks
 */
export const globalHookMiddleware = new MiddlewareStack();

/**
 * Add default middleware
 */
export function setupDefaultMiddleware(): void {
  // Add timing middleware
  const timings = new Map<string, number[]>();
  globalHookMiddleware.use(Middleware.timing(timings));

  // Add error handling middleware
  globalHookMiddleware.use(
    Middleware.errorHandling((error, context) => {
      console.error(`[Hook Error] ${context.hookName}:`, error);
    })
  );
}
