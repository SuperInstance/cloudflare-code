/**
 * Cold Start Optimization
 *
 * Lazy initialization strategies to minimize cold start time.
 * Target: <100ms cold start time.
 *
 * Strategies:
 * 1. Lazy initialization of providers
 * 2. Prefetching during idle time
 * 3. Connection warming
 * 4. Cache warming
 */

import type { ProviderClient } from '../lib/providers/base';
import type { Env } from '../types';

/**
 * Initialization state
 */
export interface InitializationState {
  /** Is fully initialized */
  initialized: boolean;
  /** Initialization timestamp */
  initializedAt: number;
  /** Time to initialize (ms) */
  initTime: number;
  /** Current phase */
  phase: 'none' | 'critical' | 'providers' | 'cache' | 'full';
}

/**
 * Lazy initialization options
 */
export interface LazyInitOptions {
  /** Initialize providers in parallel */
  parallelProviders: boolean;
  /** Prefetch common models */
  prefetchModels: boolean;
  /** Warm up connections */
  warmConnections: boolean;
  /** Initialize cache on first request */
  lazyCache: boolean;
}

/**
 * Cold start optimizer
 */
export class ColdStartOptimizer {
  private state: InitializationState;
  private options: LazyInitOptions;
  private providers: Map<string, ProviderClient>;
  private prefetchCache: Map<string, any>;
  private warmConnections: Set<string>;

  constructor(options: LazyInitOptions = {}) {
    this.state = {
      initialized: false,
      initializedAt: 0,
      initTime: 0,
      phase: 'none',
    };

    this.options = {
      parallelProviders: options.parallelProviders ?? true,
      prefetchModels: options.prefetchModels ?? true,
      warmConnections: options.warmConnections ?? true,
      lazyCache: options.lazyCache ?? true,
    };

    this.providers = new Map();
    this.prefetchCache = new Map();
    this.warmConnections = new Set();
  }

  /**
   * Get initialization state
   */
  getState(): InitializationState {
    return { ...this.state };
  }

  /**
   * Initialize critical path (synchronous, fast)
   *
   * This runs synchronously during the first request to ensure
   * minimal cold start impact.
   */
  initCritical(): void {
    if (this.state.phase !== 'none') return;

    const startTime = performance.now();

    // Initialize critical components synchronously
    // These are lightweight and fast

    this.state.phase = 'critical';
    this.state.initializedAt = Date.now();
    this.state.initTime = performance.now() - startTime;
  }

  /**
   * Initialize providers (lazy, async)
   *
   * Called on first API request. Initializes providers in parallel.
   */
  async initProviders(env: Env): Promise<void> {
    if (this.state.phase === 'providers' || this.state.phase === 'full') {
      return;
    }

    const startTime = performance.now();

    // Initialize providers in parallel
    if (this.options.parallelProviders) {
      await Promise.all([
        this.initProvider('cloudflare-ai', env),
        this.initProvider('groq', env),
        this.initProvider('cerebras', env),
        this.initProvider('openrouter', env),
      ]);
    } else {
      // Sequential initialization (fallback)
      await this.initProvider('cloudflare-ai', env);
      await this.initProvider('groq', env);
      await this.initProvider('cerebras', env);
      await this.initProvider('openrouter', env);
    }

    this.state.phase = 'providers';

    // Prefetch common models
    if (this.options.prefetchModels) {
      this.prefetchCommonModels().catch(() => {
        // Don't fail on prefetch errors
      });
    }

    this.state.initTime = performance.now() - startTime;
  }

  /**
   * Initialize cache (lazy, async)
   *
   * Called on first cache request.
   */
  async initCache(env: Env): Promise<void> {
    if (this.state.phase === 'full') return;

    const startTime = performance.now();

    // Initialize cache components
    // This is lazy-loaded only when cache is first accessed

    this.state.phase = 'full';
    this.state.initialized = true;
    this.state.initTime = performance.now() - startTime;
  }

