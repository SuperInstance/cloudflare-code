/**
 * Unit tests for Context Manager
 */

import { ContextManager } from '../../src/manager/manager';
import {
  Message,
  ContextManagerConfig,
  ContextState,
} from '../../src/types';

describe('ContextManager', () => {
  let manager: ContextManager;
  let config: Partial<ContextManagerConfig>;

  beforeEach(() => {
    config = {
      maxTokens: 10000,
      reservedTokens: 1000,
      compressionEnabled: true,
      enableEvents: false,
    };
    manager = new ContextManager(config);
  });

  describe('Context Creation', () => {
    test('should create a new context', async () => {
      const context = await manager.createContext('user123', {
        title: 'Test Session',
      });

      expect(context.sessionId).toBeDefined();
      expect(context.userId).toBe('user123');
      expect(context.messages).toEqual([]);
      expect(context.state).toBe('active');
      expect(context.metadata.title).toBe('Test Session');
    });

    test('should create context with default values', async () => {
      const context = await manager.createContext();

      expect(context.sessionId).toBeDefined();
      expect(context.userId).toBeUndefined();
      expect(context.contextWindow.maxTokens).toBe(10000);
      expect(context.contextWindow.currentTokens).toBe(0);
    });

    test('should get existing context', async () => {
      const created = await manager.createContext('user456');
      const retrieved = await manager.getContext(created.sessionId);

      expect(retrieved.sessionId).toBe(created.sessionId);
      expect(retrieved.userId).toBe('user456');
    });

    test('should throw error when getting non-existent context', async () => {
      await expect(manager.getContext('invalid-id')).rejects.toThrow();
    });

    test('should update context', async () => {
      const context = await manager.createContext('user789');
      const updated = await manager.updateContext(context.sessionId, {
        state: 'archived' as ContextState,
      });

      expect(updated.state).toBe('archived');
    });

    test('should delete context', async () => {
      const context = await manager.createContext('user000');
      await manager.deleteContext(context.sessionId);

      await expect(manager.getContext(context.sessionId)).rejects.toThrow();
    });
  });

  describe('Message Management', () => {
    let context: any;

    beforeEach(async () => {
      context = await manager.createContext('user-msg');
    });

    test('should add user message', async () => {
      const message = await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'Hello, world!',
      });

      expect(message.id).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
      expect(message.timestamp).toBeDefined();
    });

    test('should add assistant message', async () => {
      const message = await manager.addMessage(context.sessionId, {
        role: 'assistant',
        content: 'Hi there!',
      });

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hi there!');
    });

    test('should add system message', async () => {
      const message = await manager.addMessage(context.sessionId, {
        role: 'system',
        content: 'System instruction',
      });

      expect(message.role).toBe('system');
    });

    test('should add multiple messages', async () => {
      const messages = await manager.addMessages(context.sessionId, [
        { role: 'user', content: 'Question 1' },
        { role: 'assistant', content: 'Answer 1' },
        { role: 'user', content: 'Question 2' },
      ]);

      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
    });

    test('should get message by ID', async () => {
      const added = await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'Test message',
      });
      const retrieved = await manager.getMessage(context.sessionId, added.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(added.id);
      expect(retrieved?.content).toBe('Test message');
    });

    test('should get messages by time range', async () => {
      const now = Date.now();
      await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'Message 1',
      });
      await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'Message 2',
      });

      const messages = await manager.getMessagesByTimeRange(
        context.sessionId,
        now - 1000,
        now + 1000
      );

      expect(messages.length).toBeGreaterThanOrEqual(2);
    });

    test('should get last N messages', async () => {
      await manager.addMessages(context.sessionId, [
        { role: 'user', content: 'M1' },
        { role: 'user', content: 'M2' },
        { role: 'user', content: 'M3' },
        { role: 'user', content: 'M4' },
        { role: 'user', content: 'M5' },
      ]);

      const last3 = await manager.getLastMessages(context.sessionId, 3);

      expect(last3).toHaveLength(3);
      expect(last3[0].content).toBe('M3');
      expect(last3[2].content).toBe('M5');
    });

    test('should remove message', async () => {
      const message = await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'To be deleted',
      });

      await manager.removeMessage(context.sessionId, message.id);
      const retrieved = await manager.getMessage(context.sessionId, message.id);

      expect(retrieved).toBeNull();
    });

    test('should update message', async () => {
      const message = await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'Original content',
      });

      const updated = await manager.updateMessage(
        context.sessionId,
        message.id,
        { content: 'Updated content' }
      );

      expect(updated.content).toBe('Updated content');
    });
  });

  describe('Context Window Management', () => {
    let context: any;

    beforeEach(async () => {
      context = await manager.createContext('user-window');
    });

    test('should get context window', () => {
      const window = manager.getContextWindow(context.sessionId);

      expect(window).toBeDefined();
      expect(window.maxTokens).toBe(10000);
      expect(window.currentTokens).toBe(0);
      expect(window.reservedTokens).toBe(1000);
      expect(window.availableTokens).toBe(9000);
    });

    test('should update context window', async () => {
      await manager.updateContextWindow(context.sessionId, {
        maxTokens: 20000,
      });

      const window = manager.getContextWindow(context.sessionId);
      expect(window.maxTokens).toBe(20000);
    });

    test('should track token usage', async () => {
      await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'This is a test message',
      });

      const usage = manager.getTokenUsage(context.sessionId);

      expect(usage.current).toBeGreaterThan(0);
      expect(usage.max).toBe(10000);
      expect(usage.reserved).toBe(1000);
      expect(usage.available).toBeLessThan(9000);
    });

    test('should calculate percentage correctly', async () => {
      const usage = manager.getTokenUsage(context.sessionId);
      expect(usage.percentage).toBe(0);

      await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'x'.repeat(4000), // ~1000 tokens
      });

      const updatedUsage = manager.getTokenUsage(context.sessionId);
      expect(updatedUsage.percentage).toBeGreaterThan(0);
    });
  });

  describe('Session Management', () => {
    test('should list all sessions', async () => {
      await manager.createContext('user1');
      await manager.createContext('user2');
      await manager.createContext('user3');

      const sessions = manager.listSessions();

      expect(sessions).toHaveLength(3);
    });

    test('should list sessions for specific user', async () => {
      await manager.createContext('user-a');
      await manager.createContext('user-a');
      await manager.createContext('user-b');

      const userASessions = manager.listSessions('user-a');

      expect(userASessions).toHaveLength(2);
      expect(userASessions.every(s => s.userId === 'user-a')).toBe(true);
    });

    test('should get active sessions', async () => {
      const ctx1 = await manager.createContext('user-active');
      const ctx2 = await manager.createContext('user-active');
      await manager.archiveContext(ctx1.sessionId);

      const active = manager.getActiveSessions('user-active');

      expect(active).toHaveLength(1);
      expect(active[0]).toBe(ctx2.sessionId);
    });

    test('should get archived sessions', async () => {
      const ctx1 = await manager.createContext('user-archived');
      const ctx2 = await manager.createContext('user-archived');
      await manager.archiveContext(ctx1.sessionId);

      const archived = manager.getArchivedSessions('user-archived');

      expect(archived).toHaveLength(1);
      expect(archived[0]).toBe(ctx1.sessionId);
    });
  });

  describe('Token Counting', () => {
    test('should count tokens', async () => {
      const result = await manager.countTokens('Hello, world!');

      expect(result.tokens).toBeGreaterThan(0);
      expect(result.characters).toBe(13);
      expect(result.estimated).toBe(true);
    });

    test('should count tokens in batch', async () => {
      const results = await manager.countTokensBatch([
        'Hello',
        'World',
        'Test',
      ]);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.tokens > 0)).toBe(true);
    });

    test('should handle empty string', async () => {
      const result = await manager.countTokens('');

      expect(result.tokens).toBe(0);
    });
  });

  describe('Event Handling', () => {
    test('should emit events when enabled', async () => {
      const eventManager = new ContextManager({
        ...config,
        enableEvents: true,
      });

      const handler = jest.fn();
      eventManager.on('message_added', handler);

      const context = await eventManager.createContext('user-event');
      await eventManager.addMessage(context.sessionId, {
        role: 'user',
        content: 'Test',
      });

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
    });

    test('should not emit events when disabled', async () => {
      const handler = jest.fn();
      manager.on('message_added', handler);

      const context = await manager.createContext('user-no-event');
      await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'Test',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    test('should track metrics', async () => {
      const context = await manager.createContext('user-metrics');
      await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'Test message',
      });

      const metrics = manager.getMetrics(context.sessionId);

      expect(metrics).toBeDefined();
      expect(metrics?.totalMessages).toBe(1);
      expect(metrics?.totalTokens).toBeGreaterThan(0);
    });

    test('should return null for non-existent session metrics', () => {
      const metrics = manager.getMetrics('invalid');

      expect(metrics).toBeNull();
    });

    test('should get all metrics', async () => {
      await manager.createContext('user-all-1');
      await manager.createContext('user-all-2');

      const allMetrics = manager.getAllMetrics();

      expect(allMetrics.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Utility Methods', () => {
    test('should export context to JSON', async () => {
      const context = await manager.createContext('user-export');
      await manager.addMessage(context.sessionId, {
        role: 'user',
        content: 'Export test',
      });

      const json = await manager.exportContext(context.sessionId);

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.sessionId).toBe(context.sessionId);
    });

    test('should import context from JSON', async () => {
      const original = await manager.createContext('user-import');
      const json = await manager.exportContext(original.sessionId);

      await manager.clearAll();
      const imported = await manager.importContext(json);

      expect(imported.sessionId).toBe(original.sessionId);
    });

    test('should clone context', async () => {
      const original = await manager.createContext('user-clone');
      await manager.addMessage(original.sessionId, {
        role: 'user',
        content: 'Clone test',
      });

      const cloned = await manager.cloneContext(original.sessionId);

      expect(cloned.sessionId).not.toBe(original.sessionId);
      expect(cloned.userId).toBe(original.userId);
      expect(cloned.messages).toHaveLength(original.messages.length);
    });

    test('should get context count', async () => {
      await manager.createContext('user-count-1');
      await manager.createContext('user-count-2');
      await manager.createContext('user-count-3');

      expect(manager.getCount()).toBe(3);
    });

    test('should get count by state', async () => {
      const ctx1 = await manager.createContext('user-state');
      const ctx2 = await manager.createContext('user-state');
      await manager.archiveContext(ctx1.sessionId);

      expect(manager.getCountByState('active')).toBe(1);
      expect(manager.getCountByState('archived')).toBe(1);
    });

    test('should clear all contexts', async () => {
      await manager.createContext('user-clear-1');
      await manager.createContext('user-clear-2');

      await manager.clearAll();

      expect(manager.getCount()).toBe(0);
    });
  });
});
