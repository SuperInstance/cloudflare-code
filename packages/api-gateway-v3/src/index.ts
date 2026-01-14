/**
 * API Gateway v3 - Main Export Module
 *
 * Next-Generation API Gateway with:
 * - API Composition
 * - Streaming Support
 * - Edge Optimization
 * - Real-time Analytics
 * - Service Orchestration
 * - GraphQL Federation
 * - Version Management
 * - Sub-millisecond latency
 */

// ============================================================================
// Core Gateway
// ============================================================================

export { APIGateway, createGateway, initializeGateway } from './gateway.js';

// ============================================================================
// Types
// ============================================================================

export {
  // Core Types
  GatewayRequest,
  GatewayResponse,
  GatewayConfig,
  RequestContext,
  AuthContext,
  RateLimitContext,
  CacheContext,
  EdgeContext,
  RequestMetadata,
  ResponseMetadata,

  // Service Types
  ServiceDefinition,
  ServiceRegistry,
  HealthCheckConfig,
  RetryPolicy,
  CircuitBreakerConfig,
  CachePolicy,
  RateLimitPolicy,
  ServiceAuth,
  ServiceMetadata,

  // Composition Types
  CompositionRequest,
  CompositionResult,
  CompositionOperation,
  MergeStrategy,
  ErrorPolicy,
  CompositionError,
  CompositionMetadata,
  OperationMetadata,

  // Streaming Types
  StreamConfig,
  SSEMessage,
  WebSocketMessage,
  StreamSession,

  // Edge Types
  EdgeFunction,
  EdgeFunctionConfig,
  EdgeCacheConfig,
  CacheKeyConfig,

  // Analytics Types
  AnalyticsEvent,
  AnalyticsMetric,
  AnalyticsDashboard,
  DashboardWidget,
  AnalyticsQuery,
  EventType,
  WidgetType,
  AggregationType,
  QueryFilter,
  TimeRange,

  // Orchestration Types
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStep,
  ExecutionStatus,
  StepExecution,

  // GraphQL Types
  GraphQLRequest,
  GraphQLResponse,
  GraphQLError,
  GraphQLSchemaConfig,
  FederatedSubgraph,
  FederationGatewayConfig,

  // Versioning Types
  VersionConfig,
  VersionStrategy,
  VersionDefinition,
  VersionTransform,
  VersionRouting,
  CanaryConfig,
  RoutingCriteria,

  // Middleware Types
  MiddlewareContext,
  MiddlewareFunction,
  MiddlewareConfig,

  // Error Types
  GatewayError,
  ServiceUnavailableError,
  TimeoutError,
  CircuitBreakerOpenError,
  RateLimitExceededError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,

  // Validation Schemas
  ServiceDefinitionSchema,
  CompositionOperationSchema,
  GatewayConfigSchema,
} from './types/index.js';

// ============================================================================
// Composition Engine
// ============================================================================

export {
  CompositionEngine,
  ServiceRegistry as CompositionServiceRegistry,
  DataMerger,
  ExecutionPlanner,
  DependencyResolver,
  ResultAggregator,
} from './composition/engine.js';

// ============================================================================
// Streaming Gateway
// ============================================================================

export {
  SSEGateway,
  WebSocketGateway,
  StreamRouter,
  StreamProcessor,
  StreamManager,
} from './streaming/gateway.js';

export type {
  StreamGatewayConfig,
  SSEConnection,
  WebSocketConnection,
  StreamRoute,
  StreamTransform,
  StreamFallback,
} from './streaming/gateway.js';

// ============================================================================
// Edge Optimizer
// ============================================================================

export {
  EdgeOptimizer,
  EdgeFunctionRuntime,
  EdgeCacheManager,
} from './edge/optimizer.js';

export type {
  EdgeOptimizerConfig,
  EdgeRoutingConfig,
  RegionInfo,
  EdgeRequestContext,
  EdgeCacheEntry,
  CacheMetadata,
  EdgeMetrics,
  OptimizedRequest,
  CacheOptions,
} from './edge/optimizer.js';

// ============================================================================
// Analytics Engine
// ============================================================================

export {
  AnalyticsEngine,
  QueryBuilder,
  DashboardBuilder,
  WidgetBuilder,
  AnalyticsStream,
  AnalyticsReporter,
} from './analytics/engine.js';

export type {
  AnalyticsEngineConfig,
  MetricSummary,
  TimeSeries,
  TimeSeriesDataPoint,
  AnalyticsReport,
  ReportSchedule,
} from './analytics/engine.js';

// ============================================================================
// Orchestration Gateway
// ============================================================================

export {
  OrchestrationGateway,
} from './orchestration/gateway.js';

export type {
  OrchestrationConfig,
  WorkflowContext,
  OrchestrationMetrics,
} from './orchestration/gateway.js';

// ============================================================================
// Version Management
// ============================================================================

export { VersionManager } from './versioning/manager.js';

export type {
  VersionResolver,
  VersionTransformer,
  VersionRouter,
} from './versioning/manager.js';

// ============================================================================
// GraphQL Gateway
// ============================================================================

export { GraphQLGateway } from './graphql/gateway.js';

export type {
  GraphQLGatewayConfig,
  GraphQLContext,
  GraphQLExecutionResult,
} from './graphql/gateway.js';

// ============================================================================
// Middleware
// ============================================================================

export { MiddlewarePipeline } from './middleware/pipeline.js';

export type {
  MiddlewareHandler,
  MiddlewareChain,
} from './middleware/pipeline.js';

// ============================================================================
// Rate Limiter
// ============================================================================

export { RateLimiter } from './rate-limiter/limiter.js';

