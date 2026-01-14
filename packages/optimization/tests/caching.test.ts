/**
 * Caching Optimization Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { CachingOptimizer } from '../src/caching/optimizer.js';

describe('CachingOptimizer', () => {
  it('should create optimizer instance', () => {
    const optimizer = new CachingOptimizer();
    expect(optimizer).toBeDefined();
  });

  it('should create LRU cache', () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('test', { strategy: 'lru', maxSize: 3 });

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should evict key1

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  it('should create TTL cache', async () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('test', { strategy: 'ttl', ttl: 100 });

    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(cache.get('key1')).toBeUndefined();
  });

  it('should create FIFO cache', () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('test', { strategy: 'fifo', maxSize: 3 });

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should evict key1 (FIFO)

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key4')).toBe('value4');
  });

  it('should create LFU cache', () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('test', { strategy: 'lfu', maxSize: 3 });

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Access key1 and key2 multiple times
    cache.get('key1');
    cache.get('key2');
    cache.get('key1');
    cache.get('key2');

    cache.set('key4', 'value4'); // Should evict key3 (least frequently used)

    expect(cache.get('key3')).toBeUndefined();
    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key4')).toBe('value4');
  });

  it('should create hybrid cache', () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('test', {
      strategy: 'hybrid',
      maxSize: 10,
      ttl: 1000,
    });

    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should track cache statistics', () => {
    const optimizer = new CachingOptimizer({ statsEnabled: true });
    const cache = optimizer.createCache('test');

    cache.set('key1', 'value1');
    cache.get('key1'); // hit
    cache.get('key2'); // miss

    expect(cache.stats.hits).toBe(1);
    expect(cache.stats.misses).toBe(1);
    expect(cache.stats.size).toBe(1);
  });

  it('should calculate hit rate', () => {
    const optimizer = new CachingOptimizer({ statsEnabled: true });
    const cache = optimizer.createCache('test');

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.get('key1'); // hit
    cache.get('key2'); // hit
    cache.get('key3'); // miss

    const hitRate = cache.stats.hits / (cache.stats.hits + cache.stats.misses);
    expect(hitRate).toBeCloseTo(0.667, 1);
  });

  it('should create multi-level cache', () => {
    const optimizer = new CachingOptimizer();

    const mlCache = optimizer.createMultiLevelCache([
      { name: 'L1', config: { strategy: 'lru', maxSize: 10 } },
      { name: 'L2', config: { strategy: 'lru', maxSize: 100 } },
    ]);

    expect(mlCache.layers).toHaveLength(2);
    expect(mlCache.layers[0].name).toBe('L1');
    expect(mlCache.layers[1].name).toBe('L2');
  });

  it('should get from multi-level cache', () => {
    const optimizer = new CachingOptimizer();

    optimizer.createMultiLevelCache([
      { name: 'L1', config: { strategy: 'lru', maxSize: 10 } },
      { name: 'L2', config: { strategy: 'lru', maxSize: 100 } },
    ]);

    optimizer.setInMultiLevelCache('key1', 'value1');

    const value = optimizer.getFromMultiLevelCache('key1');
    expect(value).toBe('value1');
  });

  it('should analyze cache performance', () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('test');

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.get('key1');
    cache.get('key3');

    const analysis = optimizer.analyze();

    expect(analysis).toHaveProperty('totalHits');
    expect(analysis).toHaveProperty('totalMisses');
    expect(analysis).toHaveProperty('overallHitRate');
    expect(analysis).toHaveProperty('layers');
    expect(analysis).toHaveProperty('recommendations');
  });

  it('should generate recommendations for low hit rate', () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('test');

    // Create many misses
    for (let i = 0; i < 100; i++) {
      cache.get(`key${i}`);
    }

    const analysis = optimizer.analyze();
    expect(analysis.recommendations.length).toBeGreaterThan(0);
  });

  it('should clear cache', () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('test');

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should delete from cache', () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('test');

    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);

    cache.delete('key1');
    expect(cache.has('key1')).toBe(false);
  });

  it('should get cache by name', () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('myCache');

    const retrieved = optimizer.getCache('myCache');
    expect(retrieved).toBe(cache);
  });

  it('should get all caches', () => {
    const optimizer = new CachingOptimizer();

    optimizer.createCache('cache1');
    optimizer.createCache('cache2');

    const allCaches = optimizer.getAllCaches();
    expect(allCaches.size).toBe(2);
  });

  it('should clear all caches', () => {
    const optimizer = new CachingOptimizer();

    const cache1 = optimizer.createCache('cache1');
    const cache2 = optimizer.createCache('cache2');

    cache1.set('key1', 'value1');
    cache2.set('key2', 'value2');

    optimizer.clearAll();

    expect(cache1.size).toBe(0);
    expect(cache2.size).toBe(0);
  });

  it('should generate report', () => {
    const optimizer = new CachingOptimizer();
    const cache = optimizer.createCache('test');

    cache.set('key1', 'value1');
    cache.get('key1');

    const report = optimizer.generateReport();
    expect(report).toContain('Cache Optimization Report');
    expect(report).toContain('Overall Statistics');
  });

  it('should estimate size', () => {
    const optimizer = new CachingOptimizer();
    const estimate = (optimizer as any).estimateSize.bind(optimizer);

    expect(estimate('hello')).toBe(10);
    expect(estimate(123)).toBe(8);
    expect(estimate(true)).toBe(4);
    expect(estimate([1, 2, 3])).toBeGreaterThan(0);
    expect(estimate({ a: 1 })).toBeGreaterThan(0);
  });
});
