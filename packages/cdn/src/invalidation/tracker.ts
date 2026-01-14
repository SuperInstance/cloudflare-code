/**
 * Purge Tracker
 *
 * Track and monitor purge operations with detailed history.
 */

import { EventEmitter } from 'events';
import type { IPurgeRequest, IPurgeResult, PurgeStatus } from '../types/index.js';

export interface IPurgeHistoryEntry {
  request: IPurgeRequest;
  result?: IPurgeResult;
  timestamp: Date;
}

export class PurgeTracker extends EventEmitter {
  private history: IPurgeHistoryEntry[];
  private activePurges: Map<string, IPurgeRequest>;
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    super();

    this.history = [];
    this.activePurges = new Map();
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Start tracking purge
   */
  public startTracking(request: IPurgeRequest): void {
    this.activePurges.set(request.id, request);

    this.history.push({
      request,
      timestamp: new Date()
    });

    this.emit('purge_start', request);
  }

  /**
   * Complete tracking purge
   */
  public completeTracking(requestId: string, result: IPurgeResult): void {
    const request = this.activePurges.get(requestId);
    if (!request) return;

    // Update history entry
    const entry = this.history.find(h => h.request.id === requestId);
    if (entry) {
      entry.result = result;
    }

    this.activePurges.delete(requestId);

    this.emit('purge_complete', { request, result });
  }

  /**
   * Update purge status
   */
  public updateStatus(requestId: string, status: PurgeStatus, progress: number): void {
    const request = this.activePurges.get(requestId);
    if (!request) return;

    request.status = status;
    request.progress = progress;

    this.emit('purge_update', request);
  }

  /**
   * Get purge history
   */
  public getHistory(limit?: number): IPurgeHistoryEntry[] {
    const history = [...this.history].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get purge by ID
   */
  public getPurge(requestId: string): IPurgeHistoryEntry | null {
    return (
      this.history.find(h => h.request.id === requestId) ??
      this.activePurges.get(requestId)
    ) ?? null;
  }

  /**
   * Get active purges
   */
  public getActivePurges(): IPurgeRequest[] {
    return Array.from(this.activePurges.values());
  }

  /**
   * Get statistics
   */
  public getStatistics(): {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
    avgDuration: number;
    totalPurged: number;
    totalFailed: number;
  } {
    const completed = this.history.filter(h => h.result);
    const failed = completed.filter(h => h.result && !h.result.success);
    const inProgress = this.activePurges.size;

    const durations = completed
      .filter(h => h.result)
      .map(h => h.result!.duration);

    const avgDuration =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

    const totalPurged = completed.reduce(
      (sum, h) => sum + (h.result?.purged ?? 0),
      0
    );

    const totalFailed = completed.reduce(
      (sum, h) => sum + (h.result?.failed ?? 0),
      0
    );

    return {
      total: this.history.length,
      completed: completed.length,
      failed: failed.length,
      inProgress,
      avgDuration,
      totalPurged,
      totalFailed
    };
  }

  /**
   * Clear history
   */
  public clearHistory(): void {
    this.history = [];
    this.emit('history_cleared');
  }

  /**
   * Get recent errors
   */
  public getRecentErrors(limit: number = 10): Array<{
    requestId: string;
    errors: string[];
    timestamp: Date;
  }> {
    return this.history
      .filter(h => h.result && h.result.errors.length > 0)
      .slice(-limit)
      .map(h => ({
        requestId: h.request.id,
        errors: h.result!.errors,
        timestamp: h.timestamp
      }));
  }

  /**
   * Prune old history
   */
  public pruneHistory(maxAge: number): void {
    const cutoff = Date.now() - maxAge;
    this.history = this.history.filter(h => h.timestamp.getTime() > cutoff);

    // Ensure we don't exceed max size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }
}

export default PurgeTracker;
