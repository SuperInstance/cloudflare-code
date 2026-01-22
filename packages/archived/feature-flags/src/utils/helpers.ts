/**
 * Utility functions and helpers for feature flags system
 */

import type { UserAttributes, Condition, RuleOperator } from '../types/index.js';

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * Generate a consistent hash from a string
 * Uses MurmurHash3 algorithm for good distribution
 */
export function hashString(input: string): number {
  let h = 0xdeadbeef;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h = Math.imul(h ^ k, 2654435761);
  }
  h = Math.imul(h ^ (h >>> 16), 2654435761);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Generate hash combining multiple values
 */
export function hashMultiple(...values: string[]): number {
  const combined = values.join(':');
  return hashString(combined);
}

/**
 * Generate bucket assignment based on hash
 */
export function getBucket(input: string, buckets: number): number {
  const hash = hashString(input);
  return hash % buckets;
}

/**
 * Generate percentage assignment (0-99)
 */
export function getPercentage(input: string): number {
  const hash = hashString(input);
  return hash % 100;
}

// ============================================================================
// Condition Evaluation
// ============================================================================

/**
 * Evaluate a condition against user attributes
 */
export function evaluateCondition(
  condition: Condition,
  attributes: UserAttributes
): boolean {
  const value = getAttributeValue(attributes, condition.attribute);
  return compareValues(value, condition.operator, condition.value);
}

/**
 * Evaluate multiple conditions with AND/OR logic
 */
export function evaluateConditions(
  conditions: Condition[],
  逻辑: 'AND' | 'OR',
  attributes: UserAttributes
): boolean {
  if (conditions.length === 0) {
    return true;
  }

  const results = conditions.map((c) => evaluateCondition(c, attributes));

  return 逻辑 === 'AND' ? results.every((r) => r) : results.some((r) => r);
}

/**
 * Get attribute value using dot notation
 */
export function getAttributeValue(
  attributes: UserAttributes,
  path: string
): unknown {
  const parts = path.split('.');
  let value: unknown = attributes;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else if (part.startsWith('[') && part.endsWith(']')) {
      // Handle array access
      const index = parseInt(part.slice(1, -1), 10);
      if (
        value &&
        typeof value === 'object' &&
        Array.isArray(value) &&
        !isNaN(index)
      ) {
        value = value[index];
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Compare values using operator
 */
export function compareValues(
  actual: unknown,
  operator: RuleOperator,
  expected: unknown
): boolean {
  switch (operator) {
    case 'equals':
      return actual === expected;

    case 'not_equals':
      return actual !== expected;

    case 'contains':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        actual.toLowerCase().includes(expected.toLowerCase())
      );

    case 'not_contains':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        !actual.toLowerCase().includes(expected.toLowerCase())
      );

    case 'starts_with':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        actual.toLowerCase().startsWith(expected.toLowerCase())
      );

    case 'ends_with':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        actual.toLowerCase().endsWith(expected.toLowerCase())
      );

    case 'greater_than':
      return (
        typeof actual === 'number' &&
        typeof expected === 'number' &&
        actual > expected
      );

    case 'less_than':
      return (
        typeof actual === 'number' &&
        typeof expected === 'number' &&
        actual < expected
      );

    case 'greater_than_or_equal':
      return (
        typeof actual === 'number' &&
        typeof expected === 'number' &&
        actual >= expected
      );

    case 'less_than_or_equal':
      return (
        typeof actual === 'number' &&
        typeof expected === 'number' &&
        actual <= expected
      );

    case 'in':
      return Array.isArray(expected) && expected.includes(actual);

    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual);

    case 'is_one_of':
      return Array.isArray(expected) && expected.includes(actual);

    case 'is_not_one_of':
      return Array.isArray(expected) && !expected.includes(actual);

    case 'regex':
      try {
        const regex = new RegExp(expected as string, 'i');
        return typeof actual === 'string' && regex.test(actual);
      } catch {
        return false;
      }

    default:
      return false;
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate flag key format
 */
export function isValidFlagKey(key: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(key);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate ISO date string
 */
export function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get start of hour
 */
export function startOfHour(date: Date): Date {
  const result = new Date(date);
  result.setMinutes(0, 0, 0);
  return result;
}

/**
 * Get end of hour
 */
export function endOfHour(date: Date): Date {
  const result = new Date(date);
  result.setMinutes(59, 59, 999);
  return result;
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Subtract days from date
 */
export function subDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

/**
 * Get difference in days between two dates
 */
export function diffDays(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((date1.getTime() - date2.getTime()) / msPerDay);
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Convert string to slug
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate string to max length
 */
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return input.slice(0, maxLength - 3) + '...';
}

/**
 * Generate random string
 */
export function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
 * Shuffle array
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Sample random elements from array
 */
export function sample<T>(array: T[], count: number): T[] {
  const shuffled = shuffle(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

// ============================================================================
// Number Utilities
// ============================================================================

/**
 * Clamp number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Round to decimal places
 */
export function roundTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Calculate percentage
 */
export function percentage(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

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
 * Create a throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

// ============================================================================
// Retry Utilities
// ============================================================================

/**
 * Retry function with exponential backoff
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
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts - 1) {
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        );

        onRetry?.(attempt + 1, lastError);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Promise Utilities
// ============================================================================

/**
 * Execute promises with concurrency limit
 */
export async function parallel<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<unknown>,
  concurrency: number = 10
): Promise<void> {
  const executing: Promise<unknown>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i], i).then(() => {
      executing.splice(executing.indexOf(promise), 1);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

/**
 * Batch items into groups
 */
export async function batch<T, R>(
  items: T[],
  fn: (batch: T[]) => Promise<R[]>,
  batchSize: number = 100
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batchItems = items.slice(i, i + batchSize);
    const batchResults = await fn(batchItems);
    results.push(...batchResults);
  }

  return results;
}
