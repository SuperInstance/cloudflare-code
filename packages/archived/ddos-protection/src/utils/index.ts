/**
 * Utility functions for DDoS protection
 */

import { createHash, randomBytes } from 'crypto';
import type { RequestData, GeoData } from '../types';

/**
 * IP address utilities
 */
export class IPUtils {
  /**
   * Validate IPv4 address
   */
  static isValidIPv4(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * Validate IPv6 address
   */
  static isValidIPv6(ip: string): boolean {
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(::[0-9a-fA-F]{1,4}){1,7}|[0-9a-fA-F]{1,4}::([0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,6}:)$/;
    return ipv6Regex.test(ip);
  }

  /**
   * Validate IP address (IPv4 or IPv6)
   */
  static isValidIP(ip: string): boolean {
    return this.isValidIPv4(ip) || this.isValidIPv6(ip);
  }

  /**
   * Convert IP to integer (IPv4 only)
   */
  static ipToNumber(ip: string): number {
    if (!this.isValidIPv4(ip)) {
      throw new Error('Invalid IPv4 address');
    }

    const parts = ip.split('.');
    return (
      (parseInt(parts[0], 10) << 24) +
      (parseInt(parts[1], 10) << 16) +
      (parseInt(parts[2], 10) << 8) +
      parseInt(parts[3], 10)
    ) >>> 0;
  }

  /**
   * Convert integer to IP address (IPv4 only)
   */
  static numberToIP(num: number): string {
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255
    ].join('.');
  }

  /**
   * Check if IP is in CIDR range
   */
  static isIPInCIDR(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);

    const ipNum = this.ipToNumber(ip);
    const rangeNum = this.ipToNumber(range);
    const mask = (0xFFFFFFFF << (32 - bits)) >>> 0;

    return (ipNum & mask) === (rangeNum & mask);
  }

  /**
   * Check if IP is in private range
   */
  static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '127.0.0.0/8'
    ];

    return privateRanges.some(range => this.isIPInCIDR(ip, range));
  }

  /**
   * Get IP from request headers
   */
  static extractIP(headers: Record<string, string>): string {
    // Check various headers for the real IP
    const ipHeaders = [
      'cf-connecting-ip',
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip'
    ];

    for (const header of ipHeaders) {
      const value = headers[header] || headers[header.toLowerCase()];
      if (value) {
        // X-Forwarded-For may contain multiple IPs
        const ips = value.split(',').map(ip => ip.trim());
        const validIP = ips.find(ip => this.isValidIP(ip) && !this.isPrivateIP(ip));
        if (validIP) {
          return validIP;
        }
      }
    }

    // Fallback to first IP in X-Forwarded-For
    const xff = headers['x-forwarded-for'] || headers['x-forwarded-for'.toLowerCase()];
    if (xff) {
      const firstIP = xff.split(',')[0].trim();
      if (this.isValidIP(firstIP)) {
        return firstIP;
      }
    }

    return '0.0.0.0';
  }

  /**
   * Normalize IP address
   */
  static normalizeIP(ip: string): string {
    // Remove port if present
    const colonIndex = ip.lastIndexOf(':');
    if (colonIndex > 0 && !ip.includes('[')) {
      const maybePort = ip.substring(colonIndex + 1);
      if (/^\d+$/.test(maybePort)) {
        ip = ip.substring(0, colonIndex);
      }
    }

    // Remove whitespace
    return ip.trim();
  }

  /**
   * Generate IP hash for anonymity
   */
  static hashIP(ip: string, salt: string = ''): string {
    return createHash('sha256')
      .update(ip + salt)
      .digest('hex')
      .substring(0, 16);
  }
}

/**
 * Request parsing utilities
 */
export class RequestParser {
  /**
   * Parse user agent
   */
  static parseUserAgent(userAgent: string): {
    browser?: string;
    os?: string;
    device?: string;
    isBot: boolean;
    isMobile: boolean;
  } {
    const ua = userAgent.toLowerCase();

    // Detect bots
    const botPatterns = [
      'bot', 'spider', 'crawl', 'slurp', 'curl', 'wget',
      'python-requests', 'go-http-client', 'java'
    ];
    const isBot = botPatterns.some(pattern => ua.includes(pattern));

    // Detect browsers
    let browser: string | undefined;
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';

    // Detect OS
    let os: string | undefined;
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac os')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('ios')) os = 'iOS';

    // Detect device
    let device: string | undefined;
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      device = 'Mobile';
    } else {
      device = 'Desktop';
    }

