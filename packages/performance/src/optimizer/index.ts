/**
 * Performance Optimizer Module
 *
 * Analyzes performance and provides optimization recommendations
 */

export { PerformanceAnalyzer } from './analyzer.js';
export { PatternAnalyzer } from './patterns.js';

export type {
  OptimizationRecommendation,
  OptimizationCategory,
} from '../types/index.js';

export type {
  CodePattern,
} from './patterns.js';
