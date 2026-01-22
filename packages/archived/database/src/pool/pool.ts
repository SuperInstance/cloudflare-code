/**
 * Connection Pool Manager
 * Advanced connection pooling with health checks and failover
 */

import { DatabaseAdapter } from '../adapters/adapter';
import { AnyDatabaseConfig, ConnectionInfo, PoolStats, PoolConfig } from '../types';

// ============================================================================
// Pool Configuration
// ============================================================================

export class ConnectionPool {
  private adapterClass: new (config: AnyDatabaseConfig) => DatabaseAdapter;
  private config: AnyDatabaseConfig;
  private poolConfig: PoolConfig;

  private available: DatabaseAdapter[] = [];
  private inUse: Set<DatabaseAdapter> = new Set();
  private waiting: Array<(adapter: DatabaseAdapter) => void> = [];

  private healthCheckInterval?: NodeJS.Timeout;
  private reapInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  private metrics = {
    totalAcquires: 0,
    totalReleases: 0,
    totalCreates: 0,
    totalDestroys: 0,
    totalErrors: 0,
    failedAcquires: 0,
  };

  constructor(
    adapterClass: new (config: AnyDatabaseConfig) => DatabaseAdapter,
    config: AnyDatabaseConfig,
    poolConfig?: Partial<PoolConfig>
  ) {
    this.adapterClass = adapterClass;
    this.config = config;
    this.poolConfig = this.mergePoolConfig(poolConfig);
  }

  private mergePoolConfig(config?: Partial<PoolConfig>): PoolConfig {
    return {
      max: config?.max || 20,
      min: config?.min || 2,
      acquireTimeoutMillis: config?.acquireTimeoutMillis || 60000,
      idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
      createTimeoutMillis: config?.createTimeoutMillis || 30000,
      destroyTimeoutMillis: config?.destroyTimeoutMillis || 5000,
      maxLifetimeMillis: config?.maxLifetimeMillis || 1800000,
      reapIntervalMillis: config?.reapIntervalMillis || 1000,
      createRetryIntervalMillis: config?.createRetryIntervalMillis || 200,
    };
  }

  // ========================================================================
  // Pool Initialization
  // ========================================================================

  async initialize(): Promise<void> {
    // Create minimum connections
    const createPromises: Promise<DatabaseAdapter>[] = [];

    for (let i = 0; i < this.poolConfig.min; i++) {
      createPromises.push(this.createConnection());
    }

    try {
      const connections = await Promise.all(createPromises);
      this.available.push(...connections);

      // Start health check interval
      this.startHealthChecks();
      this.startReapInterval();
    } catch (error) {
      throw new Error(`Failed to initialize pool: ${error}`);
    }
  }

  // ========================================================================
  // Connection Acquisition
  // ========================================================================

