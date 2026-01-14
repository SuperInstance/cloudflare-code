/**
 * Consistent Hashing for Sharding
 *
 * Implements consistent hashing ring for distributed data partitioning
 */

import type { Shard, HashRange, ShardingConfig } from './types';

interface RingNode {
  hash: number;
  shardId: string;
  virtualIndex: number;
}

export class ConsistentHashRing {
  private ring: RingNode[];
  private shards: Map<string, Shard>;
  private virtualNodes: number;
  private sorted: boolean;

  constructor(virtualNodes: number = 150) {
    this.ring = [];
    this.shards = new Map();
    this.virtualNodes = virtualNodes;
    this.sorted = false;
  }

  /**
   * Add a shard to the ring
   */
  addShard(shard: Shard): void {
    this.shards.set(shard.id, shard);
    this.sorted = false;

    // Create virtual nodes for the shard
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hashVirtualNode(shard.id, i);
      this.ring.push({
        hash,
        shardId: shard.id,
        virtualIndex: i,
      });
    }
  }

  /**
   * Remove a shard from the ring
   */
  removeShard(shardId: string): void {
    this.shards.delete(shardId);
    this.ring = this.ring.filter((node) => node.shardId !== shardId);
    this.sorted = true;
  }

  /**
   * Get the shard for a given key
   */
  getShard(key: string): Shard | undefined {
    if (this.ring.length === 0) {
      return undefined;
    }

    if (!this.sorted) {
      this.sortRing();
    }

    const hash = this.hashKey(key);

    // Binary search for the first node with hash >= key hash
    let left = 0;
    let right = this.ring.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.ring[mid].hash < hash) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // Wrap around if necessary
    const node = this.ring[left % this.ring.length];
    return this.shards.get(node.shardId);
  }

  /**
   * Get multiple shards for replication
   */
  getShardsForReplication(key: string, count: number): Shard[] {
    if (this.ring.length === 0) {
      return [];
    }

    if (!this.sorted) {
      this.sortRing();
    }

    const hash = this.hashKey(key);
    const result: Shard[] = [];
    const seen = new Set<string>();

    let left = 0;
    let right = this.ring.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.ring[mid].hash < hash) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // Get next N unique shards
    for (let i = 0; i < this.ring.length && result.length < count; i++) {
      const index = (left + i) % this.ring.length;
      const node = this.ring[index];
      const shard = this.shards.get(node.shardId);

      if (shard && !seen.has(shard.id)) {
        seen.add(shard.id);
        result.push(shard);
      }
    }

    return result;
  }

  /**
   * Get shard for a hash value directly
   */
  getShardByHash(hash: number): Shard | undefined {
    if (!this.sorted) {
      this.sortRing();
    }

    let left = 0;
    let right = this.ring.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.ring[mid].hash < hash) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    const node = this.ring[left % this.ring.length];
    return this.shards.get(node.shardId);
  }

  /**
   * Sort the ring by hash value
   */
  private sortRing(): void {
    this.ring.sort((a, b) => a.hash - b.hash);
    this.sorted = true;
  }

  /**
   * Hash a key to a number
   */
  private hashKey(key: string): number {
    // FNV-1a hash
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /**
   * Hash a virtual node
   */
  private hashVirtualNode(shardId: string, index: number): number {
    return this.hashKey(`${shardId}#${index}`);
  }

  /**
   * Get all shards
   */
  getAllShards(): Shard[] {
    return Array.from(this.shards.values());
  }

  /**
   * Get ring statistics
   */
  getStats(): {
    totalShards: number;
    totalVirtualNodes: number;
    balanceScore: number;
  } {
    const totalVirtualNodes = this.ring.length;
    const shardCounts = new Map<string, number>();

    for (const node of this.ring) {
      const count = shardCounts.get(node.shardId) || 0;
      shardCounts.set(node.shardId, count + 1);
    }

    // Calculate balance (standard deviation of shard distribution)
    const counts = Array.from(shardCounts.values());
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
    const balanceScore = Math.sqrt(variance);

    return {
      totalShards: this.shards.size,
      totalVirtualNodes,
      balanceScore,
    };
  }
}

