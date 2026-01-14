/**
 * Cross-Modal Embedding Alignment
 * Techniques for aligning embeddings from different modalities
 */

import type { CrossModalEmbedding, Modality } from '../types';

export interface AlignmentConfig {
  method: 'procrustes' | 'cca' | 'linear' | 'neural';
  dimension: number;
  regularization: number;
  maxIterations: number;
  convergenceThreshold: number;
}

export class EmbeddingAlignment {
  private config: AlignmentConfig;
  private alignmentMatrix: Float32Array;
  private biases: Map<Modality, Float32Array>;

  constructor(config: AlignmentConfig) {
    this.config = config;
    this.alignmentMatrix = new Float32Array(config.dimension * config.dimension);
    this.biases = new Map();
  }

  /**
   * Align embeddings from different modalities
   */
  async align(
    sourceEmbeddings: Float32Array[],
    targetEmbeddings: Float32Array[],
    sourceModality: Modality,
    targetModality: Modality
  ): Promise<Float32Array> {
    switch (this.config.method) {
      case 'procrustes':
        return this.procrustesAlignment(sourceEmbeddings, targetEmbeddings);
      case 'cca':
        return this.ccaAlignment(sourceEmbeddings, targetEmbeddings);
      case 'linear':
        return this.linearAlignment(sourceEmbeddings, targetEmbeddings);
      case 'neural':
        return this.neuralAlignment(sourceEmbeddings, targetEmbeddings);
      default:
        return this.linearAlignment(sourceEmbeddings, targetEmbeddings);
    }
  }

  /**
   * Procrustes alignment
   */
  private procrustesAlignment(
    source: Float32Array[],
    target: Float32Array[]
  ): Float32Array {
    const dim = source[0].length;
    const numSamples = Math.min(source.length, target.length);

    // Center the data
    const sourceMean = this.computeMean(source.slice(0, numSamples));
    const targetMean = this.computeMean(target.slice(0, numSamples));

    const sourceCentered = this.centerData(source.slice(0, numSamples), sourceMean);
    const targetCentered = this.centerData(target.slice(0, numSamples), targetMean);

    // Compute optimal rotation using SVD
    const crossCovariance = this.computeCrossCovariance(sourceCentered, targetCentered);
    const { u, v } = this.svd(crossCovariance, dim);

    // Compute rotation matrix
    const rotation = this.multiplyMatrices(u, v, dim);

    this.alignmentMatrix = rotation;

    return rotation;
  }

  /**
   * Canonical Correlation Analysis (CCA) alignment
   */
  private ccaAlignment(
    source: Float32Array[],
    target: Float32Array[]
  ): Float32Array {
    const dim = source[0].length;
    const numSamples = Math.min(source.length, target.length);

    // Center the data
    const sourceMean = this.computeMean(source.slice(0, numSamples));
    const targetMean = this.computeMean(target.slice(0, numSamples));

    const sourceCentered = this.centerData(source.slice(0, numSamples), sourceMean);
    const targetCentered = this.centerData(target.slice(0, numSamples), targetMean);

    // Compute covariance matrices
    const sourceCov = this.computeCovariance(sourceCentered);
    const targetCov = this.computeCovariance(targetCentered);
    const crossCov = this.computeCrossCovariance(sourceCentered, targetCentered);

    // Solve CCA using generalized eigenvalue problem
    const { sourceProjection, targetProjection } = this.solveCCA(
      sourceCov,
      targetCov,
      crossCov,
      dim
    );

    // Store alignment matrix
    this.alignmentMatrix = this.multiplyMatrices(sourceProjection, targetProjection, dim);

    return this.alignmentMatrix;
  }

  /**
   * Linear alignment
   */
  private linearAlignment(
    source: Float32Array[],
    target: Float32Array[]
  ): Float32Array {
    const dim = source[0].length;
    const numSamples = Math.min(source.length, target.length);

    // Solve linear regression: target = source * W + b
    const X = this.stackMatrix(source.slice(0, numSamples));
    const Y = this.stackMatrix(target.slice(0, numSamples));

    // Regularized least squares
    const lambda = this.config.regularization;
    const XtX = this.multiplyMatricesTranspose(X, X, dim, numSamples);
    const identity = this.identity(dim);

    for (let i = 0; i < dim * dim; i++) {
      XtX[i] += lambda * identity[i];
    }

    const XtY = this.multiplyMatricesTranspose(X, Y, dim, numSamples);
    const W = this.solveLinearSystem(XtX, XtY, dim);

    this.alignmentMatrix = W;

    return W;
  }

