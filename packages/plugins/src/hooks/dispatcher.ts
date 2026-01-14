/**
 * Hook dispatcher - executes hook handlers
 */

import type {
  HookContext,
  HookHandler,
  PluginId,
} from '../types';
import { HookError, HookValidationError } from '../types/errors';
import { globalHookRegistry } from './definitions';
import { z } from 'zod';

/**
 * Hook execution result
 */
export interface HookResult {
  hookName: string;
  cancelled: boolean;
  modified: boolean;
  data: unknown;
  errors: Error[];
  executionTime: number;
  handlersExecuted: number;
  handlersSkipped: number;
}

/**
 * Hook execution options
 */
export interface HookExecutionOptions {
  /**
   * Stop on first error
   */
  stopOnError?: boolean;

  /**
   * Maximum execution time per handler (ms)
   */
  timeout?: number;

  /**
   * Parallel execution (for async hooks)
   */
  parallel?: boolean;

  /**
   * Validate data against schema
   */
  validate?: boolean;

  /**
   * Metadata to include in hook context
   */
  metadata?: Record<string, unknown>;
}

/**
 * Hook dispatcher
 */
export class HookDispatcher {
  constructor(
    private registry = globalHookRegistry
  ) {}

  /**
   * Dispatch a hook
   */
  async dispatch(
    hookName: string,
    sourcePlugin: PluginId,
    data: unknown,
    options: HookExecutionOptions = {}
  ): Promise<HookResult> {
    const startTime = Date.now();
    const errors: Error[] = [];
    let cancelled = false;
    let modified = false;
    let handlersExecuted = 0;
    let handlersSkipped = 0;

    try {
      // Get hook definition
      const hook = this.registry.getHook(hookName);
      if (!hook) {
        throw new HookError(
          hookName,
          sourcePlugin,
          `Hook ${hookName} not found`
        );
      }

      // Validate data if requested
      if (options.validate && hook.dataSchema) {
        try {
          data = hook.dataSchema.parse(data);
        } catch (error) {
          const validationErrors = (error as z.ZodError).errors.map(
            (e) => `${e.path.join('.')}: ${e.message}`
          );
          throw new HookValidationError(
            hookName,
            `Data validation failed for hook ${hookName}`,
            validationErrors
          );
        }
      }

      // Get handlers sorted by priority
      const handlers = this.getSortedHandlers(hook);

      // Create hook context
      const context = this.createHookContext(
        hookName,
        sourcePlugin,
        data,
        options.metadata || {}
      );

      // Execute handlers
      for (const [key, handler] of handlers) {
        try {
          // Check if cancelled
          if (cancelled && !hook.cancellable) {
            handlersSkipped++;
            continue;
          }

          // Execute handler with timeout
          await this.executeHandler(
            handler,
            context,
            options.timeout
          );

          handlersExecuted++;

          // Check if cancelled
          if (context.isCancelled()) {
            if (hook.cancellable) {
              cancelled = true;
            } else {
              errors.push(
                new HookError(
                  hookName,
                  sourcePlugin,
                  `Hook ${hookName} does not support cancellation`
                )
              );
            }
          }

          // Check if modified
          if (context.isModified()) {
            if (hook.mutable) {
              modified = true;
              data = context.getModifiedData();
            } else {
              errors.push(
                new HookError(
                  hookName,
                  sourcePlugin,
                  `Hook ${hookName} does not support data modification`
                )
              );
            }
          }

          // Stop on error if requested
          if (options.stopOnError && errors.length > 0) {
            break;
          }
        } catch (error) {
          errors.push(error as Error);
          handlersExecuted++;

          if (options.stopOnError) {
            break;
          }
        }
      }

      return {
        hookName,
        cancelled,
        modified,
        data,
        errors,
        executionTime: Date.now() - startTime,
        handlersExecuted,
        handlersSkipped,
      };
    } catch (error) {
      errors.push(error as Error);
      return {
        hookName,
        cancelled,
        modified,
        data,
        errors,
        executionTime: Date.now() - startTime,
        handlersExecuted,
        handlersSkipped,
      };
    }
  }

