/**
 * Plugin registry - manages plugin discovery, registration, and metadata
 */

import type {
  PluginManifest,
  PluginId,
  PluginVersion,
  PluginType,
  PluginState,
} from '../types';
import { Plugin } from '../core/plugin';
import { RegistryError } from '../types/errors';

/**
 * Plugin registry entry
 */
export interface RegistryEntry {
  manifest: PluginManifest;
  plugin?: Plugin;
  registeredAt: Date;
  updatedAt: Date;
  enabled: boolean;
  health: 'healthy' | 'unhealthy' | 'unknown';
  metadata: Record<string, unknown>;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalPlugins: number;
  enabledPlugins: number;
  disabledPlugins: number;
  activePlugins: number;
  pluginsByType: Record<string, number>;
  healthStats: {
    healthy: number;
    unhealthy: number;
    unknown: number;
  };
}

/**
 * Registry query options
 */
export interface RegistryQueryOptions {
  /**
   * Filter by type
   */
  type?: PluginType;

  /**
   * Filter by enabled state
   */
  enabled?: boolean;

  /**
   * Filter by health
   */
  health?: 'healthy' | 'unhealthy' | 'unknown';

  /**
   * Search in name, description, keywords
   */
  search?: string;

  /**
   * Minimum version
   */
  minVersion?: PluginVersion;

  /**
   * Maximum version
   */
  maxVersion?: PluginVersion;

  /**
   * Limit results
   */
  limit?: number;

  /**
   * Offset results
   */
  offset?: number;

  /**
   * Sort by field
   */
  sortBy?: 'name' | 'version' | 'registeredAt' | 'updatedAt';

  /**
   * Sort order
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Plugin registry class
 */
export class PluginRegistry {
  private entries: Map<PluginId, RegistryEntry> = new Map();
  private indexes: Map<string, Set<PluginId>> = new Map();

  /**
   * Register a plugin
   */
  async register(manifest: PluginManifest): Promise<void> {
    if (this.entries.has(manifest.id)) {
      throw new RegistryError(`Plugin ${manifest.id} is already registered`);
    }

    const entry: RegistryEntry = {
      manifest,
      registeredAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
      health: 'unknown',
      metadata: {},
    };

    this.entries.set(manifest.id, entry);
    this.updateIndexes(manifest.id, entry);

    // Emit registration event
    this.emit('plugin:registered', { pluginId: manifest.id, manifest });
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: PluginId): Promise<void> {
    const entry = this.entries.get(pluginId);
    if (!entry) {
      throw new RegistryError(`Plugin ${pluginId} is not registered`);
    }

    // Unload if loaded
    if (entry.plugin) {
      await entry.plugin.unload();
    }

    this.entries.delete(pluginId);
    this.clearIndexes(pluginId);

    // Emit unregistration event
    this.emit('plugin:unregistered', { pluginId });
  }

  /**
   * Update plugin manifest
   */
  async update(pluginId: PluginId, updates: Partial<PluginManifest>): Promise<void> {
    const entry = this.entries.get(pluginId);
    if (!entry) {
      throw new RegistryError(`Plugin ${pluginId} is not registered`);
    }

    entry.manifest = { ...entry.manifest, ...updates };
    entry.updatedAt = new Date();

    this.updateIndexes(pluginId, entry);

    // Emit update event
    this.emit('plugin:updated', { pluginId, manifest: entry.manifest });
  }

  /**
   * Get plugin entry
   */
  get(pluginId: PluginId): RegistryEntry | undefined {
    return this.entries.get(pluginId);
  }

  /**
   * Get plugin manifest
   */
  getManifest(pluginId: PluginId): PluginManifest | undefined {
    return this.entries.get(pluginId)?.manifest;
  }

  /**
   * Check if plugin is registered
   */
  has(pluginId: PluginId): boolean {
    return this.entries.has(pluginId);
  }

  /**
   * Enable plugin
   */
  async enable(pluginId: PluginId): Promise<void> {
    const entry = this.entries.get(pluginId);
    if (!entry) {
      throw new RegistryError(`Plugin ${pluginId} is not registered`);
    }

    entry.enabled = true;
    entry.updatedAt = new Date();

    this.emit('plugin:enabled', { pluginId });
  }

  /**
   * Disable plugin
   */
  async disable(pluginId: PluginId): Promise<void> {
    const entry = this.entries.get(pluginId);
    if (!entry) {
      throw new RegistryError(`Plugin ${pluginId} is not registered`);
    }

    // Unload if active
    if (entry.plugin && entry.plugin.getState() === 'active') {
      await entry.plugin.deactivate();
    }

    entry.enabled = false;
    entry.updatedAt = new Date();

    this.emit('plugin:disabled', { pluginId });
  }

