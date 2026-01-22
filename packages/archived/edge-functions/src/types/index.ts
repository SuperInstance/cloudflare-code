/**
 * Core type definitions for the Edge Functions framework
 */

import { ExecutionContext } from '@cloudflare/workers-types';

// ============================================================================
// Core Function Types
// ============================================================================

/**
 * Represents an edge function that can be executed at the edge
 */
export interface EdgeFunction<TInput = unknown, TOutput = unknown> {
  /**
   * Unique identifier for the function
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Function description
   */
  description?: string;

  /**
   * The actual function to execute
   */
  handler: FunctionHandler<TInput, TOutput>;

  /**
   * Function configuration
   */
  config: FunctionConfig;

  /**
   * Function metadata
   */
  metadata?: FunctionMetadata;

  /**
   * Function version
   */
  version: string;
}

/**
 * Function handler type
 */
export type FunctionHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: ExecutionContext & { env: EdgeEnv }
) => Promise<TOutput> | TOutput;

/**
 * Function configuration
 */
export interface FunctionConfig {
  /**
   * Maximum execution time in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Maximum memory usage in MB
   * @default 128
   */
  memoryLimit?: number;

  /**
   * Enable caching for this function
   */
  cache?: CacheConfig;

  /**
   * Rate limiting configuration
   */
  rateLimit?: RateLimitConfig;

  /**
   * Retry configuration
   */
  retry?: RetryConfig;

  /**
   * Enable tracing
   */
  tracing?: boolean;

  /**
   * Required environment variables
   */
  requiredEnvVars?: string[];

  /**
   * Required secrets
   */
  requiredSecrets?: string[];
}

/**
 * Function metadata
 */
export interface FunctionMetadata {
  /**
   * Function author
   */
  author?: string;

  /**
   Creation timestamp
   */
  createdAt?: number;

  /**
   * Last updated timestamp
   */
  updatedAt?: number;

  /**
   * Tags for categorization
   */
  tags?: string[];

  /**
   * Custom labels
   */
  labels?: Record<string, string>;

  /**
   * Dependencies on other functions
   */
  dependencies?: string[];

  /**
   * Documentation URL
   */
  docsUrl?: string;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Edge environment with bindings
 */
export interface EdgeEnv {
  /**
   * KV namespaces
   */
  KV: Record<string, KVNamespace>;

  /**
   * Durable Object namespaces
   */
  DURABLE: Record<string, DurableObjectNamespace>;

  /**
   * R2 buckets
   */
  R2: Record<string, R2Bucket>;

  /**
   * D1 databases
   */
  DB: Record<string, D1Database>;

  /**
   * Queue bindings
   */
  QUEUE: Record<string, Queue<any>>;

  /**
   * Environment variables
   */
  [key: string]: any;
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache configuration
 */
export interface CacheConfig {
  /**
   * Enable caching
   */
  enabled: boolean;

  /**
   * Cache TTL in seconds
   * @default 60
   */
  ttl?: number;

  /**
   * Cache key strategy
   */
  keyStrategy?: CacheKeyStrategy;

  /**
   * Stale while revalidate in seconds
   */
  staleWhileRevalidate?: number;

  /**
   * Cache variation by headers
   */
  varyBy?: string[];

  /**
   * Bypass cache for specific conditions
   */
  bypassCache?: (input: unknown) => boolean;
}

/**
 * Cache key generation strategy
 */
export type CacheKeyStrategy =
  | 'default' // Default: hash input + function ID
  | 'input-only' // Hash only the input
  | 'custom' // Use custom key function
  | 'header-based'; // Include request headers

/**
 * Cache entry
 */
export interface CacheEntry<T = unknown> {
  /**
   * Cached value
   */
  value: T;

  /**
   * Expiration timestamp
   */
  expiresAt: number;

  /**
   * Creation timestamp
   */
  createdAt: number;

  /**
   * Cache key
   */
  key: string;

