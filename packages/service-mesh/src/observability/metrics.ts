/**
 * Metrics Collection and Aggregation
 * Collects and aggregates service mesh metrics
 */

import {
  ServiceMetrics,
  LatencyMetrics,
  ThroughputMetrics,
  ResourceMetrics,
  CircuitState
} from '../types';

export interface MetricBucket {
  timestamp: number;
  requestCount: number;
  successCount: number;
  errorCount: number;
  latencies: number[];
  circuitState?: CircuitState;
}

export interface MetricRegistry {
  serviceName: string;
  instanceId: string;
  buckets: MetricBucket[];
  aggregated: ServiceMetrics;
  lastUpdated: number;
}

export class MetricsCollector {
  private registries: Map<string, MetricRegistry>;
  private maxBuckets: number;
  private bucketInterval: number;
  private timers: Map<string, NodeJS.Timeout>;

  constructor(maxBuckets: number = 120, bucketInterval: number = 1000) {
    this.registries = new Map();
    this.maxBuckets = maxBuckets;
    this.bucketInterval = bucketInterval;
    this.timers = new Map();
  }

  /**
   * Register a service for metrics collection
   */
  register(serviceName: string, instanceId: string): void {
    const key = this.getRegistryKey(serviceName, instanceId);

    if (this.registries.has(key)) {
      return;
    }

    const registry: MetricRegistry = {
      serviceName,
      instanceId,
      buckets: [],
      aggregated: this.createEmptyMetrics(serviceName, instanceId),
      lastUpdated: Date.now()
    };

    this.registries.set(key, registry);

    // Start periodic aggregation
    this.startAggregation(serviceName, instanceId);
  }

  /**
   * Unregister a service
   */
  unregister(serviceName: string, instanceId: string): void {
    const key = this.getRegistryKey(serviceName, instanceId);

    this.stopAggregation(key);
    this.registries.delete(key);
  }

  /**
   * Record a request
   */
  recordRequest(
    serviceName: string,
    instanceId: string,
    success: boolean,
    latency: number,
    circuitState?: CircuitState
  ): void {
    const registry = this.getRegistry(serviceName, instanceId);

    if (!registry) {
      return;
    }

    const now = Date.now();
    const currentBucket = this.getCurrentBucket(registry);

    currentBucket.requestCount++;
    currentBucket.latencies.push(latency);

    if (success) {
      currentBucket.successCount++;
    } else {
      currentBucket.errorCount++;
    }

    if (circuitState) {
      currentBucket.circuitState = circuitState;
    }

    registry.lastUpdated = now;
  }

  /**
   * Get aggregated metrics for a service
   */
  getMetrics(serviceName: string, instanceId: string): ServiceMetrics | undefined {
    const registry = this.getRegistry(serviceName, instanceId);

    if (!registry) {
      return undefined;
    }

    return { ...registry.aggregated };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): ServiceMetrics[] {
    const metrics: ServiceMetrics[] = [];

    for (const registry of this.registries.values()) {
      metrics.push({ ...registry.aggregated });
    }

    return metrics;
  }

  /**
   * Get metrics summary across all services
   */
  getSummary(): {
    totalServices: number;
    totalRequests: number;
    totalSuccesses: number;
    totalErrors: number;
    averageLatency: number;
    servicesWithOpenCircuits: number;
  } {
    let totalRequests = 0;
    let totalSuccesses = 0;
    let totalErrors = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let servicesWithOpenCircuits = 0;

    for (const registry of this.registries.values()) {
      const aggregated = registry.aggregated;

      totalRequests += aggregated.requestCount;
      totalSuccesses += aggregated.successCount;
      totalErrors += aggregated.errorCount;

      if (aggregated.latency.mean > 0) {
        totalLatency += aggregated.latency.mean;
        latencyCount++;
      }

      if (aggregated.circuitBreakerState === CircuitState.OPEN) {
        servicesWithOpenCircuits++;
      }
    }

    return {
      totalServices: this.registries.size,
      totalRequests,
      totalSuccesses,
      totalErrors,
      averageLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
      servicesWithOpenCircuits
    };
  }

  /**
   * Get metrics for a time range
   */
  getTimeRangeMetrics(
    serviceName: string,
    instanceId: string,
    startTime: number,
    endTime: number
  ): ServiceMetrics | undefined {
    const registry = this.getRegistry(serviceName, instanceId);

    if (!registry) {
      return undefined;
    }

    const filteredBuckets = registry.buckets.filter(
      b => b.timestamp >= startTime && b.timestamp <= endTime
    );

    return this.aggregateBuckets(serviceName, instanceId, filteredBuckets);
  }

