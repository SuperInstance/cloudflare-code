/**
 * Core Platform Types
 *
 * Fundamental type definitions for the ClaudeFlare platform integration layer.
 * These types provide the foundation for service registry, dependency injection,
 * composition, and orchestration.
 */

/**
 * Unique identifier for services, components, and resources
 */
export type ResourceId = string;

/**
 * Service type enumeration
 */
export enum ServiceType {
  // AI Services
  AI_PROVIDER = 'ai_provider',
  AGENT_ORCHESTRATOR = 'agent_orchestrator',
  SEMANTIC_CACHE = 'semantic_cache',
  RAG_INDEXER = 'rag_indexer',
  EMBEDDINGS = 'embeddings',

  // Developer Tools
  CLI = 'cli',
  VS_CODE_EXTENSION = 'vscode_extension',
  DASHBOARD = 'dashboard',
  DEVELOPER_PORTAL = 'developer_portal',

  // Infrastructure
  STORAGE_KV = 'storage_kv',
  STORAGE_R2 = 'storage_r2',
  STORAGE_D1 = 'storage_d1',
  DURABLE_OBJECTS = 'durable_objects',
  CACHE = 'cache',
  LOAD_BALANCER = 'load_balancer',
  MONITORING = 'monitoring',

  // Security
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  ENCRYPTION = 'encryption',
  AUDIT_LOGGING = 'audit_logging',

  // Platform
  SERVICE_REGISTRY = 'service_registry',
  EVENT_BUS = 'event_bus',
  STATE_MANAGER = 'state_manager',
  DI_CONTAINER = 'di_container',
  CONFIG_MANAGER = 'config_manager',
}

/**
 * Service health status
 */
export enum ServiceHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  STARTING = 'starting',
  STOPPING = 'stopping',
  UNKNOWN = 'unknown',
}

/**
 * Service lifecycle states
 */
export enum ServiceLifecycle {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  STARTED = 'started',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed',
  FAILED = 'failed',
}

/**
 * Service priority for startup and shutdown ordering
 */
export enum ServicePriority {
  CRITICAL = 0,      // Must start first, stop last
  HIGH = 1,          // Start early, stop late
  NORMAL = 2,        // Normal ordering
  LOW = 3,           // Start late, stop early
  DEFERRED = 4,      // Start when needed, stop first
}

/**
 * Service metadata
 */
export interface ServiceMetadata {
  readonly id: ResourceId;
  readonly name: string;
  readonly type: ServiceType;
  readonly version: string;
  readonly priority: ServicePriority;
  readonly dependencies: readonly ResourceId[];
  readonly tags: ReadonlySet<string>;
  readonly created: number;
  readonly updated: number;
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  readonly id: ResourceId;
  readonly type: ServiceType;
  readonly enabled: boolean;
  readonly config: Record<string, unknown>;
  readonly environment: 'development' | 'staging' | 'production';
}

/**
 * Service health check result
 */
export interface HealthCheckResult {
  readonly serviceId: ResourceId;
  readonly status: ServiceHealth;
  readonly message?: string;
  readonly checks: ReadonlyArray<{
    readonly name: string;
    readonly status: 'pass' | 'fail' | 'warn';
    readonly message?: string;
    readonly duration?: number;
  }>;
  readonly timestamp: number;
}

/**
 * Service instance with lifecycle
 */
export interface ServiceInstance<T = unknown> {
  readonly metadata: ServiceMetadata;
  readonly lifecycle: ServiceLifecycle;
  readonly health: HealthCheckResult;

  // Lifecycle methods
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;

  // Health check
  checkHealth(): Promise<HealthCheckResult>;

  // Service instance
  readonly instance: T;
}

/**
 * Service registration options
 */
export interface ServiceRegistrationOptions {
  readonly singleton?: boolean;
  readonly lazy?: boolean;
  readonly priority?: ServicePriority;
  readonly dependencies?: readonly ResourceId[];
  readonly tags?: readonly string[];
  readonly healthCheck?: {
    readonly interval: number;
    readonly timeout: number;
    readonly retries: number;
  };
}

/**
 * Service dependency descriptor
 */
export interface ServiceDependency {
  readonly serviceId: ResourceId;
  readonly required: boolean;
  readonly version?: string;
  readonly lazy?: boolean;
}

/**
 * Platform environment configuration
 */
export interface PlatformEnvironment {
  readonly name: string;
  readonly mode: 'development' | 'staging' | 'production';
  readonly region?: string;
  readonly debug: boolean;
  readonly tracing: boolean;
  readonly metrics: boolean;
}

/**
 * Platform capabilities
 */
export interface PlatformCapabilities {
  readonly durableObjects: boolean;
  readonly kvStorage: boolean;
  readonly r2Storage: boolean;
  readonly d1Database: boolean;
  readonly queues: boolean;
  readonly cronTriggers: boolean;
  readonly analytics: boolean;
}

/**
 * Platform context passed to all services
 */
export interface PlatformContext {
  readonly environment: PlatformEnvironment;
  readonly capabilities: PlatformCapabilities;
  readonly config: PlatformConfig;
  readonly serviceRegistry: ServiceRegistry;
  readonly eventBus: EventBus;
  readonly stateManager: StateManager;
  readonly diContainer: DIContainer;
}

