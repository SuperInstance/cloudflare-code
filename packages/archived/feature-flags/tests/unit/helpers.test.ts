/**
 * Unit tests for utility helpers
 */

import { describe, it, expect } from 'vitest';
import {
  hashString,
  getBucket,
  getPercentage,
  evaluateCondition,
  evaluateConditions,
  getAttributeValue,
  compareValues,
  isValidFlagKey,
  isValidEmail,
  isValidISODate,
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  diffDays,
  toSlug,
  truncate,
  randomString,
  generateUUID,
  chunk,
  shuffle,
  sample,
  unique,
  clamp,
  mapRange,
  roundTo,
  percentage,
  debounce,
  throttle,
  measureTime,
} from '../../src/utils/helpers';

describe('Hash Functions', () => {
  describe('hashString', () => {
    it('should generate consistent hashes', () => {
      const hash1 = hashString('test');
      const hash2 = hashString('test');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = hashString('test1');
      const hash2 = hashString('test2');
      expect(hash1).not.toBe(hash2);
    });

    it('should generate positive integers', () => {
      const hash = hashString('test');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(hash)).toBe(true);
    });
  });

  describe('getBucket', () => {
    it('should return consistent bucket for same input', () => {
      const bucket1 = getBucket('test', 10);
      const bucket2 = getBucket('test', 10);
      expect(bucket1).toBe(bucket2);
    });

    it('should return bucket within range', () => {
      const bucket = getBucket('test', 10);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(10);
    });
  });

  describe('getPercentage', () => {
    it('should return percentage between 0 and 99', () => {
      const percentage = getPercentage('test');
      expect(percentage).toBeGreaterThanOrEqual(0);
      expect(percentage).toBeLessThan(100);
    });
  });
});

describe('Condition Evaluation', () => {
  const attributes = {
    userId: 'user123',
    email: 'test@example.com',
    country: 'US',
    age: 25,
    customAttributes: {
      tier: 'premium',
      daysActive: 100,
    },
  };

  describe('getAttributeValue', () => {
    it('should get top-level attribute', () => {
      expect(getAttributeValue(attributes, 'userId')).toBe('user123');
    });

    it('should get nested attribute', () => {
      expect(getAttributeValue(attributes, 'customAttributes.tier')).toBe('premium');
    });

    it('should return undefined for non-existent attribute', () => {
      expect(getAttributeValue(attributes, 'nonexistent')).toBeUndefined();
    });
  });

  describe('compareValues', () => {
    it('should compare with equals operator', () => {
      expect(compareValues('test', 'equals', 'test')).toBe(true);
      expect(compareValues('test', 'equals', 'other')).toBe(false);
    });

    it('should compare with not_equals operator', () => {
      expect(compareValues('test', 'not_equals', 'other')).toBe(true);
      expect(compareValues('test', 'not_equals', 'test')).toBe(false);
    });

    it('should compare with contains operator', () => {
      expect(compareValues('hello world', 'contains', 'world')).toBe(true);
      expect(compareValues('hello world', 'contains', 'test')).toBe(false);
    });

    it('should compare with greater_than operator', () => {
      expect(compareValues(10, 'greater_than', 5)).toBe(true);
      expect(compareValues(5, 'greater_than', 10)).toBe(false);
    });

    it('should compare with in operator', () => {
      expect(compareValues('a', 'in', ['a', 'b', 'c'])).toBe(true);
      expect(compareValues('d', 'in', ['a', 'b', 'c'])).toBe(false);
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate condition correctly', () => {
      const condition = {
        attribute: 'country',
        operator: 'equals' as const,
        value: 'US',
      };
      expect(evaluateCondition(condition, attributes)).toBe(true);
    });

    it('should evaluate nested condition', () => {
      const condition = {
        attribute: 'customAttributes.tier',
        operator: 'equals' as const,
        value: 'premium',
      };
      expect(evaluateCondition(condition, attributes)).toBe(true);
    });
  });

  describe('evaluateConditions', () => {
    const conditions = [
      { attribute: 'country', operator: 'equals' as const, value: 'US' },
      { attribute: 'age', operator: 'greater_than' as const, value: 20 },
    ];

    it('should evaluate with AND logic', () => {
      expect(evaluateConditions(conditions, 'AND', attributes)).toBe(true);
    });

    it('should evaluate with OR logic', () => {
      const orConditions = [
        { attribute: 'country', operator: 'equals' as const, value: 'UK' },
        { attribute: 'age', operator: 'greater_than' as const, value: 20 },
      ];
      expect(evaluateConditions(orConditions, 'OR', attributes)).toBe(true);
    });
  });
});

