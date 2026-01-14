/**
 * Metrics Collector
 * Collects metrics from various sources and aggregates them
 */

import { MetricData, TimeSeriesData } from '../types/index.js';

export interface MetricSource {
  name: string;
  collect(): Promise<MetricData[]>;
  isEnabled(): boolean;
}

export class MetricsCollector {
  private sources: Map<string, MetricSource> = new Map();
  private buffers: Map<string, MetricData[]> = new Map();
  private maxBufferSize: number;
  private flushInterval: number;
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(
    maxBufferSize: number = 1000,
    flushInterval: number = 60000 // 1 minute
  ) {
    this.maxBufferSize = maxBufferSize;
    this.flushInterval = flushInterval;
  }

  /**
   * Register a metric source
   */
  registerSource(source: MetricSource): void {
    this.sources.set(source.name, source);
    this.buffers.set(source.name, []);
  }

  /**
   * Unregister a metric source
   */
  unregisterSource(sourceName: string): void {
    this.sources.delete(sourceName);
    this.buffers.delete(sourceName);
  }

  /**
   * Start collecting metrics
   */
  async start(): Promise<void> {
    // Start periodic collection
    this.flushTimer = setInterval(async () => {
      await this.collectFromAllSources();
    }, this.flushInterval);

    // Initial collection
    await this.collectFromAllSources();
  }

  /**
   * Stop collecting metrics
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush remaining buffers
    await this.flushAllBuffers();
  }

  /**
   * Manually collect from all sources
   */
  async collectFromAllSources(): Promise<void> {
    const promises = Array.from(this.sources.values())
      .filter(source => source.isEnabled())
      .map(source => this.collectFromSource(source));

    await Promise.all(promises);
  }

  /**
   * Collect metrics from a specific source
   */
  async collectFromSource(source: MetricSource): Promise<MetricData[]> {
    try {
      const metrics = await source.collect();
      await this.addMetrics(source.name, metrics);
      return metrics;
    } catch (error) {
      console.error(`Failed to collect from ${source.name}:`, error);
      return [];
    }
  }

  /**
   * Get collected metrics
   */
  async getMetrics(sourceName?: string): Promise<MetricData[]> {
    if (sourceName) {
      return this.buffers.get(sourceName) || [];
    }

    const allMetrics: MetricData[] = [];
    for (const buffer of this.buffers.values()) {
      allMetrics.push(...buffer);
    }
    return allMetrics;
  }

  /**
   * Flush metrics buffer
   */
  async flushBuffer(sourceName: string): Promise<void> {
    const buffer = this.buffers.get(sourceName);
    if (!buffer) return;

    // Send to storage/analytics backend
    await this.persistMetrics(buffer);

    // Clear buffer
    this.buffers.set(sourceName, []);
  }

  /**
   * Flush all buffers
   */
  async flushAllBuffers(): Promise<void> {
    for (const sourceName of this.buffers.keys()) {
      await this.flushBuffer(sourceName);
    }
  }

  /**
   * Get buffer sizes
   */
  getBufferSizes(): Record<string, number> {
    const sizes: Record<string, number> = {};
    for (const [name, buffer] of this.buffers.entries()) {
      sizes[name] = buffer.length;
    }
    return sizes;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async addMetrics(sourceName: string, metrics: MetricData[]): Promise<void> {
    const buffer = this.buffers.get(sourceName);
    if (!buffer) return;

    buffer.push(...metrics);

    // Auto-flush if buffer is too large
    if (buffer.length >= this.maxBufferSize) {
      await this.flushBuffer(sourceName);
    }
  }

  private async persistMetrics(metrics: MetricData[]): Promise<void> {
    // Implement persistence to storage backend
    // This would write to KV, R2, or other storage
    console.debug(`Persisting ${metrics.length} metrics`);
  }
}

// ============================================================================
// Built-in Metric Sources
// ============================================================================

export class WorkerMetricsSource implements MetricSource {
  name = 'worker';

  isEnabled(): boolean {
    return true;
  }

  async collect(): Promise<MetricData[]> {
    const now = Date.now();
    const metrics: MetricData[] = [];

    // Collect CPU usage (simulated)
    metrics.push({
      name: 'cpu_usage',
      value: await this.getCpuUsage(),
      timestamp: now,
      tags: { source: 'worker' },
    });

    // Collect memory usage
    metrics.push({
      name: 'memory_usage',
      value: this.getMemoryUsage(),
      timestamp: now,
      tags: { source: 'worker' },
    });

    return metrics;
  }

  private async getCpuUsage(): Promise<number> {
    // Simulate CPU usage measurement
    return Math.random() * 100;
  }

  private getMemoryUsage(): number {
    // Get memory usage from environment
    // @ts-ignore
    if (typeof performance !== 'undefined' && performance.memory) {
      // @ts-ignore
      return (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
    }
    return Math.random() * 100;
  }
}

export class RequestMetricsSource implements MetricSource {
  name = 'requests';
  private requestCount = 0;
  private responseTimes: number[] = [];
  private errorCount = 0;

