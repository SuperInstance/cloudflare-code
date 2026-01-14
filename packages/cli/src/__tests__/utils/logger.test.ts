/**
 * Logger Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger } from '../../utils/logger.js';

describe('Logger', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('createLogger', () => {
    it('should create a logger instance', () => {
      const logger = createLogger('test');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.success).toBe('function');
    });

    it('should use the provided context name', () => {
      const logger = createLogger('my-context');
      logger.info('test message');
      expect(consoleInfoSpy).toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      const logger = createLogger('test');
      logger.info('info message');
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('info message')
      );
    });

    it('should log error messages', () => {
      const logger = createLogger('test');
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('error message')
      );
    });

    it('should log warn messages', () => {
      const logger = createLogger('test');
      logger.warn('warn message');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('warn message')
      );
    });

    it('should log debug messages', () => {
      const logger = createLogger('test');
      logger.setLogLevel('debug');
      logger.debug('debug message');
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('debug message')
      );
    });

    it('should log success messages', () => {
      const logger = createLogger('test');
      logger.success('success message');
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('success message')
      );
    });
  });

  describe('log level filtering', () => {
    it('should respect error log level', () => {
      const logger = createLogger('test');
      logger.setLogLevel('error');

      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should respect warn log level', () => {
      const logger = createLogger('test');
      logger.setLogLevel('warn');

      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should respect info log level', () => {
      const logger = createLogger('test');
      logger.setLogLevel('info');

      logger.info('info message');
      logger.debug('debug message');

      expect(consoleInfoSpy).toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should respect debug log level', () => {
      const logger = createLogger('test');
      logger.setLogLevel('debug');

      logger.info('info message');
      logger.debug('debug message');

      expect(consoleInfoSpy).toHaveBeenCalled();
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it('should not output when quiet mode is enabled', () => {
      const logger = createLogger('test');
      logger.setLogLevel('quiet');

      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('colored output', () => {
    it('should include colors when enabled', () => {
      const logger = createLogger('test', { colors: true });
      logger.info('test message');

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(call).toContain('\x1b['); // ANSI color code
    });

    it('should not include colors when disabled', () => {
      const logger = createLogger('test', { colors: false });
      logger.info('test message');

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(call).not.toContain('\x1b['); // No ANSI color code
    });
  });

  describe('structured logging', () => {
    it('should handle objects in messages', () => {
      const logger = createLogger('test');
      const obj = { key: 'value', nested: { prop: 123 } };

      logger.info('Object:', obj);

      expect(consoleInfoSpy).toHaveBeenCalled();
      const call = consoleInfoSpy.mock.calls[0][1] as string;
      expect(call).toContain('"key":"value"');
    });

    it('should handle errors in messages', () => {
      const logger = createLogger('test');
      const error = new Error('Test error');

      logger.error('Error occurred:', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle multiple arguments', () => {
      const logger = createLogger('test');

      logger.info('Message 1', 'Message 2', { data: 'value' }, 42);

      expect(consoleInfoSpy).toHaveBeenCalled();
    });
  });

  describe('timestamp', () => {
    it('should include timestamp when enabled', () => {
      const logger = createLogger('test', { timestamp: true });
      logger.info('test message');

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      // Should contain time pattern like HH:MM:SS
      expect(call).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('should not include timestamp when disabled', () => {
      const logger = createLogger('test', { timestamp: false });
      logger.info('test message');

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      // Should not contain time pattern
      expect(call).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('utility methods', () => {
    it('should log blank line', () => {
      const logger = createLogger('test');
      logger.newline();

      expect(consoleInfoSpy).toHaveBeenCalledWith('');
    });

    it('should create box output', () => {
      const logger = createLogger('test');
      logger.box('Title', 'Content line 1\nContent line 2');

      expect(consoleInfoSpy).toHaveBeenCalled();
      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(call).toContain('Title');
      expect(call).toContain('Content line 1');
    });
  });
});
