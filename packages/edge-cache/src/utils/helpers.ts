/**
 * Utility Functions for Edge Cache Optimization
 */

/**
 * Generate a cache key from URL and metadata
 */
export function generateCacheKey(
  url: string,
  method: string = 'GET',
  varyHeaders?: Record<string, string>
): string {
  const urlObj = new URL(url);
  const parts = [method, urlObj.pathname];

  // Add query parameters for cache key
  const params = new URLSearchParams(urlObj.search);
  const cacheableParams = ['page', 'limit', 'sort', 'filter', 'search'];
  const paramParts: string[] = [];

  for (const [key, value] of params) {
    if (cacheableParams.includes(key)) {
      paramParts.push(`${key}=${value}`);
    }
  }

  if (paramParts.length > 0) {
    parts.push(paramParts.join('&'));
  }

  // Add vary headers
  if (varyHeaders) {
    const headerParts = Object.entries(varyHeaders)
      .map(([k, v]) => `${k}=${v}`)
      .sort();
    if (headerParts.length > 0) {
      parts.push(headerParts.join(','));
    }
  }

  return parts.join(':');
}

/**
 * Parse cache control header
 */
export function parseCacheControl(header: string): {
  maxAge?: number;
  sMaxAge?: number;
  noCache: boolean;
  noStore: boolean;
  mustRevalidate: boolean;
  staleWhileRevalidate?: number;
} {
  const directives = header.split(',').map((d) => d.trim().split('='));
  const result: any = {
    noCache: false,
    noStore: false,
    mustRevalidate: false,
  };

  for (const [name, value] of directives) {
    switch (name.toLowerCase()) {
      case 'max-age':
        result.maxAge = parseInt(value || '0', 10);
        break;
      case 's-maxage':
        result.sMaxAge = parseInt(value || '0', 10);
        break;
      case 'no-cache':
        result.noCache = true;
        break;
      case 'no-store':
        result.noStore = true;
        break;
      case 'must-revalidate':
        result.mustRevalidate = true;
        break;
      case 'stale-while-revalidate':
        result.staleWhileRevalidate = parseInt(value || '0', 10);
        break;
    }
  }

  return result;
}

/**
 * Calculate hash of a string
 */
export async function calculateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compress data using gzip
 */
export async function compress(data: ArrayBuffer): Promise<ArrayBuffer> {
  const compressionStream = new CompressionStream('gzip');
  const writer = compressionStream.writable.getWriter();
  await writer.write(new Uint8Array(data));
  await writer.close();

  const reader = compressionStream.readable.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

/**
 * Decompress gzip data
 */
export async function decompress(data: ArrayBuffer): Promise<ArrayBuffer> {
  const decompressionStream = new DecompressionStream('gzip');
  const writer = decompressionStream.writable.getWriter();
  await writer.write(new Uint8Array(data));
  await writer.close();

  const reader = decompressionStream.readable.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts - 1) {
        const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Batch operations
 */
export async function batch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  options: {
    concurrency?: number;
    batchSize?: number;
  } = {}
): Promise<R[]> {
  const { concurrency = 5, batchSize = 10 } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.slice(0, concurrency).map(fn)
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = undefined;
        fn(...args);
      }, remaining);
    }
  };
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

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
 * Calculate percentiles
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((sorted.length - 1) * (percentile / 100));

  return sorted[index];
}

/**
 * Calculate average
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate median
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Format duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format bytes
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
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Clamp a value between min and max
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
 * Map a value from one range to another
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
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Check if a value is a promise
 */
export function isPromise(value: unknown): value is Promise<unknown> {
  return value instanceof Promise || (typeof value === 'object' && value !== null && 'then' in value);
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  const result = { ...target };

  for (const source of sources) {
    for (const key in source) {
      if (source[key] instanceof Object && key in result && result[key] instanceof Object) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        Object.assign(result, { [key]: source[key] });
      }
    }
  }

  return result;
}
