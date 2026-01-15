/**
 * Rate Limit Analytics
 *
 * Collects, aggregates, and analyzes rate limiting metrics.
 * Provides insights into usage patterns, blocked requests, and tier distribution.
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type {
  RateLimitEvent,
  RateLimitAnalytics as RateLimitAnalyticsType,
  RateLimitScope,
  SubscriptionTier,
  RateLimitStats,
  RateLimitLogEntry,
} from './types';

/**
 * Analytics aggregation window
 */
export type AnalyticsWindow = 'minute' | 'hour' | 'day' | 'week' | 'month';

/**
 * Analytics data point
 */
export interface AnalyticsDataPoint {
  timestamp: number;
  totalRequests: number;
  blockedRequests: number;
  requestsByTier: Map<SubscriptionTier, number>;
  requestsByScope: Map<RateLimitScope, number>;
  requestsByEndpoint: Map<string, number>;
  peakRPS: number;
}

/**
 * Analytics options
 */
export interface AnalyticsOptions {
  /**
   * KV namespace for persistence
   */
  kv?: KVNamespace;

  /**
   * Enable persistent storage
   */
  enablePersistence?: boolean;

  /**
   * Retention period for analytics (seconds)
   */
  retention?: number;

  /**
   * Maximum events to keep in memory
   */
  maxEvents?: number;

  /**
   * Aggregation window
   */
  aggregationWindow?: AnalyticsWindow;
}

/**
 * Rate Limit Analytics
 *
 * Tracks and analyzes rate limiting events.
 */
export class RateLimitAnalytics {
  private kv?: KVNamespace;
  private options: Required<Omit<AnalyticsOptions, 'kv'>>;
  private events: RateLimitLogEntry[] = [];
  private hourlyData: Map<string, AnalyticsDataPoint> = new Map();
  private dailyData: Map<string, AnalyticsDataPoint> = new Map();
  private currentWindow: AnalyticsDataPoint;

  constructor(options: AnalyticsOptions = {}) {
    this.kv = options.kv;
    this.options = {
      enablePersistence: options.enablePersistence ?? true,
      retention: options.retention ?? 7 * 24 * 60 * 60, // 7 days
      maxEvents: options.maxEvents ?? 10000,
      aggregationWindow: options.aggregationWindow ?? 'hour',
    };

    this.currentWindow = this.createDataPoint();
  }

  /**
   * Record a rate limit event
   */
  async recordEvent(event: RateLimitEvent): Promise<void> {
    const entry: RateLimitLogEntry = {
      timestamp: event.timestamp,
      identifier: event.identifier,
      scope: event.scope,
      tier: event.tier,
      endpoint: event.endpoint,
      allowed: event.type === 'allow',
      remaining: event.decision?.remaining ?? 0,
      limit: event.decision?.limit ?? 0,
      metadata: event.metadata,
    };

    this.events.push(entry);

    // Trim events if needed
    if (this.events.length > this.options.maxEvents) {
      this.events = this.events.slice(-this.options.maxEvents);
    }

    // Update current window
    this.updateCurrentWindow(entry);

    // Persist if enabled
    if (this.options.enablePersistence && this.kv) {
      await this.persistEvents();
    }
  }

