/**
 * Configuration management for Error Tracking System
 */

import {
  ErrorTrackingConfig,
  ErrorCategory,
  ErrorSeverity,
  ErrorPriority,
  AlertType,
  AlertRule,
  AlertCondition,
  AlertAction
} from '../types';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Partial<ErrorTrackingConfig> = {
  environment: process.env.NODE_ENV || 'development',
  debug: false,
  sampleRate: 1.0,
  maxBreadcrumbs: 100,
  captureUnhandledRejections: true,
  captureConsole: true,
  captureHttpRequests: true,
  captureUserFeedback: true,
  maxEventQueueSize: 100,
  flushTimeout: 5000,
  retryAttempts: 3,
  enableStackCapture: true,
  enableContextCapture: true,
  enableScreenshotCapture: false,
  enablePerformanceMonitoring: true,
  tracesSampleRate: 0.1,
  timeout: 30000,
  headers: {},
  ignoreErrors: [
    // Top-level frame should not be ignored
    /^Top-level frame$/,
    // Random plugins/extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    /^safari-extension:\/\//,
    /^ms-browser-extension:\/\//,
    // Network errors that are usually not actionable
    /Network Error/i,
    /Request aborted/i,
    // ResizeObserver loop errors
    /ResizeObserver loop limit exceeded/i,
    // Non-error promise rejections
    /Non-Error promise rejection captured/i
  ],
  ignoreUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /^ms-browser-extension:\/\//i,
    // Local files
    /^file:\/\//i,
    // Development servers
    /webpack-internal:\/\//i,
    /hot-update/i
  ]
};

// ============================================================================
// Configuration Class
// ============================================================================

export class ConfigurationManager {
  private config: ErrorTrackingConfig;
  private readonly defaults: Partial<ErrorTrackingConfig>;

  constructor(config?: Partial<ErrorTrackingConfig>) {
    this.defaults = { ...DEFAULT_CONFIG };
    this.config = this.mergeWithDefaults(config || {});
    this.validateConfig();
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(
    config: Partial<ErrorTrackingConfig>
  ): ErrorTrackingConfig {
    return {
      ...this.defaults,
      ...config,
      // Ensure arrays are properly merged
      ignoreErrors: [
        ...(this.defaults.ignoreErrors || []),
        ...(config.ignoreErrors || [])
      ],
      ignoreUrls: [
        ...(this.defaults.ignoreUrls || []),
        ...(config.ignoreUrls || [])
      ],
      whitelistUrls: [
        ...(this.defaults.whitelistUrls || []),
        ...(config.whitelistUrls || [])
      ]
    } as ErrorTrackingConfig;
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    // Validate sample rate
    if (this.config.sampleRate !== undefined) {
      if (typeof this.config.sampleRate !== 'number' ||
          this.config.sampleRate < 0 ||
          this.config.sampleRate > 1) {
        throw new Error('sampleRate must be a number between 0 and 1');
      }
    }

    // Validate environment
    if (!this.config.environment) {
      throw new Error('environment is required');
    }

    // Validate maxBreadcrumbs
    if (this.config.maxBreadcrumbs !== undefined &&
        (typeof this.config.maxBreadcrumbs !== 'number' ||
         this.config.maxBreadcrumbs < 0)) {
      throw new Error('maxBreadcrumbs must be a non-negative number');
    }

    // Validate timeout
    if (this.config.timeout !== undefined &&
        (typeof this.config.timeout !== 'number' ||
         this.config.timeout < 0)) {
      throw new Error('timeout must be a non-negative number');
    }

    // Validate retryAttempts
    if (this.config.retryAttempts !== undefined &&
        (typeof this.config.retryAttempts !== 'number' ||
         this.config.retryAttempts < 0)) {
      throw new Error('retryAttempts must be a non-negative number');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorTrackingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ErrorTrackingConfig>): void {
    const newConfig = { ...this.config, ...updates };

    // Re-merge arrays to avoid duplicates
    if (updates.ignoreErrors) {
      newConfig.ignoreErrors = [
        ...(this.defaults.ignoreErrors || []),
        ...(updates.ignoreErrors || [])
      ];
    }

    if (updates.ignoreUrls) {
      newConfig.ignoreUrls = [
        ...(this.defaults.ignoreUrls || []),
        ...(updates.ignoreUrls || [])
      ];
    }

    this.config = newConfig;
    this.validateConfig();
  }

  /**
   * Get a specific config value
   */
  get<K extends keyof ErrorTrackingConfig>(key: K): ErrorTrackingConfig[K] {
    return this.config[key];
  }

  /**
   * Check if error should be ignored
   */
  shouldIgnoreError(error: Error | string): boolean {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const ignoreErrors = this.config.ignoreErrors || [];

    return ignoreErrors.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(errorMessage);
      }
      return errorMessage.includes(pattern);
    });
  }

  /**
   * Check if URL should be ignored
   */
  shouldIgnoreUrl(url: string): boolean {
    const ignoreUrls = this.config.ignoreUrls || [];
    const whitelistUrls = this.config.whitelistUrls || [];

    // If whitelist is specified and URL is not in whitelist, ignore it
    if (whitelistUrls.length > 0) {
      const inWhitelist = whitelistUrls.some(pattern => {
        if (pattern instanceof RegExp) {
          return pattern.test(url);
        }
        return url.includes(pattern);
      });
      if (!inWhitelist) {
        return true;
      }
    }

    return ignoreUrls.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(url);
      }
      return url.includes(pattern);
    });
  }

  /**
   * Check if error should be sampled
   */
  shouldSample(): boolean {
    const sampleRate = this.config.sampleRate || 1.0;
    return Math.random() < sampleRate;
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean {
    return this.config.debug || false;
  }

  /**
   * Get environment
   */
  getEnvironment(): string {
    return this.config.environment || 'unknown';
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: keyof ErrorTrackingConfig): boolean {
    const value = this.config[feature];
    if (typeof value === 'boolean') {
      return value;
    }
    return false;
  }
}