/**
 * Platform configuration
 */
export interface PlatformConfig {
  readonly services: readonly ServiceConfig[];
  readonly features: Record<string, boolean>;
  readonly limits: {
    readonly maxConcurrentRequests: number;
    readonly maxServiceInstances: number;
    readonly cacheSize: number;
    readonly timeout: number;
  };
  readonly monitoring: {
    readonly enabled: boolean;
    readonly sampleRate: number;
    readonly exportInterval: number;
  };
}

/**
 * Service registry interface
 */
export interface ServiceRegistry {
  readonly services: ReadonlyMap<ResourceId, ServiceInstance>;
  readonly servicesByType: ReadonlyMap<ServiceType, ReadonlyArray<ServiceInstance>>;

  register<T>(
    id: ResourceId,
    factory: () => T | Promise<T>,
    options: ServiceRegistrationOptions
  ): Promise<void>;

  unregister(id: ResourceId): Promise<void>;

  get<T>(id: ResourceId): Promise<T | undefined>;

  getByType<T>(type: ServiceType): Promise<ReadonlyArray<T>>;

  getByTag<T>(tag: string): Promise<ReadonlyArray<T>>;

  checkHealth(id: ResourceId): Promise<HealthCheckResult>;

  checkAllHealth(): Promise<ReadonlyArray<HealthCheckResult>>;

  on(event: ServiceRegistryEvent, handler: (...args: unknown[]) => void): void;
  off(event: ServiceRegistryEvent, handler: (...args: unknown[]) => void): void;
}

/**
 * Service registry events
 */
export type ServiceRegistryEvent =
  | 'service:registered'
  | 'service:unregistered'
  | 'service:initialized'
  | 'service:started'
  | 'service:stopped'
  | 'service:failed'
  | 'health:changed';

/**
 * Event bus interface
 */
export interface EventBus {
  publish<T = unknown>(event: string, data: T): Promise<void>;
  subscribe<T = unknown>(
    event: string,
    handler: (data: T) => void | Promise<void>
  ): () => void;
  unsubscribe(event: string, handler: (...args: unknown[]) => void): void;

  // Request/response pattern
  request<TRequest = unknown, TResponse = unknown>(
    method: string,
    data: TRequest,
    timeout?: number
  ): Promise<TResponse>;

  respond<TRequest = unknown, TResponse = unknown>(
    method: string,
    handler: (data: TRequest) => TResponse | Promise<TResponse>
  ): () => void;
}

/**
 * State manager interface
 */
export interface StateManager {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;

  // Scoped state
  getScope(scope: string): StateScope;

  // Transactions
  transaction<T>(callback: (state: StateManager) => Promise<T>): Promise<T>;

  // Events
  on(event: 'change' | 'delete', handler: (key: string, value: unknown) => void): void;
  off(event: 'change' | 'delete', handler: (...args: unknown[]) => void): void;
}

/**
 * State scope for isolated state management
 */
export interface StateScope {
  readonly namespace: string;
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

/**
 * Dependency injection container interface
 */
export interface DIContainer {
  register<T>(
    token: string | symbol,
    factory: DIFactory<T>,
    options?: DIRegistrationOptions
  ): void;

  resolve<T>(token: string | symbol): Promise<T>;

  has(token: string | symbol): boolean;

  createScope(): DIScope;

  dispose(): Promise<void>;
}

/**
 * DI factory function
 */
export type DIFactory<T> = (
  container: DIContainer
) => T | Promise<T>;

/**
 * DI registration options
 */
export interface DIRegistrationOptions {
  readonly singleton?: boolean;
  readonly scoped?: boolean;
  readonly transient?: boolean;
  readonly lifecycle?: 'singleton' | 'scoped' | 'transient';
}

/**
 * DI scope for scoped dependencies
 */
export interface DIScope {
  resolve<T>(token: string | symbol): Promise<T>;
  dispose(): Promise<void>;
}

/**
 * Service composition result
 */
export interface ComposedService<T = unknown> {
  readonly service: T;
  readonly dependencies: ReadonlyArray<ResourceId>;
  readonly dispose: () => Promise<void>;
}

/**
 * Orchestration plan
 */
export interface OrchestrationPlan {
  readonly steps: ReadonlyArray<OrchestrationStep>;
  readonly parallel: boolean;
  readonly retryPolicy: RetryPolicy;
}

/**
 * Orchestration step
 */
export interface OrchestrationStep {
  readonly serviceId: ResourceId;
  readonly method: string;
  readonly params: unknown[];
  readonly dependencies: ReadonlyArray<ResourceId>;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly initialDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
  readonly retryableErrors: ReadonlyArray<string>;
}

/**
 * Composition result
 */
export interface CompositionResult<T = unknown> {
  readonly success: boolean;
  readonly result?: T;
  readonly error?: Error;
  readonly duration: number;
  readonly steps: ReadonlyArray<CompositionStep>;
}

/**
 * Composition step result
 */
export interface CompositionStep {
  readonly serviceId: ResourceId;
  readonly method: string;
  readonly success: boolean;
  readonly duration: number;
  readonly error?: Error;
}