  /**
   * Entry metadata
   */
  metadata?: {
    /**
     * Function ID
     */
    functionId: string;

    /**
     * Function version
     */
    version: string;

    /**
     * Hit count
     */
    hits: number;

    /**
     * Last accessed timestamp
     */
    lastAccessed: number;
  };
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /**
   * Total cache hits
   */
  hits: number;

  /**
   * Total cache misses
   */
  misses: number;

  /**
   * Cache size in bytes
   */
  size: number;

  /**
   * Number of entries
   */
  entries: number;

  /**
   * Hit rate (0-1)
   */
  hitRate: number;

  /**
   * Average latency in ms
   */
  avgLatency: number;
}

// ============================================================================
// Orchestration Types
// ============================================================================

/**
 * Workflow definition for function orchestration
 */
export interface Workflow {
  /**
   * Unique workflow identifier
   */
  id: string;

  /**
   * Workflow name
   */
  name: string;

  /**
   * Workflow description
   */
  description?: string;

  /**
   * Workflow steps
   */
  steps: WorkflowStep[];

  /**
   * Initial input data
   */
  initialData?: Record<string, unknown>;

  /**
   * Error handling strategy
   */
  onError?: ErrorHandlingStrategy;

  /**
   * Execution timeout in ms
   */
  timeout?: number;

  /**
   * Workflow metadata
   */
  metadata?: WorkflowMetadata;
}

/**
 * Workflow step
 */
export interface WorkflowStep {
  /**
   * Step identifier
   */
  id: string;

  /**
   * Step name
   */
  name: string;

  /**
   * Function to execute
   */
  functionId: string;

  /**
   * Step type
   */
  type: StepType;

  /**
   * Input mapping or static value
   */
  input?: StepInput;

  /**
   * Output mapping
   */
  output?: StepOutput;

  /**
   * Step configuration
   */
  config?: StepConfig;

  /**
   * Retry configuration
   */
  retry?: RetryConfig;

  /**
   * Timeout for this step
   */
  timeout?: number;

  /**
   * Continue on error
   */
  continueOnError?: boolean;

  /**
   * Conditional execution
   */
  condition?: string | ((context: WorkflowContext) => boolean);
}

/**
 * Step execution type
 */
export type StepType =
  | 'sequential' // Execute in sequence
  | 'parallel'; // Execute in parallel

/**
 * Step input definition
 */
export type StepInput =
  | string // Reference to previous step output: '$.steps.previousStep.output'
  | Record<string, string | unknown> // Map multiple inputs
  | ((context: WorkflowContext) => unknown); // Custom function

/**
 * Step output definition
 */
export type StepOutput =
  | string // Store output at path: '$.data.result'
  | ((output: unknown, context: WorkflowContext) => void); // Custom handler

/**
 * Step configuration
 */
export interface StepConfig {
  /**
   * Maximum parallel executions
   */
  maxParallel?: number;

  /**
   * Batch size for array inputs
   */
  batchSize?: number;

  /**
   * Continue on error
   */
  continueOnError?: boolean;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  /**
   * Workflow ID
   */
  workflowId: string;

  /**
   * Execution ID
   */
  executionId: string;

  /**
   * Initial input data
   */
  input: Record<string, unknown>;

  /**
   * Accumulated data from all steps
   */
  data: Record<string, unknown>;

  /**
   * Executed steps and their results
   */
  steps: Map<string, StepResult>;

  /**
   * Execution metadata
   */
  metadata: {
    /**
     * Start time
     */
    startTime: number;

    /**
     * Current time
     */
    currentTime: number;

    /**
     * Execution attempt
     */
    attempt: number;
  };

  /**
   * Execution environment
   */
  env: EdgeEnv;

  /**
   * ExecutionContext
   */
  ctx: ExecutionContext;
}

/**
 * Step execution result
 */
export interface StepResult {
  /**
   * Step ID
   */
  stepId: string;

  /**
   * Function ID
   */
  functionId: string;

  /**
   * Execution status
   */
  status: ExecutionStatus;

  /**
   * Output value
   */
  output?: unknown;

  /**
   * Error if failed
   */
  error?: Error;

