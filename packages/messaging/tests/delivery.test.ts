import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeliveryEngine } from '../src/delivery/engine';
import { Subscription, Message } from '../src/types';
import { createMessage } from '../src/utils';

describe('DeliveryEngine', () => {
  let deliveryEngine: DeliveryEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    deliveryEngine = new DeliveryEngine({
      maxConcurrentDeliveries: 10,
      deliveryTimeout: 1000,
      enablePersistence: true,
      enableMetrics: true,
      enableBackpressure: true,
      maxQueueSize: 100,
      retryBackoffMultiplier: 2,
      maxRetryDelay: 10000
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await deliveryEngine.close();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(deliveryEngine).toBeDefined();
      expect(deliveryEngine['config'].maxConcurrentDeliveries).toBe(10);
      expect(deliveryEngine['config'].deliveryTimeout).toBe(1000);
      expect(deliveryEngine['config'].enablePersistence).toBe(true);
      expect(deliveryEngine['config'].enableMetrics).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customEngine = new DeliveryEngine({
        maxConcurrentDeliveries: 5,
        deliveryTimeout: 2000,
        enablePersistence: false,
        enableMetrics: false,
        enableBackpressure: false
      });

      expect(customEngine['config'].maxConcurrentDeliveries).toBe(5);
      expect(customEngine['config'].deliveryTimeout).toBe(2000);
      expect(customEngine['config'].enablePersistence).toBe(false);
      expect(customEngine['config'].enableMetrics).toBe(false);
    });
  });

  describe('delivery - at-most-once', () => {
    it('should deliver message successfully', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-most-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      const result = await deliveryEngine.deliverMessage(message, subscription);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(message.id);
      expect(result.subscriber).toBe('service-1');
    });

    it('should handle delivery failure', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-most-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      // Force failure by reducing success probability to 0
      const originalRandom = Math.random;
      Math.random = () => 0.99; // Always fail

      const result = await deliveryEngine.deliverMessage(message, subscription);

      Math.random = originalRandom; // Restore

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle delivery timeout', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-most-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      // Mock delivery to simulate timeout
      const originalAttemptDelivery = deliveryEngine['attemptDelivery'];
      deliveryEngine['attemptDelivery'] = async (msg, sub, opts) => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer than timeout
        return { success: true, messageId: msg.id, subscriber: sub.subscriber };
      };

      const result = await deliveryEngine.deliverMessage(message, subscription, {
        timeout: 1000
      });

      deliveryEngine['attemptDelivery'] = originalAttemptDelivery;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delivery timeout');
    });
  });

  describe('delivery - at-least-once', () => {
    it('should retry failed delivery', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-least-once',
        retryPolicy: {
          maxRetries: 2,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
          jitter: false
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      let attemptCount = 0;
      const originalAttemptDelivery = deliveryEngine['attemptDelivery'];
      deliveryEngine['attemptDelivery'] = async (msg, sub, opts) => {
        attemptCount++;
        if (attemptCount < 3) {
          return { success: false, messageId: msg.id, subscriber: sub.subscriber, error: 'Failed' };
        }
        return { success: true, messageId: msg.id, subscriber: sub.subscriber };
      };

      const startTime = Date.now();
      const result = await deliveryEngine.deliverMessage(message, subscription);
      const endTime = Date.now();

      deliveryEngine['attemptDelivery'] = originalAttemptDelivery;

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3); // 2 failures + 1 success
      expect(result.retryAttempt).toBe(2);
    });

    it('should respect max retry limit', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-least-once',
        retryPolicy: {
          maxRetries: 1,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
          jitter: false
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      let attemptCount = 0;
      const originalAttemptDelivery = deliveryEngine['attemptDelivery'];
      deliveryEngine['attemptDelivery'] = async (msg, sub, opts) => {
        attemptCount++;
        return { success: false, messageId: msg.id, subscriber: sub.subscriber, error: 'Failed' };
      };

      const result = await deliveryEngine.deliverMessage(message, subscription);

      deliveryEngine['attemptDelivery'] = originalAttemptDelivery;

      expect(result.success).toBe(false);
      expect(attemptCount).toBe(2); // 1 initial + 1 retry
      expect(result.retryAttempt).toBe(1);
    });

    it('should use retry backoff', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-least-once',
        retryPolicy: {
          maxRetries: 2,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
          jitter: false
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      const delaySpy = vi.spyOn(deliveryEngine, 'sleep');

      const originalAttemptDelivery = deliveryEngine['attemptDelivery'];
      deliveryEngine['attemptDelivery'] = async (msg, sub, opts) => {
        return { success: false, messageId: msg.id, subscriber: sub.subscriber, error: 'Failed' };
      };

      await deliveryEngine.deliverMessage(message, subscription);

      deliveryEngine['attemptDelivery'] = originalAttemptDelivery;

      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenNthCalledWith(1, 100); // initialDelay
      expect(delaySpy).toHaveBeenNthCalledWith(2, 200); // initialDelay * multiplier
    });
  });

  describe('delivery - exactly-once', () => {
    it('should check and mark delivered message', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'exactly-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      const checkSpy = vi.spyOn(deliveryEngine, 'checkMessageDelivered');
      const markSpy = vi.spyOn(deliveryEngine, 'markMessageDelivered');

      checkSpy.mockResolvedValue(false); // Message not delivered before

      const result = await deliveryEngine.deliverMessage(message, subscription);

      expect(result.success).toBe(true);
      expect(checkSpy).toHaveBeenCalledWith(message.id, subscription.id);
      expect(markSpy).toHaveBeenCalledWith(message.id, subscription.id);
    });

    it('should skip duplicate delivery', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'exactly-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      const checkSpy = vi.spyOn(deliveryEngine, 'checkMessageDelivered');
      checkSpy.mockResolvedValue(true); // Message already delivered

      const result = await deliveryEngine.deliverMessage(message, subscription);

      expect(result.success).toBe(true);
      expect(checkSpy).toHaveBeenCalledWith(message.id, subscription.id);
    });
  });

  describe('concurrency and backpressure', () => {
    it('should respect concurrent delivery limit', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-most-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      const engine = new DeliveryEngine({ maxConcurrentDeliveries: 2 });

      // Queue 5 deliveries, should only process 2 concurrently
      const deliveries = [];
      for (let i = 0; i < 5; i++) {
        deliveries.push(engine.deliverMessage(message, subscription));
      }

      const results = await Promise.all(deliveries);
      const successful = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success && r.error?.includes('Maximum concurrent')).length;

      expect(successful).toBeGreaterThan(0);
      expect(failures).toBeGreaterThan(0);
    });

    it('should respect queue size limit', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-most-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      const engine = new DeliveryEngine({
        maxConcurrentDeliveries: 100,
        maxQueueSize: 5
      });

      // Mock slow delivery
      const originalProcessDelivery = engine['processDelivery'];
      engine['processDelivery'] = async (deliveryId: string) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, messageId: '', subscriber: '' };
      };

      const deliveries = [];
      for (let i = 0; i < 10; i++) {
        deliveries.push(engine.deliverMessage(message, subscription));
      }

      const results = await Promise.all(deliveries);
      const backpressureFailures = results.filter(r =>
        !r.success && r.error?.includes('Backpressure')
      ).length;

      expect(backpressureFailures).toBeGreaterThan(0);
    });
  });

  describe('metrics', () => {
    it('should track delivery metrics', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-most-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      // Deliver multiple messages
      await deliveryEngine.deliverMessage(message, subscription);
      await deliveryEngine.deliverMessage(message, subscription);

      const metrics = await deliveryEngine.getMetrics();

      expect(metrics.totalDeliveries).toBe(2);
      expect(metrics.successfulDeliveries).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThan(0);
      expect(metrics.retryRate).toBe(0);
    });

    it('should calculate throughput', async () => {
      vi.useRealTimers();

      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-most-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      // Deliver messages rapidly
      for (let i = 0; i < 10; i++) {
        await deliveryEngine.deliverMessage(message, subscription);
      }

      // Wait for throughput calculation
      await new Promise(resolve => setTimeout(resolve, 1500));

      const metrics = await deliveryEngine.getMetrics();
      expect(metrics.throughput).toBeGreaterThan(0);
    });

    it('should reset metrics', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-most-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      await deliveryEngine.deliverMessage(message, subscription);
      expect((await deliveryEngine.getMetrics()).totalDeliveries).toBe(1);

      deliveryEngine.resetMetrics();
      expect((await deliveryEngine.getMetrics()).totalDeliveries).toBe(0);
    });
  });

  describe('queue management', () => {
    it('should provide queue status', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-most-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      const status1 = await deliveryEngine.getQueueStatus();
      expect(status1.queueSize).toBe(0);
      expect(status1.pendingDeliveries).toBe(0);

      await deliveryEngine.deliverMessage(message, subscription);

      const status2 = await deliveryEngine.getQueueStatus();
      expect(status2.queueSize).toBeGreaterThan(0);
      expect(status2.pendingDeliveries).toBeGreaterThan(0);
    });

    it('should flush pending deliveries', async () => {
      const message = createMessage('test.topic', { data: 'test' });
      const subscription: Subscription = {
        id: 'sub1',
        topic: 'test.topic',
        subscriber: 'service-1',
        deliveryGuarantee: 'at-most-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };

      // Mock slow delivery
      const originalAttemptDelivery = deliveryEngine['attemptDelivery'];
      deliveryEngine['attemptDelivery'] = async (msg, sub, opts) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { success: true, messageId: msg.id, subscriber: sub.subscriber };
      };

      await deliveryEngine.deliverMessage(message, subscription);

      const statusBefore = await deliveryEngine.getQueueStatus();
      expect(statusBefore.pendingDeliveries).toBe(1);

      await deliveryEngine.flush();

      const statusAfter = await deliveryEngine.getQueueStatus();
      expect(statusAfter.pendingDeliveries).toBe(0);
    });
  });
});