/**
 * Hierarchical Rate Limit Manager
 *
 * Manages multi-level rate limits with inheritance and priority.
 * Supports global, per-user, per-resource, per-endpoint, and custom limits.
 */

import type {
  RateLimitResult,
  RateLimitConfig,
  HierarchicalLimit,
  RateLimitContext,
  RateLimitState
} from '../types/index.js';
import { AlgorithmEngine } from '../algorithms/engine.js';
import type { StorageBackend } from '../storage/index.js';

/**
 * Priority level for hierarchical limits
 */
export enum LimitPriority {
  GLOBAL = 0,
  PER_API_KEY = 10,
  PER_USER = 20,
  PER_RESOURCE = 30,
  PER_ENDPOINT = 40,
  CUSTOM = 50
}

/**
 * Hierarchical limit entry
 */
interface LimitEntry {
  config: RateLimitConfig;
  priority: LimitPriority;
  key: string;
}

/**
 * Hierarchy manager configuration
 */
export interface HierarchyManagerConfig {
  global?: RateLimitConfig;
  perUser?: RateLimitConfig;
  perResource?: RateLimitConfig;
  perEndpoint?: RateLimitConfig;
  perApiKey?: RateLimitConfig;
  custom?: Record<string, RateLimitConfig>;
  strictMode?: boolean; // If true, all limits must pass
  priority?: LimitPriority[]; // Order of limit checking
}

/**
 * Hierarchical rate limit manager
 */
export class HierarchyManager {
  private limits: Map<string, LimitEntry>;
  private storage: StorageBackend;
  private algorithmEngine: AlgorithmEngine;
  private strictMode: boolean;
  private priority: LimitPriority[];

  constructor(
    config: HierarchyManagerConfig,
    storage: StorageBackend
  ) {
    this.limits = new Map();
    this.storage = storage;
    this.algorithmEngine = new AlgorithmEngine();
    this.strictMode = config.strictMode ?? false;
    this.priority = config.priority ?? [
      LimitPriority.GLOBAL,
      LimitPriority.PER_API_KEY,
      LimitPriority.PER_USER,
      LimitPriority.PER_RESOURCE,
      LimitPriority.PER_ENDPOINT,
      LimitPriority.CUSTOM
    ];

    // Register configured limits
    this.registerLimits(config);
  }

  /**
   * Register hierarchical limits
   */
  private registerLimits(config: HierarchyManagerConfig): void {
    if (config.global) {
      this.addLimit('global', config.global, LimitPriority.GLOBAL);
    }

    if (config.perUser) {
      this.addLimit('user', config.perUser, LimitPriority.PER_USER);
    }

    if (config.perResource) {
      this.addLimit('resource', config.perResource, LimitPriority.PER_RESOURCE);
    }

    if (config.perEndpoint) {
      this.addLimit('endpoint', config.perEndpoint, LimitPriority.PER_ENDPOINT);
    }

    if (config.perApiKey) {
      this.addLimit('api_key', config.perApiKey, LimitPriority.PER_API_KEY);
    }

    if (config.custom) {
      for (const [name, limitConfig] of Object.entries(config.custom)) {
        this.addLimit(name, limitConfig, LimitPriority.CUSTOM);
      }
    }
  }

  /**
   * Add a limit
   */
  addLimit(
    name: string,
    config: RateLimitConfig,
    priority: LimitPriority
  ): void {
    this.limits.set(name, {
      config,
      priority,
      key: name
    });
  }

  /**
   * Remove a limit
   */
  removeLimit(name: string): boolean {
    return this.limits.delete(name);
  }

  /**
   * Get a limit
   */
  getLimit(name: string): LimitEntry | undefined {
    return this.limits.get(name);
  }

  /**
   * Update a limit
   */
  updateLimit(name: string, config: Partial<RateLimitConfig>): boolean {
    const entry = this.limits.get(name);

    if (!entry) {
      return false;
    }

    entry.config = { ...entry.config, ...config };
    return true;
  }

