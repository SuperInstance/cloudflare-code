/**
 * Integration Tests for Resilience Patterns
 *
 * Tests combining rate limiting, circuit breakers, and retry logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenBucket, SlidingWindow } from '../../packages/edge/src/lib/rate-limit';
import { CircuitBreaker } from '../../packages/edge/src/lib/circuit-breaker';
import { RetryPolicy } from '../../packages/edge/src/lib/retry';
import { QuotaTracker } from '../../packages/edge/src/lib/quota';

// Mock KV namespace
class MockKVNamespace implements KVNamespace {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null>;
  async get(key: string, type: 'text'): Promise<string | null>;
  async get(key: string, type: 'json'): Promise<any>;
  async get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  async get(key: string, type?: string): Promise<any> {
    const value = this.store.get(key);
    if (!value) return null;

    if (type === 'json') {
      return JSON.parse(value);
    }
    return value;
  }

  async put(key: string, value: any, options?: any): Promise<void> {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<any>> {
    const prefix = options?.prefix || '';
    const keys = Array.from(this.store.keys())
      .filter(key => key.startsWith(prefix))
      .map(key => ({ name: key, metadata: null }));

    return {
      keys,
      list_complete: true,
      cursor: '',
    };
  }
}

describe('Integration: Rate Limiting + Circuit Breaker + Retry', () => {
  let mockKV: MockKVNamespace;
  let tokenBucket: TokenBucket;
  let slidingWindow: SlidingWindow;
  let circuitBreaker: CircuitBreaker;
  let retryPolicy: RetryPolicy;
  let quotaTracker: QuotaTracker;

  beforeEach(() => {
    mockKV = new MockKVNamespace();

    tokenBucket = new TokenBucket({
      capacity: 100,
      refillRate: 10, // 10 tokens per second
    });

    slidingWindow = new SlidingWindow({
      maxRequests: 50,
      windowMs: 60000, // 1 minute
    });

    circuitBreaker = new CircuitBreaker({
      name: 'api-service',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 10000,
    });

    retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
    });

    quotaTracker = new QuotaTracker({
      kv: mockKV as any,
      enableAnalytics: true,
    });
  });

  describe('Rate limiting before API call', () => {
    it('should check rate limit before executing', async () => {
      await quotaTracker.initialize('openai', 1000000, 'daily');

      // Simulate API call with rate limiting
      const executeWithRateLimit = async (userId: string): Promise<string> => {
        // Check token bucket
        const hasTokens = await tokenBucket.tryConsume(userId, 1);
        if (!hasTokens) {
          throw new Error('Rate limited (token bucket)');
        }

        // Check sliding window
        const allowed = await slidingWindow.isAllowed(userId);
        if (!allowed) {
          throw new Error('Rate limited (sliding window)');
        }

        // Check quota
        const hasQuota = await quotaTracker.hasQuota('openai', 1000);
        if (!hasQuota) {
          throw new Error('Quota exhausted');
        }

        // Execute with circuit breaker and retry
        return await circuitBreaker.execute(async () => {
          return await retryPolicy.execute(async () => {
            // Simulate API call
            await quotaTracker.recordUsage('openai', 1000);
            return 'API response';
          });
        });
      };

      const result = await executeWithRateLimit('user-123');
      expect(result).toBe('API response');
    });

    it('should fail when rate limit exceeded', async () => {
      // Consume all tokens
      for (let i = 0; i < 100; i++) {
        await tokenBucket.tryConsume('user-456', 1);
      }

      await expect(
        tokenBucket.tryConsume('user-456', 1)
      ).resolves.toBe(false);
    });
  });

  describe('Circuit breaker with retry', () => {
    it('should retry before opening circuit', async () => {
      let attemptCount = 0;
      const failingService = async (): Promise<string> => {
        attemptCount++;
        if (attemptCount <= 4) {
          throw new Error('Service unavailable');
        }
        return 'Success';
      };

      // Should retry and eventually succeed before circuit opens
      const result = await circuitBreaker.execute(async () => {
        return await retryPolicy.execute(failingService);
      });

      expect(result).toBe('Success');
      expect(attemptCount).toBe(5); // Initial + 4 retries
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should open circuit after threshold with retry', async () => {
      const alwaysFailing = async (): Promise<string> => {
        throw new Error('Always fails');
      };

      // Execute multiple times to open circuit
      for (let i = 0; i < 6; i++) {
        try {
          await circuitBreaker.execute(async () => {
            return await retryPolicy.execute(alwaysFailing);
          });
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });

  describe('Quota-aware routing', () => {
    it('should route to provider with most quota', async () => {
      await quotaTracker.initialize('openai', 1000000, 'daily');
      await quotaTracker.initialize('anthropic', 500000, 'daily');
      await quotaTracker.initialize('groq', 10000000, 'daily');

      // Use some quota
      await quotaTracker.recordUsage('openai', 800000); // 200K remaining
      await quotaTracker.recordUsage('anthropic', 100000); // 400K remaining
      await quotaTracker.recordUsage('groq', 1000000); // 9M remaining

      // Get providers sorted by remaining
      const providers = await quotaTracker.getProvidersByRemaining();

      // Groq should be first (most remaining)
      expect(providers[0]).toBe('groq');
      expect(providers[1]).toBe('anthropic');
      expect(providers[2]).toBe('openai');
    });

    it('should skip exhausted providers', async () => {
      await quotaTracker.initialize('openai', 1000, 'daily');
      await quotaTracker.initialize('anthropic', 1000000, 'daily');

      // Exhaust openai
      await quotaTracker.recordUsage('openai', 1000);

      const openaiExhausted = await quotaTracker.isExhausted('openai');
      const anthropicExhausted = await quotaTracker.isExhausted('anthropic');

      expect(openaiExhausted).toBe(true);
      expect(anthropicExhausted).toBe(false);
    });
  });

  describe('Complete resilience flow', () => {
    it('should handle complete request with all patterns', async () => {
      await quotaTracker.initialize('openai', 1000000, 'daily');

      let callCount = 0;
      const apiService = async (provider: string): Promise<string> => {
        callCount++;

        // Simulate transient failure on first call
        if (callCount === 1) {
          const error: any = new Error('Timeout');
          error.code = 'ETIMEDOUT';
          throw error;
        }

        // Simulate rate limit on second call
        if (callCount === 2) {
          const error: any = new Error('Rate limited');
          error.status = 429;
          throw error;
        }

        // Success on third call
        await quotaTracker.recordUsage(provider, 1000);
        return `Response from ${provider}`;
      };

      const resilientCall = async (): Promise<string> => {
        const userId = 'user-789';

        // Check rate limits
        const hasTokens = await tokenBucket.tryConsume(userId, 1);
        if (!hasTokens) {
          throw new Error('Rate limited (token bucket)');
        }

        const allowed = await slidingWindow.isAllowed(userId);
        if (!allowed) {
          throw new Error('Rate limited (sliding window)');
        }

        // Check quota
        const hasQuota = await quotaTracker.hasQuota('openai', 1000);
        if (!hasQuota) {
          throw new Error('Quota exhausted');
        }

        // Execute with circuit breaker and retry
        return await circuitBreaker.execute(async () => {
          return await retryPolicy.execute(async () => {
            return await apiService('openai');
          });
        });
      };

      const result = await resilientCall();

      expect(result).toBe('Response from openai');
      expect(callCount).toBe(3); // Initial + 2 retries
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('Failover between providers', () => {
    it('should failover to backup provider on quota exhaustion', async () => {
      await quotaTracker.initialize('primary', 1000, 'daily');
      await quotaTracker.initialize('backup', 1000000, 'daily');

      // Exhaust primary
      await quotaTracker.recordUsage('primary', 1000);

      const getProvider = async (): Promise<string> => {
        if (await quotaTracker.hasQuota('primary', 1000)) {
          return 'primary';
        }
        if (await quotaTracker.hasQuota('backup', 1000)) {
          return 'backup';
        }
        throw new Error('All providers exhausted');
      };

      const provider = await getProvider();
      expect(provider).toBe('backup');
    });
  });

  describe('Circuit breaker recovery', () => {
    it('should recover after timeout', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-service',
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 100, // Short timeout for testing
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Fail');
          });
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should transition to HALF_OPEN
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Success calls should close it
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      expect(breaker.getState()).toBe('CLOSED');
    });
  });
});

describe('Load Testing Scenarios', () => {
  it('should handle burst traffic with rate limiting', async () => {
    const limiter = new TokenBucket({
      capacity: 100,
      refillRate: 10,
    });

    // Simulate burst of 150 requests
    let allowed = 0;
    let blocked = 0;

    for (let i = 0; i < 150; i++) {
      const result = await limiter.tryConsume(`user-${i % 10}`, 1);
      if (result) {
        allowed++;
      } else {
        blocked++;
      }
    }

    expect(allowed).toBe(100); // First 100 allowed
    expect(blocked).toBe(50); // Last 50 blocked
  });

  it('should distribute load across multiple users', async () => {
    const limiter = new SlidingWindow({
      maxRequests: 10,
      windowMs: 1000,
    });

    // Simulate requests from 5 different users
    const results: Map<string, number> = new Map();

    for (let user = 1; user <= 5; user++) {
      let allowed = 0;
      for (let i = 0; i < 15; i++) {
        const result = await limiter.isAllowed(`user-${user}`);
        if (result) allowed++;
      }
      results.set(`user-${user}`, allowed);
    }

    // Each user should have 10 allowed requests
    for (const [user, count] of results.entries()) {
      expect(count).toBe(10);
    }
  });
});
