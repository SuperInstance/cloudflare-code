/**
 * Configuration Management System - Real-World Examples
 *
 * This file demonstrates practical usage patterns for the configuration
 * management system in production scenarios.
 */

import {
  FeatureFlagManager,
  DynamicConfigManager,
  ABTestingManager,
  createFeatureFlag,
  createPercentageRolloutFlag,
  createUserTargetedFlag,
  createTierTargetedFlag,
  createABTest,
  createMultiVariantTest,
  getDefaultAppConfig,
} from './index';

// ============================================================================
// Example 1: Gradual Feature Rollout
// ============================================================================

async function gradualRolloutExample() {
  const flags = new FeatureFlagManager();

  // Day 1: Enable feature for internal testing only
  console.log('📅 Day 1: Internal Testing');
  const internalFlag = createUserTargetedFlag('new-dashboard', [
    'user-internal-1',
    'user-internal-2',
    'user-internal-3',
  ]);
  flags.setFlag(internalFlag);

  // Verify only internal users see it
  console.log('Internal user:', flags.isEnabled('new-dashboard', { userId: 'user-internal-1' })); // true
  console.log('Regular user:', flags.isEnabled('new-dashboard', { userId: 'user-regular' })); // false

  // Day 3: Roll out to 10% of users
  console.log('\n📅 Day 3: 10% Rollout');
  flags.setPercentageRollout('new-dashboard', 10);

  // Check distribution
  let enabledCount = 0;
  const sampleSize = 1000;
  for (let i = 0; i < sampleSize; i++) {
    if (flags.isEnabled('new-dashboard', { userId: `user-${i}` })) {
      enabledCount++;
    }
  }
  console.log(`Enabled: ${enabledCount}/${sampleSize} (${(enabledCount / sampleSize * 100).toFixed(1)}%)`);

  // Day 7: Increase to 50% after monitoring shows no issues
  console.log('\n📅 Day 7: 50% Rollout');
  flags.setPercentageRollout('new-dashboard', 50);

  // Day 14: Full rollout
  console.log('\n📅 Day 14: 100% Rollout');
  flags.setPercentageRollout('new-dashboard', 100);
  console.log('All users:', flags.isEnabled('new-dashboard', { userId: 'any-user' })); // true
}

// ============================================================================
// Example 2: Kill Switch for Problematic Features
// ============================================================================

async function killSwitchExample() {
  const flags = new FeatureFlagManager();

  // Enable a new feature
  const feature = createFeatureFlag('experimental-api', true, {
    description: 'New experimental API endpoints',
    owner: 'backend-team',
  });
  flags.setFlag(feature);

  console.log('Feature enabled:', flags.isEnabled('experimental-api')); // true

  // Something goes wrong - high error rates detected
  console.log('\n🚨 High error rate detected!');

  // Immediately disable
  flags.setFlagEnabled('experimental-api', false);

  console.log('Feature disabled:', flags.isEnabled('experimental-api')); // false

  // All requests now bypass the feature
  const result = flags.evaluate('experimental-api', { userId: 'user-123' });
  console.log('Evaluation result:', result.enabled, result.reason);

  // Fix the issue, then re-enable gradually
  console.log('\n🔧 Issue fixed, re-enabling gradually...');
  flags.setFlagEnabled('experimental-api', true);
  flags.setPercentageRollout('experimental-api', 10); // Start with 10%
}

// ============================================================================
// Example 3: A/B Testing Pricing Page
// ============================================================================

async function abTestingPricingExample() {
  const abTesting = new ABTestingManager();

  // Create experiment for pricing page layout
  const experiment = createABTest(
    'pricing-page-layout-2024',
    {
      layout: 'sidebar',
      ctaColor: 'blue',
      highlightedPlan: 'pro',
    },
    {
      layout: 'cards',
      ctaColor: 'green',
      highlightedPlan: 'enterprise',
    },
    ['view_pricing', 'click_upgrade', 'complete_purchase']
  );

  experiment.enabled = true;
  experiment.hypothesis = 'Card-based layout with green CTA increases conversions';
  experiment.requiredSampleSize = 1000;
  abTesting.setExperiment(experiment);

  // Simulate user traffic
  const conversions = new Map<string, number>();
  const sampleSize = 1000;

  for (let i = 0; i < sampleSize; i++) {
    const assignment = abTesting.assignVariant('pricing-page-layout-2024', {
      userId: `user-${i}`,
    });

    if (assignment) {
      // Simulate conversion (random for demo)
      const converted = Math.random() < 0.05; // 5% conversion rate

      if (converted) {
        const current = conversions.get(assignment.variant) || 0;
        conversions.set(assignment.variant, current + 1);

        // Record metric
        abTesting.recordMetric('pricing-page-layout-2024', assignment.variant, 'complete_purchase', 1);
      }
    }
  }

  // Get results
  const stats = abTesting.getExperimentStats('pricing-page-layout-2024');
  console.log('\n📊 Experiment Results:');
  console.log('Total assignments:', stats?.totalAssignments);
  console.log('Variant distribution:', stats?.variantDistribution);
  console.log('Conversions per variant:', Object.fromEntries(conversions));

  // Calculate conversion rates
  for (const [variant, count] of stats!.variantDistribution.entries()) {
    const conversions_count = conversions.get(variant) || 0;
    const rate = (conversions_count / count * 100).toFixed(2);
    console.log(`  ${variant}: ${conversions_count}/${count} (${rate}% conversion)`);
  }
}

