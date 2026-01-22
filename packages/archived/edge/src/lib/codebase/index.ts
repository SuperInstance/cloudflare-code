/**
 * Codebase RAG Indexing Module
 *
 * Exports all components for codebase indexing and retrieval.
 *
 * Usage:
 * ```typescript
 * import { CodebaseParser, CodeChunker, CodeEmbeddingGenerator, CodeVectorStore, CodeRetriever } from '@claudeflare/edge/codebase';
 *
 * // Parse and chunk code
 * const parser = new CodebaseParser();
 * const chunker = new CodeChunker();
 * const parsed = await parser.parseFile(code, 'file.ts');
 * const chunks = await chunker.chunk(parsed);
 *
 * // Generate embeddings and index
 * const embedder = new CodeEmbeddingGenerator({ ai });
 * const store = new CodeVectorStore();
 * const embedded = await embedder.generateEmbeddings(chunks);
 * await store.index(embedded);
 *
 * // Retrieve relevant code
 * const retriever = new CodeRetriever(store, embedder);
 * const results = await retriever.retrieve('search query');
 * ```
 */

// Types
export type {
  SupportedLanguage,
  ChunkType,
  Import,
  Export,
  FileStructure,
  CodeChunk,
  ParsedFile,
  ChunkFilter,
  ChunkSearchResult,
  ConversationContext,
  RetrievedCode,
  ParserOptions,
  ChunkerOptions,
  EmbeddingGeneratorOptions,
  VectorStoreOptions,
  RetrieverOptions,
  IndexingStats,
  SearchStats,
  UploadResult,
  BatchUploadResult,
} from './types';

// Parser
export { CodebaseParser, createParser, defaultParser } from './parser';

// Chunker
export { CodeChunker, createChunker, defaultChunker } from './chunker';

// Embeddings
export { CodeEmbeddingGenerator, createCodeEmbeddingGenerator, defaultCodeEmbeddingGenerator } from './embeddings';

// Vector Store
export { CodeVectorStore, createCodeVectorStore } from './vector-store';

// Retriever
export { CodeRetriever, createCodeRetriever } from './retriever';

// Re-export for convenience
export { EmbeddingService } from '../embeddings';
export { HNSWIndex, createHNSWIndex } from '../hnsw';
