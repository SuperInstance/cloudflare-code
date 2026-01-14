import {
  FallbackConfig,
  FallbackFunction,
  FallbackPriority,
  ExecutionContext,
  ExecutionResultData,
  ExecutionResult,
} from '../types/index.js';

/**
 * Fallback execution result
 */
interface FallbackExecutionResult<T> {
  /** Whether fallback was successful */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: Error;
  /** Fallback name that was used */
  fallbackName: string;
  /** Execution duration */
  duration: number;
}

/**
 * Fallback usage statistics
 */
interface FallbackStats {
  /** Total times used */
  totalUses: number;
  /** Successful uses */
  successfulUses: number;
  /** Failed uses */
  failedUses: number;
  /** Last used timestamp */
  lastUsed: number;
  /** Average duration */
  averageDuration: number;
}

/**
 * Advanced Fallback Manager
 * Manages fallback chains with priority, caching, and degradation modes
 */
export class FallbackManager {
  private fallbacks: Map<string, FallbackConfig>;
  private fallbackStats: Map<string, FallbackStats>;
  private fallbackCache: Map<string, { data: unknown; expiry: number }>;
  private globalFallbacks: FallbackConfig[];
  private enabled: boolean;
  private cacheEnabled: boolean;
  private cacheTtlMs: number;
  private maxCacheSize: number;

  constructor() {
    this.fallbacks = new Map();
    this.fallbackStats = new Map();
    this.fallbackCache = new Map();
    this.globalFallbacks = [];
    this.enabled = true;
    this.cacheEnabled = true;
    this.cacheTtlMs = 60000; // 1 minute default
    this.maxCacheSize = 100;
  }

  /**
   * Register a fallback handler
   */
  register<T>(fallback: FallbackConfig<T>): void {
    this.fallbacks.set(fallback.name, fallback);
    this.fallbackStats.set(fallback.name, {
      totalUses: 0,
      successfulUses: 0,
      failedUses: 0,
      lastUsed: 0,
      averageDuration: 0,
    });
  }

  /**
   * Unregister a fallback handler
   */
  unregister(name: string): void {
    this.fallbacks.delete(name);
    this.fallbackStats.delete(name);
  }

  /**
   * Execute fallback chain
   */
  async execute<T>(
    context: ExecutionContext,
    primaryError?: Error,
    customFallbacks?: FallbackConfig<T>[]
  ): Promise<ExecutionResultData<T>> {
    if (!this.enabled) {
      return {
        status: ExecutionResult.FAILURE,
        error: primaryError || new Error('Fallbacks are disabled'),
        duration: 0,
        usedFallback: false,
        context,
        timestamp: Date.now(),
      };
    }

    // Build fallback chain
    const chain = this.buildFallbackChain(customFallbacks);

    // Try each fallback in order
    for (const fallback of chain) {
      if (!fallback.enabled) continue;

      // Check max uses
      const stats = this.fallbackStats.get(fallback.name);
      if (stats && fallback.maxUses && stats.totalUses >= fallback.maxUses) {
        continue;
      }

      // Check condition
      if (primaryError && fallback.condition && !fallback.condition(primaryError)) {
        continue;
      }

      // Check cache
      const cacheKey = this.getCacheKey(fallback.name, context);
      if (this.cacheEnabled) {
        const cached = this.getFromCache<T>(cacheKey);
        if (cached !== null) {
          return {
            status: ExecutionResult.FALLBACK_SUCCESS,
            data: cached,
            duration: 0,
            usedFallback: true,
            fallbackName: fallback.name,
            context,
            timestamp: Date.now(),
          };
        }
      }

      // Execute fallback
      const result = await this.executeFallback<T>(fallback, context, primaryError);

      // Update stats
      this.updateStats(fallback.name, result);

      if (result.success) {
        // Cache result
        if (this.cacheEnabled && result.data !== undefined) {
          this.setCache(cacheKey, result.data);
        }

        return {
          status: ExecutionResult.FALLBACK_SUCCESS,
          data: result.data,
          duration: result.duration,
          usedFallback: true,
          fallbackName: result.fallbackName,
          context,
          timestamp: Date.now(),
        };
      }
    }

    // All fallbacks failed
    return {
      status: ExecutionResult.FALLBACK_FAILURE,
      error: new Error('All fallbacks failed'),
      duration: 0,
      usedFallback: false,
      context,
      timestamp: Date.now(),
    };
  }

