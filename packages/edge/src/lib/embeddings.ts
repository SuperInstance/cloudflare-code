/**
 * Embedding Service for Semantic Caching
 *
 * Provides embedding generation using Cloudflare Workers AI with
 * support for quantization and similarity calculations.
 *
 * Performance Targets:
 * - Embedding generation: 50-100ms (Workers AI)
 * - Quantization: <5ms
 * - Similarity calculation: <1ms
 */

export interface EmbeddingServiceOptions {
  /**
   * Embedding model to use
   * @default '@cf/baai/bge-base-en-v1.5' (768 dimensions)
   */
  model?: string;

  /**
   * Cloudflare AI binding
   */
  ai?: AiTextEmbeddingsInput;

  /**
   * Fallback embeddings API endpoint
   */
  fallbackEndpoint?: string;

  /**
   * Fallback API key
   */
  fallbackApiKey?: string;
}

export interface EmbeddingGenerationResult {
  embedding: Float32Array;
  dimensions: number;
  model: string;
  latency: number;
}

/**
 * EmbeddingService using Cloudflare Workers AI
 *
 * Generates text embeddings with automatic fallback support
 * and built-in quantization for efficient storage.
 */
export class EmbeddingService {
  private options: Required<EmbeddingServiceOptions>;
  private model: string;
  private ai?: AiTextEmbeddingsInput;

  constructor(options: EmbeddingServiceOptions = {}) {
    this.options = {
      model: options.model ?? '@cf/baai/bge-base-en-v1.5',
      ai: options.ai!,
      fallbackEndpoint: options.fallbackEndpoint ?? 'https://api.openai.com/v1/embeddings',
      fallbackApiKey: options.fallbackApiKey ?? '',
    };
    this.model = this.options.model;
    this.ai = this.options.ai;
  }

  /**
   * Generate embedding for text
   * Uses Cloudflare Workers AI (free tier) with fallback to OpenAI
   *
   * @param text - Input text to embed
   * @returns Embedding vector as Float32Array
   *
   * Performance: 50-100ms via Workers AI
   */
  async generate(text: string): Promise<Float32Array> {
    const startTime = performance.now();

    // Normalize text
    const normalized = this.normalizeText(text);

    let embedding: Float32Array;

    // Try Cloudflare Workers AI first
    if (this.ai) {
      try {
        embedding = await this.generateWithWorkersAI(normalized);
      } catch (error) {
        console.warn('Workers AI embedding failed, using fallback:', error);
        embedding = await this.generateWithFallback(normalized);
      }
    } else {
      // Use fallback directly
      embedding = await this.generateWithFallback(normalized);
    }

    const latency = performance.now() - startTime;
    console.debug(`Embedding generated in ${latency.toFixed(2)}ms (${embedding.length} dimensions)`);

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts in batch
   *
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   *
   * Performance: ~50ms per text (parallelized)
   */
  async generateBatch(texts: string[]): Promise<Float32Array[]> {
    const startTime = performance.now();

    // Generate embeddings in parallel
    const embeddings = await Promise.all(
      texts.map(text => this.generate(text))
    );

    const latency = performance.now() - startTime;
    console.debug(`Generated ${texts.length} embeddings in ${latency.toFixed(2)}ms`);

    return embeddings;
  }

  /**
   * Quantize embedding to int8 (4x compression)
   *
   * @param embedding - Float32Array embedding
   * @returns Quantized embedding with metadata
   *
   * Performance: <5ms
   * Compression: 4x (float32 -> int8)
   */
  quantize(embedding: Float32Array): {
    quantized: Int8Array;
    min: number;
    max: number;
    originalSize: number;
    quantizedSize: number;
    compressionRatio: number;
  } {
    const startTime = performance.now();

    const min = Math.min(...embedding);
    const max = Math.max(...embedding);
    const range = max - min || 1;

    const quantized = new Int8Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      // Map to [-128, 127] range
      quantized[i] = Math.round(((embedding[i]! - min) / range) * 255 - 128);
    }

    const latency = performance.now() - startTime;
    console.debug(`Quantization completed in ${latency.toFixed(2)}ms (4x compression)`);

    return {
      quantized,
      min,
      max,
      originalSize: embedding.length * 4, // float32 = 4 bytes
      quantizedSize: quantized.length, // int8 = 1 byte
      compressionRatio: 4,
    };
  }

