/**
 * ClaudeFlare Analytics & Business Intelligence Platform
 * Comprehensive analytics platform for product analytics, user behavior, revenue, cohorts, and funnels
 */

// ============================================================================
// Core Types
// ============================================================================

export * from './types/index.js';

// ============================================================================
// Events Module
// ============================================================================

export {
  EventTracker,
  SchemaValidator,
  EventFilter,
  EventTransformer,
  EventCollector,
  UserProfileEnricher,
  GeoLocationEnricher,
  DeviceInfoEnricher,
  CustomEnricher,
  EventBuffer,
} from './events/index.js';

export type {
  EventTrackerConfig,
  EventValidationResult,
  ValidationError,
  ValidationWarning,
  EventTrackerStats,
  EventHandler,
  EventValidator,
  EventSchema,
  PropertyRule,
  EventFilterRule,
  TransformationRule,
  CollectorConfig,
  RouteConfig,
  EnricherConfig,
  CollectorMetrics,
} from './events/index.js';

// ============================================================================
// Aggregation Module
// ============================================================================

export {
  AggregationEngine,
  TimeSeriesAggregator,
  RealtimeAggregator,
  AggregationPipeline,
  StreamProcessor,
} from './aggregation/index.js';

export type {
  AggregationEngineConfig,
  AggregationTask,
  AggregationMetrics,
  CachedAggregation,
  TimeSeriesData,
  PipelineConfig,
  PipelineStage,
  PipelineResult,
  PipelineMetrics,
  PipelineError,
} from './aggregation/index.js';

// ============================================================================
// Statistics Module
// ============================================================================

export {
  StatisticalAnalyzer,
  HypothesisTester,
} from './statistics/index.js';

export type {
  StatisticsConfig,
} from './statistics/index.js';

// ============================================================================
// Visualization Module
// ============================================================================

export {
  VisualizationGenerator,
  DashboardBuilder,
} from './visualization/index.js';

export type {
  VisualizationGeneratorConfig,
  DashboardConfig,
  WidgetConfig,
  DashboardLayout,
  DashboardWidget,
} from './visualization/index.js';

// ============================================================================
// Reports Module
// ============================================================================

export {
  ReportBuilder,
} from './reports/index.js';

export type {
  ReportResult,
  ReportTemplate,
  ReportBuilderStats,
} from './reports/index.js';

// ============================================================================
// Export Module
// ============================================================================

export {
  DataExporter,
} from './export/index.js';

export type {
  ExporterConfig,
} from './export/index.js';

// ============================================================================
// Product Analytics Module
// ============================================================================

export { ProductAnalytics } from './product/analytics.js';

// ============================================================================
// Behavior Analytics Module
// ============================================================================

export { BehaviorAnalytics } from './behavior/analytics.js';

// ============================================================================
// Revenue Analytics Module
// ============================================================================

export { RevenueAnalytics } from './revenue/analytics.js';

// ============================================================================
// Cohort Analysis Module
// ============================================================================

export { CohortAnalyzer } from './cohort/analyzer.js';

// ============================================================================
// Funnel Analysis Module
// ============================================================================

export { FunnelAnalyzer } from './funnel/analyzer.js';

// ============================================================================
// Utilities
// ============================================================================

export * from './utils/helpers.js';

// ============================================================================
// Main Analytics Platform Class
// ============================================================================

import type { AnalyticsPlatformConfig } from './types/index.js';
import { EventCollector } from './events/index.js';
import { AggregationEngine, AggregationPipeline } from './aggregation/index.js';
import { StatisticalAnalyzer } from './statistics/index.js';
import { VisualizationGenerator, DashboardBuilder } from './visualization/index.js';
import { ReportBuilder } from './reports/index.js';
import { DataExporter } from './export/index.js';
import { ProductAnalytics } from './product/analytics.js';
import { BehaviorAnalytics } from './behavior/analytics.js';
import { RevenueAnalytics } from './revenue/analytics.js';
import { CohortAnalyzer } from './cohort/analyzer.js';
import { FunnelAnalyzer } from './funnel/analyzer.js';

/**
 * Main Analytics Platform class
 */
export class AnalyticsPlatform {
  private eventCollector: EventCollector;
  private aggregationEngine: AggregationEngine;
  private aggregationPipeline: AggregationPipeline;
  private statisticalAnalyzer: StatisticalAnalyzer;
  private visualizationGenerator: VisualizationGenerator;
  private dashboardBuilder: DashboardBuilder;
  private reportBuilder: ReportBuilder;
  private dataExporter: DataExporter;
  private productAnalytics: ProductAnalytics;
  private behaviorAnalytics: BehaviorAnalytics;
  private revenueAnalytics: RevenueAnalytics;
  private cohortAnalyzer: CohortAnalyzer;
  private funnelAnalyzer: FunnelAnalyzer;

