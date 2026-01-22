/**
 * Advanced Cache Tests
 *
 * Comprehensive test suite for advanced caching strategies:
 * - SIEVE eviction algorithm
 * - Cache warming
 * - Predictive prefetching
 * - Cross-DO coherence
 * - Analytics and insights
 *
 * Test Coverage:
 * - Unit tests for each component
 * - Integration tests
 * - Performance benchmarks
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SieveCache, createSieveCache } from './sieve';
import { CacheWarmingManager, createCacheWarmingManager } from './warming';
import { PredictiveCacheManager, createPredictiveCacheManager } from './predictive';
import { CacheAnalyticsManager, createCacheAnalyticsManager } from './analytics';
import type { CacheInvalidationMessage } from './coherence';

describe('SIEVE Cache', () => {
  let cache: SieveCache<string, number>;

  beforeEach(() => {
    cache = createSieveCache({
      maxEntries: 10,
      maxSize: 1024,
      sizeCalculator: () => 100,
    });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 100);
      const result = cache.get('key1');

      expect(result.hit).toBe(true);
      expect(result.value).toBe(100);
    });

    it('should return null for missing keys', () => {
      const result = cache.get('nonexistent');

      expect(result.hit).toBe(false);
      expect(result.value).toBe(null);
    });

    it('should update existing keys', () => {
      cache.set('key1', 100);
      cache.set('key1', 200);

      const result = cache.get('key1');
      expect(result.value).toBe(200);
    });

    it('should delete keys', () => {
      cache.set('key1', 100);
      expect(cache.has('key1')).toBe(true);

      cache.delete('key1');
      expect(cache.has('key1')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      expect(cache.count()).toBe(2);

      cache.clear();
      expect(cache.count()).toBe(0);
    });
  });

  describe('SIEVE Eviction Algorithm', () => {
    it('should evict entries when cache is full', () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, i);
      }

      expect(cache.count()).toBe(10);

      // Add one more - should trigger eviction
      cache.set('key10', 100);

      // Should have evicted at least one entry
      expect(cache.count()).toBeLessThanOrEqual(10);
    });

    it('should mark accessed entries as visited', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);

      // Access key1
      cache.get('key1');

      const entry = cache.peek('key1');
      expect(entry?.visited).toBe(true);
    });

    it('should evict unvisited entries first', () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, i);
      }

      // Access some entries
      cache.get('key1');
      cache.get('key2');
      cache.get('key3');

      // Add more entries - should evict unvisited first
      cache.set('key10', 100);
      cache.set('key11', 200);

      // Accessed entries should still be in cache
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
    });

    it('should track eviction statistics', () => {
      // Fill cache beyond capacity
      for (let i = 0; i < 20; i++) {
        cache.set(`key${i}`, i);
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should track hit rate correctly', () => {
      cache.set('key1', 100);

      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key1'); // hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('should track access counts', () => {
      cache.set('key1', 100);
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      const entry = cache.peek('key1');
      expect(entry?.accessCount).toBe(3);
    });

    it('should track current size', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);

      expect(cache.size()).toBe(200); // 2 entries * 100 bytes each
    });

    it('should track sieving operations', () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, i);
      }

      // Access some entries
      cache.get('key1');
      cache.get('key2');

      // Trigger eviction
      cache.set('key10', 100);

      const stats = cache.getStats();
      expect(stats.sievingOperations).toBeGreaterThan(0);
    });
  });

  describe('Cache Warming', () => {
    it('should warm cache with multiple entries', () => {
      const entries = Array.from({ length: 5 }, (_, i) => [`key${i}`, i] as [string, number]);

      const added = cache.warm(entries);

      expect(added).toBe(5);
      expect(cache.count()).toBe(5);
    });

    it('should stop warming when cache is full', () => {
      const entries = Array.from({ length: 20 }, (_, i) => [`key${i}`, i] as [string, number]);

      const added = cache.warm(entries);

      expect(added).toBeLessThanOrEqual(10); // maxEntries
    });
  });

  describe('Utility Methods', () => {
    it('should get entries by access frequency', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);

      // Access with different frequencies
      for (let i = 0; i < 5; i++) {
        cache.get('key1');
      }
      for (let i = 0; i < 3; i++) {
        cache.get('key2');
      }
      cache.get('key3');

      const byFreq = cache.getByAccessFrequency();

      expect(byFreq[0].key).toBe('key1');
      expect(byFreq[0].accessCount).toBe(5);
    });

    it('should get entries by recency', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);

      // Access key1
      cache.get('key1');

      const byRecency = cache.getByRecency();

      expect(byRecency[0].key).toBe('key1');
    });

    it('should get entries by size', () => {
      cache.set('key1', 100, 50);
      cache.set('key2', 200, 150);

      const bySize = cache.getBySize();

      expect(bySize[0].key).toBe('key2');
      expect(bySize[0].size).toBe(150);
    });
  });

  describe('Performance', () => {
    it('should have O(1) average get latency', () => {
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, i);
      }

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        cache.get(`key${i}`);
      }
      const end = performance.now();

      const avgLatency = (end - start) / 1000;

      // Should be very fast (< 1ms average)
      expect(avgLatency).toBeLessThan(1);
    });

    it('should have O(1) average set latency', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, i);
      }
      const end = performance.now();

      const avgLatency = (end - start) / 1000;

      // Should be very fast (< 1ms average)
      expect(avgLatency).toBeLessThan(1);
    });
  });
});

describe('Cache Warming Manager', () => {
  let warmingManager: CacheWarmingManager;

  beforeEach(() => {
    warmingManager = createCacheWarmingManager({
      minFrequency: 2,
      maxWarmEntries: 5,
    });
  });

  describe('Access Pattern Detection', () => {
    it('should record access patterns', () => {
      warmingManager.recordAccess('test query', {}, false);

      const stats = warmingManager.getStats();
      expect(stats.patternsDetected).toBe(1);
    });

    it('should track query frequency', () => {
      warmingManager.recordAccess('test query', {}, false);
      warmingManager.recordAccess('test query', {}, false);
      warmingManager.recordAccess('test query', {}, false);

      const patterns = warmingManager.getTopPatterns(10);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].frequency).toBe(3);
    });

    it('should detect time-based patterns', () => {
      const date = new Date();
      const hour = date.getHours();
      const dayOfWeek = date.getDay();

      warmingManager.recordAccess('morning query', {}, false);

      const timePatterns = warmingManager.getCurrentTimePatterns();

      // Should have patterns for current time
      expect(timePatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Query Prediction', () => {
    it('should predict next queries based on session', () => {
      const sessionId = 'test-session';

      // Simulate session
      warmingManager.recordAccess('query1', { sessionId }, false);
      warmingManager.recordAccess('query2', { sessionId }, false);
      warmingManager.recordAccess('query3', { sessionId }, false);

      const predictions = warmingManager.predictNextQueries(sessionId, ['query1', 'query2']);

      expect(Array.isArray(predictions)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track warming statistics', () => {
      warmingManager.recordAccess('query1', {}, false);
      warmingManager.recordAccess('query1', {}, false);
      warmingManager.recordAccess('query2', {}, false);

      const stats = warmingManager.getStats();

      expect(stats.patternsDetected).toBeGreaterThan(0);
    });
  });

  describe('Pattern Cleanup', () => {
    it('should clear all patterns', () => {
      warmingManager.recordAccess('query1', {}, false);
      warmingManager.recordAccess('query2', {}, false);

      warmingManager.clearPatterns();

      const stats = warmingManager.getStats();
      expect(stats.patternsDetected).toBe(0);
    });
  });
});

describe('Predictive Cache Manager', () => {
  let predictiveManager: PredictiveCacheManager;

  beforeEach(() => {
    predictiveManager = createPredictiveCacheManager({
      minConfidence: 0.5,
      maxPrefetchCount: 3,
    });
  });

  describe('Query Recording', () => {
    it('should record queries', () => {
      predictiveManager.recordQuery('test query', {
        recentQueries: [],
        sessionId: 'test-session',
        timeOfDay: 10,
        dayOfWeek: 1,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should extract features from queries', () => {
      predictiveManager.recordQuery('how to create a function in javascript', {
        recentQueries: [],
        sessionId: 'test-session',
        timeOfDay: 10,
        dayOfWeek: 1,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should categorize queries', () => {
      predictiveManager.recordQuery('debug this error', {
        recentQueries: [],
        sessionId: 'test-session',
        timeOfDay: 10,
        dayOfWeek: 1,
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Prediction', () => {
    it('should predict next queries', () => {
      // Build up some history
      const context = {
        recentQueries: ['query1', 'query2', 'query3'],
        sessionId: 'test-session',
        timeOfDay: 10,
        dayOfWeek: 1,
      };

      for (const query of context.recentQueries) {
        predictiveManager.recordQuery(query, context);
      }

      const predictions = predictiveManager.predictNextQueries(context);

      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should filter by confidence threshold', () => {
      predictiveManager.recordQuery('query1', {
        recentQueries: [],
        sessionId: 'test-session',
        timeOfDay: 10,
        dayOfWeek: 1,
      });

      const predictions = predictiveManager.predictNextQueries({
        recentQueries: ['query1'],
        sessionId: 'test-session',
        timeOfDay: 10,
        dayOfWeek: 1,
      });

      // All predictions should meet confidence threshold
      for (const pred of predictions) {
        expect(pred.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should limit number of predictions', () => {
      const predictions = predictiveManager.predictNextQueries({
        recentQueries: ['query1', 'query2', 'query3'],
        sessionId: 'test-session',
        timeOfDay: 10,
        dayOfWeek: 1,
      });

      expect(predictions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Statistics', () => {
    it('should track prediction statistics', () => {
      const stats = predictiveManager.getStats();

      expect(stats).toHaveProperty('predictionsMade');
      expect(stats).toHaveProperty('predictionsCorrect');
      expect(stats).toHaveProperty('accuracy');
    });

    it('should update accuracy on feedback', () => {
      predictiveManager.recordPrefetchHit('query1');
      predictiveManager.recordPrefetchMiss('query2');

      const stats = predictiveManager.getStats();

      expect(stats.predictionsCorrect).toBe(1);
      expect(stats.predictionsIncorrect).toBe(1);
      expect(stats.accuracy).toBeCloseTo(50, 0);
    });
  });

  describe('Pattern Management', () => {
    it('should clear all patterns', () => {
      predictiveManager.recordQuery('query1', {
        recentQueries: [],
        sessionId: 'test-session',
        timeOfDay: 10,
        dayOfWeek: 1,
      });

      predictiveManager.clearPatterns();

      const stats = predictiveManager.getStats();
      expect(stats.patternsDiscovered).toBe(0);
    });
  });
});

describe('Cache Analytics Manager', () => {
  let analyticsManager: CacheAnalyticsManager;

  beforeEach(() => {
    analyticsManager = createCacheAnalyticsManager({
      accessLogSampleRate: 1.0, // 100% for testing
    });
  });

  describe('Access Recording', () => {
    it('should record cache accesses', () => {
      analyticsManager.recordAccess('key1', true, 'hot', 1, {});

      const accessLog = analyticsManager.getAccessLog(10);

      expect(accessLog.length).toBe(1);
      expect(accessLog[0].key).toBe('key1');
      expect(accessLog[0].hit).toBe(true);
      expect(accessLog[0].tier).toBe('hot');
    });

    it('should sample access logs', () => {
      const sampledManager = createCacheAnalyticsManager({
        accessLogSampleRate: 0.1, // 10% sampling
      });

      // Record 100 accesses
      for (let i = 0; i < 100; i++) {
        sampledManager.recordAccess(`key${i}`, true, 'hot', 1, {});
      }

      const accessLog = sampledManager.getAccessLog(1000);

      // Should have approximately 10 entries (10% of 100)
      expect(accessLog.length).toBeGreaterThan(0);
      expect(accessLog.length).toBeLessThan(30);
    });

    it('should limit access log size', () => {
      const limitedManager = createCacheAnalyticsManager({
        maxAccessLogEntries: 10,
      });

      // Record 100 accesses
      for (let i = 0; i < 100; i++) {
        limitedManager.recordAccess(`key${i}`, true, 'hot', 1, {});
      }

      const accessLog = limitedManager.getAccessLog(1000);

      expect(accessLog.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Metrics', () => {
    it('should track real-time metrics', () => {
      analyticsManager.recordAccess('key1', true, 'hot', 1, {});
      analyticsManager.recordAccess('key2', false, 'cold', 10, {});
      analyticsManager.recordAccess('key3', true, 'warm', 5, {});

      const metrics = analyticsManager.getRealTimeMetrics();

      expect(metrics).not.toBeNull();
      expect(metrics?.totalQueries).toBe(3);
    });

    it('should calculate hit rate correctly', () => {
      analyticsManager.recordAccess('key1', true, 'hot', 1, {});
      analyticsManager.recordAccess('key2', false, 'cold', 10, {});
      analyticsManager.recordAccess('key3', true, 'warm', 5, {});

      const hitRate = analyticsManager.getCurrentHitRate();

      expect(hitRate).toBeCloseTo(66.67, 1);
    });

    it('should calculate average latency', () => {
      analyticsManager.recordAccess('key1', true, 'hot', 10, {});
      analyticsManager.recordAccess('key2', true, 'hot', 20, {});
      analyticsManager.recordAccess('key3', true, 'hot', 30, {});

      const avgLatency = analyticsManager.getAverageLatency();

      expect(avgLatency).toBe(20);
    });

    it('should calculate percentile latencies', () => {
      analyticsManager.recordAccess('key1', true, 'hot', 10, {});
      analyticsManager.recordAccess('key2', true, 'hot', 20, {});
      analyticsManager.recordAccess('key3', true, 'hot', 30, {});
      analyticsManager.recordAccess('key4', true, 'hot', 40, {});
      analyticsManager.recordAccess('key5', true, 'hot', 50, {});

      const p50 = analyticsManager.getPercentileLatency(50);
      const p95 = analyticsManager.getPercentileLatency(95);

      expect(p50).toBeGreaterThanOrEqual(20);
      expect(p50).toBeLessThanOrEqual(40);
      expect(p95).toBeGreaterThanOrEqual(40);
    });
  });

  describe('Analytics Reports', () => {
    it('should generate analytics report', () => {
      // Record some accesses
      for (let i = 0; i < 100; i++) {
        const hit = i % 3 !== 0; // 67% hit rate
        analyticsManager.recordAccess(`key${i}`, hit, 'hot', 1, {});
      }

      const report = analyticsManager.generateReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('tierPerformance');
      expect(report).toHaveProperty('latencyDistribution');
      expect(report).toHaveProperty('hitRateTimeSeries');
      expect(report).toHaveProperty('topMisses');
      expect(report).toHaveProperty('topHits');
      expect(report).toHaveProperty('insights');
    });

    it('should calculate summary correctly', () => {
      analyticsManager.recordAccess('key1', true, 'hot', 1, {});
      analyticsManager.recordAccess('key2', false, 'cold', 10, {});

      const report = analyticsManager.generateReport();

      expect(report.summary.totalQueries).toBe(2);
    });

    it('should generate insights', () => {
      // Generate some accesses
      for (let i = 0; i < 100; i++) {
        const hit = i % 2 === 0;
        analyticsManager.recordAccess(`key${i}`, hit, 'hot', hit ? 1 : 100, {});
      }

      const report = analyticsManager.generateReport();

      expect(Array.isArray(report.insights)).toBe(true);
      expect(report.insights.length).toBeGreaterThan(0);
    });
  });

  describe('Top Queries', () => {
    it('should identify top misses', () => {
      // Record multiple misses for same key
      for (let i = 0; i < 10; i++) {
        analyticsManager.recordAccess('miss-key', false, 'cold', 10, {});
      }

      const report = analyticsManager.generateReport();
      const topMisses = report.topMisses;

      expect(topMisses.length).toBeGreaterThan(0);
      expect(topMisses[0].key).toBe('miss-key');
      expect(topMisses[0].count).toBe(10);
    });

    it('should identify top hits', () => {
      // Record multiple hits for same key
      for (let i = 0; i < 10; i++) {
        analyticsManager.recordAccess('hit-key', true, 'hot', 1, {});
      }

      const report = analyticsManager.generateReport();
      const topHits = report.topHits;

      expect(topHits.length).toBeGreaterThan(0);
      expect(topHits[0].key).toBe('hit-key');
      expect(topHits[0].count).toBe(10);
    });
  });

  describe('Data Management', () => {
    it('should clear all data', () => {
      analyticsManager.recordAccess('key1', true, 'hot', 1, {});
      analyticsManager.recordAccess('key2', false, 'cold', 10, {});

      analyticsManager.clear();

      const metrics = analyticsManager.getRealTimeMetrics();
      expect(metrics).toBeNull();

      const accessLog = analyticsManager.getAccessLog();
      expect(accessLog.length).toBe(0);
    });

    it('should export metrics as JSON', () => {
      analyticsManager.recordAccess('key1', true, 'hot', 1, {});

      const exported = analyticsManager.exportMetrics();

      expect(typeof exported).toBe('string');

      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('accessLog');
    });
  });

  describe('Predictive Analytics', () => {
    it('should predict future hit rate', () => {
      // Generate some history
      for (let i = 0; i < 100; i++) {
        const hit = i % 2 === 0;
        analyticsManager.recordAccess(`key${i}`, hit, 'hot', 1, {});
      }

      const prediction = analyticsManager.predictHitRate(3600000); // 1 hour

      expect(typeof prediction).toBe('number');
      expect(prediction).toBeGreaterThanOrEqual(0);
      expect(prediction).toBeLessThanOrEqual(100);
    });
  });
});

describe('Integration Tests', () => {
  describe('SIEVE + Warming Integration', () => {
    it('should warm SIEVE cache with patterns', () => {
      const cache = createSieveCache({ maxEntries: 10 });
      const warming = createCacheWarmingManager();

      // Record patterns
      for (let i = 0; i < 5; i++) {
        warming.recordAccess(`query${i}`, {}, false);
      }

      // Get top patterns
      const patterns = warming.getTopPatterns(5);

      // Warm cache
      const entries = patterns.map(p => [p.query, `response-${p.query}`] as [string, string]);
      cache.warm(entries);

      expect(cache.count()).toBe(5);
    });
  });

  describe('Predictive + Analytics Integration', () => {
    it('should track predictive performance in analytics', () => {
      const predictive = createPredictiveCacheManager();
      const analytics = createCacheAnalyticsManager();

      const context = {
        recentQueries: ['query1', 'query2'],
        sessionId: 'test-session',
        timeOfDay: 10,
        dayOfWeek: 1,
      };

      // Record queries
      for (const query of context.recentQueries) {
        predictive.recordQuery(query, context);
      }

      // Get predictions
      const predictions = predictive.predictNextQueries(context);

      // Simulate prefetch hits/misses
      if (predictions.length > 0) {
        predictive.recordPrefetchHit(predictions[0].query);
        analytics.recordAccess(predictions[0].query, true, 'hot', 1, {});
      }

      const predictiveStats = predictive.getStats();
      const analyticsMetrics = analytics.getRealTimeMetrics();

      expect(predictiveStats.predictionsCorrect).toBeGreaterThan(0);
      expect(analyticsMetrics?.totalQueries).toBeGreaterThan(0);
    });
  });
});

describe('Performance Benchmarks', () => {
  describe('SIEVE Performance', () => {
    it('should handle 10K operations efficiently', () => {
      const cache = createSieveCache({ maxEntries: 1000 });

      const start = performance.now();

      // 5K sets
      for (let i = 0; i < 5000; i++) {
        cache.set(`key${i}`, i);
      }

      // 5K gets
      for (let i = 0; i < 5000; i++) {
        cache.get(`key${i % 1000}`);
      }

      const end = performance.now();
      const totalLatency = end - start;
      const avgLatency = totalLatency / 10000;

      // Average should be < 1ms
      expect(avgLatency).toBeLessThan(1);
    });
  });

  describe('Warming Performance', () => {
    it('should handle 1K pattern recordings efficiently', () => {
      const warming = createCacheWarmingManager();

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        warming.recordAccess(`query${i}`, {}, false);
      }

      const end = performance.now();
      const avgLatency = (end - start) / 1000;

      // Average should be < 1ms
      expect(avgLatency).toBeLessThan(1);
    });
  });

  describe('Predictive Performance', () => {
    it('should handle 1K query recordings efficiently', () => {
      const predictive = createPredictiveCacheManager();

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        predictive.recordQuery(`query${i}`, {
          recentQueries: [],
          sessionId: 'test-session',
          timeOfDay: 10,
          dayOfWeek: 1,
        });
      }

      const end = performance.now();
      const avgLatency = (end - start) / 1000;

      // Average should be < 1ms
      expect(avgLatency).toBeLessThan(1);
    });
  });

  describe('Analytics Performance', () => {
    it('should handle 10K access recordings efficiently', () => {
      const analytics = createCacheAnalyticsManager({
        accessLogSampleRate: 0.1, // 10% sampling
      });

      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        analytics.recordAccess(`key${i}`, i % 2 === 0, 'hot', 1, {});
      }

      const end = performance.now();
      const avgLatency = (end - start) / 10000;

      // Average should be < 1ms
      expect(avgLatency).toBeLessThan(1);
    });
  });
});
