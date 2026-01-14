/**
 * Configuration Validation
 *
 * Provides schema validation using Zod for all configuration types.
 * Ensures configuration integrity and prevents invalid states.
 */

import { z } from 'zod';
import type {
  AppConfig,
  FeatureFlag,
  Experiment,
  ConfigValidationResult,
  ProviderRoutingConfig,
  RateLimitConfig,
  UIConfig,
  CacheConfig,
  MonitoringConfig,
  SecurityConfig,
} from './types';

/**
 * Feature flag targeting schema
 */
const FeatureFlagTargetingSchema = z.object({
  users: z.array(z.string()).default([]),
  percentage: z.number().min(0).max(100).default(0),
  organizations: z.array(z.string()).default([]),
  tier: z.enum(['free', 'pro', 'enterprise', 'all']).default('all'),
  custom: z.object({
    country: z.array(z.string()).optional(),
    region: z.array(z.string()).optional(),
    environment: z.enum(['development', 'staging', 'production']).optional(),
    userAgent: z.array(z.string()).optional(),
    ipRange: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * Feature flag schema
 */
export const FeatureFlagSchema = z.object({
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(false),
  targeting: FeatureFlagTargetingSchema,
  description: z.string().max(500).optional(),
  owner: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.number().int().positive().default(() => Date.now()),
  updatedAt: z.number().int().positive().default(() => Date.now()),
  expiresAt: z.number().int().positive().optional(),
});

/**
 * Experiment variant schema
 */
const ExperimentVariantSchema = z.object({
  name: z.string().min(1).max(50),
  weight: z.number().min(0).max(1),
  config: z.record(z.unknown()).default({}),
  description: z.string().max(500).optional(),
});

/**
 * Experiment schema
 */
export const ExperimentSchema = z.object({
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(false),
  variants: z.array(ExperimentVariantSchema).min(1),
  targeting: FeatureFlagTargetingSchema,
  metrics: z.array(z.string()).min(1),
  hypothesis: z.string().max(1000).optional(),
  successCriteria: z.string().max(500).optional(),
  startedAt: z.number().int().positive().optional(),
  endsAt: z.number().int().positive().optional(),
  requiredSampleSize: z.number().int().positive().optional(),
  currentSampleSize: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.number().int().positive().default(() => Date.now()),
  updatedAt: z.number().int().positive().default(() => Date.now()),
});

/**
 * Provider settings schema
 */
const ProviderSettingsSchema = z.object({
  priority: z.number().int().positive().optional(),
  maxConcurrent: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
  costMultiplier: z.number().positive().optional(),
});

/**
 * Provider routing schema
 */
export const ProviderRoutingConfigSchema = z.object({
  defaultProvider: z.string().min(1),
  fallbackChain: z.array(z.string()).min(1),
  modelPreferences: z.record(z.string()),
  providerSettings: z.record(ProviderSettingsSchema).default({}),
});

/**
 * Rate limit tier schema
 */
const RateLimitTierSchema = z.object({
  rpm: z.number().int().positive(),
  rpd: z.number().int().positive(),
  tpm: z.number().int().positive().optional(),
});

/**
 * Rate limit config schema
 */
export const RateLimitConfigSchema = z.object({
  free: RateLimitTierSchema,
  pro: RateLimitTierSchema,
  enterprise: RateLimitTierSchema,
});

/**
 * UI features schema
 */
const UIFeaturesSchema = z.object({
  websockets: z.boolean(),
  codeIndexing: z.boolean(),
  advancedCache: z.boolean(),
  fileUploads: z.boolean(),
  collaboration: z.boolean(),
});

/**
 * UI config schema
 */
export const UIConfigSchema = z.object({
  maxMessageLength: z.number().int().positive().max(100000),
  enableStreaming: z.boolean(),
  theme: z.enum(['light', 'dark', 'auto']),
  features: UIFeaturesSchema,
});

/**
 * KV cache config schema
 */
const KVCacheConfigSchema = z.object({
  defaultTTL: z.number().int().positive(),
  compression: z.boolean(),
  maxSize: z.number().int().positive(),
});

/**
 * DO cache config schema
 */
const DOCacheConfigSchema = z.object({
  maxEntries: z.number().int().positive(),
  ttl: z.number().int().positive(),
  persistence: z.boolean(),
});

/**
 * Cache config schema
 */
export const CacheConfigSchema = z.object({
  kv: KVCacheConfigSchema,
  do: DOCacheConfigSchema,
});

/**
 * Metrics config schema
 */
const MetricsConfigSchema = z.object({
  enabled: z.boolean(),
  samplingRate: z.number().min(0).max(1),
  exportInterval: z.number().int().positive(),
  includeMetrics: z.array(z.string()),
});

/**
 * Logging config schema
 */
const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  structured: z.boolean(),
  samplingRate: z.number().min(0).max(1),
});

/**
 * Tracing config schema
 */
const TracingConfigSchema = z.object({
  enabled: z.boolean(),
  samplingRate: z.number().min(0).max(1),
  exportEndpoint: z.string().url().optional(),
});

/**
 * Monitoring config schema
 */
export const MonitoringConfigSchema = z.object({
  metrics: MetricsConfigSchema,
  logging: LoggingConfigSchema,
  tracing: TracingConfigSchema,
});

/**
 * Auth config schema
 */
const AuthConfigSchema = z.object({
  sessionDuration: z.number().int().positive(),
  maxSessionsPerUser: z.number().int().positive(),
  mfaEnabled: z.boolean(),
  allowedOrigins: z.array(z.string().url()),
});

/**
 * CSP config schema
 */
const CSPConfigSchema = z.object({
  enabled: z.boolean(),
  policy: z.string(),
});

/**
 * Rate limiting config schema
 */
const RateLimitingConfigSchema = z.object({
  enabled: z.boolean(),
  strategy: z.enum(['token-bucket', 'sliding-window', 'fixed-window']),
  limits: RateLimitConfigSchema,
});

/**
 * Security config schema
 */
export const SecurityConfigSchema = z.object({
  rateLimiting: RateLimitingConfigSchema,
  auth: AuthConfigSchema,
  csp: CSPConfigSchema,
});

/**
 * Features config schema
 */
const FeaturesConfigSchema = z.object({
  websockets: FeatureFlagSchema,
  codeIndexing: FeatureFlagSchema,
  advancedCache: FeatureFlagSchema,
  realTimeCollaboration: FeatureFlagSchema,
  fileUploads: FeatureFlagSchema,
});

/**
 * Complete app config schema
 */
export const AppConfigSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  environment: z.enum(['development', 'staging', 'production']),
  features: FeaturesConfigSchema,
  providers: ProviderRoutingConfigSchema,
  rateLimits: RateLimitConfigSchema,
  ui: UIConfigSchema,
  cache: CacheConfigSchema,
  monitoring: MonitoringConfigSchema,
  security: SecurityConfigSchema,
});

