// @ts-nocheck
/**
 * Architecture Ranking System
 * Multi-objective ranking and Pareto front calculation
 */

import {
  Architecture,
  RankingConfig,
  RankingMethod,
  RankingCriteria,
  AggregationMethod,
  NormalizationMethod,
  RankingResult,
  RankedArchitecture,
  ArchitectureMetrics,
} from '../types';

// ============================================================================
// Architecture Ranker
// ============================================================================

export class ArchitectureRanker {
  private config: RankingConfig;

  constructor(config: RankingConfig) {
    this.config = config;
  }

  /**
   * Rank architectures
   */
  public async rank(architectures: Architecture[]): Promise<RankingResult> {
    const startTime = Date.now();

    // Normalize metrics
    const normalized = this.normalizeMetrics(architectures);

    // Calculate scores
    const scored = this.calculateScores(normalized);

    // Apply ranking method
    let ranked: RankedArchitecture[];

    switch (this.config.method) {
      case 'weighted-sum':
        ranked = this.weightedSumRanking(scored);
        break;

      case 'pareto':
        ranked = this.paretoRanking(scored);
        break;

      case 'lexicographic':
        ranked = this.lexicographicRanking(scored);
        break;

      case 'topsis':
        ranked = this.topsisRanking(scored);
        break;

      case 'analytic-hierarchy':
        ranked = this.analyticHierarchyRanking(scored);
        break;

      case 'tournament':
        ranked = this.tournamentRanking(scored);
        break;

      case 'machine-learning':
        ranked = await this.machineLearningRanking(scored);
        break;

      default:
        ranked = this.weightedSumRanking(scored);
    }

    // Apply diversity if enabled
    if (this.config.diversity.enabled) {
      ranked = this.applyDiversity(ranked);
    }

    // Calculate Pareto front
    const paretoFront = this.calculateParetoFront(ranked);

    // Calculate diversity scores
    const diversityScores = this.calculateDiversityScores(ranked);

    const rankingTime = Date.now() - startTime;

    return {
      architectures: ranked,
      paretoFront,
      diversityScore: diversityScores,
      rankingTime,
    };
  }

  // ============================================================================
  // Normalization
  // ============================================================================

  private normalizeMetrics(architectures: Architecture[]): Architecture[] {
    if (this.config.normalization === 'none') {
      return architectures;
    }

    const normalized = architectures.map(arch => ({ ...arch }));

    // Get all metric names
    const metricNames = this.getAllMetricNames(architectures);

    // Normalize each metric
    for (const metricName of metricNames) {
      const values = architectures.map(arch => (arch.metrics as any)[metricName] || 0);

      const normalizedValues = this.normalizeValues(values, metricName);

      for (let i = 0; i < normalized.length; i++) {
        (normalized[i].metrics as any)[`${metricName}_normalized`] = normalizedValues[i];
      }
    }

    return normalized;
  }

  private normalizeValues(values: number[], metricName: string): number[] {
    switch (this.config.normalization) {
      case 'min-max':
        return this.minMaxNormalize(values);

      case 'z-score':
        return this.zScoreNormalize(values);

      case 'vector':
        return this.vectorNormalize(values);

      case 'ordinal':
        return this.ordinalNormalize(values);

      default:
        return values;
    }
  }

  private minMaxNormalize(values: number[]): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (max - min === 0) {
      return values.map(() => 0);
    }

