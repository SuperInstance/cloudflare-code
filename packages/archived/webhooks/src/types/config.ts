// @ts-nocheck
/**
 * Configuration types for webhook system
 */

import type { SignatureAlgorithm } from './webhook.js';

/**
 * Main webhook system configuration
 */
export interface WebhookSystemConfig {
  /**
   * Maximum number of delivery attempts per webhook
   */
  maxDeliveryAttempts: number;

  /**
   * Default timeout for webhook delivery in milliseconds
   */
  defaultTimeout: number;

  /**
   * Maximum timeout allowed in milliseconds
   */
  maxTimeout: number;

  /**
   * Maximum batch size for batch delivery
   */
  maxBatchSize: number;

  /**
   * Maximum wait time for batch aggregation in milliseconds
   */
  maxBatchWaitTime: number;

  /**
   * Default signature algorithm
   */
  defaultSignatureAlgorithm: SignatureAlgorithm;

  /**
   * Clock skew tolerance in milliseconds for signature verification
   */
  signatureTimestampTolerance: number;

  /**
   * Maximum size of webhook payload in bytes
   */
  maxPayloadSize: number;

  /**
   * Rate limiting configuration
   */
  rateLimit: {
    /**
     * Global rate limit per webhook
     */
    maxPerSecond: number;
    /**
     * Burst allowance
     */
    burstAllowance: number;
    /**
     * Rate limit window size
     */
    windowSizeMs: number;
  };

  /**
   * Queue configuration
   */
  queue: {
    /**
     * Maximum queue size per webhook
     */
    maxQueueSize: number;
    /**
     * Queue retention period in milliseconds
     */
    retentionMs: number;
    /**
     * Maximum processing time before dead letter
     */
    maxProcessingTime: number;
  };

  /**
   * Retry configuration
   */
  retry: {
    /**
     * Initial retry delay in milliseconds
     */
    initialDelayMs: number;
    /**
     * Maximum retry delay in milliseconds
     */
    maxDelayMs: number;
    /**
     * Backoff multiplier
     */
    backoffMultiplier: number;
    /**
     * Maximum number of retry attempts
     */
    maxAttempts: number;
  };

  /**
   * Dead letter queue configuration
   */
  deadLetter: {
    /**
     * Maximum size of dead letter queue
     */
    maxSize: number;
    /**
     * Retention period for dead letter items
     */
    retentionMs: number;
    /**
     * Enable automatic retry from DLQ
     */
    autoRetry: boolean;
    /**
     * Auto retry interval in milliseconds
     */
    autoRetryIntervalMs: number;
  };

  /**
   * Storage configuration
   */
  storage: {
    /**
     * Delivery record retention period
     */
    deliveryRetentionMs: number;
    /**
     * Analytics data retention period
     */
    analyticsRetentionMs: number;
    /**
     * Maximum number of records per query
     */
    maxRecordsPerQuery: number;
  };

  /**
   * Security configuration
   */
  security: {
    /**
     * Enable IP whitelisting
     */
    enableIPWhitelist: boolean;
    /**
     * Enable replay protection
     */
    enableReplayProtection: boolean;
    /**
     * Replay protection window in milliseconds
     */
    replayWindowMs: number;
    /**
     * Allowed URL patterns (regex)
     */
    allowedUrlPatterns?: string[];
    /**
     * Blocked URL patterns (regex)
     */
    blockedUrlPatterns?: string[];
    /**
     * Require HTTPS
     */
    requireHTTPS: boolean;
  };

  /**
   * Monitoring configuration
   */
  monitoring: {
    /**
     * Enable metrics collection
     */
    enabled: boolean;
    /**
     * Metrics export interval
     */
    exportIntervalMs: number;
    /**
     * Alert thresholds
     */
    alerts: {
      /**
       * Failure rate threshold (0-1)
       */
      failureRateThreshold: number;
      /**
       * Latency threshold in milliseconds
       */
      latencyThresholdMs: number;
      /**
       * Queue size threshold
       */
      queueSizeThreshold: number;
    };
  };

  /**
   * Feature flags
   */
  features: {
    /**
     * Enable batch delivery
     */
    batchDelivery: boolean;
    /**
     * Enable webhook templates
     */
    templates: boolean;
    /**
     * Enable webhook filters
     */
    filters: boolean;
    /**
     * Enable transform scripts
     */
    transformScripts: boolean;
    /**
     * Enable analytics
     */
    analytics: boolean;
  };

