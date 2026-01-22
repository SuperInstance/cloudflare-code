/**
 * Attention Visualization
 * Visualize attention mechanisms in transformer models
 */

import {
  AttentionVisualization,
  AttentionConfig,
  AttentionWeights,
  AttentionPattern,
  HeatmapData,
} from '../types/attention';
import { mean, stdDev, softmax, normalize } from '../utils/math';
import { validateMatrix } from '../utils/validation';

export class AttentionVisualizer {
  private config: Required<AttentionConfig>;

  constructor(config: AttentionConfig = {}) {
    this.config = this.validateAndSetConfig(config);
  }

  private validateAndSetConfig(config: AttentionConfig): Required<AttentionConfig> {
    return {
      layer: config.layer ?? -1, // -1 means last layer
      head: config.head ?? 0,
      aggregateLayers: config.aggregateLayers ?? false,
      aggregateHeads: config.aggregateHeads ?? false,
      normalization: config.normalization ?? 'softmax',
    };
  }

  /**
   * Visualize attention for a single instance
   */
  async visualize(
    attentionWeights: number[][][][],
    tokens: string[]
  ): Promise<AttentionVisualization[]> {
    const numLayers = attentionWeights.length;
    const numHeads = attentionWeights[0].length;

    const visualizations: AttentionVisualization[] = [];

    if (this.config.aggregateLayers && this.config.aggregateHeads) {
      // Aggregate across all layers and heads
      const aggregatedWeights = this.aggregateAllLayersAndHeads(attentionWeights);
      const visualization = await this.createVisualization(
        aggregatedWeights,
        tokens,
        -1,
        -1
      );
      visualizations.push(visualization);
    } else if (this.config.aggregateLayers) {
      // Aggregate across layers, show each head
      for (let h = 0; h < numHeads; h++) {
        const layerWeights = this.aggregateLayers(attentionWeights, h);
        const visualization = await this.createVisualization(
          layerWeights,
          tokens,
          -1,
          h
        );
        visualizations.push(visualization);
      }
    } else if (this.config.aggregateHeads) {
      // Aggregate across heads, show each layer
      for (let l = 0; l < numLayers; l++) {
        const headWeights = this.aggregateHeads(attentionWeights[l]);
        const visualization = await this.createVisualization(
          headWeights,
          tokens,
          l,
          -1
        );
        visualizations.push(visualization);
      }
    } else {
      // Show specific layer and head
      const layer = this.config.layer === -1 ? numLayers - 1 : this.config.layer;
      const head = this.config.head;
      const weights = attentionWeights[layer][head];

      const visualization = await this.createVisualization(
        weights,
        tokens,
        layer,
        head
      );
      visualizations.push(visualization);
    }

    return visualizations;
  }

  /**
   * Create visualization for specific attention weights
   */
  private async createVisualization(
    weights: number[][],
    tokens: string[],
    layer: number,
    head: number
  ): Promise<AttentionVisualization> {
    // Apply normalization
    const normalizedWeights = this.normalizeWeights(weights);

    // Create heatmap
    const heatmap = this.createHeatmap(normalizedWeights, tokens);

    // Identify patterns
    const patterns = this.identifyPatterns(normalizedWeights, tokens);

    return {
      layer,
      head,
      tokens,
      weights: normalizedWeights,
      heatmap,
      patterns,
    };
  }

  /**
   * Normalize attention weights
   */
  private normalizeWeights(weights: number[][]): number[][] {
    switch (this.config.normalization) {
      case 'softmax':
        return weights.map(row => softmax(row));
      case 'layer_norm':
        return this.layerNormalize(weights);
      case 'none':
        return weights;
      default:
        return weights.map(row => softmax(row));
    }
  }

  /**
   * Layer normalization
   */
  private layerNormalize(weights: number[][]): number[][] {
    const flatWeights = weights.flat();
    const mu = mean(flatWeights);
    const sigma = stdDev(flatWeights);

    if (sigma === 0) return weights;

    return weights.map(row =>
      row.map(w => (w - mu) / sigma)
    );
  }

