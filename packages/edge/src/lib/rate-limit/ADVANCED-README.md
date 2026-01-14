# Advanced Rate Limiting & Quota Management

## Overview

A comprehensive, production-ready rate limiting and quota management system for Cloudflare Workers, featuring distributed coordination via Durable Objects, hierarchical limits, and tier-based quotas.

## What's New

This advanced system builds upon the existing rate limiting foundation with:

- **Multi-level hierarchical rate limiting** (global > org > user > IP)
- **Advanced quota management** with tiers (requests, tokens, cost, concurrent)
- **Burst handling** with configurable capacity and recovery
- **Distributed coordination** via Durable Objects
- **Per-endpoint rate limits** with pattern matching
- **Comprehensive analytics** and monitoring
- **Hono middleware** for easy integration

## Features

### Rate Limiting Algorithms

1. **Token Bucket** (Default)
   - Allows burst traffic up to capacity
   - Refills at steady rate
   - Best for API rate limiting

2. **Sliding Window**
   - Precise rate limiting
   - No boundary spikes
   - Best for accurate limits

3. **Fixed Window**
   - Simple and performant
   - Resets at fixed intervals
   - Best for basic cases

4. **Leaky Bucket**
   - Smooths traffic patterns
   - Processes at constant rate
   - Best for traffic shaping

### Hierarchical Limits

```
Global (10,000/min)
  ↓
Organization (1,000/min)
  ↓
User (60/min)
  ↓
IP (100/min)
```

### Tier Configuration

| Tier | RPM | Burst | Cost Limit |
|------|-----|-------|------------|
| Free | 60 | 10 | $10/month |
| Pro | 600 | 100 | $100/month |
| Enterprise | 6,000 | 1,000 | Custom |

### Per-Endpoint Limits

- `/api/chat`: 10/min (free), 100/min (pro)
- `/api/code`: 5/min (free), 50/min (pro)
- `/api/analyze`: 20/min (free), 200/min (pro)
- `/api/admin`: Enterprise only

## Quick Start

### Basic Middleware

```typescript
import { Hono } from 'hono';
import { rateLimit } from './lib/rate-limit';

const app = new Hono();

app.use('/api/*', rateLimit({
  config: {
    maxRequests: 60,
    windowMs: 60000,
    scope: 'user',
  },
  identifierGenerator: (c) => c.req.header('x-user-id') || 'anonymous',
  tierGenerator: (c) => c.req.header('x-tier') || 'free',
  addHeaders: true,
}));
```

### Manager Direct Usage

```typescript
import { RateLimitManager } from './lib/rate-limit';

const manager = new RateLimitManager({
  kv: env.KV,
  doNamespace: env.RATE_LIMIT_DO,
});

const result = await manager.checkLimit('user123', 'user', 'pro', '/api/chat');

if (!result.decision.allowed) {
  console.log(`Rate limited. Retry in ${result.decision.resetIn}ms`);
}
```

### Quota Management

```typescript
import { QuotaManager } from './lib/rate-limit';

const quotaManager = new QuotaManager({
  kv: env.KV,
  enableOverage: true,
});

const check = await quotaManager.checkQuota('user123', 'pro', 0.001, 1000);

if (check.allowed) {
  await quotaManager.recordUsage('user123', 'pro', 0.001, 1000);
}
```

## Architecture

### Components

1. **Algorithms** (`algorithms.ts`)
   - TokenBucket, SlidingWindow, FixedWindow, LeakyBucket
   - Algorithm factory for easy creation
   - Hybrid limiter combining multiple algorithms

2. **Manager** (`manager.ts`)
   - Hierarchical limit checking
   - Tier-based configuration
   - Endpoint-specific limits
   - Custom rule support

3. **Quota** (`quota.ts`)
   - Multi-dimensional quota tracking
   - Request, token, cost, concurrent limits
   - Soft limits and overage support
   - Automatic period resets

