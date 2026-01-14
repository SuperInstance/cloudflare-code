# @claudeflare/service-mesh

Enterprise-grade service mesh and microservices infrastructure for ClaudeFlare on Cloudflare Workers.

## Features

- **Service Discovery**: Dynamic service registration and health checking with Durable Objects
- **Circuit Breaker**: Resilient service-to-service communication with automatic recovery
- **Retry Policies**: Exponential backoff with jitter and configurable retry strategies
- **Load Balancing**: Multiple strategies including round-robin, least-connections, and consistent hashing
- **Traffic Management**: Advanced routing, canary deployments, and A/B testing
- **Observability**: Distributed tracing, metrics collection, and monitoring
- **Sidecar Proxy**: Transparent proxy pattern for service mesh integration

## Installation

```bash
npm install @claudeflare/service-mesh
```

## Quick Start

### Creating a Service Mesh

```typescript
import { createServiceMesh } from '@claudeflare/service-mesh';

const mesh = createServiceMesh('my-mesh', {
  registryUrl: 'https://registry.example.com',
  enableMetrics: true,
  enableTracing: true,
  enableTrafficManagement: true
});

// Register your service
await mesh.discoveryClient.register({
  id: 'my-service-1',
  serviceName: 'my-service',
  host: 'my-service.example.com',
  port: 8080,
  protocol: 'https',
  metadata: {
    version: '1.0.0',
    region: 'us-east-1'
  },
  healthStatus: 'healthy',
  lastHeartbeat: Date.now(),
  version: '1.0.0',
  tags: ['api', 'v1'],
  zone: 'us-east-1a',
  region: 'us-east-1',
  weight: 100
});

// Make service calls with automatic retry and circuit breaking
const response = await mesh.httpClient.get('https://other-service/api/data');
```

### Creating a Sidecar Proxy

```typescript
import { createSidecarProxy } from '@claudeflare/service-mesh';

const proxy = createSidecarProxy({
  proxyId: 'my-proxy',
  serviceName: 'my-service',
  namespace: 'production',
  upstreams: [
    {
      name: 'backend-api',
      service: 'backend-api',
      port: 8080
    }
  ]
});

// Handle outbound requests
const response = await proxy.handleOutbound(
  'backend-api',
  request,
  { sourceService: 'my-service', sourceInstance: 'instance-1', requestId: 'req-1' }
);
```

## Architecture

### Core Components

#### 1. Service Discovery
- **ServiceRegistry** (Durable Object): Central registry for all services
- **ServiceDiscoveryClient**: Client library for service registration and discovery
- **ServiceLoadBalancer**: Load balancing with multiple strategies

#### 2. Circuit Breaker
- **CircuitBreaker**: Per-service circuit breaker with state management
- **CircuitBreakerStore** (Durable Object): Persistent circuit breaker state

#### 3. Retry & Timeout
- **RetryExecutor**: Configurable retry with exponential backoff
- **TimeoutManager**: Request timeout management
- **AdaptiveTimeoutManager**: Self-adjusting timeouts based on history

#### 4. Communication
- **ServiceHttpClient**: HTTP client with built-in resilience patterns
- **RequestBuilder**: Fluent API for building requests

#### 5. Observability
- **MetricsCollector**: Real-time metrics aggregation
- **MetricsExporter**: Export metrics to Prometheus, OTLP, etc.
- **Tracer**: Distributed tracing with span management

#### 6. Traffic Management
- **TrafficManager**: Advanced routing and traffic splitting
- **TrafficSplitController**: Canary deployment management

#### 7. Control Plane
- **ServiceMeshControlPlane**: Central configuration management
- **ControlPlaneAPI**: REST API for mesh configuration

#### 8. Sidecar Proxy
- **SidecarProxy**: Outbound/inbound proxy for services
- **ProxyManager**: Manage multiple proxy instances

## Usage Examples

### Service Registration

