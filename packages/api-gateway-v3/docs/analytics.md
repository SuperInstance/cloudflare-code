# Analytics Guide

The Analytics Engine provides real-time metrics collection, querying, and dashboarding capabilities.

## Recording Events

### Basic Event Recording

```typescript
import { AnalyticsEngine } from '@claudeflare/api-gateway-v3/analytics';

const analytics = new AnalyticsEngine();

analytics.recordEvent({
  id: 'event-1',
  timestamp: Date.now(),
  type: 'request-start',
  data: {
    requestId: 'req-123',
    method: 'GET',
    url: '/api/users',
  },
  tags: ['request', 'api'],
});
```

### Event Types

```typescript
type EventType =
  | 'request-start'
  | 'request-end'
  | 'cache-hit'
  | 'cache-miss'
  | 'error'
  | 'timeout'
  | 'circuit-breaker-open'
  | 'rate-limit-exceeded'
  | 'composition-start'
  | 'composition-end'
  | 'stream-event';
```

## Recording Metrics

### Counters

```typescript
// Increment counter
analytics.increment('request.count', 1, { method: 'GET' });

// Increment by custom value
analytics.increment('bytes.sent', 1024, { endpoint: '/api/data' });
```

### Gauges

```typescript
// Set gauge value
analytics.gauge('connections.active', 42);
analytics.gauge('memory.used', 1024 * 1024 * 512);
```

### Histograms

```typescript
// Record duration
analytics.timing('request.duration', 123, { endpoint: '/api/users' });

// Record value in histogram
analytics.histogram('response.size', 2048);
```

### Custom Metrics

```typescript
analytics.recordMetric({
  name: 'custom.metric',
  value: 100,
  timestamp: Date.now(),
  dimensions: {
    environment: 'production',
    region: 'us-east-1',
  },
  tags: ['custom', 'production'],
});
```

## Querying Data

### Using QueryBuilder

```typescript
import { QueryBuilder } from '@claudeflare/api-gateway-v3/analytics';

// Query metric
const query = new QueryBuilder()
  .metric('request.count')
  .aggregation('sum')
  .lastMinutes(5)
  .build();

const result = analytics.queryMetrics(query);
console.log(result.dataPoints);
```

### Time Ranges

```typescript
// Last N minutes
const query1 = new QueryBuilder()
  .metric('request.count')
  .lastMinutes(15)
  .build();

// Last N hours
const query2 = new QueryBuilder()
  .metric('request.duration')
  .lastHours(24)
  .build();

// Custom time range
const query3 = new QueryBuilder()
  .metric('error.count')
  .timeRange(
    Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    Date.now(),
    3600000 // 1 hour intervals
  )
  .build();
```

### Filters

```typescript
const query = new QueryBuilder()
  .metric('request.count')
  .filter('method', 'eq', 'GET')
  .filter('status', 'lt', 400)
  .aggregation('count')
  .lastMinutes(5)
  .build();
```

### Aggregations

```typescript
// Sum
const sumQuery = new QueryBuilder()
  .metric('request.count')
  .aggregation('sum')
  .lastMinutes(5)
  .build();

// Average
const avgQuery = new QueryBuilder()
  .metric('request.duration')
  .aggregation('avg')
  .lastMinutes(5)
  .build();

// Min/Max
const minQuery = new QueryBuilder()
  .metric('response.time')
  .aggregation('min')
  .lastMinutes(5)
  .build();

// Percentile (default p95)
const p95Query = new QueryBuilder()
  .metric('request.duration')
  .aggregation('percentile')
  .lastMinutes(5)
  .build();
```

### Grouping

```typescript
const query = new QueryBuilder()
  .metric('request.count')
  .groupBy('method', 'endpoint')
  .aggregation('sum')
  .lastMinutes(5)
  .build();
```

## Dashboards

### Creating Dashboards

```typescript
import { DashboardBuilder, WidgetBuilder } from '@claudeflare/api-gateway-v3/analytics';

const dashboard = new DashboardBuilder()
  .id('monitoring')
  .name('Monitoring Dashboard')
  .description('Real-time monitoring')
  .refreshInterval(30000)
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
      })
      .build()
  )
  .build();

analytics.createDashboard(dashboard);
```

### Widget Types