  /**
   * Check all hierarchical limits
   */
  async check(context: RateLimitContext): Promise<RateLimitResult> {
    const limits = this.getOrderedLimits();
    const results: RateLimitResult[] = [];

    // Check each limit in priority order
    for (const entry of limits) {
      const key = this.getLimitKey(entry, context);
      const state = await this.storage.get(key);

      const result = await this.algorithmEngine.check(
        entry.config,
        state,
        context
      );

      results.push(result);

      // Update state in storage
      if (result.allowed) {
        const newState = state || this.algorithmEngine.reset(entry.config);
        await this.storage.set(key, newState);
      }

      // If strict mode is disabled and a limit failed, return early
      if (!this.strictMode && !result.allowed) {
        return this.aggregateResults(results, entry);
      }

      // If strict mode is enabled and a limit failed, continue checking
      // but return failure at the end
    }

    return this.aggregateResults(results, null);
  }

  /**
   * Get ordered limits by priority
   */
  private getOrderedLimits(): LimitEntry[] {
    const entries = Array.from(this.limits.values());

    return entries.sort((a, b) => {
      const aIndex = this.priority.indexOf(a.priority);
      const bIndex = this.priority.indexOf(b.priority);

      return aIndex - bIndex;
    });
  }

  /**
   * Get storage key for a limit
   */
  private getLimitKey(entry: LimitEntry, context: RateLimitContext): string {
    const parts = ['limit', entry.key];

    switch (entry.priority) {
      case LimitPriority.GLOBAL:
        break;

      case LimitPriority.PER_USER:
        if (context.userId) {
          parts.push(context.userId);
        }
        break;

      case LimitPriority.PER_RESOURCE:
        if (context.resource) {
          parts.push(context.resource);
        }
        break;

      case LimitPriority.PER_ENDPOINT:
        if (context.endpoint) {
          parts.push(context.endpoint);
        }
        break;

      case LimitPriority.PER_API_KEY:
        if (context.apiKey) {
          parts.push(context.apiKey);
        }
        break;

      case LimitPriority.CUSTOM:
        if (context.identifier) {
          parts.push(context.identifier);
        }
        break;
    }

    return parts.join(':');
  }

  /**
   * Aggregate multiple limit results
   */
  private aggregateResults(
    results: RateLimitResult[],
    failedEntry: LimitEntry | null
  ): RateLimitResult {
    if (results.length === 0) {
      return {
        allowed: true,
        limit: 0,
        remaining: 0,
        reset: Date.now()
      };
    }

    // If any limit failed and we're not in strict mode, return failure
    if (failedEntry && !this.strictMode) {
      const failedResult = results[results.length - 1];
      return {
        ...failedResult,
        metadata: {
          ...failedResult.metadata,
          limitType: failedEntry.key,
          limitPriority: failedEntry.priority
        }
      };
    }

    // In strict mode, all limits must pass
    if (this.strictMode) {
      const failed = results.find(r => !r.allowed);
      if (failed) {
        return failed;
      }
    }

    // All limits passed, return most restrictive result
    const mostRestrictive = results.reduce((min, result) => {
      return result.remaining < min.remaining ? result : min;
    });

    return {
      allowed: true,
      limit: mostRestrictive.limit,
      remaining: mostRestrictive.remaining,
      reset: mostRestrictive.reset,
      metadata: {
        ...mostRestrictive.metadata,
        limitsChecked: results.length,
        hierarchyEnabled: true
      }
    };
  }

  /**
   * Get limit for specific level
   */
  async checkLevel(
    level: LimitPriority,
    context: RateLimitContext
  ): Promise<RateLimitResult> {
    const entry = Array.from(this.limits.values()).find(
      e => e.priority === level
    );

    if (!entry) {
      // No limit configured for this level
      return {
        allowed: true,
        limit: Number.MAX_SAFE_INTEGER,
        remaining: Number.MAX_SAFE_INTEGER,
        reset: Date.now()
      };
    }

    const key = this.getLimitKey(entry, context);
    const state = await this.storage.get(key);

    return this.algorithmEngine.check(entry.config, state, context);
  }

  /**
   * Reset all limits for a context
   */
  async reset(context: RateLimitContext): Promise<void> {
    const limits = this.getOrderedLimits();

    for (const entry of limits) {
      const key = this.getLimitKey(entry, context);
      await this.storage.delete(key);
    }
  }

