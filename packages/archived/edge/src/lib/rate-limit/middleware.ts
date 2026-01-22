/**
 * Rate Limiting Middleware for Hono
 *
 * Provides middleware for rate limiting HTTP requests in Hono applications.
 * Supports multiple strategies, custom identifiers, and tier-based limits.
 */

import type { Context, Next } from 'hono';
import { RateLimitManager } from './manager';
import { QuotaManager } from './quota';
import type {
  RateLimitDecision,
  RateLimitConfig,
  SubscriptionTier,
  RateLimitMiddlewareOptions,
  RateLimitResult,
} from './types';

/**
 * Extract IP address from request
 */
function extractIP(c: Context): string {
  // Check CF-Connecting-IP (Cloudflare)
  const cfIP = c.req.header('cf-connecting-ip');
  if (cfIP) return cfIP;

  // Check X-Forwarded-For
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map((ip) => ip.trim());
    return ips[0] || 'unknown';
  }

  // Check X-Real-IP
  const xri = c.req.header('x-real-ip');
  if (xri) return xri;

  // Fall back to remote address
  return c.req.header('cf-connecting-ip') || 'unknown';
}

/**
 * Extract user ID from request
 */
function extractUserId(c: Context): string | undefined {
  // Check authorization header
  const auth = c.req.header('authorization');
  if (auth) {
    // Could decode JWT or lookup user
    // For now, return a placeholder
    return auth.substring(0, 10);
  }

  // Check custom header
  const userId = c.req.header('x-user-id');
  if (userId) return userId;

  // Check query parameter
  const queryUserId = c.req.query('user');
  if (queryUserId) return queryUserId;

  return undefined;
}

/**
 * Extract organization ID from request
 */
function extractOrgId(c: Context): string | undefined {
  const orgId = c.req.header('x-org-id');
  if (orgId) return orgId;

  const queryOrgId = c.req.query('org');
  if (queryOrgId) return queryOrgId;

  return undefined;
}

/**
 * Extract tier from request
 */
function extractTier(c: Context): SubscriptionTier {
  // Check header
  const tier = c.req.header('x-tier') as SubscriptionTier;
  if (tier && ['free', 'pro', 'enterprise'].includes(tier)) {
    return tier;
  }

  // Check query parameter
  const queryTier = c.req.query('tier') as SubscriptionTier;
  if (queryTier && ['free', 'pro', 'enterprise'].includes(queryTier)) {
    return queryTier;
  }

  // Default to free tier
  return 'free';
}

/**
 * Create rate limit middleware
 */
