/**
 * Multimodal Fusion Strategies
 * Various approaches to combining information from multiple modalities
 */

import type {
  FusionConfig,
  FusionResult,
  FusionStrategy,
  Modality,
  CrossModalEmbedding,
  AttentionWeights
} from '../types';

// ============================================================================
// Early Fusion
// ============================================================================

export class EarlyFusion {
  private config: FusionConfig;

  constructor(config: FusionConfig) {
    this.config = config;
  }

  /**
   * Fuse embeddings at feature level
   */
  async fuse(embeddings: Map<Modality, Float32Array>): Promise<FusionResult> {
    const vectors = Array.from(embeddings.values());
    const modalities = Array.from(embeddings.keys());

    // Concatenate features
    const concatenated = this.concatenate(vectors);

    // Project to target dimension
    const projected = this.project(concatenated);

    // Compute modality weights (learned or equal)
    const modalityWeights = this.computeModalityWeights(modalities);

    return {
      output: projected,
      modalityWeights,
      confidence: this.computeConfidence(projected),
      metadata: {
        strategy: 'early',
        inputModalities: modalities,
        outputDim: this.config.dimensions
      }
    };
  }

  private concatenate(vectors: Float32Array[]): Float32Array {
    const totalDim = vectors.reduce((sum, v) => sum + v.length, 0);
    const concatenated = new Float32Array(totalDim);

    let offset = 0;
    for (const vector of vectors) {
      concatenated.set(vector, offset);
      offset += vector.length;
    }

    return concatenated;
  }

  private project(input: Float32Array): Float32Array {
    // Simple projection to target dimension
    const output = new Float32Array(this.config.dimensions);
    const inputDim = input.length;

    for (let i = 0; i < this.config.dimensions; i++) {
      // Use first inputDim elements, pad/truncate as needed
      const inputIdx = Math.floor((i * inputDim) / this.config.dimensions);
      output[i] = input[inputIdx];
    }

    return output;
  }

  private computeModalityWeights(modalities: Modality[]): Record<Modality, number> {
    const weights: Record<string, number> = {};
    const weight = 1 / modalities.length;
    for (const modality of modalities) {
      weights[modality] = weight;
    }
    return weights as Record<Modality, number>;
  }

  private computeConfidence(output: Float32Array): number {
    // Simple confidence based on output norm
    let sum = 0;
    for (let i = 0; i < output.length; i++) {
      sum += output[i] * output[i];
    }
    return Math.sqrt(sum) / output.length;
  }
}

// ============================================================================
// Late Fusion
// ============================================================================

export class LateFusion {
  private config: FusionConfig;

  constructor(config: FusionConfig) {
    this.config = config;
  }

  /**
   * Fuse predictions at decision level
   */
  async fuse(
    embeddings: Map<Modality, Float32Array>,
    predictions: Map<Modality, Float32Array>
  ): Promise<FusionResult> {
    const modalities = Array.from(predictions.keys());

    // Weight predictions by confidence
    const weightedPredictions = this.weightPredictions(predictions);

    // Aggregate predictions
    const aggregated = this.aggregatePredictions(weightedPredictions);

    return {
      output: aggregated,
      modalityWeights: this.computeModalityWeights(modalities),
      confidence: this.computeConfidence(aggregated),
      metadata: {
        strategy: 'late',
        inputModalities: modalities,
        outputDim: this.config.dimensions
      }
    };
  }

  private weightPredictions(predictions: Map<Modality, Float32Array>): Map<Modality, Float32Array> {
    const weighted = new Map<Modality, Float32Array>();

    for (const [modality, prediction] of predictions) {
      const confidence = this.computePredictionConfidence(prediction);
      const weightedPred = new Float32Array(prediction.length);
      for (let i = 0; i < prediction.length; i++) {
        weightedPred[i] = prediction[i] * confidence;
      }
      weighted.set(modality, weightedPred);
    }

    return weighted;
  }

  private aggregatePredictions(predictions: Map<Modality, Float32Array>): Float32Array {
    const dim = predictions.values().next().value.length;
    const aggregated = new Float32Array(dim);

    for (const prediction of predictions.values()) {
      for (let i = 0; i < dim; i++) {
        aggregated[i] += prediction[i];
      }
    }

    // Normalize by number of modalities
    const numModalities = predictions.size;
    for (let i = 0; i < dim; i++) {
      aggregated[i] /= numModalities;
    }

    return aggregated;
  }

