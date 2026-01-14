/**
 * Memory profiler for tracking memory usage and allocations
 */

import { MemoryTimelinePoint } from '../types';

export interface MemorySnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface MemoryStatistics {
  min: number;
  max: number;
  avg: number;
  current: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  growthRate: number;
}

export class MemoryProfiler {
  private snapshots: MemorySnapshot[] = [];
  private isProfiling: boolean = false;
  private profilingInterval?: number;
  private startTime: number = 0;

  constructor(private samplingInterval: number = 1000) {}

  /**
   * Start memory profiling
   */
  start(): void {
    if (this.isProfiling) {
      throw new Error('Memory profiling already in progress');
    }

    this.isProfiling = true;
    this.startTime = Date.now();
    this.snapshots = [];

    // Take initial snapshot
    this.takeSnapshot();

    // Start periodic sampling
    this.profilingInterval = window.setInterval(() => {
      this.takeSnapshot();
    }, this.samplingInterval);
  }

  /**
   * Stop memory profiling
   */
  stop(): MemoryTimelinePoint[] {
    if (!this.isProfiling) {
      throw new Error('No memory profiling in progress');
    }

    this.isProfiling = false;

    if (this.profilingInterval !== undefined) {
      clearInterval(this.profilingInterval);
      this.profilingInterval = undefined;
    }

    // Take final snapshot
    this.takeSnapshot();

    return this.getTimeline();
  }

  /**
   * Take a memory snapshot
   */
  private takeSnapshot(): void {
    if (typeof performance === 'undefined' || !(performance as any).memory) {
      console.warn('Memory API not available');
      return;
    }

    const memory = (performance as any).memory;

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };

    this.snapshots.push(snapshot);
  }

  /**
   * Get memory timeline
   */
  getTimeline(): MemoryTimelinePoint[] {
    return this.snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      used: snapshot.usedJSHeapSize,
      total: snapshot.totalJSHeapSize,
      heapUsed: snapshot.usedJSHeapSize,
      heapTotal: snapshot.totalJSHeapSize,
      external: 0, // Not available in browser
    }));
  }

  /**
   * Get memory statistics
   */
  getStatistics(): MemoryStatistics {
    if (this.snapshots.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        current: 0,
        trend: 'stable',
        growthRate: 0,
      };
    }

    const values = this.snapshots.map((s) => s.usedJSHeapSize);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const current = values[values.length - 1];

    // Calculate trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let growthRate = 0;

    if (this.snapshots.length >= 2) {
      const first = this.snapshots[0].usedJSHeapSize;
      const last = this.snapshots[this.snapshots.length - 1].usedJSHeapSize;
      const duration = this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp;

      growthRate = ((last - first) / first) * 100;

      if (growthRate > 5) {
        trend = 'increasing';
      } else if (growthRate < -5) {
        trend = 'decreasing';
      }
    }

    return {
      min,
      max,
      avg,
      current,
      trend,
      growthRate,
    };
  }

  /**
   * Detect memory leaks based on trend
   */
  detectPotentialLeaks(): {
    hasLeak: boolean;
    confidence: 'low' | 'medium' | 'high';
    description: string;
  } {
    const stats = this.getStatistics();

    if (this.snapshots.length < 5) {
      return {
        hasLeak: false,
        confidence: 'low',
        description: 'Not enough data to detect leaks',
      };
    }

    // Check for consistent growth
    const recentSnapshots = this.snapshots.slice(-10);
    let growthCount = 0;

    for (let i = 1; i < recentSnapshots.length; i++) {
      if (recentSnapshots[i].usedJSHeapSize > recentSnapshots[i - 1].usedJSHeapSize) {
        growthCount++;
      }
    }

    const growthRatio = growthCount / (recentSnapshots.length - 1);

    if (growthRatio > 0.8 && stats.growthRate > 20) {
      return {
        hasLeak: true,
        confidence: 'high',
        description: `Memory is consistently increasing by ${stats.growthRate.toFixed(2)}% over the profiling period`,
      };
    } else if (growthRatio > 0.6 && stats.growthRate > 10) {
      return {
        hasLeak: true,
        confidence: 'medium',
        description: `Memory is showing growth trend of ${stats.growthRate.toFixed(2)}%`,
      };
    } else if (growthRatio > 0.5) {
      return {
        hasLeak: true,
        confidence: 'low',
        description: 'Memory shows some growth, but may be normal operation',
      };
    }

    return {
      hasLeak: false,
      confidence: 'low',
      description: 'No significant memory growth detected',
    };
  }

  /**
   * Get memory usage at a specific time
   */
  getMemoryAtTime(timestamp: number): MemorySnapshot | null {
    const closest = this.snapshots.reduce((prev, curr) => {
      return Math.abs(curr.timestamp - timestamp) < Math.abs(prev.timestamp - timestamp)
        ? curr
        : prev;
    }, this.snapshots[0]);

    if (Math.abs(closest.timestamp - timestamp) < this.samplingInterval * 2) {
      return closest;
    }

    return null;
  }

  /**
   * Get peak memory usage
   */
  getPeakMemory(): MemorySnapshot | null {
    if (this.snapshots.length === 0) {
      return null;
    }

    return this.snapshots.reduce((max, curr) =>
      curr.usedJSHeapSize > max.usedJSHeapSize ? curr : max
    );
  }

  /**
   * Clear profiling data
   */
  clear(): void {
    this.snapshots = [];
  }

  /**
   * Get profiling status
   */
  getStatus(): {
    isProfiling: boolean;
    snapshotCount: number;
    duration: number;
  } {
    return {
      isProfiling: this.isProfiling,
      snapshotCount: this.snapshots.length,
      duration: this.isProfiling ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * Export timeline data
   */
  exportTimeline(): string {
    return JSON.stringify({
      format: 'memory-timeline',
      version: '1.0.0',
      startTime: this.startTime,
      endTime: this.snapshots[this.snapshots.length - 1]?.timestamp || Date.now(),
      samplingInterval: this.samplingInterval,
      snapshots: this.snapshots,
      statistics: this.getStatistics(),
    }, null, 2);
  }
}
