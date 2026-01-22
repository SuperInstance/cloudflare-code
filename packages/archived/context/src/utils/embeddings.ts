/**
 * Embedding utilities for semantic search and similarity
 */

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Calculate Euclidean distance between two vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate Manhattan distance between two vectors
 */
export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }

  return sum;
}

/**
 * Calculate dot product of two vectors
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let product = 0;
  for (let i = 0; i < a.length; i++) {
    product += a[i] * b[i];
  }

  return product;
}

/**
 * Normalize a vector to unit length
 */
export function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  if (norm === 0) {
    return vector.map(() => 0);
  }

  return vector.map(val => val / norm);
}

/**
 * Generate mock embedding for text (deterministic)
 */
export function mockEmbedding(text: string, dimension: number = 1536): number[] {
  const embedding: number[] = [];

  // Generate deterministic but pseudo-random embedding based on text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash;
  }

  const seed = Math.abs(hash);

  for (let i = 0; i < dimension; i++) {
    // Simple PRNG
    const x = Math.sin(seed + i) * 10000;
    embedding.push(x - Math.floor(x));
  }

  return normalize(embedding);
}

/**
 * Generate mock embedding batch
 */
export function mockEmbeddingBatch(texts: string[], dimension: number = 1536): number[][] {
  return texts.map(text => mockEmbedding(text, dimension));
}

/**
 * Calculate average of embeddings
 */
export function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error('Cannot average empty array of embeddings');
  }

  const dimension = embeddings[0].length;
  const average = new Array(dimension).fill(0);

  for (const embedding of embeddings) {
    if (embedding.length !== dimension) {
      throw new Error('All embeddings must have the same dimension');
    }

    for (let i = 0; i < dimension; i++) {
      average[i] += embedding[i];
    }
  }

  return average.map(val => val / embeddings.length);
}

/**
 * Find most similar embeddings
 */
export function findMostSimilar(
  query: number[],
  embeddings: number[][],
  topK: number = 5
): Array<{ index: number; similarity: number }> {
  const similarities = embeddings.map((embedding, index) => ({
    index,
    similarity: cosineSimilarity(query, embedding),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, topK);
}

/**
 * Cluster embeddings using k-means (simplified)
 */
export function clusterEmbeddings(
  embeddings: number[][],
  k: number,
  maxIterations: number = 100
): Array<{ centroid: number[]; indices: number[] }> {
  if (embeddings.length < k) {
    throw new Error('Number of embeddings must be >= k');
  }

  // Initialize centroids randomly
  const centroids: number[][] = [];
  const indices = new Set<number>();

  while (centroids.length < k) {
    const index = Math.floor(Math.random() * embeddings.length);
    if (!indices.has(index)) {
      indices.add(index);
      centroids.push([...embeddings[index]]);
    }
  }

  // K-means iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign embeddings to nearest centroid
    const clusters: Array<Set<number>> = Array.from({ length: k }, () => new Set());

    for (let i = 0; i < embeddings.length; i++) {
      let minDist = Infinity;
      let nearestCentroid = 0;

      for (let j = 0; j < k; j++) {
        const dist = euclideanDistance(embeddings[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          nearestCentroid = j;
        }
      }

      clusters[nearestCentroid].add(i);
    }

    // Update centroids
    const newCentroids: number[][] = [];

    for (let j = 0; j < k; j++) {
      const clusterIndices = Array.from(clusters[j]);

      if (clusterIndices.length === 0) {
        newCentroids.push([...centroids[j]]);
        continue;
      }

      const clusterEmbeddings = clusterIndices.map(i => embeddings[i]);
      newCentroids.push(averageEmbeddings(clusterEmbeddings));
    }

    // Check for convergence
    let converged = true;
    for (let j = 0; j < k; j++) {
      const dist = euclideanDistance(centroids[j], newCentroids[j]);
      if (dist > 0.001) {
        converged = false;
        break;
      }
    }

    centroids.length = 0;
    centroids.push(...newCentroids);

    if (converged) {
      break;
    }
  }

  // Return final clusters
  const result: Array<{ centroid: number[]; indices: number[] }> = [];

  for (let j = 0; j < k; j++) {
    const cluster: Set<number> = new Set();

    for (let i = 0; i < embeddings.length; i++) {
      let minDist = Infinity;
      let nearestCentroid = 0;

      for (let c = 0; c < k; c++) {
        const dist = euclideanDistance(embeddings[i], centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          nearestCentroid = c;
        }
      }

      if (nearestCentroid === j) {
        cluster.add(i);
      }
    }

    result.push({
      centroid: centroids[j],
      indices: Array.from(cluster),
    });
  }

  return result;
}
