/**
 * Cache Invalidation Engine
 * Multiple strategies for cache invalidation
 */

import {
  CacheTier,
  InvalidationEvent,
  InvalidationResult,
  InvalidationConfig,
  CacheContext,
  MultiTierCache,
} from '../types';

// ============================================================================
// Invalidation Types
// ============================================================================

interface InvalidationRule {
  id: string;
  type: 'tag' | 'prefix' | 'pattern' | 'ttl';
  condition: string | RegExp | number;
  propagate: boolean;
  priority: number;
}

interface TagIndex {
  tags: Map<string, Set<string>>; // tag -> keys
  keys: Map<string, Set<string>>; // key -> tags
}

// ============================================================================
// Tag-based Invalidation
// ============================================================================

class TagInvalidator {
  private index: TagIndex;

  constructor() {
    this.index = {
      tags: new Map(),
      keys: new Map(),
    };
  }

  /**
   * Add tags to a key
   */
  addTags(key: string, tags: string[]): void {
    const keyTags = this.index.keys.get(key) || new Set();
    tags.forEach(tag => {
      keyTags.add(tag);

      const tagKeys = this.index.tags.get(tag) || new Set();
      tagKeys.add(key);
      this.index.tags.set(tag, tagKeys);
    });
    this.index.keys.set(key, keyTags);
  }

  /**
   * Remove tags from a key
   */
  removeTags(key: string, tags: string[]): void {
    const keyTags = this.index.keys.get(key);
    if (!keyTags) return;

    tags.forEach(tag => {
      keyTags.delete(tag);

      const tagKeys = this.index.tags.get(tag);
      if (tagKeys) {
        tagKeys.delete(key);
        if (tagKeys.size === 0) {
          this.index.tags.delete(tag);
        }
      }
    });

    if (keyTags.size === 0) {
      this.index.keys.delete(key);
    }
  }

  /**
   * Get all keys for a tag
   */
  getKeysByTag(tag: string): string[] {
    const tagKeys = this.index.tags.get(tag);
    return tagKeys ? Array.from(tagKeys) : [];
  }

  /**
   * Get all tags for a key
   */
  getTagsByKey(key: string): string[] {
    const keyTags = this.index.keys.get(key);
    return keyTags ? Array.from(keyTags) : [];
  }

  /**
   * Remove key from index
   */
  removeKey(key: string): void {
    const keyTags = this.index.keys.get(key);
    if (!keyTags) return;

    keyTags.forEach(tag => {
      const tagKeys = this.index.tags.get(tag);
      if (tagKeys) {
        tagKeys.delete(key);
        if (tagKeys.size === 0) {
          this.index.tags.delete(tag);
        }
      }
    });

    this.index.keys.delete(key);
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.index.tags.clear();
    this.index.keys.clear();
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalTags: number;
    totalKeys: number;
    avgTagsPerKey: number;
  } {
    let totalTags = 0;
    this.index.keys.forEach(tags => {
      totalTags += tags.size;
    });

    return {
      totalTags: this.index.tags.size,
      totalKeys: this.index.keys.size,
      avgTagsPerKey: this.index.keys.size > 0 ? totalTags / this.index.keys.size : 0,
    };
  }
}

// ============================================================================
// TTL-based Invalidation
// ============================================================================

class TTLInvalidator {
  private expirations = new Map<string, number>();

  /**
   * Set expiration for a key
   */
  setExpiration(key: string, ttl: number): void {
    const expiresAt = Date.now() + ttl;
    this.expirations.set(key, expiresAt);
  }

  /**
   * Get expiration time for a key
   */
  getExpiration(key: string): number | null {
    return this.expirations.get(key) || null;
  }

  /**
   * Check if a key is expired
   */
  isExpired(key: string): boolean {
    const expiration = this.expirations.get(key);
    if (!expiration) return false;
    return Date.now() > expiration;
  }

  /**
   * Get expired keys
   */
  getExpiredKeys(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    this.expirations.forEach((expiration, key) => {
      if (now > expiration) {
        expired.push(key);
      }
    });

    return expired;
  }

  /**
   * Remove expiration for a key
   */
  removeExpiration(key: string): void {
    this.expirations.delete(key);
  }

  /**
   * Clear all expirations
   */
  clear(): void {
    this.expirations.clear();
  }

  /**
   * Get keys expiring soon
   */
  getKeysExpiringSoon(withinMs = 60000): string[] {
    const now = Date.now();
    const threshold = now + withinMs;
    const soon: string[] = [];

    this.expirations.forEach((expiration, key) => {
      if (expiration > now && expiration <= threshold) {
        soon.push(key);
      }
    });

    return soon.sort((a, b) => {
      const expA = this.expirations.get(a)!;
      const expB = this.expirations.get(b)!;
      return expA - expB;
    });
  }
}

