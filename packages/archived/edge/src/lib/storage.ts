/**
 * Storage Manager - Multi-Tier Storage Orchestration
 *
 * Manages data across HOT (DO), WARM (KV), and COLD (R2) tiers
 * with automatic migration based on access patterns and policies.
 */

import type {
  SessionData,
  MemoryEntry,
  UserPreferences,
  Data,
  StorageTier,
  StorageResult,
  MigrationResult,
} from '../types/index';

import { KVCache } from './kv';
import { R2Storage } from './r2';
import type { SessionDO } from '../do/session';

export interface StorageManagerOptions {
  /**
   * Maximum age for HOT tier before migration (default: 1 hour)
   */
  hotMaxAge?: number;

  /**
   * Maximum age for WARM tier before migration (default: 30 days)
   */
  warmMaxAge?: number;

  /**
   * Enable automatic migration
   */
  autoMigrate?: boolean;

  /**
   * Access count threshold for promotion (default: 5)
   */
  promotionThreshold?: number;
}

/**
 * Storage Manager - Unified API for multi-tier storage
 *
 * Features:
 * - Automatic tier selection based on data type
 * - Intelligent migration between tiers
 * - Cache promotion/demotion based on access patterns
 * - Unified get/set API with tier hints
 * - Background migration for performance
 */
export class StorageManager {
  private sessionDO: DurableObjectNamespace;
  private kvCache: KVCache;
  private r2Storage: R2Storage;
  private options: Required<StorageManagerOptions>;

  // Track access patterns for migration decisions
  private accessPatterns: Map<string, {
    tier: StorageTier;
    accessCount: number;
    lastAccess: number;
    createdAt: number;
  }>;

  constructor(
    sessionDO: DurableObjectNamespace,
    kvCache: KVCache,
    r2Storage: R2Storage,
    options: StorageManagerOptions = {}
  ) {
    this.sessionDO = sessionDO;
    this.kvCache = kvCache;
    this.r2Storage = r2Storage;
    this.options = {
      hotMaxAge: options.hotMaxAge ?? 60 * 60 * 1000, // 1 hour
      warmMaxAge: options.warmMaxAge ?? 30 * 24 * 60 * 60 * 1000, // 30 days
      autoMigrate: options.autoMigrate ?? true,
      promotionThreshold: options.promotionThreshold ?? 5,
    };
    this.accessPatterns = new Map();
  }

