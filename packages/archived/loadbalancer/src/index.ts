/**
 * ClaudeFlare Global Load Balancer
 * Enterprise-grade global load balancing for Cloudflare Workers
 */

// Main load balancer
export { LoadBalancer } from './loadbalancer.js';
export type { LoadBalancerConfig, LoadBalancerStats } from './loadbalancer.js';

// Geographic routing
export { GeographicRouter } from './geographic/router.js';
export { GeographicMapper } from './geographic/mapper.js';
export type {
  GeographicRouterConfig,
} from './geographic/router.js';
export type {
  GeoMappingConfig,
} from './geographic/mapper.js';

// Latency routing
export { LatencyRouter } from './latency/router.js';
export { LatencyMonitor } from './latency/monitor.js';
export type {
  LatencyRouterConfig,
} from './latency/router.js';
export type {
  MonitoringConfig,
} from './latency/monitor.js';

// Capacity routing
export { CapacityRouter } from './capacity/router.js';
export type { CapacityRouterConfig } from './capacity/router.js';

// Health checking
export { HealthChecker } from './health/checker.js';
export type { HealthCheckerConfig } from './health/checker.js';

// Traffic shaping
export { TrafficShaper } from './traffic/shaper.js';
export type {
  TrafficShaperConfig,
  RateLimitState,
  QueueEntry,
} from './traffic/shaper.js';

// Anycast routing
export { AnycastRouter } from './anycast/router.js';
export type { AnycastRouterConfig } from './anycast/router.js';

// Utilities
export * from './utils/calculations.js';
export * from './utils/validation.js';

// Type exports
export * from './types/index.js';

// Version
export const VERSION = '0.1.0';

// Re-export commonly used types for convenience
export type {
  Region,
  Continent,
  GeoLocation,
  RegionInfo,
  RoutingContext,
  RoutingDecision,
  RoutingStrategy,
  LatencyMetrics,
  CapacityMetrics,
  HealthCheckConfig,
  HealthStatus,
  HealthScore,
  TrafficRule,
  TrafficShapingPolicy,
  LoadBalancerMetrics,
} from './types/index.js';

// Re-export errors
export {
  LoadBalancerError,
  RegionUnavailableError,
  NoHealthyRegionsError,
  CapacityExceededError,
  ThrottledError,
} from './types/index.js';
