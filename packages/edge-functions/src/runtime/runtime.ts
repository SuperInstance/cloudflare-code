/**
 * Edge Function Runtime
 *
 * Handles execution of edge functions with comprehensive error handling,
 * timeout management, memory limits, and performance tracking.
 */

import {
  EdgeFunction,
  EdgeRequest,
  EdgeResponse,
  EdgeEnv,
  ExecutionMetrics,
  ResponseStatus,
  ExecutionStatus,
  FunctionHandler,
  FunctionConfig,
} from '../types/index.js';

// ============================================================================
// Runtime Configuration
// ============================================================================

/**
 * Runtime configuration options
 */
export interface RuntimeConfig {
  /**
   * Default timeout for all functions (ms)
   * @default 30000
   */
  defaultTimeout?: number;

  /**
   * Default memory limit (MB)
   * @default 128
   */
  defaultMemoryLimit?: number;

  /**
   * Enable metrics collection
   * @default true
   */
  enableMetrics?: boolean;

  /**
   * Enable tracing
   * @default false
   */
  enableTracing?: boolean;

  /**
   * Maximum concurrent executions
   * @default 100
   */
  maxConcurrentExecutions?: number;

  /**
   * Execution queue timeout (ms)
   * @default 5000
   */
  queueTimeout?: number;

  /**
   * Graceful shutdown timeout (ms)
   * @default 10000
   */
  shutdownTimeout?: number;
}

// ============================================================================
// Runtime Errors
// ============================================================================

/**
 * Base error for runtime errors
 */
export class RuntimeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly functionId?: string,
    public readonly executionId?: string
  ) {
    super(message);
    this.name = 'RuntimeError';
  }
}

/**
 * Error thrown when function execution times out
 */
