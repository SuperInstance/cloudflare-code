/**
 * Utility functions for data pipelines
 */

import type { StreamEvent } from '../types';

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

/**
 * Flatten nested arrays
 */
export function flatten<T>(arrays: T[][]): T[] {
  return arrays.flat();
}

/**
 * Unique values from array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);

    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Sort array by key
 */
export function sortBy<T>(array: T[], keyFn: (item: T) => any): T[] {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);

    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
}

// ============================================================================
// Object Utilities
// ============================================================================

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(...objs: T[]): T {
  const result = {} as T;

  for (const obj of objs) {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Pick keys from object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce((result, key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
    return result;
  }, {} as Pick<T, K>);
}

/**
 * Omit keys from object
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

/**
 * Get nested value from object
 */
export function get(obj: Record<string, any>, path: string, defaultValue?: any): any {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }

  return value;
}

/**
 * Set nested value in object
 */
export function set(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  let current = obj;

  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Generate random ID
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Slugify string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate string
 */
export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (str.length <= length) {
    return str;
  }

  return str.substring(0, length - suffix.length) + suffix;
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Format date
 */
export function formatDate(date: Date, format: string = 'ISO'): string {
  switch (format) {
    case 'ISO':
      return date.toISOString();

    case 'date':
      return date.toISOString().split('T')[0];

    case 'time':
      return date.toISOString().split('T')[1].split('.')[0];

    case 'timestamp':
      return String(date.getTime());

    default:
      return date.toISOString();
  }
}

/**
 * Parse date
 */
export function parseDate(value: string | number | Date): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return date;
}

/**
 * Add time to date
 */
export function addTime(date: Date, amount: number, unit: 'ms' | 's' | 'm' | 'h' | 'd'): Date {
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000
  };

  return new Date(date.getTime() + amount * multipliers[unit]);
}

// ============================================================================
// Number Utilities
// ============================================================================

/**
 * Clamp number between min and max
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Round to decimal places
 */
export function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Generate range of numbers
 */
export function range(start: number, end: number, step: number = 1): number[] {
  const result: number[] = [];

  for (let i = start; i < end; i += step) {
    result.push(i);
  }

  return result;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Check if value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if value is empty
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (Array.isArray(value) || typeof value === 'string') {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
}

/**
 * Check if value is a plain object
 */
export function isPlainObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate email
 */
export function isEmail(str: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(str);
}

/**
 * Validate URL
 */
export function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Async Utilities
// ============================================================================

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry async function
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number; backoff?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delay: delayMs = 1000, backoff = 2 } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        await delay(delayMs * Math.pow(backoff, attempt - 1));
      }
    }
  }

  throw lastError;
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ]);
}

/**
 * Batch async operations
 */
export async function batchAsync<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number
): Promise<R[]> {
  const results: R[] = [];

  for (const batch of chunk(items, batchSize)) {
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}

// ============================================================================
// Stream Utilities
// ============================================================================

/**
 * Convert async generator to array
 */
export async function asyncToArray<T>(generator: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];

  for await (const item of generator) {
    results.push(item);
  }

  return results;
}

/**
 * Create async generator from array
 */
export function arrayToAsync<T>(array: T[]): AsyncGenerator<T> {
  return (async function* () {
    for (const item of array) {
      yield item;
    }
  })();
}

/**
 * Map async generator
 */
export async function* asyncMap<T, R>(
  generator: AsyncGenerator<T>,
  fn: (item: T) => Promise<R>
): AsyncGenerator<R> {
  for await (const item of generator) {
    yield await fn(item);
  }
}

/**
 * Filter async generator
 */
export async function* asyncFilter<T>(
  generator: AsyncGenerator<T>,
  predicate: (item: T) => boolean | Promise<boolean>
): AsyncGenerator<T> {
  for await (const item of generator) {
    if (await predicate(item)) {
      yield item;
    }
  }
}

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Measure execution time
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;

  return { result, duration };
}

/**
 * Create memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);

    return result;
  }) as T;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= interval) {
      lastCall = now;
      fn(...args);
    }
  };
}

// ============================================================================
// Logging Utilities
// ============================================================================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}
