/**
 * ClaudeFlare Notification System
 * A comprehensive multi-channel notification system with alert routing, templates,
 * delivery tracking, rate limiting, preferences management, and escalation.
 */

// Type definitions
export * from './types';

// Channel implementations
export { BaseChannel } from './channels/base';
export { EmailChannel, type EmailChannelConfig } from './channels/email';
export { SmsChannel, type SmsChannelConfig } from './channels/sms';
export { PushChannel, type PushChannelConfig } from './channels/push';
export { SlackChannel, type SlackChannelConfig } from './channels/slack';
export { DiscordChannel, type DiscordChannelConfig } from './channels/discord';
export { WebhookChannel, type WebhookChannelConfig } from './channels/webhook';
export { InAppChannel, type InAppChannelConfig, type InAppStorage } from './channels/in-app';
export {
  ChannelRegistry,
  ChannelFactory,
  type ChannelConfig,
} from './channels/channels';

// Alert routing
export { AlertRouter, type RouterConfig, type RoutingResult, type AlertGroup } from './alerts/router';
export { OnCallManager, type OnCallStatus } from './alerts/on-call';

// Template engine
export { TemplateEngine, type TemplateConfig, type TemplateContext } from './templates/engine';

// Delivery tracking
export { DeliveryTracker, type DeliveryConfig, type DeliveryJob } from './delivery/tracker';

// Rate limiting
export { RateLimiter, type RateLimiterConfig, type RateLimitCheck } from './rate/limiter';

// Preferences management
export { PreferencesManager, type PreferencesConfig } from './preferences/manager';

// Escalation engine
export { EscalationEngine, type EscalationEngineConfig, type EscalationContext } from './escalation/engine';

// Utilities
export * from './utils/helpers';

// Default configuration
export {
  defaultConfig,
  getChannelDefaults,
  getCategoryDefaults,
  getRateLimitDefaults,
  getEscalationTimeout,
} from './config/default';

// Main notification system class
export { NotificationSystem } from './system';
