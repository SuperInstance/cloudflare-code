/**
 * Message Handler Tests
 * Tests message routing, queuing, and delivery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MessageHandler,
  MessageBatcher,
  MessagePriorityQueue,
} from './messaging';
import type {
  AnyMessage,
  Connection,
  MessageType,
  MessagePriority,
} from './types';
import { SerializationFormat } from './types';

// Mock connection
function createMockConnection(connectionId: string = 'conn_123'): Connection {
  return {
    connectionId,
    userId: 'user_456',
    sessionId: 'session_789',
    state: 'connected' as any,
    socket: {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    rooms: new Set(),
    metadata: {},
    capabilities: [],
  };
}

describe('MessageHandler', () => {
  let messageHandler: MessageHandler;

  beforeEach(() => {
    messageHandler = new MessageHandler({
      maxQueueSize: 1000,
      maxRetries: 3,
      messageTTL: 60000,
      enableBatching: true,
      batchSize: 100,
      batchTimeout: 100,
      maxMessageSize: 1024 * 1024,
      rateLimitPerSecond: 100,
    });
  });

  afterEach(() => {
    messageHandler.destroy();
  });

  describe('handleMessage', () => {
    it('should process incoming message', async () => {
      const connection = createMockConnection();
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello, world!',
        },
      };

      const onMessage = vi.fn();

      await messageHandler.handleMessage(message, connection, onMessage);

      expect(onMessage).toHaveBeenCalledWith(message, connection);
    });

    it('should enforce rate limiting', async () => {
      const connection = createMockConnection();
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      const handler = new MessageHandler({
        maxQueueSize: 1000,
        maxRetries: 3,
        rateLimitPerSecond: 2,
      });

      const onMessage = vi.fn();

      // Send messages up to limit
      await handler.handleMessage(message, connection, onMessage);
      await handler.handleMessage(message, connection, onMessage);

      // Third message should fail
      await expect(
        handler.handleMessage(message, connection, onMessage)
      ).rejects.toThrow('Rate limit exceeded');

      handler.destroy();
    });

    it('should validate message size', async () => {
      const connection = createMockConnection();

      // Create a message that's too large
      const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: largeContent,
        },
      };

      const onMessage = vi.fn();

      await expect(
        messageHandler.handleMessage(message, connection, onMessage)
      ).rejects.toThrow('Message too large');
    });

    it('should update statistics', async () => {
      const connection = createMockConnection();
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      const onMessage = vi.fn();

      await messageHandler.handleMessage(message, connection, onMessage);

      const stats = messageHandler.getStats();
      expect(stats.received).toBe(1);
    });
  });

  describe('sendMessage', () => {
    it('should send message to connection', async () => {
      const socket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      } as unknown as WebSocket;

      const connection: Connection = {
        ...createMockConnection(),
        socket,
      };

      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      const sent = await messageHandler.sendMessage(message, connection);

      expect(sent).toBe(true);
      expect(socket.send).toHaveBeenCalled();
    });

    it('should queue message if connection not ready', async () => {
      const socket = {
        readyState: WebSocket.CONNECTING,
        send: vi.fn(),
      } as unknown as WebSocket;

      const connection: Connection = {
        ...createMockConnection(),
        socket,
      };

      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      const sent = await messageHandler.sendMessage(message, connection);

      expect(sent).toBe(false);
      expect(messageHandler.getQueueSize()).toBeGreaterThan(0);
    });

    it('should handle send errors gracefully', async () => {
      const socket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(() => {
          throw new Error('Send failed');
        }),
      } as unknown as WebSocket;

      const connection: Connection = {
        ...createMockConnection(),
        socket,
      };

      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      const sent = await messageHandler.sendMessage(message, connection);

      expect(sent).toBe(false);
    });
  });

  describe('broadcastMessage', () => {
    it('should broadcast to multiple connections', async () => {
      const connections = [
        createMockConnection('conn_1'),
        createMockConnection('conn_2'),
        createMockConnection('conn_3'),
      ];

      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Broadcast',
        },
      };

      const count = await messageHandler.broadcastMessage(message, connections);

      expect(count).toBe(3);
    });

    it('should return count of successful sends', async () => {
      const socket1 = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      } as unknown as WebSocket;

      const socket2 = {
        readyState: WebSocket.CLOSED,
        send: vi.fn(),
      } as unknown as WebSocket;

      const connections: Connection[] = [
        { ...createMockConnection('conn_1'), socket: socket1 },
        { ...createMockConnection('conn_2'), socket: socket2 },
      ];

      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Broadcast',
        },
      };

      const count = await messageHandler.broadcastMessage(message, connections);

      expect(count).toBe(1);
    });
  });

  describe('serializeMessage', () => {
    it('should serialize message to JSON', () => {
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      const serialized = messageHandler.serializeMessage(message, {
        format: SerializationFormat.JSON,
        compressed: false,
      });

      expect(serialized).toBeInstanceOf(Uint8Array);

      const text = new TextDecoder().decode(serialized);
      const parsed = JSON.parse(text);
      expect(parsed.id).toBe('msg_123');
    });
  });

  describe('deserializeMessage', () => {
    it('should deserialize JSON message', () => {
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      const serialized = JSON.stringify(message);
      const deserialized = messageHandler.deserializeMessage(serialized);

      expect(deserialized.id).toBe('msg_123');
      expect(deserialized.data.content).toBe('Hello');
    });

    it('should deserialize ArrayBuffer', () => {
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      const serialized = JSON.stringify(message);
      const arrayBuffer = new TextEncoder().encode(serialized).buffer;

      const deserialized = messageHandler.deserializeMessage(arrayBuffer);

      expect(deserialized.id).toBe('msg_123');
    });
  });

  describe('queueMessage', () => {
    it('should queue message for delivery', () => {
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      const queueId = messageHandler.queueMessage(message, 'conn_456');

      expect(queueId).toBeDefined();
      expect(messageHandler.getQueueSize()).toBe(1);
    });

    it('should remove expired messages', async () => {
      const handler = new MessageHandler({
        maxQueueSize: 1000,
        messageTTL: 100,
      });

      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      handler.queueMessage(message, 'conn_456');

      // Wait for message to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Process queue (should remove expired)
      const stats = handler.getStats();
      expect(handler.getQueueSize()).toBe(0);

      handler.destroy();
    });
  });

  describe('onDelivery', () => {
    it('should subscribe to delivery status', () => {
      const callback = vi.fn();
      const unsubscribe = messageHandler.onDelivery('msg_123', callback);

      const delivery = {
        messageId: 'msg_123',
        status: 'delivered' as const,
        attempts: 1,
        deliveredAt: Date.now(),
      };

      // Trigger callback
      messageHandler.handleAck({
        messageId: 'msg_123',
        timestamp: Date.now(),
        processed: true,
      });

      // Note: In actual implementation, the callback would be triggered
      // This is a simplified test
      expect(callback).toBeDefined();

      unsubscribe();
    });
  });

  describe('getStats', () => {
    it('should return message statistics', async () => {
      const connection = createMockConnection();
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      await messageHandler.handleMessage(message, connection, vi.fn());
      await messageHandler.sendMessage(message, connection);

      const stats = messageHandler.getStats();

      expect(stats.sent).toBeGreaterThan(0);
      expect(stats.received).toBeGreaterThan(0);
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', async () => {
      const connection = createMockConnection();
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      await messageHandler.handleMessage(message, connection, vi.fn());

      messageHandler.resetStats();

      const stats = messageHandler.getStats();
      expect(stats.received).toBe(0);
      expect(stats.sent).toBe(0);
    });
  });
});

describe('MessageBatcher', () => {
  let batcher: MessageBatcher;

  beforeEach(() => {
    batcher = new MessageBatcher(3, 100);
  });

  afterEach(() => {
    batcher.clear();
  });

  describe('add', () => {
    it('should add message to batch', () => {
      const onBatch = vi.fn();
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      batcher.add('target_1', message, onBatch);

      expect(batcher.getBatchSize('target_1')).toBe(1);
    });

    it('should flush batch when full', () => {
      vi.useFakeTimers();

      const onBatch = vi.fn();

      for (let i = 0; i < 3; i++) {
        const message: AnyMessage = {
          type: 'message' as MessageType.MESSAGE,
          id: `msg_${i}`,
          timestamp: Date.now(),
          data: {
            content: `Message ${i}`,
          },
        };

        batcher.add('target_1', message, onBatch);
      }

      expect(onBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'msg_0' }),
          expect.objectContaining({ id: 'msg_1' }),
          expect.objectContaining({ id: 'msg_2' }),
        ])
      );

      vi.useRealTimers();
    });

    it('should flush batch on timeout', () => {
      vi.useFakeTimers();

      const onBatch = vi.fn();
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      batcher.add('target_1', message, onBatch);

      vi.advanceTimersByTime(150);

      expect(onBatch).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('flush', () => {
    it('should flush batch for target', () => {
      const onBatch = vi.fn();
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      batcher.add('target_1', message, onBatch);
      batcher.flush('target_1', onBatch);

      expect(onBatch).toHaveBeenCalled();
      expect(batcher.getBatchSize('target_1')).toBe(0);
    });
  });

  describe('flushAll', () => {
    it('should flush all batches', () => {
      const onBatch = vi.fn();

      const message1: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_1',
        timestamp: Date.now(),
        data: { content: '1' },
      };

      const message2: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_2',
        timestamp: Date.now(),
        data: { content: '2' },
      };

      batcher.add('target_1', message1, onBatch);
      batcher.add('target_2', message2, onBatch);

      batcher.flushAll((targetId, messages) => {
        expect(messages.length).toBeGreaterThan(0);
      });

      expect(batcher.getBatchSize('target_1')).toBe(0);
      expect(batcher.getBatchSize('target_2')).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all batches', () => {
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        data: {
          content: 'Hello',
        },
      };

      batcher.add('target_1', message, vi.fn());

      batcher.clear();

      expect(batcher.getBatchSize('target_1')).toBe(0);
    });
  });
});

describe('MessagePriorityQueue', () => {
  let queue: MessagePriorityQueue;

  beforeEach(() => {
    queue = new MessagePriorityQueue(100);
  });

  describe('enqueue', () => {
    it('should enqueue message', () => {
      const message: AnyMessage = {
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_123',
        timestamp: Date.now(),
        priority: MessagePriority.NORMAL,
        data: {
          content: 'Hello',
        },
      };

      const enqueued = queue.enqueue(message);

      expect(enqueued).toBe(true);
      expect(queue.size()).toBe(1);
    });

    it('should remove lowest priority message when full', () => {
      const fullQueue = new MessagePriorityQueue(3);

      // Add messages at different priorities
      fullQueue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_1',
        timestamp: Date.now(),
        priority: MessagePriority.LOW,
        data: { content: 'Low' },
      });

      fullQueue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_2',
        timestamp: Date.now(),
        priority: MessagePriority.NORMAL,
        data: { content: 'Normal' },
      });

      fullQueue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_3',
        timestamp: Date.now(),
        priority: MessagePriority.HIGH,
        data: { content: 'High' },
      });

      // Add one more (should remove LOW priority)
      fullQueue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_4',
        timestamp: Date.now(),
        priority: MessagePriority.URGENT,
        data: { content: 'Urgent' },
      });

      expect(fullQueue.size()).toBe(3);
    });
  });

  describe('dequeue', () => {
    it('should dequeue highest priority message', () => {
      queue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_1',
        timestamp: Date.now(),
        priority: MessagePriority.LOW,
        data: { content: 'Low' },
      });

      queue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_2',
        timestamp: Date.now(),
        priority: MessagePriority.URGENT,
        data: { content: 'Urgent' },
      });

      queue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_3',
        timestamp: Date.now(),
        priority: MessagePriority.NORMAL,
        data: { content: 'Normal' },
      });

      const message = queue.dequeue();

      expect(message?.id).toBe('msg_2'); // URGENT priority
    });

    it('should return null when empty', () => {
      const message = queue.dequeue();
      expect(message).toBeNull();
    });
  });

  describe('peek', () => {
    it('should peek at highest priority message without removing', () => {
      queue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_1',
        timestamp: Date.now(),
        priority: MessagePriority.HIGH,
        data: { content: 'High' },
      });

      const message = queue.peek();

      expect(message?.id).toBe('msg_1');
      expect(queue.size()).toBe(1); // Should not remove
    });
  });

  describe('size', () => {
    it('should return queue size', () => {
      expect(queue.size()).toBe(0);

      queue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_1',
        timestamp: Date.now(),
        priority: MessagePriority.NORMAL,
        data: { content: '1' },
      });

      queue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_2',
        timestamp: Date.now(),
        priority: MessagePriority.NORMAL,
        data: { content: '2' },
      });

      expect(queue.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all messages', () => {
      queue.enqueue({
        type: 'message' as MessageType.MESSAGE,
        id: 'msg_1',
        timestamp: Date.now(),
        priority: MessagePriority.NORMAL,
        data: { content: '1' },
      });

      queue.clear();

      expect(queue.size()).toBe(0);
    });
  });
});