/**
 * Configuration validator class
 */
export class ConfigValidator {
  /**
   * Validate feature flag
   */
  static validateFeatureFlag(data: unknown): ConfigValidationResult {
    return this.validate(FeatureFlagSchema, data, 'feature flag');
  }

  /**
   * Validate experiment
   */
  static validateExperiment(data: unknown): ConfigValidationResult {
    const result = this.validate(ExperimentSchema, data, 'experiment');

    // Additional validation: variant weights should sum to 1
    if (result.valid && typeof data === 'object' && data !== null) {
      const experiment = data as z.infer<typeof ExperimentSchema>;
      const totalWeight = experiment.variants.reduce(
        (sum, v) => sum + v.weight,
        0
      );

      if (Math.abs(totalWeight - 1.0) > 0.001) {
        return {
          valid: false,
          errors: [`Variant weights must sum to 1.0 (current: ${totalWeight.toFixed(3)})`],
          warnings: [],
        };
      }
    }

    return result;
  }

  /**
   * Validate provider routing config
   */
  static validateProviderRouting(data: unknown): ConfigValidationResult {
    return this.validate(ProviderRoutingConfigSchema, data, 'provider routing');
  }

  /**
   * Validate rate limit config
   */
  static validateRateLimit(data: unknown): ConfigValidationResult {
    return this.validate(RateLimitConfigSchema, data, 'rate limits');
  }

  /**
   * Validate UI config
   */
  static validateUIConfig(data: unknown): ConfigValidationResult {
    return this.validate(UIConfigSchema, data, 'UI config');
  }

  /**
   * Validate cache config
   */
  static validateCacheConfig(data: unknown): ConfigValidationResult {
    return this.validate(CacheConfigSchema, data, 'cache config');
  }

  /**
   * Validate monitoring config
   */
  static validateMonitoringConfig(data: unknown): ConfigValidationResult {
    return this.validate(MonitoringConfigSchema, data, 'monitoring config');
  }

