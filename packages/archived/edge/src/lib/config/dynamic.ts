/**
 * Dynamic Configuration
 *
 * Provides hot-reloadable configuration with change detection,
 * notification subscribers, and rollback capabilities.
 */

import type {
  AppConfig,
  ConfigChange,
  ConfigVersion,
  ConfigValidationResult,
} from './types';
import { ConfigValidator } from './validation';

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  change: ConfigChange;
  version: number;
}

/**
 * Configuration change subscriber
 */
export type ConfigSubscriber = (event: ConfigChangeEvent) => void | Promise<void>;

/**
 * Dynamic configuration manager
 */
export class DynamicConfigManager {
  private config: AppConfig;
  private versions: ConfigVersion[] = [];
  private changes: ConfigChange[] = [];
  private subscribers: Map<string, ConfigSubscriber> = new Map();
  private currentVersion: number = 0;
  private validationEnabled: boolean = true;

  /**
   * Create a new dynamic config manager
   */
  constructor(initialConfig: AppConfig) {
    // Validate initial config
    const validation = ConfigValidator.validateAppConfig(initialConfig);
    if (!validation.valid) {
      throw new Error(`Invalid initial config: ${validation.errors.join(', ')}`);
    }

    this.config = this.deepClone(initialConfig);
    this.currentVersion = 1;

    // Create initial version
    this.createVersion('Initial configuration', 'system');
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    return this.deepClone(this.config);
  }

  /**
   * Get configuration value by path (dot notation)
   */
  getValue<T = unknown>(path: string): T | undefined {
    const keys = path.split('.');
    let value: unknown = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value as T;
  }

