/**
 * Retry Policies with Exponential Backoff and Jitter
 *
 * Advanced retry system with:
 * - Multiple backoff strategies (exponential, linear, custom)
 * - Jitter to prevent thundering herd
 * - Per-error-type retry configuration
 * - Retry budget management
 * - Detailed retry metrics and analytics
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import {
  ErrorType,
  classifyError,
  getRetryConfig,
  isRetryable,
} from './types';

// ============================================================================
// RETRY STRATEGY TYPES
// ============================================================================

/**
 * Backoff strategies for retry attempts
 */
export enum BackoffStrategy {
  /** Exponential backoff: delay = baseDelay * multiplier^attempt */
  EXPONENTIAL = 'exponential',
  /** Linear backoff: delay = baseDelay + (increment * attempt) */
  LINEAR = 'linear',
  /** Fixed delay: delay = baseDelay */
  FIXED = 'fixed',
  /** Full jitter: delay = random(0, baseDelay * 2^attempt) */
  FULL_JITTER = 'full_jitter',
  /** Decorrelated jitter: delay = random(baseDelay, lastDelay * 3) */
  DECORRELATED_JITTER = 'decorrelated_jitter',
}

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

/**
 * Retry policy configuration
 */
export interface RetryPolicyConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Minimum delay in milliseconds */
  minDelay?: number;
  /** Backoff strategy */
  strategy: BackoffStrategy;
  /** Backoff multiplier (for exponential) */
  backoffMultiplier: number;
  /** Jitter factor (0-1) */
  jitterFactor: number;
  /** Whether to use retry budgets */
  useRetryBudget: boolean;
  /** Retry budget (attempts per minute) */
  retryBudget?: number;
  /** Custom delay calculator */
  customDelay?: (attempt: number, error: Error) => number;
  /** Retry condition predicate */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback before each retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  /** Callback after successful retry */
  onRetrySuccess?: (attempt: number, totalDelay: number) => void;
  /** Callback after failed retries */
  onRetryFailed?: (error: Error, attempts: number, totalDelay: number) => void;
}

/**
 * Retry attempt information
 */
export interface RetryAttempt {
  /** Attempt number (0-indexed) */
  attempt: number;
  /** Delay before this attempt */
  delay: number;
  /** Error that triggered retry */
  error: Error;
  /** Timestamp of attempt */
  timestamp: number;
}

/**
 * Retry result with metadata
 */
export interface RetryResult<T> {
  /** Whether retry succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Final error if failed */
  error?: Error;
  /** Total attempts made */
  attempts: number;
  /** Total delay across all retries */
  totalDelay: number;
  /** Retry attempts details */
  retryAttempts: RetryAttempt[];
}

/**
 * Retry budget state
 */
export interface RetryBudget {
  /** Remaining retry attempts */
  remaining: number;
  /** Last reset timestamp */
  lastReset: number;
  /** Budget window in milliseconds */
  window: number;
}

// ============================================================================
// RETRY POLICY CLASS
// ============================================================================

/**
 * Advanced retry policy with configurable backoff strategies
 */
export class RetryPolicy {
  private config: Required<RetryPolicyConfig>;
  private budget?: RetryBudget;
  private retryHistory: Map<string, RetryAttempt[]> = new Map();

  constructor(config: Partial<RetryPolicyConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      baseDelay: config.baseDelay ?? 1000,
      maxDelay: config.maxDelay ?? 60000,
      minDelay: config.minDelay ?? 100,
      strategy: config.strategy ?? BackoffStrategy.EXPONENTIAL,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      jitterFactor: config.jitterFactor ?? 0.1,
      useRetryBudget: config.useRetryBudget ?? false,
      retryBudget: config.retryBudget ?? 100,
      customDelay: config.customDelay ?? ((_, __) => this.config.baseDelay),
      shouldRetry: config.shouldRetry ?? this.defaultShouldRetry.bind(this),
      onRetry: config.onRetry ?? (() => {}),
      onRetrySuccess: config.onRetrySuccess ?? (() => {}),
      onRetryFailed: config.onRetryFailed ?? (() => {}),
    };

