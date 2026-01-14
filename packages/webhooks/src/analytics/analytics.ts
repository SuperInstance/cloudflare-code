/**
 * Analytics module for webhook delivery metrics and monitoring
 */

import type {
  WebhookAnalytics,
  WebhookDelivery,
  WebhookEventType,
  WebhookDeliveryStatus,
} from '../types/webhook.js';
import type { IAnalyticsStorage, AnalyticsPeriod, TimeSeriesData } from '../types/storage.js';
import type { WebhookSystemConfig } from '../types/config.js';

/**
 * Real-time metrics
 */
export interface RealTimeMetrics {
  timestamp: Date;
  deliveriesPerSecond: number;
  successRate: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  activeWebhooks: number;
  queueSize: number;
  retryQueueSize: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
}

/**
 * Alert conditions
 */
export interface AlertCondition {
  id: string;
  name: string;
  type: 'failure_rate' | 'latency' | 'queue_size' | 'error_spike';
  threshold: number;
  windowMinutes: number;
  enabled: boolean;
  lastTriggered?: Date;
  notificationChannel?: string;
}

/**
 * Alert event
 */
export interface AlertEvent {
  id: string;
  conditionId: string;
  conditionName: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * Analytics aggregation data
 */
export interface AggregationData {
  byEventType: Map<WebhookEventType, number>;
  byStatus: Map<WebhookDeliveryStatus, number>;
  byWebhook: Map<string, number>;
  byHour: number[];
  latencies: number[];
}

/**
 * Analytics class
 */
export class WebhookAnalytics {
  private config: WebhookSystemConfig;
  private storage: IAnalyticsStorage;

  // Real-time metrics cache
  private metricsCache: Map<string, RealTimeMetrics>;
  private deliveryBuffer: WebhookDelivery[];

  // Alert conditions
  private alertConditions: Map<string, AlertCondition>;
  private alertHistory: AlertEvent[];

  constructor(config: WebhookSystemConfig, storage: IAnalyticsStorage) {
    this.config = config;
    this.storage = storage;

    this.metricsCache = new Map();
    this.deliveryBuffer = [];
    this.alertConditions = new Map();
    this.alertHistory = [];

    this.initializeDefaultAlerts();
  }

  /**
   * Record a delivery for analytics
   */
  public async recordDelivery(delivery: WebhookDelivery): Promise<void> {
    // Add to buffer for batch processing
    this.deliveryBuffer.push(delivery);

    // Process buffer if it's full enough
    if (this.deliveryBuffer.length >= 100) {
      await this.flushDeliveryBuffer();
    }
  }

  /**
   * Get webhook analytics for a time period
   */
  public async getWebhookAnalytics(
    webhookId: string,
    period: AnalyticsPeriod
  ): Promise<WebhookAnalytics> {
    return this.storage.getWebhookAnalytics(webhookId, period);
  }

  /**
   * Get global analytics for a time period
   */
  public async getGlobalAnalytics(period: AnalyticsPeriod): Promise<WebhookAnalytics> {
    return this.storage.getGlobalAnalytics(period);
  }

  /**
   * Get real-time metrics
   */
  public async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const cacheKey = 'realtime';
    const cached = this.metricsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp.getTime() < 5000) {
      return cached;
    }

    // Calculate current metrics
    const recentDeliveries = this.deliveryBuffer.slice(-1000);
    const successful = recentDeliveries.filter(d => d.status === 'success');
    const latencies = recentDeliveries.map(d => d.duration);

    const metrics: RealTimeMetrics = {
      timestamp: new Date(),
      deliveriesPerSecond: this.calculateThroughput(recentDeliveries),
      successRate: this.calculateSuccessRate(recentDeliveries),
      averageLatency: this.average(latencies),
      p50Latency: this.percentile(latencies, 50),
      p95Latency: this.percentile(latencies, 95),
      p99Latency: this.percentile(latencies, 99),
      activeWebhooks: await this.getActiveWebhookCount(),
      queueSize: this.getQueueSize(),
      retryQueueSize: this.getRetryQueueSize(),
    };

