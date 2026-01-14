/**
 * Tests for delivery tracker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeliveryTracker } from '../delivery/tracker';
import type { NotificationChannelType } from '../types';

describe('Delivery Tracker', () => {
  let tracker: DeliveryTracker;

  beforeEach(() => {
    tracker = new DeliveryTracker({
      maxRetries: 3,
      retryDelays: [100, 500, 1000],
      enableBounceHandling: true,
      bounceThreshold: 3,
      trackingRetentionDays: 30,
    });
  });

  describe('createJob', () => {
    it('should create a delivery job', () => {
      const job = tracker.createJob('notif-1', 'email', 'recipient-1');

      expect(job.notificationId).toBe('notif-1');
      expect(job.channelId).toBe('email');
      expect(job.recipientId).toBe('recipient-1');
      expect(job.status).toBe('pending');
      expect(job.attempts).toEqual([]);
      expect(job.maxRetries).toBe(3);
    });
  });

  describe('startAttempt', () => {
    it('should start a delivery attempt', async () => {
      const job = tracker.createJob('notif-1', 'email', 'recipient-1');

      const attempt = await tracker.startAttempt(job.id);

      expect(attempt.notificationId).toBe('notif-1');
      expect(attempt.channelId).toBe('email');
      expect(attempt.attemptNumber).toBe(1);
      expect(attempt.status).toBe('in_progress');
      expect(attempt.startedAt).toBeDefined();
    });
  });

  describe('completeAttempt', () => {
    it('should complete a successful delivery attempt', async () => {
      const job = tracker.createJob('notif-1', 'email', 'recipient-1');
      const attempt = await tracker.startAttempt(job.id);

      const receipt = await tracker.completeAttempt(
        job.id,
        attempt.id,
        true,
        undefined,
        undefined,
        'msg-123'
      );

      expect(receipt.notificationId).toBe('notif-1');
      expect(receipt.status).toBe('delivered');
      expect(receipt.attempts).toBe(1);
      expect(receipt.providerMessageId).toBe('msg-123');
      expect(job.status).toBe('delivered');
    });

    it('should complete a failed delivery attempt', async () => {
      const job = tracker.createJob('notif-1', 'email', 'recipient-1');
      const attempt = await tracker.startAttempt(job.id);

      const receipt = await tracker.completeAttempt(
        job.id,
        attempt.id,
        false,
        'Connection failed',
        'ERR_001'
      );

      expect(receipt.status).toBe('failed');
      expect(receipt.errorMessage).toBe('Connection failed');
      expect(receipt.errorCode).toBe('ERR_001');
    });

    it('should set retry time for failed attempts', async () => {
      const job = tracker.createJob('notif-1', 'email', 'recipient-1');

      // First attempt fails
      const attempt1 = await tracker.startAttempt(job.id);
      await tracker.completeAttempt(job.id, attempt1.id, false);

      expect(job.status).toBe('pending');
      expect(job.nextRetryAt).toBeDefined();
      expect(job.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should mark job as failed after max retries', async () => {
      const job = tracker.createJob('notif-1', 'email', 'recipient-1');

      // Fail all attempts
      for (let i = 0; i < 3; i++) {
        const attempt = await tracker.startAttempt(job.id);
        await tracker.completeAttempt(job.id, attempt.id, false);
      }

      expect(job.status).toBe('failed');
    });
  });

  describe('getJobsReadyForRetry', () => {
    it('should return jobs ready for retry', async () => {
      const job = tracker.createJob('notif-1', 'email', 'recipient-1');
      const attempt = await tracker.startAttempt(job.id);

      // Complete with very short retry delay
      await tracker.completeAttempt(job.id, attempt.id, false);

      // Wait for retry time
      await new Promise((resolve) => setTimeout(resolve, 150));

      const readyJobs = tracker.getJobsReadyForRetry();
      expect(readyJobs.length).toBeGreaterThan(0);
    });
  });

  describe('getReceiptsForNotification', () => {
    it('should return all receipts for a notification', async () => {
      const job1 = tracker.createJob('notif-1', 'email', 'recipient-1');
      const attempt1 = await tracker.startAttempt(job1.id);
      await tracker.completeAttempt(job1.id, attempt1.id, true);

      const job2 = tracker.createJob('notif-1', 'sms', 'recipient-2');
      const attempt2 = await tracker.startAttempt(job2.id);
      await tracker.completeAttempt(job2.id, attempt2.id, true);

      const receipts = tracker.getReceiptsForNotification('notif-1');

      expect(receipts.length).toBe(2);
    });
  });

  describe('getAttemptsForNotification', () => {
    it('should return all attempts for a notification', async () => {
      const job = tracker.createJob('notif-1', 'email', 'recipient-1');

      const attempt1 = await tracker.startAttempt(job.id);
      await tracker.completeAttempt(job.id, attempt1.id, false);

      const attempt2 = await tracker.startAttempt(job.id);
      await tracker.completeAttempt(job.id, attempt2.id, true);

      const attempts = tracker.getAttemptsForNotification('notif-1');

      expect(attempts.length).toBe(2);
    });
  });

  describe('bounce handling', () => {
    it('should detect bounce after threshold failures', async () => {
      // Create multiple failed jobs for same recipient
      for (let i = 0; i < 3; i++) {
        const job = tracker.createJob(`notif-${i}`, 'email', 'recipient-1');
        const attempt = await tracker.startAttempt(job.id);
        await tracker.completeAttempt(job.id, attempt.id, false, 'Permanent failure', '550');
      }

      const bounces = tracker.getBouncesForRecipient('recipient-1');
      expect(bounces.length).toBeGreaterThan(0);
      expect(bounces[0].type).toBe('hard'); // 550 is a hard bounce
    });

    it('should check if recipient has bounced', async () => {
      // Create failed jobs
      for (let i = 0; i < 3; i++) {
        const job = tracker.createJob(`notif-${i}`, 'email', 'recipient-1');
        const attempt = await tracker.startAttempt(job.id);
        await tracker.completeAttempt(job.id, attempt.id, false, 'Permanent failure', '550');
      }

      expect(tracker.hasRecipientBounced('recipient-1', 'email')).toBe(true);
    });

    it('should clean bounce records', async () => {
      const job = tracker.createJob('notif-1', 'email', 'recipient-1');
      const attempt = await tracker.startAttempt(job.id);
      await tracker.completeAttempt(job.id, attempt.id, false, 'Permanent failure', '550');

      const bounces = tracker.getBouncesForRecipient('recipient-1');
      expect(bounces.length).toBeGreaterThan(0);

      const cleaned = tracker.cleanBounce(bounces[0].id);
      expect(cleaned).toBe(true);
    });
  });

  describe('getMetrics', () => {
    it('should return delivery metrics', async () => {
      // Create some successful deliveries
      const job1 = tracker.createJob('notif-1', 'email', 'recipient-1');
      const attempt1 = await tracker.startAttempt(job1.id);
      await tracker.completeAttempt(job1.id, attempt1.id, true);

      // Create some failed deliveries
      const job2 = tracker.createJob('notif-2', 'email', 'recipient-2');
      const attempt2 = await tracker.startAttempt(job2.id);
      await tracker.completeAttempt(job2.id, attempt2.id, false);

      const metrics = tracker.getMetrics();

      expect(metrics.totalSent).toBe(2);
      expect(metrics.totalDelivered).toBe(1);
      expect(metrics.totalFailed).toBe(1);
      expect(metrics.deliveryRate).toBe(0.5);
    });

    it('should include channel metrics', async () => {
      const job1 = tracker.createJob('notif-1', 'email', 'recipient-1');
      const attempt1 = await tracker.startAttempt(job1.id);
      await tracker.completeAttempt(job1.id, attempt1.id, true);

      const job2 = tracker.createJob('notif-2', 'sms', 'recipient-2');
      const attempt2 = await tracker.startAttempt(job2.id);
      await tracker.completeAttempt(job2.id, attempt2.id, true);

      const metrics = tracker.getMetrics();

      expect(metrics.channelMetrics.email).toBeDefined();
      expect(metrics.channelMetrics.sms).toBeDefined();
      expect(metrics.channelMetrics.email.sent).toBe(1);
      expect(metrics.channelMetrics.sms.sent).toBe(1);
    });

    it('should include daily metrics', async () => {
      const job = tracker.createJob('notif-1', 'email', 'recipient-1');
      const attempt = await tracker.startAttempt(job.id);
      await tracker.completeAttempt(job.id, attempt.id, true);

      const metrics = tracker.getMetrics();

      expect(metrics.dailyMetrics).toBeDefined();
      expect(metrics.dailyMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up old records', () => {
      tracker.cleanup();

      const stats = tracker.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return tracker statistics', async () => {
      const job1 = tracker.createJob('notif-1', 'email', 'recipient-1');
      const attempt1 = await tracker.startAttempt(job1.id);
      await tracker.completeAttempt(job1.id, attempt1.id, true);

      const job2 = tracker.createJob('notif-2', 'email', 'recipient-2');
      const attempt2 = await tracker.startAttempt(job2.id);
      await tracker.completeAttempt(job2.id, attempt2.id, false);

      const stats = tracker.getStats();

      expect(stats.totalJobs).toBe(2);
      expect(stats.deliveredJobs).toBe(1);
      expect(stats.failedJobs).toBe(1);
      expect(stats.totalReceipts).toBe(2);
    });
  });
});
