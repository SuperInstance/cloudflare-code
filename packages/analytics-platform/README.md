# @claudeflare/analytics-platform

Comprehensive analytics and business intelligence platform for ClaudeFlare - a distributed AI coding platform on Cloudflare Workers.

## Features

### Core Analytics
- **Event Tracking** - High-performance event collection with validation, enrichment, and routing
- **Data Aggregation** - Time-series aggregation with caching and real-time processing
- **Statistical Analysis** - Descriptive and inferential statistics, trend analysis, anomaly detection
- **Data Visualization** - Generate charts, heatmaps, funnels, and custom dashboards
- **Custom Reports** - Build, schedule, and distribute analytics reports
- **Data Export** - Export data in multiple formats (CSV, JSON, HTML, XML, SQL)

### Product Analytics
- **DAU/MAU/WAU** - Daily, weekly, and monthly active users
- **User Growth** - New user tracking and growth rate analysis
- **Engagement Metrics** - Session duration, bounce rate, pageviews per session
- **Retention** - Day 1, 7, 30, 90 retention rates and rolling retention
- **Churn Analysis** - Churn rate, risk scoring, at-risk user identification
- **Feature Usage** - Feature adoption, usage patterns, discovery analysis

### User Behavior Analytics
- **Pageview Analytics** - Top pages, entry/exit pages, time on page
- **Interaction Tracking** - Click patterns, navigation paths, heatmaps
- **Behavior Patterns** - Usage patterns, power user identification
- **User Segmentation** - Dynamic user segments with behavioral criteria
- **Churn Prediction** - ML-based churn risk scoring
- **Upsell Opportunities** - Identify users ready for upgrade

### Revenue Analytics
- **MRR/ARR** - Monthly and annual recurring revenue
- **ARPU/LTV** - Average revenue per user and lifetime value
- **CAC** - Customer acquisition cost and payback period
- **Revenue Churn** - Revenue churn rate and net revenue retention
- **Expansion Revenue** - Upsell and cross-sell tracking
- **Revenue Forecasting** - Predict future revenue with confidence intervals

### Cohort Analysis
- **Cohort Building** - Acquisition, signup, feature, and subscription cohorts
- **Retention Tables** - Visual cohort retention matrices
- **Retention Curves** - Compare retention across cohorts
- **LTV Analysis** - Lifetime value by cohort with projections
- **Revenue Curves** - Cumulative and per-period revenue by cohort

### Funnel Analysis
- **Custom Funnels** - Define multi-step conversion funnels
- **Step Metrics** - Completion rate, dropoff, time to complete
- **Segment Comparison** - Compare funnel performance by segment
- **Bottleneck Detection** - Identify steps with high dropoff
- **Insights Generation** - Automated recommendations for optimization

## Installation

```bash
npm install @claudeflare/analytics-platform
```

## Quick Start

```typescript
import { AnalyticsPlatform } from '@claudeflare/analytics-platform';

// Create analytics platform
const analytics = new AnalyticsPlatform();

// Track events
await analytics.events.trackPageView('user123', 'https://example.com', {
  title: 'Home Page',
  referrer: 'https://google.com'
});

// Calculate product metrics
const productMetrics = await analytics.product.calculateMetrics(events, {
  start: Date.now() - 7 * 24 * 60 * 60 * 1000,
  end: Date.now()
});

// Generate visualizations
const chart = analytics.visualization.generateLineChart(data, {
  title: 'User Growth',
  xAxis: 'date',
  yAxis: 'users'
});

// Create custom report
const report = analytics.reports.createReport(
  'report1',
  'Weekly Analytics',
  'product',
  config,
  'user123'
);

// Export data
const exportResult = await analytics.export.export(data, {
  format: 'csv',
  compression: true
});
```

## Platform Configuration

```typescript
import { createRealtimeAnalyticsPlatform } from '@claudeflare/analytics-platform';

// For real-time analytics
const realtimePlatform = createRealtimeAnalyticsPlatform({
  aggregation: {
    realtimeEnabled: true,
    cacheEnabled: true
  },
  processing: {
    batchSize: 100,
    flushInterval: 10000
  }
});

// For batch processing
import { createBatchAnalyticsPlatform } from '@claudeflare/analytics-platform';
const batchPlatform = createBatchAnalyticsPlatform();

// For reporting
import { createReportingAnalyticsPlatform } from '@claudeflare/analytics-platform';
const reportingPlatform = createReportingAnalyticsPlatform();
```

## Architecture

