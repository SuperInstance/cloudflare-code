/**
 * Database Sharding Types
 *
 * Core types for horizontal and vertical database sharding
 */

export type ShardingStrategy =
  | 'hash'
  | 'range'
  | 'consistent-hash'
  | 'geographical'
  | 'directory-based'
  | 'composite';

export interface Shard {
  id: string;
  region: string;
  range?: ShardRange;
  hashRange?: HashRange;
  weight: number;
  status: 'active' | 'draining' | 'offline' | 'migrating';
  nodeCount: number;
  capacity: number;
  utilization: number;
}

export interface ShardRange {
  min: string | number;
  max: string | number;
  inclusive: boolean;
}

export interface HashRange {
  min: number;
  max: number;
}

export interface ShardKey {
  name: string;
  type: 'string' | 'number' | 'uuid' | 'composite';
  columns: string[];
}

export interface ShardingConfig {
  strategy: ShardingStrategy;
  shards: Shard[];
  shardKey: ShardKey;
  replicas: number;
  consistentHashReplicas: number;
  rebalanceThreshold: number;
  migrationBatchSize: number;
}

export interface ShardMapping {
  key: string;
  shardId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShardDirectory {
  version: number;
  mappings: Map<string, ShardMapping>;
  shards: Map<string, Shard>;
}

export interface RebalancePlan {
  sourceShards: string[];
  targetShards: string[];
  dataMigrations: DataMigration[];
  estimatedTime: number;
  dataMovement: number;
}

export interface DataMigration {
  id: string;
  sourceShard: string;
  targetShard: string;
  keyRange?: ShardRange;
  hashRange?: HashRange;
  rowCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: Error;
}

export interface ShardMetrics {
  shardId: string;
  readCount: number;
  writeCount: number;
  rowCount: number;
  dataSize: number;
  avgLatency: number;
  errorRate: number;
  throughput: number;
}

export interface GeolocationConfig {
  userRegion: string;
  nearestShards: string[];
  fallbackShards: string[];
  latencyThreshold: number;
}

export interface CompositeShardKey {
  keys: Array<{
    name: string;
    weight: number;
    strategy: ShardingStrategy;
  }>;
}
