/**
 * ClaudeFlare Distributed Logging System
 *
 * A comprehensive distributed logging solution providing:
 * - Structured logging with log collection
 * - Log aggregation and correlation
 * - Full-text search and filtering
 * - Log analytics and anomaly detection
 * - Log streaming and real-time events
 * - D1/R2 storage integration
 * - Log metrics and monitoring
 *
 * @package @claudeflare/distributed-logging
 */

// ============================================================================
// Core Types
// ============================================================================

export * from './types';

// ============================================================================
// Collector
// ============================================================================

export {
  LogCollector,
  CollectorEvents,
  type CollectorConfig,
} from './collector/collector';

export {
  createLogCollector,
} from './collector/collector';

export {
  LogParser,
  LogFormat,
  type ParseResult,
  type ParserOptions,
} from './collector/parser';

export {
  createLogParser,
} from './collector/parser';

// ============================================================================
// Aggregation
// ============================================================================

export {
  LogAggregator,
  AggregatorEvents,
  type AggregatorConfig,
} from './aggregation/aggregator';

export {
  createLogAggregator,
} from './aggregation/aggregator';

// ============================================================================
// Search
// ============================================================================

export {
  LogSearchEngine,
  SearchEngineEvents,
  type SearchEngineConfig,
} from './search/engine';

export {
  createLogSearchEngine,
} from './search/engine';

// ============================================================================
// Analytics
// ============================================================================

export {
  LogAnalytics,
  AnalyticsEvents,
  type AnalyticsConfig,
} from './analytics/analytics';

export {
  createLogAnalytics,
} from './analytics/analytics';

// ============================================================================
// Storage
// ============================================================================

export {
  StorageManager,
  StorageEvents,
  D1_SCHEMA,
  type StorageEvents as StorageEventType,
} from './storage/storage';

export {
  createStorageManager,
} from './storage/storage';

// ============================================================================
// Streaming
// ============================================================================

export {
  LogStreamingManager,
  StreamingEvents,
  type StreamClient,
  type StreamFilter,
} from './streaming/streaming';

export {
  createLogStreamingManager,
} from './streaming/streaming';

// ============================================================================
// Metrics
// ============================================================================

export {
  LogMetricsCollector,
  type MetricsConfig,
  type MetricsSnapshot,
  type MetricDataPoint,
} from './metrics/metrics';

export {
  createLogMetricsCollector,
} from './metrics/metrics';

// ============================================================================
// Utilities
// ============================================================================

export {
  getInternalLogger,
  Logger,
  createLogger,
  type InternalLoggerConfig,
} from './utils/logger';

export {
  validateLogEntry,
  validateLogEntries,
  validateSearchQuery,
  validateTimeRange,
  sanitizeMessage,
  validateServiceName,
  validateTraceId,
  validateSpanId,
} from './utils/validation';

export {
  generateLogId,
  generateTraceId,
  generateSpanId,
  generateBatchId,
  now,
  toISOString,
  fromISOString,
  formatTimestamp,
  duration,
  isWithinRange,
  stringToLogLevel,
  logLevelToString,
  isErrorLevel,
  isWarningLevel,
  calculateLogSize,
  calculateBatchSize,
  formatBytes,
  estimateCompressionRatio,
  calculateCompressedSize,
  extractErrorInfo,
  sanitizeMetadata,
  mergeMetadata,
  flattenMetadata,
  truncate,
  escapeRegex,
  matchesPattern,
  wildcardMatch,
  chunk,
  unique,
  shuffle,
  sample,
  average,
  median,
  percentile,
  standardDeviation,
  calculateRate,
  simpleHash,
  hashMetadata,
} from './utils/helpers';

// ============================================================================
// Main Distributed Logging Class
// ============================================================================

import {
  DistributedLoggingConfig,
  LogEntry,
  PartialLogEntry,
  SearchQuery,
  AggregationConfig,
  StorageConfig,
  TimeRange,
  LogMetrics,
  Anomaly,
  LogLevel,
} from './types';
import { LogCollector } from './collector/collector';
import { LogAggregator } from './aggregation/aggregator';
import { LogSearchEngine } from './search/engine';
import { LogAnalytics } from './analytics/analytics';
import { StorageManager } from './storage/storage';
import { LogStreamingManager } from './streaming/streaming';
import { LogMetricsCollector } from './metrics/metrics';
import { createLogger } from './utils/logger';

export interface DistributedLoggingSystemEvents {
  'log:collected': LogEntry;
  'batch:ready': any;
  'search:completed': any;
  'anomaly:detected': Anomaly;
  'metrics:updated': LogMetrics;
}

