/**
 * Mathematical utilities for XAI computations
 */

// ============================================================================
// Basic Math Operations
// ============================================================================

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mu = mean(values);
  const squareDiffs = values.map(value => Math.pow(value - mu, 2));
  return Math.sqrt(mean(squareDiffs));
}

export function variance(values: number[]): number {
  const sigma = stdDev(values);
  return sigma * sigma;
}

export function min(values: number[]): number {
  return Math.min(...values);
}

export function max(values: number[]): number {
  return Math.max(...values);
}

export function sum(values: number[]): number {
  return values.reduce((acc, val) => acc + val, 0);
}

export function product(values: number[]): number {
  return values.reduce((acc, val) => acc * val, 1);
}

export function normalize(values: number[], method: 'minmax' | 'zscore' | 'l2' | 'l1' = 'minmax'): number[] {
  if (values.length === 0) return [];

  switch (method) {
    case 'minmax':
      return normalizeMinMax(values);
    case 'zscore':
      return normalizeZScore(values);
    case 'l2':
      return normalizeL2(values);
    case 'l1':
      return normalizeL1(values);
  }
}

export function normalizeMinMax(values: number[]): number[] {
  const minVal = min(values);
  const maxVal = max(values);
  const range = maxVal - minVal;
  if (range === 0) return values.map(() => 0);
  return values.map(v => (v - minVal) / range);
}

export function normalizeZScore(values: number[]): number[] {
  const mu = mean(values);
  const sigma = stdDev(values);
  if (sigma === 0) return values.map(() => 0);
  return values.map(v => (v - mu) / sigma);
}

export function normalizeL2(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return values.map(() => 0);
  return values.map(v => v / norm);
}

export function normalizeL1(values: number[]): number[] {
  const norm = values.reduce((sum, v) => sum + Math.abs(v), 0);
  if (norm === 0) return values.map(() => 0);
  return values.map(v => v / norm);
}

export function softmax(values: number[]): number[] {
  const maxVal = max(values);
  const exps = values.map(v => Math.exp(v - maxVal));
  const sumExps = sum(exps);
  if (sumExps === 0) return values.map(() => 1 / values.length);
  return exps.map(e => e / sumExps);
}

export function sigmoid(values: number[]): number[] {
  return values.map(v => 1 / (1 + Math.exp(-v)));
}

export function relu(values: number[]): number[] {
  return values.map(v => Math.max(0, v));
}

// ============================================================================
// Distance Metrics
// ============================================================================

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Arrays must have the same length');
  }
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Arrays must have the same length');
  }
  return a.reduce((sum, val, i) => sum + Math.abs(val - b[i]), 0);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Arrays must have the same length');
  }
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

export function minkowskiDistance(a: number[], b: number[], p: number = 2): number {
  if (a.length !== b.length) {
    throw new Error('Arrays must have the same length');
  }
  return Math.pow(
    a.reduce((sum, val, i) => sum + Math.pow(Math.abs(val - b[i]), p), 0),
    1 / p
  );
}

export function chebyshevDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Arrays must have the same length');
  }
  return max(a.map((val, i) => Math.abs(val - b[i])));
}

export function mahalanobisDistance(
  x: number[],
  mean: number[],
  covariance: number[][]
): number {
  if (x.length !== mean.length) {
    throw new Error('Vectors must have the same length');
  }

  const diff = x.map((val, i) => val - mean[i]);

  // Invert covariance matrix (simplified - use proper library in production)
  const invCov = invertMatrix(covariance);

  // Compute distance
  const temp = multiplyMatrixVector(invCov, diff);
  const distance = Math.sqrt(diff.reduce((sum, val, i) => sum + val * temp[i], 0));

  return distance;
}

// ============================================================================
// Matrix Operations
// ============================================================================

export function multiplyMatrices(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;

  if (colsA !== B.length) {
    throw new Error('Matrix dimensions mismatch');
  }

  const result: number[][] = Array(rowsA)
    .fill(0)
    .map(() => Array(colsB).fill(0));

  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  return result;
}

export function multiplyMatrixVector(A: number[][], v: number[]): number[] {
  const rows = A.length;
  const cols = A[0].length;

  if (cols !== v.length) {
    throw new Error('Matrix and vector dimensions mismatch');
  }

  const result: number[] = Array(rows).fill(0);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i] += A[i][j] * v[j];
    }
  }

  return result;
}

export function transposeMatrix(A: number[][]): number[][] {
  return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
}

