/**
 * Core type definitions for the service mesh
 */

// ============================================================================
// Service Discovery Types
// ============================================================================

export interface ServiceInstance {
  id: string;
  serviceName: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'grpc-web';
  metadata: ServiceMetadata;
  healthStatus: HealthStatus;
  lastHeartbeat: number;
  version: string;
  tags: string[];
  zone: string;
  region: string;
  weight: number;
}

export interface ServiceMetadata {
  [key: string]: string | number | boolean | Record<string, any>;
}

export type HealthStatus = 'healthy' | 'unhealthy' | 'draining' | 'unknown';

export interface ServiceRegistration {
  serviceName: string;
  instance: ServiceInstance;
  ttl: number;
}

export interface ServiceQuery {
  serviceName: string;
  tags?: string[];
  region?: string;
  zone?: string;
  healthyOnly?: boolean;
  minVersion?: string;
}

export interface ServiceEndpoints {
  serviceName: string;
  instances: ServiceInstance[];
  timestamp: number;
}

// ============================================================================
// Communication Types
// ============================================================================

export interface ServiceRequest {
  id: string;
  sourceService: string;
  targetService: string;
  method: string;
  path: string;
  headers: Headers;
  body?: any;
  timeout: number;
  retryPolicy?: RetryPolicy;
  circuitBreaker?: string;
  metadata: RequestMetadata;
}

export interface ServiceResponse {
  id: string;
  status: number;
  headers: Headers;
  body?: any;
  duration: number;
  fromCache: boolean;
  error?: ServiceError;
}

export interface RequestMetadata {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  custom?: Record<string, any>;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  statusCode?: number;
}

export interface GrpcRequest {
  service: string;
  method: string;
  metadata: Map<string, string>;
  message: any;
  timeout: number;
}

export interface GrpcResponse {
  message: any;
  status: GrpcStatus;
  trailers: Map<string, string>;
}

export enum GrpcStatus {
  OK = 0,
  CANCELLED = 1,
  UNKNOWN = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  ABORTED = 10,
  OUT_OF_RANGE = 11,
  UNIMPLEMENTED = 12,
  INTERNAL = 13,
  UNAVAILABLE = 14,
  DATA_LOSS = 15,
  UNAUTHENTICATED = 16
}

// ============================================================================
// Circuit Breaker Types
// ============================================================================

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreakerConfig {
  serviceName: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenMaxCalls: number;
  rollingWindow: number;
  minRequests: number;
  slidingWindow: SlidingWindow;
  fallback?: FallbackConfig;
}

export interface SlidingWindow {
  size: number;
  type: 'count' | 'time';
  bucketCount: number;
}

export interface FallbackConfig {
  enabled: boolean;
  strategy: 'exception' | 'cached' | 'default' | 'alternative';
  fallbackService?: string;
  cacheTtl?: number;
  defaultValue?: any;
  exceptionType?: string;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastStateChange: number;
  nextAttemptTime: number;
  rollingStats: RollingStats;
}

export interface RollingStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  timeouts: number;
  latencies: number[];
}

// ============================================================================
// Retry Types
// ============================================================================

export interface RetryPolicy {
  maxAttempts: number;
  initialBackoff: number;
  maxBackoff: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  jitterFactor: number;
  retryableStatuses: number[];
  retryableErrors: string[];
  stopOnRetryableErrors?: boolean;
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: number;
  error?: ServiceError;
  duration: number;
  success: boolean;
}

export interface RetryResult {
  success: boolean;
  attempts: RetryAttempt[];
  totalDuration: number;
  finalError?: ServiceError;
}

export interface BackoffCalculator {
  (attempt: number, baseDelay: number): number;
}

// ============================================================================
// Observability Types
// ============================================================================

export interface ServiceMetrics {
  serviceName: string;
  instanceId: string;
  timestamp: number;
  requestCount: number;
  successCount: number;
  errorCount: number;
  latency: LatencyMetrics;
  throughput: ThroughputMetrics;
  resourceUsage: ResourceMetrics;
  circuitBreakerState?: CircuitState;
}

export interface LatencyMetrics {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  p999: number;
}

