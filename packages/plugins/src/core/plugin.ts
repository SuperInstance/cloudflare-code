/**
 * Core Plugin base class and lifecycle management
 */

import type {
  PluginManifest,
  PluginContext,
  PluginState,
  PluginCapabilities,
  PluginLogger,
  EventEmitter,
  HttpClient,
  StorageClient,
  HookHandler,
  SecurityContext,
} from '../types';

/**
 * Abstract base class for all plugins
 */
export abstract class Plugin {
  /**
   * Plugin manifest (must be defined by subclass)
   */
  public abstract readonly manifest: PluginManifest;

  /**
   * Current plugin state
   */
  protected state: PluginState = PluginState.UNLOADED;

  /**
   * Plugin context
   */
  protected context?: PluginContext;

  /**
   * Hook handlers registered by this plugin
   */
  protected hookHandlers: Map<string, HookHandler> = new Map();

  /**
   * Error history
   */
  protected errors: Error[] = [];

  /**
   * Metrics
   */
  protected metrics: PluginMetrics = {
    loadTime: 0,
    activateTime: 0,
    deactivateTime: 0,
    executionCount: 0,
    errorCount: 0,
    lastExecution: null,
    lastError: null,
  };

  /**
   * Get current plugin state
   */
  getState(): PluginState {
    return this.state;
  }

  /**
   * Get plugin ID
   */
  getId(): string {
    return this.manifest.id;
  }

  /**
   * Get plugin version
   */
  getVersion(): string {
    return this.manifest.version;
  }

  /**
   * Get plugin type
   */
  getType(): string {
    return this.manifest.type;
  }

  /**
   * Get plugin capabilities
   */
  getCapabilities(): PluginCapabilities {
    return this.manifest.capabilities;
  }

  /**
   * Get plugin metrics
   */
  getMetrics(): PluginMetrics {
    return { ...this.metrics };
  }

  /**
   * Get error history
   */
  getErrors(): Error[] {
    return [...this.errors];
  }

  /**
   * Clear error history
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Initialize plugin with context
   */
  async initialize(context: PluginContext): Promise<void> {
    if (this.state !== PluginState.UNLOADED) {
      throw new Error(`Plugin ${this.getId()} is not in UNLOADED state`);
    }

    this.context = context;
    this.state = PluginState.LOADING;

    try {
      await this.onLoad();
      this.state = PluginState.LOADED;
      this.recordSuccess('initialize');
    } catch (error) {
      this.state = PluginState.ERROR;
      this.recordError(error as Error);
      throw error;
    }
  }

  /**
   * Activate plugin
   */
  async activate(): Promise<void> {
    if (this.state !== PluginState.LOADED && this.state !== PluginState.INACTIVE) {
      throw new Error(`Plugin ${this.getId()} is not in LOADED or INACTIVE state`);
    }

    this.state = PluginState.ACTIVATING;

    try {
      await this.onActivate();
      this.state = PluginState.ACTIVE;
      this.recordSuccess('activate');
    } catch (error) {
      this.state = PluginState.ERROR;
      this.recordError(error as Error);
      throw error;
    }
  }

  /**
   * Deactivate plugin
   */
  async deactivate(): Promise<void> {
    if (this.state !== PluginState.ACTIVE) {
      throw new Error(`Plugin ${this.getId()} is not in ACTIVE state`);
    }

    this.state = PluginState.DEACTIVATING;

    try {
      await this.onDeactivate();
      this.state = PluginState.INACTIVE;
      this.recordSuccess('deactivate');
    } catch (error) {
      this.state = PluginState.ERROR;
      this.recordError(error as Error);
      throw error;
    }
  }

  /**
   * Unload plugin
   */
  async unload(): Promise<void> {
    if (this.state === PluginState.UNLOADED || this.state === PluginState.UNLOADING) {
      return;
    }

    // Deactivate if active
    if (this.state === PluginState.ACTIVE) {
      await this.deactivate();
    }

    this.state = PluginState.UNLOADING;

    try {
      await this.onUnload();
      this.state = PluginState.UNLOADED;
      this.context = undefined;
      this.hookHandlers.clear();
      this.recordSuccess('unload');
    } catch (error) {
      this.state = PluginState.ERROR;
      this.recordError(error as Error);
      throw error;
    }
  }

