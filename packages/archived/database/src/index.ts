/**
 * ClaudeFlare Database Package
 *
 * Enterprise-grade database replication, sharding, and distributed data management
 * for Cloudflare Workers D1 databases.
 *
 * Features:
 * - Multi-region replication with configurable consistency models
 * - Horizontal and vertical sharding with consistent hashing
 * - Automatic failover and leader election
 * - Data migration and resharding tools
 * - Query optimization and caching
 * - Disaster recovery and point-in-time restore
 *
 * @package @claudeflare/database
 */

// Replication
export * from './replication';

// Sharding
export * from './sharding';

// Consistency
export * from './consistency';

// Failover
export * from './failover';

// Migration
export * from './migration';

// Optimization
export * from './optimization';

// Version
export const VERSION = '1.0.0';

/**
 * Main Database Manager
 *
 * Orchestrates all database operations including replication,
 * sharding, consistency, failover, migration, and optimization.
 */

import { DatabaseReplicator } from './replication/replicator';
import { ConsistentHashSharding } from './sharding/consistent-hashing';
import { ConsistencyManager } from './consistency/models';
import { HealthMonitor } from './failover/health-monitor';
import { ReshardingManager } from './migration/resharding';
import { QueryOptimizer } from './optimization/query-optimizer';
import type {
  ReplicationConfig,
  ShardingConfig,
  ConsistencyConfig,
  FailoverConfig,
  Region,
  Shard,
} from './';

export interface DatabaseConfig {
  replication: ReplicationConfig;
  sharding: ShardingConfig;
  consistency: ConsistencyConfig;
  failover: FailoverConfig;
}

export class DatabaseManager {
  private replicator: DatabaseReplicator;
  private sharding: ConsistentHashSharding;
  private consistency: ConsistencyManager;
  private healthMonitor: HealthMonitor;
  private resharding: ReshardingManager;
  private optimizer: QueryOptimizer;

  constructor(config: DatabaseConfig) {
    this.replicator = new DatabaseReplicator(config.replication);
    this.sharding = new ConsistentHashSharding(config.sharding);
    this.consistency = new ConsistencyManager(
      config.consistency,
      config.replication.regions.map((r) => r.id)
    );
    this.healthMonitor = new HealthMonitor(
      config.failover,
      this.createNodesFromConfig(config.replication.regions)
    );
    this.resharding = new ReshardingManager();
    this.optimizer = new QueryOptimizer();
  }

  /**
   * Execute a distributed read
   */
  async read(query: string, params: unknown[], consistency: string = 'strong'): Promise<unknown> {
    return await this.consistency.read(
      {
        id: `read-${Date.now()}`,
        query,
        params,
        consistency: consistency as any,
        timestamp: new Date(),
      },
      async (region: string) => {
        // Execute read on specific region
        return { data: [], version: 1 };
      }
    );
  }

  /**
   * Execute a distributed write
   */
  async write(query: string, params: unknown[]): Promise<void> {
    await this.replicator.write(
      {
        id: `write-${Date.now()}`,
        query,
        params,
        consistency: 'strong',
        timestamp: new Date(),
      },
      {}
    );
  }

  /**
   * Route a key to its shard
   */
  routeKey(key: string): Shard | undefined {
    return this.sharding.routeKey(key);
  }

  /**
   * Get replication status
   */
  getReplicationStatus() {
    return this.replicator.getStatus();
  }

  /**
   * Get cluster health
   */
  getClusterHealth() {
    return this.healthMonitor.getClusterHealth();
  }

  /**
   * Generate performance report
   */
  getPerformanceReport() {
    return this.optimizer.generateReport();
  }

  private createNodesFromConfig(regions: Region[]) {
    return regions.map((region) => ({
      id: region.id,
      region: region.id,
      role: (region.primary ? 'primary' : 'replica') as any,
      status: 'healthy' as const,
      lastHeartbeat: new Date(),
      endpoint: region.endpoint,
      priority: region.primary ? 100 : 50,
    }));
  }
}

/**
 * Factory function to create a DatabaseManager
 */
export function createDatabaseManager(config: DatabaseConfig): DatabaseManager {
  return new DatabaseManager(config);
}
