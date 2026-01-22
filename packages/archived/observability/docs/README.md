# ClaudeFlare Observability Platform

A comprehensive observability solution providing deep insights into application performance, user behavior, and system health with OpenTelemetry integration.

## Features

### 📊 **Metrics Collection**
- Real-time metrics collection and aggregation
- Support for Counter, Gauge, Histogram, and Summary metrics
- OpenTelemetry integration for standardized metrics
- Efficient buffering and periodic export

### 🌐 **Distributed Tracing**
- Full OpenTelemetry integration
- Multiple sampling strategies (Always, Rate Limiting, Probabilistic)
- Span propagation across services
- Automatic context correlation

### 📝 **Log Aggregation**
- Structured logging with multiple formats (JSON, text, pretty)
- Log search and filtering capabilities
- Automatic redaction of sensitive data
- Correlation with traces and metrics

### 🚀 **Application Performance Monitoring (APM)**
- Service dependency mapping
- SLI/SLO tracking
- Performance profiling
- Resource utilization monitoring
- Error rate analysis

### 🚨 **Alerting & Notification**
- Flexible alert rule creation
- Multiple notification channels (Email, Slack, PagerDuty, Webhook)
- Escalation policies
- Alert suppression and acknowledgment

### 📈 **Real-time Dashboarding**
- Customizable dashboards with various widget types
- Real-time data refresh
- Time range selection
- Interactive data exploration

### 👥 **Real User Monitoring (RUM)**
- Web Vitals tracking (LCP, FID, CLS, TBT, FCP)
- User interaction tracking
- Page view analytics
- Session replay capabilities

### 💼 **Business Metrics**
- Custom business metric collection
- KPI tracking and aggregation
- Trend analysis and forecasting
- Health scoring and recommendations

### 🐛 **Error Tracking**
- Automatic error detection and grouping
- User-reported issue tracking
- Error context and stack trace collection
- Error pattern analysis

## Quick Start

### Installation

```bash
npm install @claudeflare/observability
```

### Basic Usage

```typescript
import { initializeObservability } from '@claudeflare/observability';

// Initialize the platform
const observability = await initializeObservability({
  serviceName: 'my-app',
  environment: 'production'
});

// Record metrics
observability.getMetricsCollector().createCounter({
  name: 'requests_total',
  description: 'Total number of requests'
}).inc();

// Start a trace
const tracer = observability.getTracer();
const span = tracer.startSpan({
  name: 'process_request',
  attributes: {
    'http.method': 'GET',
    'http.path': '/api/users'
  }
});

// Log messages
observability.getLogger().info('Request processed', {
  userId: '123',
  duration: 150
});

// Record performance metrics
observability.getAPMService().recordLatency(150, 'api_request');
observability.getAPMService().recordResourceUsage(25, 45, 30);

// Record business metrics
observability.getBusinessMetricsService().recordMetric({
  id: 'revenue',
  name: 'Total Revenue',
  category: 'revenue',
  value: 15000,
  unit: 'USD'
});

// Record Web Vitals
observability.getRUMService().recordWebVitals({
  id: 'vitals-1',
  url: 'https://example.com',
  timestamp: Date.now(),
  lcp: 2500,
  fid: 100,
  cls: 0.01,
  status: 'good'
});

// Track errors
observability.getErrorTracker().recordError(new Error('Database connection failed'));
```

### Advanced Configuration

```typescript
const config = {
  tracing: {
    serviceName: 'my-microservice',
    samplingRate: 0.1,
    exporter: 'otlp',
    attributes: {
      'service.version': '1.0.0',
      'environment': 'production'
    }
  },
  metrics: {
    enabled: true,
    exportInterval: 15000
  },
  logging: {
    level: 'info',
    format: 'json',
    output: 'remote',
    correlation: {
      enableTraceCorrelation: true
    },
    redaction: {
      enabled: true,
      fields: ['password', 'token', 'secret']
    }
  },
  alerting: {
    enabled: true,
    checkInterval: 30000,
    maxAlerts: 100
  },
  dashboarding: {
    enabled: true,
    defaultRefresh: 30000
  },
  retention: {
    metricRetention: {
      counter: 86400000, // 24 hours
      gauge: 604800000   // 7 days
    },
    logRetention: 604800000, // 7 days
    traceRetention: 2592000000, // 30 days
    compressionEnabled: true,
    archiveEnabled: true
  }
};

const observability = await initializeObservability(config);
```

