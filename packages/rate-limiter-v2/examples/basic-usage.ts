/**
 * Basic Usage Examples for @claudeflare/rate-limiter-v2
 */

import {
  RateLimiter,
  RateLimitAlgorithm,
  expressMiddleware,
  ipRateLimiter
} from '../src/index.js';

// Example 1: Basic Sliding Window Rate Limiter
async function basicSlidingWindow() {
  const limiter = new RateLimiter({
    config: {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 100,
      window: 60000 // 1 minute
    }
  });

  const result = await limiter.check({
    identifier: 'user-123',
    endpoint: '/api/users'
  });

  if (result.allowed) {
    console.log('Request allowed');
    console.log(`Remaining: ${result.remaining}`);
    console.log(`Reset at: ${new Date(result.reset)}`);
  } else {
    console.log('Rate limit exceeded');
    console.log(`Retry after: ${result.retryAfter}ms`);
  }

  await limiter.destroy();
}

// Example 2: Token Bucket with Burst
async function tokenBucketWithBurst() {
  const limiter = RateLimiter.tokenBucket(
    100,  // 100 tokens per minute
    60000, // 1 minute window
    200   // burst capacity of 200
  );

  // Handle burst traffic
  for (let i = 0; i < 150; i++) {
    const result = await limiter.check({
      identifier: 'user-456'
    });

    if (!result.allowed) {
      console.log(`Request ${i + 1} blocked`);
      break;
    }
  }

  await limiter.destroy();
}

// Example 3: Leaky Bucket for Traffic Shaping
async function leakyBucket() {
  const limiter = RateLimiter.leakyBucket(
    10,    // 10 requests per second
    1000,  // 1 second window
    10000  // process rate (10 requests/sec)
  );

  const result = await limiter.check({
    identifier: 'service-789',
    endpoint: '/api/process'
  });

  console.log(`Allowed: ${result.allowed}`);
  console.log(`Remaining: ${result.remaining}`);

  await limiter.destroy();
}

// Example 4: Hierarchical Rate Limiting
async function hierarchicalLimiting() {
  const limiter = new RateLimiter({
    config: {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 100,
      window: 60000
    },
    hierarchical: {
      global: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 10000,
        window: 60000
      },
      perUser: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 100,
        window: 60000
      },
      perEndpoint: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 50,
        window: 60000
      }
    }
  });

  const result = await limiter.check({
    identifier: 'user-abc',
    userId: 'user-abc',
    endpoint: '/api/expensive'
  });

  console.log('Hierarchical check:', result);

  await limiter.destroy();
}

// Example 5: Adaptive Throttling
async function adaptiveThrottling() {
  const limiter = new RateLimiter({
    config: {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 100,
      window: 60000
    },
    adaptive: {
      enabled: true,
      loadThreshold: 0.8,
      performanceThreshold: 1000,
      costThreshold: 1000,
      adjustmentFactor: 0.2,
      minLimit: 10,
      maxLimit: 200
    }
  });

  const adaptive = limiter.getAdaptive();
  if (adaptive) {
    // Update performance metrics
    adaptive.updateLoadFactor(0.7, 0.6);
    adaptive.updatePerformanceMetrics({
      cpuUsage: 0.7,
      memoryUsage: 0.6,
      responseTime: 500,
      errorRate: 0.01,
      throughput: 100,
      timestamp: Date.now()
    });
  }

  const result = await limiter.check({
    identifier: 'user-xyz',
    metadata: { tier: 'pro' }
  });

  console.log('Adaptive check:', result);

  await limiter.destroy();
}

// Example 6: Event Listeners
async function withEvents() {
  const limiter = new RateLimiter({
    config: {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 10,
      window: 60000
    },
    onEvent: (event) => {
      console.log('Event:', event.type, event.timestamp);

      if (event.type === 'denied') {
        console.log('Rate limit exceeded for:', event.context.identifier);
      }
    }
  });

  await limiter.check({ identifier: 'test-user' });

  await limiter.destroy();
}

// Example 7: Express Middleware
function expressExample() {
  const limiter = RateLimiter.slidingWindow(100, 60000);

  const middleware = expressMiddleware(limiter, {
    headers: true,
    statusCode: 429,
    message: 'Rate limit exceeded. Please try again later.'
  });

  // In Express app:
  // app.use('/api/', middleware);

  limiter.destroy();
}

// Example 8: IP-based Rate Limiting
function ipBasedLimiting() {
  const limiter = RateLimiter.fixedWindow(60, 60000);

  const middleware = ipRateLimiter(limiter, {
    headers: true,
    skip: (req) => {
      // Skip rate limiting for admin users
      return req.user?.role === 'admin';
    }
  });

  // In Express app:
  // app.use('/api/', middleware);

  limiter.destroy();
}

