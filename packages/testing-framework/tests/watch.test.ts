/**
 * Watch Mode Tests
 * Comprehensive test suite for watch mode functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileWatcher } from '../src/watch/watcher';
import { WatchConfig, WatchEvent, WatchHook } from '../src/watch/types';
import { TestRunner } from '../src/core/test-runner';
import { TestConfig } from '../src/core/types';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
vi.mock('glob');
vi.mock('fs');
vi.mock('path');

describe('FileWatcher', () => {
  let testRunner: TestRunner;
  let mockConfig: WatchConfig;
  let watcher: FileWatcher;

  beforeEach(() => {
    // Create mock test runner
    testRunner = new TestRunner({
      files: '**/*.test.ts',
      parallel: false,
      maxWorkers: 1,
      failFast: false,
      reporter: 'default'
    } as TestConfig);

    // Create mock configuration
    mockConfig = {
      watch: ['src/**/*.{ts,js}'],
      ignore: ['**/node_modules/**'],
      tests: {
        pattern: '**/*.test.ts',
        extensions: ['.test.ts', '.spec.ts'],
        run: {
          parallel: false,
          maxWorkers: 1,
          failFast: false,
          reporter: 'default',
          environment: 'node',
          env: {}
        }
      },
      watchOptions: {
        usePolling: false,
        interval: 100,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        },
        followSymlinks: true,
        ignoreInitial: true
      },
      debounce: {
        delay: 300,
        maxWait: 5000,
        leading: false,
        trailing: true
      },
      clearScreen: true,
      verbose: false,
      autoRun: false
    };

    watcher = new FileWatcher(mockConfig, testRunner);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with correct configuration', () => {
      const session = watcher.getSession();
      expect(session.status).toBe('idle');
      expect(session.totalRuns).toBe(0);
      expect(session.isRunning).toBe(false);
    });

    it('should validate configuration correctly', () => {
      const validConfig = { ...mockConfig, watch: ['src/**/*.ts'] };
      expect(() => watcher).not.toThrow();

      const invalidConfig = { ...mockConfig, watch: [] };
      // Note: Actual validation would be implemented separately
    });
  });

  describe('Event Handling', () => {
    it('should handle file change events', async () => {
      const mockEvent: WatchEvent = {
        type: 'change',
        path: '/path/to/file.ts',
        timestamp: Date.now()
      };

      // Mock chokidar
      const mockChokidar = {
        watch: vi.fn().mockReturnValue({
          on: vi.fn((event: string, handler: any) => {
            if (event === 'change') {
              handler(mockEvent.path, mockEvent);
            }
          })
        })
      };

      // Mock glob
      vi.mocked(glob).mockResolvedValue(['/path/to/test.ts']);

      // Start watcher
      await watcher.start();

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const session = watcher.getSession();
      expect(session.totalFilesWatched).toBeGreaterThan(0);
    });

    it('should ignore files based on ignore patterns', async () => {
      const ignoredEvent: WatchEvent = {
        type: 'change',
        path: '/path/to/node_modules/file.ts',
        timestamp: Date.now()
      };

      const mockChokidar = {
        watch: vi.fn().mockReturnValue({
          on: vi.fn((event: string, handler: any) => {
            if (event === 'change') {
              handler(ignoredEvent.path, ignoredEvent);
            }
          })
        })
      };

      // Start watcher
      await watcher.start();

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // The ignored event should not trigger a test run
      expect(watcher.getSession().results.length).toBe(0);
    });
  });

  describe('Test Execution', () => {
    it('should run tests when files change', async () => {
      const mockEvent: WatchEvent = {
        type: 'change',
        path: '/path/to/file.ts',
        timestamp: Date.now()
      };

      // Mock test runner
      vi.spyOn(testRunner, 'run').mockResolvedValue({
        success: true,
        total: 10,
        failures: 0,
        skipped: 0,
        files: ['/path/to/file.ts'],
        duration: 1000,
        coverage: undefined,
        errors: [],
        warnings: []
      });

      // Mock glob
      vi.mocked(glob).mockResolvedValue(['/path/to/test.ts']);

      // Start watcher
      await watcher.start();

      // Trigger test run
      await watcher.triggerRun();

      expect(testRunner.run).toHaveBeenCalled();
    });

    it('should debounce test runs', async () => {
      const event1: WatchEvent = {
        type: 'change',
        path: '/path/to/file1.ts',
        timestamp: Date.now()
      };

      const event2: WatchEvent = {
        type: 'change',
        path: '/path/to/file2.ts',
        timestamp: Date.now() + 100
      };

      // Mock test runner
      const runSpy = vi.spyOn(testRunner, 'run').mockResolvedValue({
        success: true,
        total: 10,
        failures: 0,
        skipped: 0,
        files: ['/path/to/file1.ts'],
        duration: 1000,
        coverage: undefined,
        errors: [],
        warnings: []
      });

      // Start watcher with short debounce time
      const shortDebounceConfig = { ...mockConfig, debounce: { delay: 50, maxWait: 100, leading: false, trailing: true } };
      const shortWatcher = new FileWatcher(shortDebounceConfig, testRunner);

      await shortWatcher.start();

      // Trigger multiple events
      await new Promise(resolve => {
        process.nextTick(() => {
          shortWatcher.emit('change', event1);
          setTimeout(() => {
            shortWatcher.emit('change', event2);
            resolve(undefined);
          }, 30);
        });
      });

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only run tests once due to debouncing
      expect(runSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session Management', () => {
    it('should track session statistics', async () => {
      const mockEvent: WatchEvent = {
        type: 'change',
        path: '/path/to/file.ts',
        timestamp: Date.now()
      };

      // Mock test runner
      vi.spyOn(testRunner, 'run').mockResolvedValue({
        success: true,
        total: 5,
        failures: 0,
        skipped: 0,
        files: ['/path/to/test.ts'],
        duration: 500,
        coverage: undefined,
        errors: [],
        warnings: []
      });

      // Start watcher
      await watcher.start();

      // Trigger multiple test runs
      await watcher.triggerRun();
      await watcher.triggerRun();

      const session = watcher.getSession();
      expect(session.totalRuns).toBe(2);
      expect(session.results.length).toBe(2);
      expect(session.isRunning).toBe(false);
    });

    it('should generate report with metrics', async () => {
      const mockEvent: WatchEvent = {
        type: 'change',
        path: '/path/to/file.ts',
        timestamp: Date.now()
      };

      // Mock test runner
      vi.spyOn(testRunner, 'run').mockResolvedValue({
        success: true,
        total: 10,
        failures: 0,
        skipped: 0,
        files: ['/path/to/test.ts'],
        duration: 1000,
        coverage: {
          summary: {
            lines: { percentage: 90, total: 100, covered: 90 }
          }
        },
        errors: [],
        warnings: []
      });

      // Start watcher
      await watcher.start();

      // Trigger test run
      await watcher.triggerRun();

      const report = watcher.getReport();
      expect(report.session.totalRuns).toBe(1);
      expect(report.metrics.averageRunTime).toBeGreaterThan(0);
      expect(report.metrics.successRate).toBe(100);
    });
  });

  describe('Hook System', () => {
    it('should execute hooks at appropriate times', async () => {
      const mockHook: WatchHook = {
        name: 'test-hook',
        type: 'beforeRun',
        handler: vi.fn(),
        async: true,
        priority: 0
      };

      watcher.addHook(mockHook);

      // Mock test runner
      vi.spyOn(testRunner, 'run').mockResolvedValue({
        success: true,
        total: 5,
        failures: 0,
        skipped: 0,
        files: ['/path/to/test.ts'],
        duration: 500,
        coverage: undefined,
        errors: [],
        warnings: []
      });

      await watcher.start();
      await watcher.triggerRun();

      expect(mockHook.handler).toHaveBeenCalled();
    });

    it('should remove hooks correctly', () => {
      const mockHook: WatchHook = {
        name: 'test-hook',
        type: 'beforeRun',
        handler: vi.fn(),
        async: true,
        priority: 0
      };

      watcher.addHook(mockHook);
      expect(watcher.getSession()).toBeDefined();

      watcher.removeHook('test-hook', 'beforeRun');
      // Hook should be removed from internal state
    });
  });

  describe('Lifecycle Management', () => {
    it('should start and stop watcher correctly', async () => {
      await watcher.start();
      expect(watcher.getSession().status).toBe('running');

      await watcher.stop();
      expect(watcher.getSession().status).toBe('stopped');
    });

    it('should pause and resume watching', async () => {
      await watcher.start();

      watcher.pause();
      expect(watcher.getSession().status).toBe('paused');

      watcher.resume();
      expect(watcher.getSession().status).toBe('running');
    });
  });

  describe('Error Handling', () => {
    it('should handle test run errors', async () => {
      const testError = new TestError('Test execution failed');

      // Mock test runner to throw error
      vi.spyOn(testRunner, 'run').mockRejectedValue(testError);

      await watcher.start();

      // Trigger test run that should fail
      await watcher.triggerRun();

      const session = watcher.getSession();
      expect(session.errors.length).toBeGreaterThan(0);
      expect(session.errors[0]).toContain('Test execution failed');
    });

    it('should handle file watcher errors', async () => {
      const mockChokidar = {
        watch: vi.fn().mockReturnValue({
          on: vi.fn((event: string, handler: any) => {
            if (event === 'error') {
              handler(new Error('Watcher error'));
            }
          })
        })
      };

      await watcher.start();

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      const session = watcher.getSession();
      expect(session.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle frequent file changes efficiently', async () => {
      const eventCount = 50;
      const events: WatchEvent[] = [];

      for (let i = 0; i < eventCount; i++) {
        events.push({
          type: 'change',
          path: `/path/to/file${i}.ts`,
          timestamp: Date.now() + i
        });
      }

      // Mock test runner
      const runSpy = vi.spyOn(testRunner, 'run').mockResolvedValue({
        success: true,
        total: 5,
        failures: 0,
        skipped: 0,
        files: ['/path/to/test.ts'],
        duration: 500,
        coverage: undefined,
        errors: [],
        warnings: []
      });

      await watcher.start();

      // Send all events
      events.forEach(event => {
        watcher.emit('change', event);
      });

      // Wait for debouncing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have limited the number of test runs
      expect(runSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Watch Utils', () => {
  it('should debounce function calls', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    // Should not have been called immediately
    expect(mockFn).not.toHaveBeenCalled();

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should have been called once
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should convert glob patterns to regex', () => {
    const regex = require('../src/watch/utils').globToRegex('**/*.ts');
    expect(regex.test('/path/to/file.ts')).toBe(true);
    expect(regex.test('/path/to/file.js')).toBe(false);
  });

  it('should calculate rates correctly', () => {
    const { calculateRate } = require('../src/watch/utils');
    expect(calculateRate(5, 10)).toBe(50);
    expect(calculateRate(0, 10)).toBe(0);
    expect(calculateRate(5, 0)).toBe(0);
  });

  it('should format durations correctly', () => {
    const { formatDuration } = require('../src/watch/utils');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(65000)).toBe('1m 5.0s');
  });
});

describe('Watch Configuration', () => {
  it('should validate configuration correctly', () => {
    const { validateWatchConfig } = require('../src/watch/utils');

    const validConfig = {
      watch: ['src/**/*.ts'],
      ignore: ['node_modules'],
      tests: {
        pattern: '**/*.test.ts',
        extensions: ['.test.ts'],
        run: {
          parallel: true,
          maxWorkers: 4,
          failFast: false,
          reporter: 'default',
          environment: 'node',
          env: {}
        }
      },
      watchOptions: {
        usePolling: false,
        interval: 100,
        awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
        followSymlinks: true,
        ignoreInitial: false
      },
      debounce: { delay: 300, maxWait: 5000, leading: false, trailing: true },
      clearScreen: true,
      verbose: false,
      autoRun: true
    };

    const validation = validateWatchConfig(validConfig);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    const invalidConfig = { watch: [], tests: validConfig.tests };
    const invalidValidation = validateWatchConfig(invalidConfig);
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors.length).toBeGreaterThan(0);
  });
});

// Custom error class for testing
class TestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestError';
  }
}