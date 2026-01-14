# Configuration Management System

Comprehensive configuration management for ClaudeFlare with feature flags, dynamic configuration, A/B testing, remote sync, and validation.

## Features

- **Feature Flags** - Granular control with user, tier, and percentage targeting
- **Dynamic Configuration** - Hot-reloadable config without redeployment
- **A/B Testing** - Experiment framework with variant assignment and metrics
- **Remote Sync** - Cloudflare KV integration for persistence and backup
- **Validation** - Zod schema validation for all configuration
- **Versioning** - Automatic versioning with rollback support
- **Durable Objects** - Fast in-memory config with automatic persistence

## Quick Start

```typescript
import { createConfigSystem } from '@claudeflare/edge/config';

// Initialize the complete config system
const configSystem = createConfigSystem({
  kv: env.CONFIG_KV,
  initialConfig: {
    environment: 'production',
    // ... other config
  },
});

await configSystem.initialize();

// Use feature flags
const isEnabled = configSystem.flags.isEnabled('new-feature', {
  userId: 'user-123',
  tier: 'pro',
});

// Update dynamic config
await configSystem.config.setValue('rateLimits.free.rpm', 20, 'admin');

// A/B testing
const variant = configSystem.experiments.assignVariant('ui-test', {
  userId: 'user-123',
});
```

## Feature Flags

### Basic Usage

```typescript
import { FeatureFlagManager, createFeatureFlag } from '@claudeflare/edge/config';

const flags = new FeatureFlagManager();

// Create a simple flag
const flag = createFeatureFlag('new-feature', true);
flags.setFlag(flag);

// Check if enabled
if (flags.isEnabled('new-feature')) {
  // Feature is enabled
}

// Evaluate with context
const result = flags.evaluate('new-feature', {
  userId: 'user-123',
  tier: 'pro',
  country: 'US',
});

console.log(result.enabled, result.reason);
```

### Targeting

```typescript
// Percentage rollout
import { createPercentageRolloutFlag } from '@claudeflare/edge/config';

const flag = createPercentageRolloutFlag('new-feature', 10); // 10% rollout
flags.setFlag(flag);

// User-targeted flag
import { createUserTargetedFlag } from '@claudeflare/edge/config';

const flag = createUserTargetedFlag('beta-feature', ['user-1', 'user-2']);
flags.setFlag(flag);

// Tier-targeted flag
import { createTierTargetedFlag } from '@claudeflare/edge/config';

const flag = createTierTargetedFlag('pro-feature', 'enterprise');
flags.setFlag(flag);
```

### Gradual Rollout

```typescript
// Start with 0%
const flag = createPercentageRolloutFlag('new-api', 0);
flags.setFlag(flag);

// Roll out to 10%
flags.setPercentageRollout('new-api', 10);

// Monitor metrics, then increase to 50%
flags.setPercentageRollout('new-api', 50);

// Finally, 100%
flags.setPercentageRollout('new-api', 100);
```

### Kill Switch

```typescript
// Immediately disable a problematic feature
flags.setFlagEnabled('risky-feature', false);

// All evaluations now return false
flags.isEnabled('risky-feature'); // false
```

## Dynamic Configuration

### Basic Usage

```typescript
import { DynamicConfigManager } from '@claudeflare/edge/config';

const config = new DynamicConfigManager(initialConfig);

// Get values
const version = config.getValue('version');
const maxMessages = config.getValue('ui.maxMessageLength');

// Set values
await config.setValue('ui.maxMessageLength', 20000, 'admin', 'Increase limit');

// Subscribe to changes
config.subscribe('my-sub', (event) => {
  console.log('Config changed:', event.change.path);
});
```

### Batch Updates

```typescript
await config.updateValues(
  [
    { path: 'rateLimits.free.rpm', value: 20 },
    { path: 'rateLimits.free.rpd', value: 200 },
    { path: 'rateLimits.pro.rpm', value: 200 },
  ],
  'admin'
);
```

### Rollback

```typescript
// Make some changes
await config.setValue('version', '2.0.0', 'admin');
const targetVersion = config.getCurrentVersion() - 1;

// Rollback if needed
await config.rollback(targetVersion, 'admin', 'Reverting problematic change');
```

### History and Versions

```typescript
// Get change history
const history = config.getHistory(50); // Last 50 changes

// Get version history
const versions = config.getVersions();

// Get specific version
const version = config.getVersion(5);
```

## A/B Testing

### Basic Usage

```typescript
import { ABTestingManager, createABTest } from '@claudeflare/edge/config';

const abTesting = new ABTestingManager();

// Create A/B test
const experiment = createABTest(
  'button-color-test',
  { color: 'blue', text: 'Learn More' },
  { color: 'red', text: 'Buy Now' },
  ['clicks', 'conversions']
);

experiment.enabled = true;
abTesting.setExperiment(experiment);

// Assign user to variant
const assignment = abTesting.assignVariant('button-color-test', {
  userId: 'user-123',
});

if (assignment) {
  console.log('User sees variant:', assignment.variant);
  console.log('Config:', assignment.config);

  // Render UI with variant config
  renderButton(assignment.config);
}
```

