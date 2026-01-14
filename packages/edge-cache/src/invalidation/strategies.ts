/**
 * Cache Invalidation Strategies
 *
 * Implements multiple cache invalidation strategies including
 * time-based, event-based, tag-based, and pattern-based invalidation.
 */

import type {
  InvalidationStrategy,
  InvalidationRequest,
  InvalidationResult,
  InvalidationType,
  CacheTier,
  TagIndex,
  PatternMatcher,
  EdgeCacheEnv,
} from '../types';

export interface InvalidationConfig {
  cascade: boolean;
  propagate: boolean;
  confirm: boolean;
  retryAttempts: number;
  timeout: number;
  maxTags: number;
  maxPatterns: number;
}

/**
 * Cache Invalidation Manager
 *
 * Manages cache invalidation using various strategies.
 */
export class CacheInvalidationManager {
  private kv: KVNamespace;
  private r2?: R2Bucket;
  private config: InvalidationConfig;
  private tagIndexes: Map<string, TagIndex>;
  private patternMatchers: Map<string, PatternMatcher>;

  constructor(env: EdgeCacheEnv, config: Partial<InvalidationConfig> = {}) {
    this.kv = env.CACHE_KV;
    this.r2 = env.CACHE_R2;
    this.config = {
      cascade: true,
      propagate: true,
      confirm: false,
      retryAttempts: 3,
      timeout: 30000,
      maxTags: 1000,
      maxPatterns: 100,
      ...config,
    };

    this.tagIndexes = new Map();
    this.patternMatchers = new Map();
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(request: InvalidationRequest): Promise<InvalidationResult> {
    const startTime = Date.now();
    const keysInvalidated: string[] = [];
    const tiersAffected: CacheTier[] = [];
    const errors: string[] = [];
    const propagationResults = [];

    try {
      switch (request.strategy) {
        case 'time-based':
          return await this.invalidateByTime(request);

        case 'event-based':
          return await this.invalidateByEvent(request);

        case 'tag-based':
          return await this.invalidateByTags(request);

        case 'pattern-based':
          return await this.invalidateByPattern(request);

        case 'cascade':
          return await this.invalidateCascade(request);

        case 'purge-all':
          return await this.purgeAll(request);

        default:
          throw new Error(`Unknown invalidation strategy: ${request.strategy}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      success: errors.length === 0,
      keysInvalidated: keysInvalidated.length,
      tiersAffected,
      duration: Date.now() - startTime,
      errors,
      propagationResults,
    };
  }

  /**
   * Invalidate by keys
   */
  private async invalidateByKeys(request: InvalidationRequest): Promise<InvalidationResult> {
    const startTime = Date.now();
    const keysInvalidated: string[] = [];
    const tiersAffected: CacheTier[] = ['hot', 'warm'];
    const errors: string[] = [];
    const propagationResults = [];

    if (!request.keys || request.keys.length === 0) {
      return {
        success: false,
        keysInvalidated: 0,
        tiersAffected,
        duration: Date.now() - startTime,
        errors: ['No keys provided'],
        propagationResults,
      };
    }

    // Invalidate from KV
    for (const key of request.keys) {
      try {
        await this.kv.delete(key);
        keysInvalidated.push(key);

        // Also invalidate warm cache if propagating
        if (this.config.propagate) {
          await this.kv.delete(`warm:${key}`);
        }
      } catch (error) {
        errors.push(`Failed to invalidate ${key}: ${error}`);
      }
    }

    // Propagate to R2 if configured
    if (this.r2 && this.config.propagate) {
      for (const key of request.keys) {
        try {
          await this.r2.delete(key);
          tiersAffected.push('cold');
        } catch (error) {
          errors.push(`Failed to invalidate from R2 ${key}: ${error}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      keysInvalidated: keysInvalidated.length,
      tiersAffected: Array.from(new Set(tiersAffected)),
      duration: Date.now() - startTime,
      errors,
      propagationResults,
    };
  }

  /**
   * Invalidate by tags
   */
  private async invalidateByTags(request: InvalidationRequest): Promise<InvalidationResult> {
    const startTime = Date.now();
    const keysInvalidated: string[] = [];
    const tiersAffected: CacheTier[] = ['hot', 'warm'];
    const errors: string[] = [];
    const propagationResults = [];

    if (!request.tags || request.tags.length === 0) {
      return {
        success: false,
        keysInvalidated: 0,
        tiersAffected,
        duration: Date.now() - startTime,
        errors: ['No tags provided'],
        propagationResults,
      };
    }

    // Get keys for each tag
    const keysToDelete = new Set<string>();

    for (const tag of request.tags) {
      const tagIndex = this.tagIndexes.get(tag);
      if (tagIndex) {
        for (const key of tagIndex.keys) {
          keysToDelete.add(key);
        }
      } else {
        // Try to load from KV
        const data = await this.kv.get(`tag:${tag}`, 'json');
        if (data && typeof data === 'object') {
          const index = data as TagIndex;
          for (const key of index.keys) {
            keysToDelete.add(key);
          }
        }
      }
    }

    // Delete all keys
    for (const key of Array.from(keysToDelete)) {
      try {
        await this.kv.delete(key);
        keysInvalidated.push(key);
      } catch (error) {
        errors.push(`Failed to invalidate ${key}: ${error}`);
      }
    }

    // Remove tag indexes
    for (const tag of request.tags) {
      await this.kv.delete(`tag:${tag}`);
      this.tagIndexes.delete(tag);
    }

    return {
      success: errors.length === 0,
      keysInvalidated: keysInvalidated.length,
      tiersAffected,
      duration: Date.now() - startTime,
      errors,
      propagationResults,
    };
  }

  /**
   * Invalidate by pattern
   */
  private async invalidateByPattern(request: InvalidationRequest): Promise<InvalidationResult> {
    const startTime = Date.now();
    const keysInvalidated: string[] = [];
    const tiersAffected: CacheTier[] = ['hot', 'warm'];
    const errors: string[] = [];
    const propagationResults = [];

    if (!request.pattern) {
      return {
        success: false,
        keysInvalidated: 0,
        tiersAffected,
        duration: Date.now() - startTime,
        errors: ['No pattern provided'],
        propagationResults,
      };
    }

    // List all keys and match pattern
    try {
      // Note: KV doesn't support listing all keys directly
      // In production, you'd maintain a key index or use a different approach

      const pattern = request.pattern;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));

      // For demo, we'll use a predefined key list
      const keyList = await this.getManagedKeyList();

      for (const key of keyList) {
        if (regex.test(key)) {
          try {
            await this.kv.delete(key);
            keysInvalidated.push(key);
          } catch (error) {
            errors.push(`Failed to invalidate ${key}: ${error}`);
          }
        }
      }
    } catch (error) {
      errors.push(`Pattern matching failed: ${error}`);
    }

    return {
      success: errors.length === 0,
      keysInvalidated: keysInvalidated.length,
      tiersAffected,
      duration: Date.now() - startTime,
      errors,
      propagationResults,
    };
  }

  /**
   * Cascade invalidation
   */
  private async invalidateCascade(request: InvalidationRequest): Promise<InvalidationResult> {
    const startTime = Date.now();
    const keysInvalidated: string[] = [];
    const tiersAffected: CacheTier[] = [];
    const errors: string[] = [];
    const propagationResults = [];

    if (!request.keys || request.keys.length === 0) {
      return {
        success: false,
        keysInvalidated: 0,
        tiersAffected,
        duration: Date.now() - startTime,
        errors: ['No keys provided for cascade'],
        propagationResults,
      };
    }

    // Start from hot and cascade down
    const tiers: CacheTier[] = ['hot', 'warm', 'cold'];

    for (const tier of tiers) {
      let tierKeysInvalidated = 0;

      for (const key of request.keys) {
        try {
          switch (tier) {
            case 'hot':
              await this.kv.delete(key);
              tierKeysInvalidated++;
              break;

            case 'warm':
              await this.kv.delete(`warm:${key}`);
              tierKeysInvalidated++;
              break;

            case 'cold':
              if (this.r2) {
                await this.r2.delete(key);
                tierKeysInvalidated++;
              }
              break;
          }

          keysInvalidated.push(`${tier}:${key}`);
        } catch (error) {
          errors.push(`Failed to invalidate ${tier}:${key}: ${error}`);
        }
      }

      if (tierKeysInvalidated > 0) {
        tiersAffected.push(tier);
      }

      propagationResults.push({
        tier,
        success: tierKeysInvalidated > 0,
        keysInvalidated: tierKeysInvalidated,
        duration: 0,
      });
    }

    return {
      success: errors.length === 0,
      keysInvalidated: keysInvalidated.length,
      tiersAffected,
      duration: Date.now() - startTime,
      errors,
      propagationResults,
    };
  }

  /**
   * Purge all cache
   */
  private async purgeAll(request: InvalidationRequest): Promise<InvalidationResult> {
    const startTime = Date.now();
    const keysInvalidated = 0;
    const tiersAffected: CacheTier[] = ['hot', 'warm', 'cold'];
    const errors: string[] = [];
    const propagationResults = [];

    // Note: KV doesn't support purging all keys
    // In production, you'd use a prefix-based approach or maintain a key registry

    errors.push('Purge all not supported for KV - use tag-based or pattern-based invalidation');

    return {
      success: false,
      keysInvalidated,
      tiersAffected,
      duration: Date.now() - startTime,
      errors,
      propagationResults,
    };
  }

  /**
   * Invalidate by time (TTL-based)
   */
  private async invalidateByTime(request: InvalidationRequest): Promise<InvalidationResult> {
    const startTime = Date.now();
    const keysInvalidated = 0;
    const tiersAffected: CacheTier[] = [];
    const errors: string[] = [];
    const propagationResults = [];

    // Time-based invalidation is handled automatically by KV TTL
    // This is a placeholder for any custom time-based logic

    errors.push('Time-based invalidation is handled automatically by KV TTL');

    return {
      success: true,
      keysInvalidated,
      tiersAffected,
      duration: Date.now() - startTime,
      errors,
      propagationResults,
    };
  }

  /**
   * Invalidate by event
   */
  private async invalidateByEvent(request: InvalidationRequest): Promise<InvalidationResult> {
    const startTime = Date.now();
    const keysInvalidated = 0;
    const tiersAffected: CacheTier[] = [];
    const errors: string[] = [];
    const propagationResults = [];

    // Event-based invalidation would trigger based on external events
    // This is a placeholder for event-driven invalidation logic

    errors.push('Event-based invalidation requires event subscription setup');

    return {
      success: true,
      keysInvalidated,
      tiersAffected,
      duration: Date.now() - startTime,
      errors,
      propagationResults,
    };
  }

  /**
   * Tag cache entries
   */
  async tagEntries(keys: string[], tags: string[]): Promise<void> {
    for (const tag of tags) {
      let tagIndex = this.tagIndexes.get(tag);

      if (!tagIndex) {
        // Try to load from KV
        const data = await this.kv.get(`tag:${tag}`, 'json');
        if (data && typeof data === 'object') {
          tagIndex = data as TagIndex;
        } else {
          tagIndex = {
            tag,
            keys: [],
            count: 0,
            lastUpdated: Date.now(),
          };
        }
      }

      // Add keys to tag index
      for (const key of keys) {
        if (!tagIndex.keys.includes(key)) {
          tagIndex.keys.push(key);
          tagIndex.count++;
        }
      }

      tagIndex.lastUpdated = Date.now();

      // Update in-memory index
      this.tagIndexes.set(tag, tagIndex);

      // Persist to KV
      await this.kv.put(`tag:${tag}`, JSON.stringify(tagIndex), {
        expirationTtl: 86400 * 7, // 7 days
      });
    }
  }

  /**
   * Register a pattern matcher
   */
  async registerPattern(
    name: string,
    pattern: string,
    type: 'glob' | 'regex' | 'exact' = 'glob'
  ): Promise<void> {
    const matcher: PatternMatcher = {
      pattern,
      type,
      compiled: type === 'regex' ? new RegExp(pattern) : new RegExp('^' + pattern.replace(/\*/g, '.*') + '$'),
      matchCount: 0,
      lastMatched: Date.now(),
    };

    this.patternMatchers.set(name, matcher);

    // Persist to KV
    await this.kv.put(`pattern:${name}`, JSON.stringify({
      ...matcher,
      compiled: pattern, // Don't persist compiled regex
    }), {
      expirationTtl: 86400 * 7,
    });
  }

  /**
   * Get managed key list
   */
  private async getManagedKeyList(): Promise<string[]> {
    // In production, maintain a key registry in KV or Durable Object
    const data = await this.kv.get('key-registry', 'json');
    if (data && Array.isArray(data)) {
      return data as string[];
    }
    return [];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      tagIndexes: this.tagIndexes.size,
      patternMatchers: this.patternMatchers.size,
      config: this.config,
    };
  }
}

/**
 * Create a cache invalidation manager
 */
export function createCacheInvalidationManager(
  env: EdgeCacheEnv,
  config?: Partial<InvalidationConfig>
): CacheInvalidationManager {
  return new CacheInvalidationManager(env, config);
}
