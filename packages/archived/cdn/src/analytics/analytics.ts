/**
 * CDN Analytics
 *
 * Comprehensive analytics for CDN performance, usage, and security.
 */

import { EventEmitter } from 'events';
import type { ICDNAnalytics, CDNEventType, ICDNEvent } from '../types/index.js';

interface IAnalyticsConfig {
  retentionPeriod: number;
  aggregationInterval: number;
  enableRealTime: boolean;
  enableHistorical: boolean;
}

interface IEventAggregation {
  type: CDNEventType;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  data: Record<string, any>;
}

export class CDNAnalytics extends EventEmitter {
  private events: ICDNEvent[];
  private aggregations: Map<string, IEventAggregation>;
  private config: IAnalyticsConfig;
  private analytics: ICDNAnalytics;
  private interval?: NodeJS.Timeout;

  constructor(config?: Partial<IAnalyticsConfig>) {
    super();

    this.config = {
      retentionPeriod: config?.retentionPeriod ?? 24 * 60 * 60 * 1000, // 24 hours
      aggregationInterval: config?.aggregationInterval ?? 60000, // 1 minute
      enableRealTime: config?.enableRealTime ?? true,
      enableHistorical: config?.enableHistorical ?? true
    };

    this.events = [];
    this.aggregations = new Map();

    this.analytics = this.initializeAnalytics();

    if (this.config.enableRealTime || this.config.enableHistorical) {
      this.startAggregation();
    }
  }

  /**
   * Record event
   */
  public recordEvent(event: ICDNEvent): void {
    const enrichedEvent: ICDNEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date()
    };

    this.events.push(enrichedEvent);

    this.emit('event', enrichedEvent);
    this.emit(`event:${event.type}`, enrichedEvent);