  private computePredictionConfidence(prediction: Float32Array): number {
    // Use max probability as confidence
    let maxProb = 0;
    for (let i = 0; i < prediction.length; i++) {
      maxProb = Math.max(maxProb, prediction[i]);
    }
    return maxProb;
  }

  private computeModalityWeights(modalities: Modality[]): Record<Modality, number> {
    const weights: Record<string, number> = {};
    const weight = 1 / modalities.length;
    for (const modality of modalities) {
      weights[modality] = weight;
    }
    return weights as Record<Modality, number>;
  }

  private computeConfidence(output: Float32Array): number {
    let maxVal = 0;
    for (let i = 0; i < output.length; i++) {
      maxVal = Math.max(maxVal, output[i]);
    }
    return maxVal;
  }
}

// ============================================================================
// Hybrid Fusion
// ============================================================================

export class HybridFusion {
  private config: FusionConfig;
  private earlyFusion: EarlyFusion;
  private lateFusion: LateFusion;

  constructor(config: FusionConfig) {
    this.config = config;
    this.earlyFusion = new EarlyFusion(config);
    this.lateFusion = new LateFusion(config);
  }

  /**
   * Combine early and late fusion
   */
  async fuse(
    embeddings: Map<Modality, Float32Array>,
    predictions?: Map<Modality, Float32Array>,
    alpha: number = 0.5
  ): Promise<FusionResult> {
    // Early fusion on embeddings
    const earlyResult = await this.earlyFusion.fuse(embeddings);

    let lateResult: FusionResult | null = null;
    if (predictions && predictions.size > 0) {
      lateResult = await this.lateFusion.fuse(embeddings, predictions);
    }

    // Combine results
    let output: Float32Array;
    let modalityWeights: Record<Modality, number>;

    if (lateResult) {
      output = this.combineResults(earlyResult.output, lateResult.output, alpha);
      modalityWeights = this.combineWeights(
        earlyResult.modalityWeights!,
        lateResult.modalityWeights!,
        alpha
      );
    } else {
      output = earlyResult.output;
      modalityWeights = earlyResult.modalityWeights!;
    }

    return {
      output,
      modalityWeights,
      confidence: this.computeConfidence(output),
      metadata: {
        strategy: 'hybrid',
        inputModalities: Array.from(embeddings.keys()),
        outputDim: this.config.dimensions,
        alpha
      }
    };
  }

  private combineResults(
    earlyOutput: Float32Array,
    lateOutput: Float32Array,
    alpha: number
  ): Float32Array {
    const dim = Math.min(earlyOutput.length, lateOutput.length);
    const combined = new Float32Array(dim);

    for (let i = 0; i < dim; i++) {
      combined[i] = alpha * earlyOutput[i] + (1 - alpha) * lateOutput[i];
    }

    return combined;
  }

  private combineWeights(
    earlyWeights: Record<Modality, number>,
    lateWeights: Record<Modality, number>,
    alpha: number
  ): Record<Modality, number> {
    const combined: Record<string, number> = {};

    for (const modality in earlyWeights) {
      const earlyWeight = earlyWeights[modality as Modality];
      const lateWeight = lateWeights[modality as Modality] || 0;
      combined[modality] = alpha * earlyWeight + (1 - alpha) * lateWeight;
    }

    return combined as Record<Modality, number>;
  }

  private computeConfidence(output: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < output.length; i++) {
      sum += output[i] * output[i];
    }
    return Math.sqrt(sum) / output.length;
  }
}

// ============================================================================
// Cross-Modal Attention Fusion
// ============================================================================

export class AttentionFusion {
  private config: FusionConfig;
  private queryProjections: Map<Modality, Float32Array>;
  private keyProjections: Map<Modality, Float32Array>;
  private valueProjections: Map<Modality, Float32Array>;

