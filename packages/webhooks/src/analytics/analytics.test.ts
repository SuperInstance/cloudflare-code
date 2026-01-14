/**
 * Tests for Webhook Analytics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookAnalytics, AnalyticsUtils } from './analytics.js';
import { MemoryAnalyticsStorage } from '../storage/memory.js';
import { WebhookEventType, WebhookDeliveryStatus } from '../types/webhook.js';

describe('WebhookAnalytics', () => {
  let analytics: WebhookAnalytics;
  let storage: MemoryAnalyticsStorage;

  const config: any = {
    environment: 'test',
    monitoring: {
      enabled: true,
      exportIntervalMs: 60000,
      alerts: {
        failureRateThreshold: 0.05,
        latencyThresholdMs: 5000,
        queueSizeThreshold: 5000,
      },
    },
  };

  beforeEach(() => {
    storage = new MemoryAnalyticsStorage();
    analytics = new WebhookAnalytics(config, storage);
  });

  describe('Recording Deliveries', () => {
    it('should record delivery events', async () => {
      const delivery = {
        id: 'delivery-1',
        webhookId: 'webhook-1',
        eventType: WebhookEventType.CODE_PUSH,
        eventId: 'event-1',
        payload: { test: 'data' },
        status: 'success' as WebhookDeliveryStatus,
        attemptNumber: 1,
        maxAttempts: 3,
        duration: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await analytics.recordDelivery(delivery);

      expect(analytics.getBufferSize()).toBe(1);
    });

    it('should flush delivery buffer', async () => {
      for (let i = 0; i < 100; i++) {
        await analytics.recordDelivery({
          id: `delivery-${i}`,
          webhookId: 'webhook-1',
          eventType: WebhookEventType.CODE_PUSH,
          eventId: `event-${i}`,
          payload: { test: 'data' },
          status: 'success' as WebhookDeliveryStatus,
          attemptNumber: 1,
          maxAttempts: 3,
          duration: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      expect(analytics.getBufferSize()).toBe(100);

      await analytics.flushDeliveryBuffer();

      expect(analytics.getBufferSize()).toBe(0);
    });
  });

  describe('Real-time Metrics', () => {
    it('should calculate real-time metrics', async () => {
      for (let i = 0; i < 10; i++) {
        await analytics.recordDelivery({
          id: `delivery-${i}`,
          webhookId: 'webhook-1',
          eventType: WebhookEventType.CODE_PUSH,
          eventId: `event-${i}`,
          payload: { test: 'data' },
          status: i < 8 ? ('success' as WebhookDeliveryStatus) : ('failed' as WebhookDeliveryStatus),
          attemptNumber: 1,
          maxAttempts: 3,
          duration: 100 + i * 50,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const metrics = await analytics.getRealTimeMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.successRate).toBe(0.8); // 8 out of 10
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Alert Management', () => {
    it('should add alert condition', () => {
      const alert = analytics.addAlertCondition({
        name: 'Test Alert',
        type: 'failure_rate',
        threshold: 0.1,
        windowMinutes: 5,
        enabled: true,
      });

      expect(alert.id).toBeDefined();
      expect(alert.name).toBe('Test Alert');
    });

    it('should update alert condition', () => {
      const alert = analytics.addAlertCondition({
        name: 'Test Alert',
        type: 'failure_rate',
        threshold: 0.1,
        windowMinutes: 5,
        enabled: true,
      });

      const updated = analytics.updateAlertCondition(alert.id, {
        threshold: 0.2,
      });

      expect(updated).toBeDefined();
      expect(updated!.threshold).toBe(0.2);
    });

    it('should remove alert condition', () => {
      const alert = analytics.addAlertCondition({
        name: 'Test Alert',
        type: 'failure_rate',
        threshold: 0.1,
        windowMinutes: 5,
        enabled: true,
      });

      const removed = analytics.removeAlertCondition(alert.id);

      expect(removed).toBe(true);
    });

    it('should get alert conditions', () => {
      analytics.addAlertCondition({
        name: 'Alert 1',
        type: 'failure_rate',
        threshold: 0.1,
        windowMinutes: 5,
        enabled: true,
      });

      analytics.addAlertCondition({
        name: 'Alert 2',
        type: 'latency',
        threshold: 5000,
        windowMinutes: 5,
        enabled: true,
      });

      const conditions = analytics.getAlertConditions();

      expect(conditions).toHaveLength(2);
    });
  });

  describe('Alert Checking', () => {
    it('should trigger alert when threshold exceeded', async () => {
      analytics.addAlertCondition({
        name: 'High Failure Rate',
        type: 'failure_rate',
        threshold: 0.5,
        windowMinutes: 5,
        enabled: true,
      });

      // Record failed deliveries
      for (let i = 0; i < 10; i++) {
        await analytics.recordDelivery({
          id: `delivery-${i}`,
          webhookId: 'webhook-1',
          eventType: WebhookEventType.CODE_PUSH,
          eventId: `event-${i}`,
          payload: { test: 'data' },
          status: 'failed' as WebhookDeliveryStatus,
          attemptNumber: 1,
          maxAttempts: 3,
          duration: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const triggered = await analytics.checkAlerts();

      expect(triggered.length).toBeGreaterThan(0);
      expect(triggered[0].conditionName).toBe('High Failure Rate');
    });
  });

  describe('Report Generation', () => {
    it('should generate analytics report', async () => {
      // Record some deliveries
      for (let i = 0; i < 20; i++) {
        await analytics.recordDelivery({
          id: `delivery-${i}`,
          webhookId: 'webhook-1',
          eventType: WebhookEventType.CODE_PUSH,
          eventId: `event-${i}`,
          payload: { test: 'data' },
          status: i < 18 ? ('success' as WebhookDeliveryStatus) : ('failed' as WebhookDeliveryStatus),
          attemptNumber: 1,
          maxAttempts: 3,
          duration: 100 + i * 10,
          createdAt: new Date(Date.now() - i * 60000),
          updatedAt: new Date(),
        });
      }

      const period = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
        granularity: 'hour' as const,
      };

      const report = await analytics.generateReport('webhook-1', period);

      expect(report.summary).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.timeSeries).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });
});

describe('AnalyticsUtils', () => {
  describe('Moving Average', () => {
    it('should calculate moving average', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const window = 3;

      const result = AnalyticsUtils.movingAverage(data, window);

      expect(result[0]).toBe(1);
      expect(result[1]).toBe(1.5);
      expect(result[2]).toBe(2);
      expect(result[9]).toBe(9);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect anomalies in time series', () => {
      const data = [10, 12, 11, 13, 10, 100, 12, 11, 13, 10];

      const anomalies = AnalyticsUtils.detectAnomalies(data, 2);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].index).toBe(5);
      expect(anomalies[0].value).toBe(100);
    });
  });

  describe('Trend Calculation', () => {
    it('should detect upward trend', () => {
      const data = [10, 12, 14, 16, 18, 20];

      const trend = AnalyticsUtils.calculateTrend(data);

      expect(trend).toBe('up');
    });

    it('should detect downward trend', () => {
      const data = [20, 18, 16, 14, 12, 10];

      const trend = AnalyticsUtils.calculateTrend(data);

      expect(trend).toBe('down');
    });

    it('should detect stable trend', () => {
      const data = [10, 11, 10, 11, 10, 11];

      const trend = AnalyticsUtils.calculateTrend(data);

      expect(trend).toBe('stable');
    });
  });
});
