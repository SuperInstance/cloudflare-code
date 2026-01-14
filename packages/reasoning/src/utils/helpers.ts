/**
 * Utility Functions and Helpers
 *
 * Common utilities used across reasoning and planning components.
 */

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Normalize text for comparison
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Extract key phrases from text
 */
export function extractKeyPhrases(text: string, maxPhrases: number = 10): string[] {
  // Simple phrase extraction based on common patterns
  const phrases: string[] = [];

  // Extract quoted phrases
  const quotedPattern = /"([^"]+)"/g;
  let match;
  while ((match = quotedPattern.exec(text)) !== null && phrases.length < maxPhrases) {
    phrases.push(match[1]);
  }

  // Extract capitalized phrases
  const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  while ((match = capitalizedPattern.exec(text)) !== null && phrases.length < maxPhrases) {
    if (match[1].split(' ').length >= 2) {
      phrases.push(match[1]);
    }
  }

  return phrases;
}

/**
 * Calculate text similarity using Jaccard similarity
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).split(' '));
  const words2 = new Set(normalizeText(text2).split(' '));

  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
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
 * Shuffle array randomly
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
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Group array by key function
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
 * Sort array by key function
 */
export function sortBy<T>(array: T[], keyFn: (item: T) => number | string): T[] {
  return [...array].sort((a, b) => {
    const keyA = keyFn(a);
    const keyB = keyFn(b);
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    return 0;
  });
}

// ============================================================================
// Math Utilities
// ============================================================================>

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
 * Calculate average of numbers
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const avg = average(numbers);
  const squareDiffs = numbers.map((n) => Math.pow(n - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * Calculate percentile
 */
export function percentile(numbers: number[], p: number): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Time Utilities
// ============================================================================>

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format timestamp to ISO string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Parse duration string to milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

// ============================================================================
// Object Utilities
// ============================================================================>

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Get nested object property
 */
export function getNestedProperty<T>(
  obj: Record<string, unknown>,
  path: string,
  defaultValue?: T
): T | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return defaultValue;
    }
  }

  return current as T;
}

/**
 * Set nested object property
 */
export function setNestedProperty(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

// ============================================================================
// Validation Utilities
// ============================================================================>

/**
 * Validate that value is within range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  name: string = 'value'
): void {
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}, got ${value}`);
  }
}

/**
 * Validate that value is not empty
 */
export function validateNotEmpty(value: string, name: string = 'value'): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} must not be empty`);
  }
}

/**
 * Validate that value is one of allowed values
 */
export function validateOneOf<T>(
  value: T,
  allowed: T[],
  name: string = 'value'
): void {
  if (!allowed.includes(value)) {
    throw new Error(
      `${name} must be one of: ${allowed.join(', ')}, got ${value}`
    );
  }
}

// ============================================================================
// Async Utilities
// ============================================================================>

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        const delayTime = baseDelay * Math.pow(2, attempt);
        await delay(delayTime);
      }
    }
  }

  throw lastError;
}

/**
 * Execute functions in parallel with concurrency limit
 */
export async function parallel<T>(
  functions: Array<() => Promise<T>>,
  concurrency: number = 10
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const fn of functions) {
    const promise = fn().then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

// ============================================================================
// Logging Utilities
// ============================================================================>

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix: string = '', level: LogLevel = LogLevel.INFO) {
    this.prefix = prefix;
    this.level = level;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[${this.prefix}] DEBUG:`, message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${this.prefix}] INFO:`, message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${this.prefix}] WARN:`, message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${this.prefix}] ERROR:`, message, ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// ============================================================================
// Performance Utilities
// ============================================================================>

export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;
  private checkpoints: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Record a checkpoint
   */
  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now());
  }

  /**
   * Stop the timer
   */
  stop(): number {
    this.endTime = Date.now();
    return this.getDuration();
  }

  /**
   * Get total duration
   */
  getDuration(): number {
    return (this.endTime ?? Date.now()) - this.startTime;
  }

  /**
   * Get duration from checkpoint
   */
  getCheckpointDuration(name: string): number | undefined {
    const checkpointTime = this.checkpoints.get(name);
    if (!checkpointTime) {
      return undefined;
    }
    return checkpointTime - this.startTime;
  }

  /**
   * Get duration between checkpoints
   */
  getDurationBetweenCheckpoints(
    startName: string,
    endName: string
  ): number | undefined {
    const startTime = this.checkpoints.get(startName);
    const endTime = this.checkpoints.get(endName);

    if (startTime === undefined || endTime === undefined) {
      return undefined;
    }

    return endTime - startTime;
  }

  /**
   * Get summary of all timings
   */
  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {
      total: this.getDuration(),
    };

    let previousTime = this.startTime;
    for (const [name, time] of this.checkpoints) {
      summary[name] = time - previousTime;
      previousTime = time;
    }

    return summary;
  }
}

// ============================================================================
// Cache Utilities
// ============================================================================>

export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists
    this.cache.delete(key);

    // Add to end
    this.cache.set(key, value);

    // Evict oldest if over size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Statistics Utilities
// ============================================================================>

export class RollingAverage {
  private values: number[] = [];
  private windowSize: number;

  constructor(windowSize: number = 10) {
    this.windowSize = windowSize;
  }

  add(value: number): void {
    this.values.push(value);
    if (this.values.length > this.windowSize) {
      this.values.shift();
    }
  }

  getAverage(): number {
    if (this.values.length === 0) return 0;
    return this.values.reduce((sum, v) => sum + v, 0) / this.values.length;
  }

  getValues(): number[] {
    return [...this.values];
  }

  clear(): void {
    this.values = [];
  }
}

export class ExponentialMovingAverage {
  private alpha: number;
  private average: number | null = null;

  constructor(alpha: number = 0.2) {
    this.alpha = alpha;
  }

  add(value: number): void {
    if (this.average === null) {
      this.average = value;
    } else {
      this.average = this.alpha * value + (1 - this.alpha) * this.average;
    }
  }

  getAverage(): number {
    return this.average ?? 0;
  }

  reset(): void {
    this.average = null;
  }
}
