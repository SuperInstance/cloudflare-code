/**
 * ClaudeFlare Feature Flags System
 * Advanced feature flag management with A/B testing, canary deployments, and real-time updates
 */

// ============================================================================
// Core Types
// ============================================================================

export * from './types/index.js';

// ============================================================================
// Flag Management
// ============================================================================

export {
  FlagManager,
  FlagValidator,
} from './flags/manager.js';

// ============================================================================
// Rollout Engine
// ============================================================================

export {
  RolloutEngine,
} from './rollout/engine.js';

// ============================================================================
// A/B Testing
// ============================================================================

export {
  ABTestingEngine,
  StatisticalAnalyzer,
} from './abtesting/engine.js';

// ============================================================================
// Targeting
// ============================================================================

export {
  TargetingEngine,
  SegmentBuilder,
  GeoAttributeProvider,
  DeviceAttributeProvider,
  CompositeAttributeProvider,
  type AttributeProvider,
} from './targeting/engine.js';

// ============================================================================
// Analytics
// ============================================================================

export {
  AnalyticsEngine,
  AnalyticsReporter,
  MetricsCollector,
} from './analytics/engine.js';

// ============================================================================
// Storage
// ============================================================================

export {
  FlagStorageDurableObject,
  AnalyticsStorageDurableObject,
} from './storage/flag-storage.js';

export {
  FlagCache,
  MultiLevelCache,
  CacheKeyGenerator,
} from './storage/cache.js';

// ============================================================================
// Utilities
// ============================================================================

export * from './utils/helpers.js';

// ============================================================================
// Main Feature Flags Client
// ============================================================================

import type {
  FeatureFlagsConfig,
  Flag,
  FlagValueType,
  EvaluationContext,
  EvaluationResult,
  BatchEvaluationResult,
  UserAttributes,
  FlagStorageEnv,
} from './types/index.js';
import { FlagManager } from './flags/manager.js';
import { RolloutEngine } from './rollout/engine.js';
import { ABTestingEngine } from './abtesting/engine.js';
import { TargetingEngine } from './targeting/engine.js';
import { AnalyticsEngine } from './analytics/engine.js';
import { FlagCache, CacheKeyGenerator } from './storage/cache.js';

/**
 * Main Feature Flags Client
 * Provides unified access to all feature flag functionality
 */
export class FeatureFlagsClient {
  private flagManager: FlagManager;
  private rolloutEngine: RolloutEngine;
  private abTestingEngine: ABTestingEngine;
  private targetingEngine: TargetingEngine;
  private analyticsEngine: AnalyticsEngine;
  private cache: FlagCache<EvaluationResult<FlagValueType>>;
  private config: FeatureFlagsConfig;

  constructor(env: FlagStorageEnv, config: Partial<FeatureFlagsConfig> = {}) {
    this.config = {
      storage: config.storage || {
        type: 'durable_object',
      },
      cache: config.cache || {
        enabled: true,
        ttl: 60_000,
        maxSize: 10000,
        strategy: 'lru',
      },
      analytics: config.analytics || {
        enabled: true,
        sampleRate: 1.0,
        batchSize: 100,
        flushInterval: 10_000,
      },
      performance: config.performance || {
        maxEvaluationTime: 1000,
        cacheStrategy: 'balanced',
        enableParallelEvaluation: true,
      },
    };

    this.flagManager = new FlagManager(env);
    this.rolloutEngine = new RolloutEngine(env);
    this.abTestingEngine = new ABTestingEngine(env);
    this.targetingEngine = new TargetingEngine(env);
    this.analyticsEngine = new AnalyticsEngine(env, this.config.analytics);
    this.cache = new FlagCache({
      maxSize: this.config.cache.maxSize,
      defaultTTL: this.config.cache.ttl,
      strategy: this.config.cache.strategy,
    });
  }

  // ========================================================================
  // Flag Evaluation
  // ========================================================================