export interface ThroughputMetrics {
  requestsPerSecond: number;
  bytesPerSecond: number;
}

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  openFiles: number;
}

export interface DistributedTrace {
  traceId: string;
  parentSpanId?: string;
  spans: TraceSpan[];
  startTime: number;
  endTime: number;
  services: string[];
}

export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  duration: number;
  tags: Record<string, string>;
  logs: TraceLog[];
  status: SpanStatus;
}

export interface TraceLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

export interface SpanStatus {
  code: number;
  message?: string;
}

export interface HealthCheckResult {
  serviceName: string;
  instanceId: string;
  healthy: boolean;
  timestamp: number;
  checks: HealthCheck[];
  metadata: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  healthy: boolean;
  message?: string;
  duration: number;
}

// ============================================================================
// Traffic Management Types
// ============================================================================

export interface TrafficRule {
  id: string;
  name: string;
  priority: number;
  match: TrafficMatch;
  route: TrafficRoute;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  mirror?: TrafficMirror;
  headers?: HeaderOperations;
  metadata?: Record<string, any>;
  enabled: boolean;
}

export interface TrafficMatch {
  path?: string;
  pathPrefix?: string;
  method?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  sourceService?: string;
  userAgent?: string;
}

export interface TrafficRoute {
  type: 'service' | 'url' | 'redirect';
  destination: string;
  weight?: number;
  timeout?: number;
  rewritePath?: string;
}

export interface TrafficMirror {
  enabled: boolean;
  destination: string;
  percentage: number;
  sampleRate: number;
}

export interface HeaderOperations {
  request?: HeaderOperation[];
  response?: HeaderOperation[];
}

export interface HeaderOperation {
  action: 'add' | 'remove' | 'replace';
  header: string;
  value?: string;
}

export interface LoadBalancingStrategy {
  type: 'round-robin' | 'least-connections' | 'random' | 'weighted' | 'ip-hash' | 'consistent-hash';
  config?: Record<string, any>;
}

export interface TrafficSplit {
  serviceName: string;
  versions: TrafficVersion[];
  defaultVersion: string;
  canary?: CanaryConfig;
}

export interface TrafficVersion {
  name: string;
  weight: number;
  instances: string[];
  metadata?: Record<string, any>;
}

export interface CanaryConfig {
  version: string;
  weight: number;
  incrementStep: number;
  incrementInterval: number;
  maxWeight: number;
  metrics: CanaryMetrics;
  rollbackThreshold: number;
}

export interface CanaryMetrics {
  errorRate: number;
  latencyThreshold: number;
  customMetrics?: Record<string, number>;
}

// ============================================================================
// Control Plane Types
// ============================================================================

export interface ServiceMeshConfig {
  meshId: string;
  services: ConfiguredService[];
  globalPolicies: GlobalPolicies;
  observability: ObservabilityConfig;
  security: SecurityConfig;
  traffic: TrafficManagementConfig;
}

export interface ConfiguredService {
  name: string;
  namespace: string;
  version: string;
  ports: ServicePort[];
  discovery: ServiceDiscoveryConfig;
  loadBalancing: LoadBalancingStrategy;
  circuitBreaker?: CircuitBreakerConfig;
  retryPolicy?: RetryPolicy;
  timeout: TimeoutConfig;
  metadata: Record<string, any>;
}

export interface ServicePort {
  name: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'tcp';
  targetPort?: number;
}

export interface ServiceDiscoveryConfig {
  enabled: boolean;
  type: 'dns' | 'registry' | 'static';
  endpoints?: string[];
  healthCheck: HealthCheckConfig;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
  path?: string;
  protocol?: 'http' | 'https' | 'tcp';
}

export interface TimeoutConfig {
  connection: number;
  request: number;
  idle: number;
  stream?: number;
}

export interface GlobalPolicies {
  retry: RetryPolicy;
  timeout: TimeoutConfig;
  loadBalancing: LoadBalancingStrategy;
  circuitBreaker: CircuitBreakerConfig;
}

export interface ObservabilityConfig {
  tracing: TracingConfig;
  metrics: MetricsConfig;
  logging: LoggingConfig;
}

