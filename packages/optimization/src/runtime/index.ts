/**
 * Runtime Optimization Module
 *
 * Runtime performance profiling and optimization toolkit
 */

export { RuntimeProfiler } from './profiler.js';
export { RuntimeOptimizer, OptimizedArray } from './optimizer.js';

export type {
  RuntimeOptimizationConfig,
  RuntimeProfile,
  OptimizationSuggestion,
  HotPathAnalysis,
} from '../types/index.js';
