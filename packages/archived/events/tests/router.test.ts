/**
 * Message Router Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageRouter } from '../src/router/router';
import type { EventEnvelope, RouteRule, RouteTarget } from '../src/router/router';

describe('MessageRouter', () => {
  let router: MessageRouter;
  let testEvent: EventEnvelope;

  beforeEach(() => {
    router = new MessageRouter();
    testEvent = {
      metadata: {
        eventId: 'evt_1',
        eventType: 'UserCreated',
        timestamp: Date.now(),
        version: 1,
        source: 'user-service',
      },
      payload: {
        userId: 'user_123',
        email: 'test@example.com',
        role: 'admin',
      },
    };
  });

  describe('Content-Based Routing', () => {
    it('should route events based on field values', async () => {
      const rule: Omit<RouteRule, 'ruleId'> = {
        name: 'Admin users route',
        priority: 10,
        enabled: true,
        condition: {
          type: 'content',
          fieldPath: 'role',
          operator: 'equals',
          value: 'admin',
        },
        target: { type: 'topic', name: 'admin-events' },
      };

      const ruleId = router.addRule(rule);
      const result = await router.route(testEvent);

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(ruleId);
      expect(result.targets).toHaveLength(1);
      expect(result.targets[0]).toEqual({ type: 'topic', name: 'admin-events' });
    });

    it('should support contains operator', async () => {
      router.addRule({
        name: 'Email contains test',
        priority: 10,
        enabled: true,
        condition: {
          type: 'content',
          fieldPath: 'email',
          operator: 'contains',
          value: 'test',
        },
        target: { type: 'topic', name: 'test-users' },
      });

      const result = await router.route(testEvent);
      expect(result.matched).toBe(true);
    });

    it('should support numeric comparisons', async () => {
      const eventWithScore: EventEnvelope = {
        ...testEvent,
        payload: { ...testEvent.payload, score: 85 },
      };

      router.addRule({
        name: 'High score users',
        priority: 10,
        enabled: true,
        condition: {
          type: 'content',
          fieldPath: 'score',
          operator: 'gte',
          value: 80,
        },
        target: { type: 'topic', name: 'high-scores' },
      });

      const result = await router.route(eventWithScore);
      expect(result.matched).toBe(true);
    });
  });

  describe('Header-Based Routing', () => {
    it('should route events based on metadata headers', async () => {
      const eventWithHeader: EventEnvelope = {
        ...testEvent,
        metadata: {
          ...testEvent.metadata,
          region: 'us-west' as unknown as string,
        },
      };

      router.addRule({
        name: 'US West region',
        priority: 10,
        enabled: true,
        condition: {
          type: 'header',
          headerName: 'region',
          operator: 'equals',
          value: 'us-west',
        },
        target: { type: 'topic', name: 'us-west-events' },
      });

      const result = await router.route(eventWithHeader);
      expect(result.matched).toBe(true);
    });
  });

  describe('Pattern-Based Routing', () => {
    it('should support wildcard patterns', async () => {
      router.addRule({
        name: 'User events wildcard',
        priority: 10,
        enabled: true,
        condition: {
          type: 'pattern',
          pattern: 'User*',
          matchType: 'wildcard',
          scope: 'eventType',
        },
        target: { type: 'topic', name: 'all-user-events' },
      });

      const result = await router.route(testEvent);
      expect(result.matched).toBe(true);
    });

    it('should support regex patterns', async () => {
      router.addRule({
        name: 'User events regex',
        priority: 10,
        enabled: true,
        condition: {
          type: 'pattern',
          pattern: '^User.*Created$',
          matchType: 'regex',
          scope: 'eventType',
        },
        target: { type: 'topic', name: 'user-created-events' },
      });

      const result = await router.route(testEvent);
      expect(result.matched).toBe(true);
    });
  });

  describe('Composite Conditions', () => {
    it('should support AND conditions', async () => {
      router.addRule({
        name: 'Admin users from US',
        priority: 10,
        enabled: true,
        condition: {
          type: 'and',
          conditions: [
            {
              type: 'content',
              fieldPath: 'role',
              operator: 'equals',
              value: 'admin',
            },
            {
              type: 'content',
              fieldPath: 'country',
              operator: 'equals',
              value: 'US',
            },
          ],
        },
        target: { type: 'topic', name: 'admin-us-events' },
      });

      const event = {
        ...testEvent,
        payload: { ...testEvent.payload, role: 'admin', country: 'US' },
      };

      const result = await router.route(event);
      expect(result.matched).toBe(true);
    });

    it('should support OR conditions', async () => {
      router.addRule({
        name: 'Important users',
        priority: 10,
        enabled: true,
        condition: {
          type: 'or',
          conditions: [
            {
              type: 'content',
              fieldPath: 'role',
              operator: 'equals',
              value: 'admin',
            },
            {
              type: 'content',
              fieldPath: 'role',
              operator: 'equals',
              value: 'moderator',
            },
          ],
        },
        target: { type: 'topic', name: 'important-users' },
      });

      const result = await router.route(testEvent);
      expect(result.matched).toBe(true);
    });

    it('should support NOT conditions', async () => {
      router.addRule({
        name: 'Non-admin users',
        priority: 10,
        enabled: true,
        condition: {
          type: 'not',
          conditions: [
            {
              type: 'content',
              fieldPath: 'role',
              operator: 'equals',
              value: 'admin',
            },
          ],
        },
        target: { type: 'topic', name: 'regular-users' },
      });

      const event = {
        ...testEvent,
        payload: { ...testEvent.payload, role: 'user' },
      };

      const result = await router.route(event);
      expect(result.matched).toBe(true);
    });
  });

  describe('Priority-Based Routing', () => {
    it('should evaluate rules in priority order', async () => {
      router.addRule({
        name: 'Low priority rule',
        priority: 1,
        enabled: true,
        condition: {
          type: 'content',
          fieldPath: 'role',
          operator: 'exists',
          value: null,
        },
        target: { type: 'topic', name: 'low-priority' },
      });

      router.addRule({
        name: 'High priority rule',
        priority: 10,
        enabled: true,
        condition: {
          type: 'content',
          fieldPath: 'role',
          operator: 'equals',
          value: 'admin',
        },
        target: { type: 'topic', name: 'high-priority' },
      });

      const result = await router.route(testEvent);
      expect(result.matched).toBe(true);
      expect(result.targets[0]).toEqual({ type: 'topic', name: 'high-priority' });
    });
  });

  describe('Multi-Target Routing', () => {
    it('should route to multiple targets', async () => {
      router.addRule({
        name: 'Multi-target rule',
        priority: 10,
        enabled: true,
        condition: {
          type: 'content',
          fieldPath: 'role',
          operator: 'equals',
          value: 'admin',
        },
        target: {
          type: 'multi',
          targets: [
            { type: 'topic', name: 'admin-events' },
            { type: 'topic', name: 'audit-log' },
            { type: 'queue', name: 'admin-queue' },
          ],
        },
      });

      const result = await router.route(testEvent);
      expect(result.matched).toBe(true);
      expect(result.targets).toHaveLength(3);
    });
  });

  describe('Route Caching', () => {
    it('should cache routing results', async () => {
      router.addRule({
        name: 'Cached rule',
        priority: 10,
        enabled: true,
        condition: {
          type: 'content',
          fieldPath: 'role',
          operator: 'equals',
          value: 'admin',
        },
        target: { type: 'topic', name: 'admin-events' },
      });

      // First call
      const result1 = await router.route(testEvent);
      expect(result1.cacheHit).toBe(false);

      // Second call should be cached
      const result2 = await router.route(testEvent);
      expect(result2.cacheHit).toBe(true);
      expect(result2.executionTimeMs).toBeLessThan(result1.executionTimeMs);
    });
  });

  describe('Batch Routing', () => {
    it('should route multiple events efficiently', async () => {
      router.addRule({
        name: 'Batch rule',
        priority: 10,
        enabled: true,
        condition: {
          type: 'pattern',
          pattern: 'User*',
          matchType: 'wildcard',
          scope: 'eventType',
        },
        target: { type: 'topic', name: 'user-events' },
      });

      const events = [
        testEvent,
        { ...testEvent, metadata: { ...testEvent.metadata, eventType: 'UserUpdated' } },
        { ...testEvent, metadata: { ...testEvent.metadata, eventType: 'UserDeleted' } },
      ];

      const results = await router.routeBatch(events);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.matched)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track routing statistics', async () => {
      router.addRule({
        name: 'Stats rule',
        priority: 10,
        enabled: true,
        condition: {
          type: 'content',
          fieldPath: 'role',
          operator: 'exists',
          value: null,
        },
        target: { type: 'topic', name: 'all' },
      });

      await router.route(testEvent);
      await router.route(testEvent);

      const stats = router.getStats();
      expect(stats.totalEvaluations).toBe(2);
      expect(stats.totalMatches).toBe(2);
    });
  });

  describe('Rule Management', () => {
    it('should add, update, and remove rules', async () => {
      const ruleId = router.addRule({
        name: 'Test rule',
        priority: 10,
        enabled: true,
        condition: {
          type: 'content',
          fieldPath: 'role',
          operator: 'equals',
          value: 'admin',
        },
        target: { type: 'topic', name: 'test' },
      });

      expect(router.getRule(ruleId)).toBeDefined();

      router.updateRule(ruleId, { enabled: false });
      expect(router.getRule(ruleId)?.enabled).toBe(false);

      expect(router.removeRule(ruleId)).toBe(true);
      expect(router.getRule(ruleId)).toBeNull();
    });
  });

  describe('Default Target', () => {
    it('should use default target when no rules match', async () => {
      router.setDefaultTarget({ type: 'topic', name: 'default-topic' });

      const result = await router.route(testEvent);
      expect(result.matched).toBe(false);
      expect(result.targets).toHaveLength(1);
      expect(result.targets[0]).toEqual({ type: 'topic', name: 'default-topic' });
    });
  });
});
