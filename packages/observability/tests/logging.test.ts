/**
 * Tests for structured logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StructuredLogger, LogLevel } from '../src/logging';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;

  beforeEach(() => {
    logger = new StructuredLogger('test-service', {
      level: LogLevel.DEBUG,
    });
  });

  describe('log levels', () => {
    it('should log trace messages', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      logger.trace('trace message', { key: 'value' });
      consoleSpy.mockRestore();
    });

    it('should log debug messages', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      logger.debug('debug message', { key: 'value' });
      consoleSpy.mockRestore();
    });

    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('info message', { key: 'value' });
      consoleSpy.mockRestore();
    });

    it('should log warn messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warn message', { key: 'value' });
      consoleSpy.mockRestore();
    });

    it('should log error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('error message', new Error('test error'));
      consoleSpy.mockRestore();
    });

    it('should log fatal messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.fatal('fatal message', new Error('fatal error'));
      consoleSpy.mockRestore();
    });
  });

  describe('log filtering', () => {
    it('should respect log level threshold', () => {
      const strictLogger = new StructuredLogger('test', { level: LogLevel.ERROR });

      strictLogger.info('should not log');
      strictLogger.error('should log');

      const entries = strictLogger.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].level).toBe(LogLevel.ERROR);
    });
  });

  describe('trace correlation', () => {
    it('should correlate logs with trace context', () => {
      const traceId = 'test-trace-id';
      const spanId = 'test-span-id';

      logger.setTraceContext(traceId, spanId);
      logger.info('correlated message');

      const entries = logger.getEntries();
      const lastEntry = entries[entries.length - 1];

      expect(lastEntry.traceId).toBe(traceId);
      expect(lastEntry.spanId).toBe(spanId);
    });

    it('should clear trace context', () => {
      logger.setTraceContext('trace-1', 'span-1');
      logger.clearTraceContext();
      logger.info('uncorrelated message');

      const entries = logger.getEntries();
      const lastEntry = entries[entries.length - 1];

      expect(lastEntry.traceId).toBeUndefined();
      expect(lastEntry.spanId).toBeUndefined();
    });
  });

  describe('child logger', () => {
    it('should create child logger with inherited context', () => {
      const parentLogger = new StructuredLogger('parent', {
        metadata: { parentKey: 'parentValue' },
      });

      const childLogger = parentLogger.child('child', { childKey: 'childValue' });
      childLogger.info('child message');

      const entries = childLogger.getEntries();
      expect(entries[0].context).toContain('child');
      expect(entries[0].attributes.parentKey).toBe('parentValue');
      expect(entries[0].attributes.childKey).toBe('childValue');
    });
  });

  describe('log filtering', () => {
    beforeEach(() => {
      logger.info('info 1', { type: 'a' });
      logger.warn('warn 1', { type: 'b' });
      logger.error('error 1', { type: 'a' });
      logger.info('info 2', { type: 'c' });
    });

    it('should filter by level', () => {
      const filtered = logger.filter({ levels: [LogLevel.ERROR, LogLevel.WARN] });
      expect(filtered.length).toBe(2);
    });

    it('should filter by attributes', () => {
      const filtered = logger.filter({ attributes: { type: 'a' } });
      expect(filtered.length).toBe(2);
    });

    it('should filter by search query', () => {
      const filtered = logger.filter({ searchQuery: 'warn' });
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('aggregation', () => {
    beforeEach(() => {
      logger.info('info message');
      logger.warn('warning message');
      logger.error('error message');
      logger.error('another error');
    });

    it('should aggregate logs by level', () => {
      const aggregation = logger.aggregate();

      expect(aggregation.countByLevel[LogLevel.INFO]).toBe(1);
      expect(aggregation.countByLevel[LogLevel.WARN]).toBe(1);
      expect(aggregation.countByLevel[LogLevel.ERROR]).toBe(2);
    });

    it('should calculate error rate', () => {
      const aggregation = logger.aggregate();
      expect(aggregation.errorRate).toBe(0.5); // 2 errors out of 4 logs
    });

    it('should identify top errors', () => {
      const aggregation = logger.aggregate();
      expect(aggregation.topErrors.length).toBeGreaterThan(0);
    });
  });

  describe('search', () => {
    it('should search logs by content', () => {
      logger.info('searchable message with keyword');
      logger.info('other message');

      const results = logger.search('keyword');
      expect(results.length).toBe(1);
      expect(results[0].message).toContain('keyword');
    });
  });

  describe('statistics', () => {
    it('should provide log statistics', () => {
      logger.info('message 1');
      logger.warn('message 2');
      logger.error('message 3');

      const stats = logger.getStatistics();

      expect(stats.totalEntries).toBe(3);
      expect(stats.entriesByLevel[LogLevel.INFO]).toBe(1);
      expect(stats.entriesByLevel[LogLevel.WARN]).toBe(1);
      expect(stats.entriesByLevel[LogLevel.ERROR]).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all log entries', () => {
      logger.info('message');
      logger.clear();

      const stats = logger.getStatistics();
      expect(stats.totalEntries).toBe(0);
    });
  });
});
