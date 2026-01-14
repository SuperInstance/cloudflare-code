/**
 * Unit Tests for Context Builder
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextBuilder } from '../../packages/edge/src/lib/sessions/context';
import type { SessionData, ConversationMessage } from '../../packages/edge/src/types';

describe('ContextBuilder', () => {
  let contextBuilder: ContextBuilder;
  let mockSession: SessionData;

  beforeEach(() => {
    contextBuilder = new ContextBuilder({
      contextWindow: 128000,
      enableSummarization: true,
      summaryTargetTokens: 10000,
      reservedTokens: 4000,
    });

    mockSession = {
      sessionId: 'test-session',
      userId: 'user-123',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messages: [],
      metadata: {
        language: 'typescript',
        framework: 'react',
        projectPath: '/test/project',
        repositoryHash: 'abc123',
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 0,
      },
      storage: {
        tier: 'hot',
        compressed: false,
        sizeBytes: 0,
        checkpointCount: 0,
        lastCheckpoint: Date.now(),
      },
    };
  });

  describe('buildContext', () => {
    it('should build recent context', async () => {
      const messages: ConversationMessage[] = [
        {
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
          tokens: 2,
        },
        {
          role: 'assistant',
          content: 'Hi there!',
          timestamp: Date.now(),
          tokens: 3,
        },
      ];

      mockSession.messages = messages;
      mockSession.metadata.messageCount = 2;
      mockSession.metadata.totalTokens = 5;

      const context = await contextBuilder.buildContext(mockSession, 'recent');

      expect(context.messages).toHaveLength(2);
      expect(context.totalTokens).toBe(5);
      expect(context.messageCount).toBe(2);
      expect(context.truncated).toBe(false);
      expect(context.metadata.sessionId).toBe('test-session');
      expect(context.metadata.userId).toBe('user-123');
    });

    it('should build summary context', async () => {
      // Create many messages
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 100; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: Date.now() + i * 1000,
          tokens: 10,
        });
      }

      mockSession.messages = messages;
      mockSession.metadata.messageCount = 100;
      mockSession.metadata.totalTokens = 1000;

      const context = await contextBuilder.buildContext(mockSession, 'summary');

      expect(context.messages.length).toBeGreaterThan(0);
      expect(context.summary).toBeDefined();
      expect(context.totalTokens).toBeGreaterThan(0);
    });

    it('should build all context', async () => {
      const messages: ConversationMessage[] = [
        {
          role: 'user',
          content: 'Test message',
          timestamp: Date.now(),
          tokens: 5,
        },
      ];

      mockSession.messages = messages;
      mockSession.metadata.messageCount = 1;
      mockSession.metadata.totalTokens = 5;

      const context = await contextBuilder.buildContext(mockSession, 'all');

      expect(context.messages).toHaveLength(1);
      expect(context.totalTokens).toBe(5);
      expect(context.messageCount).toBe(1);
    });

    it('should throw error for unknown strategy', async () => {
      await expect(
        contextBuilder.buildContext(mockSession, 'unknown' as any)
      ).rejects.toThrow('Unknown context strategy');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for text', () => {
      const text = 'Hello world! This is a test.';
      const tokens = contextBuilder.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should adjust for code', () => {
      const code = 'function test() { const x = 1; return x; }';
      const tokens = contextBuilder.estimateTokens(code);

      // Code should have higher token count
      expect(tokens).toBeGreaterThan(0);
    });

    it('should adjust for URLs', () => {
      const url = 'https://example.com/very/long/url/path';
      const tokens = contextBuilder.estimateTokens(url);

      // URLs should have lower token count
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('truncateToLimit', () => {
    it('should truncate messages to fit limit', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Message 1', timestamp: Date.now(), tokens: 100 },
        { role: 'assistant', content: 'Message 2', timestamp: Date.now(), tokens: 100 },
        { role: 'user', content: 'Message 3', timestamp: Date.now(), tokens: 100 },
      ];

      const truncated = await contextBuilder.truncateToLimit(messages, 150);

      expect(truncated).toHaveLength(1);
      expect(truncated[0].content).toBe('Message 1');
    });

    it('should return all messages if under limit', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Message 1', timestamp: Date.now(), tokens: 50 },
        { role: 'assistant', content: 'Message 2', timestamp: Date.now(), tokens: 50 },
      ];

      const truncated = await contextBuilder.truncateToLimit(messages, 200);

      expect(truncated).toHaveLength(2);
    });
  });

  describe('calculateUsage', () => {
    it('should calculate context window usage', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Message 1', timestamp: Date.now(), tokens: 4000 },
      ];

      mockSession.messages = messages;
      mockSession.metadata.messageCount = 1;
      mockSession.metadata.totalTokens = 4000;

      const context = await contextBuilder.buildContext(mockSession, 'recent');
      const usage = contextBuilder.calculateUsage(context);

      expect(usage.used).toBe(4000);
      expect(usage.available).toBe(124000); // 128000 - 4000 reserved
      expect(usage.percentage).toBeGreaterThan(0);
      expect(usage.percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('optimizeContext', () => {
    it('should remove duplicate messages', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Duplicate message', timestamp: Date.now(), tokens: 10 },
        { role: 'user', content: 'Duplicate message', timestamp: Date.now(), tokens: 10 },
        { role: 'assistant', content: 'Unique message', timestamp: Date.now(), tokens: 10 },
      ];

      mockSession.messages = messages;
      mockSession.metadata.messageCount = 3;
      mockSession.metadata.totalTokens = 30;

      const context = await contextBuilder.buildContext(mockSession, 'all');
      const optimized = await contextBuilder.optimizeContext(context);

      expect(optimized.messages).toHaveLength(2);
      expect(optimized.totalTokens).toBeLessThan(context.totalTokens);
    });
  });

  describe('buildContextWithMetadata', () => {
    it('should include metadata in context', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello', timestamp: Date.now(), tokens: 2 },
      ];

      mockSession.messages = messages;
      mockSession.metadata.messageCount = 1;
      mockSession.metadata.totalTokens = 2;

      const context = await contextBuilder.buildContextWithMetadata(
        mockSession,
        'recent',
        { customField: 'customValue' }
      );

      expect(context.messages).toHaveLength(2); // Original + metadata message
      expect(context.messages[0].role).toBe('system');
      expect(context.messages[0].content).toContain('customField');
    });
  });

  describe('estimateQuality', () => {
    it('should estimate context quality', async () => {
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 20; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: Date.now() + i * 1000,
          tokens: 100,
        });
      }

      mockSession.messages = messages;
      mockSession.metadata.messageCount = 20;
      mockSession.metadata.totalTokens = 2000;

      const context = await contextBuilder.buildContext(mockSession, 'all');
      const quality = contextBuilder.estimateQuality(context);

      expect(quality.score).toBeGreaterThan(0);
      expect(quality.score).toBeLessThanOrEqual(100);
      expect(quality.factors.messageCount).toBeGreaterThan(0);
      expect(quality.factors.tokenUtilization).toBeGreaterThan(0);
      expect(quality.factors.truncation).toBeGreaterThan(0);
      expect(quality.factors.diversity).toBeGreaterThan(0);
    });

    it('should penalize truncated context', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'A'.repeat(100000), timestamp: Date.now(), tokens: 25000 },
      ];

      mockSession.messages = messages;
      mockSession.metadata.messageCount = 1;
      mockSession.metadata.totalTokens = 25000;

      const context = await contextBuilder.buildContext(mockSession, 'recent');
      const quality = contextBuilder.estimateQuality(context);

      expect(quality.factors.truncation).toBeLessThan(100);
    });
  });
});
