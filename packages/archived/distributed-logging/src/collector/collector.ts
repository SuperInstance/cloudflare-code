/**
 * Log Collector - Handles log ingestion, parsing, normalization, and enrichment
 */

import PQueue from 'p-queue';
import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  LogEntry,
  LogLevel,
  CollectionOptions,
  LogBatch,
  BatchMetadata,
  LogMetadata,
  LogContext,
  ErrorInfo,
  CompressionType,
  PartialLogEntry,
} from '../types';
import { createLogger } from '../utils/logger';
import {
  generateLogId,
  generateTraceId,
  generateSpanId,
  now,
  calculateLogSize,
  calculateBatchSize,
  sanitizeMetadata,
  extractErrorInfo,
  hashMetadata,
} from '../utils/helpers';
import { validateServiceName } from '../utils/validation';

const DEFAULT_OPTIONS: Required<CollectionOptions> = {
  batchSize: 1000,
  bufferTimeout: 5000,
  compression: CompressionType.NONE,
  enrichment: true,
  validation: true,
  deduplication: true,
};

export interface CollectorConfig {
  service: string;
  environment?: string;
  host?: string;
  options?: CollectionOptions;
  defaultTags?: string[];
  defaultContext?: LogContext;
}

export interface CollectorEvents {
  'log:received': LogEntry;
  'log:parsed': LogEntry;
  'log:normalized': LogEntry;
  'log:enriched': LogEntry;
  'log:error': { error: Error; entry?: PartialLogEntry };
  'batch:full': LogBatch;
  'batch:flushed': LogBatch;
  'buffer:timeout': LogBatch;
}

/**
 * Log Collector class
 */
export class LogCollector extends EventEmitter<CollectorEvents> {
  private config: Required<CollectorConfig>;
  private options: Required<CollectionOptions>;
  private buffer: LogEntry[] = [];
  private bufferTimer: NodeJS.Timeout | null = null;
  private queue: PQueue;
  private seenHashes: Set<string> = new Set();
  private logger = createLogger({ component: 'LogCollector' });

  constructor(config: CollectorConfig) {
    super();

    // Validate service name
    const serviceValidation = validateServiceName(config.service);
    if (!serviceValidation.valid) {
      throw new Error(`Invalid service name: ${serviceValidation.error}`);
    }

    this.config = {
      service: config.service,
      environment: config.environment ?? process.env.NODE_ENV ?? 'development',
      host: config.host ?? this.detectHost(),
      options: DEFAULT_OPTIONS,
      defaultTags: config.defaultTags ?? [],
      defaultContext: config.defaultContext ?? {},
    };

    this.options = {
      ...DEFAULT_OPTIONS,
      ...(config.options ?? {}),
    };

    // Configure queue with concurrency
    this.queue = new PQueue({
      concurrency: 10,
      autoStart: true,
      throwOnTimeout: true,
    });

    this.startBufferTimer();
    this.logger.info('Log collector initialized', {
      service: this.config.service,
      environment: this.config.environment,
    });
  }

  /**
   * Detect current hostname
   */
  private detectHost(): string {
    return (
      process.env.HOSTNAME ??
      process.env.COMPUTERNAME ??
      process.env.NAME ??
      'unknown'
    );
  }