    this.metricsCache.set(cacheKey, metrics);

    return metrics;
  }

  /**
   * Get performance metrics
   */
  public async getPerformanceMetrics(
    webhookId?: string,
    period: AnalyticsPeriod
  ): Promise<PerformanceMetrics> {
    const analytics = webhookId
      ? await this.getWebhookAnalytics(webhookId, period)
      : await this.getGlobalAnalytics(period);

    const metrics = analytics.metrics;

    return {
      totalRequests: metrics.totalEvents,
      successfulRequests: metrics.deliveredEvents,
      failedRequests: metrics.failedEvents,
      averageResponseTime: metrics.averageLatency,
      minResponseTime: metrics.p50Latency, // Placeholder
      maxResponseTime: metrics.p99Latency, // Placeholder
      p50ResponseTime: metrics.p50Latency,
      p95ResponseTime: metrics.p95Latency,
      p99ResponseTime: metrics.p99Latency,
      throughput: metrics.throughput,
      errorRate: metrics.failedEvents / metrics.totalEvents,
    };
  }

  /**
   * Get time series data
   */
  public async getTimeSeries(
    webhookId: string | null,
    period: AnalyticsPeriod
  ): Promise<TimeSeriesData[]> {
    return this.storage.aggregateByTime(webhookId, period);
  }

  /**
   * Add alert condition
   */
  public addAlertCondition(condition: Omit<AlertCondition, 'id'>): AlertCondition {
    const newCondition: AlertCondition = {
      ...condition,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.alertConditions.set(newCondition.id, newCondition);

    return newCondition;
  }

  /**
   * Update alert condition
   */
  public updateAlertCondition(
    id: string,
    updates: Partial<AlertCondition>
  ): AlertCondition | null {
    const condition = this.alertConditions.get(id);
    if (!condition) {
      return null;
    }

    const updated = { ...condition, ...updates };
    this.alertConditions.set(id, updated);

    return updated;
  }

  /**
   * Remove alert condition
   */
  public removeAlertCondition(id: string): boolean {
    return this.alertConditions.delete(id);
  }

  /**
   * Get alert conditions
   */
  public getAlertConditions(): AlertCondition[] {
    return Array.from(this.alertConditions.values());
  }

  /**
   * Get alert history
   */
  public getAlertHistory(options?: {
    limit?: number;
    severity?: string;
    resolved?: boolean;
  }): AlertEvent[] {
    let events = this.alertHistory;

    if (options?.severity) {
      events = events.filter(e => e.severity === options.severity);
    }

    if (options?.resolved !== undefined) {
      events = events.filter(e => e.resolved === options.resolved);
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  /**
   * Check alert conditions
   */
  public async checkAlerts(): Promise<AlertEvent[]> {
    if (!this.config.monitoring.enabled) {
      return [];
    }

    const triggered: AlertEvent[] = [];
    const metrics = await this.getRealTimeMetrics();

    for (const condition of this.alertConditions.values()) {
      if (!condition.enabled) {
        continue;
      }

      let shouldTrigger = false;
      let value = 0;

      switch (condition.type) {
        case 'failure_rate':
          value = 1 - metrics.successRate;
          shouldTrigger = value > condition.threshold;
          break;

        case 'latency':
          value = metrics.p95Latency;
          shouldTrigger = value > condition.threshold;
          break;

        case 'queue_size':
          value = metrics.queueSize;
          shouldTrigger = value > condition.threshold;
          break;

        case 'error_spike':
          // Check for recent error spike
          const recentFailures = this.deliveryBuffer
            .filter(d => Date.now() - d.createdAt.getTime() < condition.windowMinutes * 60 * 1000)
            .filter(d => d.status === 'failed').length;

          value = recentFailures;
          shouldTrigger = value > condition.threshold;
          break;
      }

      if (shouldTrigger) {
        const event: AlertEvent = {
          id: `alert_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conditionId: condition.id,
          conditionName: condition.name,
          severity: this.calculateSeverity(condition.type, value, condition.threshold),
          message: this.formatAlertMessage(condition, value),
          value,
          threshold: condition.threshold,
          timestamp: new Date(),
          resolved: false,
        };

        triggered.push(event);
        this.alertHistory.push(event);

        // Update condition's last triggered time
        condition.lastTriggered = new Date();
      }
    }

    return triggered;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    return true;
  }

  /**
   * Generate analytics report
   */
  public async generateReport(
    webhookId?: string,
    period?: AnalyticsPeriod
  ): Promise<{
    summary: any;
    performance: PerformanceMetrics;
    timeSeries: TimeSeriesData[];
    alerts: AlertEvent[];
    recommendations: string[];
  }> {
    const defaultPeriod: AnalyticsPeriod = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
      granularity: 'hour',
    };

    const analyticsPeriod = period || defaultPeriod;

    const analytics = webhookId
      ? await this.getWebhookAnalytics(webhookId, analyticsPeriod)
      : await this.getGlobalAnalytics(analyticsPeriod);

    const performance = await this.getPerformanceMetrics(webhookId, analyticsPeriod);
    const timeSeries = await this.getTimeSeries(webhookId || null, analyticsPeriod);
    const recentAlerts = this.getAlertHistory({ limit: 10 });

    return {
      summary: analytics,
      performance,
      timeSeries,
      alerts: recentAlerts,
      recommendations: this.generateRecommendations(performance, recentAlerts),
    };
  }

  /**
   * Flush delivery buffer to storage
   */
  public async flushDeliveryBuffer(): Promise<void> {
    if (this.deliveryBuffer.length === 0) {
      return;
    }

    const deliveries = [...this.deliveryBuffer];
    this.deliveryBuffer = [];

    for (const delivery of deliveries) {
      await this.storage.recordDelivery(delivery);
    }
  }

  /**
   * Get analytics aggregation data
   */
  private async getAggregationData(
    period: AnalyticsPeriod
  ): Promise<AggregationData> {
    const analytics = await this.getGlobalAnalytics(period);

    const byEventType = new Map<WebhookEventType, number>();
    for (const [type, count] of Object.entries(analytics.breakdown.byEventType)) {
      byEventType.set(type as WebhookEventType, count);
    }

    const byStatus = new Map<WebhookDeliveryStatus, number>();
    for (const [status, count] of Object.entries(analytics.breakdown.byStatus)) {
      byStatus.set(status as WebhookDeliveryStatus, count);
    }

    return {
      byEventType,
      byStatus,
      byWebhook: new Map(), // Would be populated by storage
      byHour: analytics.breakdown.byHour,
      latencies: [],
    };
  }

  /**
   * Initialize default alert conditions
   */
  private initializeDefaultAlerts(): void {
    const defaults: Omit<AlertCondition, 'id'>[] = [
      {
        name: 'High Failure Rate',
        type: 'failure_rate',
        threshold: this.config.monitoring.alerts.failureRateThreshold,
        windowMinutes: 5,
        enabled: true,
        severity: 'warning',
      },
      {
        name: 'High Latency',
        type: 'latency',
        threshold: this.config.monitoring.alerts.latencyThresholdMs,
        windowMinutes: 5,
        enabled: true,
        severity: 'warning',
      },
      {
        name: 'Large Queue Size',
        type: 'queue_size',
        threshold: this.config.monitoring.alerts.queueSizeThreshold,
        windowMinutes: 5,
        enabled: true,
        severity: 'info',
      },
    ];

    for (const condition of defaults) {
      this.addAlertCondition(condition);
    }
  }

  /**
   * Calculate throughput from deliveries
   */
  private calculateThroughput(deliveries: WebhookDelivery[]): number {
    if (deliveries.length === 0) {
      return 0;
    }

    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentDeliveries = deliveries.filter(
      d => d.createdAt.getTime() >= oneSecondAgo
    );

    return recentDeliveries.length;
  }

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(deliveries: WebhookDelivery[]): number {
    if (deliveries.length === 0) {
      return 1;
    }

    const successful = deliveries.filter(d => d.status === 'success').length;
    return successful / deliveries.length;
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get active webhook count
   */
  private async getActiveWebhookCount(): Promise<number> {
    // This would query the webhook storage
    // For now, return a placeholder
    return 0;
  }

  /**
   * Get queue size
   */
  private getQueueSize(): number {
    // This would get from the delivery engine
    // For now, return a placeholder
    return 0;
  }

  /**
   * Get retry queue size
   */
  private getRetryQueueSize(): number {
    // This would get from the retry handler
    // For now, return a placeholder
    return 0;
  }

  /**
   * Calculate alert severity
   */
  private calculateSeverity(
    type: string,
    value: number,
    threshold: number
  ): 'info' | 'warning' | 'error' | 'critical' {
    const ratio = value / threshold;

    if (ratio >= 2) {
      return 'critical';
    } else if (ratio >= 1.5) {
      return 'error';
    } else if (ratio >= 1.1) {
      return 'warning';
    } else {
      return 'info';
    }
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(condition: AlertCondition, value: number): string {
    switch (condition.type) {
      case 'failure_rate':
        return `Failure rate is ${(value * 100).toFixed(2)}%, exceeding threshold of ${(condition.threshold * 100).toFixed(2)}%`;
      case 'latency':
        return `P95 latency is ${value.toFixed(0)}ms, exceeding threshold of ${condition.threshold}ms`;
      case 'queue_size':
        return `Queue size is ${value}, exceeding threshold of ${condition.threshold}`;
      case 'error_spike':
        return `Error spike detected: ${value} errors in the last ${condition.windowMinutes} minutes`;
      default:
        return `Alert condition "${condition.name}" triggered with value ${value}`;
    }
  }

  /**
   * Generate recommendations based on metrics and alerts
   */
  private generateRecommendations(
    performance: PerformanceMetrics,
    alerts: AlertEvent[]
  ): string[] {
    const recommendations: string[] = [];

    // High error rate
    if (performance.errorRate > 0.05) {
      recommendations.push(
        'High error rate detected. Review webhook endpoints for availability issues.'
      );
    }

    // High latency
    if (performance.p95ResponseTime > 5000) {
      recommendations.push(
        'High latency detected. Consider optimizing webhook endpoint performance or increasing timeout values.'
      );
    }

    // Recent critical alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.resolved);
    if (criticalAlerts.length > 0) {
      recommendations.push(
        `${criticalAlerts.length} critical alerts require immediate attention.`
      );
    }

    // Low success rate
    if (performance.successfulRequests / performance.totalRequests < 0.95) {
      recommendations.push(
        'Success rate below 95%. Review failed deliveries and consider adjusting retry policies.'
      );
    }

    return recommendations;
  }

  /**
   * Clear metrics cache
   */
  public clearCache(): void {
    this.metricsCache.clear();
  }

  /**
   * Get buffer size
   */
  public getBufferSize(): number {
    return this.deliveryBuffer.length;
  }
}

/**
 * Export analytics utilities
 */
export class AnalyticsUtils {
  /**
   * Calculate moving average
   */
  static movingAverage(data: number[], window: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = data.slice(start, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }

    return result;
  }

  /**
   * Detect anomalies in time series data
   */
  static detectAnomalies(
    data: number[],
    threshold: number = 2
  ): Array<{ index: number; value: number; expected: number }> {
    const anomalies: Array<{ index: number; value: number; expected: number }> = [];

    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    for (let i = 0; i < data.length; i++) {
      const zScore = Math.abs((data[i] - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push({
          index: i,
          value: data[i],
          expected: mean,
        });
      }
    }

    return anomalies;
  }

  /**
   * Calculate trend direction
   */
  static calculateTrend(data: number[]): 'up' | 'down' | 'stable' {
    if (data.length < 2) {
      return 'stable';
    }

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (percentChange > 5) {
      return 'up';
    } else if (percentChange < -5) {
      return 'down';
    } else {
      return 'stable';
    }
  }
}
