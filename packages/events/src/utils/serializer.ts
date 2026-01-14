/**
 * Serialization utilities for events
 */

import type { EventEnvelope } from '../types';

// ============================================================================
// Event Serialization
// ============================================================================

/**
 * Serialize an event envelope to JSON
 */
export function serializeEvent<T = unknown>(event: EventEnvelope<T>): string {
  return JSON.stringify(event);
}

/**
 * Deserialize JSON to an event envelope
 */
export function deserializeEvent<T = unknown>(data: string): EventEnvelope<T> {
  return JSON.parse(data);
}

/**
 * Serialize multiple events
 */
export function serializeEvents<T = unknown>(events: EventEnvelope<T>[]): string {
  return JSON.stringify(events);
}

/**
 * Deserialize multiple events
 */
export function deserializeEvents<T = unknown>(data: string): EventEnvelope<T>[] {
  return JSON.parse(data);
}

// ============================================================================
// Binary Serialization
// ============================================================================

/**
 * Serialize an event to binary format (using MessagePack-like encoding)
 */
export function serializeEventBinary<T = unknown>(event: EventEnvelope<T>): Uint8Array {
  const json = JSON.stringify(event);
  return new TextEncoder().encode(json);
}

/**
 * Deserialize binary data to an event
 */
export function deserializeEventBinary<T = unknown>(data: Uint8Array): EventEnvelope<T> {
  const json = new TextDecoder().decode(data);
  return JSON.parse(json);
}

// ============================================================================
// Compression
// ============================================================================

/**
 * Compress an event using simple run-length encoding
 * Note: This is a simple implementation. For production, use a proper compression library.
 */
export function compressEvent<T = unknown>(event: EventEnvelope<T>): Uint8Array {
  const serialized = serializeEvent(event);
  return simpleCompress(serialized);
}

/**
 * Decompress an event
 */
export function decompressEvent<T = unknown>(data: Uint8Array): EventEnvelope<T> {
  const decompressed = simpleDecompress(data);
  return deserializeEvent(decompressed);
}

/**
 * Simple compression using repeated character elimination
 */
function simpleCompress(data: string): Uint8Array {
  const encoder = new TextEncoder();
  const input = encoder.encode(data);
  const output: number[] = [];

  let i = 0;
  while (i < input.length) {
    let count = 1;
    const byte = input[i];

    while (i + count < input.length && input[i + count] === byte && count < 255) {
      count++;
    }

    output.push(byte);
    if (count > 1) {
      output.push(count);
    }

    i += count;
  }

  return new Uint8Array(output);
}

/**
 * Simple decompression
 */
function simpleDecompress(data: Uint8Array): string {
  const output: number[] = [];

  let i = 0;
  while (i < data.length) {
    const byte = data[i];
    const nextByte = data[i + 1];

    if (nextByte && nextByte > 1 && nextByte < 255 && i + 2 < data.length) {
      // Repeated sequence
      for (let j = 0; j < nextByte; j++) {
        output.push(byte);
      }
      i += 2;
    } else {
      output.push(byte);
      i++;
    }
  }

  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(output));
}

// ============================================================================
// Event Transformation
// ============================================================================

/**
 * Transform event to a different format
 */
export function transformEvent<T = unknown, U = unknown>(
  event: EventEnvelope<T>,
  transformer: (payload: T) => U,
  newEventType?: string
): EventEnvelope<U> {
  return {
    metadata: {
      ...event.metadata,
      eventType: newEventType ?? event.metadata.eventType,
    },
    payload: transformer(event.payload),
  };
}

/**
 * Clone an event
 */
export function cloneEvent<T = unknown>(event: EventEnvelope<T>): EventEnvelope<T> {
  return JSON.parse(JSON.stringify(event));
}

// ============================================================================
// Batch Serialization
// ============================================================================

/**
 * Serialize a batch of events efficiently
 */
export function serializeEventBatch<T = unknown>(events: EventEnvelope<T>[]): Uint8Array {
  const serialized = events.map(serializeEvent);
  const lengths = serialized.map((s) => s.length);
  const combined = serialized.join('');

  const encoder = new TextEncoder();
  const data = encoder.encode(combined);

  // Prepend length information
  const header = new Uint8Array(lengths.length * 4);
  const view = new DataView(header.buffer);

  for (let i = 0; i < lengths.length; i++) {
    view.setUint32(i * 4, lengths[i], false);
  }

  const result = new Uint8Array(header.length + data.length);
  result.set(header);
  result.set(data, header.length);

  return result;
}

/**
 * Deserialize a batch of events
 */
export function deserializeEventBatch<T = unknown>(data: Uint8Array): EventEnvelope<T>[] {
  // Read header
  const eventCount = data.length / 4;
  const lengths: number[] = [];

  for (let i = 0; i < eventCount; i++) {
    const view = new DataView(data.buffer, i * 4, 4);
    const length = view.getUint32(0, false);
    lengths.push(length);
  }

  // Read events
  const decoder = new TextDecoder();
  let offset = eventCount * 4;
  const events: EventEnvelope<T>[] = [];

  for (const length of lengths) {
    const eventData = data.slice(offset, offset + length);
    const json = decoder.decode(eventData);
    events.push(JSON.parse(json));
    offset += length;
  }

  return events;
}

// ============================================================================
// Event Encoding
// ============================================================================

/**
 * Base64 encode an event
 */
export function encodeEventBase64<T = unknown>(event: EventEnvelope<T>): string {
  const serialized = serializeEvent(event);
  return btoa(serialized);
}

/**
 * Base64 decode an event
 */
export function decodeEventBase64<T = unknown>(encoded: string): EventEnvelope<T> {
  const serialized = atob(encoded);
  return deserializeEvent<T>(serialized);
}

/**
 * Hex encode an event
 */
export function encodeEventHex<T = unknown>(event: EventEnvelope<T>): string {
  const binary = serializeEventBinary(event);
  return Array.from(binary)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hex decode an event
 */
export function decodeEventHex<T = unknown>(encoded: string): EventEnvelope<T> {
  const binary = new Uint8Array(
    encoded.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
  );
  return deserializeEventBinary<T>(binary);
}

// ============================================================================
// Event Hashing
// ============================================================================

/**
 * Generate a hash of an event for integrity checking
 */
export function hashEvent<T = unknown>(event: EventEnvelope<T>): string {
  const serialized = serializeEvent(event);
  return simpleHash(serialized);
}

/**
 * Simple hash function for events
 */
function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Verify event integrity
 */
export function verifyEventIntegrity<T = unknown>(
  event: EventEnvelope<T>,
  expectedHash: string
): boolean {
  return hashEvent(event) === expectedHash;
}
