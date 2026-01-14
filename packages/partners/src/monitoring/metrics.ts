/**
 * Integration Monitoring Service
 * Tracks integration performance, health, and usage metrics
 */

import {
  IntegrationMetrics,
  IntegrationAlert,
  IntegrationHealth,
  HealthCheck,
  UsageStats
} from '../types';

export class IntegrationMonitoringService {
  private metricsBuffer: Map<string, IntegrationMetrics[]> = new Map();
  private alerts: Map<string, IntegrationAlert[]> = new Map();
  private healthChecks: Map<string, IntegrationHealth> = new Map();
  private usageStats: Map<string, UsageStats[]> = new Map();

  // Thresholds for alerts
  private thresholds = {
    errorRate: 0.05, // 5%
    latencyP95: 5000, // 5 seconds
    webhookFailureRate: 0.1, // 10%
    rateLimitHitRate: 0.2, // 20%
    tokenExpiryThreshold: 300000 // 5 minutes
  };

  /**
   * Record integration metrics
   */
  public recordMetrics(metrics: IntegrationMetrics): void {
    const key = this.getMetricsKey(metrics.partnerId, metrics.integrationId);
    let buffer = this.metricsBuffer.get(key);

    if (!buffer) {
      buffer = [];
      this.metricsBuffer.set(key, buffer);
    }

    buffer.push(metrics);

    // Keep last 1000 metrics
    if (buffer.length > 1000) {
      buffer.shift();
    }

    // Check for alerts
    this.checkAlerts(metrics);
  }

  /**
   * Record API call
   */
  public recordAPICall(
    partnerId: string,
    integrationId: string,
    success: boolean,
    responseTime: number,
    rateLimited = false
  ): void {
    const now = new Date();
    const key = this.getMetricsKey(partnerId, integrationId);

    let metrics = this.getLatestMetrics(partnerId, integrationId);

    if (!metrics || this.shouldRotateMetrics(metrics, now)) {
      metrics = this.createEmptyMetrics(partnerId, integrationId, now);
    }

    metrics.apiCalls++;
    if (success) {
      metrics.successfulCalls++;
    } else {
      metrics.failedCalls++;
    }

    // Update latency
    const totalLatency = metrics.avgResponseTime * (metrics.apiCalls - 1);
    metrics.avgResponseTime = (totalLatency + responseTime) / metrics.apiCalls;

    // Update rate limit hits
    if (rateLimited) {
      metrics.rateLimitHits++;
    }

    this.recordMetrics(metrics);
  }

  /**
   * Record webhook delivery
   */
  public recordWebhookDelivery(
    partnerId: string,
    integrationId: string,
    success: boolean
  ): void {
    const now = new Date();
    let metrics = this.getLatestMetrics(partnerId, integrationId);

    if (!metrics || this.shouldRotateMetrics(metrics, now)) {
      metrics = this.createEmptyMetrics(partnerId, integrationId, now);
    }

    metrics.webhookDeliveries++;

    // Update success rate
    const totalDeliveries = metrics.webhookDeliveries;
    const failedDeliveries = totalDeliveries * (1 - metrics.webhookSuccessRate);
    const newFailedDeliveries = success ? failedDeliveries : failedDeliveries + 1;
    metrics.webhookSuccessRate = 1 - (newFailedDeliveries / totalDeliveries);

    this.recordMetrics(metrics);
  }

  /**
   * Get metrics for integration
   */
  public getMetrics(partnerId: string, integrationId: string, period = 'hour'): IntegrationMetrics[] {
    const key = this.getMetricsKey(partnerId, integrationId);
    const buffer = this.metricsBuffer.get(key) || [];

    const now = Date.now();
    const periodMs = this.getPeriodMs(period);

    return buffer.filter(m => now - m.timestamp.getTime() <= periodMs);
  }

