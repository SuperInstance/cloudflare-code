/**
 * Configuration management for email service
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  ProviderConfig,
  EmailProvider,
  SecurityConfig
} from '../types';

/**
 * Email service configuration
 */
export interface EmailServiceConfig {
  providers: ProviderConfig[];
  security: SecurityConfig[];
  defaults: {
    from: {
      email: string;
      name: string;
    };
    replyTo?: string;
    trackOpens: boolean;
    trackClicks: boolean;
    maxRetries: number;
    retryDelay: number;
  };
  tracking: {
    baseUrl: string;
    enabled: boolean;
  };
  templates: {
    directory: string;
    cacheEnabled: boolean;
  };
  scheduling: {
    enabled: boolean;
    checkIntervalMinutes: number;
    batchSize: number;
  };
  analytics: {
    retentionDays: number;
    realTimeEnabled: boolean;
  };
}

/**
 * Configuration manager
 */
export class ConfigManager {
  private config: EmailServiceConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), 'email-config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): EmailServiceConfig {
    if (existsSync(this.configPath)) {
      try {
        const data = readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      } catch (error) {
        console.error(`Failed to load config from ${this.configPath}:`, error);
      }
    }

    // Return default configuration
    return this.getDefaultConfig();
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): EmailServiceConfig {
    return {
      providers: [],
      security: [],
      defaults: {
        from: {
          email: 'noreply@example.com',
          name: 'Example'
        },
        trackOpens: true,
        trackClicks: true,
        maxRetries: 3,
        retryDelay: 60
      },
      tracking: {
        baseUrl: 'https://example.com',
        enabled: true
      },
      templates: {
        directory: './templates',
        cacheEnabled: true
      },
      scheduling: {
        enabled: true,
        checkIntervalMinutes: 1,
        batchSize: 10
      },
      analytics: {
        retentionDays: 90,
        realTimeEnabled: true
      }
    };
  }

  /**
   * Get configuration
   */
  getConfig(): EmailServiceConfig {
    return this.config;
  }

  /**
   * Get provider configurations
   */
  getProviders(): ProviderConfig[] {
    return this.config.providers;
  }

  /**
   * Get enabled provider configurations
   */
  getEnabledProviders(): ProviderConfig[] {
    return this.config.providers.filter(p => p.enabled);
  }

  /**
   * Get provider by type
   */
  getProvider(type: EmailProvider): ProviderConfig | undefined {
    return this.config.providers.find(p => p.type === type);
  }

  /**
   * Add provider configuration
   */
  addProvider(provider: ProviderConfig): void {
    // Remove existing provider of same type
    this.config.providers = this.config.providers.filter(p => p.type !== provider.type);
    this.config.providers.push(provider);
  }

  /**
   * Remove provider configuration
   */
  removeProvider(type: EmailProvider): boolean {
    const index = this.config.providers.findIndex(p => p.type === type);
    if (index >= 0) {
      this.config.providers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get security configurations
   */
  getSecurityConfigs(): SecurityConfig[] {
    return this.config.security;
  }

  /**
   * Get security configuration for domain
   */
  getSecurityConfig(domain: string): SecurityConfig | undefined {
    return this.config.security.find(s => s.domain === domain);
  }

  /**
   * Add security configuration
   */
  addSecurityConfig(config: SecurityConfig): void {
    // Remove existing config for domain
    this.config.security = this.config.security.filter(s => s.domain !== config.domain);
    this.config.security.push(config);
  }

  /**
   * Validate configuration
   */
  validateConfig(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check if at least one provider is configured
    if (this.config.providers.length === 0) {
      errors.push('At least one email provider must be configured');
    }

    // Check if at least one provider is enabled
    const enabledProviders = this.config.providers.filter(p => p.enabled);
    if (enabledProviders.length === 0) {
      errors.push('At least one email provider must be enabled');
    }

    // Validate provider credentials
    for (const provider of enabledProviders) {
      if (!provider.credentials) {
        errors.push(`Provider ${provider.type} is missing credentials`);
      }

      if (provider.type === EmailProvider.SMTP) {
        const creds = provider.credentials;
        if (!creds.host || !creds.port || !creds.auth) {
          errors.push(`SMTP provider is missing required credentials`);
        }
      }

      if (provider.type === EmailProvider.SENDGRID) {
        const creds = provider.credentials;
        if (!creds.apiKey) {
          errors.push(`SendGrid provider is missing API key`);
        }
      }

      if (provider.type === EmailProvider.SES) {
        const creds = provider.credentials;
        if (!creds.accessKeyId || !creds.secretAccessKey || !creds.region) {
          errors.push(`AWS SES provider is missing required credentials`);
        }
      }

      if (provider.type === EmailProvider.MAILGUN) {
        const creds = provider.credentials;
        if (!creds.apiKey || !creds.domain) {
          errors.push(`Mailgun provider is missing required credentials`);
        }
      }

      if (provider.type === EmailProvider.POSTMARK) {
        const creds = provider.credentials;
        if (!creds.serverToken) {
          errors.push(`Postmark provider is missing server token`);
        }
      }
    }

    // Validate default from address
    if (!this.config.defaults.from.email) {
      errors.push('Default from email is required');
    }

    // Validate tracking base URL if tracking is enabled
    if (this.config.tracking.enabled && !this.config.tracking.baseUrl) {
      errors.push('Tracking base URL is required when tracking is enabled');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnv(): void {
    // SMTP
    if (process.env.SMTP_HOST) {
      this.addProvider({
        type: EmailProvider.SMTP,
        enabled: process.env.SMTP_ENABLED !== 'false',
        priority: parseInt(process.env.SMTP_PRIORITY || '1'),
        credentials: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
          }
        }
      });
    }

    // SendGrid
    if (process.env.SENDGRID_API_KEY) {
      this.addProvider({
        type: EmailProvider.SENDGRID,
        enabled: process.env.SENDGRID_ENABLED !== 'false',
        priority: parseInt(process.env.SENDGRID_PRIORITY || '2'),
        credentials: {
          apiKey: process.env.SENDGRID_API_KEY
        }
      });
    }

    // AWS SES
    if (process.env.SES_ACCESS_KEY_ID && process.env.SES_SECRET_ACCESS_KEY) {
      this.addProvider({
        type: EmailProvider.SES,
        enabled: process.env.SES_ENABLED !== 'false',
        priority: parseInt(process.env.SES_PRIORITY || '3'),
        credentials: {
          accessKeyId: process.env.SES_ACCESS_KEY_ID,
          secretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
          region: process.env.SES_REGION || 'us-east-1'
        }
      });
    }

    // Mailgun
    if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      this.addProvider({
        type: EmailProvider.MAILGUN,
        enabled: process.env.MAILGUN_ENABLED !== 'false',
        priority: parseInt(process.env.MAILGUN_PRIORITY || '4'),
        credentials: {
          apiKey: process.env.MAILGUN_API_KEY,
          domain: process.env.MAILGUN_DOMAIN,
          eu: process.env.MAILGUN_EU === 'true'
        }
      });
    }

    // Postmark
    if (process.env.POSTMARK_SERVER_TOKEN) {
      this.addProvider({
        type: EmailProvider.POSTMARK,
        enabled: process.env.POSTMARK_ENABLED !== 'false',
        priority: parseInt(process.env.POSTMARK_PRIORITY || '5'),
        credentials: {
          serverToken: process.env.POSTMARK_SERVER_TOKEN
        }
      });
    }

    // Default from address
    if (process.env.EMAIL_FROM) {
      this.config.defaults.from.email = process.env.EMAIL_FROM;
    }

    if (process.env.EMAIL_FROM_NAME) {
      this.config.defaults.from.name = process.env.EMAIL_FROM_NAME;
    }

    // Tracking
    if (process.env.EMAIL_TRACKING_BASE_URL) {
      this.config.tracking.baseUrl = process.env.EMAIL_TRACKING_BASE_URL;
    }

    if (process.env.EMAIL_TRACKING_ENABLED) {
      this.config.tracking.enabled = process.env.EMAIL_TRACKING_ENABLED === 'true';
    }
  }

  /**
   * Save configuration to file
   */
  saveConfig(configPath?: string): void {
    const path = configPath || this.configPath;
    // Implementation would write to file
  }

  /**
   * Reload configuration
   */
  reloadConfig(): void {
    this.config = this.loadConfig();
  }

  /**
   * Get configuration summary
   */
  getConfigSummary(): {
    providersCount: number;
    enabledProvidersCount: number;
    securityConfigsCount: number;
    trackingEnabled: boolean;
    schedulingEnabled: boolean;
  } {
    return {
      providersCount: this.config.providers.length,
      enabledProvidersCount: this.config.providers.filter(p => p.enabled).length,
      securityConfigsCount: this.config.security.length,
      trackingEnabled: this.config.tracking.enabled,
      schedulingEnabled: this.config.scheduling.enabled
    };
  }
}

