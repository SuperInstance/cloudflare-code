import { expect as expectImpl, Expect } from './expect';
import { assert } from './assertions';
import { mock, spyOn, jest, MockFactory } from './mocks';
import { TestCallback, TestOptions, SuiteOptions } from './types';

/**
 * Test framework compatibility layer for Jest-style APIs
 */

/**
 * Describe function for test suites
 */
export function describe(name: string, callback: () => void): void;
export function describe(name: string, options: SuiteOptions, callback: () => void): void;
export function describe(name: string, optionsOrCallback: SuiteOptions | (() => void), callback?: () => void): void {
  // Implementation would integrate with test runner
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    optionsOrCallback = {};
  }

  // Store suite information
  const suite = {
    name,
    options: optionsOrCallback as SuiteOptions,
    tests: []
  };

  // Execute suite callback
  if (callback) {
    callback();
  }
}

/**
 * Test function for individual test cases
 */
export function test(name: string, callback: TestCallback): void;
export function test(name: string, timeout: number, callback: TestCallback): void;
export function test(name: string, options: TestOptions, callback: TestCallback): void;
export function test(name: string, timeoutOrOptions: number | TestOptions, callback?: TestCallback): void {
  if (typeof timeoutOrOptions === 'function') {
    callback = timeoutOrOptions;
    timeoutOrOptions = {};
  }

  const options = typeof timeoutOrOptions === 'number'
    ? { timeout: timeoutOrOptions }
    : timeoutOrOptions;

  // Store test information
  const testInfo = {
    name,
    options,
    callback
  };

  // Add to current suite
  // Implementation would integrate with test runner
}

/**
 * It function (alias for test)
 */
export const it = test;

/**
 * Before each hook
 */
export function beforeEach(callback: TestCallback): void {
  // Implementation would integrate with test runner
}

/**
 * After each hook
 */
export function afterEach(callback: TestCallback): void {
  // Implementation would integrate with test runner
}

/**
 * Before all hook
 */
export function beforeAll(callback: TestCallback): void {
  // Implementation would integrate with test runner
}

/**
 * After all hook
 */
export function afterAll(callback: TestCallback): void {
  // Implementation would integrate with test runner
}

/**
 * Global expect function
 */
export const expect = expectImpl;

/**
 * Global assert function
 */
export const globalAssert = assert;

/**
 * Global mock functions
 */
export const globalMock = mock;
export const globalSpyOn = spyOn;
export const globalJest = jest;

/**
 * Skip function
 */
export function skip(name: string, callback?: TestCallback): void {
  if (callback) {
    // Mark test as skipped
    test.skip(name, callback);
  }
}

/**
 * Only function
 */
export function only(name: string, callback?: TestCallback): void {
  if (callback) {
    // Mark test as only
    test.only(name, callback);
  }
}

/**
 * Concurrent function for running tests in parallel
 */
export function concurrent(name: string, callback: TestCallback): void;
export function concurrent(name: string, options: TestOptions, callback: TestCallback): void;
export function concurrent(name: string, optionsOrCallback: TestOptions | TestCallback, callback?: TestCallback): void {
  const options = typeof optionsOrCallback === 'object' ? optionsOrCallback : {};
  const testCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;

  if (testCallback) {
    test(name, { ...options, concurrent: true }, testCallback);
  }
}

/**
 * Failing function for tests that are expected to fail
 */
export function failing(name: string, callback: TestCallback): void {
  test(name, { ...callback.options, failing: true }, callback);
}

/**
 * Slow threshold configuration
 */
export const slow = {
  /** Set slow threshold in milliseconds */
  threshold: (ms: number) => {
    // Implementation would update test runner configuration
  }
};

/**
 * Timeout configuration
 */
export const timeout = {
  /** Set default timeout in milliseconds */
  set: (ms: number) => {
    // Implementation would update test runner configuration
  }
};

/**
 * Retry configuration
 */
export const retry = {
  /** Set retry count for tests */
  times: (count: number) => {
    // Implementation would update test runner configuration
  }
};

/**
 * Tag configuration
 */
export const tag = {
  /** Add tag to tests */
  add: (...tags: string[]) => {
    // Implementation would update test runner configuration
  }
};

/**
 * Test runner configuration
 */
export const testConfig = {
  /** Set test timeout */
  timeout: (ms: number) => {
    // Implementation would update test runner configuration
  },

  /** Set slow threshold */
  slow: (ms: number) => {
    // Implementation would update test runner configuration
  },

  /** Enable/disable coverage */
  coverage: (enabled: boolean) => {
    // Implementation would update test runner configuration
  },

  /** Set coverage thresholds */
  coverageThreshold: (thresholds: {
    statements?: number;
    branches?: number;
    functions?: number;
    lines?: number;
  }) => {
    // Implementation would update test runner configuration
  },

  /** Set test reporter */
  reporter: (reporter: string) => {
    // Implementation would update test runner configuration
  },

  /** Set test environment */
  environment: (env: string) => {
    // Implementation would update test runner configuration
  }
};

