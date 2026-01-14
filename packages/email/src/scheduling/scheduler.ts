/**
 * Email Scheduler - Schedule and manage timed email delivery
 */

import { v4 as uuidv4 } from 'uuid';
import { winston as logger } from '../utils/logger';
import { EmailSender } from '../sending/sender';
import { TemplateEngine } from '../templates/engine';
import { EmailAnalytics } from '../analytics/analytics';
import {
  ScheduledEmail,
  EmailMessage,
  EmailStatus,
  RecurringConfig,
  DripCampaign,
  DripStep,
  SendTimeOptimization
} from '../types';

/**
 * Email Scheduler class for scheduling and managing email delivery
 */
export class EmailScheduler {
  private scheduledEmails: Map<string, ScheduledEmail> = new Map();
  private dripCampaigns: Map<string, DripCampaign> = new Map();
  private sender: EmailSender;
  private templateEngine: TemplateEngine;
  private analytics: EmailAnalytics;
  private schedulerInterval?: NodeJS.Timeout;
  private running: boolean = false;

  constructor(
    sender: EmailSender,
    templateEngine: TemplateEngine,
    analytics: EmailAnalytics
  ) {
    this.sender = sender;
    this.templateEngine = templateEngine;
    this.analytics = analytics;
  }

  /**
   * Start the scheduler
   */
  start(intervalMinutes: number = 1): void {
    if (this.running) {
      logger.warn('Scheduler is already running');
      return;
    }

    this.running = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    this.schedulerInterval = setInterval(async () => {
      await this.processScheduledEmails();
    }, intervalMs);

    logger.info(`Scheduler started with ${intervalMinutes} minute interval`);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }
    this.running = false;
    logger.info('Scheduler stopped');
  }

  /**
   * Schedule an email for future delivery
   */
  scheduleEmail(
    email: EmailMessage,
    scheduledAt: Date,
    recurring?: RecurringConfig
  ): ScheduledEmail {
    const scheduledEmail: ScheduledEmail = {
      id: uuidv4(),
      email,
      scheduledAt,
      status: EmailStatus.PENDING,
      recurring,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.scheduledEmails.set(scheduledEmail.id, scheduledEmail);
    logger.info(
      `Scheduled email ${scheduledEmail.id} for ${scheduledAt.toISOString()}`
    );

    return scheduledEmail;
  }

  /**
   * Update scheduled email
   */
  updateScheduledEmail(
    id: string,
    updates: Partial<ScheduledEmail>
  ): ScheduledEmail | null {
    const scheduledEmail = this.scheduledEmails.get(id);
    if (!scheduledEmail) {
      return null;
    }

    const updated = {
      ...scheduledEmail,
      ...updates,
      id: scheduledEmail.id, // Preserve ID
      createdAt: scheduledEmail.createdAt, // Preserve creation time
      updatedAt: new Date()
    };

    this.scheduledEmails.set(id, updated);
    logger.info(`Updated scheduled email ${id}`);

    return updated;
  }

  /**
   * Cancel scheduled email
   */
  cancelScheduledEmail(id: string): boolean {
    const scheduledEmail = this.scheduledEmails.get(id);
    if (!scheduledEmail) {
      return false;
    }

    if (scheduledEmail.status === EmailStatus.SENT) {
      return false;
    }

    scheduledEmail.status = EmailStatus.FAILED;
    logger.info(`Cancelled scheduled email ${id}`);

    return true;
  }

  /**
   * Get scheduled email
   */
  getScheduledEmail(id: string): ScheduledEmail | undefined {
    return this.scheduledEmails.get(id);
  }

  /**
   * Get all scheduled emails
   */
  getAllScheduledEmails(): ScheduledEmail[] {
    return Array.from(this.scheduledEmails.values());
  }

  /**
   * Get scheduled emails due for sending
   */
  private getDueEmails(): ScheduledEmail[] {
    const now = new Date();

    return Array.from(this.scheduledEmails.values()).filter(
      email =>
        email.status === EmailStatus.PENDING && email.scheduledAt <= now
    );
  }

  /**
   * Process scheduled emails
   */
  private async processScheduledEmails(): Promise<void> {
    try {
      const dueEmails = this.getDueEmails();

      if (dueEmails.length === 0) {
        return;
      }

      logger.info(`Processing ${dueEmails.length} scheduled emails`);

      for (const scheduledEmail of dueEmails) {
        try {
          await this.sendScheduledEmail(scheduledEmail);
        } catch (error) {
          logger.error(
            `Failed to send scheduled email ${scheduledEmail.id}:`,
            error
          );
          scheduledEmail.status = EmailStatus.FAILED;
        }
      }

      // Clean up old sent emails
      this.cleanupOldSentEmails();
    } catch (error) {
      logger.error('Error processing scheduled emails:', error);
    }
  }

  /**
   * Send a scheduled email
   */
  private async sendScheduledEmail(
    scheduledEmail: ScheduledEmail
  ): Promise<void> {
    // Render template if needed
    let emailToSend = scheduledEmail.email;
    if (emailToSend.templateId) {
      const { html, text, subject } = this.templateEngine.renderTemplate(
        emailToSend.templateId,
        emailToSend.templateData || {}
      );
      emailToSend = { ...emailToSend, html, text, subject };
    }

    // Send email
    const result = await this.sender.send(emailToSend);

    // Update scheduled email
    scheduledEmail.status = result.success ? EmailStatus.SENT : EmailStatus.FAILED;
    scheduledEmail.sentAt = new Date();

    // Track delivery
    this.analytics.trackDelivery(result);

    // Schedule next occurrence if recurring
    if (scheduledEmail.recurring && result.success) {
      const nextRun = this.calculateNextRun(scheduledEmail);
      if (nextRun) {
        scheduledEmail.nextRunAt = nextRun;
        this.scheduleNextOccurrence(scheduledEmail);
      }
    }

    logger.info(
      `Sent scheduled email ${scheduledEmail.id}: ${result.status}`
    );
  }

  /**
   * Schedule next occurrence of recurring email
   */
  private scheduleNextOccurrence(scheduledEmail: ScheduledEmail): void {
    const nextScheduledAt = scheduledEmail.nextRunAt;
    if (!nextScheduledAt) {
      return;
    }

    // Check if recurrence has ended
    if (scheduledEmail.recurring?.endDate && nextScheduledAt > scheduledEmail.recurring.endDate) {
      logger.info(`Recurrence ended for ${scheduledEmail.id}`);
      return;
    }

    // Create new scheduled email for next occurrence
    this.scheduleEmail(
      scheduledEmail.email,
      nextScheduledAt,
      scheduledEmail.recurring
    );
  }

  /**
   * Calculate next run time for recurring email
   */
  private calculateNextRun(scheduledEmail: ScheduledEmail): Date | null {
    if (!scheduledEmail.recurring) {
      return null;
    }

    const { frequency, interval = 1, endDate } = scheduledEmail.recurring;
    const lastRun = scheduledEmail.scheduledAt;
    const nextRun = new Date(lastRun);

    switch (frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + interval);
        break;

      case 'weekly':
        nextRun.setDate(nextRun.getDate() + (7 * interval));
        break;

      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + interval);
        break;

      case 'yearly':
        nextRun.setFullYear(nextRun.getFullYear() + interval);
        break;

      case 'custom':
        // Custom frequency would require additional logic
        // For now, skip
        return null;
    }

    // Check if past end date
    if (endDate && nextRun > endDate) {
      return null;
    }

    return nextRun;
  }

  /**
   * Clean up old sent emails
   */
  private cleanupOldSentEmails(maxAgeDays: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    for (const [id, scheduledEmail] of this.scheduledEmails) {
      if (
        scheduledEmail.status === EmailStatus.SENT &&
        scheduledEmail.sentAt &&
        scheduledEmail.sentAt < cutoffDate
      ) {
        this.scheduledEmails.delete(id);
      }
    }
  }

  /**
   * Create drip campaign
   */
  createDripCampaign(
    name: string,
    listId: string,
    steps: DripStep[]
  ): DripCampaign {
    const campaign: DripCampaign = {
      id: uuidv4(),
      name,
      listId,
      steps: steps.sort((a, b) => a.order - b.order),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dripCampaigns.set(campaign.id, campaign);
    logger.info(`Created drip campaign ${campaign.id} with ${steps.length} steps`);

    return campaign;
  }

  /**
   * Start drip campaign for subscriber
   */
  startDripCampaignForSubscriber(
    campaignId: string,
    subscriberEmail: string,
    data: Record<string, any>
  ): void {
    const campaign = this.dripCampaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== 'active') {
      throw new Error(`Campaign ${campaignId} is not active`);
    }

    // Schedule first step
    const firstStep = campaign.steps[0];
    if (!firstStep) {
      return;
    }

    const scheduledAt = this.calculateStepDelay(firstStep);

    const email = this.templateEngine.createEmailFromTemplate(
      firstStep.templateId,
      subscriberEmail,
      data.from || 'noreply@example.com',
      data
    );

    this.scheduleEmail(email, scheduledAt);
    logger.info(`Started drip campaign ${campaignId} for ${subscriberEmail}`);
  }

  /**
   * Calculate step delay
   */
  private calculateStepDelay(step: DripStep): Date {
    const now = new Date();

    switch (step.delayUnit) {
      case 'minutes':
        now.setMinutes(now.getMinutes() + step.delay);
        break;
      case 'hours':
        now.setHours(now.getHours() + step.delay);
        break;
      case 'days':
        now.setDate(now.getDate() + step.delay);
        break;
    }

    return now;
  }

  /**
   * Optimize send time based on analytics
   */
  optimizeSendTime(
    recipientEmail: string,
    timezone: string = 'UTC'
  ): SendTimeOptimization {
    // Get best send times from analytics
    const bestTimes = this.analytics.getBestSendTimes();

    if (bestTimes.length === 0) {
      // Default to 10 AM if no data
      const defaultTime = new Date();
      defaultTime.setHours(10, 0, 0, 0);

      return {
        recommendedTime: defaultTime,
        confidence: 0,
        timezone,
        reason: 'No analytics data available, using default time of 10 AM'
      };
    }

    // Get best hour
    const bestHour = bestTimes[0];

    // Convert to recipient timezone
    const recommendedTime = this.convertToTimezone(bestHour.hour, timezone);

    return {
      recommendedTime,
      confidence: bestHour.sent > 100 ? 0.9 : 0.6,
      timezone,
      reason: `Based on ${bestHour.sent} previous sends with ${bestHour.clickRate.toFixed(1)}% click rate`
    };
  }

  /**
   * Convert hour to recipient timezone
   */
  private convertToTimezone(hour: number, timezone: string): Date {
    const now = new Date();
    now.setHours(hour, 0, 0, 0);

    // This would use a timezone library like moment-timezone
    // For now, just return the time in UTC
    return now;
  }

  /**
   * Get scheduler statistics
   */
  getSchedulerStats(): {
    pending: number;
    sent: number;
    failed: number;
    recurring: number;
    activeCampaigns: number;
  } {
    const emails = Array.from(this.scheduledEmails.values());

    return {
      pending: emails.filter(e => e.status === EmailStatus.PENDING).length,
      sent: emails.filter(e => e.status === EmailStatus.SENT).length,
      failed: emails.filter(e => e.status === EmailStatus.FAILED).length,
      recurring: emails.filter(e => e.recurring).length,
      activeCampaigns: Array.from(this.dripCampaigns.values()).filter(
        c => c.status === 'active'
      ).length
    };
  }

  /**
   * Schedule batch of emails
   */
  scheduleBatch(
    emails: EmailMessage[],
    scheduledAt: Date,
    batchSize: number = 10,
    delayMinutes: number = 1
  ): ScheduledEmail[] {
    const scheduledEmails: ScheduledEmail[] = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchDelay = Math.floor(i / batchSize) * delayMinutes;

      const batchScheduledAt = new Date(scheduledAt);
      batchScheduledAt.setMinutes(batchScheduledAt.getMinutes() + batchDelay);

      batch.forEach(email => {
        const scheduled = this.scheduleEmail(email, batchScheduledAt);
        scheduledEmails.push(scheduled);
      });
    }

    logger.info(
      `Scheduled ${emails.length} emails in ${Math.ceil(emails.length / batchSize)} batches`
    );

    return scheduledEmails;
  }

  /**
   * Pause drip campaign
   */
  pauseDripCampaign(campaignId: string): boolean {
    const campaign = this.dripCampaigns.get(campaignId);
    if (!campaign) {
      return false;
    }

    campaign.status = 'paused';
    campaign.updatedAt = new Date();
    logger.info(`Paused drip campaign ${campaignId}`);

    return true;
  }

  /**
   * Resume drip campaign
   */
  resumeDripCampaign(campaignId: string): boolean {
    const campaign = this.dripCampaigns.get(campaignId);
    if (!campaign) {
      return false;
    }

    campaign.status = 'active';
    campaign.updatedAt = new Date();
    logger.info(`Resumed drip campaign ${campaignId}`);

    return true;
  }

  /**
   * Delete drip campaign
   */
  deleteDripCampaign(campaignId: string): boolean {
    return this.dripCampaigns.delete(campaignId);
  }

  /**
   * Get drip campaign
   */
  getDripCampaign(campaignId: string): DripCampaign | undefined {
    return this.dripCampaigns.get(campaignId);
  }

  /**
   * Get all drip campaigns
   */
  getAllDripCampaigns(): DripCampaign[] {
    return Array.from(this.dripCampaigns.values());
  }

  /**
   * Validate scheduled time
   */
  validateScheduledTime(scheduledAt: Date): {
    valid: boolean;
    error?: string;
  } {
    const now = new Date();

    if (scheduledAt < now) {
      return {
        valid: false,
        error: 'Scheduled time must be in the future'
      };
    }

    // Check if too far in the future (e.g., more than 1 year)
    const maxFuture = new Date();
    maxFuture.setFullYear(maxFuture.getFullYear() + 1);

    if (scheduledAt > maxFuture) {
      return {
        valid: false,
        error: 'Scheduled time is too far in the future'
      };
    }

    return { valid: true };
  }
}

/**
 * Time zone utilities
 */
export class TimeZoneUtils {
  /**
   * Convert time between timezones
   */
  static convertTime(
    date: Date,
    fromTimezone: string,
    toTimezone: string
  ): Date {
    // This would use a timezone library
    // For now, return the date as-is
    return date;
  }

  /**
   * Get current time in timezone
   */
  static getCurrentTime(timezone: string): Date {
    // This would use a timezone library
    return new Date();
  }

  /**
   * Get list of common timezones
   */
  static getCommonTimezones(): string[] {
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney'
    ];
  }
}