    return {
      browser,
      os,
      device,
      isBot,
      isMobile: device === 'Mobile'
    };
  }

  /**
   * Extract path from URL
   */
  static extractPath(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return url.split('?')[0];
    }
  }

  /**
   * Parse query parameters
   */
  static parseQuery(url: string): Record<string, string> {
    try {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return params;
    } catch {
      return {};
    }
  }

  /**
   * Generate request fingerprint
   */
  static generateFingerprint(request: Partial<RequestData>): string {
    const components = [
      request.ip,
      request.userAgent,
      request.headers?.['accept-language'],
      request.headers?.['accept-encoding']
    ];

    return createHash('sha256')
      .update(components.filter(Boolean).join('|'))
      .digest('hex');
  }

  /**
   * Parse request ID
   */
  static parseRequestID(headers: Record<string, string>): string {
    return (
      headers['x-request-id'] ||
      headers['request-id'] ||
      headers['cf-ray'] ||
      randomBytes(16).toString('hex')
    );
  }
}

/**
 * Math utilities for calculations
 */
export class MathUtils {
  /**
   * Calculate exponential moving average
   */
  static exponentialMovingAverage(values: number[], alpha: number = 0.5): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];

    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = alpha * values[i] + (1 - alpha) * ema;
    }
    return ema;
  }

  /**
   * Calculate standard deviation
   */
  static standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate percentile
   */
  static percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Calculate Z-score
   */
  static zScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  /**
   * Check if value is outlier (using IQR method)
   */
  static isOutlier(values: number[], value: number, multiplier: number = 1.5): boolean {
    if (values.length < 4) return false;

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;

    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;

    return value < lowerBound || value > upperBound;
  }

  /**
   * Calculate rate per time window
   */
  static calculateRate(count: number, windowMs: number): number {
    return (count / windowMs) * 1000;
  }

  /**
   * Smooth data using moving average
   */
  static movingAverage(values: number[], window: number): number[] {
    if (values.length < window) return [...values];

    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = values.slice(start, i + 1);
      result.push(slice.reduce((sum, val) => sum + val, 0) / slice.length);
    }
    return result;
  }
}

/**
 * Time utilities
 */
export class TimeUtils {
  /**
   * Get current timestamp in milliseconds
   */
  static now(): number {
    return Date.now();
  }

