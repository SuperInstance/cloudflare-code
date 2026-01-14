/**
 * @claudeflare/nas
 * Neural Architecture Search system for AI optimization
 */

// ============================================================================
// Types
// ============================================================================

export * from './types';

// ============================================================================
// DSL
// ============================================================================

export {
  ArchitectureDSL,
  LayerBuilder,
  ConnectionBuilder,
  ArchitectureGenerator,
  DSLParser,
  exampleDSL,
} from './dsl/architecture-dsl';

// ============================================================================
// Search Strategies
// ============================================================================

export {
  EvolutionarySearch,
  createEvolutionaryConfig,
} from './strategies/evolutionary';

export {
  ReinforcementLearningSearch,
  createRLConfig,
} from './strategies/reinforcement-learning';

export {
  BayesianOptimizationSearch,
  createBayesianConfig,
  GaussianProcessModel,
  AcquisitionFunctionOptimizer,
} from './strategies/bayesian-optimization';

// ============================================================================
// Evaluation
// ============================================================================

export {
  ArchitectureEvaluator,
  HardwareProfiler,
  DatasetManager,
  FidelityEvaluator,
  ValidationStrategy,
  BenchmarkRunner,
  createEvaluationConfig,
} from './evaluation/evaluator';

// ============================================================================
// Compression
// ============================================================================

export {
  Pruner,
  MagnitudePruner,
  GradientPruner,
  StructuredPruner,
  TaylorPruner,
  PrunerFactory,
  PruningScheduler,
  PruningMetrics,
  createPruningConfig,
} from './compression/pruning';

export {
  Quantizer,
  PostTrainingQuantizer,
  QuantizationAwareTrainingQuantizer,
  DynamicQuantizer,
  MixedPrecisionQuantizer,
  QuantizerFactory,
  createQuantizationConfig,
} from './compression/quantization';

// ============================================================================
// Ranking
// ============================================================================

export {
  ArchitectureRanker,
  rankByWeightedSum,
  findParetoFront,
  calculateHypervolume,
  createRankingConfig,
} from './ranking/ranker';

// ============================================================================
// Main Search Engine
// ============================================================================

export {
  NASSearchEngine,
  ArchitectureRanker as NASRanker,
  createNASConfig,
  quickStartNAS,
  runNAS,
  createSearchSpace,
  exportResult,
} from './search/nas-search';

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick start NAS with default evolutionary configuration
 *
 * @param searchSpace - Optional custom search space
 * @param iterations - Number of search iterations (default: 50)
 * @returns Search result with best architecture and Pareto front
 *
 * @example
 * ```typescript
 * const result = await quickStartNAS();
 * console.log('Best architecture:', result.bestArchitecture);
 * ```
 */
export async function quickStartNAS(
  searchSpace?: any,
  iterations: number = 50
) {
  const { quickStartNAS: _quickStartNAS } = await import('./search/nas-search');
  return _quickStartNAS(searchSpace, iterations);
}

/**
 * Run NAS with custom configuration
 *
 * @param config - NAS configuration
 * @returns Search result with best architecture and Pareto front
 *
 * @example
 * ```typescript
 * const config = createNASConfig({
 *   strategy: createEvolutionaryConfig({ maxIterations: 100 }),
 * });
 * const result = await runNAS(config);
 * ```
 */
export async function runNAS(config: any) {
  const { runNAS: _runNAS } = await import('./search/nas-search');
  return _runNAS(config);
}

/**
 * Create search space using DSL builder
 *
 * @param name - Search space name
 * @param builder - DSL builder function
 * @returns Configured search space
 *
 * @example
 * ```typescript
 * const space = createSearchSpace('cnn', (dsl) =>
 *   dsl.setType('cell-based')
 *     .allOperations()
 *     .filters([32, 64, 128])
 * );
 * ```
 */
export function createSearchSpace(name: string, builder: (dsl: any) => any) {
  const { createSearchSpace: _createSearchSpace } = require('./search/nas-search');
  return _createSearchSpace(name, builder);
}

/**
 * Export search result to specified format
 *
 * @param result - Search result
 * @param format - Export format ('json' or 'yaml')
 * @returns Formatted result string
 */
export function exportResult(result: any, format: 'json' | 'yaml' = 'json') {
  const { exportResult: _exportResult } = require('./search/nas-search');
  return _exportResult(result, format);
}

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
