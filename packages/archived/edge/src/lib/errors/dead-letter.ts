/**
 * Dead Letter Queue
 *
 * Persistent storage for failed requests using R2.
 * Enables:
 * - Retry of failed requests
 * - Error analysis and debugging
 * - Request replay for testing
 * - Analytics on failure patterns
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import type { ChatRequest } from '../../types/index';
import { ErrorType } from './types';

// ============================================================================
// DEAD LETTER ENTRY TYPES
// ============================================================================

/**
 * Dead letter entry status
 */
export enum DeadLetterStatus {
  /** Pending retry */
  PENDING = 'pending',
  /** Currently retrying */
  RETRYING = 'retrying',
  /** Successfully recovered */
  RECOVERED = 'recovered',
  /** Permanently failed */
  FAILED = 'failed',
  /** Manually ignored */
  IGNORED = 'ignored',
}

/**
 * Retry priority
 */
export enum RetryPriority {
  /** Critical - retry immediately */
  CRITICAL = 'critical',
  /** High - retry soon */
  HIGH = 'high',
  /** Medium - normal retry */
  MEDIUM = 'medium',
  /** Low - retry when convenient */
  LOW = 'low',
}

// ============================================================================
// DEAD LETTER ENTRY
// ============================================================================

/**
 * Dead letter queue entry
 */
export interface DeadLetterEntry {
  /** Unique entry ID */
  id: string;
  /** Original request */
  request: ChatRequest;
  /** Error that caused failure */
  error: {
    message: string;
    code?: string;
    stack?: string;
    type: ErrorType;
  };
  /** Entry status */
  status: DeadLetterStatus;
  /** Retry priority */
  priority: RetryPriority;
  /** Number of retry attempts */
  retryAttempts: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Timestamp of original failure */
  failedAt: number;
  /** Timestamp of last retry attempt */
  lastRetryAt?: number;
  /** Timestamp of next retry */
  nextRetryAt?: number;
  /** Timestamp when entry was recovered/failed */
  resolvedAt?: number;
  /** Time to live (entry expires after this) */
  ttl: number;
  /** Provider that failed */
  provider?: string;
  /** Model that failed */
  model?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Recovery result (if recovered) */
  recoveryResult?: {
    success: boolean;
    response?: any;
    error?: string;
  };
}

// ============================================================================
// DEAD LETTER QUEUE CONFIGURATION
// ============================================================================

/**
 * Dead letter queue configuration
 */
export interface DeadLetterQueueConfig {
  /** R2 bucket for storage */
  bucket: R2Bucket;
  /** Key prefix for entries */
  keyPrefix: string;
  /** Default TTL for entries (ms) */
  defaultTTL: number;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Retry backoff multiplier */
  retryBackoffMultiplier: number;
  /** Initial retry delay (ms) */
  initialRetryDelay: number;
  /** Maximum retry delay (ms) */
  maxRetryDelay: number;
  /** Enable automatic retry */
  enableAutoRetry: boolean;
  /** Auto retry interval (ms) */
  autoRetryInterval: number;
  /** Maximum entries to keep */
  maxEntries: number;
  /** Enable metrics collection */
  enableMetrics: boolean;
}

// ============================================================================
// DEAD LETTER QUEUE METRICS
// ============================================================================

/**
 * Dead letter queue metrics
 */
export interface DeadLetterQueueMetrics {
  /** Total entries in queue */
  totalEntries: number;
  /** Entries by status */
  entriesByStatus: Record<DeadLetterStatus, number>;
  /** Entries by priority */
  entriesByPriority: Record<RetryPriority, number>;
  /** Entries by error type */
  entriesByErrorType: Record<ErrorType, number>;
  /** Total retry attempts */
  totalRetryAttempts: number;
  /** Successful recoveries */
  successfulRecoveries: number;
  /** Failed recoveries */
  failedRecoveries: number;
  /** Average retry attempts before recovery */
  avgRetryAttempts: number;
  /** Oldest entry timestamp */
  oldestEntryTimestamp?: number;
  /** Newest entry timestamp */
  newestEntryTimestamp?: number;
}

// ============================================================================
// DEAD LETTER QUEUE
// ============================================================================

/**
 * Dead letter queue for failed requests
 */
export class DeadLetterQueue {
  private config: DeadLetterQueueConfig;
  private metrics: DeadLetterQueueMetrics;
  private retryTimer?: ReturnType<typeof setInterval>;