/**
 * Mock configuration
 */
export const mockConfig = {
  /** Enable/disable automatic mocking */
  autoMock: (enabled: boolean) => {
    // Implementation would update test runner configuration
  },

  /** Reset mocks after each test */
  reset: (afterEach: boolean = true) => {
    // Implementation would update test runner configuration
  },

  /** Clear mock calls and instances */
  clear: () => {
    MockFactory.resetAll();
  }
};

/**
 * Hook configuration
 */
export const hookConfig = {
  /** Set timeout for hooks */
  timeout: (ms: number) => {
    // Implementation would update test runner configuration
  }
};

/**
 * Test utilities
 */
export const testUtils = {
  /** Create a test context */
  createContext: (values: Record<string, any> = {}) => {
    return { ...values };
  },

  /** Create a fake timer */
  fakeTimers: () => {
    // Implementation would fake timers
  },

  /** Create a fake server */
  fakeServer: () => {
    // Implementation would create fake server
  },

  /** Create a fake request */
  fakeRequest: (url: string, options?: any) => {
    // Implementation would create fake request
  }
};

/**
 * Test result types
 */
export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'pending';
  duration: number;
  error?: Error;
  metadata?: {
    retryCount?: number;
    slow?: boolean;
    flaky?: boolean;
    tags?: string[];
  };
}

/**
 * Test suite result
 */
export interface SuiteResult {
  name: string;
  tests: TestResult[];
  duration: number;
  stats: {
    total: number;
    pass: number;
    fail: number;
    skip: number;
    pending: number;
  };
}

/**
 * Test runner interface
 */
export interface TestRunner {
  run(): Promise<SuiteResult[]>;
  watch(callback: (files: string[]) => void): void;
  stop(): void;
}

/**
 * Create test runner
 */
export function createTestRunner(config: any): TestRunner {
  // Implementation would create test runner
  return {
    async run() {
      return [];
    },
    watch(callback) {
      // Watch implementation
    },
    stop() {
      // Stop implementation
    }
  };
}

/**
 * Wait helper for async tests
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Async wait helper
 */
export function waitFor<T>(
  condition: () => T | Promise<T>,
  options: {
    interval?: number;
    timeout?: number;
    message?: string;
  } = {}
): Promise<T> {
  const { interval = 100, timeout = 5000, message } = options;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = async () => {
      try {
        const result = await condition();
        if (result) {
          resolve(result);
          return;
        }
      } catch (error) {
        // Ignore errors in condition check
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(message || 'Condition not met within timeout'));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Defer helper for async cleanup
 */
export function defer<T>(action: () => T | Promise<T>): Promise<T> {
  return new Promise(resolve => {
    setImmediate(() => resolve(action()));
  });
}

/**
 * Benchmark helper
 */
export function benchmark<T>(
  fn: () => T | Promise<T>,
  options: {
    iterations?: number;
    warmup?: number;
  } = {}
): Promise<{
  results: number[];
  average: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  p99: number;
}> {
  const { iterations = 100, warmup = 10 } = options;
  const results: number[] = [];

  return new Promise(async (resolve) => {
    // Warmup
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    // Benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const duration = performance.now() - start;
      results.push(duration);
    }

    // Calculate statistics
    const sorted = [...results].sort((a, b) => a - b);
    const average = results.reduce((sum, r) => sum + r, 0) / results.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    resolve({
      results,
      average,
      min,
      max,
      median,
      p95,
      p99
    });
  });
}

/**
 * Test assertions
 */
export const assertions = {
  ...assert,

  /** Expect helpers */
  expect: expectImpl,

  /** Test utilities */
  wait,
  waitFor,
  defer,
  benchmark,

  /** Mock utilities */
  ...mock,
  spyOn,
  ...jest,

  /** Test runner */
  createTestRunner
};

/**
 * Export all exports as global
 */
export const globals = {
  describe,
  test,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
  assert,
  mock,
  spyOn,
  jest,
  skip,
  only,
  concurrent,
  failing,
  slow,
  timeout,
  retry,
  tag,
  testConfig,
  mockConfig,
  hookConfig,
  testUtils,
  testUtils: testUtils,
  assertions,
  globals,
  wait,
  waitFor,
  defer,
  benchmark,
  createTestRunner
};