  /**
   * Reset metrics for a service
   */
  reset(serviceName: string, instanceId: string): void {
    const registry = this.getRegistry(serviceName, instanceId);

    if (!registry) {
      return;
    }

    registry.buckets = [];
    registry.aggregated = this.createEmptyMetrics(serviceName, instanceId);
    registry.lastUpdated = Date.now();
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    for (const [key] of this.registries) {
      this.stopAggregation(key);
    }

    this.registries.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private getRegistry(serviceName: string, instanceId: string): MetricRegistry | undefined {
    const key = this.getRegistryKey(serviceName, instanceId);
    return this.registries.get(key);
  }

  private getRegistryKey(serviceName: string, instanceId: string): string {
    return `${serviceName}:${instanceId}`;
  }

  private getCurrentBucket(registry: MetricRegistry): MetricBucket {
    const now = Date.now();
    const bucketTime = Math.floor(now / this.bucketInterval) * this.bucketInterval;

    // Find or create current bucket
    let bucket = registry.buckets.find(b => b.timestamp === bucketTime);

    if (!bucket) {
      bucket = {
        timestamp: bucketTime,
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        latencies: []
      };

      registry.buckets.push(bucket);

      // Remove old buckets
      if (registry.buckets.length > this.maxBuckets) {
        registry.buckets.shift();
      }
    }

    return bucket;
  }

  private startAggregation(serviceName: string, instanceId: string): void {
    const key = this.getRegistryKey(serviceName, instanceId);

    const timer = setInterval(() => {
      this.aggregate(serviceName, instanceId);
    }, this.bucketInterval);

    this.timers.set(key, timer);
  }

  private stopAggregation(key: string): void {
    const timer = this.timers.get(key);

    if (timer) {
      clearInterval(timer);
      this.timers.delete(key);
    }
  }

  private aggregate(serviceName: string, instanceId: string): void {
    const registry = this.getRegistry(serviceName, instanceId);

    if (!registry) {
      return;
    }

    registry.aggregated = this.aggregateBuckets(
      serviceName,
      instanceId,
      registry.buckets
    );
  }

  private aggregateBuckets(
    serviceName: string,
    instanceId: string,
    buckets: MetricBucket[]
  ): ServiceMetrics {
    const allLatencies = buckets.flatMap(b => b.latencies).sort((a, b) => a - b);
    const totalRequests = buckets.reduce((sum, b) => sum + b.requestCount, 0);
    const totalSuccesses = buckets.reduce((sum, b) => sum + b.successCount, 0);
    const totalErrors = buckets.reduce((sum, b) => sum + b.errorCount, 0);

    // Get most recent circuit state
    const lastBucketWithState = buckets
      .slice()
      .reverse()
      .find(b => b.circuitState !== undefined);

    return {
      serviceName,
      instanceId,
      timestamp: Date.now(),
      requestCount: totalRequests,
      successCount: totalSuccesses,
      errorCount: totalErrors,
      latency: this.calculateLatencyMetrics(allLatencies),
      throughput: this.calculateThroughputMetrics(buckets),
      resourceUsage: {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        openFiles: 0
      },
      circuitBreakerState: lastBucketWithState?.circuitState
    };
  }

  private calculateLatencyMetrics(latencies: number[]): LatencyMetrics {
    if (latencies.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        p999: 0
      };
    }

    return {
      min: latencies[0],
      max: latencies[latencies.length - 1],
      mean: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      p50: this.percentile(latencies, 50),
      p95: this.percentile(latencies, 95),
      p99: this.percentile(latencies, 99),
      p999: this.percentile(latencies, 99.9)
    };
  }

  private calculateThroughputMetrics(buckets: MetricBucket[]): ThroughputMetrics {
    if (buckets.length === 0) {
      return {
        requestsPerSecond: 0,
        bytesPerSecond: 0
      };
    }

    const timeSpan = buckets.length * this.bucketInterval;
    const totalRequests = buckets.reduce((sum, b) => sum + b.requestCount, 0);

    return {
      requestsPerSecond: (totalRequests / timeSpan) * 1000,
      bytesPerSecond: 0 // TODO: Implement byte tracking
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) {
      return 0;
    }

    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private createEmptyMetrics(serviceName: string, instanceId: string): ServiceMetrics {
    return {
      serviceName,
      instanceId,
      timestamp: Date.now(),
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      latency: {
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        p999: 0
      },
      throughput: {
        requestsPerSecond: 0,
        bytesPerSecond: 0
      },
      resourceUsage: {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        openFiles: 0
      }
    };
  }
}

// ========================================================================
// Metrics Exporter
// ========================================================================

export interface MetricsExporterConfig {
  type: 'prometheus' | 'otlp' | 'statsd' | 'stdout';
  endpoint?: string;
  headers?: Record<string, string>;
  format?: 'text' | 'json';
}

export class MetricsExporter {
  private config: MetricsExporterConfig;
  private collector: MetricsCollector;

  constructor(config: MetricsExporterConfig, collector: MetricsCollector) {
    this.config = config;
    this.collector = collector;
  }

