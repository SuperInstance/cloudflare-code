/**
 * Distributed Logging System - Optimized
 */

import type { DistributedLoggingConfig, LogEntry, SearchQuery, TimeRange, LogMetrics, Anomaly, LogLevel } from './types';
import { LogCollector } from './collector/collector';
import { LogAggregator } from './aggregation/aggregator';
import { LogSearchEngine } from './search/engine';
import { LogAnalytics } from './analytics/analytics';
import { StorageManager } from './storage/storage';
import { LogStreamingManager } from './streaming/streaming';
import { LogMetricsCollector } from './metrics/metrics';
import { createLogger } from './utils/logger';

export class DistributedLoggingSystem {
  private collector: LogCollector;
  private aggregator: LogAggregator;
  private searchEngine: LogSearchEngine;
  private analytics: LogAnalytics;
  private storage: StorageManager;
  private streaming: LogStreamingManager;
  private metrics: LogMetricsCollector;
  private logger = createLogger({ component: 'DistributedLoggingSystem' });
  private initialized = false;

  constructor(private config: DistributedLoggingConfig) {
    // Initialize components (streamlined)
    this.collector = new LogCollector({ service: config.service, environment: config.environment, options: config.collection });
    this.aggregator = new LogAggregator({ maxCacheSize: 10000 });
    this.searchEngine = new LogSearchEngine({ maxResults: config.search.maxResults, timeout: config.search.timeout });
    this.analytics = new LogAnalytics({
      windowSize: config.analytics.anomalyDetection.windowSize,
      minDataPoints: config.analytics.anomalyDetection.minDataPoints,
      sensitivity: config.analytics.anomalyDetection.sensitivity
    });
    this.storage = new StorageManager(config.storage);
    this.streaming = new LogStreamingManager(config.streaming);
    this.metrics = new LogMetricsCollector({
      aggregationInterval: config.analytics.metrics.aggregationInterval,
      retentionPeriod: config.analytics.metrics.retentionPeriod,
      enabledMetrics: config.analytics.metrics.enabledMetrics
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.collector.on('batch:flushed', async (batch) => {
      this.searchEngine.indexEntries(batch.entries);
      this.aggregator.aggregate(batch.entries, this.config.aggregation);
      await this.storage.storeBatch(batch);
      this.streaming.streamBatch(batch);
    });

    this.collector.on('log:received', (entry) => this.metrics.record(entry));
    this.searchEngine.on('search:completed', ({ query, result }) => this.streaming.streamSearchResults(query, result));
    this.analytics.on('anomaly:detected', (anomaly) => this.streaming.broadcast({ type: 'anomaly', data: anomaly }));
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.storage.initializeStorage();
    this.initialized = true;
  }

  async log(level: LogLevel, message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.collector.collect({ level, message, service: this.config.service, metadata });
  }

  async trace(message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log('trace' as LogLevel, message, metadata);
  }

  async debug(message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log('debug' as LogLevel, message, metadata);
  }

  async info(message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log('info' as LogLevel, message, metadata);
  }

  async warn(message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log('warn' as LogLevel, message, metadata);
  }

  async error(message: string, error?: Error | unknown, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.collector.collect({ level: 'error' as LogLevel, message, service: this.config.service, error, metadata });
  }

  async fatal(message: string, error?: Error | unknown, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.collector.collect({ level: 'fatal' as LogLevel, message, service: this.config.service, error, metadata });
  }

  async search(query: SearchQuery): Promise<LogEntry[]> {
    const result = await this.searchEngine.search(query);
    return result.entries;
  }

  async getMetrics(timeRange: TimeRange): Promise<LogMetrics> {
    const entries = await this.storage.queryEntries({ startTime: timeRange.start, endTime: timeRange.end });
    return this.analytics.calculateMetrics(entries, timeRange);
  }

  async detectAnomalies(timeRange: TimeRange): Promise<Anomaly[]> {
    const entries = await this.storage.queryEntries({ startTime: timeRange.start, endTime: timeRange.end });
    return this.analytics.detectAnomalies(entries);
  }

  async shutdown(): Promise<void> {
    await this.collector.shutdown();
    await this.aggregator.shutdown();
    await this.streaming.shutdown();
    await this.metrics.shutdown();
    await this.storage.shutdown();
    this.initialized = false;
  }

  child(service: string): DistributedLoggingSystem {
    return new DistributedLoggingSystem({ ...this.config, service });
  }
}

export function createDistributedLoggingSystem(config: DistributedLoggingConfig): DistributedLoggingSystem {
  return new DistributedLoggingSystem(config);
}
