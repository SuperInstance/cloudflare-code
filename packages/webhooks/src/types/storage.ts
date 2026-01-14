/**
 * Storage interfaces for webhook persistence
 */

import type { Webhook, WebhookDelivery, DeadLetterItem, WebhookAnalytics } from './webhook.js';

/**
 * Storage interface for webhook persistence
 */
export interface IWebhookStorage {
  /**
   * Create a new webhook
   */
  create(webhook: Omit<Webhook, 'id' | 'createdAt' | 'updatedAt' | 'statistics'>): Promise<Webhook>;

  /**
   * Get a webhook by ID
   */
  getById(id: string): Promise<Webhook | null>;

  /**
   * Get webhooks by user ID
   */
  getByUserId(userId: string, options?: ListOptions): Promise<Webhook[]>;

  /**
   * Get webhooks by project ID
   */
  getByProjectId(projectId: string, options?: ListOptions): Promise<Webhook[]>;

  /**
   * Get webhooks by event type
   */
  getByEventType(eventType: string, options?: ListOptions): Promise<Webhook[]>;

  /**
   * Update a webhook
   */
  update(id: string, updates: Partial<Webhook>): Promise<Webhook>;

  /**
   * Delete a webhook
   */
  delete(id: string): Promise<boolean>;

  /**
   * Activate a webhook
   */
  activate(id: string): Promise<Webhook>;

  /**
   * Deactivate a webhook
   */
  deactivate(id: string): Promise<Webhook>;

  /**
   * List webhooks with pagination
   */
  list(options?: ListOptions): Promise<PaginatedResult<Webhook>>;

  /**
   * Update webhook statistics
   */
  updateStatistics(id: string, stats: Partial<Webhook['statistics']>): Promise<void>;

  /**
   * Get active webhooks
   */
  getActive(options?: ListOptions): Promise<Webhook[]>;
}

/**
 * Storage interface for webhook delivery records
 */
export interface IWebhookDeliveryStorage {
  /**
   * Create a delivery record
   */
  create(delivery: Omit<WebhookDelivery, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookDelivery>;

  /**
   * Get a delivery by ID
   */
  getById(id: string): Promise<WebhookDelivery | null>;

  /**
   * Get deliveries by webhook ID
   */
  getByWebhookId(webhookId: string, options?: ListOptions): Promise<WebhookDelivery[]>;

  /**
   * Get deliveries by event ID
   */
  getByEventId(eventId: string): Promise<WebhookDelivery[]>;

  /**
   * Get pending deliveries
   */
  getPending(options?: ListOptions): Promise<WebhookDelivery[]>;

  /**
   * Get failed deliveries
   */
  getFailed(options?: ListOptions): Promise<WebhookDelivery[]>;

  /**
   * Update a delivery
   */
  update(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery>;

  /**
   * List deliveries with pagination
   */
  list(options?: ListOptions): Promise<PaginatedResult<WebhookDelivery>>;

  /**
   * Delete old deliveries
   */
  deleteOld(before: Date): Promise<number>;

  /**
   * Get delivery statistics
   */
  getStatistics(webhookId?: string): Promise<DeliveryStatistics>;
}

/**
 * Storage interface for dead letter queue
 */
export interface IDeadLetterStorage {
  /**
   * Add an item to dead letter queue
   */
  create(item: Omit<DeadLetterItem, 'id' | 'createdAt'>): Promise<DeadLetterItem>;

  /**
   * Get an item by ID
   */
  getById(id: string): Promise<DeadLetterItem | null>;

  /**
   * Get items by webhook ID
   */
  getByWebhookId(webhookId: string, options?: ListOptions): Promise<DeadLetterItem[]>;

  /**
   * List all items with pagination
   */
  list(options?: ListOptions): Promise<PaginatedResult<DeadLetterItem>>;

  /**
   * Delete an item
   */
  delete(id: string): Promise<boolean>;

  /**
   * Retry a dead letter item
   */
  retry(id: string): Promise<boolean>;

  /**
   * Delete old items
   */
  deleteOld(before: Date): Promise<number>;

  /**
   * Clear all items
   */
  clear(): Promise<number>;
}

/**
 * List options for pagination and filtering
 */
export interface ListOptions {
  skip?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, unknown>;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Delivery statistics
 */
export interface DeliveryStatistics {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  retrying: number;
  deadLettered: number;
  averageDuration: number;
  successRate: number;
  byEventType: Record<string, number>;
  byHour: number[];
}

/**
 * Analytics storage interface
 */
export interface IAnalyticsStorage {
  /**
   * Record a delivery metric
   */
  recordDelivery(delivery: WebhookDelivery): Promise<void>;

  /**
   * Get webhook analytics
   */
  getWebhookAnalytics(webhookId: string, period: AnalyticsPeriod): Promise<WebhookAnalytics>;

  /**
   * Get global analytics
   */
  getGlobalAnalytics(period: AnalyticsPeriod): Promise<WebhookAnalytics>;

  /**
   * Aggregate metrics by time period
   */
  aggregateByTime(webhookId: string | null, period: AnalyticsPeriod): Promise<TimeSeriesData[]>;
}

/**
 * Analytics period
 */
export interface AnalyticsPeriod {
  start: Date;
  end: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Time series data point
 */
export interface TimeSeriesData {
  timestamp: Date;
  count: number;
  successCount: number;
  failureCount: number;
  averageLatency: number;
}

/**
 * Key-value storage interface
 */
export interface IKVStorage {
  /**
   * Get a value by key
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value with optional expiration
   */
  set(key: string, value: string, expiration?: number): Promise<void>;

  /**
   * Delete a key
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get multiple values
   */
  getMultiple(keys: string[]): Promise<Map<string, string>>;

  /**
   * Set multiple values
   */
  setMultiple(entries: Map<string, string>, expiration?: number): Promise<void>;

  /**
   * Increment a counter
   */
  increment(key: string, delta?: number): Promise<number>;

  /**
   * Get and set (atomic)
   */
  getAndSet(key: string, value: string): Promise<string | null>;

  /**
   * List keys with prefix
   */
  list(prefix: string, limit?: number): Promise<string[]>;
}
