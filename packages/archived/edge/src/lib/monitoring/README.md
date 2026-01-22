# ClaudeFlare Monitoring & Observability System

Comprehensive monitoring and observability system for Cloudflare Workers with distributed tracing, structured logging, metrics collection, alerting, and performance profiling.

## Features

- **Prometheus Metrics**: Counter, Gauge, Histogram, and Summary metrics with label support
- **OpenTelemetry Tracing**: Distributed tracing with span context propagation
- **Structured Logging**: JSON logging with correlation IDs and context
- **Alert Management**: Real-time alerting with multiple notification channels
- **Performance Profiling**: CPU and memory profiling with hot function detection
- **Dashboard Integration**: Unified dashboard data aggregation and export
- **Edge Optimized**: Designed specifically for Cloudflare Workers with low overhead

## Installation

```typescript
import { createMonitoringSystem } from './lib/monitoring';

const monitoring = createMonitoringSystem({
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  environment: 'production',
});

await monitoring.initialize();
```

## Quick Start

### Basic Usage

```typescript
import { createCloudflareMonitoring } from './lib/monitoring';

const { monitoring, middleware } = createCloudflareMonitoring({
  serviceName: 'my-service',
  environment: 'production',
  secrets: {
    slackWebhook: 'https://hooks.slack.com/...',
  },
});

export default {
  async fetch(request: Request, env: any, ctx: any) {
    // Apply monitoring middleware
    return middleware(request, env, ctx);
  },
};
```

### Metrics Collection

```typescript
import { MetricsCollector } from './lib/monitoring';

const collector = new MetricsCollector({ service: 'api' });

// Counter metric
const requestCounter = collector.counter('requests_total', 'Total requests', ['method', 'status']);
requestCounter(1, { method: 'GET', status: '200' });

// Gauge metric
const activeConnections = collector.gauge('active_connections', 'Active connections');
activeConnections.set(42);
activeConnections.increment(5);

// Histogram metric
const responseTime = collector.histogram('response_time_seconds', 'Response time');
responseTime(0.123);

// Summary metric
const requestSize = collector.summary('request_size_bytes', 'Request size');
requestSize(1024);
```

### Distributed Tracing

```typescript
import { createTracer } from './lib/monitoring';

const tracer = createTracer('my-service', {
  samplingRate: 0.1, // 10% sampling
  exporter: 'otlp',
  exporterEndpoint: 'https://otlp.example.com',
});

// Start a span
const spanId = tracer.startSpan('processRequest', {
  kind: 'SERVER',
  attributes: {
    'http.method': 'GET',
    'http.url': '/api/users',
  },
});

// Add events
tracer.addEvent(spanId, 'cache.lookup', { hit: true });

// Record exceptions
try {
  // Do work
} catch (error) {
  tracer.recordException(spanId, error as Error);
}

// End span
tracer.endSpan(spanId, { status: 'OK' });

// Inject trace context for downstream services
const headers = tracer.inject(spanId);
const response = await fetch('https://api.example.com', { headers });
```

### Structured Logging

```typescript
import { createLogger } from './lib/monitoring';

const logger = createLogger({ level: 'INFO' });

// Basic logging
logger.info('Request received', { method: 'GET', path: '/api/users' });
logger.warn('High latency detected', { latency: 1500 });
logger.error('Request failed', error, { userId: '123' });

// Context-aware logging
const requestLogger = logger
  .withCorrelationId('abc-123')
  .withTrace('trace-456', 'span-789')
  .withUser('user-123');

requestLogger.info('Processing request');

// Get log statistics
const stats = logger.getStats();
console.log(`Total logs: ${stats.total}`);
console.log(`Error rate: ${stats.errorRate}`);
```

### Alert Management

