/**
 * Analytics Example - Real-time analytics and dashboards
 */

import {
  AnalyticsEngine,
  QueryBuilder,
  DashboardBuilder,
  WidgetBuilder,
  AnalyticsReporter,
} from '../src/analytics/engine.js';
import type {
  AnalyticsEvent,
  AnalyticsMetric,
  AnalyticsQuery,
  TimeSeries,
} from '../src/types/index.js';

// Create analytics engine
const analytics = new AnalyticsEngine({
  enabled: true,
  bufferSize: 10000,
  flushInterval: 10000,
  sampling: 1.0,
  retention: {
    events: 7 * 24 * 60 * 60 * 1000, // 7 days
    metrics: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  aggregation: {
    enabled: true,
    interval: 60000, // 1 minute
  },
});

// Example 1: Record events
export function trackRequest(requestId: string, method: string, url: string) {
  analytics.recordEvent({
    id: `req_${requestId}`,
    timestamp: Date.now(),
    type: 'request-start',
    data: {
      requestId,
      method,
      url,
    },
    tags: ['request', method],
  });
}

export function trackRequestComplete(
  requestId: string,
  status: number,
  duration: number
) {
  analytics.recordEvent({
    id: `req_${requestId}_complete`,
    timestamp: Date.now(),
    type: 'request-end',
    data: {
      requestId,
      status,
      duration,
    },
    tags: ['request', 'complete', String(status)],
  });
}

export function trackError(requestId: string, error: Error) {
  analytics.recordEvent({
    id: `req_${requestId}_error`,
    timestamp: Date.now(),
    type: 'error',
    data: {
      requestId,
      error: error.message,
      stack: error.stack,
    },
    tags: ['error', error.name],
  });
}

// Example 2: Record metrics
export function recordRequestCount(method: string) {
  analytics.increment('request.count', 1, { method });
}

export function recordRequestDuration(duration: number, method: string) {
  analytics.timing('request.duration', duration, { method });
}

export function recordCacheHit() {
  analytics.increment('cache.hits', 1);
}

export function recordCacheMiss() {
  analytics.increment('cache.misses', 1);
}

export function recordActiveConnections(count: number) {
  analytics.gauge('connections.active', count);
}

// Example 3: Query metrics using QueryBuilder
export async function getRequestRate(lastMinutes: number = 5): Promise<TimeSeries> {
  const query = new QueryBuilder()
    .metric('request.count')
    .aggregation('sum')
    .timeRange(
      Date.now() - lastMinutes * 60 * 1000,
      Date.now(),
      60000 // 1 minute intervals
    )
    .build();

  return analytics.queryMetrics(query);
}

export async function getAverageResponseTime(
  lastMinutes: number = 5
): Promise<TimeSeries> {
  const query = new QueryBuilder()
    .metric('request.duration')
    .aggregation('avg')
    .timeRange(
      Date.now() - lastMinutes * 60 * 1000,
      Date.now(),
      60000
    )
    .build();

  return analytics.queryMetrics(query);
}

export async function getErrorRate(lastMinutes: number = 5): Promise<TimeSeries> {
  const query = new QueryBuilder()
    .metric('request.count')
    .filter('status', 'gte', 400)
    .aggregation('count')
    .timeRange(
      Date.now() - lastMinutes * 60 * 1000,
      Date.now(),
      60000
    )
    .build();

  return analytics.queryMetrics(query);
}

export async function getCacheHitRate(): Promise<number> {
  const hits = await analytics.getMetricSummary('cache.hits');
  const misses = await analytics.getMetricSummary('cache.misses');

  if (!hits || !misses) {
    return 0;
  }

  const total = hits.sum + misses.sum;
  return total > 0 ? hits.sum / total : 0;
}

// Example 4: Create dashboards
export function createMonitoringDashboard() {
  const dashboard = new DashboardBuilder()
    .id('monitoring')
    .name('API Monitoring Dashboard')
    .description('Real-time API performance monitoring')
    .refreshInterval(30000) // 30 seconds
    .addWidget(
      new WidgetBuilder()
        .id('request-rate')
        .type('line-chart')
        .title('Request Rate')
        .query(
          new QueryBuilder()
            .metric('request.count')
            .aggregation('sum')
            .lastMinutes(15)
            .build()
        )
        .config({
          height: 300,
          width: 12,
          options: {
            yAxis: { label: 'Requests' },
            xAxis: { type: 'time' },
          },
        })
        .build()
    )
    .addWidget(
      new WidgetBuilder()
        .id('response-time')
        .type('line-chart')
        .title('Average Response Time')
        .query(
          new QueryBuilder()
            .metric('request.duration')
            .aggregation('avg')
            .lastMinutes(15)
            .build()
        )
        .config({
          height: 300,
          width: 12,
          options: {
            yAxis: { label: 'ms' },
            xAxis: { type: 'time' },
          },
        })
        .build()
    )
    .addWidget(
      new WidgetBuilder()
        .id('error-rate')
        .type('gauge')
        .title('Error Rate')
        .query(
          new QueryBuilder()
            .metric('request.count')
            .filter('status', 'gte', 400)
            .aggregation('count')
            .lastMinutes(5)
            .build()
        )
        .config({
          height: 200,
          width: 6,
          options: {
            min: 0,
            max: 100,
            threshold: 5,
          },
        })
        .build()
    )
    .addWidget(
      new WidgetBuilder()
        .id('cache-hit-rate')
        .type('gauge')
        .title('Cache Hit Rate')
        .query(
          new QueryBuilder()
            .metric('cache.hits')
            .aggregation('sum')
            .lastMinutes(5)
            .build()
        )
        .config({
          height: 200,
          width: 6,
          options: {
            min: 0,
            max: 100,
            format: 'percentage',
          },
        })
        .build()
    )
    .build();

  analytics.createDashboard(dashboard);

  return dashboard;
}

export function createBusinessDashboard() {
  const dashboard = new DashboardBuilder()
    .id('business')
    .name('Business Metrics Dashboard')
    .description('Key business metrics and KPIs')
    .refreshInterval(60000) // 1 minute
    .addWidget(
      new WidgetBuilder()
        .id('active-users')
        .type('stat')
        .title('Active Users')
        .query(
          new QueryBuilder()
            .metric('users.active')
            .aggregation('count')
            .lastMinutes(5)
            .build()
        )
        .config({
          height: 150,
          width: 4,
        })
        .build()
    )
    .addWidget(
      new WidgetBuilder()
        .id('total-requests')
        .type('stat')
        .title('Total Requests')
        .query(
          new QueryBuilder()
            .metric('request.count')
            .aggregation('count')
            .lastHours(24)
            .build()
        )
        .config({
          height: 150,
          width: 4,
        })
        .build()
    )
    .addWidget(
      new WidgetBuilder()
        .id('success-rate')
        .type('stat')
        .title('Success Rate')
        .query(
          new QueryBuilder()
            .metric('request.count')
            .filter('status', 'lt', 400)
            .aggregation('count')
            .lastMinutes(5)
            .build()
        )
        .config({
          height: 150,
          width: 4,
          options: {
            format: 'percentage',
          },
        })
        .build()
    )
    .build();

  analytics.createDashboard(dashboard);

  return dashboard;
}

// Example 5: Generate reports
export async function generateDailyReport() {
  const reporter = new AnalyticsReporter(analytics);

  // Create daily report
  reporter.createReport({
    id: 'daily-report',
    name: 'Daily Performance Report',
    description: 'Daily API performance summary',
    queries: [
      new QueryBuilder()
        .metric('request.count')
        .aggregation('count')
        .lastHours(24)
        .build(),
      new QueryBuilder()
        .metric('request.duration')
        .aggregation('avg')
        .lastHours(24)
        .build(),
      new QueryBuilder()
        .metric('request.count')
        .filter('status', 'gte', 400)
        .aggregation('count')
        .lastHours(24)
        .build(),
    ],
    format: 'json',
  });

  return reporter.generateReport('daily-report');
}

// Example 6: Real-time alerting
export function setupAlerts() {
  analytics.on('metric', (metric: AnalyticsMetric) => {
    // Alert on high error rate
    if (metric.name === 'request.count' && metric.dimensions.status === '500') {
      if (metric.value > 100) {
        console.error(`ALERT: High error rate detected: ${metric.value} errors`);
        // Send alert notification
      }
    }

    // Alert on slow responses
    if (metric.name === 'request.duration' && metric.value > 5000) {
      console.warn(`ALERT: Slow response detected: ${metric.value}ms`);
    }

    // Alert on low cache hit rate
    if (metric.name === 'cache.hits' || metric.name === 'cache.misses') {
      // Calculate hit rate
    }
  });
}

// Example 7: Custom metrics aggregation
export async function getPerformancePercentiles(
  lastMinutes: number = 5
): Promise<{
  p50: number;
  p95: number;
  p99: number;
}> {
  const summary = await analytics.getMetricSummary('request.duration');

  if (!summary) {
    return { p50: 0, p95: 0, p99: 0 };
  }

  return {
    p50: summary.p50,
    p95: summary.p95,
    p99: summary.p99,
  };
}

// Export analytics engine
export { analytics };

// Export helper functions
export function getAnalyticsEngine() {
  return analytics;
}

export function getQueryBuilder() {
  return new QueryBuilder();
}

export function getDashboardBuilder() {
  return new DashboardBuilder();
}

export function getWidgetBuilder() {
  return new WidgetBuilder();
}