  async acquire(): Promise<DatabaseAdapter> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }

    this.metrics.totalAcquires++;

    // Try to get an available connection
    const adapter = this.available.shift();

    if (adapter) {
      this.inUse.add(adapter);
      return adapter;
    }

    // Check if we can create a new connection
    if (this.getTotalSize() < this.poolConfig.max) {
      try {
        const newAdapter = await this.createConnection();
        this.inUse.add(newAdapter);
        return newAdapter;
      } catch (error) {
        this.metrics.totalErrors++;
        this.metrics.failedAcquires++;
        throw new Error(`Failed to create connection: ${error}`);
      }
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiting.findIndex(cb => cb === resolveCallback);
        if (index > -1) {
          this.waiting.splice(index, 1);
        }
        this.metrics.failedAcquires++;
        reject(new Error('Connection acquisition timeout'));
      }, this.poolConfig.acquireTimeoutMillis);

      const resolveCallback = (adapter: DatabaseAdapter) => {
        clearTimeout(timeout);
        this.inUse.add(adapter);
        resolve(adapter);
      };

      this.waiting.push(resolveCallback);
    });
  }

  // ========================================================================
  // Connection Release
  // ========================================================================

  release(adapter: DatabaseAdapter): void {
    if (this.isShuttingDown) {
      this.destroyConnection(adapter);
      return;
    }

    this.metrics.totalReleases++;

    if (!this.inUse.has(adapter)) {
      throw new Error('Connection not in use');
    }

    this.inUse.delete(adapter);

    // Check if there's a waiting callback
    const waitingCallback = this.waiting.shift();
    if (waitingCallback) {
      process.nextTick(() => waitingCallback(adapter));
    } else {
      this.available.push(adapter);
    }
  }

  // ========================================================================
  // Connection Creation
  // ========================================================================

  private async createConnection(): Promise<DatabaseAdapter> {
    this.metrics.totalCreates++;

    const adapter = new this.adapterClass(this.config);

    try {
      await Promise.race([
        adapter.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection creation timeout')), this.poolConfig.createTimeoutMillis)
        ),
      ]);

      return adapter;
    } catch (error) {
      this.metrics.totalErrors++;
      throw error;
    }
  }

  // ========================================================================
  // Connection Destruction
  // ========================================================================

  private async destroyConnection(adapter: DatabaseAdapter): Promise<void> {
    this.metrics.totalDestroys++;

    try {
      await Promise.race([
        adapter.disconnect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection destroy timeout')), this.poolConfig.destroyTimeoutMillis)
        ),
      ]);
    } catch (error) {
      this.metrics.totalErrors++;
      // Continue anyway
    }
  }

  // ========================================================================
  // Health Checks
  // ========================================================================

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const adapter of [...this.available]) {
        try {
          const isHealthy = await this.checkHealth(adapter);

          if (!isHealthy) {
            const index = this.available.indexOf(adapter);
            if (index > -1) {
              this.available.splice(index, 1);
              await this.destroyConnection(adapter);

              // Create replacement connection
              if (this.getTotalSize() < this.poolConfig.max) {
                try {
                  const newAdapter = await this.createConnection();
                  this.available.push(newAdapter);
                } catch (error) {
                  this.metrics.totalErrors++;
                }
              }
            }
          }
        } catch (error) {
          this.metrics.totalErrors++;
        }
      }
    }, this.poolConfig.reapIntervalMillis);
  }

  private async checkHealth(adapter: DatabaseAdapter): Promise<boolean> {
    try {
      return adapter.isConnected();
    } catch (error) {
      return false;
    }
  }

  // ========================================================================
  // Reap Idle Connections
  // ========================================================================

  private startReapInterval(): void {
    this.reapInterval = setInterval(() => {
      // Reap idle connections that have exceeded the max lifetime
      const now = Date.now();
      const availableToKeep: DatabaseAdapter[] = [];

      for (const adapter of this.available) {
        const connectionInfo = this.getConnectionInfo(adapter);

        if (!connectionInfo) {
          availableToKeep.push(adapter);
          continue;
        }

        const idleTime = now - connectionInfo.lastUsedAt;
        const age = now - connectionInfo.createdAt;

        if (age > this.poolConfig.maxLifetimeMillis || idleTime > this.poolConfig.idleTimeoutMillis) {
          if (this.getTotalSize() > this.poolConfig.min) {
            this.destroyConnection(adapter);
          } else {
            availableToKeep.push(adapter);
          }
        } else {
          availableToKeep.push(adapter);
        }
      }

      this.available = availableToKeep;
    }, this.poolConfig.reapIntervalMillis);
  }

  // ========================================================================
  // Pool Statistics
  // ========================================================================

  getStats(): PoolStats {
    return {
      total: this.getTotalSize(),
      idle: this.available.length,
      active: this.inUse.size,
      waiting: this.waiting.length,
      max: this.poolConfig.max,
      min: this.poolConfig.min,
    };
  }

  getMetrics() {
    return { ...this.metrics };
  }

  private getTotalSize(): number {
    return this.available.length + this.inUse.size;
  }

  private getConnectionInfo(adapter: DatabaseAdapter): ConnectionInfo | null {
    // This is a simplified version
    // In a real implementation, you'd track this metadata
    return null;
  }

  // ========================================================================
  // Pool Lifecycle
  // ========================================================================

  async drain(): Promise<void> {
    this.isShuttingDown = true;

    // Stop intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.reapInterval) {
      clearInterval(this.reapInterval);
    }

    // Wait for all in-use connections to be released
    while (this.inUse.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Destroy all available connections
    const destroyPromises = this.available.map(adapter => this.destroyConnection(adapter));
    await Promise.all(destroyPromises);

    this.available = [];
  }

  clear(): void {
    // Reject all waiting callbacks
    for (const callback of this.waiting) {
      callback(null as any);
    }
    this.waiting = [];
  }

  // ========================================================================
  // Pool Helpers
  // ========================================================================

  isFull(): boolean {
    return this.getTotalSize() >= this.poolConfig.max;
  }

  isEmpty(): boolean {
    return this.available.length === 0 && this.inUse.size === 0;
  }

  getAvailableCount(): number {
    return this.available.length;
  }

  getInUseCount(): number {
    return this.inUse.size;
  }

  getWaitingCount(): number {
    return this.waiting.length;
  }
}

