/**
 * Resharding and Data Migration
 *
 * Handles resharding, rebalancing, and data movement between shards
 */

import type {
  MigrationTask,
  MigrationStatus,
  MigrationPlan,
  ReshardConfig,
  MigrationBatch,
} from './types';

export class ReshardingManager {
  private tasks: Map<string, MigrationTask>;
  private batches: Map<string, MigrationBatch[]>;
  private activeMigrations: Set<string>;
  private maxParallelTasks: number;

  constructor(maxParallelTasks: number = 5) {
    this.tasks = new Map();
    this.batches = new Map();
    this.activeMigrations = new Set();
    this.maxParallelTasks = maxParallelTasks;
  }

  /**
   * Plan resharding operation
   */
  planResharding(config: ReshardConfig): MigrationPlan {
    const tasks: MigrationTask[] = [];
    const dependencies = new Map<string, string[]>();
    let totalDataMovement = 0;

    switch (config.strategy) {
      case 'split':
        const splitTasks = this.planSplit(config);
        tasks.push(...splitTasks.tasks);
        splitTasks.dependencies.forEach((deps, taskId) => dependencies.set(taskId, deps));
        totalDataMovement += splitTasks.dataMovement;
        break;

      case 'merge':
        const mergeTasks = this.planMerge(config);
        tasks.push(...mergeTasks.tasks);
        mergeTasks.dependencies.forEach((deps, taskId) => dependencies.set(taskId, deps));
        totalDataMovement += mergeTasks.dataMovement;
        break;

      case 'move':
        const moveTasks = this.planMove(config);
        tasks.push(...moveTasks.tasks);
        moveTasks.dependencies.forEach((deps, taskId) => dependencies.set(taskId, deps));
        totalDataMovement += moveTasks.dataMovement;
        break;
    }

    const estimatedTime = tasks.reduce((sum, task) => {
      return sum + this.estimateTaskTime(task.totalRows, config.batchSize);
    }, 0);

    return {
      tasks,
      dependencies,
      estimatedTime,
      estimatedDataMovement: totalDataMovement,
      rollbackPlan: this.createRollbackPlan(tasks),
    };
  }

  /**
   * Plan shard split
   */
  private planSplit(config: ReshardConfig): {
    tasks: MigrationTask[];
    dependencies: Map<string, string[]>;
    dataMovement: number;
  } {
    const tasks: MigrationTask[] = [];
    const dependencies = new Map<string, string[]>();
    let dataMovement = 0;

    for (const sourceShard of config.currentShards) {
      for (const targetShard of config.newShards) {
        const task = this.createTask({
          type: 'reshard',
          source: { shardId: sourceShard, region: 'default', table: '*' },
          target: { shardId: targetShard, region: 'default', table: '*' },
          totalRows: 0, // Will be calculated during execution
        });

        tasks.push(task);
        dependencies.set(task.id, []);
      }
    }

    return { tasks, dependencies, dataMovement };
  }

  /**
   * Plan shard merge
   */
  private planMerge(config: ReshardConfig): {
    tasks: MigrationTask[];
    dependencies: Map<string, string[]>;
    dataMovement: number;
  } {
    const tasks: MigrationTask[] = [];
    const dependencies = new Map<string, string[]>();
    let dataMovement = 0;

    // Create one task per target shard
    for (const targetShard of config.newShards) {
      const task = this.createTask({
        type: 'reshard',
        source: { shardId: config.currentShards.join(','), region: 'default', table: '*' },
        target: { shardId: targetShard, region: 'default', table: '*' },
        totalRows: 0,
      });

      // All source shard migrations must complete before merge
      dependencies.set(
        task.id,
        config.currentShards.map((s) => `migrate-${s}`)
      );

      tasks.push(task);
    }

    return { tasks, dependencies, dataMovement };
  }

  /**
   * Plan data move between shards
   */
  private planMove(config: ReshardConfig): {
    tasks: MigrationTask[];
    dependencies: Map<string, string[]>;
    dataMovement: number;
  } {
    const tasks: MigrationTask[] = [];
    const dependencies = new Map<string, string[]>();
    let dataMovement = 0;

    // Pair up source and target shards
    const pairs = Math.min(config.currentShards.length, config.newShards.length);

    for (let i = 0; i < pairs; i++) {
      const sourceShard = config.currentShards[i];
      const targetShard = config.newShards[i];

      const task = this.createTask({
        type: 'reshard',
        source: { shardId: sourceShard, region: 'default', table: '*' },
        target: { shardId: targetShard, region: 'default', table: '*' },
        totalRows: 0,
      });

      tasks.push(task);
      dependencies.set(task.id, []);
    }

    return { tasks, dependencies, dataMovement };
  }