4. **Middleware** (`middleware.ts`)
   - Hono middleware integration
   - IP, user, hierarchical limiters
   - Custom error handlers
   - Skip conditions

5. **Analytics** (`analytics.ts`)
   - Event recording and aggregation
   - Top blocked identifiers
   - Tier/endpoint/scope distribution
   - Time-series data export

6. **Durable Objects** (`rate-limit-do.ts`)
   - Distributed state management
   - Coordinator for global limits
   - Automatic cleanup and persistence

### Data Flow

```
Request
  ↓
Extract identifier (IP/user/org)
  ↓
Check hierarchical limits
  ↓
Check endpoint-specific limits
  ↓
Check quota
  ↓
Record usage
  ↓
Return decision
```

## Configuration

### Tier Limits

```typescript
import { RateLimitManager } from './lib/rate-limit';

const manager = new RateLimitManager();

// Update tier configuration
manager.updateTier('pro', {
  tier: 'pro',
  requestsPerMinute: 1000,  // Increased from 600
  burst: 200,               // Increased from 100
  monthlyCostLimit: 200,    // Increased from 100
});
```

### Burst Handling

```typescript
manager.setBurstConfig({
  enabled: true,
  burstSize: 20,           // Allow 20 extra requests
  burstDuration: 10000,    // Over 10 seconds
  recoveryRate: 1,         // Recover 1 request/sec
  cooldownPeriod: 30000,   // 30s cooldown between bursts
});
```

### Custom Rules

```typescript
manager.addRule({
  id: 'custom-api-rule',
  name: 'Custom API Limit',
  scope: 'user',
  config: {
    maxRequests: 100,
    windowMs: 60000,
    scope: 'user',
    algorithm: 'sliding-window',
  },
  tiers: ['pro', 'enterprise'],
  enabled: true,
  priority: 50,
});
```

## Analytics

### Generate Reports

```typescript
import { RateLimitAnalytics } from './lib/rate-limit';

const analytics = new RateLimitAnalytics({
  kv: env.KV,
  maxEvents: 10000,
});

// Generate comprehensive report
const report = await analytics.generateReport(
  Date.now() - 86400000,  // Last 24 hours
  Date.now()
);

console.log('Total requests:', report.summary.totalRequests);
console.log('Block rate:', report.summary.blockRate);
console.log('Top blocked:', report.topBlocked);
console.log('Peak RPS:', report.summary.peakRPS);
```

### Export Data

```typescript
// Export as JSON
const json = await analytics.exportData('json');

// Export as CSV
const csv = await analytics.exportData('csv');
```

## Durable Objects Setup

### wrangler.toml

```toml
[[durable_objects.bindings]]
name = "RATE_LIMIT_DO"
class_name = "RateLimitDO"

[[durable_objects.bindings]]
name = "RATE_LIMIT_COORDINATOR"
class_name = "RateLimitCoordinatorDO"
```

### Enable Distributed Mode

```typescript
const manager = new RateLimitManager({
  kv: env.KV,
  doNamespace: env.RATE_LIMIT_DO,
  enableDistributed: true,
  gracefulDegradation: true,
});
```

## Best Practices

### 1. Choose the Right Algorithm

- **Token Bucket**: General API rate limiting, allows bursts
- **Sliding Window**: Precise limits, no boundary spikes
- **Fixed Window**: Simple cases, performance-critical
- **Leaky Bucket**: Traffic smoothing, preventing bursts

### 2. Set Appropriate Limits

```typescript
// Good: Reasonable free tier
{ maxRequests: 60, windowMs: 60000 }  // 1 per second

// Good: Pro tier with burst
{ maxRequests: 600, windowMs: 60000, burst: 100 }  // 10x free + burst

// Bad: Too restrictive
{ maxRequests: 5, windowMs: 60000 }  // Users will be frustrated

// Bad: Too permissive
{ maxRequests: 100000, windowMs: 60000 }  // No protection
```

