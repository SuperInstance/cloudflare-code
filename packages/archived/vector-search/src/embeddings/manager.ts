/**
 * Embedding Manager - Manage embedding generation and caching
 *
 * Provides support for multiple embedding models, batch processing,
 * caching, and dimensionality reduction.
 */

import {
  Vector,
  EmbeddingModelConfig,
  EmbeddingRequest,
  EmbeddingResponse,
  NormalizationMethod,
} from '../types/index.js';
import { normalizeVector } from '../utils/vector.js';

/**
 * Mock embedding model (for demonstration)
 * In production, this would interface with real embedding services
 */
interface EmbeddingModel {
  name: string;
  config: EmbeddingModelConfig;
  embed(text: string): Promise<Vector>;
  embedBatch(texts: string[]): Promise<Vector[]>;
}

/**
 * Simple mock embedding model for demonstration
 */
class MockEmbeddingModel implements EmbeddingModel {
  name: string;
  config: EmbeddingModelConfig;

  constructor(config: EmbeddingModelConfig) {
    this.name = config.name;
    this.config = config;
  }

  async embed(text: string): Promise<Vector> {
    // Generate deterministic pseudo-random embeddings based on text
    const dimension = this.config.dimension;
    const embedding = new Float32Array(dimension);

    // Simple hash-based embedding generation
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    // Use hash as seed for generating embedding
    let seed = hash;
    for (let i = 0; i < dimension; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      embedding[i] = (seed % 10000) / 10000; // Normalize to [0, 1]
    }

    // Center around 0
    for (let i = 0; i < dimension; i++) {
      embedding[i] = (embedding[i] - 0.5) * 2;
    }

    return embedding;
  }

  async embedBatch(texts: string[]): Promise<Vector[]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

/**
 * Cache entry for embeddings
 */
interface CacheEntry {
  embedding: Vector;
  timestamp: number;
  hits: number;
}

/**
 * Embedding Manager class
 */
export class EmbeddingManager {
  private models: Map<string, EmbeddingModel>;
  private currentModel: string;
  private cache: Map<string, CacheEntry>;
  private cacheEnabled: boolean;
  private cacheMaxSize: number;
  private cacheMaxAge: number; // milliseconds
  private dimensionalityReductionEnabled: boolean;
  private targetDimension: number;

  constructor(
    defaultModel: EmbeddingModelConfig,
    cacheEnabled: boolean = true,
    cacheMaxSize: number = 10000,
    cacheMaxAge: number = 3600000 // 1 hour
  ) {
    this.models = new Map();
    this.cacheEnabled = cacheEnabled;
    this.cacheMaxSize = cacheMaxSize;
    this.cacheMaxAge = cacheMaxAge;
    this.cache = new Map();
    this.dimensionalityReductionEnabled = false;
    this.targetDimension = defaultModel.dimension;

    // Initialize default model
    this.registerModel(defaultModel);
    this.currentModel = defaultModel.name;
  }

  /**
   * Register a new embedding model
   */
  registerModel(config: EmbeddingModelConfig): void {
    const model = new MockEmbeddingModel(config);
    this.models.set(config.name, model);
  }

  /**
   * Switch to a different model
   */
  switchModel(modelName: string): void {
    if (!this.models.has(modelName)) {
      throw new Error(`Model ${modelName} not registered`);
    }
    this.currentModel = modelName;

    // Clear cache as embeddings will be different
    this.clearCache();
  }

  /**
   * Get current model name
   */
  getCurrentModel(): string {
    return this.currentModel;
  }

  /**
   * Get all registered model names
   */
  getAvailableModels(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string, normalize: NormalizationMethod = NormalizationMethod.L2): Promise<Vector> {
    // Check cache
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(text);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        // Check if cache entry is still valid
        if (Date.now() - cached.timestamp < this.cacheMaxAge) {
          cached.hits++;
          return cached.embedding;
        } else {
          this.cache.delete(cacheKey);
        }
      }
    }

    // Generate embedding
    const model = this.models.get(this.currentModel);
    if (!model) {
      throw new Error(`Model ${this.currentModel} not found`);
    }

    let embedding = await model.embed(text);

    // Apply normalization
    embedding = normalizeVector(embedding, normalize);

