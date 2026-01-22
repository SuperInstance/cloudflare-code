/**
 * Analytics Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CDNAnalytics } from '../../src/analytics/analytics.js';
import type { CDNEventType } from '../../src/types/index.js';

describe('CDNAnalytics', () => {
  let analytics: CDNAnalytics;

  beforeEach(() => {
    analytics = new CDNAnalytics({
      retentionPeriod: 3600000,
      aggregationInterval: 10000,
      enableRealTime: true,
      enableHistorical: true
    });
  });

  describe('Event Recording', () => {
    it('should record cache hit events', () => {
      analytics.recordCacheHit({
        url: 'https://example.com/test',
        responseTime: 100,
        size: 1024,
        country: 'US'
      });

      const events = analytics.getEvents({ type: 'cache_hit' as CDNEventType });
      expect(events.length).toBe(1);
      expect(events[0].data.url).toBe('https://example.com/test');
    });

    it('should record cache miss events', () => {
      analytics.recordCacheMiss({
        url: 'https://example.com/test',
        responseTime: 200,
        size: 2048,
        country: 'US'
      });

      const events = analytics.getEvents({ type: 'cache_miss' as CDNEventType });
      expect(events.length).toBe(1);
    });

    it('should record purge events', () => {
      analytics.recordPurge({
        type: 'url',
        targets: ['https://example.com/test'],
        duration: 500,
        success: true
      });

      const events = analytics.getEvents({ type: 'purge_complete' as CDNEventType });
      expect(events.length).toBe(1);
    });

    it('should record deployment events', () => {
      analytics.recordDeployment({
        deploymentId: 'deploy-123',
        version: '1.0.0',
        functions: 5,
        assets: 10,
        duration: 30000,
        success: true
      });

      const events = analytics.getEvents({ type: 'deployment_complete' as CDNEventType });
      expect(events.length).toBe(1);
    });

    it('should record error events', () => {
      analytics.recordError({
        error: 'Test error',
        url: 'https://example.com/test'
      });

      const events = analytics.getEvents({ type: 'error' as CDNEventType });
      expect(events.length).toBe(1);
      expect(events[0].severity).toBe('error');
    });

    it('should record security threats', () => {
      analytics.recordThreat({
        type: 'SQL Injection',
        source: '1.2.3.4',
        blocked: true
      });

      const events = analytics.getEvents({ type: 'threat_detected' as CDNEventType });
      expect(events.length).toBe(1);
    });
  });

  describe('Analytics Data', () => {
    it('should get analytics summary', () => {
      analytics.recordCacheHit({
        url: 'https://example.com/test1',
        responseTime: 100,
        size: 1024,
        country: 'US'
      });

      analytics.recordCacheMiss({
        url: 'https://example.com/test2',
        responseTime: 200,
        size: 2048,
        country: 'US'
      });

      const data = analytics.getAnalytics();

      expect(data.requests.cached).toBe(1);
      expect(data.requests.uncached).toBe(1);
      expect(data.bandwidth.cached).toBe(1024);
      expect(data.bandwidth.uncached).toBe(2048);
    });

    it('should track geographical distribution', () => {
      analytics.recordCacheHit({
        url: 'https://example.com/test',
        responseTime: 100,
        size: 1024,
        country: 'US'
      });

      analytics.recordCacheHit({
        url: 'https://example.com/test',
        responseTime: 100,
        size: 1024,
        country: 'GB'
      });

      const geoDist = analytics.getGeographicalDistribution();

      expect(geoDist['US']).toBe(1);
      expect(geoDist['GB']).toBe(1);
    });

    it('should get popular content', () => {
      analytics.recordCacheHit({
        url: 'https://example.com/page1',
        responseTime: 100,
        size: 1024
      });

      analytics.recordCacheHit({
        url: 'https://example.com/page1',
        responseTime: 100,
        size: 1024
      });

      analytics.recordCacheHit({
        url: 'https://example.com/page2',
        responseTime: 100,
        size: 1024
      });

      const popular = analytics.getPopularContent(10);

      expect(popular.length).toBeGreaterThan(0);
      expect(popular[0].path).toBe('/page1');
      expect(popular[0].requests).toBe(2);
    });
  });

  describe('Summary', () => {
    it('should generate summary with correct metrics', () => {
      analytics.recordCacheHit({
        url: 'https://example.com/test',
        responseTime: 100,
        size: 1024
      });

      analytics.recordCacheHit({
        url: 'https://example.com/test',
        responseTime: 100,
        size: 1024
      });

      analytics.recordCacheMiss({
        url: 'https://example.com/test',
        responseTime: 200,
        size: 2048
      });

      const summary = analytics.getSummary();

      expect(summary.requests.total).toBe(3);
      expect(summary.requests.hitRate).toBeCloseTo(66.67, 1);
      expect(summary.bandwidth.total).toBe(4096);
      expect(summary.bandwidth.saved).toBe(2048);
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by type', () => {
      analytics.recordCacheHit({
        url: 'https://example.com/test',
        responseTime: 100,
        size: 1024
      });

      analytics.recordError({
        error: 'Test error',
        url: 'https://example.com/test'
      });

      const cacheEvents = analytics.getEvents({ type: 'cache_hit' as CDNEventType });
      const errorEvents = analytics.getEvents({ type: 'error' as CDNEventType });

      expect(cacheEvents.length).toBe(1);
      expect(errorEvents.length).toBe(1);
    });

    it('should filter events by severity', () => {
      analytics.recordError({
        error: 'Critical error',
        url: 'https://example.com/test'
      });

      analytics.recordCacheHit({
        url: 'https://example.com/test',
        responseTime: 100,
        size: 1024
      });

      const errorEvents = analytics.getEvents({ severity: 'error' });

      expect(errorEvents.length).toBe(1);
    });

    it('should limit event results', () => {
      for (let i = 0; i < 10; i++) {
        analytics.recordCacheHit({
          url: `https://example.com/test${i}`,
          responseTime: 100,
          size: 1024
        });
      }

      const events = analytics.getEvents({ limit: 5 });

      expect(events.length).toBe(5);
    });
  });

  describe('Export', () => {
    it('should export analytics as JSON', () => {
      analytics.recordCacheHit({
        url: 'https://example.com/test',
        responseTime: 100,
        size: 1024
      });

      const exported = analytics.exportAnalytics('json');

      expect(exported).toContain('"requests"');
      expect(exported).toContain('"bandwidth"');
    });

    it('should export analytics as CSV', () => {
      analytics.recordCacheHit({
        url: 'https://example.com/test',
        responseTime: 100,
        size: 1024
      });

      const exported = analytics.exportAnalytics('csv');

      expect(exported).toContain('metric,value');
      expect(exported).toContain('total_requests,1');
    });
  });

  describe('Reset', () => {
    it('should reset all analytics', () => {
      analytics.recordCacheHit({
        url: 'https://example.com/test',
        responseTime: 100,
        size: 1024
      });

      analytics.reset();

      const data = analytics.getAnalytics();
      expect(data.requests.cached).toBe(0);
      expect(data.requests.uncached).toBe(0);
    });
  });
});