export function rateLimit(options: RateLimitMiddlewareOptions) {
  const manager = new RateLimitManager({
    ...(options.kv !== undefined ? { kv: options.kv } : {}),
    ...(options.config.algorithm !== undefined ? { defaultAlgorithm: options.config.algorithm } : {}),
  });

  const quotaManager = new QuotaManager({
    ...(options.kv !== undefined ? { kv: options.kv } : {}),
  });

  return async (c: Context, next: Next) => {
    // Check if should skip
    if (options.skipIf && (await options.skipIf(c))) {
      return next();
    }

    // Extract identifiers
    const identifier = await options.identifierGenerator(c);
    const tier = options.tierGenerator
      ? await options.tierGenerator(c)
      : extractTier(c);
    const endpoint = c.req.path;
    const method = c.req.method;

    // Check rate limit
    const result: RateLimitResult = await manager.checkLimit(
      identifier,
      options.config.scope,
      tier,
      endpoint,
      method
    );

    const decision = result.decision;

    // Check quota if enabled
    let quotaCheck;
    if (decision.allowed) {
      const tokenCount = parseInt(c.req.header('x-token-count') || '0', 10);
      const requestCost = parseFloat(c.req.header('x-request-cost') || '0');

      quotaCheck = await quotaManager.checkQuota(identifier, tier, requestCost, tokenCount);

      if (!quotaCheck.allowed) {
        // Quota blocked the request
        const quotaStatus = quotaCheck.status;
        decision.allowed = false;
        decision.remaining = quotaStatus.remaining;
        decision.limit = quotaStatus.limit;
        decision.resetTime = quotaStatus.resetTime;
        decision.resetIn = Math.max(0, quotaStatus.resetTime - Date.now());
      }
    }

    // Add rate limit headers if enabled
    if (options.addHeaders !== false) {
      c.header('X-RateLimit-Limit', decision.limit.toString());
      c.header('X-RateLimit-Remaining', decision.remaining.toString());
      c.header('X-RateLimit-Reset', decision.resetTime.toString());
      c.header('X-RateLimit-Reset-In', `${Math.ceil(decision.resetIn / 1000)}`);

      if (decision.retryAfter) {
        c.header('Retry-After', decision.retryAfter.toString());
      }

      if (decision.tier) {
        c.header('X-RateLimit-Tier', decision.tier);
      }

      if (quotaCheck?.softLimitExceeded) {
        c.header('X-RateLimit-Soft-Limit', 'true');
        c.header('X-RateLimit-Warning', 'Soft limit exceeded');
      }
    }

    // Log event if enabled
    if (options.logEvents) {
      console.log(JSON.stringify({
        type: 'rate_limit',
        timestamp: Date.now(),
        identifier,
        tier,
        endpoint,
        method,
        allowed: decision.allowed,
        remaining: decision.remaining,
        limit: decision.limit,
      }));
    }

    // Handle rate limit exceeded
    if (!decision.allowed) {
      if (options.errorHandler) {
        return options.errorHandler(c, decision);
      }

      return c.json(
        {
          error: 'Rate limit exceeded',
          message: `Rate limit exceeded. Try again in ${Math.ceil(decision.resetIn / 1000)} seconds.`,
          retryAfter: decision.retryAfter || Math.ceil(decision.resetIn / 1000),
          limit: decision.limit,
          remaining: decision.remaining,
          resetAt: new Date(decision.resetTime).toISOString(),
        },
        429
      );
    }

    // Record usage if allowed
    if (decision.allowed) {
      const tokenCount = parseInt(c.req.header('x-token-count') || '0', 10);
      const requestCost = parseFloat(c.req.header('x-request-cost') || '0');

      await quotaManager.recordUsage(identifier, tier, requestCost, tokenCount);

      // Release concurrent request quota after response
      c.res.headers.set('X-Concurrent-Release', 'true');
      const originalJson = c.json.bind(c);
      c.json = ((data: unknown, arg1?: number | ResponseInit) => {
        void quotaManager.releaseConcurrent(identifier, tier);
        // Handle both overload cases
        if (typeof arg1 === 'number') {
          return originalJson(data, arg1);
        } else {
          return originalJson(data, arg1);
        }
      }) as typeof c.json;
    }

    // Store decision in context for later use
    c.set('rateLimit', decision);

    return next();
  };
}

/**
 * Create IP-based rate limit middleware
 */
export function rateLimitByIP(config: RateLimitConfig) {
  return rateLimit({
    config,
    identifierGenerator: (c) => Promise.resolve(extractIP(c)),
    tierGenerator: (c) => Promise.resolve(extractTier(c)),
    addHeaders: true,
  });
}

/**
 * Create user-based rate limit middleware
 */
export function rateLimitByUser(config: RateLimitConfig) {
  return rateLimit({
    config,
    identifierGenerator: (c) => {
      const userId = extractUserId(c);
      return Promise.resolve(userId || extractIP(c));
    },
    tierGenerator: (c) => Promise.resolve(extractTier(c)),
    addHeaders: true,
  });
}

/**
 * Create hierarchical rate limit middleware (IP > User > Org > Global)
 */
export function rateLimitHierarchical(config: {
  kv?: KVNamespace;
  ipLimit?: RateLimitConfig;
  userLimit?: RateLimitConfig;
  orgLimit?: RateLimitConfig;
  globalLimit?: RateLimitConfig;
}) {
  const manager = new RateLimitManager({
    ...(config.kv !== undefined ? { kv: config.kv } : {}),
  });

  return async (c: Context, next: Next) => {
    const ip = extractIP(c);
    const userId = extractUserId(c);
    const orgId = extractOrgId(c);
    const tier = extractTier(c);

    const decision = await manager.checkHierarchicalLimits(
      ip,
      userId,
      orgId,
      tier,
      c.req.path
    );

    // Add headers
    c.header('X-RateLimit-Limit', decision.limit.toString());
    c.header('X-RateLimit-Remaining', decision.remaining.toString());
    c.header('X-RateLimit-Reset', decision.resetTime.toString());

    if (!decision.allowed) {
      return c.json(
        {
          error: 'Rate limit exceeded',
          message: `Rate limit exceeded. Try again in ${Math.ceil(decision.resetIn / 1000)} seconds.`,
          retryAfter: Math.ceil(decision.resetIn / 1000),
        },
        429
      );
    }

    return next();
  };
}

