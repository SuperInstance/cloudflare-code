/**
 * Tests for notification channels
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelRegistry, ChannelFactory } from '../channels/channels';
import { EmailChannel } from '../channels/email';
import { SmsChannel } from '../channels/sms';
import { PushChannel } from '../channels/push';
import type { Notification, NotificationRecipient } from '../types';

describe('Channel Registry', () => {
  let registry: ChannelRegistry;
  let mockChannel: any;

  beforeEach(() => {
    registry = new ChannelRegistry();
    mockChannel = {
      getChannelType: () => 'email',
      send: vi.fn().mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
      }),
      healthCheck: vi.fn().mockResolvedValue(true),
      getStats: vi.fn().mockResolvedValue({
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        averageDeliveryTime: 0,
      }),
    };
  });

  describe('register', () => {
    it('should register a channel', () => {
      registry.register('email', mockChannel);
      expect(registry.has('email')).toBe(true);
    });
  });

  describe('get', () => {
    it('should get a registered channel', () => {
      registry.register('email', mockChannel);
      const channel = registry.get('email');
      expect(channel).toBe(mockChannel);
    });

    it('should return undefined for unregistered channel', () => {
      const channel = registry.get('email');
      expect(channel).toBeUndefined();
    });
  });

  describe('send', () => {
    it('should send notification through registered channel', async () => {
      registry.register('email', mockChannel);

      const notification: Notification = {
        id: 'test-1',
        userId: 'user1',
        channel: 'email',
        category: 'system',
        priority: 'normal',
        status: 'pending',
        content: 'Test content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const recipient: NotificationRecipient = {
        id: 'recipient-1',
        userId: 'user1',
        type: 'email',
        address: 'test@example.com',
        verified: true,
        primary: true,
        createdAt: new Date(),
      };

      const result = await registry.send('email', notification, recipient);

      expect(result.success).toBe(true);
      expect(mockChannel.send).toHaveBeenCalledWith(notification, recipient);
    });

    it('should return error for unregistered channel', async () => {
      const notification: Notification = {
        id: 'test-1',
        userId: 'user1',
        channel: 'email',
        category: 'system',
        priority: 'normal',
        status: 'pending',
        content: 'Test content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const recipient: NotificationRecipient = {
        id: 'recipient-1',
        userId: 'user1',
        type: 'email',
        address: 'test@example.com',
        verified: true,
        primary: true,
        createdAt: new Date(),
      };

      const result = await registry.send('email', notification, recipient);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });
  });

  describe('healthCheck', () => {
    it('should check health of all channels', async () => {
      registry.register('email', mockChannel);
      registry.register('sms', mockChannel);

      const health = await registry.healthCheck();

      expect(health.size).toBe(2);
      expect(health.get('email')).toBe(true);
      expect(health.get('sms')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should get stats from all channels', async () => {
      registry.register('email', mockChannel);

      const stats = await registry.getStats();

      expect(stats.size).toBe(1);
      expect(stats.get('email')).toBeDefined();
    });
  });
});

describe('Channel Factory', () => {
  describe('create', () => {
    it('should create email channel', () => {
      const config = {
        provider: {
          type: 'smtp' as const,
          config: {
            host: 'smtp.example.com',
            port: 587,
            auth: { user: 'test', pass: 'test' },
          },
        },
      };

      const channel = ChannelFactory.create('email', config);
      expect(channel).toBeInstanceOf(EmailChannel);
    });

    it('should create SMS channel', () => {
      const config = {
        provider: {
          type: 'twilio' as const,
          config: {
            accountSid: 'test',
            authToken: 'test',
            fromNumber: '+1234567890',
          },
        },
      };

      const channel = ChannelFactory.create('sms', config);
      expect(channel).toBeInstanceOf(SmsChannel);
    });

    it('should create push channel', () => {
      const config = {
        provider: {
          type: 'fcm' as const,
          config: {
            apiKey: 'test-api-key',
          },
        },
      };

      const channel = ChannelFactory.create('push', config);
      expect(channel).toBeInstanceOf(PushChannel);
    });

    it('should throw error for unknown channel type', () => {
      expect(() => {
        ChannelFactory.create('unknown' as any, {});
      }).toThrow('Unknown channel type');
    });
  });

  describe('createMany', () => {
    it('should create multiple channels', () => {
      const configs = new Map([
        [
          'email',
          {
            provider: {
              type: 'smtp' as const,
              config: {
                host: 'smtp.example.com',
                port: 587,
                auth: { user: 'test', pass: 'test' },
              },
            },
          },
        ],
        [
          'sms',
          {
            provider: {
              type: 'twilio' as const,
              config: {
                accountSid: 'test',
                authToken: 'test',
                fromNumber: '+1234567890',
              },
            },
          },
        ],
      ]);

      const channels = ChannelFactory.createMany(configs);

      expect(channels.size).toBe(2);
      expect(channels.get('email')).toBeInstanceOf(EmailChannel);
      expect(channels.get('sms')).toBeInstanceOf(SmsChannel);
    });
  });

  describe('createRegistry', () => {
    it('should create a populated registry', () => {
      const configs = new Map([
        [
          'email',
          {
            provider: {
              type: 'smtp' as const,
              config: {
                host: 'smtp.example.com',
                port: 587,
                auth: { user: 'test', pass: 'test' },
              },
            },
          },
        ],
      ]);

      const registry = ChannelFactory.createRegistry(configs);

      expect(registry.has('email')).toBe(true);
      expect(registry.get('email')).toBeInstanceOf(EmailChannel);
    });
  });
});
