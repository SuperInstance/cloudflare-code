/**
 * Benchmark Module
 *
 * Provides comprehensive benchmarking capabilities
 */

export { BenchmarkRunner } from './runner.js';
export { BenchmarkSuites } from './suites.js';

export type {
  BenchmarkResult,
  BenchmarkSuite,
  Benchmark,
  BenchmarkOptions,
} from '../types/index.js';

export type {
  BenchmarkComparison,
  ComparisonResult,
  ComparisonSummary,
} from './runner.js';
