/**
 * Configuration Types
 *
 * Type definitions for platform configuration management.
 */

/**
 * Configuration source
 */
export enum ConfigSource {
  ENVIRONMENT = 'environment',
  FILE = 'file',
  REMOTE = 'remote',
  DEFAULT = 'default',
}

/**
 * Configuration value
 */
export interface ConfigValue<T = unknown> {
  readonly value: T;
  readonly source: ConfigSource;
  readonly overridden: boolean;
  readonly schema?: string;
  readonly validation?: ValidationResult;
}

/**
 * Configuration schema
 */
export interface ConfigSchema {
  readonly type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  readonly properties?: Record<string, ConfigSchema>;
  readonly items?: ConfigSchema;
  readonly required?: readonly string[];
  readonly default?: unknown;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: RegExp;
  readonly format?: string;
  readonly description?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<ValidationError>;
  readonly warnings: ReadonlyArray<ValidationWarning>;
}

/**
 * Validation error
 */
export interface ValidationError {
  readonly path: string;
  readonly message: string;
  readonly value: unknown;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  readonly path: string;
  readonly message: string;
  readonly value: unknown;
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  readonly key: string;
  readonly previousValue: ConfigValue;
  readonly currentValue: ConfigValue;
  readonly timestamp: number;
}

/**
 * Configuration loader
 */
export interface ConfigLoader {
  readonly source: ConfigSource;
  load(): Promise<Record<string, unknown>>;
  watch?(callback: (changes: Record<string, unknown>) => void): () => void;
}

/**
 * Configuration watcher
 */
export interface ConfigWatcher {
  readonly key: string;
  readonly callback: (value: ConfigValue) => void;
  readonly immediate: boolean;
}

/**
 * Configuration options
 */
export interface ConfigOptions {
  readonly sources?: ReadonlyArray<ConfigSource>;
  readonly schema?: ConfigSchema;
  readonly validateOnChange?: boolean;
  readonly enableWatchers?: boolean;
  readonly separator?: string;
  readonly transform?: (key: string, value: unknown) => unknown;
}