  /**
   * Reload plugin (hot reload)
   */
  async reload(): Promise<void> {
    if (!this.manifest.capabilities.hotReload) {
      throw new Error(`Plugin ${this.getId()} does not support hot reload`);
    }

    const wasActive = this.state === PluginState.ACTIVE;

    await this.unload();

    // Re-initialize would be handled by the plugin loader
    // This is just the lifecycle hook
    await this.onReload();

    if (wasActive && this.context) {
      await this.initialize(this.context);
      await this.activate();
    }

    this.recordSuccess('reload');
  }

  /**
   * Execute plugin logic
   */
  async execute(input: unknown, securityContext?: SecurityContext): Promise<unknown> {
    if (this.state !== PluginState.ACTIVE) {
      throw new Error(`Plugin ${this.getId()} is not active`);
    }

    this.metrics.executionCount++;
    this.metrics.lastExecution = new Date();

    try {
      const result = await this.onExecute(input, securityContext);
      this.recordSuccess('execute');
      return result;
    } catch (error) {
      this.recordError(error as Error);
      throw error;
    }
  }

  /**
   * Get plugin configuration
   */
  getConfig<T = Record<string, unknown>>(): T {
    if (!this.context) {
      throw new Error(`Plugin ${this.getId()} not initialized`);
    }
    return this.context.config as T;
  }

  /**
   * Get plugin secrets
   */
  getSecrets(): Record<string, string> {
    if (!this.context) {
      throw new Error(`Plugin ${this.getId()} not initialized`);
    }
    return this.context.secrets;
  }

  /**
   * Get plugin logger
   */
  protected getLogger(): PluginLogger {
    if (!this.context) {
      throw new Error(`Plugin ${this.getId()} not initialized`);
    }
    return this.context.logger;
  }

  /**
   * Get event emitter
   */
  protected getEvents(): EventEmitter {
    if (!this.context) {
      throw new Error(`Plugin ${this.getId()} not initialized`);
    }
    return this.context.events;
  }

  /**
   * Get HTTP client
   */
  protected getHttp(): HttpClient {
    if (!this.context) {
      throw new Error(`Plugin ${this.getId()} not initialized`);
    }
    return this.context.http;
  }

  /**
   * Get storage client
   */
  protected getStorage(): StorageClient {
    if (!this.context) {
      throw new Error(`Plugin ${this.getId()} not initialized`);
    }
    return this.context.storage;
  }

  /**
   * Register hook handler
   */
  protected registerHook(hookName: string, handler: HookHandler): void {
    this.hookHandlers.set(hookName, handler);
  }

  /**
   * Unregister hook handler
   */
  protected unregisterHook(hookName: string): void {
    this.hookHandlers.delete(hookName);
  }

  /**
   * Emit event
   */
  protected emit(event: string, ...args: unknown[]): void {
    this.getEvents().emit(event, ...args);
  }

