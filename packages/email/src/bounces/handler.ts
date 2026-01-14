/**
 * Bounce Handler - Comprehensive bounce detection, classification, and processing
 */

import { v4 as uuidv4 } from 'uuid';
import { winston as logger } from '../utils/logger';
import {
  BounceInfo,
  BounceType,
  BounceCategory,
  EmailStatus,
  EmailProvider
} from '../types';

/**
 * Bounce Handler class for processing and managing email bounces
 */
export class BounceHandler {
  private bounces: Map<string, BounceInfo> = new Map();
  private bouncedEmails: Map<string, BounceInfo> = new Map(); // Indexed by email
  private bounceRules: BounceRule[] = [];
  private suppressedEmails: Map<string, SuppressionInfo> = new Map();

  constructor() {
    this.initializeBounceRules();
  }

  /**
   * Initialize bounce classification rules
   */
  private initializeBounceRules(): void {
    this.bounceRules = [
      // Hard bounce rules
      {
        category: BounceCategory.INVALID_EMAIL,
        type: BounceType.HARD,
        patterns: [
          /does not exist/i,
          /no such user/i,
          /invalid recipient/i,
          /mailbox unavailable/i,
          /user unknown/i,
          /recipient address rejected/i,
          /no mailbox found/i,
          /address rejected/i,
          /invalid address/i,
          /not a valid recipient/i,
          /550 5\.1\.1/i,
          /550 5\.1\.2/i
        ],
        retryable: false
      },
      {
        category: BounceCategory.BOUNCED_MAILBOX,
        type: BounceType.HARD,
        patterns: [
          /mailbox disabled/i,
          /account disabled/i,
          /user inactive/i,
          /account inactive/i,
          /no longer active/i
        ],
        retryable: false
      },
      {
        category: BounceCategory.FULL_MAILBOX,
        type: BounceType.SOFT,
        patterns: [
          /mailbox full/i,
          /quota exceeded/i,
          /insufficient storage/i,
          /over quota/i,
          /mailbox size limit/i,
          /space exhausted/i
        ],
        retryable: true
      },
      {
        category: BounceCategory.BLOCKED,
        type: BounceType.HARD,
        patterns: [
          /blocked/i,
          /blacklisted/i,
          /spam rejected/i,
          /rejected by policy/i,
          /not authorized/i,
          /access denied/i,
          /policy violation/i,
          /550 5\.7\.1/i,
          /554 5\.7\.1/i
        ],
        retryable: false
      },
      {
        category: BounceCategory.SPAM,
        type: BounceType.HARD,
        patterns: [
          /spam complaint/i,
          /reported as spam/i,
          /spam rejection/i
        ],
        retryable: false
      },
      {
        category: BounceCategory.TECHNICAL,
        type: BounceType.SOFT,
        patterns: [
          /connection timed out/i,
          /timeout/i,
          /connection refused/i,
          /temporary failure/i,
          /service unavailable/i,
          /rate limit/i,
          /throttled/i,
          /too many messages/i,
          /421/i,
          /450/i,
          /451/i,
          /452/i,
          /454/i
        ],
        retryable: true
      }
    ];

    logger.info(`Initialized ${this.bounceRules.length} bounce classification rules`);
  }

  /**
   * Classify bounce from bounce message
   */
  classifyBounce(
    email: string,
    message: string,
    provider?: EmailProvider,
    providerCode?: string,
    diagnosticCode?: string
  ): BounceInfo {
    const classification = this.analyzeBounceMessage(message, diagnosticCode);

    const bounce: BounceInfo = {
      emailId: uuidv4(),
      recipient: email,
      type: classification.type,
      category: classification.category,
      reason: classification.reason,
      bouncedAt: new Date(),
      provider,
      providerCode,
      diagnosticCode,
      retryable: classification.retryable
    };

    // Store bounce
    this.bounces.set(bounce.emailId, bounce);
    this.bouncedEmails.set(email, bounce);

    // Add to suppression if hard bounce
    if (classification.type === BounceType.HARD) {
      this.addSuppression(email, classification.category);
    }

    logger.info(
      `Classified bounce for ${email}: ${classification.category} (${classification.type})`
    );

    return bounce;
  }

