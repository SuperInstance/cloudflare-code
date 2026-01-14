/**
 * Unit Tests - Error Handling
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  TimeoutError,
  UpstreamError,
  NotImplemented,
  assert,
  assertDefined,
  wrapError,
} from './errors';
import { ErrorCode, HttpStatus } from '../types';

describe('AppError', () => {
  it('should create basic AppError', () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Something went wrong');

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(error.name).toBe('AppError');
  });

  it('should create AppError with custom status code', () => {
    const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid input', HttpStatus.BAD_REQUEST);

    expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
  });

  it('should create AppError with details', () => {
    const details = { field: 'email', issue: 'Invalid format' };
    const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Validation failed', HttpStatus.BAD_REQUEST, details);

    expect(error.details).toEqual(details);
  });

  it('should convert to JSON response', () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Server error', HttpStatus.INTERNAL_SERVER_ERROR, {
      context: 'test',
    });

    const json = error.toJSON('req-123');

    expect(json).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Server error',
        details: { context: 'test' },
        requestId: 'req-123',
        timestamp: expect.any(Number),
      },
    });
  });

  it('should capture stack trace', () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test error');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });
});

describe('ValidationError', () => {
  it('should create ValidationError', () => {
    const error = new ValidationError('Invalid input');

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(error.name).toBe('ValidationError');
  });

  it('should create ValidationError with details', () => {
    const details = { field: 'email', message: 'Invalid email format' };
    const error = new ValidationError('Validation failed', details);

    expect(error.details).toEqual(details);
  });
});

describe('NotFoundError', () => {
  it('should create NotFoundError with resource only', () => {
    const error = new NotFoundError('User');

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(error.message).toBe('User not found');
    expect(error.name).toBe('NotFoundError');
  });

  it('should create NotFoundError with resource and identifier', () => {
    const error = new NotFoundError('User', '123');

    expect(error.message).toBe('User with id \'123\' not found');
  });
});

describe('UnauthorizedError', () => {
  it('should create UnauthorizedError with default message', () => {
    const error = new UnauthorizedError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.message).toBe('Unauthorized');
    expect(error.name).toBe('UnauthorizedError');
  });

  it('should create UnauthorizedError with custom message', () => {
    const error = new UnauthorizedError('Invalid API key');

    expect(error.message).toBe('Invalid API key');
  });
});

describe('ForbiddenError', () => {
  it('should create ForbiddenError with default message', () => {
    const error = new ForbiddenError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(error.message).toBe('Forbidden');
    expect(error.name).toBe('ForbiddenError');
  });

  it('should create ForbiddenError with custom message', () => {
    const error = new ForbiddenError('Access denied');

    expect(error.message).toBe('Access denied');
  });
});

describe('RateLimitError', () => {
  it('should create RateLimitError without retry after', () => {
    const error = new RateLimitError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.name).toBe('RateLimitError');
  });

  it('should create RateLimitError with retry after', () => {
    const error = new RateLimitError(60);

    expect(error.details).toEqual({ retryAfter: 60 });
  });
});

describe('InternalServerError', () => {
  it('should create InternalServerError with default message', () => {
    const error = new InternalServerError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(error.message).toBe('Internal server error');
    expect(error.name).toBe('InternalServerError');
  });

  it('should create InternalServerError with custom message', () => {
    const error = new InternalServerError('Database connection failed');

    expect(error.message).toBe('Database connection failed');
  });

  it('should create InternalServerError with details', () => {
    const details = { stack: 'Error: ...' };
    const error = new InternalServerError('Server error', details);

    expect(error.details).toEqual(details);
  });
});

describe('ServiceUnavailableError', () => {
  it('should create ServiceUnavailableError without service', () => {
    const error = new ServiceUnavailableError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(error.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(error.message).toBe('Service temporarily unavailable');
    expect(error.name).toBe('ServiceUnavailableError');
  });

  it('should create ServiceUnavailableError with service name', () => {
    const error = new ServiceUnavailableError('Database');

    expect(error.message).toBe('Service \'Database\' is currently unavailable');
  });
});

describe('TimeoutError', () => {
  it('should create TimeoutError without operation', () => {
    const error = new TimeoutError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('TIMEOUT');
    expect(error.statusCode).toBe(HttpStatus.GATEWAY_TIMEOUT);
    expect(error.message).toBe('Operation timed out');
    expect(error.name).toBe('TimeoutError');
  });

  it('should create TimeoutError with operation', () => {
    const error = new TimeoutError('Database query');

    expect(error.message).toBe('Operation \'Database query\' timed out');
  });
});

describe('UpstreamError', () => {
  it('should create UpstreamError with provider', () => {
    const error = new UpstreamError('Anthropic');

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(error.statusCode).toBe(HttpStatus.BAD_GATEWAY);
    expect(error.message).toBe('Error communicating with Anthropic');
    expect(error.name).toBe('UpstreamError');
  });

  it('should create UpstreamError with provider and original error', () => {
    const error = new UpstreamError('OpenAI', 'Connection timeout');

    expect(error.details).toEqual({
      provider: 'OpenAI',
      originalError: 'Connection timeout',
    });
  });
});

describe('NotImplemented', () => {
  it('should create NotImplemented error', () => {
    const error = new NotImplemented('Streaming responses');

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('NOT_IMPLEMENTED');
    expect(error.statusCode).toBe(HttpStatus.NOT_IMPLEMENTED);
    expect(error.message).toBe('Streaming responses is not yet implemented');
    expect(error.name).toBe('NotImplemented');
  });
});

describe('assert', () => {
  it('should not throw when condition is true', () => {
    expect(() => assert(true, 'Should not throw')).not.toThrow();
  });

  it('should throw ValidationError when condition is false', () => {
    expect(() => assert(false, 'Condition failed')).toThrow(ValidationError);
    expect(() => assert(false, 'Condition failed')).toThrow('Condition failed');
  });

  it('should throw ValidationError with details', () => {
    const details = { field: 'email' };

    try {
      assert(false, 'Validation failed', details);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).toEqual(details);
    }
  });
});

describe('assertDefined', () => {
  it('should not throw when value is defined', () => {
    expect(() => assertDefined('value', 'Resource')).not.toThrow();
    expect(() => assertDefined(0, 'Resource')).not.toThrow();
    expect(() => assertDefined(false, 'Resource')).not.toThrow();
  });

  it('should throw NotFoundError when value is null', () => {
    expect(() => assertDefined(null, 'User', '123')).toThrow(NotFoundError);
    expect(() => assertDefined(null, 'User', '123')).toThrow('User with id \'123\' not found');
  });

  it('should throw NotFoundError when value is undefined', () => {
    expect(() => assertDefined(undefined, 'Session')).toThrow(NotFoundError);
    expect(() => assertDefined(undefined, 'Session')).toThrow('Session not found');
  });

  it('should narrow type correctly', () => {
    const value: string | null = 'test';
    assertDefined(value, 'Value');

    // TypeScript should know value is string here
    expect(value.toUpperCase()).toBe('TEST');
  });
});

describe('wrapError', () => {
  it('should return AppError as-is', () => {
    const originalError = new ValidationError('Original error');
    const wrapped = wrapError(originalError);

    expect(wrapped).toBe(originalError);
  });

  it('should wrap Error in InternalServerError', () => {
    const originalError = new Error('Something went wrong');
    const wrapped = wrapError(originalError);

    expect(wrapped).toBeInstanceOf(InternalServerError);
    expect(wrapped.message).toBe('Something went wrong');
  });

  it('should wrap string in InternalServerError', () => {
    const wrapped = wrapError('String error');

    expect(wrapped).toBeInstanceOf(InternalServerError);
    expect(wrapped.message).toBe('String error');
  });

  it('should wrap unknown value in InternalServerError', () => {
    const wrapped = wrapError({ custom: 'error' });

    expect(wrapped).toBeInstanceOf(InternalServerError);
    expect(wrapped.message).toBe('An unknown error occurred');
  });

  it('should wrap null in InternalServerError', () => {
    const wrapped = wrapError(null);

    expect(wrapped).toBeInstanceOf(InternalServerError);
    expect(wrapped.message).toBe('An unknown error occurred');
  });

  it('should preserve error name when wrapping Error', () => {
    const originalError = new TypeError('Type error');
    const wrapped = wrapError(originalError);

    expect(wrapped).toBeInstanceOf(InternalServerError);
    expect(wrapped.message).toBe('Type error');
  });
});
