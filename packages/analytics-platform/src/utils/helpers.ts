/**
 * Analytics Utility Functions
 */

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Calculate growth rate
 */
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(data: number[], window: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }

  return result;
}

/**
 * Calculate percentile
 */
export function calculatePercentile(data: number[], percentile: number): number {
  const sorted = [...data].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Bucket data into ranges
 */
export function bucketData(data: number[], bucketCount: number): { min: number; max: number; count: number }[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  const bucketSize = range / bucketCount;

  const buckets: { min: number; max: number; count: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      min: min + i * bucketSize,
      max: min + (i + 1) * bucketSize,
      count: 0,
    });
  }

  for (const value of data) {
    const bucketIndex = Math.min(Math.floor((value - min) / bucketSize), bucketCount - 1);
    buckets[bucketIndex].count++;
  }

  return buckets;
}

/**
 * Format number with suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Calculate compound annual growth rate
 */
export function calculateCAGR(startValue: number, endValue: number, periods: number): number {
  if (startValue <= 0 || periods <= 0) return 0;
  return (Math.pow(endValue / startValue, 1 / periods) - 1) * 100;
}

/**
 * Calculate retention rate
 */
export function calculateRetentionRate(retained: number, total: number): number {
  if (total === 0) return 0;
  return (retained / total) * 100;
}

/**
 * Calculate churn rate
 */
export function calculateChurnRate(churned: number, total: number): number {
  if (total === 0) return 0;
  return (churned / total) * 100;
}

/**
 * Calculate LTV (Lifetime Value)
 */
export function calculateLTV(arpu: number, retentionRate: number): number {
  if (retentionRate >= 1) return Infinity;
  return arpu / (1 - retentionRate);
}

/**
 * Calculate CAC (Customer Acquisition Cost) payback period
 */
export function calculateCACPayback(cac: number, arpu: number): number {
  if (arpu === 0) return Infinity;
  return cac / arpu;
}

/**
 * Calculate session duration
 */
export function calculateSessionDuration(startTime: number, endTime: number): number {
  return endTime - startTime;
}

/**
 * Calculate bounce rate
 */
export function calculateBounceRate(singlePageSessions: number, totalSessions: number): number {
  if (totalSessions === 0) return 0;
  return (singlePageSessions / totalSessions) * 100;
}

/**
 * Round to decimal places
 */
export function roundTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Safe division
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (denominator === 0) return fallback;
  return numerator / denominator;
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map((value) => Math.pow(value - mean, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
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
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Sleep function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Batch array into chunks
 */
export function batch<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  for (const item of array) {
    const groupKey = typeof key === 'function' ? key(item) : String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
  }

  return groups;
}

/**
 * Merge objects recursively
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

function isObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Parse time range
 */
export function parseTimeRange(range: string): { start: number; end: number } {
  const now = Date.now();
  const unit = 1000;

  switch (range) {
    case '1h':
      return { start: now - unit * 60 * 60, end: now };
    case '24h':
      return { start: now - unit * 60 * 60 * 24, end: now };
    case '7d':
      return { start: now - unit * 60 * 60 * 24 * 7, end: now };
    case '30d':
      return { start: now - unit * 60 * 60 * 24 * 30, end: now };
    case '90d':
      return { start: now - unit * 60 * 60 * 24 * 90, end: now };
    case '1y':
      return { start: now - unit * 60 * 60 * 24 * 365, end: now };
    default:
      return { start: now - unit * 60 * 60 * 24, end: now };
  }
}

/**
 * Format bytes
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate URL
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get nested property
 */
export function getNestedProperty<T>(obj: any, path: string): T | undefined {
  const parts = path.split('.');
  let value = obj;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value as T;
}

/**
 * Set nested property
 */
export function setNestedProperty(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Remove undefined values from object
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as T;
}

/**
 * Flatten object
 */
export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (isObject(value) && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Unflatten object
 */
export function unflattenObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [path, value] of Object.entries(obj)) {
    setNestedProperty(result, path, value);
  }

  return result;
}
