/**
 * Autoscaling Usage Examples
 *
 * This file demonstrates various autoscaling scenarios
 */

import { Autoscaler } from '@claudeflare/autoscaling';

// ============================================================================
// Example 1: Basic Autoscaling Setup
// ============================================================================

async function basicSetup() {
  console.log('=== Basic Autoscaling Setup ===\n');

  // Initialize autoscaler
  const autoscaler = new Autoscaler({
    config: {
      enabled: true,
      evaluationInterval: 60000, // Check every minute
      targetUtilization: 70,     // Target 70% utilization
      scaleUpThreshold: 80,      // Scale up at 80%
      scaleDownThreshold: 30     // Scale down at 30%
    }
  });

  // Add scaling policy for a worker
  const workerPolicy = autoscaler.addScalingPolicy('api-worker', 'worker');
  console.log('Added worker policy:', workerPolicy.name);

  // Start autoscaling
  await autoscaler.start();
  console.log('Autoscaler started\n');

  return autoscaler;
}

// ============================================================================
// Example 2: CPU-Based Scaling
// ============================================================================

async function cpuBasedScaling() {
  console.log('=== CPU-Based Scaling ===\n');

  const { CpuScalingPolicy } = await import('@claudeflare/autoscaling');

  const cpuPolicy = new CpuScalingPolicy({
    scaleUpThreshold: 75,      // Scale up at 75% CPU
    scaleDownThreshold: 25,    // Scale down at 25% CPU
    minInstances: 2,
    maxInstances: 50,
    monitorBurst: true         // Monitor burst capacity
  });

  // Calculate target instances based on current CPU
  const currentInstances = 10;
  const cpuUtil = 85; // 85% CPU utilization
  const cpuCredits = 30; // 30% burst credits remaining

  const targetInstances = cpuPolicy.calculateTargetInstances(
    currentInstances,
    cpuUtil,
    cpuCredits
  );

  console.log(`Current instances: ${currentInstances}`);
  console.log(`CPU utilization: ${cpuUtil}%`);
  console.log(`CPU credits: ${cpuCredits}%`);
  console.log(`Recommended instances: ${targetInstances}\n`);

  // Detect anomalies
  const cpuHistory = [45, 48, 52, 55, 85, 88, 92, 95];
  const anomalies = cpuPolicy.detectAnomalies(cpuHistory);

  if (anomalies.length > 0) {
    console.log('CPU anomalies detected:');
    anomalies.forEach(anomaly => {
      console.log(`  Index ${anomaly.index}: ${anomaly.value.toFixed(1)}% (z-score: ${anomaly.score.toFixed(2)})`);
    });
    console.log('');
  }
}

// ============================================================================
// Example 3: Memory Scaling with Leak Detection
// ============================================================================

async function memoryScaling() {
  console.log('=== Memory Scaling with Leak Detection ===\n');

  const { MemoryScalingPolicy } = await import('@claudeflare/autoscaling');

  const memoryPolicy = new MemoryScalingPolicy({
    scaleUpThreshold: 80,
    scaleDownThreshold: 40,
    leakDetectionEnabled: true,
    leakThreshold: 50,        // 50 MB/min indicates leak
    oomPreventionEnabled: true
  });

  // Simulate memory growth pattern
  const resourceId = 'worker-with-leak';

  // Record memory usage over time (simulating leak)
  for (let i = 0; i < 20; i++) {
    memoryPolicy.recordMemoryUsage(resourceId, 500 + i * 30);
  }

  // Check for memory leaks
  const leakStatus = memoryPolicy.detectMemoryLeak(resourceId);

  console.log(`Memory leak detected: ${leakStatus.isLeaking}`);
  console.log(`Growth rate: ${leakStatus.growthRate.toFixed(2)} MB/min`);
  console.log(`Confidence: ${(leakStatus.confidence * 100).toFixed(1)}%\n`);

  // Get memory statistics
  const stats = memoryPolicy.getMemoryStats(resourceId);
  if (stats) {
    console.log('Memory statistics:');
    console.log(`  Current: ${stats.current.toFixed(1)} MB`);
    console.log(`  Average: ${stats.average.toFixed(1)} MB`);
    console.log(`  Peak: ${stats.peak.toFixed(1)} MB`);
    console.log(`  Trend: ${stats.trend}\n`);
  }

  // Get recommended actions
  const actions = memoryPolicy.getRecommendedActions(resourceId);
  console.log('Recommended actions:');
  actions.forEach(action => console.log(`  - ${action}`));
  console.log('');
}

// ============================================================================
// Example 4: Request-Based Scaling
// ============================================================================

