/**
 * Core Types for ClaudeFlare Database Package
 * Provides unified type definitions for multi-database support
 */

// ============================================================================
// Database Type Enums
// ============================================================================

export enum DatabaseType {
  D1 = 'd1',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  MONGODB = 'mongodb',
  REDIS = 'redis',
}

export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

export enum TransactionStatus {
  ACTIVE = 'active',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
  FAILED = 'failed',
}

// ============================================================================
// Connection Configuration
// ============================================================================

export interface DatabaseConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  maxConnections?: number;
  minConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  acquireTimeout?: number;
  maxLifetime?: number;
}

export interface D1Config extends DatabaseConfig {
  type: DatabaseType.D1;
  binding: string;
  accountId?: string;
  apiKey?: string;
}

export interface PostgreSQLConfig extends DatabaseConfig {
  type: DatabaseType.POSTGRESQL;
  host: string;
  port: number;
  username: string;
  password: string;
  ssl?: boolean;
  schema?: string;
}

export interface MySQLConfig extends DatabaseConfig {
  type: DatabaseType.MYSQL;
  host: string;
  port: number;
  username: string;
  password: string;
  charset?: string;
  timezone?: string;
}

export interface MongoDBConfig extends DatabaseConfig {
  type: DatabaseType.MONGODB;
  url: string;
  replicaSet?: string;
  authSource?: string;
}

export interface RedisConfig extends DatabaseConfig {
  type: DatabaseType.REDIS;
  host: string;
  port: number;
  password?: string;
  db?: number;
  sentinel?: boolean;
  sentinelName?: string;
}

export type AnyDatabaseConfig =
  | D1Config
  | PostgreSQLConfig
  | MySQLConfig
  | MongoDBConfig
  | RedisConfig;

// ============================================================================
// Query Types
// ============================================================================

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | Date
  | Buffer
  | QueryValue[]
  | { [key: string]: QueryValue };

export interface QueryCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN' | 'BETWEEN' | 'IS NULL' | 'IS NOT NULL';
  value?: QueryValue;
  logic?: 'AND' | 'OR';
}

export interface QueryOptions {
  select?: string[];
  where?: QueryCondition[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  groupBy?: string[];
  having?: QueryCondition[];
  limit?: number;
  offset?: number;
  distinct?: boolean;
  joins?: JoinClause[];
  with?: CTEClause[];
}

export interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  table: string;
  on: QueryCondition[];
  alias?: string;
}

export interface CTEClause {
  name: string;
  query: QueryOptions | string;
  recursive?: boolean;
}

// ============================================================================
// Result Types
// ============================================================================

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  affectedRows?: number;
  insertId?: string | number;
  fields?: FieldInfo[];
  executionTime: number;
}

export interface FieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  defaultValue?: any;
}

// ============================================================================
// ORM Types
// ============================================================================

export type RelationType = 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';

export interface RelationDefinition {
  type: RelationType;
  model: string;
  foreignKey: string;
  localKey?: string;
  through?: string;
  throughForeignKey?: string;
  throughLocalKey?: string;
  eager?: boolean;
}

export interface ModelDefinition {
  tableName: string;
  primaryKey: string;
  timestamps?: boolean;
  softDelete?: boolean;
  schema?: Record<string, FieldDefinition>;
  relations?: Record<string, RelationDefinition>;
  scopes?: Record<string, (query: QueryBuilder) => QueryBuilder>;
  hooks?: ModelHooks;
}

export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'text' | 'binary';
  nullable?: boolean;
  unique?: boolean;
  defaultValue?: any;
  validate?: (value: any) => boolean | string;
  transform?: {
    get?: (value: any) => any;
    set?: (value: any) => any;
  };
}

export interface ModelHooks {
  beforeFind?: (query: QueryBuilder) => void;
  afterFind?: (results: any[]) => void | Promise<void>;
  beforeCreate?: (data: any) => void | Promise<void>;
  afterCreate?: (model: any) => void | Promise<void>;
  beforeUpdate?: (data: any) => void | Promise<void>;
  afterUpdate?: (model: any) => void | Promise<void>;
  beforeSave?: (data: any) => void | Promise<void>;
  afterSave?: (model: any) => void | Promise<void>;
  beforeDelete?: (id: any) => void | Promise<void>;
  afterDelete?: (id: any) => void | Promise<void>;
}

export interface ModelInstance<T = any> {
  [key: string]: any;
  save(): Promise<ModelInstance<T>>;
  delete(): Promise<boolean>;
  refresh(): Promise<ModelInstance<T>>;
  toJSON(): T;
}

// ============================================================================
// Migration Types
// ============================================================================

export interface MigrationDefinition {
  name: string;
  up: (db: DatabaseAdapter) => Promise<void>;
  down: (db: DatabaseAdapter) => Promise<void>;
  timestamp?: number;
}

export interface MigrationRecord {
  id: string;
  name: string;
  batch: number;
  executedAt: Date;
}

export interface SchemaChange {
  type: 'createTable' | 'dropTable' | 'addColumn' | 'dropColumn' | 'renameColumn' | 'changeColumn' | 'addIndex' | 'dropIndex' | 'addForeignKey' | 'dropForeignKey';
  table: string;
  specifics: any;
}

export interface SchemaDiff {
  added: SchemaChange[];
  removed: SchemaChange[];
  modified: SchemaChange[];
}

// ============================================================================
// Connection Pool Types
// ============================================================================

export interface PoolConfig {
  max: number;
  min: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  maxLifetimeMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
}

export interface PoolStats {
  total: number;
  idle: number;
  active: number;
  waiting: number;
  max: number;
  min: number;
}

export interface ConnectionInfo {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  acquiredAt?: Date;
  isValid: boolean;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
  timeout?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface Savepoint {
  name: string;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  status: TransactionStatus;
  isolationLevel: IsolationLevel;
  beginTime: Date;
  endTime?: Date;
  commit(query: string, params?: any[]): Promise<QueryResult>;
  rollback(): Promise<void>;
  createSavepoint(name?: string): Promise<Savepoint>;
  releaseSavepoint(name: string): Promise<void>;
  rollbackToSavepoint(name: string): Promise<void>;
}

// ============================================================================
// Sharding Types
// ============================================================================

export interface ShardConfig {
  id: string;
  database: string;
  host: string;
  port: number;
  weight?: number;
  region?: string;
  isPrimary?: boolean;
  isReplica?: boolean;
}

export interface ShardKeyDefinition {
  field: string;
  type: 'hash' | 'range' | 'consistent_hash';
  algorithm?: 'md5' | 'sha1' | 'sha256' | 'murmurhash3';
}

export interface ShardingStrategy {
  type: 'hash' | 'range' | 'directory' | 'consistent_hash' | 'custom';
  shardKey: ShardKeyDefinition[];
  shards: ShardConfig[];
  replicas?: number;
}

export interface ShardRouter {
  route(key: any): ShardConfig | ShardConfig[];
  routeAll(): ShardConfig[];
  addShard(shard: ShardConfig): void;
  removeShard(shardId: string): void;
  rebalance(): Promise<void>;
}

// ============================================================================
// Import References
// ============================================================================

import { DatabaseAdapter } from '../adapters/adapter';
import { QueryBuilder } from '../query/builder';
