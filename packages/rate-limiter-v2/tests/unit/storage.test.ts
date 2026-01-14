/**
 * Unit tests for storage backends
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorage } from '../../src/storage/memory-storage.js';
import type { RateLimitState } from '../../src/types/index.js';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage({ type: 'memory', prefix: 'test' });
  });

  afterEach(async () => {
    await storage.destroy();
  });

  it('should store and retrieve values', async () => {
    const state: RateLimitState = {
      count: 5,
      lastUpdate: Date.now()
    };

    await storage.set('test-key', state);
    const retrieved = await storage.get('test-key');

    expect(retrieved).toEqual(state);
  });

  it('should return null for non-existent keys', async () => {
    const result = await storage.get('non-existent');
    expect(result).toBeNull();
  });

  it('should delete values', async () => {
    const state: RateLimitState = {
      count: 5,
      lastUpdate: Date.now()
    };

    await storage.set('test-key', state);
    await storage.delete('test-key');

    const result = await storage.get('test-key');
    expect(result).toBeNull();
  });

  it('should increment counters', async () => {
    const result = await storage.increment('counter', 1);
    expect(result).toBe(1);

    const result2 = await storage.increment('counter', 5);
    expect(result2).toBe(6);
  });

  it('should handle TTL expiration', async () => {
    const state: RateLimitState = {
      count: 5,
      lastUpdate: Date.now()
    };

    await storage.set('test-key', state, 100); // 100ms TTL

    // Should exist immediately
    let result = await storage.get('test-key');
    expect(result).not.toBeNull();

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    result = await storage.get('test-key');
    expect(result).toBeNull();
  });

  it('should get multiple values', async () => {
    await storage.set('key1', { count: 1, lastUpdate: Date.now() });
    await storage.set('key2', { count: 2, lastUpdate: Date.now() });
    await storage.set('key3', { count: 3, lastUpdate: Date.now() });

    const results = await storage.getMultiple(['key1', 'key2', 'key3']);

    expect(results.size).toBe(3);
    expect(results.get('key1')?.count).toBe(1);
    expect(results.get('key2')?.count).toBe(2);
    expect(results.get('key3')?.count).toBe(3);
  });

  it('should set multiple values', async () => {
    const entries = new Map<string, RateLimitState>([
      ['key1', { count: 1, lastUpdate: Date.now() }],
      ['key2', { count: 2, lastUpdate: Date.now() }],
      ['key3', { count: 3, lastUpdate: Date.now() }]
    ]);

    await storage.setMultiple(entries);

    const result1 = await storage.get('key1');
    const result2 = await storage.get('key2');
    const result3 = await storage.get('key3');

    expect(result1?.count).toBe(1);
    expect(result2?.count).toBe(2);
    expect(result3?.count).toBe(3);
  });

  it('should delete multiple values', async () => {
    await storage.set('key1', { count: 1, lastUpdate: Date.now() });
    await storage.set('key2', { count: 2, lastUpdate: Date.now() });
    await storage.set('key3', { count: 3, lastUpdate: Date.now() });

    await storage.deleteMultiple(['key1', 'key2']);

    const result1 = await storage.get('key1');
    const result2 = await storage.get('key2');
    const result3 = await storage.get('key3');

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(result3).not.toBeNull();
  });

  it('should clear all values', async () => {
    await storage.set('key1', { count: 1, lastUpdate: Date.now() });
    await storage.set('key2', { count: 2, lastUpdate: Date.now() });
    await storage.set('key3', { count: 3, lastUpdate: Date.now() });

    await storage.clear();

    expect(await storage.get('key1')).toBeNull();
    expect(await storage.get('key2')).toBeNull();
    expect(await storage.get('key3')).toBeNull();
  });

  it('should return correct size', async () => {
    expect(storage.size()).toBe(0);

    await storage.set('key1', { count: 1, lastUpdate: Date.now() });
    await storage.set('key2', { count: 2, lastUpdate: Date.now() });

    expect(storage.size()).toBe(2);
  });

  it('should find keys matching pattern', async () => {
    await storage.set('user:1', { count: 1, lastUpdate: Date.now() });
    await storage.set('user:2', { count: 2, lastUpdate: Date.now() });
    await storage.set('session:1', { count: 3, lastUpdate: Date.now() });

    const userKeys = await storage.keys('user:*');

    expect(userKeys).toHaveLength(2);
    expect(userKeys).toContain('user:1');
    expect(userKeys).toContain('user:2');
  });

  it('should return storage statistics', () => {
    const stats = storage.getStats();

    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('keysWithTTL');
    expect(stats).toHaveProperty('prefix');
    expect(stats.prefix).toBe('test');
  });

  it('should update expiration time', async () => {
    const state: RateLimitState = {
      count: 5,
      lastUpdate: Date.now()
    };

    await storage.set('test-key', state, 1000);
    await storage.expire('test-key', 5000);

    // Should still exist after 100ms (original TTL was 100ms)
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await storage.get('test-key');
    expect(result).not.toBeNull();
  });
});

describe('Storage Factory', () => {
  it('should create memory storage', () => {
    const { createStorage } = require('../../src/storage/index.js');
    const storage = createStorage({ type: 'memory' });

    expect(storage).toBeInstanceOf(MemoryStorage);
  });

  it('should throw error for unknown storage type', () => {
    const { createStorage } = require('../../src/storage/index.js');

    expect(() => {
      createStorage({ type: 'unknown' as any });
    }).toThrow();
  });
});
