// @ts-nocheck
/**
 * Memory Pruning System
 *
 * Implements various pruning strategies to manage memory size and maintain
 * performance by removing less important or obsolete memories.
 *
 * Strategies:
 * - LRU (Least Recently Used): Remove least recently accessed memories
 * - LFU (Least Frequently Used): Remove least frequently accessed memories
 * - Importance-based: Remove memories with low importance scores
 * - Temporal: Remove old memories beyond retention period
 * - Composite: Combine multiple strategies for optimal pruning
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BaseMemory,
  MemoryType,
  MemoryImportance,
  MemoryStatus,
  PruningConfig,
  PruningResult,
  PruningDetail,
  PruningStrategy,
  PruningError,
} from '../types';

export interface PruningStorage {
  getMemory(id: string): Promise<BaseMemory | null>;
  getMemoriesByType(type: MemoryType): Promise<BaseMemory[]>;
  getAllMemories(): Promise<BaseMemory[]>;
  deleteMemory(id: string): Promise<void>;
  getTotalMemorySize(): Promise<number>;
}

export class MemoryPruningSystem {
  private config: PruningConfig;
  private storage: PruningStorage;
  private pruningHistory: PruningResult[];

  constructor(config: PruningConfig, storage: PruningStorage) {
    this.config = config;
    this.storage = storage;
    this.pruningHistory = [];
  }

  /**
   * Execute pruning using the configured strategy
   */
  async prune(
    strategy: PruningStrategy = PruningStrategy.COMPOSITE,
    options: {
      targetSize?: number;
      force?: boolean;
    } = {}
  ): Promise<PruningResult> {
    if (!this.config.enabled && !options.force) {
      throw new PruningError('Pruning is disabled', { config: this.config });
    }

    const startTime = Date.now();
    const details: PruningDetail[] = [];
    let spaceFreed = 0;

    // Get current memory state
    const allMemories = await this.storage.getAllMemories();
    const currentSize = await this.storage.getTotalMemorySize();

    // Check if pruning is needed
    const targetSize = options.targetSize ?? this.config.maxMemorySize;
    if (currentSize <= targetSize) {
      return {
        memoriesRemoved: 0,
        spaceFreed: 0,
        performanceImprovement: 0,
        timestamp: new Date(),
        details: [],
      };
    }

    // Select memories to prune
    const candidates = await this.selectPruningCandidates(
      allMemories,
      strategy,
      targetSize
    );

    // Execute pruning
    for (const candidate of candidates) {
      // Preserve critical memories if configured
      if (this.config.preserveCritical && candidate.importance === MemoryImportance.CRITICAL) {
        continue;
      }

      try {
        await this.storage.deleteMemory(candidate.id);
        details.push({
          memoryId: candidate.id,
          reason: this.getPruningReason(candidate, strategy),
          importance: candidate.importance,
          lastAccessed: candidate.lastAccessed,
        });

        spaceFreed += this.estimateMemorySize(candidate);
      } catch (error) {
        console.error(`Failed to prune memory ${candidate.id}:`, error);
      }
    }

    const result: PruningResult = {
      memoriesRemoved: details.length,
      spaceFreed,
      performanceImprovement: this.calculatePerformanceImprovement(
        details.length,
        allMemories.length
      ),
      timestamp: new Date(),
      details,
    };

    this.pruningHistory.push(result);

    return result;
  }

  /**
   * Select memories for pruning based on strategy
   */
  private async selectPruningCandidates(
    memories: BaseMemory[],
    strategy: PruningStrategy,
    targetSize: number
  ): Promise<BaseMemory[]> {
    let candidates: BaseMemory[] = [];

    switch (strategy) {
      case PruningStrategy.LRU:
        candidates = await this.selectLRU(memories, targetSize);
        break;
      case PruningStrategy.LFU:
        candidates = await this.selectLFU(memories, targetSize);
        break;
      case PruningStrategy.IMPORTANCE_BASED:
        candidates = await this.selectByImportance(memories, targetSize);
        break;
      case PruningStrategy.TEMPORAL:
        candidates = await this.selectByTemporal(memories, targetSize);
        break;
      case PruningStrategy.COMPOSITE:
        candidates = await this.selectComposite(memories, targetSize);
        break;
      default:
        throw new PruningError(`Unknown strategy: ${strategy}`, { strategy });
    }

    return candidates;
  }

  /**
   * Select memories using LRU strategy
   */
  private async selectLRU(
    memories: BaseMemory[],
    targetSize: number
  ): Promise<BaseMemory[]> {
    // Sort by last accessed time (oldest first)
    const sorted = [...memories].sort(
      (a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
    );

    return this.selectToTargetSize(sorted, targetSize);
  }

  /**
   * Select memories using LFU strategy
   */
  private async selectLFU(
    memories: BaseMemory[],
    targetSize: number
  ): Promise<BaseMemory[]> {
    // Sort by access count (least frequently accessed first)
    const sorted = [...memories].sort((a, b) => a.accessCount - b.accessCount);

    return this.selectToTargetSize(sorted, targetSize);
  }

  /**
   * Select memories using importance-based strategy
   */
  private async selectByImportance(
    memories: BaseMemory[],
    targetSize: number
  ): Promise<BaseMemory[]> {
    // Filter by minimum importance
    const filtered = memories.filter(
      (m) => m.importance < this.config.minImportance
    );

    // Sort by importance (lowest first)
    const sorted = [...filtered].sort((a, b) => a.importance - b.importance);

    return this.selectToTargetSize(sorted, targetSize);
  }

  /**
   * Select memories using temporal strategy
   */
  private async selectByTemporal(
    memories: BaseMemory[],
    targetSize: number
  ): Promise<BaseMemory[]> {
    const now = Date.now();
    const maxAge = this.config.maxAge * 24 * 60 * 60 * 1000; // Convert days to ms

    // Filter old memories
    const filtered = memories.filter((m) => {
      const age = now - m.createdAt.getTime();
      return age > maxAge;
    });

    // Sort by age (oldest first)
    const sorted = [...filtered].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    return this.selectToTargetSize(sorted, targetSize);
  }

  /**
   * Select memories using composite strategy
   */
  private async selectComposite(
    memories: BaseMemory[],
    targetSize: number
  ): Promise<BaseMemory[]> {
    // Calculate pruning score for each memory
    const scored = memories.map((memory) => ({
      memory,
      score: this.calculatePruningScore(memory),
    }));

    // Sort by score (higher score = more likely to prune)
    const sorted = scored.sort((a, b) => b.score - a.score);

    // Filter by threshold
    const filtered = sorted.filter((s) => s.score >= this.config.pruningThreshold);

    return this.selectToTargetSize(
      filtered.map((s) => s.memory),
      targetSize
    );
  }

  /**
   * Calculate pruning score for a memory (higher = more likely to prune)
   */
  private calculatePruningScore(memory: BaseMemory): number {
    let score = 0;

    // Age factor (0-1)
    const ageInDays = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const ageScore = Math.min(ageInDays / 365, 1); // Max score at 1 year
    score += ageScore * 0.3;

    // Access frequency factor (0-1, lower is better for pruning)
    const accessScore = 1 - Math.min(memory.accessCount / 100, 1);
    score += accessScore * 0.3;

    // Importance factor (0-1, lower importance = higher score)
    const importanceScore = (5 - memory.importance) / 5;
    score += importanceScore * 0.3;

    // Last accessed factor (0-1)
    const daysSinceAccess = (Date.now() - memory.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    const lastAccessScore = Math.min(daysSinceAccess / 90, 1); // Max score at 90 days
    score += lastAccessScore * 0.1;

    return score;
  }

  /**
   * Select memories to reach target size
   */
  private async selectToTargetSize(
    memories: BaseMemory[],
    targetSize: number
  ): Promise<BaseMemory[]> {
    const selected: BaseMemory[] = [];
    let currentSize = 0;

    for (const memory of memories) {
      const memorySize = this.estimateMemorySize(memory);
      currentSize += memorySize;

      selected.push(memory);

      if (currentSize >= targetSize) {
        break;
      }
    }

    return selected;
  }

  /**
   * Estimate memory size for a memory
   */
  private estimateMemorySize(memory: BaseMemory): number {
    // Rough estimation in bytes
    let size = 100; // Base overhead

    // Add size of properties
    size += JSON.stringify(memory.metadata).length;
    size += memory.tags.join(',').length;
    size += memory.id.length;

    if (memory.embedding) {
      size += memory.embedding.length * 8; // 8 bytes per number
    }

    return size;
  }

  /**
   * Calculate performance improvement from pruning
   */
  private calculatePerformanceImprovement(
    removedCount: number,
    totalCount: number
  ): number {
    if (totalCount === 0) return 0;

    // Simple model: linear improvement based on percentage removed
    const percentageRemoved = removedCount / totalCount;
    return percentageRemoved * 100;
  }

  /**
   * Get pruning reason for a memory
   */
  private getPruningReason(memory: BaseMemory, strategy: PruningStrategy): string {
    switch (strategy) {
      case PruningStrategy.LRU:
        return `Least recently accessed: ${memory.lastAccessed.toISOString()}`;
      case PruningStrategy.LFU:
        return `Least frequently accessed: ${memory.accessCount} times`;
      case PruningStrategy.IMPORTANCE_BASED:
        return `Low importance: ${memory.importance}`;
      case PruningStrategy.TEMPORAL:
        return `Old memory: created ${memory.createdAt.toISOString()}`;
      case PruningStrategy.COMPOSITE:
        return `Composite score: ${this.calculatePruningScore(memory).toFixed(2)}`;
      default:
        return 'Pruned';
    }
  }

  /**
   * Get pruning statistics
   */
  async getStats(): Promise<{
    totalPruned: number;
    avgPrunedPerRun: number;
    lastPruned?: Date;
    totalSpaceFreed: number;
    pruningRuns: number;
  }> {
    const totalPruned = this.pruningHistory.reduce(
      (sum, r) => sum + r.memoriesRemoved,
      0
    );
    const totalSpaceFreed = this.pruningHistory.reduce(
      (sum, r) => sum + r.spaceFreed,
      0
    );
    const lastPruned =
      this.pruningHistory.length > 0
        ? this.pruningHistory[this.pruningHistory.length - 1].timestamp
        : undefined;

    return {
      totalPruned,
      avgPrunedPerRun:
        this.pruningHistory.length > 0
          ? totalPruned / this.pruningHistory.length
          : 0,
      lastPruned,
      totalSpaceFreed,
      pruningRuns: this.pruningHistory.length,
    };
  }

  /**
   * Analyze memory to determine if it should be pruned
   */
  async shouldPrune(memory: BaseMemory): Promise<boolean> {
    // Check if memory is below minimum importance
    if (memory.importance < this.config.minImportance) {
      return true;
    }

    // Check if memory is too old
    const ageInDays = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > this.config.maxAge) {
      return true;
    }

    // Check access frequency
    if (memory.accessCount < this.config.minAccessFrequency) {
      return true;
    }

    // Check pruning score
    const score = this.calculatePruningScore(memory);
    if (score >= this.config.pruningThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Get recommended pruning actions without executing
   */
  async analyzePruning(): Promise<{
    recommendedCount: number;
    estimatedSpaceFreed: number;
    recommendations: Array<{
      memoryId: string;
      reason: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  }> {
    const allMemories = await this.storage.getAllMemories();
    const recommendations: Array<{
      memoryId: string;
      reason: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    let estimatedSpaceFreed = 0;

    for (const memory of allMemories) {
      const score = this.calculatePruningScore(memory);
      const shouldPrune = await this.shouldPrune(memory);

      if (shouldPrune) {
        const priority =
          score > 0.8 ? 'high' : score > 0.5 ? 'medium' : 'low';

        recommendations.push({
          memoryId: memory.id,
          reason: this.getPruningReason(memory, PruningStrategy.COMPOSITE),
          priority,
        });

        estimatedSpaceFreed += this.estimateMemorySize(memory);
      }
    }

    return {
      recommendedCount: recommendations.length,
      estimatedSpaceFreed,
      recommendations,
    };
  }

  /**
   * Decay importance scores over time
   */
  async decayImportance(): Promise<number> {
    const allMemories = await this.storage.getAllMemories();
    let decayed = 0;

    for (const memory of allMemories) {
      const ageInDays = (Date.now() - memory.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);

      // Apply decay if not accessed recently
      if (ageInDays > 30) {
        const decayAmount = this.config.decayRate * Math.floor(ageInDays / 30);
        const newImportance = Math.max(
          MemoryImportance.LOW,
          Math.floor(memory.importance - decayAmount)
        ) as MemoryImportance;

        if (newImportance !== memory.importance) {
          // In production, update memory in storage
          decayed++;
        }
      }
    }

    return decayed;
  }

  /**
   * Get pruning history
   */
  getHistory(): PruningResult[] {
    return [...this.pruningHistory];
  }

  /**
   * Clear pruning history
   */
  clearHistory(): void {
    this.pruningHistory = [];
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PruningConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): PruningConfig {
    return { ...this.config };
  }
}

/**
 * Pruning scheduler for automated pruning
 */
export class PruningScheduler {
  private system: MemoryPruningSystem;
  private interval: NodeJS.Timeout | null;
  private running: boolean = false;

  constructor(system: MemoryPruningSystem) {
    this.system = system;
    this.interval = null;
  }

  /**
   * Start automatic pruning
   */
  start(intervalMs: number = 3600000): void {
    if (this.running) return;

    this.running = true;
    this.interval = setInterval(async () => {
      try {
        await this.system.prune(PruningStrategy.COMPOSITE);
      } catch (error) {
        console.error('Scheduled pruning failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop automatic pruning
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.running;
  }
}

/**
 * D1-based storage for pruning operations
 */
export class D1PruningStorage implements PruningStorage {
  constructor(private db: D1Database) {
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.db.batch([
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS pruning_history (
          id TEXT PRIMARY KEY,
          memories_removed INTEGER NOT NULL,
          space_freed INTEGER NOT NULL,
          performance_improvement REAL NOT NULL,
          timestamp TEXT NOT NULL,
          details TEXT NOT NULL
        )
      `),
    ]);
  }

  async getMemory(id: string): Promise<BaseMemory | null> {
    // This would need to query the actual memory tables
    // For now, return null as placeholder
    return null;
  }

  async getMemoriesByType(type: MemoryType): Promise<BaseMemory[]> {
    // Placeholder implementation
    return [];
  }

  async getAllMemories(): Promise<BaseMemory[]> {
    // Placeholder implementation
    return [];
  }

  async deleteMemory(id: string): Promise<void> {
    // This would delete from actual memory tables
    // Placeholder implementation
  }

  async getTotalMemorySize(): Promise<number> {
    // Calculate total memory usage across all tables
    const result = await this.db
      .prepare(`
        SELECT SUM(pgsize) as size
        FROM dbstat
        WHERE name IN ('episodic_memories', 'semantic_memories', 'procedural_memories')
      `)
      .first();

    return (result?.size as number) ?? 0;
  }

  /**
   * Save pruning result to history
   */
  async savePruningResult(result: PruningResult): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO pruning_history
        (id, memories_removed, space_freed, performance_improvement, timestamp, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        uuidv4(),
        result.memoriesRemoved,
        result.spaceFreed,
        result.performanceImprovement,
        result.timestamp.toISOString(),
        JSON.stringify(result.details)
      )
      .run();
  }

  /**
   * Get pruning history
   */
  async getPruningHistory(limit: number = 100): Promise<PruningResult[]> {
    const results = await this.db
      .prepare('SELECT * FROM pruning_history ORDER BY timestamp DESC LIMIT ?')
      .bind(limit)
      .all();

    return results.results.map((r) => ({
      memoriesRemoved: r.memories_removed,
      spaceFreed: r.space_freed,
      performanceImprovement: r.performance_improvement,
      timestamp: new Date(r.timestamp),
      details: JSON.parse(r.details),
    }));
  }
}