// ============================================================================
// Hierarchical Invalidation
// ============================================================================

class HierarchicalInvalidator {
  private hierarchy = new Map<string, Set<string>>(); // parent -> children
  private parents = new Map<string, Set<string>>(); // child -> parents

  /**
   * Add hierarchical relationship
   */
  addRelation(parent: string, child: string): void {
    const children = this.hierarchy.get(parent) || new Set();
    children.add(child);
    this.hierarchy.set(parent, children);

    const parents = this.parents.get(child) || new Set();
    parents.add(parent);
    this.parents.set(child, parents);
  }

  /**
   * Get all descendants of a key
   */
  getDescendants(key: string): Set<string> {
    const descendants = new Set<string>();
    const queue = [key];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = this.hierarchy.get(current);

      if (children) {
        children.forEach(child => {
          if (!descendants.has(child)) {
            descendants.add(child);
            queue.push(child);
          }
        });
      }
    }

    return descendants;
  }

  /**
   * Get all ancestors of a key
   */
  getAncestors(key: string): Set<string> {
    const ancestors = new Set<string>();
    const queue = [key];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const parents = this.parents.get(current);

      if (parents) {
        parents.forEach(parent => {
          if (!ancestors.has(parent)) {
            ancestors.add(parent);
            queue.push(parent);
          }
        });
      }
    }

    return ancestors;
  }

  /**
   * Remove a key from hierarchy
   */
  removeKey(key: string): void {
    // Remove from parent's children sets
    const parents = this.parents.get(key);
    if (parents) {
      parents.forEach(parent => {
        const children = this.hierarchy.get(parent);
        if (children) {
          children.delete(key);
        }
      });
    }

    // Remove from this key's children's parent sets
    const children = this.hierarchy.get(key);
    if (children) {
      children.forEach(child => {
        const childParents = this.parents.get(child);
        if (childParents) {
          childParents.delete(key);
        }
      });
    }

    this.hierarchy.delete(key);
    this.parents.delete(key);
  }

  /**
   * Clear hierarchy
   */
  clear(): void {
    this.hierarchy.clear();
    this.parents.clear();
  }
}

// ============================================================================
// Invalidation Engine
// ============================================================================

export class InvalidationEngine {
  private cache: MultiTierCache;
  private config: InvalidationConfig;
  private tagInvalidator: TagInvalidator;
  private ttlInvalidator: TTLInvalidator;
  private hierarchicalInvalidator: HierarchicalInvalidator;
  private rules: InvalidationRule[] = [];
  private eventQueue: InvalidationEvent[] = [];

  constructor(cache: MultiTierCache, config: InvalidationConfig) {
    this.cache = cache;
    this.config = config;
    this.tagInvalidator = new TagInvalidator();
    this.ttlInvalidator = new TTLInvalidator();
    this.hierarchicalInvalidator = new HierarchicalInvalidator();
  }

