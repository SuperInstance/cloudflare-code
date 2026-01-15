import { vi } from 'vitest';
/**
 * Unit Tests for Request Metrics Collector
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RequestMetricsCollector } from '../../packages/edge/src/lib/metrics/request';
import type { RequestMetrics } from '../../packages/edge/src/lib/metrics/types';

describe('RequestMetricsCollector', () => {
  let collector: RequestMetricsCollector;
  let mockKV: KVNamespace;
  let mockR2: R2Bucket;

  beforeEach(() => {
    // Mock KV namespace
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
    } as unknown as KVNamespace;

    // Mock R2 bucket
    mockR2 = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
    } as unknown as R2Bucket;

    collector = new RequestMetricsCollector(mockKV, mockR2);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('record', () => {
    it('should record a request metric', async () => {
      const metric: RequestMetrics = {
        requestId: 'test-req-1',
        timestamp: Date.now(),
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        latency: 1234,
        tokens: { prompt: 100, completion: 50, total: 150 },
        cacheHit: false,
        cost: 0.01,
        success: true,
      };

      await collector.record(metric);

      // Verify metric was recorded
      const recentMetrics = await collector.getRecent(1);
      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0]?.requestId).toBe('test-req-1');
    });

    it('should record multiple metrics', async () => {
      const metrics: RequestMetrics[] = [
        {
          requestId: 'test-req-1',
          timestamp: Date.now(),
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 1234,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: false,
          cost: 0.01,
          success: true,
        },
        {
          requestId: 'test-req-2',
          timestamp: Date.now(),
          provider: 'openai',
          model: 'gpt-4-turbo',
          latency: 567,
          tokens: { prompt: 200, completion: 100, total: 300 },
          cacheHit: true,
          cacheTier: 'warm',
          cost: 0.005,
          success: true,
        },
      ];

      for (const metric of metrics) {
        await collector.record(metric);
      }

      const recentMetrics = await collector.getRecent(1);
      expect(recentMetrics).toHaveLength(2);
    });

    it('should aggregate metrics periodically', async () => {
      // Record multiple metrics for the same provider
      for (let i = 0; i < 10; i++) {
        await collector.record({
          requestId: `test-req-${i}`,
          timestamp: Date.now(),
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 1000 + i * 100,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: false,
          cost: 0.01,
          success: true,
        });
      }

      // Verify aggregation was called
      expect(mockKV.put).toHaveBeenCalled();
    });
  });

  describe('getByTimeRange', () => {
    it('should return metrics within time range', async () => {
      const now = Date.now();
      const metric: RequestMetrics = {
        requestId: 'test-req-1',
        timestamp: now,
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        latency: 1234,
        tokens: { prompt: 100, completion: 50, total: 150 },
        cacheHit: false,
        cost: 0.01,
        success: true,
      };

      await collector.record(metric);

      const metrics = await collector.getByTimeRange(now - 60000, now + 60000);
      expect(metrics).toHaveLength(1);
    });

    it('should filter by provider', async () => {
      const now = Date.now();
      const metrics: RequestMetrics[] = [
        {
          requestId: 'test-req-1',
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 1234,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: false,
          cost: 0.01,
          success: true,
        },
        {
          requestId: 'test-req-2',
          timestamp: now,
          provider: 'openai',
          model: 'gpt-4-turbo',
          latency: 567,
          tokens: { prompt: 200, completion: 100, total: 300 },
          cacheHit: true,
          cost: 0.005,
          success: true,
        },
      ];

      for (const metric of metrics) {
        await collector.record(metric);
      }

      const anthropicMetrics = await collector.getByTimeRange(
        now - 60000,
        now + 60000,
        { provider: 'anthropic' } as any
      );

      expect(anthropicMetrics).toHaveLength(1);
      expect(anthropicMetrics[0]?.provider).toBe('anthropic');
    });

    it('should filter by feature', async () => {
      const now = Date.now();
      const metrics: RequestMetrics[] = [
        {
          requestId: 'test-req-1',
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 1234,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: false,
          cost: 0.01,
          success: true,
          feature: 'code-gen',
        },
        {
          requestId: 'test-req-2',
          timestamp: now,
          provider: 'openai',
          model: 'gpt-4-turbo',
          latency: 567,
          tokens: { prompt: 200, completion: 100, total: 300 },
          cacheHit: true,
          cost: 0.005,
          success: true,
          feature: 'code-review',
        },
      ];

      for (const metric of metrics) {
        await collector.record(metric);
      }

      const codeGenMetrics = await collector.getByTimeRange(
        now - 60000,
        now + 60000,
        { feature: 'code-gen' } as any
      );

      expect(codeGenMetrics).toHaveLength(1);
      expect(codeGenMetrics[0]?.feature).toBe('code-gen');
    });
  });

  describe('getAggregate', () => {
    it('should calculate hourly aggregates', async () => {
      const now = Date.now();
      const metrics: RequestMetrics[] = [
        {
          requestId: 'test-req-1',
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 1000,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: false,
          cost: 0.01,
          success: true,
        },
        {
          requestId: 'test-req-2',
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 2000,
          tokens: { prompt: 200, completion: 100, total: 300 },
          cacheHit: true,
          cost: 0.005,
          success: true,
        },
      ];

      for (const metric of metrics) {
        await collector.record(metric);
      }

      const aggregate = await collector.getAggregate('anthropic', 'hour');

      expect(aggregate.totalRequests).toBe(2);
      expect(aggregate.successfulRequests).toBe(2);
      expect(aggregate.totalTokens).toBe(450);
      expect(aggregate.totalCost).toBe(0.015);
    });

    it('should calculate latency percentiles', async () => {
      const now = Date.now();
      const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

      for (let i = 0; i < latencies.length; i++) {
        await collector.record({
          requestId: `test-req-${i}`,
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: latencies[i] ?? 500,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: false,
          cost: 0.01,
          success: true,
        });
      }

      const aggregate = await collector.getAggregate('anthropic', 'hour');

      expect(aggregate.latency.p50).toBe(500);
      expect(aggregate.latency.p90).toBe(900);
      expect(aggregate.latency.p95).toBe(950);
      expect(aggregate.latency.p99).toBe(990);
    });

    it('should calculate cache hit rate', async () => {
      const now = Date.now();
      const metrics: RequestMetrics[] = [
        {
          requestId: 'test-req-1',
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 1000,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: true,
          cost: 0.005,
          success: true,
        },
        {
          requestId: 'test-req-2',
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 2000,
          tokens: { prompt: 200, completion: 100, total: 300 },
          cacheHit: true,
          cost: 0.005,
          success: true,
        },
        {
          requestId: 'test-req-3',
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 3000,
          tokens: { prompt: 300, completion: 150, total: 450 },
          cacheHit: false,
          cost: 0.03,
          success: true,
        },
      ];

      for (const metric of metrics) {
        await collector.record(metric);
      }

      const aggregate = await collector.getAggregate('anthropic', 'hour');

      expect(aggregate.cacheHits).toBe(2);
      expect(aggregate.cacheMisses).toBe(1);
      expect(aggregate.cacheHitRate).toBeCloseTo(0.666, 2);
    });
  });

  describe('calculateStatistics', () => {
    it('should calculate basic statistics', () => {
      const metrics: RequestMetrics[] = [
        {
          requestId: 'test-req-1',
          timestamp: Date.now(),
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 1000,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: false,
          cost: 0.01,
          success: true,
        },
        {
          requestId: 'test-req-2',
          timestamp: Date.now(),
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 2000,
          tokens: { prompt: 200, completion: 100, total: 300 },
          cacheHit: true,
          cost: 0.005,
          success: true,
        },
        {
          requestId: 'test-req-3',
          timestamp: Date.now(),
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 3000,
          tokens: { prompt: 300, completion: 150, total: 450 },
          cacheHit: false,
          cost: 0.03,
          success: false,
        },
      ];

      const stats = collector.calculateStatistics(metrics);

      expect(stats.count).toBe(3);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
      expect(stats.cacheHitRate).toBeCloseTo(33.33, 1);
      expect(stats.totalTokens).toBe(900);
      expect(stats.totalCost).toBe(0.045);
      expect(stats.avgLatency).toBe(2000);
    });
  });
});
