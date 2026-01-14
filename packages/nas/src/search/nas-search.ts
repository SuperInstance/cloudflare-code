/**
 * Neural Architecture Search Orchestrator
 * Main entry point for NAS with all search strategies
 */

import {
  Architecture,
  NASConfig,
  SearchStrategyType,
  SearchResult,
  EvolutionaryConfig,
  RLConfig,
  BayesianConfig,
  SearchSpace,
  EvaluationConfig,
  CompressionConfig,
  RankingConfig,
  ArchitectureMetrics,
} from '../types';

import { EvolutionarySearch, createEvolutionaryConfig } from '../strategies/evolutionary';
import { ReinforcementLearningSearch, createRLConfig } from '../strategies/reinforcement-learning';
import {
  BayesianOptimizationSearch,
  createBayesianConfig,
} from '../strategies/bayesian-optimization';
import { ArchitectureDSL, ArchitectureGenerator } from '../dsl/architecture-dsl';
import { ArchitectureEvaluator, createEvaluationConfig } from '../evaluation/evaluator';
import {
  PrunerFactory,
  createPruningConfig,
  PruningMetrics,
} from '../compression/pruning';
import {
  QuantizerFactory,
  createQuantizationConfig,
} from '../compression/quantization';
import { ArchitectureRanker, createRankingConfig } from '../ranking/ranker';

// ============================================================================
// NAS Search Engine
// ============================================================================

export class NASSearchEngine {
  private config: NASConfig;
  private evaluator: ArchitectureEvaluator;
  private ranker: ArchitectureRanker;
  private searchSpace: SearchSpace;

  constructor(config: NASConfig) {
    this.config = config;
    this.searchSpace = config.searchSpace;
    this.evaluator = new ArchitectureEvaluator(config.evaluation);
    this.ranker = new ArchitectureRanker(config.ranking);
  }

  /**
   * Run architecture search
   */
  public async search(): Promise<SearchResult> {
    console.log(`Starting ${this.config.strategy.type} search...`);

    // Run selected search strategy
    const result = await this.runSearchStrategy();

    // Apply compression if configured
    if (this.config.compression) {
      console.log('Applying model compression...');
      result.bestArchitecture = await this.applyCompression(result.bestArchitecture);
    }

    // Rank architectures
    console.log('Ranking architectures...');
    const ranked = await this.ranker.rank(result.history);

    return {
      ...result,
      paretoFront: ranked.paretoFront,
      history: ranked.architectures,
    };
  }

  /**
   * Run selected search strategy
   */
  private async runSearchStrategy(): Promise<SearchResult> {
    switch (this.config.strategy.type) {
      case 'evolutionary':
        return await this.runEvolutionarySearch();

      case 'reinforcement-learning':
        return await this.runRLSearch();

      case 'bayesian-optimization':
        return await this.runBayesianSearch();

      case 'random-search':
        return await this.runRandomSearch();

      case 'grid-search':
        return await this.runGridSearch();

      default:
        throw new Error(`Unknown search strategy: ${this.config.strategy.type}`);
    }
  }

  /**
   * Run evolutionary search
   */
  private async runEvolutionarySearch(): Promise<SearchResult> {
    const evolutionarySearch = new EvolutionarySearch(
      this.config.strategy as EvolutionaryConfig
    );

    return await evolutionarySearch.search(async (arch: Architecture) => {
      return await this.evaluator.evaluate(arch);
    });
  }

  /**
   * Run reinforcement learning search
   */
  private async runRLSearch(): Promise<SearchResult> {
    const rlSearch = new ReinforcementLearningSearch(
      this.config.strategy as RLConfig
    );

    return await rlSearch.search(async (arch: Architecture) => {
      return await this.evaluator.evaluate(arch);
    });
  }

  /**
   * Run Bayesian optimization search
   */
  private async runBayesianSearch(): Promise<SearchResult> {
    const bayesianSearch = new BayesianOptimizationSearch(
      this.config.strategy as BayesianConfig
    );

    return await bayesianSearch.search(
      async (arch: Architecture) => {
        return await this.evaluator.evaluate(arch);
      },
      (arch: Architecture) => {
        // Encode architecture to vector
        return this.encodeArchitecture(arch);
      }
    );
  }

