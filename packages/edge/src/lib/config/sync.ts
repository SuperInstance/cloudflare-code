/**
 * Configuration Synchronization
 *
 * Provides remote configuration sync with Cloudflare KV,
 * conflict resolution, and automatic synchronization.
 */

import type {
  AppConfig,
  ConfigSnapshot,
  ConfigSyncStatus,
  ConfigVersion,
} from './types';
import { ConfigValidator } from './validation';
import type { KVCache } from '../kv';

/**
 * Sync options
 */
export interface ConfigSyncOptions {
  /**
   * Auto-sync interval in milliseconds
   */
  autoSyncInterval?: number;

  /**
   * Enable conflict resolution
   */
  enableConflictResolution?: boolean;

  /**
   * Sync on startup
   */
  syncOnStartup?: boolean;

  /**
   * KV key prefix for config storage
   */
  kvPrefix?: string;
}

/**
 * Sync result
 */
export interface ConfigSyncResult {
  success: boolean;
  version: number;
  changes: number;
  conflicts: string[];
  error?: string;
}

/**
 * Configuration sync manager
 */
export class ConfigSyncManager {
  private kv: KVCache;
  private options: Required<ConfigSyncOptions>;
  private syncStatus: ConfigSyncStatus;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private localVersion: number = 0;

  /**
   * Create a new config sync manager
   */
  constructor(kv: KVCache, options: ConfigSyncOptions = {}) {
    this.kv = kv;
    this.options = {
      autoSyncInterval: options.autoSyncInterval ?? 60000, // 1 minute
      enableConflictResolution: options.enableConflictResolution ?? true,
      syncOnStartup: options.syncOnStartup ?? true,
      kvPrefix: options.kvPrefix ?? 'config:',
    };

    this.syncStatus = {
      lastSync: 0,
      status: 'synced',
      version: 0,
    };
  }

  /**
   * Initialize sync manager
   */
  async initialize(): Promise<void> {
    if (this.options.syncOnStartup) {
      await this.sync();
    }

    // Start auto-sync if interval is set
    if (this.options.autoSyncInterval > 0) {
      this.startAutoSync();
    }
  }

