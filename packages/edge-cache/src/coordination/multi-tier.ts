/**
 * Multi-Tier Cache Coordination
 *
 * Coordinates cache operations across multiple tiers:
 * Browser -> Edge (Hot) -> KV (Warm) -> R2 (Cold) -> Origin
 */

import type {
  CacheLevel,
  CacheTier,
  CacheHierarchy,
  CoordinationResult,
  InvalidationPropagation,
  ConsistencyModel,
  EdgeCacheEnv,
} from '../types';

export interface CoordinationConfig {
  hierarchy: CacheHierarchy;
  defaultTTL: number;
  propagationDelay: number;
  maxRetries: number;
  consistency: ConsistencyModel;
}

export interface CacheOperation {
  type: 'get' | 'set' | 'delete';
  key: string;
  value?: ArrayBuffer | string;
  ttl?: number;
  tiers?: CacheLevel[];
  metadata?: Record<string, unknown>;
}

/**
 * Multi-Tier Cache Coordinator
 *
 * Manages cache operations across multiple tiers with
 * intelligent fallback and propagation.
 */
export class MultiTierCoordinator {
  private env: EdgeCacheEnv;
  private config: CoordinationConfig;
  private pendingPropagations: Map<string, InvalidationPropagation>;

  constructor(env: EdgeCacheEnv, config: Partial<CoordinationConfig> = {}) {
    this.env = env;
    this.config = {
      hierarchy: {
        levels: ['L1', 'L2', 'L3', 'L4'],
        fallbackOrder: ['L1', 'L2', 'L3', 'L4'],
        propagationRules: [
          { from: 'L2', to: 'L1', condition: 'on-write', action: 'invalidate' },
          { from: 'L3', to: 'L2', condition: 'on-write', action: 'copy' },
          { from: 'L4', to: 'L3', condition: 'on-read', action: 'copy' },
        ],
        consistencyModel: 'eventual',
      },
      defaultTTL: 3600,
      propagationDelay: 100,
      maxRetries: 3,
      consistency: 'eventual',
      ...config,
    };

    this.pendingPropagations = new Map();
  }

  /**
   * Get a value from cache with tier fallback
   */
  async get(key: string, preferredTiers?: CacheLevel[]): Promise<CoordinationResult> {
    const startTime = Date.now();
    const result: CoordinationResult = {
      success: false,
      source: 'L4' as CacheLevel,
      hits: [],
      misses: [],
      latency: 0,
      propagated: false,
      consistent: true,
    };

    // Determine search order
    const searchOrder = preferredTiers || this.config.hierarchy.fallbackOrder;

    // Try each tier
    for (const level of searchOrder) {
      try {
        const value = await this.getFromTier(level, key);

        if (value !== null) {
          result.success = true;
          result.source = level;
          result.hits.push(level);

          // Propagate to higher tiers if needed
          if (this.shouldPropagate(level, preferredTiers)) {
            await this.propagateToHigherTiers(key, value, level);
            result.propagated = true;
          }

          result.latency = Date.now() - startTime;
          return result;
        } else {
          result.misses.push(level);
        }
      } catch (error) {
        console.error(`Error reading from ${level}:`, error);
        result.misses.push(level);
      }
    }

    result.latency = Date.now() - startTime;
    return result;
  }