  /**
   * Execution metrics
   */
  metrics: {
    /**
     * Start time
     */
    startTime: number;

    /**
     * End time
     */
    endTime: number;

    /**
     * Duration in ms
     */
    duration: number;

    /**
     * Memory used in bytes
     */
    memoryUsed: number;

    /**
     * CPU time in ms
     */
    cpuTime: number;
  };
}

/**
 * Execution status
 */
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Error handling strategy
 */
export type ErrorHandlingStrategy =
  | 'stop' // Stop workflow on first error
  | 'continue' // Continue to next step
  | 'retry' // Retry failed steps
  | 'fallback'; // Use fallback function

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  /**
   * Workflow author
   */
  author?: string;

  /**
   * Creation timestamp
   */
  createdAt?: number;

  /**
   * Tags for categorization
   */
  tags?: string[];

  /**
   * Version
   */
  version?: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  /**
   * Execution ID
   */
  executionId: string;

  /**
   * Workflow ID
   */
  workflowId: string;

  /**
   * Execution status
   */
  status: ExecutionStatus;

  /**
   * Final output data
   */
  output: Record<string, unknown>;

  /**
   * All step results
   */
  steps: StepResult[];

  /**
   * Execution metrics
   */
  metrics: {
    /**
     * Start time
     */
    startTime: number;

    /**
     * End time
     */
    endTime: number;

    /**
     * Total duration in ms
     */
    duration: number;

    /**
     * Total memory used in bytes
     */
    memoryUsed: number;

    /**
     * Number of steps executed
     */
    stepsExecuted: number;

    /**
     * Number of steps failed
     */
    stepsFailed: number;
  };

  /**
   * Error if workflow failed
   */
  error?: Error;
}

// ============================================================================
// Deployment Types
// ============================================================================

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  /**
   * Function or functions to deploy
   */
  functions: EdgeFunction | EdgeFunction[];

  /**
   * Environment to deploy to
   */
  environment: DeploymentEnvironment;

  /**
   * Version to deploy
   */
  version?: string;

  /**
   * Rollout strategy
   */
  strategy?: RolloutStrategy;

  /**
   * Environment variables
   */
  envVars?: Record<string, string>;

  /**
   * Secrets
   */
  secrets?: Record<string, string>;

  /**
   * Deployment metadata
   */
  metadata?: DeploymentMetadata;
}

/**
 * Deployment environment
 */
export type DeploymentEnvironment =
  | 'development'
  | 'staging'
  | 'production'
  | 'custom';

/**
 * Rollout strategy
 */
export type RolloutStrategy =
  | 'immediate' // Deploy to all edge locations immediately
  | 'canary' // Deploy to percentage of locations
  | 'blue-green' // Switch traffic between deployments
  | 'gradual'; // Gradually increase traffic

/**
 * Deployment metadata
 */
export interface DeploymentMetadata {
  /**
   * Deployment ID
   */
  deploymentId?: string;

  /**
   * Previous version
   */
  previousVersion?: string;

  /**
   * Rollback version
   */
  rollbackVersion?: string;

  /**
   * Changelog
   */
  changelog?: string;

  /**
   * Tags
   */
  tags?: string[];

  /**
   * Deployment timestamp
   */
  deployedAt?: number;

  /**
   * Deployed by
   */
  deployedBy?: string;

  /**
   * Deployment status
   */
  status?: DeploymentStatus;
}

/**
 * Deployment status
 */
export type DeploymentStatus =
  | 'pending'
  | 'deploying'
  | 'deployed'
  | 'failed'
  | 'rolling-back'
  | 'rolled-back';

/**
 * Deployment result
 */
export interface DeploymentResult {
  /**
   * Deployment ID
   */
  deploymentId: string;

  /**
   * Deployment status
   */
  status: DeploymentStatus;

  /**
   * Deployed functions
   */
  functions: string[];

  /**
   * Version deployed
   */
  version: string;

  /**
   * Deployment timestamp
   */
  timestamp: number;

  /**
   * Edge locations deployed to
   */
  locations: string[];

