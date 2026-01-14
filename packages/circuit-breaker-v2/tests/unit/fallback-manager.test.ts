import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FallbackManager } from '../../src/fallback/manager';
import { FallbackConfig, FallbackPriority, ExecutionContext } from '../../src/types';

describe('FallbackManager', () => {
  let manager: FallbackManager;
  let context: ExecutionContext;

  beforeEach(() => {
    manager = new FallbackManager();
    context = {
      circuitName: 'test-circuit',
      attempt: 1,
      startTime: Date.now(),
      timeout: 5000,
    };
  });

  describe('Registration', () => {
    it('should register fallback', () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.MEDIUM,
        handler: async () => 'fallback-result',
        enabled: true,
      };

      manager.register(fallback);

      expect(manager.has('test-fallback')).toBe(true);
      expect(manager.get('test-fallback')).toEqual(fallback);
    });

    it('should unregister fallback', () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.MEDIUM,
        handler: async () => 'fallback-result',
        enabled: true,
      };

      manager.register(fallback);
      manager.unregister('test-fallback');

      expect(manager.has('test-fallback')).toBe(false);
    });

    it('should initialize stats for registered fallback', () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.MEDIUM,
        handler: async () => 'fallback-result',
        enabled: true,
      };

      manager.register(fallback);

      const stats = manager.getStats('test-fallback');
      expect(stats).toBeDefined();
      expect(stats?.totalUses).toBe(0);
    });
  });

  describe('Execution', () => {
    it('should execute successful fallback', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.MEDIUM,
        handler: async () => 'fallback-result',
        enabled: true,
      };

      manager.register(fallback);

      const result = await manager.execute(context, new Error('Test error'));

      expect(result.status).toBe('FALLBACK_SUCCESS');
      expect(result.data).toBe('fallback-result');
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackName).toBe('test-fallback');
    });

    it('should try fallbacks in priority order', async () => {
      const highPriorityFallback: FallbackConfig<string> = {
        name: 'high-priority',
        priority: FallbackPriority.HIGH,
        handler: async () => 'high-result',
        enabled: true,
      };

      const lowPriorityFallback: FallbackConfig<string> = {
        name: 'low-priority',
        priority: FallbackPriority.LOW,
        handler: async () => 'low-result',
        enabled: true,
      };

      manager.register(lowPriorityFallback);
      manager.register(highPriorityFallback);

      const result = await manager.execute(context, new Error('Test error'));

      expect(result.data).toBe('high-result');
    });

    it('should skip disabled fallbacks', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'disabled-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: false,
      };

      manager.register(fallback);

      const result = await manager.execute(context, new Error('Test error'));

      expect(result.status).toBe('FALLBACK_FAILURE');
    });

    it('should respect max uses limit', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'limited-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: true,
        maxUses: 2,
      };

      manager.register(fallback);

      // Use fallback max times
      await manager.execute(context, new Error('Test error'));
      await manager.execute(context, new Error('Test error'));

      // Third use should fail
      const result = await manager.execute(context, new Error('Test error'));

      expect(result.status).toBe('FALLBACK_FAILURE');
    });

    it('should check fallback conditions', async () => {
      const condition = vi.fn((error: Error) => error.message.includes('specific'));

      const fallback: FallbackConfig<string> = {
        name: 'conditional-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: true,
        condition,
      };

      manager.register(fallback);

      // Should not match condition
      let result = await manager.execute(context, new Error('other error'));
      expect(result.status).toBe('FALLBACK_FAILURE');

      // Should match condition
      result = await manager.execute(context, new Error('specific error'));
      expect(result.status).toBe('FALLBACK_SUCCESS');
    });

    it('should handle fallback timeout', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'slow-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return 'result';
        },
        enabled: true,
        timeout: 100,
      };

      manager.register(fallback);

      const result = await manager.execute(context, new Error('Test error'));

      expect(result.status).toBe('FALLBACK_FAILURE');
    }, 10000);
  });

  describe('Caching', () => {
    it('should cache successful fallback results', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'cacheable-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'cached-result',
        enabled: true,
      };

      manager.register(fallback);

      // First call should execute
      const result1 = await manager.execute(context);
      expect(result1.data).toBe('cached-result');

      // Second call should use cache
      const result2 = await manager.execute(context);
      expect(result2.data).toBe('cached-result');
    });

    it('should respect cache TTL', async () => {
      manager.setCacheTtl(100);

      const fallback: FallbackConfig<string> = {
        name: 'cacheable-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: true,
      };

      manager.register(fallback);

      await manager.execute(context);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const handler = vi.fn(async () => 'result');
      const newFallback: FallbackConfig<string> = {
        name: 'new-fallback',
        priority: FallbackPriority.HIGH,
        handler,
        enabled: true,
      };

      manager.register(newFallback);

      await manager.execute(context);

      expect(handler).toHaveBeenCalled();
    }, 10000);

    it('should clear cache', async () => {
      const handler = vi.fn(async () => 'result');

      const fallback: FallbackConfig<string> = {
        name: 'cacheable-fallback',
        priority: FallbackPriority.HIGH,
        handler,
        enabled: true,
      };

      manager.register(fallback);

      await manager.execute(context);
      manager.clearCache();

      await manager.execute(context);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should disable caching', async () => {
      manager.setCacheEnabled(false);

      const handler = vi.fn(async () => 'result');

      const fallback: FallbackConfig<string> = {
        name: 'fallback',
        priority: FallbackPriority.HIGH,
        handler,
        enabled: true,
      };

      manager.register(fallback);

      await manager.execute(context);
      await manager.execute(context);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Statistics', () => {
    it('should track fallback usage', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: true,
      };

      manager.register(fallback);

      await manager.execute(context);

      const stats = manager.getStats('test-fallback');

      expect(stats?.totalUses).toBe(1);
      expect(stats?.successfulUses).toBe(1);
      expect(stats?.failedUses).toBe(0);
    });

    it('should track average duration', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'result';
        },
        enabled: true,
      };

      manager.register(fallback);

      await manager.execute(context);

      const stats = manager.getStats('test-fallback');

      expect(stats?.averageDuration).toBeGreaterThan(0);
    });

    it('should track last used timestamp', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: true,
      };

      manager.register(fallback);

      await manager.execute(context);

      const stats = manager.getStats('test-fallback');

      expect(stats?.lastUsed).toBeGreaterThan(0);
      expect(stats?.lastUsed).toBeLessThanOrEqual(Date.now());
    });

    it('should get all stats', async () => {
      const fallback1: FallbackConfig<string> = {
        name: 'fallback-1',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result-1',
        enabled: true,
      };

      const fallback2: FallbackConfig<string> = {
        name: 'fallback-2',
        priority: FallbackPriority.MEDIUM,
        handler: async () => 'result-2',
        enabled: true,
      };

      manager.register(fallback1);
      manager.register(fallback2);

      await manager.execute(context);

      const allStats = manager.getAllStats();

      expect(allStats.size).toBe(2);
      expect(allStats.has('fallback-1')).toBe(true);
      expect(allStats.has('fallback-2')).toBe(true);
    });

    it('should reset specific fallback stats', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: true,
      };

      manager.register(fallback);

      await manager.execute(context);

      manager.resetStats('test-fallback');

      const stats = manager.getStats('test-fallback');

      expect(stats?.totalUses).toBe(0);
      expect(stats?.successfulUses).toBe(0);
    });

    it('should reset all stats', async () => {
      const fallback1: FallbackConfig<string> = {
        name: 'fallback-1',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result-1',
        enabled: true,
      };

      const fallback2: FallbackConfig<string> = {
        name: 'fallback-2',
        priority: FallbackPriority.MEDIUM,
        handler: async () => 'result-2',
        enabled: true,
      };

      manager.register(fallback1);
      manager.register(fallback2);

      await manager.execute(context);

      manager.resetStats();

      const stats1 = manager.getStats('fallback-1');
      const stats2 = manager.getStats('fallback-2');

      expect(stats1?.totalUses).toBe(0);
      expect(stats2?.totalUses).toBe(0);
    });
  });

  describe('Enable/Disable', () => {
    it('should enable fallback', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: false,
      };

      manager.register(fallback);

      let result = await manager.execute(context);
      expect(result.status).toBe('FALLBACK_FAILURE');

      manager.enable('test-fallback');

      result = await manager.execute(context);
      expect(result.status).toBe('FALLBACK_SUCCESS');
    });

    it('should disable fallback', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: true,
      };

      manager.register(fallback);

      manager.disable('test-fallback');

      const result = await manager.execute(context);

      expect(result.status).toBe('FALLBACK_FAILURE');
    });

    it('should disable all fallbacks', async () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: true,
      };

      manager.register(fallback);

      manager.setEnabled(false);

      const result = await manager.execute(context);

      expect(result.status).toBe('FAILURE');
      expect(result.usedFallback).toBe(false);
    });
  });

  describe('Global Fallbacks', () => {
    it('should set global fallbacks', async () => {
      const globalFallback: FallbackConfig<string> = {
        name: 'global-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'global-result',
        enabled: true,
      };

      manager.setGlobalFallbacks([globalFallback]);

      const result = await manager.execute(context);

      expect(result.data).toBe('global-result');
    });

    it('should add global fallback', async () => {
      const globalFallback: FallbackConfig<string> = {
        name: 'global-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'global-result',
        enabled: true,
      };

      manager.addGlobalFallback(globalFallback);

      const result = await manager.execute(context);

      expect(result.data).toBe('global-result');
    });
  });

  describe('Custom Fallbacks', () => {
    it('should use custom fallbacks in execution', async () => {
      const customFallback: FallbackConfig<string> = {
        name: 'custom-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'custom-result',
        enabled: true,
      };

      const result = await manager.execute(context, undefined, [customFallback]);

      expect(result.data).toBe('custom-result');
    });
  });

  describe('Reset', () => {
    it('should reset manager state', () => {
      const fallback: FallbackConfig<string> = {
        name: 'test-fallback',
        priority: FallbackPriority.HIGH,
        handler: async () => 'result',
        enabled: true,
      };

      manager.register(fallback);

      manager.reset();

      expect(manager.has('test-fallback')).toBe(false);
    });
  });

  describe('Static Factory Methods', () => {
    it('should create degraded response fallback', () => {
      const fallback = FallbackManager.getDegradedResponse('default-value');

      expect(fallback.name).toBe('degraded_mode');
      expect(fallback.priority).toBe(FallbackPriority.LOW);
      expect(fallback.enabled).toBe(true);
    });

    it('should create cached fallback', () => {
      const cache = new Map([['key', 'cached-value']]);
      const fallback = FallbackManager.getCachedFallback('key', cache);

      expect(fallback.name).toBe('cached_key');
      expect(fallback.priority).toBe(FallbackPriority.HIGH);
    });

    it('should create retry fallback', () => {
      const retryFn = vi.fn(async () => 'retry-result');
      const fallback = FallbackManager.getRetryFallback(retryFn, 3, 100);

      expect(fallback.name).toBe('retry_with_backoff');
      expect(fallback.priority).toBe(FallbackPriority.MEDIUM);
      expect(fallback.enabled).toBe(true);
    });
  });
});