  constructor(config: DeadLetterQueueConfig) {
    this.config = config;
    this.metrics = this.initializeMetrics();

    // Start auto retry if enabled
    if (this.config.enableAutoRetry) {
      this.startAutoRetry();
    }
  }

  /**
   * Add failed request to dead letter queue
   */
  async add(
    request: ChatRequest,
    error: Error,
    errorType: ErrorType,
    options?: {
      provider?: string;
      model?: string;
      priority?: RetryPriority;
      ttl?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const id = this.generateId();
    const now = Date.now();

    const entry: DeadLetterEntry = {
      id,
      request,
      error: {
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
        type: errorType,
      },
      status: DeadLetterStatus.PENDING,
      priority: options?.priority ?? this.determinePriority(errorType),
      retryAttempts: 0,
      maxRetries: this.config.maxRetries,
      failedAt: now,
      nextRetryAt: now + this.config.initialRetryDelay,
      ttl: options?.ttl ?? this.config.defaultTTL,
      provider: options?.provider,
      model: options?.model,
      metadata: options?.metadata,
    };

    // Store entry in R2
    const key = this.getEntryKey(id);
    await this.config.bucket.put(key, JSON.stringify(entry));

    // Update metrics
    this.updateMetrics(entry, 'added');

    return id;
  }

  /**
   * Get entry by ID
   */
  async get(id: string): Promise<DeadLetterEntry | null> {
    const key = this.getEntryKey(id);
    const object = await this.config.bucket.get(key);

    if (!object) {
      return null;
    }

    const entry = JSON.parse(await object.text()) as DeadLetterEntry;
    return entry;
  }

  /**
   * Update entry status
   */
  async updateStatus(
    id: string,
    status: DeadLetterStatus,
    result?: {
      success: boolean;
      response?: any;
      error?: string;
    }
  ): Promise<void> {
    const entry = await this.get(id);
    if (!entry) {
      throw new Error(`Entry ${id} not found`);
    }

    entry.status = status;
    if (status === DeadLetterStatus.RECOVERED || status === DeadLetterStatus.FAILED) {
      entry.resolvedAt = Date.now();
      entry.recoveryResult = result;
    }

    // Save updated entry
    const key = this.getEntryKey(id);
    await this.config.bucket.put(key, JSON.stringify(entry));

    // Update metrics
    this.updateMetrics(entry, 'updated');
  }

  /**
   * Retry a dead letter entry
   */
  async retry(
    id: string,
    retryFn: (request: ChatRequest) => Promise<any>
  ): Promise<boolean> {
    const entry = await this.get(id);
    if (!entry) {
      throw new Error(`Entry ${id} not found`);
    }

    // Check if should retry
    if (entry.retryAttempts >= entry.maxRetries) {
      await this.updateStatus(id, DeadLetterStatus.FAILED, {
        success: false,
        error: 'Max retry attempts exceeded',
      });
      return false;
    }

    // Update entry for retry
    entry.status = DeadLetterStatus.RETRYING;
    entry.retryAttempts++;
    entry.lastRetryAt = Date.now();

    // Calculate next retry time
    const delay = Math.min(
      this.config.initialRetryDelay *
        Math.pow(this.config.retryBackoffMultiplier, entry.retryAttempts),
      this.config.maxRetryDelay
    );
    entry.nextRetryAt = Date.now() + delay;

    // Save updated entry
    const key = this.getEntryKey(id);
    await this.config.bucket.put(key, JSON.stringify(entry));

    // Execute retry
    try {
      const response = await retryFn(entry.request);

      await this.updateStatus(id, DeadLetterStatus.RECOVERED, {
        success: true,
        response,
      });

      return true;
    } catch (error) {
      // Check if should retry again
      if (entry.retryAttempts < entry.maxRetries) {
        entry.status = DeadLetterStatus.PENDING;
        await this.config.bucket.put(key, JSON.stringify(entry));
      } else {
        await this.updateStatus(id, DeadLetterStatus.FAILED, {
          success: false,
          error: (error as Error).message,
        });
      }

      return false;
    }
  }

  /**
   * List entries with filtering
   */
  async list(filter?: {
    status?: DeadLetterStatus;
    priority?: RetryPriority;
    errorType?: ErrorType;
    provider?: string;
    limit?: number;
    offset?: number;
  }): Promise<DeadLetterEntry[]> {
    // List all objects with the prefix
    const listed = await this.config.bucket.list({
      prefix: this.config.keyPrefix,
      limit: filter?.limit ?? 100,
    });

    const entries: DeadLetterEntry[] = [];

    for (const object of listed.objects) {
      const text = await object.get()?.then(obj => obj?.text());
      if (!text) continue;

      const entry = JSON.parse(text) as DeadLetterEntry;

      // Apply filters
      if (filter?.status && entry.status !== filter.status) continue;
      if (filter?.priority && entry.priority !== filter.priority) continue;
      if (filter?.errorType && entry.error.type !== filter.errorType) continue;
      if (filter?.provider && entry.provider !== filter.provider) continue;

      entries.push(entry);
    }

    // Sort by failedAt (newest first)
    entries.sort((a, b) => b.failedAt - a.failedAt);

    // Apply offset
    if (filter?.offset) {
      return entries.slice(filter.offset);
    }

    return entries;
  }

  /**
   * Delete entry by ID
   */
  async delete(id: string): Promise<void> {
    const key = this.getEntryKey(id);
    await this.config.bucket.delete(key);

    // Update metrics
    const entry = await this.get(id);
    if (entry) {
      this.updateMetrics(entry, 'deleted');
    }
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    const listed = await this.config.bucket.list({
      prefix: this.config.keyPrefix,
    });

    const keys = listed.objects.map(obj => obj.key);
    if (keys.length > 0) {
      await this.config.bucket.delete(keys);
    }

    // Reset metrics
    this.metrics = this.initializeMetrics();
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<DeadLetterQueueMetrics> {
    // Refresh metrics by scanning entries
    const entries = await this.list();

    this.metrics = this.initializeMetrics();
    this.metrics.totalEntries = entries.length;

    for (const entry of entries) {
      this.updateMetrics(entry, 'scanned');
    }

    return { ...this.metrics };
  }

  /**
   * Get entries ready for retry
   */
  async getEntriesForRetry(): Promise<DeadLetterEntry[]> {
    const now = Date.now();
    const entries = await this.list({
      status: DeadLetterStatus.PENDING,
    });

    return entries.filter(entry =>
      entry.nextRetryAt && entry.nextRetryAt <= now
    );
  }

  /**
   * Retry all pending entries that are ready
   */
  async retryPending(retryFn: (request: ChatRequest) => Promise<any>): Promise<{
    successful: number;
    failed: number;
  }> {
    const entries = await this.getEntriesForRetry();

    let successful = 0;
    let failed = 0;

    for (const entry of entries) {
      const result = await this.retry(entry.id, retryFn);
      if (result) {
        successful++;
      } else {
        failed++;
      }
    }

    return { successful, failed };
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    const entries = await this.list();

    let deleted = 0;

    for (const entry of entries) {
      // Check if entry expired
      if (entry.failedAt + entry.ttl < now) {
        await this.delete(entry.id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Stop auto retry
   */
  stopAutoRetry(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  /**
   * Start auto retry
   */
  private startAutoRetry(): void {
    this.retryTimer = setInterval(async () => {
      // Auto retry logic would be called here
      // This would typically be triggered by a cron job or scheduled event
    }, this.config.autoRetryInterval);
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): DeadLetterQueueMetrics {
    return {
      totalEntries: 0,
      entriesByStatus: {
        [DeadLetterStatus.PENDING]: 0,
        [DeadLetterStatus.RETRYING]: 0,
        [DeadLetterStatus.RECOVERED]: 0,
        [DeadLetterStatus.FAILED]: 0,
        [DeadLetterStatus.IGNORED]: 0,
      },
      entriesByPriority: {
        [RetryPriority.CRITICAL]: 0,
        [RetryPriority.HIGH]: 0,
        [RetryPriority.MEDIUM]: 0,
        [RetryPriority.LOW]: 0,
      },
      entriesByErrorType: {} as Record<ErrorType, number>,
      totalRetryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      avgRetryAttempts: 0,
    };
  }

  /**
   * Update metrics
   */
  private updateMetrics(entry: DeadLetterEntry, operation: 'added' | 'updated' | 'deleted' | 'scanned'): void {
    if (operation === 'added') {
      this.metrics.entriesByStatus[entry.status]++;
      this.metrics.entriesByPriority[entry.priority]++;
      this.metrics.entriesByErrorType[entry.error.type] =
        (this.metrics.entriesByErrorType[entry.error.type] || 0) + 1;
      this.metrics.totalEntries++;

      if (!this.metrics.oldestEntryTimestamp || entry.failedAt < this.metrics.oldestEntryTimestamp) {
        this.metrics.oldestEntryTimestamp = entry.failedAt;
      }
      if (!this.metrics.newestEntryTimestamp || entry.failedAt > this.metrics.newestEntryTimestamp) {
        this.metrics.newestEntryTimestamp = entry.failedAt;
      }
    } else if (operation === 'updated') {
      if (entry.status === DeadLetterStatus.RECOVERED) {
        this.metrics.successfulRecoveries++;
        this.metrics.totalRetryAttempts += entry.retryAttempts;
      } else if (entry.status === DeadLetterStatus.FAILED) {
        this.metrics.failedRecoveries++;
        this.metrics.totalRetryAttempts += entry.retryAttempts;
      }

      // Calculate average
      const total = this.metrics.successfulRecoveries + this.metrics.failedRecoveries;
      if (total > 0) {
        this.metrics.avgRetryAttempts = this.metrics.totalRetryAttempts / total;
      }
    } else if (operation === 'deleted') {
      this.metrics.entriesByStatus[entry.status]--;
      this.metrics.entriesByPriority[entry.priority]--;
      this.metrics.entriesByErrorType[entry.error.type]--;
      this.metrics.totalEntries--;
    } else if (operation === 'scanned') {
      this.metrics.entriesByStatus[entry.status]++;
      this.metrics.entriesByPriority[entry.priority]++;
      this.metrics.entriesByErrorType[entry.error.type] =
        (this.metrics.entriesByErrorType[entry.error.type] || 0) + 1;

      if (!this.metrics.oldestEntryTimestamp || entry.failedAt < this.metrics.oldestEntryTimestamp) {
        this.metrics.oldestEntryTimestamp = entry.failedAt;
      }
      if (!this.metrics.newestEntryTimestamp || entry.failedAt > this.metrics.newestEntryTimestamp) {
        this.metrics.newestEntryTimestamp = entry.failedAt;
      }
    }
  }

  /**
   * Determine priority from error type
   */
  private determinePriority(errorType: ErrorType): RetryPriority {
    // Critical errors
    if (errorType === ErrorType.QUOTA_EXCEEDED ||
        errorType === ErrorType.ACCOUNT_SUSPENDED) {
      return RetryPriority.CRITICAL;
    }

    // High priority
    if (errorType === ErrorType.UNAUTHORIZED ||
        errorType === ErrorType.INVALID_API_KEY) {
      return RetryPriority.HIGH;
    }

    // Medium priority (transient errors)
    if (errorType === ErrorType.RATE_LIMITED ||
        errorType === ErrorType.TIMEOUT ||
        errorType === ErrorType.PROVIDER_UNAVAILABLE) {
      return RetryPriority.MEDIUM;
    }

    // Low priority
    return RetryPriority.LOW;
  }

  /**
   * Generate unique entry ID
   */
  private generateId(): string {
    return `dle_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get storage key for entry
   */
  private getEntryKey(id: string): string {
    return `${this.config.keyPrefix}/${id}.json`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create dead letter queue with default configuration
 */
export function createDeadLetterQueue(
  bucket: R2Bucket,
  config?: Partial<DeadLetterQueueConfig>
): DeadLetterQueue {
  const defaultConfig: DeadLetterQueueConfig = {
    bucket,
    keyPrefix: 'dead-letter-queue',
    defaultTTL: 86400000, // 24 hours
    maxRetries: 3,
    retryBackoffMultiplier: 2,
    initialRetryDelay: 60000, // 1 minute
    maxRetryDelay: 3600000, // 1 hour
    enableAutoRetry: false,
    autoRetryInterval: 300000, // 5 minutes
    maxEntries: 10000,
    enableMetrics: true,
  };

  return new DeadLetterQueue({
    ...defaultConfig,
    ...config,
  });
}

/**
 * Create dead letter queue for critical failures
 */
export function createCriticalDeadLetterQueue(
  bucket: R2Bucket
): DeadLetterQueue {
  return createDeadLetterQueue(bucket, {
    keyPrefix: 'dead-letter-queue/critical',
    defaultTTL: 604800000, // 7 days
    maxRetries: 5,
    initialRetryDelay: 10000, // 10 seconds
    enableAutoRetry: true,
    autoRetryInterval: 60000, // 1 minute
  });
}

/**
 * Create dead letter queue for transient failures
 */
export function createTransientDeadLetterQueue(
  bucket: R2Bucket
): DeadLetterQueue {
  return createDeadLetterQueue(bucket, {
    keyPrefix: 'dead-letter-queue/transient',
    defaultTTL: 3600000, // 1 hour
    maxRetries: 3,
    initialRetryDelay: 5000, // 5 seconds
    enableAutoRetry: true,
    autoRetryInterval: 30000, // 30 seconds
  });
}
