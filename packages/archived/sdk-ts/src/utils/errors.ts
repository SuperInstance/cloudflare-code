// @ts-nocheck
/**
 * Error handling utilities for ClaudeFlare SDK
 */

import type { ClaudeFlareError, ErrorCode } from '../types/index.js';

/**
 * Base ClaudeFlare error class
 */
export class ClaudeFlareAPIError extends Error implements ClaudeFlareError {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public requestId?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ClaudeFlareAPIError';
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      requestId: this.requestId,
      details: this.details,
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends ClaudeFlareAPIError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, undefined, details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends ClaudeFlareAPIError {
  constructor(message: string = 'Authentication failed', requestId?: string) {
    super('UNAUTHORIZED', message, 401, requestId);
    this.name = 'AuthenticationError';
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends ClaudeFlareAPIError {
  constructor(message: string = 'Access forbidden', requestId?: string) {
    super('FORBIDDEN', message, 403, requestId);
    this.name = 'ForbiddenError';
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends ClaudeFlareAPIError {
  constructor(resource: string, requestId?: string) {
    super('NOT_FOUND', `${resource} not found`, 404, requestId);
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends ClaudeFlareAPIError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number,
    requestId?: string
  ) {
    super('RATE_LIMIT_EXCEEDED', message, 429, requestId);
    this.name = 'RateLimitError';
  }
}

/**
 * Server error (500)
 */
export class InternalServerError extends ClaudeFlareAPIError {
  constructor(message: string = 'Internal server error', requestId?: string) {
    super('INTERNAL_ERROR', message, 500, requestId);
    this.name = 'InternalServerError';
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends ClaudeFlareAPIError {
  constructor(message: string = 'Service unavailable', requestId?: string) {
    super('SERVICE_UNAVAILABLE', message, 503, requestId);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends ClaudeFlareAPIError {
  constructor(message: string = 'Request timeout') {
    super('TIMEOUT', message, 408);
    this.name = 'TimeoutError';
  }
}

/**
 * Upstream provider error
 */
export class ProviderError extends ClaudeFlareAPIError {
  constructor(
    provider: string,
    message: string = 'Provider error',
    requestId?: string
  ) {
    super('PROVIDER_ERROR', `${provider}: ${message}`, 502, requestId);
    this.name = 'ProviderError';
  }
}

/**
 * Create error from API response
 */
export function errorFromResponse(
  statusCode: number,
  body: unknown,
  requestId?: string
): ClaudeFlareAPIError {
  const data = body as { error?: { code: string; message: string; details?: unknown } };

  const errorCode = data.error?.code || 'INTERNAL_ERROR';
  const message = data.error?.message || 'An error occurred';
  const details = data.error?.details;

  switch (statusCode) {
    case 400:
      return new ValidationError(message, details);
    case 401:
      return new AuthenticationError(message, requestId);
    case 403:
      return new ForbiddenError(message, requestId);
    case 404:
      return new NotFoundError(message, requestId);
    case 408:
      return new TimeoutError(message);
    case 429:
      return new RateLimitError(message, undefined, requestId);
    case 500:
      return new InternalServerError(message, requestId);
    case 502:
      return new ProviderError('upstream', message, requestId);
    case 503:
      return new ServiceUnavailableError(message, requestId);
    default:
      return new ClaudeFlareAPIError(
        errorCode as any,
        message,
        statusCode,
        requestId,
        details
      );
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ClaudeFlareAPIError) {
    return (
      error.statusCode === 408 || // Timeout
      error.statusCode === 429 || // Rate limit
      error.statusCode === 500 || // Internal server error
      error.statusCode === 502 || // Bad gateway
      error.statusCode === 503 || // Service unavailable
      error.statusCode === 504 // Gateway timeout
    );
  }
  return false;
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message.includes('fetch') || error.message.includes('network'))
  );
}
