/**
 * ClaudeFlare Platform
 *
 * Unified platform integration layer for service composition,
 * orchestration, dependency injection, and lifecycle management.
 *
 * @package @claudeflare/platform
 */

// Core types
export * from './types';

// Services
export * from './services';

// Dependency injection
export * from './di';

// Composition
export * from './composition';

// State management
export * from './state';

// Events
export * from './events';

// Configuration
export * from './config';

// Bootstrap
export * from './bootstrap';

// Lifecycle
export * from './lifecycle';

// Utilities
export * from './utils';

/**
 * Platform version
 */
export const VERSION = '0.1.0';

/**
 * Create a new platform instance
 */
export { Platform, bootstrapPlatform, getPlatform, shutdownPlatform } from './bootstrap/platform';

/**
 * Service discovery
 */
export { serviceDiscovery, ServiceDiscovery, PACKAGE_SERVICES } from './services/discovery';

/**
 * DI Container
 */
export { DIContainer, DIScopeImpl, DIModuleBuilder } from './di/container';

/**
 * DI Tokens
 */
export {
  CORE_TOKENS,
  AI_TOKENS,
  STORAGE_TOKENS,
  CACHE_TOKENS,
  SECURITY_TOKENS,
  MONITORING_TOKENS,
  DEV_TOOL_TOKENS,
  ALL_TOKENS,
  TokenUtils,
  InjectionToken,
} from './di/tokens';

/**
 * DI Decorators
 */
export {
  Injectable,
  Inject,
  Optional,
  Self,
  Scoped,
  Transient,
  Singleton,
  Service,
  InjectProperty,
  DecoratorUtils,
  injectClass,
} from './di/decorators';

/**
 * Service registry
 */
export {
  ServiceRegistryDurableObject,
  ServiceRegistryClient,
} from './services/registry';

/**
 * Health monitoring
 */
export {
  HealthMonitor,
  healthChecks,
  healthMonitor,
} from './services/health';

/**
 * Service orchestration
 */
export {
  ServiceOrchestrator,
  CompositionBuilder,
  OrchestrationPlanBuilder,
  DEFAULT_RETRY_POLICY,
} from './composition/orchestrator';

/**
 * Service pipeline
 */
export {
  ServicePipeline,
  PipelineBuilder,
  PipelineSteps,
  PipelineMiddleware,
} from './composition/pipeline';

/**
 * State management
 */
export {
  StateManager,
  DistributedStateManager,
  StateScopeImpl,
} from './state/manager';

/**
 * State storage
 */
export {
  MemoryStateStore,
  DurableObjectStateStore,
  KVStateStore,
  StateStoreFactory,
} from './state/store';

/**
 * Event bus integration
 */
export {
  PlatformEventBus,
  EventBusAggregator,
  EventReplayBuffer,
  EventMiddleware,
} from './events/integration';

/**
 * Event emitters
 */
export {
  ServiceEventEmitter,
  StateEventEmitter,
  AIEventEmitter,
  AgentEventEmitter,
  StorageEventEmitter,
  CacheEventEmitter,
  SecurityEventEmitter,
  PlatformEventEmitter,
  ConfigEventEmitter,
  EventEmitterFactory,
  EventTypes,
} from './events/emitters';

/**
 * Configuration management
 */
export {
  ConfigManager,
  EnvironmentConfigLoader,
  FileConfigLoader,
  RemoteConfigLoader,
  DefaultConfigLoader,
} from './config/manager';

/**
 * Configuration schemas
 */
export {
  ConfigSchemas,
  DefaultConfig,
  getSchema,
  getDefault,
  validateConfig,
} from './config/schema';

/**
 * Lifecycle management
 */
export {
  LifecycleManager,
  LifecyclePhase,
  LifecycleHooksBuilder,
  CommonLifecycleHooks,
} from './lifecycle/manager';

/**
 * Utilities
 */
export {
  delay,
  timeout,
  retry,
  parallel,
  batch,
  debounce,
  throttle,
  deepClone,
  deepMerge,
  generateId,
  parseDuration,
  formatBytes,
  formatDuration,
  CircularBuffer,
  RateLimiter,
} from './utils/helpers';

/**
 * Initialize the platform with default configuration
 *
 * @example
 * ```typescript
 * import { bootstrapPlatform } from '@claudeflare/platform';
 *
 * const platform = await bootstrapPlatform({
 *   environment: {
 *     mode: 'production',
 *     debug: false,
 *   },
 *   autoStart: true,
 * });
 *
 * console.log('Platform started:', platform.started);
 * ```
 */
export async function initialize(
  options?: import('./bootstrap/platform').PlatformBootstrapOptions
): Promise<import('./bootstrap/platform').PlatformBootstrapResult> {
  const { bootstrapPlatform } = await import('./bootstrap/platform');
  return bootstrapPlatform(options);
}

/**
 * Quick start for development
 *
 * @example
 * ```typescript
 * import { quickStart } from '@claudeflare/platform';
 *
 * const platform = await quickStart();
 * ```
 */
export async function quickStart(): Promise<import('./bootstrap/platform').PlatformBootstrapResult> {
  return initialize({
    environment: {
      mode: 'development',
      debug: true,
    },
    autoStart: true,
    enableDiscovery: true,
  });
}

/**
 * Get the platform instance
 */
export async function getInstance(): Promise<import('./bootstrap/platform').Platform> {
  const { getPlatform } = await import('./bootstrap/platform');
  return getPlatform();
}

/**
 * Shutdown the platform
 */
export async function shutdown(reason = 'manual'): Promise<void> {
  const { shutdownPlatform } = await import('./bootstrap/platform');
  return shutdownPlatform(reason);
}
