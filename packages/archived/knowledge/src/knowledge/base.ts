/**
 * Knowledge Base - Document storage, indexing, and semantic search
 */

// @ts-nocheck - External dependencies (@claudeflare/durable-objects)

import { DurableObject } from '@claudeflare/durable-objects';
import {
  DocumentContent,
  DocumentMetadata,
  DocumentFilter,
  SearchOptions,
  SearchResult,
  DocumentRelationship,
  KnowledgeBaseOptions,
  StorageBackend,
  EmbeddingProvider,
  SearchProvider
} from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { VectorStore } from './vector-store.js';
import { VersionControl } from './version-control.js';

export interface KnowledgeBaseConfig {
  storage: StorageBackend;
  embeddings: EmbeddingProvider;
  search: SearchProvider;
  enableVersioning?: boolean;
  enableAccessControl?: boolean;
  maxVersions?: number;
}

export class KnowledgeBase extends DurableObject {
  private logger: Logger;
  private vectorStore: VectorStore;
  private versionControl: VersionControl;
  private documents: Map<string, DocumentContent>;
  private embeddings: Map<string, number[]>;
  private relationships: Map<string, DocumentRelationship[]>;
  private accessControl: Map<string, Set<string>>;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.logger = new Logger('KnowledgeBase');
    this.vectorStore = new VectorStore(state, env);
    this.versionControl = new VersionControl(state, env);
    this.documents = new Map();
    this.embeddings = new Map();
    this.relationships = new Map();
    this.accessControl = new Map();
  }

  /**
   * Add or update a document in the knowledge base
   */
  async putDocument(doc: DocumentContent): Promise<void> {
    this.logger.debug(`Adding document: ${doc.metadata.id}`);

    // Store document
    this.documents.set(doc.metadata.id, doc);

    // Generate and store embedding
    const embedding = await this.generateEmbedding(doc);
    this.embeddings.set(doc.metadata.id, embedding);

    // Store in vector database
    await this.vectorStore.upsert(doc.metadata.id, embedding, doc);

    // Index for search
    await this.env.search.index(doc);

    // Save to durable storage
    await this.state.storage.put({
      [`doc:${doc.metadata.id}`]: doc,
      [`embedding:${doc.metadata.id}`]: embedding
    });

    // Extract and store relationships
    await this.extractRelationships(doc);

    this.logger.info(`Document added: ${doc.metadata.id}`);
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string, version?: string): Promise<DocumentContent | null> {
    this.logger.debug(`Getting document: ${id}${version ? `@${version}` : ''}`);

    if (version) {
      return await this.versionControl.getVersion(id, version);
    }

    // Check memory first
    if (this.documents.has(id)) {
      return this.documents.get(id)!;
    }

    // Check durable storage
    const stored = await this.state.storage.get<DocumentContent>(`doc:${id}`);
    if (stored) {
      this.documents.set(id, stored);
      return stored;
    }

    // Check storage backend
    return await this.env.storage.get(id);
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<void> {
    this.logger.debug(`Deleting document: ${id}`);

    // Remove from memory
    this.documents.delete(id);
    this.embeddings.delete(id);
    this.relationships.delete(id);
    this.accessControl.delete(id);

    // Remove from vector store
    await this.vectorStore.remove(id);

    // Remove from search index
    await this.env.search.delete(id);

    // Remove from durable storage
    await this.state.storage.delete([
      `doc:${id}`,
      `embedding:${id}`
    ]);

    // Remove from storage backend
    await this.env.storage.delete(id);

    this.logger.info(`Document deleted: ${id}`);
  }

  /**
   * List documents with optional filtering
   */
  async listDocuments(filter?: DocumentFilter): Promise<DocumentMetadata[]> {
    this.logger.debug('Listing documents', { filter });

    let docs = Array.from(this.documents.values()).map(d => d.metadata);

    // Apply filters
    if (filter) {
      docs = this.applyFilters(docs, filter);
    }

    // Sort by update date (newest first)
    docs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return docs;
  }

  /**
   * Search documents using hybrid search (keyword + semantic)
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    this.logger.debug('Searching documents', { query, options });

    const { limit = 10, offset = 0, filter, semantic = true, fuzzy = true, threshold = 0.7 } = options;

    // Keyword search
    const keywordResults = await this.env.search.search(query, { limit: limit * 2, fuzzy });

    // Semantic search
    let semanticResults: Map<string, number> = new Map();
    if (semantic) {
      const queryEmbedding = await this.generateQueryEmbedding(query);
      const similar = await this.vectorStore.search(queryEmbedding, limit * 2);
      semanticResults = new Map(similar.map(s => [s.id, s.score]));
    }

    // Combine and rank results
    const combined = this.combineResults(
      keywordResults,
      semanticResults,
      threshold
    );

    // Apply filters if provided
    let filtered = combined;
    if (filter) {
      filtered = combined.filter(result =>
        this.matchesFilter(result.document, filter)
      );
    }

    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit);

    // Add highlights and snippets
    const results = await Promise.all(
      paginated.map(async result => ({
        ...result,
        highlights: await this.generateHighlights(result.document, query),
        snippet: this.generateSnippet(result.document, query)
      }))
    );

    this.logger.info(`Search complete: ${query}`, {
      results: results.length,
      duration: 'N/A'
    });

    return results;
  }

  /**
   * Find similar documents
   */
  async findSimilar(
    documentId: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    this.logger.debug(`Finding similar documents: ${documentId}`);

    const embedding = this.embeddings.get(documentId);
    if (!embedding) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const similar = await this.vectorStore.search(embedding, limit + 1);

    // Filter out the original document
    const results = similar
      .filter(s => s.id !== documentId)
      .slice(0, limit)
      .map(s => ({
        document: this.documents.get(s.id)!.metadata,
        score: s.score,
        highlights: [],
        snippet: ''
      }));

    return results;
  }

  /**
   * Get document relationships
   */
  async getRelationships(documentId: string): Promise<DocumentRelationship[]> {
    this.logger.debug(`Getting relationships: ${documentId}`);

    return this.relationships.get(documentId) || [];
  }

  /**
   * Add document relationship
   */
  async addRelationship(
    relationship: DocumentRelationship
  ): Promise<void> {
    this.logger.debug('Adding relationship', relationship);

    const existing = this.relationships.get(relationship.sourceId) || [];
    existing.push(relationship);
    this.relationships.set(relationship.sourceId, existing);

    // Save to storage
    await this.state.storage.put({
      [`relationships:${relationship.sourceId}`]: existing
    });
  }

  /**
   * Get document versions
   */
  async getVersions(documentId: string): Promise<string[]> {
    if (!this.env.enableVersioning) {
      throw new Error('Versioning is not enabled');
    }

    return await this.versionControl.listVersions(documentId);
  }

  /**
   * Check document access
   */
  async checkAccess(documentId: string, userId: string): Promise<boolean> {
    if (!this.env.enableAccessControl) {
      return true;
    }

    const allowed = this.accessControl.get(documentId);
    if (!allowed) {
      return true; // No restrictions
    }

    return allowed.has(userId) || allowed.has('*');
  }

  /**
   * Grant document access
   */
  async grantAccess(
    documentId: string,
    userId: string,
    permission: 'read' | 'write' | 'admin' = 'read'
  ): Promise<void> {
    this.logger.debug(`Granting access to ${documentId} for ${userId}`);

    const allowed = this.accessControl.get(documentId) || new Set();
    allowed.add(userId);
    this.accessControl.set(documentId, allowed);

    // Save to storage
    await this.state.storage.put({
      [`access:${documentId}`]: Array.from(allowed)
    });
  }

  /**
   * Revoke document access
   */
  async revokeAccess(documentId: string, userId: string): Promise<void> {
    this.logger.debug(`Revoking access to ${documentId} for ${userId}`);

    const allowed = this.accessControl.get(documentId);
    if (allowed) {
      allowed.delete(userId);

      // Save to storage
      await this.state.storage.put({
        [`access:${documentId}`]: Array.from(allowed)
      });
    }
  }

  /**
   * Get knowledge base statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    totalSize: number;
    documentsByCategory: Record<string, number>;
    documentsByLanguage: Record<string, number>;
    documentsByTag: Record<string, number>;
  }> {
    const docs = Array.from(this.documents.values());

    const stats = {
      totalDocuments: docs.length,
      totalSize: docs.reduce((sum, doc) => sum + doc.content.length, 0),
      documentsByCategory: {} as Record<string, number>,
      documentsByLanguage: {} as Record<string, number>,
      documentsByTag: {} as Record<string, number>
    };

    // Count by category
    for (const doc of docs) {
      const cat = doc.metadata.category;
      stats.documentsByCategory[cat] = (stats.documentsByCategory[cat] || 0) + 1;

      const lang = doc.metadata.language;
      stats.documentsByLanguage[lang] = (stats.documentsByLanguage[lang] || 0) + 1;

      for (const tag of doc.metadata.tags) {
        stats.documentsByTag[tag] = (stats.documentsByTag[tag] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Rebuild the search index
   */
  async rebuildIndex(): Promise<void> {
    this.logger.info('Rebuilding search index');

    // Clear existing index
    await this.env.search.clear();

    // Re-index all documents
    for (const doc of this.documents.values()) {
      await this.env.search.index(doc);
    }

    this.logger.info('Search index rebuilt');
  }

  /**
   * Export knowledge base
   */
  async export(): Promise<{
    documents: DocumentContent[];
    relationships: DocumentRelationship[];
    exportedAt: Date;
  }> {
    this.logger.info('Exporting knowledge base');

    const documents = Array.from(this.documents.values());
    const relationships: DocumentRelationship[] = [];

    for (const rels of this.relationships.values()) {
      relationships.push(...rels);
    }

    return {
      documents,
      relationships,
      exportedAt: new Date()
    };
  }

  /**
   * Import knowledge base
   */
  async import(data: {
    documents: DocumentContent[];
    relationships: DocumentRelationship[];
  }): Promise<void> {
    this.logger.info('Importing knowledge base');

    // Import documents
    for (const doc of data.documents) {
      await this.putDocument(doc);
    }

    // Import relationships
    for (const rel of data.relationships) {
      await this.addRelationship(rel);
    }

    this.logger.info('Knowledge base imported');
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Generate embedding for a document
   */
  private async generateEmbedding(doc: DocumentContent): Promise<number[]> {
    const text = this.extractTextForEmbedding(doc);
    return await this.env.embeddings.generateEmbedding(text);
  }

  /**
   * Generate embedding for a search query
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    return await this.env.embeddings.generateEmbedding(query);
  }

  /**
   * Extract text content for embedding
   */
  private extractTextForEmbedding(doc: DocumentContent): string {
    const parts: string[] = [];

    // Add title and description
    parts.push(doc.metadata.title);
    parts.push(doc.metadata.description);

    // Add content
    parts.push(doc.content);

    // Add examples
    if (doc.examples) {
      for (const example of doc.examples) {
        parts.push(example.description || '');
        parts.push(example.code);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Combine keyword and semantic search results
   */
  private combineResults(
    keywordResults: Array<{ id: string; score: number }>,
    semanticResults: Map<string, number>,
    threshold: number
  ): SearchResult[] {
    const combined = new Map<string, SearchResult>();

    // Add keyword results
    for (const result of keywordResults) {
      const doc = this.documents.get(result.id);
      if (doc) {
        combined.set(result.id, {
          document: doc.metadata,
          score: result.score,
          highlights: [],
          snippet: ''
        });
      }
    }

    // Combine with semantic scores (70% semantic, 30% keyword)
    for (const [id, score] of semanticResults.entries()) {
      const existing = combined.get(id);
      if (existing) {
        // Weighted combination
        existing.score = (score * 0.7) + (existing.score * 0.3);
      } else if (score >= threshold) {
        const doc = this.documents.get(id);
        if (doc) {
          combined.set(id, {
            document: doc.metadata,
            score,
            highlights: [],
            snippet: ''
          });
        }
      }
    }

    // Filter by threshold and sort
    return Array.from(combined.values())
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Apply filters to document list
   */
  private applyFilters(
    docs: DocumentMetadata[],
    filter: DocumentFilter
  ): DocumentMetadata[] {
    let filtered = docs;

    if (filter.category) {
      filtered = filtered.filter(d => d.category === filter.category);
    }

    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(d =>
        filter.tags!.some(tag => d.tags.includes(tag))
      );
    }

    if (filter.language) {
      filtered = filtered.filter(d => d.language === filter.language);
    }

    if (filter.author) {
      filtered = filtered.filter(d => d.author === filter.author);
    }

    if (filter.dateRange) {
      filtered = filtered.filter(d =>
        d.updatedAt >= filter.dateRange!.start &&
        d.updatedAt <= filter.dateRange!.end
      );
    }

    if (filter.version) {
      filtered = filtered.filter(d => d.version === filter.version);
    }

    return filtered;
  }

  /**
   * Check if document matches filter
   */
  private matchesFilter(
    doc: DocumentMetadata,
    filter: DocumentFilter
  ): boolean {
    if (filter.category && doc.category !== filter.category) {
      return false;
    }

    if (filter.tags && filter.tags.length > 0) {
      if (!filter.tags.some(tag => doc.tags.includes(tag))) {
        return false;
      }
    }

    if (filter.language && doc.language !== filter.language) {
      return false;
    }

    if (filter.author && doc.author !== filter.author) {
      return false;
    }

    if (filter.dateRange) {
      if (doc.updatedAt < filter.dateRange.start || doc.updatedAt > filter.dateRange.end) {
        return false;
      }
    }

    if (filter.version && doc.version !== filter.version) {
      return false;
    }

    return true;
  }

  /**
   * Extract relationships from document
   */
  private async extractRelationships(doc: DocumentContent): Promise<void> {
    const relationships: DocumentRelationship[] = [];

    // Extract references
    if (doc.references) {
      for (const ref of doc.references) {
        if (ref.type === 'internal') {
          // Check if referenced document exists
          const target = await this.getDocument(ref.target);
          if (target) {
            relationships.push({
              sourceId: doc.metadata.id,
              targetId: ref.target,
              type: 'reference',
              strength: 0.8
            });
          }
        }
      }
    }

    // Extract code references
    const codeRefs = this.extractCodeReferences(doc);
    for (const ref of codeRefs) {
      relationships.push({
        sourceId: doc.metadata.id,
        targetId: ref,
        type: 'dependency',
        strength: 0.6
      });
    }

    // Save relationships
    if (relationships.length > 0) {
      this.relationships.set(doc.metadata.id, relationships);
      await this.state.storage.put({
        [`relationships:${doc.metadata.id}`]: relationships
      });
    }
  }

  /**
   * Extract code references from document
   */
  private extractCodeReferences(doc: DocumentContent): string[] {
    const refs = new Set<string>();
    const codeRefPattern = /(?:import|from|require)\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = codeRefPattern.exec(doc.content)) !== null) {
      refs.add(match[1]);
    }

    return Array.from(refs);
  }

  /**
   * Generate search highlights
   */
  private async generateHighlights(
    doc: DocumentMetadata,
    query: string
  ): Promise<Array<{ field: string; text: string; position: { start: number; end: number } }>> {
    const highlights: Array<{ field: string; text: string; position: { start: number; end: number } }> = [];

    // Highlight in title
    const titleMatch = doc.title.toLowerCase().indexOf(query.toLowerCase());
    if (titleMatch >= 0) {
      highlights.push({
        field: 'title',
        text: doc.title,
        position: { start: titleMatch, end: titleMatch + query.length }
      });
    }

    // Highlight in description
    const descMatch = doc.description.toLowerCase().indexOf(query.toLowerCase());
    if (descMatch >= 0) {
      highlights.push({
        field: 'description',
        text: doc.description,
        position: { start: descMatch, end: descMatch + query.length }
      });
    }

    return highlights;
  }

  /**
   * Generate search snippet
   */
  private generateSnippet(doc: DocumentMetadata, query: string): string {
    const maxLength = 200;
    const text = doc.description;

    if (text.length <= maxLength) {
      return text;
    }

    const queryPos = text.toLowerCase().indexOf(query.toLowerCase());
    if (queryPos >= 0) {
      // Center snippet around query
      const start = Math.max(0, queryPos - 50);
      const end = Math.min(text.length, queryPos + query.length + 50);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < text.length ? '...' : '';
      return prefix + text.substring(start, end) + suffix;
    }

    // Return first maxLength characters
    return text.substring(0, maxLength) + '...';
  }
}

/**
 * Vector Store for semantic search
 */
class VectorStore {
  private embeddings: Map<string, number[]>;
  private dimension: number;

  constructor(
    private state: DurableObjectState,
    private env: any
  ) {
    this.embeddings = new Map();
    this.dimension = 1536; // Default embedding dimension
  }

  async upsert(id: string, embedding: number[], doc: DocumentContent): Promise<void> {
    this.embeddings.set(id, embedding);
    await this.state.storage.put(`vector:${id}`, embedding);
  }

  async remove(id: string): Promise<void> {
    this.embeddings.delete(id);
    await this.state.storage.delete(`vector:${id}`);
  }

  async search(
    queryEmbedding: number[],
    limit: number = 10
  ): Promise<Array<{ id: string; score: number }>> {
    const results: Array<{ id: string; score: number }> = [];

    for (const [id, embedding] of this.embeddings.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      results.push({ id, score: similarity });
    }

    // Sort by similarity (descending)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

/**
 * Version Control for documents
 */
class VersionControl {
  constructor(
    private state: DurableObjectState,
    private env: any
  ) {}

  async saveVersion(
    id: string,
    doc: DocumentContent,
    message: string
  ): Promise<string> {
    const version = this.generateVersion();
    const key = `version:${id}:${version}`;

    await this.state.storage.put(key, {
      content: doc,
      message,
      timestamp: new Date()
    });

    return version;
  }

  async getVersion(id: string, version: string): Promise<DocumentContent | null> {
    const key = `version:${id}:${version}`;
    const stored = await this.state.storage.get<{ content: DocumentContent }>(key);
    return stored?.content || null;
  }

  async listVersions(id: string): Promise<string[]> {
    const versions: string[] = [];
    const prefix = `version:${id}:`;

    for (const key of await this.state.storage.list()) {
      if (key.startsWith(prefix)) {
        const version = key.substring(prefix.length);
        versions.push(version);
      }
    }

    return versions.sort().reverse();
  }

  private generateVersion(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }
}