// ============================================================================
// Default Alert Rules
// ============================================================================

export const DEFAULT_ALERT_RULES: Partial<AlertRule>[] = [
  {
    name: 'Critical Error Spike',
    description: 'Alert when critical errors spike',
    type: AlertType.SPIKE,
    enabled: true,
    conditions: [
      {
        field: 'severity',
        operator: 'eq',
        value: ErrorSeverity.CRITICAL
      },
      {
        field: 'count',
        operator: 'gte',
        value: 10,
        duration: 300000 // 5 minutes
      }
    ],
    actions: [
      {
        type: 'email',
        enabled: true,
        config: {
          recipients: ['devops@company.com']
        }
      },
      {
        type: 'pagerduty',
        enabled: true,
        config: {
          severity: 'critical'
        }
      }
    ],
    cooldown: 900000, // 15 minutes
    throttleWindow: 300000 // 5 minutes
  },
  {
    name: 'High Error Rate',
    description: 'Alert when error rate exceeds threshold',
    type: AlertType.THRESHOLD,
    enabled: true,
    conditions: [
      {
        field: 'errorRate',
        operator: 'gte',
        value: 0.05, // 5% error rate
        duration: 60000 // 1 minute
      }
    ],
    actions: [
      {
        type: 'slack',
        enabled: true,
        config: {
          channel: '#alerts'
        }
      },
      {
        type: 'email',
        enabled: true,
        config: {
          recipients: ['engineering@company.com']
        }
      }
    ],
    cooldown: 1800000, // 30 minutes
    throttleWindow: 600000 // 10 minutes
  },
  {
    name: 'New Error Type',
    description: 'Alert on new error types in production',
    type: AlertType.NEW_ERROR,
    enabled: true,
    conditions: [
      {
        field: 'isNew',
        operator: 'eq',
        value: true
      },
      {
        field: 'severity',
        operator: 'in',
        value: [ErrorSeverity.CRITICAL, ErrorSeverity.HIGH]
      }
    ],
    actions: [
      {
        type: 'slack',
        enabled: true,
        config: {
          channel: '#errors'
        }
      }
    ],
    cooldown: 300000 // 5 minutes
  },
  {
    name: 'Error Regression',
    description: 'Alert when previously resolved errors reoccur',
    type: AlertType.REGRESSION,
    enabled: true,
    conditions: [
      {
        field: 'status',
        operator: 'eq',
        value: 'resolved'
      },
      {
        field: 'occurrences',
        operator: 'gte',
        value: 5,
        duration: 3600000 // 1 hour
      }
    ],
    actions: [
      {
        type: 'email',
        enabled: true,
        config: {
          recipients: ['tech-lead@company.com']
        }
      }
    ],
    cooldown: 3600000 // 1 hour
  },
  {
    name: 'Database Errors',
    description: 'Alert on database-related errors',
    type: AlertType.ANOMALY,
    enabled: true,
    conditions: [
      {
        field: 'category',
        operator: 'eq',
        value: ErrorCategory.DATABASE
      },
      {
        field: 'count',
        operator: 'gte',
        value: 5,
        duration: 60000 // 1 minute
      }
    ],
    actions: [
      {
        type: 'slack',
        enabled: true,
        config: {
          channel: '#database-alerts'
        }
      },
      {
        type: 'pagerduty',
        enabled: true,
        config: {
          severity: 'high'
        }
      }
    ],
    cooldown: 900000 // 15 minutes
  },
  {
    name: 'Authentication Failures',
    description: 'Alert on authentication failures',
    type: AlertType.ANOMALY,
    enabled: true,
    conditions: [
      {
        field: 'category',
        operator: 'eq',
        value: ErrorCategory.AUTHENTICATION
      },
      {
        field: 'count',
        operator: 'gte',
        value: 20,
        duration: 300000 // 5 minutes
      }
    ],
    actions: [
      {
        type: 'slack',
        enabled: true,
        config: {
          channel: '#security-alerts'
        }
      }
    ],
    cooldown: 600000 // 10 minutes
  },
  {
    name: 'Performance Degradation',
    description: 'Alert on performance-related errors',
    type: AlertType.PERFORMANCE,
    enabled: true,
    conditions: [
      {
        field: 'category',
        operator: 'eq',
        value: ErrorCategory.PERFORMANCE
      },
      {
        field: 'count',
        operator: 'gte',
        value: 10,
        duration: 300000 // 5 minutes
      }
    ],
    actions: [
      {
        type: 'email',
        enabled: true,
        config: {
          recipients: ['performance@company.com']
        }
      }
    ],
    cooldown: 1800000 // 30 minutes
  },
  {
    name: 'Memory Issues',
    description: 'Alert on memory-related errors',
    type: AlertType.ANOMALY,
    enabled: true,
    conditions: [
      {
        field: 'category',
        operator: 'eq',
        value: ErrorCategory.MEMORY
      }
    ],
    actions: [
      {
        type: 'pagerduty',
        enabled: true,
        config: {
          severity: 'high'
        }
      },
      {
        type: 'slack',
        enabled: true,
        config: {
          channel: '#ops'
        }
      }
    ],
    cooldown: 900000 // 15 minutes
  }
];

