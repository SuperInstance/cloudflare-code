/**
 * Configuration Manager
 *
 * Provides dynamic configuration management with:
 * - Dynamic configuration updates
 * - Route configuration management
 * - Policy management
 * - Configuration validation
 * - Rollback support
 * - A/B testing configuration
 *
 * Features:
 * - Real-time configuration updates
 * - Version control for configurations
 * - Schema validation
 * - Rollback to previous versions
 * - Configuration diffing
 * - Hot reload support
 */

import type { GatewayConfig, Route, AuthConfig, RateLimitConfig, CacheConfig } from '../types';
import { z } from 'zod';

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  version: string;
  timestamp: number;
  changes: ConfigChange[];
  rollbackVersion?: string;
}

/**
 * Configuration change
 */
export interface ConfigChange {
  path: string;
  type: 'add' | 'update' | 'remove';
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Configuration version
 */
interface ConfigurationVersion {
  version: string;
  timestamp: number;
  config: GatewayConfig;
  checksum: string;
  createdBy?: string;
  description?: string;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Validation warning
 */
interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

/**
 * A/B test configuration
 */
export interface ABTestConfig {
  id: string;
  name: string;
  enabled: boolean;
  trafficSplit: number; // 0-1, percentage for variant B
  variantA: ConfigOverride;
  variantB: ConfigOverride;
  criteria: ABCriteria;
  startTime?: Date;
  endTime?: Date;
}

/**
 * Configuration override
 */
interface ConfigOverride {
  routes?: Partial<Route>[];
  auth?: Partial<AuthConfig>;
  rateLimit?: Partial<RateLimitConfig>;
  cache?: Partial<CacheConfig>;
  custom?: Record<string, unknown>;
}

/**
 * A/B test criteria
 */
interface ABCriteria {
  type: 'user_id' | 'org_id' | 'ip' | 'header' | 'cookie' | 'random';
  field?: string;
  consistencyKey?: string;
}

/**
 * Configuration manager options
 */
export interface ConfigManagerOptions {
  kv?: KVNamespace;
  enableValidation?: boolean;
  enableVersioning?: boolean;
  enableHotReload?: boolean;
  maxVersions?: number;
  rollbackOnValidationError?: boolean;
}

/**
 * Configuration Manager
 */
export class ConfigManager {
  private options: Required<ConfigManagerOptions>;
  private currentConfig: GatewayConfig;
  private configVersions: ConfigurationVersion[];
  private abTests: Map<string, ABTestConfig>;
  private changeListeners: Set<ConfigChangeListener>;
  private validationSchemas: Map<string, z.ZodSchema>;
  private currentVersion: string;

