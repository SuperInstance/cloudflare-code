/**
 * Email Service - Comprehensive email sending and management
 *
 * @example
 * ```typescript
 * import { EmailService } from '@claudeflare/email';
 *
 * const emailService = new EmailService({
 *   providers: [
 *     {
 *       type: EmailProvider.SMTP,
 *       enabled: true,
 *       priority: 1,
 *       credentials: {
 *         host: 'smtp.example.com',
 *         port: 587,
 *         secure: false,
 *         auth: { user: 'user', pass: 'pass' }
 *       }
 *     }
 *   ]
 * });
 *
 * await emailService.send({
 *   from: { email: 'from@example.com', name: 'Sender' },
 *   to: [{ email: 'to@example.com' }],
 *   subject: 'Hello',
 *   html: '<p>Hello World</p>'
 * });
 * ```
 */

import { EmailSender } from './sending/sender';
import { TemplateEngine, TemplateLibrary } from './templates/engine';
import { EmailAnalytics, TrackingPixelGenerator } from './analytics/analytics';
import { BounceHandler, EmailValidator } from './bounces/handler';
import { SecurityManager, DNSChecker } from './security/manager';
import { EmailScheduler, TimeZoneUtils } from './scheduling/scheduler';
import { ListManager, ListAnalytics } from './lists/manager';
import { ConfigManager } from './config';

// Export all types
export * from './types';

// Export core classes
export { EmailSender };
export { TemplateEngine, TemplateLibrary };
export { EmailAnalytics, TrackingPixelGenerator };
export { BounceHandler, EmailValidator };
export { SecurityManager, DNSChecker };
export { EmailScheduler, TimeZoneUtils };
export { ListManager, ListAnalytics };
export { ConfigManager };

/**
 * Main Email Service class
 */
export class EmailService {
  private sender: EmailSender;
  private templateEngine: TemplateEngine;
  private analytics: EmailAnalytics;
  private bounceHandler: BounceHandler;
  private securityManager: SecurityManager;
  private scheduler: EmailScheduler;
  private listManager: ListManager;
  private configManager: ConfigManager;

  constructor(config?: any) {
    // Initialize configuration manager
    this.configManager = new ConfigManager(config?.configPath);
    if (config?.loadFromEnv) {
      this.configManager.loadFromEnv();
    }

    // Get provider configurations
    const providers = this.configManager.getEnabledProviders();
    if (providers.length === 0 && config?.providers) {
      // Use provided config if no providers from config manager
      this.configManager.addProvider(...config.providers);
    }

    const finalProviders = this.configManager.getEnabledProviders();

    // Initialize components
    this.sender = new EmailSender(finalProviders);
    this.templateEngine = new TemplateEngine();
    this.analytics = new EmailAnalytics();
    this.bounceHandler = new BounceHandler();
    this.securityManager = new SecurityManager();
    this.scheduler = new EmailScheduler(
      this.sender,
      this.templateEngine,
      this.analytics
    );
    this.listManager = new ListManager();

    // Add security configs if provided
    if (config?.security) {
      config.security.forEach((sec: any) => {
        this.securityManager.addSecurityConfig(sec);
      });
    }

    // Start scheduler if enabled
    if (config?.scheduling?.enabled !== false) {
      const interval = config?.scheduling?.checkIntervalMinutes || 1;
      this.scheduler.start(interval);
    }
  }

  /**
   * Send an email
   */
  async send(message: any): Promise<any> {
    return this.sender.send(message);
  }

  /**
   * Send emails in batch
   */
  async sendBatch(messages: any[]): Promise<any[]> {
    return this.sender.sendBatch(messages);
  }

  /**
   * Get sender instance
   */
  getSender(): EmailSender {
    return this.sender;
  }

  /**
   * Get template engine instance
   */
  getTemplateEngine(): TemplateEngine {
    return this.templateEngine;
  }

  /**
   * Get analytics instance
   */
  getAnalytics(): EmailAnalytics {
    return this.analytics;
  }

  /**
   * Get bounce handler instance
   */
  getBounceHandler(): BounceHandler {
    return this.bounceHandler;
  }

  /**
   * Get security manager instance
   */
  getSecurityManager(): SecurityManager {
    return this.securityManager;
  }

  /**
   * Get scheduler instance
   */
  getScheduler(): EmailScheduler {
    return this.scheduler;
  }

  /**
   * Get list manager instance
   */
  getListManager(): ListManager {
    return this.listManager;
  }

  /**
   * Get configuration manager
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Shutdown the email service
   */
  async shutdown(): Promise<void> {
    this.scheduler.stop();
    await this.sender.close();
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    sender: Map<any, boolean>;
    scheduler: boolean;
    config: any;
  }> {
    const senderHealth = await this.sender.getProviderHealth();
    const schedulerStats = this.scheduler.getSchedulerStats();
    const configSummary = this.configManager.getConfigSummary();

    return {
      sender: senderHealth,
      scheduler: schedulerStats.pending > 0,
      config: configSummary
    };
  }
}

/**
 * Create email service from environment variables
 */
export function createEmailServiceFromEnv(): EmailService {
  return new EmailService({ loadFromEnv: true });
}

/**
 * Quick send function
 */
export async function quickSend(options: {
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<any> {
  const service = createEmailServiceFromEnv();

  const message = {
    from: { email: options.from },
    to: Array.isArray(options.to) ? options.to.map(email => ({ email })) : [{ email: options.to }],
    subject: options.subject,
    html: options.html,
    text: options.text
  };

  const result = await service.send(message);
  await service.shutdown();

  return result;
}
