/**
 * Core type definitions for API Gateway v3
 */

import { z } from 'zod';

// ============================================================================
// Request/Response Types
// ============================================================================

export interface GatewayRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  headers: Headers;
  body: ReadableStream | null;
  query: URLSearchParams;
  params: Record<string, string>;
  context: RequestContext;
  metadata: RequestMetadata;
}

export interface RequestContext {
  userId?: string;
  sessionId: string;
  traceId: string;
  auth?: AuthContext;
  rateLimit?: RateLimitContext;
  cache?: CacheContext;
  edge?: EdgeContext;
}

export interface AuthContext {
  authenticated: boolean;
  userId?: string;
  scopes: string[];
  token?: string;
  expiresAt?: number;
}

export interface RateLimitContext {
  limit: number;
  remaining: number;
  reset: number;
  window: number;
}

export interface CacheContext {
  enabled: boolean;
  key?: string;
  ttl?: number;
  tags?: string[];
}

export interface EdgeContext {
  location: string;
  region: string;
  datacenter?: string;
  latency?: number;
}

export interface RequestMetadata {
  sourceIp: string;
  userAgent: string;
  contentType?: string;
  accept?: string;
  origin?: string;
  referer?: string;
}

export interface GatewayResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body: ReadableStream | string | null;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  requestId: string;
  duration: number;
  cached: boolean;
  edgeLocation?: string;
  version?: string;
}

// ============================================================================
// Service Types
// ============================================================================

export interface ServiceDefinition {
  id: string;
  name: string;
  version: string;
  endpoint: string;
  healthCheck?: HealthCheckConfig;
  timeout: number;
  retryPolicy?: RetryPolicy;
  circuitBreaker?: CircuitBreakerConfig;
  cachePolicy?: CachePolicy;
  rateLimit?: RateLimitPolicy;
  auth?: ServiceAuth;
  metadata: ServiceMetadata;
}

export interface HealthCheckConfig {
  enabled: boolean;
  path: string;
  interval: number;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  retryableErrors: number[];
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  threshold: number;
  resetTimeout: number;
  halfOpenMaxCalls: number;
}

export interface CachePolicy {
  enabled: boolean;
  ttl: number;
  staleWhileRevalidate?: number;
  cacheableMethods: string[];
  cacheableStatusCodes: number[];
  invalidateOnMutation?: boolean;
}

export interface RateLimitPolicy {
  enabled: boolean;
  requestsPerSecond: number;
  burst: number;
  algorithm: 'token-bucket' | 'leaky-bucket' | 'fixed-window';
}

export interface ServiceAuth {
  type: 'none' | 'api-key' | 'jwt' | 'oauth2';
  credentials?: Record<string, string>;
}

export interface ServiceMetadata {
  description?: string;
  tags?: string[];
  owner?: string;
  documentation?: string;
  deprecated?: boolean;
}

export interface ServiceRegistry {
  register(service: ServiceDefinition): Promise<void>;
  unregister(serviceId: string): Promise<void>;
  get(serviceId: string): Promise<ServiceDefinition | undefined>;
  getAll(): Promise<ServiceDefinition[]>;
  getHealthy(): Promise<ServiceDefinition[]>;
  updateHealth(serviceId: string, healthy: boolean): Promise<void>;
}

// ============================================================================
// Composition Types
// ============================================================================

export interface CompositionRequest {
  requestId: string;
  operations: CompositionOperation[];
  timeout?: number;
  mergeStrategy?: MergeStrategy;
  errorPolicy?: ErrorPolicy;
}

