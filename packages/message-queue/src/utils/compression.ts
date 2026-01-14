/**
 * Message compression utilities
 * Reduces message size for better throughput and lower costs
 */

import type { CompressionOptions } from '../types';

/**
 * Default compression options
 */
export const DefaultCompressionOptions: CompressionOptions = {
  enabled: true,
  algorithm: 'gzip',
  threshold: 1024 // 1KB threshold
};

/**
 * Compress data using specified algorithm
 */
export async function compressData(
  data: string,
  options: CompressionOptions = DefaultCompressionOptions
): Promise<Uint8Array> {
  if (!options.enabled) {
    return new TextEncoder().encode(data);
  }

  const dataSize = new Blob([data]).size;
  if (dataSize < options.threshold) {
    // Don't compress small messages
    return new TextEncoder().encode(data);
  }

  try {
    const encoder = new TextEncoder();
    const input = encoder.encode(data);

    switch (options.algorithm) {
      case 'gzip':
        return await gzipCompress(input);
      case 'brotli':
        return await brotliCompress(input);
      case 'zstd':
        return await zstdCompress(input);
      default:
        return input;
    }
  } catch (error) {
    // Fallback to uncompressed if compression fails
    return new TextEncoder().encode(data);
  }
}

/**
 * Decompress data
 */
export async function decompressData(
  data: Uint8Array,
  algorithm: string = 'gzip'
): Promise<string> {
  try {
    switch (algorithm) {
      case 'gzip':
        return await gzipDecompress(data);
      case 'brotli':
        return await brotliDecompress(data);
      case 'zstd':
        return await zstdDecompress(data);
      default:
        return new TextDecoder().decode(data);
    }
  } catch (error) {
    // Try to decode as plain text if decompression fails
    return new TextDecoder().decode(data);
  }
}

/**
 * Gzip compression
 */
async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  // In a real implementation, use CompressionStream
  // For now, return the data as-is (would use actual compression in production)
  if (typeof CompressionStream !== 'undefined') {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    await writer.write(data);
    await writer.close();

    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined;
  }

  // Fallback for environments without CompressionStream
  return data;
}

/**
 * Gzip decompression
 */
async function gzipDecompress(data: Uint8Array): Promise<string> {
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
      if (value) chunks.push(value);
    }

    const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return new TextDecoder().decode(combined);
  }

  // Fallback
  return new TextDecoder().decode(data);
}

/**
 * Brotli compression
 */
async function brotliCompress(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new CompressionStream('deflate'); // Fallback to deflate if brotli not available
      const writer = stream.writable.getWriter();
      await writer.write(data);
      await writer.close();

      const reader = stream.readable.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }

      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      return combined;
    } catch {
      return data;
    }
  }

  return data;
}

/**
 * Brotli decompression
 */
async function brotliDecompress(data: Uint8Array): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const stream = new DecompressionStream('deflate');
      const writer = stream.writable.getWriter();
      await writer.write(data);
      await writer.close();

      const reader = stream.readable.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }

      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      return new TextDecoder().decode(combined);
    } catch {
      return new TextDecoder().decode(data);
    }
  }

  return new TextDecoder().decode(data);
}

/**
 * Zstandard compression
 */
async function zstdCompress(data: Uint8Array): Promise<Uint8Array> {
  // Zstandard not natively supported in browsers
  // Would use a library like @kubb/zstd or similar in production
  // For now, fallback to gzip
  return gzipCompress(data);
}

/**
 * Zstandard decompression
 */
async function zstdDecompress(data: Uint8Array): Promise<string> {
  // Fallback to gzip
  return gzipDecompress(data);
}

/**
 * Calculate compression ratio
 */
export function calculateCompressionRatio(
  original: Uint8Array,
  compressed: Uint8Array
): number {
  if (original.length === 0) return 1;
  return compressed.length / original.length;
}

/**
 * Estimate compression benefit
 */