## Components

### MetricsCollector
Collects and aggregates application metrics.

```typescript
const collector = observability.getMetricsCollector();

// Create metrics
const counter = collector.createCounter({
  name: 'user_logins',
  description: 'Number of user logins'
});

const histogram = collector.createHistogram({
  name: 'request_duration',
  description: 'Request duration in milliseconds',
  buckets: [100, 200, 500, 1000, 2000]
});

// Record values
counter.inc();
histogram.record(450);
```

### Tracer
Provides distributed tracing capabilities.

```typescript
const tracer = observability.getTracer();

// Start operation
const span = tracer.startSpan({
  name: 'process_order',
  attributes: {
    'order.id': '12345',
    'order.amount': 99.99
  }
});

// Add child operations
const dbSpan = span.startChildSpan('database_query');
dbSpan.end();

span.end();
```

### Logger
Structured logging with search capabilities.

```typescript
const logger = observability.getLogger();

// Set context
logger.setContext({
  userId: 'user123',
  sessionId: 'session456'
});

// Log at different levels
logger.debug('Debug message');
logger.info('User login', { action: 'login', userId: 'user123' });
logger.error('Database error', { error: new Error('Connection failed') });
```

### APMService
Application Performance Monitoring.

```typescript
const apm = observability.getAPMService();

// Record performance metrics
apm.recordLatency(150, 'api_call');
apm.recordThroughput(100, 'second');
apm.recordError('database_error', 'api_call');
apm.recordResourceUsage(25, 45, 30);

// Track dependency health
apm.recordDependency(
  'database',
  'database',
  { p50: 10, p90: 50, p95: 75, p99: 100, avg: 25, max: 200 },
  0.01,
  1000
);
```

### AlertingService
Create and manage alert rules.

```typescript
const alerting = observability.getAlertingService();

// Create alert rule
const rule = alerting.createRule({
  name: 'High Error Rate',
  description: 'Alert when error rate exceeds 5%',
  condition: {
    type: 'threshold',
    metric: 'error_rate',
    operator: 'gt',
    threshold: 5,
    duration: 300000 // 5 minutes
  },
  actions: [{
    type: 'slack',
    config: {
      webhookUrl: 'https://hooks.slack.com/...',
      recipients: ['dev-team']
    }
  }],
  severity: 'critical',
  enabled: true
});

// Acknowledge or resolve alerts
alerting.acknowledgeAlert('alert-id', 'Investigating');
alerting.resolveAlert('alert-id', 'Issue resolved');
```

### DashboardService
Create custom dashboards.

```typescript
const dashboarding = observability.getDashboardService();

// Create dashboard
const dashboard = dashboarding.createDashboard({
  name: 'Application Overview',
  description: 'Main application dashboard',
  widgets: [{
    id: 'requests-widget',
    type: 'timeseries',
    title: 'Request Rate',
    position: { x: 0, y: 0 },
    size: { width: 6, height: 4 },
    queries: [{
      id: 'q1',
      query: 'sum(rate(http_requests_total[5m]))'
    }]
  }],
  refreshInterval: 30000
});
```

### RUMService
Real User Monitoring.

```typescript
const rum = observability.getRUMService();

// Record Web Vitals
rum.recordWebVitals({
  id: 'vitals-1',
  url: 'https://app.com/dashboard',
  timestamp: Date.now(),
  lcp: 1200,
  fid: 80,
  cls: 0.05,
  tbt: 150,
  status: 'good'
});

// Record user interactions
rum.recordInteraction({
  type: 'click',
  element: 'button',
  elementId: 'submit-btn',
  x: 100,
  y: 200
});

// Record page views
rum.recordPageView({
  url: 'https://app.com/dashboard',
  title: 'Dashboard',
  referrer: 'https://app.com/login'
});
```

### BusinessMetricsService
Track business KPIs.

```typescript
const businessMetrics = observability.getBusinessMetricsService();

// Record business metrics
businessMetrics.recordMetric({
  id: 'revenue',
  name: 'Daily Revenue',
  category: 'revenue',
  value: 15000,
  unit: 'USD',
  dimensions: {
    region: 'us-west',
    plan: 'premium'
  }
});

// Get metric aggregation
const aggregation = businessMetrics.getMetricAggregation('revenue', 'sum', 86400000);

// Get metric trend
const trend = businessMetrics.getMetricTrend('revenue', 86400000);
```

