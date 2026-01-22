// @ts-nocheck
import { EventEmitter } from 'events';
import { MetricData } from '../types';
import { Logger } from '../utils/logger';
import * as client from 'prom-client';

export class MetricsCollector extends EventEmitter {
  private logger: Logger;
  private registry: client.Registry;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private customMetrics: Map<string, client.Metric<any>> = new Map();

  constructor() {
    super();
    this.logger = new Logger('MetricsCollector');
    this.registry = new client.Registry();

    // Set default metrics
    client.collectDefaultMetrics({
      register: this.registry,
      prefix: 'claudeflare_'
    });

    // Register custom metrics
    this.registerCustomMetrics();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Metrics Collector is already running');
    }

    this.logger.info('Starting Metrics Collector...');

    try {
      // Start periodic collection
      this.startPeriodicCollection();

      this.isRunning = true;
      this.logger.info('Metrics Collector started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start Metrics Collector', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Metrics Collector...');

    try {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      this.isRunning = false;
      this.logger.info('Metrics Collector stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error during Metrics Collector shutdown', { error });
      throw error;
    }
  }

  private startPeriodicCollection(): void {
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, 10000); // Every 10 seconds
  }

  private collectMetrics(): void {
    try {
      // Collect system metrics
      const systemMetrics = this.collectSystemMetrics();

      // Collect service metrics
      const serviceMetrics = this.collectServiceMetrics();

      // Emit metrics
      for (const metric of [...systemMetrics, ...serviceMetrics]) {
        this.emit('metric', metric);
      }
    } catch (error) {
      this.logger.error('Failed to collect metrics', { error });
    }
  }

  private collectSystemMetrics(): MetricData[] {
    const metrics: MetricData[] = [];
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    metrics.push({
      timestamp: new Date(),
      service: 'system',
      metric: 'memory_usage_heap_used',
      value: memoryUsage.heapUsed,
      tags: { type: 'heap', unit: 'bytes' }
    });

    metrics.push({
      timestamp: new Date(),
      service: 'system',
      metric: 'memory_usage_heap_total',
      value: memoryUsage.heapTotal,
      tags: { type: 'heap', unit: 'bytes' }
    });

    metrics.push({
      timestamp: new Date(),
      service: 'system',
      metric: 'memory_usage_external',
      value: memoryUsage.external,
      tags: { type: 'external', unit: 'bytes' }
    });

    metrics.push({
      timestamp: new Date(),
      service: 'system',
      metric: 'cpu_usage_user',
      value: cpuUsage.user,
      tags: { type: 'user', unit: 'microseconds' }
    });

    metrics.push({
      timestamp: new Date(),
      service: 'system',
      metric: 'cpu_usage_system',
      value: cpuUsage.system,
      tags: { type: 'system', unit: 'microseconds' }
    });

    metrics.push({
      timestamp: new Date(),
      service: 'system',
      metric: 'uptime',
      value: process.uptime(),
      tags: { unit: 'seconds' }
    });

    return metrics;
  }

  private collectServiceMetrics(): MetricData[] {
    const metrics: MetricData[] = [];

    // Get all registered services and their metrics
    // This would typically come from service discovery
    const services = ['service1', 'service2', 'service3'];

    for (const service of services) {
      // Simulate service metrics
      const requests = Math.floor(Math.random() * 1000);
      const errors = Math.floor(Math.random() * 10);
      const responseTime = Math.random() * 1000;
      const activeConnections = Math.floor(Math.random() * 100);

      metrics.push({
        timestamp: new Date(),
        service,
        metric: 'http_requests_total',
        value: requests,
        tags: { method: 'all', status: 'all' }
      });

      metrics.push({
        timestamp: new Date(),
        service,
        metric: 'http_errors_total',
        value: errors,
        tags: { status: '5xx' }
      });

      metrics.push({
        timestamp: new Date(),
        service,
        metric: 'http_response_time_seconds',
        value: responseTime / 1000,
        tags: { quantile: '0.5' }
      });

      metrics.push({
        timestamp: new Date(),
        service,
        metric: 'active_connections',
        value: activeConnections,
        tags: {}
      });
    }

    return metrics;
  }

