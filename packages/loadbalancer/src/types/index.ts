/**
 * Type definitions for the global load balancing system
 */

// ============================================================================
// Geographic Types
// ============================================================================

export type Continent =
  | 'AF' // Africa
  | 'AS' // Asia
  | 'EU' // Europe
  | 'NA' // North America
  | 'OC' // Oceania
  | 'SA'; // South America

export type Region =
  // North America
  | 'us-east-1'
  | 'us-east-2'
  | 'us-west-1'
  | 'us-west-2'
  | 'ca-central-1'
  | 'mx-central-1'
  // Europe
  | 'eu-west-1'
  | 'eu-west-2'
  | 'eu-west-3'
  | 'eu-central-1'
  | 'eu-north-1'
  | 'eu-south-1'
  // Asia Pacific
  | 'ap-east-1'
  | 'ap-south-1'
  | 'ap-southeast-1'
  | 'ap-southeast-2'
  | 'ap-southeast-3'
  | 'ap-northeast-1'
  | 'ap-northeast-2'
  | 'ap-northeast-3'
  // South America
  | 'sa-east-1'
  // Middle East
  | 'me-south-1'
  // Africa
  | 'af-south-1';

export interface GeoLocation {
  country: string;
  region?: string;
  city?: string;
  continent: Continent;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface RegionInfo {
  id: Region;
  name: string;
  location: GeoLocation;
  datacenters: DatacenterInfo[];
  capacity: number;
  availableCapacity: number;
  status: RegionStatus;
  healthScore: number;
  latencyScore: number;
  priority: number;
}

export type RegionStatus = 'active' | 'degraded' | 'maintenance' | 'offline';

export interface DatacenterInfo {
  id: string;
  region: Region;
  name: string;
  location: GeoLocation;
  capacity: number;
  availableCapacity: number;
  status: DatacenterStatus;
  healthScore: number;
  endpoints: string[];
}

export type DatacenterStatus = 'healthy' | 'degraded' | 'unhealthy' | 'draining';

export interface ProximityInfo {
  region: Region;
  distance: number; // in kilometers
  estimatedLatency: number; // in milliseconds
  score: number;
}

// ============================================================================
// Latency Types
// ============================================================================

export interface LatencyMetrics {
  region: Region;
  timestamp: number;
  p50: number; // median latency in ms
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
  mean: number;
  stdDev: number;
  sampleCount: number;
}

export interface LatencyMeasurement {
  sourceRegion: Region;
  targetRegion: Region;
  latency: number;
  timestamp: number;
  measurementMethod: 'active' | 'passive';
}

export interface LatencyPrediction {
  from: Region;
  to: Region;
  predictedLatency: number;
  confidence: number;
  factors: LatencyFactor[];
}

export interface LatencyFactor {
  name: string;
  impact: number;
  description: string;
}

export interface LatencyHistory {
  region: Region;
  measurements: LatencyMeasurement[];
  trends: LatencyTrends;
  anomalies: LatencyAnomaly[];
}

export interface LatencyTrends {
  direction: 'improving' | 'stable' | 'degrading';
  rate: number; // change per hour
  prediction: LatencyPrediction;
}

export interface LatencyAnomaly {
  timestamp: number;
  expectedLatency: number;
  actualLatency: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// Capacity Types
// ============================================================================

export interface CapacityMetrics {
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

export interface CapacityThresholds {
  warning: number; // percentage
  critical: number; // percentage
  overload: number; // percentage
}

export interface CapacityPrediction {
  region: Region;
  currentCapacity: number;
  predictedCapacity: number;
  predictedUtilization: number;
  timeUntilOverload: number; // seconds until overload
  confidence: number;
}

export interface ScalingEvent {
  id: string;
  region: Region;
  eventType: 'scale-up' | 'scale-down' | 'scale-out' | 'scale-in';
  timestamp: number;
  beforeCapacity: number;
  afterCapacity: number;
  reason: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

export interface CapacitySnapshot {
  region: Region;
  timestamp: number;
  metrics: CapacityMetrics;
  prediction: CapacityPrediction;
  scalingEvents: ScalingEvent[];
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheckConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  unhealthyThreshold: number;
  healthyThreshold: number;
  checkType: HealthCheckType;
}

export type HealthCheckType =
  | 'http'
  | 'https'
  | 'tcp'
  | 'udp'
  | 'icmp'
  | 'composite';

export interface HealthCheck {
  id: string;
  region: Region;
  target: string;
  config: HealthCheckConfig;
  status: HealthStatus;
  lastCheckTime: number;
  nextCheckTime: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown' | 'draining';

export interface HealthCheckResult {
  checkId: string;
  region: Region;
  timestamp: number;
  status: HealthStatus;
  latency: number;
  error?: string;
  details: Record<string, unknown>;
}

export interface HealthScore {
  region: Region;
  score: number; // 0-100
  components: HealthScoreComponent[];
  timestamp: number;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface HealthScoreComponent {
  name: string;
  weight: number;
  score: number;
  details: string;
}

export interface FailoverConfig {
  enabled: boolean;
  automaticFailover: boolean;
  failoverThreshold: number;
  recoveryMode: 'automatic' | 'manual';
  minHealthyRegions: number;
}

export interface FailoverEvent {
  id: string;
  timestamp: number;
  fromRegion: Region;
  toRegion: Region;
  reason: string;
  affectedUsers: number;
  status: 'in-progress' | 'completed' | 'rolled-back';
}

// ============================================================================
// Traffic Shaping Types
// ============================================================================

export interface TrafficRule {
  id: string;
  name: string;
  priority: number;
  condition: TrafficCondition;
  action: TrafficAction;
  enabled: boolean;
}

export interface TrafficCondition {
  type: 'region' | 'latency' | 'capacity' | 'user' | 'composite';
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: unknown;
  conditions?: TrafficCondition[]; // for composite conditions
}

export type TrafficAction =
  | ThrottleAction
  | RedirectAction
  | PrioritizeAction
  | BlockAction;

export interface ThrottleAction {
  type: 'throttle';
  maxRequestsPerSecond: number;
  maxConcurrentRequests: number;
  burstSize: number;
}

export interface RedirectAction {
  type: 'redirect';
  targetRegion: Region;
  redirectCode: 301 | 302 | 307 | 308;
}

export interface PrioritizeAction {
  type: 'prioritize';
  priority: number;
  queue: 'high' | 'medium' | 'low';
}

export interface BlockAction {
  type: 'block';
  reason: string;
  statusCode: 429 | 503;
}

export interface TrafficShapingPolicy {
  id: string;
  name: string;
  version: number;
  rules: TrafficRule[];
  defaultAction: TrafficAction;
  createdAt: number;
  updatedAt: number;
  enabled?: boolean;
}

export interface ThrottlingConfig {
  enabled: boolean;
  globalLimit: number;
  perRegionLimit: Map<Region, number>;
  perUserLimit: number;
  burstAllowance: number;
  rateLimitWindow: number; // milliseconds
}

export interface QueueManagementConfig {
  maxQueueSize: number;
  priorityLevels: number;
  queueTimeout: number;
  requeuePolicy: 'drop' | 'retry' | 'fallback';
}

export interface DDoSProtectionConfig {
  enabled: boolean;
  threshold: number; // requests per second
  burstThreshold: number;
  mitigationAction: 'throttle' | 'challenge' | 'block';
  whitelist: string[];
  blacklist: string[];
}

// ============================================================================
// Anycast Types
// ============================================================================

export interface AnycastConfig {
  enabled: boolean;
  dnsProvider: 'cloudflare' | 'aws' | 'google' | 'custom';
  ipRanges: string[];
  anycastPrefixes: AnycastPrefix[];
}

export interface AnycastPrefix {
  prefix: string;
  regions: Region[];
  healthCheckEnabled: boolean;
  weight: number;
}

export interface AnycastRoute {
  prefix: string;
  nextHop: string;
  localPref: number;
  asPath: number[];
  communities: string[];
  med: number;
}

export interface BGPConfig {
  asNumber: number;
  neighbors: BGPPeer[];
  routePolicies: RoutePolicy[];
  communities: BGPCommunity[];
}

export interface BGPPeer {
  ipAddress: string;
  asNumber: number;
  authenticationKey?: string;
  enabled: boolean;
}

export interface RoutePolicy {
  name: string;
  match: RouteMatch;
  action: RouteAction;
  priority: number;
  med?: number;
}

export interface RouteMatch {
  prefix?: string;
  asPath?: number[];
  community?: string[];
  nextHop?: string;
}

export type RouteAction = 'accept' | 'reject' | 'set-local-pref' | 'set-med' | 'prepend-as';

export interface BGPCommunity {
  value: string;
  description: string;
}

// ============================================================================
// Routing Decision Types
// ============================================================================

export interface RoutingContext {
  requestId: string;
  userId?: string;
  sourceLocation: GeoLocation;
  timestamp: number;
  userAgent?: string;
  priority: number;
  tags: string[];
}

export interface RoutingDecision {
  requestId: string;
  selectedRegion: Region;
  selectedDatacenter: string;
  selectedEndpoint: string;
  reasoning: RoutingReason[];
  confidence: number;
  timestamp: number;
  alternatives: RoutingAlternative[];
}

export interface RoutingReason {
  factor: string;
  weight: number;
  score: number;
  description: string;
}

export interface RoutingAlternative {
  region: Region;
  score: number;
  reason: string;
}

export type RoutingStrategy =
  | 'geographic'
  | 'latency'
  | 'capacity'
  | 'weighted'
  | 'round-robin'
  | 'least-connections'
  | 'consistent-hash'
  | 'adaptive';

export interface RoutingConfig {
  strategy: RoutingStrategy;
  fallbackStrategy: RoutingStrategy;
  weights?: Map<Region, number>;
  stickySessions: boolean;
  sessionAffinityTTL: number;
}

// ============================================================================
// Monitoring and Analytics Types
// ============================================================================

export interface LoadBalancerMetrics {
  timestamp: number;
  totalRequests: number;
  requestsByRegion: Map<Region, number>;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  throughput: number; // requests per second
  activeConnections: number;
}

export interface PerformanceReport {
  period: {
    start: number;
    end: number;
  };
  summary: PerformanceSummary;
  regionBreakdown: RegionPerformance[];
  recommendations: Recommendation[];
}

export interface PerformanceSummary {
  totalRequests: number;
  averageLatency: number;
  availability: number; // percentage
  errorRate: number;
  throughput: number;
}

export interface RegionPerformance {
  region: Region;
  requests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  availability: number;
}

export interface Recommendation {
  type: 'capacity' | 'routing' | 'health' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  actionItems: string[];
  estimatedImpact: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class LoadBalancerError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LoadBalancerError';
  }
}

export class RegionUnavailableError extends LoadBalancerError {
  constructor(region: Region, reason: string) {
    super(
      `Region ${region} is unavailable: ${reason}`,
      'REGION_UNAVAILABLE',
      503,
      { region, reason }
    );
    this.name = 'RegionUnavailableError';
  }
}

export class NoHealthyRegionsError extends LoadBalancerError {
  constructor() {
    super(
      'No healthy regions available',
      'NO_HEALTHY_REGIONS',
      503
    );
    this.name = 'NoHealthyRegionsError';
  }
}

export class CapacityExceededError extends LoadBalancerError {
  constructor(region: Region, utilization: number) {
    super(
      `Region ${region} capacity exceeded: ${utilization}% utilization`,
      'CAPACITY_EXCEEDED',
      503,
      { region, utilization }
    );
    this.name = 'CapacityExceededError';
  }
}

export class ThrottledError extends LoadBalancerError {
  constructor(retryAfter?: number) {
    super(
      'Request throttled',
      'THROTTLED',
      429,
      { retryAfter }
    );
    this.name = 'ThrottledError';
  }
}

// Re-export LoadBalancerConfig for convenience
export type { LoadBalancerConfig } from '../loadbalancer.js';