    return values.map(v => (v - min) / (max - min));
  }

  private zScoreNormalize(values: number[]): number[] {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    if (std === 0) {
      return values.map(() => 0);
    }

    return values.map(v => (v - mean) / std);
  }

  private vectorNormalize(values: number[]): number[] {
    const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));

    if (magnitude === 0) {
      return values.map(() => 0);
    }

    return values.map(v => v / magnitude);
  }

  private ordinalNormalize(values: number[]): number[] {
    // Replace values with ranks
    const sorted = [...values].sort((a, b) => a - b);
    return values.map(v => sorted.indexOf(v));
  }

  private getAllMetricNames(architectures: Architecture[]): string[] {
    const names = new Set<string>();

    for (const arch of architectures) {
      for (const key of Object.keys(arch.metrics)) {
        names.add(key);
      }
    }

    return Array.from(names);
  }

  // ============================================================================
  // Score Calculation
  // ============================================================================

  private calculateScores(architectures: Architecture[]): RankedArchitecture[] {
    return architectures.map(arch => {
      const scores: Record<string, number> = {};
      const criteria = this.config.criteria;

      for (const criterion of criteria) {
        const value = this.getMetricValue(arch, criterion.name);
        const normalizedValue = this.getMetricValue(arch, `${criterion.name}_normalized`) || value;

        let score = normalizedValue;

        if (criterion.direction === 'minimize') {
          score = 1 - score;
        }

        scores[criterion.name] = score * criterion.weight;
      }

      // Aggregate scores
      const aggregateScore = this.aggregateScores(scores);

      return {
        ...arch,
        rank: 0,
        score: aggregateScore,
        scores,
        diversity: 0,
      };
    });
  }

  private getMetricValue(arch: Architecture, metricName: string): number {
    return (arch.metrics as any)[metricName] || 0;
  }

  private aggregateScores(scores: Record<string, number>): number {
    const values = Object.values(scores);

    switch (this.config.aggregation) {
      case 'weighted-sum':
        return values.reduce((sum, v) => sum + v, 0);

      case 'geometric-mean':
        const product = values.reduce((p, v) => p * v, 1);
        return Math.pow(product, 1 / values.length);

      case 'harmonic-mean':
        const reciprocalSum = values.reduce((sum, v) => sum + 1 / v, 0);
        return values.length / reciprocalSum;

      case 'product':
        return values.reduce((p, v) => p * v, 1);

      case 'min':
        return Math.min(...values);

      case 'max':
        return Math.max(...values);

      default:
        return values.reduce((sum, v) => sum + v, 0);
    }
  }

  // ============================================================================
  // Ranking Methods
  // ============================================================================

  private weightedSumRanking(architectures: RankedArchitecture[]): RankedArchitecture[] {
    const sorted = [...architectures].sort((a, b) => b.score - a.score);

    return sorted.map((arch, i) => ({
      ...arch,
      rank: i + 1,
    }));
  }

  private paretoRanking(architectures: RankedArchitecture[]): RankedArchitecture[] {
    const fronts = this.calculateParetoFronts(architectures);

    // Assign ranks based on front
    const ranked: RankedArchitecture[] = [];

    for (let frontIndex = 0; frontIndex < fronts.length; frontIndex++) {
      const front = fronts[frontIndex];

      for (const arch of front) {
        ranked.push({
          ...arch,
          rank: frontIndex + 1,
        });
      }
    }

    return ranked;
  }

  private lexicographicRanking(architectures: RankedArchitecture[]): RankedArchitecture[] {
    // Sort by criteria in order
    const sorted = [...architectures].sort((a, b) => {
      for (const criterion of this.config.criteria) {
        const scoreA = a.scores[criterion.name] || 0;
        const scoreB = b.scores[criterion.name] || 0;

        if (Math.abs(scoreA - scoreB) > 1e-10) {
          return scoreB - scoreA;
        }
      }

      return 0;
    });

    return sorted.map((arch, i) => ({
      ...arch,
      rank: i + 1,
    }));
  }

  private topsisRanking(architectures: RankedArchitecture[]): RankedArchitecture[] {
    // TOPSIS: Technique for Order Preference by Similarity to Ideal Solution

    const criteria = this.config.criteria;

    // Find ideal and negative-ideal solutions
    const ideal: Record<string, number> = {};
    const negativeIdeal: Record<string, number> = {};

    for (const criterion of criteria) {
      const scores = architectures.map(a => a.scores[criterion.name] || 0);

      if (criterion.direction === 'maximize') {
        ideal[criterion.name] = Math.max(...scores);
        negativeIdeal[criterion.name] = Math.min(...scores);
      } else {
        ideal[criterion.name] = Math.min(...scores);
        negativeIdeal[criterion.name] = Math.max(...scores);
      }
    }

    // Calculate distances to ideal and negative-ideal
    const withDistances = architectures.map(arch => {
      let distToIdeal = 0;
      let distToNegativeIdeal = 0;

      for (const criterion of criteria) {
        const score = arch.scores[criterion.name] || 0;

        distToIdeal += Math.pow(score - ideal[criterion.name], 2);
        distToNegativeIdeal += Math.pow(score - negativeIdeal[criterion.name], 2);
      }

      distToIdeal = Math.sqrt(distToIdeal);
      distToNegativeIdeal = Math.sqrt(distToNegativeIdeal);

      // TOPSIS score
      const topsisScore = distToNegativeIdeal / (distToIdeal + distToNegativeIdeal);

      return {
        ...arch,
        score: topsisScore,
      };
    });

    // Sort by TOPSIS score
    const sorted = withDistances.sort((a, b) => b.score - a.score);

    return sorted.map((arch, i) => ({
      ...arch,
      rank: i + 1,
    }));
  }

  private analyticHierarchyRanking(architectures: RankedArchitecture[]): RankedArchitecture[] {
    // Analytic Hierarchy Process (AHP)
    // Simplified implementation

    // Build comparison matrix
    const criteria = this.config.criteria;
    const n = criteria.length;
    const matrix: number[][] = [];

    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          // Use weight ratio as comparison
          matrix[i][j] = criteria[i].weight / (criteria[j].weight || 1);
        }
      }
    }

    // Calculate eigenvector (simplified)
    const weights = this.calculateEigenvector(matrix);

    // Calculate final scores
    const withFinalScores = architectures.map(arch => {
      let finalScore = 0;

      for (let i = 0; i < criteria.length; i++) {
        const score = arch.scores[criteria[i].name] || 0;
        finalScore += weights[i] * score;
      }

      return {
        ...arch,
        score: finalScore,
      };
    });

    const sorted = withFinalScores.sort((a, b) => b.score - a.score);

    return sorted.map((arch, i) => ({
      ...arch,
      rank: i + 1,
    }));
  }

  private calculateEigenvector(matrix: number[][]): number[] {
    // Simplified eigenvector calculation
    const n = matrix.length;
    const weights: number[] = [];

    for (let i = 0; i < n; i++) {
      const product = matrix[i].reduce((p, v) => p * v, 1);
      weights.push(Math.pow(product, 1 / n));
    }

    // Normalize
    const sum = weights.reduce((s, w) => s + w, 0);
    return weights.map(w => w / sum);
  }

  private tournamentRanking(architectures: RankedArchitecture[]): RankedArchitecture[] {
    // Tournament ranking
    const scores = new Map<Architecture, number>();

    for (const arch of architectures) {
      scores.set(arch, 0);
    }

    // Run tournament
    for (let i = 0; i < architectures.length; i++) {
      for (let j = i + 1; j < architectures.length; j++) {
        const arch1 = architectures[i];
        const arch2 = architectures[j];

        const winner = this.compareArchitectures(arch1, arch2);
        const currentScore = scores.get(winner) || 0;
        scores.set(winner, currentScore + 1);
      }
    }

    // Sort by tournament scores
    const sorted = [...architectures].sort((a, b) => {
      const scoreA = scores.get(a) || 0;
      const scoreB = scores.get(b) || 0;
      return scoreB - scoreA;
    });

    return sorted.map((arch, i) => ({
      ...arch,
      rank: i + 1,
    }));
  }

  private compareArchitectures(
    arch1: RankedArchitecture,
    arch2: RankedArchitecture
  ): RankedArchitecture {
    // Compare based on criteria
    for (const criterion of this.config.criteria) {
      const score1 = arch1.scores[criterion.name] || 0;
      const score2 = arch2.scores[criterion.name] || 0;

      if (Math.abs(score1 - score2) > 1e-10) {
        return score1 > score2 ? arch1 : arch2;
      }
    }

    return arch1;
  }

  private async machineLearningRanking(
    architectures: RankedArchitecture[]
  ): Promise<RankedArchitecture[]> {
    // Learn ranking model
    // Simplified: use random forest-like approach

    // Extract features
    const features = architectures.map(arch => this.extractFeatures(arch));

    // Train simple model (placeholder)
    const model = this.trainSimpleModel(features);

    // Predict scores
    const withPredictedScores = architectures.map((arch, i) => {
      const predictedScore = model.predict(features[i]);

      return {
        ...arch,
        score: predictedScore,
      };
    });

    const sorted = withPredictedScores.sort((a, b) => b.score - a.score);

    return sorted.map((arch, i) => ({
      ...arch,
      rank: i + 1,
    }));
  }

  private extractFeatures(arch: RankedArchitecture): number[] {
    const features: number[] = [];

    // Architecture features
    features.push(arch.phenotype.layers.length);
    features.push(arch.phenotype.connections.length);
    features.push(arch.phenotype.topology.depth);
    features.push(arch.phenotype.topology.width);

    // Metric features
    features.push(arch.metrics.accuracy || 0);
    features.push(arch.metrics.flops);
    features.push(arch.metrics.parameters);
    features.push(arch.metrics.latency);
    features.push(arch.metrics.memory);

    return features;
  }

  private trainSimpleModel(features: number[][]): any {
    // Placeholder model training
    return {
      predict: (feature: number[]) => {
        // Simple linear model
        return feature.reduce((sum, f) => sum + f * 0.1, 0);
      },
    };
  }

  // ============================================================================
  // Pareto Front Calculation
  // ============================================================================

  private calculateParetoFront(architectures: RankedArchitecture[]): Architecture[] {
    const fronts = this.calculateParetoFronts(architectures);
    return fronts[0] || [];
  }

  private calculateParetoFronts(
    architectures: RankedArchitecture[]
  ): RankedArchitecture[][] {
    const fronts: RankedArchitecture[][] = [];
    const remaining = [...architectures];

    while (remaining.length > 0) {
      const front: RankedArchitecture[] = [];

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

  private dominates(arch1: RankedArchitecture, arch2: RankedArchitecture): boolean {
    const criteria = this.config.criteria;

    let atLeastOneBetter = false;

    for (const criterion of criteria) {
      const score1 = arch1.scores[criterion.name] || 0;
      const score2 = arch2.scores[criterion.name] || 0;

      if (score1 < score2) {
        return false;
      }

      if (score1 > score2) {
        atLeastOneBetter = true;
      }
    }

    return atLeastOneBetter;
  }

  // ============================================================================
  // Diversity
  // ============================================================================

  private applyDiversity(architectures: RankedArchitecture[]): RankedArchitecture[] {
    const diversityScores = this.calculateDiversityScores(architectures);

    return architectures.map((arch, i) => ({
      ...arch,
      score: arch.score * (1 - this.config.diversity.weight) +
             diversityScores[i] * this.config.diversity.weight,
      diversity: diversityScores[i],
    }));
  }

  private calculateDiversityScores(architectures: RankedArchitecture[]): number[] {
    const scores: number[] = [];

    for (let i = 0; i < architectures.length; i++) {
      let diversity = 0;

      for (let j = 0; j < architectures.length; j++) {
        if (i !== j) {
          diversity += this.calculateDistance(architectures[i], architectures[j]);
        }
      }

      scores.push(diversity / architectures.length);
    }

    // Normalize
    const max = Math.max(...scores);
    return scores.map(s => (max > 0 ? s / max : 0));
  }

  private calculateDistance(arch1: RankedArchitecture, arch2: RankedArchitecture): number {
    // Calculate architectural distance
    const layers1 = arch1.phenotype.layers;
    const layers2 = arch2.phenotype.layers;

    let distance = Math.abs(layers1.length - layers2.length);

    const minLength = Math.min(layers1.length, layers2.length);
    for (let i = 0; i < minLength; i++) {
      if (layers1[i].type !== layers2[i].type) {
        distance++;
      }
      if (layers1[i].operation !== layers2[i].operation) {
        distance += 0.5;
      }
    }

    return distance;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Rank architectures using weighted sum
 */
export function rankByWeightedSum(
  architectures: Architecture[],
  weights: Record<string, number>
): RankedArchitecture[] {
  const config: RankingConfig = {
    method: 'weighted-sum',
    criteria: Object.entries(weights).map(([name, weight]) => ({
      name,
      weight,
      direction: name === 'accuracy' ? 'maximize' : 'minimize',
    })),
    aggregation: 'weighted-sum',
    normalization: 'min-max',
    diversity: {
      enabled: false,
      method: 'distance',
      weight: 0,
      threshold: 0,
    },
  };

  const ranker = new ArchitectureRanker(config);
  return ranker.rank(architectures).then(result => result.architectures);
}

/**
 * Find Pareto front
 */
export function findParetoFront(architectures: Architecture[]): Architecture[] {
  const config: RankingConfig = {
    method: 'pareto',
    criteria: [
      { name: 'accuracy', weight: 1, direction: 'maximize' },
      { name: 'flops', weight: 1, direction: 'minimize' },
      { name: 'latency', weight: 1, direction: 'minimize' },
    ],
    aggregation: 'weighted-sum',
    normalization: 'none',
    diversity: {
      enabled: false,
      method: 'distance',
      weight: 0,
      threshold: 0,
    },
  };

  const ranker = new ArchitectureRanker(config);
  return ranker.rank(architectures).then(result => result.paretoFront);
}

/**
 * Calculate hypervolume of Pareto front
 */
export function calculateHypervolume(
  architectures: Architecture[],
  referencePoint: Record<string, number>
): number {
  // Simplified hypervolume calculation
  const criteria = Object.keys(referencePoint);

  let volume = 1;

  for (const criterion of criteria) {
    const values = architectures.map(arch => (arch.metrics as any)[criterion] || 0);
    const ref = referencePoint[criterion];

    // Find dominated region
    const max = Math.max(...values.filter(v => v < ref));

    volume *= Math.max(0, ref - max);
  }

  return volume;
}
