/**
 * ClaudeFlare Analytics Platform
 * Comprehensive performance analytics and ML Ops system
 */

// ============================================================================
// Monitoring
// ============================================================================

export {
  RealtimeMonitor,
  type AlertThreshold,
  type Anomaly,
  type MetricStatistics,
  type HealthStatus,
} from './monitoring/realtime-monitor.js';

export {
  MetricsCollector,
  WorkerMetricsSource,
  RequestMetricsSource,
  CustomMetricsSource,
  MetricsMiddleware,
  MetricsAggregator,
  type MetricSource,
} from './monitoring/metrics-collector.js';

// ============================================================================
// Experiments
// ============================================================================

export {
  ABTestingFramework,
  type ExperimentAssignment,
  type ExperimentMetric,
} from './experiments/ab-testing.js';

export {
  StatisticalAnalyzer,
  type SampleSizeConfig,
  type TestConfig,
  type TestResult,
} from './experiments/statistical-analyzer.js';

export {
  TrafficAllocator,
  GradualRollout,
  CanaryDeployment,
  StickyAllocation,
  type AllocationConfig,
} from './experiments/traffic-allocator.js';

export {
  ExperimentStorage,
  KVExperimentStorage,
  D1ExperimentStorage,
  type StorageConfig,
} from './experiments/experiment-storage.js';

// ============================================================================
// Features
// ============================================================================

export {
  FeatureFlagService,
  FeatureFlagMiddleware,
  type FlagEvaluationContext,
  type FlagEvaluationResult,
  type BulkEvaluationResult,
} from './features/feature-flags.js';

export {
  FeatureFlagStorage,
  KVFeatureFlagStorage,
  D1FeatureFlagStorage,
  MemoryFeatureFlagStorage,
  type FlagStats,
} from './features/feature-storage.js';

// ============================================================================
// ML Monitoring
// ============================================================================

export {
  ModelMonitoringService,
  type ModelConfig,
  type DriftThresholdConfig,
  type PredictionRecord,
  type LabeledPrediction,
  type ModelAlert,
} from './ml/model-monitoring.js';

export {
  ModelMonitoringStorage,
  D1ModelMonitoringStorage,
} from './ml/ml-storage.js';

// ============================================================================
// Insights
// ============================================================================

export {
  PerformanceInsightsService,
  AnomalyDetector,
  type InsightConfig,
} from './insights/performance-insights.js';

// ============================================================================
// Reports
// ============================================================================

export {
  AnalyticsReportsService,
  ReportTemplates,
  type ReportConfig,
} from './reports/analytics-reports.js';

// ============================================================================
// Types
// ============================================================================

export * from './types/index.js';

// ============================================================================
// Utilities
// ============================================================================

export { AnalyticsUtils } from './utils/analytics-utils.js';

// ============================================================================
// Main Analytics Platform Class
// ============================================================================

import { RealtimeMonitor } from './monitoring/realtime-monitor.js';
import { MetricsCollector } from './monitoring/metrics-collector.js';
import { ABTestingFramework } from './experiments/ab-testing.js';
import { ExperimentStorage } from './experiments/experiment-storage.js';
import { FeatureFlagService } from './features/feature-flags.js';
import { FeatureFlagStorage } from './features/feature-storage.js';
import { ModelMonitoringService } from './ml/model-monitoring.js';
import { ModelMonitoringStorage } from './ml/ml-storage.js';
import { PerformanceInsightsService } from './insights/performance-insights.js';
import { AnalyticsReportsService } from './reports/analytics-reports.js';

export interface AnalyticsPlatformConfig {
  monitoring?: {
    aggregationWindow?: number;
    maxDataPoints?: number;
    flushInterval?: number;
  };
  experiments?: {
    storage?: ExperimentStorage;
  };
  features?: {
    storage?: FeatureFlagStorage;
    cacheTTL?: number;
  };
  ml?: {
    storage?: ModelMonitoringStorage;
  };
  insights?: {
    enablePredictions?: boolean;
  };
  storage?: 'memory' | 'kv' | 'd1';
  kv?: KVNamespace;
  db?: D1Database;
}

export class AnalyticsPlatform {
  private monitor: RealtimeMonitor;
  private metricsCollector: MetricsCollector;
  private abTesting: ABTestingFramework;
  private featureFlags: FeatureFlagService;
  private mlMonitoring: ModelMonitoringService;
  private insights: PerformanceInsightsService;
  private reports: AnalyticsReportsService;

