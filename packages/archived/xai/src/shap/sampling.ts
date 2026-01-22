/**
 * SHAP Sampling Methods
 * Efficient sampling strategies for SHAP value computation
 */

import { ModelMetadata } from '../types/models';
import { sample, mean } from '../utils/math';

export interface SamplingStrategy {
  name: string;
  description: string;
  sample: (background: Record<string, any>[], size: number) => Record<string, any>[];
}

export class SHAPSampler {
  private metadata: ModelMetadata;
  private strategies: Map<string, SamplingStrategy>;

  constructor(metadata: ModelMetadata) {
    this.metadata = metadata;
    this.strategies = new Map();
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // Random sampling
    this.strategies.set('random', {
      name: 'Random Sampling',
      description: 'Uniform random sampling from background data',
      sample: (background, size) => this.randomSample(background, size),
    });

    // K-means sampling
    this.strategies.set('kmeans', {
      name: 'K-means Sampling',
      description: 'K-means clustering based sampling',
      sample: (background, size) => this.kmeansSample(background, size),
    });

    // Stratified sampling
    this.strategies.set('stratified', {
      name: 'Stratified Sampling',
      description: 'Stratified sampling based on target variable',
      sample: (background, size) => this.stratifiedSample(background, size),
    });

    // Importance sampling
    this.strategies.set('importance', {
      name: 'Importance Sampling',
      description: 'Importance-weighted sampling',
      sample: (background, size) => this.importanceSample(background, size),
    });
  }

  /**
   * Sample background data using specified strategy
   */
  sample(
    background: Record<string, any>[],
    size: number,
    strategy: string = 'random'
  ): Record<string, any>[] {
    const samplingStrategy = this.strategies.get(strategy);

    if (!samplingStrategy) {
      throw new Error(`Unknown sampling strategy: ${strategy}`);
    }

    return samplingStrategy.sample(background, size);
  }

  /**
   * Random sampling strategy
   */
  private randomSample(
    background: Record<string, any>[],
    size: number
  ): Record<string, any>[] {
    return sample(background, Math.min(size, background.length), false);
  }

  /**
   * K-means clustering based sampling
   */
  private kmeansSample(
    background: Record<string, any>[],
    size: number
  ): Record<string, any>[] {
    // Simplified k-means - in production use proper implementation
    const k = Math.min(size, background.length);
    const centroids = this.initializeKMeansCentroids(background, k);
    const clusters = this.assignToClusters(background, centroids);
    const selectedSamples: Record<string, any>[] = [];

    // Select samples closest to centroids
    for (let clusterId = 0; clusterId < k; clusterId++) {
      const clusterSamples = clusters
        .map((cid, idx) => (cid === clusterId ? idx : -1))
        .filter(idx => idx !== -1);

      if (clusterSamples.length > 0) {
        // Select representative sample
        const representativeIdx = clusterSamples[Math.floor(clusterSamples.length / 2)];
        selectedSamples.push(background[representativeIdx]);
      }
    }

    return selectedSamples;
  }

  /**
   * Initialize k-means centroids
   */
  private initializeKMeansCentroids(
    background: Record<string, any>[],
    k: number
  ): Record<string, any>[] {
    // For simplicity, just pick k random samples
    const indices = sample(
      Array.from({ length: background.length }, (_, i) => i),
      k,
      false
    );

    return indices.map(i => background[i]);
  }

  /**
   * Assign samples to clusters
   */
  private assignToClusters(
    background: Record<string, any>[],
    centroids: Record<string, any>[]
  ): number[] {
    const assignments: number[] = [];

    for (const sample of background) {
      let minDist = Infinity;
      let closestCluster = 0;

      for (let c = 0; c < centroids.length; c++) {
        const dist = this.euclideanDistance(sample, centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          closestCluster = c;
        }
      }

      assignments.push(closestCluster);
    }

    return assignments;
  }

