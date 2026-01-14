/**
 * KV Compression Utilities
 *
 * Advanced compression utilities for KV storage to minimize
 * storage costs and improve read/write performance.
 *
 * Features:
 * - Gzip compression
 * - Automatic metadata tracking
 * - Batch compression
 * - Compression ratio tracking
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Compression metadata
 */
export interface CompressionMetadata {
  /** Whether data is compressed */
  compressed: boolean;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Compression ratio */
  compressionRatio: number;
  /** Compression algorithm */
  algorithm: 'gzip' | 'none';
}

/**
 * Compression options
 */
export interface CompressionOptions {
  /** Enable compression */
  enabled?: boolean;
  /** Compression threshold (bytes) */
  threshold?: number;
  /** Track metadata */
  trackMetadata?: boolean;
}

/**
 * KV Compression utilities
 */
export class KVCompression {
  private kv: KVNamespace;
  private options: Required<CompressionOptions>;
  private stats: {
    totalCompressed: number;
    totalBytesSaved: number;
    compressionRatio: number;
  };

  constructor(kv: KVNamespace, options: CompressionOptions = {}) {
    this.kv = kv;
    this.options = {
      enabled: options.enabled ?? true,
      threshold: options.threshold ?? 1024, // 1KB
      trackMetadata: options.trackMetadata ?? true,
    };

    this.stats = {
      totalCompressed: 0,
      totalBytesSaved: 0,
      compressionRatio: 0,
    };
  }

  /**
   * Set compressed value in KV
   */
  async set(
    key: string,
    data: unknown,
    options?: {
      expirationTtl?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const json = JSON.stringify(data);
    const originalSize = json.length;

    // Check if compression is needed
    if (!this.options.enabled || originalSize < this.options.threshold) {
      await this.kv.put(key, json, {
        expirationTtl: options?.expirationTtl,
        metadata: {
          ...options?.metadata,
          compressed: 'false',
          originalSize,
        },
      });
      return;
    }

    // Compress data
    const compressed = await this.gzipCompress(json);
    const compressedSize = compressed.length;
    const compressionRatio = originalSize / compressedSize;

    // Store with metadata
    await this.kv.put(key, compressed, {
      expirationTtl: options?.expirationTtl,
      metadata: {
        ...options?.metadata,
        compressed: 'true',
        originalSize,
        compressedSize,
        compressionRatio: compressionRatio.toFixed(2),
        algorithm: 'gzip',
      },
    });

    // Update stats
    this.stats.totalCompressed++;
    this.stats.totalBytesSaved += originalSize - compressedSize;
    this.stats.compressionRatio =
      (this.stats.compressionRatio * (this.stats.totalCompressed - 1) + compressionRatio) /
      this.stats.totalCompressed;
  }

  /**
   * Get and decompress value from KV
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    // Try to get with metadata first
    const value = await this.kv.get(key, 'arrayBuffer');
    if (!value) return null;

    // Get metadata
    const metadata = await this.kv.get(key, { type: 'json' }) as any;
    const compressed = metadata?.metadata?.compressed === 'true';

    // Decompress if needed
    if (compressed) {
      const decompressed = await this.gzipDecompress(new Uint8Array(value));
      const decoder = new TextDecoder();
      const json = decoder.decode(decompressed);
      return JSON.parse(json) as T;
    }

    // Not compressed
    const decoder = new TextDecoder();
    const json = decoder.decode(value);
    return JSON.parse(json) as T;
  }

  /**
   * Set multiple values in batch
   */
  async setBatch(
    entries: Array<{
      key: string;
      value: unknown;
      expirationTtl?: number;
    }>
  ): Promise<void> {
    await Promise.all(
      entries.map((entry) =>
        this.set(entry.key, entry.value, {
          expirationTtl: entry.expirationTtl,
        })
      )
    );
  }

  /**
   * Get multiple values in batch
   */
  async getBatch<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key);
        results.set(key, value);
      })
    );

    return results;
  }

  /**
   * Gzip compress
   */
  private async gzipCompress(data: string): Promise<Uint8Array> {
    if (typeof CompressionStream === 'undefined') {
      // No compression available
      const encoder = new TextEncoder();
      return encoder.encode(data);
    }

    try {
      const encoder = new TextEncoder();
      const input = encoder.encode(data);

      const compressed = new Response(input).body!.pipeThrough(
        new CompressionStream('gzip')
      );

      const arrayBuffer = await new Response(compressed).arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.warn('Gzip compression failed:', error);
      const encoder = new TextEncoder();
      return encoder.encode(data);
    }
  }

  /**
   * Gzip decompress
   */
  private async gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
    if (typeof DecompressionStream === 'undefined') {
      // Assume not compressed
      return data;
    }

    try {
      const decompressed = new Response(data).body!.pipeThrough(
        new DecompressionStream('gzip')
      );

      const arrayBuffer = await new Response(decompressed).arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      // If decompression fails, assume it wasn't compressed
      return data;
    }
  }

  /**
   * Get compression statistics
   */
  getStats(): {
    totalCompressed: number;
    totalBytesSaved: number;
    compressionRatio: number;
    avgSavingsPercentage: number;
  } {
    const avgSavingsPercentage =
      this.stats.totalCompressed > 0
        ? (this.stats.totalBytesSaved /
            (this.stats.totalBytesSaved +
              this.stats.totalCompressed * this.stats.compressionRatio)) *
          100
        : 0;

    return {
      totalCompressed: this.stats.totalCompressed,
      totalBytesSaved: this.stats.totalBytesSaved,
      compressionRatio: this.stats.compressionRatio,
      avgSavingsPercentage,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCompressed: 0,
      totalBytesSaved: 0,
      compressionRatio: 0,
    };
  }

  /**
   * Estimate compression ratio before compressing
   */
  estimateCompression(data: unknown): number {
    try {
      const json = JSON.stringify(data);

      // Simple heuristic: JSON typically compresses 3-5x
      if (json.length < 100) return 1;
      if (json.length < 1000) return 2;
      if (json.length < 10000) return 3;
      return 4;
    } catch {
      return 1;
    }
  }

  /**
   * Calculate storage cost savings
   */
  calculateSavings(): {
    bytesSaved: number;
    costSaved: number;
  } {
    // Cloudflare KV pricing (as of 2024):
    // $0.50 per million reads
    // $5.00 per million writes
    // $0.50 per GB stored per month

    const bytesSaved = this.stats.totalBytesSaved;
    const gbSaved = bytesSaved / (1024 * 1024 * 1024);
    const costSaved = gbSaved * 0.50; // $0.50 per GB

    return {
      bytesSaved,
      costSaved,
    };
  }
}