// ============================================================================
// Example 4: Tier-Based Feature Access
// ============================================================================

async function tierBasedFeaturesExample() {
  const flags = new FeatureFlagManager();

  // Create features for different tiers
  const basicFeatures = createTierTargetedFlag('basic-analytics', 'free');
  const proFeatures = createTierTargetedFlag('advanced-analytics', 'pro');
  const enterpriseFeatures = createTierTargetedFlag('custom-integrations', 'enterprise');

  flags.setFlag(basicFeatures);
  flags.setFlag(proFeatures);
  flags.setFlag(enterpriseFeatures);

  // Test access for different users
  const users = [
    { id: 'free-user', tier: 'free' as const },
    { id: 'pro-user', tier: 'pro' as const },
    { id: 'enterprise-user', tier: 'enterprise' as const },
  ];

  console.log('\n👥 Feature Access by Tier:');
  for (const user of users) {
    console.log(`\n${user.id} (${user.tier}):`);
    console.log('  Basic analytics:', flags.isEnabled('basic-analytics', { tier: user.tier }));
    console.log('  Advanced analytics:', flags.isEnabled('advanced-analytics', { tier: user.tier }));
    console.log('  Custom integrations:', flags.isEnabled('custom-integrations', { tier: user.tier }));
  }
}

// ============================================================================
// Example 5: Emergency Configuration Changes
// ============================================================================

async function emergencyConfigChangeExample() {
  const config = new DynamicConfigManager(getDefaultAppConfig());

  console.log('📊 Current rate limits:');
  console.log('Free tier RPM:', config.getValue('rateLimits.free.rpm'));

  // Emergency: System under heavy load, need to reduce limits
  console.log('\n🚨 System under heavy load! Reducing rate limits...');

  await config.setValue('rateLimits.free.rpm', 5, 'admin', 'Emergency: Reduce load');
  await config.setValue('rateLimits.pro.rpm', 50, 'admin', 'Emergency: Reduce load');

  console.log('New free tier RPM:', config.getValue('rateLimits.free.rpm'));
  console.log('New pro tier RPM:', config.getValue('rateLimits.pro.rpm'));

  // Monitor and stabilize
  console.log('\n📈 System stabilized. Restoring normal limits...');

  const previousVersion = config.getCurrentVersion() - 1;
  await config.rollback(previousVersion, 'admin', 'Restore normal rate limits');

  console.log('Restored free tier RPM:', config.getValue('rateLimits.free.rpm'));
  console.log('Restored pro tier RPM:', config.getValue('rateLimits.pro.rpm'));

  // Check change history
  console.log('\n📜 Change History:');
  const history = config.getHistory(3);
  for (const change of history) {
    console.log(`  ${change.path}: ${change.oldValue} → ${change.newValue}`);
    console.log(`    Author: ${change.author}, Reason: ${change.reason}`);
  }
}

// ============================================================================
// Example 6: Canary Deployment
// ============================================================================

async function canaryDeploymentExample() {
  const flags = new FeatureFlagManager();

  // Stage 1: Internal users only
  console.log('🚀 Stage 1: Canary to internal users');
  const canary = createUserTargetedFlag('new-api-version', [
    'user-internal-1',
    'user-internal-2',
    'user-qa-1',
  ]);
  canary.description = 'Canary: New API version v2.0';
  flags.setFlag(canary);

  // Monitor metrics for internal users
  console.log('Internal users with new API:', flags.isEnabled('new-api-version', { userId: 'user-internal-1' }));
  console.log('External users with new API:', flags.isEnabled('new-api-version', { userId: 'user-external' }));

  // Stage 2: Expand to 1% of traffic
  console.log('\n🚀 Stage 2: Expand to 1% of users');
  canary.targeting.users = []; // Clear explicit user list
  canary.targeting.percentage = 1;
  flags.setFlag(canary);

  // Check distribution
  let enabled = 0;
  for (let i = 0; i < 1000; i++) {
    if (flags.isEnabled('new-api-version', { userId: `user-${i}` })) {
      enabled++;
    }
  }
  console.log(`Users with new API: ${enabled}/1000 (${(enabled / 10).toFixed(1)}%)`);

  // Stage 3: Expand to 10% after verifying metrics
  console.log('\n🚀 Stage 3: Expand to 10% of users');
  flags.setPercentageRollout('new-api-version', 10);

  // Stage 4: Full rollout
  console.log('\n🚀 Stage 4: Full rollout');
  flags.setPercentageRollout('new-api-version', 100);
  console.log('All users:', flags.isEnabled('new-api-version', { userId: 'any-user' }));
}

