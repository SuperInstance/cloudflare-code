/**
 * Express middleware for rate limiting
 */

import type { Request, Response, NextFunction } from 'express';
import type { RateLimiter } from '../rate-limiter.js';
import type { RateLimitContext, RateLimitResult } from '../types/index.js';

/**
 * Express middleware options
 */
export interface ExpressMiddlewareOptions {
  /**
   * Key generator function
   */
  keyGenerator?: (req: Request) => string | Promise<string>;

  /**
   * Skip function
   */
  skip?: (req: Request) => boolean | Promise<boolean>;

  /**
   * Handler for rate limit exceeded
   */
  handler?: (req: Request, res: Response, result: RateLimitResult) => void;

  /**
   * Whether to include X-RateLimit headers in response
   */
  headers?: boolean;

  /**
   * Response status code when rate limited
   */
  statusCode?: number;

  /**
   * Response message when rate limited
   */
  message?: string | ((req: Request) => string);
}

/**
 * Create Express middleware
 */
export function expressMiddleware(
  rateLimiter: RateLimiter,
  options: ExpressMiddlewareOptions = {}
) {
  const {
    keyGenerator = defaultKeyGenerator,
    skip = () => false,
    handler = defaultHandler,
    headers = true,
    statusCode = 429,
    message = 'Too many requests'
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if should skip
    const shouldSkip = await skip(req);
    if (shouldSkip) {
      return next();
    }

    // Generate key
    const key = await keyGenerator(req);

    // Create context
    const context: RateLimitContext = {
      identifier: key,
      ip: req.ip,
      userId: req.user?.id || (req as any).userId,
      apiKey: req.headers['x-api-key'] as string,
      endpoint: `${req.method}:${req.path}`,
      method: req.method,
      headers: req.headers as Record<string, string>,
      metadata: {
        userAgent: req.headers['user-agent']
      }
    };

    try {
      // Check rate limit
      const result = await rateLimiter.check(context);

      // Add headers if enabled
      if (headers) {
        res.setHeader('X-RateLimit-Limit', result.limit.toString());
        res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
        res.setHeader('X-RateLimit-Reset', result.reset.toString());

        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter.toString());
        }
      }

      // Check if allowed
      if (result.allowed) {
        return next();
      }

      // Rate limit exceeded
      return handler(req, res, result);
    } catch (error) {
      console.error('Rate limiter error:', error);
      return next(error);
    }
  };
}

/**
 * Default key generator
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || 'unknown';
}

/**
 * Default handler for rate limit exceeded
 */
function defaultHandler(
  req: Request,
  res: Response,
  result: RateLimitResult
): void {
  const statusCode = 429;
  const message = 'Too many requests';

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: result.retryAfter
    }
  });
}

/**
 * Create IP-based rate limiter middleware
 */
export function ipRateLimiter(
  rateLimiter: RateLimiter,
  options: Omit<ExpressMiddlewareOptions, 'keyGenerator'> = {}
) {
  return expressMiddleware(rateLimiter, {
    ...options,
    keyGenerator: (req) => req.ip || 'unknown'
  });
}

/**
 * Create user-based rate limiter middleware
 */
export function userRateLimiter(
  rateLimiter: RateLimiter,
  options: Omit<ExpressMiddlewareOptions, 'keyGenerator'> = {}
) {
  return expressMiddleware(rateLimiter, {
    ...options,
    keyGenerator: (req) => {
      return (req.user?.id || (req as any).userId || req.ip || 'unknown').toString();
    }
  });
}

/**
 * Create API key-based rate limiter middleware
 */
export function apiKeyRateLimiter(
  rateLimiter: RateLimiter,
  options: Omit<ExpressMiddlewareOptions, 'keyGenerator'> = {}
) {
  return expressMiddleware(rateLimiter, {
    ...options,
    keyGenerator: (req) => {
      return (req.headers['x-api-key'] as string) || req.ip || 'unknown';
    }
  });
}

/**
 * Create endpoint-based rate limiter middleware
 */
export function endpointRateLimiter(
  rateLimiter: RateLimiter,
  options: Omit<ExpressMiddlewareOptions, 'keyGenerator'> = {}
) {
  return expressMiddleware(rateLimiter, {
    ...options,
    keyGenerator: (req) => {
      return `${req.ip}:${req.method}:${req.path}`;
    }
  });
}
