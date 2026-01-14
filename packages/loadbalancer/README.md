# ClaudeFlare Global Load Balancer

Enterprise-grade global load balancing system for Cloudflare Workers, featuring intelligent routing based on geographic proximity, latency measurements, capacity management, health checking, and traffic shaping.

## Features

### Geographic Routing
- **Proximity-based routing**: Routes users to nearest regions using Haversine distance calculations
- **Continent-local routing**: Prefers regions within the same continent
- **User location detection**: IP geolocation with Cloudflare integration
- **ASN mapping**: Autonomous System Number-based routing decisions
- **Regional capacity awareness**: Considers regional capacity when routing

### Latency-Based Routing
- **Real-time latency measurement**: Active probing and passive measurement collection
- **Percentile tracking**: P50, P75, P90, P95, P99, P999 latency metrics
- **ML-based prediction**: Predictive latency modeling for optimal routing
- **Trend analysis**: Detects improving/degrading latency patterns
- **Adaptive routing**: Combines multiple strategies for optimal performance

### Capacity-Based Routing
- **Real-time capacity monitoring**: Tracks utilization across all regions
- **Queue length tracking**: Considers request queue depths
- **Auto-scaling integration**: Triggers scale-up/scale-down events
- **Overload protection**: Prevents routing to overloaded regions
- **Predictive capacity**: Forecasts capacity needs using linear regression

### Health Checking
- **Active health checks**: HTTP/HTTPS, TCP, UDP, ICMP checks
- **Passive monitoring**: Observes actual request success/failure rates
- **Health scoring**: Composite scores from multiple health components
- **Automatic failover**: Triggers failover when regions degrade
- **Recovery detection**: Automatically returns traffic when regions recover

### Traffic Shaping
- **Rate limiting**: Global, regional, and per-user limits
- **Throttling**: Configurable throttling based on capacity
- **Priority queuing**: Multi-level priority queues
- **DDoS protection**: Automated DDoS detection and mitigation
- **Traffic policies**: Flexible rule-based traffic management

### Anycast Optimization
- **BGP route optimization**: Local preference and MED tuning
- **Route advertisements**: Dynamic BGP advertisement generation
- **Community tagging**: BGP community-based routing policies
- **AS path prepending**: Influences inbound traffic patterns

## Installation

```bash
npm install @claudeflare/loadbalancer
```

## Quick Start

```typescript
import { LoadBalancer } from '@claudeflare/loadbalancer';

// Configure load balancer
const config = {
  regions: new Map([
    ['us-east-1', {
      id: 'us-east-1',
      name: 'US East (N. Virginia)',
      location: {
        country: 'US',
        continent: 'NA',
        latitude: 38.13,
        longitude: -78.45,
      },
      capacity: 10000,
      availableCapacity: 8000,
      status: 'active',
      healthScore: 95,
      latencyScore: 90,
      priority: 10,
      datacenters: [{
        id: 'dc-use1-1',
        region: 'us-east-1',
        name: 'N. Virginia DC',
        location: {
          country: 'US',
          continent: 'NA',
          latitude: 38.13,
          longitude: -78.45,
        },
        capacity: 10000,
        availableCapacity: 8000,
        status: 'healthy',
        healthScore: 95,
        endpoints: ['https://use1.example.com'],
      }],
    }],
  ]),
  defaultStrategy: 'adaptive',
  fallbackStrategy: 'geographic',
  // ... additional config
};

const lb = new LoadBalancer(config);

// Route a request
const decision = await lb.route(request);
console.log(`Routing to: ${decision.selectedRegion}`);
```

## Cloudflare Worker Usage

```typescript
import worker from '@claudeflare/loadbalancer/src/worker';

export default {
  fetch: worker.fetch,
};
```

## Architecture

### Components

1. **GeographicRouter**: Handles proximity-based routing decisions
2. **LatencyRouter**: Routes based on measured latency metrics
3. **CapacityRouter**: Considers regional capacity and load
4. **HealthChecker**: Monitors health of all regions
5. **TrafficShaper**: Manages traffic flow and rate limiting
6. **AnycastRouter**: Optimizes BGP routing

### Routing Strategies

- `geographic`: Route to nearest region
- `latency`: Route to region with lowest latency
- `capacity`: Route to region with most available capacity
- `adaptive`: Combine multiple strategies for optimal routing

## Configuration

### Load Balancer Config

```typescript
interface LoadBalancerConfig {
  regions: Map<Region, RegionInfo>;
  defaultStrategy: RoutingStrategy;
  fallbackStrategy: RoutingStrategy;
  geographic: GeographicRouterConfig;
  latency: LatencyRouterConfig;
  capacity: CapacityRouterConfig;
  health: HealthCheckerConfig;
  traffic: TrafficShaperConfig;
  anycast: AnycastConfig;
}
```

### Region Configuration