  /**
   * Neural alignment
   */
  private neuralAlignment(
    source: Float32Array[],
    target: Float32Array[]
  ): Float32Array {
    const dim = source[0].length;
    const numSamples = Math.min(source.length, target.length);

    // Initialize neural network parameters
    const W1 = this.randomMatrix(dim, dim);
    const b1 = new Float32Array(dim).fill(0);
    const W2 = this.randomMatrix(dim, dim);
    const b2 = new Float32Array(dim).fill(0);

    let prevLoss = Infinity;

    // Gradient descent optimization
    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      let totalLoss = 0;
      const gradW1 = new Float32Array(W1.length).fill(0);
      const gradW2 = new Float32Array(W2.length).fill(0);

      // Forward pass and compute gradients
      for (let i = 0; i < numSamples; i++) {
        const hidden = this.forwardLayer(source[i], W1, b1);
        const output = this.forwardLayer(hidden, W2, b2);

        const loss = this.mseLoss(output, target[i]);
        totalLoss += loss;

        // Backward pass (simplified)
        const gradOutput = this.mseGradient(output, target[i]);
        const gradHidden = this.backwardLayer(gradOutput, W2);

        this.accumulateGradients(gradW1, source[i], gradHidden);
        this.accumulateGradients(gradW2, hidden, gradOutput);
      }

      // Update parameters
      const learningRate = 0.01;
      this.updateParameters(W1, gradW1, learningRate, numSamples);
      this.updateParameters(W2, gradW2, learningRate, numSamples);

      // Check convergence
      const avgLoss = totalLoss / numSamples;
      if (Math.abs(avgLoss - prevLoss) < this.config.convergenceThreshold) {
        break;
      }
      prevLoss = avgLoss;
    }

    // Store final transformation
    this.alignmentMatrix = this.multiplyMatrices(W1, W2, dim);

