/**
 * Validation utilities for events
 */

import { z } from 'zod';
import type { EventEnvelope, EventMetadata, ValidationResult } from '../types';

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validate an event against a Zod schema
 */
export function validateEvent<T = unknown>(
  event: EventEnvelope<T>,
  schema: z.ZodTypeAny
): ValidationResult {
  try {
    schema.parse(event.payload);
    return {
      valid: true,
      errors: [],
      warnings: [],
      timestamp: Date.now(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
          severity: 'error' as const,
        })),
        warnings: [],
        timestamp: Date.now(),
      };
    }
    return {
      valid: false,
      errors: [
        {
          field: 'payload',
          message: 'Unknown validation error',
          code: 'unknown_error',
          severity: 'error',
        },
      ],
      warnings: [],
      timestamp: Date.now(),
    };
  }
}

/**
 * Validate event metadata
 */
export function validateMetadata(metadata: Partial<EventMetadata>): ValidationResult {
  const errors: Array<{ field: string; message: string; code: string; severity: 'error' }> = [];

  if (!metadata.eventId) {
    errors.push({ field: 'eventId', message: 'Event ID is required', code: 'required', severity: 'error' });
  }
  if (!metadata.eventType) {
    errors.push({ field: 'eventType', message: 'Event type is required', code: 'required', severity: 'error' });
  }
  if (!metadata.timestamp) {
    errors.push({ field: 'timestamp', message: 'Timestamp is required', code: 'required', severity: 'error' });
  }
  if (metadata.version === undefined || metadata.version === null) {
    errors.push({ field: 'version', message: 'Version is required', code: 'required', severity: 'error' });
  }
  if (!metadata.source) {
    errors.push({ field: 'source', message: 'Source is required', code: 'required', severity: 'error' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    timestamp: Date.now(),
  };
}

// ============================================================================
// Event Version Compatibility
// ============================================================================

/**
 * Check if an event version is backward compatible
 */
export function isBackwardCompatible(
  fromVersion: number,
  toVersion: number,
  schemaChanges: Array<{ type: 'add' | 'remove' | 'modify'; field: string }>
): boolean {
  // Newer versions should not remove or modify existing fields
  if (toVersion <= fromVersion) {
    return false;
  }

  const breakingChanges = schemaChanges.filter(
    (change) => change.type === 'remove' || change.type === 'modify'
  );

  return breakingChanges.length === 0;
}

/**
 * Check if an event version is forward compatible
 */
export function isForwardCompatible(
  fromVersion: number,
  toVersion: number,
  schemaChanges: Array<{ type: 'add' | 'remove' | 'modify'; field: string }>
): boolean {
  // Older versions should not have fields removed in newer versions
  if (toVersion <= fromVersion) {
    return false;
  }

  const removedFields = schemaChanges.filter((change) => change.type === 'remove');
  return removedFields.length === 0;
}

// ============================================================================
// Event Filtering
// ============================================================================

/**
 * Check if an event matches a filter
 */
export function eventMatchesFilter(
  event: EventEnvelope,
  filter: {
    eventType?: string | string[] | RegExp;
    correlationId?: string;
    userId?: string;
    fromTimestamp?: number;
    toTimestamp?: number;
  }
): boolean {
  // Check event type
  if (filter.eventType) {
    if (typeof filter.eventType === 'string') {
      if (event.metadata.eventType !== filter.eventType) {
        return false;
      }
    } else if (Array.isArray(filter.eventType)) {
      if (!filter.eventType.includes(event.metadata.eventType)) {
        return false;
      }
    } else if (filter.eventType instanceof RegExp) {
      if (!filter.eventType.test(event.metadata.eventType)) {
        return false;
      }
    }
  }

  // Check correlation ID
  if (filter.correlationId && event.metadata.correlationId !== filter.correlationId) {
    return false;
  }

  // Check user ID
  if (filter.userId && event.metadata.userId !== filter.userId) {
    return false;
  }

  // Check timestamp range
  if (filter.fromTimestamp && event.metadata.timestamp < filter.fromTimestamp) {
    return false;
  }
  if (filter.toTimestamp && event.metadata.timestamp > filter.toTimestamp) {
    return false;
  }

  return true;
}

// ============================================================================
// Event Enrichment
// ============================================================================

/**
 * Add default metadata to an event
 */
export function enrichMetadata(metadata: Partial<EventMetadata>): EventMetadata {
  return {
    eventId: metadata.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2)}`,
    eventType: metadata.eventType || 'unknown',
    timestamp: metadata.timestamp || Date.now(),
    causationId: metadata.causationId,
    correlationId: metadata.correlationId || metadata.causationId,
    version: metadata.version ?? 1,
    source: metadata.source || 'unknown',
    userId: metadata.userId,
    traceId: metadata.traceId,
  };
}

// ============================================================================
// Event Transformation
// ============================================================================

/**
 * Transform an event payload based on a schema migration
 */
export function migrateEvent(
  payload: unknown,
  fromVersion: number,
  toVersion: number,
  migrations: Array<{
    version: number;
    transform: (payload: unknown) => unknown;
  }>
): unknown {
  let current = payload;
  const sortedMigrations = migrations
    .filter((m) => m.version > fromVersion && m.version <= toVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of sortedMigrations) {
    current = migration.transform(current);
  }

  return current;
}

// ============================================================================
// Event Deduplication
// ============================================================================

/**
 * Generate a deduplication key for an event
 */
export function generateDeduplicationKey(event: EventEnvelope): string {
  const key = `${event.metadata.eventType}_${JSON.stringify(event.payload)}`;
  return simpleHash(key);
}

/**
 * Simple hash function for deduplication
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Event Ordering
// ============================================================================

/**
 * Compare events for ordering
 */
export function compareEvents(a: EventEnvelope, b: EventEnvelope): number {
  // First compare by timestamp
  const timeDiff = a.metadata.timestamp - b.metadata.timestamp;
  if (timeDiff !== 0) {
    return timeDiff;
  }

  // If timestamps are equal, compare by event ID
  return a.metadata.eventId.localeCompare(b.metadata.eventId);
}

/**
 * Sort events by timestamp and ID
 */
export function sortEvents(events: EventEnvelope[]): EventEnvelope[] {
  return [...events].sort(compareEvents);
}

// ============================================================================
// Event Size Validation
// ============================================================================

/**
 * Calculate the size of an event in bytes
 */
export function calculateEventSize(event: EventEnvelope): number {
  return JSON.stringify(event).length;
}

/**
 * Check if an event exceeds maximum size
 */
export function exceedsMaxSize(event: EventEnvelope, maxSizeBytes: number): boolean {
  return calculateEventSize(event) > maxSizeBytes;
}

// ============================================================================
// Event Time-to-Live
// ============================================================================

/**
 * Check if an event has expired
 */
export function isEventExpired(event: EventEnvelope, ttlMs: number): boolean {
  const age = Date.now() - event.metadata.timestamp;
  return age > ttlMs;
}

/**
 * Filter out expired events
 */
export function filterExpiredEvents(events: EventEnvelope[], ttlMs: number): EventEnvelope[] {
  return events.filter((event) => !isEventExpired(event, ttlMs));
}