  /**
   * Synchronize configuration from KV
   */
  async sync(): Promise<ConfigSyncResult> {
    this.syncStatus.status = 'syncing';

    try {
      // Fetch latest snapshot from KV
      const snapshot = await this.fetchSnapshot();

      if (!snapshot) {
        this.syncStatus = {
          lastSync: Date.now(),
          status: 'synced',
          version: this.localVersion,
        };

        return {
          success: true,
          version: this.localVersion,
          changes: 0,
          conflicts: [],
        };
      }

      // Check for conflicts
      const conflicts = this.detectConflicts(snapshot);

      if (conflicts.length > 0 && this.options.enableConflictResolution) {
        // Resolve conflicts
        await this.resolveConflicts(snapshot);
      }

      // Update local version
      this.localVersion = snapshot.version;

      this.syncStatus = {
        lastSync: Date.now(),
        status: 'synced',
        version: snapshot.version,
      };

      return {
        success: true,
        version: snapshot.version,
        changes: this.countChanges(snapshot),
        conflicts,
      };
    } catch (error) {
      this.syncStatus = {
        lastSync: Date.now(),
        status: 'failed',
        version: this.localVersion,
        error: error instanceof Error ? error.message : String(error),
      };

      return {
        success: false,
        version: this.localVersion,
        changes: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Push configuration to KV
   */
  async push(config: AppConfig, version: number): Promise<ConfigSyncResult> {
    try {
      // Validate config
      const validation = ConfigValidator.validateAppConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          version: this.localVersion,
          changes: 0,
          conflicts: [],
          error: `Invalid config: ${validation.errors.join(', ')}`,
        };
      }

      // Create snapshot
      const snapshot: ConfigSnapshot = {
        version,
        config,
        timestamp: Date.now(),
        checksum: this.generateChecksum(config),
      };

      // Store in KV
      await this.storeSnapshot(snapshot);

      // Update local version
      this.localVersion = version;

      this.syncStatus = {
        lastSync: Date.now(),
        status: 'synced',
        version,
      };

      return {
        success: true,
        version,
        changes: 0,
        conflicts: [],
      };
    } catch (error) {
      return {
        success: false,
        version: this.localVersion,
        changes: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch configuration snapshot from KV
   */
  async fetchSnapshot(): Promise<ConfigSnapshot | null> {
    try {
      const key = `${this.options.kvPrefix}snapshot`;
      const data = await this.kv.get<ConfigSnapshot>(key);

      if (!data) {
        return null;
      }

      // Verify checksum
      const checksum = this.generateChecksum(data.config);
      if (checksum !== data.checksum) {
        console.warn('Config snapshot checksum mismatch, data may be corrupted');
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch snapshot:', error);
      return null;
    }
  }

  /**
   * Store configuration snapshot in KV
   */
  async storeSnapshot(snapshot: ConfigSnapshot): Promise<void> {
    const key = `${this.options.kvPrefix}snapshot`;
    await this.kv.set(key, snapshot, 60 * 60 * 24 * 30); // 30 days TTL
  }

  /**
   * Get version history from KV
   */
  async getVersionHistory(limit: number = 10): Promise<ConfigVersion[]> {
    try {
      const key = `${this.options.kvPrefix}history`;
      const history = await this.kv.get<ConfigVersion[]>(key);

      if (!history) {
        return [];
      }

      return history.slice(-limit);
    } catch (error) {
      console.error('Failed to get version history:', error);
      return [];
    }
  }

  /**
   * Save version history to KV
   */
  async saveVersionHistory(history: ConfigVersion[]): Promise<void> {
    try {
      const key = `${this.options.kvPrefix}history`;
      await this.kv.set(key, history, 60 * 60 * 24 * 30); // 30 days TTL
    } catch (error) {
      console.error('Failed to save version history:', error);
    }
  }

  /**
   * Get sync status
   */
  getStatus(): ConfigSyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      return; // Already started
    }

    this.syncTimer = setInterval(async () => {
      await this.sync();
    }, this.options.autoSyncInterval);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Detect conflicts between local and remote config
   */
  private detectConflicts(remoteSnapshot: ConfigSnapshot): string[] {
    const conflicts: string[] = [];

    // Simple conflict detection: if remote version is older than local
    if (remoteSnapshot.version < this.localVersion) {
      conflicts.push(
        `Remote version ${remoteSnapshot.version} is older than local version ${this.localVersion}`
      );
    }

    return conflicts;
  }

  /**
   * Resolve conflicts using strategy
   */
  private async resolveConflicts(remoteSnapshot: ConfigSnapshot): Promise<void> {
    // Default strategy: local wins
    // In production, you might implement more sophisticated strategies
    console.warn('Config conflict detected, using local version');

    // Re-push local version to KV
    await this.push(remoteSnapshot.config, this.localVersion);
  }

  /**
   * Count changes in snapshot
   */
  private countChanges(snapshot: ConfigSnapshot): number {
    // This is a simplified implementation
    // In production, you'd compare with previous snapshot
    return 0;
  }

  /**
   * Generate checksum for config
   */
  private generateChecksum(config: AppConfig): string {
    const str = JSON.stringify(config);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoSync();
  }
}

/**
 * Multi-region configuration sync
 * Syncs configuration across multiple Cloudflare regions
 */
export class MultiRegionConfigSync {
  private primarySync: ConfigSyncManager;
  private replicas: Map<string, ConfigSyncManager> = new Map();

  /**
   * Create multi-region sync manager
   */
  constructor(
    primaryKV: KVCache,
    replicaKVs: Map<string, KVCache>,
    options?: ConfigSyncOptions
  ) {
    this.primarySync = new ConfigSyncManager(primaryKV, options);

    for (const [region, kv] of replicaKVs.entries()) {
      this.replicas.set(region, new ConfigSyncManager(kv, options));
    }
  }

  /**
   * Initialize all sync managers
   */
  async initialize(): Promise<void> {
    await this.primarySync.initialize();

    const replicaPromises = Array.from(this.replicas.values()).map((sync) =>
      sync.initialize()
    );

    await Promise.all(replicaPromises);
  }

  /**
   * Sync to all regions
   */
  async syncToAllRegions(config: AppConfig, version: number): Promise<void> {
    // Sync to primary
    await this.primarySync.push(config, version);

    // Sync to replicas
    const replicaPromises = Array.from(this.replicas.values()).map((sync) =>
      sync.push(config, version)
    );

    await Promise.all(replicaPromises);
  }

  /**
   * Get status from all regions
   */
  getAllStatuses(): Map<string, ConfigSyncStatus> {
    const statuses = new Map<string, ConfigSyncStatus>();

    statuses.set('primary', this.primarySync.getStatus());

    for (const [region, sync] of this.replicas.entries()) {
      statuses.set(region, sync.getStatus());
    }

    return statuses;
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.primarySync.destroy();
    for (const sync of this.replicas.values()) {
      sync.destroy();
    }
  }
}

/**
 * Helper function to create sync manager
 */
export function createConfigSyncManager(
  kv: KVCache,
  options?: ConfigSyncOptions
): ConfigSyncManager {
  return new ConfigSyncManager(kv, options);
}
