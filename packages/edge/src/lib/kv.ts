/**
 * KV Cache - WARM Tier Storage
 *
 * Provides fast caching (1-50ms) using Cloudflare KV.
 * Limit: 1GB storage, 1GB read per day
 */

import type { UserPreferences, MemoryEntry } from '../types/index';

export interface KVCacheOptions {
  /**
   * Default TTL in seconds (default: 7 days)
   */
  defaultTTL?: number;

  /**
   * Enable compression for values > 1KB
   */
  compression?: boolean;

  /**
   * Enable automatic retry on failure
   */
  retry?: boolean;
}

/**
 * KVCache - WARM Tier for embeddings, user preferences, and cached data
 *
 * Features:
 * - 1-50ms read latency
 * - 1GB storage limit
 * - Automatic TTL management
 * - Compression support
 * - Type-safe get/set operations
 */
export class KVCache {
  private kv: KVNamespace;
  private options: Required<KVCacheOptions>;

  constructor(kv: KVNamespace, options: KVCacheOptions = {}) {
    this.kv = kv;
    this.options = {
      defaultTTL: options.defaultTTL ?? 60 * 60 * 24 * 7, // 7 days
      compression: options.compression ?? true,
      retry: options.retry ?? true,
    };
  }

  /**
   * Get typed value from KV
   * Latency: 1-50ms
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      let value: string | null = null;

      if (this.options.retry) {
        value = await this.retryOperation(() => this.kv.get(key, 'text'));
      } else {
        value = await this.kv.get(key, 'text');
      }

      if (!value) {
        return null;
      }

      // Decompress if needed
      const decompressed = await this.maybeDecompress(value);

      // Parse JSON
      const parsed = JSON.parse(decompressed) as T;

      const latency = performance.now() - startTime;
      console.debug(`KV get: ${key} - ${latency.toFixed(2)}ms`);

      return parsed;
    } catch (error) {
      console.error(`KV get failed for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get value with metadata
   */
  async getWithMetadata<T>(key: string): Promise<{ value: T | null; metadata: unknown } | null> {
    const startTime = performance.now();

    try {
      const result = await this.kv.getWithMetadata(key, 'text');

      if (!result.value) {
        return { value: null, metadata: result.metadata };
      }

      // Decompress if needed
      const decompressed = await this.maybeDecompress(result.value);

      // Parse JSON
      const parsed = JSON.parse(decompressed) as T;

      const latency = performance.now() - startTime;
      console.debug(`KV getWithMetadata: ${key} - ${latency.toFixed(2)}ms`);

      return { value: parsed, metadata: result.metadata };
    } catch (error) {
      console.error(`KV getWithMetadata failed for key ${key}:`, error);
      return { value: null, metadata: null };
    }
  }

  /**
   * Set typed value in KV with optional TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = performance.now();

    try {
      const json = JSON.stringify(value);

      // Compress if enabled and value is large enough
      const compressed = await this.maybeCompress(json);

      const options: KVNamespacePutOptions = {};
      if (ttl || this.options.defaultTTL) {
        options.expirationTtl = ttl ?? this.options.defaultTTL;
      }

      // Add metadata about compression
      options.metadata = {
        compressed: this.options.compression && json.length > 1024,
        originalSize: json.length,
        compressedSize: compressed.length,
        timestamp: Date.now(),
      };

      if (this.options.retry) {
        await this.retryOperation(() => this.kv.put(key, compressed, options));
      } else {
        await this.kv.put(key, compressed, options);
      }

      const latency = performance.now() - startTime;
      console.debug(`KV set: ${key} - ${latency.toFixed(2)}ms (${compressed.length} bytes)`);
    } catch (error) {
      console.error(`KV set failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete value from KV
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.kv.delete(key);
      return true;
    } catch (error) {
      console.error(`KV delete failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.kv.get(key, 'stream');
      return value !== null;
    } catch (error) {
      console.error(`KV exists check failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * List keys by prefix
   */
  async list(prefix: string, limit?: number): Promise<string[]> {
    try {
      const list = await this.kv.list({ prefix, limit });
      return list.keys.map(k => k.name);
    } catch (error) {
      console.error(`KV list failed for prefix ${prefix}:`, error);
      return [];
    }
  }

  /**
   * Get multiple values by keys
   */
  async getMultiple<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    // KV doesn't support multi-get, so we parallelize individual gets
    const promises = keys.map(async (key) => {
      const value = await this.get<T>(key);
      if (value !== null) {
        return [key, value] as [string, T];
      }
      return null;
    });

    const results = await Promise.all(promises);
    for (const item of results) {
      if (item) {
        result.set(item[0], item[1]);
      }
    }