### 3. Use Hierarchical Limits

Always set IP-level limits as a safety net:

```typescript
const result = await manager.checkHierarchicalLimits(
  ip,          // IP limit (safety net)
  userId,      // User limit (fair usage)
  orgId,       // Org limit (team management)
  tier,        // Tier configuration
  endpoint     // Endpoint-specific limits
);
```

### 4. Monitor and Adjust

```typescript
// Check statistics regularly
const stats = manager.getStats('user123');

if (stats.blockedRequests / stats.totalRequests > 0.1) {
  // Block rate > 10%, consider increasing limits
  console.warn('High block rate for user123');
}
```

### 5. Handle Failures Gracefully

```typescript
try {
  const result = await manager.checkLimit('user123', 'user', 'pro');
} catch (error) {
  // Fall back to less restrictive limits
  const localResult = await localLimiter.check('user123');
  return localResult;
}
```

## Testing

### Unit Tests

```bash
npm test -- rate-limit/algorithms.test.ts
npm test -- rate-limit/manager.test.ts
npm test -- rate-limit/quota.test.ts
npm test -- rate-limit/analytics.test.ts
```

### Integration Tests

```typescript
import { RateLimitManager } from './lib/rate-limit';

describe('Rate Limiting Integration', () => {
  it('should enforce hierarchical limits', async () => {
    const manager = new RateLimitManager();

    // Exceed user limit
    for (let i = 0; i < 65; i++) {
      await manager.checkLimit('user1', 'user', 'free');
    }

    // Should be blocked
    const result = await manager.checkLimit('user1', 'user', 'free');
    expect(result.decision.allowed).toBe(false);
  });
});
```

## Performance

### Algorithm Complexity

| Algorithm | Time | Space |
|-----------|------|-------|
| Token Bucket | O(1) | O(n) |
| Sliding Window | O(n) | O(n) |
| Fixed Window | O(1) | O(n) |
| Leaky Bucket | O(1) | O(n) |

Where n = number of unique identifiers

### Optimization Tips

1. **Use token bucket** for high-traffic endpoints (O(1))
2. **Enable graceful degradation** to avoid DO failures blocking requests
3. **Set appropriate TTL** for stored state (default: 1 hour)
4. **Monitor DO latency** and fall back to local limits if needed

## Migration Guide

### From Old Token Bucket

```typescript
// Old
import { createRateLimiterRPM } from './lib/rate-limit';
const limiter = createRateLimiterRPM(100);

// New
import { RateLimitManager } from './lib/rate-limit';
const manager = new RateLimitManager();
const result = await manager.checkLimit('user123', 'user', 'free');
```

### From Old Sliding Window

```typescript
// Old
import { createSlidingWindowRPM } from './lib/rate-limit';
const limiter = createSlidingWindowRPM(100);

// New
import { SlidingWindowAlgorithm } from './lib/rate-limit';
const algorithm = new SlidingWindowAlgorithm(100, 60000);
const decision = await algorithm.check('user123');
```

## Troubleshooting

### High Block Rate

```typescript
// Check analytics
const analytics = new RateLimitAnalytics();
const report = await analytics.generateReport();

console.log('Top blocked:', report.topBlocked);
console.log('By tier:', report.tierDistribution);
console.log('By endpoint:', report.topEndpoints);
```

### DO Latency

```typescript
// Enable graceful degradation
const manager = new RateLimitManager({
  doNamespace: env.RATE_LIMIT_DO,
  enableDistributed: true,
  gracefulDegradation: true,  // Fall back to local on DO failure
});
```

### Memory Issues

```typescript
// Reduce max events in analytics
const analytics = new RateLimitAnalytics({
  maxEvents: 1000,  // Default: 10000
});

// Reduce TTL
const manager = new RateLimitManager({
  ttl: 1800,  // 30 minutes instead of 1 hour
});
```

## License

MIT