  constructor(config: FusionConfig, modalities: Modality[]) {
    this.config = config;
    this.queryProjections = new Map();
    this.keyProjections = new Map();
    this.valueProjections = new Map();

    for (const modality of modalities) {
      const dim = config.dimensions;
      this.queryProjections.set(modality, this.initProjection(dim, dim));
      this.keyProjections.set(modality, this.initProjection(dim, dim));
      this.valueProjections.set(modality, this.initProjection(dim, dim));
    }
  }

  private initProjection(inDim: number, outDim: number): Float32Array {
    const projection = new Float32Array(inDim * outDim);
    const std = Math.sqrt(2 / (inDim + outDim));
    for (let i = 0; i < projection.length; i++) {
      projection[i] = (Math.random() - 0.5) * 2 * std;
    }
    return projection;
  }

  /**
   * Fuse using cross-modal attention
   */
  async fuse(embeddings: Map<Modality, Float32Array>): Promise<FusionResult> {
    const modalities = Array.from(embeddings.keys());

    // Compute queries, keys, values for each modality
    const queries = this.computeQueries(embeddings);
    const keys = this.computeKeys(embeddings);
    const values = this.computeValues(embeddings);

    // Compute cross-modal attention
    const attended = this.computeCrossModalAttention(queries, keys, values, modalities);

    // Aggregate attended representations
    const fused = this.aggregateAttended(attended);

    return {
      output: fused,
      modalityWeights: this.computeModalityWeights(embeddings),
      confidence: this.computeConfidence(fused),
      metadata: {
        strategy: 'attention',
        inputModalities: modalities,
        outputDim: this.config.dimensions
      }
    };
  }

  private computeQueries(embeddings: Map<Modality, Float32Array>): Map<Modality, Float32Array> {
    const queries = new Map<Modality, Float32Array>();

    for (const [modality, embedding] of embeddings) {
      const projection = this.queryProjections.get(modality);
      if (projection) {
        queries.set(modality, this.project(embedding, projection));
      }
    }

    return queries;
  }

  private computeKeys(embeddings: Map<Modality, Float32Array>): Map<Modality, Float32Array> {
    const keys = new Map<Modality, Float32Array>();

    for (const [modality, embedding] of embeddings) {
      const projection = this.keyProjections.get(modality);
      if (projection) {
        keys.set(modality, this.project(embedding, projection));
      }
    }

    return keys;
  }

  private computeValues(embeddings: Map<Modality, Float32Array>): Map<Modality, Float32Array> {
    const values = new Map<Modality, Float32Array>();

    for (const [modality, embedding] of embeddings) {
      const projection = this.valueProjections.get(modality);
      if (projection) {
        values.set(modality, this.project(embedding, projection));
      }
    }

    return values;
  }

  private project(embedding: Float32Array, projection: Float32Array): Float32Array {
    const dim = embedding.length;
    const outDim = projection.length / dim;
    const output = new Float32Array(outDim);

    for (let i = 0; i < outDim; i++) {
      let sum = 0;
      for (let j = 0; j < dim; j++) {
        sum += embedding[j] * projection[j * outDim + i];
      }
      output[i] = sum;
    }

    return output;
  }

  private computeCrossModalAttention(
    queries: Map<Modality, Float32Array>,
    keys: Map<Modality, Float32Array>,
    values: Map<Modality, Float32Array>,
    modalities: Modality[]
  ): Map<Modality, Float32Array> {
    const attended = new Map<Modality, Float32Array>();

    for (const queryModality of modalities) {
      const query = queries.get(queryModality)!;
      const attentionOutput = new Float32Array(query.length);

      for (const keyModality of modalities) {
        const key = keys.get(keyModality)!;
        const value = values.get(keyModality)!;

        // Compute attention weights
        const attentionWeights = this.computeAttentionWeights(query, key);

        // Apply attention to value
        const attendedValue = this.applyAttention(value, attentionWeights);

        // Add to output
        for (let i = 0; i < attentionOutput.length; i++) {
          attentionOutput[i] += attendedValue[i];
        }
      }

      // Normalize by number of modalities
      for (let i = 0; i < attentionOutput.length; i++) {
        attentionOutput[i] /= modalities.length;
      }

      attended.set(queryModality, attentionOutput);
    }

    return attended;
  }

