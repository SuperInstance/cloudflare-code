# Edge Optimization Guide

The Edge Optimizer provides edge computing capabilities with intelligent routing, caching, and function execution.

## Edge Regions

Define edge regions for global deployment:

```typescript
import { EdgeOptimizer } from '@claudeflare/api-gateway-v3/edge';

const optimizer = new EdgeOptimizer({
  enabled: true,
  defaultRegion: 'us-east-1',
  routing: {
    strategy: 'latency',
    regions: [
      {
        name: 'us-east-1',
        code: 'use1',
        endpoint: 'https://use1.example.com',
        latitude: 40.7128,
        longitude: -74.0060,
        healthy: true,
      },
      {
        name: 'eu-west-1',
        code: 'euw1',
        endpoint: 'https://euw1.example.com',
        latitude: 51.5074,
        longitude: -0.1278,
        healthy: true,
      },
      {
        name: 'ap-southeast-1',
        code: 'aps1',
        endpoint: 'https://aps1.example.com',
        latitude: 1.3521,
        longitude: 103.8198,
        healthy: true,
      },
    ],
    healthCheck: true,
    healthCheckInterval: 30000,
  },
  cache: {
    enabled: true,
    ttl: 3600000,
  },
  functions: [],
  metrics: { enabled: true },
});
```

## Routing Strategies

### Latency-based Routing

Route to the region with lowest latency:

```typescript
const optimizer = new EdgeOptimizer({
  routing: {
    strategy: 'latency',
    regions: [...],
  },
});
```

### Geo-based Routing

Route to the nearest geographic region:

```typescript
const optimizer = new EdgeOptimizer({
  routing: {
    strategy: 'geo',
    regions: [...],
  },
});

// Client context includes location
const context: EdgeRequestContext = {
  region: 'client-region',
  latitude: 40.7128,
  longitude: '-74.0060',
};

const optimized = await optimizer.optimizeRequest(request, context);
```

### Round-robin Routing

Distribute load evenly across regions:

```typescript
const optimizer = new EdgeOptimizer({
  routing: {
    strategy: 'round-robin',
    regions: [...],
  },
});
```

### Weighted Routing

Distribute load based on weights:

```typescript
const optimizer = new EdgeOptimizer({
  routing: {
    strategy: 'weighted',
    regions: [
      {
        name: 'us-east-1',
        code: 'use1',
        endpoint: 'https://use1.example.com',
        latitude: 40.7128,
        longitude: -74.0060,
        weight: 3, // 3x traffic
        healthy: true,
      },
      {
        name: 'eu-west-1',
        code: 'euw1',
        endpoint: 'https://euw1.example.com',
        latitude: 51.5074,
        longitude: -0.1278,
        weight: 1, // 1x traffic
        healthy: true,
      },
    ],
  },
});
```

## Edge Caching

### Basic Caching

```typescript
// Cache response
await optimizer.set('cache-key', {
  data: 'response data',
}, {
  ttl: 60000, // 60 seconds
  tags: ['api', 'users'],
});

// Get from cache
const entry = await optimizer.get('cache-key');
if (entry) {
  console.log('Cache hit:', entry.value);
} else {
  console.log('Cache miss');
}
```

### Cache Invalidation

```typescript
// Invalidate by pattern
await optimizer.invalidate('user:*');

// Invalidate by tags
await optimizer.invalidate(undefined, ['api', 'users']);

// Purge all cache
await optimizer.purge();
```

### Cache Options

```typescript
interface CacheOptions {
  ttl?: number;           // Time to live in ms
  tags?: string[];        // Cache tags for invalidation
  region?: string;        // Edge region to cache in
  compress?: boolean;     // Compress cached data
  etag?: string;          // ETag for validation
}
```

### Cache Metadata

```typescript
const entry = await optimizer.get('cache-key');
if (entry) {
  console.log('Created:', entry.metadata.createdAt);
  console.log('Accessed:', entry.metadata.accessedAt);
  console.log('Access count:', entry.metadata.accessCount);
  console.log('Edge location:', entry.metadata.edgeLocation);
  console.log('Compressed:', entry.metadata.compressed);
}
```

