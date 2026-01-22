/**
 * Memory Store - Long-term memory storage with episodic, semantic, and procedural memory
 */

import {
  Memory,
  MemoryType,
  MemoryMetadata,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  WorkingMemory,
  MemoryConsolidation,
  MemoryStoreConfig,
  Fact,
  Relationship,
  ProcedureStep,
  ContextError,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';

/**
 * Default memory store configuration
 */
const DEFAULT_CONFIG: MemoryStoreConfig = {
  maxSize: 10000,
  consolidationThreshold: 1000,
  forgettingEnabled: true,
  forgettingRate: 0.01,
  embeddingModel: 'text-embedding-ada-002',
  vectorDimension: 1536,
};

/**
 * Memory Store - Manages long-term memory storage and retrieval
 */
export class MemoryStore extends EventEmitter {
  private memories: Map<string, Memory> = new Map();
  private episodicMemories: Map<string, Set<string>> = new Map(); // userId -> memoryIds
  private semanticMemories: Map<string, Set<string>> = new Map(); // category -> memoryIds
  private proceduralMemories: Map<string, Set<string>> = new Map(); // trigger -> memoryIds
  private workingMemories: Map<string, Memory> = new Map(); // sessionId -> memory
  private config: MemoryStoreConfig;
  private accessCount: Map<string, number> = new Map();
  private lastAccess: Map<string, number> = new Map();

  constructor(config: Partial<MemoryStoreConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========================================================================
  // Memory Creation
  // ========================================================================

  /**
   * Create episodic memory
   */
  async createEpisodicMemory(
    content: string,
    timestamp: number,
    metadata?: Partial<MemoryMetadata>
  ): Promise<EpisodicMemory> {
    const memory: EpisodicMemory = {
      id: uuidv4(),
      type: 'episodic',
      content,
      timestamp,
      metadata: {
        ...metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      importance: metadata?.importance || 0.5,
      strength: 1.0,
    };

    await this.addMemory(memory);

    // Index by user
    if (metadata?.userId) {
      if (!this.episodicMemories.has(metadata.userId)) {
        this.episodicMemories.set(metadata.userId, new Set());
      }
      this.episodicMemories.get(metadata.userId)!.add(memory.id);
    }

    return memory;
  }

  /**
   * Create semantic memory (facts and knowledge)
   */
  async createSemanticMemory(
    content: string,
    facts: Fact[],
    relationships?: Relationship[],
    metadata?: Partial<MemoryMetadata>
  ): Promise<SemanticMemory> {
    const memory: SemanticMemory = {
      id: uuidv4(),
      type: 'semantic',
      content,
      facts,
      relationships,
      metadata: {
        ...metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      importance: metadata?.importance || 0.7,
      strength: 1.0,
    };

    await this.addMemory(memory);

    // Index by category
    for (const category of metadata?.categories || []) {
      if (!this.semanticMemories.has(category)) {
        this.semanticMemories.set(category, new Set());
      }
      this.semanticMemories.get(category)!.add(memory.id);
    }

    return memory;
  }

  /**
   * Create procedural memory (skills and procedures)
   */
  async createProceduralMemory(
    content: string,
    steps: ProcedureStep[],
    triggers?: string[],
    outcomes?: string[],
    metadata?: Partial<MemoryMetadata>
  ): Promise<ProceduralMemory> {
    const memory: ProceduralMemory = {
      id: uuidv4(),
      type: 'semantic_procedural',
      content,
      steps,
      triggers,
      outcomes,
      metadata: {
        ...metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      importance: metadata?.importance || 0.6,
      strength: 1.0,
    };

    await this.addMemory(memory);

    // Index by triggers
    for (const trigger of triggers || []) {
      if (!this.proceduralMemories.has(trigger)) {
        this.proceduralMemories.set(trigger, new Set());
      }
      this.proceduralMemories.get(trigger)!.add(memory.id);
    }

    return memory;
  }

  /**
   * Create working memory (short-term, session-based)
   */
  async createWorkingMemory(
    sessionId: string,
    content: string,
    ttl: number = 3600000, // 1 hour default
    capacity: number = 100
  ): Promise<WorkingMemory> {
    const memory: WorkingMemory = {
      id: uuidv4(),
      type: 'working',
      content,
      ttl,
      capacity,
      currentSize: 1,
      metadata: {
        sessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      importance: 0.5,
      strength: 1.0,
    };

    this.workingMemories.set(sessionId, memory);

    // Set TTL
    setTimeout(() => {
      this.workingMemories.delete(sessionId);
    }, ttl);

    return memory;
  }

  // ========================================================================
  // Memory Retrieval
  // ========================================================================

  /**
   * Get memory by ID
   */
  async getMemory(memoryId: string): Promise<Memory | null> {
    const memory = this.memories.get(memoryId);

    if (memory) {
      // Update access tracking
      memory.accessedAt = Date.now();
      memory.accessCount++;
      this.accessCount.set(memoryId, memory.accessCount);
      this.lastAccess.set(memoryId, memory.accessedAt);
    }

    return memory || null;
  }

  /**
   * Get multiple memories by IDs
   */
  async getMemories(memoryIds: string[]): Promise<Memory[]> {
    const memories: Memory[] = [];

    for (const id of memoryIds) {
      const memory = await this.getMemory(id);
      if (memory) {
        memories.push(memory);
      }
    }

    return memories;
  }

  /**
   * Retrieve episodic memories for a user
   */
  async getEpisodicMemories(
    userId: string,
    limit: number = 100
  ): Promise<EpisodicMemory[]> {
    const memoryIds = this.episodicMemories.get(userId);
    if (!memoryIds) return [];

    const memories: EpisodicMemory[] = [];
    for (const id of memoryIds) {
      const memory = await this.getMemory(id);
      if (memory && memory.type === 'episodic') {
        memories.push(memory as EpisodicMemory);
      }
    }

    // Sort by timestamp descending
    memories.sort((a, b) => b.timestamp - a.timestamp);

    return memories.slice(0, limit);
  }

  /**
   * Retrieve semantic memories by category
   */
  async getSemanticMemories(
    category: string,
    limit: number = 100
  ): Promise<SemanticMemory[]> {
    const memoryIds = this.semanticMemories.get(category);
    if (!memoryIds) return [];

    const memories: SemanticMemory[] = [];
    for (const id of memoryIds) {
      const memory = await this.getMemory(id);
      if (memory && memory.type === 'semantic') {
        memories.push(memory as SemanticMemory);
      }
    }

    // Sort by importance descending
    memories.sort((a, b) => b.importance - a.importance);

    return memories.slice(0, limit);
  }

  /**
   * Retrieve procedural memories by trigger
   */
  async getProceduralMemories(
    trigger: string,
    limit: number = 50
  ): Promise<ProceduralMemory[]> {
    const memoryIds = this.proceduralMemories.get(trigger);
    if (!memoryIds) return [];

    const memories: ProceduralMemory[] = [];
    for (const id of memoryIds) {
      const memory = await this.getMemory(id);
      if (memory && memory.type === 'semantic_procedural') {
        memories.push(memory as ProceduralMemory);
      }
    }

    // Sort by strength descending
    memories.sort((a, b) => b.strength - a.strength);

    return memories.slice(0, limit);
  }

  /**
   * Get working memory for a session
   */
  async getWorkingMemory(sessionId: string): Promise<WorkingMemory | null> {
    return this.workingMemories.get(sessionId) || null;
  }

  /**
   * Semantic search for memories
   */
  async semanticSearch(
    query: string,
    queryEmbedding: number[],
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{ memory: Memory; score: number }>> {
    const results: Array<{ memory: Memory; score: number }> = [];

    for (const memory of this.memories.values()) {
      if (!memory.embedding) continue;

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(queryEmbedding, memory.embedding);

      if (similarity >= threshold) {
        results.push({ memory, score: similarity });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Keyword search for memories
   */
  async keywordSearch(
    query: string,
    limit: number = 10
  ): Promise<Array<{ memory: Memory; score: number }>> {
    const results: Array<{ memory: Memory; score: number }> = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    for (const memory of this.memories.values()) {
      const contentLower = memory.content.toLowerCase();
      let score = 0;

      // Count matching words
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score++;
        }
      }

      // Boost for exact phrase match
      if (contentLower.includes(queryLower)) {
        score += queryWords.length * 2;
      }

      if (score > 0) {
        results.push({ memory, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Hybrid search (semantic + keyword)
   */
  async hybridSearch(
    query: string,
    queryEmbedding: number[],
    limit: number = 10,
    semanticWeight: number = 0.7
  ): Promise<Array<{ memory: Memory; score: number }>> {
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(query, queryEmbedding, limit * 2),
      this.keywordSearch(query, limit * 2),
    ]);

    // Combine scores
    const combined = new Map<string, { memory: Memory; score: number }>();

    for (const { memory, score } of semanticResults) {
      combined.set(memory.id, {
        memory,
        score: score * semanticWeight,
      });
    }

    for (const { memory, score } of keywordResults) {
      const existing = combined.get(memory.id);
      if (existing) {
        existing.score += score * (1 - semanticWeight);
      } else {
        combined.set(memory.id, {
          memory,
          score: score * (1 - semanticWeight),
        });
      }
    }

    // Convert to array and sort
    const results = Array.from(combined.values());
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  // ========================================================================
  // Memory Updates
  // ========================================================================

  /**
   * Update memory content
   */
  async updateMemory(
    memoryId: string,
    updates: Partial<Memory>
  ): Promise<Memory> {
    const memory = this.memories.get(memoryId);

    if (!memory) {
      throw new ContextError(`Memory not found: ${memoryId}`, 'MEMORY_NOT_FOUND');
    }

    // Apply updates
    Object.assign(memory, updates);
    memory.updatedAt = Date.now();

    // Reindex if metadata changed
    if (updates.metadata) {
      await this.reindexMemory(memory);
    }

    return memory;
  }

  /**
   * Update memory importance
   */
  async updateImportance(memoryId: string, importance: number): Promise<void> {
    const memory = this.memories.get(memoryId);

    if (!memory) {
      throw new ContextError(`Memory not found: ${memoryId}`, 'MEMORY_NOT_FOUND');
    }

    memory.importance = Math.max(0, Math.min(1, importance));
    memory.updatedAt = Date.now();
  }

  /**
   * Strengthen memory (reinforcement)
   */
  async strengthenMemory(memoryId: string, amount: number = 0.1): Promise<void> {
    const memory = this.memories.get(memoryId);

    if (!memory) {
      throw new ContextError(`Memory not found: ${memoryId}`, 'MEMORY_NOT_FOUND');
    }

    memory.strength = Math.min(1.0, memory.strength + amount);
    memory.updatedAt = Date.now();
  }

  /**
   * Weaken memory (decay)
   */
  async weakenMemory(memoryId: string, amount: number = 0.05): Promise<void> {
    const memory = this.memories.get(memoryId);

    if (!memory) {
      throw new ContextError(`Memory not found: ${memoryId}`, 'MEMORY_NOT_FOUND');
    }

    memory.strength = Math.max(0.0, memory.strength - amount);
    memory.updatedAt = Date.now();

    // If strength is too low, consider forgetting
    if (this.config.forgettingEnabled && memory.strength < 0.2) {
      await this.forgetMemory(memoryId);
    }
  }

  // ========================================================================
  // Memory Deletion
  // ========================================================================

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId: string): Promise<void> {
    const memory = this.memories.get(memoryId);

    if (!memory) return;

    // Remove from indexes
    await this.unindexMemory(memory);

    // Remove from main store
    this.memories.delete(memoryId);
    this.accessCount.delete(memoryId);
    this.lastAccess.delete(memoryId);
  }

  /**
   * Forget a memory (gradual decay)
   */
  async forgetMemory(memoryId: string): Promise<void> {
    const memory = this.memories.get(memoryId);

    if (!memory) return;

    // Decrease strength
    memory.strength -= this.config.forgettingRate;

    // If strength is 0 or below, delete
    if (memory.strength <= 0) {
      await this.deleteMemory(memoryId);
    }
  }

  /**
   * Batch forget memories
   */
  async forgetMemories(memoryIds: string[]): Promise<void> {
    for (const id of memoryIds) {
      await this.forgetMemory(id);
    }
  }

  // ========================================================================
  // Memory Consolidation
  // ========================================================================

  /**
   * Consolidate memories (merge related, strengthen important)
   */
  async consolidateMemories(): Promise<MemoryConsolidation> {
    const allMemories = Array.from(this.memories.values());
    const consolidated: Memory[] = [];
    const forgotten: Memory[] = [];

    // Group by type and metadata
    const groups = this.groupMemories(allMemories);

    // Consolidate each group
    for (const group of groups) {
      if (group.length === 1) {
        consolidated.push(group[0]);
        continue;
      }

      // Check if memories should be merged
      if (this.shouldMerge(group)) {
        const merged = await this.mergeMemories(group);
        consolidated.push(merged);

        // Mark originals for deletion
        for (const memory of group) {
          if (memory.id !== merged.id) {
            forgotten.push(memory);
          }
        }
      } else {
        // Strengthen important memories
        for (const memory of group) {
          if (memory.importance > 0.7) {
            await this.strengthenMemory(memory.id, 0.05);
          }

          // Forget weak memories
          if (this.config.forgettingEnabled && memory.strength < 0.3) {
            forgotten.push(memory);
          } else {
            consolidated.push(memory);
          }
        }
      }
    }

    // Delete forgotten memories
    for (const memory of forgotten) {
      await this.deleteMemory(memory.id);
    }

    return {
      memories: allMemories,
      consolidated,
      forgotten,
      timestamp: Date.now(),
    };
  }

  // ========================================================================
  // Memory Statistics
  // ========================================================================

  /**
   * Get memory count by type
   */
  getMemoryCountByType(): Record<MemoryType, number> {
    const counts: Record<MemoryType, number> = {
      episodic: 0,
      semantic: 0,
      semantic_procedural: 0,
      working: 0,
    };

    for (const memory of this.memories.values()) {
      counts[memory.type]++;
    }

    counts.working = this.workingMemories.size;

    return counts;
  }

  /**
   * Get total memory count
   */
  getTotalMemoryCount(): number {
    return this.memories.size + this.workingMemories.size;
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): {
    total: number;
    byType: Record<MemoryType, number>;
    avgImportance: number;
    avgStrength: number;
    totalAccesses: number;
  } {
    let totalImportance = 0;
    let totalStrength = 0;
    let totalAccesses = 0;

    for (const memory of this.memories.values()) {
      totalImportance += memory.importance;
      totalStrength += memory.strength;
      totalAccesses += memory.accessCount;
    }

    const count = this.memories.size || 1;

    return {
      total: this.getTotalMemoryCount(),
      byType: this.getMemoryCountByType(),
      avgImportance: totalImportance / count,
      avgStrength: totalStrength / count,
      totalAccesses,
    };
  }

  /**
   * Get most accessed memories
   */
  getMostAccessedMemories(limit: number = 10): Memory[] {
    const memories = Array.from(this.memories.values());
    memories.sort((a, b) => b.accessCount - a.accessCount);
    return memories.slice(0, limit);
  }

  /**
   * Get strongest memories
   */
  getStrongestMemories(limit: number = 10): Memory[] {
    const memories = Array.from(this.memories.values());
    memories.sort((a, b) => b.strength - a.strength);
    return memories.slice(0, limit);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Add memory to store
   */
  private async addMemory(memory: Memory): Promise<void> {
    // Check size limit
    if (this.memories.size >= this.config.maxSize) {
      await this.evictMemories();
    }

    this.memories.set(memory.id, memory);
    this.accessCount.set(memory.id, 0);
    this.lastAccess.set(memory.id, Date.now());
  }

  /**
   * Reindex memory after metadata update
   */
  private async reindexMemory(memory: Memory): Promise<void> {
    await this.unindexMemory(memory);

    if (memory.type === 'episodic' && memory.metadata.userId) {
      if (!this.episodicMemories.has(memory.metadata.userId)) {
        this.episodicMemories.set(memory.metadata.userId, new Set());
      }
      this.episodicMemories.get(memory.metadata.userId)!.add(memory.id);
    }

    if (memory.type === 'semantic') {
      for (const category of memory.metadata.categories || []) {
        if (!this.semanticMemories.has(category)) {
          this.semanticMemories.set(category, new Set());
        }
        this.semanticMemories.get(category)!.add(memory.id);
      }
    }

    if (memory.type === 'semantic_procedural') {
      const procMemory = memory as ProceduralMemory;
      for (const trigger of procMemory.triggers || []) {
        if (!this.proceduralMemories.has(trigger)) {
          this.proceduralMemories.set(trigger, new Set());
        }
        this.proceduralMemories.get(trigger)!.add(memory.id);
      }
    }
  }

  /**
   * Unindex memory
   */
  private async unindexMemory(memory: Memory): Promise<void> {
    if (memory.type === 'episodic' && memory.metadata.userId) {
      const userMemories = this.episodicMemories.get(memory.metadata.userId);
      if (userMemories) {
        userMemories.delete(memory.id);
      }
    }

    if (memory.type === 'semantic') {
      for (const category of memory.metadata.categories || []) {
        const categoryMemories = this.semanticMemories.get(category);
        if (categoryMemories) {
          categoryMemories.delete(memory.id);
        }
      }
    }

    if (memory.type === 'semantic_procedural') {
      const procMemory = memory as ProceduralMemory;
      for (const trigger of procMemory.triggers || []) {
        const triggerMemories = this.proceduralMemories.get(trigger);
        if (triggerMemories) {
          triggerMemories.delete(memory.id);
        }
      }
    }
  }

  /**
   * Evict memories when store is full
   */
  private async evictMemories(): Promise<void> {
    // Evict weakest, least accessed memories
    const memories = Array.from(this.memories.values());
    memories.sort((a, b) => {
      if (a.strength !== b.strength) {
        return a.strength - b.strength;
      }
      return a.accessCount - b.accessCount;
    });

    // Evict bottom 10%
    const toEvict = Math.ceil(memories.length * 0.1);
    for (let i = 0; i < toEvict; i++) {
      await this.deleteMemory(memories[i].id);
    }
  }

  /**
   * Group memories for consolidation
   */
  private groupMemories(memories: Memory[]): Memory[][] {
    const groups: Memory[][] = [];
    const processed = new Set<string>();

    for (const memory of memories) {
      if (processed.has(memory.id)) continue;

      const group = [memory];
      processed.add(memory.id);

      // Find related memories
      for (const other of memories) {
        if (processed.has(other.id)) continue;

        if (this.areRelated(memory, other)) {
          group.push(other);
          processed.add(other.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Check if two memories are related
   */
  private areRelated(a: Memory, b: Memory): boolean {
    // Same type and user/category
    if (a.type !== b.type) return false;

    if (a.metadata.userId && a.metadata.userId === b.metadata.userId) {
      return true;
    }

    if (a.metadata.categories && b.metadata.categories) {
      const intersection = a.metadata.categories.filter(c =>
        b.metadata.categories?.includes(c)
      );
      return intersection.length > 0;
    }

    return false;
  }

  /**
   * Check if memories should be merged
   */
  private shouldMerge(memories: Memory[]): boolean {
    if (memories.length < 2) return false;

    // Check if memories are similar enough
    const first = memories[0];

    for (let i = 1; i < memories.length; i++) {
      const other = memories[i];

      // Check content similarity
      const similarity = this.calculateSimilarity(first.content, other.content);
      if (similarity > 0.8) {
        return true;
      }
    }

    return false;
  }

  /**
   * Merge memories
   */
  private async mergeMemories(memories: Memory[]): Promise<Memory> {
    // Keep the most important memory as base
    memories.sort((a, b) => b.importance - a.importance);
    const base = memories[0];

    // Combine content
    const combinedContent = memories
      .map(m => m.content)
      .filter(c => c)
      .join('\n\n');

    // Update base memory
    base.content = combinedContent;
    base.importance = Math.min(1.0, base.importance + 0.1);
    base.strength = Math.min(1.0, base.strength + 0.1);
    base.updatedAt = Date.now();

    return base;
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return union.size === 0 ? 0 : intersection.size / union.size;
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
   * Clear all memories
   */
  async clearAll(): Promise<void> {
    this.memories.clear();
    this.episodicMemories.clear();
    this.semanticMemories.clear();
    this.proceduralMemories.clear();
    this.workingMemories.clear();
    this.accessCount.clear();
    this.lastAccess.clear();
  }
}
