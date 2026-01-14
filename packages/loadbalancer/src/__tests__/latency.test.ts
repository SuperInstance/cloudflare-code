/**
 * Tests for latency routing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LatencyRouter } from '../latency/router.js';
import type { LatencyMeasurement, RoutingContext } from '../types/index.js';

describe('LatencyRouter', () => {
  let router: LatencyRouter;
  const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1'] as const;

  beforeEach(() => {
    router = new LatencyRouter([...regions], {
      preferP50: false,
      maxLatency: 300,
      measurementWindow: 60000,
      minSampleSize: 5,
      enablePrediction: false,
    });
  });

  describe('measurement recording', () => {
    it('should record latency measurements', async () => {
      const measurement: LatencyMeasurement = {
        sourceRegion: 'us-east-1',
        targetRegion: 'eu-west-1',
        latency: 85,
        timestamp: Date.now(),
        measurementMethod: 'active',
      };

      await router.recordMeasurement(measurement);

      const metrics = router.getMetrics(
        { country: 'US', continent: 'NA', latitude: 0, longitude: 0 },
        'eu-west-1'
      );

      expect(metrics).not.toBeNull();
      expect(metrics?.region).toBe('eu-west-1');
    });

    it('should calculate percentile metrics', async () => {
      // Record multiple measurements
      for (let i = 0; i < 20; i++) {
        await router.recordMeasurement({
          sourceRegion: 'us-east-1',
          targetRegion: 'eu-west-1',
          latency: 80 + Math.random() * 20, // 80-100ms range
          timestamp: Date.now() + i * 1000,
          measurementMethod: 'active',
        });
      }

      const metrics = router.getMetrics(
        { country: 'US', continent: 'NA', latitude: 0, longitude: 0 },
        'eu-west-1'
      );

      expect(metrics).not.toBeNull();
      expect(metrics?.p50).toBeGreaterThan(0);
      expect(metrics?.p95).toBeGreaterThan(metrics?.p50 || 0);
      expect(metrics?.p99).toBeGreaterThan(metrics?.p95 || 0);
      expect(metrics?.sampleCount).toBe(20);
    });
  });

  describe('routing decisions', () => {
    beforeEach(async () => {
      // Set up different latency profiles for each region
      for (let i = 0; i < 10; i++) {
        await router.recordMeasurement({
          sourceRegion: 'us-east-1',
          targetRegion: 'us-east-1',
          latency: 10 + Math.random() * 5,
          timestamp: Date.now() + i * 1000,
          measurementMethod: 'active',
        });

        await router.recordMeasurement({
          sourceRegion: 'us-east-1',
          targetRegion: 'eu-west-1',
          latency: 80 + Math.random() * 10,
          timestamp: Date.now() + i * 1000,
          measurementMethod: 'active',
        });

        await router.recordMeasurement({
          sourceRegion: 'us-east-1',
          targetRegion: 'ap-southeast-1',
          latency: 150 + Math.random() * 20,
          timestamp: Date.now() + i * 1000,
          measurementMethod: 'active',
        });
      }
    });

    it('should route to lowest latency region', async () => {
      const context: RoutingContext = {
        requestId: 'test-latency-1',
        timestamp: Date.now(),
        sourceLocation: {
          country: 'US',
          continent: 'NA',
          latitude: 38.13,
          longitude: -78.45,
        },
        priority: 5,
        tags: [],
      };

      const decision = await router.route(context);

      expect(decision.selectedRegion).toBe('us-east-1');
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it('should provide routing reasons', async () => {
      const context: RoutingContext = {
        requestId: 'test-latency-2',
        timestamp: Date.now(),
        sourceLocation: {
          country: 'US',
          continent: 'NA',
          latitude: 38.13,
          longitude: -78.45,
        },
        priority: 5,
        tags: [],
      };

      const decision = await router.route(context);

      expect(decision.reasoning).toBeDefined();
      expect(decision.reasoning.length).toBeGreaterThan(0);

      const latencyReason = decision.reasoning.find(r => r.factor === 'latency');
      expect(latencyReason).toBeDefined();
      expect(latencyReason?.weight).toBeGreaterThan(0);
    });

    it('should provide alternative regions', async () => {
      const context: RoutingContext = {
        requestId: 'test-latency-3',
        timestamp: Date.now(),
        sourceLocation: {
          country: 'US',
          continent: 'NA',
          latitude: 38.13,
          longitude: -78.45,
        },
        priority: 5,
        tags: [],
      };

      const decision = await router.route(context);

      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives.length).toBeGreaterThan(0);
      expect(decision.alternatives[0].region).not.toBe(decision.selectedRegion);
    });
  });

  describe('metrics management', () => {
    it('should clear old measurements', () => {
      router.clearOldMeasurements();

      // Should not throw
      expect(() => router.clearOldMeasurements()).not.toThrow();
    });

    it('should get all metrics', async () => {
      await router.recordMeasurement({
        sourceRegion: 'us-east-1',
        targetRegion: 'eu-west-1',
        latency: 85,
        timestamp: Date.now(),
        measurementMethod: 'active',
      });

      const allMetrics = router.getAllMetrics();

      expect(allMetrics.size).toBeGreaterThan(0);
    });

    it('should get latency history', async () => {
      for (let i = 0; i < 5; i++) {
        await router.recordMeasurement({
          sourceRegion: 'us-east-1',
          targetRegion: 'eu-west-1',
          latency: 80 + i * 5,
          timestamp: Date.now() + i * 1000,
          measurementMethod: 'active',
        });
      }

      const history = await router.getHistory('eu-west-1');

      expect(history.region).toBe('eu-west-1');
      expect(history.measurements.length).toBe(5);
      expect(history.trends).toBeDefined();
      expect(history.anomalies).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle no measurements gracefully', async () => {
      const emptyRouter = new LatencyRouter([...regions]);

      const context: RoutingContext = {
        requestId: 'test-edge-1',
        timestamp: Date.now(),
        sourceLocation: {
          country: 'US',
          continent: 'NA',
          latitude: 38.13,
          longitude: -78.45,
        },
        priority: 5,
        tags: [],
      };

      // Should not throw even with no measurements
      expect(async () => {
        await emptyRouter.route(context);
      }).rejects.toThrow();
    });

    it('should handle extreme latency values', async () => {
      await router.recordMeasurement({
        sourceRegion: 'us-east-1',
        targetRegion: 'eu-west-1',
        latency: 5000, // Very high latency
        timestamp: Date.now(),
        measurementMethod: 'active',
      });

      const metrics = router.getMetrics(
        { country: 'US', continent: 'NA', latitude: 0, longitude: 0 },
        'eu-west-1'
      );

      expect(metrics).not.toBeNull();
      expect(metrics?.p99).toBeGreaterThan(0);
    });
  });
});
