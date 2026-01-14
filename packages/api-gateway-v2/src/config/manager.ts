/**
 * Configuration Manager
 * Centralized configuration management with validation and defaults
 */

import { z } from 'zod';
import {
  GatewayConfig,
  GraphQLConfig,
  SubscriptionConfig,
  CompositionConfig,
  RateLimitConfig,
  VersioningConfig,
  ServiceConfig,
  GatewayError,
} from '../types';
import {
  validateFederationConfig,
  validateSubscriptionConfig,
  validateCompositionConfig,
  validateRateLimitConfig,
  validateVersioningConfig,
  validateAggregationConfig,
  createDefaultRateLimitConfig,
  createDefaultVersioningConfig,
  createDefaultAggregationConfig,
} from '../index';

// ============================================================================
// Configuration Schemas
// ============================================================================

const ServiceConfigSchema = z.object({
  name: z.string(),
  endpoint: z.string().url(),
  type: z.enum(['graphql', 'rest', 'grpc']),
  version: z.string().optional(),
  healthCheck: z.object({
    enabled: z.boolean(),
    interval: z.number().positive(),
    path: z.string(),
    timeout: z.number().positive(),
    unhealthyThreshold: z.number().positive(),
    healthyThreshold: z.number().positive(),
  }).optional(),
  timeout: z.number().positive().optional(),
  retryPolicy: z.object({
    maxAttempts: z.number().positive(),
    backoffMs: z.number().positive(),
    multiplier: z.number().positive(),
    retryableErrors: z.array(z.string()),
  }).optional(),
  headers: z.record(z.string()).optional(),
  authentication: z.object({
    type: z.enum(['jwt', 'api-key', 'oauth2', 'none']),
    credentials: z.record(z.string()).optional(),
  }).optional(),
});

const GatewayConfigSchema = z.object({
  services: z.array(ServiceConfigSchema),
  graphql: z.object({
    federation: z.object({
      enabled: z.boolean(),
      version: z.union([z.literal(1), z.literal(2)]),
      schemaPollingInterval: z.number().positive().optional(),
      queryPlanCache: z.object({
        enabled: z.boolean(),
        ttl: z.number().nonnegative(),
        maxSize: z.number().positive(),
      }).optional(),
    }),
    subscriptions: z.boolean(),
    playground: z.boolean(),
    introspection: z.boolean(),
    validation: z.object({
      complexityLimit: z.number().positive(),
      depthLimit: z.number().positive(),
      costLimit: z.number().positive(),
    }),
  }).optional(),
  subscriptions: z.object({
    enabled: z.boolean(),
    maxConnections: z.number().positive(),
    connectionTimeout: z.number().min(1000),
    heartbeatInterval: z.number().min(1000),
    messageQueueSize: z.number().positive(),
  }).optional(),
  composition: z.object({
    maxConcurrentRequests: z.number().positive(),
    defaultTimeout: z.number().min(100),
    orchestrationTimeout: z.number().positive(),
    cache: z.object({
      enabled: z.boolean(),
      ttl: z.number().nonnegative(),
      maxSize: z.number().positive(),
    }).optional(),
  }).optional(),
  rateLimit: z.object({
    enabled: z.boolean(),
    default: z.object({
      requests: z.number().positive(),
      window: z.number().positive(),
      burst: z.number().positive().optional(),
    }),
    endpoints: z.record(z.object({
      requests: z.number().positive(),
      window: z.number().positive(),
      burst: z.number().positive().optional(),
    })),
    storage: z.object({
      type: z.enum(['memory', 'redis', 'durable-object']),
      options: z.record(z.any()).optional(),
    }),
    algorithm: z.enum(['token-bucket', 'leaky-bucket', 'fixed-window', 'sliding-window']),
  }).optional(),
  versioning: z.object({
    strategy: z.enum(['url', 'header', 'query', 'content-type']),
    defaultVersion: z.string(),
    versions: z.array(z.object({
      version: z.string(),
      deprecated: z.boolean().optional(),
      sunsetAt: z.number().optional(),
      services: z.record(z.string()),
      headers: z.record(z.string()).optional(),
      transformations: z.array(z.any()).optional(),
    })),
  }).optional(),
});

// ============================================================================
// Configuration Manager
// ============================================================================

export class ConfigManager {
  private config: GatewayConfig;
  private overrides: Map<string, any>;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.overrides = new Map();
    this.validate();
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    try {
      GatewayConfigSchema.parse(this.config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new GatewayError(
          `Invalid configuration: ${error.errors.map(e => e.message).join(', ')}`,
          'INVALID_CONFIG',
          400,
          error.errors
        );
      }
      throw error;
    }

    // Additional validation
    if (this.config.graphql?.federation) {
      validateFederationConfig(this.config.graphql.federation);
    }

    if (this.config.subscriptions) {
      validateSubscriptionConfig(this.config.subscriptions);
    }

    if (this.config.composition) {
      validateCompositionConfig(this.config.composition);
    }

    if (this.config.rateLimit) {
      validateRateLimitConfig(this.config.rateLimit);
    }

