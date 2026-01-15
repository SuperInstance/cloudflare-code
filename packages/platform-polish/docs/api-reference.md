# API Reference

## Platform API

### createPlatform(config: PlatformConfig): PlatformAPI

Creates a new PlatformAPI instance with the given configuration.

**Parameters:**
- `config` - Platform configuration object

**Returns:**
- PlatformAPI instance

**Example:**
```typescript
import { createPlatform, defaultPlatformConfig } from '@claudeflare/platform-polish';

const platform = createPlatform(defaultPlatformConfig);
```

### PlatformAPI Methods

#### start(): Promise<void>
Starts the platform and all its components.

#### stop(): Promise<void>
Stops the platform and gracefully shuts down all components.

#### registerService(config: ServiceConfig): Promise<void>
Registers a new service with the platform.

**Parameters:**
- `config` - Service configuration

#### deregisterService(serviceId: string): Promise<void>
Deregisters a service from the platform.

**Parameters:**
- `serviceId` - Unique service identifier

#### requestService(serviceName: string, endpoint: string, options?: RequestOptions): Promise<any>
Makes a request to a service through the load balancer.

**Parameters:**
- `serviceName` - Name of the service
- `endpoint` - Service endpoint
- `options` - Request options

#### getHealthStatus(serviceId?: string): Promise<HealthStatus | HealthStatus[]>
Gets health status for services.

#### getMetrics(serviceId?: string): Promise<any>
Gets metrics for services.

#### getTraces(options?: TraceOptions): Promise<any[]>
Gets trace data.

## Configuration

### PlatformConfig

```typescript
interface PlatformConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  services: ServiceConfig[];
  global: GlobalConfig;
  orchestration: OrchestrationConfig;
  deployment: DeploymentConfig;
  optimization: OptimizationConfig;
}
```

### ServiceConfig

```typescript
interface ServiceConfig {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  healthCheck: HealthCheckConfig;
  loadBalancing: LoadBalancingConfig;
  circuitBreaker: CircuitBreakerConfig;
  retry: RetryConfig;
  security: SecurityConfig;
  cache: CacheConfig;
  monitoring: MonitoringConfig;
}
```

## Load Balancing Strategies

### Available Strategies
- **round-robin**: Distributes requests evenly
- **least-connections**: Sends to service with fewest active connections
- **ip-hash**: Routes based on client IP for session affinity
- **weighted**: Routes based on configured weights

### Configuration
```typescript
interface LoadBalancingConfig {
  strategy: 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted';
  stickySessions: boolean;
  healthCheckInterval: number;
  nodes: LoadBalancerNode[];
}
```

## Circuit Breaker

### Configuration
```typescript
interface CircuitBreakerConfig {
  enabled: boolean;
  threshold: number;
  timeout: number;
  resetTimeout: number;
  halfOpenRequests: number;
  slidingWindowSize: number;
  slidingWindowType: 'count' | 'percentage';
}
```

### States
- **CLOSED**: Circuit is closed, requests pass through normally
- **OPEN**: Circuit is open, requests fail fast
- **HALF_OPEN**: Circuit testing if service has recovered

## Security

### Authentication Types
- **jwt**: JSON Web Token
- **oauth**: OAuth 2.0
- **api-key**: API key authentication
- **basic**: Basic HTTP authentication

### Rate Limiting
```typescript
interface RateLimitingConfig {
  enabled: boolean;
  requestsPerMinute: number;
  burst: number;
}
```

### CORS Configuration
```typescript
interface CORSConfig {
  enabled: boolean;
  origins: string[];
  methods: string[];
  headers: string[];
  credentials: boolean;
}
```

## Caching

### Cache Types
- **memory**: In-memory LRU cache
- **redis**: Redis cluster/single instance
- **file**: File-based caching

### Configuration
```typescript
interface CacheConfig {
  enabled: boolean;
  type: 'memory' | 'redis' | 'file';
  ttl: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
  redis?: RedisConfig;
}
```

## Monitoring

### Metrics
- **Request metrics**: Count, latency, error rates
- **System metrics**: CPU, memory, disk usage
- **Service metrics**: Health status, response times
- **Business metrics**: Custom application metrics

### Logging Levels
- **debug**: Detailed debugging information
- **info**: General information
- **warn**: Warning messages
- **error**: Error messages

## Events

### Platform Events
- `started`: Platform has started
- `stopped`: Platform has stopped
- `healthUpdate`: Health status updated
- `metric`: New metric collected
- `trace`: New trace collected

### Service Events
- `serviceRegistered`: Service registered
- `serviceDeregistered`: Service deregistered
- `balancingEvent`: Load balancing event
- `circuitBreakerEvent`: Circuit breaker state change

## Error Handling

### Error Types
- `ServiceNotFoundError`: Service not found
- `ServiceUnavailableError`: Service is unavailable
- `RateLimitExceededError`: Rate limit exceeded
- `AuthenticationError`: Authentication failed
- `AuthorizationError`: Authorization failed
- `ValidationError`: Input validation failed

### Error Recovery
The platform provides automatic error recovery through:
- Circuit breakers
- Retry mechanisms
- Fallback services
- Graceful degradation

## Examples

### Basic Platform Setup
```typescript
import { createPlatform, defaultPlatformConfig } from '@claudeflare/platform-polish';

const config = {
  ...defaultPlatformConfig,
  services: [
    {
      id: 'api-service',
      name: 'api-service',
      version: '1.0.0',
      host: 'localhost',
      port: 3001,
      healthCheck: {
        enabled: true,
        endpoint: '/health',
        interval: 5000
      }
    }
  ]
};

const platform = createPlatform(config);
await platform.start();
```

### Service with Load Balancing
```typescript
const lbConfig = {
  strategy: 'least-connections' as const,
  stickySessions: false,
  healthCheckInterval: 5000,
  nodes: [
    { host: '10.0.0.1', port: 3001, weight: 1 },
    { host: '10.0.0.2', port: 3001, weight: 2 }
  ]
};
```

### Service with Security
```typescript
const securityConfig = {
  enabled: true,
  auth: {
    type: 'jwt' as const,
    provider: 'auth0'
  },
  rateLimiting: {
    enabled: true,
    requestsPerMinute: 100,
    burst: 20
  },
  cors: {
    enabled: true,
    origins: ['https://myapp.com'],
    methods: ['GET', 'POST']
  }
};
```

### Custom Fallback
```typescript
platform.registerFallbackStrategy('api-service', {
  name: 'database-fallback',
  condition: (context) => context.error?.status === 503,
  handler: async (context) => {
    return await getFallbackData();
  },
  priority: 1,
  timeout: 5000
});
```