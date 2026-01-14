/**
 * Multi-Leader Replication
 *
 * Implements multi-leader replication topology with conflict resolution
 */

import type {
  ReplicationConfig,
  DataConflict,
  ConflictResolution,
  ReplicationLog,
  Region,
} from './types';

export interface LeaderState {
  region: Region;
  sequence: number;
  vectorClock: Map<string, number>;
  pending: ReplicationLog[];
}

export class MultiLeaderReplicator {
  private config: ReplicationConfig;
  private leaders: Map<string, LeaderState>;
  private conflictResolution: ConflictResolution;
  private conflictLog: DataConflict[];

  constructor(config: ReplicationConfig, conflictResolution: ConflictResolution) {
    this.config = config;
    this.conflictResolution = conflictResolution;
    this.leaders = new Map();
    this.conflictLog = [];

    this.initializeLeaders();
  }

  private initializeLeaders(): void {
    for (const region of this.config.regions) {
      this.leaders.set(region.id, {
        region,
        sequence: 0,
        vectorClock: new Map(),
        pending: [],
      });
    }
  }

  /**
   * Write to a specific leader region
   */
  async write(
    regionId: string,
    query: string,
    params: unknown[],
    env: any
  ): Promise<{ success: boolean; sequence: number; conflicts?: DataConflict[] }> {
    const leader = this.leaders.get(regionId);
    if (!leader) {
      throw new Error(`Leader not found for region ${regionId}`);
    }

    // Increment local sequence
    leader.sequence++;

    // Update vector clock
    const currentClock = leader.vectorClock.get(regionId) || 0;
    leader.vectorClock.set(regionId, currentClock + 1);

    // Create log entry
    const log: ReplicationLog = {
      id: `log-${regionId}-${leader.sequence}`,
      sequence: leader.sequence,
      timestamp: new Date(),
      operation: this.extractOperation(query),
      table: this.extractTable(query),
      data: { query, params },
      metadata: {
        region: regionId,
        vectorClock: new Map(leader.vectorClock),
      },
      applied: false,
    };

    // Apply locally
    await this.applyLog(regionId, log, env);
    log.applied = true;

    // Replicate to other leaders
    const conflicts = await this.replicateToOtherLeaders(regionId, log, env);

    return {
      success: true,
      sequence: leader.sequence,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  /**
   * Replicate log to other leader regions
   */
  private async replicateToOtherLeaders(
    sourceId: string,
    log: ReplicationLog,
    env: any
  ): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = [];

    for (const [regionId, leader] of this.leaders) {
      if (regionId === sourceId) continue;

      try {
        // Check for conflicts using vector clocks
        const hasConflict = this.detectConflict(sourceId, log, leader);

        if (hasConflict) {
          const conflict = await this.createConflict(sourceId, regionId, log, leader);
          conflicts.push(conflict);

          // Resolve conflict
          const resolved = await this.resolveConflict(conflict);
          if (resolved) {
            await this.applyResolved(regionId, resolved, env);
          }
        } else {
          // No conflict, apply directly
          await this.applyLog(regionId, log, env);
        }

        // Merge vector clocks
        this.mergeVectorClocks(leader.vectorClock, log.metadata.vectorClock as Map<string, number>);
      } catch (error) {
        // Handle replication failure
        leader.pending.push(log);
      }
    }

    return conflicts;
  }

  /**
   * Detect conflict using vector clocks
   */
  private detectConflict(
    sourceId: string,
    log: ReplicationLog,
    leader: LeaderState
  ): boolean {
    const logClock = log.metadata.vectorClock as Map<string, number>;
    const leaderClock = leader.vectorClock;

    let logGreater = false;
    let leaderGreater = false;

    for (const [key, value] of logClock) {
      const leaderValue = leaderClock.get(key) || 0;
      if (value > leaderValue) logGreater = true;
      if (value < leaderValue) leaderGreater = true;
    }

    for (const [key, value] of leaderClock) {
      const logValue = logClock.get(key) || 0;
      if (value > logValue) leaderGreater = true;
    }

    // Concurrent updates if both are greater in some dimensions
    return logGreater && leaderGreater;
  }

  /**
   * Create conflict object
   */
  private async createConflict(
    sourceId: string,
    targetId: string,
    log: ReplicationLog,
    leader: LeaderState
  ): Promise<DataConflict> {
    return {
      id: `conflict-${Date.now()}`,
      table: log.table,
      key: this.extractKey(log.data as Record<string, unknown>),
      versions: [
        {
          region: sourceId,
          data: log.data,
          timestamp: log.timestamp,
          version: log.sequence,
        },
        {
          region: targetId,
          data: await this.getCurrentData(targetId, log.table, log),
          timestamp: new Date(),
          version: leader.sequence,
        },
      ],
    };
  }

  /**
   * Resolve conflict using configured strategy
   */
  private async resolveConflict(conflict: DataConflict): Promise<Record<string, unknown> | null> {
    this.conflictLog.push(conflict);

    switch (this.conflictResolution.strategy) {
      case 'last-write-wins':
        return this.lastWriteWins(conflict);

      case 'first-write-wins':
        return this.firstWriteWins(conflict);

      case 'merge':
        return await this.mergeConflict(conflict);

      case 'custom':
        if (this.conflictResolution.resolver) {
          return this.conflictResolution.resolver(conflict);
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Last-write-wins conflict resolution
   */
  private lastWriteWins(conflict: DataConflict): Record<string, unknown> {
    const sorted = [...conflict.versions].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    return sorted[sorted.length - 1].data;
  }

  /**
   * First-write-wins conflict resolution
   */
  private firstWriteWins(conflict: DataConflict): Record<string, unknown> {
    const sorted = [...conflict.versions].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    return sorted[0].data;
  }

  /**
   * Merge conflict resolution
   */
  private async mergeConflict(conflict: DataConflict): Promise<Record<string, unknown>> {
    const merged: Record<string, unknown> = {};

    for (const version of conflict.versions) {
      for (const [key, value] of Object.entries(version.data)) {
        if (!(key in merged)) {
          merged[key] = value;
        } else {
          // Simple merge strategy: prefer non-null values
          if (value !== null) {
            merged[key] = value;
          }
        }
      }
    }

    return merged;
  }

  /**
   * Apply resolved conflict
   */
  private async applyResolved(
    regionId: string,
    data: Record<string, unknown>,
    env: any
  ): Promise<void> {
    const leader = this.leaders.get(regionId);
    if (!leader) return;

    // Apply merged data
    // In real implementation, would execute UPDATE/INSERT
    await this.delay(10);
  }

  /**
   * Apply log to region
   */
  private async applyLog(regionId: string, log: ReplicationLog, env: any): Promise<void> {
    // In real implementation, would execute query on D1
    await this.delay(10);
  }

  /**
   * Get current data for conflict detection
   */
  private async getCurrentData(
    regionId: string,
    table: string,
    log: ReplicationLog
  ): Promise<Record<string, unknown>> {
    // In real implementation, would query current data
    return { table, region: regionId };
  }

  /**
   * Merge vector clocks
   */
  private mergeVectorClocks(
    target: Map<string, number>,
    source: Map<string, number>
  ): void {
    for (const [key, value] of source) {
      const current = target.get(key) || 0;
      target.set(key, Math.max(current, value));
    }
  }

  /**
   * Extract operation type
   */
  private extractOperation(query: string): string {
    const upper = query.trim().toUpperCase();
    if (upper.startsWith('INSERT')) return 'INSERT';
    if (upper.startsWith('UPDATE')) return 'UPDATE';
    if (upper.startsWith('DELETE')) return 'DELETE';
    return 'DDL';
  }

  /**
   * Extract table name
   */
  private extractTable(query: string): string {
    const match = query.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Extract key from data
   */
  private extractKey(data: Record<string, unknown>): string {
    // In real implementation, would extract primary key
    return data.id as string || 'unknown';
  }

  /**
   * Get all conflict log
   */
  getConflicts(): DataConflict[] {
    return [...this.conflictLog];
  }

  /**
   * Clear conflict log
   */
  clearConflicts(): void {
    this.conflictLog = [];
  }

  /**
   * Get vector clock for region
   */
  getVectorClock(regionId: string): Map<string, number> | undefined {
    return this.leaders.get(regionId)?.vectorClock;
  }

  /**
   * Get leader state
   */
  getLeaderState(regionId: string): LeaderState | undefined {
    return this.leaders.get(regionId);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
