/**
 * Unit Tests - Utility Functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateUUID,
  getTimestamp,
  calculateUptime,
  getRequestId,
  safeJsonParse,
  formatBytes,
  formatDuration,
  sleep,
  retry,
  withTimeout,
  clamp,
  isDefined,
  removeUndefined,
  deepMerge,
  parseUserAgent,
  getClientIP,
  createCORSHeaders,
} from './utils';

describe('generateUUID', () => {
  it('should generate a valid UUID v4', () => {
    const uuid = generateUUID();

    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate unique UUIDs', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();

    expect(uuid1).not.toBe(uuid2);
  });

  it('should generate 1000 unique UUIDs', () => {
    const uuids = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      uuids.add(generateUUID());
    }

    expect(uuids.size).toBe(1000);
  });
});

describe('getTimestamp', () => {
  it('should return current timestamp in milliseconds', () => {
    const before = Date.now();
    const timestamp = getTimestamp();
    const after = Date.now();

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

describe('calculateUptime', () => {
  it('should calculate uptime from start time', () => {
    const startTime = Date.now() - 5000; // 5 seconds ago
    const uptime = calculateUptime(startTime);

    expect(uptime).toBeGreaterThanOrEqual(5000);
    expect(uptime).toBeLessThan(5100); // Allow 100ms margin
  });

  it('should return 0 for current time', () => {
    const uptime = calculateUptime(Date.now());

    expect(uptime).toBeLessThan(100); // Should be very small
  });
});

describe('getRequestId', () => {
  it('should extract existing request ID from headers', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-request-id': 'existing-id-123' },
    });

    const id = getRequestId(request);

    expect(id).toBe('existing-id-123');
  });

  it('should generate new ID if not present in headers', () => {
    const request = new Request('https://example.com');

    const id = getRequestId(request);

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    const result = safeJsonParse('{"key":"value"}', null);

    expect(result).toEqual({ key: 'value' });
  });

  it('should return fallback for invalid JSON', () => {
    const result = safeJsonParse('invalid json', { default: true });

    expect(result).toEqual({ default: true });
  });

  it('should return fallback for empty string', () => {
    const result = safeJsonParse('', null);

    expect(result).toBeNull();
  });

  it('should parse arrays', () => {
    const result = safeJsonParse('[1,2,3]', []);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should parse numbers', () => {
    const result = safeJsonParse('42', 0);

    expect(result).toBe(42);
  });
});

describe('formatBytes', () => {
  it('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('should format bytes', () => {
    expect(formatBytes(500)).toBe('500 Bytes');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(2048)).toBe('2 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(100)).toBe('100ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('should format seconds', () => {
    expect(formatDuration(1000)).toBe('1.00s');
    expect(formatDuration(5500)).toBe('5.50s');
    expect(formatDuration(59999)).toBe('60.00s');
  });

  it('should format minutes', () => {
    expect(formatDuration(60000)).toBe('1.00m');
    expect(formatDuration(120000)).toBe('2.00m');
    expect(formatDuration(3599999)).toBe('60.00m');
  });

  it('should format hours', () => {
    expect(formatDuration(3600000)).toBe('1.00h');
    expect(formatDuration(7200000)).toBe('2.00h');
  });
});

describe('sleep', () => {
  it('should sleep for specified milliseconds', async () => {
    const start = Date.now();
    await sleep(100);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(100);
    expect(duration).toBeLessThan(150); // Allow 50ms margin
  });
});

describe('retry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    let attempts = 0;
    const fn = vi.fn(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Failed');
      }
      return 'success';
    });

    const result = await retry(fn, { maxAttempts: 3 });

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should throw after max attempts', async () => {
    const fn = vi.fn(() => {
      throw new Error('Always fails');
    });

    await expect(retry(fn, { maxAttempts: 3 })).rejects.toThrow('Always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn(() => {
      throw new Error('Fails');
    });

    const start = Date.now();
    await expect(retry(fn, { maxAttempts: 4, baseDelay: 50 })).rejects.toThrow();
    const duration = Date.now() - start;

    // Expected: 50ms + 100ms + 200ms = 350ms minimum
    expect(duration).toBeGreaterThanOrEqual(350);
  });

  it('should respect maxDelay', async () => {
    const fn = vi.fn(() => {
      throw new Error('Fails');
    });

    const start = Date.now();
    await expect(retry(fn, { maxAttempts: 5, baseDelay: 100, maxDelay: 150 })).rejects.toThrow();
    const duration = Date.now() - start;

    // Expected: 100ms + 150ms + 150ms + 150ms = 550ms (capped at maxDelay)
    expect(duration).toBeGreaterThanOrEqual(500);
    expect(duration).toBeLessThan(700);
  });
});

describe('withTimeout', () => {
  it('should return result before timeout', async () => {
    const promise = Promise.resolve('success');

    const result = await withTimeout(promise, 1000);

    expect(result).toBe('success');
  });

  it('should throw on timeout', async () => {
    const promise = new Promise(resolve => setTimeout(resolve, 2000));

    await expect(withTimeout(promise, 100)).rejects.toThrow('Operation timed out');
  });

  it('should use custom timeout message', async () => {
    const promise = new Promise(resolve => setTimeout(resolve, 2000));

    await expect(withTimeout(promise, 100, 'Custom timeout')).rejects.toThrow('Custom timeout');
  });

  it('should reject on promise rejection', async () => {
    const promise = Promise.reject(new Error('Promise failed'));

    await expect(withTimeout(promise, 1000)).rejects.toThrow('Promise failed');
  });
});

describe('clamp', () => {
  it('should clamp value above max', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('should clamp value below min', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it('should return value within range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('should handle edge cases', () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

describe('isDefined', () => {
  it('should return true for defined values', () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined(false)).toBe(true);
    expect(isDefined([])).toBe(true);
    expect(isDefined({})).toBe(true);
  });

  it('should return false for null', () => {
    expect(isDefined(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isDefined(undefined)).toBe(false);
  });
});

describe('removeUndefined', () => {
  it('should remove undefined values', () => {
    const obj = { a: 1, b: undefined, c: 'test', d: undefined };
    const result = removeUndefined(obj);

    expect(result).toEqual({ a: 1, c: 'test' });
  });

  it('should keep null and empty values', () => {
    const obj = { a: null, b: '', c: 0, d: false };
    const result = removeUndefined(obj);

    expect(result).toEqual({ a: null, b: '', c: 0, d: false });
  });

  it('should handle empty objects', () => {
    const result = removeUndefined({});

    expect(result).toEqual({});
  });

  it('should handle nested objects', () => {
    const obj = {
      a: 1,
      nested: { b: undefined, c: 2 },
    };
    const result = removeUndefined(obj);

    expect(result).toEqual({
      a: 1,
      nested: { b: undefined, c: 2 }, // Only removes top-level undefined
    });
  });
});

describe('deepMerge', () => {
  it('should merge simple objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should merge nested objects', () => {
    const target = { a: { x: 1, y: 2 } };
    const source = { a: { y: 3, z: 4 } };

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: { x: 1, y: 3, z: 4 } });
  });

  it('should not mutate target', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };

    deepMerge(target, source);

    expect(target).toEqual({ a: 1, b: 2 });
  });

  it('should add new keys from source', () => {
    const target = { a: 1 };
    const source = { b: 2, c: 3 };

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });
});

describe('parseUserAgent', () => {
  it('should parse Chrome user agent', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const result = parseUserAgent(ua);

    expect(result.browser).toBe('Chrome');
    expect(result.os).toBe('Windows');
    expect(result.device).toBe('Desktop');
  });

  it('should parse Firefox user agent', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';
    const result = parseUserAgent(ua);

    expect(result.browser).toBe('Firefox');
    expect(result.os).toBe('macOS');
    expect(result.device).toBe('Desktop');
  });

  it('should parse Safari user agent', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const result = parseUserAgent(ua);

    expect(result.browser).toBe('Safari');
    expect(result.os).toBe('iOS');
    expect(result.device).toBe('Mobile');
  });

  it('should handle unknown user agents', () => {
    const ua = 'UnknownBrowser/1.0';
    const result = parseUserAgent(ua);

    expect(result.browser).toBeUndefined();
    expect(result.os).toBeUndefined();
  });
});

describe('getClientIP', () => {
  it('should extract IP from cf-connecting-ip header', () => {
    const request = new Request('https://example.com', {
      headers: { 'cf-connecting-ip': '1.2.3.4' },
    });

    const ip = getClientIP(request);

    expect(ip).toBe('1.2.3.4');
  });

  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' },
    });

    const ip = getClientIP(request);

    expect(ip).toBe('5.6.7.8');
  });

  it('should prefer cf-connecting-ip over x-forwarded-for', () => {
    const request = new Request('https://example.com', {
      headers: {
        'cf-connecting-ip': '1.2.3.4',
        'x-forwarded-for': '5.6.7.8',
      },
    });

    const ip = getClientIP(request);

    expect(ip).toBe('1.2.3.4');
  });

  it('should return null if no IP headers present', () => {
    const request = new Request('https://example.com');

    const ip = getClientIP(request);

    expect(ip).toBeNull();
  });
});

describe('createCORSHeaders', () => {
  it('should create default CORS headers', () => {
    const headers = createCORSHeaders();

    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization, X-Request-ID');
  });

  it('should use custom origin', () => {
    const headers = createCORSHeaders({ origin: 'https://example.com' });

    expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
  });

  it('should use custom methods', () => {
    const headers = createCORSHeaders({ methods: ['GET', 'POST'] });

    expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST');
  });

  it('should include credentials header', () => {
    const headers = createCORSHeaders({ credentials: true });

    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('should include max-age header', () => {
    const headers = createCORSHeaders({ maxAge: 3600 });

    expect(headers['Access-Control-Max-Age']).toBe('3600');
  });
});
