/**
 * Vector utility functions for mathematical operations
 */

import {
  Vector,
  BinaryVector,
  DistanceMetric,
  NormalizationMethod,
  QuantizationType,
} from '../types/index.js';

/**
 * Calculate the Euclidean distance between two vectors
 */
export function euclideanDistance(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Calculate the cosine similarity between two vectors
 */
export function cosineSimilarity(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Calculate the dot product of two vectors
 */
export function dotProduct(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Calculate the Manhattan (L1) distance between two vectors
 */
export function manhattanDistance(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum;
}

/**
 * Calculate the Hamming distance between two binary vectors
 */
export function hammingDistance(a: BinaryVector, b: BinaryVector): number {
  if (a.length !== b.length) {
    throw new Error('Binary vectors must have the same length');
  }

  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = a[i] ^ b[i];
    distance += countSetBits(xor);
  }
  return distance;
}

/**
 * Count the number of set bits in a byte
 */
function countSetBits(byte: number): number {
  let count = 0;
  while (byte > 0) {
    count += byte & 1;
    byte >>= 1;
  }
  return count;
}

/**
 * Calculate the Jaccard similarity between two binary vectors
 */
export function jaccardSimilarity(a: BinaryVector, b: BinaryVector): number {
  if (a.length !== b.length) {
    throw new Error('Binary vectors must have the same length');
  }

  let intersection = 0;
  let union = 0;

  for (let i = 0; i < a.length; i++) {
    const andResult = a[i] & b[i];
    const orResult = a[i] | b[i];
    intersection += countSetBits(andResult);
    union += countSetBits(orResult);
  }

  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculate distance between two vectors using the specified metric
 */
export function calculateDistance(
  a: Vector | BinaryVector,
  b: Vector | BinaryVector,
  metric: DistanceMetric
): number {
  switch (metric) {
    case DistanceMetric.EUCLIDEAN:
      return euclideanDistance(a as Vector, b as Vector);
    case DistanceMetric.COSINE:
      return 1 - cosineSimilarity(a as Vector, b as Vector);
    case DistanceMetric.DOT_PRODUCT:
      return -dotProduct(a as Vector, b as Vector);
    case DistanceMetric.MANHATTAN:
      return manhattanDistance(a as Vector, b as Vector);
    case DistanceMetric.HAMMING:
      return hammingDistance(a as BinaryVector, b as BinaryVector);
    case DistanceMetric.JACCARD:
      return 1 - jaccardSimilarity(a as BinaryVector, b as BinaryVector);
    default:
      throw new Error(`Unsupported distance metric: ${metric}`);
  }
}

/**
 * Calculate similarity between two vectors (higher is more similar)
 */
export function calculateSimilarity(
  a: Vector | BinaryVector,
  b: Vector | BinaryVector,
  metric: DistanceMetric
): number {
  switch (metric) {
    case DistanceMetric.EUCLIDEAN:
    case DistanceMetric.MANHATTAN:
    case DistanceMetric.HAMMING:
      // For distance metrics, convert to similarity
      const dist = calculateDistance(a, b, metric);
      return 1 / (1 + dist);
    case DistanceMetric.COSINE:
      return cosineSimilarity(a as Vector, b as Vector);
    case DistanceMetric.DOT_PRODUCT:
      const dot = dotProduct(a as Vector, b as Vector);
      // Normalize dot product to [0, 1] range
      return Math.max(0, dot);
    case DistanceMetric.JACCARD:
      return jaccardSimilarity(a as BinaryVector, b as BinaryVector);
    default:
      throw new Error(`Unsupported distance metric: ${metric}`);
  }
}

/**
 * Normalize a vector using the specified method
 */
export function normalizeVector(
  vector: Vector,
  method: NormalizationMethod
): Vector {
  const result = new Float32Array(vector.length);

  switch (method) {
    case NormalizationMethod.NONE:
      return new Float32Array(vector);

    case NormalizationMethod.L2:
      let l2Norm = 0;
      for (let i = 0; i < vector.length; i++) {
        l2Norm += vector[i] * vector[i];
      }
      l2Norm = Math.sqrt(l2Norm);
      if (l2Norm > 0) {
        for (let i = 0; i < vector.length; i++) {
          result[i] = vector[i] / l2Norm;
        }
      } else {
        return new Float32Array(vector);
      }
      return result;

    case NormalizationMethod.UNIT:
      return normalizeVector(vector, NormalizationMethod.L2);

    case NormalizationMethod.MAX:
      let maxAbs = 0;
      for (let i = 0; i < vector.length; i++) {
        const absVal = Math.abs(vector[i]);
        if (absVal > maxAbs) {
          maxAbs = absVal;
        }
      }
      if (maxAbs > 0) {
        for (let i = 0; i < vector.length; i++) {
          result[i] = vector[i] / maxAbs;
        }
      } else {
        return new Float32Array(vector);
      }
      return result;

    default:
      throw new Error(`Unsupported normalization method: ${method}`);
  }
}

/**
 * Validate vector dimensions
 */
export function validateVectorDimension(
  vector: Vector | BinaryVector,
  expectedDimension: number
): boolean {
  return vector.length === expectedDimension;
}

/**
 * Create a zero vector
 */
export function zeroVector(dimension: number): Float32Array {
  return new Float32Array(dimension);
}

/**
 * Clone a vector
 */
export function cloneVector(vector: Vector): Vector {
  return new Float32Array(vector);
}

/**
 * Add two vectors
 */
export function addVectors(a: Vector, b: Vector): Vector {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

/**
 * Subtract two vectors
 */
export function subtractVectors(a: Vector, b: Vector): Vector {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] - b[i];
  }
  return result;
}

/**
 * Multiply a vector by a scalar
 */
export function multiplyScalar(vector: Vector, scalar: number): Vector {
  const result = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    result[i] = vector[i] * scalar;
  }
  return result;
}

/**
 * Compute the mean of multiple vectors
 */
export function meanVector(vectors: Vector[]): Vector {
  if (vectors.length === 0) {
    throw new Error('Cannot compute mean of empty array');
  }

  const dimension = vectors[0].length;
  const result = new Float32Array(dimension);

  for (const vector of vectors) {
    if (vector.length !== dimension) {
      throw new Error('All vectors must have the same dimension');
    }
    for (let i = 0; i < dimension; i++) {
      result[i] += vector[i];
    }
  }

  const scalar = 1 / vectors.length;
  return multiplyScalar(result, scalar);
}

/**
 * Convert vector to binary representation
 */
export function vectorToBinary(vector: Vector, threshold: number = 0): BinaryVector {
  const bitsPerDimension = 8;
  const bytesNeeded = Math.ceil((vector.length * bitsPerDimension) / 8);
  const binary = new Uint8Array(bytesNeeded);

  for (let i = 0; i < vector.length; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;
    const bit = vector[i] > threshold ? 1 : 0;
    binary[byteIndex] |= bit << bitIndex;
  }

  return binary;
}

/**
 * Convert binary vector to float vector
 */
export function binaryToVector(binary: BinaryVector, dimension: number): Vector {
  const vector = new Float32Array(dimension);

  for (let i = 0; i < dimension; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;
    const bit = (binary[byteIndex] >> bitIndex) & 1;
    vector[i] = bit;
  }

  return vector;
}

/**
 * Scalar quantization of a vector to 8-bit
 */
export function scalarQuantize8Bit(vector: Vector): Uint8Array {
  const quantized = new Uint8Array(vector.length);

  // Find min and max values
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < vector.length; i++) {
    if (vector[i] < min) min = vector[i];
    if (vector[i] > max) max = vector[i];
  }

  const range = max - min;
  if (range === 0) {
    // All values are the same
    return quantized.fill(128);
  }

  // Quantize
  for (let i = 0; i < vector.length; i++) {
    quantized[i] = Math.round(((vector[i] - min) / range) * 255);
  }

  return quantized;
}

