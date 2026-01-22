# @claudeflare/cdn

Advanced CDN integration for ClaudeFlare with comprehensive Cloudflare support.

## Features

- **Cache Controller**: Advanced caching with hierarchical storage, policy management, and intelligent bypass rules
- **Invalidation Engine**: URL, tag, and wildcard purging with batch operations and tracking
- **Asset Optimizer**: Image, JavaScript, and CSS optimization with compression and transformation
- **Edge Deployer**: Deploy Workers, functions, and assets with A/B testing and canary deployments
- **Analytics**: Comprehensive metrics collection and reporting for performance and security
- **Multi-CDN Support**: Advanced routing across multiple CDN providers with failover and load balancing

## Installation

```bash
npm install @claudeflare/cdn
```

## Quick Start

```typescript
import { CDN } from '@claudeflare/cdn';

const cdn = new CDN({
  provider: 'cloudflare',
  apiKey: 'your-api-key',
  apiEmail: 'your-email@example.com',
  accountId: 'your-account-id',
  zoneId: 'your-zone-id'
});

// Handle requests
const response = await cdn.handleRequest({
  url: 'https://example.com/api/users',
  method: 'GET',
  headers: {}
});

console.log(`Status: ${response.status}`);
console.log(`From Cache: ${response.fromCache}`);
```

## Cache Management

### Define Cache Policies

```typescript
cache.registerPolicy({
  name: 'static-assets',
  policy: 'public',
  ttl: 86400 * 7, // 1 week
  staleWhileRevalidate: 86400,
  level: 'both',
  tags: ['static', 'assets']
});
```

### Create Cache Rules

```typescript
cache.registerRule({
  id: 'api-endpoints',
  pattern: '^/api/',
  policy: apiPolicy,
  conditions: [
    { field: 'method', operator: 'equals', value: 'GET' }
  ],
  enabled: true,
  priority: 10
});
```

### Cache Operations

```typescript
// Store in cache
await cache.set(cacheKey, {
  url: 'https://example.com/test',
  status: 200,
  size: 1024,
  contentType: 'application/json',
  tags: ['api'],
  ttl: 3600000,
  // ... other fields
});

// Retrieve from cache
const entry = await cache.get(cacheKey);

// Delete by tag
await cache.deleteByTag('api');

// Get statistics
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
```

## Cache Invalidation

### Purge by URL

```typescript
const result = await cdn.purge('url', [
  'https://example.com/api/users',
  'https://example.com/api/posts'
]);

console.log(`Purged: ${result.purged} URLs`);
```

### Purge by Tag

```typescript
const result = await cdn.purge('tag', ['api', 'v1']);
```

### Purge by Wildcard

```typescript
const result = await cdn.purge('wildcard', ['https://example.com/api/*']);
```

### Batch Operations

```typescript
const results = await invalidationEngine.batchPurge([
  { type: 'url', targets: ['https://example.com/page1'] },
  { type: 'tag', targets: ['api'] },
  { type: 'wildcard', targets: ['https://example.com/images/*'] }
]);
```

## Asset Optimization

### Optimize Images

```typescript
const result = await optimizer.optimize(imageBuffer, 'image', {
  quality: 85,
  format: 'webp',
  dimensions: { width: 800, height: 600 }
});

console.log(`Savings: ${result.savings.percentage}%`);
```

### Optimize JavaScript/CSS

```typescript
const result = await optimizer.optimize(jsCode, 'javascript', {
  minify: true,
  compress: true
});
```

### Batch Optimization

```typescript
const results = await optimizer.optimizeBatch([
  { content: imageBuffer, type: 'image', options: { quality: 85 } },
  { content: jsCode, type: 'javascript', options: { minify: true } }
]);
```

## Edge Deployment

### Deploy Functions

```typescript
const result = await cdn.deploy({
  version: '1.0.0',
  functions: [
    {
      name: 'auth-handler',
      content: workerCode,
      routes: ['/api/auth/*']
    }
  ],
  assets: [
    {
      path: '/styles/main.css',
      content: 'body { margin: 0; }',
      contentType: 'text/css'
    }
  ],
  routes: [
    {
      pattern: '/api/*',
      functionName: 'auth-handler'
    }
  ]
]);
```

