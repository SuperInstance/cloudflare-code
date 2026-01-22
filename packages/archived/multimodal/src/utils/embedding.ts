/**
 * Embedding Utilities
 * Helper functions for vector embeddings and similarity calculations
 */

import type { EmbeddingVector } from '../types';

// ============================================================================
// Similarity Calculations
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Calculate Euclidean distance between two vectors
 */
export function euclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate Manhattan distance between two vectors
 */
export function manhattanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.abs(vec1[i] - vec2[i]);
  }

  return sum;
}

/**
 * Calculate dot product of two vectors
 */
export function dotProduct(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let product = 0;
  for (let i = 0; i < vec1.length; i++) {
    product += vec1[i] * vec2[i];
  }

  return product;
}

// ============================================================================
// Vector Operations
// ============================================================================

/**
 * Add two vectors
 */
export function addVectors(vec1: number[], vec2: number[]): number[] {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  return vec1.map((val, i) => val + vec2[i]);
}

/**
 * Subtract two vectors
 */
export function subtractVectors(vec1: number[], vec2: number[]): number[] {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  return vec1.map((val, i) => val - vec2[i]);
}

/**
 * Multiply vector by scalar
 */
export function multiplyVector(vec: number[], scalar: number): number[] {
  return vec.map(val => val * scalar);
}

/**
 * Normalize vector to unit length
 */
export function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));

  if (norm === 0) {
    return vec.map(() => 0);
  }

  return vec.map(val => val / norm);
}

/**
 * Calculate vector magnitude
 */
export function vectorMagnitude(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

/**
 * Calculate average of vectors
 */
export function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error('Cannot average empty array of vectors');
  }

  const dimension = vectors[0].length;

  if (!vectors.every(v => v.length === dimension)) {
    throw new Error('All vectors must have the same dimension');
  }

  const result = new Array(dimension).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dimension; i++) {
      result[i] += vec[i];
    }
  }

  return result.map(val => val / vectors.length);
}

// ============================================================================
// Embedding Operations
// ============================================================================

/**
 * Validate embedding vector
 */
export function validateEmbedding(embedding: EmbeddingVector): boolean {
  if (!embedding.vector || !Array.isArray(embedding.vector)) {
    return false;
  }

  if (embedding.vector.length === 0) {
    return false;
  }

  if (embedding.dimension !== embedding.vector.length) {
    return false;
  }

  if (!embedding.model || typeof embedding.model !== 'string') {
    return false;
  }

  return true;
}

/**
 * Create embedding vector from array
 */
export function createEmbedding(
  vector: number[],
  model: string
): EmbeddingVector {
  return {
    vector,
    dimension: vector.length,
    model
  };
}

/**
 * Convert embedding to flat array
 */
export function flattenEmbedding(embedding: EmbeddingVector): number[] {
  return embedding.vector;
}

/**
 * Convert flat array to embedding
 */
export function unflattenEmbedding(
  vector: number[],
  model: string
): EmbeddingVector {
  return createEmbedding(vector, model);
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Calculate similarity matrix for embeddings
 */
export function similarityMatrix(
  embeddings: EmbeddingVector[]
): number[][] {
  const matrix: number[][] = [];

  for (let i = 0; i < embeddings.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < embeddings.length; j++) {
      matrix[i][j] = cosineSimilarity(
        embeddings[i].vector,
        embeddings[j].vector
      );
    }
  }

  return matrix;
}

/**
 * Find most similar embeddings
 */
export function findMostSimilar(
  query: EmbeddingVector,
  candidates: EmbeddingVector[],
  topK: number = 5
): Array<{ embedding: EmbeddingVector; similarity: number }> {
  const similarities = candidates.map(candidate => ({
    embedding: candidate,
    similarity: cosineSimilarity(query.vector, candidate.vector)
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, topK);
}

/**
 * Cluster embeddings by similarity
 */
export function clusterEmbeddings(
  embeddings: EmbeddingVector[],
  threshold: number = 0.8
): EmbeddingVector[][] {
  const clusters: EmbeddingVector[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < embeddings.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [embeddings[i]];
    assigned.add(i);

    for (let j = i + 1; j < embeddings.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = cosineSimilarity(
        embeddings[i].vector,
        embeddings[j].vector
      );

      if (similarity >= threshold) {
        cluster.push(embeddings[j]);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

// ============================================================================
// Dimensionality Reduction (Simplified)
// ============================================================================

/**
 * Reduce embedding dimension using simple sampling
 * Note: In production, use PCA or t-SNE
 */
export function reduceDimension(
  embedding: EmbeddingVector,
  targetDimension: number
): EmbeddingVector {
  if (targetDimension >= embedding.dimension) {
    return embedding;
  }

  // Simple uniform sampling
  const step = embedding.dimension / targetDimension;
  const reducedVector: number[] = [];

  for (let i = 0; i < targetDimension; i++) {
    const index = Math.floor(i * step);
    reducedVector.push(embedding.vector[index]);
  }

  return {
    vector: reducedVector,
    dimension: targetDimension,
    model: `${embedding.model}-reduced`
  };
}

/**
 * Pad embedding to target dimension
 */
export function padEmbedding(
  embedding: EmbeddingVector,
  targetDimension: number
): EmbeddingVector {
  if (targetDimension <= embedding.dimension) {
    return embedding;
  }

  const padding = targetDimension - embedding.dimension;
  const paddedVector = [...embedding.vector, ...new Array(padding).fill(0)];

  return {
    vector: paddedVector,
    dimension: targetDimension,
    model: `${embedding.model}-padded`
  };
}

// ============================================================================
// Text Processing for Embeddings
// ============================================================================

/**
 * Tokenize text for embedding
 */
export function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Calculate word frequency
 */
export function wordFrequency(tokens: string[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }

  return frequency;
}

/**
 * Extract TF-IDF features (simplified)
 */
export function extractTFIDF(
  documents: string[]
): Map<string, Map<number, number>> {
  const tokenizedDocs = documents.map(doc => tokenize(doc));
  const vocabulary = new Set<string>();
  const docFrequency = new Map<string, number>();

  // Build vocabulary and document frequency
  for (const tokens of tokenizedDocs) {
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      vocabulary.add(token);
      docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
    }
  }

  // Calculate TF-IDF
  const tfidf = new Map<string, Map<number, number>>();
  const numDocs = documents.length;

  tokenizedDocs.forEach((tokens, docIndex) => {
    const termFreq = wordFrequency(tokens);
    const maxFreq = Math.max(...termFreq.values());

    tokens.forEach(token => {
      const tf = termFreq.get(token)! / maxFreq;
      const idf = Math.log(numDocs / (docFrequency.get(token) || 1));
      const score = tf * idf;

      if (!tfidf.has(token)) {
        tfidf.set(token, new Map());
      }

      tfidf.get(token)!.set(docIndex, score);
    });
  });

  return tfidf;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate random embedding for testing
 */
export function randomEmbedding(dimension: number, model: string = 'test'): EmbeddingVector {
  const vector = Array.from({ length: dimension }, () => Math.random() * 2 - 1);
  return createEmbedding(vector, model);
}

/**
 * Serialize embedding to JSON
 */
export function serializeEmbedding(embedding: EmbeddingVector): string {
  return JSON.stringify({
    vector: embedding.vector,
    dimension: embedding.dimension,
    model: embedding.model
  });
}

/**
 * Deserialize embedding from JSON
 */
export function deserializeEmbedding(json: string): EmbeddingVector {
  const data = JSON.parse(json);
  return {
    vector: data.vector,
    dimension: data.dimension,
    model: data.model
  };
}
