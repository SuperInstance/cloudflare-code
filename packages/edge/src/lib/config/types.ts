/**
 * Configuration Management System - Type Definitions
 *
 * Provides comprehensive type definitions for feature flags,
 * dynamic configuration, A/B testing, and configuration management.
 */

/**
 * Feature flag targeting rules
 */
export interface FeatureFlagTargeting {
  /**
   * Specific user IDs that should see this feature
   */
  users: string[];

  /**
   * Percentage rollout (0-100)
   * Users are consistently assigned based on hash of user ID
   */
  percentage: number;

  /**
   * Organization IDs that should see this feature
   */
  organizations: string[];

  /**
   * User tier targeting
   */
  tier: 'free' | 'pro' | 'enterprise' | 'all';

  /**
   * Custom targeting rules (advanced)
   */
  custom?: {
    country?: string[];
    region?: string[];
    environment?: 'development' | 'staging' | 'production';
    userAgent?: string[];
    ipRange?: string[];
  };
}

/**
 * Feature flag definition
 */
export interface FeatureFlag {
  /**
   * Unique feature flag name
   */
  name: string;

  /**
   * Whether the feature is enabled
   */
  enabled: boolean;

  /**
   * Targeting rules
   */
  targeting: FeatureFlagTargeting;

  /**
   * Feature description
   */
  description?: string;

  /**
   * Owner/team responsible
   */
  owner?: string;

  /**
   * Metadata for tracking and analytics
   */
  metadata: Record<string, unknown>;

  /**
   * Timestamps
   */
  createdAt: number;
  updatedAt: number;

  /**
   * Optional expiry time
   */
  expiresAt?: number;
}

/**
 * A/B testing variant
 */
export interface ExperimentVariant {
  /**
   * Variant name (e.g., 'control', 'treatment')
   */
  name: string;

  /**
   * Variant weight (0-1)
   * Weights should sum to 1 across all variants
   */
  weight: number;

  /**
   * Variant-specific configuration
   */
  config: Record<string, unknown>;

  /**
   * Variant description
   */
  description?: string;
}

/**
 * A/B testing experiment
 */
export interface Experiment {
  /**
   * Unique experiment name
   */
  name: string;

  /**
   * Whether the experiment is active
   */
  enabled: boolean;

  /**
   * Experiment variants
   */
  variants: ExperimentVariant[];

  /**
   * Targeting rules
   */
  targeting: FeatureFlagTargeting;

  /**
   * Metrics to track for this experiment
   */
  metrics: string[];

  /**
   * Experiment hypothesis
   */
  hypothesis?: string;

  /**
   * Success criteria
   */
  successCriteria?: string;

  /**
   * Start timestamp
   */
  startedAt?: number;

  /**
   * End timestamp
   */
  endsAt?: number;

  /**
   * Sample size required
   */
  requiredSampleSize?: number;

  /**
   * Current sample size
   */
  currentSampleSize?: number;

  /**
   * Metadata
   */
  metadata: Record<string, unknown>;

  /**
   * Timestamps
   */
  createdAt: number;
  updatedAt: number;
}

/**
 * Provider routing configuration
 */
export interface ProviderRoutingConfig {
  /**
   * Default provider to use
   */
  defaultProvider: string;

  /**
   * Fallback chain in order of preference
   */
  fallbackChain: string[];

  /**
   * Model-to-provider mapping
   */
  modelPreferences: Record<string, string>;

  /**
   * Provider-specific settings
   */
  providerSettings: Record<string, {
    /**
     * Provider priority (lower = higher priority)
     */
    priority?: number;

    /**
     * Max concurrent requests
     */
    maxConcurrent?: number;

    /**
     * Timeout in milliseconds
     */
    timeout?: number;

    /**
     * Whether provider is enabled
     */
    enabled?: boolean;

    /**
     * Cost multiplier
     */
    costMultiplier?: number;
  }>;
}

/**
 * Rate limit configuration per tier
 */
export interface RateLimitConfig {
  /**
   * Free tier limits
   */
  free: {
    /**
     * Requests per minute
     */
    rpm: number;

    /**
     * Requests per day
     */
    rpd: number;

    /**
     * Tokens per minute
     */
    tpm?: number;
  };