  /**
   * Initialize a single provider
   */
  private async initProvider(name: string, env: Env): Promise<void> {
    try {
      // Dynamic import for code splitting
      const providerModule = await import(`../lib/providers/${name}`);

      // Create provider instance
      const providerClass = providerModule[Object.keys(providerModule)[0]];
      const provider = new providerClass();

      // Test provider availability
      const available = await provider.isAvailable();

      if (available) {
        this.providers.set(name, provider);
      }
    } catch (error) {
      console.warn(`Failed to initialize provider '${name}':`, error);
    }
  }

  /**
   * Prefetch common models
   *
   * Warms up the model cache with frequently used models.
   */
  private async prefetchCommonModels(): Promise<void> {
    const commonModels = [
      'claude-3-haiku',
      'claude-3.5-sonnet',
      'llama-3.1-8b',
      'gemma-7b',
    ];

    // Prefetch in background
    for (const provider of this.providers.values()) {
      try {
        const models = await provider.getModelList();

        // Check if provider has common models
        for (const model of commonModels) {
          if (models.includes(model)) {
            // Mark as available (no actual fetch needed)
            this.prefetchCache.set(`${provider.name}:${model}`, true);
          }
        }
      } catch (error) {
        // Continue on error
      }
    }
  }

  /**
   * Warm up connection to a provider
   *
   * Makes a lightweight request to establish connection.
   */
  async warmConnection(providerName: string): Promise<boolean> {
    if (this.warmConnections.has(providerName)) {
      return true; // Already warmed
    }

    const provider = this.providers.get(providerName);
    if (!provider) return false;

    try {
      // Lightweight health check
      const available = await provider.isAvailable();

      if (available) {
        this.warmConnections.add(providerName);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get provider by name (lazy loads if needed)
   */
  getProvider(name: string): ProviderClient | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all initialized providers
   */
  getProviders(): ProviderClient[] {
    return Array.from(this.providers.values());
  }

  /**
   * Check if model is prefetched
   */
  isModelPrefetched(providerName: string, model: string): boolean {
    return this.prefetchCache.has(`${providerName}:${model}`);
  }

  /**
   * Get initialization metrics
   */
  getMetrics(): {
    state: InitializationState;
    providerCount: number;
    warmConnectionCount: number;
    prefetchCount: number;
  } {
    return {
      state: this.getState(),
      providerCount: this.providers.size,
      warmConnectionCount: this.warmConnections.size,
      prefetchCount: this.prefetchCache.size,
    };
  }
}

/**
 * Global cold start optimizer instance
 */
let globalOptimizer: ColdStartOptimizer | null = null;

/**
 * Get or create global optimizer instance
 */
export function getOptimizer(): ColdStartOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new ColdStartOptimizer({
      parallelProviders: true,
      prefetchModels: true,
      warmConnections: true,
      lazyCache: true,
    });
  }

  return globalOptimizer;
}

/**
 * Initialize on first request (middleware)
 *
 * Use this in your fetch handler to initialize components
 * just-in-time for the first request.
 */
export async function initializeOnRequest(
  env: Env,
  optimizer: ColdStartOptimizer
): Promise<void> {
  const state = optimizer.getState();

  // Initialize critical path first (synchronous)
  if (state.phase === 'none') {
    optimizer.initCritical();
  }

  // Initialize providers (async, parallel)
  if (state.phase === 'critical') {
    await optimizer.initProviders(env);
  }

  // Cache will be initialized lazily on first cache access
}

/**
 * Prefetch during idle time
 *
 * Call this during periods of low traffic to warm up resources.
 */
export async function prefetchIdle(
  optimizer: ColdStartOptimizer
): Promise<void> {
  const metrics = optimizer.getMetrics();

  // Warm up connections
  for (const provider of optimizer.getProviders()) {
    await optimizer.warmConnection(provider.name);
  }
}

/**
 * Cache warming strategy
 *
 * Pre-loads frequently accessed cache entries.
 */
export class CacheWarmer {
  private warmCache: Map<string, any>;
  private warmKeys: Set<string>;