export class TimeoutError extends RuntimeError {
  constructor(
    message: string,
    functionId?: string,
    executionId?: string,
    public readonly timeout: number
  ) {
    super(message, 'TIMEOUT', functionId, executionId);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when function exceeds memory limit
 */
export class MemoryLimitError extends RuntimeError {
  constructor(
    message: string,
    functionId?: string,
    executionId?: string,
    public readonly memoryLimit: number,
    public readonly memoryUsed: number
  ) {
    super(message, 'MEMORY_LIMIT_EXCEEDED', functionId, executionId);
    this.name = 'MemoryLimitError';
  }
}

/**
 * Error thrown when function is not found
 */
export class FunctionNotFoundError extends RuntimeError {
  constructor(functionId: string) {
    super(`Function not found: ${functionId}`, 'FUNCTION_NOT_FOUND', functionId);
    this.name = 'FunctionNotFoundError';
  }
}

/**
 * Error thrown when function execution fails
 */
export class ExecutionError extends RuntimeError {
  constructor(
    message: string,
    functionId?: string,
    executionId?: string,
    public readonly originalError?: Error
  ) {
    super(message, 'EXECUTION_ERROR', functionId, executionId);
    this.name = 'ExecutionError';
  }
}

// ============================================================================
// Function Runtime
// ============================================================================

/**
 * Edge function runtime for executing functions at the edge
 */
export class FunctionRuntime {
  private readonly functions: Map<string, EdgeFunction>;
  private readonly config: RuntimeConfig;
  private readonly executions: Map<string, ExecutionState>;
  private readonly metrics: Map<string, PerformanceMetrics>;
  private runningExecutions: number = 0;
  private isShuttingDown: boolean = false;

  constructor(config: RuntimeConfig = {}) {
    this.functions = new Map();
    this.executions = new Map();
    this.metrics = new Map();
    this.config = {
      defaultTimeout: 30000,
      defaultMemoryLimit: 128,
      enableMetrics: true,
      enableTracing: false,
      maxConcurrentExecutions: 100,
      queueTimeout: 5000,
      shutdownTimeout: 10000,
      ...config,
    };
  }

  // ========================================================================
  // Function Registration
  // ========================================================================

  /**
   * Register a function with the runtime
   */
  registerFunction<TInput = unknown, TOutput = unknown>(
    func: EdgeFunction<TInput, TOutput>
  ): void {
    if (this.functions.has(func.id)) {
      throw new Error(`Function already registered: ${func.id}`);
    }

    this.functions.set(func.id, func);
    this.metrics.set(func.id, this.createEmptyMetrics());
  }

  /**
   * Register multiple functions
   */
  registerFunctions(functions: EdgeFunction[]): void {
    for (const func of functions) {
      this.registerFunction(func);
    }
  }

  /**
   * Unregister a function
   */
  unregisterFunction(functionId: string): boolean {
    return this.functions.delete(functionId);
  }

  /**
   * Get a registered function
   */
  getFunction(functionId: string): EdgeFunction | undefined {
    return this.functions.get(functionId);
  }

  /**
   * Get all registered functions
   */
  getAllFunctions(): EdgeFunction[] {
    return Array.from(this.functions.values());
  }

  /**
   * Check if a function is registered
   */
  hasFunction(functionId: string): boolean {
    return this.functions.has(functionId);
  }

  // ========================================================================
  // Function Execution
  // ========================================================================

  /**
   * Execute a function
   */
  async execute<TInput = unknown, TOutput = unknown>(
    request: EdgeRequest<TInput>,
    context: ExecutionContext & { env: EdgeEnv }
  ): Promise<EdgeResponse<TOutput>> {
    // Check if shutting down
    if (this.isShuttingDown) {
      throw new RuntimeError('Runtime is shutting down', 'SHUTDOWN');
    }

    // Check concurrent execution limit
    if (this.runningExecutions >= this.config.maxConcurrentExecutions!) {
      throw new RuntimeError(
        'Maximum concurrent executions reached',
        'CONCURRENT_LIMIT_EXCEEDED'
      );
    }

    // Get function
    const func = this.functions.get(request.functionId);
    if (!func) {
      throw new FunctionNotFoundError(request.functionId);
    }

    // Create execution state
    const executionId = this.generateExecutionId();
    const state = this.createExecutionState(executionId, request, func);
    this.executions.set(executionId, state);
    this.runningExecutions++;

    const startTime = performance.now();
    let status: ResponseStatus = 'success';
    let result: TOutput;
    let error: Error | undefined;

    try {
      // Execute with timeout and memory limits
      result = await this.executeWithLimits<TInput, TOutput>(
        func,
        request.input,
        context,
        state
      );

      // Update metrics
      if (this.config.enableMetrics) {
        this.updateMetrics(func.id, performance.now() - startTime, true);
      }
    } catch (err) {
      status = err instanceof TimeoutError ? 'timeout' : 'error';
      error = err instanceof Error ? err : new Error(String(err));

      // Update metrics
      if (this.config.enableMetrics) {
        this.updateMetrics(func.id, performance.now() - startTime, false);
      }

      throw error;
    } finally {
      this.runningExecutions--;
      this.executions.delete(executionId);
    }

    // Create response
    return {
      id: this.generateId(),
      requestId: request.id,
      functionId: func.id,
      data: result,
      status,
      metrics: state.metrics,
      traceId: request.traceId,
    };
  }

  /**
   * Execute function with timeout and memory limits
   */
  private async executeWithLimits<TInput, TOutput>(
    func: EdgeFunction<TInput, TOutput>,
    input: TInput,
    context: ExecutionContext & { env: EdgeEnv },
    state: ExecutionState
  ): Promise<TOutput> {
    const timeout = func.config.timeout ?? this.config.defaultTimeout!;
    const memoryLimit = func.config.memoryLimit ?? this.config.defaultMemoryLimit!;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Get initial memory usage
    const initialMemory = this.getMemoryUsage();

    try {
      // Execute function with timeout
      const result = await Promise.race([
        this.executeFunction(func, input, context, state),
        this.createTimeoutPromise<TOutput>(timeout, func.id, state.executionId),
      ]);

      // Check memory limit
      const finalMemory = this.getMemoryUsage();
      const memoryUsed = finalMemory - initialMemory;
      const memoryUsedMB = memoryUsed / (1024 * 1024);

      if (memoryUsedMB > memoryLimit) {
        throw new MemoryLimitError(
          `Memory limit exceeded: ${memoryUsedMB.toFixed(2)}MB used, limit is ${memoryLimit}MB`,
          func.id,
          state.executionId,
          memoryLimit,
          memoryUsedMB
        );
      }

      state.metrics.memoryUsed = memoryUsed;
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute the actual function handler
   */
  private async executeFunction<TInput, TOutput>(
    func: EdgeFunction<TInput, TOutput>,
    input: TInput,
    context: ExecutionContext & { env: EdgeEnv },
    state: ExecutionState
  ): Promise<TOutput> {
    // Validate required environment variables
    if (func.config.requiredEnvVars) {
      for (const envVar of func.config.requiredEnvVars) {
        if (!(envVar in context.env)) {
          throw new ExecutionError(
            `Missing required environment variable: ${envVar}`,
            func.id,
            state.executionId
          );
        }
      }
    }

    // Execute function
    try {
      const result = await func.handler(input, context);
      return result as TOutput;
    } catch (error) {
      throw new ExecutionError(
        `Function execution failed: ${error instanceof Error ? error.message : String(error)}`,
        func.id,
        state.executionId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise<T>(
    timeout: number,
    functionId: string,
    executionId: string
  ): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Function execution timed out after ${timeout}ms`, functionId, executionId, timeout));
      }, timeout);
    });
  }

  // ========================================================================
  // Metrics & Monitoring
  // ========================================================================

  /**
   * Get metrics for a function
   */
  getMetrics(functionId: string): PerformanceMetrics | undefined {
    return this.metrics.get(functionId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Reset metrics for a function
   */
  resetMetrics(functionId: string): void {
    this.metrics.set(functionId, this.createEmptyMetrics());
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    for (const functionId of this.functions.keys()) {
      this.metrics.set(functionId, this.createEmptyMetrics());
    }
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): PerformanceMetrics {
    return {
      avgExecutionTime: 0,
      p50ExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      totalExecutions: 0,
      successRate: 1,
      errorRate: 0,
      avgMemoryUsage: 0,
      coldStarts: 0,
      cacheHitRate: 0,
      executions: [],
    };
  }

  /**
   * Update metrics after execution
   */
  private updateMetrics(
    functionId: string,
    duration: number,
    success: boolean
  ): void {
    const metrics = this.metrics.get(functionId);
    if (!metrics) return;

    // Track execution times for percentile calculation
    if (!metrics.executions) metrics.executions = [];
    metrics.executions.push(duration);

    // Keep only last 1000 executions for percentile calculation
    if (metrics.executions.length > 1000) {
      metrics.executions.shift();
    }

    // Update average execution time
    const totalExecutionTime = metrics.executions.reduce((sum, time) => sum + time, 0);
    metrics.avgExecutionTime = totalExecutionTime / metrics.executions.length;

    // Calculate percentiles
    const sorted = [...metrics.executions].sort((a, b) => a - b);
    metrics.p50ExecutionTime = sorted[Math.floor(sorted.length * 0.5)] || 0;
    metrics.p95ExecutionTime = sorted[Math.floor(sorted.length * 0.95)] || 0;
    metrics.p99ExecutionTime = sorted[Math.floor(sorted.length * 0.99)] || 0;

    // Update execution counts
    metrics.totalExecutions++;

    // Update success/error rates
    const successCount = metrics.executions.length; // Simplified - would need to track separately
    metrics.successRate = successCount / metrics.totalExecutions;
    metrics.errorRate = 1 - metrics.successRate;
  }

  // ========================================================================
  // Runtime Control
  // ========================================================================

  /**
   * Gracefully shutdown the runtime
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Wait for running executions to complete
    const shutdownStart = Date.now();
    while (this.runningExecutions > 0) {
      if (Date.now() - shutdownStart > this.config.shutdownTimeout!) {
        console.warn(`Shutdown timeout: ${this.runningExecutions} executions still running`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isShuttingDown = false;
  }

  /**
   * Get runtime status
   */
  getStatus(): RuntimeStatus {
    return {
      isShuttingDown: this.isShuttingDown,
      runningExecutions: this.runningExecutions,
      registeredFunctions: this.functions.size,
      maxConcurrentExecutions: this.config.maxConcurrentExecutions!,
      queuedExecutions: this.executions.size - this.runningExecutions,
    };
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Create execution state
   */
  private createExecutionState(
    executionId: string,
    request: EdgeRequest,
    func: EdgeFunction
  ): ExecutionState {
    return {
      executionId,
      functionId: func.id,
      requestId: request.id,
      startTime: Date.now(),
      endTime: 0,
      status: 'running',
      metrics: {
        functionId: func.id,
        executionId,
        startTime: Date.now(),
        endTime: 0,
        duration: 0,
        memoryUsed: 0,
        cpuTime: 0,
        status: 'running',
      },
    };
  }

  /**
   * Get current memory usage (estimated)
   */
  private getMemoryUsage(): number {
    // This is an approximation - actual memory tracking depends on the runtime
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize || 0;
    }
    return 0;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Execution state
 */
interface ExecutionState {
  executionId: string;
  functionId: string;
  requestId: string;
  startTime: number;
  endTime: number;
  status: ExecutionStatus;
  metrics: ExecutionMetrics;
}

/**
 * Performance metrics (extended)
 */
interface PerformanceMetrics {
  avgExecutionTime: number;
  p50ExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  totalExecutions: number;
  successRate: number;
  errorRate: number;
  avgMemoryUsage: number;
  coldStarts: number;
  cacheHitRate: number;
  executions?: number[];
}

/**
 * Runtime status
 */
export interface RuntimeStatus {
  isShuttingDown: boolean;
  runningExecutions: number;
  registeredFunctions: number;
  maxConcurrentExecutions: number;
  queuedExecutions: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a new function runtime
 */
export function createRuntime(config?: RuntimeConfig): FunctionRuntime {
  return new FunctionRuntime(config);
}

/**
 * Measure execution time of a function
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Create a timeout promise that rejects after specified duration
 */
export function createTimeout<T>(
  duration: number,
  message?: string
): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message || `Timeout after ${duration}ms`)), duration);
  });
}

/**
 * Execute with retry logic
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryIf?: (error: Error) => boolean;
    jitter?: boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryIf = () => true,
    jitter = true,
  } = config;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries || !retryIf(lastError)) {
        throw lastError;
      }

      // Calculate delay with optional jitter
      const actualDelay = jitter
        ? delay + Math.random() * delay * 0.1
        : delay;

      await new Promise(resolve => setTimeout(resolve, actualDelay));

      // Increase delay for next retry
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Wrap a function with timeout
 */
export function withTimeout<T extends (...args: any[]) => any>(
  fn: T,
  timeout: number,
  timeoutError?: Error
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return Promise.race([
      fn(...args),
      createTimeout<ReturnType<T>>(
        timeout,
        timeoutError?.message || `Function timed out after ${timeout}ms`
      ),
    ]);
  }) as T;
}
