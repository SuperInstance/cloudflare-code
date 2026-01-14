/**
 * Message Broker Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBroker } from '../../src/communication/protocol';
import type { Message, JsonPayload } from '../../src/types';
import {
  MessageType,
  MessagePriority,
  DeliveryGuarantee,
  RoutingStrategy,
  DeliveryStatus
} from '../../src/types';

describe('MessageBroker', () => {
  let broker: MessageBroker;

  beforeEach(() => {
    broker = new MessageBroker({
      maxQueueSize: 100,
      maxMessageSize: 1024 * 1024,
      defaultTimeout: 5000,
      enableCompression: false,
      enableEncryption: false,
      enablePersistence: false,
      maxRetries: 3,
      retryDelay: 1000
    });
  });

  afterEach(async () => {
    await broker.shutdown();
  });

  describe('Message Sending', () => {
    it('should send a direct message successfully', async () => {
      const message: Message = {
        id: 'msg-1',
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: {
          type: 'json',
          data: { action: 'test', data: 'hello' }
        } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: {
          contentType: 'application/json'
        },
        metadata: {}
      };

      await broker.send(message);

      const status = broker['deliveryStatus'].get(message.id);
      expect(status).toBe(DeliveryStatus.DELIVERED);
    });

    it('should emit message:sent event', async () => {
      const handler = vi.fn();
      broker.on('message:sent', handler);

      const message: Message = {
        id: 'msg-1',
        type: MessageType.NOTIFICATION,
        from: 'agent-1',
        to: 'agent-2',
        payload: {
          type: 'json',
          data: { test: true }
        } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: {
          contentType: 'application/json'
        },
        metadata: {}
      };

      await broker.send(message);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should reject message with missing ID', async () => {
      const message = {
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: { type: 'json', data: {} } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      } as unknown as Message;

      await expect(broker.send(message)).rejects.toThrow();
    });

    it('should reject message exceeding max size', async () => {
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB

      const message: Message = {
        id: 'msg-1',
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: {
          type: 'json',
          data: { large: largeData }
        } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: {
          contentType: 'application/json'
        },
        metadata: {}
      };

      await expect(broker.send(message)).rejects.toThrow();
    });
  });

  describe('Message Receiving', () => {
    it('should receive message from queue', async () => {
      const message: Message = {
        id: 'msg-1',
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: {
          type: 'json',
          data: { action: 'test' }
        } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: {
          contentType: 'application/json'
        },
        metadata: {}
      };

      await broker.send(message);
      const received = await broker.receive('agent-2');

      expect(received).toBeDefined();
      expect(received!.id).toBe('msg-1');
      expect(received!.from).toBe('agent-1');
    });

    it('should return null when queue is empty', async () => {
      const received = await broker.receive('non-existent');
      expect(received).toBeNull();
    });

    it('should emit message:received event', async () => {
      const handler = vi.fn();
      broker.on('message:received', handler);

      const message: Message = {
        id: 'msg-1',
        type: MessageType.NOTIFICATION,
        from: 'agent-1',
        to: 'agent-2',
        payload: {
          type: 'json',
          data: { test: true }
        } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: {
          contentType: 'application/json'
        },
        metadata: {}
      };

      await broker.send(message);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should process messages in priority order', async () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          type: MessageType.NOTIFICATION,
          from: 'agent-1',
          to: 'agent-2',
          payload: { type: 'json', data: {} } as JsonPayload,
          priority: MessagePriority.LOW,
          timestamp: Date.now(),
          deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
          routingStrategy: RoutingStrategy.DIRECT,
          headers: { contentType: 'application/json' },
          metadata: {}
        },
        {
          id: 'msg-2',
          type: MessageType.NOTIFICATION,
          from: 'agent-1',
          to: 'agent-2',
          payload: { type: 'json', data: {} } as JsonPayload,
          priority: MessagePriority.URGENT,
          timestamp: Date.now(),
          deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
          routingStrategy: RoutingStrategy.DIRECT,
          headers: { contentType: 'application/json' },
          metadata: {}
        }
      ];

      await broker.send(messages[0]);
      await broker.send(messages[1]);

      const received1 = await broker.receive('agent-2');
      const received2 = await broker.receive('agent-2');

      expect(received1!.id).toBe('msg-2'); // Urgent first
      expect(received2!.id).toBe('msg-1');
    });
  });

  describe('Pub/Sub', () => {
    it('should subscribe to a topic', async () => {
      const subscription = await broker.subscribe('agent-1', 'test-topic');

      expect(subscription).toBeDefined();
      expect(subscription.topic).toBe('test-topic');
      expect(subscription.subscriberId).toBe('agent-1');
    });

    it('should emit subscription:created event', async () => {
      const handler = vi.fn();
      broker.on('subscription:created', handler);

      await broker.subscribe('agent-1', 'test-topic');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should publish message to topic subscribers', async () => {
      await broker.subscribe('agent-1', 'test-topic');
      await broker.subscribe('agent-2', 'test-topic');

      await broker.publish('test-topic', {
        type: 'json',
        data: { message: 'hello' }
      }, 'publisher');

      const received1 = await broker.receive('agent-1');
      const received2 = await broker.receive('agent-2');

      expect(received1).toBeDefined();
      expect(received2).toBeDefined();
    });

    it('should apply subscription filter', async () => {
      await broker.subscribe('agent-1', 'test-topic', {
        types: [MessageType.NOTIFICATION]
      });

      await broker.publish('test-topic', {
        type: 'json',
        data: { test: true }
      }, 'publisher');

      const received = await broker.receive('agent-1');
      expect(received).toBeDefined();
    });

    it('should unsubscribe from topic', async () => {
      await broker.subscribe('agent-1', 'test-topic');
      await broker.unsubscribe('agent-1', 'test-topic');

      await broker.publish('test-topic', {
        type: 'json',
        data: { test: true }
      }, 'publisher');

      const received = await broker.receive('agent-1');
      expect(received).toBeNull();
    });

    it('should emit subscription:removed event', async () => {
      const handler = vi.fn();
      broker.on('subscription:removed', handler);

      await broker.subscribe('agent-1', 'test-topic');
      await broker.unsubscribe('agent-1', 'test-topic');

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Statistics', () => {
    it('should track sent messages', async () => {
      const message: Message = {
        id: 'msg-1',
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: { type: 'json', data: {} } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      };

      await broker.send(message);

      const stats = broker.getStats();
      expect(stats.totalSent).toBe(1);
    });

    it('should track delivered messages', async () => {
      const message: Message = {
        id: 'msg-1',
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: { type: 'json', data: {} } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      };

      await broker.send(message);
      await broker.receive('agent-2');

      const stats = broker.getStats();
      expect(stats.totalDelivered).toBe(1);
    });

    it('should track messages by type', async () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          type: MessageType.REQUEST,
          from: 'agent-1',
          to: 'agent-2',
          payload: { type: 'json', data: {} } as JsonPayload,
          priority: MessagePriority.NORMAL,
          timestamp: Date.now(),
          deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
          routingStrategy: RoutingStrategy.DIRECT,
          headers: { contentType: 'application/json' },
          metadata: {}
        },
        {
          id: 'msg-2',
          type: MessageType.NOTIFICATION,
          from: 'agent-1',
          to: 'agent-2',
          payload: { type: 'json', data: {} } as JsonPayload,
          priority: MessagePriority.NORMAL,
          timestamp: Date.now(),
          deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
          routingStrategy: RoutingStrategy.DIRECT,
          headers: { contentType: 'application/json' },
          metadata: {}
        }
      ];

      await broker.send(messages[0]);
      await broker.send(messages[1]);

      const stats = broker.getStats();
      expect(stats.messagesByType[MessageType.REQUEST]).toBe(1);
      expect(stats.messagesByType[MessageType.NOTIFICATION]).toBe(1);
    });
  });

  describe('Queue Management', () => {
    it('should get queue status', async () => {
      const message: Message = {
        id: 'msg-1',
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: { type: 'json', data: {} } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      };

      await broker.send(message);

      const status = broker.getQueueStatus('agent-2');
      expect(status).toBeDefined();
      expect(status!.size).toBe(1);
    });

    it('should clear message queue', async () => {
      const messages: Message[] = Array(5).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: { type: 'json', data: {} } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      }));

      for (const msg of messages) {
        await broker.send(msg);
      }

      broker.clearQueue('agent-2');

      const status = broker.getQueueStatus('agent-2');
      expect(status).toBeUndefined();
    });

    it('should enforce queue size limit', async () => {
      const smallBroker = new MessageBroker({ maxQueueSize: 2 });

      const message: Message = {
        id: 'msg-1',
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: { type: 'json', data: {} } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      };

      await smallBroker.send(message);
      await smallBroker.send({ ...message, id: 'msg-2' });

      await expect(smallBroker.send({ ...message, id: 'msg-3' })).rejects.toThrow();

      await smallBroker.shutdown();
    });
  });

  describe('Topic Management', () => {
    it('should get all topics', async () => {
      await broker.subscribe('agent-1', 'topic-1');
      await broker.subscribe('agent-2', 'topic-2');

      const topics = broker.getTopics();

      expect(topics).toHaveLength(2);
      expect(topics.some(t => t.name === 'topic-1')).toBe(true);
      expect(topics.some(t => t.name === 'topic-2')).toBe(true);
    });

    it('should get subscriptions for agent', async () => {
      await broker.subscribe('agent-1', 'topic-1');
      await broker.subscribe('agent-1', 'topic-2');

      const subscriptions = broker.getSubscriptions('agent-1');

      expect(subscriptions).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle message delivery failure', async () => {
      const handler = vi.fn();
      broker.on('message:failed', handler);

      const message: Message = {
        id: 'msg-1',
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: { type: 'json', data: {} } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      };

      // Simulate failure by using invalid routing
      const badMessage = { ...message, routingStrategy: 'invalid' as RoutingStrategy };

      await expect(broker.send(badMessage)).rejects.toThrow();
    });

    it('should update error rate on failures', async () => {
      // Send valid message
      const message: Message = {
        id: 'msg-1',
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: { type: 'json', data: {} } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      };

      await broker.send(message);
      await broker.receive('agent-2');

      const stats = broker.getStats();
      expect(stats.errorRate).toBe(0);
      expect(stats.deliveryRate).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent message sending', async () => {
      const promises = Array(10).fill(null).map((_, i) => {
        const message: Message = {
          id: `msg-${i}`,
          type: MessageType.NOTIFICATION,
          from: 'agent-1',
          to: 'agent-2',
          payload: { type: 'json', data: {} } as JsonPayload,
          priority: MessagePriority.NORMAL,
          timestamp: Date.now(),
          deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
          routingStrategy: RoutingStrategy.DIRECT,
          headers: { contentType: 'application/json' },
          metadata: {}
        };

        return broker.send(message);
      });

      await Promise.all(promises);

      const stats = broker.getStats();
      expect(stats.totalSent).toBe(10);
    });

    it('should handle empty message payload', async () => {
      const message: Message = {
        id: 'msg-1',
        type: MessageType.NOTIFICATION,
        from: 'agent-1',
        to: 'agent-2',
        payload: { type: 'json', data: {} } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      };

      await expect(broker.send(message)).resolves.not.toThrow();
    });

    it('should handle message with metadata', async () => {
      const message: Message = {
        id: 'msg-1',
        type: MessageType.REQUEST,
        from: 'agent-1',
        to: 'agent-2',
        payload: { type: 'json', data: {} } as JsonPayload,
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_MOST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {
          traceId: 'trace-123',
          userId: 'user-456'
        }
      };

      await broker.send(message);
      const received = await broker.receive('agent-2');

      expect(received!.metadata.traceId).toBe('trace-123');
      expect(received!.metadata.userId).toBe('user-456');
    });
  });
});
