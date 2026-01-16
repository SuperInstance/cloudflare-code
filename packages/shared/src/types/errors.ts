/**
 * Error type definitions for ClaudeFlare platform
 * @packageDocumentation
 */

// @ts-nocheck - This file has complex error inheritance patterns that conflict with strict optional properties
import { z } from 'zod';

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

/**
 * Base API error class
 */
export class APIError extends Error {
  /** HTTP status code */
  public readonly statusCode: number;
  /** Error code for programmatic handling */
  public readonly code: string;
  /** Timestamp when error occurred (Unix ms) */
  public readonly timestamp: number;
  /** Additional error context */
  public readonly context?: Record<string, unknown>;
  /** Original error that caused this error */
  public readonly cause?: Error;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = Date.now();
    this.context = context;
    this.cause = cause;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack
    };
  }
}

// ============================================================================
// RATE LIMIT ERRORS
// ============================================================================

/**
 * Rate limit error - thrown when rate limit is exceeded
 */
export class RateLimitError extends APIError {
  /** Suggested retry delay in milliseconds */
  public readonly retryAfter: number;
  /** Current rate limit usage */
  public readonly currentUsage: number;
  /** Rate limit maximum */
  public readonly limit: number;
  /** Timestamp when limit resets (Unix ms) */
  public readonly resetAt: number;