  /**
   * Set plugin instance
   */
  setPlugin(pluginId: PluginId, plugin: Plugin): void {
    const entry = this.entries.get(pluginId);
    if (!entry) {
      throw new RegistryError(`Plugin ${pluginId} is not registered`);
    }

    entry.plugin = plugin;
    entry.updatedAt = new Date();
  }

  /**
   * Remove plugin instance
   */
  removePlugin(pluginId: PluginId): void {
    const entry = this.entries.get(pluginId);
    if (entry) {
      entry.plugin = undefined;
      entry.updatedAt = new Date();
    }
  }

  /**
   * Update plugin health
   */
  async updateHealth(pluginId: PluginId, health: 'healthy' | 'unhealthy' | 'unknown'): Promise<void> {
    const entry = this.entries.get(pluginId);
    if (!entry) {
      throw new RegistryError(`Plugin ${pluginId} is not registered`);
    }

    const previousHealth = entry.health;
    entry.health = health;
    entry.updatedAt = new Date();

    if (previousHealth !== health) {
      this.emit('plugin:health-changed', { pluginId, health, previousHealth });
    }
  }

  /**
   * Query plugins
   */
  query(options: RegistryQueryOptions = {}): RegistryEntry[] {
    let results = Array.from(this.entries.values());

    // Filter by type
    if (options.type) {
      results = results.filter((e) => e.manifest.type === options.type);
    }

    // Filter by enabled state
    if (options.enabled !== undefined) {
      results = results.filter((e) => e.enabled === options.enabled);
    }

    // Filter by health
    if (options.health) {
      results = results.filter((e) => e.health === options.health);
    }

    // Search
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      results = results.filter((e) =>
        e.manifest.name.toLowerCase().includes(searchLower) ||
        e.manifest.description.toLowerCase().includes(searchLower) ||
        e.manifest.keywords.some((k) => k.toLowerCase().includes(searchLower))
      );
    }

    // Version filters
    if (options.minVersion) {
      results = results.filter((e) =>
        this.compareVersions(e.manifest.version, options.minVersion!) >= 0
      );
    }

    if (options.maxVersion) {
      results = results.filter((e) =>
        this.compareVersions(e.manifest.version, options.maxVersion!) <= 0
      );
    }

