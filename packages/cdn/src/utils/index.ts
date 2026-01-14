/**
 * Utility functions
 */

import { URL } from 'url';
import type { IRequestContext, IGeoInfo } from '../types/index.js';

/**
 * Parse request context from headers
 */
export function parseRequestContext(
  url: string,
  headers: Record<string, string>
): IRequestContext {
  const context: IRequestContext = {
    url,
    method: headers[':method'] || 'GET',
    headers
  };

  // Extract IP from various headers
  context.ip =
    headers['cf-connecting-ip'] ||
    headers['x-forwarded-for']?.split(',')[0] ||
    headers['x-real-ip'] ||
    undefined;

  // Extract country
  context.country = headers['cf-ipcountry'] || headers['cf-country'] || undefined;

  // Extract device info
  const userAgent = headers['user-agent'];
  context.userAgent = userAgent;

  if (userAgent) {
    if (/mobile/i.test(userAgent)) {
      context.device = 'mobile';
    } else if (/tablet/i.test(userAgent)) {
      context.device = 'tablet';
    } else {
      context.device = 'desktop';
    }
  }

  // Extract referer
  context.referer = headers['referer'];

  return context;
}

/**
 * Parse Cloudflare headers
 */
export function parseCloudflareHeaders(
  headers: Record<string, string>
): {
  ip: string | undefined;
  country: string | undefined;
  colo: string | undefined;
  ray: string | undefined;
  tlsVersion: string | undefined;
  httpVersion: string | undefined;
} {
  return {
    ip: headers['cf-connecting-ip'],
    country: headers['cf-ipcountry'],
    colo: headers['cf-ray']?.split('-')[1],
    ray: headers['cf-ray'],
    tlsVersion: headers['cf-visitor'] ? JSON.parse(headers['cf-visitor']).scheme : undefined,
    httpVersion: headers['cf-visitor'] ? headers['cf-visitor'] : undefined
  };
}

/**
 * Generate cache key from URL and headers
 */
export function generateCacheKey(
  url: string,
  headers: Record<string, string>,
  vary?: string[]
): string {
  const urlObj = new URL(url);
  let key = urlObj.pathname + urlObj.search;

  // Include Vary headers in cache key
  if (vary && vary.length > 0) {
    const varyValues = vary
      .map(header => headers[header.toLowerCase()])
      .filter(Boolean)
      .join('|');

    if (varyValues) {
      key = `${key}:${varyValues}`;
    }
  }

  return key;
}

/**
 * Parse range header
 */
export function parseRangeHeader(
  rangeHeader: string | undefined,
  fileSize: number
): { start: number; end: number } | null {
  if (!rangeHeader) {
    return null;
  }

  const matches = /bytes=(\d+)-(\d+)/.exec(rangeHeader);
  if (!matches) {
    return null;
  }

  const start = parseInt(matches[1], 10);
  const end = parseInt(matches[2], 10);

  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

/**
 * Generate Content-Range header
 */
export function generateContentRangeHeader(
  start: number,
  end: number,
  total: number
): string {
  return `bytes ${start}-${end}/${total}`;
}

/**
 * Check if request is conditional
 */
export function isConditionalRequest(
  headers: Record<string, string>
): boolean {
  return !!(
    headers['if-none-match'] ||
    headers['if-modified-since'] ||
    headers['if-match'] ||
    headers['if-unmodified-since']
  );
}

/**
 * Parse accept encoding
 */
export function parseAcceptEncoding(
  acceptEncoding: string | undefined
): string[] {
  if (!acceptEncoding) {
    return ['identity'];
  }

  return acceptEncoding
    .split(',')
    .map(encoding => encoding.trim().split(';')[0])
    .filter(Boolean);
}

/**
 * Determine best encoding
 */
export function determineBestEncoding(
  acceptEncoding: string | undefined,
  supportedEncodings: string[]
): string {
  const accepted = parseAcceptEncoding(acceptEncoding);

  for (const encoding of accepted) {
    if (supportedEncodings.includes(encoding)) {
      return encoding;
    }
  }

  return 'identity';
}

/**
 * Calculate age header value
 */
export function calculateAge(date: Date, maxAge: number): number {
  const age = Math.floor((Date.now() - date.getTime()) / 1000);
  return Math.max(0, Math.min(age, maxAge));
}

/**
 * Parse cache control header
 */
export function parseCacheControl(
  cacheControl: string | undefined
): Record<string, string | boolean> {
  const directives: Record<string, string | boolean> = {};

  if (!cacheControl) {
    return directives;
  }

  for (const part of cacheControl.split(',')) {
    const [key, value] = part.trim().split('=');
    directives[key] = value === undefined ? true : value;
  }

  return directives;
}

/**
 * Generate cache control header
 */
export function generateCacheControlHeader(directives: Record<string, string | boolean>): string {
  return Object.entries(directives)
    .map(([key, value]) => (value === true ? key : `${key}=${value}`))
    .join(', ');
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
 * Normalize URL
 */
export function normalizeURL(url: string): string {
  const urlObj = new URL(url);
  urlObj.hash = '';
  return urlObj.toString();
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  const urlObj = new URL(url);
  return urlObj.hostname;
}

/**
 * Check if URL is absolute
 */
export function isAbsoluteURL(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Resolve URL
 */
export function resolveURL(base: string, relative: string): string {
  return new URL(relative, base).toString();
}

/**
 * Calculate TTL based on response
 */
export function calculateTTL(
  headers: Record<string, string>,
  defaultTTL: number
): number {
  const cacheControl = headers['cache-control'];
  if (!cacheControl) {
    return defaultTTL;
  }

  const directives = parseCacheControl(cacheControl);

  if (directives['no-store'] || directives['private']) {
    return 0;
  }

  const maxAge = directives['max-age'];
  if (typeof maxAge === 'string') {
    return parseInt(maxAge, 10);
  }

  return defaultTTL;
}

/**
 * Parse ETag
 */
export function parseETag(etag: string | undefined): {
  weak: boolean;
  value: string;
} | null {
  if (!etag) {
    return null;
  }

  const match = /^(\*|(W\/)?"[^"]*")$/.exec(etag);
  if (!match) {
    return null;
  }

  return {
    weak: match[2] === 'W/',
    value: match[1].replace(/^W\//, '').replace(/"/g, '')
  };
}

/**
 * Generate fingerprint for content
 */
export async function generateFingerprint(content: string | Buffer): Promise<string> {
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(typeof content === 'string' ? content : content.toString('utf-8'));
  return hash.digest('hex');
}

/**
 * Format bytes
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration
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
 * Parse quality values from Accept header
 */
export function parseQualityValues(header: string | undefined): Map<string, number> {
  const values = new Map<string, number>();

  if (!header) {
    return values;
  }

  for (const part of header.split(',')) {
    const [value, q] = part.trim().split(';q=');
    const quality = q ? parseFloat(q) : 1.0;
    values.set(value, quality);
  }

  return values;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry utility
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: number;
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, backoff = 2 } = options;

  let lastError: Error;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < retries) {
        await sleep(delay * Math.pow(backoff, i));
      }
    }
  }

  throw lastError!;
}

/**
 * Debounce utility
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle utility
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeout: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
      lastCall = now;
      fn(...args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastCall = Date.now();
        timeout = undefined;
        fn(...args);
      }, remaining);
    }
  };
}

/**
 * Create a promise with timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error = new Error('Operation timed out')
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(timeoutError), timeoutMs)
    )
  ]);
}
