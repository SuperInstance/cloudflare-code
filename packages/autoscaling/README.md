# @claudeflare/autoscaling

Intelligent auto-scaling and resource management for ClaudeFlare on Cloudflare Workers.

## Features

### Auto-scaling Policies
- **CPU-Based Scaling**: Scale based on CPU utilization and burst capacity
- **Memory-Based Scaling**: Scale based on memory usage with leak detection
- **Request-Based Scaling**: Scale based on request rate, queue length, and latency
- **Custom Triggers**: Support for custom metric-based triggers

### Predictive Scaling
- **Time Series Forecasting**: ARIMA, Prophet, LSTM-style predictions
- **Seasonal Pattern Detection**: Daily, weekly, monthly patterns
- **Anomaly Detection**: Statistical outlier detection
- **Confidence Intervals**: Uncertainty quantification

### Resource Allocation
- **Multiple Strategies**: Bin packing, worst-fit, best-fit, spread
- **Capacity Planning**: KV, R2, D1, Durable Objects capacity management
- **Smart Rebalancing**: Automatic resource rebalancing
- **Constraint Management**: Min/max resource constraints

### Cost Optimization
- **Right-Sizing Recommendations**: Identify over-provisioned resources
- **Budget Management**: Set budgets and alerts
- **Cost Forecasting**: Predict future costs
- **Savings Analysis**: Calculate potential savings

### Scaling Analytics
- **Event Tracking**: Record all scaling events
- **Pattern Detection**: Identify recurring patterns
- **Insights Generation**: Automated insights
- **Recommendations**: Actionable optimization recommendations

## Installation

```bash
npm install @claudeflare/autoscaling
```

## Quick Start

```typescript
import { Autoscaler } from '@claudeflare/autoscaling';

// Initialize autoscaler
const autoscaler = new Autoscaler({
  config: {
    enabled: true,
    evaluationInterval: 60000, // 1 minute
    targetUtilization: 70
  }
});

// Add scaling policy for a worker
autoscaler.addScalingPolicy('my-worker', 'worker');

// Start autoscaling
await autoscaler.start();

// Get scaling recommendations
const recommendations = autoscaler.getRecommendations('my-worker');
console.log('Recommendations:', recommendations);
```

## Usage Examples

### CPU-Based Scaling

```typescript
import { CpuScalingPolicy } from '@claudeflare/autoscaling';

const cpuPolicy = new CpuScalingPolicy({
  scaleUpThreshold: 70,    // Scale up at 70% CPU
  scaleDownThreshold: 30,  // Scale down at 30% CPU
  minInstances: 1,
  maxInstances: 100
});

const policy = cpuPolicy.createPolicy('my-worker');
const targetInstances = cpuPolicy.calculateTargetInstances(
  currentInstances,
  cpuUtilization,
  cpuCredits
);
```

### Memory-Based Scaling with Leak Detection

```typescript
import { MemoryScalingPolicy } from '@claudeflare/autoscaling';

const memoryPolicy = new MemoryScalingPolicy({
  scaleUpThreshold: 80,
  scaleDownThreshold: 40,
  leakDetectionEnabled: true,
  oomPreventionEnabled: true
});

// Record memory usage
memoryPolicy.recordMemoryUsage('my-worker', memoryUsage);

// Detect memory leaks
const leakStatus = memoryPolicy.detectMemoryLeak('my-worker');
if (leakStatus.isLeaking) {
  console.log(`Memory leak detected: ${leakStatus.growthRate} MB/min`);
}
```

### Predictive Scaling

```typescript
// Add historical data
autoscaler.addTimeSeriesData('my-worker', [
  { timestamp: new Date('2024-01-01T00:00:00Z'), value: 100 },
  { timestamp: new Date('2024-01-01T01:00:00Z'), value: 120 },
  // ... more data
]);

// Get forecast
const forecast = await autoscaler.getForecast('my-worker', 'cpu.usage', 12);
console.log('Predictions:', forecast.predictions);
```

### Cost Optimization

```typescript
// Create budget
autoscaler.createBudget('monthly', 'Monthly Budget', 1000, [70, 90]);

// Get cost analysis
const costAnalysis = await autoscaler.getCostAnalysis('my-worker');
console.log('Current cost:', costAnalysis.currentCost);
console.log('Potential savings:', costAnalysis.savings);
console.log('Optimizations:', costAnalysis.optimization);
```

### Scaling Analytics

```typescript
// Get analytics for the last 30 days
const analytics = autoscaler.getAnalytics('my-worker', {
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  end: new Date()
});

console.log('Total events:', analytics.summary.totalEvents);
console.log('Success rate:', analytics.summary.uptime);
console.log('Patterns:', analytics.patterns);
console.log('Insights:', analytics.insights);
console.log('Recommendations:', analytics.recommendations);
```

## Architecture

### Components

1. **ScalingPolicyManager**: Manages and evaluates scaling policies
2. **CpuScalingPolicy**: CPU-based scaling with burst capacity tracking
3. **MemoryScalingPolicy**: Memory-based scaling with leak detection
4. **RequestScalingPolicy**: Request-based scaling using queueing theory
5. **PredictiveScalingEngine**: ML-based predictive scaling
6. **TimeSeriesForecaster**: Time series forecasting algorithms
7. **ResourceAllocator**: Resource allocation and capacity planning
8. **CostOptimizer**: Cost analysis and optimization
9. **ScalingMetricsCollector**: Metrics collection and aggregation
10. **ScalingAnalyticsEngine**: Analytics and insights

### Scaling Triggers

#### CPU-Based
- CPU utilization thresholds (e.g., scale up at 70%)
- CPU credit monitoring (burst capacity)
- Throttle detection

