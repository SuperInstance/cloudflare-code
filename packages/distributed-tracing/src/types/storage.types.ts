/**
 * Storage layer types for distributed tracing
 * Supports Cloudflare Durable Objects and other storage backends
 */

import { Trace, TraceId, Span, SpanId } from './trace.types';

/**
 * Storage backend types
 */
export enum StorageBackend {
  DURABLE_OBJECTS = 'durable_objects',
  MEMORY = 'memory',
  REDIS = 'redis',
  POSTGRESQL = 'postgresql',
  ELASTICSEARCH = 'elasticsearch',
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  backend: StorageBackend;
  connectionString?: string;
  ttl?: number;
  maxConnections?: number;
  retryAttempts?: number;
  retryDelay?: number;
  compression?: boolean;
  encryption?: boolean;
}

/**
 * Durable Object storage specific configuration
 */
export interface DurableObjectConfig {
  namespace: string;
  className: string;
  env?: Record<string, unknown>;
}

/**
 * Storage record
 */
export interface StorageRecord<T> {
  key: string;
  value: T;
  version: number;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Storage index
 */
export interface StorageIndex {
  name: string;
  fields: string[];
  unique: boolean;
}

/**
 * Storage query options
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filter?: Record<string, unknown>;
}

/**
 * Storage batch operation
 */
export interface BatchOperation<T> {
  type: 'put' | 'delete' | 'update';
  key: string;
  value?: T;
}

/**
 * Storage batch result
 */
export interface BatchResult {
  successful: number;
  failed: number;
  errors: Array<{ key: string; error: string }>;
}

/**
 * Trace storage interface
 */
export interface TraceStorage {
  // Trace operations
  getTrace(traceId: TraceId): Promise<Trace | null>;
  putTrace(traceId: TraceId, trace: Trace): Promise<void>;
  deleteTrace(traceId: TraceId): Promise<void>;
  listTraces(options?: QueryOptions): Promise<Trace[]>;

  // Span operations
  getSpan(spanId: SpanId): Promise<Span | null>;
  putSpan(spanId: SpanId, span: Span): Promise<void>;
  deleteSpan(spanId: SpanId): Promise<void>;

  // Batch operations
  batchPutSpans(spans: Span[]): Promise<BatchResult>;
  batchDeleteSpans(spanIds: SpanId[]): Promise<BatchResult>;

  // Query operations
  queryTracesByService(service: string, options?: QueryOptions): Promise<Trace[]>;
  querySpansByTrace(traceId: TraceId): Promise<Span[]>;
  queryTracesByTimeRange(startTime: number, endTime: number, options?: QueryOptions): Promise<Trace[]>;

  // Index operations
  createIndex(index: StorageIndex): Promise<void>;
  deleteIndex(name: string): Promise<void>;

  // Maintenance
  compact(): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<StorageStats>;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalTraces: number;
  totalSpans: number;
  storageSize: number;
  indexSize: number;
  cacheHits: number;
  cacheMisses: number;
  avgReadTime: number;
  avgWriteTime: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  ttl: number;
  strategy: 'lru' | 'lfu' | 'fifo';
}

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  value: T;
  hits: number;
  lastAccessed: number;
  expiresAt: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  evictions: number;
}
