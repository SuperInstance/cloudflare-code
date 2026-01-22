// @ts-nocheck
/**
 * Plugin loader - handles loading, initialization, and hot-reload of plugins
 */

import type {
  PluginManifest,
  PluginContext,
  PluginLoadOptions,
  PluginLoadResult,
  PluginState,
  PluginId,
  PluginLogger,
  EventEmitter,
  HttpClient,
  StorageClient,
} from '../types';
import { Plugin } from '../core/plugin';
import {
  PluginNotFoundError,
  PluginLoadError,
  PluginValidationError,
  PluginDependencyError,
  HotReloadError,
} from '../types/errors';
import { WASMSandbox } from '../core/sandbox';

/**
 * Plugin loader configuration
 */
export interface PluginLoaderConfig {
  /**
   * Base directory for plugins
   */
  pluginsDir: string;

  /**
   * Enable hot reload
   */
  hotReload?: boolean;

  /**
   * Hot reload polling interval (ms)
   */
  hotReloadInterval?: number;

  /**
   * Maximum concurrent plugin loads
   */
  maxConcurrentLoads?: number;

  /**
   * Plugin load timeout (ms)
   */
  loadTimeout?: number;

  /**
   * Enable WASM sandbox
   */
  enableSandbox?: boolean;

  /**
   * Default sandbox configuration
   */
  sandboxConfig?: Partial<{
    memoryLimit: number;
    cpuTimeLimit: number;
    wallTimeLimit: number;
    networkAccess: boolean;
    fsAccess: boolean;
  }>;
}

/**
 * Loaded plugin entry
 */
interface LoadedPlugin {
  manifest: PluginManifest;
  plugin: Plugin;
  context: PluginContext;
  sandbox?: WASMSandbox;
  loadedAt: Date;
  lastModified?: Date;
  watcher?: FileSystemWatcher;
}

/**
 * File system watcher interface
 */
interface FileSystemWatcher {
  close(): void;
  on(event: string, handler: () => void): void;
}

/**
 * Plugin loader class
 */
export class PluginLoader {
  private plugins: Map<PluginId, LoadedPlugin> = new Map();
  private loadingQueue: Set<PluginId> = new Set();
  private hotReloadWatchers: Map<PluginId, FileSystemWatcher> = new Map();
  private hotReloadTimer?: ReturnType<typeof setInterval>;

  constructor(
    private config: PluginLoaderConfig,
    private createLogger: () => PluginLogger,
    private createEvents: () => EventEmitter,
    private createHttp: () => HttpClient,
    private createStorage: () => StorageClient
  ) {}

  /**
   * Load a plugin
   */
  async load(
    pluginId: PluginId,
    options: PluginLoadOptions = {}
  ): Promise<PluginLoadResult> {
    const startTime = Date.now();

    // Check if already loading
    if (this.loadingQueue.has(pluginId)) {
      return {
        success: false,
        error: `Plugin ${pluginId} is already being loaded`,
        loadTime: Date.now() - startTime,
      };
    }

    // Check if already loaded
    if (this.plugins.has(pluginId)) {
      const existing = this.plugins.get(pluginId)!;
      if (options.autoActivate && existing.plugin.getState() === 'loaded') {
        await existing.plugin.activate();
      }
      return {
        success: true,
        plugin: existing.plugin,
        loadTime: Date.now() - startTime,
      };
    }

    this.loadingQueue.add(pluginId);

    try {
      // Load manifest
      const manifest = await this.loadManifest(pluginId);
      if (!manifest) {
        throw new PluginNotFoundError(pluginId);
      }

      // Validate manifest
      await this.validateManifest(manifest);

      // Check dependencies
      await this.checkDependencies(manifest);

      // Create plugin context
      const context = await this.createContext(manifest, options);

      // Load plugin module
      const plugin = await this.loadPluginModule(manifest);

      // Initialize plugin
      await plugin.initialize(context);

      // Setup sandbox if enabled
      let sandbox: WASMSandbox | undefined;
      if (this.config.enableSandbox && manifest.capabilities.sandboxed) {
        sandbox = await this.setupSandbox(manifest, context);
      }

      // Activate if requested
      if (options.autoActivate) {
        await plugin.activate();
      }

      // Store loaded plugin
      const loadedPlugin: LoadedPlugin = {
        manifest,
        plugin,
        context,
        sandbox,
        loadedAt: new Date(),
      };

      this.plugins.set(pluginId, loadedPlugin);

      // Setup hot reload if enabled
      if (this.config.hotReload && manifest.capabilities.hotReload) {
        await this.setupHotReload(pluginId, loadedPlugin);
      }

      return {
        success: true,
        plugin,
        loadTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        loadTime: Date.now() - startTime,
      };
    } finally {
      this.loadingQueue.delete(pluginId);
    }
  }

