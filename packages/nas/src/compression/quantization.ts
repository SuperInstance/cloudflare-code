/**
 * Model Quantization
 * Post-training and quantization-aware training for neural networks
 */

import {
  Architecture,
  QuantizationConfig,
  QuantizationMode,
  QuantizationPrecision,
  QuantizationMethod,
  QuantizationResult,
  Layer,
} from '../types';

// ============================================================================
// Quantizer Base Class
// ============================================================================

export abstract class Quantizer {
  protected config: QuantizationConfig;
  protected originalArchitecture: Architecture;

  constructor(config: QuantizationConfig, architecture: Architecture) {
    this.config = config;
    this.originalArchitecture = architecture;
  }

  /**
   * Quantize the architecture
   */
  public abstract quantize(): Promise<QuantizationResult>;

  /**
   * Dequantize values
   */
  protected dequantize(
    quantized: number[],
    scale: number,
    zeroPoint: number
  ): number[] {
    return quantized.map(q => scale * (q - zeroPoint));
  }

  /**
   * Quantize values
   */
  protected quantize(
    values: number[],
    bits: number,
    symmetric: boolean = false
  ): { quantized: number[]; scale: number; zeroPoint: number } {
    const min = Math.min(...values);
    const max = Math.max(...values);

    const qmin = symmetric ? -(2 ** (bits - 1)) : 0;
    const qmax = symmetric ? 2 ** (bits - 1) - 1 : 2 ** bits - 1;

    const scale = (max - min) / (qmax - qmin);
    const zeroPoint = symmetric ? 0 : Math.round(-min / scale);

    const quantized = values.map(v => {
      const q = Math.round(v / scale) + zeroPoint;
      return Math.max(qmin, Math.min(qmax, q));
    });

    return { quantized, scale, zeroPoint };
  }

  /**
   * Calculate quantization error
   */
  protected calculateQuantizationError(
    original: number[],
    quantized: number[]
  ): number {
    const mse = original.reduce(
      (sum, orig, i) => sum + Math.pow(orig - quantized[i], 2),
      0
    );
    return Math.sqrt(mse / original.length);
  }
}

// ============================================================================
// Post-Training Quantization
// ============================================================================

export class PostTrainingQuantizer extends Quantizer {
  async quantize(): Promise<QuantizationResult> {
    const architecture = JSON.parse(JSON.stringify(this.originalArchitecture));
    const calibrationData = await this.loadCalibrationData();

    // Calibrate and quantize each layer
    for (const layer of architecture.phenotype.layers) {
      await this.calibrateAndQuantizeLayer(layer, calibrationData);
    }

    const metrics = await this.evaluateMetrics(architecture);

    return {
      originalArchitecture: this.originalArchitecture,
      quantizedArchitecture: architecture,
      precision: this.config.precision,
      metrics,
      compressionRatio: this.calculateCompressionRatio(),
      speedup: this.estimateSpeedup(),
    };
  }

  private async loadCalibrationData(): Promise<any> {
    // Load calibration dataset
    return {
      samples: 100,
      data: [], // Placeholder
    };
  }

  private async calibrateAndQuantizeLayer(layer: Layer, calibrationData: any): Promise<void> {
    if (!layer.parameters.weights) {
      return;
    }

    const weights = layer.parameters.weights as number[];
    const bits = this.config.precision.weights;

    let quantizedWeights: number[];
    let scale: number;
    let zeroPoint: number;

    switch (this.config.method) {
      case 'min-max':
        ({ quantized: quantizedWeights, scale, zeroPoint } = this.quantizeMinMax(weights, bits));
        break;

      case 'kl-divergence':
        ({ quantized: quantizedWeights, scale, zeroPoint } = this.quantizeKLDivergence(weights, bits));
        break;

      case 'percentile':
        ({ quantized: quantizedWeights, scale, zeroPoint } = this.quantizePercentile(weights, bits));
        break;

      case 'entropy':
        ({ quantized: quantizedWeights, scale, zeroPoint } = this.quantizeEntropy(weights, bits));
        break;

      default:
        ({ quantized: quantizedWeights, scale, zeroPoint } = this.quantizeMinMax(weights, bits));
    }

    layer.parameters.weights = quantizedWeights;
    layer.parameters.scale = scale;
    layer.parameters.zeroPoint = zeroPoint;
    layer.parameters.quantized = true;
  }

