/**
 * Fastify plugin for rate limiting
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { FastifyPluginAsync } from 'fastify';
import type { RateLimiter } from '../rate-limiter.js';
import type { RateLimitContext, RateLimitResult } from '../types/index.js';

/**
 * Fastify middleware options
 */
export interface FastifyMiddlewareOptions {
  /**
   * Key generator function
   */
  keyGenerator?: (req: FastifyRequest) => string | Promise<string>;

  /**
   * Skip function
   */
  skip?: (req: FastifyRequest) => boolean | Promise<boolean>;

  /**
   * Whether to add X-RateLimit headers
   */
  addHeaders?: boolean;

  /**
   * Time to live for cache in seconds
   */
  timeWindow?: number;

  /**
   * Maximum requests per time window
   */
  maxRequests?: number;

  /**
   * Continue on error
   */
  continueExceeding?: boolean;
}

/**
 * Fastify plugin for rate limiting
 */
export const fastifyRateLimiter: FastifyPluginAsync<{
  rateLimiter: RateLimiter;
  options?: FastifyMiddlewareOptions;
}> = async (fastify, { rateLimiter, options = {} }) => {
  const {
    keyGenerator = defaultKeyGenerator,
    skip = () => false,
    addHeaders = true
  } = options;

  fastify.addHook('onRequest', async (request, reply) => {
    // Check if should skip
    const shouldSkip = await skip(request);
    if (shouldSkip) {
      return;
    }

    // Generate key
    const key = await keyGenerator(request);

    // Create context
    const context: RateLimitContext = {
      identifier: key,
      ip: request.ip,
      userId: (request.user as any)?.id,
      apiKey: request.headers['x-api-key'] as string,
      endpoint: `${request.method}:${request.routerPath}`,
      method: request.method,
      headers: request.headers as Record<string, string>,
      metadata: {
        userAgent: request.headers['user-agent']
      }
    };

    try {
      // Check rate limit
      const result = await rateLimiter.check(context);

      // Add headers if enabled
      if (addHeaders) {
        reply.header('X-RateLimit-Limit', result.limit.toString());
        reply.header('X-RateLimit-Remaining', result.remaining.toString());
        reply.header('X-RateLimit-Reset', result.reset.toString());

        if (result.retryAfter) {
          reply.header('Retry-After', result.retryAfter.toString());
        }
      }

      // Check if allowed
      if (!result.allowed) {
        reply.status(429).send({
          error: {
            message: 'Too many requests',
            statusCode: 429,
            limit: result.limit,
            remaining: result.remaining,
            reset: result.reset,
            retryAfter: result.retryAfter
          }
        });
        return;
      }
    } catch (error) {
      fastify.log.error('Rate limiter error:', error);

      if (!options?.continueExceeding) {
        throw error;
      }
    }
  });
};

/**
 * Default key generator for Fastify
 */
function defaultKeyGenerator(req: FastifyRequest): string {
  return req.ip || 'unknown';
}

/**
 * Create IP-based rate limiter for Fastify
 */
export function createIpRateLimiter(
  rateLimiter: RateLimiter,
  options?: Omit<FastifyMiddlewareOptions, 'keyGenerator'>
): FastifyPluginAsync {
  return async (fastify) => {
    await fastify.register(fastifyRateLimiter, {
      rateLimiter,
      options: {
        ...options,
        keyGenerator: (req) => req.ip || 'unknown'
      }
    });
  };
}

/**
 * Create user-based rate limiter for Fastify
 */
export function createUserRateLimiter(
  rateLimiter: RateLimiter,
  options?: Omit<FastifyMiddlewareOptions, 'keyGenerator'>
): FastifyPluginAsync {
  return async (fastify) => {
    await fastify.register(fastifyRateLimiter, {
      rateLimiter,
      options: {
        ...options,
        keyGenerator: (req) => {
          return ((req.user as any)?.id || req.ip || 'unknown').toString();
        }
      }
    });
  };
}

/**
 * Create API key-based rate limiter for Fastify
 */
export function createApiKeyRateLimiter(
  rateLimiter: RateLimiter,
  options?: Omit<FastifyMiddlewareOptions, 'keyGenerator'>
): FastifyPluginAsync {
  return async (fastify) => {
    await fastify.register(fastifyRateLimiter, {
      rateLimiter,
      options: {
        ...options,
        keyGenerator: (req) => {
          return (req.headers['x-api-key'] as string) || req.ip || 'unknown';
        }
      }
    });
  };
}
