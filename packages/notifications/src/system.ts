/**
 * Main notification system class that integrates all components
 */

import type {
  Notification,
  NotificationChannelType,
  NotificationRecipient,
  NotificationPriority,
  NotificationCategory,
  DeliveryReceipt,
  NotificationPreferences,
} from './types';

import { ChannelRegistry } from './channels/channels';
import { AlertRouter } from './alerts/router';
import { OnCallManager } from './alerts/on-call';
import { TemplateEngine } from './templates/engine';
import { DeliveryTracker } from './delivery/tracker';
import { RateLimiter } from './rate/limiter';
import { PreferencesManager } from './preferences/manager';
import { EscalationEngine } from './escalation/engine';

import { defaultConfig } from './config/default';
import { generateId, validateNotification } from './utils/helpers';

export interface NotificationSystemConfig {
  enableAlertRouting?: boolean;
  enableEscalation?: boolean;
  enableRateLimiting?: boolean;
  enablePreferences?: boolean;
  enableTemplates?: boolean;
}

/**
 * Main notification system class
 */
export class NotificationSystem {
  public channels: ChannelRegistry;
  public alerts: AlertRouter;
  public onCall: OnCallManager;
  public templates: TemplateEngine;
  public delivery: DeliveryTracker;
  public rateLimit: RateLimiter;
  public preferences: PreferencesManager;
  public escalation: EscalationEngine;

  constructor(config: NotificationSystemConfig = {}) {
    const {
      enableAlertRouting = true,
      enableEscalation = true,
      enableRateLimiting = true,
      enablePreferences = true,
      enableTemplates = true,
    } = config;

    // Initialize components
    this.channels = new ChannelRegistry();
    this.alerts = new AlertRouter();
    this.onCall = new OnCallManager();
    this.delivery = new DeliveryTracker(defaultConfig.delivery);
    this.rateLimit = new RateLimiter(defaultConfig.rateLimit);
    this.preferences = new PreferencesManager(defaultConfig);
    this.escalation = new EscalationEngine(defaultConfig.escalation);

    if (enableTemplates) {
      this.templates = new TemplateEngine(defaultConfig.templates);
    } else {
      this.templates = new TemplateEngine();
    }
  }

  /**
   * Send a notification
   */
  async send(
    notification: Notification,
    recipients: NotificationRecipient[],
    options?: {
      skipPreferences?: boolean;
      skipRateLimit?: boolean;
      templateId?: string;
    }
  ): Promise<Map<NotificationRecipient, DeliveryReceipt>> {
    const results = new Map<NotificationRecipient, DeliveryReceipt>();

    // Validate notification
    const validation = validateNotification(notification);
    if (!validation.valid) {
      throw new Error(`Invalid notification: ${validation.errors.join(', ')}`);
    }

    // Process each recipient
    for (const recipient of recipients) {
      try {
        // Check preferences
        if (!options?.skipPreferences) {
          const shouldNotify = this.preferences.shouldNotify(
            recipient.userId,
            notification.category,
            notification.channel,
            notification.priority
          );

          if (!shouldNotify) {
            continue;
          }
        }

        // Check rate limit
        if (!options?.skipRateLimit) {
          const rateCheck = await this.rateLimit.check(
            recipient.userId,
            notification.channel,
            notification.priority
          );

          if (!rateCheck.allowed) {
            throw new Error(`Rate limit exceeded. Retry after: ${rateCheck.retryAfter}`);
          }
        }

        // Render template if specified
        if (options?.templateId) {
          const rendered = await this.templates.render(options.templateId, {
            locale: notification.metadata?.locale,
            variables: notification.data || {},
          });

          notification.content = rendered.content;
          if (rendered.subject) {
            notification.subject = rendered.subject;
          }
          if (rendered.htmlContent) {
            notification.htmlContent = rendered.htmlContent;
          }
        }

        // Create delivery job
        const job = this.delivery.createJob(
          notification.id,
          notification.channel,
          recipient.id
        );

        // Start delivery attempt
        const attempt = await this.delivery.startAttempt(job.id);

        // Send notification
        const channel = this.channels.get(notification.channel);
        if (!channel) {
          throw new Error(`Channel not found: ${notification.channel}`);
        }

        const result = await channel.send(notification, recipient);

        // Complete delivery attempt
        const receipt = await this.delivery.completeAttempt(
          job.id,
          attempt.id,
          result.success,
          result.error,
          result.errorCode,
          result.messageId
        );

        results.set(recipient, receipt);
      } catch (error) {
        // Create failed receipt
        const receipt: DeliveryReceipt = {
          id: generateId('receipt'),
          notificationId: notification.id,
          channelId: notification.channel,
          status: 'failed',
          attempts: 1,
          sentAt: new Date(),
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        };

        results.set(recipient, receipt);
      }
    }

    return results;
  }

