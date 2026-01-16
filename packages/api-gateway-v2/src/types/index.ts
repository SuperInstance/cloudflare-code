/**
 * Core type definitions for API Gateway v2
 */

// @ts-nocheck - External GraphQL dependencies have type incompatibilities
import { GraphQLSchema, GraphQLResolveInfo } from 'graphql';
import { DurableObjectStorage } from '@cloudflare/workers-types';

// ============================================================================
// Core Types
// ============================================================================

export interface GatewayConfig {
  graphql?: GraphQLConfig;
  subscriptions?: SubscriptionConfig;
  composition?: CompositionConfig;
  rateLimit?: RateLimitConfig;
  versioning?: VersioningConfig;
  services: ServiceConfig[];
}

export interface ServiceConfig {
  name: string;
  endpoint: string;
  type: 'graphql' | 'rest' | 'grpc';
  version?: string;
  healthCheck?: HealthCheckConfig;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  headers?: Record<string, string>;
  authentication?: AuthConfig;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  path: string;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  multiplier: number;
  retryableErrors: string[];
}

export interface AuthConfig {
  type: 'jwt' | 'api-key' | 'oauth2' | 'none';
  credentials?: Record<string, string>;
}

// ============================================================================
// GraphQL Types
// ============================================================================

export interface GraphQLConfig {
  federation: FederationConfig;
  subscriptions: boolean;
  playground: boolean;
  introspection: boolean;
  validation: ValidationConfig;
}

export interface FederationConfig {
  enabled: boolean;
  version: 1 | 2;
  schemaPollingInterval?: number;
  queryPlanCache?: QueryPlanCacheConfig;
}

export interface QueryPlanCacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
}

export interface ValidationConfig {
  complexityLimit: number;
  depthLimit: number;
  costLimit: number;
}

export interface FederatedService {
  name: string;
  schema: GraphQLSchema;
  url: string;
  version: string;
  entities: EntityDefinition[];
}

export interface EntityDefinition {
  name: string;
  keys: string[];
  fields: FieldDefinition[];
  resolves?: boolean;
}

export interface FieldDefinition {
  name: string;
  type: string;
  arguments?: ArgumentDefinition[];
}

export interface ArgumentDefinition {
  name: string;
  type: string;
  defaultValue?: any;
}

export interface FederationContext {
  services: Map<string, FederatedService>;
  schema?: GraphQLSchema;
  queryPlanCache?: Map<string, QueryPlan>;
}

export interface QueryPlan {
  id: string;
  operations: QueryOperation[];
  dependencies: string[];
  estimatedCost: number;
}

export interface QueryOperation {
  id: string;
  service: string;
  operation: string;
  variables: Record<string, any>;
  dependsOn: string[];
}

// ============================================================================
// Subscription Types
// ============================================================================

