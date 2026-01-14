/**
 * Tests for enhanced configuration manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedConfigManager } from '../src/config/manager-enhanced';

describe('EnhancedConfigManager', () => {
  let manager: EnhancedConfigManager;

  beforeEach(() => {
    manager = new EnhancedConfigManager({
      versioning: true,
      secretInjection: true,
      cacheEnabled: true,
    });
  });

  afterEach(async () => {
    await manager.dispose();
  });

  describe('basic operations', () => {
    it('should get undefined for non-existent keys', async () => {
      const value = await manager.get('nonexistent');
      expect(value).toBeUndefined();
    });

    it('should set and get values', async () => {
      await manager.set('test.key', 'value');
      const value = await manager.get('test.key');
      expect(value).toBe('value');
    });

    it('should provide default value', async () => {
      const value = await manager.getOrDefault('test.key', 'default');
      expect(value).toBe('default');
    });

    it('should check key existence', async () => {
      expect(await manager.has('test.key')).toBe(false);

      await manager.set('test.key', 'value');
      expect(await manager.has('test.key')).toBe(true);
    });

    it('should delete keys', async () => {
      await manager.set('test.key', 'value');
      expect(await manager.has('test.key')).toBe(true);

      await manager.delete('test.key');
      expect(await manager.has('test.key')).toBe(false);
    });

    it('should get all configuration', async () => {
      await manager.set('key1', 'value1');
      await manager.set('key2', 'value2');

      const all = await manager.getAll();
      expect(all).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });
  });

  describe('versioning', () => {
    it('should track configuration versions', async () => {
      await manager.set('test.key', 'value1');
      await manager.set('test.key', 'value2');

      const versions = await manager.getVersions('test.key');
      expect(versions.length).toBeGreaterThan(0);
    });

    it('should rollback to previous version', async () => {
      await manager.set('test.key', 'value1');
      await manager.set('test.key', 'value2');

      const versions = await manager.getVersions('test.key');
      const previousVersion = versions[0];

      await manager.set('test.key', 'value3');
      expect(await manager.get('test.key')).toBe('value3');

      await manager.rollback('test.key', previousVersion.version);
      expect(await manager.get('test.key')).toBe('value1');
    });

    it('should limit version history', async () => {
      const manager = new EnhancedConfigManager({
        maxVersions: 5,
      });

      for (let i = 0; i < 10; i++) {
        await manager.set('test.key', `value${i}`);
      }

      const versions = await manager.getVersions('test.key');
      expect(versions.length).toBeLessThanOrEqual(5);

      await manager.dispose();
    });
  });

  describe('validation', () => {
    it('should validate values against schema', async () => {
      manager.addSchema('test.key', {
        type: 'number',
        minimum: 0,
        maximum: 100,
      });

      await manager.set('test.key', 50);
      expect(await manager.get('test.key')).toBe(50);

      await expect(
        manager.set('test.key', 150)
      ).rejects.toThrow();
    });

    it('should validate all configuration', async () => {
      manager.addSchema('test.key1', {
        type: 'string',
        minLength: 1,
      });

      manager.addSchema('test.key2', {
        type: 'number',
        minimum: 0,
      });

      await manager.set('test.key1', 'valid');
      await manager.set('test.key2', 100);

      const result = await manager.validateAll();
      expect(result.valid).toBe(true);
    });
  });

  describe('watching', () => {
    it('should notify watchers on change', async () => {
      const callback = vi.fn();
      manager.watch('test.key', callback);

      await manager.set('test.key', 'value1');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalled();
    });

    it('should support immediate notification', async () => {
      await manager.set('test.key', 'value1');

      const callback = vi.fn();
      manager.watch('test.key', callback, true);

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscribing', async () => {
      const callback = vi.fn();
      const unsubscribe = manager.watch('test.key', callback);

      unsubscribe();
      await manager.set('test.key', 'value');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('caching', () => {
    it('should cache values', async () => {
      await manager.set('test.key', 'value');

      const value1 = await manager.get('test.key');
      const value2 = await manager.get('test.key');

      expect(value1).toBe(value2);
    });

    it('should expire cache entries', async () => {
      const manager = new EnhancedConfigManager({
        cacheTTL: 100, // 100ms TTL
      });

      await manager.set('test.key', 'value');
      expect(await manager.get('test.key')).toBe('value');

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(await manager.get('test.key')).toBeUndefined();

      await manager.dispose();
    });
  });

  describe('secret injection', () => {
    it('should inject environment variables', async () => {
      process.env.TEST_VAR = 'test-value';

      await manager.set('test.key', '${env:TEST_VAR}');
      const value = await manager.get('test.key');

      expect(value).toBe('test-value');

      delete process.env.TEST_VAR;
    });

    it('should handle missing environment variables', async () => {
      await manager.set('test.key', '${env:NONEXISTENT}');
      const value = await manager.get('test.key');

      expect(value).toBe('${env:NONEXISTENT}');
    });
  });

  describe('import/export', () => {
    it('should export configuration', async () => {
      await manager.set('key1', 'value1');
      await manager.set('key2', 'value2');

      const exported = await manager.export();

      expect(exported).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });

    it('should import configuration', async () => {
      await manager.import({
        key1: 'value1',
        key2: 'value2',
      });

      expect(await manager.get('key1')).toBe('value1');
      expect(await manager.get('key2')).toBe('value2');
    });

    it('should support overwrite on import', async () => {
      await manager.set('key1', 'old');

      await manager.import(
        { key1: 'new' },
        { overwrite: true }
      );

      expect(await manager.get('key1')).toBe('new');
    });

    it('should skip existing keys without overwrite', async () => {
      await manager.set('key1', 'old');

      await manager.import(
        { key1: 'new' },
        { overwrite: false }
      );

      expect(await manager.get('key1')).toBe('old');
    });
  });

  describe('documentation', () => {
    it('should generate documentation', async () => {
      manager.addSchema('test.key', {
        type: 'string',
        description: 'Test configuration key',
      });

      await manager.set('test.key', 'value', {
        tags: ['important', 'user-config'],
      });

      const docs = await manager.getDocumentation();

      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].key).toBe('test.key');
      expect(docs[0].description).toBe('Test configuration key');
      expect(docs[0].tags).toEqual(['important', 'user-config']);
    });
  });
});