  private computeAttentionWeights(query: Float32Array, key: Float32Array): Float32Array {
    const dim = query.length;
    const weights = new Float32Array(dim);

    let sum = 0;
    for (let i = 0; i < dim; i++) {
      weights[i] = query[i] * key[i];
      sum += weights[i];
    }

    // Softmax normalization
    for (let i = 0; i < dim; i++) {
      weights[i] = sum > 0 ? weights[i] / sum : 1 / dim;
    }

    return weights;
  }

  private applyAttention(value: Float32Array, weights: Float32Array): Float32Array {
    const attended = new Float32Array(value.length);

    for (let i = 0; i < value.length; i++) {
      attended[i] = value[i] * weights[i % weights.length];
    }

    return attended;
  }

  private aggregateAttended(attended: Map<Modality, Float32Array>): Float32Array {
    const dim = attended.values().next().value.length;
    const aggregated = new Float32Array(dim);

    for (const value of attended.values()) {
      for (let i = 0; i < dim; i++) {
        aggregated[i] += value[i];
      }
    }

    // Normalize
    const numModalities = attended.size;
    for (let i = 0; i < dim; i++) {
      aggregated[i] /= numModalities;
    }

    return aggregated;
  }

  private computeModalityWeights(embeddings: Map<Modality, Float32Array>): Record<Modality, number> {
    const weights: Record<string, number> = {};
    const weight = 1 / embeddings.size;

    for (const modality of embeddings.keys()) {
      weights[modality] = weight;
    }

    return weights as Record<Modality, number>;
  }

  private computeConfidence(output: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < output.length; i++) {
      sum += output[i] * output[i];
    }
    return Math.sqrt(sum) / output.length;
  }
}

// ============================================================================
// Transformer Fusion
// ============================================================================

export class TransformerFusion {
  private config: FusionConfig;
  private layers: TransformerLayer[];

  constructor(config: FusionConfig) {
    this.config = config;
    this.layers = [];

    const numLayers = config.numLayers || 2;
    for (let i = 0; i < numLayers; i++) {
      this.layers.push(new TransformerLayer(config));
    }
  }

  /**
   * Fuse using transformer layers
   */
  async fuse(embeddings: Map<Modality, Float32Array>): Promise<FusionResult> {
    const modalities = Array.from(embeddings.keys());

    // Stack embeddings as sequence
    const sequence = this.stackSequence(embeddings);

    // Pass through transformer layers
    let hidden = sequence;
    for (const layer of this.layers) {
      hidden = await layer.forward(hidden);
    }

    // Pool to single representation
    const fused = this.poolSequence(hidden, modalities.length);

    return {
      output: fused,
      modalityWeights: this.extractModalityWeights(hidden, modalities),
      confidence: this.computeConfidence(fused),
      metadata: {
        strategy: 'transformer',
        inputModalities: modalities,
        outputDim: this.config.dimensions
      }
    };
  }

  private stackSequence(embeddings: Map<Modality, Float32Array>): Float32Array {
    const vectors = Array.from(embeddings.values());
    const seqLen = vectors.length;
    const dim = vectors[0].length;
    const sequence = new Float32Array(seqLen * dim);

    for (let i = 0; i < seqLen; i++) {
      sequence.set(vectors[i], i * dim);
    }

    return sequence;
  }

  private poolSequence(sequence: Float32Array, numModalities: number): Float32Array {
    const dim = sequence.length / numModalities;
    const pooled = new Float32Array(dim);

    // Average pooling
    for (let i = 0; i < numModalities; i++) {
      for (let j = 0; j < dim; j++) {
        pooled[j] += sequence[i * dim + j];
      }
    }

    for (let j = 0; j < dim; j++) {
      pooled[j] /= numModalities;
    }

    return pooled;
  }

  private extractModalityWeights(sequence: Float32Array, modalities: Modality[]): Record<Modality, number> {
    const weights: Record<string, number> = {};
    const numModalities = modalities.length;
    const dim = sequence.length / numModalities;

    // Compute attention weights (simplified)
    const totalAttention = new Array(numModalities).fill(0);

    for (let i = 0; i < numModalities; i++) {
      let sum = 0;
      for (let j = 0; j < dim; j++) {
        sum += Math.abs(sequence[i * dim + j]);
      }
      totalAttention[i] = sum;
    }

    const total = totalAttention.reduce((a, b) => a + b, 0);

    for (let i = 0; i < numModalities; i++) {
      weights[modalities[i]] = total > 0 ? totalAttention[i] / total : 1 / numModalities;
    }

    return weights as Record<Modality, number>;
  }