async function requestBasedScaling() {
  console.log('=== Request-Based Scaling ===\n');

  const { RequestScalingPolicy } = await import('@claudeflare/autoscaling');

  const requestPolicy = new RequestScalingPolicy({
    scaleUpRequestRate: 1000,   // Scale up at 1000 req/s
    scaleDownRequestRate: 200,  // Scale down at 200 req/s
    queueLengthThreshold: 100,
    latencyThreshold: 500,      // Scale up if P95 latency > 500ms
    minInstances: 2,
    maxInstances: 100
  });

  // Record request metrics
  const resourceId = 'api-worker';
  requestPolicy.recordRequestMetrics(resourceId, 1500, 250, 600);

  // Get scaling recommendation
  const recommendation = requestPolicy.getScalingRecommendation(resourceId);

  console.log(`Action: ${recommendation.action}`);
  console.log(`Reason: ${recommendation.reason}`);
  console.log(`Target instances: ${recommendation.targetInstances}`);
  console.log(`Urgency: ${recommendation.urgency}\n`);

  // Detect traffic spikes
  const spike = requestPolicy.detectTrafficSpike(resourceId);
  if (spike.isSpike) {
    console.log(`Traffic spike detected!`);
    console.log(`  Magnitude: ${spike.magnitude.toFixed(1)}x`);
    console.log(`  Duration: ${spike.duration / 1000}s\n`);
  }
}

// ============================================================================
// Example 5: Predictive Scaling
// ============================================================================

async function predictiveScaling() {
  console.log('=== Predictive Scaling ===\n');

  const autoscaler = new Autoscaler();

  // Add historical time series data
  const historicalData: Array<{ timestamp: Date; value: number }> = [];
  const now = Date.now();

  // Generate 100 data points with daily seasonality
  for (let i = 0; i < 100; i++) {
    const hour = new Date(now - (100 - i) * 3600000).getHours();
    const baseValue = 50;
    const seasonalValue = hour >= 9 && hour <= 17 ? 30 : -10; // Business hours
    const noise = (Math.random() - 0.5) * 10;

    historicalData.push({
      timestamp: new Date(now - (100 - i) * 3600000),
      value: baseValue + seasonalValue + noise
    });
  }

  autoscaler.addTimeSeriesData('api-worker', historicalData);

  // Get forecast
  const forecast = await autoscaler.getForecast('api-worker', 'cpu', 12);

  console.log('12-hour forecast:');
  forecast.predictions.forEach((pred, i) => {
    console.log(`  Hour ${i + 1}: ${pred.value.toFixed(1)}% ` +
      `(range: ${pred.lowerBound.toFixed(1)} - ${pred.upperBound.toFixed(1)}, ` +
      `confidence: ${(pred.confidence * 100).toFixed(0)}%)`);
  });
  console.log('');
}

// ============================================================================
// Example 6: Cost Optimization
// ============================================================================

