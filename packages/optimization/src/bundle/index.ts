/**
 * Bundle Optimization Module
 *
 * Comprehensive bundle analysis and optimization toolkit
 */

export { BundleAnalyzer } from './analyzer.js';
export { CodeSplittingOptimizer } from './code-splitting.js';
export { TreeShakingOptimizer, TreeShakingAnalysis, DeadCodeReport } from './tree-shaking.js';

export type {
  BundleConfig,
  BundleAnalysisResult,
  BundleModule,
  BundleDependency,
  BundleChunk,
  BundleRecommendation,
  CodeSplittingOptions,
  CompressionOptions,
} from '../types/index.js';
