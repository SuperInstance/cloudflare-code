# ClaudeFlare Analytics Platform

Comprehensive performance analytics and ML Ops system for ClaudeFlare, a distributed AI coding platform on Cloudflare Workers.

## Features

### Real-time Performance Monitoring
- Request rate and throughput tracking
- Response time metrics (P50, P95, P99)
- Error rate monitoring and classification
- Resource utilization tracking (CPU, memory, storage, network)
- Custom metric collection
- Anomaly detection
- Health status monitoring

### A/B Testing Framework
- Experiment design and management
- Multiple allocation strategies:
  - Random assignment
  - Stratified sampling
  - Cohort analysis
  - Multi-armed bandit
  - Thompson sampling
- Statistical analysis:
  - Frequentist tests (t-test, chi-square, Mann-Whitney)
  - Bayesian analysis
  - Sequential testing
- Sample size calculation
- Automated winner determination
- Real-time progress tracking

### Feature Flags
- Boolean flags
- Multivariate flags
- Kill switches
- Permission flags
- Experimentation flags
- Advanced targeting rules
- Rollout strategies:
  - All users
  - Percentage-based
  - Gradual rollout
  - Targeted rollout
  - Canary deployment
  - Blue-green deployment
- Environment-specific configuration
- User segmentation

### ML Model Monitoring
- Model performance metrics:
  - Accuracy, precision, recall, F1 score
  - AUC-ROC, AUC-PR
  - Log loss
  - Calibration metrics
- Data drift detection:
  - Feature drift (covariate, prior, conditional)
  - Prediction drift
  - Concept drift
  - Label shift
- Distribution analysis
- Model explainability:
  - Feature importance
  - SHAP values
  - Error analysis
- Resource usage tracking

### Performance Insights
- Anomaly detection:
  - Isolation Forest
  - Statistical methods
  - Moving average
- Bottleneck identification
- Trend analysis
- Forecasting (linear regression, ARIMA)
- Optimization opportunities
- Automated recommendations

### Analytics Reports
- Performance reports
- Experiment reports
- Feature flag reports
- ML model reports
- Executive summaries
- Custom reports
- Multiple visualization types:
  - Line charts
  - Bar charts
  - Pie charts
  - Tables
  - Heatmaps
  - Funnels
- Export to JSON, CSV, PDF
- Scheduled reports

## Installation

```bash
npm install @claudeflare/analytics
```

## Quick Start

```typescript
import { AnalyticsPlatform, createInMemoryAnalytics } from '@claudeflare/analytics';

// Create analytics platform
const analytics = createInMemoryAnalytics();

// Start the platform
await analytics.start();

// Record metrics
await analytics.monitor.recordMetric({
  name: 'request_count',
  value: 1,
  timestamp: Date.now(),
  tags: { method: 'GET' },
});

// Get performance metrics
const metrics = await analytics.monitor.getPerformanceMetrics();

// Create an A/B test
const experiment = await analytics.experiments.createExperiment({
  name: 'Button Color Test',
  description: 'Test different button colors',
  hypothesis: 'Red button will increase clicks',
  metrics: [
    {
      name: 'click_rate',
      type: 'primary',
      improvementDirection: 'increase',
    },
  ],
  variants: [
    { id: 'control', name: 'Blue', weight: 50, isControl: true, config: {} },
    { id: 'treatment', name: 'Red', weight: 50, config: {} },
  ],
  allocationStrategy: 'random',
  trafficAllocation: { totalPercentage: 100, byVariant: { control: 50, treatment: 50 } },
  status: 'draft',
  sampleSize: 1000,
  statisticalConfig: {
    significanceLevel: 0.05,
    statisticalPower: 0.8,
    minimumSampleSize: 1000,
    testType: 't_test',
  },
});

// Create a feature flag
const flag = await analytics.features.createFlag({
  name: 'new_dashboard',
  description: 'New dashboard UI',
  type: 'boolean',
  enabled: true,
  rules: [],
  rolloutStrategy: 'gradual',
  environmentConfig: {
    development: true,
    staging: true,
    production: false,
  },
});

// Evaluate flag for user
const result = await analytics.features.evaluateFlag(flag.id, {
  userId: 'user123',
  environment: 'development',
});

// Monitor ML model
await analytics.ml.registerModel({
  modelId: 'recommendation-model',
  modelVersion: 'v1.0',
  features: ['user_age', 'user_history', 'item_features'],
  predictions: ['click_probability'],
  thresholdConfig: {
    featureDriftThreshold: 0.5,
    predictionDriftThreshold: 0.5,
    performanceDegradationThreshold: 0.1,
    enableAlerts: true,
  },
});

// Record prediction
await analytics.ml.recordPrediction({
  modelId: 'recommendation-model',
  predictionId: 'pred123',
  features: { user_age: 25, user_history: 100, item_features: 0.5 },
  prediction: 0.8,
  probability: 0.8,
  timestamp: Date.now(),
  latency: 50,
});

// Generate insights
const insights = await analytics.insights.generateInsights();

// Generate report
const report = await analytics.reports.generatePerformanceReport({
  start: Date.now() - 24 * 60 * 60 * 1000,
  end: Date.now(),
  duration: 24 * 60 * 60 * 1000,
});
```

