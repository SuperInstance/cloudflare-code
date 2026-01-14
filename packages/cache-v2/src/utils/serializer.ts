/**
 * Serialization utilities for cache values
 */

import { SerializationError, DeserializationError } from '../types';

// ============================================================================
// Compression Algorithms
// ============================================================================

/**
 * Compress data using gzip-like compression
 * Note: In a real implementation, this would use the CompressionStream API
 * or a compression library compatible with Cloudflare Workers
 */
export async function compress(data: string): Promise<Uint8Array> {
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);

    // Simple compression simulation
    // In production, use proper compression library
    if (typeof CompressionStream !== 'undefined') {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      await writer.write(bytes);
      await writer.close();

      const reader = stream.readable.getReader();
      const chunks: Uint8Array[] = [];
      let result = await reader.read();

      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const compressed = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }

      return compressed;
    }

    // Fallback: return uncompressed
    return bytes;
  } catch (error) {
    throw new SerializationError('', `Compression failed: ${error}`);
  }
}

/**
 * Decompress data
 */
export async function decompress(bytes: Uint8Array): Promise<string> {
  try {
    // Simple decompression simulation
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      await writer.write(bytes);
      await writer.close();

      const reader = stream.readable.getReader();
      const chunks: Uint8Array[] = [];
      let result = await reader.read();

      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const decompressed = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
      }

      const decoder = new TextDecoder();
      return decoder.decode(decompressed);
    }

    // Fallback: decode directly
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch (error) {
    throw new DeserializationError('', `Decompression failed: ${error}`);
  }
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize a value to a string
 */
export function serialize(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    throw new SerializationError('', `Serialization failed: ${error}`);
  }
}

/**
 * Deserialize a string to a value
 */
export function deserialize<T>(data: string): T {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    throw new DeserializationError('', `Deserialization failed: ${error}`);
  }
}

/**
 * Serialize with compression
 */
export async function serializeCompressed(value: any): Promise<Uint8Array> {
  const serialized = serialize(value);
  return compress(serialized);
}

/**
 * Deserialize with decompression
 */
export async function deserializeCompressed<T>(bytes: Uint8Array): Promise<T> {
  const decompressed = await decompress(bytes);
  return deserialize<T>(decompressed);
}

// ============================================================================
// Size Calculation
// ============================================================================

/**
 * Calculate the size of a value in bytes
 */
export function calculateSize(value: any): number {
  const serialized = serialize(value);
  return new Blob([serialized]).size;
}

/**
 * Calculate the size of a string in bytes
 */
export function calculateStringSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * Calculate the size of a Uint8Array
 */
export function calculateBytesSize(bytes: Uint8Array): number {
  return bytes.length;
}

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Generate a simple hash for a key
 */
export function generateHash(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a cache key from components
 */
export function generateCacheKey(prefix: string, ...parts: string[]): string {
  const sanitized = parts.map(p => p.replace(/[^a-zA-Z0-9_-]/g, '_'));
  return [prefix, ...sanitized].join(':');
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a cache key
 */
export function validateKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  if (key.length > 512) {
    return false;
  }
  if (!/^[a-zA-Z0-9_\-:./]+$/.test(key)) {
    return false;
  }
  return true;
}

/**
 * Validate cache tags
 */
export function validateTags(tags: string[]): boolean {
  if (!Array.isArray(tags)) {
    return false;
  }
  return tags.every(tag =>
    typeof tag === 'string' &&
    tag.length > 0 &&
    tag.length <= 64 &&
    /^[a-zA-Z0-9_\-]+$/.test(tag)
  );
}

/**
 * Validate TTL value
 */
export function validateTTL(ttl: number): boolean {
  return typeof ttl === 'number' && ttl > 0 && ttl <= 31536000; // Max 1 year
}

// ============================================================================
// Encoding Helpers
// ============================================================================

/**
 * Encode value for storage
 */
export function encodeValue(value: any): string {
  try {
    const serialized = serialize(value);
    return btoa(serialized);
  } catch (error) {
    throw new SerializationError('', `Encoding failed: ${error}`);
  }
}

/**
 * Decode value from storage
 */
export function decodeValue<T>(encoded: string): T {
  try {
    const decoded = atob(encoded);
    return deserialize<T>(decoded);
  } catch (error) {
    throw new DeserializationError('', `Decoding failed: ${error}`);
  }
}

/**
 * Safe base64 encoding
 */
export function base64Encode(data: string): string {
  try {
    return btoa(data);
  } catch (error) {
    throw new SerializationError('', `Base64 encoding failed: ${error}`);
  }
}

/**
 * Safe base64 decoding
 */
export function base64Decode(data: string): string {
  try {
    return atob(data);
  } catch (error) {
    throw new DeserializationError('', `Base64 decoding failed: ${error}`);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is serializable
 */
export function isSerializable(value: any): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a value is a plain object
 */
export function isPlainObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if a value is a date
 */
export function isDate(value: any): boolean {
  return value instanceof Date || (typeof value === 'object' && value.__type === 'Date');
}

/**
 * Check if a value is a buffer
 */
export function isBuffer(value: any): boolean {
  return value instanceof Uint8Array || ArrayBuffer.isView(value);
}

// ============================================================================
// Custom Type Handling
// ============================================================================

/**
 * Custom serializer that handles special types
 */
export function customSerialize(value: any): string {
  if (isDate(value)) {
    return JSON.stringify({ __type: 'Date', value: value.toISOString() });
  }
  if (isBuffer(value)) {
    return JSON.stringify({ __type: 'Buffer', value: Array.from(value) });
  }
  return serialize(value);
}

/**
 * Custom deserializer that handles special types
 */
export function customDeserialize<T>(data: string): T {
  const parsed = JSON.parse(data);
  if (parsed.__type === 'Date') {
    return new Date(parsed.value) as any;
  }
  if (parsed.__type === 'Buffer') {
    return new Uint8Array(parsed.value) as any;
  }
  return parsed as T;
}
