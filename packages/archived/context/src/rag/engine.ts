// @ts-nocheck
/**
 * RAG Engine - Retrieval-Augmented Generation with document chunking and embedding-based retrieval
 */

import {
  Document,
  DocumentChunk,
  DocumentMetadata,
  ChunkMetadata,
  RAGConfig,
  RetrievalQuery,
  RetrievalResult,
  RetrievedChunk,
  RetrievalStrategy,
  RetrievalFilter,
  Citation,
  RetrievalError,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';

/**
 * Default RAG configuration
 */
const DEFAULT_CONFIG: RAGConfig = {
  chunkSize: 512,
  chunkOverlap: 50,
  maxChunks: 10,
  retrievalStrategy: 'hybrid',
  embeddingModel: 'text-embedding-ada-002',
  rerankingEnabled: true,
  citationEnabled: true,
  minRelevanceScore: 0.7,
};

/**
 * RAG Engine - Handles document indexing, chunking, and retrieval
 */
export class RAGEngine extends EventEmitter {
  private documents: Map<string, Document> = new Map();
  private chunks: Map<string, DocumentChunk> = new Map();
  private chunkIndex: Map<string, Set<string>> = new Map(); // documentId -> chunkIds
  private config: RAGConfig;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(config: Partial<RAGConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========================================================================
  // Document Management
  // ========================================================================

  /**
   * Add a document to the index
   */
  async addDocument(
    content: string,
    metadata: DocumentMetadata
  ): Promise<Document> {
    const documentId = uuidv4();
    const now = Date.now();

    const document: Document = {
      id: documentId,
      content,
      metadata: {
        ...metadata,
        createdAt: now,
        updatedAt: now,
      },
      chunks: [],
    };

    // Chunk the document
    const chunks = await this.chunkDocument(document);

    // Generate embeddings for chunks
    for (const chunk of chunks) {
      chunk.embedding = await this.generateEmbedding(chunk.content);
    }

    document.chunks = chunks;

    // Store document and chunks
    this.documents.set(documentId, document);

    const chunkIds = new Set<string>();
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
      chunkIds.add(chunk.id);
    }
    this.chunkIndex.set(documentId, chunkIds);

    this.emit('document_added', { documentId, chunkCount: chunks.length });

    return document;
  }

  /**
   * Add multiple documents in batch
   */
  async addDocuments(
    documents: Array<{ content: string; metadata: DocumentMetadata }>
  ): Promise<Document[]> {
    const added: Document[] = [];

    for (const doc of documents) {
      const document = await this.addDocument(doc.content, doc.metadata);
      added.push(document);
    }

    return added;
  }

  /**
   * Get a document by ID
   */
  async getDocument(documentId: string): Promise<Document | null> {
    return this.documents.get(documentId) || null;
  }

  /**
   * Update a document
   */
  async updateDocument(
    documentId: string,
    updates: Partial<Document>
  ): Promise<Document> {
    const document = this.documents.get(documentId);

    if (!document) {
      throw new RetrievalError(`Document not found: ${documentId}`);
    }

    // Remove old chunks
    const oldChunkIds = this.chunkIndex.get(documentId);
    if (oldChunkIds) {
      for (const chunkId of oldChunkIds) {
        this.chunks.delete(chunkId);
      }
    }

    // Apply updates
    Object.assign(document, updates);

    // Re-chunk if content changed
    if (updates.content) {
      const chunks = await this.chunkDocument(document);

      for (const chunk of chunks) {
        chunk.embedding = await this.generateEmbedding(chunk.content);
      }

      document.chunks = chunks;

      const chunkIds = new Set<string>();
      for (const chunk of chunks) {
        this.chunks.set(chunk.id, chunk);
        chunkIds.add(chunk.id);
      }
      this.chunkIndex.set(documentId, chunkIds);
    }

    document.metadata.updatedAt = Date.now();

    return document;
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const document = this.documents.get(documentId);

    if (!document) return;

    // Remove chunks
    const chunkIds = this.chunkIndex.get(documentId);
    if (chunkIds) {
      for (const chunkId of chunkIds) {
        this.chunks.delete(chunkId);
      }
      this.chunkIndex.delete(documentId);
    }

    // Remove document
    this.documents.delete(documentId);

    this.emit('document_deleted', { documentId });
  }

  /**
   * List all documents
   */
  async listDocuments(filters?: {
    source?: string;
    tags?: string[];
    limit?: number;
  }): Promise<Document[]> {
    let documents = Array.from(this.documents.values());

    if (filters?.source) {
      documents = documents.filter(d => d.metadata.source === filters.source);
    }

    if (filters?.tags && filters.tags.length > 0) {
      documents = documents.filter(d =>
        filters.tags!.some(tag => d.metadata.tags?.includes(tag))
      );
    }

    if (filters?.limit) {
      documents = documents.slice(0, filters.limit);
    }

    return documents;
  }

  // ========================================================================
  // Document Chunking
  // ========================================================================

  /**
   * Chunk a document into smaller pieces
   */
  async chunkDocument(document: Document): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const content = document.content;
    const chunkSize = this.config.chunkSize;
    const overlap = this.config.chunkOverlap;

    // Split content into chunks
    let position = 0;
    let chunkIndex = 0;

    while (position < content.length) {
      const endPosition = Math.min(position + chunkSize, content.length);

      // Find natural break point (sentence boundary)
      let breakPoint = endPosition;
      if (endPosition < content.length) {
        // Look for sentence boundary within overlap window
        const searchStart = Math.max(position, endPosition - overlap);
        const window = content.substring(searchStart, endPosition);

        const lastPeriod = window.lastIndexOf('. ');
        const lastQuestion = window.lastIndexOf('? ');
        const lastExclamation = window.lastIndexOf '! ';
        const lastNewline = window.lastIndexOf('\n');

        breakPoint =
          searchStart +
          Math.max(lastPeriod, lastQuestion, lastExclamation, lastNewline) +
          1;

        if (breakPoint <= position) {
          breakPoint = endPosition;
        }
      }

      const chunkContent = content.substring(position, breakPoint);

      const chunk: DocumentChunk = {
        id: uuidv4(),
        documentId: document.id,
        content: chunkContent,
        index: chunkIndex,
        metadata: {
          startPosition: position,
          endPosition: breakPoint,
          tokens: await this.countTokens(chunkContent),
        },
      };

      chunks.push(chunk);

      position = breakPoint;
      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Re-chunk a document with new configuration
   */
  async rechunkDocument(
    documentId: string,
    chunkSize: number,
    chunkOverlap: number
  ): Promise<DocumentChunk[]> {
    const oldConfig = { ...this.config };
    this.config.chunkSize = chunkSize;
    this.config.chunkOverlap = chunkOverlap;

    const document = await this.getDocument(documentId);
    if (!document) {
      throw new RetrievalError(`Document not found: ${documentId}`);
    }

    // Remove old chunks
    const oldChunkIds = this.chunkIndex.get(documentId);
    if (oldChunkIds) {
      for (const chunkId of oldChunkIds) {
        this.chunks.delete(chunkId);
      }
    }

    // Create new chunks
    const chunks = await this.chunkDocument(document);

    for (const chunk of chunks) {
      chunk.embedding = await this.generateEmbedding(chunk.content);
    }

    document.chunks = chunks;

    const chunkIds = new Set<string>();
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
      chunkIds.add(chunk.id);
    }
    this.chunkIndex.set(documentId, chunkIds);

    this.config = oldConfig;

    return chunks;
  }

  // ========================================================================
  // Retrieval
  // ========================================================================

  /**
   * Retrieve relevant chunks for a query
   */
  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now();

    let chunks: RetrievedChunk[] = [];

    switch (this.config.retrievalStrategy) {
      case 'semantic':
        chunks = await this.semanticRetrieval(query);
        break;
      case 'keyword':
        chunks = await this.keywordRetrieval(query);
        break;
      case 'hybrid':
        chunks = await this.hybridRetrieval(query);
        break;
      case 'dense':
        chunks = await this.denseRetrieval(query);
        break;
      case 'sparse':
        chunks = await this.sparseRetrieval(query);
        break;
      default:
        throw new RetrievalError(`Unknown retrieval strategy: ${this.config.retrievalStrategy}`);
    }

    // Apply filters
    if (query.filters && query.filters.length > 0) {
      chunks = await this.applyFilters(chunks, query.filters);
    }

    // Rerank if enabled
    if (this.config.rerankingEnabled) {
      chunks = await this.rerankChunks(query.query, chunks);
    }

    // Apply minimum relevance score
    const minScore = query.minScore ?? this.config.minRelevanceScore;
    chunks = chunks.filter(c => c.score >= minScore);

    // Limit results
    chunks = chunks.slice(0, query.limit);

    // Generate citations if enabled
    if (this.config.citationEnabled) {
      chunks = await this.generateCitations(chunks, query.query);
    }

    const retrievalTime = Date.now() - startTime;

    return {
      chunks,
      query: query.query,
      totalCount: chunks.length,
      retrievalTime,
    };
  }

  /**
   * Semantic retrieval using embeddings
   */
  private async semanticRetrieval(
    query: RetrievalQuery
  ): Promise<RetrievedChunk[]> {
    const results: RetrievedChunk[] = [];

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query.query);

    // Calculate similarity for all chunks
    for (const chunk of this.chunks.values()) {
      if (!chunk.embedding) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);

      results.push({
        chunk,
        score: similarity,
        relevance: similarity,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Keyword retrieval using BM25
   */
  private async keywordRetrieval(
    query: RetrievalQuery
  ): Promise<RetrievedChunk[]> {
    const results: RetrievedChunk[] = [];

    const queryTerms = query.query.toLowerCase().split(/\s+/);

    // Calculate BM25 score for each chunk
    for (const chunk of this.chunks.values()) {
      const content = chunk.content.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        const termFreq = (content.match(new RegExp(term, 'g')) || []).length;
        if (termFreq > 0) {
          score += termFreq * (1 + Math.log(termFreq));
        }
      }

      if (score > 0) {
        results.push({
          chunk,
          score,
          relevance: Math.min(1.0, score / 10),
        });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Hybrid retrieval combining semantic and keyword
   */
  private async hybridRetrieval(
    query: RetrievalQuery
  ): Promise<RetrievedChunk[]> {
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticRetrieval(query),
      this.keywordRetrieval(query),
    ]);

    // Combine scores
    const combined = new Map<string, RetrievedChunk>();

    const semanticWeight = 0.7;
    const keywordWeight = 0.3;

    for (const result of semanticResults) {
      combined.set(result.chunk.id, {
        ...result,
        score: result.score * semanticWeight,
      });
    }

    for (const result of keywordResults) {
      const existing = combined.get(result.chunk.id);
      if (existing) {
        existing.score += result.score * keywordWeight;
        existing.relevance = (existing.relevance + result.relevance) / 2;
      } else {
        combined.set(result.chunk.id, {
          ...result,
          score: result.score * keywordWeight,
        });
      }
    }

    const results = Array.from(combined.values());
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Dense retrieval using only embeddings
   */
  private async denseRetrieval(
    query: RetrievalQuery
  ): Promise<RetrievedChunk[]> {
    return this.semanticRetrieval(query);
  }

  /**
   * Sparse retrieval using only keywords
   */
  private async sparseRetrieval(
    query: RetrievalQuery
  ): Promise<RetrievedChunk[]> {
    return this.keywordRetrieval(query);
  }

  /**
   * Apply filters to retrieval results
   */
  private async applyFilters(
    chunks: RetrievedChunk[],
    filters: RetrievalFilter[]
  ): Promise<RetrievedChunk[]> {
    return chunks.filter(result => {
      const document = this.documents.get(result.chunk.documentId);
      if (!document) return false;

      return filters.every(filter => {
        const value = this.getFilterValue(document, result.chunk, filter.field);
        return this.matchFilter(value, filter.operator, filter.value);
      });
    });
  }

  /**
   * Get value for filtering
   */
  private getFilterValue(
    document: Document,
    chunk: DocumentChunk,
    field: string
  ): any {
    if (field.startsWith('metadata.')) {
      const key = field.substring(9);
      return document.metadata[key];
    }

    if (field.startsWith('chunk.')) {
      const key = field.substring(6);
      return chunk.metadata[key];
    }

    return (document as any)[field];
  }

  /**
   * Match filter value
   */
  private matchFilter(
    value: any,
    operator: string,
    filterValue: any
  ): boolean {
    switch (operator) {
      case 'eq':
        return value === filterValue;
      case 'ne':
        return value !== filterValue;
      case 'gt':
        return value > filterValue;
      case 'lt':
        return value < filterValue;
      case 'gte':
        return value >= filterValue;
      case 'lte':
        return value <= filterValue;
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value);
      case 'contains':
        return Array.isArray(value) && value.includes(filterValue);
      default:
        return false;
    }
  }

  /**
   * Rerank chunks based on query relevance
   */
  private async rererankChunks(
    query: string,
    chunks: RetrievedChunk[]
  ): Promise<RetrievedChunk[]> {
    // Simple reranking based on exact phrase matches
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    for (const result of chunks) {
      const content = result.chunk.content.toLowerCase();

      // Boost for exact phrase match
      if (content.includes(queryLower)) {
        result.score *= 1.5;
      }

      // Boost for multiple word matches
      const matchCount = queryWords.filter(w => content.includes(w)).length;
      if (matchCount > 1) {
        result.score *= 1 + (matchCount / queryWords.length) * 0.3;
      }

      // Boost for query terms appearing early in chunk
      const firstMatch = content.indexOf(queryWords[0]);
      if (firstMatch < result.chunk.content.length * 0.2) {
        result.score *= 1.2;
      }
    }

    // Re-sort after reranking
    chunks.sort((a, b) => b.score - a.score);

    return chunks;
  }

  /**
   * Generate citations for retrieved chunks
   */
  private async generateCitations(
    chunks: RetrievedChunk[],
    query: string
  ): Promise<RetrievedChunk[]> {
    for (const result of chunks) {
      const document = this.documents.get(result.chunk.documentId);
      if (!document) continue;

      const citation: Citation = {
        id: uuidv4(),
        source: document.metadata.source || document.id,
        text: result.chunk.content.substring(0, 200) + '...',
        startPosition: result.chunk.metadata.startPosition,
        endPosition: result.chunk.metadata.endPosition,
        confidence: result.score,
      };

      result.citation = `[${citation.source}]`;
    }

    return chunks;
  }

  // ========================================================================
  // Embedding Generation
  // ========================================================================

  /**
   * Generate embedding for text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Check cache
    const cacheKey = this.hashText(text);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    // Generate mock embedding (in production, use actual embedding model)
    const embedding = this.mockEmbedding(text);

    // Cache embedding
    this.embeddingCache.set(cacheKey, embedding);

    return embedding;
  }

  /**
   * Mock embedding generation
   */
  private mockEmbedding(text: string): number[] {
    const dimension = 1536; // OpenAI embedding dimension
    const embedding: number[] = [];

    // Generate deterministic but pseudo-random embedding based on text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash = hash & hash;
    }

    const seed = Math.abs(hash);

    for (let i = 0; i < dimension; i++) {
      // Simple PRNG
      const x = Math.sin(seed + i) * 10000;
      embedding.push(x - Math.floor(x));
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  /**
   * Hash text for caching
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Count tokens in text
   */
  private async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get statistics
   */
  getStats(): {
    documentCount: number;
    chunkCount: number;
    totalTokens: number;
    avgChunkSize: number;
    embeddingCacheSize: number;
  } {
    let totalTokens = 0;

    for (const chunk of this.chunks.values()) {
      totalTokens += chunk.metadata.tokens || 0;
    }

    return {
      documentCount: this.documents.size,
      chunkCount: this.chunks.size,
      totalTokens,
      avgChunkSize: this.chunks.size > 0 ? totalTokens / this.chunks.size : 0,
      embeddingCacheSize: this.embeddingCache.size,
    };
  }

  /**
   * Clear all documents and chunks
   */
  async clearAll(): Promise<void> {
    this.documents.clear();
    this.chunks.clear();
    this.chunkIndex.clear();
    this.embeddingCache.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RAGConfig {
    return { ...this.config };
  }
}