export function invertMatrix(A: number[][]): number[][] {
  const n = A.length;
  const result: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0));
  const temp: number[][] = A.map(row => [...row]);

  // Initialize result as identity matrix
  for (let i = 0; i < n; i++) {
    result[i][i] = 1;
  }

  // Gaussian elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let pivot = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(temp[j][i]) > Math.abs(temp[pivot][i])) {
        pivot = j;
      }
    }

    // Swap rows
    [temp[i], temp[pivot]] = [temp[pivot], temp[i]];
    [result[i], result[pivot]] = [result[pivot], result[i]];

    // Scale pivot row
    const pivotValue = temp[i][i];
    if (Math.abs(pivotValue) < 1e-10) {
      throw new Error('Matrix is singular');
    }

    for (let j = 0; j < n; j++) {
      temp[i][j] /= pivotValue;
      result[i][j] /= pivotValue;
    }

    // Eliminate column
    for (let j = 0; j < n; j++) {
      if (j !== i) {
        const factor = temp[j][i];
        for (let k = 0; k < n; k++) {
          temp[j][k] -= factor * temp[i][k];
          result[j][k] -= factor * result[i][k];
        }
      }
    }
  }

  return result;
}

export function determinant(A: number[][]): number {
  const n = A.length;
  if (n === 1) return A[0][0];
  if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];

  let det = 0;
  for (let i = 0; i < n; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    const minor = A.slice(1).map(row => row.filter((_, j) => j !== i));
    det += sign * A[0][i] * determinant(minor);
  }
  return det;
}

// ============================================================================
// Statistical Operations
// ============================================================================

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function quantile(values: number[], q: number): number {
  return percentile(values, q * 100);
}

export function iqr(values: number[]): number {
  return percentile(values, 75) - percentile(values, 25);
}

export function skewness(values: number[]): number {
  if (values.length < 3) return 0;
  const mu = mean(values);
  const sigma = stdDev(values);
  if (sigma === 0) return 0;

  const n = values.length;
  const skew =
    (n / ((n - 1) * (n - 2))) *
    values.reduce((sum, val) => Math.pow((val - mu) / sigma, 3), 0);

  return skew;
}

export function kurtosis(values: number[]): number {
  if (values.length < 4) return 0;
  const mu = mean(values);
  const sigma = stdDev(values);
  if (sigma === 0) return 0;

  const n = values.length;
  const kurt =
    ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) *
    values.reduce((sum, val) => Math.pow((val - mu) / sigma, 4), 0) -
    (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));

  return kurt;
}

export function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length) {
    throw new Error('Arrays must have the same length');
  }

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length) {
    throw new Error('Arrays must have the same length');
  }

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  return x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0) / n;
}

// ============================================================================
// Sampling and Permutations
// ============================================================================

export function sample<T>(array: T[], size: number, replace: boolean = false): T[] {
  if (replace) {
    return Array.from({ length: size }, () => array[Math.floor(Math.random() * array.length)]);
  }

  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(size, shuffled.length));
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function bootstrap<T>(
  array: T[],
  statistic: (sample: T[]) => number,
  nIterations: number = 1000
): { mean: number; std: number; confidenceInterval: [number, number] } {
  const stats: number[] = [];

  for (let i = 0; i < nIterations; i++) {
    const bootSample = sample(array, array.length, true);
    stats.push(statistic(bootSample));
  }

  const statMean = mean(stats);
  const statStd = stdDev(stats);
  const lower = percentile(stats, 2.5);
  const upper = percentile(stats, 97.5);

  return { mean: statMean, std: statStd, confidenceInterval: [lower, upper] };
}

// ============================================================================
// Special Functions
// ============================================================================

export function klDivergence(p: number[], q: number[]): number {
  if (p.length !== q.length) {
    throw new Error('Distributions must have the same length');
  }

  return p.reduce((sum, pi, i) => {
    if (pi === 0) return sum;
    if (q[i] === 0) return Infinity;
    return sum + pi * Math.log(pi / q[i]);
  }, 0);
}

export function jsDivergence(p: number[], q: number[]): number {
  if (p.length !== q.length) {
    throw new Error('Distributions must have the same length');
  }

  const m = p.map((pi, i) => (pi + q[i]) / 2);
  return 0.5 * klDivergence(p, m) + 0.5 * klDivergence(q, m);
}

export function entropy(values: number[]): number {
  const sum = values.reduce((s, v) => s + v, 0);
  if (sum === 0) return 0;

  const probs = values.map(v => v / sum);
  return -probs.reduce((e, p) => (p > 0 ? e + p * Math.log2(p) : e), 0);
}

export function crossEntropy(p: number[], q: number[]): number {
  if (p.length !== q.length) {
    throw new Error('Distributions must have the same length');
  }

  return -p.reduce((sum, pi, i) => {
    if (pi === 0) return sum;
    if (q[i] === 0) return Infinity;
    return sum + pi * Math.log2(q[i]);
  }, 0);
}