### A/B Testing

```typescript
const results = await edgeDeployer.deployAB(config, {
  name: 'ui-test',
  variants: [
    { name: 'control', weight: 80, config: { theme: 'light' } },
    { name: 'variant', weight: 20, config: { theme: 'dark' } }
  ],
  criteria: 'userId',
  metrics: ['conversion', 'engagement']
});
```

### Canary Deployments

```typescript
const result = await edgeDeployer.deployCanary(config, 10); // 10% canary
```

## Analytics

### Record Events

```typescript
analytics.recordCacheHit({
  url: 'https://example.com/test',
  responseTime: 100,
  size: 1024,
  country: 'US'
});

analytics.recordError({
  error: 'Test error',
  url: 'https://example.com/test'
});
```

### Get Analytics

```typescript
const analytics = cdn.getAnalytics();
console.log(`Total requests: ${analytics.requests.total}`);
console.log(`Hit rate: ${(analytics.requests.cached / analytics.requests.total * 100).toFixed(2)}%`);
```

### Generate Reports

```typescript
const reporter = new AnalyticsReporter(analytics);

// Performance report
const perfReport = reporter.generatePerformanceReport({ format: 'json' });

// Cache report
const cacheReport = reporter.generateCacheReport();

// Security report
const securityReport = reporter.generateSecurityReport();
```

## Multi-CDN Support

### Configure Multi-CDN

```typescript
const multiCDN = new MultiCDNProvider({
  primary: 'cloudflare',
  fallback: ['aws_cloudfront', 'fastly'],
  strategy: 'performance',
  weights: new Map([
    ['cloudflare', 100],
    ['aws_cloudfront', 50]
  ]),
  healthCheck: {
    interval: 60000,
    timeout: 5000,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
    path: 'https://example.com/health',
    expectedStatus: 200
  }
});
```

### Route Requests

```typescript
const response = await multiCDN.route({
  url: 'https://example.com/test',
  method: 'GET',
  headers: {}
});

console.log(`Routed to: ${response.provider}`);
```

### Load Balancing

```typescript
const loadBalancer = new CDNLoadBalancer({
  strategy: 'weighted',
  sessionAffinity: true,
  weights: new Map([
    ['cloudflare', 100],
    ['aws_cloudfront', 50]
  ])
});

const provider = loadBalancer.select(context);
```

## Utilities

### Parse Request Context

```typescript
import { parseRequestContext } from '@claudeflare/cdn';

const context = parseRequestContext(url, headers);
console.log(context.ip);      // Client IP
console.log(context.country); // Country code
console.log(context.device);  // Device type
```

### Cache Utilities

```typescript
import {
  generateCacheKey,
  parseCacheControl,
  calculateTTL,
  formatBytes,
  formatDuration
} from '@claudeflare/cdn';

const key = generateCacheKey(url, headers, ['Accept-Encoding']);
const ttl = calculateTTL(headers, defaultTTL);
const formatted = formatBytes(1536); // "1.5 KB"
```

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Configuration

### CDN Configuration

```typescript
interface ICDNConfig {
  provider: CDNProvider | IMultiCDNConfig;
  zoneId?: string;
  accountId?: string;
  apiKey?: string;
  apiEmail?: string;
  cachePolicies: ICachePolicy[];
  cacheRules: ICacheRule[];
  analytics?: boolean;
}
```

### Cache Policy

```typescript
interface ICachePolicy {
  name: string;
  policy: CachePolicy;
  ttl: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  vary?: string[];
  mustRevalidate?: boolean;
  level: CacheLevel;
  tags?: string[];
}
```

## Performance Targets

- **Cache Hit Rate**: >95%
- **Purge Propagation**: <1s
- **Response Time**: <100ms (edge), <500ms (origin)
- **Uptime**: 99.99%

## License

MIT

## Contributing

Contributions are welcome! Please see our contributing guidelines for more details.