/**
 * Helper function to set compressed value
 */
export async function setCompressed(
  kv: KVNamespace,
  key: string,
  data: unknown,
  options?: {
    expirationTtl?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const compression = new KVCompression(kv);
  await compression.set(key, data, options);
}

/**
 * Helper function to get decompressed value
 */
export async function getCompressed<T = unknown>(
  kv: KVNamespace,
  key: string
): Promise<T | null> {
  const compression = new KVCompression(kv);
  return compression.get<T>(key);
}

/**
 * Batch compression for large datasets
 */
export class BatchCompressor {
  private kv: KVNamespace;
  private batchSize: number;

  constructor(kv: KVNamespace, batchSize: number = 100) {
    this.kv = kv;
    this.batchSize = batchSize;
  }

  /**
   * Compress and store multiple items
   */
  async compressBatch(
    items: Array<{
      key: string;
      value: unknown;
      ttl?: number;
    }>
  ): Promise<{
    processed: number;
    compressed: number;
    bytesSaved: number;
  }> {
    let processed = 0;
    let compressed = 0;
    let bytesSaved = 0;

    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);

      await Promise.all(
        batch.map(async (item) => {
          const json = JSON.stringify(item.value);
          const originalSize = json.length;

          const kvComp = new KVCompression(this.kv);
          await kvComp.set(item.key, item.value, {
            expirationTtl: item.ttl,
          });

          const stats = kvComp.getStats();
          if (stats.totalCompressed > 0) {
            compressed++;
            bytesSaved += stats.totalBytesSaved;
          }

          processed++;
        })
      );
    }

    return {
      processed,
      compressed,
      bytesSaved,
    };
  }

  /**
   * Decompress and retrieve multiple items
   */
  async decompressBatch<T = unknown>(
    keys: string[]
  ): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    for (let i = 0; i < keys.length; i += this.batchSize) {
      const batch = keys.slice(i, i + this.batchSize);

      const batchResults = await Promise.all(
        batch.map(async (key) => {
          const kvComp = new KVCompression(this.kv);
          const value = await kvComp.get<T>(key);
          return { key, value };
        })
      );

      for (const { key, value } of batchResults) {
        results.set(key, value);
      }
    }

    return results;
  }
}

/**
 * Create KV compression instance
 */
export function createKVCompression(
  kv: KVNamespace,
  options?: CompressionOptions
): KVCompression {
  return new KVCompression(kv, options);
}

/**
 * Compression level presets
 */
export const compressionPresets = {
  /** No compression */
  none: { enabled: false },

  /** Fast compression (threshold: 10KB) */
  fast: { enabled: true, threshold: 10240 },

  /** Balanced compression (threshold: 1KB) */
  balanced: { enabled: true, threshold: 1024 },

  /** Aggressive compression (threshold: 512B) */
  aggressive: { enabled: true, threshold: 512 },
};

/**
 * Estimate cost savings for KV compression
 */
export function estimateKVSavings(
  dataSize: number,
  compressionRatio: number = 3,
  monthlyReads: number = 1000000,
  monthlyWrites: number = 100000
): {
  originalStorage: number;
  compressedStorage: number;
  storageSavings: number;
  storageCost: { original: number; compressed: number; savings: number };
  totalMonthlySavings: number;
} {
  const originalStorage = dataSize;
  const compressedStorage = dataSize / compressionRatio;
  const storageSavings = originalStorage - compressedStorage;

  // Storage cost: $0.50 per GB per month
  const storageCost = {
    original: (originalStorage / (1024 * 1024 * 1024)) * 0.50,
    compressed: (compressedStorage / (1024 * 1024 * 1024)) * 0.50,
    savings: (storageSavings / (1024 * 1024 * 1024)) * 0.50,
  };

  // Read cost: $0.50 per million reads
  // Compression doesn't significantly affect reads
  const readCost = (monthlyReads / 1000000) * 0.50;

  // Write cost: $5.00 per million writes
  // Compression adds CPU overhead but same write cost
  const writeCost = (monthlyWrites / 1000000) * 5.00;

  const totalMonthlySavings = storageCost.savings;

  return {
    originalStorage,
    compressedStorage,
    storageSavings,
    storageCost,
    totalMonthlySavings,
  };
}
