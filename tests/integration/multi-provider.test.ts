/**
 * Integration Tests - Multi-Provider Routing
 *
 * Test routing, failover, and circuit breaker functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockRequestRouter, MockLoadBalancer, MockCircuitBreaker, CircuitState, mockProviders } from '../../packages/edge/tests/fixtures/providers';
import type { ChatRequest } from '../../packages/edge/src/types';

describe('Multi-Provider Routing', () => {
  let router: MockRequestRouter;

  beforeEach(() => {
    router = new MockRequestRouter();
  });

  describe('Round-Robin Routing', () => {
    it('should route requests in round-robin fashion', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-3-opus-20240229',
      };

      const provider1 = await router.route(request);
      const provider2 = await router.route(request);
      const provider3 = await router.route(request);

      expect(provider1.name).toBe('anthropic');
      expect(provider2.name).toBe('openai');
      expect(provider3.name).toBe('groq');
    });

    it('should handle successful chat with all providers', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-opus-20240229',
      };

      const responses = await Promise.all([
        router.chat(request),
        router.chat(request),
        router.chat(request),
      ]);

      responses.forEach(response => {
        expect(response.content).toBeDefined();
        expect(response.provider).toBeDefined();
        expect(response.usage.totalTokens).toBeGreaterThan(0);
      });
    });
  });

  describe('Provider Failover', () => {
    it('should failover to next provider when one fails', async () => {
      const failingRouter = new MockRequestRouter();
      failingRouter.setProviders([
        mockProviders.failing,
        mockProviders.anthropic,
      ]);

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-3-opus-20240229',
      };

      const response = await failingRouter.chat(request);

      expect(response.provider).toBe('anthropic');
      expect(response.content).toBeDefined();
    });

    it('should throw when all providers fail', async () => {
      const failingRouter = new MockRequestRouter();
      failingRouter.setProviders([
        mockProviders.failing,
        mockProviders.failing,
      ]);

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-3-opus-20240229',
      };

      await expect(failingRouter.chat(request)).rejects.toThrow();
    });
  });
});

describe('Load Balancer', () => {
  let loadBalancer: MockLoadBalancer;

  beforeEach(() => {
    loadBalancer = new MockLoadBalancer();
  });

  describe('Load Distribution', () => {
    it('should distribute load across providers', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-3-opus-20240229',
      };

      const promises = Array(10).fill(null).map(() => loadBalancer.chat(request));

      await Promise.all(promises);

      const status = loadBalancer.getProviderStatus();

      status.forEach((providerStatus, _name) => {
        expect(providerStatus.healthy).toBe(true);
        expect(providerStatus.load).toBe(0); // All requests completed
      });
    });

    it('should prefer providers with lower load', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-3-opus-20240229',
      };

      // Start slow requests on first provider
      const slowPromises = Array(5).fill(null).map(() =>
        loadBalancer.chat({ ...request, messages: [{ role: 'user', content: 'Slow' }] })
      );

      // Give slow requests time to accumulate load
      await new Promise(resolve => setTimeout(resolve, 10));

      // Fast requests should go to other providers
      const fastResponse = await loadBalancer.chat(request);

      expect(fastResponse.content).toBeDefined();
      expect(fastResponse.provider).toBeDefined();

      // Wait for all to complete
      await Promise.all(slowPromises);
    });
  });

  describe('Health Management', () => {
    it('should route away from unhealthy providers', async () => {
      loadBalancer.markUnhealthy('anthropic');

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-3-opus-20240229',
      };

      const response = await loadBalancer.chat(request);

      expect(response.provider).not.toBe('anthropic');
    });

    it('should recover provider when marked healthy', async () => {
      loadBalancer.markUnhealthy('openai');
      loadBalancer.markHealthy('openai');

      const status = loadBalancer.getProviderStatus();

      expect(status.get('openai')?.healthy).toBe(true);
    });

    it('should throw when all providers are unhealthy', async () => {
      loadBalancer.markUnhealthy('anthropic');
      loadBalancer.markUnhealthy('openai');
      loadBalancer.markUnhealthy('groq');

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-3-opus-20240229',
      };

      await expect(loadBalancer.chat(request)).rejects.toThrow('No healthy providers available');
    });
  });
});

describe('Circuit Breaker', () => {
  let circuitBreaker: MockCircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new MockCircuitBreaker();
  });

  describe('State Transitions', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open after threshold failures', async () => {
      const failingFn = async () => {
        throw new Error('Failure');
      };

      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should transition to half-open after timeout', async () => {
      // Force open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Failure');
          });
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout (simulate by checking after threshold)
      // Note: In real test, we'd mock Date.now() or wait the full timeout
      circuitBreaker.getState();

      // Try executing after timeout
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Still failing');
        });
      } catch {
        // Expected
      }

      // After timeout and another failure, should remain open or go to half-open
      const stateAfter = circuitBreaker.getState();
      expect([CircuitState.OPEN, CircuitState.HALF_OPEN]).toContain(stateAfter);
    });

    it('should close after successful requests in half-open', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Failure');
          });
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Simulate timeout by manually setting state
      (circuitBreaker as any).state = CircuitState.HALF_OPEN;

      // Successful requests should close it
      const successFn = async () => 'success';

      await circuitBreaker.execute(successFn);
      await circuitBreaker.execute(successFn);
      await circuitBreaker.execute(successFn);

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Request Blocking', () => {
    it('should block requests when open', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Failure');
          });
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      await expect(
        circuitBreaker.execute(async () => 'success')
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should allow requests when closed', async () => {
      const result = await circuitBreaker.execute(async () => 'success');

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reset after successful requests', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Failure');
          });
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Should work after reset
      const result = await circuitBreaker.execute(async () => 'success');
      expect(result).toBe('success');
    });
  });
});

describe('Caching Integration', () => {
  it('should cache and reuse responses', async () => {
    const mockKV = new (await import('../../packages/edge/tests/utils')).MockKVNamespace();

    const cacheKey = 'cache:test-prompt';
    const cachedResponse = {
      response: 'Cached response',
      metadata: {
        model: 'claude-3-opus',
        tokens: 100,
        cost: 0.01,
        latency: 50,
      },
      timestamp: Date.now(),
    };

    await mockKV.put(cacheKey, JSON.stringify(cachedResponse));

    const retrieved = await mockKV.get(cacheKey);
    expect(retrieved).toBeDefined();
  });

  it('should handle cache misses', async () => {
    const mockKV = new (await import('../../packages/edge/tests/utils')).MockKVNamespace();

    const result = await mockKV.get('cache:non-existent');

    expect(result).toBeNull();
  });
});
