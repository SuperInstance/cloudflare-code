/**
 * Regression Detection Module
 *
 * Detects and reports performance regressions
 */

export { RegressionDetector } from './detector.js';
export { BaselineManager } from './baseline.js';

export type {
  RegressionResult,
  Regression,
  PerformanceBaseline,
} from '../types/index.js';

export type {
  RegressionThresholds,
  DetectionConfig,
} from './detector.js';

export type {
  BaselineConfig,
  BaselineComparison,
  MetricComparison,
  TrendData,
} from './baseline.js';