  private quantizeMinMax(weights: number[], bits: number): any {
    return this.quantize(weights, bits, false);
  }

  private quantizeKLDivergence(weights: number[], bits: number): any {
    // Find optimal quantization range using KL divergence
    const histogram = this.buildHistogram(weights, 512);
    const { min, max } = this.findOptimalRange(histogram, bits);

    // Clip weights to optimal range
    const clippedWeights = weights.map(w => Math.max(min, Math.min(max, w)));

    return this.quantize(clippedWeights, bits, false);
  }

  private buildHistogram(weights: number[], bins: number): number[] {
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const binWidth = (max - min) / bins;

    const histogram = new Array(bins).fill(0);

    for (const weight of weights) {
      const bin = Math.min(Math.floor((weight - min) / binWidth), bins - 1);
      histogram[bin]++;
    }

    return histogram;
  }

  private findOptimalRange(histogram: number[], bits: number): { min: number; max: number } {
    // Simplified KL divergence optimization
    // In practice, would search for optimal range that minimizes KL divergence

    const bins = histogram.length;
    const total = histogram.reduce((sum, count) => sum + count, 0);

    let bestRange = { start: 0, end: bins };
    let bestKL = Infinity;

    // Search for optimal range
    for (let start = 0; start < bins - 10; start++) {
      for (let end = start + 10; end < bins; end++) {
        const kl = this.calculateKLDivergence(histogram, start, end, total);

        if (kl < bestKL) {
          bestKL = kl;
          bestRange = { start, end };
        }
      }
    }

    return { min: bestRange.start, max: bestRange.end };
  }

  private calculateKLDivergence(
    histogram: number[],
    start: number,
    end: number,
    total: number
  ): number {
    // Calculate KL divergence between original and quantized distribution
    let kl = 0;

    for (let i = start; i < end; i++) {
      const p = histogram[i] / total;
      const q = 1 / (end - start);

      if (p > 0) {
        kl += p * Math.log(p / q);
      }
    }

    return kl;
  }

  private quantizePercentile(weights: number[], bits: number): any {
    // Use percentile-based range to handle outliers
    const sorted = [...weights].sort((a, b) => a - b);
    const lowerPercentile = 1;
    const upperPercentile = 99;

    const min = sorted[Math.floor((lowerPercentile / 100) * sorted.length)];
    const max = sorted[Math.floor((upperPercentile / 100) * sorted.length)];

    const clippedWeights = weights.map(w => Math.max(min, Math.min(max, w)));

    return this.quantize(clippedWeights, bits, false);
  }

  private quantizeEntropy(weights: number[], bits: number): any {
    // Minimize entropy of quantization error
    const histogram = this.buildHistogram(weights, 512);

    // Find range that minimizes entropy of quantization error
    const { min, max } = this.findMinEntropyRange(histogram, bits);

    const clippedWeights = weights.map(w => Math.max(min, Math.min(max, w)));

    return this.quantize(clippedWeights, bits, false);
  }

  private findMinEntropyRange(histogram: number[], bits: number): { min: number; max: number } {
    // Find range that minimizes entropy
    // Simplified - in practice would do full search

    const bins = histogram.length;

    return { min: bins * 0.1, max: bins * 0.9 };
  }

  private async evaluateMetrics(architecture: Architecture): Promise<any> {
    const bitReduction = 32 / this.config.precision.weights;

    return {
      flops: this.originalArchitecture.metrics.flops,
      parameters: this.originalArchitecture.metrics.parameters / bitReduction,
      memory: this.originalArchitecture.metrics.memory / bitReduction,
      latency: this.originalArchitecture.metrics.latency,
      energy: this.originalArchitecture.metrics.energy,
    };
  }

