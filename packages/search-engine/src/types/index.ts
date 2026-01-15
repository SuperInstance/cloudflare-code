export interface SearchDocument {
  id: string;
  title?: string;
  content: string;
  metadata: Record<string, any>;
  vector?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  id: string;
  title?: string;
  content: string;
  score: number;
  highlights: string[];
  metadata: Record<string, any>;
}

export interface SearchResultWithDistance extends SearchResult {
  distance?: number;
}

export interface SearchQuery {
  query: string;
  filters?: Record<string, any>;
  facets?: string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FullTextSearchQuery extends SearchQuery {
  useStemming?: boolean;
  useStopWords?: boolean;
  useFuzzy?: boolean;
  fuzzyThreshold?: number;
}

export interface VectorSearchQuery extends SearchQuery {
  vector?: number[];
  similarityMetric?: 'cosine' | 'euclidean' | 'dotProduct';
  minSimilarity?: number;
  maxResults?: number;
}

export interface HybridSearchQuery extends SearchQuery {
  fullTextWeight?: number;
  vectorWeight?: number;
  useReciprocalRankFusion?: boolean;
}

export interface IndexOptions {
  type: 'fulltext' | 'vector' | 'hybrid';
  fields: string[];
  vectorSize?: number;
  similarityMetric?: 'cosine' | 'euclidean' | 'dotProduct';
  shardCount?: number;
  replicationFactor?: number;
}

export interface SearchStats {
  totalDocuments: number;
  totalIndexed: number;
  averageQueryTime: number;
  cacheHitRate: number;
  indexSize: number;
  lastIndexed: Date;
}

export interface QueryOptimizerOptions {
  useCache?: boolean;
  cacheSize?: number;
  expansionThreshold?: number;
  planningTimeout?: number;
}

export interface IndexMetadata {
  name: string;
  type: 'fulltext' | 'vector' | 'hybrid';
  version: string;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
  options: IndexOptions;
}

export interface FacetResult {
  field: string;
  values: Array<{
    value: string | number;
    count: number;
    percentage: number;
  }>;
}

export interface SearchAnalytics {
  totalQueries: number;
  averageResponseTime: number;
  topQueries: Array<{
    query: string;
    count: number;
    averageScore: number;
  }>;
  failedQueries: number;
  indexedDocuments: number;
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}