```typescript
type WidgetType =
  | 'line-chart'    // Time series line chart
  | 'bar-chart'     // Bar chart
  | 'pie-chart'     // Pie chart
  | 'gauge'         // Gauge/meter
  | 'table'         // Data table
  | 'stat'          // Single stat
  | 'heatmap';      // Heatmap
```

### Querying Dashboards

```typescript
// Get dashboard
const dashboard = analytics.getDashboard('monitoring');

// Execute widget query
const widgetData = await analytics.executeWidget('monitoring', 'request-rate');

// List all dashboards
const dashboards = analytics.listDashboards();
```

## Metric Summaries

### Get Summary Statistics

```typescript
const summary = await analytics.getMetricSummary('request.duration');

console.log(`Count: ${summary.count}`);
console.log(`Sum: ${summary.sum}`);
console.log(`Average: ${summary.avg}`);
console.log(`Min: ${summary.min}`);
console.log(`Max: ${summary.max}`);
console.log(`P50: ${summary.p50}`);
console.log(`P95: ${summary.p95}`);
console.log(`P99: ${summary.p99}`);
```

### Get All Summaries

```typescript
const summaries = analytics.getAllMetricSummaries();

for (const [name, summary] of summaries) {
  console.log(`${name}: avg=${summary.avg}, p95=${summary.p95}`);
}
```

## Real-time Analytics

### Analytics Stream

```typescript
import { AnalyticsStream } from '@claudeflare/api-gateway-v3/analytics';

const stream = new AnalyticsStream(analytics);

// Subscribe to all events
stream.subscribeEvents('client-1');

// Subscribe to specific metrics
stream.subscribeMetrics('client-2', ['request.count', 'request.duration']);

// Listen to events
stream.on('event', (event) => {
  console.log('Event:', event);
});

stream.on('metric', ({ clientId, metric }) => {
  console.log(`Client ${clientId} metric:`, metric);
});
```

### Custom Event Handlers

```typescript
analytics.on('event', (event: AnalyticsEvent) => {
  if (event.type === 'error') {
    // Send alert
    sendAlert(event.data);
  }
});

analytics.on('metric', (metric: AnalyticsMetric) => {
  if (metric.name === 'error.rate' && metric.value > 0.05) {
    // High error rate alert
    sendAlert({
      message: 'High error rate detected',
      value: metric.value,
    });
  }
});
```

## Reports

### Creating Reports

```typescript
import { AnalyticsReporter } from '@claudeflare/api-gateway-v3/analytics';

const reporter = new AnalyticsReporter(analytics);

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
  ],
  format: 'json',
});
```

### Generating Reports

```typescript
const report = await reporter.generateReport('daily-report');

console.log('Report:', report);
```

## Configuration

### Engine Configuration

```typescript
const analytics = new AnalyticsEngine({
  enabled: true,
  bufferSize: 10000,        // Max events/metrics in buffer
  flushInterval: 10000,     // Flush interval in ms
  sampling: 1.0,            // 100% sampling
  retention: {
    events: 7 * 24 * 60 * 60 * 1000,  // 7 days
    metrics: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  aggregation: {
    enabled: true,
    interval: 60000,        // 1 minute
  },
});
```

### Sampling

Reduce overhead by sampling:

```typescript
const analytics = new AnalyticsEngine({
  sampling: 0.1, // Sample 10% of events/metrics
});

// Sampling is applied automatically
analytics.recordEvent(event); // 10% chance of being recorded
analytics.recordMetric(metric); // 10% chance of being recorded
```

## Flushing

### Manual Flush

```typescript
// Force flush buffers to storage
await analytics.flush();
```

### Flush Events

```typescript
analytics.on('flush', ({ events, metrics }) => {
  console.log(`Flushed ${events} events and ${metrics} metrics`);
});
```

## Best Practices

1. **Use counters** for incremental values
2. **Use gauges** for point-in-time values
3. **Use histograms** for distributions
4. **Set appropriate retention** based on storage
5. **Use sampling** for high-traffic scenarios
6. **Create dashboards** for common views
7. **Set up alerts** for critical metrics
8. **Query time ranges** appropriately
9. **Use aggregation** for large datasets
10. **Monitor flush size** to avoid memory issues

## Examples

See the [examples directory](../examples/analytics.ts) for complete examples.