export interface CompositionOperation {
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

export interface MergeConfig {
  targetPath: string;
  sourcePath?: string;
  transform?: string;
  arrayMerge?: 'replace' | 'append' | 'prepend' | 'merge';
  condition?: string;
}

export type MergeStrategy = 'parallel' | 'sequential' | 'mixed';

export type ErrorPolicy = 'fail-fast' | 'continue' | 'aggregate';

export interface CompositionResult {
  requestId: string;
  data: Record<string, unknown>;
  errors: CompositionError[];
  metadata: CompositionMetadata;
}

export interface CompositionError {
  operationId: string;
  serviceId: string;
  error: string;
  code?: string;
  details?: unknown;
  retryable: boolean;
  timestamp: number;
}

export interface CompositionMetadata {
  startTime: number;
  endTime: number;
  duration: number;
  operationCount: number;
  successCount: number;
  failureCount: number;
  operations: OperationMetadata[];
}

export interface OperationMetadata {
  operationId: string;
  serviceId: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  cached: boolean;
  retries: number;
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface StreamConfig {
  type: 'sse' | 'websocket' | 'chunked' | 'streaming-api';
  bufferSize?: number;
  backpressure?: boolean;
  compression?: boolean;
  heartbeat?: number;
  reconnect?: boolean;
}

export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export interface WebSocketMessage {
  type: 'message' | 'error' | 'close' | 'ping' | 'pong';
  data?: unknown;
  code?: number;
  reason?: string;
}

export interface StreamSession {
  id: string;
  type: string;
  createdAt: number;
  lastActivity: number;
  clientId?: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Edge Types
// ============================================================================

export interface EdgeFunction {
  id: string;
  name: string;
  handler: string;
  runtime: 'javascript' | 'wasm' | 'compiled';
  memory: number;
  timeout: number;
  regions: string[];
  config?: EdgeFunctionConfig;
}

export interface EdgeFunctionConfig {
  env?: Record<string, string>;
  bindings?: Record<string, unknown>;
  kvNamespaces?: string[];
  durableObjects?: string[];
  queues?: string[];
}

export interface EdgeCacheConfig {
  enabled: boolean;
  ttl: number;
  staleWhileRevalidate?: number;
  purgeKeys?: string[];
  cacheKeys?: CacheKeyConfig[];
}

export interface CacheKeyConfig {
  name: string;
  include: CacheKeySpec[];
  exclude: CacheKeySpec[];
}

export type CacheKeySpec =
  | { type: 'header'; name: string }
  | { type: 'cookie'; name: string }
  | { type: 'query'; name: string }
  | { type: 'custom'; expression: string };

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsEvent {
  id: string;
  timestamp: number;
  type: EventType;
  data: Record<string, unknown>;
  tags?: string[];
}

export type EventType =
  | 'request-start'
  | 'request-end'
  | 'cache-hit'
  | 'cache-miss'
  | 'error'
  | 'timeout'
  | 'circuit-breaker-open'
  | 'rate-limit-exceeded'
  | 'composition-start'
  | 'composition-end'
  | 'stream-event';

export interface AnalyticsMetric {
  name: string;
  value: number;
  timestamp: number;
  dimensions: Record<string, string>;
  tags?: string[];
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  refreshInterval?: number;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  query: AnalyticsQuery;
  config: WidgetConfig;
}

export type WidgetType =
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart'
  | 'gauge'
  | 'table'
  | 'stat'
  | 'heatmap';

export interface AnalyticsQuery {
  metric: string;
  filters?: QueryFilter[];
  aggregation?: AggregationType;
  groupBy?: string[];
  timeRange?: TimeRange;
}

export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'percentile';

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface TimeRange {
  start: number;
  end: number;
  interval?: number;
}

export interface WidgetConfig {
  height?: number;
  width?: number;
  options?: Record<string, unknown>;
}

// ============================================================================
// Orchestration Types
// ============================================================================

export interface OrchestratorConfig {
  maxConcurrent: number;
  queueSize: number;
  timeout: number;
  retryPolicy: RetryPolicy;
  deadLetterQueue?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  steps: WorkflowStep[];
  timeout: number;
  retryPolicy: RetryPolicy;
  compensation?: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  serviceId?: string;
  config: StepConfig;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  compensationStepId?: string;
}

export type StepType = 'service' | 'composition' | 'transform' | 'condition' | 'parallel' | 'sequence';

export interface StepConfig {
  method?: string;
  path?: string;
  expression?: string;
  operations?: CompositionOperation[];
  condition?: string;
  steps?: WorkflowStep[];
  transform?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: Error;
  startedAt: number;
  completedAt?: number;
  steps: StepExecution[];
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'compensating';

export interface StepExecution {
  stepId: string;
  status: ExecutionStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: Error;
  startedAt: number;
  completedAt?: number;
  retries: number;
}

// ============================================================================
// GraphQL Types
// ============================================================================

export interface GraphQLSchemaConfig {
  typeDefs: string;
  resolvers?: Record<string, unknown>;
  directives?: Record<string, unknown>;
  subscriptions?: boolean;
  federation?: boolean;
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: GraphQLError[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface FederatedSubgraph {
  name: string;
  url: string;
  schema?: string;
  version?: string;
  healthCheck?: HealthCheckConfig;
}

export interface FederationGatewayConfig {
  subgraphs: FederatedSubgraph[];
  queryPlan?: QueryPlanConfig;
  composition?: CompositionConfig;
}

export interface QueryPlanConfig {
  enabled: boolean;
  cacheTTL?: number;
  maxDepth?: number;
}

export interface CompositionConfig {
  timeout: number;
  retryPolicy: RetryPolicy;
  mergeStrategy?: MergeStrategy;
}

// ============================================================================
// Versioning Types
// ============================================================================

export interface VersionConfig {
  strategy: VersionStrategy;
  defaultVersion: string;
  versions: VersionDefinition[];
}

export type VersionStrategy = 'url' | 'header' | 'query' | 'content-type';

export interface VersionDefinition {
  version: string;
  deprecated?: boolean;
  sunsetDate?: number;
  serviceIds: string[];
  transform?: VersionTransform;
  routing?: VersionRouting;
}

export interface VersionTransform {
  request?: TransformConfig;
  response?: TransformConfig;
}

export interface TransformConfig {
  headers?: HeaderTransform;
  body?: BodyTransform;
}

export interface HeaderTransform {
  add?: Record<string, string>;
  remove?: string[];
  rename?: Record<string, string>;
}

export interface BodyTransform {
  type: 'json' | 'form' | 'custom';
  transform?: string;
}

export interface VersionRouting {
  weights?: Record<string, number>;
  canary?: CanaryConfig;
}

export interface CanaryConfig {
  version: string;
  percentage: number;
  criteria?: RoutingCriteria;
}

export interface RoutingCriteria {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  custom?: string;
}

// ============================================================================
// Middleware Types
// ============================================================================

export interface MiddlewareContext {
  request: GatewayRequest;
  response?: GatewayResponse;
  state: Map<string, unknown>;
  metadata: MiddlewareMetadata;
}

export interface MiddlewareMetadata {
  timestamp: number;
  duration: number;
  middleware: string[];
}

export type MiddlewareFunction = (
  context: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void>;

export interface MiddlewareConfig {
  name: string;
  enabled: boolean;
  order: number;
  config?: Record<string, unknown>;
}

// ============================================================================
// Config Types
// ============================================================================

export interface GatewayConfig {
  id: string;
  name: string;
  environment: 'development' | 'staging' | 'production';
  services: ServiceDefinition[];
  compositions?: CompositionDefinition[];
  routes: RouteConfig[];
  middleware: MiddlewareConfig[];
  analytics: AnalyticsConfig;
  edge: EdgeConfig;
  caching: GlobalCacheConfig;
  rateLimit: GlobalRateLimitConfig;
  circuitBreaker: GlobalCircuitBreakerConfig;
  versioning: VersionConfig;
  graphql?: GraphQLConfig;
  federation?: FederationGatewayConfig;
  orchestration?: OrchestratorConfig;
}

export interface CompositionDefinition {
  id: string;
  name: string;
  operations: CompositionOperation[];
  timeout: number;
  mergeStrategy: MergeStrategy;
  errorPolicy: ErrorPolicy;
}

export interface RouteConfig {
  id: string;
  path: string;
  method: string[];
  serviceId?: string;
  compositionId?: string;
  middleware?: string[];
  cachePolicy?: CachePolicy;
  rateLimit?: RateLimitPolicy;
  auth?: RouteAuthConfig;
  timeout?: number;
}

export interface RouteAuthConfig {
  required: boolean;
  scopes?: string[];
  strategies?: string[];
}

export interface AnalyticsConfig {
  enabled: boolean;
  endpoint?: string;
  batchSize: number;
  flushInterval: number;
  sampling: number;
  metrics: MetricConfig[];
}

export interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  enabled: boolean;
  tags?: string[];
}

export interface EdgeConfig {
  enabled: boolean;
  functions: EdgeFunction[];
  cache: EdgeCacheConfig;
  routing: EdgeRoutingConfig;
}

export interface EdgeRoutingConfig {
  strategy: 'latency' | 'geo' | 'round-robin' | 'weighted';
  regions: RegionConfig[];
}

export interface RegionConfig {
  name: string;
  endpoint: string;
  weight?: number;
  latency?: number;
}

export interface GlobalCacheConfig {
  enabled: boolean;
  defaultTTL: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
  compression: boolean;
}

export interface GlobalRateLimitConfig {
  enabled: boolean;
  defaultLimit: number;
  defaultWindow: number;
  storage: 'memory' | 'kv' | 'durable-object';
}

export interface GlobalCircuitBreakerConfig {
  enabled: boolean;
  defaultThreshold: number;
  defaultResetTimeout: number;
  monitoringEnabled: boolean;
}

export interface GraphQLConfig {
  enabled: boolean;
  endpoint: string;
  subscriptions: boolean;
  playground?: boolean;
  introspection?: boolean;
  federation?: boolean;
}

// ============================================================================
// Validation Schemas
// ============================================================================

export const ServiceDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  endpoint: z.string().url(),
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    path: z.string().default('/health'),
    interval: z.number().default(30000),
    timeout: z.number().default(5000),
    unhealthyThreshold: z.number().default(3),
    healthyThreshold: z.number().default(2),
  }).optional(),
  timeout: z.number().min(0).default(30000),
  retryPolicy: z.object({
    maxAttempts: z.number().min(1).default(3),
    backoffMultiplier: z.number().min(1).default(2),
    initialDelay: z.number().min(0).default(100),
    maxDelay: z.number().min(0).default(10000),
    retryableErrors: z.array(z.number()).default([500, 502, 503, 504]),
  }).optional(),
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    threshold: z.number().min(0).default(0.5),
    resetTimeout: z.number().min(0).default(60000),
    halfOpenMaxCalls: z.number().min(1).default(3),
  }).optional(),
  cachePolicy: z.object({
    enabled: z.boolean().default(false),
    ttl: z.number().min(0).default(60000),
    staleWhileRevalidate: z.number().min(0).optional(),
    cacheableMethods: z.array(z.string()).default(['GET']),
    cacheableStatusCodes: z.array(z.number()).default([200]),
    invalidateOnMutation: z.boolean().default(true),
  }).optional(),
  rateLimit: z.object({
    enabled: z.boolean().default(false),
    requestsPerSecond: z.number().min(1),
    burst: z.number().min(1).default(10),
    algorithm: z.enum(['token-bucket', 'leaky-bucket', 'fixed-window']),
  }).optional(),
  auth: z.object({
    type: z.enum(['none', 'api-key', 'jwt', 'oauth2']),
    credentials: z.record(z.string()).optional(),
  }).optional(),
  metadata: z.object({
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    owner: z.string().optional(),
    documentation: z.string().optional(),
    deprecated: z.boolean().default(false),
  }),
});