/**
 * Create tier-based rate limit middleware
 */
export function rateLimitByTier(config: {
  free: RateLimitConfig;
  pro?: RateLimitConfig;
  enterprise?: RateLimitConfig;
}) {
  return rateLimit({
    config: config.free,
    identifierGenerator: (c) => {
      const userId = extractUserId(c);
      return Promise.resolve(userId || extractIP(c));
    },
    tierGenerator: (c) => Promise.resolve(extractTier(c)),
    addHeaders: true,
  });
}

/**
 * Skip rate limiting for authenticated admin users
 */
export function skipIfAdmin(c: Context): boolean {
  const role = c.req.header('x-user-role');
  return role === 'admin';
}

/**
 * Skip rate limiting for specific paths
 */
export function skipIfPath(patterns: string[] | RegExp[]) {
  return (c: Context): boolean => {
    const path = c.req.path;
    return patterns.some((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern.test(path);
      }
      return path === pattern;
    });
  };
}

/**
 * Skip rate limiting for specific methods
 */
export function skipIfMethod(methods: string[]) {
  return (c: Context): boolean => {
    return methods.includes(c.req.method);
  };
}

/**
 * Custom error handler for rate limits
 */
export function rateLimitErrorHandler(
  c: Context,
  decision: RateLimitDecision
): Response {
  // Check if client wants JSON
  const accepts = c.req.header('accept');
  const wantsJSON = accepts?.includes('application/json');

  if (wantsJSON) {
    return c.json(
      {
        error: 'Rate limit exceeded',
        message: `Rate limit exceeded. Try again in ${Math.ceil(decision.resetIn / 1000)} seconds.`,
        retryAfter: decision.retryAfter || Math.ceil(decision.resetIn / 1000),
        limit: decision.limit,
        remaining: decision.remaining,
        resetAt: new Date(decision.resetTime).toISOString(),
        scope: decision.scope,
        tier: decision.tier,
      },
      {
        status: 429,
        headers: {
          'Retry-After': (decision.retryAfter || Math.ceil(decision.resetIn / 1000)).toString(),
        },
      }
    );
  }

  // HTML response
  return c.html(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Rate Limit Exceeded</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          h1 { color: #e53e3e; margin-bottom: 1rem; }
          p { color: #718096; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Rate Limit Exceeded</h1>
          <p>You've exceeded the rate limit. Please try again in ${Math.ceil(decision.resetIn / 1000)} seconds.</p>
        </div>
      </body>
    </html>
    `,
    {
      status: 429,
      headers: {
        'Retry-After': (decision.retryAfter || Math.ceil(decision.resetIn / 1000)).toString(),
      },
    }
  ) as Response;
}

/**
 * Get rate limit info from context
 */
export function getRateLimitInfo(c: Context): RateLimitDecision | undefined {
  return c.get('rateLimit');
}

/**
 * Check if request is rate limited
 */
export function isRateLimited(c: Context): boolean {
  const decision = getRateLimitInfo(c);
  return decision ? !decision.allowed : false;
}

/**
 * Middleware factory for creating custom rate limiters
 */
export function createRateLimiter(
  identifierGenerator: (c: Context) => string | Promise<string>,
  tierGenerator?: (c: Context) => SubscriptionTier | Promise<SubscriptionTier>,
  options?: Partial<RateLimitMiddlewareOptions>
) {
  return (config: RateLimitConfig) =>
    rateLimit({
      config,
      identifierGenerator,
      ...(tierGenerator !== undefined ? { tierGenerator } : {}),
      addHeaders: true,
      logEvents: false,
      ...options,
    });
}
