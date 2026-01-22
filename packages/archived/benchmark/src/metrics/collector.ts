// @ts-nocheck
/**
 * Metrics Collector
 * Comprehensive performance metrics collection system
 */

import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import pidusage from 'pidusage';
import os from 'os';
import type {
  CollectedMetrics,
  MemoryMetrics,
  CpuMetrics,
  IOMetrics,
  GCMetrics,
  EventLoopMetrics
} from '../types/index.js';

/**
 * Metrics collection configuration
 */
export interface MetricsCollectionConfig {
  /** Whether to collect memory metrics */
  memory: boolean;
  /** Whether to collect CPU metrics */
  cpu: boolean;
  /** Whether to collect I/O metrics */
  io: boolean;
  /** Whether to collect GC metrics */
  gc: boolean;
  /** Whether to collect event loop metrics */
  eventLoop: boolean;
  /** Collection interval in milliseconds */
  interval: number;
  /** Maximum number of samples to keep */
  maxSamples: number;
}

/**
 * Metrics collector for tracking performance during execution
 */
export class MetricsCollector {
  private config: MetricsCollectionConfig;
  private samples: Map<string, number[]> = new Map();
  private startTime: number = 0;
  private endTime: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private pid: number;
  private gcStats: any = null;
  private originalGc: any = null;

  constructor(config?: Partial<MetricsCollectionConfig>) {
    this.config = {
      memory: true,
      cpu: true,
      io: false,
      gc: true,
      eventLoop: true,
      interval: 100,
      maxSamples: 10000,
      ...config
    };
    this.pid = process.pid;
    this.initializeGCMonitoring();
  }

  /**
   * Initialize GC monitoring
   */
  private initializeGCMonitoring(): void {
    // Try to get GC stats if available
    try {
      // @ts-ignore - optional dependency
      if (require && require('gc-stats')) {
        // @ts-ignore
        this.gcStats = require('gc-stats')();
        this.gcStats.on('stats', (stats: any) => {
          this.recordGcEvent(stats);
        });
      }
    } catch (e) {
      // gc-stats not available, will use basic GC tracking
    }
  }

  /**
   * Record GC event
   */
  private recordGcEvent(stats: any): void {
    if (!this.samples.has('gc-time')) {
      this.samples.set('gc-time', []);
    }
    if (!this.samples.has('gc-count')) {
      this.samples.set('gc-count', []);
    }

    const gcTimes = this.samples.get('gc-time')!;
    const gcCounts = this.samples.get('gc-count')!];

    gcTimes.push(stats.pause * 1000000); // Convert to nanoseconds
    gcCounts.push(1);

