/**
 * Time utilities
 */

/**
 * Format milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${minutes % 60}m`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/**
 * Parse duration string to milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Get timestamp in seconds
 */
export function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;

  return { result, duration };
}

/**
 * Create a timeout promise
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    )
  ]);
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    onRetry
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        break;
      }

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(
  attempt: number,
  initialDelay: number = 1000,
  maxDelay: number = 30000,
  multiplier: number = 2
): number {
  return Math.min(initialDelay * Math.pow(multiplier, attempt - 1), maxDelay);
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= interval) {
      lastCall = now;
      fn(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
      }, interval - timeSinceLastCall);
    }
  };
}

/**
 * Create a cron-style interval
 */
export function cronInterval(
  expression: string,
  callback: () => void | Promise<void>,
  options?: {
    immediate?: boolean;
    timeZone?: string;
  }
): () => void {
  let timeoutId: NodeJS.Timeout | undefined;
  let running = true;

  const scheduleNext = () => {
    if (!running) {
      return;
    }

    // This would use CronParser to calculate next execution
    // For now, just use a simple interval
    timeoutId = setTimeout(async () => {
      if (running) {
        try {
          await callback();
        } catch (error) {
          console.error('Cron interval error:', error);
        }
        scheduleNext();
      }
    }, 60000); // Default to 1 minute
  };

  if (options?.immediate) {
    const result = callback();
    if (result && typeof result.then === 'function') {
      result.then(scheduleNext);
    } else {
      scheduleNext();
    }
  } else {
    scheduleNext();
  }

  return () => {
    running = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}
