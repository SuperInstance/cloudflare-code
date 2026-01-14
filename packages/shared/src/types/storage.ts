/**
 * Storage type definitions for ClaudeFlare platform
 * @packageDocumentation
 */

import { z } from 'zod';
import type { Message } from './core';

// ============================================================================
// SESSION TYPES
// ============================================================================

/**
 * Session data structure for storing conversation state
 */
export interface SessionData {
  /** Unique session identifier */
  sessionId: string;
  /** User identifier who owns this session */
  userId: string;
  /** Session creation timestamp (Unix ms) */
  createdAt: number;
  /** Last activity timestamp (Unix ms) */
  lastActivity: number;
  /** Messages in this session */
  messages: Message[];
  /** Additional session metadata */
  metadata: SessionMetadata;
  /** Session status */
  status: SessionStatus;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** Project path if applicable */
  projectPath?: string;
  /** Programming language */
  language?: string;
  /** Framework being used */
  framework?: string;
  /** Number of tokens used in session */
  totalTokens?: number;
  /** Total cost incurred in session */
  totalCost?: number;
  /** Number of requests in session */
  requestCount?: number;
  /** Custom metadata fields */
  custom?: Record<string, unknown>;
}

/**
 * Zod schema for SessionMetadata validation
 */
export const SessionMetadataSchema = z.object({
  projectPath: z.string().optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  totalTokens: z.number().nonnegative().optional(),
  totalCost: z.number().nonnegative().optional(),
  requestCount: z.number().nonnegative().optional(),
  custom: z.record(z.unknown()).optional()
});

/**
 * Session status enum
 */
export enum SessionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
  EXPIRED = 'expired'
}

/**
 * Zod schema for SessionData validation
 */
export const SessionDataSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string(),
  createdAt: z.number().nonnegative(),
  lastActivity: z.number().nonnegative(),
  messages: z.array(z.any()), // Message schema from core
  metadata: SessionMetadataSchema,
  status: z.enum(['active', 'inactive', 'archived', 'expired'])
});

// ============================================================================
// CACHE TYPES
// ============================================================================

/**
 * Generic cache entry with TTL support
 */
export interface CacheEntry<T> {
  /** Cache key */
  key: string;
  /** Cached value */
  value: T;
  /** Entry creation timestamp (Unix ms) */
  timestamp: number;
  /** Time-to-live in milliseconds (optional) */
  ttl?: number;
  /** Number of times this entry was accessed */
  accessCount?: number;
  /** Last access timestamp (Unix ms) */
  lastAccess?: number;
}

/**
 * Zod schema for CacheEntry validation
 */
export function createCacheEntrySchema<T extends z.ZodType>(valueSchema: T) {
  return z.object({
    key: z.string(),
    value: valueSchema,
    timestamp: z.number().nonnegative(),
    ttl: z.number().positive().optional(),
    accessCount: z.number().nonnegative().optional(),
    lastAccess: z.number().nonnegative().optional()
  });
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of entries */
  totalEntries: number;
  /** Current cache size in bytes */
  currentSize: number;
  /** Maximum cache size in bytes */
  maxSize: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Number of evictions */
  evictions: number;
}

/**
 * Zod schema for CacheStats validation
 */
export const CacheStatsSchema = z.object({
  totalEntries: z.number().nonnegative(),
  currentSize: z.number().nonnegative(),
  maxSize: z.number().positive(),
  hits: z.number().nonnegative(),
  misses: z.number().nonnegative(),
  hitRate: z.number().min(0).max(1),
  evictions: z.number().nonnegative()
});

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Maximum cache size in bytes */
  maxSize: number;
  /** Default TTL in milliseconds */
  defaultTtl?: number;
  /** Maximum number of entries */
  maxEntries?: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Whether to use LRU eviction */
  useLRU?: boolean;
}

/**
 * Zod schema for CacheConfig validation
 */
export const CacheConfigSchema = z.object({
  maxSize: z.number().positive(),
  defaultTtl: z.number().positive().optional(),
  maxEntries: z.number().positive().optional(),
  cleanupInterval: z.number().positive().optional(),
  useLRU: z.boolean().optional()
});

// ============================================================================
// SEMANTIC CACHE TYPES
// ============================================================================

/**
 * Semantic cache entry for similar queries
 */
