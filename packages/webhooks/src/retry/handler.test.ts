/**
 * Tests for Retry Handler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RetryHandler, RetryCalculator } from './handler.js';
import { MemoryDeliveryStorage, MemoryKVStorage } from '../storage/memory.js';
import { WebhookEventType, WebhookDeliveryStatus } from '../types/webhook.js';

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;
  let deliveryStorage: MemoryDeliveryStorage;
  let kvStorage: MemoryKVStorage;

  const config: any = {
    retry: {
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      backoffMultiplier: 2,
      maxAttempts: 3,
    },
  };

  beforeEach(() => {
    deliveryStorage = new MemoryDeliveryStorage();
    kvStorage = new MemoryKVStorage();
    retryHandler = new RetryHandler(config, deliveryStorage, kvStorage);
  });

  describe('Retry Calculation', () => {
    it('should calculate exponential backoff', async () => {
      const delivery = await deliveryStorage.create({
        webhookId: 'webhook-1',
        eventType: WebhookEventType.CODE_PUSH,
        eventId: 'event-1',
        payload: { test: 'data' },
        status: 'failed' as WebhookDeliveryStatus,
        attemptNumber: 1,
        maxAttempts: 3,
        duration: 1000,
      });

      const calculation = await retryHandler.calculateRetry(delivery, 500);

      expect(calculation.shouldRetry).toBe(true);
      expect(calculation.attemptNumber).toBe(2);
      expect(calculation.delayMs).toBeGreaterThan(0);
      expect(calculation.nextRetryAt).toBeInstanceOf(Date);
    });

    it('should stop retrying after max attempts', async () => {
      const delivery = await deliveryStorage.create({
        webhookId: 'webhook-1',
        eventType: WebhookEventType.CODE_PUSH,
        eventId: 'event-1',
        payload: { test: 'data' },
        status: 'failed' as WebhookDeliveryStatus,
        attemptNumber: 3,
        maxAttempts: 3,
        duration: 1000,
      });

      const calculation = await retryHandler.calculateRetry(delivery, 500);

      expect(calculation.shouldRetry).toBe(false);
      expect(calculation.reason).toContain('Maximum retry attempts');
    });

    it('should not retry non-retryable status codes', async () => {
      const delivery = await deliveryStorage.create({
        webhookId: 'webhook-1',
        eventType: WebhookEventType.CODE_PUSH,
        eventId: 'event-1',
        payload: { test: 'data' },
        status: 'failed' as WebhookDeliveryStatus,
        attemptNumber: 1,
        maxAttempts: 3,
        duration: 1000,
      });

      const calculation = await retryHandler.calculateRetry(delivery, 404);

      expect(calculation.shouldRetry).toBe(false);
      expect(calculation.reason).toContain('not retryable');
    });

    it('should respect retry configuration', async () => {
      const delivery = await deliveryStorage.create({
        webhookId: 'webhook-1',
        eventType: WebhookEventType.CODE_PUSH,
        eventId: 'event-1',
        payload: { test: 'data' },
        status: 'failed' as WebhookDeliveryStatus,
        attemptNumber: 1,
        maxAttempts: 5,
        duration: 1000,
      });

      const calculation = await retryHandler.calculateRetry(delivery, 500);

      expect(calculation.attemptNumber).toBe(2);
    });
  });

  describe('Retry Scheduling', () => {
    it('should schedule a retry', async () => {
      const delivery = await deliveryStorage.create({
        webhookId: 'webhook-1',
        eventType: WebhookEventType.CODE_PUSH,
        eventId: 'event-1',
        payload: { test: 'data' },
        status: 'failed' as WebhookDeliveryStatus,
        attemptNumber: 1,
        maxAttempts: 3,
        duration: 1000,
      });

      const nextRetryAt = new Date(Date.now() + 5000);

      await retryHandler.scheduleRetry(delivery, nextRetryAt, 2);

      const updated = await deliveryStorage.getById(delivery.id);
      expect(updated!.status).toBe('retrying');
      expect(updated!.attemptNumber).toBe(2);
    });

    it('should get due retries', async () => {
      const delivery = await deliveryStorage.create({
        webhookId: 'webhook-1',
        eventType: WebhookEventType.CODE_PUSH,
        eventId: 'event-1',
        payload: { test: 'data' },
        status: 'failed' as WebhookDeliveryStatus,
        attemptNumber: 1,
        maxAttempts: 3,
        duration: 1000,
      });

      const pastTime = new Date(Date.now() - 1000);
      await retryHandler.scheduleRetry(delivery, pastTime, 2);

      const dueRetries = retryHandler.getDueRetries();

      expect(dueRetries.length).toBeGreaterThan(0);
    });
  });

  describe('Queue Management', () => {
    it('should return queue size', () => {
      expect(retryHandler.getQueueSize()).toBe(0);
    });

    it('should clear webhook retries', async () => {
      const delivery = await deliveryStorage.create({
        webhookId: 'webhook-1',
        eventType: WebhookEventType.CODE_PUSH,
        eventId: 'event-1',
        payload: { test: 'data' },
        status: 'failed' as WebhookDeliveryStatus,
        attemptNumber: 1,
        maxAttempts: 3,
        duration: 1000,
      });

      const nextRetryAt = new Date(Date.now() + 5000);
      await retryHandler.scheduleRetry(delivery, nextRetryAt, 2);

      const cleared = await retryHandler.clearWebhookRetries('webhook-1');

      expect(cleared).toBeGreaterThan(0);
    });
  });
});

describe('RetryCalculator', () => {
  describe('Exponential Backoff', () => {
    it('should calculate exponential backoff delays', () => {
      const delay1 = RetryCalculator.exponentialBackoff(1, 1000, 60000, 2);
      const delay2 = RetryCalculator.exponentialBackoff(2, 1000, 60000, 2);
      const delay3 = RetryCalculator.exponentialBackoff(3, 1000, 60000, 2);

      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000);
      expect(delay3).toBe(4000);
    });

    it('should cap delay at maximum', () => {
      const delay = RetryCalculator.exponentialBackoff(10, 1000, 5000, 2);

      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe('Linear Backoff', () => {
    it('should calculate linear backoff delays', () => {
      const delay1 = RetryCalculator.linearBackoff(1, 1000, 60000, 1000);
      const delay2 = RetryCalculator.linearBackoff(2, 1000, 60000, 1000);
      const delay3 = RetryCalculator.linearBackoff(3, 1000, 60000, 1000);

      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000);
      expect(delay3).toBe(3000);
    });
  });

  describe('Fixed Interval', () => {
    it('should return fixed delay', () => {
      const delay = RetryCalculator.fixedInterval(5000);

      expect(delay).toBe(5000);
    });
  });

  describe('Retryable Status Codes', () => {
    it('should identify retryable status codes', () => {
      expect(RetryCalculator.isRetryableStatusCode(408)).toBe(true);
      expect(RetryCalculator.isRetryableStatusCode(429)).toBe(true);
      expect(RetryCalculator.isRetryableStatusCode(500)).toBe(true);
      expect(RetryCalculator.isRetryableStatusCode(502)).toBe(true);
      expect(RetryCalculator.isRetryableStatusCode(503)).toBe(true);
      expect(RetryCalculator.isRetryableStatusCode(504)).toBe(true);
    });

    it('should identify non-retryable status codes', () => {
      expect(RetryCalculator.isRetryableStatusCode(400)).toBe(false);
      expect(RetryCalculator.isRetryableStatusCode(401)).toBe(false);
      expect(RetryCalculator.isRetryableStatusCode(403)).toBe(false);
      expect(RetryCalculator.isRetryableStatusCode(404)).toBe(false);
    });
  });

  describe('Retryable Errors', () => {
    it('should identify retryable errors', () => {
      expect(RetryCalculator.isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(RetryCalculator.isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
      expect(RetryCalculator.isRetryableError(new Error('timeout'))).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(RetryCalculator.isRetryableError(new Error('Validation failed'))).toBe(false);
    });
  });

  describe('Jitter', () => {
    it('should add jitter to delay', () => {
      const baseDelay = 1000;
      const withJitter = RetryCalculator.addJitter(baseDelay, 0.1);

      expect(withJitter).toBeGreaterThanOrEqual(900);
      expect(withJitter).toBeLessThanOrEqual(1100);
    });
  });
});
