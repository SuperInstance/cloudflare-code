/**
 * Basic Feature Flags Usage Examples
 */

import {
  createFeatureFlagsClient,
  type FlagStorageEnv,
  type UserAttributes,
  type EvaluationContext,
} from '../src/index.js';

// ============================================================================
// Setup
// ============================================================================

// Initialize the client
const env = {
  FLAGS_DURABLE_OBJECT: {
    idFromName: (name: string) => ({
      getFlag: async (key: string) => undefined,
      setFlag: async (flag: any) => {},
      deleteFlag: async (key: string) => true,
      listFlags: async () => [],
      getFlagCount: async () => 0,
      getRules: async (key: string) => undefined,
      setRules: async (rules: any) => {},
      deleteRules: async (key: string) => true,
    }),
  },
  ANALYTICS_DURABLE_OBJECT: {
    idFromName: (name: string) => ({
      recordEvaluation: async (evaluation: any) => {},
      recordEvent: async (event: any) => {},
      queryEvaluations: async (query: any) => [],
      queryEvents: async (query: any) => [],
      getAggregatedMetrics: async (flagId: string, period: any) => ({}),
    }),
  },
} as FlagStorageEnv;

const client = createFeatureFlagsClient(env);

// ============================================================================
// Example 1: Basic Boolean Flag Evaluation
// ============================================================================

