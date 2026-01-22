// @ts-nocheck
/**
 * Delivery tracking and management
 */

import type {
  DeliveryReceipt,
  DeliveryAttempt,
  DeliveryStatus,
  DeliveryMetrics,
  ChannelMetrics,
  DailyMetrics,
  BounceRecord,
  NotificationChannelType,
} from '../types';

export interface DeliveryConfig {
  maxRetries?: number;
  retryDelays?: number[];
  enableBounceHandling?: boolean;
  bounceThreshold?: number;
  trackingRetentionDays?: number;
}

export interface DeliveryJob {
  id: string;
  notificationId: string;
  channelId: NotificationChannelType;
  recipientId: string;
  attempts: DeliveryAttempt[];
  status: DeliveryStatus;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  nextRetryAt?: Date;
}

/**
 * Delivery tracker implementation
 */
export class DeliveryTracker {
  private receipts: Map<string, DeliveryReceipt> = new Map();
  private attempts: Map<string, DeliveryAttempt[]> = new Map();
  private jobs: Map<string, DeliveryJob> = new Map();
  private bounces: Map<string, BounceRecord> = new Map();
  private config: DeliveryConfig;

  constructor(config: DeliveryConfig = {}) {
    this.config = {
      maxRetries: 3,
      retryDelays: [60000, 300000, 900000], // 1min, 5min, 15min
      enableBounceHandling: true,
      bounceThreshold: 3,
      trackingRetentionDays: 30,
      ...config,
    };
  }

