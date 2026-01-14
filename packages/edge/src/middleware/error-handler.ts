import type { Context, Next } from 'hono';
import type { ErrorResponse } from '../types/index';
import { AppError, wrapError } from '../lib/errors';
import { getRequestId } from '../lib/utils';

/**
 * Error Handling Middleware
 *
 * Catches all errors and returns standardized error responses
 */

const START_TIME = Date.now();

/**
 * Global error handler middleware
 */
export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    console.error('Error caught by middleware:', error);

    const appError = error instanceof AppError ? error : wrapError(error);
    const requestId = getRequestId(c.req.raw);
    const errorResponse: ErrorResponse = appError.toJSON(requestId);

    return c.json(errorResponse, appError.statusCode);
  }
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(c: Context) {
  const requestId = getRequestId(c.req.raw);

  const errorResponse: ErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      requestId,
      timestamp: Date.now(),
    },
  };

  return c.json(errorResponse, 404);
}

/**
 * Handle Zod validation errors
 */
export function handleValidationError(c: Context, error: {
  errors: Array<{
    path: Array<string | number>;
    message: string;
    code: string;
  }>;
}) {
  const requestId = getRequestId(c.req.raw);

  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    issue: err.message,
    code: err.code,
  }));

  const errorResponse: ErrorResponse = {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details,
      requestId,
      timestamp: Date.now(),
    },
  };

  return c.json(errorResponse, 400);
}

/**
 * Panic handler for unexpected errors
 */
export function panicHandler(c: Context, error: unknown) {
  console.error('PANIC: Unexpected error:', error);

  const requestId = getRequestId(c.req.raw);

  const errorResponse: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
      timestamp: Date.now(),
    },
  };

  // In production, don't expose internal errors
  if (c.env.ENVIRONMENT === 'development') {
    (errorResponse.error as any).details = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  return c.json(errorResponse, 500);
}

/**
 * Request logging middleware
 */
export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  const requestId = getRequestId(c.req.raw);

  // Log incoming request
  console.log(`[${requestId}] ${c.req.method} ${c.req.path}`);

  await next();

  // Log response
  const duration = Date.now() - start;
  const status = c.res.status;
  console.log(`[${requestId}] ${status} ${duration}ms`);
}

/**
 * Request timing middleware
 */
export async function requestTimer(c: Context, next: Next) {
  const start = Date.now();

  await next();

  const duration = Date.now() - start;
  c.header('X-Response-Time', `${duration}ms`);
  c.header('X-Process-Time', `${duration}ms`);
}

/**
 * Request ID middleware
 */
export async function requestId(c: Context, next: Next) {
  const id = getRequestId(c.req.raw);
  c.header('X-Request-ID', id);

  await next();
}

/**
 * Health check middleware
 */
export async function healthCheck(c: Context, next: Next) {
  if (c.req.path === '/health') {
    const uptime = Date.now() - START_TIME;

    return c.json({
      status: 'healthy',
      timestamp: Date.now(),
      version: c.env.API_VERSION || '0.1.0',
      environment: c.env.ENVIRONMENT || 'unknown',
      uptime,
    });
  }

  await next();
}
