// @ts-nocheck
/**
 * Sandbox tests
 */

import { describe, it, expect } from '@jest/globals';
import { WASMSandbox, createDefaultSandboxConfig } from '../core/sandbox';

describe('WASM Sandbox', () => {
  describe('constructor', () => {
    it('should create sandbox with default config', () => {
      const sandbox = new WASMSandbox();

      const config = sandbox.getConfig();
      expect(config.memoryLimit).toBe(64);
      expect(config.cpuTimeLimit).toBe(5000);
      expect(config.wallTimeLimit).toBe(10000);
      expect(config.networkAccess).toBe(false);
      expect(config.fsAccess).toBe(false);
    });

    it('should create sandbox with custom config', () => {
      const sandbox = new WASMSandbox({
        memoryLimit: 128,
        cpuTimeLimit: 10000,
        wallTimeLimit: 20000,
        networkAccess: true,
      });

      const config = sandbox.getConfig();
      expect(config.memoryLimit).toBe(128);
      expect(config.cpuTimeLimit).toBe(10000);
      expect(config.wallTimeLimit).toBe(20000);
      expect(config.networkAccess).toBe(true);
    });
  });

  describe('executeJS', () => {
    it('should execute JavaScript code', async () => {
      const sandbox = new WASMSandbox();

      const result = await sandbox.executeJS('return 1 + 1');

      expect(result.success).toBe(true);
      expect(result.data).toBe(2);
    });

    it('should handle async JavaScript code', async () => {
      const sandbox = new WASMSandbox();

      const result = await sandbox.executeJS('return await Promise.resolve(42)');

      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should provide isolated context', async () => {
      const sandbox = new WASMSandbox();

      const result = await sandbox.executeJS('return Math.random()');

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('number');
    });

    it('should handle execution errors', async () => {
      const sandbox = new WASMSandbox();

      const result = await sandbox.executeJS('throw new Error("Test error")');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    it('should enforce timeout', async () => {
      const sandbox = new WASMSandbox({
        wallTimeLimit: 100,
      });

      const result = await sandbox.executeJS('while (true) {}');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 10000);
  });

  describe('statistics', () => {
    it('should track execution statistics', async () => {
      const sandbox = new WASMSandbox();

      await sandbox.executeJS('return 1');
      await sandbox.executeJS('return 2');
      await sandbox.executeJS('throw new Error("fail")');

      const stats = sandbox.getStats();

      expect(stats.totalExecutions).toBe(3);
      expect(stats.successfulExecutions).toBe(2);
      expect(stats.failedExecutions).toBe(1);
    });

    it('should calculate average execution time', async () => {
      const sandbox = new WASMSandbox();

      await sandbox.executeJS('return 1');
      await sandbox.executeJS('return 2');

      const stats = sandbox.getStats();

      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should reset statistics', async () => {
      const sandbox = new WASMSandbox();

      await sandbox.executeJS('return 1');

      sandbox.resetStats();

      const stats = sandbox.getStats();

      expect(stats.totalExecutions).toBe(0);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const sandbox = new WASMSandbox();

      sandbox.updateConfig({
        memoryLimit: 256,
        cpuTimeLimit: 15000,
      });

      const config = sandbox.getConfig();

      expect(config.memoryLimit).toBe(256);
      expect(config.cpuTimeLimit).toBe(15000);
    });
  });

  describe('createDefaultSandboxConfig', () => {
    it('should create config for AI provider', () => {
      const config = createDefaultSandboxConfig('ai_provider', {
        networkAccess: true,
      });

      expect(config.memoryLimit).toBe(128);
      expect(config.cpuTimeLimit).toBe(30000);
      expect(config.networkAccess).toBe(true);
    });

    it('should create config for storage plugin', () => {
      const config = createDefaultSandboxConfig('storage', {
        dbAccess: true,
      });

      expect(config.memoryLimit).toBe(256);
      expect(config.dbAccess).toBe(true);
    });

    it('should create config for webhook plugin', () => {
      const config = createDefaultSandboxConfig('webhook');

      expect(config.memoryLimit).toBe(32);
      expect(config.cpuTimeLimit).toBe(3000);
      expect(config.networkAccess).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup sandbox', async () => {
      const sandbox = new WASMSandbox();

      await sandbox.executeJS('return 1');
      await sandbox.cleanup();

      const stats = sandbox.getStats();

      expect(stats.totalExecutions).toBe(0);
    });
  });
});