  private calculateCompressionRatio(): number {
    return 32 / this.config.precision.weights;
  }

  private estimateSpeedup(): number {
    // Speedup depends on hardware support for low-bit computation
    return this.config.precision.weights < 8 ? 2.0 : 1.2;
  }
}

// ============================================================================
// Quantization-Aware Training
// ============================================================================

export class QuantizationAwareTrainingQuantizer extends Quantizer {
  private epochs: number = 0;

  async quantize(): Promise<QuantizationResult> {
    const architecture = JSON.parse(JSON.stringify(this.originalArchitecture));

    // Initialize fake quantization nodes
    this.initializeFakeQuantization(architecture);

    // Train with fake quantization
    await this.trainWithFakeQuantization(architecture);

    // Actual quantization after training
    for (const layer of architecture.phenotype.layers) {
      await this.quantizeLayer(layer);
    }

    const metrics = await this.evaluateMetrics(architecture);

    return {
      originalArchitecture: this.originalArchitecture,
      quantizedArchitecture: architecture,
      precision: this.config.precision,
      metrics,
      compressionRatio: this.calculateCompressionRatio(),
      speedup: this.estimateSpeedup(),
    };
  }

  private initializeFakeQuantization(architecture: Architecture): void {
    for (const layer of architecture.phenotype.layers) {
      if (layer.parameters.weights) {
        layer.parameters.fakeQuantized = true;
        layer.parameters.quantizationRange = this.initializeRange(layer);
      }
    }
  }

  private initializeRange(layer: Layer): { min: number; max: number } {
    if (!layer.parameters.weights) {
      return { min: -3, max: 3 };
    }

    const weights = layer.parameters.weights as number[];
    const std = Math.sqrt(
      weights.reduce((sum, w) => sum + w * w, 0) / weights.length
    );

    return {
      min: -3 * std,
      max: 3 * std,
    };
  }

  private async trainWithFakeQuantization(architecture: Architecture): Promise<void> {
    const epochs = this.config.awareTraining.epochs;
    const learningRate = this.config.awareTraining.learningRate;

    console.log(`Training with fake quantization for ${epochs} epochs...`);

    for (let epoch = 0; epoch < epochs; epoch++) {
      await this.trainingEpoch(architecture, learningRate);

      if (epoch % 10 === 0) {
        console.log(`Epoch ${epoch}/${epochs}`);
      }
    }
  }

  private async trainingEpoch(architecture: Architecture, learningRate: number): Promise<void> {
    // Perform training step with fake quantization
    // This is a placeholder - actual implementation would:
    // 1. Forward pass with fake quantized weights
    // 2. Compute loss
    // 3. Backward pass
    // 4. Update weights

    for (const layer of architecture.phenotype.layers) {
      if (layer.parameters.weights && layer.parameters.fakeQuantized) {
        // Fake quantize during forward pass
        const weights = layer.parameters.weights as number[];
        const range = layer.parameters.quantizationRange;

        const fakeQuantized = this.fakeQuantize(
          weights,
          range.min,
          range.max,
          this.config.precision.weights
        );

        // In practice, would compute gradients and update weights
        layer.parameters.weights = fakeQuantized;
      }
    }
  }

  private fakeQuantize(
    weights: number[],
    min: number,
    max: number,
    bits: number
  ): number[] {
    const qmin = 0;
    const qmax = 2 ** bits - 1;
    const scale = (max - min) / (qmax - qmin);
    const zeroPoint = Math.round(-min / scale);

    return weights.map(w => {
      const q = Math.round(w / scale) + zeroPoint;
      const clampedQ = Math.max(qmin, Math.min(qmax, q));
      // Dequantize
      return scale * (clampedQ - zeroPoint);
    });
  }

