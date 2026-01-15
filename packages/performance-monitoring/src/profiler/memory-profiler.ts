/**
 * Memory Profiler for monitoring memory usage patterns
 * Tracks heap usage, memory leaks, and allocation patterns
 */

import { EventEmitter } from 'eventemitter3';
import {
  ProfileSession,
  ProfileType,
  MemoryProfileSample,
  ProfilingOptions
} from '../types';

export class MemoryProfiler {
  private eventEmitter: EventEmitter;
  private sessions: Map<string, ProfileSession>;
  private defaultOptions: ProfilingOptions;
  private baselineMemory: NodeJS.MemoryUsage | null;

  constructor(options: ProfilingOptions = {}) {
    this.eventEmitter = new EventEmitter();
    this.sessions = new Map();
    this.defaultOptions = {
      interval: options.interval || 1000, // 1 second
      duration: options.duration || 60000, // 1 minute
      samplingRate: options.samplingRate || 1,
      maxSamples: options.maxSamples || 100000
    };
    this.baselineMemory = null;
  }

  /**
   * Set baseline memory usage
   */
  setBaseline(): void {
    this.baselineMemory = process.memoryUsage();
    this.eventEmitter.emit('baseline:set', {
      heapUsed: this.baselineMemory.heapUsed,
      heapTotal: this.baselineMemory.heapTotal,
      external: this.baselineMemory.external,
      arrayBuffers: this.baselineMemory.arrayBuffers
    });
  }

  /**
   * Get current memory usage
   */
  getCurrentUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Get memory usage delta from baseline
   */
  getDeltaFromBaseline(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  } | null {
    if (!this.baselineMemory) {
      return null;
    }

    const current = this.getCurrentUsage();

    return {
      heapUsed: current.heapUsed - this.baselineMemory.heapUsed,
      heapTotal: current.heapTotal - this.baselineMemory.heapTotal,
      external: current.external - this.baselineMemory.external,
      arrayBuffers: current.arrayBuffers - this.baselineMemory.arrayBuffers
    };
  }

  /**
   * Start a memory profiling session
   */
  start(sessionId?: string): string {
    const id = sessionId || this.generateSessionId();
    const now = Date.now();

    if (this.sessions.has(id)) {
      throw new Error(`Profile session ${id} already exists`);
    }

    if (!this.baselineMemory) {
      this.setBaseline();
    }

    const session: ProfileSession = {
      id,
      type: 'memory',
      startTime: now,
      status: 'running',
      samples: [],
      metadata: {
        interval: this.defaultOptions.interval,
        samplingRate: this.defaultOptions.samplingRate,
        baseline: this.baselineMemory
      }
    };

    this.sessions.set(id, session);

    // Start collecting samples
    this.collectSamples(id);

    this.eventEmitter.emit('profile:started', { id, type: 'memory', timestamp: now });

    return id;
  }

