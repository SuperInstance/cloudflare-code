// @ts-nocheck
/**
 * Episodic Memory System
 *
 * Stores and manages episodic memories - specific events, conversations,
 * and experiences with temporal context.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EpisodicMemory,
  MemoryImportance,
  MemoryStatus,
  BaseMemory,
  MemoryError,
  StorageError,
  RetrievalQuery,
  RetrievalResult,
  Action,
} from '../types';

export interface EpisodicMemoryConfig {
  maxMemories: number;
  consolidationInterval: number;
  retentionDays: number;
  minImportance: MemoryImportance;
  autoConsolidate: boolean;
}

export interface EpisodicStorage {
  getMemory(id: string): Promise<EpisodicMemory | null>;
  saveMemory(memory: EpisodicMemory): Promise<void>;
  deleteMemory(id: string): Promise<void>;
  searchMemories(query: string): Promise<EpisodicMemory[]>;
  getMemoriesByDateRange(start: Date, end: Date): Promise<EpisodicMemory[]>;
  getMemoriesByImportance(minImportance: MemoryImportance): Promise<EpisodicMemory[]>;
  getAllMemories(): Promise<EpisodicMemory[]>;
  updateMemory(id: string, updates: Partial<EpisodicMemory>): Promise<void>;
}

export class EpisodicMemorySystem {
  private config: EpisodicMemoryConfig;
  private storage: EpisodicStorage;
  private cache: Map<string, EpisodicMemory>;
  private consolidationQueue: Set<string>;

  constructor(config: EpisodicMemoryConfig, storage: EpisodicStorage) {
    this.config = config;
    this.storage = storage;
    this.cache = new Map();
    this.consolidationQueue = new Set();
  }

  /**
   * Create a new episodic memory
   */
  async createMemory(
    context: string,
    outcome: string,
    actions: Action[],
    options: {
      participants?: string[];
      emotionalWeight?: number;
      importance?: MemoryImportance;
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<EpisodicMemory> {
    const now = new Date();

    const memory: EpisodicMemory = {
      id: uuidv4(),
      type: 'episodic' as const,
      importance: options.importance ?? this.calculateImportance(actions),
      status: MemoryStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      lastAccessed: now,
      accessCount: 0,
      timestamp: now,
      context,
      outcome,
      actions,
      participants: options.participants ?? [],
      emotionalWeight: options.emotionalWeight ?? 0.5,
      relatedMemories: [],
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
    };

    // Generate embedding for semantic search
    memory.embedding = await this.generateEmbedding(context + ' ' + outcome);

    // Find related memories
    memory.relatedMemories = await this.findRelatedMemories(memory);

    await this.storage.saveMemory(memory);
    this.cache.set(memory.id, memory);

    // Queue for consolidation if enabled
    if (this.config.autoConsolidate) {
      this.consolidationQueue.add(memory.id);
    }

    return memory;
  }

  /**
   * Retrieve a memory by ID
   */
  async getMemory(id: string): Promise<EpisodicMemory | null> {
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
   * Search memories by query
   */
  async searchMemories(query: RetrievalQuery): Promise<RetrievalResult<EpisodicMemory>> {
    const startTime = Date.now();

    let memories: EpisodicMemory[] = [];

    // Perform semantic search if query provided
    if (query.query) {
      const queryEmbedding = await this.generateEmbedding(query.query);
      memories = await this.semanticSearch(queryEmbedding, query);
    }

    // Apply filters
    if (query.filters) {
      memories = this.applyFilters(memories, query.filters);
    }

    // Sort results
    if (query.sort) {
      memories = this.sortMemories(memories, query.sort);
    }

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? memories.length;
    const paginatedMemories = memories.slice(offset, offset + limit);

    // Calculate relevance scores
    const relevanceScores = paginatedMemories.map((m) =>
      this.calculateRelevance(m, query.query)
    );

    // Update access stats for retrieved memories
    for (const memory of paginatedMemories) {
      await this.updateAccessStats(memory.id);
    }

    return {
      memories: paginatedMemories,
      totalCount: memories.length,
      query,
      duration: Date.now() - startTime,
      relevanceScores,
    };
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    id: string,
    updates: Partial<Omit<EpisodicMemory, 'id' | 'type' | 'createdAt'>>
  ): Promise<void> {
    const memory = await this.getMemory(id);
    if (!memory) {
      throw new MemoryError(`Memory not found: ${id}`, 'NOT_FOUND');
    }

    const updatedMemory: EpisodicMemory = {
      ...memory,
      ...updates,
      updatedAt: new Date(),
    };

    // Regenerate embedding if content changed
    if (updates.context || updates.outcome) {
      updatedMemory.embedding = await this.generateEmbedding(
        updatedMemory.context + ' ' + updatedMemory.outcome
      );
    }

    await this.storage.updateMemory(id, updatedMemory);
    this.cache.set(id, updatedMemory);
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string): Promise<void> {
    await this.storage.deleteMemory(id);
    this.cache.delete(id);
    this.consolidationQueue.delete(id);
  }

  /**
   * Get memories by date range
   */
  async getMemoriesByTimeRange(
    start: Date,
    end: Date
  ): Promise<EpisodicMemory[]> {
    return this.storage.getMemoriesByDateRange(start, end);
  }

  /**
   * Get recent memories
   */
  async getRecentMemories(limit: number = 10): Promise<EpisodicMemory[]> {
    const allMemories = await this.storage.getAllMemories();
    return allMemories
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get memories by importance
   */
  async getImportantMemories(
    minImportance: MemoryImportance = MemoryImportance.HIGH
  ): Promise<EpisodicMemory[]> {
    return this.storage.getMemoriesByImportance(minImportance);
  }

  /**
   * Get related memories for a given memory
   */
  async getRelatedMemories(memoryId: string, limit: number = 5): Promise<EpisodicMemory[]> {
    const memory = await this.getMemory(memoryId);
    if (!memory) {
      return [];
    }

    const relatedMemories: EpisodicMemory[] = [];
    for (const relatedId of memory.relatedMemories.slice(0, limit)) {
      const related = await this.getMemory(relatedId);
      if (related) {
        relatedMemories.push(related);
      }
    }

    return relatedMemories;
  }

  /**
   * Consolidate memories in the queue
   */
  async consolidateMemories(): Promise<number> {
    let consolidated = 0;

    for (const memoryId of this.consolidationQueue) {
      const memory = await this.getMemory(memoryId);
      if (!memory) continue;

      // Consolidate with similar memories
      await this.performConsolidation(memory);
      consolidated++;
    }

    this.consolidationQueue.clear();
    return consolidated;
  }

  /**
   * Calculate memory importance based on actions
   */
  private calculateImportance(actions: Action[]): MemoryImportance {
    if (actions.length === 0) {
      return MemoryImportance.LOW;
    }

    // Consider action count, duration, and outcomes
    const avgDuration = actions.reduce((sum, a) => sum + a.duration, 0) / actions.length;
    const successRate = actions.filter((a) => a.result === 'success').length / actions.length;

    if (avgDuration > 10000 && successRate > 0.8) {
      return MemoryImportance.CRITICAL;
    } else if (avgDuration > 5000 && successRate > 0.6) {
      return MemoryImportance.HIGH;
    } else if (avgDuration > 2000) {
      return MemoryImportance.MEDIUM;
    } else {
      return MemoryImportance.LOW;
    }
  }

  /**
   * Generate embedding for semantic search
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Simple hash-based embedding for now
    // In production, use actual embedding model
    const embedding: number[] = [];
    const hash = this.simpleHash(text);
    for (let i = 0; i < 128; i++) {
      embedding.push(Math.sin(hash + i) * 0.5 + 0.5);
    }
    return embedding;
  }

  /**
   * Simple hash function for embedding generation
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
   * Find related memories based on semantic similarity
   */
  private async findRelatedMemories(memory: EpisodicMemory): Promise<string[]> {
    const allMemories = await this.storage.getAllMemories();
    const related: Array<{ id: string; similarity: number }> = [];

    for (const other of allMemories) {
      if (other.id === memory.id) continue;

      const similarity = this.cosineSimilarity(
        memory.embedding!,
        other.embedding!
      );

      if (similarity > 0.7) {
        related.push({ id: other.id, similarity });
      }
    }

    return related
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map((r) => r.id);
  }

  /**
   * Semantic search using embeddings
   */
  private async semanticSearch(
    queryEmbedding: number[],
    query: RetrievalQuery
  ): Promise<EpisodicMemory[]> {
    const allMemories = await this.storage.getAllMemories();

    const results = allMemories
      .map((memory) => ({
        memory,
        similarity: this.cosineSimilarity(queryEmbedding, memory.embedding!),
      }))
      .filter((result) => result.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .map((result) => result.memory);

    return results;
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

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Apply filters to memories
   */
  private applyFilters(
    memories: EpisodicMemory[],
    filters: NonNullable<RetrievalQuery['filters']>
  ): EpisodicMemory[] {
    let filtered = memories;

    if (filters.importance) {
      filtered = filtered.filter((m) => filters.importance!.includes(m.importance));
    }

    if (filters.status) {
      filtered = filtered.filter((m) => filters.status!.includes(m.status));
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((m) =>
        filters.tags!.some((tag) => m.tags.includes(tag))
      );
    }

    if (filters.dateRange) {
      filtered = filtered.filter((m) => {
        const timestamp = m.timestamp;
        return (
          timestamp >= filters.dateRange!.start &&
          timestamp <= filters.dateRange!.end
        );
      });
    }

    if (filters.metadata) {
      filtered = filtered.filter((m) => {
        return Object.entries(filters.metadata!).every(([key, value]) =>
          m.metadata[key] === value
        );
      });
    }

    return filtered;
  }

  /**
   * Sort memories
   */
  private sortMemories(
    memories: EpisodicMemory[],
    sort: RetrievalQuery['sort']
  ): EpisodicMemory[] {
    const sorted = [...memories];

    switch (sort) {
      case 'importance':
        sorted.sort((a, b) => b.importance - a.importance);
        break;
      case 'recency':
        sorted.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        break;
      case 'access_count':
        sorted.sort((a, b) => b.accessCount - a.accessCount);
        break;
      case 'last_accessed':
        sorted.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
        break;
      default:
        break;
    }

    return sorted;
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(memory: EpisodicMemory, query: string): number {
    // Simple relevance calculation based on text overlap
    const memoryText = (memory.context + ' ' + memory.outcome).toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/);

    let matches = 0;
    for (const term of queryTerms) {
      if (memoryText.includes(term)) {
        matches++;
      }
    }

    return matches / queryTerms.length;
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
   * Perform consolidation on a memory
   */
  private async performConsolidation(memory: EpisodicMemory): Promise<void> {
    // Reduce emotional weight over time
    const decayedWeight = memory.emotionalWeight * 0.95;

    // Update importance based on access patterns
    const ageInDays =
      (Date.now() - memory.timestamp.getTime()) / (1000 * 60 * 60 * 24);

    let newImportance = memory.importance;
    if (ageInDays > 30 && memory.accessCount < 5) {
      newImportance = Math.max(
        MemoryImportance.LOW,
        (memory.importance - 1) as MemoryImportance
      );
    }

    await this.storage.updateMemory(memory.id, {
      emotionalWeight: decayedWeight,
      importance: newImportance,
      status:
        ageInDays > this.config.retentionDays
          ? MemoryStatus.DORMANT
          : memory.status,
    });
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{
    totalMemories: number;
    activeMemories: number;
    dormantMemories: number;
    avgImportance: number;
    oldestMemory?: Date;
    newestMemory?: Date;
  }> {
    const allMemories = await this.storage.getAllMemories();

    if (allMemories.length === 0) {
      return {
        totalMemories: 0,
        activeMemories: 0,
        dormantMemories: 0,
        avgImportance: 0,
      };
    }

    const activeMemories = allMemories.filter((m) => m.status === MemoryStatus.ACTIVE);
    const dormantMemories = allMemories.filter((m) => m.status === MemoryStatus.DORMANT);
    const avgImportance =
      allMemories.reduce((sum, m) => sum + m.importance, 0) / allMemories.length;

    const sortedByTimestamp = [...allMemories].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    return {
      totalMemories: allMemories.length,
      activeMemories: activeMemories.length,
      dormantMemories: dormantMemories.length,
      avgImportance,
      oldestMemory: sortedByTimestamp[0].timestamp,
      newestMemory: sortedByTimestamp[sortedByTimestamp.length - 1].timestamp,
    };
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
 * D1-based storage implementation for episodic memories
 */
export class D1EpisodicStorage implements EpisodicStorage {
  constructor(private db: D1Database) {
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.db.batch([
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS episodic_memories (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          importance INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_accessed TEXT NOT NULL,
          access_count INTEGER NOT NULL,
          timestamp TEXT NOT NULL,
          context TEXT NOT NULL,
          outcome TEXT NOT NULL,
          participants TEXT NOT NULL,
          actions TEXT NOT NULL,
          emotional_weight REAL NOT NULL,
          related_memories TEXT NOT NULL,
          tags TEXT NOT NULL,
          metadata TEXT NOT NULL,
          embedding TEXT
        )
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_episodic_timestamp
        ON episodic_memories(timestamp)
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_episodic_importance
        ON episodic_memories(importance)
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_episodic_status
        ON episodic_memories(status)
      `),
    ]);
  }

  async getMemory(id: string): Promise<EpisodicMemory | null> {
    const result = await this.db
      .prepare('SELECT * FROM episodic_memories WHERE id = ?')
      .bind(id)
      .first();

    if (!result) return null;

    return this.deserialize(result);
  }

  async saveMemory(memory: EpisodicMemory): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO episodic_memories
        (id, type, importance, status, created_at, updated_at, last_accessed,
         access_count, timestamp, context, outcome, participants, actions,
         emotional_weight, related_memories, tags, metadata, embedding)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        memory.timestamp.toISOString(),
        memory.context,
        memory.outcome,
        JSON.stringify(memory.participants),
        JSON.stringify(memory.actions),
        memory.emotionalWeight,
        JSON.stringify(memory.relatedMemories),
        JSON.stringify(memory.tags),
        JSON.stringify(memory.metadata),
        memory.embedding ? JSON.stringify(memory.embedding) : null
      )
      .run();
  }

  async deleteMemory(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM episodic_memories WHERE id = ?')
      .bind(id)
      .run();
  }

  async searchMemories(query: string): Promise<EpisodicMemory[]> {
    const results = await this.db
      .prepare(
        'SELECT * FROM episodic_memories WHERE context LIKE ? OR outcome LIKE ?'
      )
      .bind(`%${query}%`, `%${query}%`)
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async getMemoriesByDateRange(
    start: Date,
    end: Date
  ): Promise<EpisodicMemory[]> {
    const results = await this.db
      .prepare('SELECT * FROM episodic_memories WHERE timestamp BETWEEN ? AND ?')
      .bind(start.toISOString(), end.toISOString())
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async getMemoriesByImportance(
    minImportance: MemoryImportance
  ): Promise<EpisodicMemory[]> {
    const results = await this.db
      .prepare('SELECT * FROM episodic_memories WHERE importance >= ?')
      .bind(minImportance)
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async getAllMemories(): Promise<EpisodicMemory[]> {
    const results = await this.db
      .prepare('SELECT * FROM episodic_memories')
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async updateMemory(
    id: string,
    updates: Partial<EpisodicMemory>
  ): Promise<void> {
    const current = await this.getMemory(id);
    if (!current) {
      throw new StorageError(`Memory not found: ${id}`, 'NOT_FOUND');
    }

    const updated = { ...current, ...updates };
    await this.saveMemory(updated);
  }

  private deserialize(data: any): EpisodicMemory {
    return {
      id: data.id,
      type: data.type,
      importance: data.importance,
      status: data.status,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastAccessed: new Date(data.last_accessed),
      accessCount: data.access_count,
      timestamp: new Date(data.timestamp),
      context: data.context,
      outcome: data.outcome,
      participants: JSON.parse(data.participants),
      actions: JSON.parse(data.actions),
      emotionalWeight: data.emotional_weight,
      relatedMemories: JSON.parse(data.related_memories),
      tags: JSON.parse(data.tags),
      metadata: JSON.parse(data.metadata),
      embedding: data.embedding ? JSON.parse(data.embedding) : undefined,
    } as EpisodicMemory;
  }
}