  /**
   * Set configuration value by path (dot notation)
   */
  async setValue(
    path: string,
    value: unknown,
    author: string,
    reason?: string
  ): Promise<ConfigValidationResult> {
    // Validate the update
    if (this.validationEnabled) {
      const validation = ConfigValidator.validatePartialUpdate(path, value);
      if (!validation.valid) {
        return validation;
      }
    }

    // Get old value
    const oldValue = this.getValue(path);

    // Check if value actually changed
    if (JSON.stringify(oldValue) === JSON.stringify(value)) {
      return {
        valid: true,
        errors: [],
        warnings: ['Value unchanged, no update needed'],
      };
    }

    // Set new value
    this.setNestedValue(this.config, path, value);

    // Record change
    const change: ConfigChange = {
      type: 'update',
      path,
      oldValue,
      newValue: value,
      author,
      timestamp: Date.now(),
      reason,
    };

    this.changes.push(change);

    // Create new version
    this.createVersion(`Update ${path}`, author);

    // Notify subscribers
    await this.notifySubscribers({ change, version: this.currentVersion });

    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Update multiple configuration values
   */
  async updateValues(
    updates: Array<{
      path: string;
      value: unknown;
      reason?: string;
    }>,
    author: string
  ): Promise<{ results: ConfigValidationResult[]; success: boolean }> {
    const results: ConfigValidationResult[] = [];
    let allValid = true;

    // Validate all updates first
    for (const update of updates) {
      const validation = ConfigValidator.validatePartialUpdate(
        update.path,
        update.value
      );

      results.push(validation);
      if (!validation.valid) {
        allValid = false;
      }
    }

    // Apply updates if all valid
    if (allValid) {
      for (const update of updates) {
        const oldValue = this.getValue(update.path);
        this.setNestedValue(this.config, update.path, update.value);

        const change: ConfigChange = {
          type: 'update',
          path: update.path,
          oldValue,
          newValue: update.value,
          author,
          timestamp: Date.now(),
          reason: update.reason,
        };

        this.changes.push(change);
      }

      // Create version for batch update
      this.createVersion(`Batch update of ${updates.length} values`, author);

      // Notify subscribers
      await this.notifySubscribers({
        change: {
          type: 'update',
          path: '(multiple)',
          oldValue: undefined,
          newValue: updates.map((u) => ({ path: u.path, value: u.value })),
          author,
          timestamp: Date.now(),
        },
        version: this.currentVersion,
      });
    }

    return { results, success: allValid };
  }

  /**
   * Merge configuration updates
   */
  async mergeConfig(
    updates: Partial<AppConfig>,
    author: string,
    reason?: string
  ): Promise<ConfigValidationResult> {
    // Validate the merged config
    const merged = this.deepMerge(this.config, updates);
    const validation = ConfigValidator.validateAppConfig(merged);

    if (!validation.valid) {
      return validation;
    }

    // Track changes
    const changes = this.detectChanges(this.config, merged);

    // Apply merge
    this.config = merged;

    // Record changes
    for (const change of changes) {
      this.changes.push({
        ...change,
        author,
        timestamp: Date.now(),
        reason,
      });
    }

    // Create version
    this.createVersion(`Merge configuration changes`, author);

    // Notify subscribers
    for (const change of changes) {
      await this.notifySubscribers({ change, version: this.currentVersion });
    }

    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * Rollback to a previous version
   */
  async rollback(
    targetVersion: number,
    author: string,
    reason?: string
  ): Promise<ConfigValidationResult> {
    // Validate rollback
    const validation = ConfigValidator.validateRollback(
      this.currentVersion,
      targetVersion
    );

    if (!validation.valid) {
      return validation;
    }

    // Find target version
    const version = this.versions.find((v) => v.version === targetVersion);
    if (!version) {
      return {
        valid: false,
        errors: [`Version ${targetVersion} not found`],
        warnings: [],
      };
    }

    // Get current config for change tracking
    const oldConfig = this.deepClone(this.config);

    // Apply rollback
    this.config = this.deepMerge(this.config, version.config);

    // Record rollback change
    const change: ConfigChange = {
      type: 'rollback',
      path: '(root)',
      oldValue: oldConfig,
      newValue: this.config,
      author,
      timestamp: Date.now(),
      reason: reason || `Rollback to version ${targetVersion}`,
    };

    this.changes.push(change);

    // Create version for rollback
    this.createVersion(`Rollback to version ${targetVersion}`, author);

    // Notify subscribers
    await this.notifySubscribers({ change, version: this.currentVersion });

    return { valid: true, errors: [], warnings: validation.warnings };
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(id: string, subscriber: ConfigSubscriber): () => void {
    this.subscribers.set(id, subscriber);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(id);
    };
  }

  /**
   * Unsubscribe from configuration changes
   */
  unsubscribe(id: string): boolean {
    return this.subscribers.delete(id);
  }

  /**
   * Get change history
   */
  getHistory(limit?: number): ConfigChange[] {
    const history = [...this.changes].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get version history
   */
  getVersions(): ConfigVersion[] {
    return [...this.versions];
  }

  /**
   * Get specific version
   */
  getVersion(versionNumber: number): ConfigVersion | undefined {
    return this.versions.find((v) => v.version === versionNumber);
  }

  /**
   * Get current version number
   */
  getCurrentVersion(): number {
    return this.currentVersion;
  }

  /**
   * Enable/disable validation
   */
  setValidationEnabled(enabled: boolean): void {
    this.validationEnabled = enabled;
  }

  /**
   * Reload configuration from external source
   */
  async reload(
    source: () => Promise<AppConfig>,
    author: string
  ): Promise<ConfigValidationResult> {
    try {
      const newConfig = await source();
      return this.mergeConfig(newConfig, author, 'Reloaded from external source');
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to reload config: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Export configuration
   */
  export(): {
    config: AppConfig;
    version: number;
    timestamp: number;
  } {
    return {
      config: this.deepClone(this.config),
      version: this.currentVersion,
      timestamp: Date.now(),
    };
  }

  /**
   * Import configuration
   */
  async import(
    data: { config: AppConfig; version?: number },
    author: string,
    reason?: string
  ): Promise<ConfigValidationResult> {
    const validation = ConfigValidator.validateAppConfig(data.config);
    if (!validation.valid) {
      return validation;
    }

    const oldConfig = this.deepClone(this.config);
    this.config = this.deepClone(data.config);

    // Track changes
    const changes = this.detectChanges(oldConfig, this.config);
    for (const change of changes) {
      this.changes.push({
        ...change,
        author,
        timestamp: Date.now(),
        reason,
      });
    }

    // Create version
    this.createVersion('Import configuration', author);

    // Notify subscribers
    for (const change of changes) {
      await this.notifySubscribers({ change, version: this.currentVersion });
    }

    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * Reset to default configuration
   */
  async reset(author: string): Promise<ConfigValidationResult> {
    // This would typically load from a default config file or constant
    // For now, we'll just reset feature flags to disabled
    const resets = [
      { path: 'features.websockets.enabled', value: false },
      { path: 'features.codeIndexing.enabled', value: false },
      { path: 'features.advancedCache.enabled', value: false },
    ];

    const result = await this.updateValues(
      resets.map((r) => ({ ...r, reason: 'Reset to default' })),
      author
    );

    return result.success
      ? { valid: true, errors: [], warnings: [] }
      : {
          valid: false,
          errors: result.results.flatMap((r) => r.errors),
          warnings: result.results.flatMap((r) => r.warnings),
        };
  }

  /**
   * Get statistics
   */
  getStats(): {
    version: number;
    totalChanges: number;
    totalVersions: number;
    subscriberCount: number;
  } {
    return {
      version: this.currentVersion,
      totalChanges: this.changes.length,
      totalVersions: this.versions.length,
      subscriberCount: this.subscribers.size,
    };
  }

  /**
   * Create a new version
   */
  private createVersion(description: string, author: string): void {
    const version: ConfigVersion = {
      version: this.currentVersion,
      config: this.deepClone(this.config),
      author,
      description,
      timestamp: Date.now(),
    };

    this.versions.push(version);
    this.currentVersion++;
  }

  /**
   * Notify all subscribers
   */
  private async notifySubscribers(event: ConfigChangeEvent): Promise<void> {
    const notifications = Array.from(this.subscribers.values()).map(
      async (subscriber) => {
        try {
          await subscriber(event);
        } catch (error) {
          console.error('Config subscriber error:', error);
        }
      }
    );

    await Promise.all(notifications);
  }

  /**
   * Set nested value by path
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let target: unknown = obj;

    for (const key of keys) {
      if (target && typeof target === 'object' && key in target) {
        target = (target as Record<string, unknown>)[key];
      } else {
        throw new Error(`Invalid path: ${path} (key "${key}" not found)`);
      }
    }

    if (target && typeof target === 'object') {
      (target as Record<string, unknown>)[lastKey] = value;
    } else {
      throw new Error(`Invalid path: ${path}`);
    }
  }

  /**
   * Detect changes between two configs
   */
  private detectChanges(
    oldConfig: AppConfig,
    newConfig: AppConfig
  ): Array<{
    type: ConfigChange['type'];
    path: string;
    oldValue: unknown;
    newValue: unknown;
  }> {
    const changes: Array<{
      type: ConfigChange['type'];
      path: string;
      oldValue: unknown;
      newValue: unknown;
    }> = [];

    this.detectObjectChanges(oldConfig as Record<string, unknown>, newConfig as Record<string, unknown>, '', changes);

    return changes;
  }

  /**
   * Recursively detect object changes
   */
  private detectObjectChanges(
    oldObj: Record<string, unknown>,
    newObj: Record<string, unknown>,
    path: string,
    changes: Array<{
      type: ConfigChange['type'];
      path: string;
      oldValue: unknown;
      newValue: unknown;
    }>
  ): void {
    for (const key of Object.keys(newObj)) {
      const currentPath = path ? `${path}.${key}` : key;
      const oldValue = oldObj[key];
      const newValue = newObj[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        if (
          newValue &&
          typeof newValue === 'object' &&
          oldValue &&
          typeof oldValue === 'object'
        ) {
          this.detectObjectChanges(
            oldValue as Record<string, unknown>,
            newValue as Record<string, unknown>,
            currentPath,
            changes
          );
        } else {
          changes.push({
            type: 'update',
            path: currentPath,
            oldValue,
            newValue,
          });
        }
      }
    }
  }

  /**
   * Deep merge objects
   */
  private deepMerge<T extends Record<string, unknown>>(
    target: T,
    source: Partial<T>
  ): T {
    const output = { ...target } as Record<string, unknown>;

    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(
              target[key] as Record<string, unknown>,
              source[key] as Record<string, unknown>
            );
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output as T;
  }

  /**
   * Deep clone an object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

/**
 * Check if value is a plain object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}
