/**
 * Default Configuration
 *
 * Provides default application configuration values
 */

import type { AppConfig, FeatureFlag } from './types';

/**
 * Get default application configuration
 */
export function getDefaultAppConfig(): AppConfig {
  const now = Date.now();

  return {
    version: '1.0.0',
    environment: 'production',

    features: {
      websockets: createDefaultFeatureFlag('websockets', false),
      codeIndexing: createDefaultFeatureFlag('codeIndexing', false),
      advancedCache: createDefaultFeatureFlag('advancedCache', true),
      realTimeCollaboration: createDefaultFeatureFlag('realTimeCollaboration', false),
      fileUploads: createDefaultFeatureFlag('fileUploads', true),
    },

    providers: {
      defaultProvider: 'anthropic',
      fallbackChain: ['openai', 'google', 'cohere'],
      modelPreferences: {
        'claude-3-opus': 'anthropic',
        'claude-3-sonnet': 'anthropic',
        'claude-3-haiku': 'anthropic',
        'gpt-4': 'openai',
        'gpt-3.5-turbo': 'openai',
        'gemini-pro': 'google',
      },
      providerSettings: {
        anthropic: {
          priority: 1,
          maxConcurrent: 10,
          timeout: 30000,
          enabled: true,
          costMultiplier: 1.0,
        },
        openai: {
          priority: 2,
          maxConcurrent: 20,
          timeout: 30000,
          enabled: true,
          costMultiplier: 0.8,
        },
        google: {
          priority: 3,
          maxConcurrent: 15,
          timeout: 30000,
          enabled: true,
          costMultiplier: 0.5,
        },
        cohere: {
          priority: 4,
          maxConcurrent: 10,
          timeout: 30000,
          enabled: false,
          costMultiplier: 0.3,
        },
      },
    },

    rateLimits: {
      free: {
        rpm: 10,
        rpd: 100,
        tpm: 40000,
      },
      pro: {
        rpm: 100,
        rpd: 1000,
        tpm: 100000,
      },
      enterprise: {
        rpm: 1000,
        rpd: 10000,
        tpm: 500000,
      },
    },

    ui: {
      maxMessageLength: 100000,
      enableStreaming: true,
      theme: 'auto',
      features: {
        websockets: false,
        codeIndexing: false,
        advancedCache: true,
        fileUploads: true,
        collaboration: false,
      },
    },

    cache: {
      kv: {
        defaultTTL: 604800, // 7 days
        compression: true,
        maxSize: 1073741824, // 1GB
      },
      do: {
        maxEntries: 10000,
        ttl: 3600, // 1 hour
        persistence: true,
      },
    },

    monitoring: {
      metrics: {
        enabled: true,
        samplingRate: 0.1,
        exportInterval: 60000, // 1 minute
        includeMetrics: [
          'request_count',
          'request_duration',
          'error_count',
          'cache_hit_rate',
          'token_usage',
          'provider_latency',
        ],
      },
      logging: {
        level: 'info',
        structured: true,
        samplingRate: 1.0,
      },
      tracing: {
        enabled: true,
        samplingRate: 0.01,
        exportEndpoint: undefined,
      },
    },

    security: {
      rateLimiting: {
        enabled: true,
        strategy: 'token-bucket',
        limits: {
          free: { rpm: 10, rpd: 100 },
          pro: { rpm: 100, rpd: 1000 },
          enterprise: { rpm: 1000, rpd: 10000 },
        },
      },
      auth: {
        sessionDuration: 86400, // 24 hours
        maxSessionsPerUser: 5,
        mfaEnabled: false,
        allowedOrigins: ['*'],
      },
      csp: {
        enabled: false,
        policy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
      },
    },
  };
}

/**
 * Create a default feature flag
 */
function createDefaultFeatureFlag(name: string, enabled: boolean): FeatureFlag {
  const now = Date.now();

  return {
    name,
    enabled,
    targeting: {
      users: [],
      percentage: 0,
      organizations: [],
      tier: 'all',
    },
    description: `${name} feature flag`,
    owner: 'system',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get development configuration
 */
export function getDevelopmentConfig(): Partial<AppConfig> {
  return {
    environment: 'development',
    features: {
      websockets: { ...getDefaultAppConfig().features.websockets, enabled: true },
      codeIndexing: { ...getDefaultAppConfig().features.codeIndexing, enabled: true },
      advancedCache: { ...getDefaultAppConfig().features.advancedCache, enabled: true },
      realTimeCollaboration: {
        ...getDefaultAppConfig().features.realTimeCollaboration,
        enabled: true,
      },
      fileUploads: { ...getDefaultAppConfig().features.fileUploads, enabled: true },
    },
    monitoring: {
      ...getDefaultAppConfig().monitoring,
      logging: {
        ...getDefaultAppConfig().monitoring.logging,
        level: 'debug',
      },
    },
  };
}

/**
 * Get staging configuration
 */
export function getStagingConfig(): Partial<AppConfig> {
  return {
    environment: 'staging',
    features: {
      websockets: { ...getDefaultAppConfig().features.websockets, enabled: true },
      codeIndexing: { ...getDefaultAppConfig().features.codeIndexing, enabled: true },
      advancedCache: { ...getDefaultAppConfig().features.advancedCache, enabled: true },
      realTimeCollaboration: {
        ...getDefaultAppConfig().features.realTimeCollaboration,
        enabled: false,
      },
      fileUploads: { ...getDefaultAppConfig().features.fileUploads, enabled: true },
    },
    rateLimits: {
      ...getDefaultAppConfig().rateLimits,
      pro: {
        rpm: 200,
        rpd: 2000,
        tpm: 200000,
      },
    },
  };
}

/**
 * Get production configuration
 */
export function getProductionConfig(): Partial<AppConfig> {
  return {
    environment: 'production',
  };
}