  /**
   * Create a new delivery job
   */
  createJob(
    notificationId: string,
    channelId: NotificationChannelType,
    recipientId: string
  ): DeliveryJob {
    const job: DeliveryJob = {
      id: this.generateJobId(),
      notificationId,
      channelId,
      recipientId,
      attempts: [],
      status: 'pending',
      maxRetries: this.config.maxRetries!,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(job.id, job);
    return job;
  }

  /**
   * Start a delivery attempt
   */
  async startAttempt(jobId: string): Promise<DeliveryAttempt> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Delivery job not found: ${jobId}`);
    }

    const attempt: DeliveryAttempt = {
      id: this.generateAttemptId(),
      notificationId: job.notificationId,
      channelId: job.channelId,
      attemptNumber: job.attempts.length + 1,
      status: 'in_progress',
      startedAt: new Date(),
      success: false,
    };

    job.attempts.push(attempt);
    job.status = 'in_progress';
    job.updatedAt = new Date();

    // Track attempts by notification
    const notificationAttempts = this.attempts.get(job.notificationId) || [];
    notificationAttempts.push(attempt);
    this.attempts.set(job.notificationId, notificationAttempts);

    return attempt;
  }

  /**
   * Complete a delivery attempt
   */
  async completeAttempt(
    jobId: string,
    attemptId: string,
    success: boolean,
    errorMessage?: string,
    errorCode?: string,
    providerMessageId?: string
  ): Promise<DeliveryReceipt> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Delivery job not found: ${jobId}`);
    }

    const attempt = job.attempts.find((a) => a.id === attemptId);

    if (!attempt) {
      throw new Error(`Delivery attempt not found: ${attemptId}`);
    }

    // Update attempt
    attempt.completedAt = new Date();
    attempt.success = success;
    attempt.errorMessage = errorMessage;
    attempt.errorCode = errorCode;
    attempt.status = success ? 'delivered' : 'failed';

    if (attempt.startedAt) {
      attempt.duration = attempt.completedAt.getTime() - attempt.startedAt.getTime();
    }

    // Update job status
    if (success) {
      job.status = 'delivered';
    } else if (job.attempts.length >= job.maxRetries) {
      job.status = 'failed';

      // Check for bounce
      if (this.config.enableBounceHandling) {
        await this.handleBounce(job, attempt);
      }
    } else {
      job.status = 'pending';
      job.nextRetryAt = this.calculateRetryTime(job);
    }

    job.updatedAt = new Date();

    // Create delivery receipt
    const receipt: DeliveryReceipt = {
      id: this.generateReceiptId(),
      notificationId: job.notificationId,
      channelId: job.channelId,
      status: success ? 'delivered' : 'failed',
      attempts: job.attempts.length,
      sentAt: attempt.startedAt,
      deliveredAt: success ? attempt.completedAt : undefined,
      failedAt: success ? undefined : attempt.completedAt,
      errorMessage: attempt.errorMessage,
      errorCode: attempt.errorCode,
      providerMessageId,
    };

    this.receipts.set(receipt.id, receipt);

    return receipt;
  }

  /**
   * Calculate retry time for a job
   */
  private calculateRetryTime(job: DeliveryJob): Date {
    const retryIndex = job.attempts.length - 1;
    const delay = this.config.retryDelays![retryIndex] || this.config.retryDelays![this.config.retryDelays!.length - 1]!;

    const lastAttempt = job.attempts[job.attempts.length - 1];
    const baseTime = lastAttempt?.completedAt || new Date();

    return new Date(baseTime.getTime() + delay);
  }

  /**
   * Handle bounce detection
   */
  private async handleBounce(job: DeliveryJob, attempt: DeliveryAttempt): Promise<void> {
    // Count recent failures for this recipient
    const recentFailures = this.countRecentFailures(job.recipientId, job.channelId);

    if (recentFailures >= this.config.bounceThreshold!) {
      // Create bounce record
      const bounce: BounceRecord = {
        id: this.generateBounceId(),
        recipientId: job.recipientId,
        channel: job.channelId,
        type: this.determineBounceType(attempt.errorCode),
        reason: attempt.errorMessage || 'Unknown',
        errorCode: attempt.errorCode,
        bounceDate: new Date(),
        cleaned: false,
      };

      this.bounces.set(bounce.id, bounce);
    }
  }

  /**
   * Count recent failures for a recipient
   */
  private countRecentFailures(recipientId: string, channelId: NotificationChannelType): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1); // Last 24 hours

    let count = 0;

    for (const job of this.jobs.values()) {
      if (job.recipientId === recipientId && job.channelId === channelId) {
        const lastAttempt = job.attempts[job.attempts.length - 1];
        if (
          lastAttempt &&
          !lastAttempt.success &&
          lastAttempt.completedAt &&
          lastAttempt.completedAt > cutoff
        ) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Determine bounce type from error code
   */
  private determineBounceType(errorCode?: string): 'hard' | 'soft' {
    if (!errorCode) {
      return 'soft';
    }

    const hardBounceCodes = ['550', '551', '552', '553', '554'];
    const upperCode = errorCode.toUpperCase();

    if (hardBounceCodes.some((code) => upperCode.includes(code))) {
      return 'hard';
    }

    return 'soft';
  }

  /**
   * Get delivery job by ID
   */
  getJob(jobId: string): DeliveryJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get jobs ready for retry
   */
  getJobsReadyForRetry(): DeliveryJob[] {
    const now = new Date();
    const readyJobs: DeliveryJob[] = [];

    for (const job of this.jobs.values()) {
      if (
        job.status === 'pending' &&
        job.nextRetryAt &&
        job.nextRetryAt <= now &&
        job.attempts.length < job.maxRetries
      ) {
        readyJobs.push(job);
      }
    }

    return readyJobs;
  }

  /**
   * Get delivery receipt by ID
   */
  getReceipt(receiptId: string): DeliveryReceipt | undefined {
    return this.receipts.get(receiptId);
  }

  /**
   * Get receipts for a notification
   */
  getReceiptsForNotification(notificationId: string): DeliveryReceipt[] {
    const receipts: DeliveryReceipt[] = [];

    for (const receipt of this.receipts.values()) {
      if (receipt.notificationId === notificationId) {
        receipts.push(receipt);
      }
    }

    return receipts;
  }

  /**
   * Get attempts for a notification
   */
  getAttemptsForNotification(notificationId: string): DeliveryAttempt[] {
    return this.attempts.get(notificationId) || [];
  }

  /**
   * Get bounce record
   */
  getBounce(bounceId: string): BounceRecord | undefined {
    return this.bounces.get(bounceId);
  }

  /**
   * Get bounces for a recipient
   */
  getBouncesForRecipient(recipientId: string): BounceRecord[] {
    const bounces: BounceRecord[] = [];

    for (const bounce of this.bounces.values()) {
      if (bounce.recipientId === recipientId) {
        bounces.push(bounce);
      }
    }

    return bounces;
  }

  /**
   * Check if recipient has bounced
   */
  hasRecipientBounced(recipientId: string, channelId: NotificationChannelType): boolean {
    for (const bounce of this.bounces.values()) {
      if (bounce.recipientId === recipientId && bounce.channel === channelId && !bounce.cleaned) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clean a bounce record
   */
  cleanBounce(bounceId: string): boolean {
    const bounce = this.bounces.get(bounceId);

    if (bounce) {
      bounce.cleaned = true;
      return true;
    }

    return false;
  }

  /**
   * Get delivery metrics
   */
  getMetrics(dateRange?: { start: Date; end: Date }): DeliveryMetrics {
    let totalSent = 0;
    let totalDelivered = 0;
    let totalFailed = 0;
    let totalBounced = 0;
    let deliveryTimes: number[] = [];

    const channelMetricsMap = new Map<NotificationChannelType, {
      sent: number;
      delivered: number;
      failed: number;
      bounced: number;
      times: number[];
    }>();

    // Process receipts
    for (const receipt of this.receipts.values()) {
      if (dateRange) {
        if (!receipt.sentAt || receipt.sentAt < dateRange.start || receipt.sentAt > dateRange.end) {
          continue;
        }
      }

      totalSent++;
      totalDelivered += receipt.status === 'delivered' ? 1 : 0;
      totalFailed += receipt.status === 'failed' ? 1 : 0;

      // Channel metrics
      if (!channelMetricsMap.has(receipt.channelId)) {
        channelMetricsMap.set(receipt.channelId, {
          sent: 0,
          delivered: 0,
          failed: 0,
          bounced: 0,
          times: [],
        });
      }

      const channelMetrics = channelMetricsMap.get(receipt.channelId)!;
      channelMetrics.sent++;
      channelMetrics.delivered += receipt.status === 'delivered' ? 1 : 0;
      channelMetrics.failed += receipt.status === 'failed' ? 1 : 0;
    }

    // Count bounces
    for (const bounce of this.bounces.values()) {
      if (dateRange) {
        if (bounce.bounceDate < dateRange.start || bounce.bounceDate > dateRange.end) {
          continue;
        }
      }

      totalBounced++;

      const channelMetrics = channelMetricsMap.get(bounce.channel);
      if (channelMetrics) {
        channelMetrics.bounced++;
      }
    }

    // Calculate delivery rate
    const deliveryRate = totalSent > 0 ? totalDelivered / totalSent : 0;

    // Calculate average delivery time
    let averageDeliveryTime = 0;
    if (deliveryTimes.length > 0) {
      const sum = deliveryTimes.reduce((a, b) => a + b, 0);
      averageDeliveryTime = sum / deliveryTimes.length;
    }

    // Build channel metrics
    const channelMetrics: Record<string, ChannelMetrics> = {};

    for (const [channel, metrics] of channelMetricsMap.entries()) {
      const avgTime = metrics.times.length > 0
        ? metrics.times.reduce((a, b) => a + b, 0) / metrics.times.length
        : 0;

      channelMetrics[channel] = {
        channel,
        sent: metrics.sent,
        delivered: metrics.delivered,
        failed: metrics.failed,
        bounced: metrics.bounced,
        deliveryRate: metrics.sent > 0 ? metrics.delivered / metrics.sent : 0,
        averageTime: avgTime,
      };
    }

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      totalBounced,
      deliveryRate,
      averageDeliveryTime,
      channelMetrics,
      dailyMetrics: this.getDailyMetrics(dateRange),
    };
  }

  /**
   * Get daily metrics
   */
  private getDailyMetrics(dateRange?: { start: Date; end: Date }): DailyMetrics[] {
    const dailyMap = new Map<string, {
      sent: number;
      delivered: number;
      failed: number;
      bounced: number;
    }>();

    for (const receipt of this.receipts.values()) {
      if (!receipt.sentAt) {
        continue;
      }

      if (dateRange && (receipt.sentAt < dateRange.start || receipt.sentAt > dateRange.end)) {
        continue;
      }

      const dateKey = receipt.sentAt.toISOString().split('T')[0];

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { sent: 0, delivered: 0, failed: 0, bounced: 0 });
      }

      const metrics = dailyMap.get(dateKey)!;
      metrics.sent++;
      metrics.delivered += receipt.status === 'delivered' ? 1 : 0;
      metrics.failed += receipt.status === 'failed' ? 1 : 0;
    }

    const dailyMetrics: DailyMetrics[] = [];

    for (const [date, metrics] of dailyMap.entries()) {
      dailyMetrics.push({
        date,
        sent: metrics.sent,
        delivered: metrics.delivered,
        failed: metrics.failed,
        bounced: metrics.bounced,
        deliveryRate: metrics.sent > 0 ? metrics.delivered / metrics.sent : 0,
      });
    }

    return dailyMetrics.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Clean up old records
   */
  cleanup(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.trackingRetentionDays!);

    // Clean up old jobs
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.updatedAt < cutoff && (job.status === 'delivered' || job.status === 'failed')) {
        this.jobs.delete(jobId);
      }
    }

    // Clean up old receipts
    for (const [receiptId, receipt] of this.receipts.entries()) {
      if (receipt.sentAt && receipt.sentAt < cutoff) {
        this.receipts.delete(receiptId);
      }
    }

    // Clean up old bounces
    for (const [bounceId, bounce] of this.bounces.entries()) {
      if (bounce.bounceDate < cutoff && bounce.cleaned) {
        this.bounces.delete(bounceId);
      }
    }
  }

  /**
   * Generate unique IDs
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReceiptId(): string {
    return `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBounceId(): string {
    return `bounce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.receipts.clear();
    this.attempts.clear();
    this.jobs.clear();
    this.bounces.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalJobs: number;
    pendingJobs: number;
    inProgressJobs: number;
    deliveredJobs: number;
    failedJobs: number;
    totalReceipts: number;
    totalBounces: number;
  } {
    let pendingJobs = 0;
    let inProgressJobs = 0;
    let deliveredJobs = 0;
    let failedJobs = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'pending':
          pendingJobs++;
          break;
        case 'in_progress':
          inProgressJobs++;
          break;
        case 'delivered':
          deliveredJobs++;
          break;
        case 'failed':
          failedJobs++;
          break;
      }
    }

    return {
      totalJobs: this.jobs.size,
      pendingJobs,
      inProgressJobs,
      deliveredJobs,
      failedJobs,
      totalReceipts: this.receipts.size,
      totalBounces: this.bounces.size,
    };
  }
}
