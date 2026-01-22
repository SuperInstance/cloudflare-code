# @claudeflare/feature-flags

Advanced feature flags system for ClaudeFlare with A/B testing, canary deployments, and real-time updates.

## Features

- **Sub-millisecond flag evaluation** - Optimized for performance with multi-level caching
- **Advanced rollout strategies** - Percentage rollouts, canary deployments, blue-green deployments
- **A/B testing** - Built-in experiment management with statistical analysis
- **User segmentation** - Advanced targeting with custom rules and segments
- **Real-time updates** - Durable Objects for instant propagation
- **Comprehensive analytics** - Track evaluations, conversions, and metrics
- **Type-safe API** - Full TypeScript support with comprehensive types

## Installation

```bash
npm install @claudeflare/feature-flags
```

## Quick Start

```typescript
import { createFeatureFlagsClient } from '@claudeflare/feature-flags';

// Initialize client
const client = createFeatureFlagsClient(env, {
  cache: {
    enabled: true,
    ttl: 60000, // 1 minute
    maxSize: 10000,
    strategy: 'lru',
  },
  analytics: {
    enabled: true,
    sampleRate: 1.0,
  },
});

// Evaluate a flag
const result = await client.evaluateFlag('my_feature', {
  userId: 'user-123',
  attributes: {
    email: 'user@example.com',
    country: 'US',
  },
});

if (result.value) {
  // Feature is enabled for this user
}
```

## Core Concepts

### Flags

Feature flags are the core building blocks. They can be boolean, string, number, or JSON types.

```typescript
import { FlagManager } from '@claudeflare/feature-flags';

const flagManager = client.flagManagerRef;

// Create a flag
const flag = await flagManager.createFlag({
  key: 'new_dashboard',
  type: 'boolean',
  description: 'Enable new dashboard UI',
  defaultValue: false,
  state: 'active',
  tags: ['ui', 'dashboard'],
  owner: 'frontend-team',
  metadata: {
    jiraTicket: 'FE-123',
  },
});

// Update a flag
await flagManager.updateFlag('new_dashboard', {
  defaultValue: true,
});

// Delete a flag
await flagManager.deleteFlag('new_dashboard');
```

### Rules and Targeting

Control who sees flags using rules and conditions:

```typescript
// Set targeting rules
await flagManager.setRules('premium_features', [
  {
    id: 'rule-1',
    name: 'Premium users',
    conditions: [
      {
        attribute: 'customAttributes.tier',
        operator: 'equals',
        value: 'premium',
      },
    ],
    逻辑: 'AND',
    variant: 'true',
    enabled: true,
    priority: 100,
    rolloutPercentage: 100,
  },
]);
```

### Rollout Strategies

Gradually roll out features using different strategies:

#### Percentage Rollout

```typescript
import { RolloutEngine } from '@claudeflare/feature-flags';

const rolloutEngine = client.rolloutEngineRef;

// Start percentage rollout
const rolloutId = await rolloutEngine.startPercentageRollout(
  'new_feature',
  20, // 20% of users
  7 * 24 * 60 * 60 * 1000 // 1 week duration
);

// Update percentage
await rolloutEngine.updatePercentageRollout(rolloutId, 50);
```

#### Gradual Rollout

```typescript
// Start gradual rollout with stages
const rolloutId = await rolloutEngine.startGradualRollout({
  flagKey: 'new_feature',
  strategy: {
    type: 'gradual',
  },
  gradualConfig: {
    stages: [
      { percentage: 10, duration: 24 * 60 * 60 * 1000 }, // 10% for 1 day
      { percentage: 50, duration: 48 * 60 * 60 * 1000 }, // 50% for 2 days
      { percentage: 100, duration: 0 }, // 100% thereafter
    ],
    interval: 60 * 60 * 1000, // Check every hour
    autoProgress: true,
  },
});
```

#### Canary Deployment

```typescript
// Start canary deployment
const canaryId = await rolloutEngine.startCanaryDeployment(
  'new_api_version',
  10, // Start with 10%
  {
    errorRateThreshold: 0.05, // 5% error rate
    latencyThreshold: 500, // 500ms latency
    customMetrics: [
      {
        name: 'success_rate',
        threshold: 0.95,
        operator: 'greater_than',
      },
    ],
  }
);

// Increase canary percentage
await rolloutEngine.increaseCanaryPercentage(canaryId, 20);

// Promote to full rollout
await rolloutEngine.promoteCanary(canaryId);

// Or rollback if issues detected
await rolloutEngine.rollbackCanary(canaryId);
```

### A/B Testing

Run experiments and analyze results:

```typescript
import { ABTestingEngine } from '@claudeflare/feature-flags';

const abTestingEngine = client.abTestingEngineRef;

// Create experiment
const experiment = await abTestingEngine.createExperiment({
  name: 'CTA Button Color Test',
  description: 'Test different CTA button colors',
  flagId: 'cta_button_color',
  variants: [
    {
      name: 'Control (Blue)',
      value: '#007bff',
      allocation: 50,
      isControl: true,
    },
    {
      name: 'Variant A (Green)',
      value: '#28a745',
      allocation: 50,
    },
  ],
  trafficAllocation: 100,
  hypothesis: 'Green button will increase conversions by 10%',
  successMetric: 'click_through_rate',
  minSampleSize: 1000,
  confidenceLevel: 0.95,
});

// Start experiment
await abTestingEngine.startExperiment(experiment.id);

// Assign user to variant
const variant = await abTestingEngine.assignVariant(
  experiment.id,
  'user-123'
);

// Get results
const results = await abTestingEngine.getExperimentResults(experiment.id);

// Determine winner
const winner = await abTestingEngine.determineWinner(experiment.id);
```