/**
 * Create configuration from environment
 */
export function createConfigFromEnv(): EmailServiceConfig {
  const configManager = new ConfigManager();
  configManager.loadFromEnv();
  return configManager.getConfig();
}

/**
 * Validate provider credentials
 */
export function validateProviderCredentials(
  type: EmailProvider,
  credentials: any
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  switch (type) {
    case EmailProvider.SMTP:
      if (!credentials.host) errors.push('SMTP host is required');
      if (!credentials.port) errors.push('SMTP port is required');
      if (!credentials.auth) errors.push('SMTP auth is required');
      if (credentials.auth && !credentials.auth.user) errors.push('SMTP user is required');
      if (credentials.auth && !credentials.auth.pass) errors.push('SMTP password is required');
      break;

    case EmailProvider.SENDGRID:
      if (!credentials.apiKey) errors.push('SendGrid API key is required');
      break;

    case EmailProvider.SES:
      if (!credentials.accessKeyId) errors.push('AWS access key ID is required');
      if (!credentials.secretAccessKey) errors.push('AWS secret access key is required');
      if (!credentials.region) errors.push('AWS region is required');
      break;

    case EmailProvider.MAILGUN:
      if (!credentials.apiKey) errors.push('Mailgun API key is required');
      if (!credentials.domain) errors.push('Mailgun domain is required');
      break;

    case EmailProvider.POSTMARK:
      if (!credentials.serverToken) errors.push('Postmark server token is required');
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
