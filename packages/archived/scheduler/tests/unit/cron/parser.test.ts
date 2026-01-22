/**
 * Unit tests for CronParser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CronParser } from '../../../src/cron/parser';
import { JobStatus } from '../../../src/types';

describe('CronParser', () => {
  describe('parse', () => {
    it('should parse simple cron expression', () => {
      const parts = CronParser.parse('0 9 * * *');
      expect(parts.minute).toEqual([0]);
      expect(parts.hour).toEqual([9]);
      expect(parts.dayOfMonth.length).toBe(31);
      expect(parts.month.length).toBe(12);
      expect(parts.dayOfWeek.length).toBe(7);
    });

    it('should parse expression with list', () => {
      const parts = CronParser.parse('0,15,30 9 * * *');
      expect(parts.minute).toEqual([0, 15, 30]);
    });

    it('should parse expression with range', () => {
      const parts = CronParser.parse('0 9-17 * * *');
      expect(parts.hour).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    });

    it('should parse expression with step', () => {
      const parts = CronParser.parse('*/15 * * * *');
      expect(parts.minute).toEqual([0, 15, 30, 45]);
    });

    it('should parse expression with range and step', () => {
      const parts = CronParser.parse('0-30/10 * * * *');
      expect(parts.minute).toEqual([0, 10, 20, 30]);
    });

    it('should parse 6-part expression with seconds', () => {
      const parts = CronParser.parse('0 0 9 * * *');
      expect(parts.minute).toEqual([0]);
      expect(parts.hour).toEqual([9]);
    });

    it('should throw error for invalid part count', () => {
      expect(() => CronParser.parse('0 * * *')).toThrow();
      expect(() => CronParser.parse('0 * * * * * *')).toThrow();
    });

    it('should throw error for invalid values', () => {
      expect(() => CronParser.parse('60 * * * *')).toThrow(); // Invalid minute
      expect(() => CronParser.parse('0 24 * * *')).toThrow(); // Invalid hour
      expect(() => CronParser.parse('0 * 32 * *')).toThrow(); // Invalid day
    });
  });

  describe('validate', () => {
    it('should validate correct expression', () => {
      const result = CronParser.validate('0 9 * * *');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid expression', () => {
      const result = CronParser.validate('60 * * * *');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide warnings for potential issues', () => {
      const result = CronParser.validate('31 9 29 2 *');
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('February 31st does not exist in any year');
    });

    it('should normalize expression', () => {
      const result = CronParser.validate('0,1,2,3,4,5 * * * *');
      expect(result.normalizedExpression).toBe('* * * * *');
    });
  });

  describe('nextExecution', () => {
    it('should calculate next execution for hourly job', () => {
      const from = new Date('2024-01-01T10:30:00Z');
      const next = CronParser.nextExecution('0 * * * *', from);
      expect(next.timestamp.getHours()).toBe(11);
      expect(next.timestamp.getMinutes()).toBe(0);
    });

    it('should calculate next execution for daily job', () => {
      const from = new Date('2024-01-01T08:00:00Z');
      const next = CronParser.nextExecution('0 9 * * *', from);
      expect(next.timestamp.getHours()).toBe(9);
      expect(next.timestamp.getDate()).toBe(1);
    });

    it('should calculate next execution for weekly job', () => {
      const from = new Date('2024-01-01T08:00:00Z'); // Monday
      const next = CronParser.nextExecution('0 9 * * 1', from);
      expect(next.timestamp.getDay()).toBe(1); // Monday
    });

    it('should handle month boundaries correctly', () => {
      const from = new Date('2024-01-31T23:59:00Z');
      const next = CronParser.nextExecution('0 0 1 * *', from);
      expect(next.timestamp.getMonth()).toBe(1); // February
    });

    it('should handle year boundaries correctly', () => {
      const from = new Date('2024-12-31T23:59:00Z');
      const next = CronParser.nextExecution('0 0 1 1 *', from);
      expect(next.timestamp.getFullYear()).toBe(2025);
    });
  });

  describe('nextExecutions', () => {
    it('should calculate multiple next executions', () => {
      const from = new Date('2024-01-01T08:00:00Z');
      const next = CronParser.nextExecutions('0 * * * *', 5, from);
      expect(next).toHaveLength(5);

      for (let i = 0; i < 5; i++) {
        expect(next[i].getMinutes()).toBe(0);
      }
    });

    it('should space executions correctly', () => {
      const from = new Date('2024-01-01T08:00:00Z');
      const next = CronParser.nextExecutions('0 9 * * *', 3, from);

      for (let i = 1; i < next.length; i++) {
        const diff = next[i].getTime() - next[i - 1].getTime();
        expect(diff).toBe(24 * 60 * 60 * 1000); // 24 hours
      }
    });
  });

  describe('previousExecution', () => {
    it('should find previous execution', () => {
      const from = new Date('2024-01-01T10:30:00Z');
      const prev = CronParser.previousExecution('0 * * * *', from);
      expect(prev.getHours()).toBe(10);
      expect(prev.getMinutes()).toBe(0);
    });

    it('should handle crossing day boundaries', () => {
      const from = new Date('2024-01-01T00:30:00Z');
      const prev = CronParser.previousExecution('0 9 * * *', from);
      expect(prev.getDate()).toBe(31);
      expect(prev.getHours()).toBe(9);
    });
  });

  describe('describe', () => {
    it('should generate human-readable description', () => {
      const desc = CronParser.describe('0 9 * * *');
      expect(desc.description).toContain('09:00');
    });

    it('should include next executions', () => {
      const desc = CronParser.describe('0 * * * *', 'UTC', 3);
      expect(desc.nextExecutions).toHaveLength(3);
    });

    it('should include previous executions', () => {
      const desc = CronParser.describe('0 * * * *', 'UTC', 3);
      expect(desc.previousExecutions.length).toBeGreaterThan(0);
    });
  });

  describe('matches', () => {
    it('should match correct time', () => {
      const time = new Date('2024-01-01T09:00:00Z');
      expect(CronParser.matches('0 9 * * *', time)).toBe(true);
    });

    it('should not match incorrect time', () => {
      const time = new Date('2024-01-01T09:30:00Z');
      expect(CronParser.matches('0 9 * * *', time)).toBe(false);
    });

    it('should handle complex expressions', () => {
      const time = new Date('2024-01-01T09:15:00Z');
      expect(CronParser.matches('15,30,45 9 * * *', time)).toBe(true);
    });
  });

  describe('getTimeUntilNextExecution', () => {
    it('should calculate time until next execution', () => {
      const from = new Date('2024-01-01T08:30:00Z');
      const timeUntil = CronParser.getTimeUntilNextExecution('0 9 * * *', from);
      expect(timeUntil).toBe(30 * 60 * 1000); // 30 minutes
    });

    it('should handle hourly jobs', () => {
      const from = new Date('2024-01-01T08:30:00Z');
      const timeUntil = CronParser.getTimeUntilNextExecution('30 * * * *', from);
      expect(timeUntil).toBe(60 * 60 * 1000); // 1 hour
    });
  });

  describe('isDue', () => {
    it('should return true when job is due', () => {
      const from = new Date('2024-01-01T09:00:00Z');
      expect(CronParser.isDue('0 9 * * *', from)).toBe(true);
    });

    it('should return false when job is not due', () => {
      const from = new Date('2024-01-01T09:30:00Z');
      expect(CronParser.isDue('0 9 * * *', from)).toBe(false);
    });
  });

  describe('normalize', () => {
    it('should normalize wildcard expressions', () => {
      const normalized = CronParser.normalize('0,1,2,3,4,5 * * * *');
      expect(normalized).toBe('* * * * *');
    });

    it('should normalize range expressions', () => {
      const normalized = CronParser.normalize('0 1,2,3 * * *');
      expect(normalized).toBe('0 1-3 * * *');
    });

    it('should preserve complex expressions', () => {
      const expr = '0 9 * * 1';
      const normalized = CronParser.normalize(expr);
      expect(normalized).toBe(expr);
    });
  });
});