  /**
   * Get analytics for a time window
   */
  async getAnalytics(
    windowStart: number,
    windowEnd: number = Date.now()
  ): Promise<RateLimitAnalytics> {
    const filteredEvents = this.events.filter(
      (e) => e.timestamp >= windowStart && e.timestamp <= windowEnd
    );

    const totalRequests = filteredEvents.length;
    const blockedRequests = filteredEvents.filter((e) => !e.allowed).length;

    // Group by identifier for top blocked
    const blockedByIdentifier = new Map<string, number>();
    for (const event of filteredEvents) {
      if (!event.allowed) {
        const count = blockedByIdentifier.get(event.identifier) || 0;
        blockedByIdentifier.set(event.identifier, count + 1);
      }
    }

    const topBlocked = Array.from(blockedByIdentifier.entries())
      .map(([identifier, count]) => ({
        identifier,
        count,
        percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Group by tier
    const requestsByTier = this.groupByTier(filteredEvents, totalRequests);

    // Group by scope
    const requestsByScope = this.groupByScope(filteredEvents, totalRequests);

    // Group by endpoint
    const requestsByEndpoint = this.groupByEndpoint(filteredEvents);

    // Calculate peak usage
    const { peakTime, peakRPS } = this.calculatePeakUsage(filteredEvents);

    return {
      windowStart,
      windowEnd,
      totalRequests,
      blockedRequests,
      blockRate: totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0,
      topBlocked,
      requestsByTier,
      requestsByScope,
      requestsByEndpoint,
      peakUsageTime: peakTime,
      peakRPS: peakRPS,
    };
  }

  /**
   * Get statistics for a specific identifier
   */
  async getStats(identifier: string): Promise<RateLimitStats | null> {
    const identifierEvents = this.events.filter((e) => e.identifier === identifier);

    if (identifierEvents.length === 0) {
      return null;
    }

    const sortedEvents = identifierEvents.sort((a, b) => a.timestamp - b.timestamp);

    const allowedRequests = identifierEvents.filter((e) => e.allowed).length;
    const blockedRequests = identifierEvents.filter((e) => !e.allowed).length;

    const firstRequest = sortedEvents[0].timestamp;
    const lastRequest = sortedEvents[sortedEvents.length - 1].timestamp;

    const currentUsage = sortedEvents[sortedEvents.length - 1].limit -
      sortedEvents[sortedEvents.length - 1].remaining;

    const peakUsage = Math.max(
      ...identifierEvents.map((e) => e.limit - e.remaining)
    );

    const elapsed = (lastRequest - firstRequest) / 1000;
    const requestsPerSecond = elapsed > 0 ? identifierEvents.length / elapsed : 0;
    const requestsPerMinute = requestsPerSecond * 60;

    return {
      totalRequests: identifierEvents.length,
      allowedRequests,
      blockedRequests,
      allowRate: (allowedRequests / identifierEvents.length) * 100,
      currentUsage,
      peakUsage,
      firstRequest,
      lastRequest,
      requestsPerMinute,
      requestsPerSecond,
    };
  }

  /**
   * Get top blocked identifiers
   */
  getTopBlocked(limit: number = 10, timeWindow?: number): Array<{
    identifier: string;
    count: number;
    blockRate: number;
  }> {
    let filtered = this.events;

    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filtered = this.events.filter((e) => e.timestamp >= cutoff);
    }

    const blockedMap = new Map<string, { blocked: number; total: number }>();

    for (const event of filtered) {
      const existing = blockedMap.get(event.identifier) || {
        blocked: 0,
        total: 0,
      };
      existing.total++;
      if (!event.allowed) {
        existing.blocked++;
      }
      blockedMap.set(event.identifier, existing);
    }

    return Array.from(blockedMap.entries())
      .map(([identifier, { blocked, total }]) => ({
        identifier,
        count: blocked,
        blockRate: total > 0 ? (blocked / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get usage by tier
   */
  async getUsageByTier(
    timeWindow?: number
  ): Promise<Array<{ tier: SubscriptionTier; requests: number; percentage: number }>> {
    let filtered = this.events;

    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filtered = this.events.filter((e) => e.timestamp >= cutoff);
    }

    const tierMap = new Map<SubscriptionTier, number>();

    for (const event of filtered) {
      if (event.tier) {
        const count = tierMap.get(event.tier) || 0;
        tierMap.set(event.tier, count + 1);
      }
    }

    const total = filtered.length;

    return Array.from(tierMap.entries()).map(([tier, requests]) => ({
      tier,
      requests,
      percentage: total > 0 ? (requests / total) * 100 : 0,
    }));
  }

  /**
   * Get usage by endpoint
   */
  async getUsageByEndpoint(
    timeWindow?: number
  ): Promise<Array<{ endpoint: string; requests: number; blocked: number; blockRate: number }>> {
    let filtered = this.events;

    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filtered = this.events.filter((e) => e.timestamp >= cutoff);
    }

    const endpointMap = new Map<string, { total: number; blocked: number }>();

    for (const event of filtered) {
      const endpoint = event.endpoint || 'unknown';
      const existing = endpointMap.get(endpoint) || { total: 0, blocked: 0 };
      existing.total++;
      if (!event.allowed) {
        existing.blocked++;
      }
      endpointMap.set(endpoint, existing);
    }

    return Array.from(endpointMap.entries())
      .map(([endpoint, { total, blocked }]) => ({
        endpoint,
        requests: total,
        blocked,
        blockRate: total > 0 ? (blocked / total) * 100 : 0,
      }))
      .sort((a, b) => b.requests - a.requests);
  }

  /**
   * Get hourly aggregated data
   */
  getHourlyData(hours: number = 24): AnalyticsDataPoint[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return Array.from(this.hourlyData.values())
      .filter((d) => d.timestamp >= cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get daily aggregated data
   */
  getDailyData(days: number = 7): AnalyticsDataPoint[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return Array.from(this.dailyData.values())
      .filter((d) => d.timestamp >= cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get time series data
   */
  async getTimeSeries(
    windowStart: number,
    windowEnd: number,
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<Array<{ timestamp: number; requests: number; blocked: number }>> {
    const filtered = this.events.filter(
      (e) => e.timestamp >= windowStart && e.timestamp <= windowEnd
    );

    const timeMap = new Map<number, { requests: number; blocked: number }>();

    for (const event of filtered) {
      let bucketTimestamp: number;

      switch (granularity) {
        case 'minute':
          bucketTimestamp =
            Math.floor(event.timestamp / 60000) * 60000;
          break;
        case 'hour':
          bucketTimestamp =
            Math.floor(event.timestamp / 3600000) * 3600000;
          break;
        case 'day':
          bucketTimestamp =
            Math.floor(event.timestamp / 86400000) * 86400000;
          break;
      }

      const existing = timeMap.get(bucketTimestamp) || {
        requests: 0,
        blocked: 0,
      };
      existing.requests++;
      if (!event.allowed) {
        existing.blocked++;
      }
      timeMap.set(bucketTimestamp, existing);
    }

    return Array.from(timeMap.entries())
      .map(([timestamp, { requests, blocked }]) => ({
        timestamp,
        requests,
        blocked,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Generate analytics report
   */
  async generateReport(
    windowStart?: number,
    windowEnd?: number
  ): Promise<{
    summary: RateLimitAnalyticsType;
    topEndpoints: Array<{ endpoint: string; requests: number; blocked: number }>;
    topBlocked: Array<{ identifier: string; count: number }>;
    tierDistribution: Array<{ tier: string; requests: number; percentage: number }>;
    timeSeries: Array<{ timestamp: number; requests: number; blocked: number }>;
  }> {
    const start = windowStart || Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    const end = windowEnd || Date.now();

    const [
      summary,
      topEndpoints,
      topBlocked,
      tierDistribution,
      timeSeries,
    ] = await Promise.all([
      this.getAnalytics(start, end),
      this.getUsageByEndpoint(end - start),
      Promise.resolve(this.getTopBlocked(20, end - start)),
      this.getUsageByTier(end - start),
      this.getTimeSeries(start, end, 'hour'),
    ]);

    return {
      summary,
      topEndpoints,
      topBlocked,
      tierDistribution,
      timeSeries,
    };
  }

  /**
   * Clear old events
   */
  async cleanup(retentionMs?: number): Promise<void> {
    const retention = retentionMs || this.options.retention * 1000;
    const cutoff = Date.now() - retention;

    this.events = this.events.filter((e) => e.timestamp >= cutoff);

    // Also clean up aggregated data
    for (const [key, data] of this.hourlyData.entries()) {
      if (data.timestamp < cutoff) {
        this.hourlyData.delete(key);
      }
    }

    for (const [key, data] of this.dailyData.entries()) {
      if (data.timestamp < cutoff) {
        this.dailyData.delete(key);
      }
    }

    if (this.options.enablePersistence && this.kv) {
      await this.persistEvents();
    }
  }

  /**
   * Export analytics data
   */
  async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (format === 'csv') {
      const headers = [
        'timestamp',
        'identifier',
        'scope',
        'tier',
        'endpoint',
        'allowed',
        'remaining',
        'limit',
      ];

      const rows = this.events.map((e) => [
        e.timestamp,
        e.identifier,
        e.scope,
        e.tier || '',
        e.endpoint || '',
        e.allowed,
        e.remaining,
        e.limit,
      ]);

      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Update current window data
   */
  private updateCurrentWindow(entry: RateLimitLogEntry): void {
    this.currentWindow.totalRequests++;

    if (!entry.allowed) {
      this.currentWindow.blockedRequests++;
    }

    if (entry.tier) {
      const count = this.currentWindow.requestsByTier.get(entry.tier) || 0;
      this.currentWindow.requestsByTier.set(entry.tier, count + 1);
    }

    const scopeCount = this.currentWindow.requestsByScope.get(entry.scope) || 0;
    this.currentWindow.requestsByScope.set(entry.scope, scopeCount + 1);

    if (entry.endpoint) {
      const endpointCount =
        this.currentWindow.requestsByEndpoint.get(entry.endpoint) || 0;
      this.currentWindow.requestsByEndpoint.set(entry.endpoint, endpointCount + 1);
    }
  }

  /**
   * Create new data point
   */
  private createDataPoint(): AnalyticsDataPoint {
    return {
      timestamp: Date.now(),
      totalRequests: 0,
      blockedRequests: 0,
      requestsByTier: new Map(),
      requestsByScope: new Map(),
      requestsByEndpoint: new Map(),
      peakRPS: 0,
    };
  }

  /**
   * Group events by tier
   */
  private groupByTier(
    events: RateLimitLogEntry[],
    total: number
  ): Array<{ tier: SubscriptionTier; count: number; percentage: number }> {
    const tierMap = new Map<SubscriptionTier, number>();

    for (const event of events) {
      if (event.tier) {
        const count = tierMap.get(event.tier) || 0;
        tierMap.set(event.tier, count + 1);
      }
    }

    return Array.from(tierMap.entries()).map(([tier, count]) => ({
      tier,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));
  }

  /**
   * Group events by scope
   */
  private groupByScope(
    events: RateLimitLogEntry[],
    total: number
  ): Array<{ scope: RateLimitScope; count: number; percentage: number }> {
    const scopeMap = new Map<RateLimitScope, number>();

    for (const event of events) {
      const count = scopeMap.get(event.scope) || 0;
      scopeMap.set(event.scope, count + 1);
    }

    return Array.from(scopeMap.entries()).map(([scope, count]) => ({
      scope,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));
  }

  /**
   * Group events by endpoint
   */
  private groupByEndpoint(
    events: RateLimitLogEntry[]
  ): Array<{ endpoint: string; count: number; blocked: number }> {
    const endpointMap = new Map<string, { total: number; blocked: number }>();

    for (const event of events) {
      const endpoint = event.endpoint || 'unknown';
      const existing = endpointMap.get(endpoint) || {
        total: 0,
        blocked: 0,
      };
      existing.total++;
      if (!event.allowed) {
        existing.blocked++;
      }
      endpointMap.set(endpoint, existing);
    }

    return Array.from(endpointMap.entries())
      .map(([endpoint, { total, blocked }]) => ({
        endpoint,
        count: total,
        blocked,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  /**
   * Calculate peak usage
   */
  private calculatePeakUsage(
    events: RateLimitLogEntry[]
  ): { peakTime: number | undefined; peakRPS: number } {
    if (events.length === 0) {
      return { peakTime: undefined, peakRPS: 0 };
    }

    // Calculate requests per second in 1-second buckets
    const secondBuckets = new Map<number, number>();

    for (const event of events) {
      const bucket = Math.floor(event.timestamp / 1000);
      const count = secondBuckets.get(bucket) || 0;
      secondBuckets.set(bucket, count + 1);
    }

    let peakRPS = 0;
    let peakTime: number | undefined;

    for (const [bucket, count] of secondBuckets.entries()) {
      if (count > peakRPS) {
        peakRPS = count;
        peakTime = bucket * 1000;
      }
    }

    return { peakTime, peakRPS };
  }

  /**
   * Persist events to KV
   */
  private async persistEvents(): Promise<void> {
    if (!this.kv) return;

    try {
      const key = `rate-limit-analytics:${Date.now()}`;
      await this.kv.put(key, JSON.stringify(this.events.slice(-1000)), {
        expirationTtl: this.options.retention,
      });
    } catch (error) {
      console.error('Failed to persist analytics:', error);
    }
  }
}

/**
 * Create analytics instance
 */
export function createRateLimitAnalytics(
  options?: AnalyticsOptions
) {
  return new RateLimitAnalytics(options);
}