  private computeConfidence(output: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < output.length; i++) {
      sum += output[i] * output[i];
    }
    return Math.sqrt(sum) / output.length;
  }
}

class TransformerLayer {
  private config: FusionConfig;
  private attention: SelfAttention;
  private ffn: FeedForward;

  constructor(config: FusionConfig) {
    this.config = config;
    this.attention = new SelfAttention(config);
    this.ffn = new FeedForward(config);
  }

  async forward(x: Float32Array): Promise<Float32Array> {
    // Self-attention
    const attended = await this.attention.forward(x);

    // Add & norm
    const residual1 = this.add(x, attended);
    const norm1 = this.layerNorm(residual1);

    // Feed-forward
    const ffOut = await this.ffn.forward(norm1);

    // Add & norm
    const residual2 = this.add(norm1, ffOut);
    const norm2 = this.layerNorm(residual2);

    return norm2;
  }

  private add(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] + b[i];
    }
    return result;
  }

  private layerNorm(x: Float32Array): Float32Array {
    let mean = 0;
    for (let i = 0; i < x.length; i++) {
      mean += x[i];
    }
    mean /= x.length;

    let variance = 0;
    for (let i = 0; i < x.length; i++) {
      variance += (x[i] - mean) ** 2;
    }
    variance /= x.length;

    const std = Math.sqrt(variance + 1e-6);
    const normalized = new Float32Array(x.length);

    for (let i = 0; i < x.length; i++) {
      normalized[i] = (x[i] - mean) / std;
    }

    return normalized;
  }
}

class SelfAttention {
  private config: FusionConfig;
  private Wq: Float32Array;
  private Wk: Float32Array;
  private Wv: Float32Array;
  private Wo: Float32Array;

  constructor(config: FusionConfig) {
    this.config = config;
    const dim = config.dimensions;
    this.Wq = this.initMatrix(dim, dim);
    this.Wk = this.initMatrix(dim, dim);
    this.Wv = this.initMatrix(dim, dim);
    this.Wo = this.initMatrix(dim, dim);
  }

  private initMatrix(rows: number, cols: number): Float32Array {
    const mat = new Float32Array(rows * cols);
    const std = Math.sqrt(2 / (rows + cols));
    for (let i = 0; i < mat.length; i++) {
      mat[i] = (Math.random() - 0.5) * 2 * std;
    }
    return mat;
  }

  async forward(x: Float32Array): Promise<Float32Array> {
    const dim = this.config.dimensions;

    // Simplified self-attention
    const q = this.matmul(x, this.Wq);
    const k = this.matmul(x, this.Wk);
    const v = this.matmul(x, this.Wv);

    const output = this.matmul(v, this.Wo);

    return output;
  }

  private matmul(x: Float32Array, W: Float32Array): Float32Array {
    const xDim = x.length;
    const outDim = W.length / xDim;
    const output = new Float32Array(outDim);

    for (let i = 0; i < outDim; i++) {
      let sum = 0;
      for (let j = 0; j < xDim; j++) {
        sum += x[j] * W[j * outDim + i];
      }
      output[i] = sum;
    }

    return output;
  }
}

class FeedForward {
  private config: FusionConfig;
  private W1: Float32Array;
  private W2: Float32Array;

  constructor(config: FusionConfig) {
    this.config = config;
    const dim = config.dimensions;
    const hiddenDim = dim * 4;
    this.W1 = this.initMatrix(dim, hiddenDim);
    this.W2 = this.initMatrix(hiddenDim, dim);
  }

  private initMatrix(rows: number, cols: number): Float32Array {
    const mat = new Float32Array(rows * cols);
    const std = Math.sqrt(2 / (rows + cols));
    for (let i = 0; i < mat.length; i++) {
      mat[i] = (Math.random() - 0.5) * 2 * std;
    }
    return mat;
  }

