// @ts-nocheck
/**
 * In-memory storage implementations for testing and development
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Webhook,
  WebhookDelivery,
  DeadLetterItem,
  WebhookAnalytics,
} from '../types/webhook.js';
import type {
  IWebhookStorage,
  IWebhookDeliveryStorage,
  IDeadLetterStorage,
  IAnalyticsStorage,
  IKVStorage,
  ListOptions,
  PaginatedResult,
  DeliveryStatistics,
  AnalyticsPeriod,
  TimeSeriesData,
} from '../types/storage.js';

/**
 * In-memory webhook storage
 */
export class MemoryWebhookStorage implements IWebhookStorage {
  private webhooks: Map<string, Webhook>;

  constructor() {
    this.webhooks = new Map();
  }

  async create(webhook: Omit<Webhook, 'id' | 'createdAt' | 'updatedAt' | 'statistics'>): Promise<Webhook> {
    const now = new Date();
    const newWebhook: Webhook = {
      ...webhook,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      statistics: {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        pendingDeliveries: 0,
        averageDeliveryTime: 0,
        successRate: 1,
        failureRate: 0,
      },
    };

    this.webhooks.set(newWebhook.id, newWebhook);
    return newWebhook;
  }

  async getById(id: string): Promise<Webhook | null> {
    return this.webhooks.get(id) || null;
  }

