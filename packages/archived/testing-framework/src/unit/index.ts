/**
 * Unit Testing Module for ClaudeFlare Testing Framework
 * Provides Jest-like assertion library and mocking utilities
 */

export * from './assertions';
export * from './mocks';
export * from './expect';
export * from './jest-compat';

// Main exports for unit testing
export { describe, test, it, beforeEach, afterEach, beforeAll, afterAll, expect } from './jest-compat';
export { mock, spyOn, jest } from './mocks';
export { assert } from './assertions';

// Test runner for unit tests
export { createUnitTestRunner } from './test-runner';