```
analytics-platform/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── events/          # Event tracking and collection
│   ├── aggregation/     # Data aggregation engine
│   ├── statistics/      # Statistical analysis
│   ├── visualization/   # Data visualization
│   ├── reports/         # Custom report builder
│   ├── export/          # Data export system
│   ├── product/         # Product analytics
│   ├── behavior/        # User behavior analytics
│   ├── revenue/         # Revenue analytics
│   ├── cohort/          # Cohort analysis
│   ├── funnel/          # Funnel analysis
│   ├── utils/           # Utility functions
│   └── index.ts         # Main platform class
```

## API Reference

### Event Tracking

```typescript
// Track events
await analytics.events.track('page_view', userId, properties, context, metadata);
await analytics.events.trackPageView(userId, url, properties, context);
await analytics.events.trackCustom(eventName, userId, properties, context);

// Batch tracking
await analytics.events.trackBatch(events);

// Event validation
const validator = new SchemaValidator(schema);
analytics.events.addValidator('page_view', validator);
```

### Aggregation

```typescript
// Aggregate events
const results = await analytics.aggregation.aggregate(events, {
  timeWindow: 'day',
  dimensions: ['user_id', 'event_type'],
  metrics: [{ field: 'value', operations: ['sum', 'avg', 'count'] }],
  filters: [{ field: 'status', operator: 'equals', value: 'active' }]
});

// Time series aggregation
const ts = new TimeSeriesAggregator();
ts.addPoint('series1', timestamp, value, dimensions);
const aggregated = ts.aggregate('series1', 'day', 'sum');

// Real-time aggregation
const rt = new RealtimeAggregator(60000, 10000);
rt.addEvent('series1', event);
const current = rt.getAggregation('series1');
```

### Product Analytics

```typescript
// Calculate comprehensive metrics
const metrics = await analytics.product.calculateMetrics(events, timeRange);

// Individual metrics
const dau = await analytics.product.calculateDAU(events, timeRange);
const retention = await analytics.product.calculateRetention(events, timeRange);
const churn = await analytics.product.calculateChurn(events, timeRange);
```

### Revenue Analytics

```typescript
// Calculate revenue metrics
const revenue = await analytics.revenue.calculateMetrics(events, timeRange);

// Individual metrics
const mrr = await analytics.revenue.calculateMRR(events, timeRange);
const ltv = await analytics.revenue.calculateLTV(events, timeRange);
const forecast = await analytics.revenue.forecastRevenue(events, timeRange);
```

### Cohort Analysis

```typescript
// Analyze cohorts
const analysis = await analytics.cohort.analyze(events, timeRange);

// Build specific cohorts
const cohorts = await analytics.cohort.buildCohorts(events, timeRange);
const retention = await analytics.cohort.analyzeRetention(events, cohorts);
const ltv = await analytics.cohort.analyzeLTV(events, cohorts);
```

### Funnel Analysis

```typescript
// Analyze funnel
const funnel: Funnel = {
  id: 'signup_funnel',
  name: 'Signup Funnel',
  type: 'signup',
  steps: [
    { id: 'landing', name: 'Landing Page', event: 'page_view', order: 0, required: true },
    { id: 'signup', name: 'Signup', event: 'signup', order: 1, required: true },
    { id: 'activation', name: 'Activation', event: 'feature_use', order: 2, required: true }
  ],
  timeRange: { start: startDate, end: endDate, duration: duration }
};

const analysis = await analytics.funnel.analyze(events, funnel);
```

### Reports

```typescript
// Create report
const report = analytics.reports.createReport(
  id, name, type, config, owner
);

// Schedule report
analytics.reports.scheduleReport(id, {
  enabled: true,
  frequency: 'weekly',
  timezone: 'America/New_York',
  dayOfWeek: 1
});

// Configure distribution
analytics.reports.configureDistribution(id, {
  channels: [{ type: 'email', config: { to: 'user@example.com' } }],
  recipients: ['user@example.com'],
  format: 'pdf'
});

// Execute report
const result = await analytics.reports.executeReport(id);
```

### Export

```typescript
// Export data
const result = await analytics.export.export(data, {
  format: 'csv',
  compression: true,
  encryption: false,
  destination: {
    type: 's3',
    config: { bucket: 'my-bucket', region: 'us-east-1' }
  },
  fields: ['timestamp', 'userId', 'eventType'],
  includeMetadata: true
});

// Get export status
const status = analytics.export.getExport(result.id);
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please use the GitHub issue tracker.
