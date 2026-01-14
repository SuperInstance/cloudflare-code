/**
 * Tests for Retry Policies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RetryPolicy,
  RetryManager,
  createAPIRetryPolicy,
  createRateLimitRetryPolicy,
  createQuickRetryPolicy,
  createLongRunningRetryPolicy,
  createJitterRetryPolicy,
  createBudgetedRetryPolicy,
  retry,
  BackoffStrategy,
} from './retry';

describe('Retry Policy', () => {
  describe('Basic Retry', () => {
    it('should succeed on first attempt', async () => {
      const policy = new RetryPolicy({ maxRetries: 3 });
      const fn = vi.fn().mockResolvedValue('success');

      const result = await policy.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const policy = new RetryPolicy({ maxRetries: 3, baseDelay: 10 });
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue('success');

      const result = await policy.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const policy = new RetryPolicy({ maxRetries: 2, baseDelay: 10 });
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      await expect(policy.execute(fn)).rejects.toThrow('failure');
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should not retry on non-retryable errors', async () => {
      const policy = new RetryPolicy({ maxRetries: 3, baseDelay: 10 });
      const fn = vi.fn().mockRejectedValue(new Error('validation error'));

      await expect(policy.execute(fn)).rejects.toThrow('validation error');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry with Result', () => {
    it('should return detailed result on success', async () => {
      const policy = new RetryPolicy({ maxRetries: 3, baseDelay: 10 });
      const fn = vi.fn().mockResolvedValue('success');

      const result = await policy.executeWithResult(fn);

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalDelay).toBe(0);
    });

    it('should return detailed result on failure', async () => {
      const policy = new RetryPolicy({ maxRetries: 2, baseDelay: 10 });
      const fn = vi.fn().mockRejectedValue(new Error('timeout'));

      const result = await policy.executeWithResult(fn);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.attempts).toBe(3); // initial + 2 retries
      expect(result.totalDelay).toBeGreaterThan(0);
    });

    it('should include retry attempts in result', async () => {
      const policy = new RetryPolicy({ maxRetries: 2, baseDelay: 10 });
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const result = await policy.executeWithResult(fn);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.retryAttempts).toHaveLength(2);
      expect(result.retryAttempts[0].attempt).toBe(1);
      expect(result.retryAttempts[0].error.message).toBe('timeout');
    });
  });

  describe('Backoff Strategies', () => {
    it('should use exponential backoff', async () => {
      const policy = new RetryPolicy({
        maxRetries: 3,
        baseDelay: 100,
        strategy: BackoffStrategy.EXPONENTIAL,
        backoffMultiplier: 2,
      });

      const delays: number[] = [];
      const fn = vi.fn()
        .mockImplementation(async () => {
          throw new Error('failure');
        });

      const onRetry = vi.fn((error, attempt, delay) => {
        delays.push(delay);
      });

      policy = new RetryPolicy({
        maxRetries: 3,
        baseDelay: 100,
        strategy: BackoffStrategy.EXPONENTIAL,
        backoffMultiplier: 2,
        onRetry,
      });

      try {
        await policy.execute(fn);
      } catch (e) {
        // Expected to fail
      }

      expect(delays).toHaveLength(3);
      expect(delays[0]).toBeGreaterThan(90); // ~100
      expect(delays[1]).toBeGreaterThan(190); // ~200
      expect(delays[2]).toBeGreaterThan(390); // ~400
    });

    it('should use linear backoff', async () => {
      const policy = new RetryPolicy({
        maxRetries: 3,
        baseDelay: 100,
        strategy: BackoffStrategy.LINEAR,
      });

      const delays: number[] = [];
      const onRetry = vi.fn((error, attempt, delay) => {
        delays.push(delay);
      });

      const policyWithCallback = new RetryPolicy({
        maxRetries: 3,
        baseDelay: 100,
        strategy: BackoffStrategy.LINEAR,
        onRetry,
      });

      const fn = vi.fn().mockImplementation(async () => {
        throw new Error('failure');
      });

      try {
        await policyWithCallback.execute(fn);
      } catch (e) {
        // Expected to fail
      }

      expect(delays).toHaveLength(3);
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
    });

    it('should use fixed delay', async () => {
      const delays: number[] = [];
      const onRetry = vi.fn((error, attempt, delay) => {
        delays.push(delay);
      });

      const policy = new RetryPolicy({
        maxRetries: 3,
        baseDelay: 100,
        strategy: BackoffStrategy.FIXED,
        onRetry,
      });

      const fn = vi.fn().mockImplementation(async () => {
        throw new Error('failure');
      });

      try {
        await policy.execute(fn);
      } catch (e) {
        // Expected to fail
      }

      expect(delays).toHaveLength(3);
      delays.forEach(delay => {
        expect(delay).toBeGreaterThan(90);
        expect(delay).toBeLessThan(110);
      });
    });
  });

  describe('Jitter', () => {
    it('should apply jitter to delays', async () => {
      const delays: number[] = [];
      const onRetry = vi.fn((error, attempt, delay) => {
        delays.push(delay);
      });

      const policy = new RetryPolicy({
        maxRetries: 5,
        baseDelay: 100,
        jitterFactor: 0.5,
        onRetry,
      });

      const fn = vi.fn().mockImplementation(async () => {
        throw new Error('failure');
      });

      try {
        await policy.execute(fn);
      } catch (e) {
        // Expected to fail
      }

      // Check that delays vary
      const uniqueDelays = new Set(delays.map(d => Math.floor(d / 10)));
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Custom Retry Condition', () => {
    it('should use custom shouldRetry predicate', async () => {
      const shouldRetry = vi.fn((error, attempt) => {
        return error.message.includes('temporary') && attempt < 2;
      });

      const policy = new RetryPolicy({
        maxRetries: 5,
        baseDelay: 10,
        shouldRetry,
      });

      const fn = vi.fn().mockRejectedValue(new Error('temporary error'));

      await expect(policy.execute(fn)).rejects.toThrow('temporary error');
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries (custom limit)
      expect(shouldRetry).toHaveBeenCalledTimes(3);
    });

    it('should not retry when custom predicate returns false', async () => {
      const shouldRetry = vi.fn(() => false);

      const policy = new RetryPolicy({
        maxRetries: 5,
        baseDelay: 10,
        shouldRetry,
      });

      const fn = vi.fn().mockRejectedValue(new Error('any error'));

      await expect(policy.execute(fn)).rejects.toThrow('any error');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('Retry Budget', () => {
    it('should respect retry budget', async () => {
      const policy = new RetryPolicy({
        maxRetries: 5,
        baseDelay: 10,
        useRetryBudget: true,
        retryBudget: 3,
      });

      const fn = vi.fn().mockRejectedValue(new Error('timeout'));

      // Use up budget
      for (let i = 0; i < 5; i++) {
        try {
          await policy.execute(fn);
        } catch (e) {
          // Expected to fail
        }
      }

      // Budget should be exhausted
      const budgetStatus = policy.getBudgetStatus();
      expect(budgetStatus?.remaining).toBeLessThan(3);
    });

    it('should reset budget after window expires', async () => {
      const policy = new RetryPolicy({
        maxRetries: 1,
        baseDelay: 10,
        useRetryBudget: true,
        retryBudget: 2,
      });

      // Exhaust budget
      const fn = vi.fn().mockRejectedValue(new Error('timeout'));
      try {
        await policy.execute(fn);
      } catch (e) {
        // Expected to fail
      }

      let budget = policy.getBudgetStatus();
      expect(budget?.remaining).toBeLessThan(2);

      // Reset budget
      policy.resetBudget();

      budget = policy.getBudgetStatus();
      expect(budget?.remaining).toBe(2);
    });
  });

  describe('Retry History', () => {
    it('should track retry history by key', async () => {
      const policy = new RetryPolicy({
        maxRetries: 2,
        baseDelay: 10,
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue('success');

      await policy.execute(fn, { key: 'test-key' });

      const history = policy.getHistory('test-key');
      expect(history).toHaveLength(1);
      expect(history[0].attempt).toBe(1);
      expect(history[0].error.message).toBe('failure');
    });

    it('should clear retry history', async () => {
      const policy = new RetryPolicy({
        maxRetries: 2,
        baseDelay: 10,
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue('success');

      await policy.execute(fn, { key: 'test-key' });
      expect(policy.getHistory('test-key')).toHaveLength(1);

      policy.clearHistory('test-key');
      expect(policy.getHistory('test-key')).toHaveLength(0);
    });
  });

  describe('Callbacks', () => {
    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();

      const policy = new RetryPolicy({
        maxRetries: 2,
        baseDelay: 10,
        onRetry,
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue('success');

      await policy.execute(fn);

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1,
        expect.any(Number)
      );
    });

    it('should call onRetrySuccess callback', async () => {
      const onRetrySuccess = vi.fn();

      const policy = new RetryPolicy({
        maxRetries: 2,
        baseDelay: 10,
        onRetrySuccess,
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue('success');

      await policy.execute(fn);

      expect(onRetrySuccess).toHaveBeenCalledTimes(1);
      expect(onRetrySuccess).toHaveBeenCalledWith(1, expect.any(Number));
    });

    it('should call onRetryFailed callback', async () => {
      const onRetryFailed = vi.fn();

      const policy = new RetryPolicy({
        maxRetries: 2,
        baseDelay: 10,
        onRetryFailed,
      });

      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      try {
        await policy.execute(fn);
      } catch (e) {
        // Expected to fail
      }

      expect(onRetryFailed).toHaveBeenCalledTimes(1);
      expect(onRetryFailed).toHaveBeenCalledWith(
        expect.any(Error),
        3,
        expect.any(Number)
      );
    });
  });

  describe('Factory Functions', () => {
    it('should create API retry policy', () => {
      const policy = createAPIRetryPolicy(5);
      expect(policy).toBeInstanceOf(RetryPolicy);
      const config = policy.getConfig();
      expect(config.maxRetries).toBe(5);
    });

    it('should create rate limit retry policy', () => {
      const policy = createRateLimitRetryPolicy();
      expect(policy).toBeInstanceOf(RetryPolicy);
      const config = policy.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.baseDelay).toBe(5000);
    });

    it('should create quick retry policy', () => {
      const policy = createQuickRetryPolicy();
      expect(policy).toBeInstanceOf(RetryPolicy);
      const config = policy.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.baseDelay).toBe(100);
    });

    it('should create long running retry policy', () => {
      const policy = createLongRunningRetryPolicy();
      expect(policy).toBeInstanceOf(RetryPolicy);
      const config = policy.getConfig();
      expect(config.maxRetries).toBe(10);
      expect(config.maxDelay).toBe(300000);
    });

    it('should create jitter retry policy', () => {
      const policy = createJitterRetryPolicy();
      expect(policy).toBeInstanceOf(RetryPolicy);
      const config = policy.getConfig();
      expect(config.strategy).toBe(BackoffStrategy.FULL_JITTER);
    });

    it('should create budgeted retry policy', () => {
      const policy = createBudgetedRetryPolicy(3, 50);
      expect(policy).toBeInstanceOf(RetryPolicy);
      const budget = policy.getBudgetStatus();
      expect(budget?.remaining).toBe(50);
    });
  });

  describe('Retry Manager', () => {
    it('should manage multiple policies', () => {
      const manager = new RetryManager();
      const policy1 = createAPIRetryPolicy(3);
      const policy2 = createQuickRetryPolicy(5);

      manager.registerPolicy('api', policy1);
      manager.registerPolicy('quick', policy2);

      expect(manager.getPolicy('api')).toBe(policy1);
      expect(manager.getPolicy('quick')).toBe(policy2);
    });

    it('should execute with named policy', async () => {
      const manager = new RetryManager();
      const policy = createAPIRetryPolicy(3);
      manager.registerPolicy('api', policy);

      const fn = vi.fn().mockResolvedValue('success');
      const result = await manager.executeWithPolicy('api', fn);

      expect(result).toBe('success');
    });

    it('should throw for unknown policy', async () => {
      const manager = new RetryManager();
      const fn = vi.fn().mockResolvedValue('success');

      await expect(manager.executeWithPolicy('unknown', fn))
        .rejects.toThrow('Retry policy \'unknown\' not found');
    });

    it('should remove policies', () => {
      const manager = new RetryManager();
      const policy = createAPIRetryPolicy();
      manager.registerPolicy('api', policy);

      expect(manager.getPolicy('api')).toBe(policy);

      manager.removePolicy('api');
      expect(manager.getPolicy('api')).toBeUndefined();
    });

    it('should clear all policies', () => {
      const manager = new RetryManager();
      manager.registerPolicy('api', createAPIRetryPolicy());
      manager.registerPolicy('quick', createQuickRetryPolicy());

      expect(manager.getPolicyNames()).toHaveLength(2);

      manager.clear();
      expect(manager.getPolicyNames()).toHaveLength(0);
    });
  });

  describe('Convenience Functions', () => {
    it('should retry with convenience function', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const result = await retry(fn, 3);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry with result convenience function', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const result = await retry(fn, 3);

      expect(result).toBe('success');
    });
  });
});