  /**
   * Export metrics
   */
  async export(): Promise<void> {
    const metrics = this.collector.getAllMetrics();

    switch (this.config.type) {
      case 'prometheus':
        await this.exportPrometheus(metrics);
        break;

      case 'otlp':
        await this.exportOTLP(metrics);
        break;

      case 'statsd':
        await this.exportStatsD(metrics);
        break;

      case 'stdout':
        this.exportStdout(metrics);
        break;
    }
  }

  /**
   * Export in Prometheus format
   */
  private async exportPrometheus(metrics: ServiceMetrics[]): Promise<void> {
    const lines: string[] = [];

    for (const metric of metrics) {
      const labels = `service_name="${metric.serviceName}",instance_id="${metric.instanceId}"`;

      lines.push(`# HELP service_request_count Total number of requests`);
      lines.push(`# TYPE service_request_count counter`);
      lines.push(`service_request_count{${labels}} ${metric.requestCount}`);

      lines.push(`# HELP service_success_count Total number of successful requests`);
      lines.push(`# TYPE service_success_count counter`);
      lines.push(`service_success_count{${labels}} ${metric.successCount}`);

      lines.push(`# HELP service_error_count Total number of failed requests`);
      lines.push(`# TYPE service_error_count counter`);
      lines.push(`service_error_count{${labels}} ${metric.errorCount}`);

      lines.push(`# HELP service_latency_seconds Request latency`);
      lines.push(`# TYPE service_latency_seconds gauge`);
      lines.push(`service_latency_seconds{${labels},quantile="0.5"} ${metric.latency.p50 / 1000}`);
      lines.push(`service_latency_seconds{${labels},quantile="0.95"} ${metric.latency.p95 / 1000}`);
      lines.push(`service_latency_seconds{${labels},quantile="0.99"} ${metric.latency.p99 / 1000}`);

      lines.push(`# HELP service_throughput Requests per second`);
      lines.push(`# TYPE service_throughput gauge`);
      lines.push(`service_throughput{${labels}} ${metric.throughput.requestsPerSecond}`);
    }

    const output = lines.join('\n') + '\n';

    if (this.config.endpoint) {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          ...this.config.headers
        },
        body: output
      });
    } else {
      console.log(output);
    }
  }

  /**
   * Export in OTLP format
   */
  private async exportOTLP(metrics: ServiceMetrics[]): Promise<void> {
    const resourceMetrics = {
      resourceMetrics: metrics.map(metric => ({
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: metric.serviceName } },
            { key: 'service.instance.id', value: { stringValue: metric.instanceId } }
          ]
        },
        scopeMetrics: [{
          scope: { name: 'service-mesh' },
          metrics: [
            {
              name: 'service.request.count',
              description: 'Total number of requests',
              unit: '1',
              gauge: { dataPoints: [{ asInt: metric.requestCount }] }
            },
            {
              name: 'service.success.count',
              description: 'Total number of successful requests',
              unit: '1',
              gauge: { dataPoints: [{ asInt: metric.successCount }] }
            },
            {
              name: 'service.error.count',
              description: 'Total number of failed requests',
              unit: '1',
              gauge: { dataPoints: [{ asInt: metric.errorCount }] }
            },
            {
              name: 'service.latency.p95',
              description: '95th percentile latency',
              unit: 'ms',
              gauge: { dataPoints: [{ asDouble: metric.latency.p95 }] }
            },
            {
              name: 'service.throughput',
              description: 'Requests per second',
              unit: '1/s',
              gauge: { dataPoints: [{ asDouble: metric.throughput.requestsPerSecond }] }
            }
          ]
        }]
      }))
    };

    if (this.config.endpoint) {
      await fetch(this.config.endpoint + '/v1/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        body: JSON.stringify(resourceMetrics)
      });
    } else {
      console.log(JSON.stringify(resourceMetrics, null, 2));
    }
  }

  /**
   * Export in StatsD format
   */
  private async exportStatsD(metrics: ServiceMetrics[]): Promise<void> {
    const lines: string[] = [];

    for (const metric of metrics) {
      const baseName = `service_mesh.${metric.serviceName}.${metric.instanceId}`;

      lines.push(`${baseName}.request.count:${metric.requestCount}|c`);
      lines.push(`${baseName}.success.count:${metric.successCount}|c`);
      lines.push(`${baseName}.error.count:${metric.errorCount}|c`);
      lines.push(`${baseName}.latency.p95:${metric.latency.p95}|ms`);
      lines.push(`${baseName}.throughput:${metric.throughput.requestsPerSecond}|g`);
    }

    const output = lines.join('\n') + '\n';

    if (this.config.endpoint) {
      // Send to StatsD server (UDP)
      // Note: In Workers, you'd use a TCP/UDP socket or HTTP proxy
    } else {
      console.log(output);
    }
  }

  /**
   * Export to stdout
   */
  private exportStdout(metrics: ServiceMetrics[]): void {
    console.log(JSON.stringify(metrics, null, 2));
  }
}