  /**
   * Run random search
   */
  private async runRandomSearch(): Promise<SearchResult> {
    const startTime = Date.now();
    const architectures: Architecture[] = [];
    const generator = new ArchitectureGenerator(this.searchSpace);

    const maxEvaluations = this.config.strategy.budget.limit;

    for (let i = 0; i < maxEvaluations; i++) {
      const arch = generator.generate();
      const evaluated = await this.evaluator.evaluate(arch);
      architectures.push(evaluated);

      if (i % 10 === 0) {
        console.log(`Evaluated ${i}/${maxEvaluations} architectures`);
      }
    }

    // Find best
    const best = this.findBestArchitecture(architectures);

    return {
      strategy: 'random-search',
      iterations: maxEvaluations,
      bestArchitecture: best,
      paretoFront: this.calculateParetoFront(architectures),
      history: architectures,
      statistics: {
        totalEvaluated: maxEvaluations,
        uniqueArchitectures: architectures.length,
        convergence: best.metrics.multiObjectiveScore || 0,
        diversity: this.calculateDiversity(architectures),
        improvementRate: 0,
      },
      duration: Date.now() - startTime,
    };
  }

  /**
   * Run grid search
   */
  private async runGridSearch(): Promise<SearchResult> {
    const startTime = Date.now();
    const architectures: Architecture[] = [];
    const generator = new ArchitectureGenerator(this.searchSpace);

    // Define grid points
    const gridPoints = this.generateGridPoints();
    const maxEvaluations = Math.min(gridPoints.length, this.config.strategy.budget.limit);

    for (let i = 0; i < maxEvaluations; i++) {
      const arch = generator.generate();
      const evaluated = await this.evaluator.evaluate(arch);
      architectures.push(evaluated);

      if (i % 10 === 0) {
        console.log(`Evaluated ${i}/${maxEvaluations} grid points`);
      }
    }

    const best = this.findBestArchitecture(architectures);

    return {
      strategy: 'grid-search',
      iterations: maxEvaluations,
      bestArchitecture: best,
      paretoFront: this.calculateParetoFront(architectures),
      history: architectures,
      statistics: {
        totalEvaluated: maxEvaluations,
        uniqueArchitectures: architectures.length,
        convergence: best.metrics.multiObjectiveScore || 0,
        diversity: this.calculateDiversity(architectures),
        improvementRate: 0,
      },
      duration: Date.now() - startTime,
    };
  }