  /**
   * Load multiple plugins
   */
  async loadMany(
    pluginIds: PluginId[],
    options: PluginLoadOptions = {}
  ): Promise<Map<PluginId, PluginLoadResult>> {
    const results = new Map<PluginId, PluginLoadResult>();
    const maxConcurrent = this.config.maxConcurrentLoads || 5;

    // Process in batches
    for (let i = 0; i < pluginIds.length; i += maxConcurrent) {
      const batch = pluginIds.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((id) => this.load(id, options))
      );

      batch.forEach((result, index) => {
        results.set(batch[index], result);
      });
    }

    return results;
  }

  /**
   * Unload a plugin
   */
  async unload(pluginId: PluginId): Promise<void> {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) {
      throw new PluginNotFoundError(pluginId);
    }

    // Stop hot reload watcher
    const watcher = this.hotReloadWatchers.get(pluginId);
    if (watcher) {
      watcher.close();
      this.hotReloadWatchers.delete(pluginId);
    }

    // Unload plugin
    await loaded.plugin.unload();

    // Cleanup sandbox
    if (loaded.sandbox) {
      await loaded.sandbox.cleanup();
    }

    // Remove from registry
    this.plugins.delete(pluginId);
  }

  /**
   * Reload a plugin (hot reload)
   */
  async reload(pluginId: PluginId): Promise<void> {
    const loaded = this.plugins.get(pluginId);
    if (!loaded) {
      throw new PluginNotFoundError(pluginId);
    }

    if (!loaded.manifest.capabilities.hotReload) {
      throw new HotReloadError(
        pluginId,
        `Plugin ${pluginId} does not support hot reload`
      );
    }

    const wasActive = loaded.plugin.getState() === 'active';

    // Unload
    await this.unload(pluginId);

    // Reload
    const result = await this.load(pluginId, {
      autoActivate: wasActive,
      sandboxed: loaded.manifest.capabilities.sandboxed,
      hotReload: true,
    });

    if (!result.success) {
      throw new HotReloadError(
        pluginId,
        `Failed to reload plugin: ${result.error}`
      );
    }
  }

  /**
   * Get loaded plugin
   */
  getPlugin(pluginId: PluginId): Plugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).map((p) => p.plugin);
  }

  /**
   * Get plugin manifest
   */
  getManifest(pluginId: PluginId): PluginManifest | undefined {
    return this.plugins.get(pluginId)?.manifest;
  }

  /**
   * Check if plugin is loaded
   */
  isLoaded(pluginId: PluginId): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Get plugin state
   */
  getPluginState(pluginId: PluginId): PluginState | undefined {
    return this.plugins.get(pluginId)?.plugin.getState();
  }

  /**
   * Load plugin manifest
   */
  private async loadManifest(pluginId: PluginId): Promise<PluginManifest | null> {
    try {
      const manifestPath = `${this.config.pluginsDir}/${pluginId}/manifest.json`;
      // In a real implementation, this would read from the file system
      // For now, return null to indicate not found
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate plugin manifest
   */
  private async validateManifest(manifest: PluginManifest): Promise<void> {
    const errors: string[] = [];

    // Required fields
    if (!manifest.id) errors.push('Plugin ID is required');
    if (!manifest.name) errors.push('Plugin name is required');
    if (!manifest.version) errors.push('Plugin version is required');
    if (!manifest.type) errors.push('Plugin type is required');
    if (!manifest.author) errors.push('Plugin author is required');
    if (!manifest.license) errors.push('Plugin license is required');
    if (!manifest.main) errors.push('Plugin main entry point is required');

    // Validate version format
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
    if (manifest.version && !versionRegex.test(manifest.version)) {
      errors.push('Invalid version format (should be semver)');
    }

    if (errors.length > 0) {
      throw new PluginValidationError(
        manifest.id,
        'Plugin manifest validation failed',
        errors
      );
    }
  }

  /**
   * Check plugin dependencies
   */
  private async checkDependencies(manifest: PluginManifest): Promise<void> {
    if (!manifest.dependencies || manifest.dependencies.length === 0) {
      return;
    }

    const missing: string[] = [];
    const versionMismatches: string[] = [];

    for (const dep of manifest.dependencies) {
      const loaded = this.plugins.get(dep.pluginId);

      if (!loaded) {
        if (dep.required) {
          missing.push(dep.pluginId);
        }
      } else {
        // Check version compatibility
        // This would implement semver range checking
        // For now, just check that dependency exists
      }
    }

    if (missing.length > 0) {
      throw new PluginDependencyError(
        manifest.id,
        `Missing required dependencies: ${missing.join(', ')}`,
        missing
      );
    }
  }

  /**
   * Create plugin context
   */
  private async createContext(
    manifest: PluginManifest,
    options: PluginLoadOptions
  ): Promise<PluginContext> {
    return {
      pluginId: manifest.id,
      version: manifest.version,
      baseDir: `${this.config.pluginsDir}/${manifest.id}`,
      config: { ...manifest.configSchema, ...options.config },
      secrets: { ...options.secrets },
      env: { ...manifest.envVars, ...options.env },
      logger: this.createLogger(),
      events: this.createEvents(),
      http: this.createHttp(),
      storage: this.createStorage(),
    };
  }

  /**
   * Load plugin module
   */
  private async loadPluginModule(manifest: PluginManifest): Promise<Plugin> {
    try {
      // In a real implementation, this would dynamically import the plugin module
      // For now, create a mock plugin
      const modulePath = `${this.config.pluginsDir}/${manifest.id}/${manifest.main}`;

      // This would be something like:
      // const module = await import(modulePath);
      // return new module.default();

      throw new PluginLoadError(
        manifest.id,
        `Failed to load plugin module from ${modulePath}`
      );
    } catch (error) {
      throw new PluginLoadError(
        manifest.id,
        `Failed to load plugin: ${(error as Error).message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Setup WASM sandbox
   */
  private async setupSandbox(
    manifest: PluginManifest,
    context: PluginContext
  ): Promise<WASMSandbox> {
    const sandbox = new WASMSandbox(this.config.sandboxConfig || {});

    // Load WASM module if available
    const wasmPath = `${context.baseDir}/plugin.wasm`;
    // In a real implementation, this would load the WASM file
    // await sandbox.loadModule(wasmBytes);

    return sandbox;
  }

  /**
   * Setup hot reload for a plugin
   */
  private async setupHotReload(
    pluginId: PluginId,
    loadedPlugin: LoadedPlugin
  ): Promise<void> {
    // In a real implementation, this would setup file system watchers
    // For now, we'll use polling if hot reload is enabled
    if (!this.hotReloadTimer) {
      this.hotReloadTimer = setInterval(
        () => this.checkForUpdates(),
        this.config.hotReloadInterval || 5000
      );
    }
  }

  /**
   * Check for plugin updates (for hot reload)
   */
  private async checkForUpdates(): Promise<void> {
    for (const [pluginId, loaded] of this.plugins) {
      if (!loaded.manifest.capabilities.hotReload) {
        continue;
      }

      try {
        // Check if files have been modified
        const manifestPath = `${this.config.pluginsDir}/${pluginId}/manifest.json`;
        // In a real implementation, this would check file modification times
        // const stats = await fs.stat(manifestPath);
        // if (stats.mtime > loaded.lastModified) {
        //   await this.reload(pluginId);
        // }
      } catch (error) {
        console.error(`Error checking for updates for plugin ${pluginId}:`, error);
      }
    }
  }

  /**
   * Start hot reload monitoring
   */
  startHotReload(): void {
    if (this.config.hotReload && !this.hotReloadTimer) {
      this.hotReloadTimer = setInterval(
        () => this.checkForUpdates(),
        this.config.hotReloadInterval || 5000
      );
    }
  }

  /**
   * Stop hot reload monitoring
   */
  stopHotReload(): void {
    if (this.hotReloadTimer) {
      clearInterval(this.hotReloadTimer);
      this.hotReloadTimer = undefined;
    }
  }

  /**
   * Cleanup all plugins
   */
  async cleanup(): Promise<void> {
    this.stopHotReload();

    // Unload all plugins
    const pluginIds = Array.from(this.plugins.keys());
    await Promise.all(pluginIds.map((id) => this.unload(id).catch(() => {})));

    // Close watchers
    for (const watcher of this.hotReloadWatchers.values()) {
      watcher.close();
    }
    this.hotReloadWatchers.clear();
  }

  /**
   * Get loader statistics
   */
  getStats(): PluginLoaderStats {
    const plugins = Array.from(this.plugins.values());

    return {
      totalPlugins: plugins.length,
      activePlugins: plugins.filter((p) => p.plugin.getState() === 'active').length,
      inactivePlugins: plugins.filter((p) => p.plugin.getState() === 'inactive').length,
      errorPlugins: plugins.filter((p) => p.plugin.getState() === 'error').length,
      loadingPlugins: this.loadingQueue.size,
      hotReloadEnabled: this.config.hotReload || false,
      hotReloadWatchers: this.hotReloadWatchers.size,
    };
  }
}

/**
 * Plugin loader statistics
 */
export interface PluginLoaderStats {
  totalPlugins: number;
  activePlugins: number;
  inactivePlugins: number;
  errorPlugins: number;
  loadingPlugins: number;
  hotReloadEnabled: boolean;
  hotReloadWatchers: number;
}