```typescript
interface RegionInfo {
  id: Region;
  name: string;
  location: GeoLocation;
  capacity: number;
  availableCapacity: number;
  status: RegionStatus;
  healthScore: number;
  latencyScore: number;
  priority: number;
  datacenters: DatacenterInfo[];
}
```

## API Reference

### LoadBalancer

```typescript
class LoadBalancer {
  constructor(config: LoadBalancerConfig);

  // Route a request
  async route(request: Request, strategy?: RoutingStrategy): Promise<RoutingDecision>;

  // Update region information
  updateRegion(region: Region, info: Partial<RegionInfo>): void;

  // Get statistics
  getStats(): LoadBalancerStats;

  // Get routing history
  getRoutingHistory(count?: number): RoutingDecision[];

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; components: Record<string, boolean> }>;

  // Get component instances
  getHealthChecker(): HealthChecker;
  getCapacityRouter(): CapacityRouter;
  getLatencyRouter(): LatencyRouter;
  getTrafficShaper(): TrafficShaper;
  getAnycastRouter(): AnycastRouter;
}
```

### GeographicRouter

```typescript
class GeographicRouter {
  constructor(regions: Map<Region, RegionInfo>, config?: Partial<GeographicRouterConfig>);

  async route(context: RoutingContext): Promise<RoutingDecision>;
  updateRegion(region: Region, info: Partial<RegionInfo>): void;
  getRegionsByContinent(continent: Continent): RegionInfo[];
  findNearestRegion(location: GeoLocation): RegionInfo | null;
}
```

### LatencyRouter

```typescript
class LatencyRouter {
  constructor(regions: Region[], config?: Partial<LatencyRouterConfig>);

  async route(context: RoutingContext): Promise<RoutingDecision>;
  async recordMeasurement(measurement: LatencyMeasurement): Promise<void>;
  getMetrics(sourceLocation: GeoLocation, targetRegion: Region): LatencyMetrics | null;
  async getHistory(region: Region): Promise<LatencyHistory>;
}
```

### CapacityRouter

```typescript
class CapacityRouter {
  constructor(config?: Partial<CapacityRouterConfig>);

  async route(context: RoutingContext): Promise<RoutingDecision>;
  async updateCapacity(region: Region, metrics: CapacityMetrics): Promise<void>;
  getCapacity(region: Region): CapacityMetrics | null;
  getPrediction(region: Region): CapacityPrediction | null;
  isRegionAtCapacity(region: Region): boolean;
}
```

### HealthChecker

```typescript
class HealthChecker {
  constructor(config?: Partial<HealthCheckerConfig>);

  registerHealthCheck(id: string, region: Region, target: string, config?: Partial<HealthCheckConfig>): void;
  async performHealthCheck(checkId: string): Promise<HealthCheckResult>;
  recordPassiveMetric(metric: PassiveHealthMetric): void;
  getHealthStatus(region: Region): HealthStatus;
  getHealthScore(region: Region): HealthScore | null;
  getHealthyRegions(): Region[];
}
```

### TrafficShaper

```typescript
class TrafficShaper {
  constructor(config?: Partial<TrafficShaperConfig>);

  async evaluate(context: RoutingContext): Promise<{ allowed: boolean; action?: TrafficAction }>;
  async enqueue(context: RoutingContext, priority?: number): Promise<string>;
  async dequeue(region: Region): Promise<QueueEntry | null>;
  setPolicy(policy: TrafficShapingPolicy): void;
  updateThrottlingConfig(config: Partial<ThrottlingConfig>): void;
}
```

## Monitoring and Metrics

### Load Balancer Metrics

```typescript
interface LoadBalancerStats {
  totalRequests: number;
  requestsByStrategy: Map<RoutingStrategy, number>;
  requestsByRegion: Map<Region, number>;
  averageRoutingTime: number;
  errorRate: number;
}
```

### Latency Metrics

```typescript
interface LatencyMetrics {
  region: Region;
  timestamp: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
  mean: number;
  stdDev: number;
  sampleCount: number;
}
```

### Capacity Metrics

```typescript
interface CapacityMetrics {
  region: Region;
  timestamp: number;
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  utilizationPercentage: number;
  queueLength: number;
  queuedRequests: number;
  activeConnections: number;
}
```

## Deployment

### Build

```bash
npm run build
```

### Deploy to Cloudflare

```bash
npm run deploy
```

### Development

```bash
npm run dev
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Type checking
npm run typecheck
```

## Performance Considerations

- **Caching**: Geographic location data is cached to reduce lookup overhead
- **Async operations**: All I/O operations are non-blocking
- **Efficient algorithms**: Uses optimized data structures for routing decisions
- **Memory management**: Automatic cleanup of old metrics and measurements
- **Edge-optimized**: Designed for Cloudflare Workers' edge runtime

## Security

- **Input validation**: All inputs are validated before processing
- **Rate limiting**: Built-in protection against abuse
- **DDoS protection**: Automated detection and mitigation
- **Secure routing**: Supports TLS for all health checks
- **IP filtering**: Whitelist/blacklist support

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please use the GitHub issue tracker.
