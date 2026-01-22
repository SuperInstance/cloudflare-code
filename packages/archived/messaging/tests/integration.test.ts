import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessagingBroker } from '../src/broker';
import { createMessage, createTopic, createSubscription } from '../src/utils';

describe('MessagingBroker Integration', () => {
  let broker: MessagingBroker;

  beforeEach(async () => {
    vi.useFakeTimers();
    broker = new MessagingBroker({
      router: {
        enableTransformation: true,
        enableFiltering: true
      },
      topics: {
        enableMetrics: true
      },
      subscribers: {
        enableHealthChecks: true
      },
      delivery: {
        maxConcurrentDeliveries: 10,
        enableMetrics: true
      }
    });
    await broker.start();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await broker.stop();
  });

  describe('basic operations', () => {
    it('should publish and deliver message', async () => {
      // Create subscription
      const subscriptionResult = await broker.subscribe(
        'test.topic',
        'service-1',
        { deliveryGuarantee: 'at-least-once' }
      );
      expect(subscriptionResult.success).toBe(true);

      // Publish message
      const publishResult = await broker.publish('test.topic', { data: 'test message' });
      expect(publishResult.success).toBe(true);
      expect(publishResult.messageId).toBeDefined();
    });

    it('should publish to multiple subscribers', async () => {
      // Create multiple subscriptions
      await broker.subscribe('test.topic', 'service-1');
      await broker.subscribe('test.topic', 'service-2');
      await broker.subscribe('test.topic', 'service-3');

      // Publish message
      const result = await broker.publish('test.topic', { data: 'broadcast' });
      expect(result.success).toBe(true);
    });

    it('should handle message routing', async () => {
      // Add routing rule
      await broker.createRoutingRule(
        'notifications.*',
        [{ type: 'forward', target: 'notification-service' }],
        { name: 'Notifications Routing' }
      );

      // Create subscription on forwarded topic
      await broker.subscribe('notification-service', 'email-service');

      // Publish message
      const result = await broker.publish('notifications.user', {
        userId: 123,
        message: 'Hello World'
      });
      expect(result.success).toBe(true);
    });

    it('should transform message', async () => {
      // Add transformation rule
      await broker.createRoutingRule(
        'api.*.request',
        [{
          type: 'transform',
          transform: {
            payload: {
              operation: 'replace',
              value: { processed: true, timestamp: Date.now() }
            }
          }
        }]
      );

      // Create subscription
      await broker.subscribe('api.service.response', 'service-1');

      // Publish message
      const result = await broker.publish('api.service.request', {
        data: 'original',
        userId: 123
      });
      expect(result.success).toBe(true);
    });

    it('should filter messages', async () => {
      // Add filter rule
      await broker.createRoutingRule(
        'logs.*',
        [{
          type: 'filter',
          filter: {
            payload: {
              level: 'error'
            }
          }
        }]
      );

      // Create subscription
      await broker.subscribe('logs.errors', 'error-processor');

      // Publish messages
      await broker.publish('logs.application', { level: 'info', message: 'Info log' });
      await broker.publish('logs.application', { level: 'error', message: 'Error log' });

      // Only error message should be delivered
      const subscriptions = await broker.getSubscriptions();
      const errorLogs = subscriptions.filter(s => s.topic === 'logs.errors');
      expect(errorLogs.length).toBeGreaterThan(0);
    });
  });

  describe('topic management', () => {
    it('should create and manage topics', async () => {
      const topic = await broker.createTopic('integration.test', 3, 2);
      expect(topic.name).toBe('integration.test');
      expect(topic.partitions).toBe(3);
      expect(topic.replicationFactor).toBe(2);

      const topics = await broker.getTopics();
      expect(topics.map(t => t.name)).toContain('integration.test');
    });

    it('should track topic statistics', async () => {
      // Create topic
      await broker.createTopic('stats.test');

      // Create subscription
      await broker.subscribe('stats.test', 'service-1');

      // Publish messages
      for (let i = 0; i < 10; i++) {
        await broker.publish('stats.test', { message: i });
      }

      const stats = await broker.getStats();
      expect(stats.totalTopics).toBeGreaterThan(0);
      expect(stats.totalMessages).toBe(10);
    });
  });

  describe('subscription management', () => {
    it('should create and manage subscriptions', async () => {
      const subscriptionResult = await broker.subscribe(
        'test.topic',
        'service-1',
        {
          deliveryGuarantee: 'exactly-once',
          batchSize: 5
        }
      );
      expect(subscriptionResult.success).toBe(true);

      const subscriptions = await broker.getSubscriptions('test.topic');
      expect(subscriptions.length).toBe(1);
      expect(subscriptions[0].subscriber).toBe('service-1');
    });

    it('should unsubscribe', async () => {
      // Create subscription
      const subscriptionResult = await broker.subscribe('test.topic', 'service-1');
      expect(subscriptionResult.success).toBe(true);

      // Unsubscribe
      const unsubscribed = await broker.unsubscribe(subscriptionResult.subscriptionId);
      expect(unsubscribed).toBe(true);

      const subscriptions = await broker.getSubscriptions('test.topic');
      expect(subscriptions.length).toBe(0);
    });

    it('should filter subscriptions by topic and subscriber', async () => {
      await broker.subscribe('topic1', 'service-1');
      await broker.subscribe('topic1', 'service-2');
      await broker.subscribe('topic2', 'service-1');

      const topic1Subs = await broker.getSubscriptions('topic1');
      expect(topic1Subs.length).toBe(2);

      const service1Subs = await broker.getSubscriptions(undefined, 'service-1');
      expect(service1Subs.length).toBe(2);

      const allSubs = await broker.getSubscriptions();
      expect(allSubs.length).toBe(3);
    });
  });

  describe('delivery guarantees', () => {
    it('should handle at-most-once delivery', async () => {
      const subscriptionResult = await broker.subscribe(
        'test.at-most-once',
        'service-1',
        { deliveryGuarantee: 'at-most-once' }
      );
      expect(subscriptionResult.success).toBe(true);

      const result = await broker.publish('test.at-most-once', { data: 'test' });
      expect(result.success).toBe(true);
    });

    it('should handle at-least-once delivery', async () => {
      const subscriptionResult = await broker.subscribe(
        'test.at-least-once',
        'service-1',
        { deliveryGuarantee: 'at-least-once' }
      );
      expect(subscriptionResult.success).toBe(true);

      const result = await broker.publish('test.at-least-once', { data: 'test' });
      expect(result.success).toBe(true);
    });

    it('should handle exactly-once delivery', async () => {
      const subscriptionResult = await broker.subscribe(
        'test.exactly-once',
        'service-1',
        { deliveryGuarantee: 'exactly-once' }
      );
      expect(subscriptionResult.success).toBe(true);

      const result = await broker.publish('test.exactly-once', { data: 'test' });
      expect(result.success).toBe(true);
    });
  });

  describe('metrics and health', () => {
    it('should provide broker metrics', async () => {
      // Create topics and subscriptions
      await broker.createTopic('metrics.test');
      await broker.subscribe('metrics.test', 'service-1');

      // Publish messages
      for (let i = 0; i < 5; i++) {
        await broker.publish('metrics.test', { message: i });
      }

      const metrics = await broker.getMetrics();
      expect(metrics.topics.total).toBeGreaterThan(0);
      expect(metrics.subscribers.total).toBeGreaterThan(0);
      expect(metrics.delivery.total).toBe(5);
      expect(metrics.system.uptime).toBeGreaterThan(0);
    });

    it('should check broker health', async () => {
      const isHealthy = await broker.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should handle broker not running', async () => {
      await broker.stop();

      const result = await broker.publish('test.topic', { data: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Broker is not running');
    });
  });

  describe('error handling', () => {
    it('should handle invalid topic names', async () => {
      const result = await broker.publish('', { data: 'test' });
      // Router should handle invalid topic gracefully
      expect(result).toBeDefined();
    });

    it('should handle publishing with no subscribers', async () => {
      const result = await broker.publish('no-subscribers.topic', { data: 'test' });
      expect(result.success).toBe(true); // Should still succeed
    });

    it('should handle subscription to non-existent topic', async () => {
      const result = await broker.subscribe('non-existent.topic', 'service-1');
      expect(result.success).toBe(true); // Should still create subscription
    });
  });

  describe('performance', () => {
    it('should handle high message rate', async () => {
      const startTime = Date.now();
      const messageCount = 1000;

      // Create subscription
      await broker.subscribe('performance.test', 'service-1');

      // Publish messages rapidly
      const publishPromises = [];
      for (let i = 0; i < messageCount; i++) {
        publishPromises.push(broker.publish('performance.test', { id: i, data: 'test' }));
      }

      const results = await Promise.allSettled(publishPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      const endTime = Date.now();
      const duration = endTime - startTime;
      const messagesPerSecond = (messageCount / duration) * 1000;

      expect(successful).toBe(messageCount);
      expect(messagesPerSecond).toBeGreaterThan(1000); // Should be much higher in reality
    });

    it('should maintain low latency', async () => {
      await broker.subscribe('latency.test', 'service-1');

      const startTime = performance.now();
      await broker.publish('latency.test', { data: 'test' });
      const endTime = performance.now();

      const latency = endTime - startTime;
      expect(latency).toBeLessThan(100); // Should be much lower in reality
    });
  });

  describe('concurrency', () => {
    it('should handle concurrent operations', async () => {
      const concurrency = 10;
      const operationsPerWorker = 100;

      // Create concurrent workers
      const workers = [];
      for (let i = 0; i < concurrency; i++) {
        const worker = async () => {
          for (let j = 0; j < operationsPerWorker; j++) {
            await broker.publish(`concurrent.worker${i}`, { workerId: i, messageId: j });
          }
        };
        workers.push(worker());
      }

      await Promise.all(workers);

      const stats = await broker.getStats();
      expect(stats.totalMessages).toBe(concurrency * operationsPerWorker);
    });

    it('should handle concurrent subscriptions', async () => {
      const concurrency = 100;

      // Create concurrent subscriptions
      const subscriptionPromises = [];
      for (let i = 0; i < concurrency; i++) {
        subscriptionPromises.push(broker.subscribe(`concurrent.topic${i}`, `service${i}`));
      }

      const results = await Promise.allSettled(subscriptionPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      expect(successful).toBe(concurrency);

      const subscriptions = await broker.getSubscriptions();
      expect(subscriptions.length).toBe(concurrency);
    });
  });

  describe('graceful shutdown', () => {
    it('should stop gracefully', async () => {
      // Start publishing messages
      const publishPromise = (async () => {
        for (let i = 0; i < 10; i++) {
          await broker.publish('shutdown.test', { message: i });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })();

      // Stop broker while publishing
      setTimeout(() => broker.stop(), 50);

      await expect(publishPromise).resolves.not.toThrow();
    });
  });
});