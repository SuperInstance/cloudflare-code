/**
 * @claudeflare/vector-search
 *
 * Advanced vector search and retrieval for the ClaudeFlare distributed AI platform.
 *
 * @example
 * ```typescript
 * import { VectorSearch } from '@claudeflare/vector-search';
 *
 * const search = new VectorSearch({
 *   dimension: 768,
 *   metric: 'cosine',
 *   indexType: 'hnsw',
 * });
 *
 * await search.insert({ id: '1', vector: embedding });
 * const results = await search.search({ vector: query, topK: 10 });
 * ```
 */

// Core types
export * from './types/index.js';

// Vector Index
export { VectorIndex } from './index/vector-index.js';
export { HNSWIndex } from './index/hnsw.js';
export { IVFIndex } from './index/ivf.js';

// Search Engine
export { SearchEngine } from './search/engine.js';

// Embeddings
export { EmbeddingManager } from './embeddings/manager.js';

// Database
export { VectorDatabase } from './database/abstraction.js';

// Real-time Indexing
export { RealtimeIndexer, BulkIndexer } from './indexing/realtime.js';

// Query Optimizer
export { QueryOptimizer } from './optimizer/optimizer.js';

// Cache
export { LRUCache, VectorCache } from './cache/lru-cache.js';

// Utilities
export * from './utils/vector.js';
export * from './utils/filter.js';

// Main VectorSearch class
export { VectorSearch } from './vector-search.js';