// ============================================================================
// Connection Pool Factory
// ============================================================================

export class ConnectionPoolFactory {
  private static pools: Map<string, ConnectionPool> = new Map();

  static async createPool(
    name: string,
    adapterClass: new (config: AnyDatabaseConfig) => DatabaseAdapter,
    config: AnyDatabaseConfig,
    poolConfig?: Partial<PoolConfig>
  ): Promise<ConnectionPool> {
    if (this.pools.has(name)) {
      throw new Error(`Pool '${name}' already exists`);
    }

    const pool = new ConnectionPool(adapterClass, config, poolConfig);
    await pool.initialize();

    this.pools.set(name, pool);

    return pool;
  }

  static getPool(name: string): ConnectionPool | undefined {
    return this.pools.get(name);
  }

  static async closePool(name: string): Promise<void> {
    const pool = this.pools.get(name);

    if (!pool) {
      throw new Error(`Pool '${name}' not found`);
    }

    await pool.drain();
    this.pools.delete(name);
  }

  static async closeAllPools(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map(pool => pool.drain());

    await Promise.all(closePromises);
    this.pools.clear();
  }

  static getPools(): Map<string, ConnectionPool> {
    return new Map(this.pools);
  }
}

// ============================================================================
// Load Balancer
// ============================================================================

export class LoadBalancer {
  private pools: ConnectionPool[] = [];
  private strategy: 'round-robin' | 'least-connections' | 'random' = 'round-robin';
  private currentIndex = 0;

  constructor(pools: ConnectionPool[], strategy = 'round-robin') {
    this.pools = pools;
    this.strategy = strategy;
  }

  async acquire(): Promise<{ adapter: DatabaseAdapter; pool: ConnectionPool }> {
    let pool: ConnectionPool;

    switch (this.strategy) {
      case 'round-robin':
        pool = this.roundRobin();
        break;
      case 'least-connections':
        pool = this.leastConnections();
        break;
      case 'random':
        pool = this.random();
        break;
      default:
        pool = this.pools[0];
    }

    const adapter = await pool.acquire();

    return { adapter, pool };
  }

  release(adapter: DatabaseAdapter, pool: ConnectionPool): void {
    pool.release(adapter);
  }

  private roundRobin(): ConnectionPool {
    const pool = this.pools[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.pools.length;
    return pool;
  }

  private leastConnections(): ConnectionPool {
    let minConnections = Infinity;
    let selectedPool = this.pools[0];

    for (const pool of this.pools) {
      const stats = pool.getStats();
      if (stats.active < minConnections) {
        minConnections = stats.active;
        selectedPool = pool;
      }
    }

    return selectedPool;
  }

  private random(): ConnectionPool {
    const index = Math.floor(Math.random() * this.pools.length);
    return this.pools[index];
  }

  addPool(pool: ConnectionPool): void {
    this.pools.push(pool);
  }

  removePool(pool: ConnectionPool): void {
    const index = this.pools.indexOf(pool);
    if (index > -1) {
      this.pools.splice(index, 1);
    }
  }

  getPools(): ConnectionPool[] {
    return [...this.pools];
  }

  getStats(): any[] {
    return this.pools.map(pool => pool.getStats());
  }
}