  /**
   * Evaluate a single flag
   * Sub-millisecond performance with caching
   */
  async evaluateFlag(
    flagKey: string,
    context: EvaluationContext
  ): Promise<EvaluationResult<FlagValueType>> {
    // Check cache first
    const cacheKey = CacheKeyGenerator.forFlagEvaluation(
      flagKey,
      context.userId,
      context.attributes.customAttributes
    );

    if (this.config.cache.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Evaluate flag
    const result = await this.flagManager.evaluateFlag(flagKey, context);

    // Cache result
    if (this.config.cache.enabled) {
      this.cache.set(cacheKey, result, this.config.cache.ttl);
    }

    // Record analytics
    if (this.config.analytics.enabled) {
      await this.analyticsEngine.recordEvaluation({
        flagId: flagKey,
        flagKey,
        userId: context.userId,
        value: result.value,
        variant: result.variant,
        timestamp: result.timestamp,
        evaluationDetails: {
          evaluationTime: result.evaluationTime,
          source: 'cache',
          matchedVariant: result.variant,
        },
      });
    }

    return result;
  }

  /**
   * Evaluate multiple flags
   */
  async batchEvaluateFlags(
    flagKeys: string[],
    context: EvaluationContext
  ): Promise<BatchEvaluationResult> {
    const results: Record<string, EvaluationResult> = {};
    const errors: Record<string, string> = {};

    if (this.config.performance.enableParallelEvaluation) {
      // Parallel evaluation
      const evaluations = flagKeys.map(async (key) => {
        try {
          const result = await this.evaluateFlag(key, context);
          return { key, result, error: null };
        } catch (error) {
          return {
            key,
            result: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const settled = await Promise.all(evaluations);
      for (const evaluation of settled) {
        if (evaluation.error) {
          errors[evaluation.key] = evaluation.error;
        } else {
          results[evaluation.key] = evaluation.result!;
        }
      }
    } else {
      // Sequential evaluation
      for (const key of flagKeys) {
        try {
          const result = await this.evaluateFlag(key, context);
          results[key] = result;
        } catch (error) {
          errors[key] =
            error instanceof Error ? error.message : String(error);
        }
      }
    }

    return { results, errors };
  }

  /**
   * Get flag value with type safety
   */
  async getBooleanFlag(
    flagKey: string,
    context: EvaluationContext,
    defaultValue: boolean = false
  ): Promise<boolean> {
    try {
      const result = await this.evaluateFlag(flagKey, context);
      return result.value as boolean;
    } catch {
      return defaultValue;
    }
  }

  async getStringFlag(
    flagKey: string,
    context: EvaluationContext,
    defaultValue: string = ''
  ): Promise<string> {
    try {
      const result = await this.evaluateFlag(flagKey, context);
      return result.value as string;
    } catch {
      return defaultValue;
    }
  }

  async getNumberFlag(
    flagKey: string,
    context: EvaluationContext,
    defaultValue: number = 0
  ): Promise<number> {
    try {
      const result = await this.evaluateFlag(flagKey, context);
      return result.value as number;
    } catch {
      return defaultValue;
    }
  }

  async getJsonFlag<T extends Record<string, unknown>>(
    flagKey: string,
    context: EvaluationContext,
    defaultValue: T
  ): Promise<T> {
    try {
      const result = await this.evaluateFlag(flagKey, context);
      return result.value as T;
    } catch {
      return defaultValue;
    }
  }

  // ========================================================================
  // Flag Management
  // ========================================================================

  get flagManagerRef(): FlagManager {
    return this.flagManager;
  }

  get rolloutEngineRef(): RolloutEngine {
    return this.rolloutEngine;
  }

  get abTestingEngineRef(): ABTestingEngine {
    return this.abTestingEngine;
  }

  get targetingEngineRef(): TargetingEngine {
    return this.targetingEngine;
  }

  get analyticsEngineRef(): AnalyticsEngine {
    return this.analyticsEngine;
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  clearCache(): void {
    this.cache.clear();
    this.flagManager.clearCache();
    this.targetingEngine.clearAllCaches();
  }

  getCacheStats() {
    return {
      clientCache: this.cache.getStats(),
      flagManager: this.flagManager.getCacheStats(),
      targeting: this.targetingEngine.getCacheStats(),
    };
  }

  // ========================================================================
  // Shutdown
  // ========================================================================

  async shutdown(): Promise<void> {
    await this.analyticsEngine.shutdown();
    this.cache.destroy();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new feature flags client
 */
export function createFeatureFlagsClient(
  env: FlagStorageEnv,
  config?: Partial<FeatureFlagsConfig>
): FeatureFlagsClient {
  return new FeatureFlagsClient(env, config);
}

/**
 * Create a client with default configuration for development
 */
export function createDevelopmentClient(): FeatureFlagsClient {
  return createFeatureFlagsClient({} as FlagStorageEnv, {
    cache: {
      enabled: true,
      ttl: 60_000,
      maxSize: 1000,
      strategy: 'lru',
    },
    analytics: {
      enabled: false,
      sampleRate: 0,
      batchSize: 0,
      flushInterval: 0,
    },
  });
}

/**
 * Create a client with default configuration for production
 */
export function createProductionClient(
  env: FlagStorageEnv
): FeatureFlagsClient {
  return createFeatureFlagsClient(env, {
    cache: {
      enabled: true,
      ttl: 300_000, // 5 minutes
      maxSize: 50000,
      strategy: 'lru',
    },
    analytics: {
      enabled: true,
      sampleRate: 0.1, // 10% sampling
      batchSize: 500,
      flushInterval: 30_000, // 30 seconds
    },
    performance: {
      maxEvaluationTime: 1000, // 1ms
      cacheStrategy: 'aggressive',
      enableParallelEvaluation: true,
    },
  });
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick flag evaluation (creates client internally)
 */
export async function evaluateFlag(
  env: FlagStorageEnv,
  flagKey: string,
  userId: string,
  attributes?: UserAttributes
): Promise<FlagValueType> {
  const client = createFeatureFlagsClient(env);
  const result = await client.evaluateFlag(flagKey, {
    userId,
    attributes: attributes || { userId },
  });
  return result.value;
}

/**
 * Check if boolean flag is enabled
 */
export async function isFlagEnabled(
  env: FlagStorageEnv,
  flagKey: string,
  userId: string,
  attributes?: UserAttributes
): Promise<boolean> {
  const value = await evaluateFlag(env, flagKey, userId, attributes);
  return value === true;
}