  /**
   * Get aggregated metrics
   */
  public getAggregatedMetrics(
    partnerId: string,
    integrationId: string,
    period = 'hour'
  ): IntegrationMetrics | null {
    const metrics = this.getMetrics(partnerId, integrationId, period);

    if (metrics.length === 0) {
      return null;
    }

    return {
      partnerId,
      integrationId,
      timestamp: new Date(),
      apiCalls: metrics.reduce((sum, m) => sum + m.apiCalls, 0),
      successfulCalls: metrics.reduce((sum, m) => sum + m.successfulCalls, 0),
      failedCalls: metrics.reduce((sum, m) => sum + m.failedCalls, 0),
      avgResponseTime: metrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / metrics.length,
      p95ResponseTime: Math.max(...metrics.map(m => m.p95ResponseTime)),
      p99ResponseTime: Math.max(...metrics.map(m => m.p99ResponseTime)),
      webhookDeliveries: metrics.reduce((sum, m) => sum + m.webhookDeliveries, 0),
      webhookSuccessRate: metrics.reduce((sum, m) => sum + m.webhookSuccessRate, 0) / metrics.length,
      errorRate: metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length,
      rateLimitHits: metrics.reduce((sum, m) => sum + m.rateLimitHits, 0)
    };
  }

  /**
   * Get alerts for integration
   */
  public getAlerts(integrationId: string): IntegrationAlert[] {
    return this.alerts.get(integrationId) || [];
  }

  /**
   * Create alert
   */
  public createAlert(alert: IntegrationAlert): void {
    let alerts = this.alerts.get(alert.integrationId);

    if (!alerts) {
      alerts = [];
      this.alerts.set(alert.integrationId, alerts);
    }

    alerts.push(alert);

    // Keep last 100 alerts
    if (alerts.length > 100) {
      alerts.shift();
    }
  }

