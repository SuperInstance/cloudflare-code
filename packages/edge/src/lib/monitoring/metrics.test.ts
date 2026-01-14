/**
 * Tests for Metrics Collector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from './metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({ service: 'test' });
  });

  describe('Counter Metrics', () => {
    it('should create and increment a counter', () => {
      const counter = collector.counter('test_counter', 'A test counter');
      counter(5);
      counter(3);

      expect(collector.getCounter('test_counter')).toBe(8);
    });

    it('should support labeled counters', () => {
      const counter = collector.counter('api_requests', 'API requests', ['method', 'status']);

      counter(1, { method: 'GET', status: '200' });
      counter(1, { method: 'POST', status: '201' });
      counter(2, { method: 'GET', status: '200' });

      expect(collector.getCounter('api_requests', { method: 'GET', status: '200' })).toBe(3);
      expect(collector.getCounter('api_requests', { method: 'POST', status: '201' })).toBe(1);
    });

    it('should default to incrementing by 1', () => {
      const counter = collector.counter('simple_counter', 'Simple counter');
      counter();
      counter();
      counter();

      expect(collector.getCounter('simple_counter')).toBe(3);
    });
  });

  describe('Gauge Metrics', () => {
    it('should create and set a gauge', () => {
      const gauge = collector.gauge('temperature', 'Temperature in Celsius');
      gauge.set(25.5);

      expect(collector.getGauge('temperature')).toBe(25.5);
    });

    it('should support increment and decrement', () => {
      const gauge = collector.gauge('queue_size', 'Queue size');
      gauge.set(10);
      gauge.increment(5);
      gauge.decrement(3);

      expect(collector.getGauge('queue_size')).toBe(12);
    });

    it('should support labeled gauges', () => {
      const gauge = collector.gauge('memory_usage', 'Memory usage', ['instance']);

      gauge.set(100, { instance: 'server1' });
      gauge.set(200, { instance: 'server2' });

      expect(collector.getGauge('memory_usage', { instance: 'server1' })).toBe(100);
      expect(collector.getGauge('memory_usage', { instance: 'server2' })).toBe(200);
    });

    it('should default increment/decrement to 1', () => {
      const gauge = collector.gauge('counter', 'Counter gauge');
      gauge.increment();
      gauge.increment();
      gauge.decrement();

      expect(collector.getGauge('counter')).toBe(1);
    });
  });

  describe('Histogram Metrics', () => {
    it('should record observations and calculate buckets', () => {
      const histogram = collector.histogram('request_duration', 'Request duration', [], [0.1, 0.5, 1.0]);

      histogram(0.05);
      histogram(0.3);
      histogram(0.7);
      histogram(1.5);

      const stats = collector.getHistogramStats('request_duration');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(4);
      expect(stats?.sum).toBe(2.55);
      expect(stats?.avg).toBeCloseTo(0.6375);
    });

    it('should calculate bucket counts correctly', () => {
      const histogram = collector.histogram('latency', 'Latency', [], [1, 5, 10]);

      histogram(0.5);
      histogram(2);
      histogram(7);
      histogram(15);

      const stats = collector.getHistogramStats('latency');
      expect(stats?.buckets['le_1']).toBe(1);
      expect(stats?.buckets['le_5']).toBe(2);
      expect(stats?.buckets['le_10']).toBe(3);
      expect(stats?.buckets['le_+Inf']).toBe(4);
    });

    it('should support labeled histograms', () => {
      const histogram = collector.histogram('response_size', 'Response size', ['endpoint']);

      histogram(100, { endpoint: '/api/users' });
      histogram(200, { endpoint: '/api/users' });
      histogram(50, { endpoint: '/api/posts' });

      const stats1 = collector.getHistogramStats('response_size', { endpoint: '/api/users' });
      const stats2 = collector.getHistogramStats('response_size', { endpoint: '/api/posts' });

      expect(stats1?.count).toBe(2);
      expect(stats2?.count).toBe(1);
    });
  });

  describe('Summary Metrics', () => {
    it('should calculate quantiles', () => {
      const summary = collector.summary('request_size', 'Request size', [], [0.5, 0.9, 0.95, 0.99]);

      for (let i = 1; i <= 100; i++) {
        summary(i);
      }

      const quantiles = collector.getSummaryQuantiles('request_size');
      expect(quantiles).toBeDefined();
      expect(quantiles?.count).toBe(100);
      expect(quantiles?.quantile_0_5).toBeCloseTo(50);
      expect(quantiles?.quantile_0_9).toBeCloseTo(90);
    });

    it('should support window size limit', () => {
      const summary = collector.summary('limited', 'Limited summary', [], [0.5], 5);

      summary(1);
      summary(2);
      summary(3);
      summary(4);
      summary(5);
      summary(6); // Should push out 1

      const quantiles = collector.getSummaryQuantiles('limited');
      expect(quantiles?.count).toBe(5);
    });

    it('should support labeled summaries', () => {
      const summary = collector.summary('duration', 'Duration', ['service']);

      summary(100, { service: 'api' });
      summary(200, { service: 'api' });
      summary(50, { service: 'web' });

      const quantiles1 = collector.getSummaryQuantiles('duration', { service: 'api' });
      const quantiles2 = collector.getSummaryQuantiles('duration', { service: 'web' });

      expect(quantiles1?.count).toBe(2);
      expect(quantiles2?.count).toBe(1);
    });
  });

  describe('Prometheus Export', () => {
    it('should export metrics in Prometheus format', async () => {
      const counter = collector.counter('test_total', 'Test counter');
      counter(42);

      const gauge = collector.gauge('test_value', 'Test gauge');
      gauge.set(3.14);

      const exported = await collector.exportPrometheus();

      expect(exported).toContain('# HELP test_total Test counter');
      expect(exported).toContain('# TYPE test_total counter');
      expect(exported).toContain('test_total{service="test"} 42');
      expect(exported).toContain('# HELP test_value Test gauge');
      expect(exported).toContain('# TYPE test_value gauge');
      expect(exported).toContain('test_value{service="test"} 3.14');
    });

    it('should include labels in Prometheus export', async () => {
      const counter = collector.counter('requests', 'Requests', ['method', 'status']);
      counter(5, { method: 'GET', status: '200' });

      const exported = await collector.exportPrometheus();

      expect(exported).toContain('requests{method="GET",service="test",status="200"} 5');
    });

    it('should export histogram buckets correctly', async () => {
      const histogram = collector.histogram('duration', 'Duration', [], [0.1, 0.5]);
      histogram(0.05);
      histogram(0.3);
      histogram(0.7);

      const exported = await collector.exportPrometheus();

      expect(exported).toContain('duration_bucket{service="test"}le="0.1"} 1');
      expect(exported).toContain('duration_bucket{service="test"}le="0.5"} 2');
      expect(exported).toContain('duration_bucket{service="test"}le="+Inf"} 3');
    });

    it('should export summary quantiles correctly', async () => {
      const summary = collector.summary('size', 'Size', [], [0.5, 0.9]);

      for (let i = 1; i <= 10; i++) {
        summary(i);
      }

      const exported = await collector.exportPrometheus();

      expect(exported).toContain('size{service="test"}quantile="0.5"}');
      expect(exported).toContain('size{service="test"}quantile="0.9"}');
    });
  });

  describe('JSON Export', () => {
    it('should export metrics as JSON', () => {
      const counter = collector.counter('test_total', 'Test counter');
      counter(10);

      const exported = collector.exportJSON();

      expect(exported.counters).toHaveLength(1);
      expect(exported.counters[0].name).toBe('test_total');
      expect(exported.counters[0].value).toBe(10);
      expect(exported.counters[0].type).toBe('counter');
    });

    it('should include all metric types', () => {
      collector.counter('c', 'C')(5);
      collector.gauge('g', 'G').set(10);
      collector.histogram('h', 'H')(1.5);
      collector.summary('s', 'S')(2.5);

      const exported = collector.exportJSON();

      expect(exported.counters).toHaveLength(1);
      expect(exported.gauges).toHaveLength(1);
      expect(exported.histograms).toHaveLength(1);
      expect(exported.summaries).toHaveLength(1);
    });
  });

  describe('Stats and Management', () => {
    it('should calculate statistics correctly', () => {
      collector.counter('c1', 'C1')(5);
      collector.counter('c2', 'C2')(10);
      collector.gauge('g1', 'G1').set(20);
      collector.gauge('g2', 'G2').set(30);

      const stats = collector.getStats();

      expect(stats.totalMetrics).toBe(4);
      expect(stats.counters).toBe(2);
      expect(stats.gauges).toBe(2);
      expect(stats.histograms).toBe(0);
      expect(stats.summaries).toBe(0);
    });

    it('should reset individual metrics', () => {
      const counter = collector.counter('test', 'Test');
      counter(10);
      expect(collector.getCounter('test')).toBe(10);

      collector.reset('test');
      expect(collector.getCounter('test')).toBe(0);
    });

    it('should reset all metrics', () => {
      collector.counter('c1', 'C1')(5);
      collector.counter('c2', 'C2')(10);
      collector.gauge('g1', 'G1').set(20);

      collector.resetAll();

      const stats = collector.getStats();
      expect(stats.totalMetrics).toBe(0);
    });

    it('should track labeled metrics', () => {
      const counter = collector.counter('test', 'Test', ['label']);
      counter(1, { label: 'a' });
      counter(2, { label: 'b' });

      const stats = collector.getStats();
      expect(stats.labeledMetrics).toBeGreaterThan(0);
    });
  });

  describe('Collection Timer', () => {
    it('should start and stop collection timer', () => {
      let callbackCalled = false;

      collector.startCollection(() => {
        callbackCalled = true;
      });

      expect(collectionTimer).toBeDefined();

      collector.stopCollection();

      expect(collectionTimer).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing metrics gracefully', () => {
      expect(collector.getCounter('nonexistent')).toBe(0);
      expect(collector.getGauge('nonexistent')).toBe(0);
      expect(collector.getHistogramStats('nonexistent')).toBeNull();
      expect(collector.getSummaryQuantiles('nonexistent')).toBeNull();
    });

    it('should handle empty label values', () => {
      const counter = collector.counter('test', 'Test');
      counter(5);
      counter(3, {});

      expect(collector.getCounter('test')).toBe(8);
    });

    it('should handle negative gauge values', () => {
      const gauge = collector.gauge('temperature', 'Temperature');
      gauge.set(-10);
      gauge.decrement(5);

      expect(collector.getGauge('temperature')).toBe(-15);
    });

    it('should handle zero histogram buckets', () => {
      const histogram = collector.histogram('test', 'Test', [], []);
      histogram(1.5);

      const stats = collector.getHistogramStats('test');
      expect(stats?.buckets['le_+Inf']).toBe(1);
    });

    it('should handling empty observations', () => {
      const histogram = collector.histogram('test', 'Test');
      const stats = collector.getHistogramStats('test');

      expect(stats?.count).toBe(0);
      expect(stats?.sum).toBe(0);
      expect(stats?.avg).toBe(0);
    });
  });
});