  /**
   * Execute migration plan
   */
  async executeMigration(
    plan: MigrationPlan,
    executor: (batch: MigrationBatch) => Promise<void>
  ): Promise<{
    success: boolean;
    completed: number;
    failed: number;
    errors: Error[];
  }> {
    const completed: string[] = [];
    const failed: string[] = [];
    const errors: Error[] = [];

    // Execute tasks in dependency order
    for (const task of plan.tasks) {
      // Check if dependencies are satisfied
      const deps = plan.dependencies.get(task.id) || [];
      const depsSatisfied = deps.every((depId) => completed.includes(depId));

      if (!depsSatisfied) {
        continue;
      }

      // Check parallel task limit
      while (this.activeMigrations.size >= this.maxParallelTasks) {
        await this.delay(100);
      }

      // Execute task
      this.activeMigrations.add(task.id);
      task.status = 'running';
      task.startTime = new Date();

      try {
        await this.executeTask(task, executor);
        task.status = 'completed';
        task.endTime = new Date();
        completed.push(task.id);
      } catch (error) {
        task.status = 'failed';
        task.error = error as Error;
        task.endTime = new Date();
        failed.push(task.id);
        errors.push(error as Error);
      } finally {
        this.activeMigrations.delete(task.id);
      }
    }

    return {
      success: failed.length === 0,
      completed: completed.length,
      failed: failed.length,
      errors,
    };
  }

  /**
   * Execute a single migration task
   */
  private async executeTask(
    task: MigrationTask,
    executor: (batch: MigrationBatch) => Promise<void>
  ): Promise<void> {
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore && task.status !== 'failed') {
      // Fetch batch from source
      const batch = await this.fetchBatch(task, offset, batchSize);

      if (batch.rows.length === 0) {
        hasMore = false;
        break;
      }

      // Execute batch migration
      await executor(batch);

      // Update progress
      task.migratedRows += batch.rows.length;
      task.progress = (task.migratedRows / task.totalRows) * 100;

      offset += batchSize;
    }

    // Verify migration
    await this.verifyMigration(task);
  }

  /**
   * Fetch a batch of data to migrate
   */
  private async fetchBatch(
    task: MigrationTask,
    offset: number,
    limit: number
  ): Promise<MigrationBatch> {
    // Simulate batch fetch (in real implementation, would query database)
    await this.delay(10);

    return {
      taskId: task.id,
      batchNumber: Math.floor(offset / limit),
      rows: Array.from({ length: limit }, (_, i) => ({
        id: offset + i,
        data: `row-${offset + i}`,
      })),
      checksum: this.calculateChecksum([]),
      status: 'pending',
    };
  }

  /**
   * Verify migration integrity
   */
  private async verifyMigration(task: MigrationTask): Promise<boolean> {
    // Compare checksums
    const sourceChecksum = task.checksums.source;
    const targetChecksum = task.checksums.target;

    return sourceChecksum === targetChecksum;
  }

  /**
   * Create a migration task
   */
  private createTask(partial: Partial<MigrationTask>): MigrationTask {
    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: partial.type || 'reshard',
      source: partial.source!,
      target: partial.target!,
      status: 'pending',
      progress: 0,
      totalRows: partial.totalRows || 0,
      migratedRows: 0,
      failedRows: 0,
      checksums: {
        source: '',
        target: '',
      },
    };
  }

  /**
   * Create rollback plan
   */
  private createRollbackPlan(tasks: MigrationTask[]): MigrationTask[] {
    return tasks.map((task) => ({
      ...task,
      id: `rollback-${task.id}`,
      source: task.target,
      target: task.source,
      status: 'pending',
    }));
  }

  /**
   * Estimate task execution time
   */
  private estimateTaskTime(totalRows: number, batchSize: number): number {
    const batches = Math.ceil(totalRows / batchSize);
    // Assume 10ms per batch
    return batches * 10;
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: unknown[]): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get migration status
   */
  getTaskStatus(taskId: string): MigrationTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all active migrations
   */
  getActiveMigrations(): MigrationTask[] {
    return Array.from(this.tasks.values()).filter((t) =>
      ['running', 'pending'].includes(t.status)
    );
  }

  /**
   * Pause a migration
   */
  pauseMigration(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'running') {
      task.status = 'paused';
      return true;
    }
    return false;
  }

  /**
   * Resume a paused migration
   */
  async resumeMigration(
    taskId: string,
    executor: (batch: MigrationBatch) => Promise<void>
  ): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') {
      return false;
    }

    task.status = 'running';
    await this.executeTask(task, executor);
    return true;
  }

  /**
   * Cancel a migration
   */
  cancelMigration(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task && ['running', 'paused', 'pending'].includes(task.status)) {
      task.status = 'failed';
      task.error = new Error('Migration cancelled');
      return true;
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