### ErrorTracker
Track and analyze errors.

```typescript
const errorTracker = observability.getErrorTracker();

// Record error
const error = errorTracker.recordError(new Error('Payment processing failed'), {
  userId: 'user123',
  context: {
    paymentId: 'pay456',
    amount: 99.99
  }
});

// Search errors
const results = errorTracker.searchErrors({
  search: 'payment',
  filters: {
    severity: ['error', 'critical']
  },
  sortBy: 'timestamp',
  sortOrder: 'desc'
});

// Mark error as resolved
errorTracker.markErrorResolved(error.id, 'Payment gateway fixed');
```

## Integration Guides

### Cloudflare Workers

```typescript
// wrangler.toml
[observability]
serviceName = "my-worker"
exporter = "otlp"

// worker.ts
import { initializeObservability } from '@claudeflare/observability';

export default {
  async fetch(request, env, ctx) {
    const observability = await initializeObservability({
      serviceName: 'my-worker',
      environment: 'production'
    });

    const tracer = observability.getTracer();
    const span = tracer.startSpan({
      name: 'handle_request',
      attributes: {
        'http.method': request.method,
        'http.url': request.url
      }
    });

    try {
      const response = await handleRequest(request);
      span.setAttribute('http.status', response.status);
      return response;
    } catch (error) {
      span.recordError(error);
      throw error;
    } finally {
      span.end();
    }
  }
};
```

### Browser Environment

```typescript
// index.html
<script type="module">
  import { initializeObservability } from '@claudeflare/observability';

  // Initialize RUM
  const observability = await initializeObservability({
    serviceName: 'my-web-app',
    environment: 'production'
  });

  // Track Web Vitals
  import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

  getCLS((metric) => {
    observability.getRUMService().recordWebVitals({
      id: `cls-${Date.now()}`,
      url: window.location.href,
      timestamp: Date.now(),
      cls: metric.value,
      status: metric.value < 0.1 ? 'good' : 'needs-improvement'
    });
  });

  // Track errors
  window.addEventListener('error', (event) => {
    observability.getErrorTracker().recordError({
      name: 'JavaScript Error',
      message: event.message,
      stack: event.error?.stack
    });
  });
</script>
```

### Node.js Application

```typescript
// server.ts
import express from 'express';
import { initializeObservability } from '@claudeflare/observability';

const app = express();
const observability = await initializeObservability({
  serviceName: 'express-api',
  environment: 'production'
});

// Middleware for tracing
app.use((req, res, next) => {
  const tracer = observability.getTracer();
  const span = tracer.startSpan({
    name: 'http_request',
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.user_agent': req.get('user-agent')
    }
  });

  req.span = span;

  res.on('finish', () => {
    span.setAttribute('http.status', res.statusCode);
    span.end();
  });

  next();
});

// Metrics collection
app.use((req, res, next) => {
  const counter = observability.getMetricsCollector().createCounter({
    name: 'http_requests_total',
    labels: {
      method: req.method,
      route: req.route?.path,
      status: res.statusCode.toString()
    }
  });
  counter.inc();

  next();
});

// Error handling
app.use((error, req, res, next) => {
  observability.getErrorTracker().recordError(error, {
    userId: req.user?.id,
    path: req.path
  });

  res.status(500).json({ error: 'Internal Server Error' });
});
```

## Advanced Features

### Custom Alerting

```typescript
// Create complex alert conditions
const rule = alerting.createRule({
  name: 'High Latency with Error Rate',
  description: 'Alert when both latency and error rate are high',
  condition: {
    type: 'composite',
    metric: 'composite_alert',
    operator: 'gt',
    threshold: 10,
    aggregation: 'sum'
  },
  actions: [{
    type: 'email',
    config: {
      recipients: ['devops@example.com'],
      template: 'high-priority-alert'
    }
  }, {
    type: 'pagerduty',
    config: {
      serviceKey: 'pd-service-key',
      incidentKey: 'high-latency-error'
    }
  }],
  severity: 'critical',
  cooldown: 3600000 // 1 hour
});
```

### Custom Dashboard Widgets

