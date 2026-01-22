import type { ErrorResponse } from '../types/index';
import { ErrorCode, HttpStatus } from '../types/index';

/**
 * Application Error with structured error response
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON error response
   */
  toJSON(requestId: string): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId,
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION_ERROR, message, HttpStatus.BAD_REQUEST, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with id '${identifier}' not found`
      : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden Error
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
    this.name = 'ForbiddenError';
  }
}

/**
 * Rate Limit Error
 */
export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      HttpStatus.TOO_MANY_REQUESTS,
      { retryAfter }
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Internal Server Error
 */
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(ErrorCode.INTERNAL_ERROR, message, HttpStatus.INTERNAL_SERVER_ERROR, details);
    this.name = 'InternalServerError';
  }
}

/**
 * Service Unavailable Error
 */
export class ServiceUnavailableError extends AppError {
  constructor(service?: string) {
    const message = service
      ? `Service '${service}' is currently unavailable`
      : 'Service temporarily unavailable';
    super(ErrorCode.SERVICE_UNAVAILABLE, message, HttpStatus.SERVICE_UNAVAILABLE);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Timeout Error
 */
export class TimeoutError extends AppError {
  constructor(operation?: string) {
    const message = operation
      ? `Operation '${operation}' timed out`
      : 'Operation timed out';
    super(ErrorCode.TIMEOUT, message, HttpStatus.GATEWAY_TIMEOUT);
    this.name = 'TimeoutError';
  }
}

/**
 * Upstream Error
 */
export class UpstreamError extends AppError {
  constructor(provider: string, originalError?: string) {
    super(
      ErrorCode.UPSTREAM_ERROR,
      `Error communicating with ${provider}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      { provider, originalError }
    );
    this.name = 'UpstreamError';
  }
}

/**
 * Not Implemented Error
 */
export class NotImplemented extends AppError {
  constructor(feature: string) {
    super(
      ErrorCode.NOT_IMPLEMENTED,
      `${feature} is not yet implemented`,
      HttpStatus.NOT_IMPLEMENTED
    );
    this.name = 'NotImplemented';
  }
}

/**
 * Assert a condition is true, throw ValidationError if not
 */
export function assert(
  condition: boolean,
  message: string,
  details?: unknown
): asserts condition {
  if (!condition) {
    throw new ValidationError(message, details);
  }
}

/**
 * Assert a value is defined, throw NotFoundError if not
 */
export function assertDefined<T>(
  value: T | null | undefined,
  resource: string,
  identifier?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource, identifier);
  }
}

/**
 * Wrap unknown errors as AppError
 */
export function wrapError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message);
  }

  if (typeof error === 'string') {
    return new InternalServerError(error);
  }

  return new InternalServerError('An unknown error occurred');
}
