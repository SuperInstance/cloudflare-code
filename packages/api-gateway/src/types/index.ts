/**
 * API Gateway Type Definitions
 *
 * Core type definitions for the API Gateway package including
 * request/response types, configuration types, and error types.
 */

import type { ExecutionContext } from '@cloudflare/workers-types';

/**
 * Gateway context containing environment and execution context
 */
export interface GatewayContext {
  env: GatewayEnv;
  ctx: ExecutionContext;
  requestId: string;
  timestamp: number;
}

/**
 * Gateway environment bindings
 */
export interface GatewayEnv {
  // KV Namespaces
  KV: {
    RATE_LIMIT?: KVNamespace;
    CONFIG?: KVNamespace;
    CACHE?: KVNamespace;
    SESSIONS?: KVNamespace;
  };

  // Durable Object Namespaces
  DO: {
    RATE_LIMIT?: DurableObjectNamespace;
    SESSION?: DurableObjectNamespace;
    CIRCUIT_BREAKER?: DurableObjectNamespace;
  };

  // R2 Buckets
  R2?: {
    LOGS?: R2Bucket;
    ASSETS?: R2Bucket;
  };

  // D1 Databases
  D1?: {
    ANALYTICS?: D1Database;
    AUTH?: D1Database;
  };

  // Secrets
  secrets?: {
    JWT_SECRET?: string;
    OAUTH_CLIENT_SECRET?: string;
    ENCRYPTION_KEY?: string;
  };

  // Service bindings
  services?: {
    AUTH?: Fetcher;
    ANALYTICS?: Fetcher;
    NOTIFICATION?: Fetcher;
  };

  // Custom variables
  vars?: Record<string, string>;
}

/**
 * HTTP Request wrapper with gateway metadata
 */
export interface GatewayRequest {
  id: string;
  method: string;
  url: URL;
  headers: Headers;
  body: ReadableStream | null;
  query: URLSearchParams;
  ip: string;
  userAgent: string;
  timestamp: number;
  route?: RouteMatch;
  auth?: AuthContext;
  metadata: RequestMetadata;
}

/**
 * HTTP Response wrapper with gateway metadata
 */
export interface GatewayResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body: ReadableStream | null;
  timestamp: number;
  duration: number;
  metadata: ResponseMetadata;
}

/**
 * Request metadata
 */
export interface RequestMetadata {
  sourceIp: string;
  userAgent: string;
  referer?: string;
  country?: string;
  contentType?: string;
  contentLength?: number;
  userId?: string;
  orgId?: string;
  apiKey?: string;
  tags: Record<string, string>;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  cacheStatus?: 'hit' | 'miss' | 'bypass';
  rateLimitStatus?: 'allowed' | 'blocked' | 'throttled';
  authStatus?: 'authenticated' | 'unauthenticated' | 'forbidden';
  circuitStatus?: 'closed' | 'open' | 'half-open';
  upstream?: string;
  version?: string;
  tags: Record<string, string>;
}

/**
 * Authentication context
 */
export interface AuthContext {
  type: 'api_key' | 'jwt' | 'oauth' | 'mtls' | 'basic';
  userId?: string;
  orgId?: string;
  scopes: string[];
  roles: string[];
  permissions: string[];
  metadata: Record<string, unknown>;
  authenticatedAt: number;
  expiresAt?: number;
}

/**
 * Route match result
 */
export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
  path: string;
  matchedAt: number;
}

/**
 * Route definition
 */
export interface Route {
  id: string;
  name: string;
  path: string;
  methods: string[];
  upstream: Upstream;
  middleware: string[];
  auth: AuthConfig;
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
  version?: string;
  deprecated?: boolean;
  sunsetDate?: Date;
  metadata: Record<string, unknown>;
}

/**
 * Upstream configuration
 */
export interface Upstream {
  type: 'single' | 'load_balanced' | 'weighted';
  targets: UpstreamTarget[];
  strategy?: LoadBalancingStrategy;
  healthCheck?: HealthCheckConfig;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

/**
 * Upstream target
 */
export interface UpstreamTarget {
  id: string;
  url: string;
  weight?: number;
  healthStatus?: 'healthy' | 'unhealthy' | 'draining';
  metadata?: Record<string, unknown>;
}

/**
 * Load balancing strategies
 */
export type LoadBalancingStrategy =
  | 'round_robin'
  | 'least_connections'
  | 'weighted'
  | 'ip_hash'
  | 'random'
  | 'least_latency';

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  path: string;
  interval: number;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  retryableStatuses: number[];
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  required: boolean;
  methods: AuthMethod[];
  defaultMethod?: AuthMethod;
  apiKey?: ApiKeyAuthConfig;
  jwt?: JwtAuthConfig;
  oauth?: OAuthConfig;
  mtls?: MtlsConfig;
}

/**
 * Authentication methods
 */
export type AuthMethod = 'api_key' | 'jwt' | 'oauth' | 'mtls' | 'basic' | 'none';

/**
 * API Key authentication configuration
 */
export interface ApiKeyAuthConfig {
  headerName?: string;
  queryParam?: string;
  requiredScopes?: string[];
  validateLocally?: boolean;
}

/**
 * JWT authentication configuration
 */
