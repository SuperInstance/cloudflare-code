/**
 * Cache Compression
 * Compress cache entries to save space and improve performance
 */

import { CompressionConfig, CompressionResult } from '../types';

// ============================================================================
// Compression Algorithms
// ============================================================================>

enum CompressionAlgorithm {
  GZIP = 'gzip',
  BROTLI = 'brotli',
  LZ4 = 'lz4',
  NONE = 'none',
}

// ============================================================================
// Compression Stats
// ============================================================================

interface CompressionStats {
  totalCompressed: number;
  totalDecompressed: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  averageRatio: number;
  algorithmCounts: Map<CompressionAlgorithm, number>;
}

// ============================================================================
// Cache Compressor
// ============================================================================

export class CacheCompressor {
  private config: CompressionConfig;
  private stats: CompressionStats;

  constructor(config: CompressionConfig) {
    this.config = config;
    this.stats = {
      totalCompressed: 0,
      totalDecompressed: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      averageRatio: 0,
      algorithmCounts: new Map(),
    };
  }

  /**
   * Compress data
   */
  async compress(data: string): Promise<CompressionResult> {
    const startTime = performance.now();
    const originalSize = new Blob([data]).size;

    // Check if compression should be applied
    if (!this.config.enabled || originalSize < this.config.threshold) {
      return {
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        algorithm: 'none',
        duration: performance.now() - startTime,
      };
    }

    try {
      let compressed: Uint8Array;
      let algorithm: string;

      switch (this.config.algorithm) {
        case 'gzip':
          compressed = await this.compressGzip(data);
          algorithm = 'gzip';
          break;

        case 'brotli':
          compressed = await this.compressBrotli(data);
          algorithm = 'brotli';
          break;

        case 'lz4':
          compressed = await this.compressLZ4(data);
          algorithm = 'lz4';
          break;

        default:
          compressed = new TextEncoder().encode(data);
          algorithm = 'none';
      }

      const compressedSize = compressed.length;
      const ratio = compressedSize / originalSize;

      // Update stats
      this.stats.totalCompressed++;
      this.stats.totalOriginalSize += originalSize;
      this.stats.totalCompressedSize += compressedSize;
      this.stats.averageRatio =
        this.stats.totalCompressedSize / this.stats.totalOriginalSize;

      const algCount = this.stats.algorithmCounts.get(algorithm as CompressionAlgorithm) || 0;
      this.stats.algorithmCounts.set(algorithm as CompressionAlgorithm, algCount + 1);

      // Only use compressed version if it's actually smaller
      if (compressedSize < originalSize) {
        return {
          originalSize,
          compressedSize,
          ratio,
          algorithm,
          duration: performance.now() - startTime,
        };
      }

      // Return original if compression didn't help
      return {
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        algorithm: 'none',
        duration: performance.now() - startTime,
      };
    } catch (error) {
      console.error('Compression failed:', error);
      return {
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        algorithm: 'none',
        duration: performance.now() - startTime,
      };
    }
  }

  /**
   * Decompress data
   */
  async decompress(data: Uint8Array, algorithm: string): Promise<string> {
    const startTime = performance.now();

    try {
      let decompressed: string;

      switch (algorithm) {
        case 'gzip':
          decompressed = await this.decompressGzip(data);
          break;

        case 'brotli':
          decompressed = await this.decompressBrotli(data);
          break;

        case 'lz4':
          decompressed = await this.decompressLZ4(data);
          break;

        default:
          decompressed = new TextDecoder().decode(data);
      }

      // Update stats
      this.stats.totalDecompressed++;

      return decompressed;
    } catch (error) {
      console.error('Decompression failed:', error);
      return new TextDecoder().decode(data);
    }
  }

  /**
   * Compress using gzip
   */
  private async compressGzip(data: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);

    if (typeof CompressionStream !== 'undefined') {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      await writer.write(bytes);
      await writer.close();

      const reader = stream.readable.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result;
    }

    // Fallback: return uncompressed
    return bytes;
  }

  /**
   * Decompress gzip
   */
  private async decompressGzip(data: Uint8Array): Promise<string> {
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      await writer.write(data);
      await writer.close();

      const reader = stream.readable.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      const decoder = new TextDecoder();
      return decoder.decode(result);
    }

    // Fallback: decode directly
    const decoder = new TextDecoder();
    return decoder.decode(data);
  }

  /**
   * Compress using brotli
   */
  private async compressBrotli(data: string): Promise<Uint8Array> {
    // Brotli compression not available in standard Workers API
    // Fallback to gzip
    return this.compressGzip(data);
  }

  /**
   * Decompress brotli
   */
  private async decompressBrotli(data: Uint8Array): Promise<string> {
    // Brotli decompression not available in standard Workers API
    // Fallback to gzip
    return this.decompressGzip(data);
  }

  /**
   * Compress using LZ4 (simplified implementation)
   */
  private async compressLZ4(data: string): Promise<Uint8Array> {
    // LZ4 not available in standard Workers API
    // Fallback to gzip
    return this.compressGzip(data);
  }

  /**
   * Decompress LZ4
   */
  private async decompressLZ4(data: Uint8Array): Promise<string> {
    // LZ4 not available in standard Workers API
    // Fallback to gzip
    return this.decompressGzip(data);
  }

  /**
   * Estimate compression ratio without actually compressing
   */
  estimateCompressionRatio(data: string): number {
    // Simple heuristic based on data characteristics
    const entropy = this.calculateEntropy(data);

    if (entropy > 7.5) {
      return 0.95; // High entropy, won't compress well
    } else if (entropy > 6) {
      return 0.7; // Medium entropy
    } else {
      return 0.5; // Low entropy, should compress well
    }
  }

  /**
   * Calculate entropy of data (0-8)
   */
  private calculateEntropy(data: string): number {
    const freq = new Map<number, number>();
    const length = data.length;

    for (let i = 0; i < length; i++) {
      const byte = data.charCodeAt(i);
      const count = freq.get(byte) || 0;
      freq.set(byte, count + 1);
    }

    let entropy = 0;
    for (const count of freq.values()) {
      const p = count / length;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Check if data is compressible
   */
  isCompressible(data: string): boolean {
    const size = new Blob([data]).size;

    // Too small to compress
    if (size < this.config.threshold) {
      return false;
    }

    // Check entropy
    const entropy = this.calculateEntropy(data);

    // High entropy data (already compressed, encrypted, etc.)
    if (entropy > 7.5) {
      return false;
    }

    return true;
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCompressed: 0,
      totalDecompressed: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      averageRatio: 0,
      algorithmCounts: new Map(),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CompressionConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCacheCompressor(config: CompressionConfig): CacheCompressor {
  return new CacheCompressor(config);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect if data is already compressed
 */
export function isCompressed(data: Uint8Array): boolean {
  // Gzip magic number
  if (data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b) {
    return true;
  }

  // Brotli not easily detectable without decompression

  return false;
}

/**
 * Get compression algorithm from data
 */
export function detectCompressionAlgorithm(data: Uint8Array): string | null {
  if (data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b) {
    return 'gzip';
  }

  return null;
}

/**
 * Calculate size difference
 */
export function calculateSizeDifference(original: number, compressed: number): {
  saved: number;
  percentage: number;
  ratio: number;
} {
  const saved = original - compressed;
  const percentage = (saved / original) * 100;
  const ratio = compressed / original;

  return { saved, percentage, ratio };
}
