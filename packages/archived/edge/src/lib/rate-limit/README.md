# Rate Limiting & Circuit Breaker Module

Production-grade rate limiting, circuit breakers, retry logic, and quota tracking for ClaudeFlare.

## Overview

This module provides comprehensive resilience patterns for handling API requests:

- **Token Bucket Rate Limiter**: Allows burst traffic up to capacity, then refills at a steady rate
- **Sliding Window Rate Limiter**: Precise rate limiting without edge spikes
- **Circuit Breaker**: Prevents cascading failures by stopping requests to failing services
- **Retry Logic**: Automatic retry with exponential backoff and jitter
- **Quota Tracker**: Track API usage across multiple providers with automatic reset

## Features

- ✅ Distributed state management with Cloudflare Workers KV and Durable Objects
- ✅ Automatic persistence and recovery
- ✅ Configurable thresholds and timeouts
- ✅ Real-time monitoring and statistics
- ✅ Support for multiple rate limit strategies
- ✅ Provider quota tracking with predictive analytics
- ✅ Comprehensive test coverage

## Installation

```typescript
import {
  TokenBucket,
  SlidingWindow,
  CircuitBreaker,
  RetryPolicy,
  QuotaTracker,
} from './lib/rate-limit';
```

## Quick Start

### Token Bucket Rate Limiter

```typescript
import { createRateLimiterRPM } from './lib/rate-limit';

// Create a rate limiter: 100 requests per minute
const limiter = createRateLimiterRPM(100, env.SESSIONS);

// Check if request is allowed
if (await limiter.tryConsume('user-123')) {
  // Process request
} else {
  // Rate limited
  return new Response('Too many requests', { status: 429 });
}
```

### Circuit Breaker

```typescript
import { createCircuitBreaker } from './lib/rate-limit';

const breaker = createCircuitBreaker('api-service', env.CONFIG_KV);

try {
  const result = await breaker.execute(async () => {
    return await fetchFromAPI();
  });
} catch (error) {
  if (breaker.getState() === 'OPEN') {
    // Circuit is open, use fallback
    return getFallbackResponse();
  }
  throw error;
}
```

### Retry Logic

```typescript
import { createAPIRetryPolicy } from './lib/retry';

const retry = createAPIRetryPolicy(3);

try {
  const result = await retry.execute(async () => {
    return await fetchFromAPI();
  });
} catch (error) {
  // All retries exhausted
  console.error('Failed after retries:', error);
}
```

### Quota Tracker

```typescript
import { createQuotaTracker } from './lib/quota';

const tracker = createQuotaTracker(env.CONFIG_KV);

// Initialize provider quota
await tracker.initialize('openai', 1000000, 'daily');

// Record usage
await tracker.recordUsage('openai', 1000);

// Check quota
if (await tracker.hasQuota('openai', 1000)) {
  // Make API call
}

// Get usage percentage
const percent = await tracker.getQuotaPercent('openai');
console.log(`Usage: ${percent.toFixed(1)}%`);
```

## Configuration Examples

### Rate Limiting Strategy

```typescript
// For user-level rate limiting (100 req/min)
const userLimiter = createRateLimiterRPM(100, env.SESSIONS);

// For IP-based rate limiting (1000 req/min)
const ipLimiter = createRateLimiterRPM(1000, env.SESSIONS);

// For token-based rate limiting (1M tokens/min)
const tokenLimiter = createRateLimiterTPM(1000000, env.SESSIONS);
```

### Circuit Breaker Configuration

```typescript
const breaker = new CircuitBreaker({
  name: 'openai-api',
  failureThreshold: 5,      // Open after 5 failures
  successThreshold: 2,      // Close after 2 successes
  timeout: 60000,           // Try reset after 60s
  halfOpenMaxCalls: 3,      // Max 3 test calls in half-open
  kv: env.CONFIG_KV,        // Persist state to KV
});
```

### Retry Policy Configuration

```typescript
const retry = new RetryPolicy({
  maxAttempts: 3,           // Max retry attempts
  baseDelay: 1000,          // Start with 1s delay
  maxDelay: 60000,          // Max 60s delay
  backoffMultiplier: 2,     // Double each time
  jitterFactor: 0.1,        // Add 10% randomness

  // Custom retry condition
  shouldRetry: (error, attempt) => {
    return error.status === 429 || attempt < 2;
  },

  // Callback on each retry
  onRetry: (error, attempt, delay) => {
    console.log(`Retry ${attempt} after ${delay}ms`);
  },
});
```

## Integration Example

Complete example combining all resilience patterns:

