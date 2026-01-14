/**
 * Email Sender - Multi-provider email sending with failover support
 */

import nodemailer from 'nodemailer';
import { SES } from 'aws-sdk';
import * as FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import { winston as logger } from '../utils/logger';
import {
  EmailMessage,
  EmailProvider,
  DeliveryResult,
  EmailStatus,
  ProviderConfig,
  SMTPConfig,
  SendGridConfig,
  SESConfig,
  MailgunConfig,
  PostmarkConfig,
  EmailAddress,
  EmailPriority
} from '../types';

/**
 * Email Sender class supporting multiple providers with automatic failover
 */
export class EmailSender {
  private providers: Map<EmailProvider, ProviderConfig> = new Map();
  private transporters: Map<EmailProvider, any> = new Map();
  private providerOrder: EmailProvider[] = [];
  private rateLimiters: Map<EmailProvider, RateLimiter> = new Map();

  /**
   * Initialize email sender with provider configurations
   */
  constructor(configs: ProviderConfig[]) {
    this.initializeProviders(configs);
    this.setupTransporters();
    this.setupRateLimiters();
  }

  /**
   * Initialize and sort providers by priority
   */
  private initializeProviders(configs: ProviderConfig[]): void {
    const enabledConfigs = configs.filter(c => c.enabled);
    enabledConfigs.sort((a, b) => a.priority - b.priority);

    enabledConfigs.forEach(config => {
      this.providers.set(config.type, config);
      this.providerOrder.push(config.type);
    });

    if (this.providers.size === 0) {
      throw new Error('At least one enabled email provider is required');
    }
  }

  /**
   * Setup transporters for each provider
   */
  private setupTransporters(): void {
    for (const [providerType, config] of this.providers) {
      try {
        switch (providerType) {
          case EmailProvider.SMTP:
            this.setupSMTPTransporter(config.credentials as SMTPConfig);
            break;
          case EmailProvider.SENDGRID:
            this.setupSendGridTransporter(config.credentials as SendGridConfig);
            break;
          case EmailProvider.SES:
            this.setupSESTransporter(config.credentials as SESConfig);
            break;
          case EmailProvider.MAILGUN:
            this.setupMailgunTransporter(config.credentials as MailgunConfig);
            break;
          case EmailProvider.POSTMARK:
            this.setupPostmarkTransporter(config.credentials as PostmarkConfig);
            break;
        }
      } catch (error) {
        logger.error(`Failed to setup ${providerType} transporter:`, error);
      }
    }
  }

  /**
   * Setup rate limiters for each provider
   */
  private setupRateLimiters(): void {
    for (const [providerType, config] of this.providers) {
      if (config.rateLimit) {
        this.rateLimiters.set(
          providerType,
          new RateLimiter(config.rateLimit, 60000) // per minute
        );
      }
    }
  }

  /**
   * Setup SMTP transporter
   */
  private setupSMTPTransporter(credentials: SMTPConfig): void {
    const transporter = nodemailer.createTransport({
      host: credentials.host,
      port: credentials.port,
      secure: credentials.secure,
      auth: {
        user: credentials.auth.user,
        pass: credentials.auth.pass
      },
      pool: credentials.pool ?? true,
      maxConnections: credentials.maxConnections ?? 5,
      maxMessages: credentials.maxMessages ?? 100
    });
    this.transporters.set(EmailProvider.SMTP, transporter);
    logger.info(`SMTP transporter configured for ${credentials.host}`);
  }