// ============================================================================
// Environment-specific Configuration
// ============================================================================

export const getEnvironmentConfig = (
  environment: string
): Partial<ErrorTrackingConfig> => {
  switch (environment) {
    case 'production':
      return {
        environment: 'production',
        debug: false,
        sampleRate: 1.0,
        captureConsole: false,
        maxBreadcrumbs: 50,
        tracesSampleRate: 0.1
      };

    case 'staging':
      return {
        environment: 'staging',
        debug: true,
        sampleRate: 1.0,
        captureConsole: true,
        maxBreadcrumbs: 100,
        tracesSampleRate: 0.5
      };

    case 'development':
      return {
        environment: 'development',
        debug: true,
        sampleRate: 1.0,
        captureConsole: true,
        maxBreadcrumbs: 200,
        tracesSampleRate: 1.0
      };

    case 'test':
      return {
        environment: 'test',
        debug: false,
        sampleRate: 0.0,
        captureConsole: false,
        maxBreadcrumbs: 0,
        tracesSampleRate: 0.0
      };

    default:
      return {
        environment,
        debug: false,
        sampleRate: 0.5,
        maxBreadcrumbs: 50
      };
  }
};

// ============================================================================
// Export Utilities
// ============================================================================

export const createConfig = (
  config?: Partial<ErrorTrackingConfig>
): ConfigurationManager => {
  const env = config?.environment || process.env.NODE_ENV || 'development';
  const envConfig = getEnvironmentConfig(env);
  const merged = { ...envConfig, ...config };
  return new ConfigurationManager(merged);
};

export const getDefaultConfig = (): Partial<ErrorTrackingConfig> => {
  return { ...DEFAULT_CONFIG };
};

export const getDefaultAlertRules = (): Partial<AlertRule>[] => {
  return DEFAULT_ALERT_RULES.map(rule => ({ ...rule }));
};