  /**
   * Deployment metrics
   */
  metrics: {
    /**
     * Deployment duration in ms
     */
    duration: number;

    /**
     * Number of locations
     */
    locationCount: number;

    /**
     * Success rate (0-1)
     */
    successRate: number;
  };

  /**
   * Error if deployment failed
   */
  error?: Error;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum requests per window
   */
  requests: number;

  /**
   * Time window in seconds
   */
  window: number;

  /**
   * Rate limit key strategy
   */
  keyStrategy?: RateLimitKeyStrategy;

  /**
   * Action when limit exceeded
   */
  onLimitExceeded?: RateLimitAction;

  /**
   * Burst allowance
   */
  burst?: number;
}

/**
 * Rate limit key strategy
 */
export type RateLimitKeyStrategy =
  | 'ip' // Rate limit by IP address
  | 'user' // Rate limit by user ID
  | 'api-key' // Rate limit by API key
  | 'custom'; // Custom key function

/**
 * Rate limit action
 */
export type RateLimitAction =
  | 'reject' // Reject request with 429
  | 'queue' // Queue request
  | 'throttle'; // Slow down request

// ============================================================================
// Retry Types
// ============================================================================

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Maximum number of retries
   */
  maxRetries?: number;

  /**
   * Initial retry delay in ms
   */
  initialDelay?: number;

  /**
   * Maximum retry delay in ms
   */
  maxDelay?: number;

  /**
   * Backoff multiplier
   */
  backoffMultiplier?: number;

  /**
   * Retry conditions
   */
  retryIf?: (error: Error) => boolean;

  /**
   * Jitter for retry delays
   */
  jitter?: boolean;
}

// ============================================================================
// Versioning Types
// ============================================================================

/**
 * Function version
 */
export interface FunctionVersion {
  /**
   * Version number
   */
  version: string;

  /**
   * Function code hash
   */
  hash: string;

  /**
   * Creation timestamp
   */
  createdAt: number;

  /**
   * Created by
   */
  createdBy?: string;

  /**
   * Deployment status
   */
  status: VersionStatus;

  /**
   * Rollback version
   */
  rollbackVersion?: string;

  /**
   * Changelog
   */
  changelog?: string;

  /**
   * Tags
   */
  tags?: string[];
}

/**
 * Version status
 */
export type VersionStatus =
  | 'draft'
  | 'active'
  | 'deprecated'
  | 'archived';

// ============================================================================
// Monitoring Types
// ============================================================================

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  /**
   * Function ID
   */
  functionId: string;

  /**
   * Execution ID
   */
  executionId: string;

  /**
   * Start time
   */
  startTime: number;

  /**
   * End time
   */
  endTime: number;

  /**
   * Duration in ms
   */
  duration: number;

  /**
   * Memory used in bytes
   */
  memoryUsed: number;

  /**
   * CPU time in ms
   */
  cpuTime: number;

  /**
   * Execution status
   */
  status: ExecutionStatus;

  /**
   * Error if failed
   */
  error?: Error;

  /**
   * Custom metrics
   */
  customMetrics?: Record<string, number | string>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /**
   * Average execution time in ms
   */
  avgExecutionTime: number;

  /**
   * P50 execution time in ms
   */
  p50ExecutionTime: number;

  /**
   * P95 execution time in ms
   */
  p95ExecutionTime: number;

  /**
   * P99 execution time in ms
   */
  p99ExecutionTime: number;

  /**
   * Total executions
   */
  totalExecutions: number;

  /**
   * Success rate (0-1)
   */
  successRate: number;

  /**
   * Error rate (0-1)
   */
  errorRate: number;

  /**
   * Average memory usage in bytes
   */
  avgMemoryUsage: number;

  /**
   * Cold start count
   */
  coldStarts: number;

  /**
   * Cache hit rate (0-1)
   */
  cacheHitRate: number;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /**
   * Alert name
   */
  name: string;

  /**
   * Alert type
   */
  type: AlertType;

  /**
   * Threshold value
   */
  threshold: number;

  /**
   * Time window in seconds
   */
  window: number;

  /**
   * Alert channels
   */
  channels: AlertChannel[];

  /**
   * Alert conditions
   */
  condition: AlertCondition;
}