  /**
   * Apply compression to architecture
   */
  private async applyCompression(architecture: Architecture): Promise<Architecture> {
    if (!this.config.compression) {
      return architecture;
    }

    const compression = this.config.compression;
    let compressed = architecture;

    // Apply pruning
    if (compression.method.includes('pruning')) {
      const pruningConfig = {
        ...createPruningConfig(),
        ...compression,
      };

      const pruner = PrunerFactory.create(
        pruningConfig.method,
        pruningConfig,
        compressed
      );

      const pruningResult = await pruner.prune();
      compressed = pruningResult.prunedArchitecture;

      console.log(`Applied pruning: ${pruningResult.sparsity.toFixed(2)} sparsity`);
    }

    // Apply quantization
    if (compression.method.includes('quantization')) {
      const quantizationConfig = {
        ...createQuantizationConfig(),
        ...compression,
      };

      const quantizer = QuantizerFactory.create(
        quantizationConfig.mode,
        quantizationConfig,
        compressed
      );

      const quantizationResult = await quantizer.quantize();
      compressed = quantizationResult.quantizedArchitecture;

      console.log(`Applied quantization: ${quantizationConfig.precision.weights}-bit`);
    }

    return compressed;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private encodeArchitecture(arch: Architecture): number[] {
    // Encode architecture to fixed-length vector
    const encoding: number[] = [];

    // Encode layer count
    encoding.push(arch.phenotype.layers.length / 50);

    // Encode layer types
    const typeEncoding = this.encodeLayerTypes(arch.phenotype.layers);
    encoding.push(...typeEncoding);

    // Pad to fixed length
    while (encoding.length < 100) {
      encoding.push(0);
    }

    return encoding.slice(0, 100);
  }

  private encodeLayerTypes(layers: any[]): number[] {
    const typeMap: Record<string, number> = {
      'conv2d': 0.1,
      'depthwise-conv2d': 0.2,
      'separable-conv2d': 0.3,
      'dense': 0.4,
      'attention': 0.5,
      'pooling': 0.6,
    };

    const encoding: number[] = [];
    for (const layer of layers.slice(0, 20)) {
      encoding.push(typeMap[layer.type] || 0);
    }

    return encoding;
  }

  private findBestArchitecture(architectures: Architecture[]): Architecture {
    return architectures.reduce((best, arch) => {
      const scoreBest = best.metrics.multiObjectiveScore || 0;
      const scoreArch = arch.metrics.multiObjectiveScore || 0;
      return scoreArch > scoreBest ? arch : best;
    }, architectures[0]);
  }

  private calculateParetoFront(architectures: Architecture[]): Architecture[] {
    // Non-dominated sorting
    const fronts = this.nonDominatedSort(architectures);
    return fronts[0] || [];
  }

  private nonDominatedSort(architectures: Architecture[]): Architecture[][] {
    const fronts: Architecture[][] = [];
    const remaining = [...architectures];

    while (remaining.length > 0) {
      const front: Architecture[] = [];

      for (const arch of remaining) {
        let dominated = false;

        for (const other of remaining) {
          if (arch !== other && this.dominates(other, arch)) {
            dominated = true;
            break;
          }
        }

        if (!dominated) {
          front.push(arch);
        }
      }

      fronts.push(front);

      for (const arch of front) {
        const idx = remaining.indexOf(arch);
        if (idx !== -1) {
          remaining.splice(idx, 1);
        }
      }
    }

    return fronts;
  }

  private dominates(arch1: Architecture, arch2: Architecture): boolean {
    // Multi-objective dominance
    const m1 = arch1.metrics;
    const m2 = arch2.metrics;

    const accBetter = (m1.accuracy || 0) > (m2.accuracy || 0);
    const flopsBetter = m1.flops < m2.flops;
    const latencyBetter = m1.latency < m2.latency;

    return (accBetter || flopsBetter || latencyBetter) &&
           (m1.accuracy || 0) >= (m2.accuracy || 0) &&
           m1.flops <= m2.flops &&
           m1.latency <= m2.latency;
  }

  private calculateDiversity(architectures: Architecture[]): number {
    let totalDistance = 0;
    let count = 0;

    const sample = architectures.slice(0, 50);

    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        totalDistance += Math.abs(
          sample[i].phenotype.layers.length - sample[j].phenotype.layers.length
        );
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 0;
  }

  private generateGridPoints(): any[] {
    // Generate grid search points
    const points = [];

    for (const layers of [5, 10, 15, 20]) {
      for (const filters of [32, 64, 128, 256]) {
        points.push({ layers, filters });
      }
    }

    return points;
  }
}

// ============================================================================
// Ranking System (Simplified)
// ============================================================================

export class ArchitectureRanker {
  private config: RankingConfig;

  constructor(config: RankingConfig) {
    this.config = config;
  }

  async rank(architectures: Architecture[]): Promise<any> {
    const ranked = [...architectures].sort((a, b) => {
      const scoreA = this.calculateScore(a);
      const scoreB = this.calculateScore(b);
      return scoreB - scoreA;
    });

    const paretoFront = this.calculateParetoFront(architectures);

    return {
      architectures: ranked.map((arch, i) => ({
        ...arch,
        rank: i + 1,
        score: this.calculateScore(arch),
      })),
      paretoFront,
    };
  }

  private calculateScore(arch: Architecture): number {
    let score = 0;

    for (const criterion of this.config.criteria) {
      const value = (arch.metrics as any)[criterion.name] || 0;

      if (criterion.direction === 'maximize') {
        score += criterion.weight * value;
      } else {
        score -= criterion.weight * value;
      }
    }

    return score;
  }

  private calculateParetoFront(architectures: Architecture[]): Architecture[] {
    const fronts = this.nonDominatedSort(architectures);
    return fronts[0] || [];
  }

