// @ts-nocheck
/**
 * Enhanced Configuration Manager
 *
 * Advanced configuration management with multi-source loading,
 * validation, versioning, and dynamic updates.
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
  ConfigVersion,
  ConfigUpdateStrategy,
} from '../types/config';

import { delay, deepMerge, debounce } from '../utils/helpers';

/**
 * Enhanced configuration options
 */
export interface EnhancedConfigOptions extends ConfigOptions {
  readonly versioning?: boolean;
  readonly maxVersions?: number;
  readonly encryptionEnabled?: boolean;
  readonly secretInjection?: boolean;
  readonly updateStrategy?: ConfigUpdateStrategy;
  readonly validationMode?: 'strict' | 'lenient' | 'none';
  readonly cacheEnabled?: boolean;
  readonly cacheTTL?: number;
  readonly documentationEnabled?: boolean;
}

/**
 * Configuration metadata
 */
interface ConfigMetadata {
  readonly version: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly source: ConfigSource;
  readonly schema?: string;
  readonly encrypted?: boolean;
  readonly tags?: string[];
}

/**
 * Configuration version entry
 */
interface ConfigVersionEntry {
  readonly version: number;
  readonly timestamp: number;
  readonly changes: Record<string, { oldValue: unknown; newValue: unknown }>;
  readonly author?: string;
  readonly reason?: string;
}

/**
 * Secret injection pattern
 */
interface SecretInjection {
  readonly pattern: RegExp;
  readonly from: 'env' | 'kv' | 'secret';
  readonly transformer?: (value: string) => string | Promise<string>;
}

/**
 * Enhanced configuration manager
 */
export class EnhancedConfigManager {
  private config: Map<string, ConfigValue & { metadata: ConfigMetadata }>;
  private loaders: ConfigLoader[];
  private watchers: Map<string, ConfigWatcher[]>;
  private schemas: Map<string, ConfigSchema>;
  private versions: Map<string, ConfigVersionEntry[]>;
  private options: Required<EnhancedConfigOptions>;
  private cache: Map<string, { value: unknown; expires: number }>;
  private disposed: boolean;
  private secretInjections: SecretInjection[];
  private changeHistory: ConfigVersionEntry[];
  private currentVersion: number;

  constructor(options: EnhancedConfigOptions = {}) {
    this.config = new Map();
    this.loaders = [];
    this.watchers = new Map();
    this.schemas = new Map();
    this.versions = new Map();
    this.cache = new Map();
    this.disposed = false;
    this.secretInjections = [];
    this.changeHistory = [];
    this.currentVersion = 0;

    this.options = {
      sources: options.sources || [],
      schema: options.schema || this.defaultSchema(),
      validateOnChange: options.validateOnChange !== false,
      enableWatchers: options.enableWatchers !== false,
      separator: options.separator || '.',
      transform: options.transform || ((_, v) => v),
      versioning: options.versioning ?? true,
      maxVersions: options.maxVersions || 100,
      encryptionEnabled: options.encryptionEnabled || false,
      secretInjection: options.secretInjection ?? true,
      updateStrategy: options.updateStrategy || 'merge',
      validationMode: options.validationMode || 'lenient',
      cacheEnabled: options.cacheEnabled ?? true,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes
      documentationEnabled: options.documentationEnabled ?? true,
    };

    // Setup default secret injections
    if (this.options.secretInjection) {
      this.setupDefaultSecretInjections();
    }

    // Start cache cleanup
    if (this.options.cacheEnabled) {
      this.startCacheCleanup();
    }
  }

  /**
   * Get a configuration value
   */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    this.assertNotDisposed();