```typescript
import { TokenBucket, CircuitBreaker, RetryPolicy, QuotaTracker } from './lib/rate-limit';

export class ResilientAPI {
  private rateLimiter: TokenBucket;
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;
  private quotaTracker: QuotaTracker;

  constructor(env: Env) {
    this.rateLimiter = createRateLimiterRPM(100, env.SESSIONS);
    this.circuitBreaker = createCircuitBreaker('api-service', env.CONFIG_KV);
    this.retryPolicy = createAPIRetryPolicy(3);
    this.quotaTracker = createQuotaTracker(env.CONFIG_KV);

    // Initialize quotas
    this.initializeQuotas();
  }

  private async initializeQuotas() {
    await this.quotaTracker.initialize('openai', 1000000, 'daily');
    await this.quotaTracker.initialize('anthropic', 500000, 'daily');
    await this.quotaTracker.initialize('groq', 10000000, 'daily');
  }

  async callAPI(provider: string, userId: string): Promise<Response> {
    // 1. Check rate limits
    const allowed = await this.rateLimiter.tryConsume(userId);
    if (!allowed) {
      throw new Error('Rate limit exceeded');
    }

    // 2. Check quota
    const hasQuota = await this.quotaTracker.hasQuota(provider, 1000);
    if (!hasQuota) {
      // Try failover to another provider
      provider = await this.selectAvailableProvider();
    }

    // 3. Execute with circuit breaker and retry
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await this.retryPolicy.execute(async () => {
          const response = await this.fetchFromProvider(provider);
          await this.quotaTracker.recordUsage(provider, response.tokens);
          return response;
        });
      });

      return result;
    } catch (error) {
      // All retries failed, circuit might be open
      if (this.circuitBreaker.getState() === 'OPEN') {
        return await this.getFallbackResponse();
      }
      throw error;
    }
  }

  private async selectAvailableProvider(): Promise<string> {
    const providers = await this.quotaTracker.getProvidersByRemaining();
    return providers[0];
  }
}
```

## Testing

### Unit Tests

```bash
# Run all rate limiting tests
npm test -- rate-limit

# Run specific test file
npm test -- token-bucket.test.ts
```

### Load Testing

```typescript
// Simulate burst traffic
const limiter = new TokenBucket({ capacity: 100, refillRate: 10 });

let allowed = 0;
for (let i = 0; i < 200; i++) {
  if (await limiter.tryConsume('user-1')) {
    allowed++;
  }
}

console.log(`Allowed: ${allowed}, Blocked: ${200 - allowed}`);
// Expected: Allowed: 100, Blocked: 100
```

## Best Practices

### 1. Rate Limiting

- Use **token bucket** for user-level limits (allows burst traffic)
- Use **sliding window** for system-wide limits (more precise)
- Set appropriate capacity and refill rate based on your needs
- Monitor usage and adjust thresholds accordingly

### 2. Circuit Breakers

- Set failure threshold based on acceptable error rate
- Use timeouts to allow automatic recovery
- Monitor circuit state in your metrics
- Have fallback strategies for OPEN state

### 3. Retry Logic

- Use exponential backoff to avoid overwhelming services
- Add jitter to prevent thundering herd
- Set appropriate max attempts (3-5 for most cases)
- Only retry on transient errors (429, 5xx, network errors)

### 4. Quota Tracking

- Initialize quotas for each provider at startup
- Use daily resets for free tier quotas
- Monitor usage percentage and set alerts
- Implement failover to backup providers

### 5. Distributed Systems

- Use KV/Durable Objects for state persistence
- Handle race conditions appropriately
- Monitor state synchronization
- Test with concurrent requests

## Performance Considerations

### Token Bucket

- Time Complexity: O(1) per request
- Space Complexity: O(n) where n is number of unique identifiers
- Refill calculation: O(1) with last refill timestamp

### Sliding Window

- Time Complexity: O(n) where n is number of requests in window
- Space Complexity: O(n) for storing timestamps
- Cleanup: Periodic removal of old timestamps

### Circuit Breaker

- Time Complexity: O(1) per request
- Space Complexity: O(1) for state
- KV Persistence: Async write on state change

### Retry Logic

- Time Complexity: O(1) per attempt
- Space Complexity: O(1) for retry state
- Delay: Exponential with jitter

## Monitoring

```typescript
// Get rate limiter statistics
const stats = await limiter.getStats('user-123');
console.log({
  remaining: stats.remaining,
  usagePercent: ((stats.capacity - stats.remaining) / stats.capacity * 100).toFixed(1),
});

// Get circuit breaker state
const state = breaker.getState();
console.log('Circuit state:', state);

const cbStats = breaker.getStats();
console.log({
  failureCount: cbStats.failureCount,
  lastFailureTime: new Date(cbStats.lastFailureTime),
});

// Get quota statistics
const quotaStats = await tracker.getStats('openai');
console.log({
  usagePercent: quotaStats.usagePercent.toFixed(1),
  remaining: quotaStats.remaining,
  isExhausted: quotaStats.isExhausted,
});
```

## Error Handling

```typescript
// Rate limit exceeded
if (!await limiter.tryConsume('user-1')) {
  return new Response('Rate limit exceeded', {
    status: 429,
    headers: {
      'Retry-After': '60',
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '0',
    },
  });
}

// Circuit breaker open
if (breaker.getState() === 'OPEN') {
  return new Response('Service temporarily unavailable', {
    status: 503,
    headers: {
      'Retry-After': '60',
    },
  });
}

// Quota exhausted
if (await tracker.isExhausted('openai', 0.9)) {
  // Use fallback provider
  provider = await selectFallbackProvider();
}
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