  isEnabled(): boolean {
    return true;
  }

  async collect(): Promise<MetricData[]> {
    const now = Date.now();
    const metrics: MetricData[] = [];

    // Request count
    metrics.push({
      name: 'request_count',
      value: this.requestCount,
      timestamp: now,
      tags: { source: 'requests' },
    });

    // Response time metrics
    if (this.responseTimes.length > 0) {
      const avgResponseTime =
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
      metrics.push({
        name: 'response_time',
        value: avgResponseTime,
        timestamp: now,
        tags: { source: 'requests' },
      });

      this.responseTimes = [];
    }

    // Error count
    metrics.push({
      name: 'error_total',
      value: this.errorCount,
      timestamp: now,
      tags: { source: 'requests' },
    });

    // Reset counters
    this.requestCount = 0;
    this.errorCount = 0;

    return metrics;
  }

  recordRequest(responseTime: number, isError: boolean = false): void {
    this.requestCount++;
    this.responseTimes.push(responseTime);
    if (isError) {
      this.errorCount++;
    }
  }
}

export class CustomMetricsSource implements MetricSource {
  name: string;
  private metrics: Map<string, CustomMetric> = new Map();
  private enabled: boolean;

  constructor(name: string, enabled: boolean = true) {
    this.name = name;
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async collect(): Promise<MetricData[]> {
    const now = Date.now();
    const metrics: MetricData[] = [];

    for (const [name, metric] of this.metrics.entries()) {
      metrics.push({
        name,
        value: metric.value,
        timestamp: now,
        tags: metric.tags || {},
        metadata: metric.metadata,
      });
    }

    return metrics;
  }

  setMetric(name: string, value: number, tags?: Record<string, string>, metadata?: Record<string, any>): void {
    this.metrics.set(name, { name, value, tags, metadata });
  }

  incrementMetric(name: string, delta: number = 1, tags?: Record<string, string>): void {
    const existing = this.metrics.get(name);
    const value = existing ? existing.value + delta : delta;
    this.setMetric(name, value, tags);
  }

  clear(): void {
    this.metrics.clear();
  }
}

interface CustomMetric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

// ============================================================================
// Middleware for Request Tracking
// ============================================================================

export class MetricsMiddleware {
  private requestSource: RequestMetricsSource;

  constructor(requestSource: RequestMetricsSource) {
    this.requestSource = requestSource;
  }

  /**
   * Create middleware for request tracking
   */
  middleware(): {
    fetch: (request: Request, env: any) => Promise<Response>;
  } {
    return {
      fetch: async (request: Request, env: any): Promise<Response> => {
        const startTime = Date.now();
        let isError = false;

        try {
          const response = await env.fetch(request);
          isError = !response.ok;
          return response;
        } catch (error) {
          isError = true;
          throw error;
        } finally {
          const responseTime = Date.now() - startTime;
          this.requestSource.recordRequest(responseTime, isError);
        }
      },
    };
  }
}

// ============================================================================
// Aggregated Metrics
// ============================================================================

export class MetricsAggregator {
  /**
   * Aggregate metrics by time window
   */
  static aggregateByTimeWindow(
    metrics: MetricData[],
    windowSize: number
  ): Map<number, MetricData[]> {
    const windows = new Map<number, MetricData[]>();

    for (const metric of metrics) {
      const windowStart = Math.floor(metric.timestamp / windowSize) * windowSize;

      if (!windows.has(windowStart)) {
        windows.set(windowStart, []);
      }

      windows.get(windowStart)!.push(metric);
    }

    return windows;
  }

  /**
   * Aggregate metrics by tags
   */
  static aggregateByTags(
    metrics: MetricData[],
    tagKeys: string[]
  ): Map<string, MetricData[]> {
    const groups = new Map<string, MetricData[]>();

    for (const metric of metrics) {
      const key = tagKeys
        .map(k => metric.tags[k] || 'default')
        .join(':');

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(metric);
    }

    return groups;
  }

  /**
   * Calculate statistics for metric group
   */
  static calculateStatistics(metrics: MetricData[]): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    variance: number;
    stdDev: number;
  } {
    if (metrics.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0, variance: 0, stdDev: 0 };
    }

    const values = metrics.map(m => m.value);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return { count, sum, avg, min, max, variance, stdDev };
  }

  /**
   * Get percentiles from metric values
   */
  static getPercentiles(metrics: MetricData[], percentiles: number[]): Record<number, number> {
    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const results: Record<number, number> = {};

    for (const p of percentiles) {
      const index = Math.floor((p / 100) * values.length);
      results[p] = values[index] || 0;
    }

    return results;
  }

  /**
   * Calculate rate (per second)
   */
  static calculateRate(metrics: MetricData[], timeWindow: number): number {
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / (timeWindow / 1000);
  }
}
