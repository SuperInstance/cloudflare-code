/**
 * Unit tests for GraphQL Subscriptions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SubscriptionManager,
  createSubscriptionEvent,
  validateSubscriptionConfig,
} from '../../src/graphql/subscriptions';
import { SubscriptionConfig, SubscriptionFilter } from '../../src/types';

// Mock WebSocket
class MockWebSocket {
  onmessage?: (data: any) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  send(data: string) {
    if (this.onmessage) {
      this.onmessage(Buffer.from(data));
    }
  }

  close() {
    if (this.onclose) {
      this.onclose();
    }
  }
}

describe('SubscriptionManager', () => {
  let manager: SubscriptionManager;
  let config: SubscriptionConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      maxConnections: 100,
      connectionTimeout: 60000,
      heartbeatInterval: 30000,
      messageQueueSize: 1000,
    };
    manager = new SubscriptionManager(config);
  });

  describe('initialization', () => {
    it('should create manager instance', () => {
      expect(manager).toBeInstanceOf(SubscriptionManager);
    });

    it('should initialize successfully', async () => {
      await expect(manager.initialize()).resolves.not.toThrow();
    });
  });

  describe('connection handling', () => {
    it('should handle new connection', async () => {
      await manager.initialize();

      const socket = new MockWebSocket() as any;
      const request = new Request('http://localhost');

      await expect(
        manager.handleConnection(socket, request)
      ).resolves.not.toThrow();
    });

    it('should enforce connection limit', async () => {
      await manager.initialize();

      const limitedConfig: SubscriptionConfig = {
        ...config,
        maxConnections: 1,
      };
      const limitedManager = new SubscriptionManager(limitedConfig);
      await limitedManager.initialize();

      const socket1 = new MockWebSocket() as any;
      const socket2 = new MockWebSocket() as any;
      const request = new Request('http://localhost');

      await limitedManager.handleConnection(socket1, request);

      // Second connection should close due to limit
      socket2.close = vi.fn();
      await limitedManager.handleConnection(socket2, request);

      expect(socket2.close).toHaveBeenCalledWith(1013, 'Server overloaded');
    });
  });

  describe('subscription management', () => {
    it('should start subscription', async () => {
      await manager.initialize();

      const socket = new MockWebSocket() as any;
      const request = new Request('http://localhost');

      await manager.handleConnection(socket, request);

      const stats = manager.getStats();
      expect(stats.connections).toBe(1);
    });

    it('should publish event', async () => {
      await manager.initialize();

      const event = createSubscriptionEvent('test', { data: 'test' });

      await expect(manager.publish(event)).resolves.not.toThrow();
    });
  });

  describe('statistics', () => {
    it('should return stats', () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty('connections');
      expect(stats).toHaveProperty('subscriptions');
      expect(stats).toHaveProperty('topics');
      expect(stats).toHaveProperty('queuedEvents');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await manager.initialize();

      await expect(manager.shutdown()).resolves.not.toThrow();
    });
  });
});

describe('createSubscriptionEvent', () => {
  it('should create event without metadata', () => {
    const event = createSubscriptionEvent('test-topic', { data: 'test' });

    expect(event.topic).toBe('test-topic');
    expect(event.payload).toEqual({ data: 'test' });
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('timestamp');
  });

  it('should create event with metadata', () => {
    const metadata = { source: 'test-service' };
    const event = createSubscriptionEvent('test-topic', { data: 'test' }, metadata);

    expect(event.metadata).toEqual(metadata);
  });
});

describe('validateSubscriptionConfig', () => {
  it('should validate valid config', () => {
    const config: SubscriptionConfig = {
      enabled: true,
      maxConnections: 100,
      connectionTimeout: 60000,
      heartbeatInterval: 30000,
      messageQueueSize: 1000,
    };

    expect(() => validateSubscriptionConfig(config)).not.toThrow();
  });

  it('should reject invalid maxConnections', () => {
    const config = {
      enabled: true,
      maxConnections: 0,
      connectionTimeout: 60000,
      heartbeatInterval: 30000,
      messageQueueSize: 1000,
    } as any;

    expect(() => validateSubscriptionConfig(config)).toThrow();
  });

  it('should reject invalid connectionTimeout', () => {
    const config = {
      enabled: true,
      maxConnections: 100,
      connectionTimeout: 500,
      heartbeatInterval: 30000,
      messageQueueSize: 1000,
    } as any;

    expect(() => validateSubscriptionConfig(config)).toThrow();
  });

  it('should reject invalid heartbeatInterval', () => {
    const config = {
      enabled: true,
      maxConnections: 100,
      connectionTimeout: 60000,
      heartbeatInterval: 500,
      messageQueueSize: 1000,
    } as any;

    expect(() => validateSubscriptionConfig(config)).toThrow();
  });
});