/**
 * Dequantize 8-bit scalar quantized vector
 */
export function scalarDequantize8Bit(
  quantized: Uint8Array,
  min: number,
  max: number
): Vector {
  const vector = new Float32Array(quantized.length);
  const range = max - min;

  for (let i = 0; i < quantized.length; i++) {
    vector[i] = min + (quantized[i] / 255) * range;
  }

  return vector;
}

/**
 * Product quantization encoder
 */
export function productQuantization(
  vectors: Vector[],
  nsubvector: number,
  nbits: number
): {
  codes: Uint16Array;
  centroids: Vector[][];
} {
  if (vectors.length === 0) {
    throw new Error('Cannot perform product quantization on empty array');
  }

  const dimension = vectors[0].length;
  const subvectorDim = dimension / nsubvector;

  if (!Number.isInteger(subvectorDim)) {
    throw new Error('Dimension must be divisible by nsubvector');
  }

  const centroids: Vector[][] = [];
  const codes = new Uint16Array(vectors.length * nsubvector);

  // Process each subvector
  for (let m = 0; m < nsubvector; m++) {
    const start = m * subvectorDim;
    const end = start + subvectorDim;

    // Extract subvectors
    const subvectors: Vector[] = [];
    for (const vector of vectors) {
      const subvector = vector.slice(start, end);
      subvectors.push(subvector as Vector);
    }

    // Perform k-means clustering (simplified)
    const k = Math.pow(2, nbits);
    const subvectorCentroids = kMeansClustering(subvectors, k);
    centroids.push(subvectorCentroids);

    // Assign codes
    for (let i = 0; i < vectors.length; i++) {
      const subvector = vectors[i].slice(start, end);
      let bestCentroid = 0;
      let bestDistance = Infinity;

      for (let c = 0; c < subvectorCentroids.length; c++) {
        const dist = euclideanDistance(
          subvector as Vector,
          subvectorCentroids[c]
        );
        if (dist < bestDistance) {
          bestDistance = dist;
          bestCentroid = c;
        }
      }

      codes[i * nsubvector + m] = bestCentroid;
    }
  }

  return { codes, centroids };
}

