/**
 * Security Event Logger
 * High-performance event capture, normalization, enrichment, and storage
 * Handles 100M+ events per day with sub-second processing
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { Queue } from 'bull';
import Redis from 'ioredis';
import { Client } from '@elastic/elasticsearch';

import {
  SecurityEvent,
  SecurityEventType,
  SecurityEventSeverity,
  EnrichedSecurityEvent,
  EnrichmentData,
  EventMetadata,
} from '../types/index';
import { EventNormalizer } from './normalizer';
import { EventEnricher } from './enricher';
import { EventStorage } from './storage';
import { EventValidator } from './validator';
import { EventBuffer } from './buffer';
import { EventAggregator } from './aggregator';
import { Logger } from '@claudeflare/logger';
import { Cache } from '@claudeflare/cache';

// ============================================================================
// LOGGER CONFIGURATION
// ============================================================================

export interface SecurityEventLoggerConfig {
  // Buffer Configuration
  bufferSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;

  // Queue Configuration
  queueName?: string;
  queueConcurrency?: number;
  queueMaxSize?: number;

  // Storage Configuration
  elasticsearchUrl?: string;
  elasticsearchIndex?: string;
  elasticsearchUsername?: string;
  elasticsearchPassword?: string;

  // Redis Configuration
  redisUrl?: string;
  redisKeyPrefix?: string;

  // Logging Configuration
  logLevel?: string;
  logFormat?: string;

  // Enrichment Configuration
  enableGeoLocation?: boolean;
  enableThreatIntel?: boolean;
  enableUserBehavior?: boolean;
  enableHistoricalData?: boolean;

  // Performance Configuration
  enableBatching?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  enableCompression?: boolean;

  // Monitoring Configuration
  enableMetrics?: boolean;
  metricsPrefix?: string;
}

const DEFAULT_CONFIG: SecurityEventLoggerConfig = {
  bufferSize: 10000,
  flushInterval: 5000, // 5 seconds
  maxRetries: 3,
  retryDelay: 1000,
  queueName: 'security-events',
  queueConcurrency: 10,
  queueMaxSize: 100000,
  elasticsearchUrl: 'http://localhost:9200',
  elasticsearchIndex: 'security-events',
  redisUrl: 'redis://localhost:6379',
  redisKeyPrefix: 'security-monitoring:',
  logLevel: 'info',
  logFormat: 'json',
  enableGeoLocation: true,
  enableThreatIntel: true,
  enableUserBehavior: true,
  enableHistoricalData: true,
  enableBatching: true,
  batchSize: 100,
  batchTimeout: 1000,
  enableCompression: true,
  enableMetrics: true,
  metricsPrefix: 'security_monitoring_',
};

// ============================================================================
// LOGGER METRICS
// ============================================================================

export interface LoggerMetrics {
  totalEventsReceived: number;
  totalEventsProcessed: number;
  totalEventsStored: number;
  totalEventsFailed: number;
  averageProcessingTime: number;
  currentBufferSize: number;
  enrichmentTime: number;
  storageTime: number;
  queueSize: number;
  queueProcessed: number;
  queueFailed: number;
}

// ============================================================================
// MAIN LOGGER CLASS
// ============================================================================

export class SecurityEventLogger extends EventEmitter {
  private config: Required<SecurityEventLoggerConfig>;
  private logger: winston.Logger;
  private normalizer: EventNormalizer;
  private enricher: EventEnricher;
  private storage: EventStorage;
  private validator: EventValidator;
  private buffer: EventBuffer;
  private aggregator: EventAggregator;
  private cache: Cache;
  private queue: Queue;
  private redis: Redis;
  private elasticsearch: Client;
  private metrics: LoggerMetrics;
  private isInitialized: boolean = false;
  private isProcessing: boolean = false;
  private flushTimer?: NodeJS.Timeout;
  private processingTimer?: NodeJS.Timeout;
  private startTime: number = Date.now();

  constructor(config: SecurityEventLoggerConfig = {}) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config } as Required<SecurityEventLoggerConfig>;
    this.metrics = this.initializeMetrics();

    // Initialize Winston logger
    this.logger = winston.createLogger({
      level: this.config.logLevel,
      format: this.config.logFormat === 'json'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'security-events.log',
          level: 'info',
        }),
        new winston.transports.File({
          filename: 'security-events-error.log',
          level: 'error',
        }),
      ],
    });

    // Initialize components (will be initialized in init())
    this.normalizer = null as any;
    this.enricher = null as any;
    this.storage = null as any;
    this.validator = null as any;
    this.buffer = null as any;
    this.aggregator = null as any;
    this.cache = null as any;
    this.queue = null as any;
    this.redis = null as any;
    this.elasticsearch = null as any;
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize the logger and all its components
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('SecurityEventLogger already initialized');
      return;
    }

    try {
      this.logger.info('Initializing SecurityEventLogger...');

      // Initialize Redis
      this.redis = new Redis(this.config.redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      // Initialize Elasticsearch
      this.elasticsearch = new Client({
        node: this.config.elasticsearchUrl,
        auth: this.config.elasticsearchUsername
          ? {
              username: this.config.elasticsearchUsername,
              password: this.config.elasticsearchPassword,
            }
          : undefined,
      });

      // Initialize cache
      this.cache = new Cache({
        client: this.redis,
        prefix: this.config.redisKeyPrefix,
      });

      // Initialize components
      this.validator = new EventValidator();
      this.normalizer = new EventNormalizer(this.validator);
      this.enricher = new EventEnricher({
        cache: this.cache,
        elasticsearch: this.elasticsearch,
        enableGeoLocation: this.config.enableGeoLocation,
        enableThreatIntel: this.config.enableThreatIntel,
        enableUserBehavior: this.config.enableUserBehavior,
        enableHistoricalData: this.config.enableHistoricalData,
      });
      this.storage = new EventStorage(this.elasticsearch, this.config.elasticsearchIndex);
      this.buffer = new EventBuffer(this.config.bufferSize);
      this.aggregator = new EventAggregator(this.elasticsearch);

      // Initialize queue
      this.queue = new Queue(this.config.queueName, {
        redis: {
          host: this.redis.options.host || 'localhost',
          port: this.redis.options.port || 6379,
          password: this.redis.options.password,
        },
        defaultJobOptions: {
          attempts: this.config.maxRetries,
          backoff: {
            type: 'exponential',
            delay: this.config.retryDelay,
          },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      });

      // Setup queue event handlers
      this.setupQueueHandlers();

      // Setup periodic flush
      this.setupPeriodicFlush();

      // Setup metrics collection
      if (this.config.enableMetrics) {
        this.setupMetricsCollection();
      }

      this.isInitialized = true;
      this.logger.info('SecurityEventLogger initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize SecurityEventLogger', { error });
      throw error;
    }
  }

  /**
   * Shutdown the logger and cleanup resources
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('Shutting down SecurityEventLogger...');

    try {
      // Stop periodic flush
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }

      if (this.processingTimer) {
        clearInterval(this.processingTimer);
      }

      // Flush remaining events in buffer
      await this.flushBuffer();

      // Close queue
      await this.queue.close();

      // Close connections
      await this.redis.quit();
      await this.elasticsearch.close();

      this.isInitialized = false;
      this.logger.info('SecurityEventLogger shut down successfully');
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      throw error;
    }
  }

  // ========================================================================
  // EVENT LOGGING
  // ========================================================================

  /**
   * Log a security event
   * This is the main entry point for logging security events
   */
  public async log(eventData: Partial<SecurityEvent>): Promise<EnrichedSecurityEvent> {
    if (!this.isInitialized) {
      throw new Error('SecurityEventLogger not initialized. Call initialize() first.');
    }

    const startTime = Date.now();

    try {
      // Generate event ID if not provided
      if (!eventData.id) {
        eventData.id = uuidv4();
      }

      // Set timestamp if not provided
      if (!eventData.timestamp) {
        eventData.timestamp = new Date();
      }

      // Normalize the event
      const normalizedEvent = await this.normalizer.normalize(eventData);

      // Validate the event
      await this.validator.validate(normalizedEvent);

      // Enrich the event
      const enrichedEvent = await this.enricher.enrich(normalizedEvent);

      // Add to buffer
      this.buffer.add(enrichedEvent);

      // Update metrics
      this.metrics.totalEventsReceived++;
      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);

      // Emit event
      this.emit('eventLogged', enrichedEvent);

      // Check if buffer should be flushed
      if (this.buffer.shouldFlush()) {
        await this.flushBuffer();
      }

      return enrichedEvent;
    } catch (error) {
      this.logger.error('Failed to log event', { error, eventData });
      this.metrics.totalEventsFailed++;
      this.emit('eventLogError', { error, eventData });
      throw error;
    }
  }

  /**
   * Log multiple events in batch
   */
  public async logBatch(events: Partial<SecurityEvent>[]): Promise<EnrichedSecurityEvent[]> {
    if (!this.isInitialized) {
      throw new Error('SecurityEventLogger not initialized. Call initialize() first.');
    }

    const startTime = Date.now();

    try {
      // Generate IDs and timestamps if not provided
      events.forEach(event => {
        if (!event.id) {
          event.id = uuidv4();
        }
        if (!event.timestamp) {
          event.timestamp = new Date();
        }
      });

      // Normalize all events
      const normalizedEvents = await Promise.all(
        events.map(event => this.normalizer.normalize(event))
      );

      // Validate all events
      await Promise.all(
        normalizedEvents.map(event => this.validator.validate(event))
      );

      // Enrich all events in parallel
      const enrichedEvents = await Promise.all(
        normalizedEvents.map(event => this.enricher.enrich(event))
      );

      // Add to buffer
      enrichedEvents.forEach(event => this.buffer.add(event));

      // Update metrics
      this.metrics.totalEventsReceived += events.length;
      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime / events.length);

      // Emit batch logged event
      this.emit('batchLogged', enrichedEvents);

      // Check if buffer should be flushed
      if (this.buffer.shouldFlush()) {
        await this.flushBuffer();
      }

      return enrichedEvents;
    } catch (error) {
      this.logger.error('Failed to log batch', { error, eventCount: events.length });
      this.metrics.totalEventsFailed += events.length;
      this.emit('batchLogError', { error, eventCount: events.length });
      throw error;
    }
  }

  // ========================================================================
  // BUFFER MANAGEMENT
  // ========================================================================

  /**
   * Flush the event buffer to storage
   */
  private async flushBuffer(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const events = this.buffer.flush();

      if (events.length === 0) {
        return;
      }

      this.logger.debug(`Flushing ${events.length} events to storage`);

      // Add to queue for async processing
      await this.queue.add('processEvents', { events }, {
        jobOptions: { priority: 5 },
      });

      this.metrics.currentBufferSize = 0;
      this.emit('bufferFlushed', { eventCount: events.length });
    } catch (error) {
      this.logger.error('Failed to flush buffer', { error });
      this.emit('bufferFlushError', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Setup periodic buffer flush
   */
  private setupPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushInterval);
  }

  // ========================================================================
  // QUEUE MANAGEMENT
  // ========================================================================

  /**
   * Setup queue event handlers
   */
  private setupQueueHandlers(): void {
    this.queue.process('processEvents', this.config.queueConcurrency, async (job) => {
      const { events } = job.data;
      return await this.processEvents(events);
    });

    this.queue.on('completed', (job) => {
      this.metrics.queueProcessed++;
      this.emit('jobCompleted', { jobId: job.id });
    });

    this.queue.on('failed', (job, error) => {
      this.metrics.queueFailed++;
      this.logger.error('Job failed', { jobId: job.id, error });
      this.emit('jobFailed', { jobId: job.id, error });
    });

    this.queue.on('stalled', (job) => {
      this.logger.warn('Job stalled', { jobId: job.id });
      this.emit('jobStalled', { jobId: job.id });
    });
  }

  /**
   * Process events from queue
   */
  private async processEvents(events: EnrichedSecurityEvent[]): Promise<void> {
    const startTime = Date.now();

    try {
      // Store events in Elasticsearch
      await this.storage.storeEvents(events);

      // Update metrics
      this.metrics.totalEventsProcessed += events.length;
      this.metrics.totalEventsStored += events.length;
      const processingTime = Date.now() - startTime;
      this.metrics.storageTime = processingTime;

      // Update queue size metric
      const queueSize = await this.queue.getJobCounts();
      this.metrics.queueSize = Object.values(queueSize).reduce((a, b) => a + b, 0);

      this.emit('eventsProcessed', { eventCount: events.length, processingTime });
    } catch (error) {
      this.logger.error('Failed to process events', { error, eventCount: events.length });
      this.metrics.totalEventsFailed += events.length;
      throw error;
    }
  }

  // ========================================================================
  // EVENT RETRIEVAL
  // ========================================================================

  /**
   * Retrieve events by query
   */
  public async getEvents(query: EventQuery): Promise<EnrichedSecurityEvent[]> {
    if (!this.isInitialized) {
      throw new Error('SecurityEventLogger not initialized. Call initialize() first.');
    }

    return await this.storage.queryEvents(query);
  }

  /**
   * Get event by ID
   */
  public async getEventById(id: string): Promise<EnrichedSecurityEvent | null> {
    if (!this.isInitialized) {
      throw new Error('SecurityEventLogger not initialized. Call initialize() first.');
    }

    return await this.storage.getEventById(id);
  }

  /**
   * Get recent events
   */
  public async getRecentEvents(limit: number = 100): Promise<EnrichedSecurityEvent[]> {
    if (!this.isInitialized) {
      throw new Error('SecurityEventLogger not initialized. Call initialize() first.');
    }

    return await this.storage.getRecentEvents(limit);
  }

  /**
   * Get events by type
   */
  public async getEventsByType(
    type: SecurityEventType,
    startDate?: Date,
    endDate?: Date
  ): Promise<EnrichedSecurityEvent[]> {
    if (!this.isInitialized) {
      throw new Error('SecurityEventLogger not initialized. Call initialize() first.');
    }

    return await this.storage.getEventsByType(type, startDate, endDate);
  }

  /**
   * Get events by user
   */
  public async getEventsByUser(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<EnrichedSecurityEvent[]> {
    if (!this.isInitialized) {
      throw new Error('SecurityEventLogger not initialized. Call initialize() first.');
    }

    return await this.storage.getEventsByUser(userId, startDate, endDate);
  }

  // ========================================================================
  // AGGREGATION
  // ========================================================================

  /**
   * Get event counts by type
   */
  public async getEventCountsByType(
    startDate: Date,
    endDate: Date
  ): Promise<Record<SecurityEventType, number>> {
    if (!this.isInitialized) {
      throw new Error('SecurityEventLogger not initialized. Call initialize() first.');
    }

    return await this.aggregator.getEventCountsByType(startDate, endDate);
  }

  /**
   * Get event counts by severity
   */
  public async getEventCountsBySeverity(
    startDate: Date,
    endDate: Date
  ): Promise<Record<SecurityEventSeverity, number>> {
    if (!this.isInitialized) {
      throw new Error('SecurityEventLogger not initialized. Call initialize() first.');
    }

    return await this.aggregator.getEventCountsBySeverity(startDate, endDate);
  }

  /**
   * Get event timeline
   */
  public async getEventTimeline(
    startDate: Date,
    endDate: Date,
    interval: 'minute' | 'hour' | 'day' | 'week' | 'month' = 'hour'
  ): Promise<TimelineBucket[]> {
    if (!this.isInitialized) {
      throw new Error('SecurityEventLogger not initialized. Call initialize() first.');
    }

    return await this.aggregator.getEventTimeline(startDate, endDate, interval);
  }

  // ========================================================================
  // METRICS
  // ========================================================================

  /**
   * Get logger metrics
   */
  public getMetrics(): LoggerMetrics {
    return {
      ...this.metrics,
      currentBufferSize: this.buffer.size(),
      uptime: Date.now() - this.startTime,
    } as any;
  }

  /**
   * Get detailed metrics
   */
  public async getDetailedMetrics(): Promise<DetailedMetrics> {
    const queueStats = await this.queue.getJobCounts();
    const bufferStats = this.buffer.getStats();

    return {
      ...this.metrics,
      currentBufferSize: this.buffer.size(),
      uptime: Date.now() - this.startTime,
      queueStats,
      bufferStats,
      eventsPerSecond: this.calculateEventsPerSecond(),
      averageEnrichmentTime: this.metrics.enrichmentTime,
      averageStorageTime: this.metrics.storageTime,
    } as any;
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.startTime = Date.now();
  }

  /**
   * Setup metrics collection
   */
  private setupMetricsCollection(): void {
    this.processingTimer = setInterval(() => {
      this.collectAndEmitMetrics();
    }, 60000); // Every minute
  }

  /**
   * Collect and emit metrics
   */
  private async collectAndEmitMetrics(): Promise<void> {
    const metrics = await this.getDetailedMetrics();
    this.emit('metrics', metrics);
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private initializeMetrics(): LoggerMetrics {
    return {
      totalEventsReceived: 0,
      totalEventsProcessed: 0,
      totalEventsStored: 0,
      totalEventsFailed: 0,
      averageProcessingTime: 0,
      currentBufferSize: 0,
      enrichmentTime: 0,
      storageTime: 0,
      queueSize: 0,
      queueProcessed: 0,
      queueFailed: 0,
    };
  }

  private updateAverageProcessingTime(processingTime: number): void {
    const alpha = 0.2; // Smoothing factor for exponential moving average
    this.metrics.averageProcessingTime =
      alpha * processingTime + (1 - alpha) * this.metrics.averageProcessingTime;
  }

  private calculateEventsPerSecond(): number {
    const uptime = (Date.now() - this.startTime) / 1000;
    return uptime > 0 ? this.metrics.totalEventsProcessed / uptime : 0;
  }
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface EventQuery {
  type?: SecurityEventType | SecurityEventType[];
  severity?: SecurityEventSeverity | SecurityEventSeverity[];
  startDate?: Date;
  endDate?: Date;
  userId?: string | string[];
  source?: string | string[];
  ipAddress?: string | string[];
  resource?: string | string[];
  outcome?: 'success' | 'failure' | 'partial';
  tags?: string[];
  limit?: number;
  offset?: number;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

export interface TimelineBucket {
  timestamp: Date;
  count: number;
  byType: Record<SecurityEventType, number>;
  bySeverity: Record<SecurityEventSeverity, number>;
}

export interface DetailedMetrics extends LoggerMetrics {
  uptime: number;
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  bufferStats: {
    size: number;
    capacity: number;
    utilization: number;
  };
  eventsPerSecond: number;
  averageEnrichmentTime: number;
  averageStorageTime: number;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { EventNormalizer } from './normalizer';
export { EventEnricher } from './enricher';
export { EventStorage } from './storage';
export { EventValidator } from './validator';
export { EventBuffer } from './buffer';
export { EventAggregator } from './aggregator';