    // Apply dimensionality reduction if enabled
    if (this.dimensionalityReductionEnabled && embedding.length > this.targetDimension) {
      embedding = this.reduceDimension(embedding);
    }

    // Cache result
    if (this.cacheEnabled) {
      this.cacheEmbedding(text, embedding);
    }

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(
    texts: string[],
    normalize: NormalizationMethod = NormalizationMethod.L2
  ): Promise<Vector[]> {
    const embeddings: Vector[] = [];
    const uncachedTexts: Array<{ index: number; text: string }> = [];

    // Check cache for each text
    if (this.cacheEnabled) {
      for (let i = 0; i < texts.length; i++) {
        const cacheKey = this.generateCacheKey(texts[i]);
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
          cached.hits++;
          embeddings[i] = cached.embedding;
        } else {
          uncachedTexts.push({ index: i, text: texts[i] });
        }
      }
    } else {
      for (let i = 0; i < texts.length; i++) {
        uncachedTexts.push({ index: i, text: texts[i] });
      }
    }

    // Generate embeddings for uncached texts
    if (uncachedTexts.length > 0) {
      const model = this.models.get(this.currentModel);
      if (!model) {
        throw new Error(`Model ${this.currentModel} not found`);
      }

      const newEmbeddings = await model.embedBatch(
        uncachedTexts.map((t) => t.text)
      );

      // Process and cache new embeddings
      for (let i = 0; i < uncachedTexts.length; i++) {
        const { index, text } = uncachedTexts[i];
        let embedding = newEmbeddings[i];

        // Apply normalization
        embedding = normalizeVector(embedding, normalize);

        // Apply dimensionality reduction if enabled
        if (this.dimensionalityReductionEnabled && embedding.length > this.targetDimension) {
          embedding = this.reduceDimension(embedding);
        }

        embeddings[index] = embedding;

        // Cache result
        if (this.cacheEnabled) {
          this.cacheEmbedding(text, embedding);
        }
      }
    }