// ============================================================================
// Example 7: Multi-Variant Testing
// ============================================================================

async function multiVariantTestingExample() {
  const abTesting = new ABTestingManager();

  // Test 3 different pricing strategies
  const experiment = createMultiVariantTest(
    'pricing-strategy-2024',
    [
      {
        name: 'monthly-10',
        config: {
          billing: 'monthly',
          discount: 10,
        },
      },
      {
        name: 'yearly-20',
        config: {
          billing: 'yearly',
          discount: 20,
        },
      },
      {
        name: 'lifetime-50',
        config: {
          billing: 'lifetime',
          discount: 50,
        },
      },
    ],
    ['view_pricing', 'start_trial', 'convert_paid']
  );

  experiment.enabled = true;
  abTesting.setExperiment(experiment);

  // Assign users and track results
  const results = new Map<string, { views: number; conversions: number }>();

  for (let i = 0; i < 100; i++) {
    const assignment = abTesting.assignVariant('pricing-strategy-2024', {
      userId: `user-${i}`,
    });

    if (assignment) {
      // Initialize tracking
      if (!results.has(assignment.variant)) {
        results.set(assignment.variant, { views: 0, conversions: 0 });
      }

      const stats = results.get(assignment.variant)!;
      stats.views++;

      // Simulate conversion
      if (Math.random() < 0.1) {
        stats.conversions++;
        abTesting.recordMetric('pricing-strategy-2024', assignment.variant, 'convert_paid', 1);
      }
    }
  }

  // Display results
  console.log('\n📊 Multi-Variant Test Results:');
  for (const [variant, stats] of results.entries()) {
    const rate = (stats.conversions / stats.views * 100).toFixed(1);
    console.log(`  ${variant}: ${stats.conversions}/${stats.views} (${rate}% conversion)`);
  }
}

// ============================================================================
// Example 8: Configuration Subscribers
// ============================================================================

async function configSubscriberExample() {
  const config = new DynamicConfigManager(getDefaultAppConfig());

  // Subscribe to configuration changes
  const unsubscribe = config.subscribe('audit-log', async (event) => {
    console.log('\n📝 Configuration Changed:');
    console.log(`  Path: ${event.change.path}`);
    console.log(`  Author: ${event.change.author}`);
    console.log(`  Version: ${event.version}`);

    // Could send to external monitoring system
    // await sendToAuditLog(event);
  });

  // Make some changes
  await config.setValue('version', '2.0.0', 'developer-1');
  await config.setValue('environment', 'staging', 'developer-2');

  // Unsubscribe when done
  unsubscribe();
}

// ============================================================================
// Example 9: Feature Dependencies
// ============================================================================

async function featureDependenciesExample() {
  const flags = new FeatureFlagManager();

  // Create dependent features
  const baseFeature = createFeatureFlag('collaboration', true);
  const realtimeFeature = createFeatureFlag('realtime-sync', true);
  const presenceFeature = createFeatureFlag('user-presence', true);

  flags.setFlag(baseFeature);
  flags.setFlag(realtimeFeature);
  flags.setFlag(presenceFeature);

  // Check if all dependencies are met
  const userId = 'user-123';
  const context = { userId };

  const hasCollaboration = flags.isEnabled('collaboration', context);
  const hasRealtime = flags.isEnabled('realtime-sync', context);
  const hasPresence = flags.isEnabled('user-presence', context);

  if (hasCollaboration && hasRealtime && hasPresence) {
    console.log('✅ All collaboration features enabled');
    // Enable full collaboration UI
  } else if (hasCollaboration) {
    console.log('⚠️ Basic collaboration only');
    // Enable basic collaboration
  } else {
    console.log('❌ Collaboration not available');
  }
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Configuration Management System - Real-World Examples  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await gradualRolloutExample();
  console.log('\n' + '─'.repeat(60) + '\n');

  await killSwitchExample();
  console.log('\n' + '─'.repeat(60) + '\n');

  await abTestingPricingExample();
  console.log('\n' + '─'.repeat(60) + '\n');

  await tierBasedFeaturesExample();
  console.log('\n' + '─'.repeat(60) + '\n');

  await emergencyConfigChangeExample();
  console.log('\n' + '─'.repeat(60) + '\n');

  await canaryDeploymentExample();
  console.log('\n' + '─'.repeat(60) + '\n');

  await multiVariantTestingExample();
  console.log('\n' + '─'.repeat(60) + '\n');

  await configSubscriberExample();
  console.log('\n' + '─'.repeat(60) + '\n');

  await featureDependenciesExample();
  console.log('\n' + '─'.repeat(60) + '\n');

  console.log('✅ All examples completed!');
}

// Export for use in tests or demonstrations
export {
  gradualRolloutExample,
  killSwitchExample,
  abTestingPricingExample,
  tierBasedFeaturesExample,
  emergencyConfigChangeExample,
  canaryDeploymentExample,
  multiVariantTestingExample,
  configSubscriberExample,
  featureDependenciesExample,
};
