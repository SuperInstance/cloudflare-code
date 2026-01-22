/**
 * Retry delay calculation utilities
 * Implements various retry strategies for failed messages
 */

import type { RetryPolicy } from '../types';
import { RetryPolicyType } from '../types';

/**
 * Calculate retry delay based on policy
 */
export function calculateRetryDelay(
  policy: RetryPolicy,
  attempt: number
): number {
  switch (policy.type) {
    case RetryPolicyType.FIXED_DELAY:
      return calculateFixedDelay(policy, attempt);
    case RetryPolicyType.EXPONENTIAL_BACKOFF:
      return calculateExponentialBackoff(policy, attempt);
    case RetryPolicyType.LINEAR_BACKOFF:
      return calculateLinearBackoff(policy, attempt);
    case RetryPolicyType.CUSTOM:
      return calculateCustomDelay(policy, attempt);
    default:
      return policy.initialDelay;
  }
}

/**
 * Calculate fixed delay
 */
function calculateFixedDelay(policy: RetryPolicy, attempt: number): number {
  // Fixed delay: always return initialDelay
  return policy.initialDelay;
}

/**
 * Calculate exponential backoff delay
 * Formula: initialDelay * (backoffMultiplier ^ attempt)
 */
function calculateExponentialBackoff(policy: RetryPolicy, attempt: number): number {
  const multiplier = policy.backoffMultiplier || 2;
  const delay = policy.initialDelay * Math.pow(multiplier, attempt);

  // Cap at maxDelay if specified
  if (policy.maxDelay !== undefined) {
    return Math.min(delay, policy.maxDelay);
  }

  return delay;
}

/**
 * Calculate linear backoff delay
 * Formula: initialDelay + (initialDelay * attempt)
 */
function calculateLinearBackoff(policy: RetryPolicy, attempt: number): number {
  const delay = policy.initialDelay * (1 + attempt);

  // Cap at maxDelay if specified
  if (policy.maxDelay !== undefined) {
    return Math.min(delay, policy.maxDelay);
  }

  return delay;
}

/**
 * Calculate custom delay using provided function
 */
function calculateCustomDelay(policy: RetryPolicy, attempt: number): number {
  if (policy.customDelay) {
    try {
      return policy.customDelay(attempt);
    } catch (error) {
      // Fallback to initial delay if custom function fails
      return policy.initialDelay;
    }
  }
  return policy.initialDelay;
}

/**
 * Check if should retry based on policy
 */
export function shouldRetry(
  policy: RetryPolicy,
  attempt: number,
  lastError?: Error
): boolean {
  // Check if max retries exceeded
  if (attempt >= policy.maxRetries) {
    return false;
  }

  // Check for non-retryable errors
  if (lastError) {
    if (isNonRetryableError(lastError)) {
      return false;
    }
  }

  return true;
}

/**
 * Determine if an error is non-retryable
 */
