/**
 * Unit tests for hierarchy manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HierarchyManager, LimitPriority } from '../../src/hierarchy/manager.js';
import { RateLimitAlgorithm } from '../../src/types/index.js';
import { MemoryStorage } from '../../src/storage/memory-storage.js';

describe('HierarchyManager', () => {
  let manager: HierarchyManager;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage({ type: 'memory' });
    manager = new HierarchyManager(
      {
        global: {
          algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
          limit: 1000,
          window: 60000
        },
        perUser: {
          algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
          limit: 100,
          window: 60000
        },
        perEndpoint: {
          algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
          limit: 50,
          window: 60000
        },
        strictMode: false
      },
      storage
    );
  });

  it('should check all hierarchical limits', async () => {
    const result = await manager.check({
      identifier: 'user-123',
      userId: 'user-123',
      endpoint: '/api/test'
    });

    expect(result.allowed).toBe(true);
    expect(result.metadata).toHaveProperty('limitsChecked');
  });

  it('should enforce per-user limits', async () => {
    const context = {
      identifier: 'user-123',
      userId: 'user-123',
      endpoint: '/api/test'
    };

    // Exhaust per-user limit
    for (let i = 0; i < 100; i++) {
      await manager.check(context);
    }

    // Next request should be denied
    const result = await manager.check(context);
    expect(result.allowed).toBe(false);
  });

  it('should enforce per-endpoint limits', async () => {
    const context = {
      identifier: 'user-123',
      userId: 'user-123',
      endpoint: '/api/test'
    };

    // Exhaust per-endpoint limit
    for (let i = 0; i < 50; i++) {
      await manager.check(context);
    }

    // Next request should be denied
    const result = await manager.check(context);
    expect(result.allowed).toBe(false);
  });

  it('should return most restrictive limit', async () => {
    const result = await manager.check({
      identifier: 'user-123',
      userId: 'user-123',
      endpoint: '/api/test'
    });

    // Per-endpoint limit (50) is more restrictive than per-user (100)
    expect(result.remaining).toBeLessThanOrEqual(50);
  });

  it('should check specific limit level', async () => {
    const result = await manager.checkLevel(
      LimitPriority.PER_USER,
      {
        identifier: 'user-123',
        userId: 'user-123'
      }
    );

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(100);
  });

  it('should reset all limits for context', async () => {
    const context = {
      identifier: 'user-123',
      userId: 'user-123',
      endpoint: '/api/test'
    };

    // Make some requests
    await manager.check(context);
    await manager.check(context);

    // Reset
    await manager.reset(context);

    // Limits should be reset
    const result = await manager.check(context);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('should reset specific limit level', async () => {
    const context = {
      identifier: 'user-123',
      userId: 'user-123',
      endpoint: '/api/test'
    };

    // Make some requests
    await manager.check(context);

    // Reset per-user level
    await manager.resetLevel(LimitPriority.PER_USER, context);

    // Per-user limit should be reset
    const result = await manager.checkLevel(LimitPriority.PER_USER, context);
    expect(result.remaining).toBeGreaterThan(95);
  });

  it('should get usage statistics', async () => {
    const context = {
      identifier: 'user-123',
      userId: 'user-123',
      endpoint: '/api/test'
    };

    await manager.check(context);

    const usage = await manager.getUsage(context);
    expect(usage).toHaveProperty('global');
    expect(usage).toHaveProperty('user');
    expect(usage).toHaveProperty('endpoint');
  });

  it('should add custom limit', () => {
    manager.addLimit('custom', {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 25,
      window: 60000
    }, LimitPriority.CUSTOM);

    const limit = manager.getLimit('custom');
    expect(limit).toBeDefined();
    expect(limit?.priority).toBe(LimitPriority.CUSTOM);
  });

  it('should remove limit', () => {
    manager.addLimit('temporary', {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 25,
      window: 60000
    }, LimitPriority.CUSTOM);

    expect(manager.getLimit('temporary')).toBeDefined();

    manager.removeLimit('temporary');
    expect(manager.getLimit('temporary')).toBeUndefined();
  });

  it('should update limit', () => {
    manager.addLimit('test', {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 50,
      window: 60000
    }, LimitPriority.CUSTOM);

    manager.updateLimit('test', { limit: 100 });

    const limit = manager.getLimit('test');
    expect(limit?.config.limit).toBe(100);
  });

  it('should handle strict mode correctly', async () => {
    manager.setStrictMode(true);

    const result = await manager.check({
      identifier: 'user-123',
      userId: 'user-123',
      endpoint: '/api/test'
    });

    expect(result.allowed).toBe(true);
  });

  it('should set priority order', () => {
    const newPriority = [
      LimitPriority.PER_ENDPOINT,
      LimitPriority.PER_USER,
      LimitPriority.GLOBAL
    ];

    manager.setPriority(newPriority);

    const config = manager.exportConfig();
    expect(config.priority).toEqual(newPriority);
  });

  it('should get all limits', () => {
    const limits = manager.getAllLimits();
    expect(limits.size).toBeGreaterThan(0);
  });

  it('should get limits by priority', () => {
    const perUserLimits = manager.getLimitsByPriority(LimitPriority.PER_USER);
    expect(perUserLimits).toHaveLength(1);
    expect(perUserLimits[0].key).toBe('user');
  });

  it('should validate configuration', () => {
    const config = {
      global: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 1000,
        window: 60000
      },
      perUser: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 100,
        window: 60000
      },
      priority: [
        LimitPriority.GLOBAL,
        LimitPriority.PER_USER,
        LimitPriority.PER_ENDPOINT
      ]
    };

    const validation = manager.validateConfig(config);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect duplicate priorities', () => {
    const config = {
      global: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 1000,
        window: 60000
      },
      priority: [
        LimitPriority.GLOBAL,
        LimitPriority.GLOBAL // Duplicate
      ]
    };

    const validation = manager.validateConfig(config);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should export configuration', () => {
    const config = manager.exportConfig();

    expect(config).toHaveProperty('global');
    expect(config).toHaveProperty('perUser');
    expect(config).toHaveProperty('perEndpoint');
    expect(config).toHaveProperty('strictMode');
    expect(config).toHaveProperty('priority');
  });

  it('should import configuration', () => {
    const newConfig = {
      global: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 2000,
        window: 60000
      },
      perUser: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 200,
        window: 60000
      },
      strictMode: true
    };

    manager.importConfig(newConfig);

    const exported = manager.exportConfig();
    expect(exported.global?.limit).toBe(2000);
    expect(exported.perUser?.limit).toBe(200);
    expect(exported.strictMode).toBe(true);
  });

  it('should return statistics', () => {
    const stats = manager.getStats();

    expect(stats).toHaveProperty('totalLimits');
    expect(stats).toHaveProperty('strictMode');
    expect(stats).toHaveProperty('priorityLevels');
    expect(stats).toHaveProperty('limitsByPriority');
    expect(stats.totalLimits).toBeGreaterThan(0);
  });
});