```typescript
import { createAlertManager, createNotificationChannel } from './lib/monitoring';

const alertManager = createAlertManager(
  { evaluationInterval: 60000 },
  metricsCollector
);

// Add alert rule
alertManager.addRule({
  id: 'high-error-rate',
  name: 'High Error Rate',
  description: 'Error rate exceeds 5%',
  enabled: true,
  severity: 'critical',
  conditions: [
    {
      metric: 'error_rate',
      operator: 'gt',
      threshold: 0.05,
      duration: 300000, // 5 minutes
    },
  ],
  notificationChannels: [
    createNotificationChannel('slack', {
      webhookUrl: 'https://hooks.slack.com/...',
    }),
    createNotificationChannel('pagerduty', {
      integrationKey: 'your-integration-key',
    }),
  ],
  cooldown: 600000, // 10 minutes
  triggerCount: 0,
});

// Get alerts
const activeAlerts = alertManager.getActiveAlerts();
const alertSummary = alertManager.getAlertSummary();

// Acknowledge/resolve alerts
alertManager.acknowledgeAlert('alert-id', 'admin@example.com');
alertManager.resolveAlert('alert-id');
```

### Performance Profiling

```typescript
import { createProfiler, createProfileContext } from './lib/monitoring';

const profiler = createProfiler({ enabled: true });

// Manual profiling
const profileId = profiler.startProfile('request-processing');

// Record samples
profiler.recordSample(profileId, {
  cpuTime: 1000,
  wallTime: 1500,
  memory: { used: 1024 * 1024, total: 128 * 1024 * 1024, limit: 128 * 1024 * 1024 },
});

// End profiling
const profile = profiler.endProfile(profileId);
console.log(`Avg CPU: ${profile.summary.avgCpuUsage}%`);
console.log(`Max memory: ${profile.summary.maxMemoryUsage} bytes`);

// Context-based profiling
const profileContext = createProfileContext(profiler);
const { result, profile } = await profileContext.profile('heavy-computation', async () => {
  return await performHeavyComputation();
});
```

### Dashboard Integration

```typescript
import { createDashboardCollector } from './lib/monitoring';

const dashboard = createDashboardCollector(
  { refreshInterval: 30000 },
  { metricsCollector, tracer, logger, alertManager, profiler }
);

// Get dashboard data
const data = await dashboard.getData('day');

// Export in different formats
const jsonExport = await dashboard.export('json');
const prometheusExport = await dashboard.export('prometheus');
const grafanaExport = await dashboard.export('grafana');
```

## API Endpoints

The monitoring system provides HTTP endpoints for metrics and monitoring data:

```
GET  /metrics                 # Prometheus metrics
GET  /metrics/json           # Metrics as JSON
GET  /metrics/stats          # Metrics statistics
GET  /dashboard              # Dashboard data
GET  /dashboard/export       # Export dashboard data
GET  /health                 # Health check
GET  /alerts                 # Alert summary
GET  /alerts/active          # Active alerts
POST /alerts/:id/resolve     # Resolve alert
POST /alerts/:id/acknowledge # Acknowledge alert
GET  /traces                 # Trace summary
GET  /traces/:id             # Trace details
GET  /logs                   # Log summary
GET  /logs/entries           # Log entries
GET  /profiles               # Profile statistics
GET  /profiles/:id           # Profile details
GET  /export                 # Export all data
POST /shutdown               # Shutdown monitoring
```

## Configuration

### Monitoring System Configuration

```typescript
const monitoring = new MonitoringSystem({
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  environment: 'production',

  // Metrics configuration
  metrics: {
    defaultLabels: {
      region: 'us-east',
      team: 'platform',
    },
    collectInterval: 60000, // 1 minute
  },

  // Tracing configuration
  tracing: {
    enabled: true,
    samplingRate: 0.1, // 10%
    exporter: 'otlp',
    exporterEndpoint: 'https://otlp.example.com',
  },

  // Logging configuration
  logging: {
    level: 'INFO',
    format: 'json',
    exportToCloudflare: true,
  },

  // Alerting configuration
  alerting: {
    enabled: true,
    evaluationInterval: 60000,
    defaultNotificationChannels: [],
  },

  // Profiling configuration
  profiling: {
    enabled: false,
    samplingInterval: 10000,
  },

  // Dashboard configuration
  dashboard: {
    refreshInterval: 30000,
    enableCaching: true,
  },
});
```

