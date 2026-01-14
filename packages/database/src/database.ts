/**
 * ClaudeFlare Database Package
 * Enterprise-grade database abstraction layer with multi-database support
 */

// ========================================================================
// Database Adapters
// ========================================================================

export { DatabaseAdapter } from './adapters/adapter';
export { D1Adapter } from './adapters/d1-adapter';
export { PostgreSQLAdapter } from './adapters/postgres-adapter';
export { MySQLAdapter } from './adapters/mysql-adapter';
export { MongoDBAdapter } from './adapters/mongodb-adapter';
export { RedisAdapter } from './adapters/redis-adapter';

// ========================================================================
// Query Builder
// ========================================================================

export {
  QueryBuilder,
  InsertBuilder,
  UpdateBuilder,
  DeleteBuilder,
} from './query/builder';

// ========================================================================
// ORM Layer
// ========================================================================

export {
  Model,
  hasOne,
  hasMany,
  belongsTo,
  belongsToMany,
  Table,
  Field,
  Relation,
  Scope,
} from './orm/model';

// ========================================================================
// Migrations
// ========================================================================

export {
  MigrationManager,
  SchemaBuilder,
  createTable,
  alterTable,
  dropTable,
  renameTable,
  hasTable,
  hasColumn,
  Migration,
  Up,
  Down,
} from './migrations/migrator';

// ========================================================================
// Connection Pool
// ========================================================================

export {
  ConnectionPool,
  ConnectionPoolFactory,
  LoadBalancer,
} from './pool/pool';

// ========================================================================
// Transaction Manager
// ========================================================================

export {
  TransactionManager,
  DistributedTransactionCoordinator,
  TransactionContext,
  Transactional,
} from './transaction/manager';

// ========================================================================
// Sharding
// ========================================================================

export {
  ShardManager,
  Shard,
  ShardingStrategyFactory,
} from './sharding/manager';

// ========================================================================
// Types
// ========================================================================

export * from './types';

// ========================================================================
// Factory Functions
// ========================================================================

import { D1Adapter } from './adapters/d1-adapter';
import { PostgreSQLAdapter } from './adapters/postgres-adapter';
import { MySQLAdapter } from './adapters/mysql-adapter';
import { MongoDBAdapter } from './adapters/mongodb-adapter';
import { RedisAdapter } from './adapters/redis-adapter';
import { AnyDatabaseConfig } from './types';

export class DatabaseFactory {
  static createAdapter(config: AnyDatabaseConfig): any {
    switch (config.type) {
      case 'd1':
        return new D1Adapter(config);
      case 'postgresql':
        return new PostgreSQLAdapter(config);
      case 'mysql':
        return new MySQLAdapter(config);
      case 'mongodb':
        return new MongoDBAdapter(config);
      case 'redis':
        return new RedisAdapter(config);
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  static async connect(config: AnyDatabaseConfig): Promise<any> {
    const adapter = this.createAdapter(config);
    await adapter.connect();
    return adapter;
  }
}

// ========================================================================
// Utility Functions
// ========================================================================

export async function withConnection<T>(
  config: AnyDatabaseConfig,
  callback: (adapter: any) => Promise<T>
): Promise<T> {
  const adapter = DatabaseFactory.createAdapter(config);

  try {
    await adapter.connect();
    return await callback(adapter);
  } finally {
    await adapter.disconnect();
  }
}

export async function withTransaction<T>(
  adapter: any,
  callback: (trx: any) => Promise<T>
): Promise<T> {
  const { TransactionManager } = require('./transaction/manager');
  const manager = new TransactionManager(adapter);
  return manager.transaction(callback);
}

// ========================================================================
// Quick Start Helpers
// ========================================================================

export class QuickDB {
  private adapter: any;

  constructor(config: AnyDatabaseConfig) {
    this.adapter = DatabaseFactory.createAdapter(config);
  }

  async connect(): Promise<void> {
    await this.adapter.connect();
  }

  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
  }

  query(sql: string, params?: any[]): Promise<any> {
    return this.adapter.query(sql, params);
  }

  table(name: string): QueryBuilder {
    const { QueryBuilder } = require('./query/builder');
    return new QueryBuilder(this.adapter, name);
  }

  async transaction<T>(callback: (trx: any) => Promise<T>): Promise<T> {
    const { TransactionManager } = require('./transaction/manager');
    const manager = new TransactionManager(this.adapter);
    return manager.transaction(callback);
  }
}

// ========================================================================
// Default Export
// ========================================================================

export default {
  DatabaseFactory,
  QuickDB,
  withConnection,
  withTransaction,
};
