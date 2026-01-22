// @ts-nocheck
/**
 * Hook definitions and types
 */

import type { HookHandler, HookDefinition, PluginId } from '../types';
import { z } from 'zod';

/**
 * Core hook names
 */
export const CORE_HOOKS = {
  // Request/Response hooks
  BEFORE_REQUEST: 'beforeRequest',
  AFTER_RESPONSE: 'afterResponse',

  // Agent execution hooks
  BEFORE_AGENT_EXECUTION: 'beforeAgentExecution',
  AFTER_AGENT_EXECUTION: 'afterAgentExecution',

  // Code generation hooks
  ON_CODE_GENERATION: 'onCodeGeneration',
  ON_CODE_REVIEW: 'onCodeReview',
  ON_CODE_ANALYSIS: 'onCodeAnalysis',

  // Lifecycle hooks
  ON_PLUGIN_LOAD: 'onPluginLoad',
  ON_PLUGIN_ACTIVATE: 'onPluginActivate',
  ON_PLUGIN_DEACTIVATE: 'onPluginDeactivate',
  ON_PLUGIN_UNLOAD: 'onPluginUnload',
  ON_PLUGIN_ERROR: 'onPluginError',

  // Data hooks
  ON_DATA_READ: 'onDataRead',
  ON_DATA_WRITE: 'onDataWrite',
  ON_DATA_DELETE: 'onDataDelete',

  // Authentication hooks
  ON_AUTH_REQUEST: 'onAuthRequest',
  ON_AUTH_SUCCESS: 'onAuthSuccess',
  ON_AUTH_FAILURE: 'onAuthFailure',
} as const;

/**
 * Extension hook names
 */
export const EXTENSION_HOOKS = {
  // AI Provider hooks
  ON_AI_REQUEST: 'onAIRequest',
  ON_AI_RESPONSE: 'onAIResponse',
  ON_AI_STREAM: 'onAIStream',
  ON_AI_ERROR: 'onAIError',

  // Storage hooks
  ON_STORAGE_READ: 'onStorageRead',
  ON_STORAGE_WRITE: 'onStorageWrite',
  ON_STORAGE_DELETE: 'onStorageDelete',
  ON_STORAGE_QUERY: 'onStorageQuery',

  // Tool hooks
  ON_TOOL_EXECUTE: 'onToolExecute',
  ON_TOOL_RESULT: 'onToolResult',
  ON_TOOL_ERROR: 'onToolError',

  // Analytics hooks
  ON_ANALYTICS_EVENT: 'onAnalyticsEvent',
  ON_METRIC_RECORDED: 'onMetricRecorded',
} as const;

/**
 * All hook names
 */
export const ALL_HOOKS = {
  ...CORE_HOOKS,
  ...EXTENSION_HOOKS,
} as const;

export type HookName = typeof ALL_HOOKS[keyof typeof ALL_HOOKS];

/**
 * Hook registry
 */
export class HookRegistry {
  private hooks: Map<string, HookDefinition> = new Map();

  /**
   * Register a hook
   */
  registerHook(definition: Omit<HookDefinition, 'handlers'>): void {
    if (this.hooks.has(definition.name)) {
      throw new Error(`Hook ${definition.name} already registered`);
    }

    this.hooks.set(definition.name, {
      ...definition,
      handlers: new Map(),
    });
  }

  /**
   * Unregister a hook
   */
  unregisterHook(name: string): void {
    this.hooks.delete(name);
  }

  /**
   * Get hook definition
   */
  getHook(name: string): HookDefinition | undefined {
    return this.hooks.get(name);
  }

  /**
   * Check if hook exists
   */
  hasHook(name: string): boolean {
    return this.hooks.has(name);
  }

  /**
   * Get all hooks
   */
  getAllHooks(): Map<string, HookDefinition> {
    return new Map(this.hooks);
  }

  /**
   * Subscribe to a hook
   */
  subscribe(hookName: string, pluginId: PluginId, handler: HookHandler): void {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      throw new Error(`Hook ${hookName} not found`);
    }

