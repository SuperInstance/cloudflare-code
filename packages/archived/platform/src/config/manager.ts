// @ts-nocheck
/**
 * Configuration Manager
 *
 * Centralized configuration management with validation, watching, and hot-reloading.
 */

import type {
  ConfigValue,
  ConfigSchema,
  ConfigLoader,
  ConfigWatcher,
  ConfigChangeEvent,
  ConfigOptions,
  ValidationResult,
  ConfigSource,
} from '../types/config';

/**
 * Configuration manager implementation
 */
export class ConfigManager {
  private config: Map<string, ConfigValue>;
  private loaders: ConfigLoader[];
  private watchers: Map<string, ConfigWatcher[]>;
  private schemas: Map<string, ConfigSchema>;
  private options: Required<ConfigOptions>;
  private disposed: boolean;

  constructor(options: ConfigOptions = {}) {
    this.config = new Map();
    this.loaders = [];
    this.watchers = new Map();
    this.schemas = new Map();
    this.disposed = false;

    this.options = {
      sources: options.sources || [],
      schema: options.schema || this.defaultSchema(),
      validateOnChange: options.validateOnChange !== false,
      enableWatchers: options.enableWatchers !== false,
      separator: options.separator || '.',
      transform: options.transform || ((_, v) => v),
    };
  }

  /**
   * Get a configuration value
   */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    this.assertNotDisposed();

    const normalizedKey = this.normalizeKey(key);
    const entry = this.config.get(normalizedKey);

