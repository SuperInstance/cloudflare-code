/**
 * Tests for Logging System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StructuredLogger, createLogger, generateCorrelationId } from './logging';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;

  beforeEach(() => {
    logger = new StructuredLogger({
      level: 'DEBUG',
      format: 'json',
      includeStackTrace: false,
    });
  });

  describe('Log Levels', () => {
    it('should log trace messages', () => {
      logger.trace('Trace message');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('TRACE');
      expect(entries[0].message).toBe('Trace message');
    });

    it('should log debug messages', () => {
      logger.debug('Debug message');

      const entries = logger.getEntries();
      expect(entries[0].level).toBe('DEBUG');
    });

    it('should log info messages', () => {
      logger.info('Info message');

      const entries = logger.getEntries();
      expect(entries[0].level).toBe('INFO');
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');

      const entries = logger.getEntries();
      expect(entries[0].level).toBe('WARN');
    });

    it('should log error messages', () => {
      logger.error('Error message');

      const entries = logger.getEntries();
      expect(entries[0].level).toBe('ERROR');
    });

    it('should log fatal error messages', () => {
      logger.fatal('Fatal message');

      const entries = logger.getEntries();
      expect(entries[0].level).toBe('FATAL');
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect log level configuration', () => {
      const infoLogger = new StructuredLogger({ level: 'INFO' });

      infoLogger.debug('Debug message');
      infoLogger.info('Info message');
      infoLogger.warn('Warning message');

      const entries = infoLogger.getEntries();
      expect(entries).toHaveLength(2); // Only INFO and WARN
      expect(entries.every((e) => e.level !== 'DEBUG')).toBe(true);
    });

    it('should filter out lower level messages', () => {
      const warnLogger = new StructuredLogger({ level: 'WARN' });

      warnLogger.info('Info message');
      warnLogger.warn('Warning message');
      warnLogger.error('Error message');

      const entries = warnLogger.getEntries();
      expect(entries).toHaveLength(2); // Only WARN and ERROR
    });
  });

  describe('Metadata', () => {
    it('should include metadata in log entries', () => {
      logger.info('Test message', { key: 'value', count: 42 });

      const entries = logger.getEntries();
      expect(entries[0].metadata).toEqual({
        key: 'value',
        count: 42,
      });
    });

    it('should merge metadata from context', () => {
      const contextualLogger = logger.withContext('test-context', { contextKey: 'contextValue' });

      contextualLogger.info('Test message', { messageKey: 'messageValue' });

      const entries = contextualLogger.getEntries();
      expect(entries[0].metadata).toEqual({
        contextKey: 'contextValue',
        messageKey: 'messageValue',
      });
    });
  });

  describe('Error Handling', () => {
    it('should format errors in log entries', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      const entries = logger.getEntries();
      expect(entries[0].error).toBeDefined();
      expect(entries[0].error?.message).toBe('Test error');
      expect(entries[0].error?.name).toBe('Error');
    });

    it('should include error metadata', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error, { code: 500 });

      const entries = logger.getEntries();
      expect(entries[0].metadata?.code).toBe(500);
    });

    it('should handle string errors', () => {
      logger.error('Error occurred', 'String error message');

      const entries = logger.getEntries();
      expect(entries[0].error).toBeDefined();
      expect(entries[0].error?.message).toBe('String error message');
    });
  });

  describe('Context', () => {
    it('should create logger with context', () => {
      const contextualLogger = logger.withContext('test-context');

      contextualLogger.info('Test message');

      const entries = contextualLogger.getEntries();
      expect(entries[0].context).toBe('test-context');
    });

    it('should include context metadata', () => {
      const contextualLogger = logger.withContext('test-context', { key: 'value' });

      contextualLogger.info('Test message');

      const entries = contextualLogger.getEntries();
      expect(entries[0].metadata).toEqual({ key: 'value' });
    });

    it('should support nested contexts', () => {
      const parentLogger = logger.withContext('parent', { parentKey: 'parentValue' });
      const childLogger = parentLogger.withContext('child', { childKey: 'childValue' });

      childLogger.info('Test message');

      const entries = childLogger.getEntries();
      expect(entries[0].context).toBe('child');
      expect(entries[0].metadata).toEqual({
        parentKey: 'parentValue',
        childKey: 'childValue',
      });
    });
  });

  describe('Correlation IDs', () => {
    it('should create logger with correlation ID', () => {
      const correlatedLogger = logger.withCorrelationId('test-correlation-id');

      correlatedLogger.info('Test message');

      const entries = correlatedLogger.getEntries();
      expect(entries[0].correlationId).toBe('test-correlation-id');
    });

    it('should preserve correlation ID across context changes', () => {
      const correlatedLogger = logger.withCorrelationId('test-id');
      const contextualLogger = correlatedLogger.withContext('test');

      contextualLogger.info('Test message');

      const entries = contextualLogger.getEntries();
      expect(entries[0].correlationId).toBe('test-id');
    });
  });

  describe('Trace Context', () => {
    it('should create logger with trace context', () => {
      const traceLogger = logger.withTrace('trace-123', 'span-456');

      traceLogger.info('Test message');

      const entries = traceLogger.getEntries();
      expect(entries[0].traceId).toBe('trace-123');
      expect(entries[0].spanId).toBe('span-456');
    });
  });

  describe('User Context', () => {
    it('should create logger with user ID', () => {
      const userLogger = logger.withUser('user-123');

      userLogger.info('Test message');

      const entries = userLogger.getEntries();
      expect(entries[0].userId).toBe('user-123');
    });
  });

  describe('Session Context', () => {
    it('should create logger with session ID', () => {
      const sessionLogger = logger.withSession('session-123');

      sessionLogger.info('Test message');

      const entries = sessionLogger.getEntries();
      expect(entries[0].sessionId).toBe('session-123');
    });
  });

  describe('Request Context', () => {
    it('should create logger with request ID', () => {
      const requestLogger = logger.withRequest('request-123');

      requestLogger.info('Test message');

      const entries = requestLogger.getEntries();
      expect(entries[0].requestId).toBe('request-123');
    });
  });

  describe('Statistics', () => {
    it('should calculate log statistics', () => {
      logger.info('Info 1');
      logger.warn('Warning 1');
      logger.error('Error 1');
      logger.fatal('Fatal 1');

      const stats = logger.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byLevel.INFO).toBe(1);
      expect(stats.byLevel.WARN).toBe(1);
      expect(stats.byLevel.ERROR).toBe(1);
      expect(stats.byLevel.FATAL).toBe(1);
      expect(stats.errorRate).toBe(0.5); // 2 errors out of 4 logs
    });

    it('should calculate logs per minute', () => {
      for (let i = 0; i < 10; i++) {
        logger.info(`Message ${i}`);
      }

      const stats = logger.getStats();
      expect(stats.avgPerMinute).toBeGreaterThan(0);
    });
  });

  describe('Export', () => {
    it('should export logs as JSON', () => {
      logger.info('Message 1');
      logger.warn('Message 2');

      const exported = logger.exportJSON();

      expect(exported).toHaveLength(2);
      expect(exported[0].message).toBe('Message 1');
      expect(exported[1].message).toBe('Message 2');
    });

    it('should export logs as text', () => {
      logger.info('Info message');
      logger.warn('Warning message');

      const exported = logger.exportText();

      expect(exported).toContain('INFO');
      expect(exported).toContain('Info message');
      expect(exported).toContain('WARN');
      expect(exported).toContain('Warning message');
    });
  });

  describe('Filtering', () => {
    it('should filter entries by level', () => {
      logger.info('Info 1');
      logger.warn('Warning 1');
      logger.error('Error 1');

      const errorEntries = logger.getEntries({ level: 'ERROR' });

      expect(errorEntries).toHaveLength(1);
      expect(errorEntries[0].level).toBe('ERROR');
    });

    it('should filter entries by time range', () => {
      const now = Date.now();

      logger.info('Old message');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const recentTime = Date.now();
      logger.info('Recent message');

      const recentEntries = logger.getEntries({
        startTime: recentTime,
      });

      expect(recentEntries.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter entries by correlation ID', () => {
      const logger1 = logger.withCorrelationId('correlation-1');
      const logger2 = logger.withCorrelationId('correlation-2');

      logger1.info('Message 1');
      logger2.info('Message 2');

      const entries1 = logger.getEntries({ correlationId: 'correlation-1' });
      const entries2 = logger.getEntries({ correlationId: 'correlation-2' });

      expect(entries1).toHaveLength(1);
      expect(entries2).toHaveLength(1);
      expect(entries1[0].message).toBe('Message 1');
      expect(entries2[0].message).toBe('Message 2');
    });

    it('should limit entries', () => {
      for (let i = 0; i < 100; i++) {
        logger.info(`Message ${i}`);
      }

      const limitedEntries = logger.getEntries({ limit: 10 });

      expect(limitedEntries).toHaveLength(10);
    });
  });

  describe('Clear', () => {
    it('should clear all log entries', () => {
      logger.info('Message 1');
      logger.info('Message 2');

      expect(logger.getEntries()).toHaveLength(2);

      logger.clear();

      expect(logger.getEntries()).toHaveLength(0);
    });
  });

  describe('Factory Functions', () => {
    it('should create logger with factory function', () => {
      const testLogger = createLogger({ level: 'WARN' });

      testLogger.info('Info message');
      testLogger.warn('Warning message');

      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('WARN');
    });
  });

  describe('Correlation ID Generation', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate valid correlation ID format', () => {
      const id = generateCorrelationId();

      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty metadata', () => {
      logger.info('Test message', {});

      const entries = logger.getEntries();
      expect(entries[0].metadata).toBeUndefined();
    });

    it('should handle null error', () => {
      logger.error('Test message', null);

      const entries = logger.getEntries();
      expect(entries[0].error).toBeUndefined();
    });

    it('should handle missing context metadata', () => {
      const contextualLogger = logger.withContext('test');

      contextualLogger.info('Test message');

      const entries = contextualLogger.getEntries();
      expect(entries[0].metadata).toBeUndefined();
    });
  });

  describe('Max Entries Limit', () => {
    it('should enforce max entries limit', () => {
      const limitedLogger = new StructuredLogger({
        level: 'INFO',
      });

      // The logger should have a max limit (default 10000)
      for (let i = 0; i < 15000; i++) {
        limitedLogger.info(`Message ${i}`);
      }

      const entries = limitedLogger.getEntries();
      expect(entries.length).toBeLessThanOrEqual(10000);
    });
  });
});
