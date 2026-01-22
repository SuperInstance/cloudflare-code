/**
 * Memory Consolidation System
 *
 * Implements various consolidation algorithms to strengthen and organize memories:
 * - Spacing effect: Review memories at increasing intervals
 * - Interleaving: Mix different types of memories during review
 * - Retrieval practice: Active recall strengthens memories
 * - Elaborative encoding: Connect new memories to existing knowledge
 * - Chunking: Group related memories together
 * - Generalization: Extract abstract patterns from specific instances
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BaseMemory,
  MemoryType,
  MemoryImportance,
  ConsolidationTask,
  ConsolidationAlgorithm,
  ConsolidationStatus,
  ConsolidationResult,
  ConsolidationError,
} from '../types';

export interface ConsolidationConfig {
  enabled: boolean;
  interval: number; // milliseconds between consolidation runs
  batchSize: number;
  algorithms: ConsolidationAlgorithm[];
  spacingMultiplier: number;
  minReviewCount: number;
  autoSchedule: boolean;
}

export interface ConsolidationStorage {
  getTask(id: string): Promise<ConsolidationTask | null>;
  saveTask(task: ConsolidationTask): Promise<void>;
  deleteTask(id: string): Promise<void>;
  getPendingTasks(): Promise<ConsolidationTask[]>;
  getTasksByAlgorithm(algorithm: ConsolidationAlgorithm): Promise<ConsolidationTask[]>;
  updateTaskStatus(id: string, status: ConsolidationStatus): Promise<void>;
}

export interface MemoryAccessor {
  getMemory(id: string): Promise<BaseMemory | null>;
  getMemoriesByType(type: MemoryType): Promise<BaseMemory[]>;
  getRelatedMemories(id: string): Promise<BaseMemory[]>;
  updateMemory(id: string, updates: Partial<BaseMemory>): Promise<void>;
  deleteMemory(id: string): Promise<void>;
}

export class MemoryConsolidationSystem {
  private config: ConsolidationConfig;
  private storage: ConsolidationStorage;
  private memoryAccessor: MemoryAccessor;
  private scheduler: Map<string, NodeJS.Timeout>;
  private reviewHistory: Map<string, Date[]>;

  constructor(
    config: ConsolidationConfig,
    storage: ConsolidationStorage,
    memoryAccessor: MemoryAccessor
  ) {
    this.config = config;
    this.storage = storage;
    this.memoryAccessor = memoryAccessor;
    this.scheduler = new Map();
    this.reviewHistory = new Map();
  }

  /**
   * Schedule consolidation for a set of memories
   */
  async scheduleConsolidation(
    memoryIds: string[],
    algorithm: ConsolidationAlgorithm
  ): Promise<ConsolidationTask> {
    const task: ConsolidationTask = {
      id: uuidv4(),
      memoryType: MemoryType.EPISODIC, // Will be determined from memories
      memoryIds,
      status: ConsolidationStatus.PENDING,
      algorithm,
    };

    await this.storage.saveTask(task);

    if (this.config.autoSchedule) {
      this.scheduleTask(task);
    }

    return task;
  }

  /**
   * Execute a consolidation task
   */
  async executeConsolidation(taskId: string): Promise<ConsolidationResult> {
    const task = await this.storage.getTask(taskId);
    if (!task) {
      throw new ConsolidationError(`Task not found: ${taskId}`, { taskId });
    }

    if (task.status !== ConsolidationStatus.PENDING) {
      throw new ConsolidationError(
        `Task is not pending: ${task.status}`,
        { taskId, status: task.status }
      );
    }

    await this.storage.updateTaskStatus(taskId, ConsolidationStatus.IN_PROGRESS);
    task.status = ConsolidationStatus.IN_PROGRESS;
    task.startedAt = new Date();

    try {
      let result: ConsolidationResult;

      switch (task.algorithm) {
        case ConsolidationAlgorithm.SPACING_EFFECT:
          result = await this.applySpacingEffect(task);
          break;
        case ConsolidationAlgorithm.INTERLEAVING:
          result = await this.applyInterleaving(task);
          break;
        case ConsolidationAlgorithm.RETRIEVAL_PRACTICE:
          result = await this.applyRetrievalPractice(task);
          break;
        case ConsolidationAlgorithm.ELABORATIVE:
          result = await this.applyElaborativeEncoding(task);
          break;
        case ConsolidationAlgorithm.CHUNKING:
          result = await this.applyChunking(task);
          break;
        case ConsolidationAlgorithm.GENERALIZATION:
          result = await this.applyGeneralization(task);
          break;
        default:
          throw new ConsolidationError(
            `Unknown algorithm: ${task.algorithm}`,
            { algorithm: task.algorithm }
          );
      }

      result.timestamp = new Date();
      task.result = result;
      task.status = ConsolidationStatus.COMPLETED;
      task.completedAt = new Date();

      await this.storage.saveTask(task);

      // Update review history
      for (const memoryId of task.memoryIds) {
        const history = this.reviewHistory.get(memoryId) ?? [];
        history.push(new Date());
        this.reviewHistory.set(memoryId, history);
      }

      return result;
    } catch (error) {
      task.status = ConsolidationStatus.FAILED;
      task.completedAt = new Date();
      await this.storage.saveTask(task);

      throw new ConsolidationError(
        `Consolidation failed: ${error}`,
        { taskId, error }
      );
    }
  }

  /**
   * Apply spacing effect algorithm
   * Reviews memories at increasing intervals based on review history
   */
  private async applySpacingEffect(task: ConsolidationTask): Promise<ConsolidationResult> {
    let memoriesModified = 0;
    const memoriesMerged = 0;
    let newConnections = 0;
    let importanceUpdated = 0;

    for (const memoryId of task.memoryIds) {
      const memory = await this.memoryAccessor.getMemory(memoryId);
      if (!memory) continue;

      const reviewCount = (this.reviewHistory.get(memoryId) ?? []).length;
      const interval = this.calculateSpacingInterval(reviewCount);

      // Boost importance based on spacing
      const importanceBoost = Math.min(0.1 * reviewCount, 0.5);
      const newImportance = Math.min(
        MemoryImportance.CRITICAL,
        memory.importance + importanceBoost
      ) as MemoryImportance;

      if (newImportance !== memory.importance) {
        await this.memoryAccessor.updateMemory(memoryId, {
          importance: newImportance,
        });
        memoriesModified++;
        importanceUpdated++;
      }

      // Schedule next review
      if (this.config.autoSchedule) {
        this.scheduleReview(memoryId, interval);
      }
    }

    return {
      memoriesModified,
      memoriesMerged,
      newConnections,
      importanceUpdated,
      duration: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Apply interleaving algorithm
   * Mixes different memory types during review to improve discrimination
   */
  private async applyInterleaving(task: ConsolidationTask): Promise<ConsolidationResult> {
    let memoriesModified = 0;
    const memoriesMerged = 0;
    let newConnections = 0;
    let importanceUpdated = 0;

    // Get memories of different types
    const memoryTypes = [MemoryType.EPISODIC, MemoryType.SEMANTIC, MemoryType.PROCEDURAL];
    const interleavedGroups: Map<MemoryType, BaseMemory[]> = new Map();

    for (const type of memoryTypes) {
      const memories = await this.memoryAccessor.getMemoriesByType(type);
      interleavedGroups.set(type, memories.slice(0, 10)); // Limit batch size
    }

    // Process memories in interleaved order
    const maxBatchSize = Math.max(...Array.from(interleavedGroups.values()).map((m) => m.length));

    for (let i = 0; i < maxBatchSize; i++) {
      for (const [type, memories] of interleavedGroups.entries()) {
        if (i >= memories.length) continue;

        const memory = memories[i];
        await this.memoryAccessor.updateMemory(memory.id, {
          lastAccessed: new Date(),
          accessCount: memory.accessCount + 1,
        });
        memoriesModified++;
      }
    }

    // Find connections across types
    const connections = await this.findCrossTypeConnections(interleavedGroups);
    newConnections = connections;

    return {
      memoriesModified,
      memoriesMerged,
      newConnections,
      importanceUpdated,
      duration: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Apply retrieval practice algorithm
   * Strengthens memories through active recall
   */
  private async applyRetrievalPractice(task: ConsolidationTask): Promise<ConsolidationResult> {
    let memoriesModified = 0;
    const memoriesMerged = 0;
    let newConnections = 0;
    let importanceUpdated = 0;

    for (const memoryId of task.memoryIds) {
      const memory = await this.memoryAccessor.getMemory(memoryId);
      if (!memory) continue;

      // Simulate retrieval (in production, this would trigger actual recall)
      const retrievalSuccess = await this.simulateRetrieval(memory);

      if (retrievalSuccess) {
        // Strengthen memory on successful retrieval
        const importanceBoost = 0.2;
        const newImportance = Math.min(
          MemoryImportance.CRITICAL,
          memory.importance + importanceBoost
        ) as MemoryImportance;

        await this.memoryAccessor.updateMemory(memoryId, {
          importance: newImportance,
          lastAccessed: new Date(),
          accessCount: memory.accessCount + 1,
        });
        memoriesModified++;
        importanceUpdated++;
      } else {
        // Decay memory on failed retrieval
        const importanceDecay = 0.1;
        const newImportance = Math.max(
          MemoryImportance.LOW,
          memory.importance - importanceDecay
        ) as MemoryImportance;

        await this.memoryAccessor.updateMemory(memoryId, {
          importance: newImportance,
        });
        memoriesModified++;
      }
    }

    return {
      memoriesModified,
      memoriesMerged,
      newConnections,
      importanceUpdated,
      duration: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Apply elaborative encoding algorithm
   * Connects new memories to existing knowledge structures
   */
  private async applyElaborativeEncoding(task: ConsolidationTask): Promise<ConsolidationResult> {
    let memoriesModified = 0;
    const memoriesMerged = 0;
    let newConnections = 0;
    let importanceUpdated = 0;

    for (const memoryId of task.memoryIds) {
      const memory = await this.memoryAccessor.getMemory(memoryId);
      if (!memory) continue;

      // Find related memories
      const relatedMemories = await this.memoryAccessor.getRelatedMemories(memoryId);

      if (relatedMemories.length > 0) {
        // Strengthen connections
        for (const related of relatedMemories.slice(0, 5)) {
          // Boost importance of connected memories
          const boost = 0.05;
          const newImportance = Math.min(
            MemoryImportance.CRITICAL,
            related.importance + boost
          ) as MemoryImportance;

          await this.memoryAccessor.updateMemory(related.id, {
            importance: newImportance,
          });
          importanceUpdated++;
          newConnections++;
        }

        memoriesModified++;
      }
    }

    return {
      memoriesModified,
      memoriesMerged,
      newConnections,
      importanceUpdated,
      duration: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Apply chunking algorithm
   * Groups related memories into larger chunks
   */
  private async applyChunking(task: ConsolidationTask): Promise<ConsolidationResult> {
    let memoriesModified = 0;
    let memoriesMerged = 0;
    let newConnections = 0;
    let importanceUpdated = 0;

    // Find clusters of related memories
    const clusters = await this.findMemoryClusters(task.memoryIds);

    for (const cluster of clusters) {
      if (cluster.length < 2) continue;

      // Select representative memory
      const representative = cluster.reduce((prev, current) =>
        current.importance > prev.importance ? current : prev
      );

      // Boost importance of representative
      const boost = 0.3 * cluster.length;
      const newImportance = Math.min(
        MemoryImportance.CRITICAL,
        representative.importance + boost
      ) as MemoryImportance;

      await this.memoryAccessor.updateMemory(representative.id, {
        importance: newImportance,
      });

      // Connect other memories to representative
      for (const memory of cluster) {
        if (memory.id !== representative.id) {
          // In production, create explicit relationships
          newConnections++;
        }
      }

      memoriesModified++;
      importanceUpdated++;
      memoriesMerged += cluster.length - 1;
    }

    return {
      memoriesModified,
      memoriesMerged,
      newConnections,
      importanceUpdated,
      duration: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Apply generalization algorithm
   * Extracts abstract patterns from specific instances
   */
  private async applyGeneralization(task: ConsolidationTask): Promise<ConsolidationResult> {
    let memoriesModified = 0;
    const memoriesMerged = 0;
    let newConnections = 0;
    let importanceUpdated = 0;

    // Group memories by patterns
    const patternGroups = await this.groupByPattern(task.memoryIds);

    for (const [pattern, memoryIds] of patternGroups.entries()) {
      if (memoryIds.length < 3) continue; // Need minimum samples

      // Calculate pattern strength
      const strength = memoryIds.length / task.memoryIds.length;

      // Boost importance of memories that fit strong patterns
      if (strength > 0.3) {
        for (const memoryId of memoryIds) {
          const memory = await this.memoryAccessor.getMemory(memoryId);
          if (!memory) continue;

          const boost = 0.2 * strength;
          const newImportance = Math.min(
            MemoryImportance.CRITICAL,
            memory.importance + boost
          ) as MemoryImportance;

          await this.memoryAccessor.updateMemory(memoryId, {
            importance: newImportance,
          });
          importanceUpdated++;
          memoriesModified++;
        }
      }
    }

    return {
      memoriesModified,
      memoriesMerged,
      newConnections,
      importanceUpdated,
      duration: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Run all pending consolidation tasks
   */
  async runPendingTasks(): Promise<ConsolidationResult[]> {
    const tasks = await this.storage.getPendingTasks();
    const results: ConsolidationResult[] = [];

    for (const task of tasks) {
      try {
        const result = await this.executeConsolidation(task.id);
        results.push(result);
      } catch (error) {
        console.error(`Failed to execute task ${task.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Get consolidation statistics
   */
  async getStats(): Promise<{
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgDuration: number;
    totalMemoriesProcessed: number;
  }> {
    const tasks = await this.storage.getPendingTasks();
    const pendingCount = tasks.length;

    // In production, track completed and failed tasks
    const completedTasks = 0;
    const failedTasks = 0;
    const avgDuration = 0;
    const totalMemoriesProcessed = 0;

    return {
      pendingTasks: pendingCount,
      completedTasks,
      failedTasks,
      avgDuration,
      totalMemoriesProcessed,
    };
  }

  /**
   * Calculate spacing interval based on review count
   */
  private calculateSpacingInterval(reviewCount: number): number {
    // Exponential spacing: interval = base * multiplier^reviewCount
    const baseInterval = 60000; // 1 minute
    return baseInterval * Math.pow(this.config.spacingMultiplier, reviewCount);
  }

  /**
   * Schedule a task for future execution
   */
  private scheduleTask(task: ConsolidationTask): void {
    const delay = this.config.interval;
    const timeout = setTimeout(() => {
      this.executeConsolidation(task.id).catch((error) => {
        console.error(`Scheduled consolidation failed: ${error}`);
      });
    }, delay);

    this.scheduler.set(task.id, timeout);
  }

  /**
   * Schedule a memory review
   */
  private scheduleReview(memoryId: string, interval: number): void {
    const timeout = setTimeout(async () => {
      await this.scheduleConsolidation([memoryId], ConsolidationAlgorithm.SPACING_EFFECT);
    }, interval);

    this.scheduler.set(`review:${memoryId}`, timeout);
  }

  /**
   * Simulate memory retrieval
   */
  private async simulateRetrieval(memory: BaseMemory): Promise<boolean> {
    // In production, implement actual retrieval testing
    // For now, use probability based on importance and access count
    const baseProbability = 0.7;
    const importanceBonus = memory.importance * 0.05;
    const accessBonus = Math.min(memory.accessCount * 0.02, 0.2);

    const probability = baseProbability + importanceBonus + accessBonus;
    return Math.random() < probability;
  }

  /**
   * Find connections across memory types
   */
  private async findCrossTypeConnections(
    groups: Map<MemoryType, BaseMemory[]>
  ): Promise<number> {
    let connections = 0;

    const types = Array.from(groups.keys());
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const type1Memories = groups.get(types[i]) ?? [];
        const type2Memories = groups.get(types[j]) ?? [];

        // Find potential connections
        for (const mem1 of type1Memories) {
          for (const mem2 of type2Memories) {
            if (await this.areMemoriesRelated(mem1, mem2)) {
              connections++;
            }
          }
        }
      }
    }

    return connections;
  }

  /**
   * Check if two memories are related
   */
  private async areMemoriesRelated(
    mem1: BaseMemory,
    mem2: BaseMemory
  ): Promise<boolean> {
    // Simple check based on tags
    const sharedTags = mem1.tags.filter((tag) => mem2.tags.includes(tag));
    return sharedTags.length > 0;
  }

  /**
   * Find clusters of related memories
   */
  private async findMemoryClusters(memoryIds: string[]): Promise<BaseMemory[][]> {
    const clusters: BaseMemory[][] = [];
    const processed = new Set<string>();

    for (const memoryId of memoryIds) {
      if (processed.has(memoryId)) continue;

      const memory = await this.memoryAccessor.getMemory(memoryId);
      if (!memory) continue;

      const cluster = [memory];
      processed.add(memoryId);

      // Find related memories
      const related = await this.memoryAccessor.getRelatedMemories(memoryId);
      for (const rel of related) {
        if (!processed.has(rel.id) && memoryIds.includes(rel.id)) {
          cluster.push(rel);
          processed.add(rel.id);
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Group memories by pattern
   */
  private async groupByPattern(
    memoryIds: string[]
  ): Promise<Map<string, string[]>> {
    const groups = new Map<string, string[]>();

    for (const memoryId of memoryIds) {
      const memory = await this.memoryAccessor.getMemory(memoryId);
      if (!memory) continue;

      // Extract pattern from metadata
      const pattern = memory.metadata['pattern'] as string;
      if (pattern) {
        if (!groups.has(pattern)) {
          groups.set(pattern, []);
        }
        groups.get(pattern)!.push(memoryId);
      }
    }

    return groups;
  }

  /**
   * Cancel scheduled task
   */
  cancelTask(taskId: string): void {
    const timeout = this.scheduler.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduler.delete(taskId);
    }
  }

  /**
   * Stop all scheduled tasks
   */
  stopAll(): void {
    for (const timeout of this.scheduler.values()) {
      clearTimeout(timeout);
    }
    this.scheduler.clear();
  }
}

/**
 * D1-based storage for consolidation tasks
 */
export class D1ConsolidationStorage implements ConsolidationStorage {
  constructor(private db: D1Database) {
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.db.batch([
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS consolidation_tasks (
          id TEXT PRIMARY KEY,
          memory_type TEXT NOT NULL,
          memory_ids TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          algorithm TEXT NOT NULL,
          result TEXT
        )
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_consolidation_status
        ON consolidation_tasks(status)
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_consolidation_algorithm
        ON consolidation_tasks(algorithm)
      `),
    ]);
  }

  async getTask(id: string): Promise<ConsolidationTask | null> {
    const result = await this.db
      .prepare('SELECT * FROM consolidation_tasks WHERE id = ?')
      .bind(id)
      .first();

    if (!result) return null;

    return this.deserialize(result);
  }

  async saveTask(task: ConsolidationTask): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO consolidation_tasks
        (id, memory_type, memory_ids, status, started_at, completed_at, algorithm, result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        task.id,
        task.memoryType,
        JSON.stringify(task.memoryIds),
        task.status,
        task.startedAt?.toISOString() ?? null,
        task.completedAt?.toISOString() ?? null,
        task.algorithm,
        task.result ? JSON.stringify(task.result) : null
      )
      .run();
  }

  async deleteTask(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM consolidation_tasks WHERE id = ?')
      .bind(id)
      .run();
  }

  async getPendingTasks(): Promise<ConsolidationTask[]> {
    const results = await this.db
      .prepare('SELECT * FROM consolidation_tasks WHERE status = ?')
      .bind(ConsolidationStatus.PENDING)
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async getTasksByAlgorithm(
    algorithm: ConsolidationAlgorithm
  ): Promise<ConsolidationTask[]> {
    const results = await this.db
      .prepare('SELECT * FROM consolidation_tasks WHERE algorithm = ?')
      .bind(algorithm)
      .all();

    return results.results.map((r) => this.deserialize(r));
  }

  async updateTaskStatus(
    id: string,
    status: ConsolidationStatus
  ): Promise<void> {
    const task = await this.getTask(id);
    if (!task) {
      throw new ConsolidationError(`Task not found: ${id}`, { id });
    }

    task.status = status;
    await this.saveTask(task);
  }

  private deserialize(data: any): ConsolidationTask {
    return {
      id: data.id,
      memoryType: data.memory_type,
      memoryIds: JSON.parse(data.memory_ids),
      status: data.status,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      algorithm: data.algorithm,
      result: data.result ? JSON.parse(data.result) : undefined,
    } as ConsolidationTask;
  }
}