// Example 9: Weighted Requests
async function weightedRequests() {
  const limiter = new RateLimiter({
    config: {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 100,
      window: 60000
    }
  });

  // Expensive operation costs 5 tokens
  const result = await limiter.checkWithWeight(
    {
      identifier: 'user-123',
      endpoint: '/api/expensive-operation'
    },
    5
  );

  console.log('Weighted request:', result);

  await limiter.destroy();
}

// Example 10: Metrics and Monitoring
async function metricsExample() {
  const limiter = new RateLimiter({
    config: {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 100,
      window: 60000
    }
  });

  // Make some requests
  for (let i = 0; i < 50; i++) {
    await limiter.check({ identifier: `user-${i}` });
  }

  // Get metrics
  const metrics = limiter.getMetrics();
  console.log('Metrics:', {
    totalRequests: metrics.totalRequests,
    allowedRequests: metrics.allowedRequests,
    deniedRequests: metrics.deniedRequests,
    averageLatency: metrics.averageLatency,
    peakUsage: metrics.peakUsage
  });

  await limiter.destroy();
}

// Example 11: Distributed Rate Limiting
async function distributedLimiting() {
  const limiter = new RateLimiter({
    config: {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 100,
      window: 60000
    },
    storage: {
      type: 'redis',
      redis: {
        host: 'localhost',
        port: 6379,
        keyPrefix: 'ratelimit'
      }
    },
    distributed: {
      enabled: true,
      syncInterval: 10000,
      leaderElection: true,
      nodeId: 'node-1',
      heartbeatInterval: 5000,
      failureTimeout: 30000
    }
  });

  const result = await limiter.check({
    identifier: 'user-123'
  });

  console.log('Distributed check:', result);

  await limiter.destroy();
}

// Example 12: Custom Key Generator
function customKeyExample() {
  const limiter = RateLimiter.slidingWindow(100, 60000);

  const middleware = expressMiddleware(limiter, {
    keyGenerator: (req) => {
      // Use combination of IP and user ID
      const userId = req.user?.id || 'anonymous';
      const ip = req.ip;
      return `${ip}:${userId}`;
    }
  });

  limiter.destroy();
}

// Example 13: Conditional Rate Limiting
function conditionalLimiting() {
  const limiter = RateLimiter.slidingWindow(100, 60000);

  const middleware = expressMiddleware(limiter, {
    skip: (req) => {
      // Skip rate limiting for:
      // - Admin users
      // - Internal requests
      // - Webhooks
      return (
        req.user?.role === 'admin' ||
        req.headers['x-internal'] === 'true' ||
        req.path.startsWith('/webhooks/')
      );
    }
  });

  limiter.destroy();
}

// Example 14: Multiple Rate Limiters
async function multipleLimiters() {
  // Global rate limiter
  const globalLimiter = RateLimiter.slidingWindow(1000, 60000);

  // Per-user rate limiter
  const userLimiter = RateLimiter.slidingWindow(100, 60000);

  // Per-endpoint rate limiter
  const endpointLimiter = RateLimiter.slidingWindow(50, 60000);

  const context = {
    identifier: 'user-123',
    userId: 'user-123',
    endpoint: '/api/search'
  };

  // Check all limiters
  const globalResult = await globalLimiter.check(context);
  const userResult = await userLimiter.check(context);
  const endpointResult = await endpointLimiter.check(context);

  // Request is allowed only if all limiters allow it
  const allowed = globalResult.allowed && userResult.allowed && endpointResult.allowed;

  console.log('Multiple limiters check:', { allowed, globalResult, userResult, endpointResult });

  await globalLimiter.destroy();
  await userLimiter.destroy();
  await endpointLimiter.destroy();
}

// Example 15: Resetting Rate Limits
async function resetExample() {
  const limiter = RateLimiter.slidingWindow(10, 60000);

  const context = { identifier: 'user-123', endpoint: '/api/test' };

  // Exhaust limit
  for (let i = 0; i < 10; i++) {
    await limiter.check(context);
  }

  // Reset
  await limiter.reset(context);

  // Should be allowed again
  const result = await limiter.check(context);
  console.log('After reset:', result);

  await limiter.destroy();
}

// Run examples
async function runExamples() {
  console.log('Running basic usage examples...\n');

  await basicSlidingWindow();
  await tokenBucketWithBurst();
  await leakyBucket();
  await hierarchicalLimiting();
  await adaptiveThrottling();
  await withEvents();
  expressExample();
  ipBasedLimiting();
  await weightedRequests();
  await metricsExample();
  await distributedLimiting();
  customKeyExample();
  conditionalLimiting();
  await multipleLimiters();
  await resetExample();

  console.log('\nAll examples completed!');
}

// Uncomment to run examples
// runExamples().catch(console.error);
