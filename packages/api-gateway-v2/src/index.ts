/**
 * API Gateway v2 - Main Exports
 * Next-generation API gateway with GraphQL federation, subscriptions, and advanced composition
 */

// Core Gateway
export {
  APIGatewayV2,
  GatewayStats,
  createAPIGateway,
  createDefaultAPIGateway,
} from './gateway';

// GraphQL
export {
  FederationGateway,
  createFederatedService,
  validateFederationConfig,
  extractEntities,
} from './graphql/federation';

export {
  SubscriptionManager,
  SubscriptionServer,
  EventHandler,
  SubscriptionStats,
  createSubscriptionEvent,
  validateSubscriptionConfig,
} from './graphql/subscriptions';

// Composition
export {
  APIComposer,
  createStep,
  validateCompositionConfig,
} from './composition/composer';

// Aggregation
export {
  ResponseAggregator,
  ConflictResolver,
  createMergePolicy,
  createConflictResolution,
  createDeduplicationConfig,
  validateAggregationConfig,
  createDefaultAggregationConfig,
} from './aggregation/aggregator';

// Orchestration
export {
  OrchestrationEngine,
  createOrchestrationStep,
} from './orchestration/engine';

// Rate Limiting
export {
  RateLimiter,
  createRateLimitMiddleware,
  validateRateLimitConfig,
  createDefaultRateLimitConfig,
} from './rate-limit/rate-limiter';

// Versioning
export {
  VersionManager,
  VersionTransformer,
  createVersioningMiddleware,
  validateVersioningConfig,
  createDefaultVersioningConfig,
  createVersionDefinition,
} from './versioning/version-manager';

// Middleware
export {
  Pipeline,
  createLoggingMiddleware,
  createAuthenticationMiddleware,
  createCORSMiddleware,
  createRequestIdMiddleware,
  createTimeoutMiddleware,
  createCompressionMiddleware,
  createMetricsMiddleware,
  createMiddlewareContext,
  RequestMetrics,
} from './middleware/pipeline';

// Configuration
export {
  ConfigManager,
  buildGatewayConfig,
  buildGraphQLConfig,
  buildSubscriptionConfig,
  buildCompositionConfig,
  loadConfigFromEnv,
  loadConfigFromFile,
} from './config/manager';

// Types
export {
  GatewayConfig,
  ServiceConfig,
  HealthCheckConfig,
  RetryPolicy,
  AuthConfig,
  GraphQLConfig,
  FederationConfig,
  QueryPlanCacheConfig,
  ValidationConfig,
  FederatedService,
  EntityDefinition,
  FieldDefinition,
  ArgumentDefinition,
  FederationContext,
  QueryPlan,
  QueryOperation,
  SubscriptionConfig,
  RedisConfig,
  SubscriptionConnection,
  Subscription,
  SubscriptionFilter,
  SubscriptionContext,
  SubscriptionEvent,
  SubscriptionMessage,
  CompositionConfig,
  CompositionPlan,
  CompositionStep,
  CompositionContext,
  CompositionResult,
  CompositionMetadata,
  StepResult,
  AggregationConfig,
  MergePolicy,
  ConflictResolution,
  ConflictPolicy,
  DeduplicationConfig,
  AggregationResult,
  AggregationMetadata,
  Conflict,
  DuplicateInfo,
  RateLimitConfig,
  RateLimitRule,
  RateLimitStorage,
  RateLimitState,
  RateLimitResult,
  VersioningConfig,
  VersionDefinition,
  VersionTransformation,
  VersionedRequest,
  VersionedResponse,
  MiddlewareContext,
  RequestMetadata,
  MiddlewareFunction,
  MiddlewarePipeline,
  CacheConfig,
  CacheStorage,
  CacheEntry,
  CacheMetadata,
  CacheResult,
  GatewayDurableObjectState,
  GatewayState,
  ServiceState,
  GatewayMetrics,
  GatewayError,
  FederationError,
  CompositionError,
  RateLimitError,
  ValidationError,
  DeepPartial,
  MaybePromise,
  ServiceRegistry,
  SchemaRegistry,
  RequestHandler,
  GraphQLResolver,
  OrchestrationPlan,
  OrchestrationStep,
  OrchestrationContext,
  OrchestrationResult,
} from './types';

// Utilities
export {
  buildURL,
  parseQueryParams,
  safeJSONParse,
  safeJSONStringify,
  sleep,
  retry,
  parallel,
  timeout,
  isValidEmail,
  isValidURL,
  isValidUUID,
  deepClone,
  deepMerge,
  getNestedValue,
  setNestedValue,
  deleteNestedValue,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  capitalize,
  randomString,
  createError,
  isGatewayError,
  getErrorMessage,
  now,
  msToSec,
  secToMs,
  formatDuration,
  clamp,
  lerp,
  mapRange,
  chunk,
  groupBy,
  unique,
  shuffle,
} from './utils/helpers';