  /**
   * Analyze bounce message to determine type and category
   */
  private analyzeBounceMessage(
    message: string,
    diagnosticCode?: string
  ): {
    type: BounceType;
    category: BounceCategory;
    reason: string;
    retryable: boolean;
  } {
    const fullMessage = diagnosticCode
      ? `${message} ${diagnosticCode}`
      : message;

    // Check each rule
    for (const rule of this.bounceRules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(fullMessage)) {
          return {
            type: rule.type,
            category: rule.category,
            reason: `Matched pattern: ${pattern.source}`,
            retryable: rule.retryable
          };
        }
      }
    }

    // Unknown bounce
    return {
      type: BounceType.UNKNOWN,
      category: BounceCategory.UNKNOWN,
      reason: 'Unknown bounce reason',
      retryable: false
    };
  }

  /**
   * Check if email is on bounce list
   */
  isBounced(email: string): boolean {
    return this.bouncedEmails.has(email);
  }

  /**
   * Get bounce info for email
   */
  getBounceInfo(email: string): BounceInfo | undefined {
    return this.bouncedEmails.get(email);
  }

  /**
   * Check if email is suppressed
   */
  isSuppressed(email: string): boolean {
    return this.suppressedEmails.has(email);
  }

  /**
   * Add email to suppression list
   */
  private addSuppression(
    email: string,
    category: BounceCategory
  ): void {
    const suppression: SuppressionInfo = {
      email,
      category,
      addedAt: new Date(),
      reason: category
    };

    this.suppressedEmails.set(email, suppression);
    logger.info(`Added ${email} to suppression list: ${category}`);
  }

  /**
   * Remove email from suppression list
   */
  removeSuppression(email: string): boolean {
    return this.suppressedEmails.delete(email);
  }

  /**
   * Get suppression list
   */
  getSuppressionList(): SuppressionInfo[] {
    return Array.from(this.suppressedEmails.values());
  }

  /**
   * Process bounce notification from provider
   */
  processBounceNotification(notification: BounceNotification): BounceInfo | null {
    try {
      const email = notification.recipient;

      // Check if we've already processed this bounce
      if (this.bouncedEmails.has(email)) {
        const existing = this.bouncedEmails.get(email)!;
        logger.debug(`Already processed bounce for ${email}`);
        return existing;
      }

      // Classify the bounce
      const bounce = this.classifyBounce(
        email,
        notification.reason || notification.message || '',
        notification.provider,
        notification.code,
        notification.diagnosticCode
      );

      // Trigger bounce webhook if configured
      this.triggerBounceWebhook(bounce);

      return bounce;
    } catch (error) {
      logger.error('Failed to process bounce notification:', error);
      return null;
    }
  }

  /**
   * Trigger bounce webhook
   */
  private triggerBounceWebhook(bounce: BounceInfo): void {
    // This would trigger a webhook to notify external systems
    logger.debug(`Would trigger webhook for bounce: ${bounce.emailId}`);
  }

  /**
   * Get bounce statistics
   */
  getBounceStatistics(startDate?: Date, endDate?: Date): {
    total: number;
    hard: number;
    soft: number;
    byCategory: Record<BounceCategory, number>;
    byProvider: Record<EmailProvider, number>;
  } {
    let bounces = Array.from(this.bounces.values());

    // Filter by date range
    if (startDate || endDate) {
      bounces = bounces.filter(bounce => {
        if (startDate && bounce.bouncedAt < startDate) return false;
        if (endDate && bounce.bouncedAt > endDate) return false;
        return true;
      });
    }

    const stats = {
      total: bounces.length,
      hard: 0,
      soft: 0,
      byCategory: {} as Record<BounceCategory, number>,
      byProvider: {} as Record<EmailProvider, number>
    };

    // Initialize category counts
    Object.values(BounceCategory).forEach(category => {
      stats.byCategory[category] = 0;
    });

    // Initialize provider counts
    Object.values(EmailProvider).forEach(provider => {
      stats.byProvider[provider] = 0;
    });

    // Aggregate statistics
    for (const bounce of bounces) {
      if (bounce.type === BounceType.HARD) {
        stats.hard++;
      } else if (bounce.type === BounceType.SOFT) {
        stats.soft++;
      }

      stats.byCategory[bounce.category]++;
      if (bounce.provider) {
        stats.byProvider[bounce.provider]++;
      }
    }

    return stats;
  }

  /**
   * Clean up old bounces
   */
  cleanupOldBounces(olderThanDays: number = 90): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let removedCount = 0;

    for (const [id, bounce] of this.bounces) {
      if (bounce.bouncedAt < cutoffDate) {
        this.bounces.delete(id);
        // Keep in bouncedEmails map for suppression
        removedCount++;
      }
    }

    logger.info(`Cleaned up ${removedCount} old bounce records`);
  }

  /**
   * Check if should retry sending to bounced email
   */
  shouldRetry(email: string, currentAttempt: number): boolean {
    const bounce = this.bouncedEmails.get(email);

    if (!bounce) {
      return true; // No bounce history, safe to send
    }

    if (!bounce.retryable) {
      return false; // Hard bounce, don't retry
    }

    // Soft bounces can be retried but with limits
    const maxRetries = 3;
    return currentAttempt < maxRetries;
  }

  /**
   * Get retry delay for soft bounces
   */
  getRetryDelay(attempt: number): number {
    // Exponential backoff: 1 hour, 4 hours, 24 hours
    const delays = [60, 240, 1440]; // in minutes
    return delays[Math.min(attempt - 1, delays.length - 1)];
  }

  /**
   * Export suppression list
   */
  exportSuppressionList(): string {
    const data = {
      suppressed: Array.from(this.suppressedEmails.values()),
      exportedAt: new Date()
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import suppression list
   */
  importSuppressionList(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);

      if (data.suppressed && Array.isArray(data.suppressed)) {
        data.suppressed.forEach((suppression: SuppressionInfo) => {
          this.suppressedEmails.set(suppression.email, suppression);
        });

        logger.info(
          `Imported ${data.suppressed.length} email(s) to suppression list`
        );
      }
    } catch (error) {
      logger.error('Failed to import suppression list:', error);
      throw new Error('Invalid JSON data format');
    }
  }

  /**
   * Get bounce trends
   */
  getBounceTrends(days: number = 30): Array<{
    date: Date;
    total: number;
    hard: number;
    soft: number;
  }> {
    const trends: Map<string, { total: number; hard: number; soft: number }> = new Map();

    // Initialize date range
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      trends.set(dateKey, { total: 0, hard: 0, soft: 0 });
    }

    // Aggregate bounces by date
    for (const bounce of this.bounces.values()) {
      const dateKey = bounce.bouncedAt.toISOString().split('T')[0];

      if (trends.has(dateKey)) {
        const stats = trends.get(dateKey)!;
        stats.total++;

        if (bounce.type === BounceType.HARD) {
          stats.hard++;
        } else if (bounce.type === BounceType.SOFT) {
          stats.soft++;
        }
      }
    }

    // Convert to array
    return Array.from(trends.entries()).map(([dateStr, stats]) => ({
      date: new Date(dateStr),
      ...stats
    }));
  }

  /**
   * Get top bounce reasons
   */
  getTopBounceReasons(limit: number = 10): Array<{
    reason: string;
    count: number;
    percentage: number;
  }> {
    const reasonCounts = new Map<string, number>();

    for (const bounce of this.bounces.values()) {
      const reason = bounce.category;
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }

    const total = this.bounces.size;

    return Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Validate email address before sending
   */
  validateEmail(email: string): {
    valid: boolean;
    canSend: boolean;
    reason?: string;
  } {
    // Check syntax
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        valid: false,
        canSend: false,
        reason: 'Invalid email format'
      };
    }

    // Check suppression list
    if (this.isSuppressed(email)) {
      const suppression = this.suppressedEmails.get(email)!;
      return {
        valid: true,
        canSend: false,
        reason: `Email is suppressed: ${suppression.category}`
      };
    }

    // Check bounce history
    if (this.isBounced(email)) {
      const bounce = this.bouncedEmails.get(email)!;
      if (!bounce.retryable) {
        return {
          valid: true,
          canSend: false,
          reason: `Email has hard bounced: ${bounce.category}`
        };
      }
    }

    return {
      valid: true,
      canSend: true
    };
  }

  /**
   * Get recommendations for list hygiene
   */
  getListHygieneRecommendations(): {
    removeSuppressed: number;
    removeHardBounces: number;
    reviewSoftBounces: number;
    totalActions: number;
  } {
    const suppressed = this.suppressedEmails.size;
    const hardBounces = Array.from(this.bounces.values()).filter(
      b => b.type === BounceType.HARD
    ).length;
    const softBounces = Array.from(this.bounces.values()).filter(
      b => b.type === BounceType.SOFT
    ).length;

    return {
      removeSuppressed: suppressed,
      removeHardBounces: hardBounces,
      reviewSoftBounces: softBounces,
      totalActions: suppressed + hardBounces + softBounces
    };
  }
}

