/**
 * Utility functions and helpers for edge functions
 */

import { EdgeFunction, FunctionConfig } from '../types/index.js';

// ============================================================================
// Function Creation Helpers
// ============================================================================

/**
 * Create an edge function
 */
export function createEdgeFunction<TInput = unknown, TOutput = unknown>(
  id: string,
  name: string,
  handler: (input: TInput, ctx: any) => Promise<TOutput> | TOutput,
  config?: Partial<FunctionConfig>
): EdgeFunction<TInput, TOutput> {
  return {
    id,
    name,
    handler,
    config: {
      timeout: 30000,
      memoryLimit: 128,
      ...config,
    },
    version: '1.0.0',
  };
}

/**
 * Create a batch of edge functions
 */
export function createEdgeFunctions(
  definitions: Array<{
    id: string;
    name: string;
    handler: (input: unknown, ctx: any) => Promise<unknown> | unknown;
    config?: Partial<FunctionConfig>;
  }>
): EdgeFunction[] {
  return definitions.map(def => createEdgeFunction(def.id, def.name, def.handler, def.config));
}

// ============================================================================
// Request/Response Helpers
// ============================================================================

/**
 * Create an edge request
 */
export function createEdgeRequest<TInput = unknown>(
  functionId: string,
  input: TInput,
  overrides?: Partial<{
    id: string;
    headers: Headers;
    timestamp: number;
    metadata: Record<string, unknown>;
    bypassCache: boolean;
    traceId: string;
    parentSpanId: string;
  }>
) {
  return {
    id: overrides?.id || generateId(),
    functionId,
    input,
    headers: overrides?.headers,
    timestamp: overrides?.timestamp || Date.now(),
    metadata: overrides?.metadata,
    bypassCache: overrides?.bypassCache || false,
    traceId: overrides?.traceId,
    parentSpanId: overrides?.parentSpanId,
  };
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a slug from a string
 */
export function generateSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * Simple hash function for strings
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a hash string
 */
export function generateHash(str: string): string {
  return simpleHash(str).toString(16);
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Measure execution time
 */
export async function measureTime<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Create a timeout promise
 */
export function timeout<T>(ms: number, message?: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message || `Timeout after ${ms}ms`)), ms);
  });
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T> | T,
  ms: number,
  timeoutError?: Error
): Promise<T> {
  return Promise.race([
    fn(),
    timeout<T>(ms, timeoutError?.message),
  ]);
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T> | T,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryIf?: (error: Error) => boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryIf = () => true,
    onRetry,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts || !retryIf(lastError)) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process items in batches
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Process items in parallel with concurrency limit
 */
export async function parallelProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R> | R,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate required fields
 */
export function validateRequired<T extends Record<string, unknown>>(
  obj: T,
  required: (keyof T)[]
): void {
  const missing = required.filter(key => !(key in obj) || obj[key] === undefined);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Validate function configuration
 */
export function validateFunctionConfig(config: FunctionConfig): void {
  if (config.timeout !== undefined && config.timeout < 0) {
    throw new Error('Timeout must be positive');
  }

  if (config.memoryLimit !== undefined) {
    if (config.memoryLimit < 1 || config.memoryLimit > 128) {
      throw new Error('Memory limit must be between 1 and 128 MB');
    }
  }

  if (config.cache?.enabled && config.cache.ttl !== undefined && config.cache.ttl < 0) {
    throw new Error('Cache TTL must be positive');
  }
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Wrap an error with additional context
 */
export function wrapError(error: unknown, message: string): Error {
  if (error instanceof Error) {
    const wrapped = new Error(`${message}: ${error.message}`);
    wrapped.stack = error.stack;
    wrapped.cause = error;
    return wrapped;
  }
  return new Error(`${message}: ${String(error)}`);
}

/**
 * Check if an error is a specific type
 */
export function isErrorType<T extends Error>(
  error: unknown,
  errorType: new (...args: any[]) => T
): error is T {
  return error instanceof errorType;
}

/**
 * Get error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// ============================================================================
// Object Utilities
// ============================================================================

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Check if value is an object
 */
export function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Pick specific keys from an object
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
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
 * Omit specific keys from an object
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
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
// String Utilities
// ============================================================================

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Convert a string to title case
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Shuffle an array
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Remove duplicates from an array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Group array items by a key
 */
export function groupBy<T>(
  array: T[],
  keyGetter: (item: T) => string
): Record<string, T[]> {
  return array.reduce((result, item) => {
    const key = keyGetter(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Create a performance tracker
 */
export function createPerformanceTracker() {
  const marks = new Map<string, number>();

  return {
    mark(name: string): void {
      marks.set(name, performance.now());
    },
    measure(name: string, startMark: string, endMark?: string): number {
      const start = marks.get(startMark);
      if (start === undefined) {
        throw new Error(`Mark not found: ${startMark}`);
      }
      const end = endMark ? marks.get(endMark) : performance.now();
      if (end === undefined) {
        throw new Error(`Mark not found: ${endMark}`);
      }
      return end - start;
    },
    getMark(name: string): number | undefined {
      return marks.get(name);
    },
    clear(): void {
      marks.clear();
    },
  };
}

// ============================================================================
// Environment Utilities
// ============================================================================

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get environment variable with fallback
 */
export function getEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] || fallback;
}

/**
 * Get required environment variable
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable not set: ${key}`);
  }
  return value;
}
