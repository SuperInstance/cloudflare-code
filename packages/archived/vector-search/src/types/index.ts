/**
 * Core type definitions for the vector search package
 */

/**
 * Represents a vector (embedding) as an array of floating-point numbers
 */
export type Vector = Float32Array | Float64Array | number[];

/**
 * Binary vector for compressed representation
 */
export type BinaryVector = Uint8Array;

/**
 * Vector ID - unique identifier for a vector
 */
export type VectorId = string;

/**
 * Vector metadata for filtering and retrieval
 */
export interface VectorMetadata {
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

/**
 * Complete vector record with ID, vector, and metadata
 */
export interface VectorRecord {
  id: VectorId;
  vector: Vector;
  metadata?: VectorMetadata;
  timestamp?: number;
  namespace?: string;
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  id: VectorId;
  score: number;
  metadata?: VectorMetadata;
  distance?: number;
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  vector: Vector;
  topK?: number;
  filter?: VectorFilter;
  namespace?: string;
  includeMetadata?: boolean;
  includeVector?: boolean;
}

/**
 * Filter for vector search
 */
export interface VectorFilter {
  must?: MetadataFilter[];
  mustNot?: MetadataFilter[];
  should?: MetadataFilter[];
}

/**
 * Individual metadata filter condition
 */
export interface MetadataFilter {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | number[];
}

/**
 * Filter operators
 */
export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  IN = 'in',
  NOT_IN = 'not_in',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
}

/**
 * Distance metrics for vector similarity
 */
export enum DistanceMetric {
  EUCLIDEAN = 'euclidean',
  COSINE = 'cosine',
  DOT_PRODUCT = 'dot_product',
  MANHATTAN = 'manhattan',
  HAMMING = 'hamming',
  JACCARD = 'jaccard',
}

/**
 * Index types
 */
export enum IndexType {
  HNSW = 'hnsw',
  IVF = 'ivf',
  FLAT = 'flat',
  PQ = 'pq',
  SQ = 'sq',
  BINARY = 'binary',
}

/**
 * Index configuration
 */
export interface IndexConfig {
  type: IndexType;
  dimension: number;
  metric: DistanceMetric;
  efConstruction?: number;
  efSearch?: number;
  M?: number;
  nlist?: number;
  nbits?: number;
  nsubvector?: number;
}

/**
 * HNSW-specific configuration
 */
export interface HNSWConfig extends IndexConfig {
  type: IndexType.HNSW;
  M: number; // Maximum number of connections per node
  efConstruction: number; // Size of dynamic candidate list for construction
  efSearch: number; // Size of dynamic candidate list for search
}

/**
 * IVF-specific configuration
 */
export interface IVFConfig extends IndexConfig {
  type: IndexType.IVF;
  nlist: number; // Number of cluster centroids
  nprobe: number; // Number of clusters to search
}

/**
 * Product Quantization configuration
 */
export interface PQConfig extends IndexConfig {
  type: IndexType.PQ;
  nsubvector: number; // Number of subvectors
  nbits: number; // Bits per subvector
}

/**
 * Scalar Quantization configuration
 */
export interface SQConfig extends IndexConfig {
  type: IndexType.SQ;
  quantizerType: 'QT_8bit' | 'QT_8bit_uniform' | 'QT_4bit' | 'QT_fp16';
}

/**
 * Batch operation result
 */
export interface BatchResult {
  succeeded: number;
  failed: number;
  errors: Array<{ id: VectorId; error: string }>;
}

/**
 * Index statistics
 */
export interface IndexStats {
  vectorCount: number;
  dimension: number;
  indexSize: number;
  memoryUsage: number;
  lastUpdated: number;
  indexType: IndexType;
}

/**
 * Search performance metrics
 */
export interface SearchMetrics {
  queryLatency: number;
  vectorsScanned: number;
  cacheHit: boolean;
  indexUsed: string;
}

/**
 * Embedding model configuration
 */
export interface EmbeddingModelConfig {
  name: string;
  dimension: number;
  maxTokens?: number;
  supportedLanguages?: string[];
  modelType: 'text' | 'image' | 'audio' | 'multimodal';
}

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  input: string | string[] | Buffer | Buffer[];
  model?: string;
  dimensions?: number;
  encodingFormat?: 'float' | 'base64';
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  embeddings: Vector[];
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Vector database configuration
 */
