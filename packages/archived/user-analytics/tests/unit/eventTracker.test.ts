/**
 * Unit Tests for Event Tracker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EventTracker,
  EventValidator,
  EventEnricher,
  EventBatcher,
  generateEventId,
  generateSessionId,
  generateAnonymousId,
} from '../../src/events/index.js';
import type { AnalyticsEvent, AnalyticsConfig } from '../../src/types/index.js';

describe('EventValidator', () => {
  let validator: EventValidator;

  beforeEach(() => {
    validator = new EventValidator();
  });

  describe('validate', () => {
    it('should validate a correct event', () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: { path: '/' },
        context: {
          appId: 'test_app',
          platform: 'web',
        },
        timestamp: Date.now(),
      };

      const result = validator.validate(event);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should invalidate event with missing required fields', () => {
      const event = {
        id: 'evt_123',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {},
        timestamp: Date.now(),
      } as any;

      const result = validator.validate(event);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.field === 'sessionId')).toBe(true);
    });

    it('should warn about missing user identification', () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      };

      const result = validator.validate(event);

      expect(result.warnings.some((w) => w.code === 'NO_USER_ID')).toBe(true);
    });

    it('should sanitize future timestamps', () => {
      const futureTime = Date.now() + 10 * 60 * 1000; // 10 minutes in future

      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {
          appId: 'test_app',
        },
        timestamp: futureTime,
      };

      const result = validator.validate(event);

      expect(result.sanitizedEvent).toBeDefined();
      expect(result.sanitizedEvent!.timestamp).toBeLessThan(futureTime);
    });

    it('should detect potential PII in properties', () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'custom',
        eventName: 'form_submit',
        properties: {
          email: 'test@example.com',
        },
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      };

      const result = validator.validate(event);

      expect(result.warnings.some((w) => w.code === 'POTENTIAL_PII')).toBe(true);
    });
  });
});

describe('EventEnricher', () => {
  let enricher: EventEnricher;

  beforeEach(() => {
    enricher = new EventEnricher();
  });

  describe('enrich', () => {
    it('should enrich event with time-based properties', () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      };

      const enriched = enricher.enrich(event);

      expect(enriched.properties).toHaveProperty('hour_of_day');
      expect(enriched.properties).toHaveProperty('day_of_week');
      expect(enriched.properties).toHaveProperty('is_weekend');
      expect(enriched.metadata?.enriched).toBe(true);
    });

    it('should enrich event with campaign parameters from URL', () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'landing',
        properties: {},
        context: {
          appId: 'test_app',
          url: 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale',
        },
        timestamp: Date.now(),
      };

      const enriched = enricher.enrich(event);

      expect(enriched.context.campaign).toBeDefined();
      expect(enriched.context.campaign?.source).toBe('google');
      expect(enriched.context.campaign?.medium).toBe('cpc');
      expect(enriched.context.campaign?.campaign).toBe('spring_sale');
    });

    it('should enrich event with user type', () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        userProperties: {
          subscription: 'premium',
        },
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      };

      const enriched = enricher.enrich(event);

      expect(enriched.properties).toHaveProperty('user_type', 'subscriber');
    });
  });
});

describe('EventBatcher', () => {
  let batcher: EventBatcher;

  beforeEach(() => {
    batcher = new EventBatcher({
      maxBatchSize: 10,
      maxBatchWait: 100,
    });
  });

  describe('add', () => {
    it('should add event to batch', async () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      };

      const batchKey = await batcher.add(event);

      expect(batchKey).toBe('default');
    });

    it('should flush when batch reaches max size', async () => {
      const events: AnalyticsEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `evt_${i}`,
        userId: `user_${i}`,
        sessionId: 'sess_1',
        eventType: 'page_view',
        eventName: 'page',
        properties: {},
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      }));

      let flushCount = 0;
      const flushSpy = jest.spyOn(batcher, 'flush').mockImplementation(async () => {
        flushCount++;
        return null;
      });

      for (const event of events) {
        await batcher.add(event);
      }

      expect(flushCount).toBeGreaterThan(0);
      flushSpy.mockRestore();
    });
  });

  describe('getStats', () => {
    it('should return batch statistics', async () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      };

      await batcher.add(event);
      const stats = batcher.getStats();

      expect(stats.pendingBatches).toBe(1);
      expect(stats.totalEvents).toBe(1);
    });
  });
});

describe('EventTracker', () => {
  let tracker: EventTracker;
  let config: AnalyticsConfig;

  beforeEach(() => {
    config = {
      storage: {
        bindingName: 'DB',
      },
      events: {
        batchSize: 10,
        flushInterval: 5000,
        maxRetries: 3,
        validation: true,
        enrichment: true,
        sampling: 1,
      },
      privacy: {
        gdprEnabled: false,
        ccpaEnabled: false,
        dataRetention: 0,
        anonymizeIp: false,
        hashEmails: false,
        consentRequired: false,
        dataResidency: [],
      },
      realtime: {
        enabled: false,
        windowSize: 0,
        aggregationInterval: 0,
        alertThresholds: [],
      },
      aggregation: {
        enabled: false,
        preAggregation: false,
        materializedViews: false,
        refreshInterval: 0,
        maxQueryTime: 0,
      },
      performance: {
        cacheEnabled: false,
        cacheTTL: 0,
        queryTimeout: 0,
        maxConcurrentQueries: 0,
        indexOptimization: false,
      },
    };

    tracker = new EventTracker(config);
  });

  describe('track', () => {
    it('should track a valid event', async () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      };

      const result = await tracker.track(event);

      expect(result.success).toBe(true);
    });

    it('should fail to track invalid event when validation is enabled', async () => {
      const invalidEvent = {
        id: 'evt_123',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {},
        timestamp: Date.now(),
      } as any;

      const result = await tracker.track(invalidEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should update metrics', async () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      };

      await tracker.track(event);
      const metrics = tracker.getMetrics();

      expect(metrics.totalEvents).toBe(1);
      expect(metrics.validatedEvents).toBe(1);
      expect(metrics.enrichedEvents).toBe(1);
    });
  });

  describe('trackBatch', () => {
    it('should track multiple events', async () => {
      const events: AnalyticsEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `evt_${i}`,
        userId: `user_${i}`,
        sessionId: `sess_${i}`,
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      }));

      const result = await tracker.trackBatch(events);

      expect(result.successful).toBe(5);
      expect(result.failed).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return tracker metrics', async () => {
      const event: AnalyticsEvent = {
        id: 'evt_123',
        userId: 'user_456',
        sessionId: 'sess_789',
        eventType: 'page_view',
        eventName: 'homepage',
        properties: {},
        context: {
          appId: 'test_app',
        },
        timestamp: Date.now(),
      };

      await tracker.track(event);
      const metrics = tracker.getMetrics();

      expect(metrics).toHaveProperty('totalEvents');
      expect(metrics).toHaveProperty('validatedEvents');
      expect(metrics).toHaveProperty('invalidEvents');
      expect(metrics).toHaveProperty('enrichedEvents');
    });
  });
});

describe('ID Generators', () => {
  describe('generateEventId', () => {
    it('should generate unique event IDs', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^evt_/);
    });
  });

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^sess_/);
    });
  });

  describe('generateAnonymousId', () => {
    it('should generate unique anonymous IDs', () => {
      const id1 = generateAnonymousId();
      const id2 = generateAnonymousId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^anon_/);
    });
  });
});