/**
 * Simple k-means clustering
 */
function kMeansClustering(vectors: Vector[], k: number): Vector[] {
  if (vectors.length < k) {
    return vectors.slice();
  }

  // Initialize centroids randomly
  const centroids: Vector[] = [];
  const indices = new Set<number>();

  while (indices.size < k && indices.size < vectors.length) {
    const idx = Math.floor(Math.random() * vectors.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      centroids.push(new Float32Array(vectors[idx]) as Vector);
    }
  }

  // Iterative refinement (limited iterations for performance)
  const maxIterations = 10;
  for (let iter = 0; iter < maxIterations; iter++) {
    const clusters: Vector[][] = Array.from({ length: k }, () => []);

    // Assign vectors to clusters
    for (const vector of vectors) {
      let bestCluster = 0;
      let bestDistance = Infinity;

      for (let c = 0; c < centroids.length; c++) {
        const dist = euclideanDistance(vector, centroids[c]);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestCluster = c;
        }
      }

      clusters[bestCluster].push(vector);
    }

    // Update centroids
    for (let c = 0; c < k; c++) {
      if (clusters[c].length > 0) {
        centroids[c] = meanVector(clusters[c]);
      }
    }
  }

  return centroids;
}

/**
 * Calculate vector magnitude
 */
export function vectorMagnitude(vector: Vector): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }
  return Math.sqrt(sum);
}

/**
 * Check if vector is normalized
 */
export function isNormalized(vector: Vector, tolerance: number = 1e-6): boolean {
  const magnitude = vectorMagnitude(vector);
  return Math.abs(magnitude - 1.0) < tolerance;
}

/**
 * Compute PCA for dimensionality reduction
 */