    // Check cache first
    if (this.options.cacheEnabled) {
      const cached = this.cache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.value as T;
      }
    }

    const normalizedKey = this.normalizeKey(key);
    const entry = this.config.get(normalizedKey);

    if (!entry) {
      return undefined;
    }

    // Apply secret injection
    const value = await this.applySecretInjection(key, entry.value);

    // Update cache
    if (this.options.cacheEnabled) {
      this.cache.set(key, {
        value,
        expires: Date.now() + this.options.cacheTTL,
      });
    }

    return value as T;
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
   * Get configuration with metadata
   */
  async getWithMetadata<T = unknown>(
    key: string
  ): Promise<{ value: T; metadata: ConfigMetadata } | undefined> {
    this.assertNotDisposed();

    const normalizedKey = this.normalizeKey(key);
    const entry = this.config.get(normalizedKey);

    if (!entry) {
      return undefined;
    }

    return {
      value: await this.applySecretInjection(key, entry.value) as T,
      metadata: entry.metadata,
    };
  }

  /**
   * Set a configuration value
   */
  async set<T = unknown>(
    key: string,
    value: T,
    options: {
      source?: ConfigSource;
      author?: string;
      reason?: string;
      tags?: string[];
      skipValidation?: boolean;
    } = {}
  ): Promise<void> {
    this.assertNotDisposed();

    const normalizedKey = this.normalizeKey(key);

    // Get old value for versioning
    const oldEntry = this.config.get(normalizedKey);
    const oldValue = oldEntry?.value;

    // Transform value
    const transformedValue = this.options.transform(normalizedKey, value);

    // Validate if schema exists
    const schema = this.schemas.get(normalizedKey);
    if (schema && !options.skipValidation && this.options.validationMode !== 'none') {
      const validation = this.validate(schema, transformedValue);
      if (!validation.valid && this.options.validationMode === 'strict') {
        throw new Error(
          `Configuration validation failed for ${key}: ${validation.errors
            .map((e) => e.message)
            .join(', ')}`
        );
      }
    }

    // Create metadata
    const metadata: ConfigMetadata = {
      version: this.currentVersion + 1,
      createdAt: oldEntry?.metadata.createdAt || Date.now(),
      updatedAt: Date.now(),
      source: options.source || 'default',
      schema: schema?.description,
      encrypted: false,
      tags: options.tags,
    };

    const configValue: ConfigValue & { metadata: ConfigMetadata } = {
      value: transformedValue,
      source: options.source || 'default',
      overridden: oldEntry !== undefined,
      schema: schema?.description,
      validation: schema ? this.validate(schema, transformedValue) : undefined,
      metadata,
    };

    // Apply update strategy
    await this.applyUpdateStrategy(normalizedKey, configValue);

    // Invalidate cache
    if (this.options.cacheEnabled) {
      this.cache.delete(key);
    }

    // Create version entry
    if (this.options.versioning && oldValue !== undefined) {
      this.createVersionEntry(normalizedKey, oldValue, transformedValue, options);
    }

    // Notify watchers
    await this.notifyWatchers(normalizedKey, configValue);

    // Emit change event
    if (oldEntry) {
      await this.emitChange(normalizedKey, oldEntry, configValue);
    }
  }

  /**
   * Delete a configuration value
   */
  async delete(key: string): Promise<void> {
    this.assertNotDisposed();

    const normalizedKey = this.normalizeKey(key);
    this.config.delete(normalizedKey);

    // Invalidate cache
    if (this.options.cacheEnabled) {
      this.cache.delete(key);
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
   * Get all configuration
   */
  async getAll(): Promise<Record<string, unknown>> {
    this.assertNotDisposed();

    const result: Record<string, unknown> = {};

    for (const [key, value] of this.config.entries()) {
      result[key] = await this.applySecretInjection(key, value.value);
    }

    return result;
  }

  /**
   * Get all configuration with metadata
   */
  async getAllWithMetadata(): Promise<
    Record<string, { value: unknown; metadata: ConfigMetadata }>
  > {
    this.assertNotDisposed();

    const result: Record<
      string,
      { value: unknown; metadata: ConfigMetadata }
    > = {};

    for (const [key, value] of this.config.entries()) {
      result[key] = {
        value: await this.applySecretInjection(key, value.value),
        metadata: value.metadata,
      };
    }

    return result;
  }

  /**
   * Get configuration versions
   */
  async getVersions(key: string): Promise<ConfigVersionEntry[]> {
    this.assertNotDisposed();

    const normalizedKey = this.normalizeKey(key);
    return this.versions.get(normalizedKey) || [];
  }

  /**
   * Rollback to a specific version
   */
  async rollback(key: string, version: number): Promise<void> {
    this.assertNotDisposed();

    const versions = await this.getVersions(key);
    const targetVersion = versions.find((v) => v.version === version);

    if (!targetVersion) {
      throw new Error(`Version ${version} not found for ${key}`);
    }

    // Apply all changes from that version
    for (const [changeKey, change] of Object.entries(targetVersion.changes)) {
      await this.set(changeKey, change.oldValue, {
        source: 'rollback',
        reason: `Rollback to version ${version}`,
      });
    }
  }

  /**
   * Add a configuration loader
   */
  addLoader(loader: ConfigLoader): this {
    this.loaders.push(loader);

    // Start watching if loader supports it
    if (loader.watch && this.options.enableWatchers) {
      const unwatch = loader.watch(
        debounce(async (changes) => {
          for (const [key, value] of Object.entries(changes)) {
            await this.set(key, value, { source: loader.source });
          }
        }, 100)
      );

      // Store unwatch function for cleanup
      this.loaders[this.loaders.length - 1] = {
        ...loader,
        unwatch,
      } as ConfigLoader & { unwatch: () => void };
    }

    return this;
  }

  /**
   * Add a secret injection pattern
   */
  addSecretInjection(injection: SecretInjection): this {
    this.secretInjections.push(injection);
    return this;
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
          await this.set(key, value, { source: loader.source });
        }
      } catch (error) {
        console.error(`Failed to load config from ${loader.source}:`, error);
      }
    }
  }

  /**
   * Watch a configuration key
   */
  watch(
    key: string,
    callback: (value: ConfigValue & { metadata: ConfigMetadata }) => void,
    immediate = false
  ): () => void {
    this.assertNotDisposed();

    const normalizedKey = this.normalizeKey(key);

    if (!this.watchers.has(normalizedKey)) {
      this.watchers.set(normalizedKey, []);
    }

    const watcher: ConfigWatcher = {
      key: normalizedKey,
      callback: callback as (value: ConfigValue) => void,
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
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          message: `Value must be >= ${schema.minimum}`,
          value,
        });
      }

      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          message: `Value must be <= ${schema.maximum}`,
          value,
        });
      }
    }

    // Length validation for strings
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
          message: `String length must be >= ${schema.minLength}`,
          value,
        });
      }

      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
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
   * Validate all configuration
   */
  async validateAll(): Promise<{
    valid: boolean;
    errors: Array<{ key: string; errors: string[] }>;
    warnings: Array<{ key: string; warnings: string[] }>;
  }> {
    const errors: Array<{ key: string; errors: string[] }> = [];
    const warnings: Array<{ key: string; warnings: string[] }> = [];

    for (const [key, value] of this.config.entries()) {
      const schema = this.schemas.get(key);

      if (schema) {
        const validation = this.validate(schema, value.value);

        if (!validation.valid) {
          errors.push({
            key,
            errors: validation.errors.map((e) => e.message),
          });
        }

        if (validation.warnings.length > 0) {
          warnings.push({
            key,
            warnings: validation.warnings.map((w) => w.message),
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
   * Get configuration documentation
   */
  async getDocumentation(): Promise<
    Array<{
      key: string;
      schema?: ConfigSchema;
      currentValue: unknown;
      description?: string;
      tags?: string[];
    }>
  > {
    if (!this.options.documentationEnabled) {
      throw new Error('Documentation is not enabled');
    }

    const docs: Array<{
      key: string;
      schema?: ConfigSchema;
      currentValue: unknown;
      description?: string;
      tags?: string[];
    }> = [];

    for (const [key, value] of this.config.entries()) {
      const schema = this.schemas.get(key);

      docs.push({
        key,
        schema,
        currentValue: value.value,
        description: schema?.description,
        tags: value.metadata.tags,
      });
    }

    return docs;
  }

  /**
   * Export configuration
   */
  async export(options: {
    includeMetadata?: boolean;
    includeVersions?: boolean;
    redactSecrets?: boolean;
  } = {}): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of this.config.entries()) {
      let exportValue = value.value;

      // Redact secrets if requested
      if (options.redactSecrets && value.metadata.encrypted) {
        exportValue = '***REDACTED***';
      }

      if (options.includeMetadata) {
        result[key] = {
          value: exportValue,
          metadata: value.metadata,
        };
      } else {
        result[key] = exportValue;
      }

      // Add versions if requested
      if (options.includeVersions) {
        const versions = this.versions.get(key);
        if (versions) {
          result[`${key}.$versions`] = versions;
        }
      }
    }

    return result;
  }

  /**
   * Import configuration
   */
  async import(
    data: Record<string, unknown>,
    options: {
      overwrite?: boolean;
      source?: ConfigSource;
      validate?: boolean;
    } = {}
  ): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      // Skip version metadata
      if (key.endsWith('.$versions')) {
        continue;
      }

      // Check if should overwrite
      if (!options.overwrite && (await this.has(key))) {
        continue;
      }

      // Extract value if it's wrapped
      let actualValue = value;
      if (typeof value === 'object' && value !== null && 'value' in value) {
        actualValue = (value as { value: unknown }).value;
      }

      await this.set(key, actualValue, {
        source: options.source || 'import',
        skipValidation: !options.validate,
      });
    }
  }

  /**
   * Clear all configuration
   */
  async clear(): Promise<void> {
    this.config.clear();
    this.watchers.clear();
    this.versions.clear();
    this.cache.clear();
    this.changeHistory = [];
    this.currentVersion = 0;
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
    this.versions.clear();
    this.cache.clear();
    this.secretInjections = [];
  }

  private setupDefaultSecretInjections(): void {
    // Environment variable injection: ${env:VAR_NAME}
    this.addSecretInjection({
      pattern: /\$\{env:([^}]+)\}/g,
      from: 'env',
      transformer: async (match: string, envVar: string) => {
        if (typeof process !== 'undefined' && process.env) {
          return process.env[envVar] || match;
        }
        return match;
      },
    });

    // KV injection: ${kv:KEY_NAME}
    this.addSecretInjection({
      pattern: /\$\{kv:([^}]+)\}/g,
      from: 'kv',
      transformer: async (match: string, kvKey: string) => {
        // Would integrate with KV namespace
        return match;
      },
    });
  }

  private async applySecretInjection(
    key: string,
    value: unknown
  ): Promise<unknown> {
    if (typeof value !== 'string') {
      return value;
    }

    let result = value;

    for (const injection of this.secretInjections) {
      const matches = value.matchAll(injection.pattern);

      for (const match of matches) {
        const [fullMatch, ...groups] = match;
        const replacement = injection.transformer
          ? await injection.transformer(fullMatch, groups[0])
          : fullMatch;
        result = result.replace(fullMatch, replacement);
      }
    }

    return result;
  }

  private async applyUpdateStrategy(
    key: string,
    value: ConfigValue & { metadata: ConfigMetadata }
  ): Promise<void> {
    const existing = this.config.get(key);

    switch (this.options.updateStrategy) {
      case 'replace':
        this.config.set(key, value);
        break;

      case 'merge':
        if (
          existing &&
          typeof existing.value === 'object' &&
          !Array.isArray(existing.value) &&
          typeof value.value === 'object' &&
          !Array.isArray(value.value)
        ) {
          this.config.set(key, {
            ...value,
            value: deepMerge(
              existing.value as Record<string, unknown>,
              value.value as Record<string, unknown>
            ),
          });
        } else {
          this.config.set(key, value);
        }
        break;

      case 'error':
        if (existing) {
          throw new Error(`Configuration key ${key} already exists`);
        }
        this.config.set(key, value);
        break;
    }
  }

  private createVersionEntry(
    key: string,
    oldValue: unknown,
    newValue: unknown,
    options: {
      author?: string;
      reason?: string;
    }
  ): void {
    this.currentVersion++;

    const versionEntry: ConfigVersionEntry = {
      version: this.currentVersion,
      timestamp: Date.now(),
      changes: {
        [key]: {
          oldValue,
          newValue,
        },
      },
      author: options.author,
      reason: options.reason,
    };

    this.changeHistory.push(versionEntry);

    // Add to key-specific versions
    if (!this.versions.has(key)) {
      this.versions.set(key, []);
    }

    const keyVersions = this.versions.get(key)!;
    keyVersions.push(versionEntry);

    // Trim old versions if needed
    if (keyVersions.length > this.options.maxVersions) {
      keyVersions.shift();
    }

    // Trim global history
    if (this.changeHistory.length > this.options.maxVersions) {
      this.changeHistory.shift();
    }
  }

  private normalizeKey(key: string): string {
    return key.split(this.options.separator).join('.');
  }

  private validateType(
    type: ConfigSchema['type'],
    value: unknown
  ): boolean {
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
        return (
          typeof value === 'object' && value !== null && !Array.isArray(value)
        );
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
    value: ConfigValue & { metadata: ConfigMetadata }
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
    previousValue: ConfigValue & { metadata: ConfigMetadata },
    currentValue: ConfigValue & { metadata: ConfigMetadata }
  ): Promise<void> {
    // Emit to change listeners if needed
    // This would integrate with the event bus
  }

  private startCacheCleanup(): void {
    // Cleanup expired cache entries every minute
    setInterval(() => {
      const now = Date.now();

      for (const [key, entry] of this.cache.entries()) {
        if (entry.expires <= now) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('EnhancedConfigManager has been disposed');
    }
  }
}
