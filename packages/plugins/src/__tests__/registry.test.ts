/**
 * Plugin registry tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PluginRegistry } from '../registry/plugin-registry';
import type { PluginManifest, PluginType } from '../types';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  const createManifest = (id: string, type: PluginType = 'custom'): PluginManifest => ({
    id,
    name: `Plugin ${id}`,
    description: `Test plugin ${id}`,
    version: '1.0.0',
    minPlatformVersion: '1.0.0',
    type,
    author: {
      name: 'Test Author',
    },
    license: 'MIT',
    keywords: ['test'],
    capabilities: {
      sandboxed: false,
      hotReload: false,
      networkAccess: false,
      fsAccess: false,
      dbAccess: false,
      customPermissions: [],
    },
    main: 'index.js',
  });

  describe('registration', () => {
    it('should register a plugin', async () => {
      const manifest = createManifest('test-plugin');

      await registry.register(manifest);

      expect(registry.has('test-plugin')).toBe(true);
      expect(registry.get('test-plugin')).toBeDefined();
    });

    it('should fail to register duplicate plugin', async () => {
      const manifest = createManifest('test-plugin');

      await registry.register(manifest);

      await expect(registry.register(manifest)).rejects.toThrow();
    });

    it('should unregister a plugin', async () => {
      const manifest = createManifest('test-plugin');

      await registry.register(manifest);
      await registry.unregister('test-plugin');

      expect(registry.has('test-plugin')).toBe(false);
    });

    it('should fail to unregister non-existent plugin', async () => {
      await expect(registry.unregister('non-existent')).rejects.toThrow();
    });
  });

  describe('enabling/disabling', () => {
    it('should enable a plugin', async () => {
      const manifest = createManifest('test-plugin');

      await registry.register(manifest);
      await registry.disable('test-plugin');
      await registry.enable('test-plugin');

      const entry = registry.get('test-plugin');
      expect(entry?.enabled).toBe(true);
    });

    it('should disable a plugin', async () => {
      const manifest = createManifest('test-plugin');

      await registry.register(manifest);
      await registry.disable('test-plugin');

      const entry = registry.get('test-plugin');
      expect(entry?.enabled).toBe(false);
    });
  });

  describe('health management', () => {
    it('should update plugin health', async () => {
      const manifest = createManifest('test-plugin');

      await registry.register(manifest);
      await registry.updateHealth('test-plugin', 'healthy');

      const entry = registry.get('test-plugin');
      expect(entry?.health).toBe('healthy');
    });
  });

  describe('querying', () => {
    beforeEach(async () => {
      await registry.register(createManifest('plugin1', 'ai_provider'));
      await registry.register(createManifest('plugin2', 'storage'));
      await registry.register(createManifest('plugin3', 'ai_provider'));

      await registry.disable('plugin2');
      await registry.updateHealth('plugin3', 'unhealthy');
    });

    it('should query all plugins', () => {
      const results = registry.query();

      expect(results.length).toBe(3);
    });

    it('should query by type', () => {
      const results = registry.query({ type: 'ai_provider' });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.manifest.type === 'ai_provider')).toBe(true);
    });

    it('should query by enabled state', () => {
      const results = registry.query({ enabled: true });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.enabled)).toBe(true);
    });

    it('should query by health', () => {
      const results = registry.query({ health: 'healthy' });

      expect(results.length).toBe(1);
    });

    it('should search plugins', () => {
      const results = registry.query({ search: 'plugin1' });

      expect(results.length).toBe(1);
      expect(results[0].manifest.id).toBe('plugin1');
    });

    it('should sort results', () => {
      const results = registry.query({ sortBy: 'name', sortOrder: 'asc' });

      expect(results[0].manifest.id).toBe('plugin1');
      expect(results[2].manifest.id).toBe('plugin3');
    });

    it('should limit results', () => {
      const results = registry.query({ limit: 2 });

      expect(results.length).toBe(2);
    });

    it('should offset results', () => {
      const results = registry.query({ offset: 1 });

      expect(results.length).toBe(2);
    });
  });

  describe('statistics', () => {
    it('should return registry statistics', async () => {
      await registry.register(createManifest('plugin1', 'ai_provider'));
      await registry.register(createManifest('plugin2', 'storage'));
      await registry.disable('plugin2');

      const stats = registry.getStats();

      expect(stats.totalPlugins).toBe(2);
      expect(stats.enabledPlugins).toBe(1);
      expect(stats.disabledPlugins).toBe(1);
      expect(stats.pluginsByType['ai_provider']).toBe(1);
      expect(stats.pluginsByType['storage']).toBe(1);
    });
  });

  describe('dependencies', () => {
    it('should get plugin dependencies', async () => {
      const manifest1 = createManifest('plugin1');
      manifest1.dependencies = [
        { pluginId: 'plugin2', version: '^1.0.0', required: true },
      ];

      const manifest2 = createManifest('plugin2');

      await registry.register(manifest1);
      await registry.register(manifest2);

      const dependencies = registry.getDependencies('plugin1');

      expect(dependencies.length).toBe(1);
      expect(dependencies[0].id).toBe('plugin2');
    });

    it('should get dependent plugins', async () => {
      const manifest1 = createManifest('plugin1');
      manifest1.dependencies = [
        { pluginId: 'plugin3', version: '^1.0.0', required: true },
      ];

      const manifest2 = createManifest('plugin2');
      manifest2.dependencies = [
        { pluginId: 'plugin3', version: '^1.0.0', required: true },
      ];

      const manifest3 = createManifest('plugin3');

      await registry.register(manifest1);
      await registry.register(manifest2);
      await registry.register(manifest3);

      const dependents = registry.getDependents('plugin3');

      expect(dependents.length).toBe(2);
    });

    it('should check dependency conflicts', async () => {
      const manifest = createManifest('plugin1');
      manifest.dependencies = [
        { pluginId: 'missing-plugin', version: '^1.0.0', required: true },
      ];

      await registry.register(manifest);

      const conflicts = registry.checkDependencyConflicts('plugin1');

      expect(conflicts.hasConflicts).toBe(true);
      expect(conflicts.conflicts).toContain('missing-plugin');
    });
  });

  describe('export/import', () => {
    it('should export registry', async () => {
      await registry.register(createManifest('plugin1'));
      await registry.register(createManifest('plugin2'));

      const exported = registry.export();

      expect(Object.keys(exported).length).toBe(2);
      expect(exported['plugin1']).toBeDefined();
      expect(exported['plugin2']).toBeDefined();
    });

    it('should import registry', async () => {
      const data = {
        plugin1: {
          manifest: createManifest('plugin1'),
          registeredAt: new Date(),
          updatedAt: new Date(),
          enabled: true,
          health: 'healthy' as const,
          metadata: {},
        },
      };

      await registry.import(data);

      expect(registry.has('plugin1')).toBe(true);
    });
  });
});
