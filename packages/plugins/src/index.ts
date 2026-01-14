/**
 * ClaudeFlare Plugin System
 *
 * A comprehensive plugin system and extensions framework for ClaudeFlare
 * distributed AI coding platform on Cloudflare Workers.
 *
 * @package @claudeflare/plugins
 * @version 1.0.0
 */

// Core types
export * from './types';

// Core plugin system
export * from './core';

// Hook system
export * from './hooks';

// Plugin loader
export * from './loader';

// Plugin registry
export * from './registry';

// Webhooks
export * from './webhooks';

// API routes
export * from './api';

// Utilities
export * from './utils';

// Examples
export * from './examples';

// Re-export commonly used items
export {
  Plugin,
  type PluginManifest,
  type PluginContext,
  type PluginLoadOptions,
  type PluginLoadResult,
  type PluginState,
  type PluginType,
  PluginState,
  PluginType,
} from './types';

export {
  WASMSandbox,
  createDefaultSandboxConfig,
} from './core';

export {
  PluginRegistry,
  PluginDiscovery,
  type RegistryEntry,
  type RegistryStats,
} from './registry';

export {
  PluginLoader,
  type PluginLoaderConfig,
  type PluginLoaderStats,
} from './loader';

export {
  globalHookRegistry,
  globalHookDispatcher,
  dispatchHook,
  dispatchHookSync,
  type HookContext,
  type HookResult,
} from './hooks';

export {
  globalWebhookHandler,
  WebhookHandler,
  GitHubWebhookHandler,
  GitLabWebhookHandler,
  BitbucketWebhookHandler,
} from './webhooks';

export {
  createLogger,
  loggerFactory,
  createEventEmitter,
  createHttpClient,
  createKVStorageClient,
  createD1StorageClient,
  createMemoryStorageClient,
} from './utils';

export { api } from './api';

/**
 * Create a plugin system instance
 */
import { PluginRegistry } from './registry/plugin-registry';
import { PluginDiscovery } from './registry/discovery';
import { PluginLoader } from './loader/plugin-loader';
import { createLogger, createEventEmitter, createHttpClient, createMemoryStorageClient } from './utils';
import type { PluginId, PluginLogger, EventEmitter, HttpClient, StorageClient } from './types';

export interface PluginSystemConfig {
  pluginsDir?: string;
  enableSandbox?: boolean;
  enableHotReload?: boolean;
  hotReloadInterval?: number;
}

export class PluginSystem {
  public readonly registry: PluginRegistry;
  public readonly discovery: PluginDiscovery;
  public readonly loader: PluginLoader;

  constructor(config: PluginSystemConfig = {}) {
    // Create logger factory
    const createLoggerFor = (pluginId: PluginId): PluginLogger => {
      return createLogger(pluginId);
    };

    // Create event emitter factory
    const createEvents = (): EventEmitter => {
      return createEventEmitter();
    };

    // Create HTTP client factory
    const createHttp = (): HttpClient => {
      return createHttpClient();
    };

    // Create storage client factory
    const createStorage = (): StorageClient => {
      return createMemoryStorageClient();
    };

    // Initialize components
    this.registry = new PluginRegistry();
    this.discovery = new PluginDiscovery(this.registry);
    this.loader = new PluginLoader(
      {
        pluginsDir: config.pluginsDir || './plugins',
        enableSandbox: config.enableSandbox ?? true,
        hotReload: config.hotReload ?? false,
        hotReloadInterval: config.hotReloadInterval ?? 5000,
      },
      createLoggerFor,
      createEvents,
      createHttp,
      createStorage
    );
  }

  /**
   * Initialize the plugin system
   */
  async initialize(): Promise<void> {
    // Start hot reload if enabled
    this.loader.startHotReload();
  }

  /**
   * Shutdown the plugin system
   */
  async shutdown(): Promise<void> {
    await this.loader.cleanup();
    await this.registry.clear();
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      registry: this.registry.getStats(),
      loader: this.loader.getStats(),
    };
  }
}

/**
 * Create a plugin system instance
 */
export function createPluginSystem(config?: PluginSystemConfig): PluginSystem {
  return new PluginSystem(config);
}

// Default export
export default {
  createPluginSystem,
  PluginSystem,
  Plugin,
  PluginRegistry,
  PluginDiscovery,
  PluginLoader,
};
