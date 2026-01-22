/**
 * Default configuration for the notification system
 */

import type {
  NotificationChannelType,
  NotificationPriority,
  NotificationCategory,
} from '../types';

export interface DefaultNotificationConfig {
  channels: ChannelDefaults;
  categories: CategoryDefaults;
  priorities: PriorityDefaults;
  templates: TemplateDefaults;
  delivery: DeliveryDefaults;
  rateLimit: RateLimitDefaults;
  escalation: EscalationDefaults;
}

export interface ChannelDefaults {
  enabled: NotificationChannelType[];
  defaults: Map<NotificationChannelType, ChannelDefaultConfig>;
}

export interface ChannelDefaultConfig {
  enabled: boolean;
  priority: NotificationPriority;
  maxRetries: number;
  timeout: number;
}

export interface CategoryDefaults {
  defaults: Map<NotificationCategory, CategoryDefaultConfig>;
}

export interface CategoryDefaultConfig {
  enabled: boolean;
  channels: NotificationChannelType[];
  priority: NotificationPriority;
  quietHours: boolean;
}

export interface PriorityDefaults {
  levels: NotificationPriority[];
  thresholds: Map<NotificationPriority, number>;
  escalationTimeouts: Map<NotificationPriority, number>;
}

export interface TemplateDefaults {
  defaultLocale: string;
  fallbackLocale: string;
  enableCaching: boolean;
  cacheSize: number;
}

export interface DeliveryDefaults {
  maxRetries: number;
  retryDelays: number[];
  enableBounceHandling: boolean;
  bounceThreshold: number;
  trackingRetentionDays: number;
}

export interface RateLimitDefaults {
  enablePriority: boolean;
  enableBursting: boolean;
  defaultStrategy: string;
  limits: Map<NotificationChannelType, RateLimitDefaultConfig>;
}

export interface RateLimitDefaultConfig {
  limit: number;
  windowMs: number;
  burstLimit?: number;
}

export interface EscalationDefaults {
  enableAutoEscalation: boolean;
  checkIntervalMs: number;
  maxConcurrentEscalations: number;
  notificationTimeoutMs: number;
  defaultTimeoutMinutes: number;
  maxEscalations: number;
}

/**
 * Default configuration
 */