describe('Validation', () => {
  describe('isValidFlagKey', () => {
    it('should validate correct flag keys', () => {
      expect(isValidFlagKey('my-flag')).toBe(true);
      expect(isValidFlagKey('my.flag')).toBe(true);
      expect(isValidFlagKey('my_flag')).toBe(true);
      expect(isValidFlagKey('MyFlag123')).toBe(true);
    });

    it('should reject invalid flag keys', () => {
      expect(isValidFlagKey('my flag')).toBe(false);
      expect(isValidFlagKey('my/flag')).toBe(false);
      expect(isValidFlagKey('my@flag')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('isValidISODate', () => {
    it('should validate correct ISO dates', () => {
      expect(isValidISODate('2024-01-15T10:30:00Z')).toBe(true);
      expect(isValidISODate('2024-01-15T10:30:00.123Z')).toBe(true);
    });

    it('should reject invalid dates', () => {
      expect(isValidISODate('invalid')).toBe(false);
      expect(isValidISODate('2024-13-45')).toBe(false);
    });
  });
});

describe('Date Utilities', () => {
  describe('startOfDay and endOfDay', () => {
    it('should return start of day', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const start = startOfDay(date);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
    });

    it('should return end of day', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const end = endOfDay(date);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });
  });

  describe('addDays and subDays', () => {
    it('should add days to date', () => {
      const date = new Date('2024-01-15');
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });

    it('should subtract days from date', () => {
      const date = new Date('2024-01-15');
      const result = subDays(date, 5);
      expect(result.getDate()).toBe(10);
    });
  });

  describe('diffDays', () => {
    it('should calculate difference in days', () => {
      const date1 = new Date('2024-01-20');
      const date2 = new Date('2024-01-15');
      expect(diffDays(date1, date2)).toBe(5);
    });
  });
});

describe('String Utilities', () => {
  describe('toSlug', () => {
    it('should convert string to slug', () => {
      expect(toSlug('Hello World')).toBe('hello-world');
      expect(toSlug('Hello   World')).toBe('hello-world');
      expect(toSlug('Hello World!')).toBe('hello-world');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello World', 5)).toBe('He...');
      expect(truncate('Hi', 5)).toBe('Hi');
    });
  });

  describe('randomString', () => {
    it('should generate random string of correct length', () => {
      const str = randomString(10);
      expect(str.length).toBe(10);
    });

    it('should generate different strings', () => {
      const str1 = randomString(10);
      const str2 = randomString(10);
      expect(str1).not.toBe(str2);
    });
  });

  describe('generateUUID', () => {
    it('should generate valid UUID v4', () => {
      const uuid = generateUUID();
      const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(regex.test(uuid)).toBe(true);
    });
  });
});

describe('Array Utilities', () => {
  describe('chunk', () => {
    it('should chunk array into smaller arrays', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const chunks = chunk(arr, 3);
      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    });

    it('should handle remainder', () => {
      const arr = [1, 2, 3, 4, 5];
      const chunks = chunk(arr, 2);
      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    });
  });

  describe('shuffle', () => {
    it('should shuffle array', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled).not.toEqual(arr);
      expect(shuffled.sort()).toEqual(arr.sort());
    });
  });

  describe('sample', () => {
    it('should sample random elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const sampled = sample(arr, 3);
      expect(sampled.length).toBe(3);
      expect(sampled.every((x) => arr.includes(x))).toBe(true);
    });
  });

  describe('unique', () => {
    it('should remove duplicates', () => {
      const arr = [1, 2, 2, 3, 3, 3, 4];
      const uniqueArr = unique(arr);
      expect(uniqueArr).toEqual([1, 2, 3, 4]);
    });
  });
});

describe('Number Utilities', () => {
  describe('clamp', () => {
    it('should clamp number within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('mapRange', () => {
    it('should map value from one range to another', () => {
      expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
      expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
      expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
    });
  });

  describe('roundTo', () => {
    it('should round to decimal places', () => {
      expect(roundTo(3.14159, 2)).toBe(3.14);
      expect(roundTo(3.14159, 4)).toBe(3.1416);
    });
  });

  describe('percentage', () => {
    it('should calculate percentage', () => {
      expect(percentage(50, 100)).toBe(50);
      expect(percentage(25, 200)).toBe(12.5);
      expect(percentage(0, 100)).toBe(0);
    });
  });
});

describe('Performance Utilities', () => {
  describe('measureTime', () => {
    it('should measure execution time', async () => {
      const { result, duration } = await measureTime(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'done';
      });

      expect(result).toBe('done');
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      let count = 0;
      const debouncedFn = debounce(() => {
        count++;
      }, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(count).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(count).toBe(1);
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', async () => {
      let count = 0;
      const throttledFn = throttle(() => {
        count++;
      }, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(count).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 150));
      throttledFn();
      expect(count).toBe(2);
    });
  });
});