  /**
   * Build fallback chain from global, registered, and custom fallbacks
   */
  private buildFallbackChain<T>(customFallbacks?: FallbackConfig<T>[]): FallbackConfig<T>[] {
    const chain: FallbackConfig<T>[] = [];

    // Add global fallbacks
    chain.push(...(this.globalFallbacks as FallbackConfig<T>[]));

    // Add registered fallbacks
    chain.push(
      ...Array.from(this.fallbacks.values()).filter((f) => f.enabled) as FallbackConfig<T>[]
    );

    // Add custom fallbacks
    if (customFallbacks) {
      chain.push(...customFallbacks.filter((f) => f.enabled));
    }

    // Sort by priority
    chain.sort((a, b) => a.priority - b.priority);

    return chain;
  }

  /**
   * Execute a single fallback
   */
  private async executeFallback<T>(
    fallback: FallbackConfig<T>,
    context: ExecutionContext,
    primaryError?: Error
  ): Promise<FallbackExecutionResult<T>> {
    const startTime = Date.now();

    try {
      const timeout = fallback.timeout || 5000;
      const result = await this.withTimeout<T>(
        fallback.handler(context, primaryError),
        timeout
      );

      return {
        success: true,
        data: result,
        fallbackName: fallback.name,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        fallbackName: fallback.name,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute function with timeout
   */
  private async withTimeout<T>(promise: Promise<T> | T, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Fallback timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([Promise.resolve(promise), timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Update fallback statistics
   */
  private updateStats(name: string, result: FallbackExecutionResult<unknown>): void {
    let stats = this.fallbackStats.get(name);
    if (!stats) {
      stats = {
        totalUses: 0,
        successfulUses: 0,
        failedUses: 0,
        lastUsed: 0,
        averageDuration: 0,
      };
      this.fallbackStats.set(name, stats);
    }

    stats.totalUses++;
    stats.lastUsed = Date.now();

    if (result.success) {
      stats.successfulUses++;
    } else {
      stats.failedUses++;
    }

    // Update average duration
    stats.averageDuration =
      (stats.averageDuration * (stats.totalUses - 1) + result.duration) / stats.totalUses;
  }

  /**
   * Get cache key for fallback
   */
  private getCacheKey(fallbackName: string, context: ExecutionContext): string {
    const metadata = context.metadata || {};
    const metadataStr = JSON.stringify(metadata, Object.keys(metadata).sort());
    return `${fallbackName}:${metadataStr}`;
  }

  /**
   * Get value from cache
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.fallbackCache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.fallbackCache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Set value in cache
   */
  private setCache(key: string, data: unknown): void {
    // Evict oldest if cache is full
    if (this.fallbackCache.size >= this.maxCacheSize) {
      const oldestKey = this.fallbackCache.keys().next().value;
      if (oldestKey) {
        this.fallbackCache.delete(oldestKey);
      }
    }

    this.fallbackCache.set(key, {
      data,
      expiry: Date.now() + this.cacheTtlMs,
    });
  }

  /**
   * Set global fallbacks
   */
  setGlobalFallbacks(fallbacks: FallbackConfig[]): void {
    this.globalFallbacks = fallbacks;
  }

  /**
   * Add global fallback
   */
  addGlobalFallback<T>(fallback: FallbackConfig<T>): void {
    this.globalFallbacks.push(fallback);
  }

  /**
   * Enable or disable fallbacks
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Enable or disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.fallbackCache.clear();
    }
  }

  /**
   * Set cache TTL
   */
  setCacheTtl(ttlMs: number): void {
    this.cacheTtlMs = ttlMs;
  }

  /**
   * Set max cache size
   */
  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;

    // Trim cache if necessary
    while (this.fallbackCache.size > this.maxCacheSize) {
      const firstKey = this.fallbackCache.keys().next().value;
      if (firstKey) {
        this.fallbackCache.delete(firstKey);
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.fallbackCache.clear();
  }

  /**
   * Get fallback statistics
   */
  getStats(name: string): FallbackStats | undefined {
    return this.fallbackStats.get(name);
  }

  /**
   * Get all fallback statistics
   */
  getAllStats(): Map<string, FallbackStats> {
    return new Map(this.fallbackStats);
  }

  /**
   * Reset fallback statistics
   */
  resetStats(name?: string): void {
    if (name) {
      const stats = this.fallbackStats.get(name);
      if (stats) {
        stats.totalUses = 0;
        stats.successfulUses = 0;
        stats.failedUses = 0;
        stats.lastUsed = 0;
        stats.averageDuration = 0;
      }
    } else {
      this.fallbackStats.clear();
      this.fallbacks.forEach((_, name) => {
        this.fallbackStats.set(name, {
          totalUses: 0,
          successfulUses: 0,
          failedUses: 0,
          lastUsed: 0,
          averageDuration: 0,
        });
      });
    }
  }

  /**
   * Check if fallback is registered
   */
  has(name: string): boolean {
    return this.fallbacks.has(name);
  }

  /**
   * Get registered fallback
   */
  get(name: string): FallbackConfig | undefined {
    return this.fallbacks.get(name);
  }

  /**
   * Get all registered fallbacks
   */
  getAll(): FallbackConfig[] {
    return Array.from(this.fallbacks.values());
  }

  /**
   * Enable fallback
   */
  enable(name: string): void {
    const fallback = this.fallbacks.get(name);
    if (fallback) {
      fallback.enabled = true;
    }
  }

  /**
   * Disable fallback
   */
  disable(name: string): void {
    const fallback = this.fallbacks.get(name);
    if (fallback) {
      fallback.enabled = false;
    }
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.fallbacks.clear();
    this.fallbackStats.clear();
    this.fallbackCache.clear();
    this.globalFallbacks = [];
  }

  /**
   * Get degraded service mode response
   */
  static getDegradedResponse<T>(defaultValue: T): FallbackConfig<T> {
    return {
      name: 'degraded_mode',
      priority: FallbackPriority.LOW,
      handler: () => defaultValue,
      enabled: true,
      tags: ['degraded', 'static'],
    };
  }

  /**
   * Get cached fallback (for using cached data as fallback)
   */
  static getCachedFallback<T>(cacheKey: string, cache: Map<string, T>): FallbackConfig<T> {
    return {
      name: `cached_${cacheKey}`,
      priority: FallbackPriority.HIGH,
      handler: () => {
        const value = cache.get(cacheKey);
        if (value === undefined) {
          throw new Error(`Cache miss for key: ${cacheKey}`);
        }
        return value;
      },
      enabled: true,
      tags: ['cache', 'static'],
    };
  }

  /**
   * Get retry fallback (for retrying with backoff)
   */
  static getRetryFallback<T>(
    retryFn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): FallbackConfig<T> {
    return {
      name: 'retry_with_backoff',
      priority: FallbackPriority.MEDIUM,
      handler: async () => {
        let lastError: Error | undefined;
        for (let i = 0; i < maxAttempts; i++) {
          try {
            return await retryFn();
          } catch (error) {
            lastError = error as Error;
            if (i < maxAttempts - 1) {
              await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
            }
          }
        }
        throw lastError || new Error('Retry failed');
      },
      enabled: true,
      tags: ['retry', 'dynamic'],
    };
  }
}