  /**
   * Pro tier limits
   */
  pro: {
    rpm: number;
    rpd: number;
    tpm?: number;
  };

  /**
   * Enterprise tier limits
   */
  enterprise: {
    rpm: number;
    rpd: number;
    tpm?: number;
  };
}

/**
 * UI configuration
 */
export interface UIConfig {
  /**
   * Maximum message length
   */
  maxMessageLength: number;

  /**
   * Enable streaming responses
   */
  enableStreaming: boolean;

  /**
   * Default theme
   */
  theme: 'light' | 'dark' | 'auto';

  /**
   * Feature flags for UI
   */
  features: {
    /**
     * Enable websockets
     */
    websockets: boolean;

    /**
     * Enable code indexing
     */
    codeIndexing: boolean;

    /**
     * Enable advanced cache
     */
    advancedCache: boolean;

    /**
     * Enable file uploads
     */
    fileUploads: boolean;

    /**
     * Enable collaboration
     */
    collaboration: boolean;
  };
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /**
   * KV cache settings
   */
  kv: {
    /**
     * Default TTL in seconds
     */
    defaultTTL: number;

    /**
     * Enable compression
     */
    compression: boolean;

    /**
     * Max cache size
     */
    maxSize: number;
  };

  /**
   * Durable Object cache settings
   */
  do: {
    /**
     * Max entries per DO
     */
    maxEntries: number;

    /**
     * TTL in seconds
     */
    ttl: number;

    /**
     * Enable persistence
     */
    persistence: boolean;
  };
}

/**
 * Monitoring and observability configuration
 */
export interface MonitoringConfig {
  /**
   * Metrics settings
   */
  metrics: {
    /**
     * Enable metrics collection
     */
    enabled: boolean;

    /**
     * Sampling rate (0-1)
     */
    samplingRate: number;

    /**
     * Export interval in milliseconds
     */
    exportInterval: number;

    /**
     * Metrics to export
     */
    includeMetrics: string[];
  };

  /**
   * Logging settings
   */
  logging: {
    /**
     * Log level
     */
    level: 'debug' | 'info' | 'warn' | 'error';

    /**
     * Enable structured logging
     */
    structured: boolean;

    /**
     * Sampling rate
     */
    samplingRate: number;
  };

  /**
   * Tracing settings
   */
  tracing: {
    /**
     * Enable distributed tracing
     */
    enabled: boolean;

    /**
     * Sampling rate
     */
    samplingRate: number;

    /**
     * Export endpoint
     */
    exportEndpoint?: string;
  };
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  /**
   * Rate limiting
   */
  rateLimiting: {
    /**
     * Enable rate limiting
     */
    enabled: boolean;

    /**
     * Strategy: 'token-bucket' | 'sliding-window' | 'fixed-window'
     */
    strategy: 'token-bucket' | 'sliding-window' | 'fixed-window';

    /**
     * Default limits per tier
     */
    limits: RateLimitConfig;
  };

  /**
   * Authentication settings
   */
  auth: {
    /**
     * Session duration in seconds
     */
    sessionDuration: number;

    /**
     * Max sessions per user
     */
    maxSessionsPerUser: number;

    /**
     * Enable MFA
     */
    mfaEnabled: boolean;

    /**
     * Allowed origins
     */
    allowedOrigins: string[];
  };

  /**
   * Content security policy
   */
  csp: {
    /**
     * Enable CSP headers
     */
    enabled: boolean;

    /**
     * CSP policy
     */
    policy: string;
  };
}

/**
 * Application configuration
 */
export interface AppConfig {
  /**
   * Application version
   */
  version: string;

  /**
   * Environment
   */
  environment: 'development' | 'staging' | 'production';

  /**
   * Feature flags
   */
  features: {
    websockets: FeatureFlag;
    codeIndexing: FeatureFlag;
    advancedCache: FeatureFlag;
    realTimeCollaboration: FeatureFlag;
    fileUploads: FeatureFlag;
  };

  /**
   * Provider routing
   */
  providers: ProviderRoutingConfig;

  /**
   * Rate limits
   */
  rateLimits: RateLimitConfig;

  /**
   * UI settings
   */
  ui: UIConfig;