  /**
   * Stratified sampling
   */
  private stratifiedSample(
    background: Record<string, any>[],
    size: number
  ): Record<string, any>[] {
    // Group by target variable (if available)
    const groups = this.groupByTarget(background);
    const samplesPerGroup = Math.ceil(size / Object.keys(groups).size);
    const selectedSamples: Record<string, any>[] = [];

    for (const [target, groupSamples] of Object.entries(groups)) {
      const groupSize = Math.min(samplesPerGroup, groupSamples.length);
      const groupSelected = sample(groupSamples, groupSize, false);
      selectedSamples.push(...groupSelected);
    }

    return selectedSamples.slice(0, size);
  }

  /**
   * Group samples by target variable
   */
  private groupByTarget(background: Record<string, any>[]): Record<string, Record<string, any>[]> {
    const groups: Record<string, Record<string, any>[]> = {};

    for (const sample of background) {
      // Try to find target variable
      const targetKey = Object.keys(sample).find(key =>
        key.toLowerCase().includes('target') ||
        key.toLowerCase().includes('label') ||
        key.toLowerCase().includes('class')
      );

      if (targetKey) {
        const target = String(sample[targetKey]);
        if (!groups[target]) {
          groups[target] = [];
        }
        groups[target].push(sample);
      } else {
        // No target found, put in 'unknown' group
        if (!groups['unknown']) {
          groups['unknown'] = [];
        }
        groups['unknown'].push(sample);
      }
    }

    return groups;
  }

  /**
   * Importance sampling
   */
  private importanceSample(
    background: Record<string, any>[],
    size: number
  ): Record<string, any>[] {
    // Calculate importance weights based on feature variance
    const weights = this.calculateImportanceWeights(background);
    const cumulativeWeights: number[] = [];
    let sum = 0;

    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      cumulativeWeights.push(sum);
    }

    // Sample based on weights
    const selectedSamples: Record<string, any>[] = [];
    const selectedIndices = new Set<number>();

    while (selectedIndices.size < size && selectedIndices.size < background.length) {
      const r = Math.random() * cumulativeWeights[cumulativeWeights.length - 1];

      for (let i = 0; i < cumulativeWeights.length; i++) {
        if (r <= cumulativeWeights[i]) {
          selectedIndices.add(i);
          break;
        }
      }
    }

    for (const idx of selectedIndices) {
      selectedSamples.push(background[idx]);
    }

