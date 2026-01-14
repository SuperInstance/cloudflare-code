/**
 * @claudeflare/user-analytics
 *
 * Advanced User Analytics Platform for ClaudeFlare
 *
 * Features:
 * - Event tracking with validation and enrichment
 * - Dynamic user segmentation
 * - Funnel analysis with drop-off detection
 * - Cohort analysis and comparison
 * - Retention analysis with churn prediction
 * - Behavioral analytics and pattern discovery
 * - Real-time analytics with alerting
 * - GDPR/CCPA compliance
 * - D1 database integration
 *
 * @example
 * ```typescript
 * import { EventTracker, SegmentManager, FunnelAnalyzer } from '@claudeflare/user-analytics';
 *
 * // Initialize tracker
 * const tracker = new EventTracker(config);
 *
 * // Track events
 * await tracker.track({
 *   id: 'evt_123',
 *   eventType: 'page_view',
 *   eventName: 'homepage',
 *   // ...
 * });
 * ```
 */

// Core Types
export * from './types/index.js';

// Event Tracking
export {
  EventTracker,
  EventValidator,
  EventEnricher,
  EventBatcher,
  EventRouter,
  generateEventId,
  generateSessionId,
  generateAnonymousId,
} from './events/index.js';

// Segmentation
export {
  SegmentBuilder,
  SegmentEvaluator,
  SegmentManager,
  BehavioralSegmenter,
  DynamicSegmenter,
} from './segmentation/index.js';

// Funnel Analysis
export {
  FunnelBuilder,
  FunnelAnalyzer,
  FunnelOptimizer,
} from './funnel/index.js';

// Retention Analysis
export {
  CohortCreator,
  RetentionCalculator,
  RetentionAnalyzer,
  ChurnPredictor,
  SurvivalAnalyzer,
} from './retention/index.js';

// Behavioral Analytics
export {
  JourneyAnalyzer,
  SessionAnalyzer,
  PatternDiscovery,
  FeatureUsageAnalyzer,
} from './behavior/index.js';

// Cohort Analysis
export {
  CohortManager,
  CohortBuilder,
  CohortAnalyzer,
} from './cohort/index.js';

// Real-time Analytics
export {
  RealtimeProcessor,
  RealtimeMetricsCalculator,
  RealtimeAlertManager,
  RealtimeAnalytics,
} from './realtime/index.js';

// Privacy & Compliance
export {
  ConsentManager,
  DataClassifier,
  PrivacyRequestProcessor,
  DataAnonymizer,
  DataRetentionManager,
} from './privacy/index.js';

// Storage (D1)
export {
  D1Client,
  EventStorage,
  UserStorage,
  SegmentStorage,
  AnalyticsStorage,
} from './storage/d1.js';

// Utilities
export * from './utils/index.js';

// Re-export commonly used types for convenience
export type {
  AnalyticsEvent,
  User,
  Session,
  Segment,
  Funnel,
  FunnelResult,
  RetentionAnalysis,
  ChurnPrediction,
  UserJourney,
  BehaviorPattern,
  Cohort,
  RealtimeMetrics,
  PrivacyRequest,
  ConsentRecord,
  AnalyticsConfig,
  DateRange,
  QueryOptions,
  ExportOptions,
} from './types/index.js';

// Version
export const VERSION = '0.1.0';

/**
 * Create a new analytics instance with default configuration
 */
export function createAnalytics(config: Partial<AnalyticsConfig> = {}) {
  const defaultConfig: AnalyticsConfig = {
    storage: {
      bindingName: 'DB',
      batchSize: 100,
      maxRetries: 3,
      timeout: 10000,
    },
    events: {
      batchSize: 100,
      flushInterval: 5000,
      maxRetries: 3,
      validation: true,
      enrichment: true,
      sampling: 1,
    },
    privacy: {
      gdprEnabled: true,
      ccpaEnabled: true,
      dataRetention: 365 * 24 * 60 * 60 * 1000, // 1 year
      anonymizeIp: true,
      hashEmails: false,
      consentRequired: false,
      dataResidency: [],
    },
    realtime: {
      enabled: true,
      windowSize: 60000, // 1 minute
      aggregationInterval: 5000, // 5 seconds
      alertThresholds: [],
    },
    aggregation: {
      enabled: true,
      preAggregation: true,
      materializedViews: false,
      refreshInterval: 3600000, // 1 hour
      maxQueryTime: 10000, // 10 seconds
    },
    performance: {
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      queryTimeout: 10000,
      maxConcurrentQueries: 10,
      indexOptimization: true,
    },
  };

  return {
    config: { ...defaultConfig, ...config },
    version: VERSION,
  };
}
