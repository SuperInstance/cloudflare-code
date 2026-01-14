/**
 * Cross-DO Cache Coherence
 *
 * Maintains cache consistency across multiple Durable Object instances.
 * Implements a distributed invalidation protocol with eventual consistency.
 *
 * Goals:
 * - Keep caches coherent across DO instances
 * - Minimize invalidation latency (<100ms)
 * - Handle network partitions gracefully
 * - Support broadcast and targeted invalidations
 *
 * Architecture:
 * 1. Invalidation Protocol: DO-to-DO messaging for invalidations
 * 2. Versioning: Track cache entry versions
 * 3. Conflict Resolution: Last-write-wins with vector clocks
 * 4. Anti-Entropy: Periodic synchronization
 *
 * Message Types:
 * - INVALIDATE: Invalidate specific cache entries
 * - UPDATE: Update cache entries with new values
 * - SYNC: Synchronize cache state
 * - QUERY: Query cache state from other DOs
 */

import type { DurableObjectState } from '@cloudflare/workers-types';

export interface CacheInvalidationMessage {
  type: 'invalidate' | 'update' | 'sync' | 'query';
  id: string;
  timestamp: number;
  sourceId: string;
  targetId?: string; // Optional: specific target DO
  keys: string[];
  versions?: Map<string, number>; // Version numbers for each key
  payload?: Record<string, unknown>; // Optional: new values for updates
  ttl?: number; // Time-to-live for invalidation
}

export interface CacheEntryVersion {
  key: string;
  version: number;
  timestamp: number;
  sourceId: string;
}

export interface VectorClock {
  [sourceId: string]: number;
}

export interface CacheCoherenceOptions {
  /**
   * Enable cache coherence
   * @default true
   */
  enableCoherence?: boolean;

  /**
   * Invalidation timeout (ms)
   * @default 5000
   */
  invalidationTimeout?: number;

  /**
   * Maximum retry attempts for invalidations
   * @default 3
   */
  maxInvalidationRetries?: number;

  /**
   * Enable anti-entropy (periodic sync)
   * @default true
   */
  enableAntiEntropy?: boolean;

  /**
   * Anti-entropy interval (ms)
   * @default 60000 (1 minute)
   */
  antiEntropyInterval?: number;

  /**
   * Version history size
   * @default 1000
   */
  versionHistorySize?: number;

  /**
   * Callback for local cache invalidation
   */
  onInvalidate?: (keys: string[]) => void | Promise<void>;

  /**
   * Callback for local cache update
   */
  onUpdate?: (entries: Map<string, unknown>) => void | Promise<void>;

  /**
   * Callback for broadcasting messages
   */
  onBroadcast?: (message: CacheInvalidationMessage) => void | Promise<void>;
}

export interface CoherenceStats {
  invalidationsReceived: number;
  invalidationsSent: number;
  invalidationsFailed: number;
  updatesReceived: number;
  updatesSent: number;
  syncsReceived: number;
  syncsSent: number;
  avgInvalidationLatency: number;
  antiEntropyRuns: number;
  conflictsDetected: number;
  conflictsResolved: number;
}

/**
 * Cache Coherence Manager
 *
 * Manages cache coherence across DO instances.
 */
export class CacheCoherenceManager {
  private options: Required<CacheCoherenceOptions>;
  private state: DurableObjectState;
  private sourceId: string;
  private versionMap: Map<string, CacheEntryVersion>;
  private vectorClock: VectorClock;
  private pendingInvalidations: Map<string, CacheInvalidationMessage>;
  private stats: CoherenceStats;
  private lastAntiEntropy: number;
  private antiEntropyTimer: number | null;