export function isNonRetryableError(error: Error): boolean {
  const nonRetryablePatterns = [
    'validation',
    'invalid',
    'malformed',
    'unauthorized',
    'forbidden',
    'not found',
    'quota',
    'limit'
  ];

  const errorMessage = error.message.toLowerCase();
  return nonRetryablePatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Calculate next retry timestamp
 */
export function calculateNextRetryTimestamp(
  policy: RetryPolicy,
  attempt: number
): number {
  const delay = calculateRetryDelay(policy, attempt);
  return Date.now() + delay;
}

/**
 * Default retry policies
 */
export const DefaultRetryPolicies = {
  /**
   * Immediate retries (for testing)
   */
  immediate: {
    type: RetryPolicyType.FIXED_DELAY,
    maxRetries: 3,
    initialDelay: 0
  } as RetryPolicy,

  /**
   * Fixed delay with 1 second intervals
   */
  fixed1s: {
    type: RetryPolicyType.FIXED_DELAY,
    maxRetries: 5,
    initialDelay: 1000
  } as RetryPolicy,

  /**
   * Fixed delay with 5 second intervals
   */
  fixed5s: {
    type: RetryPolicyType.FIXED_DELAY,
    maxRetries: 5,
    initialDelay: 5000
  } as RetryPolicy,

  /**
   * Exponential backoff starting at 100ms
   */
  exponential100ms: {
    type: RetryPolicyType.EXPONENTIAL_BACKOFF,
    maxRetries: 10,
    initialDelay: 100,
    backoffMultiplier: 2,
    maxDelay: 30000
  } as RetryPolicy,

  /**
   * Exponential backoff starting at 1 second
   */
  exponential1s: {
    type: RetryPolicyType.EXPONENTIAL_BACKOFF,
    maxRetries: 10,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 60000
  } as RetryPolicy,

  /**
   * Linear backoff starting at 1 second
   */
  linear1s: {
    type: RetryPolicyType.LINEAR_BACKOFF,
    maxRetries: 7,
    initialDelay: 1000,
    maxDelay: 30000
  } as RetryPolicy,

  /**
   * Aggressive exponential backoff for quick failures
   */
  aggressive: {
    type: RetryPolicyType.EXPONENTIAL_BACKOFF,
    maxRetries: 3,
    initialDelay: 100,
    backoffMultiplier: 10,
    maxDelay: 10000
  } as RetryPolicy,

  /**
   * Conservative exponential backoff for resilience
   */
  conservative: {
    type: RetryPolicyType.EXPONENTIAL_BACKOFF,
    maxRetries: 20,
    initialDelay: 1000,
    backoffMultiplier: 1.5,
    maxDelay: 300000
  } as RetryPolicy
};

/**
 * Create custom retry policy
 */
export function createRetryPolicy(
  type: RetryPolicyType,
  maxRetries: number,
  initialDelay: number,
  options?: {
    maxDelay?: number;
    backoffMultiplier?: number;
    customDelay?: (attempt: number) => number;
  }
): RetryPolicy {
  const policy: RetryPolicy = {
    type,
    maxRetries,
    initialDelay
  };

  if (options?.maxDelay !== undefined) {
    policy.maxDelay = options.maxDelay;
  }

  if (options?.backoffMultiplier !== undefined) {
    policy.backoffMultiplier = options.backoffMultiplier;
  }

  if (options?.customDelay !== undefined) {
    policy.customDelay = options.customDelay;
  }

  return policy;
}

/**
 * Jitter utilities for adding randomness to delays
 * Prevents thundering herd problem
 */

/**
 * Add full jitter to delay
 * Returns random value between 0 and delay
 */
export function addFullJitter(delay: number): number {
  return Math.random() * delay;
}

/**
 * Add equal jitter to delay
 * Returns delay / 2 + random(0, delay / 2)
 */
export function addEqualJitter(delay: number): number {
  return delay / 2 + Math.random() * (delay / 2);
}

/**
 * Add decorrelated jitter
 * Based on previous delay: min(cap, random(base, previousDelay * 3))
 */
export function addDecorrelatedJitter(
  delay: number,
  previousDelay: number,
  cap: number = 60000
): number {
  const min = Math.min(delay, previousDelay * 3);
  return Math.min(cap, delay + Math.random() * (min - delay));
}

/**
 * Calculate retry delay with jitter
 */
export function calculateRetryDelayWithJitter(
  policy: RetryPolicy,
  attempt: number,
  jitterType: 'full' | 'equal' | 'decorrelated' = 'equal',
  previousDelay?: number
): number {
  const baseDelay = calculateRetryDelay(policy, attempt);

  switch (jitterType) {
    case 'full':
      return addFullJitter(baseDelay);
    case 'equal':
      return addEqualJitter(baseDelay);
    case 'decorrelated':
      if (previousDelay === undefined) {
        return baseDelay;
      }
      return addDecorrelatedJitter(baseDelay, previousDelay);
    default:
      return baseDelay;
  }
}

/**
 * Retry state for tracking retry attempts
 */
export interface RetryState {
  attempt: number;
  lastDelay: number;
  lastError?: Error;
  nextRetryAt?: number;
}

/**
 * Create initial retry state
 */
export function createRetryState(): RetryState {
  return {
    attempt: 0,
    lastDelay: 0
  };
}

/**
 * Update retry state after a failed attempt
 */
export function updateRetryState(
  state: RetryState,
  error: Error,
  policy: RetryPolicy,
  useJitter: boolean = true,
  jitterType: 'full' | 'equal' | 'decorrelated' = 'equal'
): RetryState {
  const attempt = state.attempt + 1;
  let delay: number;

  if (useJitter) {
    delay = calculateRetryDelayWithJitter(policy, attempt, jitterType, state.lastDelay);
  } else {
    delay = calculateRetryDelay(policy, attempt);
  }

  return {
    attempt,
    lastDelay: delay,
    lastError: error,
    nextRetryAt: Date.now() + delay
  };
}

/**
 * Calculate total retry duration for all attempts
 */
export function calculateTotalRetryDuration(policy: RetryPolicy): number {
  let total = 0;
  for (let i = 0; i < policy.maxRetries; i++) {
    total += calculateRetryDelay(policy, i);
  }
  return total;
}

/**
 * Estimate time until next retry
 */
export function estimateTimeUntilNextRetry(state: RetryState): number | null {
  if (state.nextRetryAt === undefined) {
    return null;
  }
  return Math.max(0, state.nextRetryAt - Date.now());
}