export interface TracingConfig {
  enabled: boolean;
  sampleRate: number;
  exporter: 'jaeger' | 'zipkin' | 'otlp' | 'stdout';
  exporterConfig: Record<string, any>;
}

export interface MetricsConfig {
  enabled: boolean;
  exporters: MetricExporter[];
  scrapeInterval: number;
}

export interface MetricExporter {
  type: 'prometheus' | 'otlp' | 'statsd';
  config: Record<string, any>;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  exporters: LogExporter[];
}

export interface LogExporter {
  type: 'console' | 'file' | 'elasticsearch' | 'cloudwatch';
  config: Record<string, any>;
}

export interface SecurityConfig {
  mTLS: MutualTLSConfig;
  authentication: AuthenticationConfig;
  authorization: AuthorizationConfig;
  encryption: EncryptionConfig;
}

export interface MutualTLSConfig {
  enabled: boolean;
  caCert?: string;
  cert?: string;
  key?: string;
  verifyClient: boolean;
}

export interface AuthenticationConfig {
  type: 'jwt' | 'oauth2' | 'api-key' | 'none';
  config: Record<string, any>;
}

export interface AuthorizationConfig {
  type: 'rbac' | 'abac' | 'none';
  policies: AuthorizationPolicy[];
}

export interface AuthorizationPolicy {
  name: string;
  rules: AuthorizationRule[];
}

export interface AuthorizationRule {
  from: string[];
  to: string[];
  methods: string[];
  allow: boolean;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyRotationInterval: number;
}

export interface TrafficManagementConfig {
  rules: TrafficRule[];
  splits: TrafficSplit[];
  loadBalancing: LoadBalancingStrategy;
}

// ============================================================================
// Sidecar Proxy Types
// ============================================================================

export interface ProxyConfig {
  proxyId: string;
  serviceName: string;
  namespace: string;
  meshId: string;
  listeningPorts: ProxyPort[];
  upstreams: ProxyUpstream[];
  filters: ProxyFilter[];
  resources: ResourceLimits;
  metadata: Record<string, any>;
}

export interface ProxyPort {
  name: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'tcp';
  targetPort?: number;
}

export interface ProxyUpstream {
  name: string;
  service: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc';
  loadBalancing: LoadBalancingStrategy;
  circuitBreaker?: CircuitBreakerConfig;
  retryPolicy?: RetryPolicy;
  timeout: TimeoutConfig;
  healthCheck: HealthCheckConfig;
}

export interface ProxyFilter {
  type: string;
  config: Record<string, any>;
  order: number;
}

export interface ResourceLimits {
  cpu: string;
  memory: string;
  connections: number;
  requestsPerSecond: number;
}

export interface ProxyStats {
  proxyId: string;
  timestamp: number;
  connections: ConnectionStats;
  requests: RequestStats;
  errors: ErrorStats;
  latency: LatencyMetrics;
  throughput: ThroughputMetrics;
}

export interface ConnectionStats {
  active: number;
  total: number;
  created: number;
  closed: number;
}

export interface RequestStats {
  total: number;
  successful: number;
  failed: number;
  timeout: number;
  retried: number;
}

export interface ErrorStats {
  total: number;
  byCode: Record<string, number>;
  byService: Record<string, number>;
}

// ============================================================================
// Event Types
// ============================================================================

export interface ServiceEvent {
  eventType: ServiceEventType;
  timestamp: number;
  serviceName: string;
  instanceId: string;
  data: any;
}

export type ServiceEventType =
  | 'service_registered'
  | 'service_deregistered'
  | 'service_healthy'
  | 'service_unhealthy'
  | 'circuit_open'
  | 'circuit_half_open'
  | 'circuit_closed'
  | 'retry_exhausted'
  | 'timeout'
  | 'error_rate_threshold'
  | 'latency_threshold';

// ============================================================================
// Context Types
// ============================================================================

export interface MeshContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage: Map<string, string>;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
}

export interface RequestExecutionContext {
  meshContext: MeshContext;
  sourceService: string;
  targetService: string;
  startTime: number;
  deadline: number;
  metadata: Record<string, any>;
}
