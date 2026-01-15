import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageRouter } from '../src/router/router';
import { createMessage } from '../src/utils';

describe('MessageRouter', () => {
  let router: MessageRouter;

  beforeEach(() => {
    router = new MessageRouter({
      enableMetrics: true,
      enableTransformation: true,
      enableFiltering: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(router).toBeDefined();
      expect(router['config'].enableTransformation).toBe(true);
      expect(router['config'].enableFiltering).toBe(true);
      expect(router['config'].maxConcurrency).toBe(100);
    });

    it('should initialize with custom configuration', () => {
      const customRouter = new MessageRouter({
        maxConcurrency: 50,
        enableTransformation: false
      });

      expect(customRouter['config'].maxConcurrency).toBe(50);
      expect(customRouter['config'].enableTransformation).toBe(false);
    });
  });

  describe('routing', () => {
    it('should route message with exact match', async () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const message = createMessage('test.topic', { data: 'test' });

      const result = await router.route(message);

      expect(result.matched).toBe(true);
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].id).toBe('test-rule');
      expect(result.actions).toHaveLength(1);
    });

    it('should route message with wildcard pattern', async () => {
      const rule = {
        id: 'wildcard-rule',
        name: 'Wildcard Rule',
        pattern: 'test.*',
        type: 'wildcard' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const message = createMessage('test.service', { data: 'test' });

      const result = await router.route(message);

      expect(result.matched).toBe(true);
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].id).toBe('wildcard-rule');
    });

    it('should route message with prefix pattern', async () => {
      const rule = {
        id: 'prefix-rule',
        name: 'Prefix Rule',
        pattern: 'test.',
        type: 'prefix' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const message = createMessage('test.topic', { data: 'test' });

      const result = await router.route(message);

      expect(result.matched).toBe(true);
      expect(result.rules).toHaveLength(1);
    });

    it('should route message with regex pattern', async () => {
      const rule = {
        id: 'regex-rule',
        name: 'Regex Rule',
        pattern: '^test\\.\\w+$',
        type: 'regex' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const message = createMessage('test.topic', { data: 'test' });

      const result = await router.route(message);

      expect(result.matched).toBe(true);
      expect(result.rules).toHaveLength(1);
    });

    it('should not route message with unmatched pattern', async () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        pattern: 'other.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const message = createMessage('test.topic', { data: 'test' });

      const result = await router.route(message);

      expect(result.matched).toBe(false);
      expect(result.rules).toHaveLength(0);
      expect(result.actions).toHaveLength(0);
    });

    it('should respect rule priority', async () => {
      const rule1 = {
        id: 'low-priority',
        name: 'Low Priority',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      const rule2 = {
        id: 'high-priority',
        name: 'High Priority',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-2' }],
        priority: 10,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule1);
      router.addRule(rule2);

      const message = createMessage('test.topic', { data: 'test' });

      const result = await router.route(message);

      expect(result.matched).toBe(true);
      expect(result.rules).toHaveLength(2);
      expect(result.rules[0].id).toBe('high-priority');
      expect(result.rules[1].id).toBe('low-priority');
    });

    it('should skip disabled rules', async () => {
      const enabledRule = {
        id: 'enabled-rule',
        name: 'Enabled Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      const disabledRule = {
        id: 'disabled-rule',
        name: 'Disabled Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-2' }],
        priority: 1,
        enabled: false,
        createdAt: Date.now()
      };

      router.addRule(enabledRule);
      router.addRule(disabledRule);

      const message = createMessage('test.topic', { data: 'test' });

      const result = await router.route(message);

      expect(result.matched).toBe(true);
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].id).toBe('enabled-rule');
    });
  });

  describe('transformation', () => {
    it('should transform message payload', async () => {
      const rule = {
        id: 'transform-rule',
        name: 'Transform Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{
          type: 'transform' as const,
          transform: {
            payload: {
              operation: 'replace',
              value: { transformed: true }
            }
          }
        }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const message = createMessage('test.topic', { data: 'original' });

      const result = await router.route(message);

      expect(result.matched).toBe(true);
      expect(result.transformedMessage).toBeDefined();
      expect(result.transformedMessage?.payload).toEqual({ transformed: true });
      expect(result.transformedMessage?.headers.transformedAt).toBeDefined();
    });

    it('should append to payload array', async () => {
      const rule = {
        id: 'append-rule',
        name: 'Append Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{
          type: 'transform' as const,
          transform: {
            payload: {
              operation: 'append',
              value: 'appended'
            }
          }
        }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const message = createMessage('test.topic', ['original']);

      const result = await router.route(message);

      expect(result.matched).toBe(true);
      expect(result.transformedMessage?.payload).toEqual(['original', 'appended']);
    });
  });

  describe('filtering', () => {
    it('should filter messages based on content type', async () => {
      const rule = {
        id: 'filter-rule',
        name: 'Filter Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{
          type: 'filter' as const,
          filter: {
            contentType: 'application/json'
          }
        }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const message = createMessage('test.topic', { data: 'test' });

      const result = await router.route(message);

      expect(result.matched).toBe(true);
      expect(result.rules).toHaveLength(1);
      expect(result.actions).toHaveLength(1);
    });

    it('should filter messages based on payload', async () => {
      const rule = {
        id: 'payload-filter-rule',
        name: 'Payload Filter Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{
          type: 'filter' as const,
          filter: {
            payload: {
              status: 'allowed'
            }
          }
        }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const allowedMessage = createMessage('test.topic', { status: 'allowed', data: 'test' });
      const blockedMessage = createMessage('test.topic', { status: 'blocked', data: 'test' });

      const allowedResult = await router.route(allowedMessage);
      const blockedResult = await router.route(blockedMessage);

      expect(allowedResult.matched).toBe(true);
      expect(blockedResult.matched).toBe(false);
    });
  });

  describe('rule management', () => {
    it('should add rule', () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const retrieved = router.getRule('test-rule');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-rule');
    });

    it('should remove rule', () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);
      expect(router.getRule('test-rule')).toBeDefined();

      const removed = router.removeRule('test-rule');
      expect(removed).toBe(true);
      expect(router.getRule('test-rule')).toBeUndefined();
    });

    it('should enable/disable rule', () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);
      expect(router.getRule('test-rule')?.enabled).toBe(true);

      router.disableRule('test-rule');
      expect(router.getRule('test-rule')?.enabled).toBe(false);

      router.enableRule('test-rule');
      expect(router.getRule('test-rule')?.enabled).toBe(true);
    });

    it('should get all rules', () => {
      const rule1 = {
        id: 'rule1',
        name: 'Rule 1',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-1' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      const rule2 = {
        id: 'rule2',
        name: 'Rule 2',
        pattern: 'other.topic',
        type: 'exact' as const,
        actions: [{ type: 'forward' as const, target: 'service-2' }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule1);
      router.addRule(rule2);

      const rules = router.getAllRules();
      expect(rules).toHaveLength(2);
      expect(rules.map(r => r.id)).toContain('rule1');
      expect(rules.map(r => r.id)).toContain('rule2');
    });
  });

  describe('error handling', () => {
    it('should handle route errors gracefully', async () => {
      const rule = {
        id: 'error-rule',
        name: 'Error Rule',
        pattern: 'test.topic',
        type: 'exact' as const,
        actions: [{
          type: 'transform' as const,
          transform: {
            payload: {
              operation: 'invalid_operation'
            }
          }
        }],
        priority: 1,
        enabled: true,
        createdAt: Date.now()
      };

      router.addRule(rule);

      const message = createMessage('test.topic', { data: 'test' });

      const result = await router.route(message);

      // Should still return original message on error
      expect(result.matched).toBe(true);
      expect(result.transformedMessage).toBeDefined();
      expect(result.transformedMessage?.payload).toEqual({ data: 'test' });
    });

    it('should provide metrics', () => {
      const metrics = router.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalMessages).toBe(0);
      expect(metrics.matchRate).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });

    it('should reset metrics', () => {
      // Simulate some activity
      router['metrics'].totalMessages = 10;
      router['metrics'].matchedMessages = 5;

      router.resetMetrics();

      const metrics = router.getMetrics();
      expect(metrics.totalMessages).toBe(0);
      expect(metrics.matchedMessages).toBe(0);
    });
  });
});