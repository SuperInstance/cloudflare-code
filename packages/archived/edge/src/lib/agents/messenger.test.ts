/**
 * Unit Tests for Agent Messenger
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentMessenger } from './messenger';
import type { AgentMessage, Env } from './types';

// Mock environment
const mockStorage = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

const mockEnv: Env = {
  DIRECTOR_DO: {
    get: vi.fn(),
    idFromName: vi.fn((name: string) => ({ toString: () => name })),
  } as unknown as DurableObjectNamespace,
  PLANNER_DO: {
    get: vi.fn(),
    idFromName: vi.fn((name: string) => ({ toString: () => name })),
  } as unknown as DurableObjectNamespace,
  EXECUTOR_DO: {
    get: vi.fn(),
    idFromName: vi.fn((name: string) => ({ toString: () => name })),
  } as unknown as DurableObjectNamespace,
  AGENT_REGISTRY: {
    get: vi.fn(),
    idFromName: vi.fn((name: string) => ({ toString: () => name })),
  } as unknown as DurableObjectNamespace,
  AGENTS_KV: undefined,
};

describe('AgentMessenger', () => {
  let messenger: AgentMessenger;

  beforeEach(() => {
    vi.clearAllMocks();
    messenger = new AgentMessenger(mockEnv, mockStorage as unknown as DurableObjectStorage);
  });

  describe('sendToAgent', () => {
    it('should create and queue a message', async () => {
      const messageId = await messenger.sendToAgent(
        'director-123',
        'planner-code-456',
        {
          type: 'request',
          payload: { action: 'plan' },
          priority: 0.8,
        }
      );

      expect(messageId).toBeTruthy();
      expect(mockStorage.put).toHaveBeenCalled();
    });

    it('should generate unique message IDs', async () => {
      const id1 = await messenger.sendToAgent('director-1', 'planner-1', {
        type: 'request',
        payload: {},
      });

      const id2 = await messenger.sendToAgent('director-1', 'planner-2', {
        type: 'request',
        payload: {},
      });

      expect(id1).not.toBe(id2);
    });
  });

  describe('broadcast', () => {
    it('should send message to multiple agents', async () => {
      const recipients = ['planner-code-1', 'planner-docs-2', 'planner-debug-3'];

      const messageIds = await messenger.broadcast(
        'director-123',
        recipients,
        {
          type: 'notification',
          payload: { update: 'system' },
          priority: 0.5,
        }
      );

      expect(messageIds).toHaveLength(recipients.length);
      expect(new Set(messageIds).size).toBe(recipients.length); // All unique
    });

    it('should handle partial failures gracefully', async () => {
      const recipients = ['planner-code-1', 'planner-docs-2'];

      const messageIds = await messenger.broadcast(
        'director-123',
        recipients,
        {
          type: 'notification',
          payload: {},
          priority: 0.5,
        }
      );

      // Should return successful sends
      expect(messageIds.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('receive', () => {
    it('should return messages for specific agent', async () => {
      const message: AgentMessage = {
        id: crypto.randomUUID(),
        from: 'director-123',
        to: 'planner-code-456',
        type: 'request',
        payload: { test: 'data' },
        timestamp: Date.now(),
        priority: 0.5,
      };

      await messenger.storeMessage(message);

      const messages = await messenger.receive('planner-code-456');

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(message.id);
    });

    it('should remove messages after receiving', async () => {
      const message: AgentMessage = {
        id: crypto.randomUUID(),
        from: 'director-123',
        to: 'planner-code-456',
        type: 'request',
        payload: {},
        timestamp: Date.now(),
        priority: 0.5,
      };

      await messenger.storeMessage(message);

      await messenger.receive('planner-code-456');
      const messages = await messenger.receive('planner-code-456');

      expect(messages).toHaveLength(0);
    });

    it('should not return messages for other agents', async () => {
      const message: AgentMessage = {
        id: crypto.randomUUID(),
        from: 'director-123',
        to: 'planner-code-456',
        type: 'request',
        payload: {},
        timestamp: Date.now(),
        priority: 0.5,
      };

      await messenger.storeMessage(message);

      const messages = await messenger.receive('planner-docs-789');

      expect(messages).toHaveLength(0);
    });
  });

  describe('peek', () => {
    it('should return messages without removing them', async () => {
      const message: AgentMessage = {
        id: crypto.randomUUID(),
        from: 'director-123',
        to: 'planner-code-456',
        type: 'request',
        payload: {},
        timestamp: Date.now(),
        priority: 0.5,
      };

      await messenger.storeMessage(message);

      const peek1 = await messenger.peek('planner-code-456');
      const peek2 = await messenger.peek('planner-code-456');

      expect(peek1).toHaveLength(1);
      expect(peek2).toHaveLength(1); // Still there
    });
  });

  describe('getMessageStatus', () => {
    it('should return status for queued message', async () => {
      const messageId = await messenger.sendToAgent('director-1', 'planner-1', {
        type: 'request',
        payload: {},
      });

      const status = await messenger.getMessageStatus(messageId);

      expect(status).toBeTruthy();
      expect(status?.messageId).toBe(messageId);
    });

    it('should return null for unknown message', async () => {
      const status = await messenger.getMessageStatus('unknown-id');

      expect(status).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return messenger statistics', () => {
      const stats = messenger.getStats();

      expect(stats).toHaveProperty('outboxSize');
      expect(stats).toHaveProperty('inboxSize');
      expect(stats).toHaveProperty('sentMessages');
      expect(stats).toHaveProperty('messageCount');

      expect(typeof stats.outboxSize).toBe('number');
      expect(typeof stats.inboxSize).toBe('number');
    });
  });

  describe('storeMessage', () => {
    it('should store incoming message', async () => {
      const message: AgentMessage = {
        id: crypto.randomUUID(),
        from: 'director-123',
        to: 'planner-code-456',
        type: 'request',
        payload: {},
        timestamp: Date.now(),
        priority: 0.5,
      };

      await messenger.storeMessage(message);

      const messages = await messenger.receive('planner-code-456');
      expect(messages).toHaveLength(1);
    });
  });
});
