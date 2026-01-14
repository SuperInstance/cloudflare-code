/**
 * Plugin lifecycle tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Plugin, PluginState } from '../core/plugin';
import type { PluginManifest, PluginContext, SecurityContext } from '../types';

// Test plugin implementation
class TestPlugin extends Plugin {
  public readonly manifest: PluginManifest = {
    id: 'test-plugin',
    name: 'Test Plugin',
    description: 'A test plugin',
    version: '1.0.0',
    minPlatformVersion: '1.0.0',
    type: 'custom',
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
  };

  private onLoadCalled = false;
  private onActivateCalled = false;
  private onDeactivateCalled = false;
  private onUnloadCalled = false;

  protected async onLoad(): Promise<void> {
    this.onLoadCalled = true;
  }

  protected async onActivate(): Promise<void> {
    this.onActivateCalled = true;
  }

  protected async onDeactivate(): Promise<void> {
    this.onDeactivateCalled = true;
  }

  protected async onUnload(): Promise<void> {
    this.onUnloadCalled = true;
  }

  protected async onExecute(input: unknown, _securityContext?: SecurityContext): Promise<unknown> {
    return { input, result: 'success' };
  }

  // Test helpers
  wasOnLoadCalled(): boolean {
    return this.onLoadCalled;
  }

  wasOnActivateCalled(): boolean {
    return this.onActivateCalled;
  }

  wasOnDeactivateCalled(): boolean {
    return this.onDeactivateCalled;
  }

  wasOnUnloadCalled(): boolean {
    return this.onUnloadCalled;
  }
}

describe('Plugin', () => {
  let plugin: TestPlugin;
  let context: PluginContext;

  beforeEach(() => {
    plugin = new TestPlugin();
    context = {
      pluginId: 'test-plugin',
      version: '1.0.0',
      baseDir: '/plugins/test-plugin',
      config: {},
      secrets: {},
      env: {},
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      },
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        once: jest.fn(),
      },
      http: {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        request: jest.fn(),
      },
      storage: {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
        list: jest.fn(),
        clear: jest.fn(),
      },
    };
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await plugin.initialize(context);

      expect(plugin.getState()).toBe(PluginState.LOADED);
      expect(plugin.wasOnLoadCalled()).toBe(true);
    });

    it('should fail to initialize if not in UNLOADED state', async () => {
      await plugin.initialize(context);

      await expect(plugin.initialize(context)).rejects.toThrow();
    });
  });

  describe('activation', () => {
    it('should activate successfully', async () => {
      await plugin.initialize(context);
      await plugin.activate();

      expect(plugin.getState()).toBe(PluginState.ACTIVE);
      expect(plugin.wasOnActivateCalled()).toBe(true);
    });

    it('should fail to activate if not loaded', async () => {
      await expect(plugin.activate()).rejects.toThrow();
    });
  });

  describe('deactivation', () => {
    it('should deactivate successfully', async () => {
      await plugin.initialize(context);
      await plugin.activate();
      await plugin.deactivate();

      expect(plugin.getState()).toBe(PluginState.INACTIVE);
      expect(plugin.wasOnDeactivateCalled()).toBe(true);
    });

    it('should fail to deactivate if not active', async () => {
      await plugin.initialize(context);

      await expect(plugin.deactivate()).rejects.toThrow();
    });
  });

  describe('execution', () => {
    it('should execute successfully', async () => {
      await plugin.initialize(context);
      await plugin.activate();

      const result = await plugin.execute({ test: 'data' });

      expect(result).toEqual({ input: { test: 'data' }, result: 'success' });
      expect(plugin.getMetrics().executionCount).toBe(1);
    });

    it('should fail to execute if not active', async () => {
      await plugin.initialize(context);

      await expect(plugin.execute({})).rejects.toThrow();
    });
  });

  describe('unloading', () => {
    it('should unload successfully', async () => {
      await plugin.initialize(context);
      await plugin.activate();
      await plugin.unload();

      expect(plugin.getState()).toBe(PluginState.UNLOADED);
      expect(plugin.wasOnUnloadCalled()).toBe(true);
    });

    it('should deactivate before unloading if active', async () => {
      await plugin.initialize(context);
      await plugin.activate();
      await plugin.unload();

      expect(plugin.wasOnDeactivateCalled()).toBe(true);
    });
  });

  describe('health check', () => {
    it('should return healthy status when active', async () => {
      await plugin.initialize(context);
      await plugin.activate();

      const health = await plugin.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.state).toBe(PluginState.ACTIVE);
    });

    it('should return unhealthy status with errors', async () => {
      await plugin.initialize(context);

      // Force an error
      plugin['recordError'](new Error('Test error'));

      const health = await plugin.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.errors.length).toBeGreaterThan(0);
    });
  });

  describe('metrics', () => {
    it('should track execution count', async () => {
      await plugin.initialize(context);
      await plugin.activate();

      await plugin.execute({});
      await plugin.execute({});
      await plugin.execute({});

      expect(plugin.getMetrics().executionCount).toBe(3);
    });

    it('should track error count', async () => {
      await plugin.initialize(context);

      plugin['recordError'](new Error('Error 1'));
      plugin['recordError'](new Error('Error 2'));

      expect(plugin.getMetrics().errorCount).toBe(2);
    });
  });

  describe('configuration', () => {
    it('should get configuration', async () => {
      context.config = { apiKey: 'test-key' };
      await plugin.initialize(context);

      const config = plugin.getConfig();

      expect(config).toEqual({ apiKey: 'test-key' });
    });

    it('should update configuration', async () => {
      await plugin.initialize(context);
      await plugin.activate();

      await plugin.updateConfig({ newSetting: 'value' });

      expect(plugin.getConfig()).toHaveProperty('newSetting', 'value');
    });
  });

  describe('info', () => {
    it('should return plugin info', async () => {
      await plugin.initialize(context);

      const info = plugin.getInfo();

      expect(info.id).toBe('test-plugin');
      expect(info.name).toBe('Test Plugin');
      expect(info.version).toBe('1.0.0');
      expect(info.type).toBe('custom');
      expect(info.state).toBe(PluginState.LOADED);
    });
  });
});