  constructor(state: DurableObjectState, options: CacheCoherenceOptions = {}) {
    this.state = state;
    this.options = {
      enableCoherence: options.enableCoherence ?? true,
      invalidationTimeout: options.invalidationTimeout ?? 5000,
      maxInvalidationRetries: options.maxInvalidationRetries ?? 3,
      enableAntiEntropy: options.enableAntiEntropy ?? true,
      antiEntropyInterval: options.antiEntropyInterval ?? 60000,
      versionHistorySize: options.versionHistorySize ?? 1000,
      onInvalidate: options.onInvalidate!,
      onUpdate: options.onUpdate!,
      onBroadcast: options.onBroadcast!,
    };

    this.sourceId = this.state.id.toString();
    this.versionMap = new Map();
    this.vectorClock = {};
    this.pendingInvalidations = new Map();

    this.stats = {
      invalidationsReceived: 0,
      invalidationsSent: 0,
      invalidationsFailed: 0,
      updatesReceived: 0,
      updatesSent: 0,
      syncsReceived: 0,
      syncsSent: 0,
      avgInvalidationLatency: 0,
      antiEntropyRuns: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
    };

    this.lastAntiEntropy = Date.now();
    this.antiEntropyTimer = null;

    // Load from storage
    this.loadFromStorage();

    // Start anti-entropy timer
    if (this.options.enableAntiEntropy) {
      this.startAntiEntropyTimer();
    }
  }

  /**
   * Invalidate cache entries across all DOs
   *
   * @param keys - Keys to invalidate
   * @param targetId - Optional target DO ID (null = broadcast)
   * @returns true if invalidation was initiated
   */
  async invalidate(keys: string[], targetId?: string): Promise<boolean> {
    if (!this.options.enableCoherence) {
      return false;
    }

    // Update local version map
    for (const key of keys) {
      const existing = this.versionMap.get(key);
      const newVersion = (existing?.version ?? 0) + 1;

      this.versionMap.set(key, {
        key,
        version: newVersion,
        timestamp: Date.now(),
        sourceId: this.sourceId,
      });

      // Update vector clock
      this.vectorClock[this.sourceId] = Math.max(
        this.vectorClock[this.sourceId] ?? 0,
        newVersion
      );
    }

    // Create invalidation message
    const message: CacheInvalidationMessage = {
      type: 'invalidate',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      sourceId: this.sourceId,
      targetId,
      keys,
      versions: new Map(
        keys.map(key => {
          const version = this.versionMap.get(key)!;
          return [key, version.version];
        })
      ),
      ttl: this.options.invalidationTimeout,
    };

    // Track pending invalidation
    this.pendingInvalidations.set(message.id, message);

    // Invalidate locally first
    if (this.options.onInvalidate) {
      try {
        await this.options.onInvalidate(keys);
      } catch (error) {
        console.error('Local invalidation failed:', error);
      }
    }

    // Broadcast to other DOs
    if (this.options.onBroadcast) {
      try {
        await this.options.onBroadcast(message);
        this.stats.invalidationsSent++;
      } catch (error) {
        console.error('Failed to broadcast invalidation:', error);
        this.stats.invalidationsFailed++;
        return false;
      }
    }

    return true;
  }

  /**
   * Update cache entries across all DOs
   *
   * @param entries - Entries to update
   * @param targetId - Optional target DO ID (null = broadcast)
   * @returns true if update was initiated
   */
  async update(entries: Map<string, unknown>, targetId?: string): Promise<boolean> {
    if (!this.options.enableCoherence) {
      return false;
    }

    const keys = Array.from(entries.keys());

    // Update local version map
    for (const key of keys) {
      const existing = this.versionMap.get(key);
      const newVersion = (existing?.version ?? 0) + 1;

      this.versionMap.set(key, {
        key,
        version: newVersion,
        timestamp: Date.now(),
        sourceId: this.sourceId,
      });

      // Update vector clock
      this.vectorClock[this.sourceId] = Math.max(
        this.vectorClock[this.sourceId] ?? 0,
        newVersion
      );
    }

    // Create update message
    const message: CacheInvalidationMessage = {
      type: 'update',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      sourceId: this.sourceId,
      targetId,
      keys,
      versions: new Map(
        keys.map(key => {
          const version = this.versionMap.get(key)!;
          return [key, version.version];
        })
      ),
      payload: Object.fromEntries(entries),
      ttl: this.options.invalidationTimeout,
    };

    // Update locally first
    if (this.options.onUpdate) {
      try {
        await this.options.onUpdate(entries);
      } catch (error) {
        console.error('Local update failed:', error);
      }
    }

    // Broadcast to other DOs
    if (this.options.onBroadcast) {
      try {
        await this.options.onBroadcast(message);
        this.stats.updatesSent++;
      } catch (error) {
        console.error('Failed to broadcast update:', error);
        this.stats.invalidationsFailed++;
        return false;
      }
    }

    return true;
  }