export interface SemanticCacheEntry {
  /** Original query text */
  query: string;
  /** Query embedding vector */
  embedding: number[];
  /** Cached response */
  response: SemanticCacheResponse;
  /** Creation timestamp (Unix ms) */
  timestamp: number;
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Similarity threshold used */
  similarityThreshold: number;
  /** Number of hits */
  hitCount: number;
}

/**
 * Semantic cache response data
 */
export interface SemanticCacheResponse {
  /** Response content */
  content: string;
  /** Model used for generation */
  model: string;
  /** Token usage */
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Response latency in milliseconds */
  latency: number;
}

/**
 * Zod schema for SemanticCacheResponse validation
 */
export const SemanticCacheResponseSchema = z.object({
  content: z.string(),
  model: z.string(),
  tokens: z.object({
    prompt: z.number().nonnegative(),
    completion: z.number().nonnegative(),
    total: z.number().nonnegative()
  }),
  latency: z.number().nonnegative()
});

/**
 * Zod schema for SemanticCacheEntry validation
 */
export const SemanticCacheEntrySchema = z.object({
  query: z.string(),
  embedding: z.array(z.number()),
  response: SemanticCacheResponseSchema,
  timestamp: z.number().nonnegative(),
  ttl: z.number().positive(),
  similarityThreshold: z.number().min(0).max(1),
  hitCount: z.number().nonnegative()
});

/**
 * Semantic cache search result
 */
export interface SemanticCacheResult {
  /** Cached entry if found */
  entry?: SemanticCacheEntry;
  /** Similarity score (0-1) */
  similarity: number;
  /** Whether cache was hit */
  cacheHit: boolean;
}

/**
 * Zod schema for SemanticCacheResult validation
 */
export const SemanticCacheResultSchema = z.object({
  entry: SemanticCacheEntrySchema.optional(),
  similarity: z.number().min(0).max(1),
  cacheHit: z.boolean()
});

// ============================================================================
// PERSISTENCE TYPES
// ============================================================================

/**
 * Storage backend types
 */
export enum StorageBackend {
  MEMORY = 'memory',
  FILE = 'file',
  REDIS = 'redis',
  POSTGRESQL = 'postgresql',
  SQLITE = 'sqlite'
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Storage backend type */
  backend: StorageBackend;
  /** Connection string (for DB backends) */
  connectionString?: string;
  /** Base path for file storage */
  basePath?: string;
  /** Maximum concurrent connections */
  maxConnections?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Whether to enable compression */
  enableCompression?: boolean;
  /** Retry attempts for failed operations */
  retryAttempts?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Zod schema for StorageConfig validation
 */
export const StorageConfigSchema = z.object({
  backend: z.enum(['memory', 'file', 'redis', 'postgresql', 'sqlite']),
  connectionString: z.string().optional(),
  basePath: z.string().optional(),
  maxConnections: z.number().positive().optional(),
  connectionTimeout: z.number().positive().optional(),
  enableCompression: z.boolean().optional(),
  retryAttempts: z.number().nonnegative().optional(),
  retryDelay: z.number().positive().optional()
});

/**
 * Storage operation result
 */
export interface StorageResult<T> {
  /** Whether operation was successful */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Operation duration in milliseconds */
  duration: number;
}

/**
 * Zod schema for StorageResult validation
 */
export function createStorageResultSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    duration: z.number().nonnegative()
  });
}

// ============================================================================
// TYPE INFERENCE UTILITIES
// ============================================================================

/**
 * Infer SessionData type from schema
 */
export type SessionDataType = z.infer<typeof SessionDataSchema>;

/**
 * Infer SessionMetadata type from schema
 */
export type SessionMetadataType = z.infer<typeof SessionMetadataSchema>;

/**
 * Infer CacheStats type from schema
 */
export type CacheStatsType = z.infer<typeof CacheStatsSchema>;

/**
 * Infer CacheConfig type from schema
 */
export type CacheConfigType = z.infer<typeof CacheConfigSchema>;

/**
 * Infer SemanticCacheEntry type from schema
 */
export type SemanticCacheEntryType = z.infer<typeof SemanticCacheEntrySchema>;

/**
 * Infer StorageConfig type from schema
 */
export type StorageConfigType = z.infer<typeof StorageConfigSchema>;
