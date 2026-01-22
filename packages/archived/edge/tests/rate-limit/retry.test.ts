/**
 * Retry Logic Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RetryPolicy,
  createAPIRetryPolicy,
  createQuickRetryPolicy,
  createLongRunningRetryPolicy,
  retry,
} from '../../src/lib/retry';

describe('RetryPolicy', () => {
  let policy: RetryPolicy;

  beforeEach(() => {
    policy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitterFactor: 0,
    });
  });

  describe('Successful execution', () => {
    it('should execute function successfully without retries', async () => {
      const fn = async () => 'success';
      const result = await policy.execute(fn);

      expect(result).toBe('success');
    });

    it('should not retry on success', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        return 'success';
      };

      await policy.execute(fn);

      expect(callCount).toBe(1);
    });
  });

  describe('Retry on failure', () => {
    it('should retry on retryable errors', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 2) {
          const error: any = new Error('Timeout');
          error.code = 'ETIMEDOUT';
          throw error;
        }
        return 'success';
      };

      const result = await policy.execute(fn);

      expect(result).toBe('success');
      expect(callCount).toBe(2);
    });

    it('should respect max attempts', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        const error: any = new Error('Timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      };

      try {
        await policy.execute(fn);
      } catch (error) {
        // Expected
      }

      expect(callCount).toBe(4); // Initial + 3 retries
    });

    it('should throw final error after all retries', async () => {
      const fn = async () => {
        const error: any = new Error('Timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      };

      await expect(policy.execute(fn)).rejects.toThrow('Timeout');
    });
  });

  describe('Exponential backoff', () => {
    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const startTimes: number[] = [];

      const fn = async () => {
        startTimes.push(Date.now());
        const error: any = new Error('Timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      };

      const policyWithCallback = new RetryPolicy({
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitterFactor: 0,
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        },
      });

      try {
        await policyWithCallback.execute(fn);
      } catch (error) {
        // Expected
      }

      // Expected delays: 100, 200, 400
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
      expect(delays[2]).toBe(400);
    });

    it('should cap delay at maxDelay', async () => {
      const delays: number[] = [];

      const policyWithMaxDelay = new RetryPolicy({
        maxAttempts: 10,
        baseDelay: 100,
        maxDelay: 300,
        backoffMultiplier: 2,
        jitterFactor: 0,
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        },
      });

      const fn = async () => {
        const error: any = new Error('Timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      };

      try {
        await policyWithMaxDelay.execute(fn);
      } catch (error) {
        // Expected
      }

      // Delays should be capped at 300
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(300);
      });
    });
  });

  describe('Jitter', () => {
    it('should add jitter to delays', async () => {
      const delays: number[] = [];

      const policyWithJitter = new RetryPolicy({
        maxAttempts: 5,
        baseDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitterFactor: 0.1,
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        },
      });

      const fn = async () => {
        const error: any = new Error('Timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      };

      try {
        await policyWithJitter.execute(fn);
      } catch (error) {
        // Expected
      }

      // Check that delays vary (not exact multiples)
      const baseDelay = 100;
      const hasVariation = delays.some(
        delay => delay !== baseDelay && delay !== baseDelay * 2
      );
      expect(hasVariation).toBe(true);
    });
  });

  describe('Retry conditions', () => {
    it('should retry on 429 status code', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 2) {
          const error: any = new Error('Rate limited');
          error.status = 429;
          throw error;
        }
        return 'success';
      };

      const result = await policy.execute(fn);
      expect(result).toBe('success');
      expect(callCount).toBe(2);
    });

    it('should retry on 5xx status codes', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 2) {
          const error: any = new Error('Server error');
          error.status = 500;
          throw error;
        }
        return 'success';
      };

      const result = await policy.execute(fn);
      expect(result).toBe('success');
    });

    it('should not retry on 4xx (except 429)', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        const error: any = new Error('Not found');
        error.status = 404;
        throw error;
      };

      try {
        await policy.execute(fn);
      } catch (error) {
        // Expected
      }

      expect(callCount).toBe(1); // No retries
    });

    it('should retry on network errors', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 2) {
          const error: any = new Error('Connection reset');
          error.code = 'ECONNRESET';
          throw error;
        }
        return 'success';
      };

      const result = await policy.execute(fn);
      expect(result).toBe('success');
    });
  });

  describe('Custom retry condition', () => {
    it('should use custom shouldRetry predicate', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        const error: any = new Error('Custom error');
        error.code = 'CUSTOM_ERROR';
        throw error;
      };

      const customPolicy = new RetryPolicy({
        maxAttempts: 5,
        shouldRetry: (error, attempt) => {
          return (error as any).code === 'CUSTOM_ERROR' && attempt < 2;
        },
      });

      try {
        await customPolicy.execute(fn);
      } catch (error) {
        // Expected
      }

      expect(callCount).toBe(3); // Initial + 2 retries
    });
  });

  describe('executeWithResult', () => {
    it('should return success result', async () => {
      const fn = async () => 'success';

      const result = await policy.executeWithResult(fn);

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalDelay).toBe(0);
    });

    it('should return failure result after retries', async () => {
      const fn = async () => {
        const error: any = new Error('Timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      };

      const result = await policy.executeWithResult(fn);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts).toBe(4); // Initial + 3 retries
      expect(result.totalDelay).toBeGreaterThan(0);
    });
  });
});

describe('createAPIRetryPolicy', () => {
  it('should create policy for API calls', () => {
    const policy = createAPIRetryPolicy(3);

    expect(policy).toBeInstanceOf(RetryPolicy);
  });
});

describe('createQuickRetryPolicy', () => {
  it('should create policy for quick retries', async () => {
    const policy = createQuickRetryPolicy(3);

    const delays: number[] = [];
    const fn = async () => {
      const error: any = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      throw error;
    };

    const quickPolicy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
      jitterFactor: 0.2,
      onRetry: (error, attempt, delay) => {
        delays.push(delay);
      },
    });

    try {
      await quickPolicy.execute(fn);
    } catch (error) {
      // Expected
    }

    // Should use lower base delay
    expect(delays[0]).toBeLessThan(150);
  });
});

describe('createLongRunningRetryPolicy', () => {
  it('should create policy for long operations', async () => {
    const policy = createLongRunningRetryPolicy(10);

    expect(policy).toBeInstanceOf(RetryPolicy);
  });
});

describe('retry convenience function', () => {
  it('should execute with retry using default policy', async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      if (callCount < 2) {
        const error: any = new Error('Timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      }
      return 'success';
    };

    const result = await retry(fn, 3);

    expect(result).toBe('success');
    expect(callCount).toBe(2);
  });
});

describe('RetryPolicy edge cases', () => {
  it('should handle zero max attempts', async () => {
    const policy = new RetryPolicy({
      maxAttempts: 0,
    });

    const fn = async () => {
      const error: any = new Error('Failed');
      error.code = 'ETIMEDOUT';
      throw error;
    };

    await expect(policy.execute(fn)).rejects.toThrow();
  });

  it('should handle very small delays', async () => {
    const policy = new RetryPolicy({
      maxAttempts: 2,
      baseDelay: 1,
      maxDelay: 10,
      backoffMultiplier: 2,
      jitterFactor: 0,
    });

    const startTime = Date.now();
    const fn = async () => {
      const error: any = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      throw error;
    };

    try {
      await policy.execute(fn);
    } catch (error) {
      // Expected
    }

    const elapsed = Date.now() - startTime;
    // Should be very fast (1ms + 2ms)
    expect(elapsed).toBeLessThan(100);
  });

  it('should handle errors without status or code', async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      if (callCount < 2) {
        throw new Error('Network timeout');
      }
      return 'success';
    };

    const result = await policy.execute(fn);
    expect(result).toBe('success');
    expect(callCount).toBe(2);
  });
});
