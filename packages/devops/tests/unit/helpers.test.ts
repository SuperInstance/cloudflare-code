/**
 * Unit tests for helper utilities
 */

import { describe, it, expect } from 'vitest';
import {
  generateHash,
  diffObjects,
  sleep,
  retry,
  parseDuration,
  formatDuration,
  truncate,
  sanitizeResourceName,
  generateId,
  deepClone,
  deepMerge,
  chunk,
  debounce,
  throttle,
  isDefined,
  isEmpty,
  pick,
  omit,
} from '../../src/utils/helpers';

describe('generateHash', () => {
  it('should generate a unique hash', () => {
    const hash1 = generateHash();
    const hash2 = generateHash();
    expect(hash1).toHaveLength(16);
    expect(hash2).toHaveLength(16);
    expect(hash1).not.toBe(hash2);
  });

  it('should generate consistent hash for same input', () => {
    const hash1 = generateHash('test');
    const hash2 = generateHash('test');
    expect(hash1).toBe(hash2);
  });
});

describe('diffObjects', () => {
  it('should detect no changes for identical objects', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    const result = diffObjects(obj1, obj2);
    expect(result.hasChanges).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it('should detect simple value changes', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 3 };
    const result = diffObjects(obj1, obj2);
    expect(result.hasChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].path).toContain('b');
  });

  it('should detect nested object changes', () => {
    const obj1 = { a: { b: { c: 1 } } };
    const obj2 = { a: { b: { c: 2 } } };
    const result = diffObjects(obj1, obj2);
    expect(result.hasChanges).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('should detect new properties', () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 1, b: 2 };
    const result = diffObjects(obj1, obj2);
    expect(result.hasChanges).toBe(true);
  });
});

describe('sleep', () => {
  it('should sleep for the specified duration', async () => {
    const start = Date.now();
    await sleep(100);
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(95);
    expect(duration).toBeLessThan(150);
  });
});

describe('retry', () => {
  it('should succeed on first attempt', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      return 'success';
    };
    const result = await retry(fn);
    expect(result).toBe('success');
    expect(attempts).toBe(1);
  });

  it('should retry on failure', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Not yet');
      }
      return 'success';
    };
    const result = await retry(fn, { maxRetries: 5, initialDelay: 10 });
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should throw after max retries', async () => {
    const fn = async () => {
      throw new Error('Failed');
    };
    await expect(
      retry(fn, { maxRetries: 2, initialDelay: 10 })
    ).rejects.toThrow('Failed');
  });
});

describe('parseDuration', () => {
  it('should parse milliseconds', () => {
    expect(parseDuration('500ms')).toBe(500);
  });

  it('should parse seconds', () => {
    expect(parseDuration('30s')).toBe(30000);
  });

  it('should parse minutes', () => {
    expect(parseDuration('5m')).toBe(300000);
  });

  it('should parse hours', () => {
    expect(parseDuration('2h')).toBe(7200000);
  });

  it('should parse days', () => {
    expect(parseDuration('1d')).toBe(86400000);
  });

  it('should throw for invalid format', () => {
    expect(() => parseDuration('invalid')).toThrow();
  });
});

describe('formatDuration', () => {
  it('should format seconds', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(30000)).toBe('30s');
  });

  it('should format minutes', () => {
    expect(formatDuration(60000)).toBe('1m');
    expect(formatDuration(90000)).toBe('1m 30s');
  });

  it('should format hours', () => {
    expect(formatDuration(3600000)).toBe('1h');
    expect(formatDuration(3660000)).toBe('1h 1m');
  });

  it('should format days', () => {
    expect(formatDuration(86400000)).toBe('1d');
    expect(formatDuration(90000000)).toBe('1d 1h');
  });
});

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('should handle exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('sanitizeResourceName', () => {
  it('should convert to lowercase', () => {
    expect(sanitizeResourceName('MyResource')).toBe('myresource');
  });

  it('should replace special characters with hyphens', () => {
    expect(sanitizeResourceName('my_resource')).toBe('my-resource');
    expect(sanitizeResourceName('my.resource')).toBe('my-resource');
  });

  it('should remove consecutive hyphens', () => {
    expect(sanitizeResourceName('my--resource')).toBe('my-resource');
  });

  it('should trim leading and trailing hyphens', () => {
    expect(sanitizeResourceName('-my-resource-')).toBe('my-resource');
  });

  it('should limit to 63 characters', () => {
    const longName = 'a'.repeat(100);
    expect(sanitizeResourceName(longName)).toHaveLength(63);
  });
});

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('should include prefix when specified', () => {
    const id = generateId('test');
    expect(id).toMatch(/^test-/);
  });
});

describe('deepClone', () => {
  it('should clone simple objects', () => {
    const obj = { a: 1, b: 2 };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  it('should clone nested objects', () => {
    const obj = { a: { b: { c: 1 } } };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned.a).not.toBe(obj.a);
  });

  it('should clone arrays', () => {
    const obj = { a: [1, 2, 3] };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned.a).not.toBe(obj.a);
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
    const target = { a: { b: 1, c: 2 } };
    const source = { a: { b: 3, d: 4 } };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: { b: 3, c: 2, d: 4 } });
  });

  it('should not mutate original objects', () => {
    const target = { a: 1 };
    const source = { b: 2 };
    const originalTarget = { ...target };
    const originalSource = { ...source };
    deepMerge(target, source);
    expect(target).toEqual(originalTarget);
    expect(source).toEqual(originalSource);
  });
});

describe('chunk', () => {
  it('should chunk arrays evenly', () => {
    const arr = [1, 2, 3, 4, 5, 6];
    const chunks = chunk(arr, 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it('should handle remaining elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const chunks = chunk(arr, 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('should handle empty arrays', () => {
    const chunks = chunk([], 2);
    expect(chunks).toEqual([]);
  });
});

describe('debounce', () => {
  it('should debounce function calls', () => {
    let count = 0;
    const fn = debounce(() => count++, 100);

    fn();
    fn();
    fn();

    expect(count).toBe(0);
  });

  it('should execute after delay', async () => {
    let count = 0;
    const fn = debounce(() => count++, 50);

    fn();
    await sleep(100);
    expect(count).toBe(1);
  });
});

describe('throttle', () => {
  it('should throttle function calls', () => {
    let count = 0;
    const fn = throttle(() => count++, 100);

    fn();
    fn();
    fn();

    expect(count).toBe(1);
  });

  it('should allow calls after interval', async () => {
    let count = 0;
    const fn = throttle(() => count++, 50);

    fn();
    await sleep(100);
    fn();
    expect(count).toBe(2);
  });
});

describe('isDefined', () => {
  it('should return true for defined values', () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined(false)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined([])).toBe(true);
  });

  it('should return false for null and undefined', () => {
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });
});

describe('isEmpty', () => {
  it('should return true for empty values', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty('')).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
  });

  it('should return false for non-empty values', () => {
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(false)).toBe(false);
    expect(isEmpty('a')).toBe(false);
    expect(isEmpty([1])).toBe(false);
    expect(isEmpty({ a: 1 })).toBe(false);
  });
});

describe('pick', () => {
  it('should pick specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = pick(obj, ['a', 'c']);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('should ignore missing keys', () => {
    const obj = { a: 1, b: 2 };
    const result = pick(obj, ['a', 'c'] as any);
    expect(result).toEqual({ a: 1 });
  });
});

describe('omit', () => {
  it('should omit specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = omit(obj, ['b']);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('should handle multiple keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = omit(obj, ['a', 'c']);
    expect(result).toEqual({ b: 2 });
  });
});