## Metrics Reference

### Request Metrics

- `requests_total`: Total number of requests
- `request_duration_seconds`: Request duration histogram
- `request_success_rate`: Request success rate gauge
- `error_rate`: Error rate gauge

### Cache Metrics

- `cache_hit_rate`: Cache hit rate by tier
- `cache_requests_total`: Cache requests by tier and status
- `cache_latency_seconds`: Cache latency by tier
- `cache_savings_dollars`: Cost savings from cache hits

### Cost Metrics

- `cost_total_dollars`: Total cost in dollars
- `cost_per_request_dollars`: Average cost per request
- `cost_forecast_dollars`: Cost forecast by period

### Provider Metrics

- `provider_up`: Provider health status
- `provider_success_rate`: Provider success rate
- `provider_latency_seconds`: Provider latency

### System Metrics

- `claudeflare_health`: System health status
- `claudeflare_uptime_seconds`: System uptime
- `claudeflare_alerts_active`: Number of active alerts

## Alert Rules

### Predefined Alert Rules

The system includes predefined alert rules for common scenarios:

- **High Error Rate**: Triggers when error rate exceeds 5%
- **High Latency**: Triggers when P95 latency exceeds 1 second
- **Low Cache Hit Rate**: Triggers when cache hit rate drops below 50%
- **High Cost**: Triggers when hourly cost exceeds $100
- **Provider Down**: Triggers when AI provider is not responding

### Custom Alert Rules

```typescript
alertManager.addRule({
  id: 'custom-rule',
  name: 'Custom Alert',
  description: 'Custom alert description',
  enabled: true,
  severity: 'warning',
  conditions: [
    {
      metric: 'custom_metric',
      operator: 'gt',
      threshold: 100,
      duration: 300000,
    },
  ],
  notificationChannels: [],
  cooldown: 600000,
  triggerCount: 0,
});
```

## Performance Considerations

### Overhead

The monitoring system is designed to have minimal overhead:

- **Metrics**: <1% CPU overhead for standard usage
- **Tracing**: Configurable sampling rate (default 10%)
- **Logging**: Asynchronous log export
- **Profiling**: Manual activation only

### Best Practices

1. **Use Sampling**: Enable tracing sampling for high-traffic services
2. **Filter Logs**: Use appropriate log levels in production
3. **Aggregate Metrics**: Use histogram buckets for distributions
4. **Set Alerts**: Configure alerts for critical metrics
5. **Monitor Overhead**: Track monitoring system performance

## Integration Examples

### With Cloudflare Workers

```typescript
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const monitoring = env.monitoring;

    // Create request-specific logger
    const logger = monitoring.logger.withCorrelationId(crypto.randomUUID());

    // Start trace
    const spanId = monitoring.tracer.startSpanFromHeaders(
      'fetch',
      Object.fromEntries(request.headers)
    );

    try {
      // Handle request
      const response = await handleRequest(request);

      // Record metrics
      monitoring.metrics.counter('requests_total')(1, {
        status: response.status.toString(),
      });

      return response;
    } catch (error) {
      logger.error('Request failed', error);
      monitoring.tracer.recordException(spanId, error as Error);
      throw error;
    } finally {
      monitoring.tracer.endSpan(spanId);
    }
  },
};
```

### With Hono

```typescript
import { Hono } from 'hono';
import { createMonitoringMiddleware } from './lib/monitoring';

const app = new Hono();
const monitoring = createMonitoringSystem({ serviceName: 'api' });

await monitoring.initialize();

// Apply monitoring middleware
app.use('*', createMonitoringMiddleware(monitoring));

app.get('/api/users', async (c) => {
  return c.json({ users: [] });
});

export default app;
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