    // Prune old events
    this.pruneEvents();
  }

  /**
   * Record cache hit
   */
  public recordCacheHit(data: {
    url: string;
    responseTime: number;
    size: number;
    country?: string;
    provider?: string;
  }): void {
    this.recordEvent({
      type: 'cache_hit' as CDNEventType,
      timestamp: new Date(),
      data,
      severity: 'info'
    });

    this.analytics.requests.cached++;
    this.analytics.bandwidth.cached += data.size;
    this.analytics.bandwidth.saved += data.size;

    if (data.country) {
      this.analytics.requests.byCountry[data.country] =
        (this.analytics.requests.byCountry[data.country] ?? 0) + 1;
    }
  }

  /**
   * Record cache miss
   */
  public recordCacheMiss(data: {
    url: string;
    responseTime: number;
    size: number;
    country?: string;
    provider?: string;
  }): void {
    this.recordEvent({
      type: 'cache_miss' as CDNEventType,
      timestamp: new Date(),
      data,
      severity: 'info'
    });

    this.analytics.requests.uncached++;
    this.analytics.bandwidth.uncached += data.size;
    this.analytics.bandwidth.total += data.size;

    if (data.country) {
      this.analytics.requests.byCountry[data.country] =
        (this.analytics.requests.byCountry[data.country] ?? 0) + 1;
    }
  }

  /**
   * Record purge operation
   */
  public recordPurge(data: {
    type: 'url' | 'tag' | 'wildcard';
    targets: string[];
    duration: number;
    success: boolean;
  }): void {
    this.recordEvent({
      type: 'purge_start' as CDNEventType,
      timestamp: new Date(),
      data: { ...data, stage: 'start' },
      severity: 'info'
    });

    this.recordEvent({
      type: 'purge_complete' as CDNEventType,
      timestamp: new Date(),
      data: { ...data, stage: 'complete' },
      severity: data.success ? 'info' : 'warning'
    });
  }

  /**
   * Record deployment
   */
  public recordDeployment(data: {
    deploymentId: string;
    version: string;
    functions: number;
    assets: number;
    duration: number;
    success: boolean;
  }): void {
    this.recordEvent({
      type: 'deployment_start' as CDNEventType,
      timestamp: new Date(),
      data: { ...data, stage: 'start' },
      severity: 'info'
    });

    this.recordEvent({
      type: 'deployment_complete' as CDNEventType,
      timestamp: new Date(),
      data: { ...data, stage: 'complete' },
      severity: data.success ? 'info' : 'error'
    });
  }

  /**
   * Record error
   */
  public recordError(data: {
    error: string;
    url?: string;
    provider?: string;
    stack?: string;
  }): void {
    this.recordEvent({
      type: 'error' as CDNEventType,
      timestamp: new Date(),
      data,
      severity: 'error'
    });
  }

  /**
   * Record security threat
   */
  public recordThreat(data: {
    type: string;
    source: string;
    target?: string;
    blocked: boolean;
  }): void {
    this.recordEvent({
      type: 'threat_detected' as CDNEventType,
      timestamp: new Date(),
      data,
      severity: data.blocked ? 'warning' : 'critical'
    });

    if (data.blocked) {
      this.analytics.security.threatsBlocked++;
    }
  }

  /**
   * Get analytics
   */
  public getAnalytics(): ICDNAnalytics {
    this.updateAggregations();
    return { ...this.analytics };
  }

  /**
   * Get events
   */
  public getEvents(filter?: {
    type?: CDNEventType;
    severity?: string;
    limit?: number;
    startTime?: Date;
    endTime?: Date;
  }): ICDNEvent[] {
    let events = [...this.events];

    // Apply filters
    if (filter?.type) {
      events = events.filter(e => e.type === filter.type);
    }

    if (filter?.severity) {
      events = events.filter(e => e.severity === filter.severity);
    }

    if (filter?.startTime) {
      events = events.filter(e => e.timestamp >= filter.startTime!);
    }

    if (filter?.endTime) {
      events = events.filter(e => e.timestamp <= filter.endTime!);
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filter?.limit) {
      events = events.slice(0, filter.limit);
    }

    return events;
  }

  /**
   * Get summary
   */
  public getSummary(): {
    period: { start: Date; end: Date };
    requests: { total: number; cached: number; uncached: number; hitRate: number };
    bandwidth: { total: number; cached: number; saved: number; savingsRate: number };
    performance: { avgResponseTime: number; errorRate: number };
    security: { threatsBlocked: number; rateLimitExceeded: number };
  } {
    const total = this.analytics.requests.cached + this.analytics.requests.uncached;
    const hitRate = total > 0 ? (this.analytics.requests.cached / total) * 100 : 0;
    const savingsRate = this.analytics.bandwidth.total > 0
      ? (this.analytics.bandwidth.saved / this.analytics.bandwidth.total) * 100
      : 0;

    // Calculate average response time from events
    const responseTimes = this.events
      .filter(e => e.type === 'cache_hit' || e.type === 'cache_miss')
      .map(e => e.data['responseTime'] as number);

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : 0;

    return {
      period: {
        start: new Date(Date.now() - this.config.retentionPeriod),
        end: new Date()
      },
      requests: {
        total,
        cached: this.analytics.requests.cached,
        uncached: this.analytics.requests.uncached,
        hitRate
      },
      bandwidth: {
        total: this.analytics.bandwidth.total,
        cached: this.analytics.bandwidth.cached,
        saved: this.analytics.bandwidth.saved,
        savingsRate
      },
      performance: {
        avgResponseTime,
        errorRate: 0 // Would need to track errors
      },
      security: {
        threatsBlocked: this.analytics.security.threatsBlocked,
        rateLimitExceeded: this.analytics.security.rateLimitExceeded
      }
    };
  }

  /**
   * Get popular content
   */
  public getPopularContent(limit: number = 10): Array<{
    path: string;
    requests: number;
    bandwidth: number;
  }> {
    const pathStats = new Map<string, { requests: number; bandwidth: number }>();

    for (const event of this.events) {
      if (event.type !== 'cache_hit' && event.type !== 'cache_miss') continue;

      const url = event.data['url'] as string;
      const path = new URL(url).pathname;
      const size = event.data['size'] as number;

      const stats = pathStats.get(path) ?? { requests: 0, bandwidth: 0 };
      stats.requests++;
      stats.bandwidth += size;
      pathStats.set(path, stats);
    }

    return Array.from(pathStats.entries())
      .map(([path, stats]) => ({ path, ...stats }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, limit);
  }

  /**
   * Get top tags
   */
  public getTopTags(_limit: number = 10): Array<{
    tag: string;
    requests: number;
  }> {
    // This would require tracking tags in events
    return [];
  }

  /**
   * Get geographical distribution
   */
  public getGeographicalDistribution(): Record<string, number> {
    return { ...this.analytics.requests.byCountry };
  }

  /**
   * Export analytics
   */
  public exportAnalytics(format: 'json' | 'csv' = 'json'): string {
    const analytics = this.getAnalytics();

    if (format === 'json') {
      return JSON.stringify(analytics, null, 2);
    }

    // CSV format
    const lines: string[] = [];
    lines.push('metric,value');

    lines.push(`total_requests,${analytics.requests.total}`);
    lines.push(`cached_requests,${analytics.requests.cached}`);
    lines.push(`uncached_requests,${analytics.requests.uncached}`);
    lines.push(`total_bandwidth,${analytics.bandwidth.total}`);
    lines.push(`cached_bandwidth,${analytics.bandwidth.cached}`);
    lines.push(`saved_bandwidth,${analytics.bandwidth.saved}`);
    lines.push(`threats_blocked,${analytics.security.threatsBlocked}`);

    return lines.join('\n');
  }

  /**
   * Reset analytics
   */
  public reset(): void {
    this.events = [];
    this.aggregations.clear();
    this.analytics = this.initializeAnalytics();
    this.emit('reset');
  }

  /**
   * Initialize analytics structure
   */
  private initializeAnalytics(): ICDNAnalytics {
    return {
      requests: {
        total: 0,
        cached: 0,
        uncached: 0,
        byCountry: {},
        byDevice: {}
      },
      bandwidth: {
        total: 0,
        cached: 0,
        uncached: 0,
        saved: 0
      },
      performance: {
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0
      },
      popularity: {
        topPaths: [],
        topTags: []
      },
      security: {
        threatsBlocked: 0,
        rateLimitExceeded: 0,
        suspiciousIPs: 0
      }
    };
  }

  /**
   * Start aggregation
   */
  private startAggregation(): void {
    this.interval = setInterval(() => {
      this.updateAggregations();
    }, this.config.aggregationInterval);
  }

  /**
   * Update aggregations
   */
  private updateAggregations(): void {
    // Update analytics from events
    this.analytics.requests.total = this.analytics.requests.cached + this.analytics.requests.uncached;

    // Update popularity
    this.analytics.popularity.topPaths = this.getPopularContent(10);
  }

  /**
   * Prune old events
   */
  private pruneEvents(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.events = this.events.filter(e => e.timestamp.getTime() > cutoff);
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.events = [];
    this.aggregations.clear();
    this.removeAllListeners();
  }
}

export default CDNAnalytics;
