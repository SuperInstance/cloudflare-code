/**
 * Session Storage Strategy - Multi-tier session storage management
 *
 * Manages session storage across HOT (DO), WARM (KV), and COLD (R2) tiers
 * with intelligent promotion/demotion based on access patterns.
 */

import type { SessionData, StorageTier } from '../../types/index';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import { KVCache } from '../kv';
import { R2Storage } from '../r2';

export type Tier = 'hot' | 'warm' | 'cold';

export interface SessionStorageOptions {
  /**
   * HOT tier max age before demotion (default: 1 hour)
   */
  hotMaxAge?: number;

  /**
   * WARM tier max age before demotion (default: 7 days)
   */
  warmMaxAge?: number;

  /**
   * HOT tier access count threshold for promotion (default: 5)
   */
  hotAccessThreshold?: number;

  /**
   * WARM tier access count threshold for promotion (default: 3)
   */
  warmAccessThreshold?: number;

  /**
   * Enable automatic tier migration (default: true)
   */
  autoMigrate?: boolean;

  /**
   * Migration check interval in ms (default: 5 minutes)
   */
  migrationInterval?: number;
}

/**
 * Session Storage Strategy - Intelligent tier management
 *
 * Features:
 * - Automatic tier selection
 * - Promotion based on access patterns
 * - Demotion based on age and size
 * - Background migration
 * - Tier health monitoring
 */
export class SessionStorage {
  private sessionDO: DurableObjectNamespace;
  private kvCache: KVCache;
  private r2Storage: R2Storage;
  private options: Required<SessionStorageOptions>;

  // Track access patterns for migration decisions
  private accessPatterns: Map<string, {
    tier: Tier;
    accessCount: number;
    lastAccess: number;
    createdAt: number;
    size: number;
  }>;

  constructor(
    sessionDO: DurableObjectNamespace,
    kvCache: KVCache,
    r2Storage: R2Storage,
    options: SessionStorageOptions = {}
  ) {
    this.sessionDO = sessionDO;
    this.kvCache = kvCache;
    this.r2Storage = r2Storage;
    this.options = {
      hotMaxAge: options.hotMaxAge ?? 60 * 60 * 1000, // 1 hour
      warmMaxAge: options.warmMaxAge ?? 7 * 24 * 60 * 60 * 1000, // 7 days
      hotAccessThreshold: options.hotAccessThreshold ?? 5,
      warmAccessThreshold: options.warmAccessThreshold ?? 3,
      autoMigrate: options.autoMigrate ?? true,
      migrationInterval: options.migrationInterval ?? 5 * 60 * 1000, // 5 minutes
    };
    this.accessPatterns = new Map();
  }

  /**
   * Save session to specified tier
   */
  async save(
    session: SessionData,
    tier: Tier
  ): Promise<void> {
    const startTime = performance.now();

    try {
      switch (tier) {
        case 'hot':
          await this.saveToHot(session);
          break;
        case 'warm':
          await this.saveToWarm(session);
          break;
        case 'cold':
          await this.saveToCold(session);
          break;
      }

      // Record access pattern
      this.recordAccess(session.sessionId, tier, this.calculateSessionSize(session));

      const latency = performance.now() - startTime;
      console.debug(
        `Session saved to ${tier.toUpperCase()} tier: ${session.sessionId} - ${latency.toFixed(2)}ms`
      );
    } catch (error) {
      console.error(`Failed to save session to ${tier} tier:`, error);
      throw error;
    }
  }