  constructor(config: Partial<AnalyticsPlatformConfig> = {}) {
    // Initialize core components
    this.eventCollector = new EventCollector({
      enableValidation: true,
      enableSampling: false,
      ...config.processing,
    });

    this.aggregationEngine = new AggregationEngine({
      cacheEnabled: true,
      realtimeEnabled: true,
      ...config.aggregation,
    });

    this.aggregationPipeline = new AggregationPipeline({
      stages: [],
      parallelism: 4,
      bufferSize: 10000,
      errorHandling: 'continue',
    });

    this.statisticalAnalyzer = new StatisticalAnalyzer({
      confidenceLevel: 0.95,
      significanceLevel: 0.05,
      enableSeasonality: true,
    });

    this.visualizationGenerator = new VisualizationGenerator({
      maxDataPoints: 1000,
      enableAnimations: true,
      responsive: true,
    });

    this.dashboardBuilder = new DashboardBuilder(this.visualizationGenerator);
    this.reportBuilder = new ReportBuilder({
      enableScheduling: true,
      enableDistribution: true,
      maxReports: 100,
    });

    this.dataExporter = new DataExporter({
      maxExportSize: 10000000,
      enableCompression: true,
      enableEncryption: false,
    });

    // Initialize specialized analytics modules
    this.productAnalytics = new ProductAnalytics(this.aggregationEngine);
    this.behaviorAnalytics = new BehaviorAnalytics();
    this.revenueAnalytics = new RevenueAnalytics();
    this.cohortAnalyzer = new CohortAnalyzer();
    this.funnelAnalyzer = new FunnelAnalyzer();
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  get events() {
    return this.eventCollector;
  }

  // ==========================================================================
  // Aggregation
  // ==========================================================================

  get aggregation() {
    return this.aggregationEngine;
  }

  get pipeline() {
    return this.aggregationPipeline;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  get statistics() {
    return this.statisticalAnalyzer;
  }

  // ==========================================================================
  // Visualization
  // ==========================================================================

  get visualization() {
    return this.visualizationGenerator;
  }

  get dashboards() {
    return this.dashboardBuilder;
  }

  // ==========================================================================
  // Reports
  // ==========================================================================

  get reports() {
    return this.reportBuilder;
  }

  // ==========================================================================
  // Export
  // ==========================================================================

  get export() {
    return this.dataExporter;
  }

  // ==========================================================================
  // Product Analytics
  // ==========================================================================

  get product() {
    return this.productAnalytics;
  }

  // ==========================================================================
  // Behavior Analytics
  // ==========================================================================

  get behavior() {
    return this.behaviorAnalytics;
  }

  // ==========================================================================
  // Revenue Analytics
  // ==========================================================================

  get revenue() {
    return this.revenueAnalytics;
  }

  // ==========================================================================
  // Cohort Analysis
  // ==========================================================================

  get cohort() {
    return this.cohortAnalyzer;
  }

  // ==========================================================================
  // Funnel Analysis
  // ==========================================================================

  get funnel() {
    return this.funnelAnalyzer;
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Start the analytics platform
   */
  async start(): Promise<void> {
    console.log('Starting Analytics Platform...');
    // Initialize any background processes
  }

  /**
   * Stop the analytics platform
   */
  async stop(): Promise<void> {
    console.log('Stopping Analytics Platform...');
    await this.eventCollector.shutdown();
  }

  /**
   * Get platform health
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, boolean>;
  }> {
    return {
      status: 'healthy',
      components: {
        events: true,
        aggregation: true,
        statistics: true,
        visualization: true,
        reports: true,
        export: true,
        productAnalytics: true,
        behaviorAnalytics: true,
        revenueAnalytics: true,
        cohortAnalysis: true,
        funnelAnalysis: true,
      },
    };
  }

  /**
   * Get platform statistics
   */
  getStats(): {
    eventCollector: any;
    aggregation: any;
    reports: any;
  } {
    return {
      eventCollector: this.eventCollector.getMetrics(),
      aggregation: this.aggregationEngine.getMetrics(),
      reports: this.reportBuilder.getStats(),
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create analytics platform with default configuration
 */
export function createAnalyticsPlatform(config?: Partial<AnalyticsPlatformConfig>): AnalyticsPlatform {
  return new AnalyticsPlatform(config);
}

/**
 * Create analytics platform optimized for real-time processing
 */
export function createRealtimeAnalyticsPlatform(config?: Partial<AnalyticsPlatformConfig>): AnalyticsPlatform {
  return new AnalyticsPlatform({
    ...config,
    aggregation: {
      ...config?.aggregation,
      realtimeEnabled: true,
      cacheEnabled: true,
    },
    processing: {
      ...config?.processing,
      batchSize: 100,
      flushInterval: 10000,
    },
  });
}

/**
 * Create analytics platform optimized for batch processing
 */
export function createBatchAnalyticsPlatform(config?: Partial<AnalyticsPlatformConfig>): AnalyticsPlatform {
  return new AnalyticsPlatform({
    ...config,
    aggregation: {
      ...config?.aggregation,
      realtimeEnabled: false,
      cacheEnabled: true,
    },
    processing: {
      ...config?.processing,
      batchSize: 10000,
      flushInterval: 300000,
    },
  });
}

/**
 * Create analytics platform optimized for reporting
 */
export function createReportingAnalyticsPlatform(config?: Partial<AnalyticsPlatformConfig>): AnalyticsPlatform {
  return new AnalyticsPlatform({
    ...config,
    aggregation: {
      ...config?.aggregation,
      realtimeEnabled: false,
      cacheEnabled: true,
    },
    processing: {
      ...config?.processing,
      batchSize: 5000,
      flushInterval: 60000,
    },
  });
}