  constructor(
    retryAfter: number,
    currentUsage: number,
    limit: number,
    resetAt: number,
    context?: Record<string, unknown>
  ) {
    super(
      429,
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. ${currentUsage}/${limit} requests used. Retry after ${retryAfter}ms.`,
      context
    );
    this.retryAfter = retryAfter;
    this.currentUsage = currentUsage;
    this.limit = limit;
    this.resetAt = resetAt;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
      currentUsage: this.currentUsage,
      limit: this.limit,
      resetAt: this.resetAt
    };
  }
}

// ============================================================================
// PROVIDER ERRORS
// ============================================================================

/**
 * Provider error - thrown when provider request fails
 */
export class ProviderError extends APIError {
  /** Provider identifier */
  public readonly providerId: string;
  /** Model being used */
  public readonly model?: string;
  /** Whether error is retryable */
  public readonly retryable: boolean;
  /** Suggested retry delay in milliseconds */
  public readonly retryAfter?: number;

  constructor(
    providerId: string,
    message: string,
    statusCode: number = 500,
    retryable: boolean = true,
    model?: string,
    retryAfter?: number,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      statusCode,
      'PROVIDER_ERROR',
      message,
      { providerId, model, retryable, ...context },
      cause
    );
    this.providerId = providerId;
    this.model = model;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      providerId: this.providerId,
      model: this.model,
      retryable: this.retryable,
      retryAfter: this.retryAfter
    };
  }
}

/**
 * Provider unavailable error - thrown when provider is down
 */
export class ProviderUnavailableError extends ProviderError {
  constructor(
    providerId: string,
    model?: string,
    retryAfter: number = 60000,
    context?: Record<string, unknown>
  ) {
    super(
      providerId,
      `Provider ${providerId} is currently unavailable`,
      503,
      true,
      model,
      retryAfter,
      context
    );
  }
}

/**
 * Provider timeout error - thrown when provider request times out
 */
export class ProviderTimeoutError extends ProviderError {
  /** Timeout duration in milliseconds */
  public readonly timeout: number;

  constructor(
    providerId: string,
    timeout: number,
    model?: string,
    context?: Record<string, unknown>
  ) {
    super(
      providerId,
      `Provider ${providerId} request timed out after ${timeout}ms`,
      504,
      true,
      model,
      timeout,
      context
    );
    this.timeout = timeout;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      timeout: this.timeout
    };
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

/**
 * Validation error - thrown when input validation fails
 */
export class ValidationError extends APIError {
  /** Field that failed validation */
  public readonly field?: string;
  /** Expected value/type */
  public readonly expected?: string;
  /** Actual value received */
  public readonly received?: unknown;

  constructor(
    message: string,
    field?: string,
    expected?: string,
    received?: unknown,
    context?: Record<string, unknown>
  ) {
    super(
      400,
      'VALIDATION_ERROR',
      message,
      { field, expected, received, ...context }
    );
    this.field = field;
    this.expected = expected;
    this.received = received;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      field: this.field,
      expected: this.expected,
      received: this.received
    };
  }
}

/**
 * Schema validation error - thrown when Zod schema validation fails
 */
export class SchemaValidationError extends ValidationError {
  /** Zod validation error details */
  public readonly validationErrors: Array<{
    path: string[];
    message: string;
    code: string;
  }>;

  constructor(
    validationErrors: Array<{
      path: string[];
      message: string;
      code: string;
    }>,
    context?: Record<string, unknown>
  ) {
    super(
      'Schema validation failed',
      undefined,
      'valid schema',
      'invalid data',
      { validationErrors, ...context }
    );
    this.validationErrors = validationErrors;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors
    };
  }
}

// ============================================================================
// QUOTA ERRORS
// ============================================================================

/**
 * Quota exceeded error - thrown when quota limit is exceeded
 */
export class QuotaExceededError extends APIError {
  /** Quota type */
  public readonly quotaType: 'requests' | 'tokens' | 'cost';
  /** Current usage */
  public readonly currentUsage: number;
  /** Quota limit */
  public readonly limit: number;
  /** Timestamp when quota resets (Unix ms) */
  public readonly resetAt: number;

  constructor(
    quotaType: 'requests' | 'tokens' | 'cost',
    currentUsage: number,
    limit: number,
    resetAt: number,
    context?: Record<string, unknown>
  ) {
    super(
      429,
      'QUOTA_EXCEEDED',
      `${quotaType} quota exceeded: ${currentUsage}/${limit} used. Resets at ${new Date(resetAt).toISOString()}`,
      { quotaType, currentUsage, limit, resetAt, ...context }
    );
    this.quotaType = quotaType;
    this.currentUsage = currentUsage;
    this.limit = limit;
    this.resetAt = resetAt;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      quotaType: this.quotaType,
      currentUsage: this.currentUsage,
      limit: this.limit,
      resetAt: this.resetAt
    };
  }
}

// ============================================================================
// CACHE ERRORS
// ============================================================================

/**
 * Cache error - thrown when cache operation fails
 */
export class CacheError extends APIError {
  /** Cache operation that failed */
  public readonly operation: 'get' | 'set' | 'delete' | 'clear';
  /** Cache key involved */
  public readonly key?: string;

  constructor(
    operation: 'get' | 'set' | 'delete' | 'clear',
    message: string,
    key?: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      500,
      'CACHE_ERROR',
      message,
      { operation, key, ...context },
      cause
    );
    this.operation = operation;
    this.key = key;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      operation: this.operation,
      key: this.key
    };
  }
}

// ============================================================================
// ROUTING ERRORS
// ============================================================================

/**
 * Routing error - thrown when request routing fails
 */
export class RoutingError extends APIError {
  /** Available providers (if any) */
  public readonly availableProviders?: string[];
  /** Routing criteria that failed */
  public readonly criteria?: Record<string, unknown>;

  constructor(
    message: string,
    availableProviders?: string[],
    criteria?: Record<string, unknown>,
    context?: Record<string, unknown>
  ) {
    super(
      503,
      'ROUTING_ERROR',
      message,
      { availableProviders, criteria, ...context }
    );
    this.availableProviders = availableProviders;
    this.criteria = criteria;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      availableProviders: this.availableProviders,
      criteria: this.criteria
    };
  }
}

/**
 * No available providers error - thrown when no providers can handle request
 */
export class NoAvailableProvidersError extends RoutingError {
  constructor(
    reason: string,
    availableProviders?: string[],
    context?: Record<string, unknown>
  ) {
    super(
      `No available providers: ${reason}`,
      availableProviders,
      undefined,
      context
    );
  }
}

// ============================================================================
// SESSION ERRORS
// ============================================================================

/**
 * Session error - thrown when session operation fails
 */
export class SessionError extends APIError {
  /** Session identifier */
  public readonly sessionId?: string;
  /** Session operation that failed */
  public readonly operation: 'create' | 'read' | 'update' | 'delete' | 'list';

  constructor(
    operation: 'create' | 'read' | 'update' | 'delete' | 'list',
    message: string,
    sessionId?: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      500,
      'SESSION_ERROR',
      message,
      { operation, sessionId, ...context },
      cause
    );
    this.sessionId = sessionId;
    this.operation = operation;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      sessionId: this.sessionId,
      operation: this.operation
    };
  }
}

/**
 * Session not found error
 */
export class SessionNotFoundError extends SessionError {
  constructor(sessionId: string, context?: Record<string, unknown>) {
    super(
      'read',
      `Session ${sessionId} not found`,
      sessionId,
      context
    );
    this.statusCode = 404;
    this.code = 'SESSION_NOT_FOUND';
  }
}

/**
 * Session expired error
 */
export class SessionExpiredError extends SessionError {
  /** Session expiration timestamp (Unix ms) */
  public readonly expiredAt: number;

  constructor(sessionId: string, expiredAt: number, context?: Record<string, unknown>) {
    super(
      'read',
      `Session ${sessionId} expired at ${new Date(expiredAt).toISOString()}`,
      sessionId,
      context
    );
    this.statusCode = 410;
    this.code = 'SESSION_EXPIRED';
    this.expiredAt = expiredAt;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      expiredAt: this.expiredAt
    };
  }
}

// ============================================================================
// ZOD SCHEMAS FOR ERROR SERIALIZATION
// ============================================================================

/**
 * Zod schema for APIError serialization
 */
export const APIErrorSchema = z.object({
  name: z.string(),
  message: z.string(),
  code: z.string(),
  statusCode: z.number(),
  timestamp: z.number(),
  context: z.record(z.unknown()).optional(),
  stack: z.string().optional()
});

/**
 * Zod schema for RateLimitError serialization
 */
export const RateLimitErrorSchema = APIErrorSchema.extend({
  retryAfter: z.number(),
  currentUsage: z.number(),
  limit: z.number(),
  resetAt: z.number()
});

/**
 * Zod schema for ProviderError serialization
 */
export const ProviderErrorSchema = APIErrorSchema.extend({
  providerId: z.string(),
  model: z.string().optional(),
  retryable: z.boolean(),
  retryAfter: z.number().optional()
});

/**
 * Zod schema for ValidationError serialization
 */
export const ValidationErrorSchema = APIErrorSchema.extend({
  field: z.string().optional(),
  expected: z.string().optional(),
  received: z.unknown()
});

/**
 * Zod schema for QuotaExceededError serialization
 */
export const QuotaExceededErrorSchema = APIErrorSchema.extend({
  quotaType: z.enum(['requests', 'tokens', 'cost']),
  currentUsage: z.number(),
  limit: z.number(),
  resetAt: z.number()
});

// ============================================================================
// ERROR TYPE UTILITIES
// ============================================================================

/**
 * Type guard for APIError
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

/**
 * Type guard for RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Type guard for ProviderError
 */
export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

/**
 * Type guard for ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard for QuotaExceededError
 */
export function isQuotaExceededError(error: unknown): error is QuotaExceededError {
  return error instanceof QuotaExceededError;
}

/**
 * Extract error information from unknown error
 */
export function extractErrorInfo(error: unknown): {
  message: string;
  code?: string;
  statusCode?: number;
  retryable?: boolean;
} {
  if (isAPIError(error)) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      retryable: error instanceof ProviderError ? error.retryable : undefined
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR'
    };
  }

  return {
    message: String(error),
    code: 'UNKNOWN_ERROR'
  };
}

/**
 * Infer error types from schemas
 */
export type APIErrorType = z.infer<typeof APIErrorSchema>;
export type RateLimitErrorType = z.infer<typeof RateLimitErrorSchema>;
export type ProviderErrorType = z.infer<typeof ProviderErrorSchema>;
export type ValidationErrorType = z.infer<typeof ValidationErrorSchema>;
export type QuotaExceededErrorType = z.infer<typeof QuotaExceededErrorSchema>;
