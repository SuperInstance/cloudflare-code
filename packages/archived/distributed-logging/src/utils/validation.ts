/**
 * Validation utilities for log entries and queries
 */

import { z } from 'zod';
import { LogLevel, LogEntry, LogFilter, SearchQuery, TimeRange } from '../types';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Zod schema for log metadata
 */
const LogMetadataSchema: z.ZodType<Record<string, any>> = z.record(
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.lazy(() => LogMetadataSchema)])
);

/**
 * Zod schema for log context
 */
const LogContextSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  requestId: z.string().optional(),
  tenantId: z.string().optional(),
  workflowId: z.string().optional(),
  deploymentId: z.string().optional(),
  buildId: z.string().optional(),
});

/**
 * Zod schema for error info
 */
const ErrorInfoSchema = z.object({
  name: z.string(),
  message: z.string(),
  code: z.string().optional(),
  stack: z.string().optional(),
  cause: z.lazy(() => ErrorInfoSchema.optional()),
});

/**
 * Zod schema for log entry
 */
export const LogEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number().int().positive(),
  level: z.nativeEnum(LogLevel),
  message: z.string().min(1).max(10000),
  metadata: LogMetadataSchema.optional(),
  context: LogContextSchema.optional(),
  tags: z.array(z.string()).optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  parentSpanId: z.string().optional(),
  service: z.string().min(1).max(255),
  host: z.string().optional(),
  environment: z.string().optional(),
  stackTrace: z.string().optional(),
  error: ErrorInfoSchema.optional(),
});

/**
 * Zod schema for log filter
 */
export const LogFilterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    'eq',
    'ne',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'not_in',
    'regex',
    'exists',
    'not_exists',
  ]),
  value: z.any(),
});

/**
 * Zod schema for time range
 */
export const TimeRangeSchema = z.object({
  start: z.number().int().positive(),
  end: z.number().int().positive(),
});

/**
 * Zod schema for search query
 */
export const SearchQuerySchema = z.object({
  query: z.string().max(1000).optional(),
  filters: z.array(LogFilterSchema).optional(),
  timeRange: TimeRangeSchema.optional(),
  level: z.nativeEnum(LogLevel).optional(),
  limit: z.number().int().positive().max(10000).optional(),
  offset: z.number().int().nonnegative().optional(),
  sortBy: z.enum(['timestamp', 'level', 'service', 'message', 'duration']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  highlight: z.boolean().optional(),
  aggregations: z.array(z.any()).optional(),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a log entry
 */
export function validateLogEntry(entry: unknown): { valid: boolean; errors?: string[] } {
  const result = LogEntrySchema.safeParse(entry);

  if (result.success) {
    return { valid: true };
  }

  const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
  return { valid: false, errors };
}

/**
 * Validate multiple log entries
 */
export function validateLogEntries(entries: unknown[]): {
  valid: boolean;
  errors: Array<{ index: number; errors: string[] }>;
} {
  const allErrors: Array<{ index: number; errors: string[] }> = [];

  entries.forEach((entry, index) => {
    const result = validateLogEntry(entry);
    if (!result.valid && result.errors) {
      allErrors.push({ index, errors: result.errors });
    }
  });

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Validate a search query
 */
export function validateSearchQuery(query: unknown): { valid: boolean; errors?: string[] } {
  const result = SearchQuerySchema.safeParse(query);

  if (result.success) {
    // Additional validation
    const errors: string[] = [];

    if (result.data.timeRange) {
      if (result.data.timeRange.start >= result.data.timeRange.end) {
        errors.push('timeRange.start must be less than timeRange.end');
      }
    }

    if (result.data.offset && result.data.limit) {
      if (result.data.offset >= 10000) {
        errors.push('offset must be less than 10000');
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true };
  }

  const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
  return { valid: false, errors };
}

/**
 * Validate a time range
 */
export function validateTimeRange(timeRange: TimeRange): { valid: boolean; error?: string } {
  if (timeRange.start < 0) {
    return { valid: false, error: 'start timestamp must be positive' };
  }

  if (timeRange.end < 0) {
    return { valid: false, error: 'end timestamp must be positive' };
  }

  if (timeRange.start >= timeRange.end) {
    return { valid: false, error: 'start must be less than end' };
  }

  // Check if range is reasonable (not more than 1 year)
  const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (timeRange.end - timeRange.start > maxRange) {
    return { valid: false, error: 'time range cannot exceed 1 year' };
  }

  return { valid: true };
}

/**
 * Sanitize log message to prevent injection attacks
 */
export function sanitizeMessage(message: string): string {
  // Remove potential control characters
  let sanitized = message.replace(/[\x00-\x1F\x7F]/g, '');

  // Limit length
  const maxLength = 10000;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '... (truncated)';
  }

  return sanitized;
}

/**
 * Validate service name
 */
export function validateServiceName(service: string): { valid: boolean; error?: string } {
  if (!service || service.length === 0) {
    return { valid: false, error: 'service name cannot be empty' };
  }

  if (service.length > 255) {
    return { valid: false, error: 'service name cannot exceed 255 characters' };
  }

  // Only allow alphanumeric, hyphens, and underscores
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(service)) {
    return {
      valid: false,
      error: 'service name can only contain alphanumeric characters, hyphens, and underscores',
    };
  }

  return { valid: true };
}

/**
 * Validate trace ID format
 */
export function validateTraceId(traceId: string): boolean {
  // Trace IDs should be hex strings, typically 16 or 32 bytes
  const traceIdPattern = /^[a-f0-9]{32,64}$/i;
  return traceIdPattern.test(traceId);
}

/**
 * Validate span ID format
 */
export function validateSpanId(spanId: string): boolean {
  // Span IDs should be 16 hex characters
  const spanIdPattern = /^[a-f0-9]{16}$/i;
  return spanIdPattern.test(spanId);
}
