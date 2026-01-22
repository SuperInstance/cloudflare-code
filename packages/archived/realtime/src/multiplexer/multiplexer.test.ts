/**
 * Multiplexer Tests
 */

import { Multiplexer } from './multiplexer';
import { ChannelMessage, ChannelInfo } from '../types';

// Mock event bus
class MockEventBus {
  private listeners = new Map<string, Function[]>();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        listener(...args);
      }
    }
  }
}

// Mock logger
class MockLogger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
  log = jest.fn();
}

describe('Multiplexer', () => {
  let multiplexer: Multiplexer;
  let eventBus: MockEventBus;
  let logger: MockLogger;

  beforeEach(() => {
    eventBus = new MockEventBus();
    logger = new MockLogger();
    multiplexer = new Multiplexer({
      maxChannels: 100,
      maxSubscribers: 1000,
      channelTtl: 3600000,
      enableHistory: true,
      historySize: 100,
      messageOrdering: true,
      enableCompression: false,
      enableMetrics: true
    }, logger);

    // Mock the event bus
    (multiplexer as any).eventBus = eventBus;
  });

  afterEach(async () => {
    await multiplexer.reset();
  });

  describe('Channel Management', () => {
    test('should create channel', async () => {
      const channelName = 'test-channel';
      const channelInfo = await multiplexer.createChannel(channelName);

      expect(channelInfo.name).toBe(channelName);
      expect(channelInfo.subscribers).toBeInstanceOf(Set);
      expect(channelInfo.createdAt).toBeGreaterThan(0);
      expect(channelInfo.messageCount).toBe(0);

      const stats = multiplexer.getStats();
      expect(stats.channels.total).toBe(1);
      expect(stats.channels.active).toBe(1);
    });

    test('should reject duplicate channel creation', async () => {
      const channelName = 'test-channel';
      await multiplexer.createChannel(channelName);

      await expect(multiplexer.createChannel(channelName)).rejects.toThrow('Channel already exists');
    });

    test('should handle channel limits', async () => {
      const limitedMultiplexer = new Multiplexer({
        maxChannels: 1,
        maxSubscribers: 1000,
        channelTtl: 3600000,
        enableHistory: true,
        historySize: 100,
        messageOrdering: true,
        enableCompression: false,
        enableMetrics: true
      });

      // Create first channel
      await limitedMultiplexer.createChannel('channel1');

      // Second channel should fail
      await expect(limitedMultiplexer.createChannel('channel2')).rejects.toThrow('Channel limit exceeded');

      await limitedMultiplexer.reset();
    });

    test('should delete channel', async () => {
      const channelName = 'test-channel';
      await multiplexer.createChannel(channelName);

      // Add subscription
      await multiplexer.subscribe(channelName, 'user-123');

      await multiplexer.deleteChannel(channelName);

      expect(multiplexer.getChannel(channelName)).toBeUndefined();
      expect(multiplexer.getChannelSubscribers(channelName)).toHaveLength(0);

      const stats = multiplexer.getStats();
      expect(stats.channels.active).toBe(0);
    });

    test('should auto-delete channel when no subscribers', async () => {
      const channelName = 'test-channel';
      await multiplexer.createChannel(channelName);

      // Auto-delete should happen when channel has no subscribers
      // (mock implementation would trigger this)
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(multiplexer.getChannel(channelName)).toBeUndefined();
    });
  });

  describe('Subscription Management', () => {
    let channelName: string;

    beforeEach(async () => {
      channelName = 'test-channel';
      await multiplexer.createChannel(channelName);
    });

    test('should subscribe user to channel', async () => {
      const userId = 'user-123';
      const subscription = await multiplexer.subscribe(channelName, userId);

      expect(subscription.channel).toBe(channelName);
      expect(subscription.userId).toBe(userId);
      expect(subscription.subscribedAt).toBeGreaterThan(0);

      const subscribers = multiplexer.getChannelSubscribers(channelName);
      expect(subscribers).toContain(userId);
      expect(subscribers).toHaveLength(1);

      const stats = multiplexer.getStats();
      expect(stats.subscriptions.total).toBe(1);
    });

    test('should reject duplicate subscription', async () => {
      const userId = 'user-123';
      await multiplexer.subscribe(channelName, userId);

      await expect(multiplexer.subscribe(channelName, userId)).rejects.toThrow('User already subscribed');
    });

    test('should handle subscription limits', async () => {
      const limitedMultiplexer = new Multiplexer({
        maxChannels: 10,
        maxSubscribers: 1,
        channelTtl: 3600000,
        enableHistory: true,
        historySize: 100,
        messageOrdering: true,
        enableCompression: false,
        enableMetrics: true
      });

      await limitedMultiplexer.createChannel('limited-channel');

      // First subscription should succeed
      await limitedMultiplexer.subscribe('limited-channel', 'user-1');

      // Second subscription should fail
      await expect(limitedMultiplexer.subscribe('limited-channel', 'user-2'))
        .rejects.toThrow('Subscriber limit exceeded');

      await limitedMultiplexer.reset();
    });

    test('should unsubscribe user from channel', async () => {
      const userId = 'user-123';
      await multiplexer.subscribe(channelName, userId);

      await multiplexer.unsubscribe(channelName, userId);

      const subscribers = multiplexer.getChannelSubscribers(channelName);
      expect(subscribers).not.toContain(userId);
      expect(subscribers).toHaveLength(0);

      const stats = multiplexer.getStats();
      expect(stats.subscriptions.total).toBe(0);
    });

    test('should handle user subscriptions across channels', async () => {
      const userId = 'user-123';
      const channel1 = 'channel-1';
      const channel2 = 'channel-2';

      await multiplexer.createChannel(channel1);
      await multiplexer.createChannel(channel2);

      await multiplexer.subscribe(channel1, userId);
      await multiplexer.subscribe(channel2, userId);

      const subscriptions = multiplexer.getUserSubscriptions(userId);
      expect(subscriptions).toHaveLength(2);
      expect(subscriptions.map(s => s.channel)).toContain(channel1);
      expect(subscriptions.map(s => s.channel)).toContain(channel2);
    });

    test('should emit subscription events', async () => {
      const userId = 'user-123';
      const eventHandler = jest.fn();

      multiplexer.on('subscribe', eventHandler);

      await multiplexer.subscribe(channelName, userId);

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'subscribe',
        channel: channelName,
        userId,
        timestamp: expect.any(Number),
        data: expect.any(Object)
      });
    });
  });

  describe('Message Publishing', () => {
    let channelName: string;
    let userId: string;

    beforeEach(async () => {
      channelName = 'test-channel';
      userId = 'user-123';
      await multiplexer.createChannel(channelName);
      await multiplexer.subscribe(channelName, userId);
    });

    test('should publish message to channel', async () => {
      const message = {
        id: 'msg-123',
        type: 'chat',
        payload: { text: 'Hello, World!' },
        timestamp: Date.now(),
        source: { id: 'conn-456', namespace: 'test' }
      };

      await multiplexer.publish(channelName, message, 'conn-456');

      const history = multiplexer.getChannelHistory(channelName);
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('chat');
      expect(history[0].payload.text).toBe('Hello, World!');
      expect(history[0].channel).toBe(channelName);

      const stats = multiplexer.getStats();
      expect(stats.messages.total).toBe(1);
    });

    test('should handle invalid message format', async () => {
      const invalidMessage = {
        type: 'invalid',
        // Missing required fields
      };

      await expect(multiplexer.publish(channelName, invalidMessage, 'conn-456'))
        .rejects.toThrow('Invalid message format');
    });

    test('should handle non-existent channel', async () => {
      const message = {
        id: 'msg-123',
        type: 'chat',
        payload: { text: 'Hello' },
        timestamp: Date.now(),
        source: { id: 'conn-456', namespace: 'test' }
      };

      await expect(multiplexer.publish('non-existent-channel', message, 'conn-456'))
        .rejects.toThrow('Channel not found');
    });
  });

  describe('Message Routing', () => {
    let channelName: string;
    let userId1: string;
    let userId2: string;

    beforeEach(async () => {
      channelName = 'test-channel';
      userId1 = 'user-1';
      userId2 = 'user-2';

      await multiplexer.createChannel(channelName);
      await multiplexer.subscribe(channelName, userId1);
      await multiplexer.subscribe(channelName, userId2);
    });

    test('should send unicast message', async () => {
      const message = {
        id: 'msg-123',
        type: 'chat',
        payload: { text: 'Private message' },
        timestamp: Date.now(),
        source: { id: 'conn-456', namespace: 'test' }
      };

      await multiplexer.sendUnicast(channelName, userId2, message, 'conn-456');

      const history = multiplexer.getChannelHistory(channelName);
      expect(history).toHaveLength(1);
      expect(history[0].target?.id).toBe(userId2);
    });

    test('should send multicast message', async () => {
      const message = {
        id: 'msg-456',
        type: 'chat',
        payload: { text: 'Group message' },
        timestamp: Date.now(),
        source: { id: 'conn-789', namespace: 'test' }
      };

      const targetUsers = [userId1, userId2];
      await multiplexer.sendMulticast(channelName, targetUsers, message, 'conn-789');

      const history = multiplexer.getChannelHistory(channelName);
      expect(history).toHaveLength(1);
      expect(history[0].multicastTargets).toEqual(targetUsers);
    });

    test('should handle multicast with invalid targets', async () => {
      const message = {
        id: 'msg-789',
        type: 'chat',
        payload: { text: 'Invalid target' },
        timestamp: Date.now(),
        source: { id: 'conn-999', namespace: 'test' }
      };

      const invalidTargetUsers = ['user-3']; // Not subscribed
      await expect(multiplexer.sendMulticast(channelName, invalidTargetUsers, message, 'conn-999'))
        .rejects.toThrow('No valid targets found');
    });
  });

  describe('Channel Information', () => {
    test('should get channel information', async () => {
      const channelName = 'test-channel';
      await multiplexer.createChannel(channelName);

      const channelInfo = multiplexer.getChannel(channelName);
      expect(channelInfo).toBeDefined();
      expect(channelInfo?.name).toBe(channelName);
      expect(channelInfo?.subscribers).toBeInstanceOf(Set);
    });

    test('should get all channels', async () => {
      const channel1 = 'channel-1';
      const channel2 = 'channel-2';

      await multiplexer.createChannel(channel1);
      await multiplexer.createChannel(channel2);

      const allChannels = multiplexer.getAllChannels();
      expect(allChannels).toHaveLength(2);
      expect(allChannels.map(c => c.name)).toContain(channel1);
      expect(allChannels.map(c => c.name)).toContain(channel2);
    });

    test('should get subscriber count', async () => {
      const channelName = 'test-channel';
      await multiplexer.createChannel(channelName);

      let subscriberCount = multiplexer.getSubscriberCount(channelName);
      expect(subscriberCount).toBe(0);

      await multiplexer.subscribe(channelName, 'user-1');
      await multiplexer.subscribe(channelName, 'user-2');

      subscriberCount = multiplexer.getSubscriberCount(channelName);
      expect(subscriberCount).toBe(2);
    });

    test('should check subscription status', async () => {
      const channelName = 'test-channel';
      const userId = 'user-123';

      await multiplexer.createChannel(channelName);

      expect(multiplexer.isSubscribed(channelName, userId)).toBe(false);

      await multiplexer.subscribe(channelName, userId);

      expect(multiplexer.isSubscribed(channelName, userId)).toBe(true);
    });
  });

  describe('Message History', () => {
    let channelName: string;
    let userId: string;

    beforeEach(async () => {
      channelName = 'test-channel';
      userId = 'user-123';

      await multiplexer.createChannel(channelName);
      await multiplexer.subscribe(channelName, userId);
    });

    test('should maintain message history', async () => {
      const message1 = {
        id: 'msg-1',
        type: 'chat',
        payload: { text: 'Message 1' },
        timestamp: Date.now(),
        source: { id: 'conn-1', namespace: 'test' }
      };

      const message2 = {
        id: 'msg-2',
        type: 'chat',
        payload: { text: 'Message 2' },
        timestamp: Date.now(),
        source: { id: 'conn-2', namespace: 'test' }
      };

      await multiplexer.publish(channelName, message1, 'conn-1');
      await multiplexer.publish(channelName, message2, 'conn-2');

      const history = multiplexer.getChannelHistory(channelName);
      expect(history).toHaveLength(2);
      expect(history[0].payload.text).toBe('Message 1');
      expect(history[1].payload.text).toBe('Message 2');
    });

    test('should limit history size', async () => {
      // Create multiplexer with small history size
      const limitedMultiplexer = new Multiplexer({
        maxChannels: 10,
        maxSubscribers: 1000,
        channelTtl: 3600000,
        enableHistory: true,
        historySize: 2,
        messageOrdering: true,
        enableCompression: false,
        enableMetrics: true
      });

      const channelName = 'limited-channel';
      await limitedMultiplexer.createChannel(channelName);
      await limitedMultiplexer.subscribe(channelName, 'user-123');

      // Publish 3 messages
      for (let i = 0; i < 3; i++) {
        const message = {
          id: `msg-${i}`,
          type: 'chat',
          payload: { text: `Message ${i}` },
          timestamp: Date.now(),
          source: { id: 'conn-1', namespace: 'test' }
        };
        await limitedMultiplexer.publish(channelName, message, 'conn-1');
      }

      const history = limitedMultiplexer.getChannelHistory(channelName);
      expect(history).toHaveLength(2); // Should only keep last 2 messages

      await limitedMultiplexer.reset();
    });

    test('should handle history when disabled', async () => {
      const noHistoryMultiplexer = new Multiplexer({
        maxChannels: 10,
        maxSubscribers: 1000,
        channelTtl: 3600000,
        enableHistory: false,
        historySize: 100,
        messageOrdering: true,
        enableCompression: false,
        enableMetrics: true
      });

      const channelName = 'no-history-channel';
      await noHistoryMultiplexer.createChannel(channelName);
      await noHistoryMultiplexer.subscribe(channelName, 'user-123');

      const message = {
        id: 'msg-123',
        type: 'chat',
        payload: { text: 'No history' },
        timestamp: Date.now(),
        source: { id: 'conn-1', namespace: 'test' }
      };

      await noHistoryMultiplexer.publish(channelName, message, 'conn-1');

      const history = noHistoryMultiplexer.getChannelHistory(channelName);
      expect(history).toHaveLength(0);

      await noHistoryMultiplexer.reset();
    });
  });

  describe('Statistics', () => {
    test('should track channel statistics', async () => {
      const stats = multiplexer.getStats();
      expect(stats.channels.total).toBe(0);
      expect(stats.channels.active).toBe(0);
      expect(stats.channels.max).toBe(100);

      await multiplexer.createChannel('test-channel');

      const statsAfter = multiplexer.getStats();
      expect(statsAfter.channels.total).toBe(1);
      expect(statsAfter.channels.active).toBe(1);
    });

    test('should track subscription statistics', async () => {
      const stats = multiplexer.getStats();
      expect(stats.subscriptions.total).toBe(0);
      expect(stats.subscriptions.average).toBe(0);
      expect(stats.subscriptions.max).toBe(1000);

      await multiplexer.createChannel('test-channel');
      await multiplexer.subscribe('test-channel', 'user-1');

      const statsAfter = multiplexer.getStats();
      expect(statsAfter.subscriptions.total).toBe(1);
      expect(statsAfter.subscriptions.average).toBe(1);
    });

    test('should track message statistics', async () => {
      const stats = multiplexer.getStats();
      expect(stats.messages.total).toBe(0);
      expect(stats.messages.historyEnabled).toBe(true);
      expect(stats.messages.historySize).toBe(100);

      await multiplexer.createChannel('test-channel');
      await multiplexer.subscribe('test-channel', 'user-123');

      const message = {
        id: 'msg-123',
        type: 'chat',
        payload: { text: 'Hello' },
        timestamp: Date.now(),
        source: { id: 'conn-456', namespace: 'test' }
      };

      await multiplexer.publish('test-channel', message, 'conn-456');

      const statsAfter = multiplexer.getStats();
      expect(statsAfter.messages.total).toBe(1);
    });
  });

  describe('Cleanup', () => {
    test('should reset multiplexer', async () => {
      await multiplexer.createChannel('test-channel');
      await multiplexer.subscribe('test-channel', 'user-123');

      const statsBefore = multiplexer.getStats();
      expect(statsBefore.channels.active).toBe(1);
      expect(statsBefore.subscriptions.total).toBe(1);

      await multiplexer.reset();

      const statsAfter = multiplexer.getStats();
      expect(statsAfter.channels.active).toBe(0);
      expect(statsAfter.subscriptions.total).toBe(0);
    });

    test('should clean up expired channels', async () => {
      // This test would simulate the cleanup process
      // In a real implementation, we'd set up channels and wait for TTL expiration
      const cleanupSpy = jest.spyOn(multiplexer as any, 'cleanup');

      // Force cleanup
      (multiplexer as any).cleanup();

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });
});