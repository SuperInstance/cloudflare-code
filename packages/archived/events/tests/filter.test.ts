/**
 * Event Filter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventFilter } from '../src/filter/filter';
import type { EventEnvelope, FilterDefinition } from '../src/filter/filter';

describe('EventFilter', () => {
  let filter: EventFilter;
  let testEvent: EventEnvelope;

  beforeEach(() => {
    filter = new EventFilter();
    testEvent = {
      metadata: {
        eventId: 'evt_1',
        eventType: 'UserCreated',
        timestamp: Date.now(),
        version: 1,
        source: 'user-service',
        userId: 'user_123',
      },
      payload: {
        userId: 'user_123',
        email: 'test@example.com',
        role: 'admin',
        age: 30,
        score: 85.5,
        tags: ['premium', 'verified'],
        active: true,
      },
    };
  });

  describe('Field Filters', () => {
    it('should filter by equality', async () => {
      const filterId = filter.addFilter({
        name: 'Admin filter',
        expression: {
          type: 'field',
          field: 'role',
          operator: 'eq',
          value: 'admin',
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should filter by inequality', async () => {
      const filterId = filter.addFilter({
        name: 'Non-guest filter',
        expression: {
          type: 'field',
          field: 'role',
          operator: 'ne',
          value: 'guest',
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should filter by comparison operators', async () => {
      const filterId = filter.addFilter({
        name: 'Adult filter',
        expression: {
          type: 'field',
          field: 'age',
          operator: 'gte',
          value: 18,
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should filter by contains', async () => {
      const filterId = filter.addFilter({
        name: 'Email domain filter',
        expression: {
          type: 'field',
          field: 'email',
          operator: 'contains',
          value: 'example.com',
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should filter by in operator', async () => {
      const filterId = filter.addFilter({
        name: 'Role filter',
        expression: {
          type: 'field',
          field: 'role',
          operator: 'in',
          value: ['admin', 'moderator'],
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should filter by exists', async () => {
      const filterId = filter.addFilter({
        name: 'Has role filter',
        expression: {
          type: 'field',
          field: 'role',
          operator: 'exists',
          value: null,
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should support case insensitive matching', async () => {
      const filterId = filter.addFilter({
        name: 'Email filter',
        expression: {
          type: 'field',
          field: 'email',
          operator: 'eq',
          value: 'TEST@EXAMPLE.COM',
          caseSensitive: false,
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });
  });

  describe('Composite Filters', () => {
    it('should support AND conditions', async () => {
      const filterId = filter.addFilter({
        name: 'Adult admin filter',
        expression: {
          type: 'and',
          filters: [
            {
              type: 'field',
              field: 'role',
              operator: 'eq',
              value: 'admin',
            },
            {
              type: 'field',
              field: 'age',
              operator: 'gte',
              value: 18,
            },
          ],
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should support OR conditions', async () => {
      const filterId = filter.addFilter({
        name: 'Important user filter',
        expression: {
          type: 'or',
          filters: [
            {
              type: 'field',
              field: 'role',
              operator: 'eq',
              value: 'admin',
            },
            {
              type: 'field',
              field: 'score',
              operator: 'gte',
              value: 90,
            },
          ],
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should support NOT conditions', async () => {
      const filterId = filter.addFilter({
        name: 'Non-guest filter',
        expression: {
          type: 'not',
          filters: [
            {
              type: 'field',
              field: 'role',
              operator: 'eq',
              value: 'guest',
            },
          ],
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should support short-circuit evaluation', async () => {
      let callCount = 0;
      const filterId = filter.addFilter({
        name: 'Short circuit filter',
        expression: {
          type: 'and',
          shortCircuit: true,
          filters: [
            {
              type: 'field',
              field: 'role',
              operator: 'eq',
              value: 'wrong-value', // This will fail
            },
            {
              type: 'custom',
              fn: () => {
                callCount++;
                return true;
              },
            },
          ],
        },
        enabled: true,
      });

      await filter.evaluate(testEvent, filterId);
      expect(callCount).toBe(0); // Custom filter should not be called
    });
  });

  describe('Regex Filters', () => {
    it('should support regex matching', async () => {
      const filterId = filter.addFilter({
        name: 'Email pattern filter',
        expression: {
          type: 'regex',
          patterns: [
            {
              field: 'email',
              pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            },
          ],
          matchType: 'all',
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should support multiple patterns with any match', async () => {
      const filterId = filter.addFilter({
        name: 'Multiple patterns filter',
        expression: {
          type: 'regex',
          patterns: [
            {
              field: 'email',
              pattern: 'admin@.*',
            },
            {
              field: 'email',
              pattern: '.*@example\\.com',
            },
          ],
          matchType: 'any',
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });
  });

  describe('Wildcard Filters', () => {
    it('should support wildcard matching', async () => {
      const filterId = filter.addFilter({
        name: 'Email wildcard filter',
        expression: {
          type: 'wildcard',
          patterns: [
            {
              field: 'email',
              pattern: '*@example.com',
            },
          ],
          matchType: 'all',
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });
  });

  describe('Custom Filters', () => {
    it('should support custom filter functions', async () => {
      const filterId = filter.addFilter({
        name: 'Custom filter',
        expression: {
          type: 'custom',
          fn: (event: EventEnvelope) => {
            const payload = event.payload as { score: number };
            return payload.score > 80;
          },
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should support async custom filters', async () => {
      const filterId = filter.addFilter({
        name: 'Async custom filter',
        expression: {
          type: 'custom',
          fn: async (event: EventEnvelope) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            const payload = event.payload as { active: boolean };
            return payload.active === true;
          },
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });
  });

  describe('Schema Filters', () => {
    it('should validate required fields', async () => {
      const filterId = filter.addFilter({
        name: 'Required fields filter',
        expression: {
          type: 'schema',
          requiredFields: ['userId', 'email', 'role'],
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should validate field types', async () => {
      const filterId = filter.addFilter({
        name: 'Field types filter',
        expression: {
          type: 'schema',
          fieldTypes: {
            userId: 'string',
            age: 'number',
            active: 'boolean',
          },
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should validate schema version', async () => {
      const filterId = filter.addFilter({
        name: 'Version filter',
        expression: {
          type: 'schema',
          schemaVersion: 1,
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });
  });

  describe('Temporal Filters', () => {
    it('should filter by time range', async () => {
      const now = Date.now();
      const filterId = filter.addFilter({
        name: 'Recent events filter',
        expression: {
          type: 'temporal',
          timeRange: {
            from: now - 60000, // Last minute
            to: now + 60000,
          },
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should filter by event age', async () => {
      const filterId = filter.addFilter({
        name: 'Fresh events filter',
        expression: {
          type: 'temporal',
          ageRange: {
            maxAgeMs: 60000, // Not older than 1 minute
          },
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });

    it('should filter by time window', async () => {
      const filterId = filter.addFilter({
        name: 'Window filter',
        expression: {
          type: 'temporal',
          timeWindow: {
            durationMs: 60000, // 1 minute windows
          },
        },
        enabled: true,
      });

      const result = await filter.evaluate(testEvent, filterId);
      expect(result.matched).toBe(true);
    });
  });

  describe('Filter Chains', () => {
    it('should evaluate ALL chains (AND mode)', async () => {
      filter.addFilter({
        name: 'Role filter',
        expression: { type: 'field', field: 'role', operator: 'eq', value: 'admin' },
        enabled: true,
      });

      filter.addFilter({
        name: 'Age filter',
        expression: { type: 'field', field: 'age', operator: 'gte', value: 18 },
        enabled: true,
      });

      const chainId = filter.addChain({
        name: 'Adult admin chain',
        mode: 'all',
        filters: filter.listFilters(),
      });

      const result = await filter.evaluateChain(testEvent, chainId);
      expect(result.matched).toBe(true);
    });

    it('should evaluate ANY chains (OR mode)', async () => {
      filter.addFilter({
        name: 'Role filter',
        expression: { type: 'field', field: 'role', operator: 'eq', value: 'admin' },
        enabled: true,
      });

      filter.addFilter({
        name: 'Score filter',
        expression: { type: 'field', field: 'score', operator: 'gte', value: 100 },
        enabled: true,
      });

      const chainId = filter.addChain({
        name: 'Important user chain',
        mode: 'any',
        filters: filter.listFilters(),
      });

      const result = await filter.evaluateChain(testEvent, chainId);
      expect(result.matched).toBe(true);
    });

    it('should evaluate SEQUENTIAL chains (pipeline mode)', async () => {
      filter.addFilter({
        name: 'Has role filter',
        expression: { type: 'field', field: 'role', operator: 'exists', value: null },
        enabled: true,
      });

      const chainId = filter.addChain({
        name: 'Sequential chain',
        mode: 'sequential',
        filters: filter.listFilters(),
      });

      const result = await filter.evaluateChain(testEvent, chainId);
      expect(result.matched).toBe(true);
    });
  });

  describe('Batch Evaluation', () => {
    it('should evaluate multiple events against all filters', async () => {
      filter.addFilter({
        name: 'Admin filter',
        expression: { type: 'field', field: 'role', operator: 'eq', value: 'admin' },
        enabled: true,
      });

      const events = [
        testEvent,
        { ...testEvent, payload: { ...testEvent.payload, role: 'user' } },
        { ...testEvent, payload: { ...testEvent.payload, role: 'admin' } },
      ];

      const results = await filter.evaluateAll(events);
      expect(results).toHaveLength(3);
      expect(results[0].matched).toBe(true);
      expect(results[1].matched).toBe(false);
      expect(results[2].matched).toBe(true);
    });
  });

  describe('Filter Optimization', () => {
    it('should optimize filters based on cost', () => {
      filter.addFilter({
        name: 'Expensive regex filter',
        expression: {
          type: 'regex',
          patterns: [{ field: 'email', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' }],
          matchType: 'all',
        },
        enabled: true,
        priority: 1, // Lower priority should run later
      });

      filter.addFilter({
        name: 'Simple field filter',
        expression: { type: 'field', field: 'role', operator: 'exists', value: null },
        enabled: true,
        priority: 10, // Higher priority should run first
      });

      filter.optimizeFilters();

      const filters = filter.listFilters();
      expect(filters[0].name).toBe('Simple field filter');
    });
  });

  describe('Statistics', () => {
    it('should track filter statistics', async () => {
      const filterId = filter.addFilter({
        name: 'Test filter',
        expression: { type: 'field', field: 'role', operator: 'eq', value: 'admin' },
        enabled: true,
      });

      await filter.evaluate(testEvent, filterId);
      await filter.evaluate(testEvent, filterId);

      const stats = filter.getStats();
      expect(stats.totalEvaluations).toBe(2);
      expect(stats.totalMatches).toBe(2);
    });
  });

  describe('Caching', () => {
    it('should cache filter results', async () => {
      const filterId = filter.addFilter({
        name: 'Cached filter',
        expression: { type: 'field', field: 'role', operator: 'eq', value: 'admin' },
        enabled: true,
      });

      const result1 = await filter.evaluate(testEvent, filterId, { useCache: true });
      const result2 = await filter.evaluate(testEvent, filterId, { useCache: true });

      expect(result1.matched).toBe(true);
      expect(result2.matched).toBe(true);
    });
  });
});
