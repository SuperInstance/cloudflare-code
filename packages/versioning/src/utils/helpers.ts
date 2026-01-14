/**
 * Helper utilities for versioning operations
 */

import type {
  SemVer,
  APIEndpoint,
  APIParameter,
  DeprecationRecord,
  MigrationStep,
  BreakingChange,
} from '../types/index.js';

/**
 * Extract version from various sources
 */
export function extractVersion(
  source: string | Headers | URLSearchParams | undefined
): string | null {
  if (!source) return null;

  if (typeof source === 'string') {
    // Direct version string
    if (/^\d+\.\d+\.\d+$/.test(source)) {
      return source;
    }

    // Extract from URL path
    const pathMatch = source.match(/\/v(\d+\.\d+\.\d+)\//);
    if (pathMatch) return pathMatch[1];

    // Extract from Content-Type/Accept header
    const vndMatch = source.match(/vnd\.claudeflare\.v(\d+\.\d+\.\d+)/);
    if (vndMatch) return vndMatch[1];
  }

  if (source instanceof Headers) {
    // Check common version headers
    const versionHeaders = [
      'API-Version',
      'X-API-Version',
      'Api-Version',
      'Accept',
      'Content-Type',
    ];

    for (const header of versionHeaders) {
      const value = source.get(header);
      if (value) {
        const extracted = extractVersion(value);
        if (extracted) return extracted;
      }
    }
  }

  if (source instanceof URLSearchParams) {
    const version = source.get('version') || source.get('api_version');
    if (version && /^\d+\.\d+\.\d+$/.test(version)) {
      return version;
    }
  }

  return null;
}

/**
 * Format date for headers
 */
export function formatDateForHeader(date: Date): string {
  return date.toUTCString();
}

/**
 * Parse date from header
 */
export function parseDateFromHeader(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Calculate days between dates
 */
export function daysBetween(from: Date, to: Date): number {
  const diff = to.getTime() - from.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if date is in future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Check if date is in past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Format duration for display
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}

/**
 * Merge objects deeply
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key] as any);
    } else {
      result[key] = source[key] as any;
    }
  }

  return result;
}

/**
 * Clone object deeply
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Sanitize string for use in IDs
 */
export function sanitizeId(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Deduplicate array
 */
export function uniqueArray<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Sort array of objects by key
 */
export function sortByKey<T>(array: T[], key: keyof T): T[] {
  return array.slice().sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
}

/**
 * Group array by key
 */
export function groupByKey<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: any): boolean {
  if (!obj) return true;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}

/**
 * Pick specific keys from object
 */
export function pick<T extends object, K extends keyof T>(
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
 * Omit specific keys from object
 */
export function omit<T extends object, K extends keyof T>(
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
 * Safe JSON parse
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Safe JSON stringify
 */
export function safeJsonStringify(obj: any, fallback: string = '{}'): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return fallback;
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
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

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  func: () => Promise<T>,
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
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await func();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Parse semver from string
 */
export function parseSemver(version: string): SemVer | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9a-zA-Z.-]+))?(?:\+([0-9a-zA-Z.-]+))?$/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] ? match[4].split('.') : undefined,
    build: match[5] ? match[5].split('.') : undefined,
  };
}

/**
 * Compare semver versions
 */
export function compareSemver(v1: SemVer, v2: SemVer): number {
  if (v1.major !== v2.major) return v1.major - v2.major;
  if (v1.minor !== v2.minor) return v1.minor - v2.minor;
  if (v1.patch !== v2.patch) return v1.patch - v2.patch;

  // Compare prerelease
  const p1 = v1.prerelease || [];
  const p2 = v2.prerelease || [];

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const p1Val = p1[i] ? parseInt(p1[i], 10) : 0;
    const p2Val = p2[i] ? parseInt(p2[i], 10) : 0;
    if (p1Val !== p2Val) return p1Val - p2Val;
  }

  return 0;
}

/**
 * Format semver to string
 */
export function formatSemver(semver: SemVer): string {
  const base = `${semver.major}.${semver.minor}.${semver.patch}`;
  const prerelease = semver.prerelease && semver.prerelease.length ? `-${semver.prerelease.join('.')}` : '';
  const build = semver.build && semver.build.length ? `+${semver.build.join('.')}` : '';
  return base + prerelease + build;
}

/**
 * Validate endpoint path
 */
export function validateEndpointPath(path: string): boolean {
  return /^\/[a-zA-Z0-9/_\-{}]*$/.test(path);
}

/**
 * Validate HTTP method
 */
export function validateHttpMethod(method: string): boolean {
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'];
  return validMethods.includes(method.toUpperCase());
}

/**
 * Validate parameter name
 */
export function validateParameterName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Parse content type
 */
export function parseContentType(contentType: string): {
  type: string;
  subtype: string;
  charset?: string;
  version?: string;
} {
  const parts = contentType.split(';').map(p => p.trim());
  const [type, subtype] = parts[0].split('/');

  const result: any = { type, subtype };

  for (let i = 1; i < parts.length; i++) {
    const [key, value] = parts[i].split('=');
    if (key && value) {
      result[key] = value.replace(/"/g, '');
    }
  }

  return result;
}

/**
 * Format error response
 */
export function formatErrorResponse(error: Error, includeStack: boolean = false): {
  message: string;
  stack?: string;
} {
  const response: any = {
    message: error.message,
  };

  if (includeStack && error.stack) {
    response.stack = error.stack;
  }

  return response;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100;
}

/**
 * Format bytes for display
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
 * Format number for display
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Create URL with query parameters
 */
export function createUrl(baseUrl: string, params: Record<string, string | number | boolean>): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

/**
 * Parse URL parameters
 */
export function parseUrlParams(url: string): Record<string, string> {
  const urlObj = new URL(url);
  const params: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/**
 * Check if URL is valid
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
 * Merge query parameters
 */
export function mergeQueryParams(
  url: string,
  params: Record<string, string | number | boolean>
): string {
  const urlObj = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    urlObj.searchParams.set(key, String(value));
  });
  return urlObj.toString();
}