  /**
   * Setup SendGrid transporter
   */
  private setupSendGridTransporter(credentials: SendGridConfig): void {
    const transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: credentials.apiKey
      }
    });
    this.transporters.set(EmailProvider.SENDGRID, transporter);
    logger.info('SendGrid transporter configured');
  }

  /**
   * Setup AWS SES transporter
   */
  private setupSESTransporter(credentials: SESConfig): void {
    const ses = new SES({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: credentials.region,
      endpoint: credentials.endpoint
    });

    const transporter = nodemailer.createTransport({
      SES: { ses, aws: SES }
    });
    this.transporters.set(EmailProvider.SES, transporter);
    logger.info(`AWS SES transporter configured for ${credentials.region}`);
  }

  /**
   * Setup Mailgun transporter
   */
  private setupMailgunTransporter(credentials: MailgunConfig): void {
    const endpoint = credentials.eu
      ? 'api.eu.mailgun.net'
      : 'api.mailgun.net';

    const transporter = nodemailer.createTransport({
      host: endpoint,
      port: 587,
      secure: false,
      auth: {
        user: `postmaster@${credentials.domain}`,
        pass: credentials.apiKey
      }
    });
    this.transporters.set(EmailProvider.MAILGUN, transporter);
    logger.info(`Mailgun transporter configured for ${credentials.domain}`);
  }

  /**
   * Setup Postmark transporter
   */
  private setupPostmarkTransporter(credentials: PostmarkConfig): void {
    const transporter = nodemailer.createTransport({
      host: 'smtp.postmarkapp.com',
      port: 587,
      secure: false,
      auth: {
        user: credentials.serverToken,
        pass: credentials.serverToken
      }
    });
    this.transporters.set(EmailProvider.POSTMARK, transporter);
    logger.info('Postmark transporter configured');
  }

  /**
   * Send an email message with automatic failover
   */
  async send(message: EmailMessage): Promise<DeliveryResult> {
    const emailId = message.id || uuidv4();
    let lastError: Error | undefined;

    // If specific provider requested, try only that provider
    if (message.provider) {
      const provider = message.provider;
      if (this.providers.has(provider)) {
        try {
          return await this.sendViaProvider(provider, message, emailId);
        } catch (error) {
          lastError = error as Error;
          logger.error(`Failed to send via ${provider}:`, error);
        }
      }
      return this.createFailureResult(emailId, provider, lastError);
    }

    // Try each provider in priority order
    for (const provider of this.providerOrder) {
      try {
        // Check rate limit
        if (this.rateLimiters.has(provider)) {
          const limiter = this.rateLimiters.get(provider)!;
          if (!limiter.canSend()) {
            logger.warn(`Rate limit reached for ${provider}, trying next provider`);
            continue;
          }
        }

        return await this.sendViaProvider(provider, message, emailId);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Failed to send via ${provider}: ${error.message}`);
        continue;
      }
    }

    // All providers failed
    return this.createFailureResult(
      emailId,
      this.providerOrder[0],
      lastError || new Error('All providers failed')
    );
  }

  /**
   * Send email via specific provider
   */
  private async sendViaProvider(
    provider: EmailProvider,
    message: EmailMessage,
    emailId: string
  ): Promise<DeliveryResult> {
    const transporter = this.transporters.get(provider);
    if (!transporter) {
      throw new Error(`No transporter found for ${provider}`);
    }

    // Update rate limiter
    if (this.rateLimiters.has(provider)) {
      this.rateLimiters.get(provider)!.recordSend();
    }

    const mailOptions = this.buildMailOptions(message);

    try {
      const info = await transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: emailId,
        provider,
        providerMessageId: info.messageId,
        status: EmailStatus.SENT,
        timestamp: new Date(),
        retryable: false
      };
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        messageId: emailId,
        provider,
        status: EmailStatus.FAILED,
        error: err,
        timestamp: new Date(),
        retryable: this.isRetryableError(err)
      };
    }
  }

  /**
   * Build mail options from email message
   */
  private buildMailOptions(message: EmailMessage): any {
    const options: any = {
      messageId: message.id,
      from: this.formatEmailAddress(message.from),
      to: message.to.map(t => this.formatEmailAddress(t)).join(', '),
      subject: message.subject,
      headers: message.headers || {}
    };

    if (message.cc && message.cc.length > 0) {
      options.cc = message.cc.map(c => this.formatEmailAddress(c)).join(', ');
    }

    if (message.bcc && message.bcc.length > 0) {
      options.bcc = message.bcc.map(b => this.formatEmailAddress(b)).join(', ');
    }

    if (message.replyTo) {
      options.replyTo = this.formatEmailAddress(message.replyTo);
    }

    if (message.text) {
      options.text = message.text;
    }

    if (message.html) {
      options.html = message.html;
    }

    if (message.attachments && message.attachments.length > 0) {
      options.attachments = message.attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        encoding: att.encoding || 'base64',
        contentType: att.contentType,
        cid: att.cid
      }));
    }

    // Add priority headers
    if (message.priority === EmailPriority.HIGH) {
      options.headers['X-Priority'] = '1';
      options.headers['X-MSMail-Priority'] = 'High';
    } else if (message.priority === EmailPriority.LOW) {
      options.headers['X-Priority'] = '5';
      options.headers['X-MSMail-Priority'] = 'Low';
    }

    // Add custom headers
    if (message.tags && message.tags.length > 0) {
      options.headers['X-Tags'] = message.tags.join(',');
    }

    return options;
  }

  /**
   * Format email address
   */
  private formatEmailAddress(address: EmailAddress): string {
    if (address.name) {
      return `${address.name} <${address.email}>`;
    }
    return address.email;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /timeout/i,
      /ETIMEDOUT/i,
      /ECONNRESET/i,
      /ECONNREFUSED/i,
      /temporary failure/i,
      /rate limit/i,
      /throttled/i,
      /service unavailable/i,
      /503/i,
      /502/i
    ];

    return retryablePatterns.some(pattern =>
      pattern.test(error.message) || pattern.test(error.name)
    );
  }

  /**
   * Create failure result
   */
  private createFailureResult(
    emailId: string,
    provider: EmailProvider,
    error?: Error
  ): DeliveryResult {
    return {
      success: false,
      messageId: emailId,
      provider,
      status: EmailStatus.FAILED,
      error,
      timestamp: new Date(),
      retryable: error ? this.isRetryableError(error) : false
    };
  }

  /**
   * Send multiple emails in batch
   */
  async sendBatch(messages: EmailMessage[]): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    // Send concurrently but respect rate limits
    const batchSize = 10; // Process 10 at a time
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(message => this.send(message))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<Map<EmailProvider, boolean>> {
    const health = new Map<EmailProvider, boolean>();

    for (const [provider, transporter] of this.transporters) {
      try {
        await transporter.verify();
        health.set(provider, true);
      } catch (error) {
        health.set(provider, false);
      }
    }

    return health;
  }

  /**
   * Close all transporters
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const transporter of this.transporters.values()) {
      if (transporter.close) {
        closePromises.push(transporter.close());
      }
    }

    await Promise.all(closePromises);
  }
}

/**
 * Rate limiter for email sending
 */
class RateLimiter {
  private sends: number[] = [];
  private maxSends: number;
  private window: number;

  constructor(maxSends: number, window: number) {
    this.maxSends = maxSends;
    this.window = window;
  }

  canSend(): boolean {
    this.cleanup();
    return this.sends.length < this.maxSends;
  }

  recordSend(): void {
    this.sends.push(Date.now());
  }

  private cleanup(): void {
    const now = Date.now();
    this.sends = this.sends.filter(time => now - time < this.window);
  }

  getRemainingCount(): number {
    this.cleanup();
    return Math.max(0, this.maxSends - this.sends.length);
  }

  getResetTime(): Date {
    this.cleanup();
    if (this.sends.length === 0) {
      return new Date();
    }
    return new Date(this.sends[0] + this.window);
  }
}
