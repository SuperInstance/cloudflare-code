/**
 * Runtime Optimization Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { RuntimeProfiler } from '../src/runtime/profiler.js';
import { RuntimeOptimizer } from '../src/runtime/optimizer.js';

describe('RuntimeProfiler', () => {
  it('should create profiler instance', () => {
    const profiler = new RuntimeProfiler();
    expect(profiler).toBeDefined();
  });

  it('should profile function execution', () => {
    const profiler = new RuntimeProfiler();

    const testFn = (x: number) => x * 2;
    const profiled = profiler.profile(testFn, 'testFn');

    const result = profiled(5);
    expect(result).toBe(10);

    const profiles = profiler.getProfiles();
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles[0].functionName).toBe('testFn');
  });

  it('should memoize function', () => {
    const profiler = new RuntimeProfiler();

    let callCount = 0;
    const expensiveFn = (x: number) => {
      callCount++;
      return x * 2;
    };

    const memoized = profiler.memoize(expensiveFn);

    expect(memoized(5)).toBe(10);
    expect(callCount).toBe(1);

    expect(memoized(5)).toBe(10);
    expect(callCount).toBe(1); // Should not call again

    expect(memoized(10)).toBe(20);
    expect(callCount).toBe(2);
  });

  it('should debounce function', async () => {
    const profiler = new RuntimeProfiler();
    const fn = vi.fn();

    const debounced = profiler.debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throttle function', async () => {
    const profiler = new RuntimeProfiler();
    const fn = vi.fn();

    const throttled = profiler.throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);

    await new Promise(resolve => setTimeout(resolve, 150));

    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should identify hot paths', () => {
    const profiler = new RuntimeProfiler();

    const slowFn = profiler.profile(() => {
      // Simulate slow function
      for (let i = 0; i < 1000000; i++) {}
    }, 'slowFn');

    // Call multiple times
    for (let i = 0; i < 10; i++) {
      slowFn();
    }

    const hotPaths = profiler.getHotPaths();
    expect(hotPaths.length).toBeGreaterThan(0);
  });

  it('should generate statistics', () => {
    const profiler = new RuntimeProfiler();

    const fn1 = profiler.profile(() => {}, 'fn1');
    const fn2 = profiler.profile(() => {}, 'fn2');

    fn1();
    fn1();
    fn2();

    const stats = profiler.getStats();
    expect(stats.totalFunctions).toBe(2);
    expect(stats.totalCalls).toBe(3);
  });
});

describe('RuntimeOptimizer', () => {
  it('should create optimizer instance', () => {
    const optimizer = new RuntimeOptimizer();
    expect(optimizer).toBeDefined();
  });

  it('should optimize function with multiple techniques', () => {
    const optimizer = new RuntimeOptimizer();

    let callCount = 0;
    const fn = (x: number) => {
      callCount++;
      return x * 2;
    };

    const optimized = optimizer.optimizeFunction(fn, {
      name: 'test',
      memoize: true,
    });

    expect(optimized(5)).toBe(10);
    expect(optimized(5)).toBe(10);
    expect(callCount).toBe(1); // Memoized
  });

  it('should create cache', () => {
    const optimizer = new RuntimeOptimizer();
    const cache = optimizer.createCache<number>({ maxSize: 10 });

    cache.set('key1', 100);
    cache.set('key2', 200);

    expect(cache.get('key1')).toBe(100);
    expect(cache.get('key2')).toBe(200);
    expect(cache.get('key3')).toBeUndefined();
  });

  it('should create object pool', () => {
    const optimizer = new RuntimeOptimizer();
    const pool = optimizer.createObjectPool(
      () => ({ data: 0 }),
      (obj) => { obj.data = 0; },
      { maxSize: 5 }
    );

    const obj1 = pool.acquire();
    obj1.data = 42;

    pool.release(obj1);

    const obj2 = pool.acquire();
    expect(obj2.data).toBe(0); // Should be reset
    expect(pool.size()).toBe(0);
  });

  it('should create async queue', async () => {
    const optimizer = new RuntimeOptimizer();
    const queue = optimizer.createAsyncQueue<{ value: number }>({ concurrency: 2 });

    let completed = 0;
    const tasks = Array.from({ length: 5 }, (_, i) =>
      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        completed++;
        return { value: i };
      })
    );

    await Promise.all(tasks);
    expect(completed).toBe(5);
  });

  it('should create batch processor', async () => {
    const optimizer = new RuntimeOptimizer();
    let batchCount = 0;

    const processor = optimizer.createBatchProcessor<number, number>(
      async (batch) => {
        batchCount++;
        return batch.map(x => x * 2);
      },
      { batchSize: 3, maxWaitTime: 50 }
    );

    const results = await Promise.all([
      processor.add(1),
      processor.add(2),
      processor.add(3),
    ]);

    expect(results).toEqual([2, 4, 6]);
    expect(batchCount).toBe(1);
  });

  it('should generate report', () => {
    const optimizer = new RuntimeOptimizer();
    const profiler = optimizer.getProfiler();

    const fn = profiler.profile(() => {}, 'test');
    fn();

    const report = optimizer.generateReport();
    expect(report).toContain('Runtime Optimization Report');
    expect(report).toContain('Statistics');
  });
});