### User Segmentation

Create user segments for advanced targeting:

```typescript
import { TargetingEngine, SegmentBuilder } from '@claudeflare/feature-flags';

const targetingEngine = client.targetingEngineRef;

// Create segment using builder
const builder = new SegmentBuilder()
  .setName('Power Users')
  .setDescription('Users active for 30+ days')
  .setLogic('AND')
  .addCondition('customAttributes.daysActive', 'greater_than_or_equal', 30);

const segment = await targetingEngine.createSegment(builder.build());

// Or use convenience methods
const betaTesters = await targetingEngine.createBetaTestersSegment([
  'user-1',
  'user-2',
]);

const countrySegment = await targetingEngine.createCountrySegment('US');

// Check if user matches segment
const matches = await targetingEngine.matchesSegment(
  segment.id,
  'user-123',
  {
    userId: 'user-123',
    customAttributes: {
      daysActive: 45,
    },
  }
);

// Get all segments for user
const userSegments = await targetingEngine.getUserSegments('user-123', attributes);
```

### Analytics

Track and analyze flag usage:

```typescript
import { AnalyticsEngine, AnalyticsReporter } from '@claudeflare/feature-flags';

const analyticsEngine = client.analyticsEngineRef;

// Get flag metrics
const metrics = await analyticsEngine.getFlagMetrics('my_feature', {
  start: new Date(Date.now() - 24 * 60 * 60 * 1000),
  end: new Date(),
});

console.log(`Total evaluations: ${metrics.evaluations.total}`);
console.log(`Unique users: ${metrics.evaluations.uniqueUsers}`);
console.log(`Cache hit rate: ${metrics.performance.cacheHitRate}`);

// Get evaluation time series
const timeSeries = await analyticsEngine.getEvaluationTimeSeries(
  'my_feature',
  {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
  },
  3600000 // 1 hour intervals
);

// Generate reports
const reporter = new AnalyticsReporter(analyticsEngine);
const report = await reporter.generateDailyReport();
const jsonReport = reporter.exportReportAsJSON(report);
const csvReport = reporter.exportReportAsCSV(report);
```

## API Reference

### Client Methods

#### `evaluateFlag(flagKey, context)`
Evaluate a single flag for a user context.

#### `batchEvaluateFlags(flagKeys, context)`
Evaluate multiple flags in parallel.

#### `getBooleanFlag(flagKey, context, defaultValue)`
Get boolean flag value with default fallback.

#### `getStringFlag(flagKey, context, defaultValue)`
Get string flag value with default fallback.

#### `getNumberFlag(flagKey, context, defaultValue)`
Get number flag value with default fallback.

#### `getJsonFlag(flagKey, context, defaultValue)`
Get JSON flag value with default fallback.

### Flag Manager

#### `createFlag(flagData)`
Create a new feature flag.

#### `getFlag(key)`
Get a flag by key.

#### `updateFlag(key, updates)`
Update an existing flag.

#### `deleteFlag(key)`
Delete a flag.

#### `setRules(flagKey, rules)`
Set targeting rules for a flag.

### Rollout Engine

#### `startPercentageRollout(flagKey, percentage, duration?)`
Start a percentage-based rollout.

#### `startGradualRollout(config)`
Start a gradual rollout with stages.

#### `startCanaryDeployment(flagKey, percentage, criteria)`
Start a canary deployment.

#### `rollbackRollout(rolloutId)`
Rollback an active rollout.

### A/B Testing Engine

#### `createExperiment(config)`
Create a new A/B experiment.

#### `startExperiment(experimentId)`
Start an experiment.

#### `assignVariant(experimentId, userId)`
Assign a user to a variant.

#### `getExperimentResults(experimentId)`
Get experiment results with statistical analysis.

#### `determineWinner(experimentId)`
Determine the winning variant.

### Targeting Engine

#### `createSegment(config)`
Create a user segment.

#### `matchesSegment(segmentId, userId, attributes)`
Check if user matches segment.

#### `getUserSegments(userId, attributes)`
Get all segments a user belongs to.

### Analytics Engine

#### `getFlagMetrics(flagKey, period)`
Get metrics for a flag.

#### `getEvaluationTimeSeries(flagKey, period, interval)`
Get evaluation time series data.

#### `getFlagHealth(flagKey)`
Get health status for a flag.

## Performance

The feature flags system is optimized for performance:

- **Sub-millisecond evaluation** - Average evaluation time < 1ms
- **Multi-level caching** - L1 in-memory cache with optional L2 distributed cache
- **Parallel evaluation** - Batch evaluate multiple flags concurrently
- **Efficient hashing** - Consistent user hashing for deterministic assignments

## Best Practices

1. **Use descriptive flag keys** - `new_dashboard_ui` instead of `flag1`
2. **Set appropriate TTLs** - Balance freshness with performance
3. **Monitor metrics** - Track evaluation times and cache hit rates
4. **Use segments** - Organize users into reusable segments
5. **Set min sample sizes** - Ensure statistical significance in experiments
6. **Roll out gradually** - Use percentage or gradual rollouts for safety
7. **Set up alerts** - Monitor canary deployments for automatic rollback

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
