/**
 * Tests for Rate Limit Analytics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RateLimitAnalytics,
  createRateLimitAnalytics,
} from './analytics';
import type { RateLimitEvent, RateLimitScope, SubscriptionTier } from './types';

describe('RateLimitAnalytics', () => {
  let analytics: RateLimitAnalytics;

  beforeEach(() => {
    analytics = new RateLimitAnalytics({
      enablePersistence: false,
      maxEvents: 1000,
    });
  });

  describe('Event Recording', () => {
    it('should record allow event', async () => {
      const event: RateLimitEvent = {
        timestamp: Date.now(),
        type: 'allow',
        scope: 'user',
        identifier: 'user1',
        tier: 'free',
        endpoint: '/api/chat',
        decision: {
          allowed: true,
          remaining: 59,
          limit: 60,
          resetTime: Date.now() + 60000,
          resetIn: 60000,
          currentUsage: 1,
        },
      };

      await analytics.recordEvent(event);

      const events = analytics['events'];
      expect(events.length).toBe(1);
      expect(events[0].allowed).toBe(true);
    });

    it('should record block event', async () => {
      const event: RateLimitEvent = {
        timestamp: Date.now(),
        type: 'block',
        scope: 'user',
        identifier: 'user1',
        tier: 'free',
        endpoint: '/api/chat',
        decision: {
          allowed: false,
          remaining: 0,
          limit: 60,
          resetTime: Date.now() + 60000,
          resetIn: 60000,
          currentUsage: 60,
          retryAfter: 60,
        },
      };

      await analytics.recordEvent(event);

      const events = analytics['events'];
      expect(events.length).toBe(1);
      expect(events[0].allowed).toBe(false);
    });

    it('should trim events when exceeding max', async () => {
      const smallAnalytics = new RateLimitAnalytics({
        maxEvents: 10,
      });

      // Add 15 events
      for (let i = 0; i < 15; i++) {
        await smallAnalytics.recordEvent({
          timestamp: Date.now() + i,
          type: 'allow',
          scope: 'user',
          identifier: `user${i}`,
          tier: 'free',
        });
      }

      const events = smallAnalytics['events'];
      expect(events.length).toBe(10);
    });
  });

  describe('Analytics Generation', () => {
    beforeEach(async () => {
      // Add sample events
      for (let i = 0; i < 100; i++) {
        await analytics.recordEvent({
          timestamp: Date.now() - 3600000 + i * 36000, // Spread over 1 hour
          type: i < 90 ? 'allow' : 'block',
          scope: 'user',
          identifier: i % 5 === 0 ? 'user0' : `user${i}`,
          tier: 'free',
          endpoint: '/api/chat',
          decision: {
            allowed: i < 90,
            remaining: Math.max(0, 60 - i),
            limit: 60,
            resetTime: Date.now() + 60000,
            resetIn: 60000,
            currentUsage: i,
          },
        });
      }
    });

    it('should generate analytics summary', async () => {
      const start = Date.now() - 3600000;
      const end = Date.now();

      const summary = await analytics.getAnalytics(start, end);

      expect(summary.totalRequests).toBe(100);
      expect(summary.blockedRequests).toBe(10);
      expect(summary.blockRate).toBe(10);
    });

    it('should identify top blocked identifiers', async () => {
      const start = Date.now() - 3600000;
      const end = Date.now();

      const analyticsData = await analytics.getAnalytics(start, end);

      expect(analyticsData.topBlocked.length).toBeGreaterThan(0);
      expect(analyticsData.topBlocked[0].identifier).toBeDefined();
      expect(analyticsData.topBlocked[0].count).toBeGreaterThan(0);
    });

    it('should group by tier', async () => {
      // Add events for different tiers
      await analytics.recordEvent({
        timestamp: Date.now(),
        type: 'allow',
        scope: 'user',
        identifier: 'pro-user',
        tier: 'pro',
      });

      const start = Date.now() - 3600000;
      const end = Date.now();

      const analyticsData = await analytics.getAnalytics(start, end);

      expect(analyticsData.requestsByTier.length).toBeGreaterThan(0);
    });

    it('should group by scope', async () => {
      const start = Date.now() - 3600000;
      const end = Date.now();

      const analyticsData = await analytics.getAnalytics(start, end);

      expect(analyticsData.requestsByScope.length).toBeGreaterThan(0);
      expect(analyticsData.requestsByScope[0].scope).toBeDefined();
    });

    it('should group by endpoint', async () => {
      const start = Date.now() - 3600000;
      const end = Date.now();

      const analyticsData = await analytics.getAnalytics(start, end);

      expect(analyticsData.requestsByEndpoint.length).toBeGreaterThan(0);
      expect(analyticsData.requestsByEndpoint[0].endpoint).toBeDefined();
    });

    it('should calculate peak usage', async () => {
      const start = Date.now() - 3600000;
      const end = Date.now();

      const analyticsData = await analytics.getAnalytics(start, end);

      expect(analyticsData.peakRPS).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      for (let i = 0; i < 50; i++) {
        await analytics.recordEvent({
          timestamp: Date.now() - 3600000 + i * 72000,
          type: 'allow',
          scope: 'user',
          identifier: 'user1',
          tier: 'free',
          endpoint: '/api/chat',
          decision: {
            allowed: true,
            remaining: 60 - i,
            limit: 60,
            resetTime: Date.now() + 60000,
            resetIn: 60000,
            currentUsage: i,
          },
        });
      }
    });

    it('should get stats for identifier', async () => {
      const stats = await analytics.getStats('user1');

      expect(stats).not.toBeNull();
      expect(stats?.totalRequests).toBe(50);
      expect(stats?.allowedRequests).toBe(50);
      expect(stats?.blockedRequests).toBe(0);
    });

    it('should calculate allow rate', async () => {
      const stats = await analytics.getStats('user1');

      expect(stats?.allowRate).toBe(100);
    });

    it('should calculate requests per minute', async () => {
      const stats = await analytics.getStats('user1');

      expect(stats?.requestsPerMinute).toBeGreaterThan(0);
    });
  });

  describe('Top Blocked', () => {
    it('should return top blocked identifiers', async () => {
      // Add events with multiple blocks for same user
      for (let i = 0; i < 10; i++) {
        await analytics.recordEvent({
          timestamp: Date.now() + i,
          type: 'block',
          scope: 'user',
          identifier: 'blocked-user',
          tier: 'free',
        });
      }

      const topBlocked = analytics.getTopBlocked(10);

      expect(topBlocked.length).toBeGreaterThan(0);
      expect(topBlocked[0].identifier).toBe('blocked-user');
      expect(topBlocked[0].count).toBe(10);
    });

    it('should filter by time window', async () => {
      // Add old event
      await analytics.recordEvent({
        timestamp: Date.now() - 7200000, // 2 hours ago
        type: 'block',
        scope: 'user',
        identifier: 'old-user',
        tier: 'free',
      });

      // Add recent event
      await analytics.recordEvent({
        timestamp: Date.now(),
        type: 'block',
        scope: 'user',
        identifier: 'recent-user',
        tier: 'free',
      });

      const topBlocked = analytics.getTopBlocked(10, 3600000); // Last hour

      expect(topBlocked.find(u => u.identifier === 'recent-user')).toBeDefined();
      expect(topBlocked.find(u => u.identifier === 'old-user')).toBeUndefined();
    });
  });

  describe('Usage by Tier', () => {
    it('should return usage by tier', async () => {
      await analytics.recordEvent({
        timestamp: Date.now(),
        type: 'allow',
        scope: 'user',
        identifier: 'free-user',
        tier: 'free',
      });

      await analytics.recordEvent({
        timestamp: Date.now(),
        type: 'allow',
        scope: 'user',
        identifier: 'pro-user',
        tier: 'pro',
      });

      const usageByTier = await analytics.getUsageByTier();

      expect(usageByTier.length).toBeGreaterThan(0);
      expect(usageByTier.find(u => u.tier === 'free')).toBeDefined();
      expect(usageByTier.find(u => u.tier === 'pro')).toBeDefined();
    });
  });

  describe('Usage by Endpoint', () => {
    it('should return usage by endpoint', async () => {
      await analytics.recordEvent({
        timestamp: Date.now(),
        type: 'allow',
        scope: 'user',
        identifier: 'user1',
        tier: 'free',
        endpoint: '/api/chat',
      });

      await analytics.recordEvent({
        timestamp: Date.now(),
        type: 'block',
        scope: 'user',
        identifier: 'user2',
        tier: 'free',
        endpoint: '/api/chat',
      });

      const usageByEndpoint = await analytics.getUsageByEndpoint();

      expect(usageByEndpoint.length).toBeGreaterThan(0);
      expect(usageByEndpoint[0].endpoint).toBeDefined();
      expect(usageByEndpoint[0].requests).toBeGreaterThan(0);
    });
  });

  describe('Time Series', () => {
    it('should generate hourly time series', async () => {
      const start = Date.now() - 3600000;
      const end = Date.now();

      const timeSeries = await analytics.getTimeSeries(start, end, 'hour');

      expect(timeSeries.length).toBeGreaterThan(0);
      expect(timeSeries[0].timestamp).toBeDefined();
      expect(timeSeries[0].requests).toBeGreaterThanOrEqual(0);
    });

    it('should generate minute time series', async () => {
      const start = Date.now() - 60000;
      const end = Date.now();

      const timeSeries = await analytics.getTimeSeries(start, end, 'minute');

      expect(timeSeries.length).toBeGreaterThan(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive report', async () => {
      await analytics.recordEvent({
        timestamp: Date.now(),
        type: 'allow',
        scope: 'user',
        identifier: 'user1',
        tier: 'free',
        endpoint: '/api/chat',
      });

      const report = await analytics.generateReport();

      expect(report.summary).toBeDefined();
      expect(report.topEndpoints).toBeDefined();
      expect(report.topBlocked).toBeDefined();
      expect(report.tierDistribution).toBeDefined();
      expect(report.timeSeries).toBeDefined();
    });

    it('should generate report for custom time window', async () => {
      const start = Date.now() - 86400000; // 24 hours
      const end = Date.now();

      const report = await analytics.generateReport(start, end);

      expect(report.summary.windowStart).toBe(start);
      expect(report.summary.windowEnd).toBe(end);
    });
  });

  describe('Cleanup', () => {
    it('should clean up old events', async () => {
      // Add old event
      await analytics.recordEvent({
        timestamp: Date.now() - 86400000, // 1 day ago
        type: 'allow',
        scope: 'user',
        identifier: 'old-user',
        tier: 'free',
      });

      await analytics.cleanup(3600000); // Keep only last hour

      const events = analytics['events'];
      expect(events.length).toBe(0);
    });
  });

  describe('Export', () => {
    it('should export data as JSON', async () => {
      await analytics.recordEvent({
        timestamp: Date.now(),
        type: 'allow',
        scope: 'user',
        identifier: 'user1',
        tier: 'free',
      });

      const json = await analytics.exportData('json');
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('should export data as CSV', async () => {
      await analytics.recordEvent({
        timestamp: Date.now(),
        type: 'allow',
        scope: 'user',
        identifier: 'user1',
        tier: 'free',
      });

      const csv = await analytics.exportData('csv');
      const lines = csv.split('\n');

      expect(lines.length).toBeGreaterThan(1); // Header + at least one data row
      expect(lines[0]).toContain('timestamp');
    });
  });
});

describe('createRateLimitAnalytics', () => {
  it('should create analytics with default options', () => {
    const analytics = createRateLimitAnalytics();
    expect(analytics).toBeInstanceOf(RateLimitAnalytics);
  });

  it('should create analytics with custom options', () => {
    const analytics = createRateLimitAnalytics({
      maxEvents: 500,
      aggregationWindow: 'day',
    });

    expect(analytics).toBeInstanceOf(RateLimitAnalytics);
  });
});