## Storage Backends

### In-Memory Storage

```typescript
const analytics = createInMemoryAnalytics();
```

### KV Storage

```typescript
const analytics = createAnalyticsWithKV(kv, {
  monitoring: { aggregationWindow: 60000 },
});
```

### D1 Storage

```typescript
const analytics = createAnalyticsWithD1(db, {
  monitoring: { aggregationWindow: 60000 },
});
```

## Middleware Integration

```typescript
import { createAnalyticsMiddleware } from '@claudeflare/analytics';

export default {
  async fetch(request: Request, env: any) {
    const analytics = env.analytics;
    const middleware = createAnalyticsMiddleware(analytics);

    return middleware.fetch(request, env);
  },
};
```

## API Reference

### RealtimeMonitor

```typescript
// Record a metric
await monitor.recordMetric({
  name: 'response_time',
  value: 123,
  timestamp: Date.now(),
  tags: { endpoint: '/api/users' },
});

// Get performance metrics
const metrics = await monitor.getPerformanceMetrics();

// Detect anomalies
const anomalies = await monitor.detectAnomalies('response_time');

// Get health status
const health = await monitor.getHealthStatus();
```

### ABTestingFramework

```typescript
// Create experiment
const experiment = await abTesting.createExperiment(config);

// Start experiment
await abTesting.startExperiment(experiment.id);

// Assign user to variant
const variant = await abTesting.assignVariant(experiment.id, 'user123');

// Record metric
await abTesting.recordMetric(experiment.id, 'user123', 'clicks', 1);

// Get results
const results = await abTesting.getResults(experiment.id);
```

### FeatureFlagService

```typescript
// Create flag
const flag = await featureFlags.createFlag(config);

// Evaluate flag
const result = await featureFlags.evaluateFlag(flag.id, {
  userId: 'user123',
  attributes: { plan: 'premium' },
  environment: 'production',
});

// Get all flags for user
const flags = await featureFlags.getAllFlagsForUser(context);
```

### ModelMonitoringService

```typescript
// Register model
await mlMonitoring.registerModel(config);

// Record prediction
await mlMonitoring.recordPrediction(record);

// Record label
await mlMonitoring.recordLabel(modelId, predictionId, label);

// Get metrics
const metrics = await mlMonitoring.getModelMetrics(modelId);

// Get health status
const health = await mlMonitoring.getHealthStatus(modelId);
```

### PerformanceInsightsService

```typescript
// Generate insights
const insights = await insights.generateInsights();

// Get insights by type
const anomalies = await insights.getInsights({ type: 'anomaly' });

// Get insights by severity
const critical = await insights.getInsights({ severity: 'critical' });
```

### AnalyticsReportsService

```typescript
// Generate performance report
const report = await reports.generatePerformanceReport(timeRange);

// Create custom report
const report = await reports.createReport(config);

// Export report
const { data, contentType } = await reports.exportReport(reportId, 'csv');

// Schedule report
await reports.scheduleReport(reportId, {
  frequency: 'weekly',
  time: '09:00',
  timezone: 'UTC',
  recipients: ['admin@example.com'],
});
```

## License

MIT
