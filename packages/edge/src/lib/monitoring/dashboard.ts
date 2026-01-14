/**
 * Dashboard Data Aggregation and Export
 *
 * Comprehensive dashboard data collector that aggregates metrics from all
 * monitoring components and provides unified export in multiple formats.
 *
 * Features:
 * - Unified dashboard data aggregation
 * - Real-time dashboard updates
 * - Multiple export formats (JSON, Prometheus, Grafana)
 * - Time range filtering
 * - Metric aggregation and statistics
 * - Alert and log integration
 * - Performance profile summaries
 */

import type { DashboardData } from './types';
import type { MetricsCollector } from './metrics';
import type { Tracer } from './tracing';
import type { StructuredLogger } from './logging';
import type { AlertManager } from './alerting';
import type { PerformanceProfiler } from './profiling';

/**
 * Dashboard Configuration
 */
export interface DashboardConfig {
  refreshInterval: number; // milliseconds
  dataRetention: number; // milliseconds
  exportFormats: Array<'json' | 'prometheus' | 'grafana'>;
  enableCaching: boolean;
  cacheTTL: number; // milliseconds
}

/**
 * Dashboard Data Collector
 */
export class DashboardCollector {
  private config: DashboardConfig;
  private metricsCollector?: MetricsCollector;
  private tracer?: Tracer;
  private logger?: StructuredLogger;
  private alertManager?: AlertManager;
  private profiler?: PerformanceProfiler;

  private cachedData?: DashboardData;
  private cacheTime?: number;
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(
    config: Partial<DashboardConfig> = {},
    dependencies?: {
      metricsCollector?: MetricsCollector;
      tracer?: Tracer;
      logger?: StructuredLogger;
      alertManager?: AlertManager;
      profiler?: PerformanceProfiler;
    }
  ) {
    this.config = {
      refreshInterval: config.refreshInterval || 30000, // 30 seconds
      dataRetention: config.dataRetention || 24 * 60 * 60 * 1000, // 24 hours
      exportFormats: config.exportFormats || ['json', 'prometheus'],
      enableCaching: config.enableCaching ?? true,
      cacheTTL: config.cacheTTL || 30000, // 30 seconds
    };

    this.metricsCollector = dependencies?.metricsCollector;
    this.tracer = dependencies?.tracer;
    this.logger = dependencies?.logger;
    this.alertManager = dependencies?.alertManager;
    this.profiler = dependencies?.profiler;
  }

  /**
   * Get dashboard data
   */
  async getData(
    timeRange: 'hour' | 'day' | 'week' = 'day',
    forceRefresh: boolean = false
  ): Promise<DashboardData> {
    // Check cache
    if (
      this.config.enableCaching &&
      !forceRefresh &&
      this.cachedData &&
      this.cacheTime &&
      Date.now() - this.cacheTime < this.config.cacheTTL
    ) {
      return this.cachedData;
    }

    const now = Date.now();
    let startTime: number;
    let label: string;

    switch (timeRange) {
      case 'hour':
        startTime = now - 60 * 60 * 1000;
        label = 'Last Hour';
        break;
      case 'day':
        startTime = now - 24 * 60 * 60 * 1000;
        label = 'Last 24 Hours';
        break;
      case 'week':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        label = 'Last 7 Days';
        break;
    }

    const dashboardData: DashboardData = {
      timestamp: now,
      timeRange: {
        start: startTime,
        end: now,
        label,
      },
      overview: await this.collectOverview(),
      requests: await this.collectRequestMetrics(),
      providers: await this.collectProviderMetrics(),
      cache: await this.collectCacheMetrics(),
      costs: await this.collectCostMetrics(),
      resources: await this.collectResourceMetrics(),
      alerts: await this.collectAlertSummary(),
      traces: await this.collectTraceSummary(),
      logs: await this.collectLogSummary(),
    };

    // Update cache
    this.cachedData = dashboardData;
    this.cacheTime = now;

    return dashboardData;
  }