## Edge Functions

### Register Edge Function

```typescript
optimizer.addFunction({
  id: 'process-data',
  name: 'Process Data',
  handler: 'index.handler',
  runtime: 'javascript',
  memory: 128,
  timeout: 5000,
  regions: ['*'], // All regions
  config: {
    env: {
      API_KEY: 'secret',
    },
  },
});
```

### Execute Edge Function

```typescript
const context: EdgeRequestContext = {
  region: 'us-east-1',
};

const result = await optimizer.executeFunction(
  'process-data',
  { input: 'data' },
  context
);
```

### Edge Function Runtime

```typescript
import { EdgeFunctionRuntime } from '@claudeflare/api-gateway-v3/edge';

const runtime = new EdgeFunctionRuntime();

// Register function
runtime.register({
  id: 'my-function',
  name: 'My Function',
  handler: 'handler',
  runtime: 'javascript',
  memory: 256,
  timeout: 10000,
  regions: ['us-east-1', 'eu-west-1'],
});

// Execute function
const result = await runtime.execute(
  'my-function',
  { input: 'test' },
  { region: 'us-east-1' }
);
```

## Cache Keys

### Custom Cache Keys

```typescript
import { EdgeCacheManager } from '@claudeflare/api-gateway-v3/edge';

const cacheManager = new EdgeCacheManager(optimizer);

const key = cacheManager.createKey(request, {
  enabled: true,
  ttl: 3600000,
  cacheKeys: [
    {
      name: 'user-specific',
      include: [
        { type: 'header', name: 'Authorization' },
        { type: 'query', name: 'userId' },
      ],
      exclude: [
        { type: 'query', name: 'timestamp' },
      ],
    },
  ],
});
```

## Request Optimization

### Optimize Request

```typescript
const context: EdgeRequestContext = {
  region: 'us-east-1',
  latitude: 40.7128,
  longitude: '-74.0060',
};

const optimized = await optimizer.optimizeRequest(request, context);

if (optimized.cached) {
  // Return cached response
  return optimized.data;
} else {
  // Process request at edge
  return processAtEdge(optimized);
}
```

### Response Optimization

```typescript
const optimizedResponse = await optimizer.optimizeResponse(response, {
  enabled: true,
  ttl: 60000,
});

// Response will have cache headers and compression applied
```

## Cache Warming

Pre-populate cache with frequently accessed data:

```typescript
await optimizer.warmup(
  ['user:123', 'user:456', 'user:789'],
  async (key) => {
    // Fetch data from source
    const response = await fetch(`https://api.example.com/users/${key.split(':')[1]}`);
    return response.json();
  }
);
```

## Metrics

### Edge Metrics

```typescript
const metrics = optimizer.getMetrics();

console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Edge hits: ${metrics.edgeHits}`);
console.log(`Edge misses: ${metrics.edgeMisses}`);
console.log(`Cache hit rate: ${metrics.cacheHitRate}`);
console.log(`Average latency: ${metrics.averageLatency}ms`);

// Region distribution
for (const [region, count] of metrics.regionDistribution) {
  console.log(`${region}: ${count} requests`);
}

// Function executions
for (const [fn, count] of metrics.functionExecutions) {
  console.log(`${fn}: ${count} executions`);
}
```

## Health Checking

Automatic health checking is enabled by default:

```typescript
const optimizer = new EdgeOptimizer({
  routing: {
    healthCheck: true,
    healthCheckInterval: 30000, // 30 seconds
    regions: [...],
  },
});

// Regions are automatically marked healthy/unhealthy
// Traffic is routed away from unhealthy regions
```

## Best Practices

1. **Use edge caching** for frequently accessed data
2. **Deploy edge functions** close to users
3. **Enable health checking** for high availability
4. **Use geo-routing** for better performance
5. **Monitor metrics** to optimize performance
6. **Warm up cache** for known hot data
7. **Use appropriate TTL** for cached data
8. **Implement cache invalidation** for data updates

## Examples

See the [examples directory](../examples/) for complete examples.
