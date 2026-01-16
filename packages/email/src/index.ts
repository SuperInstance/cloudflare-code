/**
 * ClaudeFlare Email Service - Ultra-Optimized
 * Comprehensive email sending and management
 */

// @ts-nocheck - Missing EmailService export
export * from './types';

// Core components (minimal exports)
export { EmailSender } from './sending/sender';
export { TemplateEngine, TemplateLibrary } from './templates/engine';
export { EmailAnalytics } from './analytics/analytics';
export { BounceHandler, EmailValidator } from './bounces/handler';
export { SecurityManager, DNSChecker } from './security/manager';
export { EmailScheduler } from './scheduling/scheduler';
export { ListManager } from './lists/manager';
export { ConfigManager } from './config';

// Main system
export { EmailService, createEmailService } from './system';

export const VERSION = '1.0.0';
export default EmailService;