  /**
   * Lifecycle hook: Called when plugin is loaded
   * Override this to implement plugin initialization logic
   */
  protected async onLoad(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: Called when plugin is activated
   * Override this to implement plugin activation logic
   */
  protected async onActivate(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: Called when plugin is deactivated
   * Override this to implement plugin deactivation logic
   */
  protected async onDeactivate(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: Called when plugin is unloaded
   * Override this to implement plugin cleanup logic
   */
  protected async onUnload(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: Called when plugin is reloaded
   * Override this to implement hot reload logic
   */
  protected async onReload(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: Called when plugin is executed
   * Override this to implement plugin execution logic
   */
  protected abstract onExecute(input: unknown, securityContext?: SecurityContext): Promise<unknown>;

  /**
   * Lifecycle hook: Called when plugin configuration is updated
   */
  protected async onConfigUpdate(newConfig: Record<string, unknown>): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: Called when an error occurs
   */
  protected async onError(error: Error): Promise<void> {
    // Default implementation just logs the error
    this.getLogger().error(`Plugin error: ${error.message}`, error);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<PluginHealth> {
    const isHealthy = this.state === PluginState.ACTIVE && this.errors.length === 0;

    return {
      healthy: isHealthy,
      state: this.state,
      errors: this.errors.slice(-5), // Last 5 errors
      metrics: this.metrics,
    };
  }

  /**
   * Update plugin configuration
   */
  async updateConfig(newConfig: Record<string, unknown>): Promise<void> {
    if (!this.context) {
      throw new Error(`Plugin ${this.getId()} not initialized`);
    }

    const oldConfig = { ...this.context.config };
    this.context.config = { ...this.context.config, ...newConfig };

    try {
      await this.onConfigUpdate(newConfig);
      this.recordSuccess('configUpdate');
    } catch (error) {
      this.context.config = oldConfig; // Rollback
      this.recordError(error as Error);
      throw error;
    }
  }

  /**
   * Record successful operation
   */
  protected recordSuccess(operation: string): void {
    const now = Date.now();

    switch (operation) {
      case 'initialize':
      case 'activate':
        this.metrics.activateTime = now - (this.metrics.loadTime || now);
        break;
      case 'deactivate':
        this.metrics.deactivateTime = now - (this.metrics.activateTime || now);
        break;
      case 'unload':
        this.metrics.deactivateTime = now - (this.metrics.deactivateTime || now);
        break;
    }
  }

  /**
   * Record error
   */
  protected recordError(error: Error): void {
    this.errors.push(error);
    this.metrics.errorCount++;
    this.metrics.lastError = new Date();

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors.shift();
    }

    // Call error handler
    this.onError(error).catch((err) => {
      console.error(`Error in error handler for plugin ${this.getId()}:`, err);
    });
  }

  /**
   * Validate plugin configuration
   */
  validateConfig(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Validate against schema if provided
    if (this.manifest.configSchema) {
      // Schema validation would be implemented here
      // For now, just check required fields
    }

    // Validate required secrets are present
    if (this.manifest.requiredSecrets) {
      for (const secret of this.manifest.requiredSecrets) {
        if (!config[secret]) {
          errors.push(`Missing required secret: ${secret}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get plugin info
   */
  getInfo(): PluginInfo {
    return {
      id: this.manifest.id,
      name: this.manifest.name,
      description: this.manifest.description,
      version: this.manifest.version,
      type: this.manifest.type,
      author: this.manifest.author,
      license: this.manifest.license,
      homepage: this.manifest.homepage,
      repository: this.manifest.repository,
      state: this.state,
      capabilities: this.manifest.capabilities,
      dependencies: this.manifest.dependencies,
      hooks: {
        provides: this.manifest.provides || [],
        subscribes: this.manifest.subscribes || [],
      },
      metrics: this.metrics,
      health: this.errors.length === 0,
    };
  }
}

/**
 * Plugin metrics
 */
export interface PluginMetrics {
  loadTime: number;
  activateTime: number;
  deactivateTime: number;
  executionCount: number;
  errorCount: number;
  lastExecution: Date | null;
  lastError: Date | null;
}

/**
 * Plugin health status
 */
export interface PluginHealth {
  healthy: boolean;
  state: PluginState;
  errors: Error[];
  metrics: PluginMetrics;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Plugin info
 */
export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  type: string;
  author: {
    name: string;
    email?: string;
    website?: string;
    organization?: string;
  };
  license: string;
  homepage?: string;
  repository?: string;
  state: PluginState;
  capabilities: PluginCapabilities;
  dependencies?: Array<{
    pluginId: string;
    version: string;
    required: boolean;
  }>;
  hooks: {
    provides: string[];
    subscribes: string[];
  };
  metrics: PluginMetrics;
  health: boolean;
}

/**
 * Plugin state transition map
 */
export const STATE_TRANSITIONS: Record<PluginState, PluginState[]> = {
  [PluginState.UNLOADED]: [PluginState.LOADING],
  [PluginState.LOADING]: [PluginState.LOADED, PluginState.ERROR],
  [PluginState.LOADED]: [PluginState.ACTIVATING, PluginState.UNLOADING, PluginState.ERROR],
  [PluginState.ACTIVATING]: [PluginState.ACTIVE, PluginState.ERROR],
  [PluginState.ACTIVE]: [PluginState.DEACTIVATING, PluginState.ERROR],
  [PluginState.DEACTIVATING]: [PluginState.INACTIVE, PluginState.ERROR],
  [PluginState.INACTIVE]: [PluginState.ACTIVATING, PluginState.UNLOADING],
  [PluginState.ERROR]: [PluginState.UNLOADING, PluginState.LOADED],
  [PluginState.UNLOADING]: [PluginState.UNLOADED],
};

/**
 * Validate state transition
 */
export function isValidStateTransition(
  from: PluginState,
  to: PluginState
): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}