```typescript
import { ServiceDiscoveryClient } from '@claudeflare/service-mesh/discovery';

const client = new ServiceDiscoveryClient({
  registryUrl: 'https://registry.example.com',
  cacheEnabled: true,
  cacheTtl: 5000
});

await client.register({
  id: 'service-1',
  serviceName: 'user-service',
  host: 'user-service.example.com',
  port: 8080,
  protocol: 'https',
  metadata: { version: '1.0.0' },
  healthStatus: 'healthy',
  lastHeartbeat: Date.now(),
  version: '1.0.0',
  tags: ['api', 'users'],
  zone: 'us-east-1a',
  region: 'us-east-1',
  weight: 100
}, 30000); // TTL: 30 seconds
```

### Circuit Breaker

```typescript
import { CircuitBreaker } from '@claudeflare/service-mesh/circuit';

const breaker = new CircuitBreaker('user-service', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  halfOpenMaxCalls: 3
});

try {
  const result = await breaker.execute(async () => {
    return await fetchDataFromService();
  });
} catch (error) {
  if (error.message.includes('CIRCUIT_OPEN')) {
    // Circuit is open, use fallback
    return getFallbackData();
  }
}
```

### Retry with Backoff

```typescript
import { RetryExecutor, BackoffStrategies } from '@claudeflare/service-mesh/retry';

const executor = new RetryExecutor({
  policy: {
    maxAttempts: 3,
    initialBackoff: 1000,
    maxBackoff: 30000,
    backoffMultiplier: 2,
    jitterEnabled: true
  }
});

const result = await executor.execute(async () => {
  return await fetch('https://api.example.com/data');
});
```

### Load Balancing

```typescript
import { ServiceLoadBalancer } from '@claudeflare/service-mesh/discovery';

const balancer = new ServiceLoadBalancer({
  strategy: { type: 'least-connections' }
});

const instance = balancer.selectInstance(endpoints, {
  sessionId: 'user-session-123',
  metadata: { clientIP: '192.168.1.1' }
});
```

### Traffic Splitting

```typescript
import { TrafficManager, TrafficSplitController } from '@claudeflare/service-mesh/traffic';

const manager = new TrafficManager();
const controller = new TrafficSplitController(manager);

// Set up traffic split
manager.addSplit({
  serviceName: 'user-service',
  versions: [
    { name: 'v1', weight: 90, instances: ['v1-1', 'v1-2'] },
    { name: 'v2', weight: 10, instances: ['v2-1'] }
  ],
  defaultVersion: 'v1'
});

// Start canary deployment
await controller.startCanary('user-service', 'v2', {
  weight: 10,
  incrementStep: 5,
  maxWeight: 100,
  rollbackThreshold: 10
});
```

### Distributed Tracing

```typescript
import { Tracer, TraceScope } from '@claudeflare/service-mesh/observability';

const tracer = new Tracer('my-service');

// Start a trace
const context = tracer.startTrace('processRequest', {
  'http.method': 'GET',
  'http.url': '/api/users'
});

try {
  // Create child spans
  await TraceScope.withSpan(tracer, 'databaseQuery', async (span) => {
    tracer.addTags(span.spanId, {
      'db.type': 'postgresql',
      'db.statement': 'SELECT * FROM users'
    });

    return await db.query('SELECT * FROM users');
  });

  // Finish trace
  tracer.finishTrace(context);

} catch (error) {
  if (error instanceof Error) {
    tracer.recordError(context.spanId, error);
  }
}
```

### Metrics Collection

```typescript
import { MetricsCollector, MetricsExporter } from '@claudeflare/service-mesh/observability';

const collector = new MetricsCollector();

// Register service
collector.register('user-service', 'instance-1');

// Record requests
collector.recordRequest('user-service', 'instance-1', true, 150);
collector.recordRequest('user-service', 'instance-1', false, 500);

// Get metrics
const metrics = collector.getMetrics('user-service', 'instance-1');
console.log(metrics);

// Export metrics
const exporter = new MetricsExporter({
  type: 'prometheus',
  endpoint: 'https://prometheus.example.com/api/v1/metrics'
}, collector);

await exporter.export();
```