    if (this.config.versioning) {
      validateVersioningConfig(this.config.versioning);
    }
  }

  /**
   * Get full configuration
   */
  getConfig(): GatewayConfig {
    return this.config;
  }

  /**
   * Get GraphQL configuration
   */
  getGraphQLConfig(): GraphQLConfig | undefined {
    return this.config.graphql;
  }

  /**
   * Get subscription configuration
   */
  getSubscriptionConfig(): SubscriptionConfig | undefined {
    return this.config.subscriptions;
  }

  /**
   * Get composition configuration
   */
  getCompositionConfig(): CompositionConfig | undefined {
    return this.config.config.composition;
  }

  /**
   * Get rate limit configuration
   */
  getRateLimitConfig(): RateLimitConfig | undefined {
    return this.config.rateLimit;
  }

  /**
   * Get versioning configuration
   */
  getVersioningConfig(): VersioningConfig | undefined {
    return this.config.versioning;
  }

  /**
   * Get service configuration by name
   */
  getServiceConfig(name: string): ServiceConfig | undefined {
    return this.config.services.find(s => s.name === name);
  }

  /**
   * Get all service configurations
   */
  getAllServiceConfigs(): ServiceConfig[] {
    return this.config.services;
  }

  /**
   * Set configuration override
   */
  setOverride(key: string, value: any): void {
    this.overrides.set(key, value);
    this.applyOverrides();
  }

  /**
   * Apply configuration overrides
   */
  private applyOverrides(): void {
    for (const [key, value] of this.overrides) {
      const keys = key.split('.');
      let current: any = this.config;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
    }

    this.validate();
  }

  /**
   * Clear all overrides
   */
  clearOverrides(): void {
    this.overrides.clear();
  }

  /**
   * Export configuration as JSON
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  static fromJSON(json: string): ConfigManager {
    const config = JSON.parse(json);
    return new ConfigManager(config);
  }
}

// ============================================================================
// Configuration Builders
// ============================================================================

/**
 * Build gateway configuration with defaults
 */
export function buildGatewayConfig(
  services: ServiceConfig[],
  options?: Partial<GatewayConfig>
): GatewayConfig {
  return {
    services,
    graphql: options?.graphql,
    subscriptions: options?.subscriptions,
    composition: options?.composition,
    rateLimit: options?.rateLimit || createDefaultRateLimitConfig(),
    versioning: options?.versioning || createDefaultVersioningConfig(),
  };
}

/**
 * Build GraphQL configuration with defaults
 */
export function buildGraphQLConfig(
  options?: Partial<GraphQLConfig>
): GraphQLConfig {
  return {
    federation: {
      enabled: options?.federation?.enabled || false,
      version: options?.federation?.version || 2,
      schemaPollingInterval: options?.federation?.schemaPollingInterval,
      queryPlanCache: options?.federation?.queryPlanCache,
    },
    subscriptions: options?.subscriptions || false,
    playground: options?.playground || false,
    introspection: options?.introspection || true,
    validation: options?.validation || {
      complexityLimit: 1000,
      depthLimit: 10,
      costLimit: 5000,
    },
  };
}

/**
 * Build subscription configuration with defaults
 */
export function buildSubscriptionConfig(
  options?: Partial<SubscriptionConfig>
): SubscriptionConfig {
  return {
    enabled: options?.enabled || false,
    maxConnections: options?.maxConnections || 1000,
    connectionTimeout: options?.connectionTimeout || 60000,
    heartbeatInterval: options?.heartbeatInterval || 30000,
    messageQueueSize: options?.messageQueueSize || 1000,
  };
}

/**
 * Build composition configuration with defaults
 */
export function buildCompositionConfig(
  options?: Partial<CompositionConfig>
): CompositionConfig {
  return {
    maxConcurrentRequests: options?.maxConcurrentRequests || 100,
    defaultTimeout: options?.defaultTimeout || 5000,
    orchestrationTimeout: options?.orchestrationTimeout || 30000,
    cache: options?.cache,
  };
}

// ============================================================================
// Environment-based Configuration
// ============================================================================

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<GatewayConfig> {
  const config: Partial<GatewayConfig> = {};

  // Load rate limiting config
  if (process.env.RATE_LIMIT_ENABLED) {
    config.rateLimit = {
      ...createDefaultRateLimitConfig(),
      enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    };
  }

  // Load GraphQL config
  if (process.env.GRAPHQL_ENABLED) {
    config.graphql = {
      ...buildGraphQLConfig(),
      federation: {
        enabled: process.env.GRAPHQL_FEDERATION_ENABLED === 'true',
        version: parseInt(process.env.GRAPHQL_FEDERATION_VERSION || '2') as 1 | 2,
      },
    };
  }

  // Load subscriptions config
  if (process.env.WS_ENABLED) {
    config.subscriptions = {
      ...buildSubscriptionConfig(),
      enabled: process.env.WS_ENABLED === 'true',
    };
  }

  return config;
}

/**
 * Load configuration from file
 */
export async function loadConfigFromFile(
  path: string
): Promise<GatewayConfig> {
  // In a real implementation, this would read from the filesystem
  // For now, return a default config
  return buildGatewayConfig([]);
}