  /**
   * Cache configuration
   */
  cache: CacheConfig;

  /**
   * Monitoring configuration
   */
  monitoring: MonitoringConfig;

  /**
   * Security configuration
   */
  security: SecurityConfig;
}

/**
 * Configuration version
 */
export interface ConfigVersion {
  /**
   * Version number (incrementing)
   */
  version: number;

  /**
   * Configuration snapshot
   */
  config: Partial<AppConfig>;

  /**
   * Author who made the change
   */
  author: string;

  /**
   * Change description
   */
  description: string;

  /**
   * Timestamp
   */
  timestamp: number;

  /**
   * Commit hash (if applicable)
   */
  commitHash?: string;
}

/**
 * Configuration change record
 */
export interface ConfigChange {
  /**
   * Change type
   */
  type: 'create' | 'update' | 'delete' | 'rollback';

  /**
   * Path to changed config (e.g., 'features.websockets.enabled')
   */
  path: string;

  /**
   * Old value
   */
  oldValue: unknown;

  /**
   * New value
   */
  newValue: unknown;

  /**
   * Author
   */
  author: string;

  /**
   * Timestamp
   */
  timestamp: number;

  /**
   * Reason for change
   */
  reason?: string;
}

/**
 * Configuration change event (for subscribers)
 */
export interface ConfigChangeEvent {
  change: ConfigChange;
  version: number;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;

  /**
   * Validation errors
   */
  errors: string[];

  /**
   * Validation warnings
   */
  warnings: string[];

  /**
   * Path to invalid config
   */
  path?: string;
}

/**
 * Configuration sync status
 */
export interface ConfigSyncStatus {
  /**
   * Last sync timestamp
   */
  lastSync: number;

  /**
   * Sync status
   */
  status: 'synced' | 'syncing' | 'failed';

  /**
   * Sync error (if failed)
   */
  error?: string;

  /**
   * Version synced
   */
  version: number;
}

/**
 * Feature flag evaluation context
 */
export interface EvaluationContext {
  /**
   * User ID
   */
  userId?: string;

  /**
   * Organization ID
   */
  organizationId?: string;

  /**
   * User tier
   */
  tier?: 'free' | 'pro' | 'enterprise';

  /**
   * User country
   */
  country?: string;

  /**
   * User region
   */
  region?: string;

  /**
   * Environment
   */
  environment?: 'development' | 'staging' | 'production';

  /**
   * User agent
   */
  userAgent?: string;

  /**
   * IP address
   */
  ip?: string;

  /**
   * Custom attributes
   */
  custom?: Record<string, unknown>;
}

/**
 * Feature flag evaluation result
 */
export interface EvaluationResult {
  /**
   * Whether the flag is enabled
   */
  enabled: boolean;

  /**
   * Variant (for A/B tests)
   */
  variant?: string;

  /**
   * Reason for evaluation
   */
  reason: string;

  /**
   * Configuration payload
   */
  config?: Record<string, unknown>;
}

/**
 * A/B test assignment result
 */
export interface AssignmentResult {
  /**
   * Experiment name
   */
  experiment: string;

  /**
   * Assigned variant
   */
  variant: string;

  /**
   * Variant configuration
   */
  config: Record<string, unknown>;

  /**
   * Assignment is consistent (same user always gets same variant)
   */
  consistent: boolean;

  /**
   * Timestamp
   */
  timestamp: number;
}

/**
 * Configuration snapshot
 */
export interface ConfigSnapshot {
  /**
   * Configuration version
   */
  version: number;

  /**
   * Full configuration
   */
  config: AppConfig;

  /**
   * Timestamp
   */
  timestamp: number;

  /**
   * Checksum for integrity verification
   */
  checksum: string;
}

/**
 * Configuration export format
 */
export interface ConfigExport {
  /**
   * Export format version
   */
  formatVersion: string;

  /**
   * Exported configuration
   */
  config: AppConfig;

  /**
   * Metadata
   */
  metadata: {
    /**
     * Export timestamp
     */
    exportedAt: number;

    /**
     * Exported by
     */
    exportedBy: string;

    /**
     * Source environment
     */
    sourceEnvironment: string;

    /**
     * Config version
     */
    version: number;
  };
}