export const defaultConfig: DefaultNotificationConfig = {
  channels: {
    enabled: ['in_app', 'email', 'push', 'slack', 'sms', 'discord', 'webhook'],
    defaults: new Map([
      ['email', {
        enabled: true,
        priority: 'normal',
        maxRetries: 3,
        timeout: 30000,
      }],
      ['sms', {
        enabled: true,
        priority: 'high',
        maxRetries: 3,
        timeout: 10000,
      }],
      ['push', {
        enabled: true,
        priority: 'normal',
        maxRetries: 2,
        timeout: 10000,
      }],
      ['slack', {
        enabled: true,
        priority: 'normal',
        maxRetries: 3,
        timeout: 5000,
      }],
      ['discord', {
        enabled: true,
        priority: 'normal',
        maxRetries: 3,
        timeout: 5000,
      }],
      ['webhook', {
        enabled: true,
        priority: 'normal',
        maxRetries: 3,
        timeout: 30000,
      }],
      ['in_app', {
        enabled: true,
        priority: 'normal',
        maxRetries: 1,
        timeout: 5000,
      }],
    ]),
  },

  categories: {
    defaults: new Map([
      ['system', {
        enabled: true,
        channels: ['in_app', 'email'],
        priority: 'normal',
        quietHours: false,
      }],
      ['security', {
        enabled: true,
        channels: ['in_app', 'email', 'sms', 'push'],
        priority: 'urgent',
        quietHours: false,
      }],
      ['billing', {
        enabled: true,
        channels: ['in_app', 'email'],
        priority: 'normal',
        quietHours: false,
      }],
      ['deployment', {
        enabled: true,
        channels: ['in_app', 'email', 'slack'],
        priority: 'high',
        quietHours: true,
      }],
      ['performance', {
        enabled: true,
        channels: ['in_app'],
        priority: 'low',
        quietHours: true,
      }],
      ['alert', {
        enabled: true,
        channels: ['in_app', 'email', 'sms', 'push'],
        priority: 'high',
        quietHours: false,
      }],
      ['social', {
        enabled: true,
        channels: ['in_app'],
        priority: 'low',
        quietHours: true,
      }],
      ['marketing', {
        enabled: false,
        channels: ['in_app', 'email'],
        priority: 'low',
        quietHours: true,
      }],
      ['workflow', {
        enabled: true,
        channels: ['in_app', 'email'],
        priority: 'normal',
        quietHours: true,
      }],
      ['custom', {
        enabled: true,
        channels: ['in_app', 'email'],
        priority: 'normal',
        quietHours: false,
      }],
    ]),
  },

  priorities: {
    levels: ['critical', 'urgent', 'high', 'normal', 'low'],
    thresholds: new Map([
      ['critical', 100],
      ['urgent', 80],
      ['high', 60],
      ['normal', 40],
      ['low', 20],
    ]),
    escalationTimeouts: new Map([
      ['critical', 5], // 5 minutes
      ['urgent', 15], // 15 minutes
      ['high', 30], // 30 minutes
      ['normal', 60], // 1 hour
      ['low', 120], // 2 hours
    ]),
  },

  templates: {
    defaultLocale: 'en',
    fallbackLocale: 'en',
    enableCaching: true,
    cacheSize: 1000,
  },

  delivery: {
    maxRetries: 3,
    retryDelays: [60000, 300000, 900000], // 1min, 5min, 15min
    enableBounceHandling: true,
    bounceThreshold: 3,
    trackingRetentionDays: 30,
  },

  rateLimit: {
    enablePriority: true,
    enableBursting: true,
    defaultStrategy: 'sliding_window',
    limits: new Map([
      ['email', {
        limit: 100,
        windowMs: 3600000, // 1 hour
        burstLimit: 10,
      }],
      ['sms', {
        limit: 50,
        windowMs: 3600000, // 1 hour
        burstLimit: 5,
      }],
      ['push', {
        limit: 200,
        windowMs: 3600000, // 1 hour
        burstLimit: 20,
      }],
      ['slack', {
        limit: 1000,
        windowMs: 3600000, // 1 hour
        burstLimit: 50,
      }],
      ['discord', {
        limit: 100,
        windowMs: 3600000, // 1 hour
        burstLimit: 10,
      }],
      ['webhook', {
        limit: 500,
        windowMs: 3600000, // 1 hour
        burstLimit: 20,
      }],
      ['in_app', {
        limit: 1000,
        windowMs: 3600000, // 1 hour
        burstLimit: 100,
      }],
    ]),
  },

  escalation: {
    enableAutoEscalation: true,
    checkIntervalMs: 60000, // 1 minute
    maxConcurrentEscalations: 100,
    notificationTimeoutMs: 300000, // 5 minutes
    defaultTimeoutMinutes: 30,
    maxEscalations: 5,
  },
};

/**
 * Get default config for a channel
 */
export function getChannelDefaults(channel: NotificationChannelType): ChannelDefaultConfig {
  return defaultConfig.channels.defaults.get(channel) || {
    enabled: true,
    priority: 'normal',
    maxRetries: 3,
    timeout: 10000,
  };
}

/**
 * Get default config for a category
 */
export function getCategoryDefaults(category: NotificationCategory): CategoryDefaultConfig {
  return defaultConfig.categories.defaults.get(category) || {
    enabled: true,
    channels: ['in_app'],
    priority: 'normal',
    quietHours: false,
  };
}

/**
 * Get rate limit defaults for a channel
 */
export function getRateLimitDefaults(channel: NotificationChannelType): RateLimitDefaultConfig {
  return defaultConfig.rateLimit.limits.get(channel) || {
    limit: 100,
    windowMs: 3600000,
  };
}

/**
 * Get escalation timeout for a priority
 */
export function getEscalationTimeout(priority: NotificationPriority): number {
  return defaultConfig.priorities.escalationTimeouts.get(priority) || 30; // Default 30 minutes
}