export interface SubscriptionConfig {
  enabled: boolean;
  maxConnections: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  messageQueueSize: number;
  redis?: RedisConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface SubscriptionConnection {
  id: string;
  socket: WebSocket;
  subscriptions: Map<string, Subscription>;
  context: SubscriptionContext;
  createdAt: number;
  lastActivityAt: number;
}

export interface Subscription {
  id: string;
  query: string;
  variables: Record<string, any>;
  filters: SubscriptionFilter[];
  createdAt: number;
}

export interface SubscriptionFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface SubscriptionContext {
  userId?: string;
  isAuthenticated: boolean;
  roles: string[];
  metadata: Record<string, any>;
}

export interface SubscriptionEvent {
  id: string;
  topic: string;
  payload: any;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface SubscriptionMessage {
  type: 'data' | 'error' | 'complete';
  id: string;
  payload?: any;
  error?: Error;
}

// ============================================================================
// Composition Types
// ============================================================================

export interface CompositionConfig {
  maxConcurrentRequests: number;
  defaultTimeout: number;
  orchestrationTimeout: number;
  cache?: CompositionCacheConfig;
}

export interface CompositionCacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
}

export interface CompositionPlan {
  id: string;
  steps: CompositionStep[];
  timeout: number;
  retryPolicy?: RetryPolicy;
}

export interface CompositionStep {
  id: string;
  service: string;
  operation: string;
  type: 'query' | 'mutation' | 'custom';
  execution: 'parallel' | 'sequential';
  dependencies: string[];
  inputs: StepInput[];
  outputs: StepOutput[];
  timeout?: number;
}

export interface StepInput {
  source: 'request' | 'step' | 'constant';
  value: any;
  transform?: string;
}

export interface StepOutput {
  name: string;
  path: string;
  required: boolean;
}

export interface CompositionContext {
  request: any;
  results: Map<string, any>;
  metadata: CompositionMetadata;
}

export interface CompositionMetadata {
  requestId: string;
  startTime: number;
  traceId: string;
  userId?: string;
}

export interface CompositionResult {
  data: any;
  errors?: Error[];
  metadata: ResultMetadata;
}

export interface ResultMetadata {
  duration: number;
  steps: StepResult[];
  cacheHits: number;
  serviceCalls: number;
}

export interface StepResult {
  stepId: string;
  service: string;
  duration: number;
  success: boolean;
  cached: boolean;
  error?: Error;
}

// ============================================================================
// Aggregation Types
// ============================================================================

export interface AggregationConfig {
  strategy: 'merge' | 'replace' | 'custom';
  mergePolicies: Map<string, MergePolicy>;
  conflictResolution: ConflictResolution;
  deduplication: DeduplicationConfig;
}

export interface MergePolicy {
  type: 'overwrite' | 'merge' | 'array' | 'custom';
  priority?: number;
  transformer?: string;
}

export interface ConflictResolution {
  strategy: 'last-write-wins' | 'first-write-wins' | 'merge' | 'error';
  fieldPolicies?: Map<string, ConflictPolicy>;
}

export interface ConflictPolicy {
  strategy: 'last-write-wins' | 'first-write-wins' | 'merge' | 'error';
  priority?: number;
}

export interface DeduplicationConfig {
  enabled: boolean;
  keyFields: string[];
  strategy: 'first' | 'last' | 'merge';
}

export interface AggregationResult {
  data: any;
  metadata: AggregationMetadata;
}

export interface AggregationMetadata {
  sourceCount: number;
  mergedFields: string[];
  conflicts: Conflict[];
  duplicates: DuplicateInfo[];
}

export interface Conflict {
  path: string;
  sources: string[];
  values: any[];
  resolved: any;
  strategy: string;
}

export interface DuplicateInfo {
  key: string;
  count: number;
  sources: string[];
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitConfig {
  enabled: boolean;
  default: RateLimitRule;
  endpoints: Map<string, RateLimitRule>;
  storage: RateLimitStorage;
  algorithm: 'token-bucket' | 'leaky-bucket' | 'fixed-window' | 'sliding-window';
}

export interface RateLimitRule {
  requests: number;
  window: number; // milliseconds
  burst?: number;
}

export interface RateLimitStorage {
  type: 'memory' | 'redis' | 'durable-object';
  options?: Record<string, any>;
}

export interface RateLimitState {
  count: number;
  resetAt: number;
  remaining: number;
  burstTokens?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ============================================================================
// Versioning Types
// ============================================================================

export interface VersioningConfig {
  strategy: 'url' | 'header' | 'query' | 'content-type';
  defaultVersion: string;
  versions: VersionDefinition[];
}

export interface VersionDefinition {
  version: string;
  deprecated?: boolean;
  sunsetAt?: number;
  services: Map<string, string>;
  headers?: Record<string, string>;
  transformations?: VersionTransformation[];
}

export interface VersionTransformation {
  type: 'request' | 'response';
  schema: any;
}

export interface VersionedRequest {
  version: string;
  originalRequest: Request;
  transformedRequest?: Request;
}

export interface VersionedResponse {
  version: string;
  data: any;
  headers?: Record<string, string>;
}

// ============================================================================
// Middleware Types
// ============================================================================

export interface MiddlewareContext {
  request: Request;
  response?: Response;
  metadata: RequestMetadata;
  state: Map<string, any>;
}

export interface RequestMetadata {
  requestId: string;
  timestamp: number;
  userId?: string;
  clientIp: string;
  userAgent: string;
  path: string;
  method: string;
}

export interface MiddlewareFunction {
  (context: MiddlewareContext): Promise<Response> | Response;
}

export interface MiddlewarePipeline {
  middleware: MiddlewareFunction[];
  execute(context: MiddlewareContext): Promise<Response>;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'lfu' | 'fifo';
  storage: CacheStorage;
}

export interface CacheStorage {
  type: 'memory' | 'redis' | 'durable-object';
  options?: Record<string, any>;
}

export interface CacheEntry {
  key: string;
  value: any;
  expiresAt: number;
  metadata: CacheMetadata;
}

export interface CacheMetadata {
  createdAt: number;
  accessedAt: number;
  hitCount: number;
  size: number;
}

export interface CacheResult {
  hit: boolean;
  value?: any;
  metadata?: CacheMetadata;
}

// ============================================================================
// Durable Object Types
// ============================================================================

export interface GatewayDurableObjectState {
  storage: DurableObjectStorage;
  env: any;
}

export interface GatewayState {
  services: Map<string, ServiceState>;
  subscriptions: Map<string, SubscriptionConnection>;
  rateLimits: Map<string, RateLimitState>;
  cache: Map<string, CacheEntry>;
  metrics: GatewayMetrics;
}

export interface ServiceState {
  healthy: boolean;
  lastHealthCheck: number;
  failureCount: number;
  latency: number[];
}

export interface GatewayMetrics {
  requests: number;
  errors: number;
  latency: number[];
  lastUpdated: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class GatewayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class FederationError extends GatewayError {
  constructor(message: string, details?: any) {
    super(message, 'FEDERATION_ERROR', 500, details);
    this.name = 'FederationError';
  }
}

export class CompositionError extends GatewayError {
  constructor(message: string, details?: any) {
    super(message, 'COMPOSITION_ERROR', 500, details);
    this.name = 'CompositionError';
  }
}

export class RateLimitError extends GatewayError {
  constructor(message: string, public retryAfter: number) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends GatewayError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type MaybePromise<T> = T | Promise<T>;

export type ServiceRegistry = Map<string, ServiceConfig>;

export type SchemaRegistry = Map<string, GraphQLSchema>;

export type RequestHandler = (request: Request) => Promise<Response>;

export type GraphQLResolver = (
  parent: any,
  args: any,
  context: any,
  info: GraphQLResolveInfo
) => MaybePromise<any>;

// ============================================================================
// Orchestration Types
// ============================================================================

export interface OrchestrationPlan {
  id: string;
  steps: OrchestrationStep[];
  timeout: number;
  maxParallelism: number;
  retryPolicy?: RetryPolicy;
}

export interface OrchestrationStep {
  id: string;
  service: string;
  operation: string;
  mode: 'parallel' | 'sequential';
  dependencies: string[];
  input: any;
  output: boolean;
  required: boolean;
  timeout?: number;
  retryable: boolean;
  postProcess?: (result: any, context: OrchestrationContext) => any;
}

export interface OrchestrationContext {
  requestId: string;
  startTime: number;
  input: any;
  results: Map<string, any>;
  metadata: Record<string, any>;
  traceId: string;
}

export interface OrchestrationResult {
  success: boolean;
  requestId: string;
  data?: any;
  duration: number;
  steps: Array<{
    id: string;
    service: string;
    duration: number;
    success: boolean;
  }>;
  error?: Error;
}
