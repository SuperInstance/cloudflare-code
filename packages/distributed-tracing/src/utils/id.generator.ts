/**
 * ID generation utilities for distributed tracing
 * Generates compliant trace and span IDs according to OpenTelemetry spec
 */

import { TraceId, SpanId } from '../types/trace.types';
import { customAlphabet } from 'nanoid';

/**
 * Generate a valid trace ID (16 bytes, 32 hex characters)
 */
export function generateTraceId(): TraceId {
  // Generate 16 random bytes
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Convert to hex string
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a valid span ID (8 bytes, 16 hex characters)
 */
export function generateSpanId(): SpanId {
  // Generate 8 random bytes
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  // Convert to hex string
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate trace ID format
 */
export function isValidTraceId(traceId: string): traceId is TraceId {
  return /^[0-9a-f]{32}$/i.test(traceId);
}

/**
 * Validate span ID format
 */
export function isValidSpanId(spanId: string): spanId is SpanId {
  return /^[0-9a-f]{16}$/i.test(spanId);
}

/**
 * Generate a deterministic trace ID from a string
 */
export function traceIdFromString(input: string): TraceId {
  // Simple hash function for deterministic ID generation
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Use the hash as a seed for deterministic random generation
  const seed = Math.abs(hash);
  const bytes = new Uint8Array(16);

  // Simple seeded random generator
  let state = seed;
  for (let i = 0; i < 16; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    bytes[i] = state % 256;
  }

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a short, human-readable ID for debugging
 */
const shortIdGenerator = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);

export function generateShortId(): string {
  return shortIdGenerator();
}

/**
 * Extract timestamp from trace ID (if encoded)
 * Note: This is a custom encoding, not part of OpenTelemetry spec
 */
export function extractTimestampFromTraceId(traceId: TraceId): number | null {
  try {
    // First 8 bytes could encode a timestamp
    const timestampBytes = traceId.substring(0, 16);
    const timestamp = parseInt(timestampBytes, 16);
    return timestamp;
  } catch {
    return null;
  }
}

/**
 * Encode timestamp in trace ID
 * Note: This is a custom encoding, not part of OpenTelemetry spec
 */
export function encodeTimestampInTraceId(timestamp: number): TraceId {
  // First 8 bytes for timestamp
  const timestampHex = timestamp.toString(16).padStart(16, '0');

  // Last 8 bytes random
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timestampHex + randomHex;
}

/**
 * Generate a batch of trace IDs
 */
export function generateTraceIdBatch(count: number): TraceId[] {
  const ids: TraceId[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateTraceId());
  }
  return ids;
}

/**
 * Generate a batch of span IDs
 */
export function generateSpanIdBatch(count: number): SpanId[] {
  const ids: SpanId[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateSpanId());
  }
  return ids;
}

/**
 * Compare two trace IDs
 */
export function compareTraceIds(a: TraceId, b: TraceId): number {
  return a.localeCompare(b, 'en', { numeric: true });
}

/**
 * Compare two span IDs
 */
export function compareSpanIds(a: SpanId, b: SpanId): number {
  return a.localeCompare(b, 'en', { numeric: true });
}
