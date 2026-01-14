/**
 * Timing and scheduling utilities
 */

/**
 * Create a promise that resolves after a specified delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a promise that rejects after a specified timeout
 */
export function timeout<T>(promise: Promise<T>, ms: number, error: Error = new Error('Operation timed out')): Promise<T> {
  return Promise.race([
    promise,
    (async () => {
      await delay(ms);
      throw error;
    })()
  ]);
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    multiplier?: number;
    jitter?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    multiplier = 2,
    jitter = true,
    onRetry
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        break;
      }

      const delayMs = calculateBackoff(attempt, initialDelay, maxDelay, multiplier, jitter);
      onRetry?.(attempt, lastError);
      await delay(delayMs);
    }
  }

  throw lastError;
}

/**
 * Calculate exponential backoff delay with optional jitter
 */
export function calculateBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
  jitter: boolean
): number {
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
  const delayMs = Math.min(exponentialDelay, maxDelay);

  if (jitter) {
    // Add random jitter up to 25% of the delay
    const jitterAmount = delayMs * 0.25;
    return delayMs - (jitterAmount / 2) + Math.random() * jitterAmount;
  }

  return delayMs;
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function debounced(...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  let lastArgs: Parameters<T> | undefined;

  return function throttled(...args: Parameters<T>) {
    lastArgs = args;

    if (!inThrottle) {
      func(...lastArgs);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = undefined;
        }
      }, limit);
    }
  };
}

/**
 * Measure execution time of an async function
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Create a token bucket rate limiter
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillRate: number, // tokens per second
    private readonly currentTime: () => number = Date.now
  ) {
    this.tokens = capacity;
    this.lastRefill = currentTime();
  }

  /**
   * Try to consume tokens from the bucket
   */
  async tryConsume(tokens: number): Promise<boolean> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Consume tokens or wait until available
   */
  async consume(tokens: number): Promise<void> {
    while (!await this.tryConsume(tokens)) {
      const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
      await delay(Math.max(waitTime, 1));
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = this.currentTime();
    const elapsed = (now - this.lastRefill) / 1000; // convert to seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Get current token count
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Create a sliding window rate limiter
 */
export class SlidingWindowRateLimiter {
  private requests: number[] = [];

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly currentTime: () => number = Date.now
  ) {}

  /**
   * Check if a request is allowed
   */
  async tryRequest(): Promise<boolean> {
    const now = this.currentTime();

    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }

    return false;
  }

  /**
   * Wait until a request slot is available
   */
  async request(): Promise<void> {
    while (!await this.tryRequest()) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.windowMs - this.currentTime();
      if (waitTime > 0) {
        await delay(waitTime);
      }
    }
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }

  /**
   * Get current request count
   */
  getRequestCount(): number {
    const now = this.currentTime();
    return this.requests.filter(time => now - time < this.windowMs).length;
  }
}