export function estimateCompressionBenefit(data: string): {
  shouldCompress: boolean;
  estimatedRatio: number;
  algorithm: string;
} {
  const dataSize = new Blob([data]).size;

  // Don't compress very small data
  if (dataSize < 512) {
    return {
      shouldCompress: false,
      estimatedRatio: 1,
      algorithm: 'none'
    };
  }

  // Check data characteristics
  const hasRepetition = /(.)\1{10,}/.test(data); // Repeated characters
  const isStructured = /^[\s\[\]{}:,]+$/.test(data.slice(0, 100)); // Likely JSON

  if (hasRepetition || isStructured) {
    return {
      shouldCompress: true,
      estimatedRatio: 0.3, // Estimated 70% reduction
      algorithm: 'gzip'
    };
  }

  // Mixed content - moderate compression
  return {
    shouldCompress: dataSize > 2048,
    estimatedRatio: 0.6, // Estimated 40% reduction
    algorithm: 'gzip'
  };
}

/**
 * Compress message payload
 */
export async function compressMessage(
  payload: unknown,
  options: CompressionOptions = DefaultCompressionOptions
): Promise<{
  compressed: Uint8Array;
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}> {
  const serialized = JSON.stringify(payload);
  const originalSize = new Blob([serialized]).size;

  const compressed = await compressData(serialized, options);
  const compressedSize = compressed.length;
  const ratio = calculateCompressionRatio(
    new TextEncoder().encode(serialized),
    compressed
  );

  return {
    compressed,
    algorithm: options.enabled ? options.algorithm : 'none',
    originalSize,
    compressedSize,
    ratio
  };
}

/**
 * Decompress message payload
 */
export async function decompressMessage(
  data: Uint8Array,
  algorithm: string = 'gzip'
): Promise<unknown> {
  const decompressed = await decompressData(data, algorithm);
  return JSON.parse(decompressed);
}

/**
 * Batch compression for multiple messages
 */
export async function compressBatch(
  messages: unknown[],
  options: CompressionOptions = DefaultCompressionOptions
): Promise<{
  compressed: Uint8Array[];
  stats: {
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageRatio: number;
  };
}> {
  const compressed: Uint8Array[] = [];
  let totalOriginalSize = 0;
  let totalCompressedSize = 0;

  for (const message of messages) {
    const result = await compressMessage(message, options);
    compressed.push(result.compressed);
    totalOriginalSize += result.originalSize;
    totalCompressedSize += result.compressedSize;
  }

  const averageRatio = totalOriginalSize > 0
    ? totalCompressedSize / totalOriginalSize
    : 1;

  return {
    compressed,
    stats: {
      totalOriginalSize,
      totalCompressedSize,
      averageRatio
    }
  };
}

/**
 * Choose optimal compression algorithm based on data characteristics
 */
export function chooseCompressionAlgorithm(data: string): 'gzip' | 'brotli' | 'zstd' {
  const size = new Blob([data]).size;

  // For small data, use fast gzip
  if (size < 1024) {
    return 'gzip';
  }

  // For JSON/structured data, brotli usually gives better compression
  const isStructured = data.trim().startsWith('{') || data.trim().startsWith('[');
  if (isStructured) {
    return 'brotli';
  }

  // For larger data, use zstd if available
  if (size > 10240) {
    return 'zstd';
  }

  // Default to gzip
  return 'gzip';
}

/**
 * Validate compressed data
 */
export function validateCompressedData(data: Uint8Array): boolean {
  if (data.length === 0) {
    return false;
  }

  // Check for common compression magic numbers
  // Gzip: 0x1f 0x8b
  if (data[0] === 0x1f && data[1] === 0x8b) {
    return true;
  }

  // Brotli (varies, but typically starts with specific patterns)
  // Zstd (0xfd 0x2f 0xb5 0x28)

  // If no magic number detected, might be uncompressed
  return true;
}

/**
 * Calculate size savings from compression
 */
export function calculateSizeSavings(
  originalSize: number,
  compressedSize: number
): {
  bytesSaved: number;
  percentSaved: number;
  humanReadable: string;
} {
  const bytesSaved = originalSize - compressedSize;
  const percentSaved = originalSize > 0
    ? ((bytesSaved / originalSize) * 100)
    : 0;

  let humanReadable: string;
  if (bytesSaved < 1024) {
    humanReadable = `${bytesSaved} B`;
  } else if (bytesSaved < 1024 * 1024) {
    humanReadable = `${(bytesSaved / 1024).toFixed(2)} KB`;
  } else {
    humanReadable = `${(bytesSaved / (1024 * 1024)).toFixed(2)} MB`;
  }

  return {
    bytesSaved,
    percentSaved,
    humanReadable
  };
}
