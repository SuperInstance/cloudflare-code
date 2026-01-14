/**
 * DDoS Protection Configuration
 */

import { z } from 'zod';
import type {
  DDoSProtectionConfig,
  RateLimitConfig,
  Thresholds,
  NotificationConfig,
  MitigationMode,
  ChallengeConfig,
  ChallengeType
} from '../types';

/**
 * Zod schema for configuration validation
 */
const RateLimitConfigSchema = z.object({
  requestsPerSecond: z.number().min(1).default(100),
  requestsPerMinute: z.number().min(1).default(1000),
  requestsPerHour: z.number().min(1).default(10000),
  burstSize: z.number().min(1).default(200),
  windowSize: z.number().min(1).default(60)
});

const ThresholdsSchema = z.object({
  requestsPerSecond: z.number().min(1).default(1000),
  errorRate: z.number().min(0).max(1).default(0.5),
  responseTime: z.number().min(0).default(5000),
  anomalyScore: z.number().min(0).max(1).default(0.7),
  riskScore: z.number().min(0).max(1).default(0.8)
});

const NotificationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  webhook: z.string().url().optional(),
  email: z.array(z.string().email()).optional(),
  slack: z.string().url().optional(),
  pagerduty: z.string().optional(),
  thresholds: z.object({
    warning: z.number().min(0).max(1).default(0.5),
    critical: z.number().min(0).max(1).default(0.8)
  }).default({
    warning: 0.5,
    critical: 0.8
  })
});

const DDoSProtectionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  rateLimiting: RateLimitConfigSchema.default({}),
  ipReputation: z.boolean().default(true),
  challengePlatform: z.boolean().default(true),
  analytics: z.boolean().default(true),
  mitigationMode: z.enum(['monitor', 'mitigate', 'aggressive']).default('mitigate'),
  whitelist: z.array(z.string()).default([]),
  blacklist: z.array(z.string()).default([]),
  geoWhitelist: z.array(z.string()).default([]),
  geoBlacklist: z.array(z.string()).default([]),
  thresholds: ThresholdsSchema.default({}),
  notifications: NotificationConfigSchema.default({})
});

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: DDoSProtectionConfig = {
  enabled: true,
  rateLimiting: {
    requestsPerSecond: 100,
    requestsPerMinute: 1000,
    requestsPerHour: 10000,
    burstSize: 200,
    windowSize: 60
  },
  ipReputation: true,
  challengePlatform: true,
  analytics: true,
  mitigationMode: 'mitigate',
  whitelist: [],
  blacklist: [],
  geoWhitelist: [],
  geoBlacklist: [],
  thresholds: {
    requestsPerSecond: 1000,
    errorRate: 0.5,
    responseTime: 5000,
    anomalyScore: 0.7,
    riskScore: 0.8
  },
  notifications: {
    enabled: true,
    thresholds: {
      warning: 0.5,
      critical: 0.8
    }
  }
};

/**
 * Aggressive configuration for high-risk scenarios
 */
export const AGGRESSIVE_CONFIG: DDoSProtectionConfig = {
  ...DEFAULT_CONFIG,
  mitigationMode: 'aggressive',
  rateLimiting: {
    requestsPerSecond: 50,
    requestsPerMinute: 500,
    requestsPerHour: 5000,
    burstSize: 100,
    windowSize: 60
  },
  thresholds: {
    requestsPerSecond: 500,
    errorRate: 0.3,
    responseTime: 3000,
    anomalyScore: 0.5,
    riskScore: 0.6
  }
};

/**
 * Monitoring-only configuration
 */
export const MONITOR_CONFIG: DDoSProtectionConfig = {
  ...DEFAULT_CONFIG,
  mitigationMode: 'monitor'
};

/**
 * Challenge configurations
 */
export const JAVASCRIPT_CHALLENGE_CONFIG: ChallengeConfig = {
  type: 'javascript' as ChallengeType,
  difficulty: 3,
  timeout: 5000
};

export const HCAPTCHA_CONFIG: ChallengeConfig = {
  type: 'hcaptcha' as ChallengeType,
  difficulty: 2,
  timeout: 30000
};

export const TURNSTILE_CONFIG: ChallengeConfig = {
  type: 'turnstile' as ChallengeType,
  difficulty: 1,
  timeout: 10000
};

/**
 * Configuration manager class
 */
export class ConfigManager {
  private config: DDoSProtectionConfig;
  private env: string;

  constructor(config: Partial<DDoSProtectionConfig> = {}, env: string = 'production') {
    this.env = env;
    const mergedConfig = this.mergeWithDefaults(config);
    this.config = this.validateAndParse(mergedConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): DDoSProtectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<DDoSProtectionConfig>): void {
    const merged = { ...this.config, ...updates };
    this.config = this.validateAndParse(merged);
  }

  /**
   * Get rate limit configuration
   */
  getRateLimitConfig(): RateLimitConfig {
    return { ...this.config.rateLimiting };
  }

  /**
   * Get thresholds
   */
  getThresholds(): Thresholds {
    return { ...this.config.thresholds };
  }

  /**
   * Get notification configuration
   */
  getNotificationConfig(): NotificationConfig {
    return { ...this.config.notifications };
  }

