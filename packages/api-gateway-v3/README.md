# @claudeflare/api-gateway-v3

> Next-Generation API Gateway with composition, streaming, edge optimization, and GraphQL federation

## Features

- **API Composition** - Execute multiple service calls in parallel or sequence with intelligent data merging
- **Streaming Support** - Server-Sent Events (SSE) and WebSocket support with backpressure handling
- **Edge Optimization** - Edge computing integration with intelligent routing and caching
- **Real-time Analytics** - Built-in analytics engine with custom dashboards
- **Service Orchestration** - Workflow execution engine with compensation transactions
- **GraphQL Federation** - GraphQL gateway with federation support
- **Version Management** - API versioning with routing and transformation
- **Sub-millisecond Latency** - Optimized for Cloudflare Workers and edge deployment

## Installation

```bash
npm install @claudeflare/api-gateway-v3
```

## Quick Start

```typescript
import { createGateway } from '@claudeflare/api-gateway-v3';

const gateway = createGateway({
  id: 'my-gateway',
  name: 'My API Gateway',
  environment: 'production',
  services: [
    {
      id: 'users-service',
      name: 'Users Service',
      version: '1.0.0',
      endpoint: 'https://api.users.example.com',
      timeout: 5000,
      metadata: {},
    },
  ],
  routes: [
    {
      id: 'get-users',
      path: '/api/users',
      method: ['GET'],
      serviceId: 'users-service',
    },
  ],
  middleware: [],
  analytics: {
    enabled: true,
    batchSize: 100,
    flushInterval: 10000,
    sampling: 1.0,
    metrics: [],
  },
  edge: {
    enabled: true,
    functions: [],
    cache: {
      enabled: true,
      ttl: 3600000,
      purgeKeys: [],
      cacheKeys: [],
    },
    routing: {
      strategy: 'latency',
      regions: [],
      healthCheck: false,
      healthCheckInterval: 30000,
    },
  },
  caching: {
    enabled: true,
    defaultTTL: 3600000,
    maxSize: 10000,
    evictionPolicy: 'lru',
    compression: true,
  },
  rateLimit: {
    enabled: true,
    defaultLimit: 1000,
    defaultWindow: 60000,
    storage: 'memory',
  },
  circuitBreaker: {
    enabled: true,
    defaultThreshold: 0.5,
    defaultResetTimeout: 60000,
    monitoringEnabled: true,
  },
  versioning: {
    strategy: 'header',
    defaultVersion: 'v1',
    versions: [],
  },
  graphql: {
    enabled: false,
    endpoint: '/graphql',
    subscriptions: false,
  },
});

// Initialize
await gateway.initialize();

// Handle requests
const response = await gateway.handle(request);
```

## Usage

### API Composition

```typescript
import { CompositionEngine, ServiceRegistry } from '@claudeflare/api-gateway-v3/composition';

const registry = new ServiceRegistry();
await registry.register({
  id: 'users-service',
  name: 'Users Service',
  version: '1.0.0',
  endpoint: 'https://api.users.example.com',
  timeout: 5000,
  metadata: {},
});

const engine = new CompositionEngine(registry);

const result = await engine.execute({
  requestId: 'req-1',
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
    },
  ],
  mergeStrategy: 'parallel',
  errorPolicy: 'continue',
});
```

### Streaming (SSE)

```typescript
import { SSEGateway } from '@claudeflare/api-gateway-v3/streaming';

const sse = new SSEGateway();

// Connect client
const connectionId = await sse.connect('client-1', writableStream);

// Subscribe to channel
await sse.subscribe(connectionId, 'notifications');

// Broadcast message
await sse.broadcast('notifications', {
  event: 'update',
  data: JSON.stringify({ message: 'Hello!' }),
});
```

### Edge Optimization

```typescript
import { EdgeOptimizer } from '@claudeflare/api-gateway-v3/edge';

const optimizer = new EdgeOptimizer({
  enabled: true,
  defaultRegion: 'us-east-1',
  cache: {
    enabled: true,
    ttl: 3600000,
  },
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
    ],
    healthCheck: true,
    healthCheckInterval: 30000,
  },
  functions: [],
  metrics: { enabled: true },
});

// Optimize request
const optimized = await optimizer.optimizeRequest(request, context);
```

### Analytics

```typescript
import { AnalyticsEngine, QueryBuilder } from '@claudeflare/api-gateway-v3/analytics';

const analytics = new AnalyticsEngine();

// Record event
analytics.recordEvent({
  id: 'event-1',
  timestamp: Date.now(),
  type: 'request-start',
  data: { requestId: 'req-1' },
});

// Query metrics
const query = new QueryBuilder()
  .metric('request.count')
  .aggregation('sum')
  .lastMinutes(5)
  .build();

const result = await analytics.queryMetrics(query);
```

## Configuration

### Gateway Config

```typescript
interface GatewayConfig {
  id: string;
  name: string;
  environment: 'development' | 'staging' | 'production';
  services: ServiceDefinition[];
  routes: RouteConfig[];
  middleware: MiddlewareConfig[];
  analytics: AnalyticsConfig;
  edge: EdgeConfig;
  caching: GlobalCacheConfig;
  rateLimit: GlobalRateLimitConfig;
  circuitBreaker: GlobalCircuitBreakerConfig;
  versioning: VersionConfig;
  graphql?: GraphQLConfig;
}
```

### Service Definition

```typescript
interface ServiceDefinition {
  id: string;
  name: string;
  version: string;
  endpoint: string;
  timeout: number;
  healthCheck?: HealthCheckConfig;
  retryPolicy?: RetryPolicy;
  circuitBreaker?: CircuitBreakerConfig;
  cachePolicy?: CachePolicy;
  rateLimit?: RateLimitPolicy;
  auth?: ServiceAuth;
  metadata: ServiceMetadata;
}
```

## Performance

- **Gateway Overhead**: <1ms
- **Cold Start**: <10ms (Cloudflare Workers)
- **Hot Path**: <1ms (cached requests)
- **Composition**: Adds ~1-2ms per operation
- **Streaming**: Sub-millisecond message delivery

## Deployment

### Cloudflare Workers

```typescript
import { createGateway } from '@claudeflare/api-gateway-v3';

const gateway = createGateway(config);
await gateway.initialize();

export default {
  async fetch(request: Request): Promise<Response> {
    return gateway.handle(request);
  },
};
```

### Durable Objects

```typescript
import { DurableObjectGateway } from '@claudeflare/api-gateway-v3';

export class GatewayDO extends DurableObjectGateway {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, config);
  }
}
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

## Documentation

- [API Reference](./docs/api.md)
- [Composition Guide](./docs/composition.md)
- [Streaming Guide](./docs/streaming.md)
- [Edge Optimization](./docs/edge.md)
- [Analytics](./docs/analytics.md)
- [Examples](./examples/)

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