/**
 * Alert type
 */
export type AlertType =
  | 'error-rate'
  | 'latency'
  | 'memory-usage'
  | 'cache-miss'
  | 'rate-limit';

/**
 * Alert channel
 */
export type AlertChannel =
  | 'email'
  | 'webhook'
  | 'slack'
  | 'pagerduty';

/**
 * Alert condition
 */
export type AlertCondition =
  | 'greater-than'
  | 'less-than'
  | 'equals'
  | 'not-equals';

// ============================================================================
// Hot Reload Types
// ============================================================================

/**
 * Hot reload configuration
 */
export interface HotReloadConfig {
  /**
   * Enable hot reload
   */
  enabled: boolean;

  /**
   * Watch paths
   */
  watchPaths?: string[];

  /**
   * Reload strategy
   */
  strategy?: HotReloadStrategy;

  /**
   * Debounce delay in ms
   */
  debounceDelay?: number;

  /**
   * Ignore patterns
   */
  ignorePatterns?: string[];
}

/**
 * Hot reload strategy
 */
export type HotReloadStrategy =
  | 'immediate' // Reload immediately on change
  | 'debounced' // Wait for debounce delay
  | 'manual'; // Manual reload trigger

/**
 * Reload event
 */
export interface ReloadEvent {
  /**
   * Event type
   */
  type: 'add' | 'update' | 'remove';

  /**
   * Function ID
   */
  functionId: string;

  /**
   * File path
   */
  path: string;

  /**
   * Timestamp
   */
  timestamp: number;

  /**
   * Old version hash
   */
  oldHash?: string;

  /**
   * New version hash
   */
  newHash?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Edge request
 */
export interface EdgeRequest<TInput = unknown> {
  /**
   * Request ID
   */
  id: string;

  /**
   * Function ID to execute
   */
  functionId: string;

  /**
   * Input data
   */
  input: unknown;

  /**
   * Request headers
   */
  headers?: Headers;

  /**
   * Request timestamp
   */
  timestamp: number;

  /**
   * Request metadata
   */
  metadata?: Record<string, unknown>;

  /**
   * Cache bypass flag
   */
  bypassCache?: boolean;

  /**
   * Trace ID for distributed tracing
   */
  traceId?: string;

  /**
   * Parent span ID
   */
  parentSpanId?: string;
}

/**
 * Edge response
 */
export interface EdgeResponse<T = unknown> {
  /**
   * Response ID
   */
  id: string;

  /**
   * Request ID
   */
  requestId: string;

  /**
   * Function ID
   */
  functionId: string;

  /**
   * Response data
   */
  data: T;

  /**
   * Response status
   */
  status: ResponseStatus;

  /**
   * Response headers
   */
  headers?: Headers;

  /**
   * Execution metrics
   */
  metrics: ExecutionMetrics;

  /**
   * Cache info
   */
  cache?: {
    /**
     * Was response served from cache
     */
    hit: boolean;

    /**
     * Cache key
     */
    key?: string;

    /**
     * Cache age in seconds
     */
    age?: number;
  };

  /**
   * Error if request failed
   */
  error?: Error;

  /**
   * Trace ID
   */
  traceId?: string;

  /**
   * Span IDs
   */
  spanIds?: string[];
}

/**
 * Response status
 */
export type ResponseStatus =
  | 'success'
  | 'error'
  | 'timeout'
  | 'cancelled';

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Middleware function
 */
export type MiddlewareFunction = (
  request: EdgeRequest,
  context: ExecutionContext & { env: EdgeEnv },
  next: () => Promise<EdgeResponse>
) => Promise<EdgeResponse>;

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /**
   * Middleware name
   */
  name: string;

  /**
   * Middleware function
   */
  handler: MiddlewareFunction;

  /**
   * Apply to specific functions
   */
  applyTo?: string[];

  /**
   * Apply before function execution
   */
  before?: boolean;

  /**
   * Apply after function execution
   */
  after?: boolean;

  /**
   * Middleware priority (lower = earlier)
   */
  priority?: number;
}