export const CompositionOperationSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  method: z.string(),
  path: z.string(),
  params: z.record(z.unknown()),
  headers: z.record(z.string()).optional(),
  timeout: z.number().min(0).optional(),
  retryPolicy: z.object({
    maxAttempts: z.number().min(1).default(3),
    backoffMultiplier: z.number().min(1).default(2),
    initialDelay: z.number().min(0).default(100),
    maxDelay: z.number().min(0).default(10000),
    retryableErrors: z.array(z.number()).default([500, 502, 503, 504]),
  }).optional(),
  dependencies: z.array(z.string()).optional(),
  mergeConfig: z.object({
    targetPath: z.string(),
    sourcePath: z.string().optional(),
    transform: z.string().optional(),
    arrayMerge: z.enum(['replace', 'append', 'prepend', 'merge']).default('replace'),
    condition: z.string().optional(),
  }).optional(),
});

export const GatewayConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  services: z.array(ServiceDefinitionSchema),
  compositions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    operations: z.array(CompositionOperationSchema),
    timeout: z.number().min(0),
    mergeStrategy: z.enum(['parallel', 'sequential', 'mixed']),
    errorPolicy: z.enum(['fail-fast', 'continue', 'aggregate']),
  })).optional(),
  routes: z.array(z.object({
    id: z.string(),
    path: z.string(),
    method: z.array(z.string()),
    serviceId: z.string().optional(),
    compositionId: z.string().optional(),
    middleware: z.array(z.string()).optional(),
    cachePolicy: z.object({
      enabled: z.boolean().default(false),
      ttl: z.number().min(0).default(60000),
      staleWhileRevalidate: z.number().min(0).optional(),
      cacheableMethods: z.array(z.string()).default(['GET']),
      cacheableStatusCodes: z.array(z.number()).default([200]),
      invalidateOnMutation: z.boolean().default(true),
    }).optional(),
    rateLimit: z.object({
      enabled: z.boolean().default(false),
      requestsPerSecond: z.number().min(1),
      burst: z.number().min(1).default(10),
      algorithm: z.enum(['token-bucket', 'leaky-bucket', 'fixed-window']),
    }).optional(),
    auth: z.object({
      required: z.boolean().default(false),
      scopes: z.array(z.string()).optional(),
      strategies: z.array(z.string()).optional(),
    }).optional(),
    timeout: z.number().min(0).optional(),
  })),
  middleware: z.array(z.object({
    name: z.string(),
    enabled: z.boolean().default(true),
    order: z.number(),
    config: z.record(z.unknown()).optional(),
  })),
  analytics: z.object({
    enabled: z.boolean().default(true),
    endpoint: z.string().url().optional(),
    batchSize: z.number().min(1).default(100),
    flushInterval: z.number().min(100).default(10000),
    sampling: z.number().min(0).max(1).default(1),
    metrics: z.array(z.object({
      name: z.string(),
      type: z.enum(['counter', 'gauge', 'histogram']),
      enabled: z.boolean().default(true),
      tags: z.array(z.string()).optional(),
    })),
  }),
  edge: z.object({
    enabled: z.boolean().default(true),
    functions: z.array(z.object({
      id: z.string(),
      name: z.string(),
      handler: z.string(),
      runtime: z.enum(['javascript', 'wasm', 'compiled']),
      memory: z.number().min(128).default(128),
      timeout: z.number().min(1).default(10),
      regions: z.array(z.string()),
      config: z.object({
        env: z.record(z.string()).optional(),
        bindings: z.record(z.unknown()).optional(),
        kvNamespaces: z.array(z.string()).optional(),
        durableObjects: z.array(z.string()).optional(),
        queues: z.array(z.string()).optional(),
      }).optional(),
    })),
    cache: z.object({
      enabled: z.boolean().default(true),
      ttl: z.number().min(0).default(3600000),
      staleWhileRevalidate: z.number().min(0).optional(),
      purgeKeys: z.array(z.string()).optional(),
      cacheKeys: z.array(z.object({
        name: z.string(),
        include: z.array(z.object({
          type: z.enum(['header', 'cookie', 'query', 'custom']),
          name: z.string().optional(),
          expression: z.string().optional(),
        })),
        exclude: z.array(z.object({
          type: z.enum(['header', 'cookie', 'query', 'custom']),
          name: z.string().optional(),
          expression: z.string().optional(),
        })),
      })),
    }),
    routing: z.object({
      strategy: z.enum(['latency', 'geo', 'round-robin', 'weighted']).default('latency'),
      regions: z.array(z.object({
        name: z.string(),
        endpoint: z.string().url(),
        weight: z.number().optional(),
        latency: z.number().optional(),
      })),
    }),
  }),
  caching: z.object({
    enabled: z.boolean().default(true),
    defaultTTL: z.number().min(0).default(3600000),
    maxSize: z.number().min(1).default(10000),
    evictionPolicy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
    compression: z.boolean().default(true),
  }),
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    defaultLimit: z.number().min(1).default(1000),
    defaultWindow: z.number().min(1000).default(60000),
    storage: z.enum(['memory', 'kv', 'durable-object']).default('memory'),
  }),
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    defaultThreshold: z.number().min(0).max(1).default(0.5),
    defaultResetTimeout: z.number().min(0).default(60000),
    monitoringEnabled: z.boolean().default(true),
  }),
  versioning: z.object({
    strategy: z.enum(['url', 'header', 'query', 'content-type']).default('header'),
    defaultVersion: z.string().default('v1'),
    versions: z.array(z.object({
      version: z.string(),
      deprecated: z.boolean().default(false),
      sunsetDate: z.number().optional(),
      serviceIds: z.array(z.string()),
      transform: z.object({
        request: z.object({
          headers: z.object({
            add: z.record(z.string()).optional(),
            remove: z.array(z.string()).optional(),
            rename: z.record(z.string()).optional(),
          }).optional(),
          body: z.object({
            type: z.enum(['json', 'form', 'custom']),
            transform: z.string().optional(),
          }).optional(),
        }).optional(),
        response: z.object({
          headers: z.object({
            add: z.record(z.string()).optional(),
            remove: z.array(z.string()).optional(),
            rename: z.record(z.string()).optional(),
          }).optional(),
          body: z.object({
            type: z.enum(['json', 'form', 'custom']),
            transform: z.string().optional(),
          }).optional(),
        }).optional(),
      }).optional(),
      routing: z.object({
        weights: z.record(z.number()).optional(),
        canary: z.object({
          version: z.string(),
          percentage: z.number().min(0).max(100),
          criteria: z.object({
            headers: z.record(z.string()).optional(),
            query: z.record(z.string()).optional(),
            cookies: z.record(z.string()).optional(),
            custom: z.string().optional(),
          }).optional(),
        }).optional(),
      }).optional(),
    })),
  }),
  graphql: z.object({
    enabled: z.boolean().default(false),
    endpoint: z.string().default('/graphql'),
    subscriptions: z.boolean().default(false),
    playground: z.boolean().default(false),
    introspection: z.boolean().default(true),
    federation: z.boolean().default(false),
  }).optional(),
  federation: z.object({
    subgraphs: z.array(z.object({
      name: z.string(),
      url: z.string().url(),
      schema: z.string().optional(),
      version: z.string().optional(),
      healthCheck: z.object({
        enabled: z.boolean().default(true),
        path: z.string().default('/health'),
        interval: z.number().default(30000),
        timeout: z.number().default(5000),
        unhealthyThreshold: z.number().default(3),
        healthyThreshold: z.number().default(2),
      }).optional(),
    })),
    queryPlan: z.object({
      enabled: z.boolean().default(true),
      cacheTTL: z.number().min(0).optional(),
      maxDepth: z.number().min(1).optional(),
    }).optional(),
    composition: z.object({
      timeout: z.number().min(0).default(30000),
      retryPolicy: z.object({
        maxAttempts: z.number().min(1).default(3),
        backoffMultiplier: z.number().min(1).default(2),
        initialDelay: z.number().min(0).default(100),
        maxDelay: z.number().min(0).default(10000),
        retryableErrors: z.array(z.number()).default([500, 502, 503, 504]),
      }),
      mergeStrategy: z.enum(['parallel', 'sequential', 'mixed']).default('parallel'),
    }).optional(),
  }).optional(),
  orchestration: z.object({
    maxConcurrent: z.number().min(1).default(100),
    queueSize: z.number().min(1).default(1000),
    timeout: z.number().min(0).default(300000),
    retryPolicy: z.object({
      maxAttempts: z.number().min(1).default(3),
      backoffMultiplier: z.number().min(1).default(2),
      initialDelay: z.number().min(0).default(100),
      maxDelay: z.number().min(0).default(10000),
      retryableErrors: z.array(z.number()).default([500, 502, 503, 504]),
    }),
    deadLetterQueue: z.boolean().default(true),
  }).optional(),
});