  /**
   * Handle incoming invalidation message
   *
   * @param message - Invalidation message
   */
  async handleInvalidation(message: CacheInvalidationMessage): Promise<void> {
    const startTime = Date.now();

    // Check if message is for us
    if (message.targetId && message.targetId !== this.sourceId) {
      return; // Not for us
    }

    // Check if message is expired
    if (message.ttl && Date.now() - message.timestamp > message.ttl) {
      return; // Expired
    }

    // Process based on message type
    switch (message.type) {
      case 'invalidate':
        await this.processInvalidation(message);
        this.stats.invalidationsReceived++;
        break;

      case 'update':
        await this.processUpdate(message);
        this.stats.updatesReceived++;
        break;

      case 'sync':
        await this.processSync(message);
        this.stats.syncsReceived++;
        break;

      case 'query':
        await this.processQuery(message);
        break;
    }

    // Update stats
    const latency = Date.now() - startTime;
    this.stats.avgInvalidationLatency =
      (this.stats.avgInvalidationLatency * (this.stats.invalidationsReceived - 1) + latency) /
      this.stats.invalidationsReceived;

    // Save to storage
    await this.saveToStorage();
  }

  /**
   * Request sync from other DOs
   *
   * @param targetId - Optional target DO ID (null = broadcast)
   */
  async requestSync(targetId?: string): Promise<void> {
    const message: CacheInvalidationMessage = {
      type: 'sync',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      sourceId: this.sourceId,
      targetId,
      keys: Array.from(this.versionMap.keys()),
      versions: new Map(
        Array.from(this.versionMap.entries()).map(([key, version]) => [key, version.version])
      ),
    };

    if (this.options.onBroadcast) {
      await this.options.onBroadcast(message);
      this.stats.syncsSent++;
    }
  }

  /**
   * Get coherence statistics
   */
  getStats(): CoherenceStats {
    return { ...this.stats };
  }

  /**
   * Get version map
   */
  getVersionMap(): Map<string, CacheEntryVersion> {
    return new Map(this.versionMap);
  }

  /**
   * Get vector clock
   */
  getVectorClock(): VectorClock {
    return { ...this.vectorClock };
  }

  /**
   * Clear all versions
   */
  clearVersions(): void {
    this.versionMap.clear();
    this.vectorClock = {};
  }

  /**
   * Process invalidation message
   *
   * @private
   */
  private async processInvalidation(message: CacheInvalidationMessage): Promise<void> {
    // Check for conflicts using vector clocks
    const conflicts = this.detectConflicts(message);

    if (conflicts.length > 0) {
      this.stats.conflictsDetected += conflicts.length;
      this.resolveConflicts(conflicts, message);
    }

    // Update version map
    if (message.versions) {
      for (const [key, version] of message.versions.entries()) {
        const existing = this.versionMap.get(key);

        // Update if incoming version is higher
        if (!existing || version > existing.version) {
          this.versionMap.set(key, {
            key,
            version,
            timestamp: message.timestamp,
            sourceId: message.sourceId,
          });
        }
      }
    }

    // Update vector clock
    this.updateVectorClock(message.sourceId, message.versions);

    // Invalidate local cache
    if (this.options.onInvalidate) {
      try {
        await this.options.onInvalidate(message.keys);
      } catch (error) {
        console.error('Local invalidation failed:', error);
      }
    }
  }