    // Sort
    if (options.sortBy) {
      results.sort((a, b) => {
        let comparison = 0;

        switch (options.sortBy) {
          case 'name':
            comparison = a.manifest.name.localeCompare(b.manifest.name);
            break;
          case 'version':
            comparison = this.compareVersions(a.manifest.version, b.manifest.version);
            break;
          case 'registeredAt':
            comparison = a.registeredAt.getTime() - b.registeredAt.getTime();
            break;
          case 'updatedAt':
            comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
            break;
        }

        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Pagination
    if (options.offset) {
      results = results.slice(options.offset);
    }

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Find plugins by type
   */
  findByType(type: PluginType): RegistryEntry[] {
    return this.query({ type });
  }

  /**
   * Find plugins by keyword
   */
  findByKeyword(keyword: string): RegistryEntry[] {
    return this.query({ search: keyword });
  }

  /**
   * Find plugins by hook
   */
  findByHook(hookName: string): RegistryEntry[] {
    return Array.from(this.entries.values()).filter((e) =>
      e.manifest.provides?.includes(hookName) ||
      e.manifest.subscribes?.includes(hookName)
    );
  }

  /**
   * Find plugins by dependency
   */
  findByDependency(dependencyId: PluginId): RegistryEntry[] {
    return Array.from(this.entries.values()).filter((e) =>
      e.manifest.dependencies?.some((d) => d.pluginId === dependencyId)
    );
  }

  /**
   * Get dependent plugins
   */
  getDependents(pluginId: PluginId): RegistryEntry[] {
    return this.findByDependency(pluginId);
  }

  /**
   * Get dependencies
   */
  getDependencies(pluginId: PluginId): PluginManifest[] {
    const entry = this.entries.get(pluginId);
    if (!entry?.manifest.dependencies) {
      return [];
    }

    return entry.manifest.dependencies
      .map((dep) => this.entries.get(dep.pluginId)?.manifest)
      .filter((m): m is PluginManifest => m !== undefined);
  }

  /**
   * Check for dependency conflicts
   */
  checkDependencyConflicts(pluginId: PluginId): { hasConflicts: boolean; conflicts: string[] } {
    const entry = this.entries.get(pluginId);
    if (!entry?.manifest.dependencies) {
      return { hasConflicts: false, conflicts: [] };
    }

    const conflicts: string[] = [];

    for (const dep of entry.manifest.dependencies) {
      if (dep.required && !this.entries.has(dep.pluginId)) {
        conflicts.push(`Missing required dependency: ${dep.pluginId}`);
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Get all plugins
   */
  getAll(): RegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get enabled plugins
   */
  getEnabled(): RegistryEntry[] {
    return this.query({ enabled: true });
  }

  /**
   * Get disabled plugins
   */
  getDisabled(): RegistryEntry[] {
    return this.query({ enabled: false });
  }

  /**
   * Get active plugins
   */
  getActive(): RegistryEntry[] {
    return Array.from(this.entries.values()).filter(
      (e) => e.plugin?.getState() === 'active'
    );
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const plugins = Array.from(this.entries.values());
    const pluginsByType: Record<string, number> = {};

    for (const plugin of plugins) {
      const type = plugin.manifest.type;
      pluginsByType[type] = (pluginsByType[type] || 0) + 1;
    }

    return {
      totalPlugins: plugins.length,
      enabledPlugins: plugins.filter((p) => p.enabled).length,
      disabledPlugins: plugins.filter((p) => !p.enabled).length,
      activePlugins: plugins.filter((p) => p.plugin?.getState() === 'active').length,
      pluginsByType,
      healthStats: {
        healthy: plugins.filter((p) => p.health === 'healthy').length,
        unhealthy: plugins.filter((p) => p.health === 'unhealthy').length,
        unknown: plugins.filter((p) => p.health === 'unknown').length,
      },
    };
  }

  /**
   * Update indexes
   */
  private updateIndexes(pluginId: PluginId, entry: RegistryEntry): void {
    // Type index
    const type = entry.manifest.type;
    if (!this.indexes.has(`type:${type}`)) {
      this.indexes.set(`type:${type}`, new Set());
    }
    this.indexes.get(`type:${type}`)!.add(pluginId);

    // Hook indexes
    if (entry.manifest.provides) {
      for (const hook of entry.manifest.provides) {
        if (!this.indexes.has(`provides:${hook}`)) {
          this.indexes.set(`provides:${hook}`, new Set());
        }
        this.indexes.get(`provides:${hook}`)!.add(pluginId);
      }
    }

    if (entry.manifest.subscribes) {
      for (const hook of entry.manifest.subscribes) {
        if (!this.indexes.has(`subscribes:${hook}`)) {
          this.indexes.set(`subscribes:${hook}`, new Set());
        }
        this.indexes.get(`subscribes:${hook}`)!.add(pluginId);
      }
    }

    // Keyword index
    for (const keyword of entry.manifest.keywords) {
      if (!this.indexes.has(`keyword:${keyword}`)) {
        this.indexes.set(`keyword:${keyword}`, new Set());
      }
      this.indexes.get(`keyword:${keyword}`)!.add(pluginId);
    }
  }

  /**
   * Clear indexes
   */
  private clearIndexes(pluginId: PluginId): void {
    for (const [key, set] of this.indexes) {
      set.delete(pluginId);
      if (set.size === 0) {
        this.indexes.delete(key);
      }
    }
  }

  /**
   * Compare versions
   */
  private compareVersions(v1: PluginVersion, v2: PluginVersion): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] < parts2[i]) return -1;
      if (parts1[i] > parts2[i]) return 1;
    }

    return 0;
  }

  /**
   * Emit event
   */
  private emit(event: string, data: unknown): void {
    // In a real implementation, this would use an event emitter
    // For now, just log
    console.log(`[Registry Event] ${event}:`, data);
  }

  /**
   * Clear all plugins
   */
  async clear(): Promise<void> {
    // Unload all plugins
    for (const entry of this.entries.values()) {
      if (entry.plugin) {
        await entry.plugin.unload().catch(() => {});
      }
    }

    this.entries.clear();
    this.indexes.clear();
  }

  /**
   * Export registry
   */
  export(): Record<string, RegistryEntry> {
    return Object.fromEntries(this.entries);
  }

  /**
   * Import registry
   */
  async import(data: Record<string, RegistryEntry>): Promise<void> {
    for (const [pluginId, entry] of Object.entries(data)) {
      this.entries.set(pluginId, entry);
      this.updateIndexes(pluginId, entry);
    }
  }
}