    // Limit sample size
    if (gcTimes.length > this.config.maxSamples) {
      gcTimes.shift();
      gcCounts.shift();
    }
  }

  /**
   * Start collecting metrics
   */
  start(): void {
    this.startTime = performance.now();
    this.clearSamples();

    if (this.config.interval > 0) {
      this.intervalId = setInterval(() => {
        this.collectSample();
      }, this.config.interval);
    }

    // Force initial collection
    this.collectSample();
  }

  /**
   * Stop collecting metrics
   */
  stop(): void {
    this.endTime = performance.now();

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Collect final sample
    this.collectSample();
  }

  /**
   * Clear all collected samples
   */
  private clearSamples(): void {
    this.samples.clear();
  }

  /**
   * Collect a single sample of all metrics
   */
  private collectSample(): void {
    if (this.config.memory) {
      this.collectMemoryMetrics();
    }

    if (this.config.cpu) {
      this.collectCpuMetrics();
    }

    if (this.config.eventLoop) {
      this.collectEventLoopMetrics();
    }
  }

  /**
   * Collect memory metrics
   */
  private collectMemoryMetrics(): void {
    const memoryUsage = process.memoryUsage();

    this.addSample('memory-heap-used', memoryUsage.heapUsed);
    this.addSample('memory-heap-total', memoryUsage.heapTotal);
    this.addSample('memory-external', memoryUsage.external);
    this.addSample('memory-array-buffers', memoryUsage.arrayBuffers);
    this.addSample('memory-rss', memoryUsage.rss);
  }

  /**
   * Collect CPU metrics
   */
  private collectCpuMetrics(): void {
    pidusage.stat(this.pid, (err, stats) => {
      if (err) return;

      this.addSample('cpu-percent', stats.cpu);
      this.addSample('cpu-user', stats.cuser * 1000); // Convert to microseconds
      this.addSample('cpu-system', stats.csystem * 1000);
    });
  }

  /**
   * Collect event loop metrics
   */
  private collectEventLoopMetrics(): void {
    const start = performance.now();
    setImmediate(() => {
      const lag = performance.now() - start;
      this.addSample('event-loop-lag', lag * 1000000); // Convert to nanoseconds
    });
  }

  /**
   * Add a sample for a specific metric
   */
  private addSample(name: string, value: number): void {
    if (!this.samples.has(name)) {
      this.samples.set(name, []);
    }

    const samples = this.samples.get(name)!;
    samples.push(value);

    // Limit sample size
    if (samples.length > this.config.maxSamples) {
      samples.shift();
    }
  }

  /**
   * Get all collected metrics
   */
  async getMetrics(): Promise<CollectedMetrics> {
    return {
      memory: this.getMemoryMetrics(),
      cpu: await this.getCpuMetrics(),
      io: this.getIOMetrics(),
      gc: this.getGCMetrics(),
      eventLoop: this.getEventLoopMetrics(),
      startTime: this.startTime,
      endTime: this.endTime
    };
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics(): MemoryMetrics {
    const heapUsed = this.samples.get('memory-heap-used') || [];
    const heapTotal = this.samples.get('memory-heap-total') || [];
    const external = this.samples.get('memory-external') || [];
    const arrayBuffers = this.samples.get('memory-array-buffers') || [];
    const rss = this.samples.get('memory-rss') || [];

    return {
      heapUsed: this.average(heapUsed),
      heapTotal: this.average(heapTotal),
      external: this.average(external),
      arrayBuffers: this.average(arrayBuffers),
      rss: this.average(rss),
      peakHeapUsed: heapUsed.length > 0 ? Math.max(...heapUsed) : 0,
      growth: heapUsed.length >= 2 ? heapUsed[heapUsed.length - 1] - heapUsed[0] : 0
    };
  }

  /**
   * Get CPU metrics
   */
  private async getCpuMetrics(): Promise<CpuMetrics> {
    const percent = this.samples.get('cpu-percent') || [];
    const user = this.samples.get('cpu-user') || [];
    const system = this.samples.get('cpu-system') || [];

    return {
      user: this.sum(user),
      system: this.sum(system),
      percent: this.average(percent),
      cores: os.cpus().length
    };
  }

  /**
   * Get I/O metrics
   */
  private getIOMetrics(): IOMetrics {
    // Basic implementation - could be enhanced with more detailed tracking
    return {
      reads: 0,
      writes: 0,
      bytesWritten: 0,
      bytesRead: 0,
      networkRequests: 0
    };
  }

  /**
   * Get GC metrics
   */
  private getGCMetrics(): GCMetrics {
    const gcTimes = this.samples.get('gc-time') || [];
    const gcCounts = this.samples.get('gc-count') || [];

    return {
      collections: this.sum(gcCounts),
      time: this.sum(gcTimes),
      scavenge: 0, // Would need more detailed GC tracking
      markSweepCompact: 0,
      incrementalMarking: 0
    };
  }

  /**
   * Get event loop metrics
   */
  private getEventLoopMetrics(): EventLoopMetrics {
    const lags = this.samples.get('event-loop-lag') || [];

    if (lags.length === 0) {
      return {
        avgLag: 0,
        maxLag: 0,
        minLag: 0,
        percentiles: {}
      };
    }

    const sortedLags = [...lags].sort((a, b) => a - b);

    return {
      avgLag: this.average(lags) / 1000000, // Convert to milliseconds
      maxLag: Math.max(...lags) / 1000000,
      minLag: Math.min(...lags) / 1000000,
      percentiles: {
        50: this.percentile(sortedLags, 50) / 1000000,
        95: this.percentile(sortedLags, 95) / 1000000,
        99: this.percentile(sortedLags, 99) / 1000000
      }
    };
  }

  /**
   * Calculate average of an array
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate sum of an array
   */
  private sum(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0);
  }

  /**
   * Calculate percentile of an array
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = (p / 100) * (values.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const lowerValue = values[lowerIndex];
    const upperValue = values[upperIndex];
    const weight = index - lowerIndex;
    return lowerValue + weight * (upperValue - lowerValue);
  }

  /**
   * Get raw samples for a specific metric
   */
  getSamples(name: string): number[] {
    return this.samples.get(name) || [];
  }

  /**
   * Get all sample names
   */
  getSampleNames(): string[] {
    return Array.from(this.samples.keys());
  }

  /**
   * Reset the collector
   */
  reset(): void {
    this.stop();
    this.clearSamples();
    this.startTime = 0;
    this.endTime = 0;
  }
}

/**
 * Convenience function to collect metrics during a function execution
 */
export async function collectMetricsDuring<T>(
  fn: () => Promise<T>,
  config?: Partial<MetricsCollectionConfig>
): Promise<{ result: T; metrics: CollectedMetrics }> {
  const collector = new MetricsCollector(config);
  collector.start();

  try {
    const result = await fn();
    return { result, metrics: await collector.getMetrics() };
  } finally {
    collector.stop();
  }
}

/**
 * Create a snapshot of current metrics
 */
export function snapshotMetrics(): {
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  timestamp: number;
} {
  return {
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: performance.now()
  };
}

/**
 * Calculate metrics delta between two snapshots
 */
export function calculateMetricsDelta(
  start: ReturnType<typeof snapshotMetrics>,
  end: ReturnType<typeof snapshotMetrics>
): {
  memory: {
    heapUsedDelta: number;
    heapTotalDelta: number;
    externalDelta: number;
    arrayBuffersDelta: number;
    rssDelta: number;
  };
  cpu: {
    userDelta: number;
    systemDelta: number;
    totalDelta: number;
  };
  duration: number;
} {
  return {
    memory: {
      heapUsedDelta: end.memory.heapUsed - start.memory.heapUsed,
      heapTotalDelta: end.memory.heapTotal - start.memory.heapTotal,
      externalDelta: end.memory.external - start.memory.external,
      arrayBuffersDelta: end.memory.arrayBuffers - start.memory.arrayBuffers,
      rssDelta: end.memory.rss - start.memory.rss
    },
    cpu: {
      userDelta: end.cpu.user - start.cpu.user,
      systemDelta: end.cpu.system - start.cpu.system,
      totalDelta: (end.cpu.user - start.cpu.user) + (end.cpu.system - start.cpu.system)
    },
    duration: end.timestamp - start.timestamp
  };
}
