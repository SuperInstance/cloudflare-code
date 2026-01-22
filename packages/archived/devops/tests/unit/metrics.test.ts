/**
 * Unit tests for metrics collector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../../src/utils/metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({
      service: 'test',
      enabled: true,
    });
  });

  describe('counters', () => {
    it('should increment counter', () => {
      collector.incrementCounter('test.counter', 1);
      expect(collector.getCounter('test.counter')).toBe(1);
    });

    it('should increment counter multiple times', () => {
      collector.incrementCounter('test.counter', 1);
      collector.incrementCounter('test.counter', 2);
      expect(collector.getCounter('test.counter')).toBe(3);
    });

    it('should start at zero for new counters', () => {
      expect(collector.getCounter('new.counter')).toBe(0);
    });

    it('should store labels with counter', () => {
      collector.incrementCounter('test.counter', 1, { env: 'prod' });
      const metrics = collector.getMetrics();
      expect(metrics.counters['test.counter']).toBe(1);
    });
  });

  describe('gauges', () => {
    it('should set gauge value', () => {
      collector.setGauge('test.gauge', 42);
      expect(collector.getGauge('test.gauge')).toBe(42);
    });

    it('should update gauge value', () => {
      collector.setGauge('test.gauge', 42);
      collector.setGauge('test.gauge', 100);
      expect(collector.getGauge('test.gauge')).toBe(100);
    });

    it('should start at zero for new gauges', () => {
      expect(collector.getGauge('new.gauge')).toBe(0);
    });
  });

  describe('histograms', () => {
    it('should record histogram values', () => {
      collector.recordHistogram('test.histogram', 10);
      collector.recordHistogram('test.histogram', 20);
      collector.recordHistogram('test.histogram', 30);

      const stats = collector.getHistogram('test.histogram');
      expect(stats.count).toBe(3);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(30);
      expect(stats.sum).toBe(60);
      expect(stats.avg).toBe(20);
    });

    it('should calculate percentiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      values.forEach((v) => collector.recordHistogram('test.histogram', v));

      const stats = collector.getHistogram('test.histogram');
      expect(stats.p50).toBe(5);
      expect(stats.p95).toBe(10);
      expect(stats.p99).toBe(10);
    });

    it('should handle single value', () => {
      collector.recordHistogram('test.histogram', 42);

      const stats = collector.getHistogram('test.histogram');
      expect(stats.count).toBe(1);
      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.avg).toBe(42);
    });

    it('should return empty stats for new histogram', () => {
      const stats = collector.getHistogram('new.histogram');
      expect(stats.count).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      collector.incrementCounter('test.counter', 5);
      collector.setGauge('test.gauge', 42);
      collector.recordHistogram('test.histogram', 10);
      collector.recordHistogram('test.histogram', 20);
    });

    it('should return all metrics', () => {
      const metrics = collector.getMetrics();

      expect(metrics.counters).toHaveProperty('test.counter');
      expect(metrics.gauges).toHaveProperty('test.gauge');
      expect(metrics.histograms).toHaveProperty('test.histogram');
    });

    it('should include histogram statistics', () => {
      const metrics = collector.getMetrics();
      const histStats = metrics.histograms['test.histogram'];

      expect(histStats.count).toBe(2);
      expect(histStats.min).toBe(10);
      expect(histStats.max).toBe(20);
      expect(histStats.sum).toBe(30);
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      collector.incrementCounter('test.counter', 5);
      collector.setGauge('test.gauge', 42);
      collector.recordHistogram('test.histogram', 10);

      collector.reset();

      expect(collector.getCounter('test.counter')).toBe(0);
      expect(collector.getGauge('test.gauge')).toBe(0);
      expect(collector.getHistogram('test.histogram').count).toBe(0);
    });
  });

  describe('disabled state', () => {
    it('should not record metrics when disabled', () => {
      const disabledCollector = new MetricsCollector({
        service: 'test',
        enabled: false,
      });

      disabledCollector.incrementCounter('test.counter', 5);
      disabledCollector.setGauge('test.gauge', 42);
      disabledCollector.recordHistogram('test.histogram', 10);

      expect(disabledCollector.getCounter('test.counter')).toBe(0);
      expect(disabledCollector.getGauge('test.gauge')).toBe(0);
      expect(disabledCollector.getHistogram('test.histogram').count).toBe(0);
    });
  });
});
