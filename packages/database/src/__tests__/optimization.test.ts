/**
 * Performance Optimization Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { QueryCache } from '../optimization/cache';
import { QueryOptimizer } from '../optimization/query-optimizer';
import type { CacheConfig } from '../optimization/types';

describe('QueryCache', () => {
  let cache: QueryCache;
  let config: CacheConfig;

  beforeEach(() => {
    config = {
      maxSize: 100,
      defaultTTL: 60000,
      evictionPolicy: 'lru',
      maxSizeBytes: 1024 * 1024,
    };
    cache = new QueryCache(config);
  });

  it('should store and retrieve values', () => {
    cache.set('key1', { value: 'test' });
    const value = cache.get('key1');

    expect(value).toEqual({ value: 'test' });
  });

  it('should return null for missing keys', () => {
    const value = cache.get('nonexistent');
    expect(value).toBeNull();
  });

  it('should expire entries based on TTL', async () => {
    cache.set('key1', { value: 'test' }, 10);

    await new Promise(resolve => setTimeout(resolve, 20));

    const value = cache.get('key1');
    expect(value).toBeNull();
  });

  it('should track cache hits', () => {
    cache.set('key1', { value: 'test' });

    cache.get('key1');
    cache.get('key1');
    cache.get('key1');

    const stats = cache.getStats();
    expect(stats.totalHits).toBe(3);
  });

  it('should evict entries when full', () => {
    // Fill cache
    for (let i = 0; i < 100; i++) {
      cache.set(`key${i}`, { value: `data${i}` });
    }

    // Add one more - should trigger eviction
    cache.set('key100', { value: 'data100' });

    const stats = cache.getStats();
    expect(stats.size).toBeLessThanOrEqual(100);
  });

  it('should invalidate entries by pattern', () => {
    cache.set('user:1', { name: 'Alice' });
    cache.set('user:2', { name: 'Bob' });
    cache.set('product:1', { name: 'Widget' });

    const count = cache.invalidate('user:*');

    expect(count).toBe(2);
    expect(cache.get('user:1')).toBeNull();
    expect(cache.get('product:1')).toBeDefined();
  });

  it('should clear all entries', () => {
    cache.set('key1', { value: 'test1' });
    cache.set('key2', { value: 'test2' });

    cache.clear();

    const stats = cache.getStats();
    expect(stats.size).toBe(0);
  });
});

describe('QueryOptimizer', () => {
  let optimizer: QueryOptimizer;

  beforeEach(() => {
    optimizer = new QueryOptimizer(100);
  });

  it('should record query metrics', () => {
    optimizer.recordQuery('SELECT * FROM users WHERE id = 1', 50, 10, 1);
    optimizer.recordQuery('SELECT * FROM users WHERE id = 1', 70, 10, 1);
    optimizer.recordQuery('SELECT * FROM users WHERE id = 1', 30, 10, 1);

    const metrics = optimizer.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0].executionCount).toBe(3);
    expect(metrics[0].avgTime).toBe(50);
  });

  it('should analyze queries and generate plans', () => {
    const plan = optimizer.analyzeQuery('SELECT * FROM users WHERE id = 1');

    expect(plan.query).toBeDefined();
    expect(plan.plan).toBeDefined();
    expect(plan.estimatedCost).toBeGreaterThan(0);
  });

  it('should identify slow queries', () => {
    optimizer.recordQuery('SELECT * FROM users', 200, 1000, 100);

    const metrics = optimizer.getMetrics();
    expect(metrics[0].avgTime).toBe(200);
  });

  it('should generate performance reports', () => {
    // Record some queries
    optimizer.recordQuery('SELECT * FROM users WHERE id = 1', 50, 10, 1);
    optimizer.recordQuery('SELECT * FROM orders WHERE user_id = 1', 150, 100, 50);
    optimizer.recordQuery('SELECT * FROM products', 300, 500, 100);

    const report = optimizer.generateReport();

    expect(report.totalQueries).toBe(3);
    expect(report.avgLatency).toBeGreaterThan(0);
    expect(report.slowQueries.length).toBeGreaterThan(0);
  });

  it('should provide index suggestions', () => {
    optimizer.recordQuery('SELECT * FROM users WHERE email = ?', 250, 1000, 1);

    const plan = optimizer.analyzeQuery('SELECT * FROM users WHERE email = ?');

    expect(plan.suggestions.length).toBeGreaterThan(0);
    expect(plan.suggestions[0].table).toBe('users');
  });

  it('should optimize queries', () => {
    const optimized = optimizer.optimizeQuery('SELECT * FROM users');

    expect(optimized).toContain('LIMIT');
  });

  it('should clear metrics', () => {
    optimizer.recordQuery('SELECT * FROM users', 50, 10, 1);

    optimizer.clearMetrics();

    const metrics = optimizer.getMetrics();
    expect(metrics.length).toBe(0);
  });

  it('should provide access to cache', () => {
    const cache = optimizer.getCache();
    expect(cache).toBeInstanceOf(QueryCache);
  });
});