  /**
   * Resolve alert
   */
  public resolveAlert(alertId: string, integrationId: string): void {
    const alerts = this.alerts.get(integrationId);

    if (!alerts) {
      return;
    }

    const alert = alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
    }
  }

  /**
   * Check for alerts based on metrics
   */
  private checkAlerts(metrics: IntegrationMetrics): void {
    const errorRate = metrics.failedCalls / metrics.apiCalls;

    // High error rate alert
    if (errorRate > this.thresholds.errorRate && metrics.apiCalls > 10) {
      this.createAlert({
        id: crypto.randomUUID(),
        integrationId: metrics.integrationId,
        type: 'error-rate',
        severity: 'error',
        title: 'High Error Rate',
        message: `Error rate is ${(errorRate * 100).toFixed(2)}% (${metrics.failedCalls}/${metrics.apiCalls} calls)`,
        metadata: {
          partnerId: metrics.partnerId,
          errorRate,
          failedCalls: metrics.failedCalls,
          totalCalls: metrics.apiCalls
        },
        resolved: false,
        createdAt: new Date()
      });
    }

    // High latency alert
    if (metrics.p95ResponseTime > this.thresholds.latencyP95) {
      this.createAlert({
        id: crypto.randomUUID(),
        integrationId: metrics.integrationId,
        type: 'latency',
        severity: 'warning',
        title: 'High Latency',
        message: `P95 latency is ${metrics.p95ResponseTime}ms`,
        metadata: {
          partnerId: metrics.partnerId,
          p95ResponseTime: metrics.p95ResponseTime,
          avgResponseTime: metrics.avgResponseTime
        },
        resolved: false,
        createdAt: new Date()
      });
    }

    // Webhook failure alert
    if (metrics.webhookDeliveries > 10) {
      const failureRate = 1 - metrics.webhookSuccessRate;
      if (failureRate > this.thresholds.webhookFailureRate) {
        this.createAlert({
          id: crypto.randomUUID(),
          integrationId: metrics.integrationId,
          type: 'webhook-failure',
          severity: 'error',
          title: 'Webhook Failures',
          message: `Webhook failure rate is ${(failureRate * 100).toFixed(2)}%`,
          metadata: {
            partnerId: metrics.partnerId,
            failureRate,
            totalDeliveries: metrics.webhookDeliveries
          },
          resolved: false,
          createdAt: new Date()
        });
      }
    }

    // Rate limit alert
    if (metrics.apiCalls > 100) {
      const rateLimitRate = metrics.rateLimitHits / metrics.apiCalls;
      if (rateLimitRate > this.thresholds.rateLimitHitRate) {
        this.createAlert({
          id: crypto.randomUUID(),
          integrationId: metrics.integrationId,
          type: 'rate-limit',
          severity: 'warning',
          title: 'High Rate Limit Hits',
          message: `Rate limit hit rate is ${(rateLimitRate * 100).toFixed(2)}%`,
          metadata: {
            partnerId: metrics.partnerId,
            rateLimitRate,
            rateLimitHits: metrics.rateLimitHits,
            totalCalls: metrics.apiCalls
          },
          resolved: false,
          createdAt: new Date()
        });
      }
    }
  }

  /**
   * Update integration health
   */
  public updateHealth(integrationId: string, health: IntegrationHealth): void {
    this.healthChecks.set(integrationId, health);
  }

  /**
   * Get integration health
   */
  public getHealth(integrationId: string): IntegrationHealth | undefined {
    return this.healthChecks.get(integrationId);
  }

  /**
   * Perform health check
   */
  public async performHealthCheck(
    integrationId: string,
    checks: Array<{
      name: string;
      check: () => Promise<{ pass: boolean; message?: string; responseTime?: number }>;
    }>
  ): Promise<IntegrationHealth> {
    const results: HealthCheck[] = [];

    for (const check of checks) {
      const start = Date.now();

      try {
        const result = await check.check();

        results.push({
          name: check.name,
          status: result.pass ? 'pass' : 'fail',
          message: result.message,
          lastCheck: new Date(),
          responseTime: result.responseTime || Date.now() - start
        });
      } catch (error) {
        results.push({
          name: check.name,
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date(),
          responseTime: Date.now() - start
        });
      }
    }

    const failed = results.filter(r => r.status === 'fail').length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failed === 0) {
      status = 'healthy';
    } else if (failed < results.length / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const health: IntegrationHealth = {
      integrationId,
      status,
      lastCheck: new Date(),
      uptime: 0, // Would be calculated from historical data
      checks: results
    };

    this.updateHealth(integrationId, health);

    return health;
  }

  /**
   * Record usage stats
   */
  public recordUsageStats(stats: UsageStats): void {
    const key = `${stats.partnerId}:${stats.period}`;
    let buffer = this.usageStats.get(key);

    if (!buffer) {
      buffer = [];
      this.usageStats.set(key, buffer);
    }

    buffer.push(stats);

    // Keep last 90 days of stats
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    buffer = buffer.filter(s => s.timestamp.getTime() >= cutoff);
    this.usageStats.set(key, buffer);
  }

  /**
   * Get usage stats
   */
  public getUsageStats(partnerId: string, period: 'hour' | 'day' | 'week' | 'month'): UsageStats[] {
    const key = `${partnerId}:${period}`;
    return this.usageStats.get(key) || [];
  }

  /**
   * Get metrics key
   */
  private getMetricsKey(partnerId: string, integrationId: string): string {
    return `${partnerId}:${integrationId}`;
  }

  /**
   * Get latest metrics
   */
  private getLatestMetrics(partnerId: string, integrationId: string): IntegrationMetrics | null {
    const key = this.getMetricsKey(partnerId, integrationId);
    const buffer = this.metricsBuffer.get(key);

    return buffer && buffer.length > 0 ? buffer[buffer.length - 1] : null;
  }

  /**
   * Check if metrics should be rotated
   */
  private shouldRotateMetrics(metrics: IntegrationMetrics, now: Date): boolean {
    const hour = 60 * 60 * 1000;
    return now.getTime() - metrics.timestamp.getTime() >= hour;
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(
    partnerId: string,
    integrationId: string,
    timestamp: Date
  ): IntegrationMetrics {
    return {
      partnerId,
      integrationId,
      timestamp,
      apiCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      webhookDeliveries: 0,
      webhookSuccessRate: 1,
      errorRate: 0,
      rateLimitHits: 0
    };
  }

  /**
   * Get period in milliseconds
   */
  private getPeriodMs(period: string): number {
    const periods: Record<string, number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    return periods[period] || periods.hour;
  }

  /**
   * Clear old data
   */
  public clearOldData(olderThan: Date): void {
    const cutoff = olderThan.getTime();

    // Clear old metrics
    for (const [key, buffer] of this.metricsBuffer.entries()) {
      const filtered = buffer.filter(m => m.timestamp.getTime() >= cutoff);
      this.metricsBuffer.set(key, filtered);
    }

    // Clear old usage stats
    for (const [key, buffer] of this.usageStats.entries()) {
      const filtered = buffer.filter(s => s.timestamp.getTime() >= cutoff);
      this.usageStats.set(key, filtered);
    }

    // Clear resolved alerts older than threshold
    for (const [key, alerts] of this.alerts.entries()) {
      const filtered = alerts.filter(a => !a.resolved || (a.resolvedAt && a.resolvedAt.getTime() >= cutoff));
      this.alerts.set(key, filtered);
    }
  }
}