export function pca(vectors: Vector[], targetDimension: number): Vector[] {
  if (vectors.length === 0) {
    throw new Error('Cannot compute PCA on empty array');
  }

  const dimension = vectors[0].length;
  if (targetDimension >= dimension) {
    return vectors.map((v) => new Float32Array(v));
  }

  // Center the data
  const mean = meanVector(vectors);
  const centered = vectors.map((v) => subtractVectors(v, mean));

  // Compute covariance matrix (simplified)
  const cov: number[][] = Array.from({ length: dimension }, () =>
    new Array(dimension).fill(0)
  );

  for (const vec of centered) {
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        cov[i][j] += vec[i] * vec[j];
      }
    }
  }

  for (let i = 0; i < dimension; i++) {
    for (let j = 0; j < dimension; j++) {
      cov[i][j] /= vectors.length;
    }
  }

  // Power iteration to find top eigenvectors (simplified)
  const eigenvectors: Vector[] = [];
  for (let d = 0; d < targetDimension; d++) {
    const eigenvector = powerIteration(cov, dimension);
    eigenvectors.push(eigenvector);

    // Deflate
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        cov[i][j] -= eigenvector[i] * eigenvector[j];
      }
    }
  }

  // Project onto eigenvectors
  const result: Vector[] = [];
  for (const vec of centered) {
    const projected = new Float32Array(targetDimension);
    for (let d = 0; d < targetDimension; d++) {
      projected[d] = dotProduct(vec, eigenvectors[d]);
    }
    result.push(projected);
  }

  return result;
}

/**
 * Power iteration method to find dominant eigenvector
 */
function powerIteration(matrix: number[][], dimension: number): Vector {
  let vector = new Float32Array(dimension);
  for (let i = 0; i < dimension; i++) {
    vector[i] = Math.random();
  }

  // Normalize
  vector = normalizeVector(vector, NormalizationMethod.UNIT) as Float32Array;

  const iterations = 20;
  for (let iter = 0; iter < iterations; iter++) {
    const newVector = new Float32Array(dimension);

    // Matrix-vector multiplication
    for (let i = 0; i < dimension; i++) {
      for (let j = 0; j < dimension; j++) {
        newVector[i] += matrix[i][j] * vector[j];
      }
    }

    // Normalize
    const norm = vectorMagnitude(newVector);
    for (let i = 0; i < dimension; i++) {
      vector[i] = newVector[i] / norm;
    }
  }

  return vector;
}

/**
 * Sample random vectors from a collection
 */
export function sampleVectors(
  vectors: Vector[],
  count: number,
  seed?: number
): Vector[] {
  if (count >= vectors.length) {
    return vectors.map((v) => new Float32Array(v));
  }

  const sampled: Vector[] = [];
  const indices = new Set<number>();

  // Simple random sampling
  let randomState = seed || Date.now();
  const random = () => {
    randomState = (randomState * 1103515245 + 12345) & 0x7fffffff;
    return randomState / 0x7fffffff;
  };

  while (indices.size < count) {
    const idx = Math.floor(random() * vectors.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      sampled.push(new Float32Array(vectors[idx]));
    }
  }

  return sampled;
}

/**
 * Compute statistics for a collection of vectors
 */
export function computeVectorStatistics(vectors: Vector[]): {
  mean: Vector;
  variance: Vector;
  stdDev: Vector;
  min: Vector;
  max: Vector;
} {
  if (vectors.length === 0) {
    throw new Error('Cannot compute statistics on empty array');
  }

  const dimension = vectors[0].length;
  const mean = meanVector(vectors);
  const variance = new Float32Array(dimension);
  const min = new Float32Array(vectors[0]);
  const max = new Float32Array(vectors[0]);

  // Initialize min and max
  for (const vector of vectors) {
    for (let i = 0; i < dimension; i++) {
      if (vector[i] < min[i]) min[i] = vector[i];
      if (vector[i] > max[i]) max[i] = vector[i];
    }
  }

  // Compute variance
  for (const vector of vectors) {
    for (let i = 0; i < dimension; i++) {
      const diff = vector[i] - mean[i];
      variance[i] += diff * diff;
    }
  }

  for (let i = 0; i < dimension; i++) {
    variance[i] /= vectors.length;
  }

  // Compute standard deviation
  const stdDev = new Float32Array(dimension);
  for (let i = 0; i < dimension; i++) {
    stdDev[i] = Math.sqrt(variance[i]);
  }

  return { mean, variance, stdDev, min, max };
}