    // Initialize retry budget if enabled
    if (this.config.useRetryBudget && this.config.retryBudget) {
      this.budget = {
        remaining: this.config.retryBudget,
        lastReset: Date.now(),
        window: 60000, // 1 minute
      };
    }
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: { key?: string; errorType?: ErrorType }
  ): Promise<T> {
    const result = await this.executeWithResult(fn, context);

    if (!result.success) {
      throw result.error!;
    }

    return result.data!;
  }

  /**
   * Execute with detailed retry result
   */
  async executeWithResult<T>(
    fn: () => Promise<T>,
    context?: { key?: string; errorType?: ErrorType }
  ): Promise<RetryResult<T>> {
    const retryAttempts: RetryAttempt[] = [];
    let lastError: Error;
    let totalDelay = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();

        // Log successful retry
        if (attempt > 0) {
          this.config.onRetrySuccess(attempt, totalDelay);
        }

        return {
          success: true,
          data: result,
          attempts: attempt + 1,
          totalDelay,
          retryAttempts,
        };
      } catch (error) {
        lastError = error as Error;

        // Check if should retry
        const errorType = context?.errorType ?? this.classifyError(lastError);
        if (
          attempt >= this.config.maxRetries ||
          !this.isRetryable(lastError, attempt, errorType)
        ) {
          // All retries exhausted
          this.config.onRetryFailed(lastError, attempt + 1, totalDelay);

          return {
            success: false,
            error: lastError,
            attempts: attempt + 1,
            totalDelay,
            retryAttempts,
          };
        }

        // Check retry budget
        if (this.config.useRetryBudget && !this.consumeBudget()) {
          this.config.onRetryFailed(lastError, attempt + 1, totalDelay);

          return {
            success: false,
            error: new Error('Retry budget exhausted'),
            attempts: attempt + 1,
            totalDelay,
            retryAttempts,
          };
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, lastError);
        totalDelay += delay;

        // Record retry attempt
        const retryAttempt: RetryAttempt = {
          attempt: attempt + 1,
          delay,
          error: lastError,
          timestamp: Date.now(),
        };
        retryAttempts.push(retryAttempt);

        // Store in history
        if (context?.key) {
          this.addToHistory(context.key, retryAttempt);
        }

        // Call retry callback
        this.config.onRetry(lastError, attempt + 1, delay);

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // Should not reach here
    return {
      success: false,
      error: lastError!,
      attempts: this.config.maxRetries + 1,
      totalDelay,
      retryAttempts,
    };
  }

  /**
   * Calculate delay for retry attempt
   */
  private calculateDelay(attempt: number, error: Error): number {
    let delay: number;

    switch (this.config.strategy) {
      case BackoffStrategy.EXPONENTIAL:
        delay = this.exponentialBackoff(attempt);
        break;

      case BackoffStrategy.LINEAR:
        delay = this.linearBackoff(attempt);
        break;

      case BackoffStrategy.FIXED:
        delay = this.config.baseDelay;
        break;

      case BackoffStrategy.FULL_JITTER:
        delay = this.fullJitter(attempt);
        break;

      case BackoffStrategy.DECORRELATED_JITTER:
        delay = this.decorrelatedJitter(attempt, error);
        break;

      default:
        delay = this.exponentialBackoff(attempt);
    }

    // Apply jitter if configured
    if (this.config.strategy !== BackoffStrategy.FULL_JITTER &&
        this.config.strategy !== BackoffStrategy.DECORRELATED_JITTER) {
      delay = this.applyJitter(delay);
    }

    // Clamp to min/max bounds
    delay = Math.max(this.config.minDelay, Math.min(delay, this.config.maxDelay));

    return Math.floor(delay);
  }

  /**
   * Exponential backoff: delay = baseDelay * multiplier^attempt
   */
  private exponentialBackoff(attempt: number): number {
    return this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt);
  }

  /**
   * Linear backoff: delay = baseDelay + (baseDelay * 0.5 * attempt)
   */
  private linearBackoff(attempt: number): number {
    return this.config.baseDelay + (this.config.baseDelay * 0.5 * attempt);
  }

  /**
   * Full jitter: delay = random(0, baseDelay * 2^attempt)
   */
  private fullJitter(attempt: number): number {
    const maxDelay = this.config.baseDelay * Math.pow(2, attempt);
    return Math.random() * maxDelay;
  }

  /**
   * Decorrelated jitter: delay = random(baseDelay, lastDelay * 3)
   */
  private decorrelatedJitter(attempt: number, error: Error): number {
    // Use custom delay from previous attempt or base delay
    const lastDelay = (error as any).lastDelay ?? this.config.baseDelay;
    const minDelay = this.config.baseDelay;
    const maxDelay = lastDelay * 3;
    return minDelay + Math.random() * (maxDelay - minDelay);
  }

  /**
   * Apply jitter to delay
   */
  private applyJitter(delay: number): number {
    const jitter = delay * this.config.jitterFactor * (Math.random() * 2 - 1);
    return delay + jitter;
  }

  /**
   * Check if error should be retried
   */
  private isRetryable(error: Error, attempt: number, errorType?: ErrorType): boolean {
    // Use custom shouldRetry if provided
    if (this.config.shouldRetry !== this.defaultShouldRetry) {
      return this.config.shouldRetry(error, attempt);
    }

    // Use error type classification
    const type = errorType ?? this.classifyError(error);
    return isRetryable(type);
  }

  /**
   * Default retry condition predicate
   */
  private defaultShouldRetry(error: Error, attempt: number): boolean {
    // Check for status code
    const statusCode = (error as any).status;
    if (statusCode) {
      // Retry on rate limits (429)
      if (statusCode === 429) {
        return true;
      }
      // Retry on server errors (5xx)
      if (statusCode >= 500 && statusCode < 600) {
        return true;
      }
      // Retry on timeout (408)
      if (statusCode === 408) {
        return true;
      }
    }

    // Check for network errors
    const errorCode = (error as any).code;
    if (errorCode) {
      const retryableCodes = [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ENETUNREACH',
        'EPIPE',
      ];
      if (retryableCodes.includes(errorCode)) {
        return true;
      }
    }

    // Check error message
    const message = error.message?.toLowerCase() || '';
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'rate limit',
      'temporarily unavailable',
      'service unavailable',
      'gateway timeout',
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Classify error from Error object
   */
  private classifyError(error: Error): ErrorType {
    const statusCode = (error as any).status ?? 0;
    return classifyError(statusCode, error.message);
  }

  /**
   * Consume retry budget
   */
  private consumeBudget(): boolean {
    if (!this.budget) return true;

    const now = Date.now();

    // Reset budget if window expired
    if (now - this.budget.lastReset >= this.budget.window) {
      this.budget.remaining = this.config.retryBudget;
      this.budget.lastReset = now;
    }

    // Check if budget available
    if (this.budget.remaining <= 0) {
      return false;
    }

    this.budget.remaining--;
    return true;
  }

  /**
   * Add retry attempt to history
   */
  private addToHistory(key: string, attempt: RetryAttempt): void {
    if (!this.retryHistory.has(key)) {
      this.retryHistory.set(key, []);
    }

    const history = this.retryHistory.get(key)!;
    history.push(attempt);

    // Keep only last 100 attempts
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry configuration
   */
  getConfig(): Required<RetryPolicyConfig> {
    return { ...this.config };
  }

  /**
   * Get retry budget status
   */
  getBudgetStatus(): RetryBudget | undefined {
    return this.budget ? { ...this.budget } : undefined;
  }

  /**
   * Get retry history for a key
   */
  getHistory(key: string): RetryAttempt[] {
    return this.retryHistory.get(key) ?? [];
  }

  /**
   * Clear retry history
   */
  clearHistory(key?: string): void {
    if (key) {
      this.retryHistory.delete(key);
    } else {
      this.retryHistory.clear();
    }
  }

  /**
   * Reset retry budget
   */
  resetBudget(): void {
    if (this.budget) {
      this.budget.remaining = this.config.retryBudget;
      this.budget.lastReset = Date.now();
    }
  }
}

// ============================================================================
// PREDEFINED RETRY POLICIES
// ============================================================================

/**
 * Create retry policy for API calls
 */
export function createAPIRetryPolicy(
  maxRetries: number = 3
): RetryPolicy {
  return new RetryPolicy({
    maxRetries,
    baseDelay: 1000,
    maxDelay: 60000,
    strategy: BackoffStrategy.EXPONENTIAL,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  });
}

/**
 * Create retry policy for rate-limited APIs
 */
export function createRateLimitRetryPolicy(
  maxRetries: number = 5
): RetryPolicy {
  return new RetryPolicy({
    maxRetries,
    baseDelay: 5000,
    maxDelay: 120000,
    strategy: BackoffStrategy.EXPONENTIAL,
    backoffMultiplier: 2,
    jitterFactor: 0.3,
  });
}

/**
 * Create retry policy for quick retries (transient issues)
 */
export function createQuickRetryPolicy(
  maxRetries: number = 5
): RetryPolicy {
  return new RetryPolicy({
    maxRetries,
    baseDelay: 100,
    maxDelay: 5000,
    strategy: BackoffStrategy.LINEAR,
    backoffMultiplier: 1.5,
    jitterFactor: 0.2,
  });
}

/**
 * Create retry policy for long-running operations
 */
export function createLongRunningRetryPolicy(
  maxRetries: number = 10
): RetryPolicy {
  return new RetryPolicy({
    maxRetries,
    baseDelay: 5000,
    maxDelay: 300000, // 5 minutes
    strategy: BackoffStrategy.EXPONENTIAL,
    backoffMultiplier: 2,
    jitterFactor: 0.15,
  });
}

/**
 * Create retry policy with jitter (distributed systems)
 */
export function createJitterRetryPolicy(
  maxRetries: number = 5
): RetryPolicy {
  return new RetryPolicy({
    maxRetries,
    baseDelay: 1000,
    maxDelay: 60000,
    strategy: BackoffStrategy.FULL_JITTER,
    backoffMultiplier: 2,
    jitterFactor: 0.5,
  });
}

/**
 * Create retry policy with budget (production)
 */
export function createBudgetedRetryPolicy(
  maxRetries: number = 3,
  budgetPerMinute: number = 100
): RetryPolicy {
  return new RetryPolicy({
    maxRetries,
    baseDelay: 1000,
    maxDelay: 60000,
    strategy: BackoffStrategy.EXPONENTIAL,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    useRetryBudget: true,
    retryBudget: budgetPerMinute,
  });
}

/**
 * Create retry policy from error type
 */
export function createRetryPolicyFromErrorType(
  errorType: ErrorType
): RetryPolicy {
  const config = getRetryConfig(errorType);
  return new RetryPolicy({
    maxRetries: config.maxRetries,
    baseDelay: config.baseDelay,
    maxDelay: config.maxDelay,
    strategy: BackoffStrategy.EXPONENTIAL,
    backoffMultiplier: config.backoffMultiplier,
    jitterFactor: config.jitterFactor,
  });
}

// ============================================================================
// RETRY MANAGER
// ============================================================================

/**
 * Manages multiple retry policies with different strategies
 */
export class RetryManager {
  private policies: Map<string, RetryPolicy> = new Map();

  /**
   * Register a retry policy
   */
  registerPolicy(name: string, policy: RetryPolicy): void {
    this.policies.set(name, policy);
  }

  /**
   * Get a retry policy by name
   */
  getPolicy(name: string): RetryPolicy | undefined {
    return this.policies.get(name);
  }

  /**
   * Execute with named policy
   */
  async executeWithPolicy<T>(
    policyName: string,
    fn: () => Promise<T>,
    context?: { key?: string; errorType?: ErrorType }
  ): Promise<T> {
    const policy = this.policies.get(policyName);
    if (!policy) {
      throw new Error(`Retry policy '${policyName}' not found`);
    }

    return policy.execute(fn, context);
  }

  /**
   * Get all policy names
   */
  getPolicyNames(): string[] {
    return Array.from(this.policies.keys());
  }

  /**
   * Remove a policy
   */
  removePolicy(name: string): boolean {
    return this.policies.delete(name);
  }

  /**
   * Clear all policies
   */
  clear(): void {
    this.policies.clear();
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Execute function with retry (convenience function)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  const policy = createAPIRetryPolicy(maxRetries);
  return policy.execute(fn);
}

/**
 * Execute function with retry and result
 */
export async function retryWithResult<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<RetryResult<T>> {
  const policy = createAPIRetryPolicy(maxRetries);
  return policy.executeWithResult(fn);
}

/**
 * Create default retry manager with common policies
 */
export function createDefaultRetryManager(): RetryManager {
  const manager = new RetryManager();

  manager.registerPolicy('api', createAPIRetryPolicy());
  manager.registerPolicy('rate-limit', createRateLimitRetryPolicy());
  manager.registerPolicy('quick', createQuickRetryPolicy());
  manager.registerPolicy('long-running', createLongRunningRetryPolicy());
  manager.registerPolicy('jitter', createJitterRetryPolicy());
  manager.registerPolicy('budgeted', createBudgetedRetryPolicy());

  return manager;
}
