/**
 * Composition Engine Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CompositionEngine,
  ServiceRegistry,
  DataMerger,
} from '../../src/composition/engine.js';
import type {
  CompositionRequest,
  CompositionOperation,
  ServiceDefinition,
} from '../../src/types/index.js';

describe('CompositionEngine', () => {
  let serviceRegistry: ServiceRegistry;
  let engine: CompositionEngine;

  beforeEach(() => {
    serviceRegistry = new ServiceRegistry();
    engine = new CompositionEngine(serviceRegistry);
  });

  describe('execute', () => {
    it('should execute parallel operations', async () => {
      // Register test service
      const service: ServiceDefinition = {
        id: 'test-service',
        name: 'Test Service',
        version: '1.0.0',
        endpoint: 'https://api.example.com',
        timeout: 5000,
        metadata: {},
      };
      await serviceRegistry.register(service);

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 'success' }),
      } as Response);

      const operations: CompositionOperation[] = [
        {
          id: 'op1',
          serviceId: 'test-service',
          method: 'GET',
          path: '/data1',
          params: {},
        },
        {
          id: 'op2',
          serviceId: 'test-service',
          method: 'GET',
          path: '/data2',
          params: {},
        },
      ];

      const request: CompositionRequest = {
        requestId: 'test-req-1',
        operations,
        mergeStrategy: 'parallel',
        errorPolicy: 'continue',
      };

      const result = await engine.execute(request);

      expect(result.requestId).toBe('test-req-1');
      expect(result.data).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should handle operation failures with continue policy', async () => {
      const service: ServiceDefinition = {
        id: 'test-service',
        name: 'Test Service',
        version: '1.0.0',
        endpoint: 'https://api.example.com',
        timeout: 5000,
        metadata: {},
      };
      await serviceRegistry.register(service);

      // Mock fetch to fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const operations: CompositionOperation[] = [
        {
          id: 'op1',
          serviceId: 'test-service',
          method: 'GET',
          path: '/data1',
          params: {},
        },
        {
          id: 'op2',
          serviceId: 'test-service',
          method: 'GET',
          path: '/data2',
          params: {},
        },
      ];

      const request: CompositionRequest = {
        requestId: 'test-req-2',
        operations,
        mergeStrategy: 'parallel',
        errorPolicy: 'continue',
      };

      const result = await engine.execute(request);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.metadata.failureCount).toBeGreaterThan(0);
    });

    it('should handle operation timeouts', async () => {
      const service: ServiceDefinition = {
        id: 'test-service',
        name: 'Test Service',
        version: '1.0.0',
        endpoint: 'https://api.example.com',
        timeout: 1000,
        metadata: {},
      };
      await serviceRegistry.register(service);

      // Mock slow fetch
      global.fetch = vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ result: 'success' }),
                } as Response),
              2000
            )
          )
      );

      const operations: CompositionOperation[] = [
        {
          id: 'op1',
          serviceId: 'test-service',
          method: 'GET',
          path: '/data1',
          params: {},
          timeout: 500,
        },
      ];

      const request: CompositionRequest = {
        requestId: 'test-req-3',
        operations,
        mergeStrategy: 'parallel',
        errorPolicy: 'fail-fast',
      };

      const result = await engine.execute(request);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('timed out');
    });

    it('should cache results when enabled', async () => {
      const cachedEngine = new CompositionEngine(serviceRegistry, {
        cache: {
          enabled: true,
          ttl: 60000,
          maxSize: 1000,
        },
      });

      const service: ServiceDefinition = {
        id: 'test-service',
        name: 'Test Service',
        version: '1.0.0',
        endpoint: 'https://api.example.com',
        timeout: 5000,
        metadata: {},
      };
      await serviceRegistry.register(service);

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ result: 'success', callCount }),
        } as Response);
      });

      const operations: CompositionOperation[] = [
        {
          id: 'op1',
          serviceId: 'test-service',
          method: 'GET',
          path: '/data1',
          params: {},
        },
      ];

      const request: CompositionRequest = {
        requestId: 'test-req-4',
        operations,
        mergeStrategy: 'parallel',
        errorPolicy: 'continue',
      };

      // First call
      await cachedEngine.execute(request);
      // Second call - should use cache
      await cachedEngine.execute(request);

      expect(callCount).toBe(1); // Only one actual fetch due to caching
    });
  });

  describe('executeBatch', () => {
    it('should execute multiple compositions in parallel', async () => {
      const service: ServiceDefinition = {
        id: 'test-service',
        name: 'Test Service',
        version: '1.0.0',
        endpoint: 'https://api.example.com',
        timeout: 5000,
        metadata: {},
      };
      await serviceRegistry.register(service);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 'success' }),
      } as Response);

      const requests: CompositionRequest[] = [
        {
          requestId: 'batch-1',
          operations: [
            {
              id: 'op1',
              serviceId: 'test-service',
              method: 'GET',
              path: '/data1',
              params: {},
            },
          ],
          mergeStrategy: 'parallel',
          errorPolicy: 'continue',
        },
        {
          requestId: 'batch-2',
          operations: [
            {
              id: 'op2',
              serviceId: 'test-service',
              method: 'GET',
              path: '/data2',
              params: {},
            },
          ],
          mergeStrategy: 'parallel',
          errorPolicy: 'continue',
        },
      ];

      const results = await engine.executeBatch(requests);

      expect(results).toHaveLength(2);
      expect(results[0].requestId).toBe('batch-1');
      expect(results[1].requestId).toBe('batch-2');
    });
  });

  describe('metrics', () => {
    it('should track composition metrics', async () => {
      const service: ServiceDefinition = {
        id: 'test-service',
        name: 'Test Service',
        version: '1.0.0',
        endpoint: 'https://api.example.com',
        timeout: 5000,
        metadata: {},
      };
      await serviceRegistry.register(service);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 'success' }),
      } as Response);

      const operations: CompositionOperation[] = [
        {
          id: 'op1',
          serviceId: 'test-service',
          method: 'GET',
          path: '/data1',
          params: {},
        },
      ];

      const request: CompositionRequest = {
        requestId: 'test-req-5',
        operations,
        mergeStrategy: 'parallel',
        errorPolicy: 'continue',
      };

      await engine.execute(request);

      const metrics = engine.getMetrics();
      expect(metrics.totalCompositions).toBe(1);
      expect(metrics.successfulCompositions).toBe(1);
    });
  });

  describe('cancellation', () => {
    it('should cancel running composition', async () => {
      const service: ServiceDefinition = {
        id: 'test-service',
        name: 'Test Service',
        version: '1.0.0',
        endpoint: 'https://api.example.com',
        timeout: 5000,
        metadata: {},
      };
      await serviceRegistry.register(service);

      const operations: CompositionOperation[] = [
        {
          id: 'op1',
          serviceId: 'test-service',
          method: 'GET',
          path: '/data1',
          params: {},
        },
      ];

      const request: CompositionRequest = {
        requestId: 'test-req-6',
        operations,
        mergeStrategy: 'parallel',
        errorPolicy: 'continue',
      };

      // Start execution
      const execution = engine.execute(request);

      // Cancel immediately
      const cancelled = await engine.cancel(request.requestId);

      expect(cancelled).toBe(true);

      const metrics = engine.getMetrics();
      expect(metrics.cancellations).toBe(1);
    });
  });

  describe('cache management', () => {
    it('should clear cache by pattern', async () => {
      const cachedEngine = new CompositionEngine(serviceRegistry, {
        cache: {
          enabled: true,
          ttl: 60000,
          maxSize: 1000,
        },
      });

      const service: ServiceDefinition = {
        id: 'test-service',
        name: 'Test Service',
        version: '1.0.0',
        endpoint: 'https://api.example.com',
        timeout: 5000,
        metadata: {},
      };
      await serviceRegistry.register(service);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 'success' }),
      } as Response);

      const operations: CompositionOperation[] = [
        {
          id: 'op1',
          serviceId: 'test-service',
          method: 'GET',
          path: '/data1',
          params: {},
        },
      ];

      const request: CompositionRequest = {
        requestId: 'test-req-7',
        operations,
        mergeStrategy: 'parallel',
        errorPolicy: 'continue',
      };

      await cachedEngine.execute(request);

      // Clear all cache
      cachedEngine.clearCache();

      const metrics = cachedEngine.getMetrics();
      // Cache should be cleared
    });
  });
});

describe('DataMerger', () => {
  it('should merge nested objects', () => {
    const merger = new DataMerger();
    const target = { user: { name: 'John' }, posts: [] };
    const source = { user: { email: 'john@example.com' }, posts: [{ id: 1 }] };

    const result = merger.merge(target, source, []);

    expect(result.user.name).toBe('John');
    expect(result.user.email).toBe('john@example.com');
    expect(result.posts).toHaveLength(1);
  });

  it('should handle array merge strategies', () => {
    const merger = new DataMerger();
    const target = { items: [1, 2] };
    const source = { items: [3, 4] };

    const appendResult = merger.merge(target, source, [
      {
        targetPath: 'items',
        arrayMerge: 'append',
      },
    ]);

    expect(appendResult.items).toEqual([1, 2, 3, 4]);

    const replaceResult = merger.merge(target, source, [
      {
        targetPath: 'items',
        arrayMerge: 'replace',
      },
    ]);

    expect(replaceResult.items).toEqual([3, 4]);
  });
});

describe('ServiceRegistry', () => {
  it('should register and retrieve services', async () => {
    const registry = new ServiceRegistry();
    const service: ServiceDefinition = {
      id: 'svc-1',
      name: 'Service 1',
      version: '1.0.0',
      endpoint: 'https://api.example.com',
      timeout: 5000,
      metadata: {},
    };

    await registry.register(service);
    const retrieved = await registry.get('svc-1');

    expect(retrieved).toEqual(service);
  });

  it('should filter healthy services', async () => {
    const registry = new ServiceRegistry();

    const service1: ServiceDefinition = {
      id: 'svc-1',
      name: 'Service 1',
      version: '1.0.0',
      endpoint: 'https://api.example.com',
      timeout: 5000,
      healthCheck: { enabled: true, path: '/health', interval: 30000, timeout: 5000, unhealthyThreshold: 3, healthyThreshold: 2 },
      metadata: {},
    };

    const service2: ServiceDefinition = {
      id: 'svc-2',
      name: 'Service 2',
      version: '1.0.0',
      endpoint: 'https://api.example.com',
      timeout: 5000,
      healthCheck: { enabled: false, path: '/health', interval: 30000, timeout: 5000, unhealthyThreshold: 3, healthyThreshold: 2 },
      metadata: {},
    };

    await registry.register(service1);
    await registry.register(service2);

    const healthy = await registry.getHealthy();

    expect(healthy).toContain(service1);
    expect(healthy).not.toContain(service2);
  });
});