  /**
   * Dispatch hook synchronously
   */
  dispatchSync(
    hookName: string,
    sourcePlugin: PluginId,
    data: unknown,
    options: HookExecutionOptions = {}
  ): HookResult {
    const startTime = Date.now();
    const errors: Error[] = [];
    let cancelled = false;
    let modified = false;
    let handlersExecuted = 0;
    let handlersSkipped = 0;

    try {
      // Get hook definition
      const hook = this.registry.getHook(hookName);
      if (!hook) {
        throw new HookError(
          hookName,
          sourcePlugin,
          `Hook ${hookName} not found`
        );
      }

      if (hook.type !== 'sync') {
        throw new HookError(
          hookName,
          sourcePlugin,
          `Hook ${hookName} is not synchronous`
        );
      }

      // Validate data if requested
      if (options.validate && hook.dataSchema) {
        try {
          data = hook.dataSchema.parse(data);
        } catch (error) {
          const validationErrors = (error as z.ZodError).errors.map(
            (e) => `${e.path.join('.')}: ${e.message}`
          );
          throw new HookValidationError(
            hookName,
            `Data validation failed for hook ${hookName}`,
            validationErrors
          );
        }
      }

      // Get handlers sorted by priority
      const handlers = this.getSortedHandlers(hook);

      // Create hook context
      const context = this.createHookContext(
        hookName,
        sourcePlugin,
        data,
        options.metadata || {}
      );

      // Execute handlers
      for (const [key, handler] of handlers) {
        try {
          // Check if cancelled
          if (cancelled && !hook.cancellable) {
            handlersSkipped++;
            continue;
          }

          // Execute handler
          (handler as (...args: unknown[]) => void)(context);

          handlersExecuted++;

          // Check if cancelled
          if (context.isCancelled()) {
            if (hook.cancellable) {
              cancelled = true;
            } else {
              errors.push(
                new HookError(
                  hookName,
                  sourcePlugin,
                  `Hook ${hookName} does not support cancellation`
                )
              );
            }
          }

          // Check if modified
          if (context.isModified()) {
            if (hook.mutable) {
              modified = true;
              data = context.getModifiedData();
            } else {
              errors.push(
                new HookError(
                  hookName,
                  sourcePlugin,
                  `Hook ${hookName} does not support data modification`
                )
              );
            }
          }

          // Stop on error if requested
          if (options.stopOnError && errors.length > 0) {
            break;
          }
        } catch (error) {
          errors.push(error as Error);
          handlersExecuted++;

          if (options.stopOnError) {
            break;
          }
        }
      }

      return {
        hookName,
        cancelled,
        modified,
        data,
        errors,
        executionTime: Date.now() - startTime,
        handlersExecuted,
        handlersSkipped,
      };
    } catch (error) {
      errors.push(error as Error);
      return {
        hookName,
        cancelled,
        modified,
        data,
        errors,
        executionTime: Date.now() - startTime,
        handlersExecuted,
        handlersSkipped,
      };
    }
  }

  /**
   * Get sorted handlers
   */
  private getSortedHandlers(
    hook: { priority: number; handlers: Map<string, HookHandler> }
  ): [string, HookHandler][] {
    return Array.from(hook.handlers.entries()).sort(([, a], [, b]) => {
      // Sort by priority (higher first)
      const priorityDiff = hook.priority - hook.priority;
      if (priorityDiff !== 0) return priorityDiff;

      // Then by name (for consistency)
      return a.name > b.name ? 1 : -1;
    });
  }

  /**
   * Create hook context
   */
  private createHookContext(
    hookName: string,
    sourcePlugin: PluginId,
    data: unknown,
    metadata: Record<string, unknown>
  ): HookContextImpl {
    return new HookContextImpl(hookName, sourcePlugin, data, metadata);
  }

  /**
   * Execute handler with timeout
   */
  private async executeHandler(
    handler: HookHandler,
    context: HookContext,
    timeout?: number
  ): Promise<void> {
    if (!timeout) {
      return handler(context);
    }

    return Promise.race([
      handler(context),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`Hook handler timeout after ${timeout}ms`)
            ),
          timeout
        )
      ),
    ]);
  }
}

/**
 * Hook context implementation
 */
class HookContextImpl implements HookContext {
  private _cancelled = false;
  private _modified = false;
  private _modifiedData?: unknown;

  constructor(
    public readonly hookName: string,
    public readonly sourcePlugin: PluginId,
    public readonly data: unknown,
    public readonly metadata: Record<string, unknown>,
    public readonly timestamp: Date = new Date()
  ) {}

  cancel(): void {
    this._cancelled = true;
  }

  isCancelled(): boolean {
    return this._cancelled;
  }

  modify(data: unknown): void {
    this._modified = true;
    this._modifiedData = data;
  }

  isModified(): boolean {
    return this._modified;
  }

  getModifiedData(): unknown {
    return this._modifiedData;
  }

  toJSON(): Record<string, unknown> {
    return {
      hookName: this.hookName,
      sourcePlugin: this.sourcePlugin,
      timestamp: this.timestamp,
      data: this.data,
      metadata: this.metadata,
      cancelled: this._cancelled,
      modified: this._modified,
      modifiedData: this._modifiedData,
    };
  }
}

/**
 * Global hook dispatcher instance
 */
export const globalHookDispatcher = new HookDispatcher();

/**
 * Convenience function to dispatch a hook
 */
export async function dispatchHook(
  hookName: string,
  sourcePlugin: PluginId,
  data: unknown,
  options?: HookExecutionOptions
): Promise<HookResult> {
  return globalHookDispatcher.dispatch(hookName, sourcePlugin, data, options);
}

/**
 * Convenience function to dispatch a hook synchronously
 */
export function dispatchHookSync(
  hookName: string,
  sourcePlugin: PluginId,
  data: unknown,
  options?: HookExecutionOptions
): HookResult {
  return globalHookDispatcher.dispatchSync(hookName, sourcePlugin, data, options);
}
