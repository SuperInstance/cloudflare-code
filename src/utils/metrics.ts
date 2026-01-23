/**
 * Metrics Collection Utility
 * Performance and usage metrics for Cloudflare Workers
 */

export interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: number;
}

export interface HistogramData {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  /**
   * Increment a counter
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.makeKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.makeKey(name, tags);
    this.gauges.set(key, value);
  }

  /**
   * Record a value in a histogram
   */
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.makeKey(name, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }

  /**
   * Time a function execution
   */
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.histogram(name, duration, tags);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.histogram(`${name}.error`, duration, tags);
      throw error;
    }
  }

  /**
   * Get counter value
   */
  getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.makeKey(name, tags);
    return this.counters.get(key) || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, tags?: Record<string, string>): number | undefined {
    const key = this.makeKey(name, tags);
    return this.gauges.get(key);
  }

  /**
   * Get histogram data
   */
  getHistogram(name: string, tags?: Record<string, string>): HistogramData | undefined {
    const key = this.makeKey(name, tags);
    const values = this.histograms.get(key);
    if (!values || values.length === 0) return undefined;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, any> {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Array.from(this.histograms.entries()).reduce((acc, [key, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        acc[key] = {
          count: sorted.length,
          sum: sorted.reduce((a, b) => a + b, 0),
          min: sorted[0],
          max: sorted[sorted.length - 1],
          avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)]
        };
        return acc;
      }, {} as Record<string, HistogramData>)
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Create a key from name and tags
   */
  private makeKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${tagStr}}`;
  }
}

/**
 * Pre-configured metrics for common operations
 */
export class SystemMetrics {
  private static metrics = new MetricsCollector();

  /**
   * Record HTTP request
   */
  static recordRequest(method: string, path: string, status: number, duration: number): void {
    this.metrics.increment('http.requests', 1, { method, path, status: status.toString() });
    this.metrics.histogram('http.request.duration', duration, { method, path });
  }

  /**
   * Record cache hit/miss
   */
  static recordCacheHit(key: string, hit: boolean): void {
    this.metrics.increment('cache.access', 1, { hit: hit.toString() });
  }

  /**
   * Record deployment
   */
  static recordDeployment(success: boolean, duration: number): void {
    this.metrics.increment('deployments.total', 1, { success: success.toString() });
    this.metrics.histogram('deployments.duration', duration);
  }

  /**
   * Record code generation
   */
  static recordCodeGeneration(template: string, duration: number, success: boolean): void {
    this.metrics.increment('codegen.total', 1, { template, success: success.toString() });
    this.metrics.histogram('codegen.duration', duration, { template });
  }

  /**
   * Update gauge for active connections
   */
  static updateActiveConnections(count: number): void {
    this.metrics.gauge('connections.active', count);
  }

  /**
   * Get all metrics
   */
  static getAll() {
    return this.metrics.getAllMetrics();
  }

  /**
   * Reset metrics
   */
  static reset() {
    this.metrics.reset();
  }
}

/**
 * Middleware to collect request metrics
 */
export function metricsMiddleware(metrics: MetricsCollector = SystemMetrics['metrics' as any]) {
  return async (c: any, next: any) => {
    const start = Date.now();

    await next();

    const duration = Date.now() - start;
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const status = c.res.status;

    metrics.increment('http.requests', 1, { method, path, status: status.toString() });
    metrics.histogram('http.request.duration', duration, { method, path });

    // Add metrics header
    c.res.headers.set('X-Response-Time', `${duration}ms`);
  };
}