    return result;
  }

  /**
   * Set multiple values
   */
  async setMultiple<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    const promises = Array.from(entries.entries()).map(([key, value]) =>
      this.set(key, value, ttl)
    );

    await Promise.all(promises);
  }

  /**
   * Store user preferences
   */
  async setUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    await this.set(`user:${userId}:preferences`, preferences, 60 * 60 * 24 * 30); // 30 days
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    return this.get<UserPreferences>(`user:${userId}:preferences`);
  }

  /**
   * Store embedding in KV (quantized to int8)
   */
  async setEmbedding(key: string, embedding: Float32Array, ttl?: number): Promise<void> {
    // Quantize to int8 for 4x compression
    const quantized = this.quantizeEmbedding(embedding);

    await this.set(`embedding:${key}`, {
      quantized,
      dimensions: embedding.length,
      min: Math.min(...embedding),
      max: Math.max(...embedding),
    }, ttl ?? 60 * 60 * 24 * 30); // 30 days
  }

  /**
   * Get embedding from KV (de-quantized)
   */
  async getEmbedding(key: string): Promise<Float32Array | null> {
    const data = await this.get<{
      quantized: number[];
      dimensions: number;
      min: number;
      max: number;
    }>(`embedding:${key}`);

    if (!data) {
      return null;
    }

    return this.dequantizeEmbedding(data.quantized, data.min, data.max);
  }

  /**
   * Store memory entry in KV
   */
  async setMemoryEntry(entry: MemoryEntry, ttl?: number): Promise<void> {
    // Compress and quantize embedding
    const compressed = {
      ...entry,
      embedding: Array.from(this.quantizeEmbedding(entry.embedding)),
    };

    await this.set(`memory:${entry.id}`, compressed, ttl);
  }

  /**
   * Get memory entry from KV
   */
  async getMemoryEntry(entryId: string): Promise<MemoryEntry | null> {
    const compressed = await this.get<MemoryEntry & { embedding: number[] }>(`memory:${entryId}`);

    if (!compressed) {
      return null;
    }

    // De-quantize embedding
    return {
      ...compressed,
      embedding: this.dequantizeEmbedding(
        compressed.embedding as unknown as number[],
        Math.min(...compressed.embedding),
        Math.max(...compressed.embedding)
      ),
    };
  }

  /**
   * Cache LLM response
   */
  async cacheLLMResponse(
    promptHash: string,
    response: string,
    metadata: {
      model: string;
      tokens: number;
      cost: number;
      latency: number;
    },
    ttl?: number
  ): Promise<void> {
    await this.set(`cache:${promptHash}`, {
      response,
      metadata,
      timestamp: Date.now(),
    }, ttl ?? 60 * 60 * 24 * 7); // 7 days
  }

  /**
   * Get cached LLM response
   */
  async getCachedLLMResponse(promptHash: string): Promise<{
    response: string;
    metadata: {
      model: string;
      tokens: number;
      cost: number;
      latency: number;
    };
    timestamp: number;
  } | null> {
    return this.get(`cache:${promptHash}`);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keyCount: number;
    totalSize: number;
    avgLatency: number;
  }> {
    // Note: KV doesn't provide a native way to get total size or count
    // This is a simplified version that samples keys
    const keys = await this.list('', 1000);

    return {
      keyCount: keys.length,
      totalSize: 0, // Not available in KV
      avgLatency: 0, // Would need to track this
    };
  }

  /**
   * Quantize embedding from float32 to int8
   * 4x compression
   */
  private quantizeEmbedding(embedding: Float32Array): number[] {
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);
    const range = max - min || 1;

    const quantized = new Int8Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      quantized[i] = Math.round(((embedding[i] - min) / range) * 255 - 128);
    }

    return Array.from(quantized);
  }

  /**
   * De-quantize embedding from int8 to float32
   */
  private dequantizeEmbedding(quantized: number[], min: number, max: number): Float32Array {
    const range = max - min || 1;
    const embedding = new Float32Array(quantized.length);

    for (let i = 0; i < quantized.length; i++) {
      embedding[i] = ((quantized[i] + 128) / 255) * range + min;
    }

    return embedding;
  }

  /**
   * Compress data if compression is enabled and data is large enough
   */
  private async maybeCompress(data: string): Promise<string> {
    if (!this.options.compression || data.length < 1024) {
      return data;
    }

    try {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(data);

      // Note: CompressionStream might not be available in all environments
      if (typeof CompressionStream === 'undefined') {
        return data;
      }

      const compressed = new Response(uint8Array).body!
        .pipeThrough(new CompressionStream('gzip'));
      const arrayBuffer = await new Response(compressed).arrayBuffer();
      const compressedArray = new Uint8Array(arrayBuffer);

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...compressedArray));
    } catch (error) {
      console.warn('Compression failed, storing uncompressed:', error);
      return data;
    }
  }

  /**
   * Decompress data if it was compressed
   */
  private async maybeDecompress(data: string): Promise<string> {
    if (!this.options.compression) {
      return data;
    }

    try {
      // Try to detect if it's base64 encoded (compressed)
      if (/^[A-Za-z0-9+/]+=*$/.test(data) && data.length > 100) {
        const binaryString = atob(data);
        const uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }

        // Note: DecompressionStream might not be available in all environments
        if (typeof DecompressionStream === 'undefined') {
          return data;
        }

        const decompressed = new Response(uint8Array).body!
          .pipeThrough(new DecompressionStream('gzip'));
        const arrayBuffer = await new Response(decompressed).arrayBuffer();
        const decoder = new TextDecoder();
        return decoder.decode(arrayBuffer);
      }

      return data;
    } catch (error) {
      // If decompression fails, assume it wasn't compressed
      return data;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }

        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = 100 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Retry operation failed');
  }
}

/**
 * Helper function to create KVCache instance
 */
export function createKVCache(kv: KVNamespace, options?: KVCacheOptions): KVCache {
  return new KVCache(kv, options);
}
