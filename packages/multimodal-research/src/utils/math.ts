/**
 * Mathematical utilities for multimodal processing
 */

export class MathUtils {
  /**
   * L2 normalize a vector
   */
  static normalize(vector: Float32Array): Float32Array {
    let sum = 0;
    for (let i = 0; i < vector.length; i++) {
      sum += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sum);

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = norm > 0 ? vector[i] / norm : 0;
    }
    return normalized;
  }

  /**
   * Compute cosine similarity
   */
  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
  }

  /**
   * Compute Euclidean distance
   */
  static euclideanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Compute Manhattan distance
   */
  static manhattanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.abs(a[i] - b[i]);
    }
    return sum;
  }

  /**
   * Dot product
   */
  static dot(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Matrix multiplication
   */
  static matmul(A: Float32Array, B: Float32Array, shapeA: [number, number], shapeB: [number, number]): Float32Array {
    const [m, k1] = shapeA;
    const [k2, n] = shapeB;

    if (k1 !== k2) {
      throw new Error('Incompatible matrix shapes');
    }

    const C = new Float32Array(m * n);

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < k1; k++) {
          sum += A[i * k1 + k] * B[k * n + j];
        }
        C[i * n + j] = sum;
      }
    }

    return C;
  }

  /**
   * Softmax
   */
  static softmax(logits: Float32Array): Float32Array {
    const max = Math.max(...logits);
    const exp = logits.map(l => Math.exp(l - max));
    const sum = exp.reduce((a, b) => a + b, 0);

    return new Float32Array(exp.map(e => e / sum));
  }

  /**
   * Sigmoid
   */
  static sigmoid(x: Float32Array): Float32Array {
    return new Float32Array(x.map(v => 1 / (1 + Math.exp(-v))));
  }

  /**
   * ReLU activation
   */
  static relu(x: Float32Array): Float32Array {
    return new Float32Array(x.map(v => Math.max(0, v)));
  }

  /**
   * GELU activation
   */
  static gelu(x: Float32Array): Float32Array {
    return new Float32Array(x.map(v => 0.5 * v * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (v + 0.044715 * v ** 3)))));
  }

  /**
   * Linear interpolation
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Clamp value to range
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Generate random vector
   */
  static randomVector(dim: number, scale: number = 1): Float32Array {
    const vector = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      vector[i] = (Math.random() - 0.5) * 2 * scale;
    }
    return vector;
  }

  /**
   * Generate random matrix
   */
  static randomMatrix(rows: number, cols: number, scale: number = 1): Float32Array {
    const matrix = new Float32Array(rows * cols);
    const std = Math.sqrt(2 / (rows + cols)) * scale;

    for (let i = 0; i < matrix.length; i++) {
      matrix[i] = (Math.random() - 0.5) * 2 * std;
    }

    return matrix;
  }

  /**
   * Xavier initialization
   */
  static xavierInit(inDim: number, outDim: number): Float32Array {
    const std = Math.sqrt(2 / (inDim + outDim));
    return this.randomMatrix(inDim, outDim, std);
  }

  /**
   * He initialization
   */
  static heInit(inDim: number, outDim: number): Float32Array {
    const std = Math.sqrt(2 / inDim);
    return this.randomMatrix(inDim, outDim, std);
  }

  /**
   * Compute mean
   */
  static mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Compute standard deviation
   */
  static std(values: number[]): number {
    const mean = this.mean(values);
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Compute median
   */
  static median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Compute percentile
   */
  static percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Apply moving average
   */
  static movingAverage(values: number[], window: number): number[] {
    const smoothed: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1);
      const windowValues = values.slice(start, i + 1);
      smoothed.push(this.mean(windowValues));
    }

    return smoothed;
  }

  /**
   * Compute exponential moving average
   */
  static exponentialMovingAverage(values: number[], alpha: number): number[] {
    const smoothed: number[] = [values[0]];

    for (let i = 1; i < values.length; i++) {
      smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
    }

    return smoothed;
  }
}