    return selectedSamples;
  }

  /**
   * Calculate importance weights for samples
   */
  private calculateImportanceWeights(background: Record<string, any>[]): number[] {
    const weights: number[] = [];

    // Calculate variance for each feature
    const featureVariances: Record<string, number> = {};

    for (const feature of this.metadata.featureNames) {
      const featureType = this.metadata.featureTypes.find(
        ft => ft.name === feature
      );

      if (featureType?.type === 'numeric') {
        const values = background
          .map(s => s[feature])
          .filter(v => typeof v === 'number');

        if (values.length > 0) {
          featureVariances[feature] = this.calculateVariance(values);
        }
      }
    }

    // Calculate weight for each sample
    for (const sample of background) {
      let weight = 0;

      for (const [feature, variance] of Object.entries(featureVariances)) {
        const value = sample[feature];
        if (typeof value === 'number') {
          // Higher weight for samples with extreme values
          const deviation = Math.abs(value - mean(background.map(s => s[feature])));
          weight += deviation * variance;
        }
      }

      weights.push(weight);
    }

    // Normalize weights
    const sumWeights = weights.reduce((sum, w) => sum + w, 0);
    return weights.map(w => (sumWeights > 0 ? w / sumWeights : 1 / weights.length));
  }

  /**
   * Calculate variance of values
   */
  private calculateVariance(values: number[]): number {
    const mu = mean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mu, 2));
    return mean(squaredDiffs);
  }

  /**
   * Calculate Euclidean distance between two samples
   */
  private euclideanDistance(
    a: Record<string, any>,
    b: Record<string, any>
  ): number {
    let sum = 0;

    for (const feature of this.metadata.featureNames) {
      const valA = a[feature];
      const valB = b[feature];

      if (typeof valA === 'number' && typeof valB === 'number') {
        sum += Math.pow(valA - valB, 2);
      }
    }

    return Math.sqrt(sum);
  }

  /**
   * Get available sampling strategies
   */
  getStrategies(): SamplingStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get strategy by name
   */
  getStrategy(name: string): SamplingStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Estimate optimal sample size
   */
  estimateOptimalSampleSize(
    background: Record<string, any>[],
    confidence: number = 0.95,
    marginOfError: number = 0.05
  ): number {
    // Simple formula for sample size estimation
    // n = (Z^2 * p * (1-p)) / E^2

    const Z = 1.96; // Z-score for 95% confidence
    const p = 0.5; // Conservative estimate
    const E = marginOfError;

    const sampleSize = Math.ceil((Math.pow(Z, 2) * p * (1 - p)) / Math.pow(E, 2));

    return Math.min(sampleSize, background.length);
  }

  /**
   * Adaptive sampling - adjust sample size based on convergence
   */
  adaptiveSample(
    background: Record<string, any>[],
    initialSize: number = 100,
    maxIterations: number = 10,
    convergenceThreshold: number = 0.01
  ): { samples: Record<string, any>[]; converged: boolean; iterations: number } {
    let currentSize = initialSize;
    let prevMean = 0;
    let converged = false;
    let iterations = 0;

    while (!converged && iterations < maxIterations) {
      const samples = this.sample(background, currentSize, 'random');

      // Calculate mean of first numeric feature
      const feature = this.metadata.featureNames.find(f => {
        const type = this.metadata.featureTypes.find(ft => ft.name === f);
        return type?.type === 'numeric';
      });

      if (feature) {
        const values = samples.map(s => s[feature]).filter(v => typeof v === 'number');
        const currentMean = mean(values);

        if (iterations > 0) {
          const change = Math.abs(currentMean - prevMean) / (Math.abs(prevMean) + 1e-10);

          if (change < convergenceThreshold) {
            converged = true;
          }
        }

        prevMean = currentMean;
      }

      iterations++;
      currentSize = Math.min(currentSize * 2, background.length);
    }

    const finalSamples = this.sample(background, currentSize, 'random');

    return {
      samples: finalSamples,
      converged,
      iterations,
    };
  }

  /**
   * Create sampling summary report
   */
  createSamplingReport(
    background: Record<string, any>[],
    selected: Record<string, any>[],
    strategy: string
  ): {
    strategy: string;
    originalSize: number;
    selectedSize: number;
    reductionRatio: number;
    coverage: number;
    statistics: Record<string, { mean: number; std: number; min: number; max: number }>;
  } {
    const statistics: Record<string, any> = {};

    for (const feature of this.metadata.featureNames) {
      const featureType = this.metadata.featureTypes.find(
        ft => ft.name === feature
      );

      if (featureType?.type === 'numeric') {
        const values = selected
          .map(s => s[feature])
          .filter(v => typeof v === 'number');

        if (values.length > 0) {
          statistics[feature] = {
            mean: mean(values),
            std: this.calculateVariance(values),
            min: Math.min(...values),
            max: Math.max(...values),
          };
        }
      }
    }

    return {
      strategy,
      originalSize: background.length,
      selectedSize: selected.length,
      reductionRatio: selected.length / background.length,
      coverage: this.calculateCoverage(background, selected),
      statistics,
    };
  }

  /**
   * Calculate coverage of selected samples
   */
  private calculateCoverage(
    background: Record<string, any>[],
    selected: Record<string, any>[]
  ): number {
    // Simple coverage metric: proportion of background within radius of selected
    let covered = 0;
    const radius = 0.1; // Normalized radius

    for (const bgSample of background) {
      let isCovered = false;

      for (const selectedSample of selected) {
        const dist = this.euclideanDistance(bgSample, selectedSample);
        if (dist < radius) {
          isCovered = true;
          break;
        }
      }

      if (isCovered) covered++;
    }

    return covered / background.length;
  }
}
