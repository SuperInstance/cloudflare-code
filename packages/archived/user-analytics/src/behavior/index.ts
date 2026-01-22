/**
 * Behavioral Analytics Module
 * Exports all behavioral analytics functionality
 */

export {
  JourneyAnalyzer,
  SessionAnalyzer,
  PatternDiscovery,
  FeatureUsageAnalyzer,
} from './analytics.js';

export type {
  UserJourney,
  JourneyStep,
  ConversionInfo,
  JourneyMetadata,
  BehaviorPattern,
  PatternType,
  PatternDefinition,
  PatternStep,
  SessionAnalysis,
  PageMetric,
  EventMetric,
  PageFlow,
  FlowNode,
  FlowEdge,
  EngagementMetrics,
  EngagementFactor,
  FeatureUsage,
  FeatureTrend,
  FeatureUser,
  FeatureCohortUsage,
} from '../types/index.js';
