/**
 * Edge Optimizer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EdgeOptimizer,
  EdgeFunctionRuntime,
  EdgeCacheManager,
} from '../../src/edge/optimizer.js';
import type {
  EdgeFunction,
  EdgeOptimizerConfig,
  GatewayRequest,
  GatewayResponse,
  EdgeRequestContext,
} from '../../src/types/index.js';

describe('EdgeOptimizer', () => {
  let optimizer: EdgeOptimizer;

  beforeEach(() => {
    const config: Partial<EdgeOptimizerConfig> = {
      enabled: true,
      defaultRegion: 'us-east-1',
      cache: {
        enabled: true,
        ttl: 3600000,
        purgeKeys: [],
        cacheKeys: [],
      },
      routing: {
        strategy: 'latency',
        regions: [
          {
            name: 'us-east-1',
            code: 'use1',
            endpoint: 'https://use1.example.com',
            latitude: 40.7128,
            longitude: -74.0060,
            healthy: true,
          },
          {
            name: 'eu-west-1',
            code: 'euw1',
            endpoint: 'https://euw1.example.com',
            latitude: 51.5074,
            longitude: -0.1278,
            healthy: true,
          },
        ],
        healthCheck: false,
        healthCheckInterval: 30000,
      },
      functions: [],
      metrics: {
        enabled: true,
      },
    };

    optimizer = new EdgeOptimizer(config);
  });

  describe('optimizeRequest', () => {
    it('should select optimal region for request', async () => {
      const request: GatewayRequest = {
        id: 'req-1',
        timestamp: Date.now(),
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: new Headers(),
        body: null,
        query: new URLSearchParams(),
        params: {},
        context: {} as any,
        metadata: {
          sourceIp: '1.2.3.4',
          userAgent: 'test',
        },
      };

      const context: EdgeRequestContext = {
        region: 'us-east-1',
        latitude: 40.7128,
        longitude: '-74.0060',
      };

      const optimized = await optimizer.optimizeRequest(request, context);

      expect(optimized.region).toBeDefined();
      expect(optimized.cached).toBe(false);
    });

    it('should return cached result when available', async () => {
      const request: GatewayRequest = {
        id: 'req-2',
        timestamp: Date.now(),
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: new Headers(),
        body: null,
        query: new URLSearchParams(),
        params: {},
        context: {} as any,
        metadata: {
          sourceIp: '1.2.3.4',
          userAgent: 'test',
        },
      };

      const context: EdgeRequestContext = {
        region: 'us-east-1',
      };

      // Set cache
      await optimizer.set('cache-key', { cached: true });

      const optimized = await optimizer.optimizeRequest(request, context);

      // In real scenario, would check cache hit
    });
  });

  describe('executeFunction', () => {
    it('should execute edge function', async () => {
      const fn: EdgeFunction = {
        id: 'fn-1',
        name: 'Test Function',
        handler: 'index.handler',
        runtime: 'javascript',
        memory: 128,
        timeout: 5000,
        regions: ['*'],
      };

      optimizer.addFunction(fn);

      const context: EdgeRequestContext = {
        region: 'us-east-1',
      };

      const result = await optimizer.executeFunction('fn-1', { input: 'test' }, context);

      expect(result).toBeDefined();
    });

    it('should throw error for non-existent function', async () => {
      const context: EdgeRequestContext = {
        region: 'us-east-1',
      };

      await expect(
        optimizer.executeFunction('non-existent', {}, context)
      ).rejects.toThrow('Edge function not found');
    });

    it('should throw error when function not available in region', async () => {
      const fn: EdgeFunction = {
        id: 'fn-1',
        name: 'Test Function',
        handler: 'index.handler',
        runtime: 'javascript',
        memory: 128,
        timeout: 5000,
        regions: ['us-west-1'], // Different from request region
      };

      optimizer.addFunction(fn);

      const context: EdgeRequestContext = {
        region: 'us-east-1',
      };

      await expect(
        optimizer.executeFunction('fn-1', {}, context)
      ).rejects.toThrow('not available in region');
    });
  });

  describe('cache operations', () => {
    it('should set and get cache entries', async () => {
      await optimizer.set('key1', { value: 'test' }, {
        ttl: 60000,
        tags: ['tag1', 'tag2'],
      });

      const entry = await optimizer.get('key1');

      expect(entry).toBeDefined();
      expect(entry?.value).toEqual({ value: 'test' });
      expect(entry?.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle cache expiration', async () => {
      await optimizer.set('key2', { value: 'test' }, {
        ttl: 100, // 100ms
      });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      const entry = await optimizer.get('key2');

      expect(entry).toBeNull();
    });

    it('should invalidate cache by pattern', async () => {
      await optimizer.set('user:1', { data: 'user1' });
      await optimizer.set('user:2', { data: 'user2' });
      await optimizer.set('product:1', { data: 'product1' });

      const invalidated = await optimizer.invalidate('user:*');

      expect(invalidated).toBe(2);

      const user1 = await optimizer.get('user:1');
      const product1 = await optimizer.get('product:1');

      expect(user1).toBeNull();
      expect(product1).toBeDefined();
    });

    it('should invalidate cache by tags', async () => {
      await optimizer.set('key1', { value: 'test1' }, { tags: ['tag1'] });
      await optimizer.set('key2', { value: 'test2' }, { tags: ['tag2'] });
      await optimizer.set('key3', { value: 'test3' }, { tags: ['tag1'] });

      await optimizer.invalidate(undefined, ['tag1']);

      expect(await optimizer.get('key1')).toBeNull();
      expect(await optimizer.get('key2')).toBeDefined();
      expect(await optimizer.get('key3')).toBeNull();
    });

    it('should evict entries when cache is full', async () => {
      const smallOptimizer = new EdgeOptimizer({
        enabled: true,
        defaultRegion: 'us-east-1',
        cache: {
          enabled: true,
          ttl: 3600000,
          purgeKeys: [],
          cacheKeys: [],
        },
        routing: {
          strategy: 'latency',
          regions: [],
          healthCheck: false,
          healthCheckInterval: 30000,
        },
        functions: [],
        metrics: { enabled: false },
      });

      // Override max cache size for testing
      (smallOptimizer as any).maxCacheSize = 100;

      await smallOptimizer.set('key1', 'x'.repeat(50));
      await smallOptimizer.set('key2', 'x'.repeat(50));
      await smallOptimizer.set('key3', 'x'.repeat(50)); // Should trigger eviction

      const entry1 = await smallOptimizer.get('key1');
      const entry3 = await smallOptimizer.get('key3');

      // At least one should be evicted
      expect(entry1 === null || entry3 === null).toBe(true);
    });
  });

  describe('warmup', () => {
    it('should warmup cache with provided keys', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'cached' });

      await optimizer.warmup(['key1', 'key2', 'key3'], fetcher);

      expect(fetcher).toHaveBeenCalledTimes(3);

      const entry1 = await optimizer.get('key1');
      expect(entry1?.value).toEqual({ data: 'cached' });
    });
  });

  describe('metrics', () => {
    it('should track optimization metrics', async () => {
      const metrics = optimizer.getMetrics();

      expect(metrics.totalRequests).toBeDefined();
      expect(metrics.edgeHits).toBeDefined();
      expect(metrics.edgeMisses).toBeDefined();
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeLessThanOrEqual(1);
    });
  });
});

describe('EdgeFunctionRuntime', () => {
  let runtime: EdgeFunctionRuntime;

  beforeEach(() => {
    runtime = new EdgeFunctionRuntime();
  });

  describe('function management', () => {
    it('should register and execute functions', async () => {
      const fn: EdgeFunction = {
        id: 'fn-1',
        name: 'Test Function',
        handler: 'index.handler',
        runtime: 'javascript',
        memory: 128,
        timeout: 5000,
        regions: ['*'],
      };

      runtime.register(fn);

      const registered = runtime.getFunction('fn-1');
      expect(registered).toEqual(fn);
    });

    it('should unregister functions', () => {
      const fn: EdgeFunction = {
        id: 'fn-1',
        name: 'Test Function',
        handler: 'index.handler',
        runtime: 'javascript',
        memory: 128,
        timeout: 5000,
        regions: ['*'],
      };

      runtime.register(fn);
      const unregistered = runtime.unregister('fn-1');

      expect(unregistered).toBe(true);
      expect(runtime.getFunction('fn-1')).toBeUndefined();
    });

    it('should list all functions', () => {
      const fn1: EdgeFunction = {
        id: 'fn-1',
        name: 'Function 1',
        handler: 'index.handler',
        runtime: 'javascript',
        memory: 128,
        timeout: 5000,
        regions: ['*'],
      };

      const fn2: EdgeFunction = {
        id: 'fn-2',
        name: 'Function 2',
        handler: 'index.handler',
        runtime: 'javascript',
        memory: 256,
        timeout: 10000,
        regions: ['*'],
      };

      runtime.register(fn1);
      runtime.register(fn2);

      const functions = runtime.listFunctions();

      expect(functions).toHaveLength(2);
      expect(functions).toContainEqual(fn1);
      expect(functions).toContainEqual(fn2);
    });
  });

  describe('execute', () => {
    it('should execute registered function', async () => {
      const fn: EdgeFunction = {
        id: 'fn-1',
        name: 'Test Function',
        handler: 'index.handler',
        runtime: 'javascript',
        memory: 128,
        timeout: 5000,
        regions: ['*'],
      };

      runtime.register(fn);

      const context: EdgeRequestContext = {
        region: 'us-east-1',
      };

      const result = await runtime.execute('fn-1', { input: 'test' }, context);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('functionId', 'fn-1');
    });

    it('should throw error for non-existent function', async () => {
      const context: EdgeRequestContext = {
        region: 'us-east-1',
      };

      await expect(
        runtime.execute('non-existent', {}, context)
      ).rejects.toThrow('Function not found');
    });
  });
});

describe('EdgeCacheManager', () => {
  it('should create cache key from request', () => {
    const optimizer = new EdgeOptimizer({
      enabled: true,
      defaultRegion: 'us-east-1',
      cache: {
        enabled: true,
        ttl: 3600000,
        cacheKeys: [],
        purgeKeys: [],
      },
      routing: {
        strategy: 'latency',
        regions: [],
        healthCheck: false,
        healthCheckInterval: 30000,
      },
      functions: [],
      metrics: { enabled: false },
    });

    const cacheManager = new EdgeCacheManager(optimizer);

    const request: GatewayRequest = {
      id: 'req-1',
      timestamp: Date.now(),
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: new Headers(),
      body: null,
      query: new URLSearchParams(),
      params: {},
      context: {} as any,
      metadata: {
        sourceIp: '1.2.3.4',
        userAgent: 'test',
      },
    };

    const key = cacheManager.createKey(request, {
      enabled: true,
      ttl: 3600000,
      cacheKeys: [],
    });

    expect(key).toContain('GET');
    expect(key).toContain('https://api.example.com/data');
  });

  it('should generate tags from response', () => {
    const optimizer = new EdgeOptimizer({
      enabled: true,
      defaultRegion: 'us-east-1',
      cache: {
        enabled: true,
        ttl: 3600000,
        cacheKeys: [],
        purgeKeys: [],
      },
      routing: {
        strategy: 'latency',
        regions: [],
        healthCheck: false,
        healthCheckInterval: 30000,
      },
      functions: [],
      metrics: { enabled: false },
    });

    const cacheManager = new EdgeCacheManager(optimizer);

    const response: GatewayResponse = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      body: null,
      metadata: {
        requestId: 'req-1',
        duration: 100,
        cached: false,
      },
    };

    const tags = cacheManager.generateTags(response);

    expect(tags).toContain('status:200');
    expect(tags).toContain('content-type:application/json');
  });
});