  /**
   * Check if IP is whitelisted
   */
  isWhitelisted(ip: string): boolean {
    return this.config.whitelist.includes(ip);
  }

  /**
   * Check if IP is blacklisted
   */
  isBlacklisted(ip: string): boolean {
    return this.config.blacklist.includes(ip);
  }

  /**
   * Check if country is whitelisted
   */
  isGeoWhitelisted(country: string): boolean {
    return this.config.geoWhitelist.includes(country);
  }

  /**
   * Check if country is blacklisted
   */
  isGeoBlacklisted(country: string): boolean {
    return this.config.geoBlacklist.includes(country);
  }

  /**
   * Get mitigation mode
   */
  getMitigationMode(): MitigationMode {
    return this.config.mitigationMode;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: keyof Pick<DDoSProtectionConfig, 'ipReputation' | 'challengePlatform' | 'analytics'>): boolean {
    return this.config[feature];
  }

  /**
   * Merge user config with defaults based on environment
   */
  private mergeWithDefaults(config: Partial<DDoSProtectionConfig>): DDoSProtectionConfig {
    let baseConfig = DEFAULT_CONFIG;

    // Adjust defaults based on environment
    if (this.env === 'development') {
      baseConfig = {
        ...DEFAULT_CONFIG,
        rateLimiting: {
          ...DEFAULT_CONFIG.rateLimiting,
          requestsPerSecond: 1000,
          requestsPerMinute: 10000
        },
        mitigationMode: 'monitor'
      };
    } else if (this.env === 'staging') {
      baseConfig = {
        ...DEFAULT_CONFIG,
        mitigationMode: 'monitor'
      };
    }

    return {
      ...baseConfig,
      ...config,
      rateLimiting: {
        ...baseConfig.rateLimiting,
        ...config.rateLimiting
      },
      thresholds: {
        ...baseConfig.thresholds,
        ...config.thresholds
      },
      notifications: {
        ...baseConfig.notifications,
        ...config.notifications
      }
    };
  }

  /**
   * Validate and parse configuration
   */
  private validateAndParse(config: DDoSProtectionConfig): DDoSProtectionConfig {
    try {
      return DDoSProtectionConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
        throw new Error(`Invalid configuration:\n${issues}`);
      }
      throw error;
    }
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
  static fromJSON(json: string, env?: string): ConfigManager {
    const config = JSON.parse(json) as Partial<DDoSProtectionConfig>;
    return new ConfigManager(config, env);
  }
}

/**
 * Configuration preset loader
 */
export class ConfigPresetLoader {
  private static presets: Record<string, Partial<DDoSProtectionConfig>> = {
    high_security: {
      mitigationMode: 'aggressive',
      rateLimiting: {
        requestsPerSecond: 50,
        requestsPerMinute: 500,
        requestsPerHour: 5000,
        burstSize: 100,
        windowSize: 60
      },
      ipReputation: true,
      challengePlatform: true
    },
    low_traffic: {
      mitigationMode: 'monitor',
      rateLimiting: {
        requestsPerSecond: 200,
        requestsPerMinute: 2000,
        requestsPerHour: 20000,
        burstSize: 400,
        windowSize: 60
      }
    },
    api_focused: {
      mitigationMode: 'mitigate',
      rateLimiting: {
        requestsPerSecond: 100,
        requestsPerMinute: 500,
        requestsPerHour: 5000,
        burstSize: 150,
        windowSize: 60
      },
      challengePlatform: true
    }
  };

  /**
   * Load a preset configuration
   */
  static load(preset: string, env: string = 'production'): ConfigManager {
    const presetConfig = this.presets[preset];
    if (!presetConfig) {
      throw new Error(`Unknown preset: ${preset}`);
    }
    return new ConfigManager(presetConfig, env);
  }

  /**
   * List available presets
   */
  static listPresets(): string[] {
    return Object.keys(this.presets);
  }

  /**
   * Register a custom preset
   */
  static registerPreset(name: string, config: Partial<DDoSProtectionConfig>): void {
    this.presets[name] = config;
  }
}

/**
 * Environment-based configuration loader
 */
export function loadConfigFromEnvironment(): Partial<DDoSProtectionConfig> {
  const config: Partial<DDoSProtectionConfig> = {
    enabled: process.env.DDOS_PROTECTION_ENABLED === 'true',
    mitigationMode: (process.env.DDOS_MITIGATION_MODE as MitigationMode) || 'mitigate',
    notifications: {
      enabled: process.env.DDOS_NOTIFICATIONS_ENABLED === 'true',
      webhook: process.env.DDOS_NOTIFICATION_WEBHOOK,
      email: process.env.DDOS_NOTIFICATION_EMAIL?.split(','),
      slack: process.env.DDOS_NOTIFICATION_SLACK,
      pagerduty: process.env.DDOS_NOTIFICATION_PAGERDUTY
    }
  };

  if (process.env.DDOS_RATE_LIMIT_RPS) {
    config.rateLimiting = {
      requestsPerSecond: parseInt(process.env.DDOS_RATE_LIMIT_RPS, 10)
    };
  }

  return config;
}
