/**
 * Dynamic Configuration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamicConfigManager } from './dynamic';
import type { AppConfig } from './types';
import { ConfigValidator } from './validation';

describe('DynamicConfigManager', () => {
  let manager: DynamicConfigManager;
  let defaultConfig: AppConfig;

  beforeEach(() => {
    // Create default config
    defaultConfig = {
      version: '1.0.0',
      environment: 'production',
      features: {
        websockets: {
          name: 'websockets',
          enabled: false,
          targeting: {
            users: [],
            percentage: 0,
            organizations: [],
            tier: 'all',
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        codeIndexing: {
          name: 'codeIndexing',
          enabled: false,
          targeting: {
            users: [],
            percentage: 0,
            organizations: [],
            tier: 'all',
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        advancedCache: {
          name: 'advancedCache',
          enabled: false,
          targeting: {
            users: [],
            percentage: 0,
            organizations: [],
            tier: 'all',
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        realTimeCollaboration: {
          name: 'realTimeCollaboration',
          enabled: false,
          targeting: {
            users: [],
            percentage: 0,
            organizations: [],
            tier: 'all',
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        fileUploads: {
          name: 'fileUploads',
          enabled: false,
          targeting: {
            users: [],
            percentage: 0,
            organizations: [],
            tier: 'all',
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      providers: {
        defaultProvider: 'anthropic',
        fallbackChain: ['openai', 'google'],
        modelPreferences: {},
        providerSettings: {},
      },
      rateLimits: {
        free: { rpm: 10, rpd: 100 },
        pro: { rpm: 100, rpd: 1000 },
        enterprise: { rpm: 1000, rpd: 10000 },
      },
      ui: {
        maxMessageLength: 10000,
        enableStreaming: true,
        theme: 'auto',
        features: {
          websockets: false,
          codeIndexing: false,
          advancedCache: false,
          fileUploads: false,
          collaboration: false,
        },
      },
      cache: {
        kv: {
          defaultTTL: 604800,
          compression: true,
          maxSize: 1073741824,
        },
        do: {
          maxEntries: 10000,
          ttl: 3600,
          persistence: true,
        },
      },
      monitoring: {
        metrics: {
          enabled: true,
          samplingRate: 0.1,
          exportInterval: 60000,
          includeMetrics: ['latency', 'throughput'],
        },
        logging: {
          level: 'info',
          structured: true,
          samplingRate: 1.0,
        },
        tracing: {
          enabled: true,
          samplingRate: 0.01,
        },
      },
      security: {
        rateLimiting: {
          enabled: true,
          strategy: 'token-bucket',
          limits: {
            free: { rpm: 10, rpd: 100 },
            pro: { rpm: 100, rpd: 1000 },
            enterprise: { rpm: 1000, rpd: 10000 },
          },
        },
        auth: {
          sessionDuration: 86400,
          maxSessionsPerUser: 5,
          mfaEnabled: false,
          allowedOrigins: ['*'],
        },
        csp: {
          enabled: false,
          policy: '',
        },
      },
    };

    manager = new DynamicConfigManager(defaultConfig);
  });

  describe('Initialization', () => {
    it('should create manager with valid config', () => {
      expect(manager.getConfig()).toBeDefined();
      expect(manager.getCurrentVersion()).toBe(1);
    });

    it('should reject invalid initial config', () => {
      const invalidConfig = { ...defaultConfig, version: 'invalid' };

      expect(() => new DynamicConfigManager(invalidConfig as AppConfig)).toThrow();
    });

    it('should create initial version', () => {
      const versions = manager.getVersions();
      expect(versions).toHaveLength(1);
      expect(versions[0].description).toBe('Initial configuration');
    });
  });

  describe('Get Configuration', () => {
    it('should return full config', () => {
      const config = manager.getConfig();
      expect(config.version).toBe('1.0.0');
      expect(config.environment).toBe('production');
    });

    it('should get value by path', () => {
      const value = manager.getValue('version');
      expect(value).toBe('1.0.0');
    });

    it('should get nested value by path', () => {
      const value = manager.getValue('ui.maxMessageLength');
      expect(value).toBe(10000);
    });

    it('should return undefined for invalid path', () => {
      const value = manager.getValue('invalid.path');
      expect(value).toBeUndefined();
    });

    it('should get feature flag', () => {
      const flag = manager.getValue('features.websockets');
      expect(flag).toBeDefined();
      expect((flag as any).enabled).toBe(false);
    });
  });

  describe('Set Configuration Value', () => {
    it('should set simple value', async () => {
      const result = await manager.setValue('version', '1.1.0', 'test-user');

      expect(result.valid).toBe(true);
      expect(manager.getValue('version')).toBe('1.1.0');
    });

    it('should set nested value', async () => {
      const result = await manager.setValue(
        'ui.maxMessageLength',
        20000,
        'test-user'
      );

      expect(result.valid).toBe(true);
      expect(manager.getValue('ui.maxMessageLength')).toBe(20000);
    });

    it('should create version on update', async () => {
      const initialVersion = manager.getCurrentVersion();
      await manager.setValue('version', '1.1.0', 'test-user');

      expect(manager.getCurrentVersion()).toBe(initialVersion + 1);
    });

    it('should reject invalid update', async () => {
      const result = await manager.setValue(
        'ui.maxMessageLength',
        'invalid' as unknown as number,
        'test-user'
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject unchanged value', async () => {
      const result = await manager.setValue('version', '1.0.0', 'test-user');

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Value unchanged, no update needed');
    });

    it('should record change in history', async () => {
      await manager.setValue('version', '1.1.0', 'test-user', 'Upgrade version');

      const history = manager.getHistory();
      const change = history[0];

      expect(change.type).toBe('update');
      expect(change.path).toBe('version');
      expect(change.author).toBe('test-user');
      expect(change.reason).toBe('Upgrade version');
    });
  });

  describe('Batch Updates', () => {
    it('should update multiple values', async () => {
      const result = await manager.updateValues(
        [
          { path: 'version', value: '1.1.0' },
          { path: 'environment', value: 'staging' },
        ],
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(manager.getValue('version')).toBe('1.1.0');
      expect(manager.getValue('environment')).toBe('staging');
    });

    it('should validate all updates before applying', async () => {
      const result = await manager.updateValues(
        [
          { path: 'version', value: '1.1.0' },
          { path: 'ui.maxMessageLength', value: 'invalid' as unknown as number },
        ],
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.results.some((r) => !r.valid)).toBe(true);
    });

    it('should not apply any updates if validation fails', async () => {
      const initialVersion = manager.getValue('version');

      await manager.updateValues(
        [
          { path: 'version', value: '1.1.0' },
          { path: 'ui.maxMessageLength', value: 'invalid' as unknown as number },
        ],
        'test-user'
      );

      expect(manager.getValue('version')).toBe(initialVersion);
    });
  });

  describe('Merge Configuration', () => {
    it('should merge partial config', async () => {
      const result = await manager.mergeConfig(
        {
          version: '1.1.0',
          ui: {
            ...defaultConfig.ui,
            theme: 'dark',
          },
        },
        'test-user'
      );

      expect(result.valid).toBe(true);
      expect(manager.getValue('version')).toBe('1.1.0');
      expect(manager.getValue('ui.theme')).toBe('dark');
    });

    it('should preserve unchanged values', async () => {
      const initialLength = manager.getValue('ui.maxMessageLength');

      await manager.mergeConfig({ version: '1.1.0' }, 'test-user');

      expect(manager.getValue('ui.maxMessageLength')).toBe(initialLength);
    });

    it('should reject invalid merge', async () => {
      const result = await manager.mergeConfig(
        { version: 'invalid-version' },
        'test-user'
      );

      expect(result.valid).toBe(false);
    });
  });

  describe('Rollback', () => {
    it('should rollback to previous version', async () => {
      // Make a change
      await manager.setValue('version', '1.1.0', 'test-user');
      const targetVersion = manager.getCurrentVersion() - 1;

      // Rollback
      const result = await manager.rollback(targetVersion, 'test-user');

      expect(result.valid).toBe(true);
      expect(manager.getValue('version')).toBe('1.0.0');
    });

    it('should reject rollback to current version', async () => {
      const currentVersion = manager.getCurrentVersion();
      const result = await manager.rollback(currentVersion, 'test-user');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject rollback to future version', async () => {
      const result = await manager.rollback(999, 'test-user');

      expect(result.valid).toBe(false);
    });

    it('should reject rollback to negative version', async () => {
      const result = await manager.rollback(-1, 'test-user');

      expect(result.valid).toBe(false);
    });

    it('should create version for rollback', async () => {
      await manager.setValue('version', '1.1.0', 'test-user');
      const targetVersion = manager.getCurrentVersion() - 1;
      const versionBeforeRollback = manager.getCurrentVersion();

      await manager.rollback(targetVersion, 'test-user');

      expect(manager.getCurrentVersion()).toBe(versionBeforeRollback + 1);
    });
  });

  describe('Subscriptions', () => {
    it('should notify subscribers on change', async () => {
      const subscriber = vi.fn();
      manager.subscribe('test-sub', subscriber);

      await manager.setValue('version', '1.1.0', 'test-user');

      expect(subscriber).toHaveBeenCalledTimes(1);

      const event = subscriber.mock.calls[0][0] as any;
      expect(event.change.path).toBe('version');
      expect(event.version).toBeGreaterThan(0);
    });

    it('should unsubscribe from changes', async () => {
      const subscriber = vi.fn();
      const unsubscribe = manager.subscribe('test-sub', subscriber);

      unsubscribe();
      await manager.setValue('version', '1.1.0', 'test-user');

      expect(subscriber).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribers', async () => {
      const sub1 = vi.fn();
      const sub2 = vi.fn();

      manager.subscribe('sub1', sub1);
      manager.subscribe('sub2', sub2);

      await manager.setValue('version', '1.1.0', 'test-user');

      expect(sub1).toHaveBeenCalledTimes(1);
      expect(sub2).toHaveBeenCalledTimes(1);
    });

    it('should handle subscriber errors gracefully', async () => {
      const errorSub = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalSub = vi.fn();

      manager.subscribe('error-sub', errorSub);
      manager.subscribe('normal-sub', normalSub);

      // Should not throw
      await manager.setValue('version', '1.1.0', 'test-user');

      expect(normalSub).toHaveBeenCalledTimes(1);
    });
  });

  describe('History and Versions', () => {
    it('should track change history', async () => {
      await manager.setValue('version', '1.1.0', 'test-user');
      await manager.setValue('environment', 'staging', 'test-user');

      const history = manager.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('should limit history', async () => {
      for (let i = 0; i < 10; i++) {
        await manager.setValue('version', `1.${i}.0`, 'test-user');
      }

      const limitedHistory = manager.getHistory(5);
      expect(limitedHistory.length).toBe(5);
    });

    it('should return all versions', async () => {
      await manager.setValue('version', '1.1.0', 'test-user');

      const versions = manager.getVersions();
      expect(versions.length).toBeGreaterThanOrEqual(2);
    });

    it('should get specific version', async () => {
      const versions = manager.getVersions();
      const version = manager.getVersion(versions[0].version);

      expect(version).toBeDefined();
      expect(version?.version).toBe(versions[0].version);
    });
  });

  describe('Import/Export', () => {
    it('should export configuration', () => {
      const exported = manager.export();

      expect(exported.config).toBeDefined();
      expect(exported.version).toBeGreaterThan(0);
      expect(exported.timestamp).toBeGreaterThan(0);
    });

    it('should import configuration', async () => {
      const exported = manager.export();
      exported.config.version = '2.0.0';

      const result = await manager.import(exported, 'test-user');

      expect(result.valid).toBe(true);
      expect(manager.getValue('version')).toBe('2.0.0');
    });

    it('should reject invalid import', async () => {
      const invalidData = {
        config: { ...defaultConfig, version: 'invalid' },
      };

      const result = await manager.import(invalidData, 'test-user');

      expect(result.valid).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return accurate stats', () => {
      const stats = manager.getStats();

      expect(stats.version).toBeGreaterThan(0);
      expect(stats.totalChanges).toBe(0);
      expect(stats.totalVersions).toBe(1);
      expect(stats.subscriberCount).toBe(0);
    });

    it('should track changes in stats', async () => {
      await manager.setValue('version', '1.1.0', 'test-user');

      const stats = manager.getStats();
      expect(stats.totalChanges).toBe(1);
      expect(stats.totalVersions).toBe(2);
    });

    it('should track subscribers in stats', () => {
      manager.subscribe('sub1', () => {});
      manager.subscribe('sub2', () => {});

      const stats = manager.getStats();
      expect(stats.subscriberCount).toBe(2);
    });
  });

  describe('Validation Control', () => {
    it('should disable validation', async () => {
      manager.setValidationEnabled(false);

      const result = await manager.setValue(
        'ui.maxMessageLength',
        'invalid' as unknown as number,
        'test-user'
      );

      expect(result.valid).toBe(true);
    });

    it('should re-enable validation', async () => {
      manager.setValidationEnabled(false);
      manager.setValidationEnabled(true);

      const result = await manager.setValue(
        'ui.maxMessageLength',
        'invalid' as unknown as number,
        'test-user'
      );

      expect(result.valid).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should reset to defaults', async () => {
      await manager.setValue('features.websockets.enabled', true, 'test-user');

      const result = await manager.reset('test-user');

      expect(result.valid).toBe(true);
      expect(manager.getValue('features.websockets.enabled')).toBe(false);
    });
  });
});