export type {
  RateLimitConfig,
  RateLimitResult,
  TokenBucket,
  LeakyBucket,
  FixedWindow,
} from './rate-limiter/limiter.js';

// ============================================================================
// Circuit Breaker
// ============================================================================

export { CircuitBreaker } from './circuit-breaker/breaker.js';

export type {
  CircuitBreakerState,
  CircuitBreakerConfig as CircuitBreakerConfigType,
  CircuitBreakerStats,
} from './circuit-breaker/breaker.js';

// ============================================================================
// Cache Manager
// ============================================================================

export { CacheManager } from './cache/manager.js';

export type {
  CacheConfig,
  CacheEntry,
  CacheStats,
} from './cache/manager.js';

// ============================================================================
// Utilities
// ============================================================================

export { Logger } from './utils/logger.js';

export { MetricsCollector } from './utils/metrics.js';

export { ConfigValidator } from './utils/validator.js';

// ============================================================================
// Constants
// ============================================================================

export const VERSION = '3.0.0';
export const DEFAULT_TIMEOUT = 30000;
export const MAX_REQUEST_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_RESPONSE_SIZE = 100 * 1024 * 1024; // 100MB
export const DEFAULT_CACHE_TTL = 3600000; // 1 hour
export const DEFAULT_RATE_LIMIT = 1000; // requests per window
export const DEFAULT_RATE_WINDOW = 60000; // 1 minute
export const DEFAULT_CIRCUIT_THRESHOLD = 0.5; // 50% failure rate
export const DEFAULT_CIRCUIT_RESET = 60000; // 1 minute

// ============================================================================
// Error Factory
// ============================================================================

export class Errors {
  static serviceUnavailable(serviceId: string, details?: unknown) {
    return new ServiceUnavailableError(serviceId, details);
  }

  static timeout(operation: string, timeout: number) {
    return new TimeoutError(operation, timeout);
  }

  static circuitBreakerOpen(serviceId: string) {
    return new CircuitBreakerOpenError(serviceId);
  }

  static rateLimitExceeded(limit: number, reset: number) {
    return new RateLimitExceededError(limit, reset);
  }

  static validation(message: string, details?: unknown) {
    return new ValidationError(message, details);
  }

  static authentication(message?: string) {
    return new AuthenticationError(message);
  }

  static authorization(message?: string) {
    return new AuthorizationError(message);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function parseContentType(header: string | null): {
  type: string;
  charset?: string;
} {
  if (!header) {
    return { type: 'application/json' };
  }

  const [type, ...params] = header.split(';');
  const charset = params.find((p) => p.trim().startsWith('charset='));

  return {
    type: type.trim(),
    charset: charset?.split('=')[1],
  };
}

export function parseAccept(header: string | null): string[] {
  if (!header) {
    return ['*/*'];
  }

  return header
    .split(',')
    .map((h) => h.trim().split(';')[0])
    .sort((a, b) => {
      // Sort by q value if present
      const qA = parseFloat(a.match(/q=([\d.]+)/)?.[1] || '1');
      const qB = parseFloat(b.match(/q=([\d.]+)/)?.[1] || '1');
      return qB - qA;
    });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function isRetryableStatus(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

export function isCacheableMethod(method: string): boolean {
  return ['GET', 'HEAD'].includes(method.toUpperCase());
}

export function isCacheableStatus(status: number): boolean {
  return status === 200 || status === 203 || status === 204 || status === 206 || status === 300 || status === 301 || status === 404 || status === 405 || status === 410 || status === 414 || status === 501;
}

export function isSafeMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

export function isIdempotentMethod(method: string): boolean {
  return ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'].includes(method.toUpperCase());
}

export function sanitizeHeaders(headers: Headers): Headers {
  const sanitized = new Headers();

  for (const [key, value] of headers.entries()) {
    // Filter out hop-by-hop headers
    if (!['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'].includes(key.toLowerCase())) {
      sanitized.set(key, value);
    }
  }

  return sanitized;
}

export function mergeHeaders(...headers: Headers[]): Headers {
  const merged = new Headers();

  for (const h of headers) {
    for (const [key, value] of h.entries()) {
      merged.set(key, value);
    }
  }

  return merged;
}

export function cloneHeaders(headers: Headers): Headers {
  return new Headers(headers);
}

export function parseCacheControl(header: string | null): {
  maxAge?: number;
  sMaxAge?: number;
  noCache?: boolean;
  noStore?: boolean;
  private?: boolean;
  public?: boolean;
  mustRevalidate?: boolean;
} {
  const result: Record<string, boolean | number> = {};

  if (!header) {
    return result as any;
  }

  const directives = header.split(',').map((d) => d.trim());

  for (const directive of directives) {
    if (directive === 'no-cache') {
      result.noCache = true;
    } else if (directive === 'no-store') {
      result.noStore = true;
    } else if (directive === 'private') {
      result.private = true;
    } else if (directive === 'public') {
      result.public = true;
    } else if (directive === 'must-revalidate') {
      result.mustRevalidate = true;
    } else if (directive.startsWith('max-age=')) {
      result.maxAge = parseInt(directive.split('=')[1], 10);
    } else if (directive.startsWith('s-maxage=')) {
      result.sMaxAge = parseInt(directive.split('=')[1], 10);
    }
  }

  return result as any;
}

/**
 * Create a default gateway configuration
 */
export function createDefaultConfig(): Partial<GatewayConfig> {
  return {
    id: 'gateway-default',
    name: 'API Gateway v3',
    environment: 'development',
    services: [],
    routes: [],
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
        healthCheck: true,
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
      playground: false,
      introspection: true,
      federation: false,
    },
  };
}

// ============================================================================
// Re-export for convenience
// ============================================================================

export * from './types/index.js';
