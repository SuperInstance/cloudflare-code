/**
 * Utility Functions Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseRequestContext,
  generateCacheKey,
  parseCacheControl,
  generateCacheControlHeader,
  calculateTTL,
  formatBytes,
  formatDuration,
  isValidURL,
  normalizeURL,
  extractDomain
} from '../../src/utils/index.js';

describe('Utility Functions', () => {
  describe('parseRequestContext', () => {
    it('should parse basic request context', () => {
      const context = parseRequestContext('https://example.com/test', {
        'user-agent': 'Mozilla/5.0',
        'referer': 'https://google.com'
      });

      expect(context.url).toBe('https://example.com/test');
      expect(context.method).toBe('GET');
      expect(context.userAgent).toBe('Mozilla/5.0');
      expect(context.referer).toBe('https://google.com');
    });

    it('should extract IP from headers', () => {
      const context = parseRequestContext('https://example.com/test', {
        'cf-connecting-ip': '1.2.3.4'
      });

      expect(context.ip).toBe('1.2.3.4');
    });

    it('should extract country from headers', () => {
      const context = parseRequestContext('https://example.com/test', {
        'cf-ipcountry': 'US'
      });

      expect(context.country).toBe('US');
    });

    it('should detect device type from user agent', () => {
      const mobileContext = parseRequestContext('https://example.com/test', {
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      });

      expect(mobileContext.device).toBe('mobile');

      const desktopContext = parseRequestContext('https://example.com/test', {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      });

      expect(desktopContext.device).toBe('desktop');
    });
  });

  describe('generateCacheKey', () => {
    it('should generate key from URL', () => {
      const key = generateCacheKey('https://example.com/test', {});
      expect(key).toBe('https://example.com/test');
    });

    it('should include vary headers in key', () => {
      const key = generateCacheKey('https://example.com/test', {
        'accept-encoding': 'gzip',
        'cookie': 'session=abc'
      }, ['accept-encoding']);

      expect(key).toContain('gzip');
      expect(key).not.toContain('session');
    });
  });

  describe('parseCacheControl', () => {
    it('should parse cache-control header', () => {
      const directives = parseCacheControl('public, max-age=3600, stale-while-revalidate=600');

      expect(directives['public']).toBe(true);
      expect(directives['max-age']).toBe('3600');
      expect(directives['stale-while-revalidate']).toBe('600');
    });

    it('should handle empty header', () => {
      const directives = parseCacheControl(undefined);
      expect(Object.keys(directives).length).toBe(0);
    });

    it('should handle boolean directives', () => {
      const directives = parseCacheControl('no-cache, no-store');

      expect(directives['no-cache']).toBe(true);
      expect(directives['no-store']).toBe(true);
    });
  });

  describe('generateCacheControlHeader', () => {
    it('should generate cache-control header', () => {
      const header = generateCacheControlHeader({
        'public': true,
        'max-age': '3600',
        'stale-while-revalidate': '600'
      });

      expect(header).toBe('public, max-age=3600, stale-while-revalidate=600');
    });

    it('should handle boolean directives', () => {
      const header = generateCacheControlHeader({
        'no-cache': true,
        'no-store': true
      });

      expect(header).toBe('no-cache, no-store');
    });
  });

  describe('calculateTTL', () => {
    it('should extract max-age from cache-control', () => {
      const ttl = calculateTTL({
        'cache-control': 'public, max-age=7200'
      }, 3600);

      expect(ttl).toBe(7200);
    });

    it('should return default TTL when no cache-control', () => {
      const ttl = calculateTTL({}, 3600);
      expect(ttl).toBe(3600);
    });

    it('should return 0 for no-store directive', () => {
      const ttl = calculateTTL({
        'cache-control': 'no-store'
      }, 3600);

      expect(ttl).toBe(0);
    });

    it('should return 0 for private directive', () => {
      const ttl = calculateTTL({
        'cache-control': 'private'
      }, 3600);

      expect(ttl).toBe(0);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should handle decimal precision', () => {
      expect(formatBytes(1234, 3)).toBe('1.205 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('0s');
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(3600000)).toBe('1h 0m 0s');
    });

    it('should format complex durations', () => {
      expect(formatDuration(3661500)).toBe('1h 1m 1s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('URL Utilities', () => {
    it('should validate URLs', () => {
      expect(isValidURL('https://example.com')).toBe(true);
      expect(isValidURL('http://example.com')).toBe(true);
      expect(isValidURL('invalid-url')).toBe(false);
      expect(isValidURL('')).toBe(false);
    });

    it('should normalize URLs', () => {
      expect(normalizeURL('https://example.com/test#section')).toBe('https://example.com/test');
      expect(normalizeURL('https://example.com/test?foo=bar')).toBe('https://example.com/test?foo=bar');
    });

    it('should extract domain from URL', () => {
      expect(extractDomain('https://example.com/test')).toBe('example.com');
      expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
      expect(extractDomain('http://sub.domain.com/page')).toBe('sub.domain.com');
    });
  });
});
