/**
 * Codebase RAG Indexing - Type Definitions
 *
 * Core types for parsing, chunking, indexing, and retrieving code
 * for Retrieval-Augmented Generation (RAG).
 */

/**
 * Supported programming languages
 */
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'markdown'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'xml'
  | 'html'
  | 'css'
  | 'shell'
  | 'sql';

/**
 * Code chunk types
 */
export type ChunkType = 'function' | 'class' | 'interface' | 'method' | 'import' | 'export' | 'comment' | 'config' | 'other';

/**
 * Import statement
 */
export interface Import {
  module: string;
  symbols: string[];
  isDefault: boolean;
  isDynamic: boolean;
  line: number;
}

/**
 * Export statement
 */
export interface Export {
  name: string;
  isDefault: boolean;
  type: 'function' | 'class' | 'interface' | 'variable' | 'type';
  line: number;
}

/**
 * File structure information
 */
export interface FileStructure {
  path: string;
  language: SupportedLanguage;
  functions: string[];
  classes: string[];
  interfaces: string[];
  variables: string[];
  imports: Import[];
  exports: Export[];
  lineCount: number;
  hasComments: boolean;
}

/**
 * Code chunk interface
 */
export interface CodeChunk {
  id: string;
  filePath: string;
  language: SupportedLanguage;
  content: string;
  startLine: number;
  endLine: number;
  type: ChunkType;

  // Metadata
  name?: string; // function/class name
  signature?: string; // function/class signature
  dependencies: string[]; // IDs of related chunks
  imports: Import[];
  exports: Export[];

  // Embedding (optional until indexed)
  embedding?: Float32Array;

  // Context for better retrieval
  context?: {
    parent?: string; // Parent class/module name
    siblings?: string[]; // Sibling functions/classes
    fileSummary?: string; // Brief summary of the file
  };

  // Timestamps
  indexedAt?: number;
  updatedAt?: number;
}

/**
 * Parsed file result
 */
export interface ParsedFile {
  path: string;
  language: SupportedLanguage;
  content: string;
  chunks: CodeChunk[];
  structure: FileStructure;
  imports: Import[];
  exports: Export[];
  lineCount: number;
}

/**
 * Chunk filter for search queries
 */
export interface ChunkFilter {
  languages?: SupportedLanguage[];
  types?: ChunkType[];
  filePaths?: string[];
  filePathPattern?: string;
  minLine?: number;
  maxLine?: number;
  hasExports?: boolean;
  hasImports?: boolean;
}

/**
 * Search result with metadata
 */
export interface ChunkSearchResult {
  chunk: CodeChunk;
  similarity: number;
  score: number;
  rank: number;
}

/**
 * Conversation context for retrieval
 */
export interface ConversationContext {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
  currentQuery: string;
  previousQueries?: string[];
  relevantFiles?: string[];
  maxTokens?: number;
}

/**
 * Retrieved code with context
 */
export interface RetrievedCode {
  chunks: CodeChunk[];
  context: string;
  metadata: {
    totalTokens: number;
    fileCount: number;
    chunkCount: number;
    averageRelevance: number;
    retrievalTime: number;
  };
}

/**
 * Parser options
 */
export interface ParserOptions {
  /**
   * Include comments in chunks
   */
  includeComments?: boolean;

  /**
   * Maximum chunk size in tokens
   */
  maxChunkSize?: number;

  /**
   * Overlap between chunks in lines
   */
  overlapLines?: number;

  /**
   * Extract function/class signatures
   */
  extractSignatures?: boolean;

  /**
   * Track dependencies
   */
  trackDependencies?: boolean;
}

/**
 * Chunker options
 */
export interface ChunkerOptions {
  /**
   * Maximum chunk size in characters
   */
  maxSize?: number;

  /**
   * Overlap between chunks in characters
   */
  overlap?: number;

  /**
   * Chunk by code structure (functions, classes)
   */
  byStructure?: boolean;

  /**
   * Minimum chunk size
   */
  minSize?: number;

  /**
   * Preserve code structure (indentation, etc.)
   */
  preserveStructure?: boolean;
}

/**
 * Embedding generator options
 */
export interface EmbeddingGeneratorOptions {
  /**
   * Embedding model to use
   */
  model?: string;

  /**
   * Include file path in embedding context
   */
  includePath?: boolean;

  /**
   * Include language in embedding context
   */
  includeLanguage?: boolean;

  /**
   * Include function/class signature in context
   */
  includeSignature?: boolean;

  /**
   * Batch size for embedding generation
   */
  batchSize?: number;

  /**
   * Cloudflare AI binding
   */
  ai?: AiTextEmbeddingsInput;
}

/**
 * Vector store options
 */
export interface VectorStoreOptions {
  /**
   * HNSW index options
   */
  index?: {
    M?: number;
    efConstruction?: number;
    ef?: number;
    maxLayers?: number;
    metric?: 'cosine' | 'euclidean' | 'dotproduct';
  };

  /**
   * Storage backend
   */
  storage?: 'memory' | 'kv' | 'r2';

  /**
   * Cache size for frequently accessed chunks
   */
  cacheSize?: number;

  /**
   * Persistence settings
   */
  persist?: {
    enabled: boolean;
    interval: number; // milliseconds
    keyPrefix: string;
  };
}

/**
 * Retriever options
 */
export interface RetrieverOptions {
  /**
   * Maximum number of chunks to retrieve
   */
  maxChunks?: number;

  /**
   * Maximum tokens in retrieved context
   */
  maxTokens?: number;

  /**
   * Minimum similarity threshold
   */
  minSimilarity?: number;

  /**
   * Re-ranking method
   */
  reranking?: 'none' | 'similarity' | 'recency' | 'hybrid';

  /**
   * Include file context
   */
  includeFileContext?: boolean;

  /**
   * Include related chunks
   */
  includeRelated?: boolean;

  /**
   * Context window for LLM
   */
  contextWindow?: number;
}

/**
 * Indexing statistics
 */
export interface IndexingStats {
  totalFiles: number;
  totalChunks: number;
  totalTokens: number;
  languages: Record<SupportedLanguage, number>;
  avgChunksPerFile: number;
  avgFileSize: number;
  indexingTime: number;
  lastIndexed: number;
}

/**
 * Search statistics
 */
export interface SearchStats {
  totalSearches: number;
  avgSearchTime: number;
  avgResults: number;
  cacheHitRate: number;
  lastSearch: number;
}

/**
 * Upload result
 */
export interface UploadResult {
  success: boolean;
  filePath: string;
  language: SupportedLanguage;
  chunksIndexed: number;
  indexingTime: number;
  error?: string;
}

/**
 * Batch upload result
 */
export interface BatchUploadResult {
  success: boolean;
  files: UploadResult[];
  totalChunks: number;
  totalTime: number;
  errors: string[];
}
