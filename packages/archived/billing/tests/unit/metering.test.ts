/**
 * Unit tests for metering system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UsageMeter, createUsageMeter } from '../../src/metering/index.js';
import { UsageMetric, UsageMetricType, MeteringConfig } from '../../src/types/index.js';

describe('UsageMeter', () => {
  let meter: UsageMeter;

  beforeEach(() => {
    meter = createUsageMeter({
      enabled: true,
      aggregationWindow: 300,
      retentionPeriod: 90,
      realTimeEnabled: false,
      batchProcessingEnabled: true,
    });
  });

  describe('recordMetric', () => {
    it('should record a single metric', async () => {
      const metric: UsageMetric = {
        type: UsageMetricType.REQUESTS,
        value: 1,
        unit: 'requests',
        timestamp: new Date(),
        userId: 'user123',
        organizationId: 'org123',
      };

      await meter.recordMetric(metric);

      const usage = await meter.getCurrentUsage('org123', UsageMetricType.REQUESTS);
      expect(usage).toBe(1);
    });

    it('should aggregate multiple metrics of same type', async () => {
      const metrics: UsageMetric[] = [
        {
          type: UsageMetricType.REQUESTS,
          value: 5,
          unit: 'requests',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
        {
          type: UsageMetricType.REQUESTS,
          value: 3,
          unit: 'requests',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
      ];

      await meter.recordMetrics(metrics);

      const usage = await meter.getCurrentUsage('org123', UsageMetricType.REQUESTS);
      expect(usage).toBe(8);
    });

    it('should track different metric types separately', async () => {
      const metrics: UsageMetric[] = [
        {
          type: UsageMetricType.REQUESTS,
          value: 10,
          unit: 'requests',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
        {
          type: UsageMetricType.TOKENS,
          value: 1000,
          unit: 'tokens',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
      ];

      await meter.recordMetrics(metrics);

      const requests = await meter.getCurrentUsage('org123', UsageMetricType.REQUESTS);
      const tokens = await meter.getCurrentUsage('org123', UsageMetricType.TOKENS);

      expect(requests).toBe(10);
      expect(tokens).toBe(1000);
    });

    it('should throw error when metering is disabled', async () => {
      const disabledMeter = createUsageMeter({ enabled: false });

      const metric: UsageMetric = {
        type: UsageMetricType.REQUESTS,
        value: 1,
        unit: 'requests',
        timestamp: new Date(),
        userId: 'user123',
        organizationId: 'org123',
      };

      await expect(disabledMeter.recordMetric(metric)).rejects.toThrow('Metering is disabled');
    });
  });

  describe('checkLimit', () => {
    it('should return correct status when under limit', async () => {
      const metric: UsageMetric = {
        type: UsageMetricType.REQUESTS,
        value: 50,
        unit: 'requests',
        timestamp: new Date(),
        userId: 'user123',
        organizationId: 'org123',
      };

      await meter.recordMetric(metric);

      const result = await meter.checkLimit('org123', UsageMetricType.REQUESTS, 100);
      expect(result.exceeds).toBe(false);
      expect(result.current).toBe(50);
      expect(result.remaining).toBe(50);
    });

    it('should return correct status when over limit', async () => {
      const metric: UsageMetric = {
        type: UsageMetricType.REQUESTS,
        value: 150,
        unit: 'requests',
        timestamp: new Date(),
        userId: 'user123',
        organizationId: 'org123',
      };

      await meter.recordMetric(metric);

      const result = await meter.checkLimit('org123', UsageMetricType.REQUESTS, 100);
      expect(result.exceeds).toBe(true);
      expect(result.current).toBe(150);
      expect(result.remaining).toBe(0);
    });

    it('should return correct status at exact limit', async () => {
      const metric: UsageMetric = {
        type: UsageMetricType.REQUESTS,
        value: 100,
        unit: 'requests',
        timestamp: new Date(),
        userId: 'user123',
        organizationId: 'org123',
      };

      await meter.recordMetric(metric);

      const result = await meter.checkLimit('org123', UsageMetricType.REQUESTS, 100);
      expect(result.exceeds).toBe(false);
      expect(result.current).toBe(100);
      expect(result.remaining).toBe(0);
    });
  });

  describe('getUsageSummary', () => {
    it('should return usage for all metric types', async () => {
      const metrics: UsageMetric[] = [
        {
          type: UsageMetricType.REQUESTS,
          value: 100,
          unit: 'requests',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
        {
          type: UsageMetricType.TOKENS,
          value: 10000,
          unit: 'tokens',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
        {
          type: UsageMetricType.API_CALLS,
          value: 50,
          unit: 'calls',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
      ];

      await meter.recordMetrics(metrics);

      const summary = await meter.getUsageSummary('org123');

      expect(summary[UsageMetricType.REQUESTS]).toBe(100);
      expect(summary[UsageMetricType.TOKENS]).toBe(10000);
      expect(summary[UsageMetricType.API_CALLS]).toBe(50);
    });
  });

  describe('resetUsage', () => {
    it('should reset specific metric type', async () => {
      const metrics: UsageMetric[] = [
        {
          type: UsageMetricType.REQUESTS,
          value: 100,
          unit: 'requests',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
        {
          type: UsageMetricType.TOKENS,
          value: 10000,
          unit: 'tokens',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
      ];

      await meter.recordMetrics(metrics);
      await meter.resetUsage('org123', UsageMetricType.REQUESTS);

      const requests = await meter.getCurrentUsage('org123', UsageMetricType.REQUESTS);
      const tokens = await meter.getCurrentUsage('org123', UsageMetricType.TOKENS);

      expect(requests).toBe(0);
      expect(tokens).toBe(10000);
    });

    it('should reset all usage for organization', async () => {
      const metrics: UsageMetric[] = [
        {
          type: UsageMetricType.REQUESTS,
          value: 100,
          unit: 'requests',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
        {
          type: UsageMetricType.TOKENS,
          value: 10000,
          unit: 'tokens',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
      ];

      await meter.recordMetrics(metrics);
      await meter.resetAllUsage('org123');

      const requests = await meter.getCurrentUsage('org123', UsageMetricType.REQUESTS);
      const tokens = await meter.getCurrentUsage('org123', UsageMetricType.TOKENS);

      expect(requests).toBe(0);
      expect(tokens).toBe(0);
    });
  });

  describe('flushBuffers', () => {
    it('should flush buffer for specific key', async () => {
      const metric: UsageMetric = {
        type: UsageMetricType.REQUESTS,
        value: 1,
        unit: 'requests',
        timestamp: new Date(),
        userId: 'user123',
        organizationId: 'org123',
      };

      await meter.recordMetric(metric);

      const bufferSizeBefore = meter.getBufferSize('org123:user123');
      expect(bufferSizeBefore).toBeGreaterThan(0);

      await meter.flushBuffer('org123:user123');

      const bufferSizeAfter = meter.getBufferSize('org123:user123');
      expect(bufferSizeAfter).toBe(0);
    });

    it('should flush all buffers', async () => {
      const metrics: UsageMetric[] = [
        {
          type: UsageMetricType.REQUESTS,
          value: 1,
          unit: 'requests',
          timestamp: new Date(),
          userId: 'user123',
          organizationId: 'org123',
        },
        {
          type: UsageMetricType.REQUESTS,
          value: 1,
          unit: 'requests',
          timestamp: new Date(),
          userId: 'user456',
          organizationId: 'org456',
        },
      ];

      await meter.recordMetrics(metrics);

      const totalBufferSizeBefore = meter.getBufferSize();
      expect(totalBufferSizeBefore).toBeGreaterThan(0);

      await meter.flushAllBuffers();

      const totalBufferSizeAfter = meter.getBufferSize();
      expect(totalBufferSizeAfter).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      meter.updateConfig({ enabled: false });
      const config = meter.getConfig();

      expect(config.enabled).toBe(false);
    });

    it('should get current configuration', () => {
      const config = meter.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.aggregationWindow).toBe(300);
      expect(config.retentionPeriod).toBe(90);
    });
  });
});
