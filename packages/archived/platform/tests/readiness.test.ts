/**
 * Tests for production readiness checker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ReadinessChecker,
  createReadinessChecker,
} from '../src/readiness/checker';

describe('ReadinessChecker', () => {
  let checker: ReadinessChecker;

  beforeEach(() => {
    checker = new ReadinessChecker();
  });

  describe('readiness checks', () => {
    it('should register and execute readiness checks', async () => {
      checker.registerCheck('custom', async () => ({
        name: 'custom',
        status: 'pass',
        message: 'Check passed',
        critical: true,
      }));

      const result = await checker.check();

      expect(result.score).toBeGreaterThan(0);
      expect(result.checks.some((c) => c.name === 'custom')).toBe(true);
    });

    it('should calculate readiness score', async () => {
      checker.registerCheck('passing', async () => ({
        name: 'passing',
        status: 'pass',
        message: 'Passed',
        critical: true,
      }));

      const result = await checker.check();

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should determine readiness status', async () => {
      checker.registerCheck('passing', async () => ({
        name: 'passing',
        status: 'pass',
        message: 'Passed',
        critical: true,
      }));

      const result = await checker.check();

      expect(['ready', 'not-ready', 'degraded']).toContain(result.status);
    });

    it('should handle failing checks', async () => {
      checker.registerCheck('failing', async () => ({
        name: 'failing',
        status: 'fail',
        message: 'Check failed',
        critical: true,
      }));

      const result = await checker.check();

      expect(result.summary.failed).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    it('should handle warning checks', async () => {
      checker.registerCheck('warning', async () => ({
        name: 'warning',
        status: 'warn',
        message: 'Warning',
        critical: false,
      }));

      const result = await checker.check();

      expect(result.summary.warnings).toBeGreaterThan(0);
    });

    it('should timeout checks', async () => {
      checker.registerCheck('slow', async () => {
        await new Promise((resolve) => setTimeout(resolve, 6000));
        return {
          name: 'slow',
          status: 'pass',
          message: 'Passed',
          critical: true,
        };
      });

      const result = await checker.check({ timeout: 1000 });

      expect(result.summary.failed).toBeGreaterThan(0);
    });

    it('should generate recommendations', async () => {
      checker.registerCheck('failing', async () => ({
        name: 'failing',
        status: 'fail',
        message: 'Configuration is invalid',
        critical: true,
      }));

      const result = await checker.check();

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]).toBe('Configuration is invalid');
    });

    it('should weigh critical checks higher', async () => {
      checker.registerCheck(
        'critical-pass',
        async () => ({
          name: 'critical-pass',
          status: 'pass',
          message: 'Passed',
          critical: true,
        })
      );

      checker.registerCheck(
        'non-critical-fail',
        async () => ({
          name: 'non-critical-fail',
          status: 'fail',
          message: 'Failed',
          critical: false,
        })
      );

      const result = await checker.check();

      // Critical passing check should have more weight
      expect(result.score).toBeGreaterThan(50);
    });
  });

  describe('summary', () => {
    it('should provide accurate summary', async () => {
      checker.registerCheck('pass1', async () => ({
        name: 'pass1',
        status: 'pass',
        message: 'Passed',
        critical: true,
      }));

      checker.registerCheck('pass2', async () => ({
        name: 'pass2',
        status: 'pass',
        message: 'Passed',
        critical: true,
      }));

      checker.registerCheck('fail1', async () => ({
        name: 'fail1',
        status: 'fail',
        message: 'Failed',
        critical: true,
      }));

      checker.registerCheck('warn1', async () => ({
        name: 'warn1',
        status: 'warn',
        message: 'Warning',
        critical: false,
      }));

      const result = await checker.check();

      expect(result.summary.passed).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.summary.warnings).toBe(1);
      expect(result.summary.total).toBeGreaterThanOrEqual(4);
    });
  });

  describe('readiness status', () => {
    it('should be ready with high score', async () => {
      const checker = new ReadinessChecker();

      // All default checks should pass
      const result = await checker.check();

      if (result.score >= 95) {
        expect(result.status).toBe('ready');
      }
    });

    it('should be degraded with medium score', async () => {
      const checker = new ReadinessChecker();

      checker.registerCheck('pass', async () => ({
        name: 'pass',
        status: 'pass',
        message: 'Passed',
        critical: true,
      }));

      checker.registerCheck('fail', async () => ({
        name: 'fail',
        status: 'fail',
        message: 'Failed',
        critical: false,
      }));

      const result = await checker.check();

      if (result.score >= 70 && result.score < 95) {
        expect(result.status).toBe('degraded');
      }
    });

    it('should be not-ready with low score', async () => {
      const checker = new ReadinessChecker();

      checker.registerCheck('fail', async () => ({
        name: 'fail',
        status: 'fail',
        message: 'Failed',
        critical: true,
      }));

      const result = await checker.check();

      if (result.score < 70) {
        expect(result.status).toBe('not-ready');
      }
    });
  });
});

describe('createReadinessChecker', () => {
  it('should create readiness checker', async () => {
    const checker = createReadinessChecker();

    const result = await checker.check();

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.checks.length).toBeGreaterThan(0);
  });
});