  async forward(x: Float32Array): Promise<Float32Array> {
    const hidden = this.matmul(x, this.W1);
    const activated = this.gelu(hidden);
    const output = this.matmul(activated, this.W2);
    return output;
  }

  private matmul(x: Float32Array, W: Float32Array): Float32Array {
    const xDim = x.length;
    const outDim = W.length / xDim;
    const output = new Float32Array(outDim);

    for (let i = 0; i < outDim; i++) {
      let sum = 0;
      for (let j = 0; j < xDim; j++) {
        sum += x[j] * W[j * outDim + i];
      }
      output[i] = sum;
    }

    return output;
  }

  private gelu(x: Float32Array): Float32Array {
    return x.map(v => 0.5 * v * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (v + 0.044715 * v ** 3))));
  }
}

// ============================================================================
// Gated Fusion
// ============================================================================

export class GatedFusion {
  private config: FusionConfig;
  private gateNetwork: Float32Array;

  constructor(config: FusionConfig, numModalities: number) {
    this.config = config;
    this.gateNetwork = this.initGateNetwork(config.dimensions, numModalities);
  }

  private initGateNetwork(dim: number, numModalities: number): Float32Array {
    const gate = new Float32Array(dim * numModalities);
    const std = Math.sqrt(2 / (dim + numModalities));
    for (let i = 0; i < gate.length; i++) {
      gate[i] = (Math.random() - 0.5) * 2 * std;
    }
    return gate;
  }

  /**
   * Fuse using learned gates
   */
  async fuse(embeddings: Map<Modality, Float32Array>): Promise<FusionResult> {
    const modalities = Array.from(embeddings.keys());
    const vectors = Array.from(embeddings.values());

    // Concatenate embeddings for gate input
    const concatenated = this.concatenate(vectors);

    // Compute gates
    const gates = this.computeGates(concatenated, modalities.length);

    // Apply gates and combine
    const fused = this.applyGates(vectors, gates);

    return {
      output: fused,
      modalityWeights: this.gatesToWeights(gates, modalities),
      confidence: this.computeConfidence(fused),
      metadata: {
        strategy: 'gated',
        inputModalities: modalities,
        outputDim: this.config.dimensions
      }
    };
  }

  private concatenate(vectors: Float32Array[]): Float32Array {
    const totalDim = vectors.reduce((sum, v) => sum + v.length, 0);
    const concatenated = new Float32Array(totalDim);

    let offset = 0;
    for (const vector of vectors) {
      concatenated.set(vector, offset);
      offset += vector.length;
    }

    return concatenated;
  }

  private computeGates(concatenated: Float32Array, numModalities: number): Float32Array {
    const gates = new Float32Array(numModalities);

    // Simplified gate computation
    const dim = concatenated.length / numModalities;

    for (let i = 0; i < numModalities; i++) {
      let sum = 0;
      for (let j = 0; j < dim; j++) {
        sum += concatenated[i * dim + j] * this.gateNetwork[i * dim + j];
      }
      gates[i] = Math.sigmoid(sum);
    }

    // Normalize gates
    const gateSum = gates.reduce((a, b) => a + b, 0);
    for (let i = 0; i < numModalities; i++) {
      gates[i] = gateSum > 0 ? gates[i] / gateSum : 1 / numModalities;
    }

    return gates;
  }

  private applyGates(vectors: Float32Array[], gates: Float32Array): Float32Array {
    const dim = vectors[0].length;
    const fused = new Float32Array(dim);

    for (let i = 0; i < vectors.length; i++) {
      for (let j = 0; j < dim; j++) {
        fused[j] += gates[i] * vectors[i][j];
      }
    }

    return fused;
  }

  private gatesToWeights(gates: Float32Array, modalities: Modality[]): Record<Modality, number> {
    const weights: Record<string, number> = {};

    for (let i = 0; i < modalities.length; i++) {
      weights[modalities[i]] = gates[i];
    }

    return weights as Record<Modality, number>;
  }

  private computeConfidence(output: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < output.length; i++) {
      sum += output[i] * output[i];
    }
    return Math.sqrt(sum) / output.length;
  }
}