    hook.handlers.set(`${pluginId}:${handler.name || 'anonymous'}`, handler);
  }

  /**
   * Unsubscribe from a hook
   */
  unsubscribe(hookName: string, pluginId: PluginId, handlerName?: string): void {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return;
    }

    if (handlerName) {
      hook.handlers.delete(`${pluginId}:${handlerName}`);
    } else {
      // Remove all handlers for this plugin
      for (const key of hook.handlers.keys()) {
        if (key.startsWith(`${pluginId}:`)) {
          hook.handlers.delete(key);
        }
      }
    }
  }

  /**
   * Get handlers for a hook
   */
  getHandlers(hookName: string): Map<string, HookHandler> {
    const hook = this.hooks.get(hookName);
    return hook ? new Map(hook.handlers) : new Map();
  }

  /**
   * Clear all handlers for a plugin
   */
  clearPluginHandlers(pluginId: PluginId): void {
    for (const hook of this.hooks.values()) {
      for (const key of hook.handlers.keys()) {
        if (key.startsWith(`${pluginId}:`)) {
          hook.handlers.delete(key);
        }
      }
    }
  }

  /**
   * Initialize default hooks
   */
  initializeDefaults(): void {
    // Register core hooks
    this.registerHook({
      name: CORE_HOOKS.BEFORE_REQUEST,
      description: 'Called before API request is sent',
      type: 'async',
      priority: 100,
      cancellable: true,
      mutable: true,
      dataSchema: z.object({
        method: z.string(),
        url: z.string(),
        headers: z.record(z.string()).optional(),
        body: z.any().optional(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.AFTER_RESPONSE,
      description: 'Called after API response is received',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        status: z.number(),
        headers: z.record(z.string()),
        body: z.any(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.BEFORE_AGENT_EXECUTION,
      description: 'Called before agent starts execution',
      type: 'async',
      priority: 100,
      cancellable: true,
      mutable: true,
      dataSchema: z.object({
        agentId: z.string(),
        agentType: z.string(),
        input: z.any(),
        config: z.record(z.any()).optional(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.AFTER_AGENT_EXECUTION,
      description: 'Called after agent completes execution',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        agentId: z.string(),
        agentType: z.string(),
        input: z.any(),
        output: z.any(),
        executionTime: z.number(),
        success: z.boolean(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_CODE_GENERATION,
      description: 'Called during code generation',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        prompt: z.string(),
        language: z.string(),
        partialCode: z.string().optional(),
        context: z.record(z.any()).optional(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_CODE_REVIEW,
      description: 'Called during code review',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        code: z.string(),
        language: z.string(),
        issues: z.array(z.any()).optional(),
        suggestions: z.array(z.any()).optional(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_CODE_ANALYSIS,
      description: 'Called during code analysis',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        code: z.string(),
        language: z.string(),
        filePath: z.string().optional(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_PLUGIN_LOAD,
      description: 'Called when a plugin is loaded',
      type: 'async',
      priority: 50,
      cancellable: false,
      mutable: false,
      dataSchema: z.object({
        pluginId: z.string(),
        pluginVersion: z.string(),
        pluginType: z.string(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_PLUGIN_ACTIVATE,
      description: 'Called when a plugin is activated',
      type: 'async',
      priority: 50,
      cancellable: false,
      mutable: false,
      dataSchema: z.object({
        pluginId: z.string(),
        pluginVersion: z.string(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_PLUGIN_DEACTIVATE,
      description: 'Called when a plugin is deactivated',
      type: 'async',
      priority: 50,
      cancellable: false,
      mutable: false,
      dataSchema: z.object({
        pluginId: z.string(),
        pluginVersion: z.string(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_PLUGIN_UNLOAD,
      description: 'Called when a plugin is unloaded',
      type: 'async',
      priority: 50,
      cancellable: false,
      mutable: false,
      dataSchema: z.object({
        pluginId: z.string(),
        pluginVersion: z.string(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_PLUGIN_ERROR,
      description: 'Called when a plugin encounters an error',
      type: 'async',
      priority: 50,
      cancellable: false,
      mutable: false,
      dataSchema: z.object({
        pluginId: z.string(),
        error: z.string(),
        stack: z.string().optional(),
        context: z.record(z.any()).optional(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_DATA_READ,
      description: 'Called when data is read',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        key: z.string(),
        value: z.any().optional(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_DATA_WRITE,
      description: 'Called when data is written',
      type: 'async',
      priority: 100,
      cancellable: true,
      mutable: true,
      dataSchema: z.object({
        key: z.string(),
        value: z.any(),
        ttl: z.number().optional(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_DATA_DELETE,
      description: 'Called when data is deleted',
      type: 'async',
      priority: 100,
      cancellable: true,
      mutable: false,
      dataSchema: z.object({
        key: z.string(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_AUTH_REQUEST,
      description: 'Called when authentication is requested',
      type: 'async',
      priority: 100,
      cancellable: true,
      mutable: true,
      dataSchema: z.object({
        method: z.string(),
        credentials: z.record(z.any()).optional(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_AUTH_SUCCESS,
      description: 'Called when authentication succeeds',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: false,
      dataSchema: z.object({
        userId: z.string(),
        method: z.string(),
        timestamp: z.date(),
      }),
    });

    this.registerHook({
      name: CORE_HOOKS.ON_AUTH_FAILURE,
      description: 'Called when authentication fails',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        method: z.string(),
        reason: z.string(),
        timestamp: z.date(),
      }),
    });

    // Register extension hooks
    this.registerHook({
      name: EXTENSION_HOOKS.ON_AI_REQUEST,
      description: 'Called when AI request is made',
      type: 'async',
      priority: 100,
      cancellable: true,
      mutable: true,
      dataSchema: z.object({
        provider: z.string(),
        model: z.string(),
        prompt: z.string(),
        parameters: z.record(z.any()).optional(),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_AI_RESPONSE,
      description: 'Called when AI response is received',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        provider: z.string(),
        model: z.string(),
        response: z.any(),
        duration: z.number(),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_AI_STREAM,
      description: 'Called for each chunk in AI streaming response',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        provider: z.string(),
        model: z.string(),
        chunk: z.string(),
        index: z.number(),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_AI_ERROR,
      description: 'Called when AI request fails',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        provider: z.string(),
        model: z.string(),
        error: z.string(),
        code: z.string().optional(),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_STORAGE_READ,
      description: 'Called when storage is read',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        backend: z.string(),
        key: z.string(),
        value: z.any().optional(),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_STORAGE_WRITE,
      description: 'Called when storage is written',
      type: 'async',
      priority: 100,
      cancellable: true,
      mutable: true,
      dataSchema: z.object({
        backend: z.string(),
        key: z.string(),
        value: z.any(),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_STORAGE_DELETE,
      description: 'Called when storage is deleted',
      type: 'async',
      priority: 100,
      cancellable: true,
      mutable: false,
      dataSchema: z.object({
        backend: z.string(),
        key: z.string(),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_STORAGE_QUERY,
      description: 'Called when storage is queried',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        backend: z.string(),
        query: z.record(z.any()),
        results: z.array(z.any()),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_TOOL_EXECUTE,
      description: 'Called when a tool is executed',
      type: 'async',
      priority: 100,
      cancellable: true,
      mutable: true,
      dataSchema: z.object({
        toolName: z.string(),
        parameters: z.record(z.any()),
        context: z.record(z.any()).optional(),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_TOOL_RESULT,
      description: 'Called when a tool returns a result',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        toolName: z.string(),
        result: z.any(),
        duration: z.number(),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_TOOL_ERROR,
      description: 'Called when a tool encounters an error',
      type: 'async',
      priority: 100,
      cancellable: false,
      mutable: true,
      dataSchema: z.object({
        toolName: z.string(),
        error: z.string(),
        parameters: z.record(z.any()),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_ANALYTICS_EVENT,
      description: 'Called when an analytics event is recorded',
      type: 'async',
      priority: 50,
      cancellable: false,
      mutable: false,
      dataSchema: z.object({
        eventName: z.string(),
        properties: z.record(z.any()),
        userId: z.string().optional(),
        timestamp: z.date(),
      }),
    });

    this.registerHook({
      name: EXTENSION_HOOKS.ON_METRIC_RECORDED,
      description: 'Called when a metric is recorded',
      type: 'async',
      priority: 50,
      cancellable: false,
      mutable: false,
      dataSchema: z.object({
        metricName: z.string(),
        value: z.number(),
        tags: z.record(z.string()).optional(),
      }),
    });
  }
}

/**
 * Global hook registry instance
 */
export const globalHookRegistry = new HookRegistry();

// Initialize default hooks
globalHookRegistry.initializeDefaults();
