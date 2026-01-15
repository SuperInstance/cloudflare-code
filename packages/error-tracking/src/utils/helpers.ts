/**
 * Utility functions for error tracking
 */

import { ErrorEvent, ErrorSeverity, ErrorCategory, ErrorPriority } from '../types';

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Check if value is an error
 */
export function isError(value: any): value is Error {
  return value instanceof Error || (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'stack' in value
  );
}

/**
 * Serialize error for transport
 */
export function serializeError(error: Error | any): any {
  if (!isError(error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...Object.getOwnPropertyNames(error).reduce((obj, key) => {
      if (key !== 'name' && key !== 'message' && key !== 'stack') {
        obj[key] = (error as any)[key];
      }
      return obj;
    }, {} as any)
  };
}

/**
 * Extract error message
 */
export function getErrorMessage(error: any): string {
  if (isError(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    return error.message || error.toString() || 'Unknown error';
  }

  return 'Unknown error';
}

/**
 * Extract error stack trace
 */
export function getErrorStack(error: any): string | undefined {
  if (isError(error)) {
    return error.stack;
  }

  return undefined;
}

/**
 * Get error type name
 */
export function getErrorType(error: any): string {
  if (isError(error)) {
    return error.name || 'Error';
  }

  if (error && typeof error === 'object' && error.constructor) {
    return error.constructor.name || 'Error';
  }

  return 'Error';
}

// ============================================================================
// Severity Utilities
// ============================================================================

/**
 * Get numeric severity value for comparison
 */
export function getSeverityValue(severity: ErrorSeverity): number {
  const values: Record<ErrorSeverity, number> = {
    [ErrorSeverity.INFO]: 0,
    [ErrorSeverity.LOW]: 1,
    [ErrorSeverity.MEDIUM]: 2,
    [ErrorSeverity.HIGH]: 3,
    [ErrorSeverity.CRITICAL]: 4
  };

  return values[severity] || 2;
}

/**
 * Compare severities
 */
export function compareSeverity(severity1: ErrorSeverity, severity2: ErrorSeverity): number {
  return getSeverityValue(severity1) - getSeverityValue(severity2);
}

/**
 * Check if severity is at least a certain level
 */
export function isSeverityAtLeast(
  severity: ErrorSeverity,
  minimum: ErrorSeverity
): boolean {
  return getSeverityValue(severity) >= getSeverityValue(minimum);
}

/**
 * Get highest severity
 */
export function getHighestSeverity(severities: ErrorSeverity[]): ErrorSeverity {
  if (severities.length === 0) {
    return ErrorSeverity.INFO;
  }

  return severities.reduce((highest, current) =>
    compareSeverity(current, highest) > 0 ? current : highest
  );
}

// ============================================================================
// Priority Utilities
// ============================================================================

/**
 * Get numeric priority value
 */
export function getPriorityValue(priority: ErrorPriority): number {
  return priority;
}

/**
 * Compare priorities
 */
export function comparePriority(priority1: ErrorPriority, priority2: ErrorPriority): number {
  return priority1 - priority2;
}

/**
 * Check if priority is at least a certain level
 */
export function isPriorityAtLeast(
  priority: ErrorPriority,
  maximum: ErrorPriority
): boolean {
  return getPriorityValue(priority) <= getPriorityValue(maximum);
}

/**
 * Get highest priority (lowest number)
 */
export function getHighestPriority(priorities: ErrorPriority[]): ErrorPriority {
  if (priorities.length === 0) {
    return ErrorPriority.P4;
  }

  return priorities.reduce((highest, current) =>
    comparePriority(current, highest) < 0 ? current : highest
  );
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number, format: 'iso' | 'relative' | 'date' = 'iso'): string {
  switch (format) {
    case 'iso':
      return new Date(timestamp).toISOString();

    case 'relative':
      return getRelativeTime(timestamp);

    case 'date':
      return new Date(timestamp).toLocaleString();

    default:
      return new Date(timestamp).toISOString();
  }
}

/**
 * Get relative time string
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return `${seconds}s ago`;
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}

/**
 * Get time range timestamps
 */
export function getTimeRange(period: 'hour' | 'day' | 'week' | 'month'): { start: number; end: number } {
  const now = Date.now();
  let start: number;

  switch (period) {
    case 'hour':
      start = now - 3600000;
      break;
    case 'day':
      start = now - 86400000;
      break;
    case 'week':
      start = now - 604800000;
      break;
    case 'month':
      start = now - 2592000000;
      break;
  }

  return { start, end: now };
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }

  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Sanitize string for display
 */
export function sanitize(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Highlight code in stack trace
 */
export function highlightStackTrace(stack: string): string {
  const lines = stack.split('\n');
  const highlighted = lines.map(line => {
    // Highlight error message
    if (line.match(/^(Error|TypeError|ReferenceError|SyntaxError|RangeError)/)) {
      return `<span class="error-type">${line}</span>`;
    }

    // Highlight file paths
    return line.replace(/at (.+?) \((.+?):(\d+):(\d+)\)/, (_, fn, file, line, col) =>
      `at <span class="function-name">${fn}</span> (<span class="file-path">${file}</span>:<span class="line-number">${line}</span>:<span class="column-number">${col}</span>)`
    );
  });

  return highlighted.join('\n');
}

// ============================================================================
// Math Utilities
// ============================================================================

/**
 * Calculate percentile
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate average
 */
export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate median
 */
export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const avg = average(values);
  const squareDiffs = values.map(val => Math.pow(val - avg, 2));
  const avgSquareDiff = average(squareDiffs);

  return Math.sqrt(avgSquareDiff);
}

// ============================================================================
// Object Utilities
// ============================================================================

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as any;
  }

  if (obj instanceof Object) {
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(...objects: T[]): T {
  const result: any = {};

  for (const obj of objects) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          result[key] = deepMerge(result[key] || {}, obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
    }
  }

  return result;
}

/**
 * Pick properties from object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Omit properties from object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };

  for (const key of keys) {
    delete result[key];
  }

  return result as Omit<T, K>;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate UUID
 */
export function isValidUuid(uuid: string): boolean {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

// ============================================================================
// Rate Limiting Utilities
// ============================================================================()

export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request should be allowed
   */
  allow(): boolean {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    // Check if under limit
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }

    return false;
  }

  /**
   * Get remaining requests
   */
  getRemaining(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  /**
   * Get reset time
   */
  getResetTime(): number {
    if (this.requests.length === 0) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    return oldestRequest + this.windowMs;
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.requests = [];
  }
}

// ============================================================================
// Retry Utilities
// ============================================================================

export class RetryHandler {
  /**
   * Execute function with retry logic
   */
  static async execute<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delay?: number;
      backoff?: boolean;
      maxDelay?: number;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delay = 1000,
      backoff = true,
      maxDelay = 30000
    } = options;

    let lastError: Error | undefined;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          throw lastError;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, currentDelay));

        // Calculate next delay with exponential backoff
        if (backoff) {
          currentDelay = Math.min(currentDelay * 2, maxDelay);
        }
      }
    }

    throw lastError!;
  }
}