  private async quantizeLayer(layer: Layer): Promise<void> {
    if (!layer.parameters.weights) {
      return;
    }

    const weights = layer.parameters.weights as number[];
    const range = layer.parameters.quantizationRange;

    // Clip weights to learned range
    const clippedWeights = weights.map(w =>
      Math.max(range.min, Math.min(range.max, w))
    );

    // Quantize
    const { quantized, scale, zeroPoint } = this.quantize(
      clippedWeights,
      this.config.precision.weights
    );

    layer.parameters.weights = quantized;
    layer.parameters.scale = scale;
    layer.parameters.zeroPoint = zeroPoint;
    layer.parameters.quantized = true;
  }

  private async evaluateMetrics(architecture: Architecture): Promise<any> {
    const bitReduction = 32 / this.config.precision.weights;

    return {
      flops: this.originalArchitecture.metrics.flops,
      parameters: this.originalArchitecture.metrics.parameters / bitReduction,
      memory: this.originalArchitecture.metrics.memory / bitReduction,
      latency: this.originalArchitecture.metrics.latency,
      energy: this.originalArchitecture.metrics.energy,
    };
  }

  private calculateCompressionRatio(): number {
    return 32 / this.config.precision.weights;
  }

  private estimateSpeedup(): number {
    return this.config.precision.weights < 8 ? 2.0 : 1.2;
  }
}

// ============================================================================
// Dynamic Quantization
// ============================================================================

export class DynamicQuantizer extends Quantizer {
  async quantize(): Promise<QuantizationResult> {
    const architecture = JSON.parse(JSON.stringify(this.originalArchitecture));

    // Dynamically quantize weights at runtime
    for (const layer of architecture.phenotype.layers) {
      if (layer.parameters.weights) {
        this.setupDynamicQuantization(layer);
      }
    }

    const metrics = await this.evaluateMetrics(architecture);

    return {
      originalArchitecture: this.originalArchitecture,
      quantizedArchitecture: architecture,
      precision: this.config.precision,
      metrics,
      compressionRatio: this.calculateCompressionRatio(),
      speedup: this.estimateSpeedup(),
    };
  }

  private setupDynamicQuantization(layer: Layer): void {
    const weights = layer.parameters.weights as number[];

    // Calculate per-channel scales
    const scales = this.calculatePerChannelScales(weights);
    const zeroPoints = scales.map(() => 0);

    layer.parameters.scales = scales;
    layer.parameters.zeroPoints = zeroPoints;
    layer.parameters.dynamicQuantization = true;
  }

  private calculatePerChannelScales(weights: number[]): number[] {
    // Simplified - assume one channel
    const max = Math.max(...weights.map(Math.abs));
    return [max / 127];
  }

  private async evaluateMetrics(architecture: Architecture): Promise<any> {
    const bitReduction = 32 / this.config.precision.weights;

    return {
      flops: this.originalArchitecture.metrics.flops,
      parameters: this.originalArchitecture.metrics.parameters / bitReduction,
      memory: this.originalArchitecture.metrics.memory / bitReduction,
      latency: this.originalArchitecture.metrics.latency * 0.8,
      energy: this.originalArchitecture.metrics.energy * 0.8,
    };
  }

  private calculateCompressionRatio(): number {
    return 32 / this.config.precision.weights;
  }

  private estimateSpeedup(): number {
    return 1.5;
  }
}

// ============================================================================
// Mixed Precision Quantization
// ============================================================================

export class MixedPrecisionQuantizer extends Quantizer {
  private layerPrecisions: Map<string, number> = new Map();

  async quantize(): Promise<QuantizationResult> {
    const architecture = JSON.parse(JSON.stringify(this.originalArchitecture));

    // Determine optimal precision for each layer
    this.determineLayerPrecisions(architecture);

    // Quantize each layer with its precision
    for (const layer of architecture.phenotype.layers) {
      const precision = this.layerPrecisions.get(layer.id) || 8;
      await this.quantizeLayerWithPrecision(layer, precision);
    }

    const metrics = await this.evaluateMetrics(architecture);

    return {
      originalArchitecture: this.originalArchitecture,
      quantizedArchitecture: architecture,
      precision: this.config.precision,
      metrics,
      compressionRatio: this.calculateCompressionRatio(),
      speedup: this.estimateSpeedup(),
    };
  }