  /**
   * Validate security config
   */
  static validateSecurityConfig(data: unknown): ConfigValidationResult {
    return this.validate(SecurityConfigSchema, data, 'security config');
  }

  /**
   * Validate complete app config
   */
  static validateAppConfig(data: unknown): ConfigValidationResult {
    return this.validate(AppConfigSchema, data, 'app config');
  }

  /**
   * Validate using Zod schema
   */
  private static validate<T extends z.ZodType>(
    schema: T,
    data: unknown,
    context: string
  ): ConfigValidationResult {
    const result = schema.safeParse(data);

    if (result.success) {
      return {
        valid: true,
        errors: [],
        warnings: this.generateWarnings(data, context),
      };
    }

    const errors = result.error.errors.map((err) => {
      const path = err.path.join('.');
      return `${path ? path + ': ' : ''}${err.message}`;
    });

    return {
      valid: false,
      errors,
      warnings: [],
      path: result.error.errors[0]?.path.join('.'),
    };
  }

  /**
   * Generate validation warnings
   */
  private static generateWarnings(data: unknown, context: string): string[] {
    const warnings: string[] = [];

    if (typeof data === 'object' && data !== null) {
      // Check for empty arrays
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length === 0) {
          warnings.push(`${context}.${key} is empty`);
        }
      }

      // Check for optional values that might need attention
      if ('expiresAt' in data && data.expiresAt === undefined) {
        warnings.push(`${context}.expiresAt is not set (feature will not expire)`);
      }

      if ('description' in data && data.description === undefined) {
        warnings.push(`${context}.description is not set (recommended for documentation)`);
      }
    }

    return warnings;
  }

  /**
   * Validate feature flag targeting rules
   */
  static validateTargeting(data: unknown): ConfigValidationResult {
    return this.validate(FeatureFlagTargetingSchema, data, 'targeting');
  }

  /**
   * Validate experiment variant
   */
  static validateVariant(data: unknown): ConfigValidationResult {
    return this.validate(ExperimentVariantSchema, data, 'variant');
  }

  /**
   * Validate partial config update
   */
  static validatePartialUpdate(
    path: string,
    value: unknown
  ): ConfigValidationResult {
    // Determine which schema to use based on path
    const schemaMap: Record<string, z.ZodType> = {
      'features': FeaturesConfigSchema,
      'providers': ProviderRoutingConfigSchema,
      'rateLimits': RateLimitConfigSchema,
      'ui': UIConfigSchema,
      'cache': CacheConfigSchema,
      'monitoring': MonitoringConfigSchema,
      'security': SecurityConfigSchema,
    };

    const topLevelKey = path.split('.')[0];
    const schema = schemaMap[topLevelKey];

    if (!schema) {
      return {
        valid: false,
        errors: [`Unknown config path: ${path}`],
        warnings: [],
      };
    }

    return this.validate(schema, { [topLevelKey]: value }, path);
  }

  /**
   * Validate configuration rollback
   */
  static validateRollback(
    currentVersion: number,
    targetVersion: number
  ): ConfigValidationResult {
    if (targetVersion < 0) {
      return {
        valid: false,
        errors: ['Target version cannot be negative'],
        warnings: [],
      };
    }

    if (targetVersion >= currentVersion) {
      return {
        valid: false,
        errors: [`Cannot rollback to version ${targetVersion} (current: ${currentVersion})`],
        warnings: [],
      };
    }

    if (targetVersion === currentVersion - 1) {
      return {
        valid: true,
        errors: [],
        warnings: ['Rolling back to previous version'],
      };
    }

    return {
      valid: true,
      errors: [],
      warnings: [`Rolling back ${currentVersion - targetVersion} versions`],
    };
  }
}

/**
 * Helper function to validate config
 */
export function validateConfig<T>(
  schema: z.ZodType<T>,
  data: unknown
): ConfigValidationResult {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }

  const errors = result.error.errors.map((err) => {
    const path = err.path.join('.');
    return `${path ? path + ': ' : ''}${err.message}`;
  });

  return {
    valid: false,
    errors,
    warnings: [],
    path: result.error.errors[0]?.path.join('.'),
  };
}

/**
 * Helper function to assert config is valid
 */
export function assertValidConfig<T>(
  schema: z.ZodType<T>,
  data: unknown
): asserts data is T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((err) => {
      const path = err.path.join('.');
      return `${path ? path + ': ' : ''}${err.message}`;
    });
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
