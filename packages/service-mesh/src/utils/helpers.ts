/**
 * Utility Functions for Service Mesh
 */

/**
 * Generate a unique ID
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

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

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;

  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject((source as any)[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key] as any, (source as any)[key]);
      } else {
        Object.assign(target, { [key]: (source as any)[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Check if value is an object
 */
export function isObject(item: any): item is Record<string, any> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Calculate percentile
 */
export function calculatePercentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;

  const index = Math.ceil((p / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format bytes in human-readable format
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Parse duration string to milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h)$/);

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
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
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
 * Extract hostname from URL
 */
export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Check if two objects are equal deeply
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object' || a === null || b === null) {
    return a === b;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Create a promise that resolves after a timeout
 */
export function createTimeoutPromise<T>(timeout: number, value?: T): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => resolve(value as T), timeout);
  });
}

/**
 * Race multiple promises with timeout
 */
export function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  timeoutError: Error = new Error('Promise timeout')
): Promise<T> {
  return Promise.race([
    promise,
    createTimeoutPromise(timeout).then(() => {
      throw timeoutError;
    })
  ]);
}

/**
 * Batch items into chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

/**
 * Create a sliding window iterator
 */
export function* slidingWindow<T>(array: T[], size: number): Generator<T[]> {
  for (let i = 0; i <= array.length - size; i++) {
    yield array.slice(i, i + size);
  }
}

/**
 * Group array items by key
 */
export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
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
 * Create a circular buffer
 */
export class CircularBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;

  constructor(private capacity: number) {
    this.buffer = new Array<T>(capacity);
  }

  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  pop(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }

    this.tail = (this.tail - 1 + this.capacity) % this.capacity;
    this.size--;

    return this.buffer[this.tail];
  }

  peek(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }

    return this.buffer[(this.tail - 1 + this.capacity) % this.capacity];
  }

  toArray(): T[] {
    const result: T[] = [];

    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[(this.head + i) % this.capacity]);
    }

    return result;
  }

  getLength(): number {
    return this.size;
  }

  isEmpty(): boolean {
    return this.size === 0;
  }

  isFull(): boolean {
    return this.size === this.capacity;
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
}

/**
 * Exponential moving average
 */
export class ExponentialMovingAverage {
  private average: number = 0;
  private initialized: boolean = false;

  constructor(private alpha: number = 0.5) {
    if (alpha <= 0 || alpha > 1) {
      throw new Error('Alpha must be between 0 and 1');
    }
  }

  update(value: number): number {
    if (!this.initialized) {
      this.average = value;
      this.initialized = true;
    } else {
      this.average = this.alpha * value + (1 - this.alpha) * this.average;
    }

    return this.average;
  }

  getAverage(): number {
    return this.average;
  }

  reset(): void {
    this.average = 0;
    this.initialized = false;
  }
}

/**
 * Token bucket rate limiter
 */
export class TokenBucket {
  private lastRefill: number = Date.now();

  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
    private tokens: number = capacity
  ) {}

  consume(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }
}

/**
 * Hash string to number
 */
export function hashString(str: string): number {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash;
}

/**
 * Consistent hash ring
 */
export class ConsistentHashRing {
  private ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];
  private virtualNodes: number = 100;

  constructor(virtualNodes: number = 100) {
    this.virtualNodes = virtualNodes;
  }

  addNode(node: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const key = hashString(`${node}:${i}`);
      this.ring.set(key, node);
      this.sortedKeys.push(key);
    }

    this.sortedKeys.sort((a, b) => a - b);
  }

  removeNode(node: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const key = hashString(`${node}:${i}`);
      this.ring.delete(key);
    }

    this.sortedKeys = this.sortedKeys.filter(k => !this.ring.has(k));
  }

  getNode(key: string): string | undefined {
    if (this.sortedKeys.length === 0) {
      return undefined;
    }

    const hash = hashString(key);

    // Find first node with hash >= key hash
    for (const ringKey of this.sortedKeys) {
      if (ringKey >= hash) {
        return this.ring.get(ringKey);
      }
    }

    // Wrap around to first node
    return this.ring.get(this.sortedKeys[0]);
  }

  getNodes(): string[] {
    return Array.from(new Set(this.ring.values()));
  }
}
