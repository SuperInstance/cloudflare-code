/**
 * Database Sharding Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConsistentHashRing, ConsistentHashSharding } from '../sharding/consistent-hashing';
import { HorizontalSharding } from '../sharding/horizontal';
import { GeographicalSharding } from '../sharding/geographical';
import type { ShardingConfig, Shard } from '../sharding/types';

describe('ConsistentHashRing', () => {
  let ring: ConsistentHashRing;

  beforeEach(() => {
    ring = new ConsistentHashRing(150);
  });

  it('should distribute keys evenly across shards', () => {
    const shard1: Shard = { id: 'shard1', region: 'us-east', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 };
    const shard2: Shard = { id: 'shard2', region: 'us-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 };
    const shard3: Shard = { id: 'shard3', region: 'eu-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 };

    ring.addShard(shard1);
    ring.addShard(shard2);
    ring.addShard(shard3);

    const distribution = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      const key = `key-${i}`;
      const shard = ring.getShard(key);
      if (shard) {
        const count = distribution.get(shard.id) || 0;
        distribution.set(shard.id, count + 1);
      }
    }

    // Check distribution is relatively even (within 20%)
    const counts = Array.from(distribution.values());
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    for (const count of counts) {
      expect(Math.abs(count - avg) / avg).toBeLessThan(0.2);
    }
  });

  it('should handle adding and removing shards', () => {
    const shard1: Shard = { id: 'shard1', region: 'us-east', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 };
    const shard2: Shard = { id: 'shard2', region: 'us-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 };

    ring.addShard(shard1);

    const key = 'test-key';
    const originalShard = ring.getShard(key);
    expect(originalShard?.id).toBe('shard1');

    ring.addShard(shard2);

    // Some keys should move, but not all
    let moved = 0;
    let stayed = 0;
    for (let i = 0; i < 100; i++) {
      const k = `key-${i}`;
      const s = ring.getShard(k);
      if (s?.id === 'shard1') stayed++;
      else if (s?.id === 'shard2') moved++;
    }

    expect(moved + stayed).toBe(100);
  });

  it('should get multiple shards for replication', () => {
    const shards: Shard[] = [
      { id: 'shard1', region: 'us-east', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
      { id: 'shard2', region: 'us-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
      { id: 'shard3', region: 'eu-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
    ];

    for (const shard of shards) {
      ring.addShard(shard);
    }

    const replicaShards = ring.getShardsForReplication('test-key', 2);
    expect(replicaShards.length).toBe(2);
    expect(new Set(replicaShards).size).toBe(2); // Unique shards
  });
});

describe('HorizontalSharding', () => {
  let sharding: HorizontalSharding;
  let config: ShardingConfig;

  beforeEach(() => {
    config = {
      strategy: 'hash',
      shards: [
        { id: 'shard1', region: 'us-east', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
        { id: 'shard2', region: 'us-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
        { id: 'shard3', region: 'eu-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
      ],
      shardKey: {
        name: 'user_id',
        type: 'number',
        columns: ['user_id'],
      },
      replicas: 2,
      consistentHashReplicas: 150,
      rebalanceThreshold: 0.2,
      migrationBatchSize: 1000,
    };
    sharding = new HorizontalSharding(config);
  });

  it('should route keys to shards using hash strategy', () => {
    const shard1 = sharding.route('key-1', 'read');
    const shard2 = sharding.route('key-2', 'read');
    const shard1Again = sharding.route('key-1', 'read');

    expect(shard1).toBeDefined();
    expect(shard2).toBeDefined();
    expect(shard1?.id).toBe(shard1Again?.id); // Same key goes to same shard
  });

  it('should add and remove shards', () => {
    const initialCount = config.shards.length;

    const newShard: Shard = { id: 'shard4', region: 'asia-east', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 };
    const migrations = sharding.addShard(newShard);

    expect(migrations).toBeDefined();
    expect(config.shards.length).toBe(initialCount + 1);

    const removeMigrations = sharding.removeShard('shard4');
    expect(removeMigrations).toBeDefined();
    expect(config.shards.length).toBe(initialCount);
  });
});

describe('GeographicalSharding', () => {
  let sharding: GeographicalSharding;
  let config: ShardingConfig;

  beforeEach(() => {
    config = {
      strategy: 'geographical',
      shards: [
        { id: 'shard1', region: 'us-east', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
        { id: 'shard2', region: 'us-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
        { id: 'shard3', region: 'eu-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
      ],
      shardKey: {
        name: 'user_id',
        type: 'number',
        columns: ['user_id'],
      },
      replicas: 2,
      consistentHashReplicas: 150,
      rebalanceThreshold: 0.2,
      migrationBatchSize: 1000,
    };
    sharding = new GeographicalSharding(config);
  });

  it('should route to nearest region', () => {
    const userLocation = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco

    const result = sharding.route(userLocation, 'user-123');

    expect(result.primary).toBeDefined();
    expect(result.replicas).toBeDefined();
    expect(result.latency).toBeGreaterThan(0);
  });

  it('should set and get user locations', () => {
    sharding.setUserLocation('user-1', 'us-west');
    const region = sharding.getUserRegion('user-1');

    expect(region).toBe('us-west');
  });

  it('should route by user with location affinity', () => {
    sharding.setUserLocation('user-1', 'eu-west');

    const shard = sharding.routeByUser('user-1', {
      userRegion: 'eu-west',
      nearestShards: ['shard3'],
      fallbackShards: ['shard1', 'shard2'],
      latencyThreshold: 200,
    });

    expect(shard).toBeDefined();
    expect(shard?.region).toBe('eu-west');
  });
});