```typescript
// Register custom widget provider
dashboarding.registerWidgetProvider('custom-widget', {
  type: 'custom-widget',
  async fetchData(widget) {
    // Fetch data from custom source
    return {
      data: await fetchCustomData(widget.config.dataSource),
      metadata: widget.config.metadata
    };
  }
});

// Use custom widget
const dashboard = dashboarding.createDashboard({
  name: 'Custom Analytics',
  widgets: [{
    id: 'custom-analytics',
    type: 'custom-widget',
    title: 'Custom Analytics',
    position: { x: 0, y: 0 },
    size: { width: 8, height: 6 },
    config: {
      dataSource: 'api/custom-analytics',
      metadata: { format: 'json' }
    }
  }]
});
```

### Custom Business Metrics

```typescript
// Create custom metric aggregator
class RevenueAggregator {
  async aggregate(metrics, type) {
    // Custom aggregation logic
    return {
      value: metrics.reduce((sum, m) => sum + m.value, 0),
      count: metrics.length
    };
  }
}

// Register custom aggregator
businessMetrics.createAggregator('revenue', new RevenueAggregator());

// Record custom metric
businessMetrics.recordMetric({
  id: 'subscription_revenue',
  name: 'Subscription Revenue',
  category: 'revenue',
  value: 2500,
  unit: 'USD'
});
```

## Performance Tuning

### Buffer Optimization

```typescript
// Configure optimal buffer sizes
const config = {
  metrics: {
    enabled: true,
    exportInterval: 10000, // 10 seconds
    maxBufferSize: 5000   // Buffer up to 5000 metrics
  },
  logging: {
    level: 'info',
    maxLogCount: 10000,    // Keep 10,000 logs in memory
    bufferInterval: 5000   // Flush every 5 seconds
  }
};
```

### Sampling Configuration

```typescript
// Configure sampling for different environments
const config = {
  tracing: {
    samplingRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    samplingStrategy: process.env.NODE_ENV === 'production'
      ? 'probabilistic'
      : 'always'
  }
};
```

### Storage Optimization

```typescript
// Configure data retention
const config = {
  retention: {
    metricRetention: {
      counter: 86400000,    // 24 hours for counters
      gauge: 604800000,     // 7 days for gauges
      histogram: 2592000000 // 30 days for histograms
    },
    logRetention: 604800000,   // 7 days for logs
    traceRetention: 2592000000, // 30 days for traces
    compressionEnabled: true,
    archiveEnabled: true,
    archiveThreshold: 2592000000 // 30 days
  }
};
```

## API Reference

### ObservableManager

Manages all observability components.

```typescript
interface ObservableManager {
  register(name: string, component: Observable): void;
  get<T>(name: string): T;
  initializeAll(): Promise<void>;
  destroyAll(): Promise<void>;
  exportAll(): Promise<ExportResult[]>;
  getStatus(): Record<string, boolean>;
}
```

### MetricsCollector

Collects and manages application metrics.

```typescript
interface MetricsCollector {
  createCounter(options: CounterOptions): Counter;
  createGauge(options: GaugeOptions): Gauge;
  createHistogram(options: HistogramOptions): Histogram;
  createSummary(options: SummaryOptions): Summary;
  recordMetric(metric: MetricData): void;
  export(): Promise<ExportResult>;
}
```

### Tracer

Provides distributed tracing capabilities.

```typescript
interface Tracer {
  startSpan(options: SpanOptions): Span;
  getActiveSpans(): Span[];
  getCompletedSpans(): Span[];
  export(): Promise<TraceExportResult>;
}
```

For complete API documentation, see the [TypeScript definitions](../src/types/index.ts).

## Troubleshooting

### Common Issues

#### High Memory Usage
- Adjust buffer sizes in configuration
- Enable data compression
- Implement data retention policies

#### Performance Impact
- Configure appropriate sampling rates
- Use asynchronous operations where possible
- Monitor resource usage

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const observability = await initializeObservability({
  serviceName: 'my-app',
  environment: 'development',
  logging: {
    level: 'debug',
    format: 'pretty'
  }
});
```

### Metrics Not Appearing

1. Check if metrics collection is enabled
2. Verify metric names and labels
3. Check export configuration
4. Ensure proper initialization sequence

### Traces Not Capturing

1. Verify sampling rate configuration
2. Check if spans are properly started and ended
3. Ensure trace context propagation
4. Validate exporter configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see [LICENSE](../LICENSE) file for details.

## Support

For support, please:
1. Check the [troubleshooting guide](#troubleshooting)
2. Review the [documentation](https://docs.claudeflare.com/observability)
3. Open an issue on [GitHub](https://github.com/claudeflare/observability)
4. Contact the development team