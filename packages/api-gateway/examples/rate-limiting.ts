/**
 * Rate Limiting Examples
 *
 * This example demonstrates various rate limiting strategies:
 * - Token bucket algorithm
 * - Sliding window algorithm
 * - Fixed window algorithm
 * - Leaky bucket algorithm
 * - Hierarchical rate limits
 * - Custom rate limit keys
 */

import {
  createRateLimiter,
  createRateLimitRPM,
  createRateLimitRPS,
} from '../src';
import type { RateLimitAlgorithm, RateLimitScope } from '../src/types';

// Example 1: Basic rate limiting (requests per minute)
const rateLimiterRPM = createRateLimiter({
  algorithm: 'token_bucket',
  storage: 'memory',
  defaultLimits: [
    createRateLimitRPM(60, 'per_ip'), // 60 requests per minute per IP
  ],
});

// Example 2: Rate limiting per user
const rateLimiterPerUser = createRateLimiter({
  algorithm: 'sliding_window',
  storage: 'memory',
  defaultLimits: [
    {
      id: 'user-limit',
      name: 'User Rate Limit',
      scope: 'per_user',
      limit: 1000,
      window: 3600000, // 1 hour
    },
  ],
});

// Example 3: Hierarchical rate limits
const hierarchicalRateLimiter = createRateLimiter({
  algorithm: 'token_bucket',
  storage: 'memory',
  enableHierarchical: true,
  defaultLimits: [
    {
      id: 'global-limit',
      name: 'Global Rate Limit',
      scope: 'global',
      limit: 100000,
      window: 3600000, // 1 hour
    },
    {
      id: 'org-limit',
      name: 'Organization Rate Limit',
      scope: 'per_org',
      limit: 10000,
      window: 3600000, // 1 hour
    },
    {
      id: 'user-limit',
      name: 'User Rate Limit',
      scope: 'per_user',
      limit: 1000,
      window: 3600000, // 1 hour
    },
  ],
});

// Example 4: API key rate limiting with tiers
function createRateLimitsForTier(tier: string) {
  switch (tier) {
    case 'free':
      return [
        createRateLimitRPM(10, 'per_api_key'),
      ];
    case 'basic':
      return [
        createRateLimitRPM(100, 'per_api_key'),
      ];
    case 'pro':
      return [
        createRateLimitRPM(1000, 'per_api_key'),
      ];
    case 'enterprise':
      return [
        createRateLimitRPM(10000, 'per_api_key'),
      ];
    default:
      return [
        createRateLimitRPM(10, 'per_api_key'),
      ];
  }
}

// Example 5: Custom rate limit keys
const customKeyRateLimiter = createRateLimiter({
  algorithm: 'fixed_window',
  storage: 'memory',
  defaultLimits: [
    {
      id: 'custom-limit',
      name: 'Custom Key Rate Limit',
      scope: 'per_user',
      limit: 100,
      window: 60000,
      key: '{{org_id}}:{{user_id}}:api', // Custom key template
    },
  ],
});

// Example 6: Rate limiting with burst handling
const burstRateLimiter = createRateLimiter({
  algorithm: 'token_bucket',
  storage: 'memory',
  enableBurst: true,
  burstCapacity: 20, // Allow bursts up to 20 requests
  defaultLimits: [
    {
      id: 'burst-limit',
      name: 'Burst Rate Limit',
      scope: 'per_ip',
      limit: 10, // Sustained rate: 10 requests per second
      window: 1000,
      burst: 20, // Burst capacity: 20 requests
    },
  ],
});

// Example 7: Rate limiting by endpoint
const endpointRateLimits = createRateLimiter({
  algorithm: 'sliding_window',
  storage: 'memory',
  defaultLimits: [
    {
      id: 'search-limit',
      name: 'Search Endpoint Rate Limit',
      scope: 'per_user',
      limit: 100,
      window: 60000, // 100 searches per minute
    },
    {
      id: 'export-limit',
      name: 'Export Endpoint Rate Limit',
      scope: 'per_user',
      limit: 10,
      window: 3600000, // 10 exports per hour
    },
    {
      id: 'webhook-limit',
      name: 'Webhook Rate Limit',
      scope: 'per_org',
      limit: 1000,
      window: 3600000, // 1000 webhooks per hour
    },
  ],
});

// Example 8: Rate limiting with graceful degradation
const degradingRateLimiter = createRateLimiter({
  algorithm: 'token_bucket',
  storage: 'memory',
  degradeOnFailure: true, // Allow requests if rate limiting fails
  defaultLimits: [
    createRateLimitRPM(60, 'per_ip'),
  ],
});

// Example 9: Rate limiting with different algorithms
function createRateLimiterWithAlgorithm(algorithm: RateLimitAlgorithm) {
  return createRateLimiter({
    algorithm,
    storage: 'memory',
    defaultLimits: [
      {
        id: 'limit',
        name: 'Rate Limit',
        scope: 'per_ip',
        limit: 100,
        window: 60000,
      },
    ],
  });
}

// Example 10: Rate limiting with time-based windows
function createBusinessHoursRateLimit() {
  const now = new Date();
  const isBusinessHours = now.getHours() >= 9 && now.getHours() < 17;

  if (isBusinessHours) {
    // Stricter limits during business hours
    return createRateLimiter({
      algorithm: 'sliding_window',
      storage: 'memory',
      defaultLimits: [
        createRateLimitRPM(100, 'per_user'),
      ],
    });
  } else {
    // Relaxed limits outside business hours
    return createRateLimiter({
      algorithm: 'sliding_window',
      storage: 'memory',
      defaultLimits: [
        createRateLimitRPM(1000, 'per_user'),
      ],
    });
  }
}

// Example usage function
async function checkRateLimit(request: any, context: any) {
  const result = await rateLimiterRPM.check(request, context);

  if (!result.allowed) {
    return {
      allowed: false,
      retryAfter: result.retryAfter,
      limit: result.limit,
      remaining: result.remaining,
    };
  }

  return {
    allowed: true,
    limit: result.limit,
    remaining: result.remaining,
  };
}

// Export examples
export {
  rateLimiterRPM,
  rateLimiterPerUser,
  hierarchicalRateLimiter,
  createRateLimitsForTier,
  customKeyRateLimiter,
  burstRateLimiter,
  endpointRateLimits,
  degradingRateLimiter,
  createRateLimiterWithAlgorithm,
  createBusinessHoursRateLimit,
  checkRateLimit,
};