export interface JwtAuthConfig {
  issuer: string;
  audience: string[];
  algorithms: string[];
  requiredScopes?: string[];
  clockSkewSeconds?: number;
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  providers: OAuthProvider[];
  tokenIntrospection?: {
    enabled: boolean;
    endpoint?: string;
  };
}

/**
 * OAuth provider
 */
export interface OAuthProvider {
  name: string;
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
}

/**
 * mTLS configuration
 */
export interface MtlsConfig {
  required: boolean;
  validateCertificate: boolean;
  allowedCas?: string[];
  allowedCns?: string[];
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  algorithm: RateLimitAlgorithm;
  limits: RateLimit[];
  burst?: number;
  headers?: {
    enabled: boolean;
    remaining?: string;
    reset?: string;
    limit?: string;
  };
}

/**
 * Rate limit algorithms
 */
export type RateLimitAlgorithm =
  | 'token_bucket'
  | 'sliding_window'
  | 'fixed_window'
  | 'leaky_bucket';

/**
 * Rate limit definition
 */
export interface RateLimit {
  id: string;
  name: string;
  scope: RateLimitScope;
  limit: number;
  window: number;
  key?: string;
}

/**
 * Rate limit scopes
 */
export type RateLimitScope = 'global' | 'per_user' | 'per_org' | 'per_ip' | 'per_api_key';

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  staleTtl?: number;
  cacheableStatuses: number[];
  cacheKeyParts?: string[];
  bypassHeaders?: string[];
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  id: string;
  name: string;
  environment: 'development' | 'staging' | 'production';
  routes: Route[];
  globalMiddleware: string[];
  defaultAuth: AuthConfig;
  defaultRateLimit?: RateLimitConfig;
  defaultCache?: CacheConfig;
  errorHandling: ErrorHandlingConfig;
  analytics: AnalyticsConfig;
  monitoring: MonitoringConfig;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  includeStackTrace: boolean;
  includeRequestDetails: boolean;
  customErrors: Record<number, ErrorResponse>;
  fallbackResponse?: ErrorResponse;
}

/**
 * Error response
 */
export interface ErrorResponse {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  enabled: boolean;
  sampleRate: number;
  bufferSize: number;
  flushInterval: number;
  events: AnalyticsEvent[];
}

/**
 * Analytics event types
 */
export type AnalyticsEvent =
  | 'request'
  | 'response'
  | 'error'
  | 'auth'
  | 'rate_limit'
  | 'circuit_breaker'
  | 'cache'
  | 'custom';

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  metricsPort?: number;
  metricsPath?: string;
  healthCheckPath?: string;
  readinessCheckPath?: string;
}

/**
 * API version information
 */
export interface ApiVersion {
  version: string;
  path: string;
  status: 'active' | 'deprecated' | 'sunset' | 'retired';
  releasedAt: Date;
  deprecatedAt?: Date;
  sunsetAt?: Date;
  supportedUntil?: Date;
  migrationGuide?: string;
  changelog?: string;
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenMaxCalls: number;
  slidingWindowSize?: number;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  openedAt?: number;
  halfOpenCallCount: number;
}

/**
 * Transformer configuration
 */
export interface TransformerConfig {
  requestHeaders?: HeaderTransform[];
  responseHeaders?: HeaderTransform[];
  requestBody?: BodyTransform[];
  responseBody?: BodyTransform[];
  protocolTranslation?: ProtocolTranslation;
}

/**
 * Header transformation
 */
export interface HeaderTransform {
  action: 'add' | 'set' | 'remove' | 'rename';
  header: string;
  value?: string;
  condition?: TransformCondition;
}

/**
 * Body transformation
 */
export interface BodyTransform {
  type: 'json' | 'xml' | 'form';
  action: 'modify' | 'replace' | 'filter';
  operations: TransformOperation[];
  condition?: TransformCondition;
}

/**
 * Transform operation
 */
export interface TransformOperation {
  path: string;
  action: 'set' | 'remove' | 'rename' | 'move';
  value?: unknown;
  fromPath?: string;
}

/**
 * Transform condition
 */
export interface TransformCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'exists';
  value?: unknown;
}

/**
 * Protocol translation
 */
export interface ProtocolTranslation {
  type: 'rest_to_graphql' | 'graphql_to_rest';
  schema?: string;
  queryMapping?: Record<string, string>;
}

/**
 * Gateway error
 */
export class GatewayError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

/**
 * Routing error
 */
export class RoutingError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super(500, 'ROUTING_ERROR', message, details);
    this.name = 'RoutingError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super(401, 'AUTHENTICATION_ERROR', message, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super(403, 'AUTHORIZATION_ERROR', message, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends GatewayError {
  constructor(
    message: string,
    public retryAfter?: number,
    details?: unknown
  ) {
    super(429, 'RATE_LIMIT_ERROR', message, details);
    this.name = 'RateLimitError';
  }
}

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends GatewayError {
  constructor(message: string, public state: CircuitState, details?: unknown) {
    super(503, 'CIRCUIT_BREAKER_ERROR', message, details);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends GatewayError {
  constructor(message: string, public fields: Record<string, string>) {
    super(400, 'VALIDATION_ERROR', message, { fields });
    this.name = 'ValidationError';
  }
}