// ============================================================================
// Error Types
// ============================================================================

export class GatewayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class ServiceUnavailableError extends GatewayError {
  constructor(serviceId: string, details?: unknown) {
    super(
      `Service ${serviceId} is unavailable`,
      'SERVICE_UNAVAILABLE',
      503,
      details
    );
    this.name = 'ServiceUnavailableError';
  }
}

export class TimeoutError extends GatewayError {
  constructor(operation: string, timeout: number) {
    super(
      `Operation ${operation} timed out after ${timeout}ms`,
      'TIMEOUT',
      504,
      { timeout }
    );
    this.name = 'TimeoutError';
  }
}

export class CircuitBreakerOpenError extends GatewayError {
  constructor(serviceId: string) {
    super(
      `Circuit breaker is open for service ${serviceId}`,
      'CIRCUIT_BREAKER_OPEN',
      503
    );
    this.name = 'CircuitBreakerOpenError';
  }
}

export class RateLimitExceededError extends GatewayError {
  constructor(limit: number, reset: number) {
    super(
      `Rate limit exceeded: ${limit} requests allowed`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { limit, reset }
    );
    this.name = 'RateLimitExceededError';
  }
}

export class ValidationError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends GatewayError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends GatewayError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class CompositionError extends Error {
  constructor(
    message: string,
    public operationId: string,
    public serviceId: string,
    public retryable: boolean = false,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CompositionError';
  }
}