  /**
   * Send a notification to multiple channels
   */
  async sendMultiChannel(
    notification: Notification,
    channelRecipients: Map<NotificationChannelType, NotificationRecipient[]>,
    options?: {
      skipPreferences?: boolean;
      skipRateLimit?: boolean;
      templateId?: string;
    }
  ): Promise<Map<NotificationChannelType, Map<NotificationRecipient, DeliveryReceipt>>> {
    const results = new Map<NotificationChannelType, Map<NotificationRecipient, DeliveryReceipt>>();

    for (const [channel, recipients] of channelRecipients.entries()) {
      const channelNotification = { ...notification, channel };
      const channelResults = await this.send(channelNotification, recipients, options);
      results.set(channel, channelResults);
    }

    return results;
  }

  /**
   * Send a notification using a template
   */
  async sendFromTemplate(
    templateId: string,
    recipients: NotificationRecipient[],
    data: {
      userId: string;
      channel: NotificationChannelType;
      category: NotificationCategory;
      priority?: NotificationPriority;
      locale?: string;
      variables: Record<string, unknown>;
    }
  ): Promise<Map<NotificationRecipient, DeliveryReceipt>> {
    // Render template
    const rendered = await this.templates.render(templateId, {
      locale: data.locale,
      variables: data.variables,
    });

    // Create notification
    const notification: Notification = {
      id: generateId(),
      userId: data.userId,
      channel: data.channel,
      category: data.category,
      priority: data.priority || 'normal',
      status: 'pending',
      subject: rendered.subject,
      content: rendered.content,
      htmlContent: rendered.htmlContent,
      data: data.variables,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.send(notification, recipients, { templateId });
  }

  /**
   * Route and send an alert
   */
  async sendAlert(
    alert: any,
    options?: {
      skipEscalation?: boolean;
    }
  ): Promise<void> {
    // Route alert
    const routingResults = await this.alerts.routeAlert(alert);

    // Send notifications based on routing
    for (const result of routingResults) {
      if (!result.matched) {
        continue;
      }

      for (const channel of result.channels) {
        // Create notification from alert
        const notification: Notification = {
          id: generateId(),
          userId: result.users[0] || alert.assignedTo || 'system',
          channel,
          category: 'alert' as NotificationCategory,
          priority: result.priority,
          status: 'pending',
          subject: alert.title,
          content: alert.description,
          data: alert.data,
          metadata: {
            correlationId: alert.id,
            source: alert.source,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Create recipient
        const recipients: NotificationRecipient[] = result.users.map((userId) => ({
          id: generateId('recipient'),
          userId,
          type: channel,
          address: `${userId}@example.com`, // Would be resolved from user data
          verified: true,
          primary: true,
          createdAt: new Date(),
        }));

        // Send notification
        await this.send(notification, recipients);

        // Delay if specified
        if (result.delay) {
          await new Promise((resolve) => setTimeout(resolve, result.delay));
        }
      }
    }

    // Start escalation if enabled
    if (!options?.skipEscalation) {
      const escalationRules = await this.escalation.evaluateAlert(alert);
      for (const rule of escalationRules) {
        await this.escalation.startEscalation(alert.id, rule.id);
      }
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    channels: Map<NotificationChannelType, boolean>;
    delivery: {
      totalJobs: number;
      pendingJobs: number;
      deliveredJobs: number;
      failedJobs: number;
    };
    rateLimit: {
      totalLimits: number;
      activeStates: number;
    };
    preferences: {
      totalUsers: number;
    };
    escalation: {
      totalEscalations: number;
      activeEscalations: number;
    };
  }> {
    const [channelHealth, deliveryStats, rateLimitStats, preferencesStats, escalationStats] =
      await Promise.all([
        this.channels.healthCheck(),
        Promise.resolve(this.delivery.getStats()),
        Promise.resolve(this.rateLimit.getOverallStats()),
        Promise.resolve(this.preferences.getStats()),
        Promise.resolve(this.escalation.getStats()),
      ]);

    return {
      channels: channelHealth,
      delivery: {
        totalJobs: deliveryStats.totalJobs,
        pendingJobs: deliveryStats.pendingJobs,
        deliveredJobs: deliveryStats.deliveredJobs,
        failedJobs: deliveryStats.failedJobs,
      },
      rateLimit: {
        totalLimits: rateLimitStats.totalLimits,
        activeStates: rateLimitStats.activeStates,
      },
      preferences: {
        totalUsers: preferencesStats.totalUsers,
      },
      escalation: {
        totalEscalations: escalationStats.totalEscalations,
        activeEscalations: escalationStats.activeEscalations,
      },
    };
  }

  /**
   * Shutdown the notification system
   */
  async shutdown(): Promise<void> {
    // Stop timers
    this.escalation.stopCheckTimer();
    this.rateLimit.stopCleanupTimer();

    // Cleanup
    this.delivery.cleanup();
    this.escalation.cleanup();
  }

  /**
   * Reset the notification system
   */
  reset(): void {
    this.channels.clear();
    this.alerts.clearRoutes();
    this.alerts.clearGroups();
    this.alerts.clearDeduplicationKeys();
    this.onCall.clearRotations();
    this.templates.clearCache();
    this.templates.clearCompiledCache();
    this.delivery.clear();
    this.rateLimit.clear();
    this.preferences.clear();
    this.escalation.clearEscalations();
  }
}