  /**
   * Get data from appropriate tier
   * Tries HOT -> WARM -> COLD
   */
  async get(key: string, type: 'session' | 'memory' | 'user' | 'data'): Promise<StorageResult> {
    const startTime = performance.now();

    try {
      // Try HOT tier first
      const hot = await this.getFromHot(key, type);
      if (hot) {
        this.recordAccess(key, 'hot');
        if (this.options.autoMigrate) {
          this.scheduleMigrationIfNeeded(key, type);
        }
        return {
          success: true,
          data: hot,
          tier: 'hot',
          latency: performance.now() - startTime,
        };
      }

      // Try WARM tier
      const warm = await this.getFromWarm(key, type);
      if (warm) {
        this.recordAccess(key, 'warm');

        // Promote to HOT if frequently accessed
        if (this.options.autoMigrate && this.shouldPromote(key)) {
          this.promote(key, 'warm', 'hot', type).catch(console.error);
        }

        return {
          success: true,
          data: warm,
          tier: 'warm',
          latency: performance.now() - startTime,
        };
      }

      // Try COLD tier
      const cold = await this.getFromCold(key, type);
      if (cold) {
        this.recordAccess(key, 'cold');

        // Promote to WARM if accessed
        if (this.options.autoMigrate) {
          this.promote(key, 'cold', 'warm', type).catch(console.error);
        }

        return {
          success: true,
          data: cold,
          tier: 'cold',
          latency: performance.now() - startTime,
        };
      }

      return {
        success: false,
        data: null,
        tier: 'hot',
        latency: performance.now() - startTime,
        error: 'Key not found in any tier',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        tier: 'hot',
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Set data in specified tier
   */
  async set(
    key: string,
    data: Data,
    type: 'session' | 'memory' | 'user' | 'data',
    tier: StorageTier = 'hot'
  ): Promise<StorageResult> {
    const startTime = performance.now();

    try {
      switch (tier) {
        case 'hot':
          await this.setToHot(key, data, type);
          break;
        case 'warm':
          await this.setToWarm(key, data, type);
          break;
        case 'cold':
          await this.setToCold(key, data, type);
          break;
      }

      // Record access pattern
      this.accessPatterns.set(key, {
        tier,
        accessCount: 0,
        lastAccess: Date.now(),
        createdAt: Date.now(),
      });

      return {
        success: true,
        data,
        tier,
        latency: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        tier,
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Migrate data from one tier to another
   */
  async migrate(
    key: string,
    from: StorageTier,
    to: StorageTier,
    type: 'session' | 'memory' | 'user' | 'data'
  ): Promise<MigrationResult> {
    const startTime = performance.now();

    try {
      // Get data from source tier
      let data: Data | null = null;
      switch (from) {
        case 'hot':
          data = await this.getFromHot(key, type);
          break;
        case 'warm':
          data = await this.getFromWarm(key, type);
          break;
        case 'cold':
          data = await this.getFromCold(key, type);
          break;
      }

      if (!data) {
        return {
          success: false,
          from,
          to,
          key,
          latency: performance.now() - startTime,
          error: 'Data not found in source tier',
        };
      }

      // Set data in destination tier
      switch (to) {
        case 'hot':
          await this.setToHot(key, data, type);
          break;
        case 'warm':
          await this.setToWarm(key, data, type);
          break;
        case 'cold':
          await this.setToCold(key, data, type);
          break;
      }

      // Delete from source tier (if not promoting)
      if (this.isDemotion(from, to)) {
        await this.deleteFromTier(key, from, type);
      }

      // Update access pattern
      const pattern = this.accessPatterns.get(key);
      if (pattern) {
        pattern.tier = to;
        this.accessPatterns.set(key, pattern);
      }

      return {
        success: true,
        from,
        to,
        key,
        latency: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        from,
        to,
        key,
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Promote data to higher tier (faster access)
   */
  async promote(
    key: string,
    from: StorageTier,
    to: StorageTier,
    type: 'session' | 'memory' | 'user' | 'data'
  ): Promise<MigrationResult> {
    if (!this.isPromotion(from, to)) {
      throw new Error(`Invalid promotion: ${from} -> ${to}`);
    }

    return this.migrate(key, from, to, type);
  }

  /**
   * Demote data to lower tier (slower access, cheaper storage)
   */
  async demote(
    key: string,
    from: StorageTier,
    to: StorageTier,
    type: 'session' | 'memory' | 'user' | 'data'
  ): Promise<MigrationResult> {
    if (!this.isDemotion(from, to)) {
      throw new Error(`Invalid demotion: ${from} -> ${to}`);
    }

    return this.migrate(key, from, to, type);
  }

  /**
   * Delete data from all tiers
   */
  async delete(key: string, type: 'session' | 'memory' | 'user' | 'data'): Promise<void> {
    await Promise.all([
      this.deleteFromTier(key, 'hot', type),
      this.deleteFromTier(key, 'warm', type),
      this.deleteFromTier(key, 'cold', type),
    ]);

    this.accessPatterns.delete(key);
  }

  /**
   * Check if key exists in any tier
   */
  async exists(key: string, type: 'session' | 'memory' | 'user' | 'data'): Promise<{
    exists: boolean;
    tier?: StorageTier;
  }> {
    const hot = await this.existsInTier(key, 'hot', type);
    if (hot) return { exists: true, tier: 'hot' };

    const warm = await this.existsInTier(key, 'warm', type);
    if (warm) return { exists: true, tier: 'warm' };

    const cold = await this.existsInTier(key, 'cold', type);
    if (cold) return { exists: true, tier: 'cold' };

    return { exists: false };
  }

  /**
   * Get statistics across all tiers
   */
  async getStats(): Promise<{
    hot: { sessionCount: number; memoryUsage: number };
    warm: { keyCount: number; totalSize: number };
    cold: { objectCount: number; totalSize: number };
    totalAccessPatterns: number;
  }> {
    // Note: Some stats require actual DO calls, this is simplified
    return {
      hot: {
        sessionCount: 0, // Would need DO call
        memoryUsage: 0, // Would need DO call
      },
      warm: await this.kvCache.getStats(),
      cold: await this.r2Storage.getStats(),
      totalAccessPatterns: this.accessPatterns.size,
    };
  }

  /**
   * Run automatic migration based on policies
   */
  async runMigrationPolicy(): Promise<{
    migrated: number;
    errors: number;
  }> {
    if (!this.options.autoMigrate) {
      return { migrated: 0, errors: 0 };
    }

    let migrated = 0;
    let errors = 0;

    const now = Date.now();

    for (const [key, pattern] of this.accessPatterns.entries()) {
      try {
        // HOT -> WARM migration (age-based)
        if (pattern.tier === 'hot') {
          const age = now - pattern.lastAccess;
          if (age > this.options.hotMaxAge) {
            await this.demote(key, 'hot', 'warm', 'data');
            migrated++;
          }
        }

        // WARM -> COLD migration (age-based)
        if (pattern.tier === 'warm') {
          const age = now - pattern.lastAccess;
          if (age > this.options.warmMaxAge) {
            await this.demote(key, 'warm', 'cold', 'data');
            migrated++;
          }
        }

        // COLD -> WARM promotion (access-based)
        if (pattern.tier === 'cold' || pattern.tier === 'warm') {
          if (pattern.accessCount >= this.options.promotionThreshold) {
            const targetTier = pattern.tier === 'cold' ? 'warm' : 'hot';
            await this.promote(key, pattern.tier, targetTier, 'data');
            pattern.accessCount = 0; // Reset counter
            migrated++;
          }
        }
      } catch (error) {
        console.error(`Migration failed for key ${key}:`, error);
        errors++;
      }
    }

    return { migrated, errors };
  }

  // Private methods

  private async getFromHot(
    key: string,
    type: string
  ): Promise<Data | null> {
    if (type === 'session') {
      const stub = this.sessionDO.get(this.sessionDO.idFromName(key));
      const response = await stub.fetch(
        new Request(`https://do/${key}`, { method: 'GET' })
      );
      if (response.ok) {
        const data = await response.json();
        return data.session;
      }
    }
    return null;
  }

  private async getFromWarm(
    key: string,
    type: string
  ): Promise<Data | null> {
    const kvKey = this.getKVKey(key, type);
    return this.kvCache.get(kvKey);
  }

  private async getFromCold(
    key: string,
    type: string
  ): Promise<Data | null> {
    const r2Key = this.getR2Key(key, type);
    return this.r2Storage.getJSON(r2Key);
  }

  private async setToHot(
    key: string,
    data: Data,
    type: string
  ): Promise<void> {
    if (type === 'session') {
      const stub = this.sessionDO.get(this.sessionDO.idFromName(key));
      await stub.fetch(
        new Request(`https://do/${key}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      );
    } else {
      // For non-session data, HOT tier is just in-memory Map
      // This would need a different implementation
      throw new Error('HOT tier only supports session data');
    }
  }

  private async setToWarm(
    key: string,
    data: Data,
    type: string
  ): Promise<void> {
    const kvKey = this.getKVKey(key, type);
    const ttl = type === 'user' ? 60 * 60 * 24 * 30 : undefined; // 30 days for user prefs
    await this.kvCache.set(kvKey, data, ttl);
  }

  private async setToCold(
    key: string,
    data: Data,
    type: string
  ): Promise<void> {
    const r2Key = this.getR2Key(key, type);
    await this.r2Storage.put(r2Key, data, { type });
  }

  private async deleteFromTier(
    key: string,
    tier: StorageTier,
    type: string
  ): Promise<void> {
    switch (tier) {
      case 'hot':
        if (type === 'session') {
          const stub = this.sessionDO.get(this.sessionDO.idFromName(key));
          await stub.fetch(
            new Request(`https://do/${key}`, { method: 'DELETE' })
          );
        }
        break;
      case 'warm':
        const kvKey = this.getKVKey(key, type);
        await this.kvCache.delete(kvKey);
        break;
      case 'cold':
        const r2Key = this.getR2Key(key, type);
        await this.r2Storage.delete(r2Key);
        break;
    }
  }

  private async existsInTier(
    key: string,
    tier: StorageTier,
    type: string
  ): Promise<boolean> {
    switch (tier) {
      case 'hot':
        if (type === 'session') {
          const stub = this.sessionDO.get(this.sessionDO.idFromName(key));
          const response = await stub.fetch(
            new Request(`https://do/${key}`, { method: 'GET' })
          );
          return response.ok;
        }
        return false;
      case 'warm':
        const kvKey = this.getKVKey(key, type);
        return this.kvCache.exists(kvKey);
      case 'cold':
        const r2Key = this.getR2Key(key, type);
        return this.r2Storage.exists(r2Key);
    }
  }

  private getKVKey(key: string, type: string): string {
    return `${type}:${key}`;
  }

  private getR2Key(key: string, type: string): string {
    return `${type}/${key}.json`;
  }

  private recordAccess(key: string, tier: StorageTier): void {
    const pattern = this.accessPatterns.get(key);
    if (pattern) {
      pattern.accessCount++;
      pattern.lastAccess = Date.now();
      this.accessPatterns.set(key, pattern);
    }
  }

  private shouldPromote(key: string): boolean {
    const pattern = this.accessPatterns.get(key);
    return pattern ? pattern.accessCount >= this.options.promotionThreshold : false;
  }

  private isPromotion(from: StorageTier, to: StorageTier): boolean {
    const tierOrder = ['cold', 'warm', 'hot'];
    return tierOrder.indexOf(to) > tierOrder.indexOf(from);
  }

  private isDemotion(from: StorageTier, to: StorageTier): boolean {
    const tierOrder = ['cold', 'warm', 'hot'];
    return tierOrder.indexOf(to) < tierOrder.indexOf(from);
  }

  private scheduleMigrationIfNeeded(key: string, type: string): void {
    // This would schedule a background migration check
    // Implementation depends on runtime capabilities
  }
}

/**
 * Helper function to create StorageManager instance
 */
export function createStorageManager(
  sessionDO: DurableObjectNamespace,
  kvCache: KVCache,
  r2Storage: R2Storage,
  options?: StorageManagerOptions
): StorageManager {
  return new StorageManager(sessionDO, kvCache, r2Storage, options);
}