  /**
   * Environment name
   */
  environment: 'development' | 'staging' | 'production';

  /**
   * Custom metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: WebhookSystemConfig = {
  maxDeliveryAttempts: 5,
  defaultTimeout: 30000,
  maxTimeout: 300000,
  maxBatchSize: 100,
  maxBatchWaitTime: 5000,
  defaultSignatureAlgorithm: 'hmac_sha256' as SignatureAlgorithm,
  signatureTimestampTolerance: 300000, // 5 minutes
  maxPayloadSize: 6 * 1024 * 1024, // 6MB
  rateLimit: {
    maxPerSecond: 100,
    burstAllowance: 20,
    windowSizeMs: 60000, // 1 minute
  },
  queue: {
    maxQueueSize: 10000,
    retentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxProcessingTime: 300000, // 5 minutes
  },
  retry: {
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    maxAttempts: 3,
  },
  deadLetter: {
    maxSize: 100000,
    retentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    autoRetry: false,
    autoRetryIntervalMs: 3600000, // 1 hour
  },
  storage: {
    deliveryRetentionMs: 90 * 24 * 60 * 60 * 1000, // 90 days
    analyticsRetentionMs: 365 * 24 * 60 * 60 * 1000, // 1 year
    maxRecordsPerQuery: 1000,
  },
  security: {
    enableIPWhitelist: false,
    enableReplayProtection: true,
    replayWindowMs: 3600000, // 1 hour
    requireHTTPS: true,
  },
  monitoring: {
    enabled: true,
    exportIntervalMs: 60000, // 1 minute
    alerts: {
      failureRateThreshold: 0.05, // 5%
      latencyThresholdMs: 5000,
      queueSizeThreshold: 5000,
    },
  },
  features: {
    batchDelivery: true,
    templates: true,
    filters: true,
    transformScripts: false,
    analytics: true,
  },
  environment: 'production',
};

/**
 * Load configuration from environment variables
 */
export function configFromEnv(): Partial<WebhookSystemConfig> {
  return {
    maxDeliveryAttempts: parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '5', 10),
    defaultTimeout: parseInt(process.env.WEBHOOK_TIMEOUT || '30000', 10),
    maxBatchSize: parseInt(process.env.WEBHOOK_MAX_BATCH_SIZE || '100', 10),
    environment: (process.env.NODE_ENV as any) || 'production',
    security: {
      enableIPWhitelist: process.env.WEBHOOK_IP_WHITELIST === 'true',
      enableReplayProtection: process.env.WEBHOOK_REPLAY_PROTECTION !== 'false',
      requireHTTPS: process.env.WEBHOOK_REQUIRE_HTTPS !== 'false',
    },
  };
}

/**
 * Merge configuration with defaults
 */
export function mergeConfig(
  userConfig?: Partial<WebhookSystemConfig>
): WebhookSystemConfig {
  const envConfig = configFromEnv();
  return {
    ...DEFAULT_CONFIG,
    ...envConfig,
    ...userConfig,
    rateLimit: {
      ...DEFAULT_CONFIG.rateLimit,
      ...envConfig.rateLimit,
      ...userConfig?.rateLimit,
    },
    queue: {
      ...DEFAULT_CONFIG.queue,
      ...envConfig.queue,
      ...userConfig?.queue,
    },
    retry: {
      ...DEFAULT_CONFIG.retry,
      ...envConfig.retry,
      ...userConfig?.retry,
    },
    deadLetter: {
      ...DEFAULT_CONFIG.deadLetter,
      ...envConfig.deadLetter,
      ...userConfig?.deadLetter,
    },
    storage: {
      ...DEFAULT_CONFIG.storage,
      ...envConfig.storage,
      ...userConfig?.storage,
    },
    security: {
      ...DEFAULT_CONFIG.security,
      ...envConfig.security,
      ...userConfig?.security,
    },
    monitoring: {
      ...DEFAULT_CONFIG.monitoring,
      ...envConfig.monitoring,
      ...userConfig?.monitoring,
    },
    features: {
      ...DEFAULT_CONFIG.features,
      ...envConfig.features,
      ...userConfig?.features,
    },
  };
}