  /**
   * Start buffer timeout timer
   */
  private startBufferTimer(): void {
    if (this.bufferTimer) {
      clearInterval(this.bufferTimer);
    }

    this.bufferTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush('timeout');
      }
    }, this.options.bufferTimeout);
  }

  /**
   * Stop buffer timer
   */
  private stopBufferTimer(): void {
    if (this.bufferTimer) {
      clearInterval(this.bufferTimer);
      this.bufferTimer = null;
    }
  }

  /**
   * Add a log entry to the collector
   */
  public async collect(entry: PartialLogEntry): Promise<LogEntry> {
    return this.queue.add(async () => {
      try {
        const parsed = await this.parse(entry);
        const normalized = this.normalize(parsed);
        const enriched = this.options.enrichment ? this.enrich(normalized) : normalized;
        const validated = this.options.validation ? this.validate(enriched) : enriched;

        this.emit('log:received', validated);
        this.addToBuffer(validated);

        return validated;
      } catch (error) {
        this.logger.error('Failed to collect log entry', error);
        this.emit('log:error', { error: error as Error, entry });
        throw error;
      }
    }) as Promise<LogEntry>;
  }

  /**
   * Collect multiple log entries
   */
  public async collectMany(entries: PartialLogEntry[]): Promise<LogEntry[]> {
    const promises = entries.map((entry) => this.collect(entry));
    return Promise.all(promises);
  }

  /**
   * Parse a log entry
   */
  private async parse(entry: PartialLogEntry): Promise<PartialLogEntry> {
    this.emit('log:parsed', entry as LogEntry);

    // Handle different input formats
    let parsed = { ...entry };

    // Parse level if string
    if (typeof parsed.level === 'string') {
      const levelMap: Record<string, LogLevel> = {
        trace: LogLevel.TRACE,
        debug: LogLevel.DEBUG,
        info: LogLevel.INFO,
        warn: LogLevel.WARN,
        warning: LogLevel.WARN,
        error: LogLevel.ERROR,
        err: LogLevel.ERROR,
        fatal: LogLevel.FATAL,
        critical: LogLevel.FATAL,
      };
      parsed.level = levelMap[parsed.level.toLowerCase()] ?? LogLevel.INFO;
    }

    // Parse timestamp if needed
    if (!parsed.timestamp) {
      parsed.timestamp = now();
    } else if (typeof parsed.timestamp === 'string') {
      parsed.timestamp = new Date(parsed.timestamp).getTime();
    }

    // Extract error info if error object provided
    if (entry.error instanceof Error) {
      parsed.error = extractErrorInfo(entry.error);
      parsed.stackTrace = entry.error.stack;
    }

    return parsed;
  }

  /**
   * Normalize a log entry
   */
  private normalize(entry: PartialLogEntry): LogEntry {
    const normalized: LogEntry = {
      id: entry.id ?? generateLogId(),
      timestamp: entry.timestamp ?? now(),
      level: entry.level ?? LogLevel.INFO,
      message: this.sanitizeMessage(entry.message),
      service: entry.service ?? this.config.service,
      environment: entry.environment ?? this.config.environment,
      host: entry.host ?? this.config.host,
      metadata: entry.metadata ? sanitizeMetadata(entry.metadata) : undefined,
      context: { ...this.config.defaultContext, ...entry.context },
      tags: this.mergeTags(entry.tags),
    };

    // Add trace/span IDs if not present
    if (normalized.context?.requestId && !normalized.traceId) {
      normalized.traceId = normalized.context.requestId;
      normalized.spanId = generateSpanId();
    }

    this.emit('log:normalized', normalized);
    return normalized;
  }

  /**
   * Enrich a log entry with additional metadata
   */
  private enrich(entry: LogEntry): LogEntry {
    const enriched = { ...entry };

    // Add enrichment metadata
    enriched.metadata = {
      ...(enriched.metadata ?? {}),
      collector: {
        version: '1.0.0',
        node: process.env.NODE_NAME,
        pod: process.env.POD_NAME,
        namespace: process.env.NAMESPACE,
      },
      collectedAt: now(),
    };

    // Add additional context metadata
    if (enriched.context?.userId) {
      enriched.metadata = {
        ...enriched.metadata,
        user: {
          id: enriched.context.userId,
        },
      };
    }

    this.emit('log:enriched', enriched);
    return enriched;
  }

  /**
   * Validate a log entry
   */
  private validate(entry: LogEntry): LogEntry {
    // Basic validation
    if (!entry.message || entry.message.length === 0) {
      throw new Error('Log message cannot be empty');
    }

    if (entry.message.length > 10000) {
      entry.message = entry.message.substring(0, 10000) + '... (truncated)';
    }

    return entry;
  }

  /**
   * Sanitize log message
   */
  private sanitizeMessage(message: string): string {
    // Remove control characters
    let sanitized = message.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // Limit length
    const maxLength = 10000;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '... (truncated)';
    }

    return sanitized;
  }

  /**
   * Merge default and entry tags
   */
  private mergeTags(entryTags?: string[]): string[] | undefined {
    const allTags = [...this.config.defaultTags];
    if (entryTags) {
      allTags.push(...entryTags);
    }
    return allTags.length > 0 ? Array.from(new Set(allTags)) : undefined;
  }

  /**
   * Add entry to buffer
   */
  private addToBuffer(entry: LogEntry): void {
    // Check for duplicates if enabled
    if (this.options.deduplication) {
      const hash = this.hashEntry(entry);
      if (this.seenHashes.has(hash)) {
        this.logger.debug('Duplicate log entry detected, skipping', { id: entry.id });
        return;
      }
      this.seenHashes.add(hash);

      // Clean up old hashes to prevent memory leaks
      if (this.seenHashes.size > 100000) {
        const hashesArray = Array.from(this.seenHashes);
        this.seenHashes = new Set(hashesArray.slice(50000));
      }
    }

    this.buffer.push(entry);

    // Check if buffer is full
    if (this.buffer.length >= this.options.batchSize) {
      this.flush('full');
    }
  }

  /**
   * Hash a log entry for deduplication
   */
  private hashEntry(entry: LogEntry): string {
    const key = `${entry.service}:${entry.level}:${entry.message}:${hashMetadata(
      entry.metadata ?? {}
    )}`;
    return hashMetadata({ key });
  }

  /**
   * Flush buffer to create a batch
   */
  public flush(reason = 'manual'): LogBatch | null {
    if (this.buffer.length === 0) {
      return null;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    const batchMetadata: BatchMetadata = {
      batchId: generateLogId(),
      timestamp: now(),
      count: entries.length,
      sizeBytes: calculateBatchSize(entries),
      source: this.config.service,
      compression: this.options.compression,
    };

    const batch: LogBatch = {
      entries,
      metadata: batchMetadata,
    };

    if (reason === 'full') {
      this.emit('batch:full', batch);
    } else if (reason === 'timeout') {
      this.emit('buffer:timeout', batch);
    }

    this.emit('batch:flushed', batch);

    this.logger.debug('Batch flushed', {
      reason,
      count: batchMetadata.count,
      size: batchMetadata.sizeBytes,
    });

    return batch;
  }

  /**
   * Get buffer size
   */
  public getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Get buffer size in bytes
   */
  public getBufferSizeBytes(): number {
    return calculateBatchSize(this.buffer);
  }

  /**
   * Get queue status
   */
  public getQueueStatus(): {
    size: number;
    pending: number;
    concurrency: number;
  } {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      concurrency: this.queue.concurrency,
    };
  }

  /**
   * Clear deduplication cache
   */
  public clearDeduplicationCache(): void {
    this.seenHashes.clear();
  }

  /**
   * Shutdown the collector
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down log collector');

    this.stopBufferTimer();

    // Wait for queue to empty
    await this.queue.onIdle();

    // Flush any remaining logs
    const finalBatch = this.flush('shutdown');
    if (finalBatch) {
      this.logger.info('Flushed final batch on shutdown', {
        count: finalBatch.metadata.count,
      });
    }

    this.logger.info('Log collector shutdown complete');
  }

  /**
   * Update collector options
   */
  public updateOptions(options: Partial<CollectionOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };

    // Restart buffer timer if timeout changed
    if (options.bufferTimeout !== undefined) {
      this.startBufferTimer();
    }
  }

  /**
   * Get current options
   */
  public getOptions(): Required<CollectionOptions> {
    return { ...this.options };
  }

  /**
   * Get collector stats
   */
  public getStats(): {
    bufferSize: number;
    bufferSizeBytes: number;
    deduplicationCacheSize: number;
    queueStatus: ReturnType<LogCollector['getQueueStatus']>;
  } {
    return {
      bufferSize: this.getBufferSize(),
      bufferSizeBytes: this.getBufferSizeBytes(),
      deduplicationCacheSize: this.seenHashes.size,
      queueStatus: this.getQueueStatus(),
    };
  }

  /**
   * Create a child collector with different service
   */
  public child(service: string, options?: Partial<CollectionOptions>): LogCollector {
    const childConfig: CollectorConfig = {
      service,
      environment: this.config.environment,
      host: this.config.host,
      options: { ...this.options, ...options },
      defaultTags: this.config.defaultTags,
      defaultContext: this.config.defaultContext,
    };

    const child = new LogCollector(childConfig);

    // Forward events from child to parent
    child.on('log:received', (entry) => this.emit('log:received', entry));
    child.on('log:error', (data) => this.emit('log:error', data));
    child.on('batch:flushed', (batch) => this.emit('batch:flushed', batch));

    return child;
  }
}

/**
 * Create a log collector instance
 */
export function createLogCollector(config: CollectorConfig): LogCollector {
  return new LogCollector(config);
}
