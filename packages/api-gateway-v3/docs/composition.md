# API Composition Guide

The Composition Engine enables you to orchestrate multiple service calls into a single, optimized request.

## Basic Concepts

### CompositionRequest

```typescript
interface CompositionRequest {
  requestId: string;
  operations: CompositionOperation[];
  timeout?: number;
  mergeStrategy?: MergeStrategy;
  errorPolicy?: ErrorPolicy;
}
```

### CompositionOperation

```typescript
interface CompositionOperation {
  id: string;
  serviceId: string;
  method: string;
  path: string;
  params: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  dependencies?: string[];
  mergeConfig?: MergeConfig;
}
```

## Merge Strategies

### Parallel

Execute all operations simultaneously:

```typescript
const result = await engine.execute({
  requestId: 'req-1',
  operations: [
    { id: 'user', serviceId: 'users-service', method: 'GET', path: '/users/123', params: {} },
    { id: 'posts', serviceId: 'posts-service', method: 'GET', path: '/posts', params: { userId: '123' } },
    { id: 'comments', serviceId: 'comments-service', method: 'GET', path: '/comments', params: { userId: '123' } },
  ],
  mergeStrategy: 'parallel',
  errorPolicy: 'continue',
});
```

### Sequential

Execute operations in order:

```typescript
const result = await engine.execute({
  requestId: 'req-2',
  operations: [
    { id: 'post', serviceId: 'posts-service', method: 'GET', path: '/posts/1', params: {} },
    { id: 'comments', serviceId: 'comments-service', method: 'GET', path: '/comments', params: { postId: '1' } },
  ],
  mergeStrategy: 'sequential',
  errorPolicy: 'fail-fast',
});
```

### Mixed

Use dependencies to create execution graph:

```typescript
const result = await engine.execute({
  requestId: 'req-3',
  operations: [
    {
      id: 'user',
      serviceId: 'users-service',
      method: 'GET',
      path: '/users/123',
      params: {},
    },
    {
      id: 'posts',
      serviceId: 'posts-service',
      method: 'GET',
      path: '/posts',
      params: { userId: '123' },
      dependencies: ['user'], // Wait for user to be fetched first
    },
    {
      id: 'comments',
      serviceId: 'comments-service',
      method: 'GET',
      path: '/comments',
      params: { userId: '123' },
      dependencies: ['user'], // Can run in parallel with posts
    },
  ],
  mergeStrategy: 'mixed',
  errorPolicy: 'continue',
});
```

## Error Handling

### Continue Policy

Continue execution even if some operations fail:

```typescript
const result = await engine.execute({
  requestId: 'req-4',
  operations: [...],
  errorPolicy: 'continue',
});

// Check for errors
if (result.errors.length > 0) {
  console.error('Some operations failed:', result.errors);
}
```

### Fail-Fast Policy

Stop execution on first error:

```typescript
const result = await engine.execute({
  requestId: 'req-5',
  operations: [...],
  errorPolicy: 'fail-fast',
});
```

### Aggregate Policy

Collect all errors but continue execution:

```typescript
const result = await engine.execute({
  requestId: 'req-6',
  operations: [...],
  errorPolicy: 'aggregate',
});

// Process all errors
for (const error of result.errors) {
  console.error(`Operation ${error.operationId} failed:`, error.error);
}
```

## Data Merging

### Simple Merge

By default, operation results are merged by ID:

```typescript
const result = await engine.execute({ ... });

// Access results
const user = result.data.user;
const posts = result.data.posts;
```

### Custom Merge Config

Define how to merge results:

```typescript
const result = await engine.execute({
  requestId: 'req-7',
  operations: [
    {
      id: 'user',
      serviceId: 'users-service',
      method: 'GET',
      path: '/users/123',
      params: {},
      mergeConfig: {
        targetPath: 'profile',
      },
    },
    {
      id: 'stats',
      serviceId: 'users-service',
      method: 'GET',
      path: '/users/123/stats',
      params: {},
      mergeConfig: {
        targetPath: 'profile.statistics',
      },
    },
  ],
  mergeStrategy: 'parallel',
});

// Result will have merged structure
console.log(result.data.profile);
console.log(result.data.profile.statistics);
```

### Array Merge Strategies

```typescript
const result = await engine.execute({
  requestId: 'req-8',
  operations: [
    {
      id: 'posts1',
      serviceId: 'posts-service',
      method: 'GET',
      path: '/posts',
      params: { page: 1 },
      mergeConfig: {
        targetPath: 'posts',
        arrayMerge: 'append', // or 'replace', 'prepend', 'merge'
      },
    },
  ],
});
```

## Caching

### Enable Caching

```typescript
const engine = new CompositionEngine(registry, {
  cache: {
    enabled: true,
    ttl: 60000, // 60 seconds
    maxSize: 1000,
  },
});
```

### Cache Invalidation

```typescript
// Clear all cache
engine.clearCache();

// Clear by pattern
engine.clearCache('user:*');

// Clear specific composition
engine.clearCache('composition:abc123');
```

### Cache Metrics

```typescript
const metrics = engine.getMetrics();
console.log(`Cache hit rate: ${metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)}`);
```

## Retry Policy

```typescript
const result = await engine.execute({
  requestId: 'req-9',
  operations: [
    {
      id: 'flaky-service',
      serviceId: 'flaky-service',
      method: 'GET',
      path: '/data',
      params: {},
      retryPolicy: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        retryableErrors: [500, 502, 503, 504],
      },
    },
  ],
});
```

## Batch Processing

```typescript
const requests: CompositionRequest[] = [
  { requestId: 'batch-1', operations: [...], mergeStrategy: 'parallel', errorPolicy: 'continue' },
  { requestId: 'batch-2', operations: [...], mergeStrategy: 'parallel', errorPolicy: 'continue' },
  { requestId: 'batch-3', operations: [...], mergeStrategy: 'parallel', errorPolicy: 'continue' },
];

const results = await engine.executeBatch(requests);

for (const result of results) {
  console.log(`Request ${result.requestId} completed with ${result.errors.length} errors`);
}
```

## Metrics

```typescript
const metrics = engine.getMetrics();

console.log(`Total compositions: ${metrics.totalCompositions}`);
console.log(`Successful: ${metrics.successfulCompositions}`);
console.log(`Failed: ${metrics.failedCompositions}`);
console.log(`Average duration: ${metrics.averageDuration}ms`);
console.log(`P50: ${metrics.p50Duration}ms`);
console.log(`P95: ${metrics.p95Duration}ms`);
console.log(`P99: ${metrics.p99Duration}ms`);
```

## Best Practices

1. **Use parallel execution** for independent operations
2. **Define dependencies** when operations need data from previous operations
3. **Set appropriate timeouts** to prevent hanging requests
4. **Enable caching** for frequently accessed data
5. **Use continue policy** for non-critical operations
6. **Monitor metrics** to optimize performance
7. **Use batch processing** for multiple independent compositions

## Examples

See the [examples directory](../examples/composition.ts) for more detailed examples.