## Configuration

### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  serviceName: string;
  failureThreshold: number;      // Failures before opening
  successThreshold: number;       // Successes to close
  timeout: number;                // Time in open state (ms)
  halfOpenMaxCalls: number;       // Max calls in half-open
  rollingWindow: {
    size: number;                // Window size
    type: 'count' | 'time';      // Window type
    bucketCount: number;          // Number of buckets
  };
  minRequests: number;            // Min requests for analysis
  fallback?: FallbackConfig;      // Fallback strategy
}
```

### Retry Policy Configuration

```typescript
interface RetryPolicy {
  maxAttempts: number;           // Maximum retry attempts
  initialBackoff: number;         // Initial backoff (ms)
  maxBackoff: number;            // Maximum backoff (ms)
  backoffMultiplier: number;      // Backoff multiplier
  jitterEnabled: boolean;         // Enable jitter
  jitterFactor: number;           // Jitter factor (0-1)
  retryableStatuses: number[];    // Retryable HTTP statuses
  retryableErrors: string[];      // Retryable error codes
}
```

### Load Balancing Strategies

- `round-robin`: Distribute requests sequentially
- `least-connections`: Route to instance with fewest active connections
- `random`: Random instance selection
- `weighted`: Weight-based distribution
- `ip-hash`: Hash based on client IP
- `consistent-hash`: Consistent hashing

## API Reference

### Service Discovery

- `register(instance, ttl)` - Register a service instance
- `deregister(serviceName, instanceId)` - Deregister a service
- `discover(serviceName, options)` - Discover service endpoints
- `selectInstance(serviceName, strategy, options)` - Select an instance with load balancing

### Circuit Breaker

- `execute(request, context)` - Execute request through circuit breaker
- `executeWithTimeout(request, timeout, context)` - Execute with timeout
- `getState()` - Get current circuit breaker state
- `reset()` - Reset circuit breaker to closed state

### Traffic Management

- `route(request, metadata)` - Route request based on rules
- `routeSplit(serviceName, sessionId)` - Route based on traffic split
- `updateCanaryWeights(serviceName, metrics)` - Update canary weights

### Observability

- `recordRequest(serviceName, instanceId, success, latency)` - Record request metric
- `getMetrics(serviceName, instanceId)` - Get service metrics
- `startTrace(operationName, tags)` - Start distributed trace
- `finishTrace(context)` - Finish trace and collect spans

## Best Practices

1. **Service Registration**: Always register services with proper TTL and send heartbeats
2. **Circuit Breakers**: Configure appropriate thresholds based on your service's SLA
3. **Retry Policies**: Use exponential backoff with jitter to prevent thundering herd
4. **Load Balancing**: Choose the right strategy for your use case
5. **Tracing**: Enable distributed tracing for critical paths
6. **Metrics**: Monitor metrics and set up alerts for anomalies
7. **Traffic Management**: Use canary deployments for gradual rollouts

## Performance Considerations

- **Caching**: Service discovery results are cached by default
- **Connection Pooling**: HTTP clients use connection pooling
- **Metrics Sampling**: Use sampling for high-traffic services
- **Tracing Sampling**: Adjust sampling rate based on traffic volume

## Security

- **mTLS**: Enable mutual TLS for service-to-service communication
- **Authentication**: Configure JWT or OAuth2 authentication
- **Authorization**: Implement RBAC policies
- **Encryption**: Enable encryption for data in transit

## Monitoring

The service mesh provides built-in metrics for:

- Request rate and error rate
- Latency percentiles (p50, p95, p99, p999)
- Circuit breaker states
- Retry attempts
- Connection counts
- Throughput

Export metrics to your monitoring system:

- Prometheus
- OpenTelemetry
- StatsD
- Custom endpoints

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines.

## Support

For issues and questions, please open a GitHub issue.
