/**
 * Cloudflare Workers middleware for rate limiting
 */

// @ts-nocheck
import type { RateLimiter } from '../rate-limiter.js';
import type { RateLimitContext } from '../types/index.js';

/**
 * Cloudflare Workers request context
 */
export interface WorkersRequestContext {
  request: Request;
  env?: any;
  ctx?: ExecutionContext;
}

/**
 * Cloudflare Workers middleware options
 */
export interface WorkersMiddlewareOptions {
  /**
   * Key generator function
   */
  keyGenerator?: (request: Request, env?: any, ctx?: ExecutionContext) => string | Promise<string>;

  /**
   * Skip function
   */
  skip?: (request: Request, env?: any, ctx?: ExecutionContext) => boolean | Promise<boolean>;

  /**
   * Whether to add rate limit headers
   */
  addHeaders?: boolean;

  /**
   * Custom response handler
   */
  responseHandler?: (
    request: Request,
    result: { allowed: boolean; remaining: number; reset: number; retryAfter?: number }
  ) => Response | null;
}

/**
 * Create Cloudflare Workers middleware
 */
export function workersMiddleware(
  rateLimiter: RateLimiter,
  options: WorkersMiddlewareOptions = {}
) {
  const {
    keyGenerator = defaultKeyGenerator,
    skip = () => false,
    addHeaders = true,
    responseHandler = null
  } = options;

  return async (
    request: Request,
    env?: any,
    ctx?: ExecutionContext
  ): Promise<Response | null> => {
    // Check if should skip
    const shouldSkip = await skip(request, env, ctx);
    if (shouldSkip) {
      return null; // Continue to next handler
    }

    // Generate key
    const key = await keyGenerator(request, env, ctx);

    // Extract IP from CF headers
    const cf = (request as any).cf || {};
    const ip = cf.incoming || request.headers.get('CF-Connecting-IP') || 'unknown';

    // Create context
    const context: RateLimitContext = {
      identifier: key,
      ip,
      apiKey: request.headers.get('x-api-key') || undefined,
      endpoint: `${request.method}:${new URL(request.url).pathname}`,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      metadata: {
        userAgent: request.headers.get('user-agent'),
        country: cf.country,
        colo: cf.colo
      }
    };

    try {
      // Check rate limit
      const result = await rateLimiter.check(context);

      // Use custom response handler if provided and not allowed
      if (responseHandler && !result.allowed) {
        return responseHandler(request, result);
      }

      // If not allowed, return rate limit response
      if (!result.allowed) {
        const headers = new Headers();

        if (addHeaders) {
          headers.set('X-RateLimit-Limit', result.limit.toString());
          headers.set('X-RateLimit-Remaining', result.remaining.toString());
          headers.set('X-RateLimit-Reset', result.reset.toString());

          if (result.retryAfter) {
            headers.set('Retry-After', result.retryAfter.toString());
          }
        }

        headers.set('Content-Type', 'application/json');

        return new Response(
          JSON.stringify({
            error: {
              message: 'Too many requests',
              statusCode: 429,
              limit: result.limit,
              remaining: result.remaining,
              reset: result.reset,
              retryAfter: result.retryAfter
            }
          }),
          {
            status: 429,
            headers
          }
        );
      }

      // Add headers to request for downstream handlers
      if (addHeaders) {
        // Store rate limit info for downstream handlers
        (request as any).__rateLimit = {
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset
        };
      }

      // Continue to next handler
      return null;
    } catch (error) {
      console.error('Rate limiter error:', error);

      // Continue to next handler on error
      return null;
    }
  };
}

/**
 * Default key generator for Cloudflare Workers
 */
function defaultKeyGenerator(request: Request): string {
  const cf = (request as any).cf || {};
  return cf.incoming || request.headers.get('CF-Connecting-IP') || 'unknown';
}

/**
 * Create IP-based rate limiter for Cloudflare Workers
 */
export function createIpRateLimiter(
  rateLimiter: RateLimiter,
  options?: Omit<WorkersMiddlewareOptions, 'keyGenerator'>
) {
  return workersMiddleware(rateLimiter, {
    ...options,
    keyGenerator: (request) => {
      const cf = (request as any).cf || {};
      return cf.incoming || request.headers.get('CF-Connecting-IP') || 'unknown';
    }
  });
}

/**
 * Create API key-based rate limiter for Cloudflare Workers
 */
export function createApiKeyRateLimiter(
  rateLimiter: RateLimiter,
  options?: Omit<WorkersMiddlewareOptions, 'keyGenerator'>
) {
  return workersMiddleware(rateLimiter, {
    ...options,
    keyGenerator: (request) => {
      return request.headers.get('x-api-key') || defaultKeyGenerator(request);
    }
  });
}

/**
 * Create country-based rate limiter for Cloudflare Workers
 */
export function createCountryRateLimiter(
  rateLimiter: RateLimiter,
  options?: Omit<WorkersMiddlewareOptions, 'keyGenerator'>
) {
  return workersMiddleware(rateLimiter, {
    ...options,
    keyGenerator: (request) => {
      const cf = (request as any).cf || {};
      return `country:${cf.country || 'unknown'}`;
    }
  });
}

/**
 * Create colo-based rate limiter for Cloudflare Workers
 */
export function createColoRateLimiter(
  rateLimiter: RateLimiter,
  options?: Omit<WorkersMiddlewareOptions, 'keyGenerator'>
) {
  return workersMiddleware(rateLimiter, {
    ...options,
    keyGenerator: (request) => {
      const cf = (request as any).cf || {};
      return `colo:${cf.colo || 'unknown'}`;
    }
  });
}

/**
 * Wrapper for Cloudflare Workers export
 */
export function withRateLimit(
  rateLimiter: RateLimiter,
  handler: (
    request: Request,
    env?: any,
    ctx?: ExecutionContext
  ) => Response | Promise<Response>,
  options?: WorkersMiddlewareOptions
) {
  const middleware = workersMiddleware(rateLimiter, options);

  return async (
    request: Request,
    env?: any,
    ctx?: ExecutionContext
  ): Promise<Response> => {
    // Run middleware
    const middlewareResult = await middleware(request, env, ctx);

    // If middleware returned a response, use it
    if (middlewareResult) {
      return middlewareResult;
    }

    // Otherwise, continue to handler
    return handler(request, env, ctx);
  };
}