  /**
   * Process update message
   *
   * @private
   */
  private async processUpdate(message: CacheInvalidationMessage): Promise<void> {
    // Check for conflicts
    const conflicts = this.detectConflicts(message);

    if (conflicts.length > 0) {
      this.stats.conflictsDetected += conflicts.length;
      this.resolveConflicts(conflicts, message);
    }

    // Update version map
    if (message.versions) {
      for (const [key, version] of message.versions.entries()) {
        const existing = this.versionMap.get(key);

        // Update if incoming version is higher
        if (!existing || version > existing.version) {
          this.versionMap.set(key, {
            key,
            version,
            timestamp: message.timestamp,
            sourceId: message.sourceId,
          });
        }
      }
    }

    // Update vector clock
    this.updateVectorClock(message.sourceId, message.versions);

    // Update local cache
    if (message.payload && this.options.onUpdate) {
      try {
        const entries = new Map(Object.entries(message.payload));
        await this.options.onUpdate(entries);
      } catch (error) {
        console.error('Local update failed:', error);
      }
    }
  }

  /**
   * Process sync message
   *
   * @private
   */
  private async processSync(message: CacheInvalidationMessage): Promise<void> {
    // Compare versions
    const ourVersions = new Map(
      Array.from(this.versionMap.entries()).map(([key, version]) => [key, version.version])
    );

    const theirVersions = message.versions ?? new Map();

    // Find entries we're missing
    const missingKeys: string[] = [];
    for (const [key, theirVersion] of theirVersions.entries()) {
      const ourVersion = ourVersions.get(key);

      if (!ourVersion || theirVersion > ourVersion) {
        missingKeys.push(key);
      }
    }

    // Find entries they're missing
    const outdatedKeys: string[] = [];
    for (const [key, ourVersion] of ourVersions.entries()) {
      const theirVersion = theirVersions.get(key);

      if (!theirVersion || ourVersion > theirVersion) {
        outdatedKeys.push(key);
      }
    }

    // Respond with our updates if they're missing data
    if (outdatedKeys.length > 0 && this.options.onBroadcast) {
      const response: CacheInvalidationMessage = {
        type: 'update',
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        sourceId: this.sourceId,
        targetId: message.sourceId,
        keys: outdatedKeys,
        versions: new Map(
          outdatedKeys.map(key => {
            const version = this.versionMap.get(key)!;
            return [key, version.version];
          })
        ),
      };

      await this.options.onBroadcast(response);
    }
  }

  /**
   * Process query message
   *
   * @private
   */
  private async processQuery(message: CacheInvalidationMessage): Promise<void> {
    // Respond with version map
    if (this.options.onBroadcast) {
      const response: CacheInvalidationMessage = {
        type: 'sync',
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        sourceId: this.sourceId,
        targetId: message.sourceId,
        keys: Array.from(this.versionMap.keys()),
        versions: new Map(
          Array.from(this.versionMap.entries()).map(([key, version]) => [key, version.version])
        ),
      };

      await this.options.onBroadcast(response);
    }
  }

