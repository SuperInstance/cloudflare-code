/**
 * ClaudeFlare Autoscaling Package
 *
 * Intelligent auto-scaling and resource management for Cloudflare Workers
 */

// Main autoscaler
export { Autoscaler } from './autoscaler.js';

// Policies
export { ScalingPolicyManager } from './policies/scaling-policy.js';
export { CpuScalingPolicy } from './policies/cpu-policy.js';
export { MemoryScalingPolicy } from './policies/memory-policy.js';
export { RequestScalingPolicy } from './policies/request-policy.js';

// Prediction
export { PredictiveScalingEngine } from './prediction/predictive-scaling.js';
export { TimeSeriesForecaster, ForecastMethod } from './prediction/forecasting.js';

// Allocation
export { ResourceAllocator } from './allocation/resource-allocator.js';

// Cost
export { CostOptimizer } from './cost/cost-optimizer.js';

// Metrics
export { ScalingMetricsCollector } from './metrics/scaling-metrics.js';

// Analytics
export { ScalingAnalyticsEngine } from './analytics/scaling-analytics.js';

// Types
export * from './types/index.js';

// Utilities
export * from './utils/helpers.js';