  /**
   * Set a value in cache with tier propagation
   */
  async set(
    key: string,
    value: ArrayBuffer | string,
    options?: {
      ttl?: number;
      tiers?: CacheLevel[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<CoordinationResult> {
    const startTime = Date.now();
    const result: CoordinationResult = {
      success: false,
      source: 'L2' as CacheLevel,
      hits: [],
      misses: [],
      latency: 0,
      propagated: false,
      consistent: false,
    };

    const ttl = options?.ttl || this.config.defaultTTL;
    const tiers = options?.tiers || ['L2', 'L3'];

    // Set in specified tiers
    const successes: CacheLevel[] = [];

    for (const tier of tiers) {
      try {
        await this.setToTier(tier, key, value, ttl, options?.metadata);
        successes.push(tier);
      } catch (error) {
        console.error(`Error writing to ${tier}:`, error);
      }
    }

    if (successes.length > 0) {
      result.success = true;
      result.source = successes[0];
      result.hits = successes;

      // Invalidate lower tiers based on propagation rules
      await this.invalidateLowerTiers(key, successes[0]);
      result.propagated = true;
    }

    result.latency = Date.now() - startTime;
    return result;
  }

  /**
   * Delete a value from all tiers
   */
  async delete(key: string): Promise<CoordinationResult> {
    const startTime = Date.now();
    const result: CoordinationResult = {
      success: false,
      source: 'L2' as CacheLevel,
      hits: [],
      misses: [],
      latency: 0,
      propagated: true,
      consistent: true,
    };

    // Delete from all tiers
    for (const level of this.config.hierarchy.levels) {
      try {
        await this.deleteFromTier(level, key);
        result.hits.push(level);
      } catch (error) {
        console.error(`Error deleting from ${level}:`, error);
        result.misses.push(level);
      }
    }

    result.success = result.hits.length > 0;
    result.latency = Date.now() - startTime;

    return result;
  }

  /**
   * Invalidate a key across all tiers
   */
  async invalidate(key: string): Promise<void> {
    const propagation: InvalidationPropagation = {
      key,
      source: 'L2',
      targets: this.config.hierarchy.levels,
      status: 'in-progress',
      startedAt: Date.now(),
      errors: [],
    };

    this.pendingPropagations.set(key, propagation);

    try {
      for (const level of this.config.hierarchy.levels) {
        try {
          await this.deleteFromTier(level, key);
        } catch (error) {
          propagation.errors.push(`${level}: ${error}`);
        }
      }

      propagation.status = propagation.errors.length === 0 ? 'completed' : 'failed';
      propagation.completedAt = Date.now();
    } finally {
      this.pendingPropagations.delete(key);
    }
  }

  /**
   * Get value from a specific tier
   */
  private async getFromTier(level: CacheLevel, key: string): Promise<ArrayBuffer | string | null> {
    switch (level) {
      case 'L1': // Browser cache
        // Browser cache is managed by the client
        return null;

      case 'L2': // Edge cache (hot)
        // Use in-memory DO cache or Workers KV
        try {
          const value = await this.env.CACHE_KV.get(key, 'arrayBuffer');
          return value;
        } catch {
          return null;
        }

      case 'L3': // Origin cache (warm)
        try {
          const value = await this.env.CACHE_KV.get(`warm:${key}`, 'arrayBuffer');
          return value;
        } catch {
          return null;
        }

      case 'L4': // Database/Origin (cold)
        try {
          const response = await fetch(key);
          if (response.ok) {
            return await response.arrayBuffer();
          }
          return null;
        } catch {
          return null;
        }

      default:
        return null;
    }
  }

  /**
   * Set value in a specific tier
   */
  private async setToTier(
    level: CacheLevel,
    key: string,
    value: ArrayBuffer | string,
    ttl: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    switch (level) {
      case 'L1': // Browser cache
        // Set cache headers for browser
        break;

      case 'L2': // Edge cache (hot)
        await this.env.CACHE_KV.put(key, value, {
          expirationTtl: ttl,
          metadata,
        });
        break;

      case 'L3': // Origin cache (warm)
        await this.env.CACHE_KV.put(`warm:${key}`, value, {
          expirationTtl: ttl * 2,
          metadata,
        });
        break;

      case 'L4': // Database/Origin (cold)
        // Store in R2 or send to origin
        if (this.env.CACHE_R2) {
          await this.env.CACHE_R2.put(key, value);
        }
        break;
    }
  }

  /**
   * Delete from a specific tier
   */
  private async deleteFromTier(level: CacheLevel, key: string): Promise<void> {
    switch (level) {
      case 'L2':
      case 'L3':
        await this.env.CACHE_KV.delete(key);
        if (level === 'L3') {
          await this.env.CACHE_KV.delete(`warm:${key}`);
        }
        break;

      case 'L4':
        if (this.env.CACHE_R2) {
          await this.env.CACHE_R2.delete(key);
        }
        break;
    }
  }

  /**
   * Check if we should propagate to higher tiers
   */
  private shouldPropagate(currentLevel: CacheLevel, preferredTiers?: CacheLevel[]): boolean {
    // Always propagate if requested from lower tier
    if (preferredTiers && !preferredTiers.includes(currentLevel)) {
      return true;
    }

    // Check propagation rules
    for (const rule of this.config.hierarchy.propagationRules) {
      if (rule.to === currentLevel && rule.condition === 'on-read') {
        return true;
      }
    }

    return false;
  }

  /**
   * Propagate to higher tiers
   */
  private async propagateToHigherTiers(
    key: string,
    value: ArrayBuffer | string,
    sourceLevel: CacheLevel
  ): Promise<void> {
    const higherLevels = this.config.hierarchy.levels.slice(
      0,
      this.config.hierarchy.levels.indexOf(sourceLevel)
    );

    for (const level of higherLevels.reverse()) {
      try {
        await this.setToTier(level, key, value, this.config.defaultTTL);
      } catch (error) {
        console.error(`Error propagating to ${level}:`, error);
      }
    }
  }

  /**
   * Invalidate lower tiers
   */
  private async invalidateLowerTiers(key: string, sourceLevel: CacheLevel): Promise<void> {
    const lowerLevels = this.config.hierarchy.levels.slice(
      this.config.hierarchy.levels.indexOf(sourceLevel) + 1
    );

    for (const level of lowerLevels) {
      try {
        await this.deleteFromTier(level, key);
      } catch (error) {
        console.error(`Error invalidating ${level}:`, error);
      }
    }
  }

  /**
   * Get pending propagations
   */
  getPendingPropagations(): InvalidationPropagation[] {
    return Array.from(this.pendingPropagations.values());
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      pendingPropagations: this.pendingPropagations.size,
      hierarchy: this.config.hierarchy,
      consistency: this.config.consistency,
    };
  }
}

/**
 * Create a multi-tier coordinator
 */
export function createMultiTierCoordinator(
  env: EdgeCacheEnv,
  config?: Partial<CoordinationConfig>
): MultiTierCoordinator {
  return new MultiTierCoordinator(env, config);
}