#### Memory-Based
- Memory usage thresholds
- Memory leak detection (growth rate analysis)
- OOM prevention

#### Request-Based
- Request rate scaling
- Queue length scaling
- Latency-based scaling (P50, P90, P95, P99)
- Error rate scaling

#### Predictive
- Time series forecasting
- Seasonal pattern scaling
- Event-based prediction
- ML model predictions

### Scaling Actions

- **SCALE_UP**: Increase instance count
- **SCALE_DOWN**: Decrease instance count
- **ADJUST_CPU**: Adjust CPU allocation
- **ADJUST_MEMORY**: Adjust memory allocation
- **ADJUST_CAPACITY**: Adjust capacity limits
- **ENABLE_FEATURE**: Enable scaling features
- **DISABLE_FEATURE**: Disable scaling features

## Configuration

```typescript
interface AutoscalingConfig {
  enabled: boolean;
  pollingInterval: number;        // How often to check metrics (ms)
  evaluationInterval: number;      // How often to evaluate policies (ms)
  cooldownPeriod: number;          // Cooldown after scaling (ms)
  maxScaleUpPercent: number;       // Max scale up percentage
  maxScaleDownPercent: number;     // Max scale down percentage
  targetUtilization: number;       // Target utilization (0-100)
  scaleUpThreshold: number;        // Scale up threshold
  scaleDownThreshold: number;      // Scale down threshold

  predictiveScaling: {
    enabled: boolean;
    modelType: 'linear_regression' | 'arima' | 'prophet' | 'lstm';
    predictionHorizon: number;     // Minutes to predict ahead
    confidenceThreshold: number;   // Min confidence to act on prediction
    retrainInterval: number;       // How often to retrain models (ms)
  };

  costOptimization: {
    enabled: boolean;
    budgetLimit: number;
    budgetPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly';
    rightSizingEnabled: boolean;
    optimizationInterval: number;
  };

  metrics: {
    retentionDays: number;
    aggregationLevel: 'average' | 'sum' | 'max' | 'min';
    collectionInterval: number;
    enabledMetrics: string[];
  };
}
```

## API Reference

### Autoscaler

Main orchestrator class.

#### Methods

- `start()`: Start autoscaling
- `stop()`: Stop autoscaling
- `addScalingPolicy(resourceId, resourceType)`: Add scaling policy
- `evaluateScaling(resourceId)`: Evaluate scaling for a resource
- `getForecast(resourceId, metric, horizon)`: Get predictive forecast
- `getAnalytics(resourceId, period)`: Get scaling analytics
- `getCostAnalysis(resourceId)`: Get cost analysis
- `getRecommendations(resourceId)`: Get scaling recommendations
- `createBudget(id, name, limit, alertThresholds)`: Create budget
- `updateConfig(updates)`: Update configuration
- `getStatus()`: Get autoscaler status

### ScalingPolicyManager

Manages scaling policies.

#### Methods

- `addPolicy(policy)`: Add policy
- `removePolicy(policyId)`: Remove policy
- `getPolicy(policyId)`: Get policy
- `evaluatePolicy(policyId, metrics, state)`: Evaluate policy
- `executePolicy(policyId, action, state)`: Execute policy

### PredictiveScalingEngine

Predictive scaling using ML.

#### Methods

- `addTimeSeriesData(resourceId, data)`: Add time series data
- `predict(resourceId, metric, horizon)`: Generate predictions
- `detectAnomalies(resourceId, threshold)`: Detect anomalies
- `trainModel(resourceId)`: Train prediction model

### ResourceAllocator

Resource allocation and capacity planning.

#### Methods

- `allocate(request)`: Allocate resources
- `deallocate(resourceId)`: Deallocate resources
- `updateAllocation(resourceId, spec)`: Update allocation
- `getAllocation(resourceId)`: Get allocation
- `rebalance()`: Rebalance allocations
- `getUtilization(resourceType)`: Get utilization

### CostOptimizer

Cost optimization and budget management.

#### Methods

- `analyzeCosts(resourceId, allocation)`: Analyze costs
- `createBudget(id, name, limit, period, thresholds)`: Create budget
- `updateBudgetSpend(budgetId, spend)`: Update budget spend
- `forecastCosts(resourceId, periods)`: Forecast costs
- `optimizeAllCosts(allocations)`: Optimize all costs

### ScalingMetricsCollector

Metrics collection and aggregation.

#### Methods

- `collectMetrics(resourceId)`: Collect metrics
- `getMetricsHistory(resourceId, limit)`: Get metrics history
- `getAggregatedMetrics(resourceId, window, aggregation)`: Get aggregated metrics
- `setThresholds(resourceId, thresholds)`: Set alert thresholds
- `getPercentile(resourceId, metric, percentile, window)`: Get percentile

### ScalingAnalyticsEngine

Scaling analytics and insights.

#### Methods

- `recordEvent(event)`: Record scaling event
- `getAnalytics(resourceId, period)`: Get analytics
- `getRecommendations(resourceId)`: Get recommendations
- `getInsights(resourceId)`: Get insights

## Best Practices

1. **Set Appropriate Thresholds**: Configure thresholds based on your workload characteristics
2. **Use Cooldown Periods**: Prevent oscillation with proper cooldowns
3. **Monitor Costs**: Set budgets and alerts to control spending
4. **Leverage Predictive Scaling**: Enable predictive scaling for predictable workloads
5. **Review Recommendations**: Regularly review and act on optimization recommendations
6. **Test Policies**: Test scaling policies in non-production environments first
7. **Track Events**: Monitor scaling events to identify patterns and issues

## License

MIT
