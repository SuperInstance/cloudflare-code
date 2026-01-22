/**
 * Cache Middleware for Cloudflare Workers
 *
 * Provides middleware for automatic caching, cache warming,
 * and predictive preloading.
 */

import type { EdgeCacheEnv } from '../types';
import { generateCacheKey, parseCacheControl } from './helpers';

export interface CacheMiddlewareOptions {
  enabled?: boolean;
  defaultTTL?: number;
  staleWhileRevalidate?: number;
  bypassForAuthenticated?: boolean;
  skipCachePatterns?: string[];
  forceCachePatterns?: string[];
}

/**
 * Cache middleware for Hono framework
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const {
    enabled = true,
    defaultTTL = 3600,
    staleWhileRevalidate = 300,
    bypassForAuthenticated = true,
    skipCachePatterns = [],
    forceCachePatterns = [],
  } = options;

  return async (c: any, next: any) => {
    if (!enabled) {
      return next();
    }

    // Check if should bypass cache
    if (shouldBypassCache(c, skipCachePatterns, bypassForAuthenticated)) {
      return next();
    }

    const cacheKey = generateCacheKey(c.req.url, c.req.method);
    const cache = c.env.CACHE_KV as KVNamespace;

    // Try to get from cache
    try {
      const cached = await cache.get(cacheKey, 'json');
      if (cached) {
        const response = new Response(cached.body, cached);
        response.headers.set('X-Cache', 'HIT');
        response.headers.set('Age', `${Math.floor((Date.now() - cached.cachedAt) / 1000)}`);
        return response;
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }

    // Continue to handler
    const response = await next();

    // Cache the response if appropriate
    if (shouldCacheResponse(response, forceCachePatterns)) {
      try {
        const cacheControl = response.headers.get('Cache-Control') || `max-age=${defaultTTL}`;
        const directives = parseCacheControl(cacheControl);

        if (!directives.noStore && !directives.noCache) {
          const ttl = directives.sMaxAge || directives.maxAge || defaultTTL;
          const swr = directives.staleWhileRevalidate || staleWhileRevalidate;

          const body = await response.clone().text();
          const cachedResponse = {
            body,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            cachedAt: Date.now(),
          };

          await cache.put(cacheKey, JSON.stringify(cachedResponse), {
            expirationTtl: ttl + swr,
            metadata: { ttl, swr },
          });

          response.headers.set('X-Cache', 'MISS');
        }
      } catch (error) {
        console.error('Cache write error:', error);
      }
    }

    return response;
  };
}

/**
 * Predictive preloading middleware
 */
export function predictivePreloadMiddleware(options: {
  enabled?: boolean;
  predictionLimit?: number;
  minConfidence?: number;
} = {}) {
  const {
    enabled = true,
    predictionLimit = 5,
    minConfidence = 0.5,
  } = options;

  return async (c: any, next: any) => {
    if (!enabled) {
      return next();
    }

    // Record access for predictions
    const userId = c.get('userId');
    const sessionId = c.get('sessionId');
    const url = c.req.url;
    const method = c.req.method;

    // Record access (would use prediction manager in production)
    // await c.env.predictionManager.recordAccess(userId, sessionId, url, method, context);

    const response = await next();

    // Add preload hints for predicted resources
    try {
      const predictions = [] as any[]; // Would come from prediction manager
      const preloads = predictions
        .filter((p) => p.confidence >= minConfidence)
        .slice(0, predictionLimit)
        .map((p) => `<${p.url}>; rel="preload"; as="${p.as || 'fetch'}"`)
        .join(', ');

      if (preloads) {
        response.headers.set('Link', preloads);
      }
    } catch (error) {
      console.error('Prediction error:', error);
    }

    return response;
  };
}

/**
 * Cache warming middleware
 */
export function cacheWarmupMiddleware(options: {
  enabled?: boolean;
  warmOnMiss?: boolean;
  priorityThreshold?: number;
} = {}) {
  const {
    enabled = true,
    warmOnMiss = true,
    priorityThreshold = 50,
  } = options;

  return async (c: any, next: any) => {
    if (!enabled) {
      return next();
    }

    const response = await next();

    // Check if cache miss
    if (warmOnMiss && response.headers.get('X-Cache') === 'MISS') {
      const url = c.req.url;
      const priority = calculateWarmupPriority(c);

      if (priority >= priorityThreshold) {
        // Trigger background warming (would use warming manager in production)
        // c.env.warmingManager.warmUrl(url, priority);
      }
    }

    return response;
  };
}

/**
 * Check if should bypass cache
 */
function shouldBypassCache(
  c: any,
  skipCachePatterns: string[],
  bypassForAuthenticated: boolean
): boolean {
  // Check for authenticated users
  if (bypassForAuthenticated && c.get('userId')) {
    return true;
  }

  // Check skip patterns
  const url = c.req.url;
  for (const pattern of skipCachePatterns) {
    const regex = new RegExp(pattern);
    if (regex.test(url)) {
      return true;
    }
  }

  // Check for cache control headers
  const cacheControl = c.req.header('Cache-Control');
  if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
    return true;
  }

  return false;
}

/**
 * Check if should cache response
 */
function shouldCacheResponse(response: Response, forceCachePatterns: string[]): boolean {
  // Only cache successful responses
  if (response.status !== 200) {
    return false;
  }

  // Check force cache patterns
  const url = response.url;
  for (const pattern of forceCachePatterns) {
    const regex = new RegExp(pattern);
    if (regex.test(url)) {
      return true;
    }
  }

  // Check content type
  const contentType = response.headers.get('Content-Type');
  if (!contentType) {
    return false;
  }

  // Cache common content types
  const cacheableTypes = [
    'text/html',
    'text/css',
    'application/javascript',
    'application/json',
    'image/',
    'font/',
    'video/',
  ];

  return cacheableTypes.some((type) => contentType.includes(type));
}

/**
 * Calculate warmup priority for a request
 */
function calculateWarmupPriority(c: any): number {
  let priority = 50; // Base priority

  // Increase priority for authenticated users
  if (c.get('userId')) {
    priority += 20;
  }

  // Increase priority for specific paths
  const url = c.req.url;
  if (url.includes('/docs/') || url.includes('/blog/')) {
    priority += 15;
  }

  // Increase priority for GET requests
  if (c.req.method === 'GET') {
    priority += 10;
  }

  return Math.min(priority, 100);
}

/**
 * Create combined cache middleware
 */
export function createCacheStack(options: CacheMiddlewareOptions & {
  enablePredictive?: boolean;
  enableWarmup?: boolean;
} = {}) {
  const {
    enablePredictive = true,
    enableWarmup = true,
    ...cacheOptions
  } = options;

  const middlewares = [cacheMiddleware(cacheOptions)];

  if (enablePredictive) {
    middlewares.push(predictivePreloadMiddleware());
  }

  if (enableWarmup) {
    middlewares.push(cacheWarmupMiddleware());
  }

  return middlewares;
}