export interface VectorDatabaseConfig {
  type: 'cloudflare-vectorize' | 'pinecone' | 'weaviate' | 'qdrant' | 'milvus' | 'memory';
  apiKey?: string;
  endpoint?: string;
  namespace?: string;
  dimension: number;
  metric: DistanceMetric;
  cloudflareAccountId?: string;
  indexName?: string;
  environment?: string;
}

/**
 * Bulk indexing options
 */
export interface BulkIndexOptions {
  batchSize?: number;
  concurrency?: number;
  skipExisting?: boolean;
  updateMetadata?: boolean;
  progressCallback?: (progress: BulkIndexProgress) => void;
}

/**
 * Bulk indexing progress
 */
export interface BulkIndexProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  percentage: number;
  eta?: number;
}

/**
 * Index snapshot for persistence
 */
export interface IndexSnapshot {
  version: string;
  timestamp: number;
  config: IndexConfig;
  vectors: VectorRecord[];
  stats: IndexStats;
}

/**
 * Query plan for optimized search
 */
export interface QueryPlan {
  strategy: 'exact' | 'approximate' | 'hybrid';
  indexesToUse: string[];
  estimatedCost: number;
  filters: VectorFilter;
  limit: number;
  prefetch?: {
    enabled: boolean;
    batchSize: number;
  };
}

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  hitCount: number;
  lastAccessed: number;
}

/**
 * Range search parameters
 */
export interface RangeSearchParams {
  vector: Vector;
  radius: number;
  filter?: VectorFilter;
  maxResults?: number;
}

/**
 * Faceted search parameters
 */
export interface FacetedSearchParams extends SearchQuery {
  facets: FacetDefinition[];
  maxFacetValues?: number;
}

/**
 * Facet definition
 */
export interface FacetDefinition {
  field: string;
  type: 'term' | 'range' | 'histogram';
  size?: number;
  ranges?: Array<{ from: number; to: number; label?: string }>;
}

/**
 * Facet result
 */
export interface FacetResult {
  field: string;
  values: FacetValue[];
}

/**
 * Facet value
 */
export interface FacetValue {
  value: string | number;
  count: number;
  displayName?: string;
}

/**
 * Hybrid search parameters
 */
export interface HybridSearchParams {
  vector: Vector;
  query: string;
  topK?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  filter?: VectorFilter;
  alpha?: number; // Interpolation parameter between 0 and 1
}

/**
 * Re-ranking options
 */
export interface RerankOptions {
  method: 'none' | 'score-fusion' | 'rrf' | 'custom';
  topK?: number;
  customFunction?: (results: SearchResult[]) => SearchResult[];
}

/**
 * Index operation types
 */
export enum IndexOperation {
  INSERT = 'insert',
  UPDATE = 'update',
  DELETE = 'delete',
  UPSERT = 'upsert',
}

/**
 * Index operation result
 */
export interface IndexOperationResult {
  operation: IndexOperation;
  success: boolean;
  vectorId?: VectorId;
  error?: string;
}

/**
 * Quantization types
 */
export enum QuantizationType {
  NONE = 'none',
  SCALAR_8BIT = 'scalar_8bit',
  SCALAR_4BIT = 'scalar_4bit',
  PRODUCT = 'product',
  BINARY = 'binary',
}

/**
 * Vector normalization methods
 */
export enum NormalizationMethod {
  NONE = 'none',
  L2 = 'l2',
  UNIT = 'unit',
  MAX = 'max',
}

/**
 * Index optimization options
 */
export interface IndexOptimizationOptions {
  targetRecall?: number;
  targetLatency?: number;
  maxMemoryUsage?: number;
  compactIndex?: boolean;
  rebuildIndex?: boolean;
  updateStatistics?: boolean;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  avgQueryLatency: number;
  p95QueryLatency: number;
  p99QueryLatency: number;
  queriesPerSecond: number;
  indexSize: number;
  memoryUsage: number;
  cacheHitRate: number;
  recallRate: number;
}

/**
 * Index health status
 */
export enum IndexHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  BUILDING = 'building',
}

/**
 * Index health check result
 */
export interface IndexHealthCheck {
  status: IndexHealth;
  message: string;
  metrics: PerformanceMetrics;
  issues: string[];
  warnings: string[];
}