    return this.alignmentMatrix;
  }

  /**
   * Apply learned alignment to new embedding
   */
  applyAlignment(embedding: Float32Array, modality: Modality): Float32Array {
    const aligned = this.matvec(embedding, this.alignmentMatrix, embedding.length);

    // Add bias if available
    const bias = this.biases.get(modality);
    if (bias) {
      for (let i = 0; i < aligned.length; i++) {
        aligned[i] += bias[i];
      }
    }

    return aligned;
  }

  /**
   * Compute mean of embeddings
   */
  private computeMean(embeddings: Float32Array[]): Float32Array {
    const dim = embeddings[0].length;
    const mean = new Float32Array(dim);

    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        mean[i] += emb[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      mean[i] /= embeddings.length;
    }

    return mean;
  }

  /**
   * Center embeddings
   */
  private centerData(embeddings: Float32Array[], mean: Float32Array): Float32Array[] {
    return embeddings.map(emb => {
      const centered = new Float32Array(emb);
      for (let i = 0; i < centered.length; i++) {
        centered[i] -= mean[i];
      }
      return centered;
    });
  }

  /**
   * Compute cross-covariance matrix
   */
  private computeCrossCovariance(X: Float32Array[], Y: Float32Array[]): Float32Array {
    const dim = X[0].length;
    const crossCov = new Float32Array(dim * dim);

    for (let i = 0; i < X.length; i++) {
      for (let j = 0; j < dim; j++) {
        for (let k = 0; k < dim; k++) {
          crossCov[j * dim + k] += X[i][j] * Y[i][k];
        }
      }
    }

    for (let i = 0; i < crossCov.length; i++) {
      crossCov[i] /= X.length;
    }

    return crossCov;
  }

  /**
   * Compute covariance matrix
   */
  private computeCovariance(embeddings: Float32Array[]): Float32Array {
    const dim = embeddings[0].length;
    const cov = new Float32Array(dim * dim);

    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
          cov[i * dim + j] += emb[i] * emb[j];
        }
      }
    }

    for (let i = 0; i < cov.length; i++) {
      cov[i] /= embeddings.length;
    }

    return cov;
  }

  /**
   * Compute SVD (simplified)
   */
  private svd(matrix: Float32Array, dim: number): { u: Float32Array; v: Float32Array } {
    // Simplified SVD - in practice use LAPACK/BLAS
    const u = this.randomMatrix(dim, dim);
    const v = this.randomMatrix(dim, dim);

    // Power iteration for dominant singular vectors
    for (let iter = 0; iter < 10; iter++) {
      // Simplified iterations
    }

    return { u, v };
  }

  /**
   * Solve CCA
   */
  private solveCCA(
    sourceCov: Float32Array,
    targetCov: Float32Array,
    crossCov: Float32Array,
    dim: number
  ): { sourceProjection: Float32Array; targetProjection: Float32Array } {
    // Simplified CCA solution
    const sourceProjection = this.identity(dim);
    const targetProjection = this.identity(dim);

    return { sourceProjection, targetProjection };
  }

  /**
   * Stack embeddings into matrix
   */
  private stackMatrix(embeddings: Float32Array[]): Float32Array {
    const dim = embeddings[0].length;
    const numSamples = embeddings.length;
    const matrix = new Float32Array(dim * numSamples);

    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j < dim; j++) {
        matrix[j * numSamples + i] = embeddings[i][j];
      }
    }

    return matrix;
  }

  /**
   * Matrix multiplication
   */
  private multiplyMatrices(A: Float32Array, B: Float32Array, dim: number): Float32Array {
    const C = new Float32Array(dim * dim);

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        let sum = 0;
        for (let k = 0; k < dim; k++) {
          sum += A[i * dim + k] * B[k * dim + j];
        }
        C[i * dim + j] = sum;
      }
    }

    return C;
  }

  /**
   * Matrix multiplication with transpose
   */
  private multiplyMatricesTranspose(
    A: Float32Array,
    B: Float32Array,
    dim: number,
    numSamples: number
  ): Float32Array {
    const C = new Float32Array(dim * dim);

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        let sum = 0;
        for (let k = 0; k < numSamples; k++) {
          sum += A[i * numSamples + k] * B[j * numSamples + k];
        }
        C[i * dim + j] = sum;
      }
    }

    return C;
  }

  /**
   * Matrix-vector multiplication
   */
  private matvec(vec: Float32Array, mat: Float32Array, dim: number): Float32Array {
    const result = new Float32Array(dim);

    for (let i = 0; i < dim; i++) {
      let sum = 0;
      for (let j = 0; j < dim; j++) {
        sum += vec[j] * mat[j * dim + i];
      }
      result[i] = sum;
    }

    return result;
  }

  /**
   * Identity matrix
   */
  private identity(dim: number): Float32Array {
    const mat = new Float32Array(dim * dim);
    for (let i = 0; i < dim; i++) {
      mat[i * dim + i] = 1;
    }
    return mat;
  }

  /**
   * Random matrix
   */
  private randomMatrix(rows: number, cols: number): Float32Array {
    const mat = new Float32Array(rows * cols);
    const std = Math.sqrt(2 / (rows + cols));
    for (let i = 0; i < mat.length; i++) {
      mat[i] = (Math.random() - 0.5) * 2 * std;
    }
    return mat;
  }

  /**
   * Solve linear system
   */
  private solveLinearSystem(A: Float32Array, b: Float32Array, dim: number): Float32Array {
    // Simplified - use LU decomposition in practice
    const x = new Float32Array(dim);

    for (let i = 0; i < dim; i++) {
      x[i] = b[i] / (A[i * dim + i] + 1e-8);
    }

    return x;
  }

  /**
   * Forward layer
   */
  private forwardLayer(input: Float32Array, W: Float32Array, b: Float32Array): Float32Array {
    const output = this.matvec(input, W, input.length);
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.max(0, output[i] + b[i]); // ReLU
    }
    return output;
  }

  /**
   * MSE loss
   */
  private mseLoss(pred: Float32Array, target: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < pred.length; i++) {
      const diff = pred[i] - target[i];
      sum += diff * diff;
    }
    return sum / pred.length;
  }

  /**
   * MSE gradient
   */
  private mseGradient(pred: Float32Array, target: Float32Array): Float32Array {
    const grad = new Float32Array(pred.length);
    for (let i = 0; i < pred.length; i++) {
      grad[i] = 2 * (pred[i] - target[i]) / pred.length;
    }
    return grad;
  }

  /**
   * Backward layer
   */
  private backwardLayer(grad: Float32Array, W: Float32Array): Float32Array {
    return this.matvec(grad, W, grad.length);
  }

  /**
   * Accumulate gradients
   */
  private accumulateGradients(
    gradW: Float32Array,
    input: Float32Array,
    gradOutput: Float32Array
  ): void {
    const dim = input.length;
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        gradW[i * dim + j] += input[i] * gradOutput[j];
      }
    }
  }

  /**
   * Update parameters
   */
  private updateParameters(
    params: Float32Array,
    grads: Float32Array,
    learningRate: number,
    numSamples: number
  ): void {
    for (let i = 0; i < params.length; i++) {
      params[i] -= learningRate * grads[i] / numSamples;
    }
  }
}
