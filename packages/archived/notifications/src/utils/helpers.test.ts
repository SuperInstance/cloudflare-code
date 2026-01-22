/**
 * Tests for utility helpers
 */

import { describe, it, expect } from 'vitest';
import {
  generateId,
  isValidEmail,
  isValidPhoneNumber,
  isValidWebhookUrl,
  sanitizeHtml,
  truncateText,
  formatDate,
  formatRelativeTime,
  calculatePriorityScore,
  comparePriorities,
  getHigherPriority,
  meetsThreshold,
  parseChannel,
  parseCategory,
  parsePriority,
  deepMerge,
  debounce,
  throttle,
  chunk,
  unique,
  groupBy,
  sortBy,
  validateNotification,
  maskSensitiveData,
  generateFingerprint,
  isWithinRange,
  getDateRange,
  formatBytes,
  calculatePercentage,
  formatPercentage,
} from '../helpers';

describe('Utility Helpers', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should use custom prefix', () => {
      const id = generateId('custom');
      expect(id.startsWith('custom_')).toBe(true);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate correct phone numbers', () => {
      expect(isValidPhoneNumber('+1234567890')).toBe(true);
      expect(isValidPhoneNumber('1234567890')).toBe(true);
      expect(isValidPhoneNumber('+1 (234) 567-8900')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhoneNumber('123')).toBe(false);
      expect(isValidPhoneNumber('abc')).toBe(false);
    });
  });

  describe('isValidWebhookUrl', () => {
    it('should validate correct webhook URLs', () => {
      expect(isValidWebhookUrl('https://example.com/webhook')).toBe(true);
      expect(isValidWebhookUrl('http://example.com/hook')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidWebhookUrl('not-a-url')).toBe(false);
      expect(isValidWebhookUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('sanitizeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
      expect(sanitizeHtml('<div>Hello</div>')).toBe('&lt;div&gt;Hello&lt;/div&gt;');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      expect(truncateText('Hello world', 5)).toBe('Hello...');
      expect(truncateText('Short', 10)).toBe('Short');
    });

    it('should use custom suffix', () => {
      expect(truncateText('Hello world', 5, '---')).toBe('Hello---');
    });
  });

  describe('calculatePriorityScore', () => {
    it('should calculate correct priority scores', () => {
      expect(calculatePriorityScore('critical')).toBe(100);
      expect(calculatePriorityScore('urgent')).toBe(80);
      expect(calculatePriorityScore('high')).toBe(60);
      expect(calculatePriorityScore('normal')).toBe(40);
      expect(calculatePriorityScore('low')).toBe(20);
    });
  });

  describe('comparePriorities', () => {
    it('should compare priorities correctly', () => {
      expect(comparePriorities('critical', 'low')).toBeGreaterThan(0);
      expect(comparePriorities('normal', 'high')).toBeLessThan(0);
      expect(comparePriorities('normal', 'normal')).toBe(0);
    });
  });

  describe('getHigherPriority', () => {
    it('should return higher priority', () => {
      expect(getHigherPriority('critical', 'low')).toBe('critical');
      expect(getHigherPriority('normal', 'high')).toBe('high');
    });
  });

  describe('meetsThreshold', () => {
    it('should check if priority meets threshold', () => {
      expect(meetsThreshold('critical', 'high')).toBe(true);
      expect(meetsThreshold('normal', 'high')).toBe(false);
      expect(meetsThreshold('high', 'high')).toBe(true);
    });
  });

  describe('parseChannel', () => {
    it('should parse valid channels', () => {
      expect(parseChannel('email')).toBe('email');
      expect(parseChannel('sms')).toBe('sms');
      expect(parseChannel('invalid')).toBe(null);
    });
  });

  describe('parseCategory', () => {
    it('should parse valid categories', () => {
      expect(parseCategory('system')).toBe('system');
      expect(parseCategory('security')).toBe('security');
      expect(parseCategory('invalid')).toBe(null);
    });
  });

  describe('parsePriority', () => {
    it('should parse valid priorities', () => {
      expect(parsePriority('critical')).toBe('critical');
      expect(parsePriority('normal')).toBe('normal');
      expect(parsePriority('invalid')).toBe(null);
    });
  });

  describe('deepMerge', () => {
    it('should merge objects deeply', () => {
      const target = { a: 1, b: { c: 2, d: 3 } };
      const source = { b: { d: 4, e: 5 }, f: 6 };
      const result = deepMerge(target, source);

      expect(result).toEqual({
        a: 1,
        b: { c: 2, d: 4, e: 5 },
        f: 6,
      });
    });
  });

  describe('chunk', () => {
    it('should chunk arrays correctly', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
    });
  });

  describe('unique', () => {
    it('should remove duplicates', () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('groupBy', () => {
    it('should group array by key', () => {
      const items = [
        { id: 1, type: 'a' },
        { id: 2, type: 'b' },
        { id: 3, type: 'a' },
      ];
      const groups = groupBy(items, 'type');

      expect(groups.get('a')).toEqual([
        { id: 1, type: 'a' },
        { id: 3, type: 'a' },
      ]);
      expect(groups.get('b')).toEqual([{ id: 2, type: 'b' }]);
    });
  });

  describe('sortBy', () => {
    it('should sort array by key', () => {
      const items = [
        { id: 3, name: 'c' },
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
      ];

      expect(sortBy(items, 'id')).toEqual([
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 3, name: 'c' },
      ]);

      expect(sortBy(items, 'id', 'desc')).toEqual([
        { id: 3, name: 'c' },
        { id: 2, name: 'b' },
        { id: 1, name: 'a' },
      ]);
    });
  });

  describe('validateNotification', () => {
    it('should validate valid notifications', () => {
      const notification = {
        id: '123',
        userId: 'user1',
        channel: 'email' as const,
        category: 'system' as const,
        priority: 'normal' as const,
        content: 'Test content',
      };

      const result = validateNotification(notification);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid notifications', () => {
      const notification = {
        id: '',
        userId: '',
        channel: 'invalid' as const,
        category: 'invalid' as const,
        priority: 'invalid' as const,
        content: '',
      };

      const result = validateNotification(notification);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask sensitive data', () => {
      expect(maskSensitiveData('password123', 4)).toBe('pass*********');
      expect(maskSensitiveData('short', 2)).toBe('sh****');
    });
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprints', () => {
      const data1 = { a: 1, b: 2 };
      const data2 = { b: 2, a: 1 };
      const data3 = { a: 1, b: 3 };

      expect(generateFingerprint(data1)).toBe(generateFingerprint(data2));
      expect(generateFingerprint(data1)).not.toBe(generateFingerprint(data3));
    });
  });

  describe('isWithinRange', () => {
    it('should check if date is within range', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');

      expect(isWithinRange(new Date('2024-01-15'), start, end)).toBe(true);
      expect(isWithinRange(new Date('2024-02-01'), start, end)).toBe(false);
    });
  });

  describe('getDateRange', () => {
    it('should return correct date ranges', () => {
      const endDate = new Date('2024-01-15');
      const range = getDateRange('day', endDate);

      expect(range.end).toEqual(endDate);
      expect(range.start.getTime()).toBeLessThan(range.end.getTime());
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('calculatePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculatePercentage(50, 100)).toBe(50);
      expect(calculatePercentage(1, 3)).toBeCloseTo(33.33, 2);
      expect(calculatePercentage(0, 100)).toBe(0);
      expect(calculatePercentage(50, 0)).toBe(0);
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage correctly', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(33.333, 2)).toBe('33.33%');
    });
  });
});