  private determineLayerPrecisions(architecture: Architecture): void {
    // Analyze each layer to determine optimal precision
    for (const layer of architecture.phenotype.layers) {
      const sensitivity = this.analyzeLayerSensitivity(layer);

      // More sensitive layers get higher precision
      if (sensitivity > 0.5) {
        this.layerPrecisions.set(layer.id, 8);
      } else if (sensitivity > 0.2) {
        this.layerPrecisions.set(layer.id, 4);
      } else {
        this.layerPrecisions.set(layer.id, 2);
      }
    }
  }

  private analyzeLayerSensitivity(layer: Layer): number {
    // Analyze layer sensitivity to quantization
    // This is a simplified heuristic

    if (!layer.parameters.weights) {
      return 0.5;
    }

    const weights = layer.parameters.weights as number[];
    const variance = weights.reduce((sum, w) => sum + w * w, 0) / weights.length;

    // Higher variance -> higher sensitivity
    return Math.min(variance / 10, 1);
  }

  private async quantizeLayerWithPrecision(layer: Layer, bits: number): Promise<void> {
    if (!layer.parameters.weights) {
      return;
    }

    const weights = layer.parameters.weights as number[];
    const { quantized, scale, zeroPoint } = this.quantize(weights, bits);

    layer.parameters.weights = quantized;
    layer.parameters.scale = scale;
    layer.parameters.zeroPoint = zeroPoint;
    layer.parameters.precision = bits;
    layer.parameters.quantized = true;
  }

  private async evaluateMetrics(architecture: Architecture): Promise<any> {
    // Calculate average bit width
    const precisions = Array.from(this.layerPrecisions.values());
    const avgBits = precisions.reduce((sum, p) => sum + p, 0) / precisions.length;
    const bitReduction = 32 / avgBits;

    return {
      flops: this.originalArchitecture.metrics.flops,
      parameters: this.originalArchitecture.metrics.parameters / bitReduction,
      memory: this.originalArchitecture.metrics.memory / bitReduction,
      latency: this.originalArchitecture.metrics.latency * (32 / avgBits) * 0.7,
      energy: this.originalArchitecture.metrics.energy * (32 / avgBits) * 0.7,
    };
  }

  private calculateCompressionRatio(): number {
    const precisions = Array.from(this.layerPrecisions.values());
    const avgBits = precisions.reduce((sum, p) => sum + p, 0) / precisions.length;
    return 32 / avgBits;
  }

  private estimateSpeedup(): number {
    const precisions = Array.from(this.layerPrecisions.values());
    const avgBits = precisions.reduce((sum, p) => sum + p, 0) / precisions.length;
    return avgBits < 8 ? 2.0 : 1.2;
  }
}

// ============================================================================
// Quantization Factory
// ============================================================================

export class QuantizerFactory {
  static create(
    mode: QuantizationMode,
    config: QuantizationConfig,
    architecture: Architecture
  ): Quantizer {
    switch (mode) {
      case 'post-training':
        return new PostTrainingQuantizer(config, architecture);

      case 'quantization-aware':
        return new QuantizationAwareTrainingQuantizer(config, architecture);

      case 'dynamic':
        return new DynamicQuantizer(config, architecture);

      default:
        return new PostTrainingQuantizer(config, architecture);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createQuantizationConfig(
  overrides: Partial<QuantizationConfig> = {}
): QuantizationConfig {
  return {
    mode: 'post-training',
    precision: {
      weights: 8,
      activations: 8,
      gradients: 32,
      mixed: false,
    },
    method: 'min-max',
    calibration: {
      dataset: 'imagenet',
      samples: 100,
      batchSize: 32,
      method: 'min-max',
    },
    awareTraining: {
      epochs: 30,
      learningRate: 0.001,
      fakeQuant: true,
      straightThrough: true,
    },
    ...overrides,
  };
}
