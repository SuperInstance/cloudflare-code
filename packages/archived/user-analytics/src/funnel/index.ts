/**
 * Funnel Analysis Module
 * Exports all funnel analysis functionality
 */

export {
  FunnelBuilder,
  FunnelAnalyzer,
  FunnelOptimizer,
} from './analyzer.js';

export type {
  Funnel,
  FunnelStep,
  FunnelResult,
  FunnelStepResult,
  DropOffAnalysis,
  DropOffPath,
  DropOffReason,
  AbandonmentPoint,
  TimeMetrics,
  TimeBucket,
  FunnelComparison,
  ComparisonDifference,
  FunnelBreakdown,
  BreakdownSegment,
} from '../types/index.js';
