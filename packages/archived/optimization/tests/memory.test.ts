/**
 * Memory Optimization Tests
 */

import { describe, it, expect } from 'vitest';
import { MemoryOptimizer } from '../src/memory/optimizer.js';

describe('MemoryOptimizer', () => {
  it('should create optimizer instance', () => {
    const optimizer = new MemoryOptimizer();
    expect(optimizer).toBeDefined();
  });

  it('should capture memory snapshot', () => {
    const optimizer = new MemoryOptimizer();
    const snapshot = optimizer.captureSnapshot();

    expect(snapshot).toHaveProperty('timestamp');
    expect(snapshot).toHaveProperty('heapUsed');
    expect(snapshot).toHaveProperty('heapTotal');
    expect(snapshot).toHaveProperty('external');
    expect(snapshot).toHaveProperty('arrayBuffers');
  });

  it('should create object pool', () => {
    const optimizer = new MemoryOptimizer();
    const pool = optimizer.createPool(
      'test',
      () => ({ value: 0 }),
      (obj) => { obj.value = 0; }
    );

    expect(pool.size()).toBe(0);

    const obj1 = pool.acquire();
    expect(obj1).toEqual({ value: 0 });
    expect(pool.size()).toBe(0);

    obj1.value = 42;
    pool.release(obj1);
    expect(pool.size()).toBe(1);

    const obj2 = pool.acquire();
    expect(obj2.value).toBe(0); // Should be reset
    expect(pool.size()).toBe(0);
  });

  it('should create buffer pool', () => {
    const optimizer = new MemoryOptimizer();
    const pool = optimizer.createBufferPool('buffer', 1024, 10);

    const buf1 = pool.acquire();
    expect(buf1).toBeInstanceOf(Uint8Array);
    expect(buf1.length).toBe(1024);

    buf1[0] = 42;
    pool.release(buf1);

    const buf2 = pool.acquire();
    expect(buf2[0]).toBe(0); // Should be cleared
  });

  it('should create optimized cache', () => {
    const optimizer = new MemoryOptimizer();
    const cache = optimizer.createCache('test', {
      maxSize: 10,
      ttl: 1000,
    });

    cache.set('key1', { data: 'value1' });
    cache.set('key2', { data: 'value2' });

    expect(cache.get('key1')).toEqual({ data: 'value1' });
    expect(cache.get('key2')).toEqual({ data: 'value2' });
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key3')).toBe(false);

    cache.delete('key1');
    expect(cache.has('key1')).toBe(false);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('should track cache memory usage', () => {
    const optimizer = new MemoryOptimizer();
    const cache = optimizer.createCache('test', {
      maxSize: 10,
      maxMemory: 1000,
    });

    cache.set('small', 'x');
    expect(cache.memoryUsage).toBeGreaterThan(0);

    cache.clear();
    expect(cache.memoryUsage).toBe(0);
  });

  it('should analyze memory', async () => {
    const optimizer = new MemoryOptimizer();

    // Capture some snapshots
    for (let i = 0; i < 5; i++) {
      optimizer.captureSnapshot();
    }

    const analysis = await optimizer.analyze();

    expect(analysis).toHaveProperty('baseline');
    expect(analysis).toHaveProperty('current');
    expect(analysis).toHaveProperty('leaks');
    expect(analysis).toHaveProperty('pools');
    expect(analysis).toHaveProperty('recommendations');
  });

  it('should get stats', () => {
    const optimizer = new MemoryOptimizer();

    optimizer.captureSnapshot();
    optimizer.captureSnapshot();

    const stats = optimizer.getStats();

    expect(stats).toHaveProperty('currentMemory');
    expect(stats).toHaveProperty('peakMemory');
    expect(stats).toHaveProperty('averageMemory');
    expect(stats).toHaveProperty('snapshots');
    expect(stats.snapshots).toBe(2);
  });

  it('should clear snapshots', () => {
    const optimizer = new MemoryOptimizer();

    optimizer.captureSnapshot();
    optimizer.captureSnapshot();
    expect(optimizer['snapshots'].length).toBe(2);

    optimizer.clearSnapshots();
    expect(optimizer['snapshots'].length).toBe(0);
  });

  it('should generate report', () => {
    const optimizer = new MemoryOptimizer();
    optimizer.captureSnapshot();

    const report = optimizer.generateReport();
    expect(report).toContain('Memory Optimization Report');
    expect(report).toContain('Statistics');
  });

  it('should estimate size correctly', () => {
    const optimizer = new MemoryOptimizer();
    const estimate = (optimizer as any).estimateSize.bind(optimizer);

    expect(estimate('hello')).toBe(10); // 5 chars * 2 bytes
    expect(estimate(42)).toBe(8); // 8 bytes for number
    expect(estimate(true)).toBe(4); // 4 bytes for boolean
    expect(estimate(null)).toBe(0);
    expect(estimate(undefined)).toBe(0);
  });

  it('should create pool with custom config', () => {
    const optimizer = new MemoryOptimizer();
    const pool = optimizer.createPool(
      'custom',
      () => ({ value: 0 }),
      (obj) => { obj.value = 0; },
      { maxSize: 5 }
    );

    for (let i = 0; i < 10; i++) {
      const obj = { value: i };
      pool.release(obj);
    }

    expect(pool.size()).toBeLessThanOrEqual(5);
  });
});