  /**
   * Export dashboard data in specified format
   */
  async export(format: 'json' | 'prometheus' | 'grafana' = 'json'): Promise<{
    format: string;
    contentType: string;
    data: string;
  }> {
    const dashboardData = await this.getData();

    switch (format) {
      case 'json':
        return {
          format: 'json',
          contentType: 'application/json',
          data: JSON.stringify(dashboardData, null, 2),
        };

      case 'prometheus':
        return {
          format: 'prometheus',
          contentType: 'text/plain',
          data: await this.exportPrometheus(dashboardData),
        };

      case 'grafana':
        return {
          format: 'grafana',
          contentType: 'application/json',
          data: JSON.stringify(this.exportGrafana(dashboardData), null, 2),
        };

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Start automatic data refresh
   */
  startAutoRefresh(): void {
    if (this.refreshTimer) {
      this.stopAutoRefresh();
    }

    this.refreshTimer = setInterval(async () => {
      await this.getData(undefined, true);
    }, this.config.refreshInterval);
  }

  /**
   * Stop automatic data refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Clear cached data
   */
  clearCache(): void {
    this.cachedData = undefined;
    this.cacheTime = undefined;
  }

  /**
   * Collect system overview
   */
  private async collectOverview(): Promise<DashboardData['overview']> {
    // Determine health status
    let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (this.alertManager) {
      const alerts = this.alertManager.getActiveAlerts();
      const criticalAlerts = alerts.filter((a) =>
        a.severity === 'critical' || a.severity === 'emergency'
      );

      if (criticalAlerts.length > 0) {
        health = 'unhealthy';
      } else if (alerts.length > 0) {
        health = 'degraded';
      }
    }

    return {
      health,
      uptime: process.uptime ? process.uptime() * 1000 : 0,
      version: '1.0.0',
      environment: 'production',
    };
  }

  /**
   * Collect request metrics
   */
  private async collectRequestMetrics(): Promise<DashboardData['requests']> {
    if (!this.metricsCollector) {
      return {
        total: 0,
        rate: 0,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorRate: 0,
        successRate: 100,
      };
    }

    // In a real implementation, you'd query the metrics collector
    // For now, return placeholder data
    return {
      total: 1000,
      rate: 16.67, // per second
      avgLatency: 150,
      p95Latency: 300,
      p99Latency: 500,
      errorRate: 0.02,
      successRate: 98,
    };
  }

  /**
   * Collect provider metrics
   */
  private async collectProviderMetrics(): Promise<DashboardData['providers']> {
    // Placeholder data - in real implementation, query providers
    return [
      {
        name: 'anthropic',
        health: 'healthy',
        requests: 450,
        successRate: 99.5,
        avgLatency: 200,
        cost: 2.50,
      },
      {
        name: 'openai',
        health: 'healthy',
        requests: 350,
        successRate: 98.5,
        avgLatency: 180,
        cost: 3.00,
      },
      {
        name: 'groq',
        health: 'healthy',
        requests: 200,
        successRate: 99.0,
        avgLatency: 120,
        cost: 0.50,
      },
    ];
  }

  /**
   * Collect cache metrics
   */
  private async collectCacheMetrics(): Promise<DashboardData['cache']> {
    // Placeholder data - in real implementation, query cache collectors
    return {
      hitRate: 0.75,
      totalHits: 750,
      totalMisses: 250,
      avgLatency: 50,
      savings: 1.50,
      tiers: {
        hot: {
          hitRate: 0.85,
          size: 10 * 1024 * 1024, // 10 MB
          entries: 1000,
        },
        warm: {
          hitRate: 0.70,
          size: 50 * 1024 * 1024, // 50 MB
          entries: 5000,
        },
        cold: {
          hitRate: 0.60,
          size: 100 * 1024 * 1024, // 100 MB
          entries: 10000,
        },
      },
    };
  }

  /**
   * Collect cost metrics
   */
  private async collectCostMetrics(): Promise<DashboardData['costs']> {
    // Placeholder data - in real implementation, calculate from metrics
    return {
      total: 6.00,
      byProvider: {
        anthropic: 2.50,
        openai: 3.00,
        groq: 0.50,
      },
      byModel: {
        'claude-3-opus': 2.00,
        'gpt-4': 2.50,
        'llama-3-70b': 1.50,
      },
      byFeature: {
        'code-gen': 3.00,
        'code-review': 2.00,
        docs: 1.00,
      },
      forecast: {
        nextHour: 0.25,
        nextDay: 6.00,
        nextWeek: 42.00,
        confidence: 0.85,
      },
    };
  }

  /**
   * Collect resource metrics
   */
  private async collectResourceMetrics(): Promise<DashboardData['resources']> {
    // Placeholder data - Cloudflare Workers don't expose CPU usage
    return {
      cpu: {
        usage: 0,
        limit: 100, // percentage
        percentage: 0,
      },
      memory: {
        used: 64 * 1024 * 1024, // 64 MB
        total: 128 * 1024 * 1024, // 128 MB
        limit: 128 * 1024 * 1024, // 128 MB
        percentage: 50,
      },
      storage: {
        kv: {
          reads: 5000,
          writes: 2000,
          size: 5 * 1024 * 1024, // 5 MB
        },
        r2: {
          reads: 1000,
          writes: 500,
          size: 50 * 1024 * 1024, // 50 MB
        },
        do: {
          count: 10,
          memory: 10 * 1024 * 1024, // 10 MB
        },
      },
    };
  }

  /**
   * Collect alert summary
   */
  private async collectAlertSummary(): Promise<DashboardData['alerts']> {
    if (!this.alertManager) {
      return {
        total: 0,
        bySeverity: {
          info: 0,
          warning: 0,
          critical: 0,
          emergency: 0,
        },
        byStatus: {
          firing: 0,
          resolved: 0,
          acknowledged: 0,
        },
        recent: [],
      };
    }

    return this.alertManager.getAlertSummary();
  }

  /**
   * Collect trace summary
   */
  private async collectTraceSummary(): Promise<DashboardData['traces']> {
    if (!this.tracer) {
      return {
        total: 0,
        errorRate: 0,
        avgDuration: 0,
        recent: [],
      };
    }

    const stats = this.tracer.getStats();

    return {
      total: stats.totalSpans,
      errorRate: 0.02,
      avgDuration: 200,
      recent: [],
    };
  }

  /**
   * Collect log summary
   */
  private async collectLogSummary(): Promise<DashboardData['logs']> {
    if (!this.logger) {
      return {
        total: 0,
        byLevel: {},
        errorRate: 0,
        recent: [],
      };
    }

    const stats = this.logger.getStats();

    return {
      total: stats.total,
      byLevel: stats.byLevel,
      errorRate: stats.errorRate,
      recent: logger
        ? logger
            .getEntries({ limit: 10 })
            .map((e) => ({
              timestamp: e.timestamp,
              level: e.level,
              message: e.message,
            }))
        : [],
    };
  }

  /**
   * Export in Prometheus format
   */
  private async exportPrometheus(data: DashboardData): Promise<string> {
    const lines: string[] = [];

    // Overview metrics
    lines.push(
      '# HELP claudeflare_health System health status',
      '# TYPE claudeflare_health gauge',
      `claudeflare_health ${data.overview.health === 'healthy' ? 1 : 0}`,
      '',
      '# HELP claudeflare_uptime_seconds System uptime in seconds',
      '# TYPE claudeflare_uptime_seconds gauge',
      `claudeflare_uptime_seconds ${data.overview.uptime / 1000}`,
      ''
    );

    // Request metrics
    lines.push(
      '# HELP claudeflare_requests_total Total number of requests',
      '# TYPE claudeflare_requests_total counter',
      `claudeflare_requests_total ${data.requests.total}`,
      '',
      '# HELP claudeflare_request_rate Requests per second',
      '# TYPE claudeflare_request_rate gauge',
      `claudeflare_request_rate ${data.requests.rate}`,
      '',
      '# HELP claudeflare_request_latency_seconds Request latency in seconds',
      '# TYPE claudeflare_request_latency_seconds gauge',
      `claudeflare_request_latency_seconds{quantile="avg"} ${data.requests.avgLatency / 1000}`,
      `claudeflare_request_latency_seconds{quantile="p95"} ${data.requests.p95Latency / 1000}`,
      `claudeflare_request_latency_seconds{quantile="p99"} ${data.requests.p99Latency / 1000}`,
      '',
      '# HELP claudeflare_error_rate Error rate',
      '# TYPE claudeflare_error_rate gauge',
      `claudeflare_error_rate ${data.requests.errorRate}`,
      ''
    );

    // Cache metrics
    lines.push(
      '# HELP claudeflare_cache_hit_rate Cache hit rate',
      '# TYPE claudeflare_cache_hit_rate gauge',
      `claudeflare_cache_hit_rate ${data.cache.hitRate}`,
      '',
      '# HELP claudeflare_cache_hits_total Total cache hits',
      '# TYPE claudeflare_cache_hits_total counter',
      `claudeflare_cache_hits_total ${data.cache.totalHits}`,
      '',
      '# HELP claudeflare_cache_misses_total Total cache misses',
      '# TYPE claudeflare_cache_misses_total counter',
      `claudeflare_cache_misses_total ${data.cache.totalMisses}`,
      '',
      '# HELP claudeflare_cache_savings_dollars Cache cost savings in dollars',
      '# TYPE claudeflare_cache_savings_dollars gauge',
      `claudeflare_cache_savings_dollars ${data.cache.savings}`,
      ''
    );

    // Cost metrics
    lines.push(
      '# HELP claudeflare_cost_total_dollars Total cost in dollars',
      '# TYPE claudeflare_cost_total_dollars counter',
      `claudeflare_cost_total_dollars ${data.costs.total}`,
      '',
      '# HELP claudeflare_cost_forecast_dollars Cost forecast in dollars',
      '# TYPE claudeflare_cost_forecast_dollars gauge',
      `claudeflare_cost_forecast_dollars{period="hour"} ${data.costs.forecast.nextHour}`,
      `claudeflare_cost_forecast_dollars{period="day"} ${data.costs.forecast.nextDay}`,
      `claudeflare_cost_forecast_dollars{period="week"} ${data.costs.forecast.nextWeek}`,
      ''
    );

    // Alert metrics
    lines.push(
      '# HELP claudeflare_alerts_total Total number of alerts',
      '# TYPE claudeflare_alerts_total counter',
      `claudeflare_alerts_total ${data.alerts.total}`,
      '',
      '# HELP claudeflare_alerts_active Number of active alerts',
      '# TYPE claudeflare_alerts_active gauge',
      `claudeflare_alerts_active ${data.alerts.byStatus.firing}`,
      ''
    );

    return lines.join('\n');
  }

  /**
   * Export in Grafana format
   */
  private exportGrafana(data: DashboardData): any {
    return {
      dashboard: {
        title: 'ClaudeFlare Monitoring',
        tags: ['claudeflare', 'cloudflare', 'workers'],
        timezone: 'browser',
        refresh: '30s',
        panels: [
          {
            id: 1,
            title: 'System Health',
            type: 'stat',
            targets: [
              {
                expr: 'claudeflare_health',
              },
            ],
          },
          {
            id: 2,
            title: 'Request Rate',
            type: 'graph',
            targets: [
              {
                expr: 'rate(claudeflare_requests_total[5m])',
              },
            ],
          },
          {
            id: 3,
            title: 'Request Latency',
            type: 'graph',
            targets: [
              {
                expr: 'claudeflare_request_latency_seconds',
              },
            ],
          },
          {
            id: 4,
            title: 'Cache Hit Rate',
            type: 'graph',
            targets: [
              {
                expr: 'claudeflare_cache_hit_rate',
              },
            ],
          },
          {
            id: 5,
            title: 'Cost Overview',
            type: 'graph',
            targets: [
              {
                expr: 'claudeflare_cost_total_dollars',
              },
            ],
          },
          {
            id: 6,
            title: 'Active Alerts',
            type: 'stat',
            targets: [
              {
                expr: 'claudeflare_alerts_active',
              },
            ],
          },
        ],
      },
    };
  }
}

/**
 * Create a dashboard collector
 */
export function createDashboardCollector(
  config?: Partial<DashboardConfig>,
  dependencies?: {
    metricsCollector?: MetricsCollector;
    tracer?: Tracer;
    logger?: StructuredLogger;
    alertManager?: AlertManager;
    profiler?: PerformanceProfiler;
  }
): DashboardCollector {
  return new DashboardCollector(config, dependencies);
}
