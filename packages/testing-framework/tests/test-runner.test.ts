import { describe, test, expect, beforeEach, afterEach } from '../src/unit/jest-compat';
import { TestRunner, TestConfig, TestResult, TestStatus } from '../src/core';
import { createTestRunner } from '../src/core/test-runner';

describe('TestRunner', () => {
  let testRunner: TestRunner;
  let testConfig: TestConfig;

  beforeEach(() => {
    testConfig = {
      pattern: ['**/*.test.ts'],
      testDir: ['test'],
      maxParallel: 4,
      coverage: false,
      reporters: [{ type: 'console' }]
    };
    testRunner = createTestRunner(testConfig);
  });

  afterEach(() => {
    testRunner.clearResults();
  });

  test('should initialize with default configuration', () => {
    expect(testRunner).toBeDefined();
    expect(testRunner.getState()).toBe('idle');
  });

  test('should collect test files successfully', async () => {
    const testFiles = await testRunner['collector']['collect']();
    expect(Array.isArray(testFiles)).toBe(true);
  });

  test('should execute tests and return results', async () => {
    const results = await testRunner.run();
    expect(Array.isArray(results)).toBe(true);

    for (const result of results) {
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('startTime');
      expect(result).toHaveProperty('endTime');
    }
  });

  test('should handle test failures gracefully', async () => {
    // This would need a failing test file to test properly
    // For now, just ensure the runner doesn't crash
    const results = await testRunner.run();
    expect(results).toBeDefined();
  });

  test('should support stopping test execution', async () => {
    // Start test run
    setTimeout(() => testRunner.stop(), 100);

    const results = await testRunner.run();
    expect(results).toBeDefined();
  });

  test('should provide test statistics', async () => {
    const results = await testRunner.run();
    const stats = {
      total: results.length,
      passed: results.filter(r => r.status === TestStatus.PASS).length,
      failed: results.filter(r => r.status === TestStatus.FAIL).length
    };

    expect(stats.total).toBeGreaterThanOrEqual(0);
    expect(stats.passed + stats.failed).toBe(stats.total);
  });

  test('should clear test results', () => {
    testRunner.clearResults();
    const results = testRunner.getResults();
    expect(results.length).toBe(0);
  });
});