/**
 * Performance Regression Module
 *
 * Performance regression detection and alerting
 */

export { RegressionDetector } from './detector.js';

export type {
  RegressionConfig,
  RegressionResult,
  PerformanceBaseline,
  BaselineMetrics,
  RegressionIssue,
  Improvement,
  RegressionSummary,
  RegressionThresholds,
  AlertConfig,
} from '../types/index.js';
