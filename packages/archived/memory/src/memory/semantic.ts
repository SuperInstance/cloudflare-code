// @ts-nocheck
/**
 * Semantic Memory System
 *
 * Manages semantic knowledge using vector embeddings for similarity-based retrieval.
 * Supports code patterns, best practices, domain knowledge, and architectural patterns.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SemanticMemory,
  MemoryImportance,
  MemoryStatus,
  SemanticRelationship,
  VectorStoreConfig,
  Vector,
  VectorSearchResult,
  RetrievalQuery,
  RetrievalResult,
  MemoryError,
  VectorStoreError,
} from '../types';

export interface SemanticMemoryConfig {
  maxMemories: number;
  vectorStore: VectorStoreConfig;
  updateInterval: number;
  minConfidence: number;
  autoUpdate: boolean;
}

export interface SemanticStorage {
  getMemory(id: string): Promise<SemanticMemory | null>;
  saveMemory(memory: SemanticMemory): Promise<void>;
  deleteMemory(id: string): Promise<void>;
  searchByCategory(category: string): Promise<SemanticMemory[]>;
  searchByContent(query: string): Promise<SemanticMemory[]>;
  getAllMemories(): Promise<SemanticMemory[]>;
  updateMemory(id: string, updates: Partial<SemanticMemory>): Promise<void>;
}

export interface VectorDatabase {
  insert(vector: Vector): Promise<void>;
  search(vector: number[], topK: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  update(id: string, vector: number[]): Promise<void>;
  get(id: string): Promise<Vector | null>;
}

export class SemanticMemorySystem {
  private config: SemanticMemoryConfig;
  private storage: SemanticStorage;
  private vectorDB: VectorDatabase;
  private cache: Map<string, SemanticMemory>;
  private updateQueue: Set<string>;

  constructor(
    config: SemanticMemoryConfig,
    storage: SemanticStorage,
    vectorDB: VectorDatabase
  ) {
    this.config = config;
    this.storage = storage;
    this.vectorDB = vectorDB;
    this.cache = new Map();
    this.updateQueue = new Set();
  }

  /**
   * Create a new semantic memory
   */
  async createMemory(
    content: string,
    category: string,
    options: {
      confidence?: number;
      source?: string;
      examples?: string[];
      importance?: MemoryImportance;
      tags?: string[];
      metadata?: Record<string, unknown>;
      relationships?: SemanticRelationship[];
    } = {}
  ): Promise<SemanticMemory> {
    const now = new Date();

    // Generate embedding
    const embedding = await this.generateEmbedding(content);

    const memory: SemanticMemory = {
      id: uuidv4(),
      type: 'semantic' as const,
      importance: options.importance ?? MemoryImportance.MEDIUM,
      status: MemoryStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      lastAccessed: now,
      accessCount: 0,
      embedding,
      content,
      category,
      confidence: options.confidence ?? 0.8,
      source: options.source ?? 'user',
      examples: options.examples ?? [],
      relationships: options.relationships ?? [],
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
    };

    // Save to storage
    await this.storage.saveMemory(memory);

    // Insert into vector database
    await this.vectorDB.insert({
      id: memory.id,
      values: embedding,
      metadata: {
        category,
        confidence: memory.confidence,
        source: memory.source,
      },
    });

    // Cache the memory
    this.cache.set(memory.id, memory);

    return memory;
  }

  /**
   * Retrieve a memory by ID
   */
  async getMemory(id: string): Promise<SemanticMemory | null> {
    // Check cache first
    if (this.cache.has(id)) {
      const memory = this.cache.get(id)!;
      await this.updateAccessStats(id);
      return memory;
    }

    // Load from storage
    const memory = await this.storage.getMemory(id);
    if (memory) {
      this.cache.set(id, memory);
      await this.updateAccessStats(id);
    }

    return memory;
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(
    query: string,
    options: {
      topK?: number;
      minScore?: number;
      category?: string;
      filters?: Record<string, unknown>;
    } = {}
  ): Promise<RetrievalResult<SemanticMemory>> {
    const startTime = Date.now();
    const topK = options.topK ?? 10;
    const minScore = options.minScore ?? 0.7;

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Search vector database
    const vectorResults = await this.vectorDB.search(queryEmbedding, topK * 2);

    // Filter by score and retrieve full memories
    const memories: SemanticMemory[] = [];
    const relevanceScores: number[] = [];

    for (const result of vectorResults) {
      if (result.score < minScore) continue;

      // Apply category filter
      if (options.category) {
        const resultCategory = result.metadata.category as string;
        if (resultCategory !== options.category) continue;
      }

      // Apply custom filters
      if (options.filters) {
        let matches = true;
        for (const [key, value] of Object.entries(options.filters)) {
          if (result.metadata[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      const memory = await this.getMemory(result.id);
      if (memory) {
        memories.push(memory);
        relevanceScores.push(result.score);
      }

      if (memories.length >= topK) break;
    }

    // Update access stats
    for (const memory of memories) {
      await this.updateAccessStats(memory.id);
    }

    return {
      memories,
      totalCount: memories.length,
      query: {
        query,
        limit: topK,
      } as RetrievalQuery,
      duration: Date.now() - startTime,
      relevanceScores,
    };
  }

  /**
   * Search by category
   */
  async getByCategory(category: string): Promise<SemanticMemory[]> {
    const memories = await this.storage.searchByCategory(category);

    // Update access stats
    for (const memory of memories) {
      await this.updateAccessStats(memory.id);
    }

    return memories;
  }

  /**
   * Find related semantic memories
   */
  async findRelated(
    memoryId: string,
    maxResults: number = 5
  ): Promise<Array<{ memory: SemanticMemory; similarity: number }>> {
    const memory = await this.getMemory(memoryId);
    if (!memory || !memory.embedding) {
      return [];
    }

    const vectorResults = await this.vectorDB.search(
      memory.embedding,
      maxResults + 1
    );

    const related: Array<{ memory: SemanticMemory; similarity: number }> = [];

    for (const result of vectorResults) {
      if (result.id === memoryId) continue;

      const relatedMemory = await this.getMemory(result.id);
      if (relatedMemory) {
        related.push({ memory: relatedMemory, similarity: result.score });
      }

      if (related.length >= maxResults) break;
    }

    return related;
  }

  /**
   * Add relationship between memories
   */
  async addRelationship(
    sourceId: string,
    targetId: string,
    type: SemanticRelationship['type'],
    strength: number = 0.5,
    description?: string
  ): Promise<void> {
    const sourceMemory = await this.getMemory(sourceId);
    if (!sourceMemory) {
      throw new MemoryError(`Source memory not found: ${sourceId}`, 'NOT_FOUND');
    }

    const targetMemory = await this.getMemory(targetId);
    if (!targetMemory) {
      throw new MemoryError(`Target memory not found: ${targetId}`, 'NOT_FOUND');
    }

    const relationship: SemanticRelationship = {
      type,
      targetId,
      strength,
      description,
    };

    sourceMemory.relationships.push(relationship);
    await this.storage.updateMemory(sourceId, {
      relationships: sourceMemory.relationships,
    });
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    id: string,
    updates: Partial<Omit<SemanticMemory, 'id' | 'type' | 'createdAt'>>
  ): Promise<void> {
    const memory = await this.getMemory(id);
    if (!memory) {
      throw new MemoryError(`Memory not found: ${id}`, 'NOT_FOUND');
    }

    const updatedMemory: SemanticMemory = {
      ...memory,
      ...updates,
      updatedAt: new Date(),
    };

    // Regenerate embedding if content changed
    if (updates.content) {
      updatedMemory.embedding = await this.generateEmbedding(updates.content);
      await this.vectorDB.update(id, updatedMemory.embedding);
    }

    await this.storage.updateMemory(id, updatedMemory);
    this.cache.set(id, updatedMemory);
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string): Promise<void> {
    await this.storage.deleteMemory(id);
    await this.vectorDB.delete(id);
    this.cache.delete(id);
    this.updateQueue.delete(id);
  }

  /**
   * Get memories by confidence threshold
   */
  async getByConfidence(minConfidence: number): Promise<SemanticMemory[]> {
    const allMemories = await this.storage.getAllMemories();
    return allMemories.filter((m) => m.confidence >= minConfidence);
  }

  /**
   * Batch import memories
   */
  async importMemories(
    memories: Array<{
      content: string;
      category: string;
      confidence?: number;
      source?: string;
      examples?: string[];
    }>
  ): Promise<string[]> {
    const importedIds: string[] = [];

    for (const mem of memories) {
      try {
        const memory = await this.createMemory(mem.content, mem.category, {
          confidence: mem.confidence,
          source: mem.source,
          examples: mem.examples,
        });
        importedIds.push(memory.id);
      } catch (error) {
        console.error(`Failed to import memory: ${error}`);
      }
    }

    return importedIds;
  }

  /**
   * Consolidate similar memories
   */
  async consolidateMemories(threshold: number = 0.9): Promise<number> {
    const allMemories = await this.storage.getAllMemories();
    let consolidated = 0;

    const processed = new Set<string>();

    for (const memory of allMemories) {
      if (processed.has(memory.id)) continue;

      // Find similar memories
      const similar = await this.findSimilarMemories(memory, threshold);

      if (similar.length > 1) {
        // Merge memories
        await this.mergeMemories([memory, ...similar]);
        consolidated++;
        processed.add(memory.id);
        similar.forEach((s) => processed.add(s.id));
      }
    }

    return consolidated;
  }

  /**
   * Update confidence based on feedback
   */
  async updateConfidence(
    id: string,
    feedback: boolean
  ): Promise<void> {
    const memory = await this.getMemory(id);
    if (!memory) return;

    // Adjust confidence using exponential moving average
    const alpha = 0.3;
    const newConfidence = memory.confidence * (1 - alpha) + (feedback ? 1 : 0) * alpha;

    await this.updateMemory(id, { confidence: newConfidence });
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalMemories: number;
    memoriesByCategory: Record<string, number>;
    avgConfidence: number;
    highConfidenceCount: number;
    lowConfidenceCount: number;
  }> {
    const allMemories = await this.storage.getAllMemories();

    const memoriesByCategory: Record<string, number> = {};
    let totalConfidence = 0;
    let highConfidence = 0;
    let lowConfidence = 0;

    for (const memory of allMemories) {
      memoriesByCategory[memory.category] =
        (memoriesByCategory[memory.category] || 0) + 1;
      totalConfidence += memory.confidence;

      if (memory.confidence >= 0.8) highConfidence++;
      else if (memory.confidence < 0.5) lowConfidence++;
    }

    return {
      totalMemories: allMemories.length,
      memoriesByCategory,
      avgConfidence: allMemories.length > 0 ? totalConfidence / allMemories.length : 0,
      highConfidenceCount: highConfidence,
      lowConfidenceCount: lowConfidence,
    };
  }

  /**
   * Generate embedding for text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Simple hash-based embedding
    // In production, replace with actual embedding model
    const embedding: number[] = [];
    const words = text.toLowerCase().split(/\s+/);
    const dimension = this.config.vectorStore.dimension;

    for (let i = 0; i < dimension; i++) {
      const wordIndex = i % words.length;
      const hash = this.simpleHash(words[wordIndex] + i);
      embedding.push((hash % 1000) / 1000);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / norm);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Find similar memories
   */
  private async findSimilarMemories(
    memory: SemanticMemory,
    threshold: number
  ): Promise<SemanticMemory[]> {
    if (!memory.embedding) return [];

    const vectorResults = await this.vectorDB.search(memory.embedding, 20);

    const similar: SemanticMemory[] = [];

    for (const result of vectorResults) {
      if (result.id === memory.id) continue;
      if (result.score < threshold) break;

      const similarMemory = await this.getMemory(result.id);
      if (similarMemory) {
        similar.push(similarMemory);
      }
    }

    return similar;
  }

  /**
   * Merge similar memories
   */
  private async mergeMemories(memories: SemanticMemory[]): Promise<void> {
    if (memories.length === 0) return;

    // Keep the first memory as base
    const base = memories[0];
    const others = memories.slice(1);

    // Merge examples
    const allExamples = [...base.examples];
    for (const other of others) {
      allExamples.push(...other.examples);
    }

    // Update confidence (use max)
    const maxConfidence = Math.max(...memories.map((m) => m.confidence));

    // Merge relationships
    const allRelationships = [...base.relationships];
    for (const other of others) {
      allRelationships.push(...other.relationships);
    }

    // Update base memory
    await this.updateMemory(base.id, {
      examples: [...new Set(allExamples)],
      confidence: maxConfidence,
      relationships: allRelationships,
    });

    // Delete merged memories
    for (const other of others) {
      await this.deleteMemory(other.id);
    }
  }

  /**
   * Update access statistics
   */
  private async updateAccessStats(id: string): Promise<void> {
    const memory = await this.storage.getMemory(id);
    if (!memory) return;

    await this.storage.updateMemory(id, {
      lastAccessed: new Date(),
      accessCount: memory.accessCount + 1,
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * In-memory vector database implementation
 */
export class InMemoryVectorDB implements VectorDatabase {
  private vectors: Map<string, Vector>;

  constructor() {
    this.vectors = new Map();
  }

  async insert(vector: Vector): Promise<void> {
    this.vectors.set(vector.id, vector);
  }

  async search(
    queryVector: number[],
    topK: number
  ): Promise<VectorSearchResult[]> {
    const results: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];

    for (const [id, vector] of this.vectors.entries()) {
      const score = this.cosineSimilarity(queryVector, vector.values);
      results.push({
        id,
        score,
        metadata: vector.metadata,
      });
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    // Return top K
    return results.slice(0, topK);
  }

  async delete(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async update(id: string, vector: number[]): Promise<void> {
    const existing = this.vectors.get(id);
    if (!existing) {
      throw new VectorStoreError(`Vector not found: ${id}`, 'NOT_FOUND');
    }

    existing.values = vector;
  }

  async get(id: string): Promise<Vector | null> {
    return this.vectors.get(id) ?? null;
  }

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

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

/**
 * D1-based storage for semantic memories
 */
export class D1SemanticStorage implements SemanticStorage {
  constructor(private db: D1Database) {
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.db.batch([
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS semantic_memories (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          importance INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_accessed TEXT NOT NULL,
          access_count INTEGER NOT NULL,
          content TEXT NOT NULL,
          category TEXT NOT NULL,
          confidence REAL NOT NULL,
          source TEXT NOT NULL,
          examples TEXT NOT NULL,
          relationships TEXT NOT NULL,
          tags TEXT NOT NULL,
          metadata TEXT NOT NULL,
          embedding TEXT
        )
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_semantic_category
        ON semantic_memories(category)
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_semantic_confidence
        ON semantic_memories(confidence)
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_semantic_status
        ON semantic_memories(status)
      `),
    ]);
  }

  async getMemory(id: string): Promise<SemanticMemory | null> {
    const result = await this.db
      .prepare('SELECT * FROM semantic_memories WHERE id = ?')
      .bind(id)
      .first();

    if (!result) return null;

    return this.deserialize(result);
  }

  async saveMemory(memory: SemanticMemory): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO semantic_memories
        (id, type, importance, status, created_at, updated_at, last_accessed,
         access_count, content, category, confidence, source, examples,
         relationships, tags, metadata, embedding)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        memory.id,
        memory.type,
        memory.importance,
        memory.status,
        memory.createdAt.toISOString(),
        memory.updatedAt.toISOString(),
        memory.lastAccessed.toISOString(),
        memory.accessCount,
        memory.content,
        memory.category,
        memory.confidence,
        memory.source,
        JSON.stringify(memory.examples),
        JSON.stringify(memory.relationships),
        JSON.stringify(memory.tags),
        JSON.stringify(memory.metadata),
        memory.embedding ? JSON.stringify(memory.embedding) : null
      )
      .run();
  }

  async deleteMemory(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM semantic_memories WHERE id = ?')
      .bind(id)
      .run();
  }

  async searchByCategory(category: string): Promise<SemanticMemory[]> {
    const results = await this.db
      .prepare('SELECT * FROM semantic_memories WHERE category = ?')
      .bind(category)
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async searchByContent(query: string): Promise<SemanticMemory[]> {
    const results = await this.db
      .prepare('SELECT * FROM semantic_memories WHERE content LIKE ?')
      .bind(`%${query}%`)
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async getAllMemories(): Promise<SemanticMemory[]> {
    const results = await this.db
      .prepare('SELECT * FROM semantic_memories')
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async updateMemory(
    id: string,
    updates: Partial<SemanticMemory>
  ): Promise<void> {
    const current = await this.getMemory(id);
    if (!current) {
      throw new MemoryError(`Memory not found: ${id}`, 'NOT_FOUND');
    }

    const updated = { ...current, ...updates };
    await this.saveMemory(updated);
  }

  private deserialize(data: any): SemanticMemory {
    return {
      id: data.id,
      type: data.type,
      importance: data.importance,
      status: data.status,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastAccessed: new Date(data.last_accessed),
      accessCount: data.access_count,
      content: data.content,
      category: data.category,
      confidence: data.confidence,
      source: data.source,
      examples: JSON.parse(data.examples),
      relationships: JSON.parse(data.relationships),
      tags: JSON.parse(data.tags),
      metadata: JSON.parse(data.metadata),
      embedding: data.embedding ? JSON.parse(data.embedding) : undefined,
    } as SemanticMemory;
  }
}
