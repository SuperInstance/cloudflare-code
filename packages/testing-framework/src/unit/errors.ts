/**
 * Error classes for unit testing
 */

/**
 * Base test error
 */
export class TestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestError';
  }
}

/**
 * Assertion error
 */
export class AssertionError extends TestError {
  expected?: any;
  actual?: any;
  location?: AssertionLocation;

  constructor(message: string, expected?: any, actual?: any, location?: AssertionLocation) {
    super(message);
    this.expected = expected;
    this.actual = actual;
    this.location = location;
    this.name = 'AssertionError';
  }
}

/**
 * Test timeout error
 */
export class TestTimeoutError extends TestError {
  timeout: number;

  constructor(timeout: number) {
    super(`Test timed out after ${timeout}ms`);
    this.timeout = timeout;
    this.name = 'TestTimeoutError';
  }
}

/**
 * Test setup error
 */
export class TestSetupError extends TestError {
  constructor(message: string) {
    super(message);
    this.name = 'TestSetupError';
  }
}

/**
 * Test teardown error
 */
export class TestTeardownError extends TestError {
  constructor(message: string) {
    super(message);
    this.name = 'TestTeardownError';
  }
}

/**
 * Mock error
 */
export class MockError extends TestError {
  constructor(message: string) {
    super(message);
    this.name = 'MockError';
  }
}

/**
 * Spy error
 */
export class SpyError extends TestError {
  constructor(message: string) {
    super(message);
    this.name = 'SpyError';
  }
}

/**
 * Assertion location interface
 */
export interface AssertionLocation {
  file?: string;
  line?: number;
  column?: number;
  function?: string;
}