  async getByUserId(userId: string, options?: ListOptions): Promise<Webhook[]> {
    return Array.from(this.webhooks.values())
      .filter(w => w.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getByProjectId(projectId: string, options?: ListOptions): Promise<Webhook[]> {
    return Array.from(this.webhooks.values())
      .filter(w => w.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getByEventType(eventType: string, options?: ListOptions): Promise<Webhook[]> {
    return Array.from(this.webhooks.values())
      .filter(w => w.events.includes(eventType as any))
      .filter(w => w.active);
  }

  async update(id: string, updates: Partial<Webhook>): Promise<Webhook> {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const updated = { ...webhook, ...updates, updatedAt: new Date() };
    this.webhooks.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.webhooks.delete(id);
  }

  async activate(id: string): Promise<Webhook> {
    return this.update(id, { active: true });
  }

  async deactivate(id: string): Promise<Webhook> {
    return this.update(id, { active: false });
  }

  async list(options?: ListOptions): Promise<PaginatedResult<Webhook>> {
    let items = Array.from(this.webhooks.values());

    // Apply sorting
    const sortBy = options?.sortBy || 'createdAt';
    const sortOrder = options?.sortOrder || 'desc';
    items.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      const result = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortOrder === 'desc' ? -result : result;
    });

    // Apply pagination
    const skip = options?.skip || 0;
    const limit = options?.limit || 50;
    const paginatedItems = items.slice(skip, skip + limit);

    return {
      items: paginatedItems,
      total: items.length,
      skip,
      limit,
      hasMore: skip + limit < items.length,
    };
  }

  async updateStatistics(id: string, stats: Partial<Webhook['statistics']>): Promise<void> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return;

    webhook.statistics = { ...webhook.statistics, ...stats };
  }

  async getActive(options?: ListOptions): Promise<Webhook[]> {
    return Array.from(this.webhooks.values())
      .filter(w => w.active)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

/**
 * In-memory delivery storage
 */
export class MemoryDeliveryStorage implements IWebhookDeliveryStorage {
  private deliveries: Map<string, WebhookDelivery>;

  constructor() {
    this.deliveries = new Map();
  }

  async create(delivery: Omit<WebhookDelivery, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookDelivery> {
    const now = new Date();
    const newDelivery: WebhookDelivery = {
      ...delivery,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    this.deliveries.set(newDelivery.id, newDelivery);
    return newDelivery;
  }

  async getById(id: string): Promise<WebhookDelivery | null> {
    return this.deliveries.get(id) || null;
  }

  async getByWebhookId(webhookId: string, options?: ListOptions): Promise<WebhookDelivery[]> {
    return Array.from(this.deliveries.values())
      .filter(d => d.webhookId === webhookId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getByEventId(eventId: string): Promise<WebhookDelivery[]> {
    return Array.from(this.deliveries.values())
      .filter(d => d.eventId === eventId);
  }

  async getPending(options?: ListOptions): Promise<WebhookDelivery[]> {
    return Array.from(this.deliveries.values())
      .filter(d => d.status === 'pending' || d.status === 'retrying');
  }

  async getFailed(options?: ListOptions): Promise<WebhookDelivery[]> {
    return Array.from(this.deliveries.values())
      .filter(d => d.status === 'failed');
  }

  async update(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery> {
    const delivery = this.deliveries.get(id);
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    const updated = { ...delivery, ...updates, updatedAt: new Date() };
    this.deliveries.set(id, updated);
    return updated;
  }

  async list(options?: ListOptions): Promise<PaginatedResult<WebhookDelivery>> {
    let items = Array.from(this.deliveries.values());

    const sortBy = options?.sortBy || 'createdAt';
    const sortOrder = options?.sortOrder || 'desc';
    items.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      const result = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortOrder === 'desc' ? -result : result;
    });

    const skip = options?.skip || 0;
    const limit = options?.limit || 50;
    const paginatedItems = items.slice(skip, skip + limit);

    return {
      items: paginatedItems,
      total: items.length,
      skip,
      limit,
      hasMore: skip + limit < items.length,
    };
  }

  async deleteOld(before: Date): Promise<number> {
    let count = 0;
    for (const [id, delivery] of this.deliveries.entries()) {
      if (delivery.createdAt.getTime() < before.getTime()) {
        this.deliveries.delete(id);
        count++;
      }
    }
    return count;
  }

  async getStatistics(webhookId?: string): Promise<DeliveryStatistics> {
    let deliveries = Array.from(this.deliveries.values());

    if (webhookId) {
      deliveries = deliveries.filter(d => d.webhookId === webhookId);
    }

    const successful = deliveries.filter(d => d.status === 'success').length;
    const failed = deliveries.filter(d => d.status === 'failed').length;
    const pending = deliveries.filter(d => d.status === 'pending').length;
    const retrying = deliveries.filter(d => d.status === 'retrying').length;

    const durations = deliveries
      .filter(d => d.deliveredAt)
      .map(d => d.duration);
    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      total: deliveries.length,
      successful,
      failed,
      pending,
      retrying,
      deadLettered: 0,
      averageDuration,
      successRate: deliveries.length > 0 ? successful / deliveries.length : 1,
      byEventType: {},
      byHour: [],
    };
  }
}

/**
 * In-memory KV storage
 */
export class MemoryKVStorage implements IKVStorage {
  private store: Map<string, { value: string; expires?: number }>;

  constructor() {
    this.store = new Map();

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expires && Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, expiration?: number): Promise<void> {
    const expires = expiration ? Date.now() + expiration : undefined;
    this.store.set(key, { value, expires });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);

    if (!entry) {
      return false;
    }

    if (entry.expires && Date.now() > entry.expires) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  async getMultiple(keys: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    for (const key of keys) {
      const value = await this.get(key);
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  async setMultiple(entries: Map<string, string>, expiration?: number): Promise<void> {
    for (const [key, value] of entries.entries()) {
      await this.set(key, value, expiration);
    }
  }

  async increment(key: string, delta: number = 1): Promise<number> {
    const currentValue = await this.get(key);
    const current = currentValue ? parseInt(currentValue, 10) : 0;
    const newValue = current + delta;
    await this.set(key, newValue.toString());
    return newValue;
  }

  async getAndSet(key: string, value: string): Promise<string | null> {
    const current = await this.get(key);
    await this.set(key, value);
    return current;
  }

  async list(prefix: string, limit: number = 100): Promise<string[]> {
    const keys = Array.from(this.store.keys())
      .filter(key => key.startsWith(prefix))
      .slice(0, limit);

    return keys;
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.expires && now > entry.expires) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * In-memory analytics storage
 */
export class MemoryAnalyticsStorage implements IAnalyticsStorage {
  private deliveryRecords: WebhookDelivery[];

  constructor() {
    this.deliveryRecords = [];
  }

  async recordDelivery(delivery: WebhookDelivery): Promise<void> {
    this.deliveryRecords.push(delivery);
  }

  async getWebhookAnalytics(webhookId: string, period: AnalyticsPeriod): Promise<WebhookAnalytics> {
    const records = this.deliveryRecords.filter(d =>
      d.webhookId === webhookId &&
      d.createdAt >= period.start &&
      d.createdAt <= period.end
    );

    return this.buildAnalytics(records, period);
  }

  async getGlobalAnalytics(period: AnalyticsPeriod): Promise<WebhookAnalytics> {
    const records = this.deliveryRecords.filter(d =>
      d.createdAt >= period.start &&
      d.createdAt <= period.end
    );

    return this.buildAnalytics(records, period);
  }

  async aggregateByTime(
    webhookId: string | null,
    period: AnalyticsPeriod
  ): Promise<TimeSeriesData[]> {
    let records = this.deliveryRecords.filter(d =>
      d.createdAt >= period.start &&
      d.createdAt <= period.end
    );

    if (webhookId) {
      records = records.filter(d => d.webhookId === webhookId);
    }

    // Group by hour
    const byHour = new Map<number, TimeSeriesData>();

    for (const record of records) {
      const hour = Math.floor(record.createdAt.getTime() / 3600000) * 3600000;

      if (!byHour.has(hour)) {
        byHour.set(hour, {
          timestamp: new Date(hour),
          count: 0,
          successCount: 0,
          failureCount: 0,
          averageLatency: 0,
        });
      }

      const data = byHour.get(hour)!;
      data.count++;
      if (record.status === 'success') {
        data.successCount++;
      } else {
        data.failureCount++;
      }
    }

    return Array.from(byHour.values()).sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  private buildAnalytics(records: WebhookDelivery[], period: AnalyticsPeriod): WebhookAnalytics {
    const successful = records.filter(r => r.status === 'success');
    const failed = records.filter(r => r.status === 'failed');

    const latencies = records.map(r => r.duration).sort((a, b) => a - b);

    const byEventType: Record<string, number> = {};
    for (const record of records) {
      byEventType[record.eventType] = (byEventType[record.eventType] || 0) + 1;
    }

    const byStatus: Record<string, number> = {};
    for (const record of records) {
      byStatus[record.status] = (byStatus[record.status] || 0) + 1;
    }

    // By hour breakdown
    const byHour = new Array(24).fill(0);
    for (const record of records) {
      const hour = record.createdAt.getHours();
      byHour[hour]++;
    }

    return {
      webhookId: '',
      period,
      metrics: {
        totalEvents: records.length,
        deliveredEvents: successful.length,
        failedEvents: failed.length,
        averageLatency: latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
        p50Latency: this.percentile(latencies, 50),
        p95Latency: this.percentile(latencies, 95),
        p99Latency: this.percentile(latencies, 99),
        throughput: records.length / ((period.end.getTime() - period.start.getTime()) / 1000),
      },
      breakdown: {
        byEventType: byEventType as any,
        byStatus: byStatus as any,
        byHour,
      },
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

/**
 * In-memory dead letter storage
 */
export class MemoryDeadLetterStorage implements IDeadLetterStorage {
  private items: Map<string, DeadLetterItem>;

  constructor() {
    this.items = new Map();
  }

  async create(item: Omit<DeadLetterItem, 'id' | 'createdAt'>): Promise<DeadLetterItem> {
    const newItem: DeadLetterItem = {
      ...item,
      id: uuidv4(),
      createdAt: new Date(),
    };

    this.items.set(newItem.id, newItem);
    return newItem;
  }

  async getById(id: string): Promise<DeadLetterItem | null> {
    return this.items.get(id) || null;
  }

  async getByWebhookId(webhookId: string, options?: ListOptions): Promise<DeadLetterItem[]> {
    return Array.from(this.items.values())
      .filter(i => i.webhookId === webhookId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async list(options?: ListOptions): Promise<PaginatedResult<DeadLetterItem>> {
    let items = Array.from(this.items.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const skip = options?.skip || 0;
    const limit = options?.limit || 50;
    const paginatedItems = items.slice(skip, skip + limit);

    return {
      items: paginatedItems,
      total: items.length,
      skip,
      limit,
      hasMore: skip + limit < items.length,
    };
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async retry(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;

    // In a real implementation, this would requeue the delivery
    this.items.delete(id);
    return true;
  }

  async deleteOld(before: Date): Promise<number> {
    let count = 0;
    for (const [id, item] of this.items.entries()) {
      if (item.createdAt.getTime() < before.getTime()) {
        this.items.delete(id);
        count++;
      }
    }
    return count;
  }

  async clear(): Promise<number> {
    const count = this.items.size;
    this.items.clear();
    return count;
  }
}