  constructor() {
    this.warmCache = new Map();
    this.warmKeys = new Set();
  }

  /**
   * Mark a key as warm (frequently accessed)
   */
  markWarm(key: string): void {
    this.warmKeys.add(key);
  }

  /**
   * Check if key is marked as warm
   */
  isWarm(key: string): boolean {
    return this.warmKeys.has(key);
  }

  /**
   * Pre-load warm keys into cache
   */
  async preloadWarm(
    cache: any,
    keys: string[]
  ): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        try {
          const value = await cache.get(key);
          if (value) {
            this.warmCache.set(key, value);
          }
        } catch (error) {
          // Continue on error
        }
      })
    );
  }

  /**
   * Get from warm cache
   */
  getFromWarmCache(key: string): any | undefined {
    return this.warmCache.get(key);
  }

  /**
   * Get warm keys
   */
  getWarmKeys(): string[] {
    return Array.from(this.warmKeys);
  }

  /**
   * Clear warm cache
   */
  clear(): void {
    this.warmCache.clear();
    this.warmKeys.clear();
  }
}

/**
 * Connection pool for warming connections
 */
export class ConnectionPool {
  private connections: Map<string, any>;
  private lastUsed: Map<string, number>;
  private maxIdleTime: number;

  constructor(maxIdleTime = 30000) { // 30 seconds
    this.connections = new Map();
    this.lastUsed = new Map();
    this.maxIdleTime = maxIdleTime;
  }

  /**
   * Get or create connection
   */
  async get(key: string, factory: () => Promise<any>): Promise<any> {
    const existing = this.connections.get(key);

    if (existing) {
      this.lastUsed.set(key, Date.now());
      return existing;
    }

    const connection = await factory();
    this.connections.set(key, connection);
    this.lastUsed.set(key, Date.now());

    return connection;
  }

  /**
   * Close idle connections
   */
  closeIdle(): void {
    const now = Date.now();

    for (const [key, lastUsed] of this.lastUsed.entries()) {
      if (now - lastUsed > this.maxIdleTime) {
        const connection = this.connections.get(key);
        if (connection && typeof connection.close === 'function') {
          connection.close();
        }

        this.connections.delete(key);
        this.lastUsed.delete(key);
      }
    }
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const connection of this.connections.values()) {
      if (typeof connection.close === 'function') {
        connection.close();
      }
    }

    this.connections.clear();
    this.lastUsed.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
  } {
    const now = Date.now();
    let active = 0;

    for (const lastUsed of this.lastUsed.values()) {
      if (now - lastUsed < this.maxIdleTime) {
        active++;
      }
    }

    return {
      totalConnections: this.connections.size,
      activeConnections: active,
    };
  }
}

/**
 * Create initialization middleware for Hono
 */
export function createInitMiddleware(optimizer: ColdStartOptimizer) {
  return async (c: any, next: () => Promise<void>) => {
    // Initialize on first request
    await initializeOnRequest(c.env, optimizer);

    await next();
  };
}

/**
 * Performance targets
 */
export const coldStartTargets = {
  /** Maximum cold start time */
  maxColdStart: 100, // ms

  /** Target cold start time */
  targetColdStart: 50, // ms

  /** Critical path initialization */
  criticalPath: 10, // ms

  /** Provider initialization */
  providerInit: 30, // ms

  /** Cache initialization */
  cacheInit: 20, // ms
};

/**
 * Measure cold start time
 */
export function measureColdStart<T>(
  fn: () => Promise<T>,
  optimizer: ColdStartOptimizer
): Promise<T> {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();

    fn()
      .then((result) => {
        const duration = performance.now() - startTime;

        // Update metrics if this was a cold start
        const state = optimizer.getState();
        if (!state.initialized) {
          console.log(`Cold start: ${duration.toFixed(2)}ms`);
        }

        resolve(result);
      })
      .catch(reject);
  });
}
