/**
 * Performance Optimization Types
 *
 * Core types for database performance optimization
 */

export interface QueryMetrics {
  query: string;
  executionCount: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  rowsScanned: number;
  rowsReturned: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface CacheEntry {
  key: string;
  value: unknown;
  timestamp: Date;
  ttl: number;
  hits: number;
  size: number;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  maxSizeBytes: number;
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gist' | 'gin';
  reason: string;
  estimatedImprovement: number;
}

export interface QueryPlan {
  query: string;
  plan: string;
  estimatedCost: number;
  actualCost?: number;
  indexes: string[];
  suggestions: IndexSuggestion[];
}

export interface PerformanceReport {
  timestamp: Date;
  totalQueries: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  cacheHitRate: number;
  slowQueries: QueryMetrics[];
  indexSuggestions: IndexSuggestion[];
}