  /**
   * Load session from appropriate tier
   * Tries HOT -> WARM -> COLD
   */
  async load(sessionId: string): Promise<SessionData | null> {
    const startTime = performance.now();

    try {
      // Try HOT tier first
      let session = await this.loadFromHot(sessionId);
      if (session) {
        this.recordAccess(sessionId, 'hot', this.calculateSessionSize(session));
        if (this.options.autoMigrate) {
          this.checkPromotion(sessionId, 'hot').catch(console.error);
        }
        return session;
      }

      // Try WARM tier
      session = await this.loadFromWarm(sessionId);
      if (session) {
        this.recordAccess(sessionId, 'warm', this.calculateSessionSize(session));
        // Promote to HOT if frequently accessed
        if (this.options.autoMigrate && this.shouldPromote(sessionId, 'warm')) {
          this.promote(sessionId, 'warm', 'hot').catch(console.error);
        }
        return session;
      }

      // Try COLD tier
      session = await this.loadFromCold(sessionId);
      if (session) {
        this.recordAccess(sessionId, 'cold', this.calculateSessionSize(session));
        // Promote to WARM if accessed
        if (this.options.autoMigrate) {
          this.promote(sessionId, 'cold', 'warm').catch(console.error);
        }
        return session;
      }

      return null;
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Migrate session from one tier to another
   */
  async migrate(
    sessionId: string,
    from: Tier,
    to: Tier
  ): Promise<{ success: boolean; latency: number; error?: string }> {
    const startTime = performance.now();

    try {
      // Get session from source tier
      let session: SessionData | null = null;

      switch (from) {
        case 'hot':
          session = await this.loadFromHot(sessionId);
          break;
        case 'warm':
          session = await this.loadFromWarm(sessionId);
          break;
        case 'cold':
          session = await this.loadFromCold(sessionId);
          break;
      }

      if (!session) {
        return {
          success: false,
          latency: performance.now() - startTime,
          error: 'Session not found in source tier',
        };
      }

      // Save to destination tier
      switch (to) {
        case 'hot':
          await this.saveToHot(session);
          break;
        case 'warm':
          await this.saveToWarm(session);
          break;
        case 'cold':
          await this.saveToCold(session);
          break;
      }

      // Delete from source tier if demoting
      if (this.isDemotion(from, to)) {
        await this.deleteFromTier(sessionId, from);
      }

      // Update access pattern
      const pattern = this.accessPatterns.get(sessionId);
      if (pattern) {
        pattern.tier = to;
        this.accessPatterns.set(sessionId, pattern);
      }

      const latency = performance.now() - startTime;
      console.debug(
        `Session migrated ${from.toUpperCase()} -> ${to.toUpperCase()}: ${sessionId} - ${latency.toFixed(2)}ms`
      );

      return { success: true, latency };
    } catch (error) {
      return {
        success: false,
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if session should be promoted
   */
  async shouldPromote(sessionId: string, currentTier: Tier): Promise<boolean> {
    const pattern = this.accessPatterns.get(sessionId);

    if (!pattern || pattern.tier !== currentTier) {
      return false;
    }

    const threshold =
      currentTier === 'cold'
        ? this.options.warmAccessThreshold
        : this.options.hotAccessThreshold;

    return pattern.accessCount >= threshold;
  }

  /**
   * Check if session should be demoted
   */
  async shouldDemote(sessionId: string): Promise<boolean> {
    const pattern = this.accessPatterns.get(sessionId);

    if (!pattern) {
      return false;
    }

    const now = Date.now();
    const age = now - pattern.lastAccess;

    // Check age-based demotion
    if (pattern.tier === 'hot' && age > this.options.hotMaxAge) {
      return true;
    }

    if (pattern.tier === 'warm' && age > this.options.warmMaxAge) {
      return true;
    }

    return false;
  }

  /**
   * Promote session to higher tier
   */
  async promote(
    sessionId: string,
    from: Tier,
    to: Tier
  ): Promise<void> {
    if (!this.isPromotion(from, to)) {
      throw new Error(`Invalid promotion: ${from} -> ${to}`);
    }

    const result = await this.migrate(sessionId, from, to);

    if (!result.success) {
      throw new Error(`Promotion failed: ${result.error}`);
    }
  }

  /**
   * Demote session to lower tier
   */
  async demote(
    sessionId: string,
    from: Tier,
    to: Tier
  ): Promise<void> {
    if (!this.isDemotion(from, to)) {
      throw new Error(`Invalid demotion: ${from} -> ${to}`);
    }

    const result = await this.migrate(sessionId, from, to);

    if (!result.success) {
      throw new Error(`Demotion failed: ${result.error}`);
    }
  }

  /**
   * Get storage tier for session
   */
  async getTier(sessionId: string): Promise<Tier | null> {
    const pattern = this.accessPatterns.get(sessionId);

    if (pattern) {
      return pattern.tier;
    }

    // Check each tier
    if (await this.existsInTier(sessionId, 'hot')) {
      return 'hot';
    }

    if (await this.existsInTier(sessionId, 'warm')) {
      return 'warm';
    }

    if (await this.existsInTier(sessionId, 'cold')) {
      return 'cold';
    }

    return null;
  }

  /**
   * Get tier statistics
   */
  async getTierStats(): Promise<{
    hot: { count: number; totalSize: number; avgAccessCount: number };
    warm: { count: number; totalSize: number; avgAccessCount: number };
    cold: { count: number; totalSize: number; avgAccessCount: number };
  }> {
    const stats = {
      hot: { count: 0, totalSize: 0, avgAccessCount: 0 },
      warm: { count: 0, totalSize: 0, avgAccessCount: 0 },
      cold: { count: 0, totalSize: 0, avgAccessCount: 0 },
    };

    for (const [sessionId, pattern] of this.accessPatterns.entries()) {
      const tierStats = stats[pattern.tier];
      tierStats.count++;
      tierStats.totalSize += pattern.size;
      tierStats.avgAccessCount += pattern.accessCount;
    }

    // Calculate averages
    for (const tier of ['hot', 'warm', 'cold'] as Tier[]) {
      const tierStats = stats[tier];
      if (tierStats.count > 0) {
        tierStats.avgAccessCount = Math.round(
          tierStats.avgAccessCount / tierStats.count
        );
      }
    }

    return stats;
  }

  /**
   * Run automatic migration policy
   */
  async runMigrationPolicy(): Promise<{
    promoted: number;
    demoted: number;
    errors: number;
  }> {
    if (!this.options.autoMigrate) {
      return { promoted: 0, demoted: 0, errors: 0 };
    }

    let promoted = 0;
    let demoted = 0;
    let errors = 0;

    for (const [sessionId, pattern] of this.accessPatterns.entries()) {
      try {
        // Check for promotion
        if (await this.shouldPromote(sessionId, pattern.tier)) {
          const targetTier = pattern.tier === 'cold' ? 'warm' : 'hot';
          await this.promote(sessionId, pattern.tier, targetTier);
          pattern.accessCount = 0; // Reset counter
          promoted++;
        }

        // Check for demotion
        if (await this.shouldDemote(sessionId)) {
          const targetTier = pattern.tier === 'hot' ? 'warm' : 'cold';
          await this.demote(sessionId, pattern.tier, targetTier);
          demoted++;
        }
      } catch (error) {
        console.error(`Migration failed for session ${sessionId}:`, error);
        errors++;
      }
    }

    return { promoted, demoted, errors };
  }

  // Private methods

  private async saveToHot(session: SessionData): Promise<void> {
    const stub = this.sessionDO.get(this.sessionDO.idFromName(session.sessionId));

    await stub.fetch(
      new Request(`https://do/${session.sessionId}`, {
        method: 'PUT',
        body: JSON.stringify(session),
      })
    );
  }

  private async saveToWarm(session: SessionData): Promise<void> {
    await this.kvCache.set(
      `session:${session.sessionId}`,
      session,
      60 * 60 * 24 * 7 // 7 days TTL
    );
  }

  private async saveToCold(session: SessionData): Promise<void> {
    await this.r2Storage.archiveSession(session);
  }

  private async loadFromHot(sessionId: string): Promise<SessionData | null> {
    try {
      const stub = this.sessionDO.get(this.sessionDO.idFromName(sessionId));
      const response = await stub.fetch(
        new Request(`https://do/${sessionId}`, { method: 'GET' })
      );

      if (response.status === 404) {
        return null;
      }

      const data = await response.json();
      return data.session as SessionData;
    } catch (error) {
      console.error(`Failed to load from HOT tier:`, error);
      return null;
    }
  }

  private async loadFromWarm(sessionId: string): Promise<SessionData | null> {
    return this.kvCache.get<SessionData>(`session:${sessionId}`);
  }

  private async loadFromCold(sessionId: string): Promise<SessionData | null> {
    const archives = await this.r2Storage.getSessionArchive(sessionId);

    if (archives.length > 0) {
      return archives[archives.length - 1]; // Return most recent
    }

    return null;
  }

  private async deleteFromTier(sessionId: string, tier: Tier): Promise<void> {
    switch (tier) {
      case 'hot':
        const stub = this.sessionDO.get(this.sessionDO.idFromName(sessionId));
        await stub.fetch(
          new Request(`https://do/${sessionId}`, { method: 'DELETE' })
        );
        break;
      case 'warm':
        await this.kvCache.delete(`session:${sessionId}`);
        break;
      case 'cold':
        // Delete from R2
        const objects = await this.r2Storage.list(`sessions/${sessionId}/`);
        for (const object of objects.objects) {
          await this.r2Storage.delete(object.key);
        }
        break;
    }
  }

  private async existsInTier(sessionId: string, tier: Tier): Promise<boolean> {
    switch (tier) {
      case 'hot':
        const session = await this.loadFromHot(sessionId);
        return session !== null;
      case 'warm':
        return this.kvCache.exists(`session:${sessionId}`);
      case 'cold':
        const objects = await this.r2Storage.list(`sessions/${sessionId}/`);
        return objects.objects.length > 0;
    }
  }

  private recordAccess(sessionId: string, tier: Tier, size: number): void {
    const pattern = this.accessPatterns.get(sessionId);

    if (pattern) {
      pattern.accessCount++;
      pattern.lastAccess = Date.now();
      this.accessPatterns.set(sessionId, pattern);
    } else {
      this.accessPatterns.set(sessionId, {
        tier,
        accessCount: 1,
        lastAccess: Date.now(),
        createdAt: Date.now(),
        size,
      });
    }
  }

  private async checkPromotion(sessionId: string, currentTier: Tier): Promise<void> {
    if (await this.shouldPromote(sessionId, currentTier)) {
      const targetTier = currentTier === 'cold' ? 'warm' : 'hot';
      await this.promote(sessionId, currentTier, targetTier);

      // Reset access counter
      const pattern = this.accessPatterns.get(sessionId);
      if (pattern) {
        pattern.accessCount = 0;
        this.accessPatterns.set(sessionId, pattern);
      }
    }
  }

  private isPromotion(from: Tier, to: Tier): boolean {
    const tierOrder = ['cold', 'warm', 'hot'];
    return tierOrder.indexOf(to) > tierOrder.indexOf(from);
  }

  private isDemotion(from: Tier, to: Tier): boolean {
    const tierOrder = ['cold', 'warm', 'hot'];
    return tierOrder.indexOf(to) < tierOrder.indexOf(from);
  }

  private calculateSessionSize(session: SessionData): number {
    const json = JSON.stringify(session);
    return json.length * 2; // UTF-16 encoding
  }
}

/**
 * Helper function to create SessionStorage instance
 */
export function createSessionStorage(
  sessionDO: DurableObjectNamespace,
  kvCache: KVCache,
  r2Storage: R2Storage,
  options?: SessionStorageOptions
): SessionStorage {
  return new SessionStorage(sessionDO, kvCache, r2Storage, options);
}
