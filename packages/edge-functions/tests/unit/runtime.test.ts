/**
 * Unit tests for Function Runtime
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FunctionRuntime,
  TimeoutError,
  MemoryLimitError,
  FunctionNotFoundError,
  ExecutionError,
  createRuntime,
} from '../../src/runtime/runtime';
import type { EdgeFunction, EdgeRequest, EdgeEnv } from '../../src/types';

describe('FunctionRuntime', () => {
  let runtime: FunctionRuntime;
  let mockEnv: EdgeEnv;
  let mockContext: ExecutionContext & { env: EdgeEnv };

  beforeEach(() => {
    runtime = new FunctionRuntime({
      defaultTimeout: 5000,
      defaultMemoryLimit: 128,
      enableMetrics: true,
    });

    mockEnv = {
      KV: {},
      DURABLE: {},
      R2: {},
      DB: {},
      QUEUE: {},
    };

    mockContext = {
      env: mockEnv,
      waitUntil: vi.fn(),
    } as any;
  });

  describe('Function Registration', () => {
    it('should register a function successfully', () => {
      const func: EdgeFunction = {
        id: 'test-func',
        name: 'Test Function',
        handler: async (input: { name: string }) => `Hello, ${input.name}!`,
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunction(func);
      expect(runtime.hasFunction('test-func')).toBe(true);
    });

    it('should throw error when registering duplicate function', () => {
      const func: EdgeFunction = {
        id: 'test-func',
        name: 'Test Function',
        handler: async () => 'test',
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunction(func);
      expect(() => runtime.registerFunction(func)).toThrow('already registered');
    });

    it('should get registered function', () => {
      const func: EdgeFunction = {
        id: 'test-func',
        name: 'Test Function',
        handler: async () => 'test',
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunction(func);
      const retrieved = runtime.getFunction('test-func');
      expect(retrieved).toEqual(func);
    });

    it('should unregister a function', () => {
      const func: EdgeFunction = {
        id: 'test-func',
        name: 'Test Function',
        handler: async () => 'test',
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunction(func);
      expect(runtime.unregisterFunction('test-func')).toBe(true);
      expect(runtime.hasFunction('test-func')).toBe(false);
    });

    it('should get all registered functions', () => {
      const func1: EdgeFunction = {
        id: 'func1',
        name: 'Function 1',
        handler: async () => 'test1',
        config: {},
        version: '1.0.0',
      };

      const func2: EdgeFunction = {
        id: 'func2',
        name: 'Function 2',
        handler: async () => 'test2',
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunctions([func1, func2]);
      const all = runtime.getAllFunctions();
      expect(all).toHaveLength(2);
      expect(all.map(f => f.id)).toContain('func1');
      expect(all.map(f => f.id)).toContain('func2');
    });
  });

  describe('Function Execution', () => {
    it('should execute a function successfully', async () => {
      const func: EdgeFunction<{ name: string }, string> = {
        id: 'hello',
        name: 'Hello World',
        handler: async (input) => `Hello, ${input.name}!`,
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunction(func);

      const request: EdgeRequest<{ name: string }> = {
        id: 'req-1',
        functionId: 'hello',
        input: { name: 'World' },
        timestamp: Date.now(),
      };

      const response = await runtime.execute(request, mockContext);

      expect(response.status).toBe('success');
      expect(response.data).toBe('Hello, World!');
      expect(response.functionId).toBe('hello');
    });

    it('should throw FunctionNotFoundError for non-existent function', async () => {
      const request: EdgeRequest = {
        id: 'req-1',
        functionId: 'non-existent',
        input: {},
        timestamp: Date.now(),
      };

      await expect(runtime.execute(request, mockContext)).rejects.toThrow(
        FunctionNotFoundError
      );
    });

    it('should handle function errors', async () => {
      const func: EdgeFunction = {
        id: 'error-func',
        name: 'Error Function',
        handler: async () => {
          throw new Error('Function failed');
        },
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunction(func);

      const request: EdgeRequest = {
        id: 'req-1',
        functionId: 'error-func',
        input: {},
        timestamp: Date.now(),
      };

      await expect(runtime.execute(request, mockContext)).rejects.toThrow(
        ExecutionError
      );
    });

    it('should validate required environment variables', async () => {
      const func: EdgeFunction = {
        id: 'env-func',
        name: 'Env Function',
        handler: async () => 'test',
        config: {
          requiredEnvVars: ['API_KEY', 'DB_URL'],
        },
        version: '1.0.0',
      };

      runtime.registerFunction(func);

      const request: EdgeRequest = {
        id: 'req-1',
        functionId: 'env-func',
        input: {},
        timestamp: Date.now(),
      };

      await expect(runtime.execute(request, mockContext)).rejects.toThrow(
        'Missing required environment variable'
      );
    });

    it('should execute with required env vars present', async () => {
      mockEnv.API_KEY = 'secret';
      mockEnv.DB_URL = 'postgres://localhost';

      const func: EdgeFunction = {
        id: 'env-func',
        name: 'Env Function',
        handler: async (_, ctx) => {
          return ctx.env.API_KEY;
        },
        config: {
          requiredEnvVars: ['API_KEY'],
        },
        version: '1.0.0',
      };

      runtime.registerFunction(func);

      const request: EdgeRequest = {
        id: 'req-1',
        functionId: 'env-func',
        input: {},
        timestamp: Date.now(),
      };

      const response = await runtime.execute(request, mockContext);
      expect(response.data).toBe('secret');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow function', async () => {
      const func: EdgeFunction = {
        id: 'slow-func',
        name: 'Slow Function',
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 10000));
          return 'done';
        },
        config: {
          timeout: 100,
        },
        version: '1.0.0',
      };

      runtime.registerFunction(func);

      const request: EdgeRequest = {
        id: 'req-1',
        functionId: 'slow-func',
        input: {},
        timestamp: Date.now(),
      };

      await expect(runtime.execute(request, mockContext)).rejects.toThrow(
        TimeoutError
      );
    });
  });

  describe('Metrics', () => {
    it('should track execution metrics', async () => {
      const func: EdgeFunction = {
        id: 'metric-func',
        name: 'Metric Function',
        handler: async () => 'test',
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunction(func);

      const request: EdgeRequest = {
        id: 'req-1',
        functionId: 'metric-func',
        input: {},
        timestamp: Date.now(),
      };

      await runtime.execute(request, mockContext);

      const metrics = runtime.getMetrics('metric-func');
      expect(metrics).toBeDefined();
      expect(metrics?.totalExecutions).toBeGreaterThan(0);
    });

    it('should calculate average execution time', async () => {
      const func: EdgeFunction = {
        id: 'metric-func',
        name: 'Metric Function',
        handler: async () => 'test',
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunction(func);

      const request: EdgeRequest = {
        id: 'req-1',
        functionId: 'metric-func',
        input: {},
        timestamp: Date.now(),
      };

      // Execute multiple times
      for (let i = 0; i < 5; i++) {
        await runtime.execute(request, mockContext);
      }

      const metrics = runtime.getMetrics('metric-func');
      expect(metrics?.totalExecutions).toBe(5);
      expect(metrics?.avgExecutionTime).toBeGreaterThan(0);
    });

    it('should reset metrics', async () => {
      const func: EdgeFunction = {
        id: 'metric-func',
        name: 'Metric Function',
        handler: async () => 'test',
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunction(func);

      const request: EdgeRequest = {
        id: 'req-1',
        functionId: 'metric-func',
        input: {},
        timestamp: Date.now(),
      };

      await runtime.execute(request, mockContext);
      runtime.resetMetrics('metric-func');

      const metrics = runtime.getMetrics('metric-func');
      expect(metrics?.totalExecutions).toBe(0);
    });
  });

  describe('Runtime Status', () => {
    it('should get runtime status', () => {
      const status = runtime.getStatus();

      expect(status).toHaveProperty('isShuttingDown');
      expect(status).toHaveProperty('runningExecutions');
      expect(status).toHaveProperty('registeredFunctions');
      expect(status).toHaveProperty('maxConcurrentExecutions');
    });

    it('should track running executions', async () => {
      const func: EdgeFunction = {
        id: 'async-func',
        name: 'Async Function',
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'done';
        },
        config: {},
        version: '1.0.0',
      };

      runtime.registerFunction(func);

      const request: EdgeRequest = {
        id: 'req-1',
        functionId: 'async-func',
        input: {},
        timestamp: Date.now(),
      };

      const executionPromise = runtime.execute(request, mockContext);
      const status = runtime.getStatus();
      expect(status.runningExecutions).toBeGreaterThan(0);

      await executionPromise;
    });
  });

  describe('Utility Functions', () => {
    it('should create runtime with custom config', () => {
      const customRuntime = createRuntime({
        defaultTimeout: 10000,
        defaultMemoryLimit: 256,
        maxConcurrentExecutions: 50,
      });

      expect(customRuntime).toBeInstanceOf(FunctionRuntime);
    });

    it('should measure execution time', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      };

      const { result, duration } = await runtime['measureExecutionTime'](fn);

      expect(result).toBe('result');
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Concurrent Execution Limits', () => {
    it('should enforce max concurrent executions', async () => {
      const limitedRuntime = new FunctionRuntime({
        maxConcurrentExecutions: 2,
      });

      const func: EdgeFunction = {
        id: 'slow-func',
        name: 'Slow Function',
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return 'done';
        },
        config: {},
        version: '1.0.0',
      };

      limitedRuntime.registerFunction(func);

      const request: EdgeRequest = {
        id: 'req-1',
        functionId: 'slow-func',
        input: {},
        timestamp: Date.now(),
      };

      // Start 3 concurrent executions
      const executions = [
        limitedRuntime.execute({ ...request, id: 'req-1' }, mockContext),
        limitedRuntime.execute({ ...request, id: 'req-2' }, mockContext),
        limitedRuntime.execute({ ...request, id: 'req-3' }, mockContext),
      ];

      // Third execution should fail with concurrent limit error
      const results = await Promise.allSettled(executions);
      const failures = results.filter(r => r.status === 'rejected');

      expect(failures.length).toBeGreaterThan(0);
    });
  });
});
