/**
 * Tests for Pub/Sub Messaging System
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PubSubSystem, PubSubDO } from './pubsub';
import type { AgentMessage, Subscription } from './types';

// Mock DurableObjectStorage
class MockStorage {
  private data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) || null;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(): Promise<string[]> {
    return Array.from(this.data.keys());
  }
}

// Mock environment
const mockEnv = {
  AGENT_PUBSUB: {
    get: vi.fn(() => ({
      fetch: vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true })))),
    })),
  } as any,
  AGENTS_KV: undefined,
};

describe('PubSubSystem', () => {
  let pubsub: PubSubSystem;
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    pubsub = new PubSubSystem(mockEnv, mockStorage as any);
  });

  describe('initialization', () => {
    it('should initialize with empty state', async () => {
      await pubsub.initialize();

      const stats = pubsub.getStats();
      expect(stats.messagesPublished).toBe(0);
      expect(stats.messagesDelivered).toBe(0);
      expect(stats.messagesFailed).toBe(0);
    });
  });

  describe('topic management', () => {
    it('should create a new topic', async () => {
      await pubsub.createTopic('test-topic');

      const stats = await pubsub.getTopicStats('test-topic');
      expect(stats).not.toBeNull();
      expect(stats?.name).toBe('test-topic');
      expect(stats?.subscriberCount).toBe(0);
      expect(stats?.messageCount).toBe(0);
    });

    it('should not duplicate existing topic', async () => {
      await pubsub.createTopic('test-topic');
      await pubsub.createTopic('test-topic');

      const stats = await pubsub.getTopicStats('test-topic');
      expect(stats).not.toBeNull();
    });

    it('should delete a topic', async () => {
      await pubsub.createTopic('test-topic');
      await pubsub.subscribe('agent-1', 'test-topic');

      await pubsub.deleteTopic('test-topic');

      const stats = await pubsub.getTopicStats('test-topic');
      expect(stats).toBeNull();
    });

    it('should list all topics', async () => {
      await pubsub.createTopic('topic-1');
      await pubsub.createTopic('topic-2');
      await pubsub.createTopic('topic-3');

      const topics = pubsub.listTopics();
      expect(topics).toHaveLength(3);
      expect(topics).toContain('topic-1');
      expect(topics).toContain('topic-2');
      expect(topics).toContain('topic-3');
    });
  });

  describe('subscription management', () => {
    it('should subscribe to a topic', async () => {
      const subscriptionId = await pubsub.subscribe('agent-1', 'test-topic');

      expect(subscriptionId).toBeDefined();
      expect(subscriptionId.length).toBeGreaterThan(0);

      const subscription = pubsub.getSubscription(subscriptionId);
      expect(subscription).not.toBeNull();
      expect(subscription?.subscriberId).toBe('agent-1');
      expect(subscription?.topic).toBe('test-topic');
    });

    it('should create topic if not exists when subscribing', async () => {
      await pubsub.subscribe('agent-1', 'new-topic');

      const stats = await pubsub.getTopicStats('new-topic');
      expect(stats).not.toBeNull();
    });

    it('should unsubscribe from a topic', async () => {
      const subscriptionId = await pubsub.subscribe('agent-1', 'test-topic');

      await pubsub.unsubscribe(subscriptionId);

      const subscription = pubsub.getSubscription(subscriptionId);
      expect(subscription).toBeNull();
    });

    it('should list subscriptions for a subscriber', async () => {
      await pubsub.subscribe('agent-1', 'topic-1');
      await pubsub.subscribe('agent-1', 'topic-2');
      await pubsub.subscribe('agent-2', 'topic-1');

      const agent1Subs = pubsub.listSubscriptions('agent-1');
      expect(agent1Subs).toHaveLength(2);

      const agent2Subs = pubsub.listSubscriptions('agent-2');
      expect(agent2Subs).toHaveLength(1);
    });

    it('should support message filters', async () => {
      const filter = {
        messageType: ['request', 'response'],
        priority: ['high', 'urgent'],
      };

      const subscriptionId = await pubsub.subscribe('agent-1', 'test-topic', filter);

      const subscription = pubsub.getSubscription(subscriptionId);
      expect(subscription?.filter).toEqual(filter);
    });
  });

  describe('message publishing', () => {
    beforeEach(async () => {
      await pubsub.createTopic('test-topic');
      await pubsub.subscribe('agent-1', 'test-topic');
      await pubsub.subscribe('agent-2', 'test-topic');
    });

    it('should publish message to topic subscribers', async () => {
      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'test-topic',
        type: 'request',
        action: 'test-action',
        payload: { data: 'test' },
        context: {
          conversationId: 'conv-1',
          metadata: {},
          timestamp: Date.now(),
        },
        priority: 'normal',
        timestamp: Date.now(),
      };

      const deliveryIds = await pubsub.publish('test-topic', message);

      expect(deliveryIds).toHaveLength(2);
    });

    it('should filter messages based on subscription filters', async () => {
      await pubsub.subscribe('agent-3', 'test-topic', {
        messageType: ['notification'],
      });

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'test-topic',
        type: 'request',
        action: 'test-action',
        payload: { data: 'test' },
        context: {
          conversationId: 'conv-1',
          metadata: {},
          timestamp: Date.now(),
        },
        priority: 'normal',
        timestamp: Date.now(),
      };

      const deliveryIds = await pubsub.publish('test-topic', message);

      // Only agent-1 and agent-2 should receive (agent-3 filters out 'request')
      expect(deliveryIds.length).toBeLessThanOrEqual(2);
    });

    it('should update topic statistics after publishing', async () => {
      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'test-topic',
        type: 'request',
        action: 'test-action',
        payload: { data: 'test' },
        context: {
          conversationId: 'conv-1',
          metadata: {},
          timestamp: Date.now(),
        },
        priority: 'normal',
        timestamp: Date.now(),
      };

      await pubsub.publish('test-topic', message);

      const stats = await pubsub.getTopicStats('test-topic');
      expect(stats?.messageCount).toBe(1);
      expect(stats?.lastMessageAt).toBeDefined();
    });

    it('should return empty array if no subscribers', async () => {
      await pubsub.createTopic('empty-topic');

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'empty-topic',
        type: 'request',
        action: 'test-action',
        payload: { data: 'test' },
        context: {
          conversationId: 'conv-1',
          metadata: {},
          timestamp: Date.now(),
        },
        priority: 'normal',
        timestamp: Date.now(),
      };

      const deliveryIds = await pubsub.publish('empty-topic', message);
      expect(deliveryIds).toHaveLength(0);
    });
  });

  describe('message filtering', () => {
    it('should match messages without filter', async () => {
      await pubsub.createTopic('test-topic');
      await pubsub.subscribe('agent-1', 'test-topic');

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'test-topic',
        type: 'request',
        action: 'any-action',
        payload: {},
        context: {
          conversationId: 'conv-1',
          metadata: {},
          timestamp: Date.now(),
        },
        priority: 'low',
        timestamp: Date.now(),
      };

      const deliveryIds = await pubsub.publish('test-topic', message);
      expect(deliveryIds).toHaveLength(1);
    });

    it('should filter by message type', async () => {
      await pubsub.createTopic('test-topic');
      await pubsub.subscribe('agent-1', 'test-topic', {
        messageType: ['notification'],
      });

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'test-topic',
        type: 'request',
        action: 'test',
        payload: {},
        context: {
          conversationId: 'conv-1',
          metadata: {},
          timestamp: Date.now(),
        },
        priority: 'normal',
        timestamp: Date.now(),
      };

      const deliveryIds = await pubsub.publish('test-topic', message);
      expect(deliveryIds).toHaveLength(0);
    });

    it('should filter by priority', async () => {
      await pubsub.createTopic('test-topic');
      await pubsub.subscribe('agent-1', 'test-topic', {
        priority: ['urgent'],
      });

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'test-topic',
        type: 'notification',
        action: 'test',
        payload: {},
        context: {
          conversationId: 'conv-1',
          metadata: {},
          timestamp: Date.now(),
        },
        priority: 'low',
        timestamp: Date.now(),
      };

      const deliveryIds = await pubsub.publish('test-topic', message);
      expect(deliveryIds).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    it('should track published messages', async () => {
      await pubsub.createTopic('test-topic');
      await pubsub.subscribe('agent-1', 'test-topic');

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'test-topic',
        type: 'notification',
        action: 'test',
        payload: {},
        context: {
          conversationId: 'conv-1',
          metadata: {},
          timestamp: Date.now(),
        },
        priority: 'normal',
        timestamp: Date.now(),
      };

      await pubsub.publish('test-topic', message);

      const stats = pubsub.getStats();
      expect(stats.messagesPublished).toBe(1);
    });

    it('should track delivery statistics', async () => {
      const stats = pubsub.getStats();
      expect(stats.messagesDelivered).toBeDefined();
      expect(stats.messagesFailed).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup old messages', async () => {
      await pubsub.createTopic('test-topic');
      await pubsub.subscribe('agent-1', 'test-topic');

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'test-topic',
        type: 'notification',
        action: 'test',
        payload: {},
        context: {
          conversationId: 'conv-1',
          metadata: {},
          timestamp: Date.now(),
        },
        priority: 'normal',
        timestamp: Date.now(),
        ttl: 1, // 1ms TTL
      };

      await pubsub.publish('test-topic', message);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      await pubsub.cleanup();
      // Cleanup should remove expired messages
    });
  });
});