// ============================================================================
// Debounce/Throttle Utilities
// ============================================================================

export class Debouncer<T extends any[]> {
  private timeout: NodeJS.Timeout | null = null;
  private fn: (...args: T) => void;
  private delay: number;

  constructor(fn: (...args: T) => void, delay: number) {
    this.fn = fn;
    this.delay = delay;
  }

  /**
   * Execute debounced function
   */
  execute(...args: T): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.fn(...args);
      this.timeout = null;
    }, this.delay);
  }

  /**
   * Cancel pending execution
   */
  cancel(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  /**
   * Execute immediately without delay
   */
  flush(...args: T): void {
    this.cancel();
    this.fn(...args);
  }
}

export class Throttler<T extends any[]> {
  private lastExecution: number = 0;
  private fn: (...args: T) => void;
  private delay: number;
  private pendingArgs: T | null = null;
  private timeout: NodeJS.Timeout | null = null;

  constructor(fn: (...args: T) => void, delay: number) {
    this.fn = fn;
    this.delay = delay;
  }

  /**
   * Execute throttled function
   */
  execute(...args: T): void {
    const now = Date.now();
    const timeSinceLastExecution = now - this.lastExecution;

    if (timeSinceLastExecution >= this.delay) {
      this.lastExecution = now;
      this.fn(...args);
      this.pendingArgs = null;
    } else {
      this.pendingArgs = args;

      if (!this.timeout) {
        this.timeout = setTimeout(() => {
          if (this.pendingArgs) {
            this.lastExecution = Date.now();
            this.fn(...this.pendingArgs);
            this.pendingArgs = null;
          }
          this.timeout = null;
        }, this.delay - timeSinceLastExecution);
      }
    }
  }

  /**
   * Cancel pending execution
   */
  cancel(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.pendingArgs = null;
  }
}