  /**
   * Invalidate by key
   */
  async invalidateByKey(key: string): Promise<InvalidationResult> {
    const startTime = Date.now();

    try {
      // Remove from all indexes
      this.tagInvalidator.removeKey(key);
      this.ttlInvalidator.removeExpiration(key);
      this.hierarchicalInvalidator.removeKey(key);

      // Delete from cache
      const deleted = await this.cache.delete(key);

      return {
        success: deleted,
        invalidatedKeys: [key],
        affectedTiers: [CacheTier.L1, CacheTier.L2, CacheTier.L3],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        invalidatedKeys: [],
        affectedTiers: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Invalidate by tag
   */
  async invalidateByTag(tag: string): Promise<InvalidationResult> {
    const startTime = Date.now();

    try {
      const keys = this.tagInvalidator.getKeysByTag(tag);
      const invalidatedKeys: string[] = [];

      // Process in batches
      const batchSize = this.config.batchSize;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async key => {
            const result = await this.invalidateByKey(key);
            if (result.success) {
              invalidatedKeys.push(key);
            }
          })
        );
      }

      return {
        success: true,
        invalidatedKeys,
        affectedTiers: [CacheTier.L1, CacheTier.L2, CacheTier.L3],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        invalidatedKeys: [],
        affectedTiers: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Invalidate by prefix
   */
  async invalidateByPrefix(prefix: string): Promise<InvalidationResult> {
    const startTime = Date.now();

    try {
      // Get all keys from cache (this would need to be implemented in MultiTierCache)
      // For now, we'll use a simplified approach

      const invalidatedKeys: string[] = [];

      // This is a placeholder - in reality, you'd need to scan all tiers
      // for keys matching the prefix

      return {
        success: true,
        invalidatedKeys,
        affectedTiers: [CacheTier.L1, CacheTier.L2, CacheTier.L3],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        invalidatedKeys: [],
        affectedTiers: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Invalidate by hierarchy
   */
  async invalidateHierarchy(key: string, direction: 'up' | 'down' | 'both' = 'both'): Promise<InvalidationResult> {
    const startTime = Date.now();

    try {
      const keysToInvalidate = new Set<string>();

      if (direction === 'down' || direction === 'both') {
        const descendants = this.hierarchicalInvalidator.getDescendants(key);
        descendants.forEach(k => keysToInvalidate.add(k));
      }

      if (direction === 'up' || direction === 'both') {
        const ancestors = this.hierarchicalInvalidator.getAncestors(key);
        ancestors.forEach(k => keysToInvalidate.add(k));
      }

      keysToInvalidate.add(key);

      const invalidatedKeys: string[] = [];

      await Promise.all(
        Array.from(keysToInvalidate).map(async k => {
          const result = await this.invalidateByKey(k);
          if (result.success) {
            invalidatedKeys.push(k);
          }
        })
      );

      return {
        success: true,
        invalidatedKeys,
        affectedTiers: [CacheTier.L1, CacheTier.L2, CacheTier.L3],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        invalidatedKeys: [],
        affectedTiers: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Invalidate expired entries
   */
  async invalidateExpired(): Promise<InvalidationResult> {
    const startTime = Date.now();

    try {
      const expiredKeys = this.ttlInvalidator.getExpiredKeys();
      const invalidatedKeys: string[] = [];

      await Promise.all(
        expiredKeys.map(async key => {
          const result = await this.invalidateByKey(key);
          if (result.success) {
            invalidatedKeys.push(key);
          }
        })
      );

      return {
        success: true,
        invalidatedKeys,
        affectedTiers: [CacheTier.L1, CacheTier.L2, CacheTier.L3],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        invalidatedKeys: [],
        affectedTiers: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Queue an invalidation event
   */
  queueEvent(event: InvalidationEvent): void {
    this.eventQueue.push(event);
  }

  /**
   * Process queued invalidation events
   */
  async processEvents(): Promise<InvalidationResult[]> {
    const results: InvalidationResult[] = [];
    const events = [...this.eventQueue];
    this.eventQueue = [];

    for (const event of events) {
      let result: InvalidationResult;

      switch (event.type) {
        case 'invalidate':
          if (event.tags && event.tags.length > 0) {
            result = await this.invalidateByTag(event.tags[0]);
          } else {
            result = await this.invalidateByKey(event.key);
          }
          break;

        case 'expire':
          result = await this.invalidateByKey(event.key);
          break;

        default:
          result = await this.invalidateByKey(event.key);
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Add tags to a key
   */
  addTags(key: string, tags: string[]): void {
    this.tagInvalidator.addTags(key, tags);
  }

  /**
   * Set TTL for a key
   */
  setTTL(key: string, ttl: number): void {
    this.ttlInvalidator.setExpiration(key, ttl);
  }

  /**
   * Add hierarchical relation
   */
  addHierarchy(parent: string, child: string): void {
    this.hierarchicalInvalidator.addRelation(parent, child);
  }

  /**
   * Add invalidation rule
   */
  addRule(rule: InvalidationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove invalidation rule
   */
  removeRule(id: string): void {
    this.rules = this.rules.filter(r => r.id !== id);
  }

  /**
   * Get statistics
   */
  getStats(): {
    tagIndex: ReturnType<TagInvalidator['getStats']>;
    ttlExpirations: number;
    hierarchyNodes: number;
    queuedEvents: number;
    rules: number;
  } {
    return {
      tagIndex: this.tagInvalidator.getStats(),
      ttlExpirations: this.ttlInvalidator.getExpiredKeys().length,
      hierarchyNodes: this.hierarchicalInvalidator['hierarchy'].size,
      queuedEvents: this.eventQueue.length,
      rules: this.rules.length,
    };
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.tagInvalidator.clear();
    this.ttlInvalidator.clear();
    this.hierarchicalInvalidator.clear();
    this.eventQueue = [];
    this.rules = [];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createInvalidationEngine(
  cache: MultiTierCache,
  config: InvalidationConfig
): InvalidationEngine {
  return new InvalidationEngine(cache, config);
}