/**
 * Main Distributed Logging System
 *
 * Integrates all components into a unified logging system
 */
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

  private config: DistributedLoggingConfig;

  constructor(config: DistributedLoggingConfig) {
    this.config = config;

    // Initialize components
    this.collector = new LogCollector({
      service: config.service,
      environment: config.environment,
      options: config.collection,
    });

    this.aggregator = new LogAggregator({
      maxCacheSize: 10000,
    });

    this.searchEngine = new LogSearchEngine({
      maxResults: config.search.maxResults,
      timeout: config.search.timeout,
    });

    this.analytics = new LogAnalytics({
      windowSize: config.analytics.anomalyDetection.windowSize,
      minDataPoints: config.analytics.anomalyDetection.minDataPoints,
      sensitivity: config.analytics.anomalyDetection.sensitivity,
    });

    this.storage = new StorageManager(config.storage);

    this.streaming = new LogStreamingManager(config.streaming);

    this.metrics = new LogMetricsCollector({
      aggregationInterval: config.analytics.metrics.aggregationInterval,
      retentionPeriod: config.analytics.metrics.retentionPeriod,
      enabledMetrics: config.analytics.metrics.enabledMetrics,
    });

    this.setupEventListeners();
  }

  /**
   * Setup event listeners between components
   */
  private setupEventListeners(): void {
    // Collector -> Search Engine
    this.collector.on('batch:flushed', async (batch) => {
      this.searchEngine.indexEntries(batch.entries);
    });

    // Collector -> Aggregator
    this.collector.on('batch:flushed', async (batch) => {
      this.aggregator.aggregate(batch.entries, this.config.aggregation);
    });

    // Collector -> Storage
    this.collector.on('batch:flushed', async (batch) => {
      await this.storage.storeBatch(batch);
    });

    // Collector -> Streaming
    this.collector.on('batch:flushed', async (batch) => {
      this.streaming.streamBatch(batch);
    });

    // Collector -> Metrics
    this.collector.on('log:received', (entry) => {
      this.metrics.record(entry);
    });

    // Search Engine -> Streaming
    this.searchEngine.on('search:completed', ({ query, result }) => {
      this.streaming.streamSearchResults(query, result);
    });

    // Analytics -> Streaming
    this.analytics.on('anomaly:detected', (anomaly) => {
      this.streaming.broadcast({
        type: 'anomaly',
        data: anomaly,
      });
    });
  }

  /**
   * Initialize the system
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('System already initialized');
      return;
    }

    this.logger.info('Initializing distributed logging system');

    // Initialize storage
    await this.storage.initializeStorage();

    this.initialized = true;

    this.logger.info('Distributed logging system initialized successfully');
  }

  /**
   * Log a message
   */
  public async log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): Promise<LogEntry> {
    const entry = await this.collector.collect({
      level,
      message,
      service: this.config.service,
      metadata,
    });

    return entry;
  }

  /**
   * Log at trace level
   */
  public async trace(message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log(LogLevel.TRACE, message, metadata);
  }

  /**
   * Log at debug level
   */
  public async debug(message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log at info level
   */
  public async info(message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log at warn level
   */
  public async warn(message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log at error level
   */
  public async error(
    message: string,
    error?: Error | unknown,
    metadata?: Record<string, any>
  ): Promise<LogEntry> {
    const entry = await this.collector.collect({
      level: LogLevel.ERROR,
      message,
      service: this.config.service,
      error,
      metadata,
    });

    return entry;
  }

  /**
   * Log at fatal level
   */
  public async fatal(
    message: string,
    error?: Error | unknown,
    metadata?: Record<string, any>
  ): Promise<LogEntry> {
    const entry = await this.collector.collect({
      level: LogLevel.FATAL,
      message,
      service: this.config.service,
      error,
      metadata,
    });

    return entry;
  }

  /**
   * Search logs
   */
  public async search(query: SearchQuery): Promise<LogEntry[]> {
    const result = await this.searchEngine.search(query);
    return result.entries;
  }

  /**
   * Get metrics for a time range
   */
  public async getMetrics(timeRange: TimeRange): Promise<LogMetrics> {
    // Get entries from storage
    const entries = await this.storage.queryEntries({
      startTime: timeRange.start,
      endTime: timeRange.end,
    });

    // Calculate metrics
    return this.analytics.calculateMetrics(entries, timeRange);
  }

  /**
   * Detect anomalies
   */
  public async detectAnomalies(timeRange: TimeRange): Promise<Anomaly[]> {
    // Get entries from storage
    const entries = await this.storage.queryEntries({
      startTime: timeRange.start,
      endTime: timeRange.end,
    });

    // Detect anomalies
    return this.analytics.detectAnomalies(entries);
  }

  /**
   * Get aggregated logs
   */
  public async getAggregations(config: AggregationConfig): Promise<any[]> {
    // This would need to be implemented based on aggregation type
    return [];
  }

  /**
   * Shutdown the system
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down distributed logging system');

    // Flush any pending logs
    await this.collector.shutdown();

    // Shutdown components
    await this.aggregator.shutdown();
    await this.streaming.shutdown();
    await this.metrics.shutdown();
    await this.storage.shutdown();

    this.initialized = false;

    this.logger.info('Distributed logging system shutdown complete');
  }

  /**
   * Get system statistics
   */
  public getStats(): {
    collector: any;
    aggregator: any;
    search: any;
    storage: Promise<any>;
    streaming: { clientCount: number };
    metrics: any;
  } {
    return {
      collector: this.collector.getStats(),
      aggregator: this.aggregator.getStats(),
      search: this.searchEngine.getStats(),
      storage: this.storage.getStats(),
      streaming: {
        clientCount: this.streaming.getClientCount(),
      },
      metrics: this.metrics.getStats(),
    };
  }

  /**
   * Create a child logger with a different service
   */
  public child(service: string): DistributedLoggingSystem {
    const childConfig: DistributedLoggingConfig = {
      ...this.config,
      service,
    };

    const child = new DistributedLoggingSystem(childConfig);

    // Forward events
    this.collector.on('log:received', (entry) => child.collector.emit('log:received', entry));

    return child;
  }
}

/**
 * Create a distributed logging system instance
 */
export function createDistributedLoggingSystem(
  config: DistributedLoggingConfig
): DistributedLoggingSystem {
  return new DistributedLoggingSystem(config);
}
