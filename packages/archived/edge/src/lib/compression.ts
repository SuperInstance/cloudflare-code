/**
 * Compression Utilities for Storage Optimization
 *
 * Provides compression and quantization utilities for reducing
 * storage costs and improving performance across all tiers.
 */

import type { SessionData, MemoryEntry } from '../types/index';

export interface CompressionResult {
  compressed: Uint8Array;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: 'gzip' | 'deflate' | 'none';
}

export interface QuantizationResult {
  quantized: Uint8Array | Int8Array;
  min: number;
  max: number;
  originalSize: number;
  quantizedSize: number;
  compressionRatio: number;
  quantizationType: 'uint8' | 'int8' | 'binary';
}

/**
 * Compression utilities for storage optimization
 */
export class CompressionUtils {
  /**
   * Compress session state (3-5x reduction)
   */
  static async compressSession(state: SessionData): Promise<CompressionResult> {
    const json = JSON.stringify(state);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);

    const compressed = await this.gzipCompress(data);

    return {
      compressed,
      originalSize: data.length,
      compressedSize: compressed.length,
      compressionRatio: data.length / compressed.length,
      algorithm: 'gzip',
    };
  }

  /**
   * Decompress session state
   */
  static async decompressSession(compressed: Uint8Array): Promise<SessionData> {
    const decompressed = await this.gzipDecompress(compressed);
    const decoder = new TextDecoder();
    const json = decoder.decode(decompressed);
    return JSON.parse(json) as SessionData;
  }

  /**
   * Compress embedding to int8 (4x reduction)
   */
  static compressEmbeddingInt8(embedding: Float32Array): QuantizationResult {
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);
    const range = max - min || 1;

    const quantized = new Int8Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      quantized[i] = Math.round(((embedding[i] - min) / range) * 255 - 128);
    }

    return {
      quantized,
      min,
      max,
      originalSize: embedding.length * 4, // float32 = 4 bytes
      quantizedSize: quantized.length, // int8 = 1 byte
      compressionRatio: 4,
      quantizationType: 'int8',
    };
  }

  /**
   * Compress embedding to uint8 (4x reduction, shifted range)
   */
  static compressEmbeddingUInt8(embedding: Float32Array): QuantizationResult {
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);
    const range = max - min || 1;

    const quantized = new Uint8Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      quantized[i] = Math.round(((embedding[i] - min) / range) * 255);
    }

    return {
      quantized,
      min,
      max,
      originalSize: embedding.length * 4,
      quantizedSize: quantized.length,
      compressionRatio: 4,
      quantizationType: 'uint8',
    };
  }

  /**
   * Compress embedding to binary (32x reduction)
   */
  static compressEmbeddingBinary(embedding: Float32Array): QuantizationResult {
    const mean = embedding.reduce((a, b) => a + b, 0) / embedding.length;

    // Each bit represents 8 values, so we need embedding.length / 8 bytes
    const bitArray = new Uint8Array(Math.ceil(embedding.length / 8));

    for (let i = 0; i < embedding.length; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;

      if (embedding[i] >= mean) {
        bitArray[byteIndex] |= (1 << bitIndex);
      }
    }

    return {
      quantized: bitArray,
      min: mean,
      max: mean,
      originalSize: embedding.length * 4,
      quantizedSize: bitArray.length,
      compressionRatio: (embedding.length * 4) / bitArray.length,
      quantizationType: 'binary',
    };
  }

  /**
   * Decompress embedding from int8
   */
  static decompressEmbeddingInt8(
    quantized: Uint8Array | Int8Array,
    min: number,
    max: number
  ): Float32Array {
    const range = max - min || 1;
    const embedding = new Float32Array(quantized.length);

    for (let i = 0; i < quantized.length; i++) {
      embedding[i] = ((quantized[i] + 128) / 255) * range + min;
    }

    return embedding;
  }

  /**
   * Decompress embedding from uint8
   */
  static decompressEmbeddingUInt8(
    quantized: Uint8Array,
    min: number,
    max: number
  ): Float32Array {
    const range = max - min || 1;
    const embedding = new Float32Array(quantized.length);

    for (let i = 0; i < quantized.length; i++) {
      embedding[i] = (quantized[i] / 255) * range + min;
    }

    return embedding;
  }

  /**
   * Decompress embedding from binary
   */
  static decompressEmbeddingBinary(
    quantized: Uint8Array,
    mean: number,
    originalLength: number
  ): Float32Array {
    const embedding = new Float32Array(originalLength);

    for (let i = 0; i < originalLength; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;

      if (byteIndex < quantized.length) {
        const bit = (quantized[byteIndex] >> bitIndex) & 1;
        embedding[i] = bit === 1 ? mean + 0.01 : mean - 0.01; // Small delta around mean
      } else {
        embedding[i] = mean;
      }
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate cosine similarity for quantized embeddings
   * (Approximate, faster but less accurate)
   */
  static cosineSimilarityQuantized(
    a: Uint8Array | Int8Array,
    b: Uint8Array | Int8Array
  ): number {
    if (a.length !== b.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Compress generic data using gzip
   */
  static async gzipCompress(data: Uint8Array): Promise<Uint8Array> {
    if (typeof CompressionStream === 'undefined') {
      return data; // No compression available
    }

    try {
      const compressed = new Response(data).body!
        .pipeThrough(new CompressionStream('gzip'));
      const arrayBuffer = await new Response(compressed).arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.warn('Gzip compression failed:', error);
      return data;
    }
  }

  /**
   * Decompress gzip data
   */
  static async gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
    if (typeof DecompressionStream === 'undefined') {
      return data; // Assume not compressed
    }

    try {
      const decompressed = new Response(data).body!
        .pipeThrough(new DecompressionStream('gzip'));
      const arrayBuffer = await new Response(decompressed).arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      // If decompression fails, assume it wasn't compressed
      return data;
    }
  }

  /**
   * Calculate optimal quantization for embedding
   * Returns 'int8', 'uint8', or 'binary' based on use case
   */
  static recommendQuantization(
    embedding: Float32Array,
    useCase: 'semantic-search' | 'approximate-search' | 'pre-filtering'
  ): 'int8' | 'uint8' | 'binary' {
    if (useCase === 'semantic-search') {
      // Use int8 for best accuracy
      return 'int8';
    } else if (useCase === 'approximate-search') {
      // Use uint8 for balance of accuracy and speed
      return 'uint8';
    } else {
      // Use binary for fastest pre-filtering
      return 'binary';
    }
  }

  /**
   * Compress multiple embeddings in batch
   */
  static async compressEmbeddingsBatch(
    embeddings: Float32Array[],
    quantization: 'int8' | 'uint8' | 'binary' = 'int8'
  ): Promise<{
    compressed: QuantizationResult[];
    totalTime: number;
  }> {
    const startTime = performance.now();
    const compressed: QuantizationResult[] = [];

    for (const embedding of embeddings) {
      let result: QuantizationResult;

      switch (quantization) {
        case 'int8':
          result = this.compressEmbeddingInt8(embedding);
          break;
        case 'uint8':
          result = this.compressEmbeddingUInt8(embedding);
          break;
        case 'binary':
          result = this.compressEmbeddingBinary(embedding);
          break;
      }

      compressed.push(result);
    }

    return {
      compressed,
      totalTime: performance.now() - startTime,
    };
  }

  /**
   * Calculate embedding statistics
   */
  static calculateEmbeddingStats(embedding: Float32Array): {
    dimensions: number;
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    sparsity: number; // Percentage of near-zero values
  } {
    const dimensions = embedding.length;
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);

    const sum = embedding.reduce((a, b) => a + b, 0);
    const mean = sum / dimensions;

    const variance = embedding.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / dimensions;
    const stdDev = Math.sqrt(variance);

    const nearZeroCount = embedding.filter(v => Math.abs(v) < 0.01).length;
    const sparsity = (nearZeroCount / dimensions) * 100;

    return {
      dimensions,
      min,
      max,
      mean,
      stdDev,
      sparsity,
    };
  }

  /**
   * Estimate compression ratio before compression
   */
  static estimateCompressionRatio(
    data: string | object,
    type: 'session' | 'embedding' | 'json'
  ): number {
    switch (type) {
      case 'session':
        return 4; // 4x compression with gzip
      case 'embedding':
        return 32; // 32x with binary quantization
      case 'json':
        return 3; // 3x with gzip
      default:
        return 2;
    }
  }

  /**
   * Calculate storage cost savings
   */
  static calculateSavings(
    originalSize: number,
    compressedSize: number,
    storageCostPerGB: number = 0.015 // Cloudflare R2 pricing
  ): {
    bytesSaved: number;
    percentageSaved: number;
    costSaved: number;
  } {
    const bytesSaved = originalSize - compressedSize;
    const percentageSaved = (bytesSaved / originalSize) * 100;
    const gbSaved = bytesSaved / (1024 * 1024 * 1024);
    const costSaved = gbSaved * storageCostPerGB;

    return {
      bytesSaved,
      percentageSaved,
      costSaved,
    };
  }
}

/**
 * Product Quantization for advanced embedding compression
 * (8x compression with minimal accuracy loss)
 */
export class ProductQuantization {
  private subvectorCount: number;
  private codebookSize: number;
  private codebooks: Float32Array[][] = []; // [subvectorIndex][codeIndex][values]

  constructor(subvectorCount = 8, codebookSize = 256) {
    this.subvectorCount = subvectorCount;
    this.codebookSize = codebookSize;
  }

  /**
   * Train codebooks on a set of vectors
   */
  train(vectors: Float32Array[]): void {
    const dimensions = vectors[0].length;
    const subDim = Math.floor(dimensions / this.subvectorCount);

    for (let s = 0; s < this.subvectorCount; s++) {
      // Extract subvectors
      const subvectors: Float32Array[] = [];
      for (const vector of vectors) {
        const start = s * subDim;
        const end = Math.min(start + subDim, dimensions);
        subvectors.push(vector.slice(start, end));
      }

      // K-means clustering to generate codebook
      const codebook = this.kmeans(subvectors, this.codebookSize);
      this.codebooks[s] = codebook;
    }
  }

  /**
   * Encode vector to codes
   */
  encode(vector: Float32Array): Uint8Array {
    const dimensions = vector.length;
    const subDim = Math.floor(dimensions / this.subvectorCount);
    const codes = new Uint8Array(this.subvectorCount);

    for (let s = 0; s < this.subvectorCount; s++) {
      const start = s * subDim;
      const end = Math.min(start + subDim, dimensions);
      const subvector = vector.slice(start, end);

      // Find nearest centroid
      codes[s] = this.findNearestCentroid(subvector, this.codebooks[s]);
    }

    return codes;
  }

  /**
   * Decode codes to vector
   */
  decode(codes: Uint8Array): Float32Array {
    const subDim = this.codebooks[0]?.[0]?.length ?? 1;
    const vector = new Float32Array(codes.length * subDim);

    for (let s = 0; s < codes.length; s++) {
      const centroid = this.codebooks[s]?.[codes[s]];
      if (centroid) {
        vector.set(centroid, s * subDim);
      }
    }

    return vector;
  }

  /**
   * K-means clustering
   */
  private kmeans(vectors: Float32Array[], k: number): Float32Array[] {
    const dimensions = vectors[0].length;
    const centroids: Float32Array[] = [];

    // Initialize centroids randomly
    for (let i = 0; i < k; i++) {
      centroids.push(vectors[Math.floor(Math.random() * vectors.length)].slice());
    }

    // Iterate until convergence (simplified)
    for (let iter = 0; iter < 10; iter++) {
      const clusters: Array<Float32Array[]> = Array.from({ length: k }, () => []);

      // Assign vectors to nearest centroid
      for (const vector of vectors) {
        let nearest = 0;
        let minDist = Infinity;

        for (let c = 0; c < k; c++) {
          const dist = this.euclideanDistance(vector, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            nearest = c;
          }
        }

        clusters[nearest].push(vector);
      }

      // Update centroids
      for (let c = 0; c < k; c++) {
        if (clusters[c].length === 0) continue;

        const newCentroid = new Float32Array(dimensions);
        for (const vector of clusters[c]) {
          for (let d = 0; d < dimensions; d++) {
            newCentroid[d] += vector[d];
          }
        }

        for (let d = 0; d < dimensions; d++) {
          newCentroid[d] /= clusters[c].length;
        }

        centroids[c] = newCentroid;
      }
    }

    return centroids;
  }

  /**
   * Find nearest centroid
   */
  private findNearestCentroid(vector: Float32Array, codebook: Float32Array[]): number {
    let nearest = 0;
    let minDist = Infinity;

    for (let i = 0; i < codebook.length; i++) {
      const dist = this.euclideanDistance(vector, codebook[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }

    return nearest;
  }

  /**
   * Euclidean distance
   */
  private euclideanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}