  registerCustomMetric(name: string, type: 'counter' | 'gauge' | 'histogram', help: string, labelNames?: string[]): void {
    let metric: client.Metric<any>;

    switch (type) {
      case 'counter':
        metric = new client.Counter({
          name,
          help,
          labelNames: labelNames || [],
          registers: [this.registry]
        });
        break;
      case 'gauge':
        metric = new client.Gauge({
          name,
          help,
          labelNames: labelNames || [],
          registers: [this.registry]
        });
        break;
      case 'histogram':
        metric = new client.Histogram({
          name,
          help,
          labelNames: labelNames || [],
          registers: [this.registry]
        });
        break;
    }

    this.customMetrics.set(name, metric);
    this.logger.debug(`Registered custom metric: ${name}`, { type, help });
  }

  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const metric = this.customMetrics.get(name);
    if (metric && metric instanceof client.Counter) {
      metric.inc(labels, value);
    }
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.customMetrics.get(name);
    if (metric && metric instanceof client.Gauge) {
      metric.set(labels, value);
    }
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.customMetrics.get(name);
    if (metric && metric instanceof client.Histogram) {
      metric.observe(labels, value);
    }
  }

  async getServiceMetrics(serviceName: string): Promise<any> {
    // In a real implementation, this would query the metrics database
    return {
      service: serviceName,
      metrics: {
        requestRate: Math.random() * 100,
        errorRate: Math.random() * 10,
        avgResponseTime: Math.random() * 1000,
        p95ResponseTime: Math.random() * 2000,
        throughput: Math.random() * 1000,
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100
      },
      timestamp: new Date()
    };
  }

  async getAllMetrics(): Promise<any> {
    return {
      registry: await this.registry.metrics(),
      customMetrics: Array.from(this.customMetrics.keys()),
      timestamp: new Date()
    };
  }

  async getMetricsAsPrometheusFormat(): Promise<string> {
    return await this.registry.metrics();
  }

  getRegistry(): client.Registry {
    return this.registry;
  }
}

export class TraceCollector extends EventEmitter {
  private logger: Logger;
  private traces: Map<string, any[]> = new Map();
  private isRunning = false;
  private samplingRate: number = 0.1;

  constructor(samplingRate: number = 0.1) {
    super();
    this.logger = new Logger('TraceCollector');
    this.samplingRate = samplingRate;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Trace Collector is already running');
    }

    this.logger.info('Starting Trace Collector...');

    try {
      this.isRunning = true;
      this.logger.info('Trace Collector started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start Trace Collector', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Trace Collector...');

    try {
      this.isRunning = false;
      this.logger.info('Trace Collector stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error during Trace Collector shutdown', { error });
      throw error;
    }
  }

  shouldSample(): boolean {
    return Math.random() < this.samplingRate;
  }

  recordTrace(trace: any): void {
    if (!this.shouldSample()) {
      return;
    }

    if (!this.traces.has(trace.traceId)) {
      this.traces.set(trace.traceId, []);
    }

    const traceSpans = this.traces.get(trace.traceId)!;
    traceSpans.push(trace);

    // Keep only recent traces
    if (this.traces.size > 1000) {
      const oldestKey = this.traces.keys().next().value;
      this.traces.delete(oldestKey);
    }

    this.emit('trace', trace);
  }

  getTraces(options: { traceId?: string; service?: string; limit?: number } = {}): any[] {
    let traces: any[] = [];

    if (options.traceId) {
      traces = this.traces.get(options.traceId) || [];
    } else {
      for (const traceSpans of this.traces.values()) {
        traces.push(...traceSpans);
      }
    }

    // Filter by service
    if (options.service) {
      traces = traces.filter(span => span.serviceName === options.service);
    }

    // Limit results
    if (options.limit) {
      traces = traces.slice(0, options.limit);
    }

    return traces;
  }

  getTraceStats(): any {
    return {
      totalTraces: this.traces.size,
      totalSpans: Array.from(this.traces.values()).reduce((sum, spans) => sum + spans.length, 0),
      avgSpansPerTrace: Array.from(this.traces.values()).reduce((sum, spans, _, arr) => sum + (spans.length / arr.length), 0),
      samplingRate: this.samplingRate
    };
  }

  setSamplingRate(rate: number): void {
    this.samplingRate = Math.max(0, Math.min(1, rate));
    this.logger.info(`Trace sampling rate set to: ${this.samplingRate}`);
  }
}

// Event emitter interface
export interface MetricsCollectorEvents {
  metric: (metric: MetricData) => void;
  started: () => void;
  stopped: () => void;
}

export interface TraceCollectorEvents {
  trace: (trace: any) => void;
  started: () => void;
  stopped: () => void;
}

// Extend MetricsCollector with EventEmitter functionality
export interface MetricsCollector extends NodeJS.EventEmitter {
  on(event: 'metric', listener: (metric: MetricData) => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;

  emit(event: 'metric', metric: MetricData): boolean;
  emit(event: 'started'): boolean;
  emit(event: 'stopped'): boolean;
}

// Extend TraceCollector with EventEmitter functionality
export interface TraceCollector extends NodeJS.EventEmitter {
  on(event: 'trace', listener: (trace: any) => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;

  emit(event: 'trace', trace: any): boolean;
  emit(event: 'started'): boolean;
  emit(event: 'stopped'): boolean;
}