/**
 * Default configuration for the multi-tier cache system
 */

import { MultiTierCacheConfig, CacheTier } from '../types';

/**
 * Default production configuration
 */
export const DEFAULT_PRODUCTION_CONFIG: MultiTierCacheConfig = {
  tiers: {
    L1: {
      tier: CacheTier.L1,
      maxSize: 128 * 1024 * 1024, // 128 MB
      maxEntries: 10000,
      ttl: 300000, // 5 minutes
      compressionEnabled: false,
      priority: 1,
    },
    L2: {
      tier: CacheTier.L2,
      maxSize: 1024 * 1024 * 1024, // 1 GB
      maxEntries: 1000000,
      ttl: 86400000, // 24 hours
      compressionEnabled: true,
      priority: 2,
    },
    L3: {
      tier: CacheTier.L3,
      maxSize: 100 * 1024 * 1024 * 1024, // 100 GB
      maxEntries: 10000000,
      ttl: 604800000, // 7 days
      compressionEnabled: true,
      priority: 3,
    },
  },
  warming: {
    type: 'predictive',
    config: {
      enabled: true,
      concurrency: 10,
      batchSize: 100,
      maxEntries: 1000,
      priority: 'medium',
      sourceTier: CacheTier.L3,
    },
  },
  invalidation: {
    type: 'ttl',
    config: {
      propagateToAllTiers: true,
      backgroundProcessing: true,
      batchSize: 100,
      retries: 3,
      retryDelay: 1000,
    },
  },
  prefetch: {
    enabled: true,
    maxConcurrent: 5,
    maxBytes: 50 * 1024 * 1024, // 50 MB
    threshold: 0.7,
    strategy: 'hybrid',
    learningEnabled: true,
  },
  compression: {
    algorithm: 'gzip',
    threshold: 1024, // 1 KB
    level: 6,
    enabled: true,
  },
  analytics: {
    enabled: true,
    retentionDays: 30,
    sampleRate: 1.0,
  },
  metrics: {
    enabled: true,
    exportInterval: 60000, // 1 minute
  },
};

/**
 * Default development configuration
 */
export const DEFAULT_DEVELOPMENT_CONFIG: MultiTierCacheConfig = {
  tiers: {
    L1: {
      tier: CacheTier.L1,
      maxSize: 32 * 1024 * 1024, // 32 MB
      maxEntries: 1000,
      ttl: 60000, // 1 minute
      compressionEnabled: false,
      priority: 1,
    },
    L2: {
      tier: CacheTier.L2,
      maxSize: 256 * 1024 * 1024, // 256 MB
      maxEntries: 10000,
      ttl: 300000, // 5 minutes
      compressionEnabled: false,
      priority: 2,
    },
    L3: {
      tier: CacheTier.L3,
      maxSize: 1024 * 1024 * 1024, // 1 GB
      maxEntries: 100000,
      ttl: 3600000, // 1 hour
      compressionEnabled: false,
      priority: 3,
    },
  },
  warming: {
    type: 'predictive',
    config: {
      enabled: false,
      concurrency: 2,
      batchSize: 10,
      maxEntries: 100,
      priority: 'low',
      sourceTier: CacheTier.L3,
    },
  },
  invalidation: {
    type: 'ttl',
    config: {
      propagateToAllTiers: true,
      backgroundProcessing: false,
      batchSize: 10,
      retries: 1,
      retryDelay: 500,
    },
  },
  prefetch: {
    enabled: false,
    maxConcurrent: 2,
    maxBytes: 10 * 1024 * 1024, // 10 MB
    threshold: 0.8,
    strategy: 'pattern-based',
    learningEnabled: true,
  },
  compression: {
    algorithm: 'gzip',
    threshold: 2048, // 2 KB
    level: 3,
    enabled: false,
  },
  analytics: {
    enabled: true,
    retentionDays: 7,
    sampleRate: 1.0,
  },
  metrics: {
    enabled: true,
    exportInterval: 300000, // 5 minutes
  },
};

/**
 * Default testing configuration
 */
export const DEFAULT_TESTING_CONFIG: MultiTierCacheConfig = {
  tiers: {
    L1: {
      tier: CacheTier.L1,
      maxSize: 1024 * 1024, // 1 MB
      maxEntries: 100,
      ttl: 10000, // 10 seconds
      compressionEnabled: false,
      priority: 1,
    },
    L2: {
      tier: CacheTier.L2,
      maxSize: 10 * 1024 * 1024, // 10 MB
      maxEntries: 1000,
      ttl: 30000, // 30 seconds
      compressionEnabled: false,
      priority: 2,
    },
    L3: {
      tier: CacheTier.L3,
      maxSize: 100 * 1024 * 1024, // 100 MB
      maxEntries: 10000,
      ttl: 60000, // 1 minute
      compressionEnabled: false,
      priority: 3,
    },
  },
  warming: {
    type: 'predictive',
    config: {
      enabled: false,
      concurrency: 1,
      batchSize: 5,
      maxEntries: 10,
      priority: 'low',
      sourceTier: CacheTier.L3,
    },
  },
  invalidation: {
    type: 'ttl',
    config: {
      propagateToAllTiers: true,
      backgroundProcessing: false,
      batchSize: 5,
      retries: 0,
      retryDelay: 0,
    },
  },
  prefetch: {
    enabled: false,
    maxConcurrent: 1,
    maxBytes: 1024 * 1024, // 1 MB
    threshold: 0.9,
    strategy: 'pattern-based',
    learningEnabled: false,
  },
  compression: {
    algorithm: 'gzip',
    threshold: 512,
    level: 1,
    enabled: false,
  },
  analytics: {
    enabled: false,
    retentionDays: 1,
    sampleRate: 1.0,
  },
  metrics: {
    enabled: true,
    exportInterval: 10000, // 10 seconds
  },
};

/**
 * Get configuration for environment
 */
export function getConfigForEnvironment(
  env: 'production' | 'development' | 'testing'
): MultiTierCacheConfig {
  switch (env) {
    case 'production':
      return DEFAULT_PRODUCTION_CONFIG;
    case 'development':
      return DEFAULT_DEVELOPMENT_CONFIG;
    case 'testing':
      return DEFAULT_TESTING_CONFIG;
    default:
      return DEFAULT_PRODUCTION_CONFIG;
  }
}

/**
 * Validate cache configuration
 */
export function validateConfig(config: MultiTierCacheConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate tier sizes
  if (config.tiers.L1.maxSize >= config.tiers.L2.maxSize) {
    errors.push('L1 max size must be less than L2 max size');
  }

  if (config.tiers.L2.maxSize >= config.tiers.L3.maxSize) {
    errors.push('L2 max size must be less than L3 max size');
  }

  // Validate tier priorities
  if (config.tiers.L1.priority >= config.tiers.L2.priority) {
    errors.push('L1 priority must be less than L2 priority');
  }

  if (config.tiers.L2.priority >= config.tiers.L3.priority) {
    errors.push('L2 priority must be less than L3 priority');
  }

  // Validate TTLs
  if (config.tiers.L1.ttl >= config.tiers.L2.ttl) {
    errors.push('L1 TTL should generally be less than L2 TTL');
  }

  if (config.tiers.L2.ttl >= config.tiers.L3.ttl) {
    errors.push('L2 TTL should generally be less than L3 TTL');
  }

  // Validate compression threshold
  if (config.compression.threshold < 0) {
    errors.push('Compression threshold must be non-negative');
  }

  // Validate prefetch threshold
  if (config.prefetch.threshold < 0 || config.prefetch.threshold > 1) {
    errors.push('Prefetch threshold must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