  constructor(
    initialConfig: GatewayConfig,
    options: ConfigManagerOptions = {}
  ) {
    this.options = {
      kv: options.kv,
      enableValidation: options.enableValidation ?? true,
      enableVersioning: options.enableVersioning ?? true,
      enableHotReload: options.enableHotReload ?? true,
      maxVersions: options.maxVersions ?? 10,
      rollbackOnValidationError: options.rollbackOnValidationError ?? false,
    };

    this.currentConfig = initialConfig;
    this.configVersions = [];
    this.abTests = new Map();
    this.changeListeners = new Set();
    this.validationSchemas = new Map();
    this.currentVersion = this.generateVersion();

    // Create initial version
    if (this.options.enableVersioning) {
      this.createVersion('Initial configuration');
    }

    // Load from KV if available
    if (this.options.kv) {
      this.loadFromKV().catch(console.error);
    }

    // Setup validation schemas
    this.setupValidationSchemas();

    // Start hot reload watcher
    if (this.options.enableHotReload && this.options.kv) {
      this.startHotReload();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(request?: Request): GatewayConfig {
    if (!request) {
      return this.currentConfig;
    }

    // Apply A/B test overrides if applicable
    const abTestConfig = this.getActiveABTest(request);
    if (abTestConfig) {
      return this.applyABTest(this.currentConfig, abTestConfig, request);
    }

    return this.currentConfig;
  }

  /**
   * Update configuration
   */
  async updateConfig(
    updates: Partial<GatewayConfig>,
    options: UpdateOptions = {}
  ): Promise<ValidationResult> {
    const { description, createdBy, validate = true } = options;

    // Calculate changes
    const changes = this.calculateChanges(this.currentConfig, updates);

    // Create new config
    const newConfig = {
      ...this.currentConfig,
      ...updates,
    };

    // Validate if enabled
    let validationResult: ValidationResult = { valid: true, errors: [], warnings: [] };

    if (validate && this.options.enableValidation) {
      validationResult = await this.validateConfig(newConfig);

      if (!validationResult.valid && this.options.rollbackOnValidationError) {
        return validationResult;
      }
    }

    // Apply updates
    const oldConfig = this.currentConfig;
    this.currentConfig = newConfig;

    // Create version
    if (this.options.enableVersioning) {
      this.currentVersion = this.createVersion(description, createdBy);
    }

    // Save to KV
    if (this.options.kv) {
      await this.saveToKV();
    }

    // Notify listeners
    await this.notifyListeners({
      version: this.currentVersion,
      timestamp: Date.now(),
      changes,
    });

    return validationResult;
  }

  /**
   * Update a specific route
   */
  async updateRoute(
    routeId: string,
    updates: Partial<Route>,
    options: UpdateOptions = {}
  ): Promise<ValidationResult> {
    const routeIndex = this.currentConfig.routes.findIndex(r => r.id === routeId);

    if (routeIndex === -1) {
      return {
        valid: false,
        errors: [
          {
            path: `routes.${routeId}`,
            message: `Route ${routeId} not found`,
            code: 'NOT_FOUND',
          },
        ],
        warnings: [],
      };
    }

    const updatedRoutes = [...this.currentConfig.routes];
    updatedRoutes[routeIndex] = {
      ...updatedRoutes[routeIndex],
      ...updates,
    };

    return await this.updateConfig({ routes: updatedRoutes }, options);
  }

  /**
   * Add a route
   */
  async addRoute(route: Route, options: UpdateOptions = {}): Promise<ValidationResult> {
    const updatedRoutes = [...this.currentConfig.routes, route];

    return await this.updateConfig({ routes: updatedRoutes }, options);
  }

  /**
   * Remove a route
   */
  async removeRoute(routeId: string, options: UpdateOptions = {}): Promise<ValidationResult> {
    const updatedRoutes = this.currentConfig.routes.filter(r => r.id !== routeId);

    return await this.updateConfig({ routes: updatedRoutes }, options);
  }

  /**
   * Rollback to a previous version
   */
  async rollback(version?: string): Promise<boolean> {
    let targetVersion: ConfigurationVersion | undefined;

    if (version) {
      targetVersion = this.configVersions.find(v => v.version === version);
    } else {
      // Rollback to previous version
      const currentIndex = this.configVersions.findIndex(
        v => v.version === this.currentVersion
      );
      if (currentIndex > 0) {
        targetVersion = this.configVersions[currentIndex - 1];
      }
    }

    if (!targetVersion) {
      return false;
    }

    this.currentConfig = targetVersion.config;
    this.currentVersion = targetVersion.version;

    // Save to KV
    if (this.options.kv) {
      await this.saveToKV();
    }

    // Notify listeners
    await this.notifyListeners({
      version: this.currentVersion,
      timestamp: Date.now(),
      changes: [],
      rollbackVersion: version,
    });

    return true;
  }

  /**
   * Get configuration history
   */
  getHistory(limit?: number): ConfigurationVersion[] {
    const versions = [...this.configVersions].reverse();

    if (limit) {
      return versions.slice(0, limit);
    }

    return versions;
  }

  /**
   * Get configuration diff
   */
  diff(versionA: string, versionB: string): ConfigChange[] {
    const configA = this.configVersions.find(v => v.version === versionA)?.config;
    const configB = this.configVersions.find(v => v.version === versionB)?.config;

    if (!configA || !configB) {
      return [];
    }

    return this.calculateChanges(configA, configB);
  }

  /**
   * Add an A/B test
   */
  addABTest(test: ABTestConfig): void {
    this.abTests.set(test.id, test);
  }

  /**
   * Remove an A/B test
   */
  removeABTest(testId: string): boolean {
    return this.abTests.delete(testId);
  }

  /**
   * Get A/B test
   */
  getABTest(testId: string): ABTestConfig | undefined {
    return this.abTests.get(testId);
  }

  /**
   * Get all A/B tests
   */
  getAllABTests(): ABTestConfig[] {
    return Array.from(this.abTests.values());
  }

  /**
   * Register a change listener
   */
  onChange(listener: ConfigChangeListener): void {
    this.changeListeners.add(listener);
  }

  /**
   * Remove a change listener
   */
  offChange(listener: ConfigChangeListener): void {
    this.changeListeners.delete(listener);
  }

  /**
   * Validate configuration
   */
  async validateConfig(config: GatewayConfig): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate routes
    for (const route of config.routes) {
      const routeErrors = this.validateRoute(route);
      errors.push(...routeErrors);
    }

    // Validate auth config
    if (config.defaultAuth) {
      const authErrors = this.validateAuthConfig(config.defaultAuth);
      errors.push(...authErrors);
    }

    // Validate rate limit config
    if (config.defaultRateLimit) {
      const rateLimitErrors = this.validateRateLimitConfig(config.defaultRateLimit);
      errors.push(...rateLimitErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculate changes (private helper)
   */
  private calculateChanges(
    oldConfig: GatewayConfig,
    updates: Partial<GatewayConfig>
  ): ConfigChange[] {
    const changes: ConfigChange[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (JSON.stringify(oldConfig[key as keyof GatewayConfig]) !== JSON.stringify(value)) {
        changes.push({
          path: key,
          type: oldConfig[key as keyof GatewayConfig] !== undefined ? 'update' : 'add',
          oldValue: oldConfig[key as keyof GatewayConfig],
          newValue: value,
        });
      }
    }

    return changes;
  }

  /**
   * Create configuration version (private helper)
   */
  private createVersion(description?: string, createdBy?: string): string {
    const version = this.generateVersion();
    const checksum = this.calculateChecksum(this.currentConfig);

    const configVersion: ConfigurationVersion = {
      version,
      timestamp: Date.now(),
      config: JSON.parse(JSON.stringify(this.currentConfig)),
      checksum,
      createdBy,
      description,
    };

    this.configVersions.push(configVersion);

    // Keep only max versions
    if (this.configVersions.length > this.options.maxVersions) {
      this.configVersions.shift();
    }

    return version;
  }

  /**
   * Generate version string (private helper)
   */
  private generateVersion(): string {
    return `v${Date.now()}`;
  }

  /**
   * Calculate checksum (private helper)
   */
  private calculateChecksum(config: GatewayConfig): string {
    const str = JSON.stringify(config);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Notify listeners (private helper)
   */
  private async notifyListeners(event: ConfigChangeEvent): Promise<void> {
    for (const listener of this.changeListeners) {
      try {
        await listener(event);
      } catch (error) {
        console.error('Config change listener error:', error);
      }
    }
  }

  /**
   * Get active A/B test (private helper)
   */
  private getActiveABTest(request: Request): ABTestConfig | null {
    for (const test of this.abTests.values()) {
      if (!test.enabled) continue;

      // Check time bounds
      if (test.startTime && Date.now() < test.startTime.getTime()) continue;
      if (test.endTime && Date.now() > test.endTime.getTime()) continue;

      // Check criteria
      if (this.shouldUseVariantB(test, request)) {
        return test;
      }
    }

    return null;
  }

  /**
   * Determine if should use variant B (private helper)
   */
  private shouldUseVariantB(test: ABTestConfig, request: Request): boolean {
    const random = Math.random();

    switch (test.criteria.type) {
      case 'random':
        return random < test.trafficSplit;

      case 'user_id':
      case 'org_id':
      case 'ip':
      case 'header':
      case 'cookie':
        // Consistent hashing based on criteria
        // This is simplified - a real implementation would use proper hashing
        const value = request.headers.get(test.criteria.field || 'X-User-ID') || 'default';
        const hash = this.hashString(value);
        return (hash % 100) < (test.trafficSplit * 100);

      default:
        return random < test.trafficSplit;
    }
  }

  /**
   * Apply A/B test (private helper)
   */
  private applyABTest(
    config: GatewayConfig,
    test: ABTestConfig,
    request: Request
  ): GatewayConfig {
    const useVariantB = this.shouldUseVariantB(test, request);
    const override = useVariantB ? test.variantB : test.variantA;

    return {
      ...config,
      ...override,
    };
  }

  /**
   * Hash string (private helper)
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Load from KV (private helper)
   */
  private async loadFromKV(): Promise<void> {
    if (!this.options.kv) return;

    try {
      const key = 'config:current';
      const data = await this.options.kv.get(key, 'json');

      if (data && typeof data === 'object') {
        this.currentConfig = data as GatewayConfig;
      }
    } catch (error) {
      console.error('Config KV load error:', error);
    }
  }

  /**
   * Save to KV (private helper)
   */
  private async saveToKV(): Promise<void> {
    if (!this.options.kv) return;

    try {
      const key = 'config:current';
      await this.options.kv.put(key, JSON.stringify(this.currentConfig), {
        expirationTtl: 86400, // 1 day
      });
    } catch (error) {
      console.error('Config KV save error:', error);
    }
  }

  /**
   * Start hot reload (private helper)
   */
  private startHotReload(): void {
    // In a real implementation, watch for KV changes
    // This could use KV's watch API or polling
    setInterval(async () => {
      await this.loadFromKV();
    }, 60000); // Check every minute
  }

  /**
   * Setup validation schemas (private helper)
   */
  private setupValidationSchemas(): void {
    // Route schema
    this.validationSchemas.set('route', z.object({
      id: z.string(),
      name: z.string(),
      path: z.string(),
      methods: z.array(z.string()),
      upstream: z.object({
        type: z.enum(['single', 'load_balanced', 'weighted']),
        targets: z.array(z.object({
          id: z.string(),
          url: z.string().url(),
        })),
      }),
    }));

    // Add more schemas as needed
  }

  /**
   * Validate route (private helper)
   */
  private validateRoute(route: Route): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!route.id) {
      errors.push({
        path: 'route.id',
        message: 'Route ID is required',
        code: 'REQUIRED',
      });
    }

    if (!route.path) {
      errors.push({
        path: 'route.path',
        message: 'Route path is required',
        code: 'REQUIRED',
      });
    }

    if (!route.methods || route.methods.length === 0) {
      errors.push({
        path: 'route.methods',
        message: 'Route must have at least one method',
        code: 'REQUIRED',
      });
    }

    return errors;
  }

  /**
   * Validate auth config (private helper)
   */
  private validateAuthConfig(config: AuthConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    if (config.required && config.methods.length === 0) {
      errors.push({
        path: 'auth.methods',
        message: 'At least one auth method is required when auth is required',
        code: 'REQUIRED',
      });
    }

    return errors;
  }

  /**
   * Validate rate limit config (private helper)
   */
  private validateRateLimitConfig(config: RateLimitConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    if (config.enabled && config.limits.length === 0) {
      errors.push({
        path: 'rateLimit.limits',
        message: 'At least one rate limit is required when rate limiting is enabled',
        code: 'REQUIRED',
      });
    }

    return errors;
  }
}

/**
 * Config change listener
 */
type ConfigChangeListener = (event: ConfigChangeEvent) => void | Promise<void>;

/**
 * Update options
 */
interface UpdateOptions {
  description?: string;
  createdBy?: string;
  validate?: boolean;
}

/**
 * Create a configuration manager
 */
export function createConfigManager(
  config: GatewayConfig,
  options?: ConfigManagerOptions
): ConfigManager {
  return new ConfigManager(config, options);
}