  private nonDominatedSort(architectures: Architecture[]): Architecture[][] {
    const fronts: Architecture[][] = [];
    const remaining = [...architectures];

    while (remaining.length > 0) {
      const front: Architecture[] = [];

      for (const arch of remaining) {
        let dominated = false;

        for (const other of remaining) {
          if (arch !== other && this.dominates(other, arch)) {
            dominated = true;
            break;
          }
        }

        if (!dominated) {
          front.push(arch);
        }
      }

      fronts.push(front);

      for (const arch of front) {
        const idx = remaining.indexOf(arch);
        if (idx !== -1) {
          remaining.splice(idx, 1);
        }
      }
    }

    return fronts;
  }

  private dominates(arch1: Architecture, arch2: Architecture): boolean {
    const m1 = arch1.metrics;
    const m2 = arch2.metrics;

    return (m1.accuracy || 0) >= (m2.accuracy || 0) &&
           m1.flops <= m2.flops &&
           m1.latency <= m2.latency &&
           ((m1.accuracy || 0) > (m2.accuracy || 0) ||
            m1.flops < m2.flops ||
            m1.latency < m2.latency);
  }
}

function createRankingConfig(overrides: Partial<RankingConfig> = {}): RankingConfig {
  return {
    method: 'weighted-sum',
    criteria: [
      { name: 'accuracy', weight: 1.0, direction: 'maximize' },
      { name: 'flops', weight: 0.5, direction: 'minimize' },
      { name: 'latency', weight: 0.3, direction: 'minimize' },
      { name: 'memory', weight: 0.2, direction: 'minimize' },
    ],
    aggregation: 'weighted-sum',
    normalization: 'min-max',
    diversity: {
      enabled: true,
      method: 'distance',
      weight: 0.1,
      threshold: 5,
    },
    ...overrides,
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createNASConfig(overrides: Partial<NASConfig> = {}): NASConfig {
  return {
    searchSpace: {
      name: 'default',
      type: 'cell-based',
      layers: [],
      connections: {
        patterns: [],
        skipConnections: {
          enabled: true,
          types: ['residual'],
          maxDepth: 5,
          probability: 0.3,
        },
        normalization: 'batch',
      },
      constraints: {
        maxLayers: 20,
        minLayers: 3,
        maxParameters: 10000000,
        maxFLOPs: 1000000000,
        maxLatency: 100,
        maxMemory: 1000,
      },
      encoding: {
        type: 'one-hot',
        dimension: 128,
        vocabulary: new Map(),
      },
    },
    strategy: createEvolutionaryConfig(),
    evaluation: createEvaluationConfig(),
    hyperparameters: {
      hyperparameters: [],
      constraints: [],
      conditional: [],
    },
    ranking: createRankingConfig(),
    export: {
      format: 'json',
      includeMetrics: true,
      includeHistory: true,
      pretty: true,
    },
    ...overrides,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick start: Run evolutionary NAS with default config
 */
export async function quickStartNAS(
  searchSpace?: SearchSpace,
  iterations: number = 50
): Promise<SearchResult> {
  const config = createNASConfig({
    searchSpace: searchSpace || createNASConfig().searchSpace,
    strategy: createEvolutionaryConfig({
      maxIterations: iterations,
    }),
  });

  const engine = new NASSearchEngine(config);
  return await engine.search();
}

/**
 * Run NAS with custom config
 */
export async function runNAS(config: NASConfig): Promise<SearchResult> {
  const engine = new NASSearchEngine(config);
  return await engine.search();
}

/**
 * Create search space from DSL
 */
export function createSearchSpace(
  name: string,
  builder: (dsl: ArchitectureDSL) => ArchitectureDSL
): SearchSpace {
  const dsl = new ArchitectureDSL(name);
  return builder(dsl).build();
}

/**
 * Export search result
 */
export function exportResult(
  result: SearchResult,
  format: 'json' | 'yaml' = 'json'
): string {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  } else {
    // Simplified YAML export
    return `
strategy: ${result.strategy}
iterations: ${result.iterations}
best_score: ${result.bestArchitecture.metrics.multiObjectiveScore}
pareto_front_size: ${result.paretoFront.length}
total_evaluated: ${result.statistics.totalEvaluated}
`;
  }
}