async function example1_BasicBooleanFlag() {
  console.log('Example 1: Basic Boolean Flag Evaluation');
  console.log('=========================================');

  // Create a boolean flag
  const flag = await client.flagManagerRef.createFlag({
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

  console.log('Created flag:', flag.key);

  // Evaluate for a user
  const context: EvaluationContext = {
    userId: 'user-123',
    attributes: {
      userId: 'user-123',
      email: 'user@example.com',
      country: 'US',
    },
  };

  const result = await client.evaluateFlag('new_dashboard', context);
  console.log('Flag value:', result.value);
  console.log('Reason:', result.reason);
  console.log('Evaluation time:', result.evaluationTime, 'ms');
}

// ============================================================================
// Example 2: Flag with Rules
// ============================================================================

async function example2_FlagWithRules() {
  console.log('\nExample 2: Flag with Rules');
  console.log('==========================');

  // Create a flag with targeting rules
  await client.flagManagerRef.createFlag({
    key: 'premium_features',
    type: 'boolean',
    description: 'Enable premium features',
    defaultValue: false,
    state: 'active',
    tags: ['premium', 'monetization'],
    owner: 'product-team',
    metadata: {},
  });

  // Add targeting rules
  await client.flagManagerRef.setRules('premium_features', [
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
    {
      id: 'rule-2',
      name: 'Enterprise users',
      conditions: [
        {
          attribute: 'customAttributes.tier',
          operator: 'equals',
          value: 'enterprise',
        },
      ],
      逻辑: 'AND',
      variant: 'true',
      enabled: true,
      priority: 90,
      rolloutPercentage: 100,
    },
  ]);

  // Evaluate for premium user
  const premiumContext: EvaluationContext = {
    userId: 'user-456',
    attributes: {
      userId: 'user-456',
      customAttributes: {
        tier: 'premium',
      },
    },
  };

  const premiumResult = await client.evaluateFlag(
    'premium_features',
    premiumContext
  );
  console.log('Premium user sees flag:', premiumResult.value);

  // Evaluate for free user
  const freeContext: EvaluationContext = {
    userId: 'user-789',
    attributes: {
      userId: 'user-789',
      customAttributes: {
        tier: 'free',
      },
    },
  };

  const freeResult = await client.evaluateFlag('premium_features', freeContext);
  console.log('Free user sees flag:', freeResult.value);
}

// ============================================================================
// Example 3: Percentage Rollout
// ============================================================================

async function example3_PercentageRollout() {
  console.log('\nExample 3: Percentage Rollout');
  console.log('=============================');

  // Start a percentage rollout
  const rolloutId = await client.rolloutEngineRef.startPercentageRollout(
    'new_feature',
    20, // 20% of users
    7 * 24 * 60 * 60 * 1000 // 1 week
  );

  console.log('Started rollout:', rolloutId);

  // Evaluate for multiple users
  const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
  const results = await Promise.all(
    users.map(async (userId) => {
      const context: EvaluationContext = {
        userId,
        attributes: { userId },
      };
      const result = await client.evaluateFlag('new_feature', context);
      return { userId, value: result.value };
    })
  );

  console.log('Rollout results:');
  for (const { userId, value } of results) {
    console.log(`  ${userId}: ${value}`);
  }

  // Update rollout percentage
  await client.rolloutEngineRef.updatePercentageRollout(rolloutId, 50);
  console.log('Increased rollout to 50%');
}

// ============================================================================
// Example 4: A/B Testing
// ============================================================================

async function example4_ABTesting() {
  console.log('\nExample 4: A/B Testing');
  console.log('======================');

  // Create an A/B experiment
  const experiment = await client.abTestingEngineRef.createExperiment({
    name: 'CTA Button Color Test',
    description: 'Test different CTA button colors',
    flagId: 'cta_button_color',
    variants: [
      {
        name: 'Control (Blue)',
        description: 'Current blue button',
        value: '#007bff',
        allocation: 50,
        isControl: true,
      },
      {
        name: 'Variant A (Green)',
        description: 'Green button',
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

  console.log('Created experiment:', experiment.id);

  // Start experiment
  await client.abTestingEngineRef.startExperiment(experiment.id);
  console.log('Started experiment');

  // Assign users to variants
  const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

  for (const userId of users) {
    const variant = await client.abTestingEngineRef.assignVariant(
      experiment.id,
      userId
    );
    console.log(`User ${userId} assigned to: ${variant?.name || 'none'}`);
  }

  // Get experiment results
  const results = await client.abTestingEngineRef.getExperimentResults(
    experiment.id
  );

  console.log('\nExperiment Results:');
  for (const result of results) {
    console.log(
      `  ${result.variantId}: ${result.conversionRate.toFixed(2)}% conversion rate`
    );
  }

  // Determine winner
  const winner = await client.abTestingEngineRef.determineWinner(
    experiment.id
  );
  console.log('\nWinner:', winner?.name || 'None yet');
}

// ============================================================================
// Example 5: User Segmentation
// ============================================================================

async function example5_UserSegmentation() {
  console.log('\nExample 5: User Segmentation');
  console.log('============================');

  // Create segments
  const betaTesters = await client.targetingEngineRef.createSegment({
    name: 'Beta Testers',
    description: 'Users who opted in for beta testing',
    conditions: [
      {
        attribute: 'customAttributes.betaTester',
        operator: 'equals',
        value: true,
      },
    ],
    逻辑: 'AND',
    userIds: ['user-1', 'user-2', 'user-3'],
  });

  console.log('Created segment:', betaTesters.id);

  const powerUsers = await client.targetingEngineRef.createPowerUsersSegment(30);
  console.log('Created power users segment:', powerUsers.id);

  // Check if user is in segment
  const attributes: UserAttributes = {
    userId: 'user-1',
    customAttributes: {
      betaTester: true,
      daysActive: 45,
    },
  };

  const isBetaTester = await client.targetingEngineRef.matchesSegment(
    betaTesters.id,
    'user-1',
    attributes
  );
  console.log('User is beta tester:', isBetaTester);

  const isPowerUser = await client.targetingEngineRef.matchesSegment(
    powerUsers.id,
    'user-1',
    attributes
  );
  console.log('User is power user:', isPowerUser);

  // Get all segments for user
  const userSegments = await client.targetingEngineRef.getUserSegments(
    'user-1',
    attributes
  );
  console.log('User segments:', userSegments.map((s) => s.name));
}

// ============================================================================
// Example 6: Analytics and Metrics
// ============================================================================

async function example6_Analytics() {
  console.log('\nExample 6: Analytics and Metrics');
  console.log('=================================');

  // Get flag metrics
  const metrics = await client.analyticsEngineRef.getFlagMetrics('new_dashboard', {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date(),
  });

  if (metrics) {
    console.log('Flag Metrics:');
    console.log(`  Total evaluations: ${metrics.evaluations.total}`);
    console.log(`  Unique users: ${metrics.evaluations.uniqueUsers}`);
    console.log(`  True count: ${metrics.evaluations.trueCount}`);
    console.log(`  False count: ${metrics.evaluations.falseCount}`);
    console.log(`  Avg evaluation time: ${metrics.performance.avgEvaluationTime.toFixed(2)}μs`);
    console.log(`  Cache hit rate: ${(metrics.performance.cacheHitRate * 100).toFixed(1)}%`);
  }

  // Get evaluation time series
  const timeSeries = await client.analyticsEngineRef.getEvaluationTimeSeries(
    'new_dashboard',
    {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    },
    3600000 // 1 hour intervals
  );

  console.log('\nEvaluation Time Series:');
  for (const point of timeSeries.slice(-5)) {
    console.log(`  ${point.timestamp.toISOString()}: ${point.count} evaluations`);
  }

  // Check flag health
  const health = await client.analyticsEngineRef.getFlagHealth('new_dashboard');
  console.log('\nFlag Health:', health.status);
  for (const check of health.checks) {
    console.log(`  ${check.name}: ${check.status}`);
  }
}

// ============================================================================
// Example 7: Batch Evaluation
// ============================================================================

async function example7_BatchEvaluation() {
  console.log('\nExample 7: Batch Evaluation');
  console.log('============================');

  const flagKeys = [
    'new_dashboard',
    'premium_features',
    'new_feature',
    'cta_button_color',
  ];

  const context: EvaluationContext = {
    userId: 'user-123',
    attributes: {
      userId: 'user-123',
      customAttributes: {
        tier: 'premium',
      },
    },
  };

  const results = await client.batchEvaluateFlags(flagKeys, context);

  console.log('Batch Evaluation Results:');
  for (const [key, result] of Object.entries(results.results)) {
    console.log(`  ${key}: ${result.value} (${result.reason})`);
  }
}

// ============================================================================
// Example 8: Canary Deployment
// ============================================================================

async function example8_CanaryDeployment() {
  console.log('\nExample 8: Canary Deployment');
  console.log('==============================');

  // Start canary deployment
  const canaryId = await client.rolloutEngineRef.startCanaryDeployment(
    'new_api_version',
    10, // Start with 10%
    {
      errorRateThreshold: 0.05, // 5% error rate threshold
      latencyThreshold: 500, // 500ms latency threshold
      customMetrics: [
        {
          name: 'success_rate',
          threshold: 0.95,
          operator: 'greater_than',
        },
      ],
    }
  );

  console.log('Started canary deployment:', canaryId);

  // Increase canary percentage gradually
  await client.rolloutEngineRef.increaseCanaryPercentage(canaryId, 20);
  console.log('Increased to 30%');

  // Promote to full rollout
  await client.rolloutEngineRef.promoteCanary(canaryId);
  console.log('Promoted to 100%');
}

// ============================================================================
// Example 9: Convenience Methods
// ============================================================================

async function example9_ConvenienceMethods() {
  console.log('\nExample 9: Convenience Methods');
  console.log('================================');

  const context: EvaluationContext = {
    userId: 'user-123',
    attributes: {
      userId: 'user-123',
    },
  };

  // Boolean flag with default
  const isEnabled = await client.getBooleanFlag(
    'new_dashboard',
    context,
    false
  );
  console.log('Feature enabled:', isEnabled);

  // String flag with default
  const theme = await client.getStringFlag('theme', context, 'light');
  console.log('Theme:', theme);

  // Number flag with default
  const maxItems = await client.getNumberFlag('max_items', context, 10);
  console.log('Max items:', maxItems);

  // JSON flag with default
  const config = await client.getJsonFlag('api_config', context, {
    endpoint: '/api/v1',
    timeout: 5000,
  });
  console.log('API config:', config);
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  try {
    await example1_BasicBooleanFlag();
    await example2_FlagWithRules();
    await example3_PercentageRollout();
    await example4_ABTesting();
    await example5_UserSegmentation();
    await example6_Analytics();
    await example7_BatchEvaluation();
    await example8_CanaryDeployment();
    await example9_ConvenienceMethods();
  } catch (error) {
    console.error('Error running examples:', error);
  } finally {
    await client.shutdown();
  }
}

// Uncomment to run examples
// runAllExamples();
