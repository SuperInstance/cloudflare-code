/**
 * Horizontal Sharding
 *
 * Implements horizontal sharding strategies (hash, range, directory-based)
 */

import type { Shard, ShardKey, ShardingConfig, ShardMapping, DataMigration } from './types';
import { ConsistentHashRing } from './consistent-hashing';

export class HorizontalSharding {
  private config: ShardingConfig;
  private directory: Map<string, ShardMapping>;
  private metrics: Map<string, number>;

  constructor(config: ShardingConfig) {
    this.config = config;
    this.directory = new Map();
    this.metrics = new Map();
  }

  /**
   * Route a request to the appropriate shard
   */
  route(key: string | number, operation: 'read' | 'write'): Shard | undefined {
    switch (this.config.strategy) {
      case 'hash':
        return this.hashRoute(key);
      case 'range':
        return this.rangeRoute(key);
      case 'consistent-hash':
        return this.consistentHashRoute(key);
      case 'directory-based':
        return this.directoryRoute(key);
      default:
        throw new Error(`Unknown sharding strategy: ${this.config.strategy}`);
    }
  }

  /**
   * Hash-based routing
   */
  private hashRoute(key: string | number): Shard | undefined {
    const hash = this.hashKey(String(key));
    const shardIndex = hash % this.config.shards.length;
    return this.config.shards[shardIndex];
  }

  /**
   * Range-based routing
   */
  private rangeRoute(key: string | number): Shard | undefined {
    const keyValue = typeof key === 'number' ? key : this.parseRangeKey(key);

    for (const shard of this.config.shards) {
      if (shard.range) {
        const { min, max, inclusive } = shard.range;
        const minVal = typeof min === 'number' ? min : this.parseRangeKey(min);
        const maxVal = typeof max === 'number' ? max : this.parseRangeKey(max);

        if (inclusive) {
          if (keyValue >= minVal && keyValue <= maxVal) {
            return shard;
          }
        } else {
          if (keyValue > minVal && keyValue < maxVal) {
            return shard;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Consistent hash routing
   */
  private consistentHashRoute(key: string | number): Shard | undefined {
    const ring = new ConsistentHashRing(this.config.consistentHashReplicas);

    for (const shard of this.config.shards) {
      ring.addShard(shard);
    }

    return ring.getShard(String(key));
  }

  /**
   * Directory-based routing
   */
  private directoryRoute(key: string | number): Shard | undefined {
    const mapping = this.directory.get(String(key));
    if (!mapping) {
      // Create new mapping
      const shard = this.assignToShard(String(key));
      this.directory.set(String(key), {
        key: String(key),
        shardId: shard.id,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return shard;
    }

    return this.config.shards.find((s) => s.id === mapping.shardId);
  }

  /**
   * Assign a key to a shard using load balancing
   */
  private assignToShard(key: string): Shard {
    // Find shard with lowest utilization
    let bestShard = this.config.shards[0];
    let lowestUtilization = Infinity;

    for (const shard of this.config.shards) {
      if (shard.utilization < lowestUtilization && shard.status === 'active') {
        lowestUtilization = shard.utilization;
        bestShard = shard;
      }
    }

    return bestShard;
  }

  /**
   * Parse range key
   */
  private parseRangeKey(key: string): number {
    // For string ranges, use hash for comparison
    return this.hashKey(key);
  }

  /**
   * Hash a key to a number
   */
  private hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Add a new shard
   */
  addShard(shard: Shard): DataMigration[] {
    this.config.shards.push(shard);
    return this.planRebalance();
  }

  /**
   * Remove a shard
   */
  removeShard(shardId: string): DataMigration[] {
    const shard = this.config.shards.find((s) => s.id === shardId);
    if (!shard) {
      throw new Error(`Shard ${shardId} not found`);
    }

    this.config.shards = this.config.shards.filter((s) => s.id !== shardId);

    // Plan migration for affected keys
    const migrations: DataMigration[] = [];

    for (const [key, mapping] of this.directory) {
      if (mapping.shardId === shardId) {
        const newShard = this.assignToShard(key);
        migrations.push({
          id: `migration-${Date.now()}-${migrations.length}`,
          sourceShard: shardId,
          targetShard: newShard.id,
          rowCount: 0, // Will be calculated during migration
          status: 'pending',
        });
      }
    }

    return migrations;
  }

  /**
   * Plan rebalancing of data across shards
   */
  planRebalance(): DataMigration[] {
    const migrations: DataMigration[] = [];
    const avgUtilization = this.calculateAverageUtilization();

    for (const shard of this.config.shards) {
      // If shard is over threshold, move some data
      if (shard.utilization > avgUtilization * (1 + this.config.rebalanceThreshold)) {
        // Find underutilized shards
        for (const target of this.config.shards) {
          if (
            target.id !== shard.id &&
            target.utilization < avgUtilization * (1 - this.config.rebalanceThreshold)
          ) {
            migrations.push({
              id: `rebalance-${Date.now()}-${migrations.length}`,
              sourceShard: shard.id,
              targetShard: target.id,
              rowCount: 0,
              status: 'pending',
            });
          }
        }
      }
    }

    return migrations;
  }

  /**
   * Calculate average shard utilization
   */
  private calculateAverageUtilization(): number {
    if (this.config.shards.length === 0) return 0;

    const total = this.config.shards.reduce((sum, shard) => sum + shard.utilization, 0);
    return total / this.config.shards.length;
  }

  /**
   * Update shard metrics
   */
  updateMetrics(shardId: string, rowCount: number, dataSize: number): void {
    const shard = this.config.shards.find((s) => s.id === shardId);
    if (shard) {
      shard.utilization = dataSize / shard.capacity;
    }
  }

  /**
   * Get shard directory
   */
  getDirectory(): Map<string, ShardMapping> {
    return new Map(this.directory);
  }

  /**
   * Update directory mapping
   */
  updateMapping(key: string, shardId: string): void {
    const existing = this.directory.get(key);

    if (existing) {
      existing.shardId = shardId;
      existing.updatedAt = new Date();
      existing.version++;
    } else {
      this.directory.set(key, {
        key,
        shardId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Get shard statistics
   */
  getShardStats(): Map<string, {
    utilization: number;
    keyCount: number;
    status: string;
  }> {
    const stats = new Map();

    for (const shard of this.config.shards) {
      let keyCount = 0;
      for (const mapping of this.directory.values()) {
        if (mapping.shardId === shard.id) {
          keyCount++;
        }
      }

      stats.set(shard.id, {
        utilization: shard.utilization,
        keyCount,
        status: shard.status,
      });
    }

    return stats;
  }
}
