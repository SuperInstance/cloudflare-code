import { vi } from 'vitest';
/**
 * Integration Tests for Metrics System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RequestMetricsCollector } from '../../packages/edge/src/lib/metrics/request';
import { ProviderMetricsCollector } from '../../packages/edge/src/lib/metrics/provider';
import { CacheMetricsCollector } from '../../packages/edge/src/lib/metrics/cache';
import { MetricsAggregator } from '../../packages/edge/src/lib/metrics/aggregator';
import type { RequestMetrics } from '../../packages/edge/src/lib/metrics/types';

describe('Metrics System Integration', () => {
  let requestCollector: RequestMetricsCollector;
  let providerCollector: ProviderMetricsCollector;
  let cacheCollector: CacheMetricsCollector;
  let aggregator: MetricsAggregator;
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

    requestCollector = new RequestMetricsCollector(mockKV, mockR2);
    providerCollector = new ProviderMetricsCollector(mockKV, mockR2);
    cacheCollector = new CacheMetricsCollector(mockKV, mockR2);
    aggregator = new MetricsAggregator(
      requestCollector,
      providerCollector,
      cacheCollector
    );
  });

  describe('End-to-End Metrics Flow', () => {
    it('should track complete request lifecycle', async () => {
      const now = Date.now();

      // Simulate a cache miss
      cacheCollector.recordMiss('warm', 50);

      // Record provider request
      providerCollector.recordSuccess('anthropic', 1234, 150);

      // Record request metrics
      const requestMetric: RequestMetrics = {
        requestId: 'integration-test-1',
        timestamp: now,
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        latency: 1234,
        tokens: { prompt: 100, completion: 50, total: 150 },
        cacheHit: false,
        cost: 0.01,
        success: true,
        feature: 'code-gen',
      };

      await requestCollector.record(requestMetric);

      // Verify request was recorded
      const recentMetrics = await requestCollector.getRecent(1);
      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0]?.requestId).toBe('integration-test-1');

      // Verify cache metrics
      const cacheMetrics = await cacheCollector.getOverallMetrics();
      expect(cacheMetrics.totalRequests).toBe(1);
      expect(cacheMetrics.totalMisses).toBe(1);

      // Verify provider metrics
      const providerStatus = await providerCollector.getProviderStatus('anthropic');
      expect(providerStatus).toBeDefined();
      expect(providerStatus?.provider).toBe('anthropic');
    });

    it('should handle cache hits correctly', async () => {
      const now = Date.now();

      // Simulate a cache hit
      cacheCollector.recordHit('hot', 5); // Very fast from hot tier

      // Record request metrics with cache hit
      const requestMetric: RequestMetrics = {
        requestId: 'integration-test-2',
        timestamp: now,
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        latency: 5,
        tokens: { prompt: 100, completion: 50, total: 150 },
        cacheHit: true,
        cacheTier: 'hot',
        cost: 0, // No cost for cache hits
        success: true,
        feature: 'code-gen',
      };

      await requestCollector.record(requestMetric);

      // Verify cache metrics
      const cacheMetrics = await cacheCollector.getOverallMetrics();
      expect(cacheMetrics.totalHits).toBe(1);
      expect(cacheMetrics.hitRate).toBe(1);

      // Verify cache savings
      const savings = await cacheCollector.getSavings();
      expect(savings.tokensSaved).toBeGreaterThan(0);
      expect(savings.costSaved).toBeGreaterThan(0);
    });

    it('should aggregate metrics for dashboard', async () => {
      const now = Date.now();

      // Record multiple requests
      const requests: RequestMetrics[] = [
        {
          requestId: 'dash-test-1',
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
          requestId: 'dash-test-2',
          timestamp: now,
          provider: 'openai',
          model: 'gpt-4-turbo',
          latency: 567,
          tokens: { prompt: 200, completion: 100, total: 300 },
          cacheHit: true,
          cacheTier: 'warm',
          cost: 0.005,
          success: true,
          feature: 'code-review',
        },
        {
          requestId: 'dash-test-3',
          timestamp: now,
          provider: 'groq',
          model: 'llama-3.3-70b',
          latency: 234,
          tokens: { prompt: 150, completion: 75, total: 225 },
          cacheHit: false,
          cost: 0.002,
          success: true,
          feature: 'docs',
        },
      ];

      for (const request of requests) {
        await requestCollector.record(request);

        // Update provider metrics
        providerCollector.recordSuccess(request.provider, request.latency, request.tokens.total);

        // Update cache metrics
        if (request.cacheHit) {
          cacheCollector.recordHit(request.cacheTier!, request.latency);
        } else {
          cacheCollector.recordMiss('warm', request.latency);
        }
      }

      // Get dashboard data
      const dashboardData = await aggregator.getDashboardData('hour');

      expect(dashboardData.overview.totalRequests).toBe(3);
      expect(dashboardData.overview.totalCost).toBeCloseTo(0.017, 3);
      expect(Object.keys(dashboardData.costByProvider)).toHaveLength(3);
      expect(Object.keys(dashboardData.costByFeature)).toHaveLength(3);
    });

    it('should detect cost anomalies', async () => {
      const now = Date.now();

      // Record normal requests
      for (let i = 0; i < 10; i++) {
        await requestCollector.record({
          requestId: `normal-${i}`,
          timestamp: now - 3600000, // 1 hour ago
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 1000,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: false,
          cost: 0.01,
          success: true,
        });
      }

      // Record expensive requests (2x normal cost)
      for (let i = 0; i < 10; i++) {
        await requestCollector.record({
          requestId: `expensive-${i}`,
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-opus',
          latency: 2000,
          tokens: { prompt: 200, completion: 100, total: 300 },
          cacheHit: false,
          cost: 0.10, // 10x normal cost
          success: true,
        });
      }

      // Detect anomalies
      const anomalies = await aggregator.detectAnomalies();

      // Should detect cost spike
      const costAnomaly = anomalies.find((a) => a.type === 'cost_spike');
      expect(costAnomaly).toBeDefined();
      expect(costAnomaly?.severity).toBe('critical');
    });

    it('should calculate cost savings', async () => {
      const now = Date.now();

      // Record requests with and without cache hits
      const requests: RequestMetrics[] = [
        // Cache hits (cheaper)
        {
          requestId: 'cache-hit-1',
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 10,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: true,
          cacheTier: 'hot',
          cost: 0,
          success: true,
        },
        {
          requestId: 'cache-hit-2',
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 10,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: true,
          cacheTier: 'warm',
          cost: 0,
          success: true,
        },
        // Cache misses (full cost)
        {
          requestId: 'cache-miss-1',
          timestamp: now,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          latency: 1000,
          tokens: { prompt: 100, completion: 50, total: 150 },
          cacheHit: false,
          cost: 0.01,
          success: true,
        },
      ];

      for (const request of requests) {
        await requestCollector.record(request);

        if (request.cacheHit) {
          cacheCollector.recordHit(request.cacheTier!, request.latency);
        } else {
          cacheCollector.recordMiss('warm', request.latency);
        }
      }

      // Calculate savings
      const savings = await aggregator.calculateSavings('hour');

      expect(savings.totalSavings).toBeGreaterThan(0);
      expect(savings.cacheSavings.amount).toBeGreaterThan(0);
      expect(savings.cacheSavings.tokensSaved).toBeGreaterThan(0);
    });

    it('should generate cost forecast', async () => {
      const now = Date.now();

      // Record historical data with increasing trend
      for (let day = 0; day < 7; day++) {
        const dayTimestamp = now - (7 - day) * 24 * 60 * 60 * 1000;
        const dailyCost = 1.0 + day * 0.2; // Increasing trend

        for (let i = 0; i < 100; i++) {
          await requestCollector.record({
            requestId: `forecast-${day}-${i}`,
            timestamp: dayTimestamp + i * 1000,
            provider: 'anthropic',
            model: 'claude-3-sonnet',
            latency: 1000,
            tokens: { prompt: 100, completion: 50, total: 150 },
            cacheHit: false,
            cost: dailyCost / 100,
            success: true,
          });
        }
      }

      // Generate forecast
      const forecast = await aggregator.generateForecast(now, 'day');

      expect(forecast.nextDay).toBeGreaterThan(0);
      expect(forecast.nextHour).toBeGreaterThan(0);
      expect(forecast.nextWeek).toBeGreaterThan(0);
      expect(forecast.confidence).toBeGreaterThan(0);
      expect(forecast.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Prometheus Metrics Format', () => {
    it('should generate valid Prometheus metrics', async () => {
      const now = Date.now();

      // Record some metrics
      await requestCollector.record({
        requestId: 'prometheus-test-1',
        timestamp: now,
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        latency: 1234,
        tokens: { prompt: 100, completion: 50, total: 150 },
        cacheHit: false,
        cost: 0.01,
        success: true,
      });

      // Get Prometheus metrics
      const prometheusMetrics = await aggregator.getPrometheusMetrics();

      // Verify format
      expect(prometheusMetrics).toContain('# HELP');
      expect(prometheusMetrics).toContain('# TYPE');
      expect(prometheusMetrics).toContain('requests_total');
      expect(prometheusMetrics).toContain('request_success_rate');
      expect(prometheusMetrics).toContain('cost_total_dollars');
      expect(prometheusMetrics).toContain('tokens_total');
    });

    it('should include cache metrics in Prometheus format', async () => {
      // Record cache activity
      cacheCollector.recordHit('hot', 5);
      cacheCollector.recordMiss('warm', 50);

      const cacheMetrics = await cacheCollector.getPrometheusMetrics();

      expect(cacheMetrics).toContain('cache_hit_rate');
      expect(cacheMetrics).toContain('cache_requests_total');
      expect(cacheMetrics).toContain('cache_latency_seconds');
      expect(cacheMetrics).toContain('cache_size_bytes');
    });
  });

  describe('Multi-Tier Storage', () => {
    it('should store recent metrics in HOT tier', async () => {
      const now = Date.now();

      await requestCollector.record({
        requestId: 'hot-tier-test',
        timestamp: now,
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        latency: 1234,
        tokens: { prompt: 100, completion: 50, total: 150 },
        cacheHit: false,
        cost: 0.01,
        success: true,
      });

      const recentMetrics = await requestCollector.getRecent(1);
      expect(recentMetrics).toHaveLength(1);
    });

    it('should aggregate to WARM tier', async () => {
      const now = Date.now();

      // Record multiple metrics
      for (let i = 0; i < 10; i++) {
        await requestCollector.record({
          requestId: `warm-tier-${i}`,
          timestamp: now,
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

  describe('Provider Rankings', () => {
    it('should rank providers by cost', async () => {
      // Record provider metrics
      const providers = [
        { name: 'groq', cost: 0.05 },
        { name: 'cerebras', cost: 0.10 },
        { name: 'anthropic', cost: 0.15 },
      ];

      for (const provider of providers) {
        await providerCollector.record(provider.name, {
          provider: provider.name,
          timestamp: Date.now(),
          health: 'healthy',
          latency: { p50: 100, p95: 200, p99: 300 },
          successRate: 99,
          requestsPerMinute: 10,
          tokensPerSecond: 100,
          quotaUsed: 100,
          quotaTotal: 10000,
          costPer1KTokens: { input: provider.cost, output: provider.cost * 2 },
        });
      }

      const ranking = await providerCollector.getCostRanking();

      expect(ranking[0]?.provider).toBe('groq');
      expect(ranking[0]?.rank).toBe(1);
      expect(ranking[2]?.provider).toBe('anthropic');
      expect(ranking[2]?.rank).toBe(3);
    });
  });
});