async function costOptimization() {
  console.log('=== Cost Optimization ===\n');

  const autoscaler = new Autoscaler();

  // Create budget
  const budget = autoscaler.createBudget(
    'monthly-production',
    'Monthly Production Budget',
    1000,
    [70, 90] // Alert at 70% and 90%
  );

  console.log(`Budget created: ${budget.name}`);
  console.log(`  Limit: $${budget.limit}`);
  console.log(`  Alert thresholds: ${budget.alertThresholds.join('%, ')}%\n`);

  // Simulate cost analysis
  const { ResourceAllocator } = await import('@claudeflare/autoscaling');
  const allocator = new ResourceAllocator();

  // Allocate a resource
  await allocator.allocate({
    resourceId: 'api-worker-1',
    resourceType: 'worker',
    strategy: {
      type: 'first_fit',
      parameters: {},
      constraints: []
    },
    constraints: [],
    priority: 1,
    requestedSpec: {
      cpu: { cores: 4, frequency: 3000, credits: 400, burstCapacity: 40 },
      memory: { size: 2048, type: 'dram' },
      storage: { size: 10000, type: 'ssd', iops: 1000, throughput: 100 },
      network: { bandwidth: 1000, connections: 10000, requestsPerSecond: 10000 }
    }
  });

  // Get cost analysis
  const costAnalysis = await autoscaler.getCostAnalysis('api-worker-1');

  if (costAnalysis) {
    console.log('Cost Analysis:');
    console.log(`  Current monthly cost: $${costAnalysis.currentCost.total.toFixed(2)}`);
    console.log(`  Projected monthly cost: $${costAnalysis.projectedCost.total.toFixed(2)}`);
    console.log(`  Potential savings: $${costAnalysis.savings.toFixed(2)}\n`);

    console.log('Optimization opportunities:');
    costAnalysis.optimization.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.description}`);
      console.log(`     Type: ${opt.type}`);
      console.log(`     Savings: $${opt.savings.toFixed(2)}/month`);
      console.log(`     Effort: ${opt.effort}`);
      console.log(`     Risk: ${opt.risk}\n`);
    });
  }
}

// ============================================================================
// Example 7: Scaling Analytics
// ============================================================================

async function scalingAnalytics() {
  console.log('=== Scaling Analytics ===\n');

  const autoscaler = new Autoscaler();

  // Get analytics for the last 30 days
  const analytics = autoscaler.getAnalytics('api-worker', {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  });

  console.log('Scaling Summary:');
  console.log(`  Total events: ${analytics.summary.totalEvents}`);
  console.log(`  Successful: ${analytics.summary.successfulEvents}`);
  console.log(`  Failed: ${analytics.summary.failedEvents}`);
  console.log(`  Success rate: ${(analytics.summary.uptime).toFixed(1)}%`);
  console.log(`  Avg scaling time: ${(analytics.summary.averageScaleTime / 1000).toFixed(1)}s\n`);

  console.log('Detected Patterns:');
  analytics.patterns.forEach(pattern => {
    console.log(`  - ${pattern.type}: ${pattern.description}`);
    console.log(`    Confidence: ${(pattern.confidence * 100).toFixed(0)}%`);
    console.log(`    Occurrences: ${pattern.occurrences}\n`);
  });

  console.log('Insights:');
  analytics.insights.forEach(insight => {
    console.log(`  [${insight.severity.toUpperCase()}] ${insight.title}`);
    console.log(`  ${insight.description}\n`);
  });

  console.log('Recommendations:');
  analytics.recommendations.forEach(rec => {
    console.log(`  [${rec.priority.toUpperCase()}] ${rec.title}`);
    console.log(`  ${rec.description}`);
    console.log(`  Expected benefit:`);
    console.log(`    Performance: +${(rec.expectedBenefit.performance * 100).toFixed(0)}%`);
    console.log(`    Cost: ${(rec.expectedBenefit.cost * 100).toFixed(0)}%`);
    console.log(`    Reliability: +${(rec.expectedBenefit.reliability * 100).toFixed(0)}%\n`);
  });
}

// ============================================================================
// Example 8: Advanced Configuration
// ============================================================================

async function advancedConfiguration() {
  console.log('=== Advanced Configuration ===\n');

  const autoscaler = new Autoscaler({
    config: {
      enabled: true,
      evaluationInterval: 30000,      // Check every 30 seconds
      cooldownPeriod: 120000,          // 2-minute cooldown
      maxScaleUpPercent: 300,          // Can scale up 3x
      maxScaleDownPercent: 50,         // Can scale down 50%
      targetUtilization: 65,

      predictiveScaling: {
        enabled: true,
        modelType: 'arima',
        predictionHorizon: 120,        // 2 hours ahead
        confidenceThreshold: 0.8,      // Only act on 80%+ confidence
        retrainInterval: 1800000       // Retrain every 30 minutes
      },

      costOptimization: {
        enabled: true,
        budgetLimit: 5000,
        rightSizingEnabled: true,
        reservedCapacityEnabled: true,
        optimizationInterval: 3600000  // Check every hour
      },

      metrics: {
        retentionDays: 90,
        aggregationLevel: 'average',
        collectionInterval: 15000,     // Collect every 15 seconds
        enabledMetrics: ['cpu', 'memory', 'requests', 'latency', 'cost', 'errors']
      }
    }
  });

  const status = autoscaler.getStatus();

  console.log('Autoscaler Status:');
  console.log(`  Running: ${status.running}`);
  console.log(`  Policies: ${status.policiesCount}`);
  console.log(`  Enabled policies: ${status.enabledPoliciesCount}\n`);

  console.log('Configuration:');
  console.log(`  Evaluation interval: ${status.config.evaluationInterval}ms`);
  console.log(`  Target utilization: ${status.config.targetUtilization}%`);
  console.log(`  Predictive scaling: ${status.config.predictiveScaling.enabled}`);
  console.log(`  Cost optimization: ${status.config.costOptimization.enabled}\n`);
}

// ============================================================================
// Run All Examples
// ============================================================================

async function main() {
  try {
    await basicSetup();
    await cpuBasedScaling();
    await memoryScaling();
    await requestBasedScaling();
    await predictiveScaling();
    await costOptimization();
    await scalingAnalytics();
    await advancedConfiguration();

    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  basicSetup,
  cpuBasedScaling,
  memoryScaling,
  requestBasedScaling,
  predictiveScaling,
  costOptimization,
  scalingAnalytics,
  advancedConfiguration
};