  /**
   * Dequantize embedding from int8 to Float32Array
   *
   * @param quantized - Int8Array quantized embedding
   * @param min - Minimum value from original embedding
   * @param max - Maximum value from original embedding
   * @returns Dequantized Float32Array embedding
   *
   * Performance: <5ms
   */
  dequantize(quantized: Int8Array | Uint8Array, min: number, max: number): Float32Array {
    const range = max - min || 1;
    const embedding = new Float32Array(quantized.length);

    for (let i = 0; i < quantized.length; i++) {
      // Map from [-128, 127] back to original range
      embedding[i] = ((quantized[i]! + 128) / 255) * range + min;
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   *
   * @param a - First embedding
   * @param b - Second embedding
   * @returns Similarity score between 0 and 1
   *
   * Performance: <1ms for 768-dimensional vectors
   */
  similarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(`Embedding dimensions must match: ${a.length} != ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    // Unrolled loop for better performance
    const len = a.length;
    let i = 0;

    // Process 8 elements at a time
    for (; i + 8 <= len; i += 8) {
      dotProduct += a[i]! * b[i]! + a[i + 1]! * b[i + 1]! + a[i + 2]! * b[i + 2]! + a[i + 3]! * b[i + 3]! +
                   a[i + 4]! * b[i + 4]! + a[i + 5]! * b[i + 5]! + a[i + 6]! * b[i + 6]! + a[i + 7]! * b[i + 7]!;
      normA += a[i]! * a[i]! + a[i + 1]! * a[i + 1]! + a[i + 2]! * a[i + 2]! + a[i + 3]! * a[i + 3]! +
              a[i + 4]! * a[i + 4]! + a[i + 5]! * a[i + 5]! + a[i + 6]! * a[i + 6]! + a[i + 7]! * a[i + 7]!;
      normB += b[i]! * b[i]! + b[i + 1]! * b[i + 1]! + b[i + 2]! * b[i + 2]! + b[i + 3]! * b[i + 3]! +
              b[i + 4]! * b[i + 4]! + b[i + 5]! * b[i + 5]! + b[i + 6]! * b[i + 6]! + b[i + 7]! * b[i + 7]!;
    }

    // Process remaining elements
    for (; i < len; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Calculate similarity for quantized embeddings (approximate)
   *
   * @param a - First quantized embedding
   * @param b - Second quantized embedding
   * @param aMin - Min value for first embedding
   * @param aMax - Max value for first embedding
   * @param bMin - Min value for second embedding
   * @param bMax - Max value for second embedding
   * @returns Approximate similarity score
   *
   * Performance: <1ms
   * Note: Slightly less accurate than dequantize + similarity
   */
  similarityQuantized(
    a: Int8Array | Uint8Array,
    b: Int8Array | Uint8Array,
    aMin: number,
    aMax: number,
    bMin: number,
    bMax: number
  ): number {
    const aRange = aMax - aMin || 1;
    const bRange = bMax - bMin || 1;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    const len = a.length;
    for (let i = 0; i < len; i++) {
      const aVal = ((a[i]! + 128) / 255) * aRange + aMin;
      const bVal = ((b[i]! + 128) / 255) * bRange + bMin;

      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Generate embedding using Cloudflare Workers AI
   *
   * @private
   */
  private async generateWithWorkersAI(text: string): Promise<Float32Array> {
    if (!this.ai) {
      throw new Error('Workers AI binding not available');
    }

    try {
      // Use the AI binding to generate embeddings
      // @ts-ignore - Cloudflare Workers AI types may not be up to date
      const result = await this.ai.run(this.model, { input: [text] });

      // Extract the embedding vector from the response
      const embeddingData = result as unknown as { data: Array<{ embedding: number[] }> };
      const embeddingArray = embeddingData.data[0]!.embedding;

      return new Float32Array(embeddingArray);
    } catch (error) {
      throw new Error(`Workers AI embedding failed: ${error}`);
    }
  }

  /**
   * Generate embedding using fallback API (OpenAI-compatible)
   *
   * @private
   */
  private async generateWithFallback(text: string): Promise<Float32Array> {
    if (!this.options.fallbackApiKey) {
      throw new Error('Fallback API key not configured');
    }

    const response = await fetch(this.options.fallbackEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.options.fallbackApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Fallback API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    const embeddingArray = data.data[0]!.embedding;
    return new Float32Array(embeddingArray);
  }

  /**
   * Normalize text for embedding generation
   *
   * @private
   */
  private normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 8192); // Limit to 8192 characters (Workers AI limit)
  }

  /**
   * Get embedding dimensions for the current model
   */
  getDimensions(): number {
    const dimensions: Record<string, number> = {
      '@cf/baai/bge-base-en-v1.5': 768,
      '@cf/baai/bge-small-en-v1.5': 384,
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
    };

    return dimensions[this.model] ?? 768; // Default to 768
  }

  /**
   * Calculate embedding statistics for debugging
   */
  calculateStats(embedding: Float32Array): {
    dimensions: number;
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    norm: number;
  } {
    const dimensions = embedding.length;
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);

    const sum = embedding.reduce((a, b) => a + b, 0);
    const mean = sum / dimensions;

    const variance = embedding.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / dimensions;
    const stdDev = Math.sqrt(variance);

    const norm = Math.sqrt(embedding.reduce((acc, val) => acc + val * val, 0));

    return {
      dimensions,
      min,
      max,
      mean,
      stdDev,
      norm,
    };
  }
}

/**
 * Create an EmbeddingService instance
 */
export function createEmbeddingService(options?: EmbeddingServiceOptions): EmbeddingService {
  return new EmbeddingService(options);
}

/**
 * Default embedding service instance
 */
export const defaultEmbeddingService = new EmbeddingService();
