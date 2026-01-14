/**
 * Configuration Management System
 *
 * Comprehensive configuration management for ClaudeFlare including:
 * - Feature flags with targeting
 * - Dynamic configuration with hot-reload
 * - A/B testing framework
 * - Remote configuration sync
 * - Configuration validation
 * - Rollback and versioning
 *
 * @example
 * ```typescript
 * import { FeatureFlagManager, DynamicConfigManager, ABTestingManager } from '@claudeflare/edge/config';
 *
 * // Feature flags
 * const flags = new FeatureFlagManager();
 * const isEnabled = flags.isEnabled('new-feature', { userId: 'user-123' });
 *
 * // Dynamic config
 * const config = new DynamicConfigManager(initialConfig);
 * await config.setValue('feature.flag', true, 'admin');
 *
 * // A/B testing
 * const abTest = new ABTestingManager();
 * const variant = abTest.assignVariant('experiment-1', { userId: 'user-123' });
 * ```
 */

// Type definitions
export type {
  // Core types
  AppConfig,
  ConfigVersion,
  ConfigChange,
  ConfigValidationResult,
  ConfigSyncStatus,
  ConfigSnapshot,
  ConfigExport,

  // Feature flags
  FeatureFlag,
  FeatureFlagTargeting,
  EvaluationContext,
  EvaluationResult,

  // A/B testing
  Experiment,
  ExperimentVariant,
  AssignmentResult,

  // Configuration sections
  ProviderRoutingConfig,
  RateLimitConfig,
  UIConfig,
  CacheConfig,
  MonitoringConfig,
  SecurityConfig,
} from './types';

// Feature flags
export {
  FeatureFlagManager,
  createFeatureFlag,
  createPercentageRolloutFlag,
  createUserTargetedFlag,
  createTierTargetedFlag,
} from './feature-flags';

// A/B testing
export {
  ABTestingManager,
  createExperiment,
  createABTest,
  createMultiVariantTest,
} from './ab-testing';

// Dynamic configuration
export { DynamicConfigManager } from './dynamic';
export type { ConfigSubscriber } from './dynamic';

// Validation
export {
  ConfigValidator,
  validateConfig,
  assertValidConfig,
} from './validation';

// Remote sync
export {
  ConfigSyncManager,
  MultiRegionConfigSync,
  createConfigSyncManager,
} from './sync';
export type { ConfigSyncOptions, ConfigSyncResult } from './sync';

// Durable Object store
export { ConfigDurableObject } from './store';

// Default configuration
export { getDefaultAppConfig } from './defaults';

/**
 * Create a complete configuration management system
 */
export function createConfigSystem(options: {
  kv: KVNamespace;
  initialConfig?: Partial<AppConfig>;
  syncOptions?: import('./sync').ConfigSyncOptions;
}) {
  const { kv, initialConfig, syncOptions } = options;

  // Import KVCache
  const { KVCache } = require('../kv');
  const kvCache = new KVCache(kv);

  // Get default config and merge with initial
  const { getDefaultAppConfig } = require('./defaults');
  const defaultConfig = getDefaultAppConfig();
  const config = initialConfig
    ? deepMerge(defaultConfig, initialConfig)
    : defaultConfig;

  // Create managers
  const dynamicConfig = new DynamicConfigManager(config);
  const syncManager = new ConfigSyncManager(kvCache, syncOptions);
  const featureFlags = new FeatureFlagManager(
    Object.values(config.features).map((f: any) => ({
      ...f,
      targeting: f.targeting || {
        users: [],
        percentage: 0,
        organizations: [],
        tier: 'all',
      },
      metadata: f.metadata || {},
      createdAt: f.createdAt || Date.now(),
      updatedAt: f.updatedAt || Date.now(),
    }))
  );
  const abTesting = new ABTestingManager();

  return {
    config: dynamicConfig,
    sync: syncManager,
    flags: featureFlags,
    experiments: abTesting,

    /**
     * Initialize the configuration system
     */
    async initialize() {
      await syncManager.initialize();
    },

    /**
     * Sync configuration from remote
     */
    async sync() {
      return syncManager.sync();
    },

    /**
     * Push configuration to remote
     */
    async push() {
      return syncManager.push(dynamicConfig.getConfig(), dynamicConfig.getCurrentVersion());
    },

    /**
     * Cleanup resources
     */
    destroy() {
      syncManager.destroy();
    },
  };
}

/**
 * Deep merge helper
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          (output as Record<string, unknown>)[key] = deepMerge(
            target[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>
          );
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }

  return output;
}

function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}