  constructor(config: AnalyticsPlatformConfig = {}) {
    // Initialize monitoring
    this.monitor = new RealtimeMonitor(
      config.monitoring?.aggregationWindow,
      config.monitoring?.maxDataPoints
    );

    this.metricsCollector = new MetricsCollector(
      1000,
      config.monitoring?.flushInterval || 60000
    );

    // Initialize experiment storage
    const experimentStorage = config.experiments?.storage || new ExperimentStorage();

    // Initialize A/B testing
    this.abTesting = new ABTestingFramework(experimentStorage);

    // Initialize feature flag storage
    const featureStorage = config.features?.storage || new FeatureFlagStorage();

    // Initialize feature flags
    this.featureFlags = new FeatureFlagService(
      featureStorage,
      config.features?.cacheTTL
    );

    // Initialize ML monitoring storage
    const mlStorage = config.ml?.storage || new ModelMonitoringStorage();

    // Initialize ML monitoring
    this.mlMonitoring = new ModelMonitoringService(mlStorage);

    // Initialize insights
    this.insights = new PerformanceInsightsService(
      this.monitor,
      config.insights
    );

    // Initialize reports
    this.reports = new AnalyticsReportsService(this.monitor);
  }

  // ==========================================================================
  // Monitoring
  // ==========================================================================

  get monitor(): RealtimeMonitor {
    return this._monitor;
  }

  get metrics(): MetricsCollector {
    return this._metricsCollector;
  }

  // ==========================================================================
  // Experiments
  // ==========================================================================

  get experiments(): ABTestingFramework {
    return this._abTesting;
  }

  // ==========================================================================
  // Features
  // ==========================================================================

  get features(): FeatureFlagService {
    return this._featureFlags;
  }

  // ==========================================================================
  // ML Monitoring
  // ==========================================================================

  get ml(): ModelMonitoringService {
    return this._mlMonitoring;
  }

  // ==========================================================================
  // Insights
  // ==========================================================================

  get insights(): PerformanceInsightsService {
    return this._insights;
  }

  // ==========================================================================
  // Reports
  // ==========================================================================

  get reports(): AnalyticsReportsService {
    return this._reports;
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Start the analytics platform
   */
  async start(): Promise<void> {
    await this.metricsCollector.start();
  }

  /**
   * Stop the analytics platform
   */
  async stop(): Promise<void> {
    await this.metricsCollector.stop();
  }

  /**
   * Get platform health
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, boolean>;
  }> {
    const health = await this.monitor.getHealthStatus();

    return {
      status: health.status,
      components: {
        monitoring: true,
        experiments: true,
        features: true,
        ml: true,
        insights: true,
        reports: true,
      },
    };
  }

  // ==========================================================================
  // Private Members
  // ==========================================================================

  private _monitor: RealtimeMonitor;
  private _metricsCollector: MetricsCollector;
  private _abTesting: ABTestingFramework;
  private _featureFlags: FeatureFlagService;
  private _mlMonitoring: ModelMonitoringService;
  private _insights: PerformanceInsightsService;
  private _reports: AnalyticsReportsService;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create analytics platform with KV storage
 */
export function createAnalyticsWithKV(kv: KVNamespace, config?: AnalyticsPlatformConfig): AnalyticsPlatform {
  return new AnalyticsPlatform({
    ...config,
    storage: 'kv',
    kv,
  });
}

/**
 * Create analytics platform with D1 storage
 */
export function createAnalyticsWithD1(db: D1Database, config?: AnalyticsPlatformConfig): AnalyticsPlatform {
  return new AnalyticsPlatform({
    ...config,
    storage: 'd1',
    db,
  });
}

/**
 * Create analytics platform with in-memory storage
 */
export function createInMemoryAnalytics(config?: AnalyticsPlatformConfig): AnalyticsPlatform {
  return new AnalyticsPlatform({
    ...config,
    storage: 'memory',
  });
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Create analytics middleware for Cloudflare Workers
 */
export function createAnalyticsMiddleware(platform: AnalyticsPlatform) {
  return {
    async fetch(request: Request, env: any): Promise<Response> {
      const startTime = Date.now();

      try {
        const response = await env.fetch(request);
        const duration = Date.now() - startTime;

        // Record metrics
        await platform.metrics.recordMetric({
          name: 'request_count',
          value: 1,
          timestamp: Date.now(),
          tags: {
            method: request.method,
            status: response.status.toString(),
          },
        });

        await platform.metrics.recordMetric({
          name: 'response_time',
          value: duration,
          timestamp: Date.now(),
          tags: {
            method: request.method,
          },
        });

        if (!response.ok) {
          await platform.metrics.recordMetric({
            name: 'error_total',
            value: 1,
            timestamp: Date.now(),
            tags: {
              status: response.status.toString(),
            },
          });
        }

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        await platform.metrics.recordMetric({
          name: 'error_total',
          value: 1,
          timestamp: Date.now(),
          tags: {
            type: 'exception',
          },
        });

        throw error;
      }
    },
  };
}