    if (!entry) {
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Get a configuration value with default
   */
  async getOrDefault<T = unknown>(
    key: string,
    defaultValue: T
  ): Promise<T> {
    const value = await this.get<T>(key);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set a configuration value
   */
  async set<T = unknown>(
    key: string,
    value: T,
    source: ConfigSource = 'default'
  ): Promise<void> {
    this.assertNotDisposed();

    const normalizedKey = this.normalizeKey(key);

    // Transform value
    const transformedValue = this.options.transform(normalizedKey, value);

    // Validate if schema exists
    const schema = this.schemas.get(normalizedKey);
    if (schema) {
      const validation = this.validate(schema, transformedValue);
      if (!validation.valid && this.options.validateOnChange) {
        throw new Error(
          `Configuration validation failed for ${key}: ${validation.errors
            .map((e) => e.message)
            .join(', ')}`
        );
      }
    }

    const existing = this.config.get(normalizedKey);
    const now = Date.now();

    const configValue: ConfigValue = {
      value: transformedValue,
      source,
      overridden: existing !== undefined,
      schema: schema?.description,
      validation: schema ? this.validate(schema, transformedValue) : undefined,
    };

    this.config.set(normalizedKey, configValue);

    // Notify watchers
    await this.notifyWatchers(normalizedKey, configValue);

    // Emit change event
    if (existing) {
      await this.emitChange(normalizedKey, existing, configValue);
    }
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    this.assertNotDisposed();

    const normalizedKey = this.normalizeKey(key);
    return this.config.has(normalizedKey);
  }

  /**
   * Delete a configuration value
   */
  async delete(key: string): Promise<void> {
    this.assertNotDisposed();

    const normalizedKey = this.normalizeKey(key);
    this.config.delete(normalizedKey);
  }

  /**
   * Get all configuration
   */
  async getAll(): Promise<Record<string, unknown>> {
    this.assertNotDisposed();

    const result: Record<string, unknown> = {};

    for (const [key, value] of this.config.entries()) {
      result[key] = value.value;
    }

    return result;
  }

  /**
   * Load configuration from loaders
   */
  async load(): Promise<void> {
    this.assertNotDisposed();

    for (const loader of this.loaders) {
      try {
        const data = await loader.load();

        for (const [key, value] of Object.entries(data)) {
          await this.set(key, value, loader.source);
        }
      } catch (error) {
        console.error(`Failed to load config from ${loader.source}:`, error);
      }
    }
  }

  /**
   * Add a configuration loader
   */
  addLoader(loader: ConfigLoader): this {
    this.loaders.push(loader);

    // Start watching if loader supports it
    if (loader.watch && this.options.enableWatchers) {
      const unwatch = loader.watch(async (changes) => {
        for (const [key, value] of Object.entries(changes)) {
          await this.set(key, value, loader.source);
        }
      });

      // Store unwatch function for cleanup
      this.loaders[this.loaders.length - 1] = {
        ...loader,
        unwatch,
      } as ConfigLoader & { unwatch: () => void };
    }

    return this;
  }

  /**
   * Remove a configuration loader
   */
  removeLoader(loader: ConfigLoader): this {
    const index = this.loaders.indexOf(loader);

    if (index !== -1) {
      const ldr = loader as ConfigLoader & { unwatch?: () => void };

      if (ldr.unwatch) {
        ldr.unwatch();
      }

      this.loaders.splice(index, 1);
    }

    return this;
  }

  /**
   * Watch a configuration key
   */
  watch(
    key: string,
    callback: (value: ConfigValue) => void,
    immediate = false
  ): () => void {
    this.assertNotDisposed();

    const normalizedKey = this.normalizeKey(key);

    if (!this.watchers.has(normalizedKey)) {
      this.watchers.set(normalizedKey, []);
    }

    const watcher: ConfigWatcher = {
      key: normalizedKey,
      callback,
      immediate,
    };

    this.watchers.get(normalizedKey)!.push(watcher);

    // Call immediately if requested
    if (immediate) {
      const value = this.config.get(normalizedKey);
      if (value) {
        callback(value);
      }
    }

    // Return unsubscribe function
    return () => {
      const watchers = this.watchers.get(normalizedKey);

      if (watchers) {
        const index = watchers.indexOf(watcher);

        if (index !== -1) {
          watchers.splice(index, 1);
        }

        if (watchers.length === 0) {
          this.watchers.delete(normalizedKey);
        }
      }
    };
  }

  /**
   * Add a schema for a key
   */
  addSchema(key: string, schema: ConfigSchema): this {
    const normalizedKey = this.normalizeKey(key);
    this.schemas.set(normalizedKey, schema);
    return this;
  }

  /**
   * Validate configuration
   */
  validate(schema: ConfigSchema, value: unknown): ValidationResult {
    const errors: Array<{ message: string; value: unknown }> = [];
    const warnings: Array<{ message: string; value: unknown }> = [];

    // Type validation
    if (schema.type && !this.validateType(schema.type, value)) {
      errors.push({
        message: `Expected type ${schema.type}, got ${typeof value}`,
        value,
      });
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value as never)) {
      errors.push({
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        value,
      });
    }

    // Range validation for numbers
    if (typeof value === 'number') {
      if (
        schema.minimum !== undefined &&
        value < schema.minimum
      ) {
        errors.push({
          message: `Value must be >= ${schema.minimum}`,
          value,
        });
      }

      if (
        schema.maximum !== undefined &&
        value > schema.maximum
      ) {
        errors.push({
          message: `Value must be <= ${schema.maximum}`,
          value,
        });
      }
    }

    // Length validation for strings
    if (typeof value === 'string') {
      if (
        schema.minLength !== undefined &&
        value.length < schema.minLength
      ) {
        errors.push({
          message: `String length must be >= ${schema.minLength}`,
          value,
        });
      }

      if (
        schema.maxLength !== undefined &&
        value.length > schema.maxLength
      ) {
        errors.push({
          message: `String length must be <= ${schema.maxLength}`,
          value,
        });
      }

      // Pattern validation
      if (schema.pattern && !schema.pattern.test(value)) {
        errors.push({
          message: `String does not match pattern: ${schema.pattern}`,
          value,
        });
      }
    }

    // Required properties for objects
    if (
      schema.type === 'object' &&
      schema.properties &&
      typeof value === 'object' &&
      value !== null
    ) {
      for (const required of schema.required || []) {
        if (!(required in value)) {
          errors.push({
            message: `Missing required property: ${required}`,
            value,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get configuration as flattened object
   */
  async flatten(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of this.config.entries()) {
      result[key] = value.value;
    }

    return result;
  }

  /**
   * Clear all configuration
   */
  async clear(): Promise<void> {
    this.config.clear();
    this.watchers.clear();
  }

  /**
   * Dispose of configuration manager
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop all loaders
    for (const loader of this.loaders) {
      const ldr = loader as ConfigLoader & { unwatch?: () => void };

      if (ldr.unwatch) {
        ldr.unwatch();
      }
    }

    this.loaders = [];
    this.watchers.clear();
    this.config.clear();
    this.schemas.clear();
  }

  private normalizeKey(key: string): string {
    return key.split(this.options.separator).join('.');
  }

  private validateType(type: ConfigSchema['type'], value: unknown): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'null':
        return value === null;
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  private defaultSchema(): ConfigSchema {
    return {
      type: 'object',
      properties: {},
    };
  }

  private async notifyWatchers(
    key: string,
    value: ConfigValue
  ): Promise<void> {
    const watchers = this.watchers.get(key);

    if (!watchers) {
      return;
    }

    for (const watcher of watchers) {
      try {
        await watcher.callback(value);
      } catch (error) {
        console.error(`Error in config watcher for ${key}:`, error);
      }
    }
  }

  private async emitChange(
    key: string,
    previousValue: ConfigValue,
    currentValue: ConfigValue
  ): Promise<void> {
    // Emit to change listeners if needed
    // This would integrate with the event bus
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('ConfigManager has been disposed');
    }
  }
}

/**
 * Environment configuration loader
 */
export class EnvironmentConfigLoader implements ConfigLoader {
  readonly source = 'environment';

  async load(): Promise<Record<string, unknown>> {
    // In a real implementation, this would read from environment variables
    // For Cloudflare Workers, this would be from env bindings
    return {};
  }
}

/**
 * File configuration loader
 */
export class FileConfigLoader implements ConfigLoader {
  readonly source = 'file';

  constructor(private path: string) {}

  async load(): Promise<Record<string, unknown>> {
    // In a real implementation, this would read from a file
    // For Cloudflare Workers, this might be from KV or assets
    return {};
  }
}

/**
 * Remote configuration loader
 */
export class RemoteConfigLoader implements ConfigLoader {
  readonly source = 'remote';

  constructor(private url: string) {}

  async load(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(this.url);

      if (!response.ok) {
        throw new Error(`Failed to load remote config: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to load remote configuration:', error);
      return {};
    }
  }
}

/**
 * Default configuration loader
 */
export class DefaultConfigLoader implements ConfigLoader {
  readonly source = 'default';

  constructor(private defaults: Record<string, unknown>) {}

  async load(): Promise<Record<string, unknown>> {
    return { ...this.defaults };
  }
}