  /**
   * Detect conflicts using vector clocks
   *
   * @private
   */
  private detectConflicts(message: CacheInvalidationMessage): string[] {
    const conflicts: string[] = [];

    if (!message.versions) {
      return conflicts;
    }

    for (const [key, incomingVersion] of message.versions.entries()) {
      const existing = this.versionMap.get(key);

      if (existing && existing.sourceId !== message.sourceId) {
        // Check vector clocks
        const existingClock = this.vectorClock[existing.sourceId] ?? 0;
        const incomingClock = this.vectorClock[message.sourceId] ?? 0;

        // If both have updated the key and versions are concurrent
        if (existing.version === incomingVersion && existingClock === incomingClock) {
          conflicts.push(key);
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts (last-write-wins)
   *
   * @private
   */
  private resolveConflicts(conflicts: string[], message: CacheInvalidationMessage): void {
    for (const key of conflicts) {
      const existing = this.versionMap.get(key);
      const incomingVersion = message.versions?.get(key);

      if (existing && incomingVersion !== undefined) {
        // Last-write-wins: use the most recent timestamp
        if (message.timestamp > existing.timestamp) {
          this.versionMap.set(key, {
            key,
            version: incomingVersion,
            timestamp: message.timestamp,
            sourceId: message.sourceId,
          });

          this.stats.conflictsResolved++;
        }
      }
    }
  }

  /**
   * Update vector clock
   *
   * @private
   */
  private updateVectorClock(sourceId: string, versions?: Map<string, number>): void {
    if (!versions) {
      return;
    }

    const maxVersion = Math.max(...versions.values());
    this.vectorClock[sourceId] = Math.max(
      this.vectorClock[sourceId] ?? 0,
      maxVersion
    );
  }

  /**
   * Start anti-entropy timer
   *
   * @private
   */
  private startAntiEntropyTimer(): void {
    if (this.antiEntropyTimer !== null) {
      return;
    }

    this.antiEntropyTimer = setInterval(async () => {
      await this.runAntiEntropy();
    }, this.options.antiEntropyInterval) as unknown as number;
  }

  /**
   * Run anti-entropy sync
   *
   * @private
   */
  private async runAntiEntropy(): Promise<void> {
    if (!this.options.enableAntiEntropy) {
      return;
    }

    const now = Date.now();
    if (now - this.lastAntiEntropy < this.options.antiEntropyInterval) {
      return;
    }

    this.stats.antiEntropyRuns++;
    this.lastAntiEntropy = now;

    // Request sync from other DOs
    await this.requestSync();

    // Cleanup old versions
    this.cleanupOldVersions();

    // Save to storage
    await this.saveToStorage();
  }

  /**
   * Cleanup old versions
   *
   * @private
   */
  private cleanupOldVersions(): void {
    const now = Date.now();
    const cutoff = now - (7 * 24 * 60 * 60 * 1000); // 7 days

    // Remove versions older than cutoff
    for (const [key, version] of this.versionMap.entries()) {
      if (version.timestamp < cutoff) {
        this.versionMap.delete(key);
      }
    }

    // Limit version map size
    if (this.versionMap.size > this.options.versionHistorySize) {
      const sorted = Array.from(this.versionMap.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp);

      this.versionMap = new Map(sorted.slice(0, this.options.versionHistorySize));
    }
  }

  /**
   * Save to storage
   *
   * @private
   */
  private async saveToStorage(): Promise<void> {
    try {
      await this.state.storage.put('cacheCoherence', {
        versionMap: Array.from(this.versionMap.entries()),
        vectorClock: this.vectorClock,
        lastUpdate: Date.now(),
      });
    } catch (error) {
      console.error('Failed to save coherence state:', error);
    }
  }

  /**
   * Load from storage
   *
   * @private
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const stored = await this.state.storage.get<{
        versionMap: Array<[string, CacheEntryVersion]>;
        vectorClock: VectorClock;
        lastUpdate: number;
      }>('cacheCoherence');

      if (stored) {
        this.versionMap = new Map(stored.versionMap);
        this.vectorClock = stored.vectorClock;
      }
    } catch (error) {
      console.error('Failed to load coherence state:', error);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.antiEntropyTimer !== null) {
      clearInterval(this.antiEntropyTimer);
      this.antiEntropyTimer = null;
    }
  }
}

/**
 * Create a cache coherence manager
 */
export function createCacheCoherenceManager(
  state: DurableObjectState,
  options?: CacheCoherenceOptions
): CacheCoherenceManager {
  return new CacheCoherenceManager(state, options);
}