/**
 * Consistent Hashing Sharding Strategy
 */
export class ConsistentHashSharding {
  private ring: ConsistentHashRing;
  private config: ShardingConfig;

  constructor(config: ShardingConfig) {
    this.config = config;
    this.ring = new ConsistentHashRing(config.consistentHashReplicas);

    // Initialize with configured shards
    for (const shard of config.shards) {
      this.ring.addShard(shard);
    }
  }

  /**
   * Route a key to its shard
   */
  routeKey(key: string): Shard | undefined {
    return this.ring.getShard(key);
  }

  /**
   * Route a composite key
   */
  routeCompositeKey(keys: Record<string, unknown>): Shard | undefined {
    const compositeKey = this.buildCompositeKey(keys);
    return this.routeKey(compositeKey);
  }

  /**
   * Get shards for replicated write
   */
  getReplicaShards(key: string): Shard[] {
    return this.ring.getShardsForReplication(key, this.config.replicas);
  }

  /**
   * Add a new shard to the cluster
   */
  addShard(shard: Shard): {
    affectedKeys: string[];
    migrationPlan: Map<string, string>;
  } {
    const affectedKeys: string[] = [];
    const migrationPlan = new Map<string, string>();

    // Track keys that would move
    const oldShards = new Map<string, string>();

    // Simulate checking all keys (in practice, you'd scan actual data)
    for (const [existingShardId] of this.config.shards.map((s) => [s.id])) {
      // This is simplified - real implementation would scan data
      oldShards.set(existingShardId, existingShardId);
    }

    // Add the new shard
    this.ring.addShard(shard);
    this.config.shards.push(shard);

    return { affectedKeys, migrationPlan };
  }

  /**
   * Remove a shard from the cluster
   */
  removeShard(shardId: string): {
    targetShards: Shard[];
    affectedKeys: string[];
  } {
    const shard = this.config.shards.find((s) => s.id === shardId);
    if (!shard) {
      throw new Error(`Shard ${shardId} not found`);
    }

    // Get replica shards that will receive the data
    const targetShards = this.ring.getShardsForReplication(
      'dummy-key',
      this.config.replicas
    ).filter((s) => s.id !== shardId);

    const affectedKeys: string[] = [];

    // Remove the shard
    this.ring.removeShard(shardId);
    this.config.shards = this.config.shards.filter((s) => s.id !== shardId);

    return { targetShards, affectedKeys };
  }

  /**
   * Build composite key from multiple fields
   */
  private buildCompositeKey(keys: Record<string, unknown>): string {
    const parts: string[] = [];

    for (const [name, value] of Object.entries(keys)) {
      parts.push(`${name}=${value}`);
    }

    return parts.join('|');
  }

  /**
   * Get shard statistics
   */
  getStats(): {
    shards: number;
    replicas: number;
    ring: ReturnType<ConsistentHashRing['getStats']>;
  } {
    return {
      shards: this.config.shards.length,
      replicas: this.config.replicas,
      ring: this.ring.getStats(),
    };
  }

  /**
   * Check if rebalancing is needed
   */
  needsRebalancing(): boolean {
    const stats = this.ring.getStats();
    const idealBalance = this.ring.getAllShards().length > 0
      ? this.ring.getStats().totalVirtualNodes / this.ring.getAllShards().length
      : 0;

    // Check if any shard is significantly imbalanced
    const shardDistribution = new Map<string, number>();

    for (const node of (this.ring as any).ring) {
      const count = shardDistribution.get(node.shardId) || 0;
      shardDistribution.set(node.shardId, count + 1);
    }

    for (const [shardId, count] of shardDistribution) {
      const deviation = Math.abs(count - idealBalance) / idealBalance;
      if (deviation > this.config.rebalanceThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the ring (for testing/debugging)
   */
  getRing(): ConsistentHashRing {
    return this.ring;
  }
}
