/**
 * Database Sharding Manager
 * Advanced sharding with routing, rebalancing, and cross-shard queries
 */

import { DatabaseAdapter } from '../adapters/adapter';
import {
  ShardConfig,
  ShardingStrategy,
  ShardKeyDefinition,
  QueryResult,
  AnyDatabaseConfig,
} from '../types';

// ============================================================================
// Shard Manager
// ============================================================================

export class ShardManager {
  private shards: Map<string, Shard> = new Map();
  private strategy: ShardingStrategy;
  private router: ShardRouter;
  private rebalancer: ShardRebalancer;
  private healthMonitor: ShardHealthMonitor;

  constructor(strategy: ShardingStrategy) {
    this.strategy = strategy;
    this.router = new ShardRouter(strategy);
    this.rebalancer = new ShardRebalancer(this);
    this.healthMonitor = new ShardHealthMonitor(this);

    this.initializeShards();
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  private async initializeShards(): Promise<void> {
    for (const shardConfig of this.strategy.shards) {
      const shard = new Shard(shardConfig);
      this.shards.set(shardConfig.id, shard);
      await shard.connect();
    }

    // Start health monitoring
    this.healthMonitor.start();
  }

  // ========================================================================
  // Query Routing
  // ========================================================================

  async query<T = any>(
    shardKey: any,
    sql: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const shards = this.router.route(shardKey);

    if (Array.isArray(shards)) {
      // Cross-shard query
      return this.executeCrossShardQuery(shards, sql, params);
    } else {
      // Single-shard query
      return this.executeShardQuery(shards, sql, params);
    }
  }

  private async executeShardQuery<T>(
    shard: ShardConfig,
    sql: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const shardInstance = this.shards.get(shard.id);

    if (!shardInstance) {
      throw new Error(`Shard ${shard.id} not found`);
    }

    if (!shardInstance.isHealthy()) {
      throw new Error(`Shard ${shard.id} is not healthy`);
    }

    return shardInstance.getAdapter().query<T>(sql, params);
  }

  private async executeCrossShardQuery<T>(
    shards: ShardConfig[],
    sql: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const results: QueryResult<T>[] = [];
    const startTime = Date.now();

    // Execute query on all shards in parallel
    const promises = shards.map(shard =>
      this.executeShardQuery<T>(shard, sql, params)
    );

    const shardResults = await Promise.all(promises);
    results.push(...shardResults);

    // Merge results
    const mergedRows = results.flatMap(r => r.rows);
    const totalRowCount = results.reduce((sum, r) => sum + r.rowCount, 0);

    return {
      rows: mergedRows,
      rowCount: totalRowCount,
      executionTime: Date.now() - startTime,
    };
  }

  // ========================================================================
  // Shard Management
  // ========================================================================

  async addShard(shardConfig: ShardConfig): Promise<void> {
    if (this.shards.has(shardConfig.id)) {
      throw new Error(`Shard ${shardConfig.id} already exists`);
    }

    const shard = new Shard(shardConfig);
    await shard.connect();

    this.shards.set(shardConfig.id, shard);
    this.strategy.shards.push(shardConfig);

    // Rebalance if needed
    await this.rebalancer.rebalance();
  }

  async removeShard(shardId: string): Promise<void> {
    const shard = this.shards.get(shardId);

    if (!shard) {
      throw new Error(`Shard ${shardId} not found`);
    }

    // Move data from this shard to other shards
    await this.rebalancer.migrateShardData(shardId);

    // Disconnect shard
    await shard.disconnect();

    this.shards.delete(shardId);
    this.strategy.shards = this.strategy.shards.filter(s => s.id !== shardId);
  }

  getShard(shardId: string): Shard | undefined {
    return this.shards.get(shardId);
  }

  getShards(): Shard[] {
    return Array.from(this.shards.values());
  }

  // ========================================================================
  // Health Monitoring
  // ========================================================================

  async checkShardHealth(shardId: string): Promise<boolean> {
    const shard = this.shards.get(shardId);

    if (!shard) {
      return false;
    }

    return shard.isHealthy();
  }

  getUnhealthyShards(): Shard[] {
    return Array.from(this.shards.values()).filter(s => !s.isHealthy());
  }

  async failoverShard(shardId: string): Promise<void> {
    const unhealthyShards = this.getUnhealthyShards();
    const targetShard = unhealthyShards.find(s => s.getId() === shardId);

    if (!targetShard) {
      throw new Error(`Shard ${shardId} is healthy or doesn't exist`);
    }

    // Find replica shard
    const replicaShard = Array.from(this.shards.values()).find(s =>
      s.getConfig().isReplica && s.getConfig().region === targetShard.getConfig().region
    );

    if (replicaShard) {
      // Promote replica to primary
      await this.promoteReplica(replicaShard.getId());
    }
  }

  private async promoteReplica(replicaId: string): Promise<void> {
    const shard = this.shards.get(replicaId);

    if (!shard) {
      throw new Error(`Replica ${replicaId} not found`);
    }

    const config = shard.getConfig();
    config.isPrimary = true;
    config.isReplica = false;

    // Update router configuration
    this.router.updateShardConfig(config);
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  async disconnect(): Promise<void> {
    this.healthMonitor.stop();

    const disconnectPromises = Array.from(this.shards.values()).map(shard =>
      shard.disconnect()
    );

    await Promise.all(disconnectPromises);
    this.shards.clear();
  }
}

// ============================================================================
// Shard Router
// ============================================================================

class ShardRouter {
  private strategy: ShardingStrategy;
  private hashAlgorithms: Map<string, (key: any) => number> = new Map();

  constructor(strategy: ShardingStrategy) {
    this.strategy = strategy;
    this.initializeHashAlgorithms();
  }

  private initializeHashAlgorithms(): void {
    this.hashAlgorithms.set('md5', (key: any) => {
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(String(key)).digest('hex');
      return parseInt(hash.substring(0, 8), 16);
    });

    this.hashAlgorithms.set('sha1', (key: any) => {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha1').update(String(key)).digest('hex');
      return parseInt(hash.substring(0, 8), 16);
    });

    this.hashAlgorithms.set('sha256', (key: any) => {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(String(key)).digest('hex');
      return parseInt(hash.substring(0, 8), 16);
    });

    this.hashAlgorithms.set('murmurhash3', (key: any) => {
      // Simplified murmurhash3 implementation
      let h = 1779033703 ^ String(key).length;
      for (let i = 0; i < String(key).length; i++) {
        h = Math.imul(h ^ String(key).charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
      }();
    });
  }

  route(key: any): ShardConfig | ShardConfig[] {
    switch (this.strategy.type) {
      case 'hash':
        return this.routeHash(key);
      case 'range':
        return this.routeRange(key);
      case 'directory':
        return this.routeDirectory(key);
      case 'consistent_hash':
        return this.routeConsistentHash(key);
      default:
        throw new Error(`Unknown sharding strategy: ${this.strategy.type}`);
    }
  }

  private routeHash(key: any): ShardConfig {
    const shardKey = this.strategy.shardKey[0];
    const algorithm = shardKey.algorithm || 'md5';
    const hashFn = this.hashAlgorithms.get(algorithm);

    if (!hashFn) {
      throw new Error(`Unknown hash algorithm: ${algorithm}`);
    }

    const hash = hashFn(key);
    const shardCount = this.strategy.shards.length;
    const weightedShards = this.getWeightedShards();

    // Apply weights to shard selection
    let totalWeight = weightedShards.reduce((sum, s) => sum + (s.weight || 1), 0);
    let targetHash = hash % totalWeight;

    for (const shard of weightedShards) {
      const weight = shard.weight || 1;
      if (targetHash < weight) {
        return shard;
      }
      targetHash -= weight;
    }

    return weightedShards[0];
  }

  private routeRange(key: any): ShardConfig {
    const shardKey = this.strategy.shardKey[0];

    for (const shard of this.strategy.shards) {
      if (shard.minValue !== undefined && shard.maxValue !== undefined) {
        if (key >= shard.minValue && key < shard.maxValue) {
          return shard;
        }
      }
    }

    throw new Error(`No shard found for key: ${key}`);
  }

  private routeDirectory(key: any): ShardConfig {
    // Directory-based routing: lookup key in directory
    // This would typically query a directory service
    // For now, use hash routing as fallback
    return this.routeHash(key);
  }

  private routeConsistentHash(key: any): ShardConfig {
    const shardKey = this.strategy.shardKey;
    const algorithm = shardKey.algorithm || 'md5';
    const hashFn = this.hashAlgorithms.get(algorithm);

    if (!hashFn) {
      throw new Error(`Unknown hash algorithm: ${algorithm}`);
    }

    const hash = hashFn(key);
    const weightedShards = this.getWeightedShards();

    // Find the shard with the next higher hash (circular)
    for (const shard of weightedShards) {
      const shardHash = this.getShardHash(shard);
      if (shardHash >= hash) {
        return shard;
      }
    }

    // Wrap around to first shard
    return weightedShards[0];
  }

  private getWeightedShards(): ShardConfig[] {
    const shards: ShardConfig[] = [];

    for (const shard of this.strategy.shards) {
      const weight = shard.weight || 1;
      for (let i = 0; i < weight; i++) {
        shards.push({ ...shard, weight: 1 });
      }
    }

    return shards;
  }

  private getShardHash(shard: ShardConfig): number {
    const hashFn = this.hashAlgorithms.get('md5');
    return hashFn ? hashFn(shard.id) : 0;
  }

  updateShardConfig(config: ShardConfig): void {
    const index = this.strategy.shards.findIndex(s => s.id === config.id);
    if (index > -1) {
      this.strategy.shards[index] = config;
    }
  }

  addShard(shard: ShardConfig): void {
    this.strategy.shards.push(shard);
  }

  removeShard(shardId: string): void {
    this.strategy.shards = this.strategy.shards.filter(s => s.id !== shardId);
  }
}

// ============================================================================
// Shard Rebalancer
// ============================================================================

class ShardRebalancer {
  private manager: ShardManager;

  constructor(manager: ShardManager) {
    this.manager = manager;
  }

  async rebalance(): Promise<void> {
    const shards = this.manager.getShards();
    const stats = await Promise.all(
      shards.map(async shard => ({
        shard,
        stats: await shard.getStats(),
      }))
    );

    // Calculate data distribution
    const totalData = stats.reduce((sum, s) => sum + (s.stats.rowCount || 0), 0);
    const avgData = totalData / stats.length;

    // Find shards that need rebalancing
    const overloaded = stats.filter(s => s.stats.rowCount > avgData * 1.2);
    const underloaded = stats.filter(s => s.stats.rowCount < avgData * 0.8);

    // Move data from overloaded to underloaded shards
    for (const overload of overloaded) {
      const target = underloaded.shift();
      if (!target) break;

      await this.moveData(overload.shard, target.shard);
    }
  }

  async moveData(fromShard: Shard, toShard: Shard): Promise<void> {
    // Get data to move (simplified - in real implementation, would use shard key ranges)
    const fromAdapter = fromShard.getAdapter();
    const toAdapter = toShard.getAdapter();

    // Get sample data to move
    const data = await fromAdapter.query('SELECT * FROM data LIMIT 100');

    // Insert into target shard
    for (const row of data.rows) {
      await toAdapter.insert('data', row);
    }

    // Delete from source shard
    await fromAdapter.query('DELETE FROM data WHERE id IN (?)', [
      data.rows.map(r => r.id),
    ]);
  }

  async migrateShardData(shardId: string): Promise<void> {
    const shard = this.manager.getShard(shardId);

    if (!shard) {
      throw new Error(`Shard ${shardId} not found`);
    }

    const otherShards = this.manager.getShards().filter(s => s.getId() !== shardId);

    if (otherShards.length === 0) {
      throw new Error('No other shards available for migration');
    }

    // Distribute data evenly among other shards
    const data = await shard.getAdapter().query('SELECT * FROM data');
    const chunkSize = Math.ceil(data.rows.length / otherShards.length);

    for (let i = 0; i < otherShards.length; i++) {
      const chunk = data.rows.slice(i * chunkSize, (i + 1) * chunkSize);
      const targetShard = otherShards[i];

      for (const row of chunk) {
        await targetShard.getAdapter().insert('data', row);
      }
    }
  }
}

// ============================================================================
// Shard Health Monitor
// ============================================================================

class ShardHealthMonitor {
  private manager: ShardManager;
  private interval?: NodeJS.Timeout;

  constructor(manager: ShardManager) {
    this.manager = manager;
  }

  start(checkInterval = 30000): void {
    this.interval = setInterval(async () => {
      const shards = this.manager.getShards();

      for (const shard of shards) {
        const healthy = await shard.checkHealth();

        if (!healthy && shard.getConfig().isPrimary) {
          // Attempt failover
          await this.manager.failoverShard(shard.getId());
        }
      }
    }, checkInterval);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}

// ============================================================================
// Shard
// ============================================================================

export class Shard {
  private config: ShardConfig;
  private adapter: DatabaseAdapter;
  private healthy = true;
  private lastCheck?: Date;
  private connectionAttempts = 0;

  constructor(config: ShardConfig) {
    this.config = config;
    this.adapter = this.createAdapter();
  }

  private createAdapter(): DatabaseAdapter {
    // Create appropriate adapter based on config
    // This is a simplified version - in real implementation, would use adapter factory
    const { D1Adapter } = require('../adapters/d1-adapter');
    const { PostgreSQLAdapter } = require('../adapters/postgres-adapter');
    const { MySQLAdapter } = require('../adapters/mysql-adapter');

    const config = {
      type: 'postgresql',
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      username: 'user',
      password: 'pass',
    } as AnyDatabaseConfig;

    return new PostgreSQLAdapter(config);
  }

  async connect(): Promise<void> {
    try {
      await this.adapter.connect();
      this.healthy = true;
      this.connectionAttempts = 0;
    } catch (error) {
      this.healthy = false;
      this.connectionAttempts++;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
  }

  async checkHealth(): Promise<boolean> {
    try {
      this.healthy = this.adapter.isConnected();
      this.lastCheck = new Date();
      return this.healthy;
    } catch (error) {
      this.healthy = false;
      this.lastCheck = new Date();
      return false;
    }
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  getAdapter(): DatabaseAdapter {
    return this.adapter;
  }

  getConfig(): ShardConfig {
    return this.config;
  }

  getId(): string {
    return this.config.id;
  }

  async getStats(): Promise<any> {
    return {
      healthy: this.healthy,
      lastCheck: this.lastCheck,
      connectionAttempts: this.connectionAttempts,
      rowCount: await this.getRowCount(),
    };
  }

  private async getRowCount(): Promise<number> {
    try {
      const result = await this.adapter.query('SELECT COUNT(*) as count FROM data');
      return result.rows[0]?.count || 0;
    } catch (error) {
      return 0;
    }
  }
}

// ============================================================================
// Sharding Strategy Factory
// ============================================================================

export class ShardingStrategyFactory {
  static createHashStrategy(
    shardKey: string,
    shards: ShardConfig[],
    algorithm = 'md5'
  ): ShardingStrategy {
    return {
      type: 'hash',
      shardKey: [{ field: shardKey, type: 'hash', algorithm }],
      shards,
    };
  }

  static createRangeStrategy(
    shardKey: string,
    ranges: Array<{ id: string; minValue: number; maxValue: number }>,
    shards: ShardConfig[]
  ): ShardingStrategy {
    return {
      type: 'range',
      shardKey: [{ field: shardKey, type: 'range' }],
      shards: shards.map((shard, index) => ({
        ...shard,
        minValue: ranges[index]?.minValue,
        maxValue: ranges[index]?.maxValue,
      })),
    };
  }

  static createConsistentHashStrategy(
    shardKey: string,
    shards: ShardConfig[],
    algorithm = 'md5'
  ): ShardingStrategy {
    return {
      type: 'consistent_hash',
      shardKey: [{ field: shardKey, type: 'consistent_hash', algorithm }],
      shards,
    };
  }
}