  /**
   * Aggregate attention across all layers and heads
   */
  private aggregateAllLayersAndHeads(
    attentionWeights: number[][][][]
  ): number[][] {
    const numLayers = attentionWeights.length;
    const numHeads = attentionWeights[0].length;
    const seqLen = attentionWeights[0][0].length;

    const aggregated: number[][] = Array(seqLen)
      .fill(0)
      .map(() => Array(seqLen).fill(0));

    for (let l = 0; l < numLayers; l++) {
      for (let h = 0; h < numHeads; h++) {
        for (let i = 0; i < seqLen; i++) {
          for (let j = 0; j < seqLen; j++) {
            aggregated[i][j] += attentionWeights[l][h][i][j];
          }
        }
      }
    }

    // Normalize
    const maxVal = Math.max(...aggregated.flat());
    if (maxVal > 0) {
      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < seqLen; j++) {
          aggregated[i][j] /= maxVal;
        }
      }
    }

    return aggregated;
  }

  /**
   * Aggregate attention across layers for a specific head
   */
  private aggregateLayers(
    attentionWeights: number[][][][],
    head: number
  ): number[][] {
    const numLayers = attentionWeights.length;
    const seqLen = attentionWeights[0][0].length;

    const aggregated: number[][] = Array(seqLen)
      .fill(0)
      .map(() => Array(seqLen).fill(0));

    for (let l = 0; l < numLayers; l++) {
      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < seqLen; j++) {
          aggregated[i][j] += attentionWeights[l][head][i][j];
        }
      }
    }

    // Average
    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < seqLen; j++) {
        aggregated[i][j] /= numLayers;
      }
    }

    return aggregated;
  }

  /**
   * Aggregate attention across heads for a specific layer
   */
  private aggregateHeads(layerWeights: number[][][]): number[][] {
    const numHeads = layerWeights.length;
    const seqLen = layerWeights[0].length;

    const aggregated: number[][] = Array(seqLen)
      .fill(0)
      .map(() => Array(seqLen).fill(0));

    for (let h = 0; h < numHeads; h++) {
      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < seqLen; j++) {
          aggregated[i][j] += layerWeights[h][i][j];
        }
      }
    }

    // Average
    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < seqLen; j++) {
        aggregated[i][j] /= numHeads;
      }
    }

    return aggregated;
  }

  /**
   * Create heatmap data structure
   */
  private createHeatmap(weights: number[][], tokens: string[]): HeatmapData {
    const seqLen = tokens.length;

    return {
      rows: tokens,
      cols: tokens,
      values: weights,
      colorScale: 'viridis',
      annotations: this.createAnnotations(weights),
    };
  }

  /**
   * Create annotations for heatmap
   */
  private createAnnotations(weights: number[][]): string[][] {
    return weights.map(row =>
      row.map(w => w.toFixed(3))
    );
  }

  /**
   * Identify attention patterns
   */
  private identifyPatterns(
    weights: number[][],
    tokens: string[]
  ): AttentionPattern[] {
    const patterns: AttentionPattern[] = [];

    // Check for diagonal pattern (self-attention)
    const diagonalScore = this.calculateDiagonalScore(weights);
    if (diagonalScore > 0.5) {
      patterns.push({
        type: 'diagonal',
        strength: diagonalScore,
        description: 'Strong self-attention pattern - tokens focus on themselves',
      });
    }

    // Check for vertical pattern (attention to specific tokens)
    const verticalScore = this.calculateVerticalScore(weights);
    if (verticalScore > 0.5) {
      patterns.push({
        type: 'vertical',
        strength: verticalScore,
        description: 'Vertical attention pattern - specific tokens receive high attention',
      });
    }

    // Check for local pattern (attention to nearby tokens)
    const localScore = this.calculateLocalScore(weights);
    if (localScore > 0.5) {
      patterns.push({
        type: 'local',
        strength: localScore,
        description: 'Local attention pattern - tokens focus on nearby tokens',
      });
    }

    // Check for global pattern (attention distributed across sequence)
    const globalScore = this.calculateGlobalScore(weights);
    if (globalScore > 0.5) {
      patterns.push({
        type: 'global',
        strength: globalScore,
        description: 'Global attention pattern - attention distributed across sequence',
      });
    }

    // If no strong patterns, classify as heterogeneous
    if (patterns.length === 0) {
      patterns.push({
        type: 'other',
        strength: 0.5,
        description: 'Heterogeneous attention pattern - no dominant pattern detected',
      });
    }

    return patterns.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Calculate diagonal pattern score
   */
  private calculateDiagonalScore(weights: number[][]): number {
    const seqLen = weights.length;
    let diagonalSum = 0;

    for (let i = 0; i < seqLen; i++) {
      diagonalSum += weights[i][i];
    }

    return diagonalSum / seqLen;
  }

  /**
   * Calculate vertical pattern score
   */
  private calculateVerticalScore(weights: number[][]): number {
    const seqLen = weights.length;
    const columnSums: number[] = Array(seqLen).fill(0);

    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < seqLen; j++) {
        columnSums[j] += weights[i][j];
      }
    }

    // Check if any column has very high sum
    const maxColumnSum = Math.max(...columnSums);
    const expectedSum = 1.0; // Each row should sum to 1

    return min(maxColumnSum / (expectedSum * seqLen), 1.0);
  }

  /**
   * Calculate local pattern score
   */
  private calculateLocalScore(weights: number[][]): number {
    const seqLen = weights.length;
    let localAttention = 0;
    const windowSize = 3;

    for (let i = 0; i < seqLen; i++) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(seqLen, i + windowSize + 1);

      for (let j = start; j < end; j++) {
        localAttention += weights[i][j];
      }
    }

    return localAttention / (seqLen * windowSize * 2);
  }

  /**
   * Calculate global pattern score
   */
  private calculateGlobalScore(weights: number[][]): number {
    const seqLen = weights.length;
    const entropyValues: number[] = [];

    for (let i = 0; i < seqLen; i++) {
      const entropy = this.calculateEntropy(weights[i]);
      entropyValues.push(entropy);
    }

    // High entropy indicates distributed (global) attention
    const avgEntropy = mean(entropyValues);
    const maxEntropy = Math.log2(seqLen);

    return avgEntropy / maxEntropy;
  }

  /**
   * Calculate entropy of attention distribution
   */
  private calculateEntropy(distribution: number[]): number {
    const entropy = distribution.reduce((sum, p) => {
      if (p > 0) {
        return sum - p * Math.log2(p);
      }
      return sum;
    }, 0);

    return entropy;
  }

  /**
   * Extract attention weights for specific layer and head
   */
  extractWeights(
    attentionWeights: number[][][][],
    layer: number,
    head: number
  ): AttentionWeights {
    const numLayers = attentionWeights.length;
    const numHeads = attentionWeights[0].length;

    if (layer < 0 || layer >= numLayers) {
      throw new Error(`Invalid layer: ${layer}`);
    }

    if (head < 0 || head >= numHeads) {
      throw new Error(`Invalid head: ${head}`);
    }

    return {
      layer,
      head,
      weights: attentionWeights[layer][head],
      tokens: [], // Will be filled by caller
    };
  }

  /**
   * Get attention flow through layers
   */
  getAttentionFlow(
    attentionWeights: number[][][][],
    tokens: string[]
  ): number[][] {
    const numLayers = attentionWeights.length;
    const seqLen = tokens.length;

    // Start with uniform distribution
    let flow: number[][] = Array(seqLen)
      .fill(0)
      .map(() => Array(seqLen).fill(0));

    for (let i = 0; i < seqLen; i++) {
      flow[i][i] = 1.0;
    }

    // Propagate through layers
    for (let l = 0; l < numLayers; l++) {
      const numHeads = attentionWeights[l].length;
      const aggregatedHead = this.aggregateHeads(attentionWeights[l]);

      const newFlow: number[][] = Array(seqLen)
        .fill(0)
        .map(() => Array(seqLen).fill(0));

      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < seqLen; j++) {
          for (let k = 0; k < seqLen; k++) {
            newFlow[i][j] += flow[i][k] * aggregatedHead[k][j];
          }
        }
      }

      flow = newFlow;
    }

    return flow;
  }

  /**
   * Calculate attention metrics
   */
  calculateMetrics(attentionWeights: number[][]): {
    entropy: number;
    sparsity: number;
    focus: number;
    uniformity: number;
  } {
    const seqLen = attentionWeights.length;

    // Calculate entropy for each row
    const entropies: number[] = [];
    for (let i = 0; i < seqLen; i++) {
      entropies.push(this.calculateEntropy(attentionWeights[i]));
    }
    const avgEntropy = mean(entropies);
    const maxEntropy = Math.log2(seqLen);

    // Calculate sparsity (proportion of near-zero values)
    const threshold = 0.01;
    let zeroCount = 0;
    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < seqLen; j++) {
        if (attentionWeights[i][j] < threshold) {
          zeroCount++;
        }
      }
    }
    const sparsity = zeroCount / (seqLen * seqLen);

    // Calculate focus (concentration on diagonal)
    const diagonalSum = this.calculateDiagonalScore(attentionWeights);

    // Calculate uniformity (inverse of variance)
    const flatWeights = attentionWeights.flat();
    const variance = stdDev(flatWeights);
    const uniformity = 1 / (1 + variance);

    return {
      entropy: avgEntropy / maxEntropy,
      sparsity,
      focus: diagonalSum,
      uniformity,
    };
  }

  /**
   * Compare attention patterns
   */
  compareAttention(
    weightsA: number[][],
    weightsB: number[][]
  ): {
    similarity: number;
    correlation: number;
    klDivergence: number;
  } {
    const seqLen = weightsA.length;

    // Flatten matrices
    const flatA = weightsA.flat();
    const flatB = weightsB.flat();

    // Calculate cosine similarity
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < flatA.length; i++) {
      dotProduct += flatA[i] * flatB[i];
      normA += flatA[i] * flatA[i];
      normB += flatB[i] * flatB[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    // Calculate correlation
    const meanA = mean(flatA);
    const meanB = mean(flatB);

    let numerator = 0;
    let denomA = 0;
    let denomB = 0;

    for (let i = 0; i < flatA.length; i++) {
      const diffA = flatA[i] - meanA;
      const diffB = flatB[i] - meanB;
      numerator += diffA * diffB;
      denomA += diffA * diffA;
      denomB += diffB * diffB;
    }

    const correlation = numerator / Math.sqrt(denomA * denomB);

    // Calculate KL divergence
    let klDiv = 0;
    for (let i = 0; i < flatA.length; i++) {
      if (flatA[i] > 0 && flatB[i] > 0) {
        klDiv += flatA[i] * Math.log(flatA[i] / flatB[i]);
      }
    }

    return {
      similarity,
      correlation,
      klDivergence: klDiv,
    };
  }
}

function min(a: number, b: number): number {
  return a < b ? a : b;
}