  /**
   * Get current timestamp in seconds
   */
  static nowSec(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Convert milliseconds to seconds
   */
  static msToSec(ms: number): number {
    return Math.floor(ms / 1000);
  }

  /**
   * Convert seconds to milliseconds
   */
  static secToMs(sec: number): number {
    return sec * 1000;
  }

  /**
   * Format duration
   */
  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${ms}ms`;
  }

  /**
   * Get time bucket for aggregation
   */
  static getTimeBucket(timestamp: number, bucketSizeMs: number): number {
    return Math.floor(timestamp / bucketSizeMs) * bucketSizeMs;
  }

  /**
   * Check if timestamp is within window
   */
  static isWithinWindow(timestamp: number, windowStart: number, windowSize: number): boolean {
    return timestamp >= windowStart && timestamp < windowStart + windowSize;
  }

  /**
   * Calculate time until next bucket
   */
  static timeUntilNextBucket(timestamp: number, bucketSizeMs: number): number {
    const currentBucket = this.getTimeBucket(timestamp, bucketSizeMs);
    const nextBucket = currentBucket + bucketSizeMs;
    return nextBucket - timestamp;
  }
}

/**
 * String utilities
 */
export class StringUtils {
  /**
   * Generate random string
   */
  static random(length: number = 16): string {
    return randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .substring(0, length);
  }

  /**
   * Generate UUID v4
   */
  static uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Truncate string
   */
  static truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Sanitize string for logging
   */
  static sanitize(str: string): string {
    // Remove sensitive data (passwords, tokens, etc.)
    return str.replace(/(?:password|token|secret|api[_-]?key|authorization)["\']?\s*[:=]\s*["\']?([^\s"']+)/gi, '[REDACTED]');
  }

  /**
   * Convert to safe string (for keys, identifiers)
   */
  static toSafeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * Geographic utilities
 */
export class GeoUtils {
  /**
   * Get country from headers
   */
  static getCountryFromHeaders(headers: Record<string, string>): string | undefined {
    return (
      headers['cf-ipcountry'] ||
      headers['x-country-code'] ||
      undefined
    );
  }

  /**
   * Parse geo data from Cloudflare headers
   */
  static parseCloudflareGeoHeaders(headers: Record<string, string>): Partial<GeoData> {
    return {
      country: headers['cf-ipcountry'],
      city: headers['cf-ipcity'] || headers['cf-visitor-city'],
      latitude: headers['cf-iplatitude'] ? parseFloat(headers['cf-iplatitude']) : undefined,
      longitude: headers['cf-iplongitude'] ? parseFloat(headers['cf-iplongitude']) : undefined,
      asn: headers['cf-asn'] ? parseInt(headers['cf-asn'], 10) : undefined,
      timezone: headers['cf-timezone']
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get continent from country code
   */
  static getContinent(countryCode: string): string | undefined {
    const continentMap: Record<string, string> = {
      // North America
      US: 'North America',
      CA: 'North America',
      MX: 'North America',
      // Europe
      GB: 'Europe',
      DE: 'Europe',
      FR: 'Europe',
      IT: 'Europe',
      ES: 'Europe',
      // Asia
      CN: 'Asia',
      JP: 'Asia',
      IN: 'Asia',
      KR: 'Asia',
      // South America
      BR: 'South America',
      AR: 'South America',
      // Oceania
      AU: 'Oceania',
      NZ: 'Oceania',
      // Africa
      ZA: 'Africa',
      EG: 'Africa',
      NG: 'Africa'
    };

    return continentMap[countryCode.toUpperCase()];
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate URL
   */
  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate email
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate port number
   */
  static isValidPort(port: number): boolean {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  /**
   * Validate ASN number
   */
  static isValidASN(asn: number): boolean {
    return Number.isInteger(asn) && asn > 0 && asn <= 4294967295;
  }
}

/**
 * Rate limiting utilities
 */
export class RateLimitUtils {
  /**
   * Calculate token bucket state
   */
  static calculateTokenBucket(
    tokens: number,
    maxTokens: number,
    refillRate: number,
    lastRefill: number,
    currentTime: number
  ): number {
    const timePassed = currentTime - lastRefill;
    const tokensToAdd = (timePassed / 1000) * refillRate;
    return Math.min(maxTokens, tokens + tokensToAdd);
  }

  /**
   * Check if rate limit is exceeded (fixed window)
   */
  static isFixedWindowExceeded(
    currentCount: number,
    maxRequests: number,
    windowStart: number,
    windowSize: number,
    currentTime: number
  ): boolean {
    if (currentTime >= windowStart + windowSize) {
      // New window
      return false;
    }
    return currentCount >= maxRequests;
  }

  /**
   * Check if rate limit is exceeded (sliding window)
   */
  static isSlidingWindowExceeded(
    requestTimestamps: number[],
    maxRequests: number,
    windowSize: number,
    currentTime: number
  ): boolean {
    // Remove timestamps outside the window
    const validTimestamps = requestTimestamps.filter(
      ts => currentTime - ts < windowSize
    );

    return validTimestamps.length >= maxRequests;
  }
}

/**
 * Performance utilities
 */
export class PerformanceUtils {
  /**
   * High-resolution timer
   */
  static hrtime(): () => number {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1_000_000; // Convert to milliseconds
    };
  }

  /**
   * Measure function execution time
   */
  static async measureTime<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const endTimer = this.hrtime();
    const result = await fn();
    const duration = endTimer();

    return { result, duration };
  }

  /**
   * Create throttled function
   */
  static throttle<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall >= delay) {
        lastCall = now;
        fn(...args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          lastCall = Date.now();
          timeout = null;
          fn(...args);
        }, delay - timeSinceLastCall);
      }
    };
  }

  /**
   * Create debounced function
   */
  static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        fn(...args);
        timeout = null;
      }, delay);
    };
  }
}

/**
 * Cache utilities
 */
export class CacheUtils {
  /**
   * Create in-memory cache with TTL
   */
  static createCache<T>(defaultTTL: number = 60000): Map<string, { value: T; expires: number }> {
    const cache = new Map<string, { value: T; expires: number }>();

    // Periodically clean up expired entries
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of cache.entries()) {
        if (entry.expires < now) {
          cache.delete(key);
        }
      }
    }, 60000); // Clean up every minute

    return cache;
  }

  /**
   * Get from cache with TTL
   */
  static getFromCache<T>(
    cache: Map<string, { value: T; expires: number }>,
    key: string
  ): T | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;

    if (entry.expires < Date.now()) {
      cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set in cache with TTL
   */
  static setInCache<T>(
    cache: Map<string, { value: T; expires: number }>,
    key: string,
    value: T,
    ttl: number
  ): void {
    cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }
}
