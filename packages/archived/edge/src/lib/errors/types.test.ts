/**
 * Tests for Error Types and Taxonomy
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  classifyError,
  getErrorMetadata,
  isRetryable,
  shouldUseFallback,
  getUserMessage,
  getSuggestedActions,
  getErrorSeverity,
  getErrorCategory,
  isErrorType,
} from './types';

describe('Error Types and Taxonomy', () => {
  describe('ErrorType Enum', () => {
    it('should have all transient error types', () => {
      expect(ErrorType.RATE_LIMITED).toBe('rate_limited');
      expect(ErrorType.TIMEOUT).toBe('timeout');
      expect(ErrorType.NETWORK_ERROR).toBe('network_error');
      expect(ErrorType.PROVIDER_UNAVAILABLE).toBe('provider_unavailable');
      expect(ErrorType.SERVICE_UNAVAILABLE).toBe('service_unavailable');
      expect(ErrorType.GATEWAY_TIMEOUT).toBe('gateway_timeout');
    });

    it('should have all permanent error types', () => {
      expect(ErrorType.INVALID_INPUT).toBe('invalid_input');
      expect(ErrorType.UNAUTHORIZED).toBe('unauthorized');
      expect(ErrorType.NOT_FOUND).toBe('not_found');
      expect(ErrorType.QUOTA_EXCEEDED).toBe('quota_exceeded');
      expect(ErrorType.NOT_SUPPORTED).toBe('not_supported');
      expect(ErrorType.INVALID_API_KEY).toBe('invalid_api_key');
      expect(ErrorType.ACCOUNT_SUSPENDED).toBe('account_suspended');
      expect(ErrorType.FEATURE_NOT_ENABLED).toBe('feature_not_enabled');
    });

    it('should have all throttling error types', () => {
      expect(ErrorType.API_RATE_LIMIT).toBe('api_rate_limit');
      expect(ErrorType.API_OVERLOADED).toBe('api_overloaded');
      expect(ErrorType.CONCURRENT_LIMIT).toBe('concurrent_limit');
      expect(ErrorType.RESOURCE_EXHAUSTED).toBe('resource_exhausted');
    });

    it('should have all content error types', () => {
      expect(ErrorType.CONTENT_POLICY).toBe('content_policy');
      expect(ErrorType.CONTENT_FILTERED).toBe('content_filtered');
      expect(ErrorType.INCOMPLETE_RESPONSE).toBe('incomplete_response');
    });

    it('should have all system error types', () => {
      expect(ErrorType.INTERNAL_ERROR).toBe('internal_error');
      expect(ErrorType.UNKNOWN_ERROR).toBe('unknown_error');
    });
  });

  describe('Error Classification', () => {
    it('should classify rate limit errors', () => {
      const type = classifyError(429, 'rate limit exceeded');
      expect(type).toBe(ErrorType.RATE_LIMITED);
    });

    it('should classify timeout errors', () => {
      const type = classifyError(408, 'request timeout');
      expect(type).toBe(ErrorType.TIMEOUT);
    });

    it('should classify network errors', () => {
      const type = classifyError(0, 'network error');
      expect(type).toBe(ErrorType.NETWORK_ERROR);
    });

    it('should classify unauthorized errors', () => {
      const type = classifyError(401, 'unauthorized');
      expect(type).toBe(ErrorType.UNAUTHORIZED);
    });

    it('should classify not found errors', () => {
      const type = classifyError(404, 'not found');
      expect(type).toBe(ErrorType.NOT_FOUND);
    });

    it('should classify internal server errors', () => {
      const type = classifyError(500, 'internal server error');
      expect(type).toBe(ErrorType.INTERNAL_ERROR);
    });

    it('should classify service unavailable errors', () => {
      const type = classifyError(503, 'service unavailable');
      expect(type).toBe(ErrorType.SERVICE_UNAVAILABLE);
    });

    it('should classify gateway timeout errors', () => {
      const type = classifyError(504, 'gateway timeout');
      expect(type).toBe(ErrorType.GATEWAY_TIMEOUT);
    });

    it('should classify unknown errors by default', () => {
      const type = classifyError(418, 'unknown error');
      expect(type).toBe(ErrorType.UNKNOWN_ERROR);
    });
  });

  describe('Error Metadata', () => {
    it('should return correct metadata for rate limited error', () => {
      const metadata = getErrorMetadata(ErrorType.RATE_LIMITED);
      expect(metadata.type).toBe(ErrorType.RATE_LIMITED);
      expect(metadata.category).toBe(ErrorCategory.TRANSIENT);
      expect(metadata.severity).toBe(ErrorSeverity.MEDIUM);
      expect(metadata.retryable).toBe(true);
      expect(metadata.statusCode).toBe(429);
    });

    it('should return correct metadata for unauthorized error', () => {
      const metadata = getErrorMetadata(ErrorType.UNAUTHORIZED);
      expect(metadata.type).toBe(ErrorType.UNAUTHORIZED);
      expect(metadata.category).toBe(ErrorCategory.PERMANENT);
      expect(metadata.severity).toBe(ErrorSeverity.HIGH);
      expect(metadata.retryable).toBe(false);
      expect(metadata.statusCode).toBe(401);
    });

    it('should return correct metadata for API rate limit error', () => {
      const metadata = getErrorMetadata(ErrorType.API_RATE_LIMIT);
      expect(metadata.type).toBe(ErrorType.API_RATE_LIMIT);
      expect(metadata.category).toBe(ErrorCategory.THROTTLING);
      expect(metadata.severity).toBe(ErrorSeverity.MEDIUM);
      expect(metadata.retryable).toBe(true);
      expect(metadata.statusCode).toBe(429);
    });

    it('should have user-friendly message', () => {
      const metadata = getErrorMetadata(ErrorType.RATE_LIMITED);
      expect(metadata.userMessage).toBeTruthy();
      expect(typeof metadata.userMessage).toBe('string');
    });

    it('should have suggested actions', () => {
      const metadata = getErrorMetadata(ErrorType.RATE_LIMITED);
      expect(metadata.suggestedActions).toBeTruthy();
      expect(Array.isArray(metadata.suggestedActions)).toBe(true);
      expect(metadata.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should have retry configuration', () => {
      const metadata = getErrorMetadata(ErrorType.RATE_LIMITED);
      expect(metadata.retryConfig).toBeTruthy();
      expect(metadata.retryConfig.retryable).toBe(true);
      expect(metadata.retryConfig.maxRetries).toBeGreaterThan(0);
      expect(metadata.retryConfig.baseDelay).toBeGreaterThan(0);
      expect(metadata.retryConfig.maxDelay).toBeGreaterThan(0);
    });
  });

  describe('Error Utilities', () => {
    it('should correctly identify retryable errors', () => {
      expect(isRetryable(ErrorType.RATE_LIMITED)).toBe(true);
      expect(isRetryable(ErrorType.TIMEOUT)).toBe(true);
      expect(isRetryable(ErrorType.NETWORK_ERROR)).toBe(true);
      expect(isRetryable(ErrorType.PROVIDER_UNAVAILABLE)).toBe(true);
    });

    it('should correctly identify non-retryable errors', () => {
      expect(isRetryable(ErrorType.INVALID_INPUT)).toBe(false);
      expect(isRetryable(ErrorType.UNAUTHORIZED)).toBe(false);
      expect(isRetryable(ErrorType.NOT_FOUND)).toBe(false);
      expect(isRetryable(ErrorType.QUOTA_EXCEEDED)).toBe(false);
    });

    it('should correctly identify fallback-eligible errors', () => {
      expect(shouldUseFallback(ErrorType.RATE_LIMITED)).toBe(true);
      expect(shouldUseFallback(ErrorType.TIMEOUT)).toBe(true);
      expect(shouldUseFallback(ErrorType.PROVIDER_UNAVAILABLE)).toBe(true);
    });

    it('should correctly identify non-fallback errors', () => {
      expect(shouldUseFallback(ErrorType.INVALID_INPUT)).toBe(false);
      expect(shouldUseFallback(ErrorType.UNAUTHORIZED)).toBe(false);
    });

    it('should return user-friendly message', () => {
      const message = getUserMessage(ErrorType.RATE_LIMITED);
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return suggested actions', () => {
      const actions = getSuggestedActions(ErrorType.RATE_LIMITED);
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
      actions.forEach(action => {
        expect(typeof action).toBe('string');
      });
    });

    it('should return error severity', () => {
      expect(getErrorSeverity(ErrorType.ACCOUNT_SUSPENDED)).toBe(ErrorSeverity.CRITICAL);
      expect(getErrorSeverity(ErrorType.UNAUTHORIZED)).toBe(ErrorSeverity.HIGH);
      expect(getErrorSeverity(ErrorType.RATE_LIMITED)).toBe(ErrorSeverity.MEDIUM);
      expect(getErrorSeverity(ErrorType.NOT_FOUND)).toBe(ErrorSeverity.LOW);
    });

    it('should return error category', () => {
      expect(getErrorCategory(ErrorType.RATE_LIMITED)).toBe(ErrorCategory.TRANSIENT);
      expect(getErrorCategory(ErrorType.UNAUTHORIZED)).toBe(ErrorCategory.PERMANENT);
      expect(getErrorCategory(ErrorType.API_RATE_LIMIT)).toBe(ErrorCategory.THROTTLING);
      expect(getErrorCategory(ErrorType.CONTENT_POLICY)).toBe(ErrorCategory.CONTENT);
      expect(getErrorCategory(ErrorType.INTERNAL_ERROR)).toBe(ErrorCategory.SYSTEM);
    });
  });

  describe('Type Guards', () => {
    it('should validate error types', () => {
      expect(isErrorType('rate_limited')).toBe(true);
      expect(isErrorType('unknown_error')).toBe(true);
      expect(isErrorType('invalid_type')).toBe(false);
      expect(isErrorType('')).toBe(false);
    });

    it('should validate error categories', () => {
      expect(isErrorCategory('transient')).toBe(true);
      expect(isErrorCategory('permanent')).toBe(true);
      expect(isErrorCategory('throttling')).toBe(true);
      expect(isErrorCategory('invalid_category')).toBe(false);
    });

    it('should validate error severities', () => {
      expect(isErrorSeverity('critical')).toBe(true);
      expect(isErrorSeverity('high')).toBe(true);
      expect(isErrorSeverity('medium')).toBe(true);
      expect(isErrorSeverity('low')).toBe(true);
      expect(isErrorSeverity('invalid_severity')).toBe(false);
    });
  });

  describe('Error Classification Edge Cases', () => {
    it('should handle empty message', () => {
      const type = classifyError(500, '');
      expect(type).toBe(ErrorType.INTERNAL_ERROR);
    });

    it('should handle case-insensitive message matching', () => {
      const type1 = classifyError(429, 'RATE LIMIT');
      const type2 = classifyError(429, 'Rate Limit');
      const type3 = classifyError(429, 'rate limit');
      expect(type1).toBe(ErrorType.RATE_LIMITED);
      expect(type2).toBe(ErrorType.RATE_LIMITED);
      expect(type3).toBe(ErrorType.RATE_LIMITED);
    });

    it('should prioritize specific error patterns', () => {
      const type = classifyError(429, 'quota exceeded');
      expect(type).toBe(ErrorType.QUOTA_EXCEEDED);
    });

    it('should handle multiple error patterns in message', () => {
      const type = classifyError(0, 'network timeout connection lost');
      expect(type).toBe(ErrorType.TIMEOUT);
    });
  });

  describe('Retry Configuration', () => {
    it('should have appropriate retry config for transient errors', () => {
      const metadata = getErrorMetadata(ErrorType.RATE_LIMITED);
      expect(metadata.retryConfig.retryable).toBe(true);
      expect(metadata.retryConfig.maxRetries).toBeGreaterThanOrEqual(3);
      expect(metadata.retryConfig.backoffMultiplier).toBeGreaterThanOrEqual(1);
    });

    it('should have no retry config for permanent errors', () => {
      const metadata = getErrorMetadata(ErrorType.UNAUTHORIZED);
      expect(metadata.retryConfig.retryable).toBe(false);
      expect(metadata.retryConfig.maxRetries).toBe(0);
    });

    it('should have longer backoff for throttling errors', () => {
      const transientConfig = getErrorMetadata(ErrorType.RATE_LIMITED).retryConfig;
      const throttlingConfig = getErrorMetadata(ErrorType.API_RATE_LIMIT).retryConfig;
      expect(throttlingConfig.baseDelay).toBeGreaterThanOrEqual(transientConfig.baseDelay);
    });

    it('should include fallback in retry config for applicable errors', () => {
      const metadata = getErrorMetadata(ErrorType.PROVIDER_UNAVAILABLE);
      expect(metadata.retryConfig.useFallback).toBe(true);
    });
  });

  describe('Documentation Links', () => {
    it('should include documentation links for some error types', () => {
      const metadata = getErrorMetadata(ErrorType.RATE_LIMITED);
      expect(metadata.docsLinks).toBeTruthy();
      expect(Array.isArray(metadata.docsLinks)).toBe(true);
    });

    it('should not have documentation links for all error types', () => {
      const metadata = getErrorMetadata(ErrorType.UNKNOWN_ERROR);
      expect(metadata.docsLinks).toBeUndefined();
    });
  });
});
