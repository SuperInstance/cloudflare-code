/**
 * Edge Cache System Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EdgeCacheSystem,
  createEdgeCacheSystem,
  generateCacheKey,
  parseCacheControl,
  formatDuration,
  formatBytes,
} from './index';

// Mock environment
const mockEnv = {
  CACHE_KV: {
    get: async () => null,
    put: async () => undefined,
    delete: async () => undefined,
    list: async () => ({ keys: [], list_complete: true }),
  } as any,
  PREDICTION_KV: {
    get: async () => null,
    put: async () => undefined,
    delete: async () => undefined,
  } as any,
  ANALYTICS_KV: {
    get: async () => null,
    put: async () => undefined,
    delete: async () => undefined,
  } as any,
  CACHE_R2: {
    get: async () => null,
    put: async () => undefined,
    delete: async () => undefined,
  } as any,
};

describe('EdgeCacheSystem', () => {
  let cache: EdgeCacheSystem;

  beforeEach(() => {
    cache = createEdgeCacheSystem(mockEnv);
  });

  describe('Initialization', () => {
    it('should create a cache system', () => {
      expect(cache).toBeDefined();
      expect(cache instanceof EdgeCacheSystem).toBe(true);
    });

    it('should initialize successfully', async () => {
      await cache.initialize();
      const stats = cache.getStats();
      expect(stats.initialized).toBe(true);
    });

    it('should perform health check', async () => {
      const health = await cache.healthCheck();
      expect(health.status).toBeDefined();
      expect(health.checks).toBeDefined();
    });
  });

  describe('Cache Operations', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    it('should get value from cache', async () => {
      const result = await cache.get('test-key');
      expect(result).toBeDefined();
      expect(result.value).toBeNull();
      expect(result.cached).toBe(false);
    });

    it('should set value in cache', async () => {
      await cache.set('test-key', 'test-value', {
        ttl: 3600,
        tags: ['test'],
      });
      // No error means success
    });

    it('should delete value from cache', async () => {
      await cache.delete('test-key');
      // No error means success
    });

    it('should invalidate by tags', async () => {
      const result = await cache.invalidate({
        tags: ['test'],
        strategy: 'tag-based',
      });
      expect(result).toBeDefined();
    });
  });

  describe('Predictions', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    it('should record access', async () => {
      await cache.recordAccess(
        'user1',
        'session1',
        'https://example.com/api/data',
        'GET',
        {
          userAgent: 'Mozilla/5.0',
          geography: 'US',
          timestamp: Date.now(),
        }
      );
      // No error means success
    });

    it('should get predictions', async () => {
      const predictions = await cache.getPredictions(
        'user1',
        'session1',
        {
          currentUrl: 'https://example.com/api/data',
          userAgent: 'Mozilla/5.0',
          geography: 'US',
          timestamp: Date.now(),
        },
        5
      );
      expect(predictions).toBeDefined();
      expect(Array.isArray(predictions)).toBe(true);
    });
  });

  describe('Analytics', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    it('should get analytics', async () => {
      const analytics = await cache.getAnalytics('daily');
      expect(analytics).toBeDefined();
      expect(analytics.period).toBe('daily');
      expect(analytics.overall).toBeDefined();
      expect(analytics.tierMetrics).toBeDefined();
    });
  });
});

describe('Utility Functions', () => {
  describe('generateCacheKey', () => {
    it('should generate cache key from URL', () => {
      const key = generateCacheKey('https://example.com/api/data?page=1', 'GET');
      expect(key).toBeDefined();
      expect(key).toContain('GET');
      expect(key).toContain('/api/data');
    });

    it('should include vary headers', () => {
      const key = generateCacheKey(
        'https://example.com/api/data',
        'GET',
        { 'Accept-Encoding': 'gzip' }
      );
      expect(key).toContain('Accept-Encoding');
    });
  });

  describe('parseCacheControl', () => {
    it('should parse max-age directive', () => {
      const parsed = parseCacheControl('max-age=3600');
      expect(parsed.maxAge).toBe(3600);
    });

    it('should parse no-cache directive', () => {
      const parsed = parseCacheControl('no-cache');
      expect(parsed.noCache).toBe(true);
    });

    it('should parse multiple directives', () => {
      const parsed = parseCacheControl('max-age=3600, must-revalidate');
      expect(parsed.maxAge).toBe(3600);
      expect(parsed.mustRevalidate).toBe(true);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1500)).toBe('1.50s');
    });

    it('should format minutes', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500.00 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(5000)).toBe('4.88 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(5000000)).toBe('4.77 MB');
    });
  });
});

describe('Integration Tests', () => {
  it('should handle full cache lifecycle', async () => {
    const cache = createEdgeCacheSystem(mockEnv);
    await cache.initialize();

    // Set value
    await cache.set('integration-test', 'test-value', { ttl: 3600 });

    // Get value
    const result = await cache.get('integration-test');
    expect(result).toBeDefined();

    // Delete value
    await cache.delete('integration-test');

    // Shutdown
    await cache.shutdown();
  });

  it('should handle warming and predictions', async () => {
    const cache = createEdgeCacheSystem(mockEnv);
    await cache.initialize();

    // Record accesses
    for (let i = 0; i < 10; i++) {
      await cache.recordAccess(
        `user${i}`,
        `session${i}`,
        `https://example.com/page${i}`,
        'GET',
        {
          userAgent: 'Mozilla/5.0',
          geography: 'US',
          timestamp: Date.now(),
        }
      );
    }

    // Get predictions
    const predictions = await cache.getPredictions(
      'user1',
      'session1',
      {
        currentUrl: 'https://example.com/page1',
        userAgent: 'Mozilla/5.0',
        geography: 'US',
        timestamp: Date.now(),
      },
      5
    );

    expect(predictions).toBeDefined();

    await cache.shutdown();
  });

  it('should provide analytics insights', async () => {
    const cache = createEdgeCacheSystem(mockEnv);
    await cache.initialize();

    // Perform some operations
    await cache.set('test1', 'value1', { recordMetrics: true });
    await cache.get('test1', { recordMetrics: true });
    await cache.get('test2', { recordMetrics: true });

    // Get analytics
    const analytics = await cache.getAnalytics('daily');

    expect(analytics.overall).toBeDefined();
    expect(analytics.insights).toBeDefined();
    expect(analytics.recommendations).toBeDefined();

    await cache.shutdown();
  });
});

describe('Performance Tests', () => {
  it('should handle high throughput', async () => {
    const cache = createEdgeCacheSystem(mockEnv);
    await cache.initialize();

    const startTime = Date.now();
    const operations = 100;

    for (let i = 0; i < operations; i++) {
      await cache.set(`key${i}`, `value${i}`);
    }

    const duration = Date.now() - startTime;
    const opsPerSecond = (operations / duration) * 1000;

    console.log(`Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
    expect(opsPerSecond).toBeGreaterThan(10); // At least 10 ops/sec

    await cache.shutdown();
  });

  it('should handle concurrent operations', async () => {
    const cache = createEdgeCacheSystem(mockEnv);
    await cache.initialize();

    const operations = 50;
    const promises = [];

    for (let i = 0; i < operations; i++) {
      promises.push(cache.set(`concurrent${i}`, `value${i}`));
    }

    await Promise.all(promises);

    // All operations completed without error
    expect(true).toBe(true);

    await cache.shutdown();
  });
});
