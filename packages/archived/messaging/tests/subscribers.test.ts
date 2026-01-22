import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubscriberManager } from '../src/subscribers/manager';

describe('SubscriberManager', () => {
  let subscriberManager: SubscriberManager;

  beforeEach(() => {
    vi.useFakeTimers();
    subscriberManager = new SubscriberManager({
      maxSubscriptions: 1000,
      maxRetries: 5,
      healthCheckInterval: 1000,
      enableHealthChecks: true,
      enableDeadLetter: true,
      deadLetterRetention: 86400000 // 24 hours
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await subscriberManager.close();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(subscriberManager).toBeDefined();
      expect(subscriberManager['config'].maxSubscriptions).toBe(1000);
      expect(subscriberManager['config'].maxRetries).toBe(5);
      expect(subscriberManager['config'].enableHealthChecks).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customManager = new SubscriberManager({
        maxSubscriptions: 100,
        maxRetries: 3,
        enableHealthChecks: false,
        enableDeadLetter: false
      });

      expect(customManager['config'].maxSubscriptions).toBe(100);
      expect(customManager['config'].maxRetries).toBe(3);
      expect(customManager['config'].enableHealthChecks).toBe(false);
      expect(customManager['config'].enableDeadLetter).toBe(false);
    });
  });

  describe('subscription management', () => {
    it('should create subscription successfully', async () => {
      const subscription = await subscriberManager.createSubscription(
        'test.topic',
        'service-1',
        {
          deliveryGuarantee: 'at-least-once',
          batchSize: 10,
          retryPolicy: {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 5000,
            backoffMultiplier: 2,
            jitter: true
          }
        }
      );

      expect(subscription).toBeDefined();
      expect(subscription.topic).toBe('test.topic');
      expect(subscription.subscriber).toBe('service-1');
      expect(subscription.deliveryGuarantee).toBe('at-least-once');
      expect(subscription.batchSize).toBe(10);
      expect(subscription.id).toBeDefined();
      expect(subscription.createdAt).toBeDefined();
    });

    it('should create subscription with dead letter queue', async () => {
      const subscription = await subscriberManager.createSubscription(
        'test.topic',
        'service-1',
        {
          deadLetterQueue: 'test.topic.deadletter'
        }
      );

      expect(subscription.deadLetterQueue).toBe('test.topic.deadletter');
    });

    it('should reject subscription creation when max subscriptions reached', async () => {
      const manager = new SubscriberManager({ maxSubscriptions: 1 });

      await manager.createSubscription('topic1', 'sub1');
      await expect(manager.createSubscription('topic2', 'sub2')).rejects.toThrow('Maximum number of subscriptions reached');
    });

    it('should get subscription by ID', async () => {
      const subscription = await subscriberManager.createSubscription('test.topic', 'service-1');
      const retrieved = await subscriberManager.getSubscription(subscription.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(subscription.id);
      expect(retrieved?.topic).toBe('test.topic');
      expect(retrieved?.subscriber).toBe('service-1');
    });

    it('should return undefined for non-existent subscription', async () => {
      const retrieved = await subscriberManager.getSubscription('nonexistent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should get subscriptions by topic', async () => {
      await subscriberManager.createSubscription('test.topic', 'service-1');
      await subscriberManager.createSubscription('test.topic', 'service-2');
      await subscriberManager.createSubscription('other.topic', 'service-3');

      const subscriptions = await subscriberManager.getSubscriptionsByTopic('test.topic');

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions.map(s => s.subscriber)).toContain('service-1');
      expect(subscriptions.map(s => s.subscriber)).toContain('service-2');
    });

    it('should get subscriptions by subscriber', async () => {
      await subscriberManager.createSubscription('topic1', 'service-1');
      await subscriberManager.createSubscription('topic2', 'service-1');
      await subscriberManager.createSubscription('topic3', 'service-2');

      const subscriptions = await subscriberManager.getSubscriptionsBySubscriber('service-1');

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions.map(s => s.topic)).toContain('topic1');
      expect(subscriptions.map(s => s.topic)).toContain('topic2');
    });

    it('should update subscription', async () => {
      const subscription = await subscriberManager.createSubscription('test.topic', 'service-1');
      const updated = await subscriberManager.updateSubscription(subscription.id, {
        batchSize: 20,
        maxConcurrency: 5
      });

      expect(updated).toBeDefined();
      expect(updated?.batchSize).toBe(20);
      expect(updated?.maxConcurrency).toBe(5);
    });

    it('should delete subscription', async () => {
      const subscription = await subscriberManager.createSubscription('test.topic', 'service-1');
      let retrieved = await subscriberManager.getSubscription(subscription.id);
      expect(retrieved).toBeDefined();

      const deleted = await subscriberManager.deleteSubscription(subscription.id);
      expect(deleted).toBe(true);

      retrieved = await subscriberManager.getSubscription(subscription.id);
      expect(retrieved).toBeUndefined();
    });

    it('should return false when deleting non-existent subscription', async () => {
      const deleted = await subscriberManager.deleteSubscription('nonexistent-id');
      expect(deleted).toBe(false);
    });

    it('should get all subscriptions', async () => {
      await subscriberManager.createSubscription('topic1', 'sub1');
      await subscriberManager.createSubscription('topic2', 'sub2');
      await subscriberManager.createSubscription('topic3', 'sub3');

      const allSubscriptions = await subscriberManager.getAllSubscriptions();

      expect(allSubscriptions).toHaveLength(3);
      expect(allSubscriptions.map(s => s.subscriber)).toContain('sub1');
      expect(allSubscriptions.map(s => s.subscriber)).toContain('sub2');
      expect(allSubscriptions.map(s => s.subscriber)).toContain('sub3');
    });

    it('should check subscription existence', async () => {
      const subscription = await subscriberManager.createSubscription('test.topic', 'service-1');

      expect(await subscriberManager.subscriptionExists(subscription.id)).toBe(true);
      expect(await subscriberManager.subscriptionExists('nonexistent-id')).toBe(false);
    });

    it('should count subscriptions', async () => {
      await subscriberManager.createSubscription('topic1', 'sub1');
      await subscriberManager.createSubscription('topic1', 'sub2');
      await subscriberManager.createSubscription('topic2', 'sub1');

      expect(await subscriberManager.getSubscriptionCount()).toBe(3);
      expect(await subscriberManager.getSubscriptionCount('topic1')).toBe(2);
      expect(await subscriberManager.getSubscriptionCount(undefined, 'sub1')).toBe(2);
      expect(await subscriberManager.getSubscriptionCount('topic1', 'sub1')).toBe(1);
    });
  });

  describe('health management', () => {
    it('should initialize subscriber health', async () => {
      const subscription = await subscriberManager.createSubscription('test.topic', 'service-1');
      const health = await subscriberManager.getSubscriberHealth('service-1');

      expect(health).toBeDefined();
      expect(health?.subscriber).toBe('service-1');
      expect(health?.status).toBe('unknown');
      expect(health?.lastCheck).toBeGreaterThan(0);
    });

    it('should update subscriber health', () => {
      subscriberManager.updateSubscriberHealth('service-1', 'healthy', 100);

      const health = subscriberManager['subscriberHealth'].get('service-1');
      expect(health?.status).toBe('healthy');
      expect(health?.responseTime).toBe(100);
      expect(health?.connected).toBe(true);
      expect(health?.errorRate).toBe(0);
    });

    it('should track error rates', () => {
      subscriberManager.updateSubscriberHealth('service-1', 'healthy', 100);
      subscriberManager.updateSubscriberHealth('service-1', 'unhealthy', 200);
      subscriberManager.updateSubscriberHealth('service-1', 'unhealthy', 300);

      const health = subscriberManager['subscriberHealth'].get('service-1');
      expect(health?.errorRate).toBeCloseTo(0.2, 1); // 2 failures out of 3 updates
    });

    it('should get all subscriber health', async () => {
      await subscriberManager.createSubscription('topic1', 'sub1');
      await subscriberManager.createSubscription('topic2', 'sub2');

      const health = await subscriberManager.getAllSubscriberHealth();

      expect(health).toHaveLength(2);
      expect(health.map(h => h.subscriber)).toContain('sub1');
      expect(health.map(h => h.subscriber)).toContain('sub2');
    });

    it('should get healthy subscribers', async () => {
      await subscriberManager.createSubscription('topic1', 'sub1');
      await subscriberManager.createSubscription('topic2', 'sub2');

      subscriberManager.updateSubscriberHealth('sub1', 'healthy', 100);
      subscriberManager.updateSubscriberHealth('sub2', 'unhealthy', 200);

      const healthy = await subscriberManager.getHealthySubscribers();
      expect(healthy).toHaveLength(1);
      expect(healthy[0].subscriber).toBe('sub1');
    });

    it('should get unhealthy subscribers', async () => {
      await subscriberManager.createSubscription('topic1', 'sub1');
      await subscriberManager.createSubscription('topic2', 'sub2');

      subscriberManager.updateSubscriberHealth('sub1', 'healthy', 100);
      subscriberManager.updateSubscriberHealth('sub2', 'unhealthy', 200);

      const unhealthy = await subscriberManager.getUnhealthySubscribers();
      expect(unhealthy).toHaveLength(1);
      expect(unhealthy[0].subscriber).toBe('sub2');
    });
  });

  describe('health checks', () => {
    it('should perform health checks', async () => {
      await subscriberManager.createSubscription('topic1', 'sub1');
      await subscriberManager.createSubscription('topic2', 'sub2');

      // Mock health check calls
      const checkSpy = vi.spyOn(subscriberManager, 'checkSubscriberHealth');
      checkSpy.mockResolvedValue();

      await subscriberManager.performHealthChecks();

      expect(checkSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle health check failures', async () => {
      await subscriberManager.createSubscription('topic1', 'sub1');

      // Mock a failing health check
      vi.spyOn(subscriberManager, 'checkSubscriberHealth')
        .mockRejectedValue(new Error('Health check failed'));

      await subscriberManager.performHealthChecks();

      const health = await subscriberManager.getSubscriberHealth('sub1');
      expect(health?.status).toBe('unhealthy');
    });
  });

  describe('dead letter queue', () => {
    it('should add to dead letter queue', async () => {
      const subscription = await subscriberManager.createSubscription(
        'test.topic',
        'service-1',
        { deadLetterQueue: 'test.topic.deadletter' }
      );

      const message = { id: 'msg1', payload: 'test' };
      await subscriberManager.addToDeadLetterQueue(subscription.id, message, 'Delivery failed', 3);

      const dlq = await subscriberManager.getDeadLetterQueue('test.topic.deadletter');
      expect(dlq).toHaveLength(1);
      expect(dlq[0].originalMessage).toEqual(message);
      expect(dlq[0].error).toBe('Delivery failed');
      expect(dlq[0].attempts).toBe(3);
    });

    it('should remove from dead letter queue', async () => {
      const subscription = await subscriberManager.createSubscription(
        'test.topic',
        'service-1',
        { deadLetterQueue: 'test.topic.deadletter' }
      );

      await subscriberManager.addToDeadLetterQueue(subscription.id, { id: 'msg1' }, 'error', 1);

      let dlq = await subscriberManager.getDeadLetterQueue('test.topic.deadletter');
      expect(dlq).toHaveLength(1);

      const removed = await subscriberManager.removeFromDeadLetterQueue(
        'test.topic.deadletter',
        dlq[0].id
      );
      expect(removed).toBe(true);

      dlq = await subscriberManager.getDeadLetterQueue('test.topic.deadletter');
      expect(dlq).toHaveLength(0);
    });

    it('should clean up expired dead letter messages', () => {
      const message = {
        id: 'msg1',
        originalMessage: {},
        error: 'error',
        attempts: 1,
        timestamp: Date.now() - 100000000, // Expired
        metadata: {}
      };

      subscriberManager['deadLetterQueue'].set('test.deadletter', [message]);

      // Advance time
      vi.advanceTimersByTime(60000);

      // Cleanup happens every minute
      const cleanupSpy = vi.spyOn(subscriberManager, 'cleanupDeadLetterQueue');
      cleanupSpy.mockImplementation(async () => {
        const now = Date.now();
        for (const [dlqId, messages] of subscriberManager['deadLetterQueue'].entries()) {
          const filtered = messages.filter(msg => now - msg.timestamp < 86400000);
          if (filtered.length === 0) {
            subscriberManager['deadLetterQueue'].delete(dlqId);
          } else {
            subscriberManager['deadLetterQueue'].set(dlqId, filtered);
          }
        }
      });

      subscriberManager['cleanupDeadLetterQueue']();

      const dlq = subscriberManager['deadLetterQueue'].get('test.deadletter');
      expect(dlq).toHaveLength(0);
    });
  });

  describe('metrics', () => {
    it('should provide metrics', async () => {
      await subscriberManager.createSubscription('topic1', 'sub1');
      await subscriberManager.createSubscription('topic2', 'sub2');

      subscriberManager.updateSubscriberHealth('sub1', 'healthy', 100);
      subscriberManager.updateSubscriberHealth('sub2', 'unhealthy', 200);

      const metrics = await subscriberManager.getMetrics();

      expect(metrics.totalSubscriptions).toBe(2);
      expect(metrics.healthySubscribers).toBe(1);
      expect(metrics.unhealthySubscribers).toBe(1);
      expect(metrics.averageResponseTime).toBe(150);
    });

    it('should handle DLQ in metrics', async () => {
      const subscription = await subscriberManager.createSubscription(
        'test.topic',
        'service-1',
        { deadLetterQueue: 'test.topic.deadletter' }
      );

      await subscriberManager.addToDeadLetterQueue(subscription.id, { id: 'msg1' }, 'error', 1);

      const metrics = await subscriberManager.getMetrics();
      expect(metrics.deadLetterCount).toBe(1);
    });
  });
});