  /**
   * Stop a memory profiling session
   */
  stop(sessionId: string): ProfileSession {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Profile session ${sessionId} not found`);
    }

    if (session.status !== 'running') {
      throw new Error(`Profile session ${sessionId} is not running`);
    }

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.status = 'completed';

    // Add final sample
    this.addSample(session);

    this.eventEmitter.emit('profile:stopped', {
      id: sessionId,
      type: 'memory',
      duration: session.duration
    });

    return session;
  }

  /**
   * Collect memory samples
   */
  private collectSamples(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      return;
    }

    this.addSample(session);

    // Check if we've reached max samples or duration
    if (session.samples.length >= this.defaultOptions.maxSamples) {
      this.stop(sessionId);
      return;
    }

    const elapsed = Date.now() - session.startTime;
    if (elapsed >= this.defaultOptions.duration!) {
      this.stop(sessionId);
      return;
    }

    // Schedule next collection
    setTimeout(() => this.collectSamples(sessionId), this.defaultOptions.interval);
  }

  /**
   * Add a memory sample to the session
   */
  private addSample(session: ProfileSession): void {
    const usage = process.memoryUsage();

    const sample: MemoryProfileSample = {
      timestamp: Date.now(),
      data: {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers
      }
    };

    session.samples.push(sample);
  }

  /**
   * Get memory statistics for a session
   */
  getStatistics(sessionId: string): {
    min: MemoryProfileSample['data'];
    max: MemoryProfileSample['data'];
    avg: MemoryProfileSample['data'];
    current: MemoryProfileSample['data'];
    growth: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.samples.length === 0) {
      return null;
    }

    const samples = session.samples as MemoryProfileSample[];

    const stats = {
      min: {
        heapUsed: Infinity,
        heapTotal: Infinity,
        external: Infinity,
        arrayBuffers: Infinity
      },
      max: {
        heapUsed: -Infinity,
        heapTotal: -Infinity,
        external: -Infinity,
        arrayBuffers: -Infinity
      },
      avg: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0
      },
      current: samples[samples.length - 1].data,
      growth: 0
    };

    for (const sample of samples) {
      stats.min.heapUsed = Math.min(stats.min.heapUsed, sample.data.heapUsed);
      stats.min.heapTotal = Math.min(stats.min.heapTotal, sample.data.heapTotal);
      stats.min.external = Math.min(stats.min.external, sample.data.external);
      stats.min.arrayBuffers = Math.min(stats.min.arrayBuffers, sample.data.arrayBuffers);

      stats.max.heapUsed = Math.max(stats.max.heapUsed, sample.data.heapUsed);
      stats.max.heapTotal = Math.max(stats.max.heapTotal, sample.data.heapTotal);
      stats.max.external = Math.max(stats.max.external, sample.data.external);
      stats.max.arrayBuffers = Math.max(stats.max.arrayBuffers, sample.data.arrayBuffers);

      stats.avg.heapUsed += sample.data.heapUsed;
      stats.avg.heapTotal += sample.data.heapTotal;
      stats.avg.external += sample.data.external;
      stats.avg.arrayBuffers += sample.data.arrayBuffers;
    }

    const count = samples.length;
    stats.avg.heapUsed /= count;
    stats.avg.heapTotal /= count;
    stats.avg.external /= count;
    stats.avg.arrayBuffers /= count;

    stats.growth = stats.current.heapUsed - samples[0].data.heapUsed;

    return stats;
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(sessionId: string): {
    hasLeak: boolean;
    confidence: number;
    growthRate: number;
    description: string;
  } {
    const stats = this.getStatistics(sessionId);

    if (!stats) {
      return {
        hasLeak: false,
        confidence: 0,
        growthRate: 0,
        description: 'Insufficient data to detect memory leaks'
      };
    }

    const growth = stats.growth;
    const duration = this.sessions.get(sessionId)!.duration || 1;
    const growthRate = growth / duration; // bytes per ms

    // Simple heuristic: if heap grows consistently and significantly
    const avgHeap = stats.avg.heapUsed;
    const relativeGrowth = Math.abs(growth) / avgHeap;

    let hasLeak = false;
    let confidence = 0;

    if (growthRate > 100 && relativeGrowth > 0.1) {
      hasLeak = true;
      confidence = Math.min(100, relativeGrowth * 100);
    }

    return {
      hasLeak,
      confidence,
      growthRate: growthRate * 1000, // bytes per second
      description: hasLeak
        ? `Potential memory leak detected. Heap grew by ${this.formatBytes(growth)} over ${this.formatDuration(duration)}`
        : 'No significant memory leak detected'
    };
  }

  /**
   * Get heap snapshot (if available)
   */
  getHeapSnapshot(): any {
    try {
      const v8 = require('v8');
      return v8.writeHeapSnapshot();
    } catch (error) {
      console.error('Failed to get heap snapshot:', error);
      return null;
    }
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): boolean {
    try {
      if (global.gc) {
        global.gc();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to force GC:', error);
      return false;
    }
  }

  /**
   * Get a profile session
   */
  getSession(sessionId: string): ProfileSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ProfileSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.eventEmitter.emit('session:deleted', { id: sessionId });
    }
    return deleted;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const abs = Math.abs(bytes);
    if (abs < 1024) return `${bytes.toFixed(2)} B`;
    if (abs < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (abs < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Format duration to human readable
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Clean up all sessions
   */
  cleanup(): void {
    for (const sessionId of this.sessions.keys()) {
      if (this.sessions.get(sessionId)?.status === 'running') {
        try {
          this.stop(sessionId);
        } catch {
          // Ignore errors during cleanup
        }
      }
    }

    this.sessions.clear();
  }
}