    return embeddings;
  }

  /**
   * Generate embedding from request
   */
  async embedRequest(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    // Validate input types
    for (const input of inputs) {
      if (typeof input !== 'string' && !(input instanceof Buffer)) {
        throw new Error('Input must be string or Buffer');
      }
    }

    // Generate embeddings
    const embeddings = await this.embedBatch(
      inputs.map((i) => (typeof i === 'string' ? i : i.toString('utf-8')))
    );

    // Apply dimension reduction if requested
    if (request.dimensions && request.dimensions < embeddings[0].length) {
      for (let i = 0; i < embeddings.length; i++) {
        embeddings[i] = this.reduceDimension(embeddings[i], request.dimensions);
      }
    }

    // Get model info
    const model = this.models.get(this.currentModel);
    const modelConfig = model?.config || { name: this.currentModel, dimension: embeddings[0].length, modelType: 'text' as const };

    return {
      embeddings,
      model: request.model || this.currentModel,
      usage: {
        promptTokens: inputs.reduce((sum, text) => sum + text.length, 0),
        totalTokens: inputs.reduce((sum, text) => sum + text.length, 0),
      },
    };
  }

  /**
   * Reduce dimensionality of embedding
   */
  private reduceDimension(embedding: Vector, targetDim?: number): Vector {
    const dim = targetDim || this.targetDimension;

    if (embedding.length <= dim) {
      return embedding;
    }

    // Simple truncation (in production, use PCA or other methods)
    return embedding.slice(0, dim) as Vector;
  }

  /**
   * Enable dimensionality reduction
   */
  enableDimensionalityReduction(targetDimension: number): void {
    this.dimensionalityReductionEnabled = true;
    this.targetDimension = targetDimension;
    this.clearCache();
  }

  /**
   * Disable dimensionality reduction
   */
  disableDimensionalityReduction(): void {
    this.dimensionalityReductionEnabled = false;
    this.clearCache();
  }

  /**
   * Cache an embedding
   */
  private cacheEmbedding(text: string, embedding: Vector): void {
    // Check cache size limit
    if (this.cache.size >= this.cacheMaxSize) {
      // Remove least recently used entry
      let lruKey: string | null = null;
      let lruTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.timestamp < lruTime) {
          lruTime = entry.timestamp;
          lruKey = key;
        }
      }

      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    const cacheKey = this.generateCacheKey(text);
    this.cache.set(cacheKey, {
      embedding,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Generate cache key from text
   */
  private generateCacheKey(text: string): string {
    // Simple hash-based cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return `${this.currentModel}:${hash.toString(36)}`;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
  } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }

    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      totalHits,
    };
  }

  /**
   * Enable or disable cache
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  /**
   * Set cache max size
   */
  setCacheMaxSize(size: number): void {
    this.cacheMaxSize = size;

    // Trim cache if necessary
    while (this.cache.size > this.cacheMaxSize) {
      let lruKey: string | null = null;
      let lruTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.timestamp < lruTime) {
          lruTime = entry.timestamp;
          lruKey = key;
        }
      }

      if (lruKey) {
        this.cache.delete(lruKey);
      } else {
        break;
      }
    }
  }

  /**
   * Set cache max age
   */
  setCacheMaxAge(age: number): void {
    this.cacheMaxAge = age;

    // Clean old entries
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheMaxAge) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheMaxAge) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelName?: string): EmbeddingModelConfig | undefined {
    const model = this.models.get(modelName || this.currentModel);
    return model?.config;
  }

  /**
   * Get embedding dimension for current model
   */
  getEmbeddingDimension(): number {
    const model = this.models.get(this.currentModel);
    if (!model) {
      throw new Error(`Model ${this.currentModel} not found`);
    }

    let dimension = model.config.dimension;

    if (this.dimensionalityReductionEnabled) {
      dimension = Math.min(dimension, this.targetDimension);
    }

    return dimension;
  }

  /**
   * Batch embedding with progress callback
   */
  async embedBatchWithProgress(
    texts: string[],
    batchSize: number = 100,
    progressCallback?: (progress: number, total: number) => void
  ): Promise<Vector[]> {
    const embeddings: Vector[] = [];
    const total = texts.length;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await this.embedBatch(batch);
      embeddings.push(...batchEmbeddings);

      if (progressCallback) {
        progressCallback(Math.min(i + batchSize, total), total);
      }
    }

    return embeddings;
  }

  /**
   * Compare two texts by embedding similarity
   */
  async compareTexts(
    text1: string,
    text2: string,
    normalize: NormalizationMethod = NormalizationMethod.L2
  ): Promise<number> {
    const [embedding1, embedding2] = await Promise.all([
      this.embed(text1, normalize),
      this.embed(text2, normalize),
    ]);

    return this.cosineSimilarity(embedding1, embedding2);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: Vector, b: Vector): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimension');
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
   * Find most similar texts to a query
   */
  async findSimilar(
    query: string,
    texts: string[],
    topK: number = 10
  ): Promise<Array<{ text: string; score: number }>> {
    const queryEmbedding = await this.embed(query);
    const textEmbeddings = await this.embedBatch(texts);

    const similarities = textEmbeddings.map((embedding, index) => ({
      text: texts[index],
      score: this.cosineSimilarity(queryEmbedding, embedding),
    }));

    similarities.sort((a, b) => b.score - a.score);

    return similarities.slice(0, topK);
  }

  /**
   * Export cache for persistence
   */
  exportCache(): Array<{ key: string; embedding: number[]; timestamp: number }> {
    const entries = [];

    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        embedding: Array.from(entry.embedding),
        timestamp: entry.timestamp,
      });
    }

    return entries;
  }

  /**
   * Import cache from persistence
   */
  importCache(entries: Array<{ key: string; embedding: number[]; timestamp: number }>): void {
    for (const entry of entries) {
      if (this.cache.size < this.cacheMaxSize) {
        this.cache.set(entry.key, {
          embedding: new Float32Array(entry.embedding),
          timestamp: entry.timestamp,
          hits: 0,
        });
      }
    }
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): number {
    let bytes = 0;

    // Cache storage
    for (const entry of this.cache.values()) {
      bytes += entry.embedding.length * 4; // Float32Array
      bytes += 24; // Object overhead
    }

    // Models (approximate)
    bytes += this.models.size * 1000;

    return bytes;
  }

  /**
   * Reset manager to initial state
   */
  reset(): void {
    this.clearCache();
    this.dimensionalityReductionEnabled = false;
  }
}