  /**
   * Reset specific limit level
   */
  async resetLevel(level: LimitPriority, context: RateLimitContext): Promise<void> {
    const entry = Array.from(this.limits.values()).find(
      e => e.priority === level
    );

    if (!entry) {
      return;
    }

    const key = this.getLimitKey(entry, context);
    await this.storage.delete(key);
  }

  /**
   * Get usage statistics for a context
   */
  async getUsage(context: RateLimitContext): Promise<Record<string, RateLimitResult>> {
    const limits = this.getOrderedLimits();
    const usage: Record<string, RateLimitResult> = {};

    for (const entry of limits) {
      const key = this.getLimitKey(entry, context);
      const state = await this.storage.get(key);

      const result = await this.algorithmEngine.check(
        entry.config,
        state,
        context
      );

      usage[entry.key] = result;
    }

    return usage;
  }

  /**
   * Get all configured limits
   */
  getAllLimits(): Map<string, LimitEntry> {
    return new Map(this.limits);
  }

  /**
   * Get limits by priority
   */
  getLimitsByPriority(priority: LimitPriority): LimitEntry[] {
    return Array.from(this.limits.values()).filter(
      entry => entry.priority === priority
    );
  }

  /**
   * Enable/disable strict mode
   */
  setStrictMode(enabled: boolean): void {
    this.strictMode = enabled;
  }

  /**
   * Set priority order
   */
  setPriority(priority: LimitPriority[]): void {
    this.priority = priority;
  }

  /**
   * Export hierarchy configuration
   */
  exportConfig(): HierarchyManagerConfig {
    const config: HierarchyManagerConfig = {
      strictMode: this.strictMode,
      priority: this.priority,
      custom: {}
    };

    for (const entry of this.limits.values()) {
      switch (entry.priority) {
        case LimitPriority.GLOBAL:
          config.global = entry.config;
          break;

        case LimitPriority.PER_USER:
          config.perUser = entry.config;
          break;

        case LimitPriority.PER_RESOURCE:
          config.perResource = entry.config;
          break;

        case LimitPriority.PER_ENDPOINT:
          config.perEndpoint = entry.config;
          break;

        case LimitPriority.PER_API_KEY:
          config.perApiKey = entry.config;
          break;

        case LimitPriority.CUSTOM:
          if (!config.custom) {
            config.custom = {};
          }
          config.custom[entry.key] = entry.config;
          break;
      }
    }

    return config;
  }

  /**
   * Import hierarchy configuration
   */
  importConfig(config: HierarchyManagerConfig): void {
    // Clear existing limits
    this.limits.clear();

    // Import new limits
    this.registerLimits(config);

    // Update settings
    if (config.strictMode !== undefined) {
      this.strictMode = config.strictMode;
    }

    if (config.priority) {
      this.priority = config.priority;
    }
  }

  /**
   * Validate hierarchy configuration
   */
  validateConfig(config: HierarchyManagerConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for circular dependencies
    // (This is a simplified check)

    // Check for invalid priorities
    if (config.priority) {
      const hasDuplicates = new Set(config.priority).size !== config.priority.length;
      if (hasDuplicates) {
        errors.push('Duplicate priorities found in priority array');
      }
    }

    // Check for missing required fields
    for (const [name, limitConfig] of Object.entries(config.custom || {})) {
      if (!limitConfig.limit || !limitConfig.window) {
        errors.push(`Invalid limit configuration for custom limit '${name}'`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get hierarchy statistics
   */
  getStats(): {
    totalLimits: number;
    strictMode: boolean;
    priorityLevels: number;
    limitsByPriority: Record<string, number>;
  } {
    const limitsByPriority: Record<string, number> = {};

    for (const entry of this.limits.values()) {
      const priorityName = LimitPriority[entry.priority];
      limitsByPriority[priorityName] = (limitsByPriority[priorityName] || 0) + 1;
    }

    return {
      totalLimits: this.limits.size,
      strictMode: this.strictMode,
      priorityLevels: this.priority.length,
      limitsByPriority
    };
  }
}

export { LimitPriority };