/**
 * Bounce rule interface
 */
interface BounceRule {
  category: BounceCategory;
  type: BounceType;
  patterns: RegExp[];
  retryable: boolean;
}

/**
 * Suppression info
 */
interface SuppressionInfo {
  email: string;
  category: BounceCategory;
  addedAt: Date;
  reason: string;
}

/**
 * Bounce notification from provider
 */
interface BounceNotification {
  recipient: string;
  reason?: string;
  message?: string;
  provider?: EmailProvider;
  code?: string;
  diagnosticCode?: string;
  timestamp?: Date;
}

/**
 * Email validator for bounce detection
 */
export class EmailValidator {
  /**
   * Validate email syntax
   */
  static validateSyntax(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Check if email domain is valid
   */
  static async validateDomain(email: string): Promise<boolean> {
    const domain = email.split('@')[1];

    // Check for valid TLD
    const tld = domain.split('.').pop();
    const validTLDs = ['com', 'org', 'net', 'edu', 'gov', 'mil', 'io', 'co', 'ai'];

    if (!validTLDs.includes(tld || '')) {
      return false;
    }

    return true;
  }

  /**
   * Detect role-based email addresses
   */
  static isRoleBasedEmail(email: string): boolean {
    const rolePrefixes = [
      'admin',
      'support',
      'info',
      'sales',
      'marketing',
      'contact',
      'office',
      'help',
      'enquiries',
      'billing',
      'accounts',
      'team',
      'jobs',
      'career'
    ];

    const localPart = email.split('@')[0].toLowerCase();
    return rolePrefixes.includes(localPart);
  }

  /**
   * Detect disposable email addresses
   */
  static isDisposableEmail(email: string): boolean {
    const disposableDomains = [
      'tempmail.com',
      'guerrillamail.com',
      'mailinator.com',
      '10minutemail.com',
      'yopmail.com'
    ];

    const domain = email.split('@')[1].toLowerCase();
    return disposableDomains.includes(domain);
  }
}
