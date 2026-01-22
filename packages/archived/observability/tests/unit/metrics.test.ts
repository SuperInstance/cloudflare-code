/**
 * Unit tests for metrics collection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MetricsCollector,
  MetricCounter,
  MetricGauge,
  MetricHistogram,
  MetricRegistry,
  type CounterOptions,
  type GaugeOptions,
  type HistogramOptions,
} from '../../src/metrics/collector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector('test-service');
  });

  afterEach(async () => {
    await collector.shutdown();
  });

  describe('Counter Metrics', () => {
    it('should create and increment counter', () => {
      const options: CounterOptions = {
        name: 'test_counter',
        description: 'A test counter',
      };
      
      const counter = collector.counter(options);
      expect(counter).toBeInstanceOf(MetricCounter);
      
      counter.increment(1);
      counter.increment(5);
      
      expect(counter.getValue()).toBe(6);
    });

    it('should decrement counter', () => {
      const counter = collector.counter({
        name: 'test_counter',
      });
      
      counter.increment(10);
      counter.decrement(3);
      
      expect(counter.getValue()).toBe(7);
    });

    it('should calculate rate', () => {
      const counter = collector.counter({
        name: 'test_counter',
      });
      
      for (let i = 0; i < 100; i++) {
        counter.increment(1);
      }
      
      const rate = counter.getRate(undefined, 60000);
      expect(rate).toBeGreaterThan(0);
    });

    it('should reset counter', () => {
      const counter = collector.counter({
        name: 'test_counter',
      });
      
      counter.increment(10);
      counter.reset();
      
      expect(counter.getValue()).toBe(0);
    });
  });

  describe('Gauge Metrics', () => {
    it('should create and set gauge', () => {
      const options: GaugeOptions = {
        name: 'test_gauge',
        description: 'A test gauge',
        initialValue: 5,
      };
      
      const gauge = collector.gauge(options);
      expect(gauge).toBeInstanceOf(MetricGauge);
      expect(gauge.getValue()).toBe(5);
      
      gauge.set(10);
      expect(gauge.getValue()).toBe(10);
    });

    it('should increment and decrement gauge', () => {
      const gauge = collector.gauge({
        name: 'test_gauge',
        initialValue: 10,
      });
      
      gauge.increment(5);
      expect(gauge.getValue()).toBe(15);
      
      gauge.decrement(3);
      expect(gauge.getValue()).toBe(12);
    });

    it('should keep history of values', () => {
      const gauge = collector.gauge({
        name: 'test_gauge',
      });
      
      gauge.set(10);
      gauge.set(20);
      gauge.set(30);
      
      const history = gauge.getHistory(undefined, 60000);
      expect(history.length).toBe(3);
      expect(history[2].value).toBe(30);
    });
  });

  describe('Histogram Metrics', () => {
    it('should create and record histogram values', () => {
      const options: HistogramOptions = {
        name: 'test_histogram',
        description: 'A test histogram',
        buckets: [1, 5, 10, 50, 100],
      };
      
      const histogram = collector.histogram(options);
      expect(histogram).toBeInstanceOf(MetricHistogram);
      
      histogram.record(2);
      histogram.record(7);
      histogram.record(15);
      histogram.record(50);
    });

    it('should calculate percentiles', () => {
      const histogram = collector.histogram({
        name: 'test_histogram',
      });
      
      for (let i = 1; i <= 100; i++) {
        histogram.record(i);
      }
      
      const percentiles = histogram.getPercentiles();
      expect(percentiles.p50).toBeCloseTo(50, 5);
      expect(percentiles.p90).toBeCloseTo(90, 5);
      expect(percentiles.p95).toBeCloseTo(95, 5);
      expect(percentiles.p99).toBeCloseTo(99, 5);
    });

    it('should calculate average', () => {
      const histogram = collector.histogram({
        name: 'test_histogram',
      });
      
      histogram.record(10);
      histogram.record(20);
      histogram.record(30);
      
      const avg = histogram.getAverage();
      expect(avg).toBe(20);
    });

    it('should get bucket counts', () => {
      const histogram = collector.histogram({
        name: 'test_histogram',
        buckets: [1, 5, 10],
      });
      
      histogram.record(0.5);
      histogram.record(2);
      histogram.record(7);
      histogram.record(15);
      
      const counts = histogram.getBucketCounts();
      expect(counts['le_1']).toBe(1);
      expect(counts['le_5']).toBe(2);
      expect(counts['le_10']).toBe(3);
      expect(counts['le_+Inf']).toBe(4);
    });
  });

  describe('Metric Collection', () => {
    it('should collect all metrics', () => {
      collector.counter({ name: 'counter1' });
      collector.gauge({ name: 'gauge1' });
      collector.histogram({ name: 'histogram1' });
      
      const metrics = collector.getAllMetrics();
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should export metrics in Prometheus format', async () => {
      collector.counter({ name: 'test_counter' });
      
      const result = await collector.export({
        format: 'prometheus',
      });
      
      expect(result.success).toBe(true);
      expect(result.exported).toBeGreaterThan(0);
    });

    it('should export metrics in JSON format', async () => {
      collector.counter({ name: 'test_counter' });
      
      const result = await collector.export({
        format: 'json',
      });
      
      expect(result.success).toBe(true);
      expect(result.exported).toBeGreaterThan(0);
    });
  });

  describe('Metric Management', () => {
    it('should get metric by name', () => {
      const counter = collector.counter({
        name: 'test_counter',
      });
      
      const retrieved = collector.getMetric('test_counter');
      expect(retrieved).toBe(counter);
    });

    it('should get all metric names', () => {
      collector.counter({ name: 'counter1' });
      collector.gauge({ name: 'gauge1' });
      collector.histogram({ name: 'histogram1' });
      
      const names = collector.getMetricNames();
      expect(names).toContain('counter1');
      expect(names).toContain('gauge1');
      expect(names).toContain('histogram1');
    });

    it('should remove metric', () => {
      collector.counter({ name: 'test_counter' });
      
      const removed = collector.removeMetric('test_counter');
      expect(removed).toBe(true);
      
      const retrieved = collector.getMetric('test_counter');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Collector Configuration', () => {
    it('should enable and disable collection', () => {
      expect(collector.isEnabled()).toBe(true);
      
      collector.setEnabled(false);
      expect(collector.isEnabled()).toBe(false);
      
      collector.setEnabled(true);
      expect(collector.isEnabled()).toBe(true);
    });

    it('should set aggregation window', () => {
      collector.setAggregationWindow({
        duration: 60000,
        alignTo: 0,
      });
    });
  });
});

describe('MetricRegistry', () => {
  afterEach(() => {
    MetricRegistry.clear();
  });

  it('should create singleton collectors', () => {
    const collector1 = MetricRegistry.get('service1');
    const collector2 = MetricRegistry.get('service1');
    
    expect(collector1).toBe(collector2);
  });

  it('should create different collectors for different services', () => {
    const collector1 = MetricRegistry.get('service1');
    const collector2 = MetricRegistry.get('service2');
    
    expect(collector1).not.toBe(collector2);
  });

  it('should track collector count', () => {
    MetricRegistry.get('service1');
    MetricRegistry.get('service2');
    MetricRegistry.get('service3');
    
    expect(MetricRegistry.size()).toBe(3);
  });

  it('should delete collectors', () => {
    MetricRegistry.get('service1');
    
    const deleted = MetricRegistry.delete('service1');
    expect(deleted).toBe(true);
    expect(MetricRegistry.has('service1')).toBe(false);
  });
});