### Multi-Variant Testing

```typescript
import { createMultiVariantTest } from '@claudeflare/edge/config';

const experiment = createMultiVariantTest(
  'pricing-layout',
  [
    { name: 'layout-a', config: { columns: 2 } },
    { name: 'layout-b', config: { columns: 3 } },
    { name: 'layout-c', config: { columns: 4 } },
  ],
  ['conversions', 'revenue']
);

abTesting.setExperiment(experiment);
```

### Targeting

```typescript
const experiment = createABTest(
  'pro-feature-test',
  { featureLevel: 'basic' },
  { featureLevel: 'advanced' },
  ['usage']
);

experiment.enabled = true;
experiment.targeting.tier = 'pro'; // Only pro users
experiment.targeting.percentage = 50; // 50% of pro users

abTesting.setExperiment(experiment);
```

### Metrics

```typescript
// Record metrics for a variant
abTesting.recordMetric('button-test', 'control', 'clicks', 1);
abTesting.recordMetric('button-test', 'control', 'conversions', 1);

// Get experiment statistics
const stats = abTesting.getExperimentStats('button-test');

console.log('Total assignments:', stats.totalAssignments);
console.log('Variant distribution:', stats.variantDistribution);
console.log('Sample size reached:', stats.sampleSizeReached);
```

## Validation

```typescript
import { ConfigValidator } from '@claudeflare/edge/config';

// Validate feature flag
const flag = createFeatureFlag('test', true);
const result = ConfigValidator.validateFeatureFlag(flag);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Validate complete config
const config = getDefaultAppConfig();
const validation = ConfigValidator.validateAppConfig(config);
```

## Remote Sync

```typescript
import { ConfigSyncManager } from '@claudeflare/edge/config';

const syncManager = new ConfigSyncManager(kvCache, {
  autoSyncInterval: 60000, // 1 minute
  enableConflictResolution: true,
});

await syncManager.initialize();

// Sync from remote
const result = await syncManager.sync();

// Push to remote
await syncManager.push(config, version);

// Get status
const status = syncManager.getStatus();
console.log('Last sync:', status.lastSync);
console.log('Status:', status.status);
```

## Use Cases

### 1. Gradual Feature Rollout

```typescript
// Day 1: Roll out to 10% of users
flags.setPercentageRollout('new-feature', 10);

// Day 3: Monitor metrics, increase to 50%
flags.setPercentageRollout('new-feature', 50);

// Day 7: All users
flags.setPercentageRollout('new-feature', 100);
```

### 2. Kill Switch

```typescript
// Something is wrong with the feature
flags.setFlagEnabled('problematic-feature', false);

// Fix and re-enable
flags.setFlagEnabled('problematic-feature', true);
```

### 3. A/B Test Routing Strategies

```typescript
const experiment = createABTest(
  'routing-strategy',
  { strategy: 'round-robin' },
  { strategy: 'least-latency' },
  ['latency', 'error-rate']
);

abTesting.setExperiment(experiment);
```

### 4. User Tier-Based Features

```typescript
const proFlag = createTierTargetedFlag('advanced-analytics', 'pro');
const enterpriseFlag = createTierTargetedFlag('custom-integrations', 'enterprise');

flags.setFlag(proFlag);
flags.setFlag(enterpriseFlag);
```

### 5. Emergency Configuration Changes

```typescript
// Emergency: Reduce rate limits
await config.setValue('rateLimits.free.rpm', 5, 'admin', 'Emergency reduction');

// Monitor and revert when stable
await config.rollback(previousVersion, 'admin', 'Restore normal limits');
```

### 6. Canary Deployments

```typescript
// Start with internal users
const canary = createUserTargetedFlag('new-api', [
  'internal-user-1',
  'internal-user-2',
]);

// Gradually expand to percentage rollout
canary.targeting.users = [];
canary.targeting.percentage = 1; // 1% of users
```

## Best Practices

1. **Always use targeting** - Don't enable features for 100% immediately
2. **Monitor metrics** - Track the impact of feature flags and experiments
3. **Clean up old flags** - Remove flags that are no longer needed
4. **Document flags** - Use descriptions to explain what each flag does
5. **Test before rollout** - Use A/B testing to validate changes
6. **Set expiry dates** - Auto-disable temporary features
7. **Use versioning** - Leverage rollback capabilities
8. **Validate changes** - Always validate config before applying

## API Reference

See individual files for detailed API documentation:

- `types.ts` - Type definitions
- `feature-flags.ts` - Feature flag system
- `dynamic.ts` - Dynamic configuration
- `ab-testing.ts` - A/B testing framework
- `sync.ts` - Remote synchronization
- `validation.ts` - Configuration validation
- `store.ts` - Durable Object storage

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test feature-flags.test.ts

# Run with coverage
npm test -- --coverage
```

## License

MIT
