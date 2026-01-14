/**
 * Edge Functions Package
 *
 * A comprehensive edge functions framework for the ClaudeFlare distributed
 * AI coding platform.
 *
 * @example
 * ```typescript
 * import { FunctionRuntime, CacheLayer, DeploymentManager } from '@claudeflare/edge-functions';
 *
 * // Create runtime
 * const runtime = new FunctionRuntime();
 *
 * // Register function
 * runtime.registerFunction({
 *   id: 'hello',
 *   name: 'Hello World',
 *   handler: async (input) => `Hello, ${input.name}!`,
 *   config: { timeout: 5000 },
 *   version: '1.0.0',
 * });
 *
 * // Execute function
 * const response = await runtime.execute({
 *   id: 'req-1',
 *   functionId: 'hello',
 *   input: { name: 'World' },
 *   timestamp: Date.now(),
 * }, context);
 * ```
 */

// ============================================================================
// Core Exports
// ============================================================================

export * from './types/index.js';

// Runtime
export {
  FunctionRuntime,
  RuntimeError,
  TimeoutError,
  MemoryLimitError,
  FunctionNotFoundError,
  ExecutionError,
  createRuntime,
  measureExecutionTime,
  createTimeout,
  executeWithRetry,
  withTimeout,
  type RuntimeConfig,
  type RuntimeStatus,
} from './runtime/runtime.js';

// Deployment
export {
  DeploymentManager,
  DeploymentError,
  ValidationError,
  DeploymentFailedError,
  RollbackError,
  createDeploymentManager,
  createDeploymentConfig,
  createHealthCheckConfig,
  type DeploymentManagerConfig,
  type HealthCheckConfig,
  type DeploymentHooks,
} from './deployment/manager.js';

// Orchestration
export {
  OrchestrationEngine,
  OrchestrationError,
  WorkflowNotFoundError,
  StepExecutionError,
  WorkflowTimeoutError,
  StepTimeoutError,
  createOrchestrationEngine,
  createWorkflow,
  createWorkflowStep,
  sequentialStep,
  parallelStep,
  chainSteps,
  parallelSteps,
  conditionalStep,
  type OrchestrationConfig,
  type OrchestrationHooks,
} from './orchestration/engine.js';

// Cache
export {
  CacheLayer,
  CacheError,
  EntryTooLargeError,
  CacheFullError,
  createCacheLayer,
  createCacheConfig,
  withCache,
  cached,
  type CacheLayerConfig,
  type CacheStorage,
} from './cache/layer.js';

// Middleware
export {
  MiddlewareChain,
  loggingMiddleware,
  timingMiddleware,
  authenticationMiddleware,
  rateLimitMiddleware,
  corsMiddleware,
  errorHandlingMiddleware,
  compressionMiddleware,
  cacheControlMiddleware,
  securityHeadersMiddleware,
  createMiddlewareChain,
  createMiddleware,
  combineMiddleware,
  applyToFunctions,
  type MiddlewareContext,
} from './middleware/middleware.js';

// Utilities
export {
  createEdgeFunction,
  createEdgeFunctions,
  createEdgeRequest,
  generateId,
  generateUUID,
  generateSlug,
  simpleHash,
  generateHash,
  sleep,
  measureTime,
  timeout,
  withTimeout,
  retry,
  batchProcess,
  parallelProcess,
  validateRequired,
  validateFunctionConfig,
  wrapError,
  isErrorType,
  getErrorMessage,
  deepClone,
  deepMerge,
  isObject,
  pick,
  omit,
  truncate,
  toTitleCase,
  capitalize,
  chunk,
  shuffle,
  unique,
  groupBy,
  createPerformanceTracker,
  isDevelopment,
  isProduction,
  isTest,
  getEnv,
  getRequiredEnv,
} from './utils/helpers.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';

// ============================================================================
// Default Exports
// ============================================================================

export default {
  FunctionRuntime,
  CacheLayer,
  DeploymentManager,
  OrchestrationEngine,
  MiddlewareChain,
  VERSION,
};
