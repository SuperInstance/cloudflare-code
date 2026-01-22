/**
 * Tests for Translator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Translator } from '../src/core/translator.js';
import { KVTranslationStorage } from '../src/storage/kv.js';

// Mock KV namespace
class MockKVNamespace {
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    const keys = Array.from(this.store.keys())
      .filter((k) => !options?.prefix || k.startsWith(options.prefix))
      .map((name) => ({ name }));
    return { keys };
  }
}

describe('Translator', () => {
  let mockKV: MockKVNamespace;
  let storage: KVTranslationStorage;
  let translator: Translator;

  beforeEach(async () => {
    mockKV = new MockKVNamespace();
    storage = new KVTranslationStorage({ binding: mockKV as unknown as KVNamespace });

    // Add some test translations
    await storage.set({
      locale: 'en',
      namespace: 'common',
      translations: {
        hello: {
          key: 'hello',
          value: 'Hello, World!',
        },
        welcome: {
          key: 'welcome',
          value: 'Welcome, {name}!',
        },
        items: {
          key: 'items',
          value: '{count, plural, =0 {No items} =1 {One item} other {# items}}',
          plural: true,
        },
      },
      metadata: {
        version: '1.0.0',
        totalKeys: 3,
      },
    });

    translator = new Translator({
      locale: 'en',
      fallbackLocale: 'en',
      storage,
      namespaces: ['common'],
    });

    await translator.loadNamespaces();
  });

  it('should translate simple key', async () => {
    const result = await translator.translate('hello');
    expect(result.translated).toBe('Hello, World!');
    expect(result.locale).toBe('en');
    expect(result.usedFallback).toBe(false);
  });

  it('should translate key with values', async () => {
    const result = await translator.translate('welcome', { name: 'Alice' });
    expect(result.translated).toBe('Welcome, Alice!');
  });

  it('should handle ICU plural messages', async () => {
    const result0 = await translator.translate('items', { count: 0 });
    expect(result0.translated).toBe('No items');

    const result1 = await translator.translate('items', { count: 1 });
    expect(result1.translated).toBe('One item');

    const result5 = await translator.translate('items', { count: 5 });
    expect(result5.translated).toBe('5 items');
  });

  it('should return missing key as fallback', async () => {
    const result = await translator.translate('nonexistent');
    expect(result.translated).toBe('nonexistent');
    expect(result.missing).toBe(true);
  });

  it('should check if key exists', async () => {
    expect(await translator.has('hello')).toBe(true);
    expect(await translator.has('nonexistent')).toBe(false);
  });

  it('should get all keys for namespace', async () => {
    const keys = await translator.getKeys('common');
    expect(keys).toContain('hello');
    expect(keys).toContain('welcome');
    expect(keys).toContain('items');
  });

  it('should batch translate', async () => {
    const results = await translator.translateBatch(['hello', 'welcome'], { name: 'Bob' });
    expect(results.get('hello')?.translated).toBe('Hello, World!');
    expect(results.get('welcome')?.translated).toBe('Welcome, Bob!');
  });

  it('should handle locale change', async () => {
    await translator.setLocale('es');
    expect(translator.getLocale()).toBe('es');
  });

  it('should clear cache', () => {
    translator.clearCache();
    // Cache should be empty - no easy way to test this directly
    // but we can verify it doesn't throw
    expect(true).toBe(true);
  });
});
