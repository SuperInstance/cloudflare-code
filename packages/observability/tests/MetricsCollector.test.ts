import { MetricsCollector, Counter, Gauge, Histogram, Summary } from '../src/metrics/MetricsCollector';
import { ObservableConfig } from '../src/types';

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;
  let config: ObservableConfig;

  beforeEach(() => {
    config = {
      metrics: { enabled: true, exportInterval: 1000 }
    };
    metricsCollector = new MetricsCollector(config);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(metricsCollector.initialize()).resolves.toBeUndefined();
      expect(metricsCollector.isInitialized()).toBe(true);
    });

    it('should export successfully when initialized', async () => {
      await metricsCollector.initialize();
      const result = await metricsCollector.export();

      expect(result.success).toBe(true);
      expect(result.exported).toBeGreaterThanOrEqual(0);
      expect(result.metrics).toEqual({
        counters: 0,
        gauges: 0,
        histograms: 0,
        summaries: 0
      });
    });
  });

  describe('counter metrics', () => {
    it('should create and increment counter', async () => {
      await metricsCollector.initialize();

      const counter = metricsCollector.createCounter({
        name: 'test_counter',
        description: 'Test counter metric'
      });

      expect(counter).toBeInstanceOf(Counter);

      counter.inc(5);
      expect(counter.getValue()).toBe(5);

      counter.add(3);
      expect(counter.getValue()).toBe(8);
    });

    it('should support initial value', async () => {
      await metricsCollector.initialize();

      const counter = metricsCollector.createCounter({
        name: 'test_counter',
        initialValue: 10
      });

      expect(counter.getValue()).toBe(10);
    });

    it('should generate metric data', async () => {
      await metricsCollector.initialize();

      const counter = metricsCollector.createCounter({
        name: 'test_counter',
        labels: { environment: 'test' }
      });

      counter.inc(5);

      const data = counter.getData({ region: 'us-west' });

      expect(data.name).toBe('test_counter');
      expect(data.type).toBe('counter');
      expect(data.value).toBe(5);
      expect(data.labels).toEqual({ environment: 'test', region: 'us-west' });
      expect(data.timestamp).toBeGreaterThan(0);
    });
  });

  describe('gauge metrics', () => {
    it('should create and set gauge', async () => {
      await metricsCollector.initialize();

      const gauge = metricsCollector.createGauge({
        name: 'test_gauge',
        description: 'Test gauge metric'
      });

      expect(gauge).toBeInstanceOf(Gauge);

      gauge.set(42);
      expect(gauge.getValue()).toBe(42);

      gauge.add(10);
      expect(gauge.getValue()).toBe(52);

      gauge.sub(5);
      expect(gauge.getValue()).toBe(47);
    });

    it('should support initial value', async () => {
      await metricsCollector.initialize();

      const gauge = metricsCollector.createGauge({
        name: 'test_gauge',
        initialValue: 100
      });

      expect(gauge.getValue()).toBe(100);
    });
  });

  describe('histogram metrics', () => {
    it('should record values and calculate statistics', async () => {
      await metricsCollector.initialize();

      const histogram = metricsCollector.createHistogram({
        name: 'test_histogram',
        buckets: [10, 20, 30, 40, 50]
      });

      expect(histogram).toBeInstanceOf(Histogram);

      // Record multiple values
      histogram.record(15);
      histogram.record(25);
      histogram.record(35);
      histogram.record(25);
      histogram.record(15);

      const stats = histogram.getStatistics();

      expect(stats.count).toBe(5);
      expect(stats.sum).toBe(115);
      expect(stats.avg).toBe(23);
      expect(stats.min).toBe(15);
      expect(stats.max).toBe(35);
      expect(stats.buckets).toHaveLength(5);
    });

    it('should generate metric data', async () => {
      await metricsCollector.initialize();

      const histogram = metricsCollector.createHistogram({
        name: 'test_histogram'
      });

      histogram.record(10);
      histogram.record(20);

      const data = histogram.getData();

      expect(data.name).toBe('test_histogram');
      expect(data.type).toBe('histogram');
      expect(data.value).toBe(2);
    });
  });

  describe('summary metrics', () => {
    it('should record values and calculate percentiles', async () => {
      await metricsCollector.initialize();

      const summary = metricsCollector.createSummary({
        name: 'test_summary',
        quantiles: [0.5, 0.9, 0.95, 0.99]
      });

      expect(summary).toBeInstanceOf(Summary);

      // Record multiple values
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      values.forEach(value => summary.record(value));

      const stats = summary.getStatistics();

      expect(stats.p50).toBe(55);
      expect(stats.p90).toBe(96);
      expect(stats.p95).toBe(99);
      expect(stats.p99).toBe(100);
    });

    it('should handle empty values', async () => {
      await metricsCollector.initialize();

      const summary = metricsCollector.createSummary({
        name: 'test_summary'
      });

      const stats = summary.getStatistics();

      expect(stats.p50).toBe(0);
      expect(stats.p90).toBe(0);
      expect(stats.p95).toBe(0);
      expect(stats.p99).toBe(0);
    });
  });

  describe('metric management', () => {
    it('should get metric by name', async () => {
      await metricsCollector.initialize();

      const counter = metricsCollector.createCounter({
        name: 'test_counter'
      });

      const retrieved = metricsCollector.getMetric('test_counter');
      expect(retrieved).toBe(counter);
    });

    it('should return null for non-existent metric', async () => {
      await metricsCollector.initialize();

      const retrieved = metricsCollector.getMetric('non_existent');
      expect(retrieved).toBeNull();
    });

    it('should remove metric', async () => {
      await metricsCollector.initialize();

      metricsCollector.createCounter({
        name: 'test_counter'
      });

      expect(metricsCollector.getMetric('test_counter')).not.toBeNull();

      const removed = metricsCollector.removeMetric('test_counter');
      expect(removed).toBe(true);

      expect(metricsCollector.getMetric('test_counter')).toBeNull();
    });

    it('should clear all metrics', async () => {
      await metricsCollector.initialize();

      metricsCollector.createCounter({ name: 'counter1' });
      metricsCollector.createGauge({ name: 'gauge1' });
      metricsCollector.createHistogram({ name: 'histogram1' });
      metricsCollector.createSummary({ name: 'summary1' });

      metricsCollector.clearAllMetrics();

      expect(metricsCollector.getMetric('counter1')).toBeNull();
      expect(metricsCollector.getMetric('gauge1')).toBeNull();
      expect(metricsCollector.getMetric('histogram1')).toBeNull();
      expect(metricsCollector.getMetric('summary1')).toBeNull();
    });

    it('should get metrics count', async () => {
      await metricsCollector.initialize();

      metricsCollector.createCounter({ name: 'counter1' });
      metricsCollector.createCounter({ name: 'counter2' });
      metricsCollector.createGauge({ name: 'gauge1' });

      const counts = metricsCollector.getMetricsCount();

      expect(counts.counters).toBe(2);
      expect(counts.gauges).toBe(1);
      expect(counts.histograms).toBe(0);
      expect(counts.summaries).toBe(0);
      expect(counts.total).toBe(3);
    });
  });

  describe('buffer management', () => {
    it('should flush metrics when buffer is full', async () => {
      jest.useFakeTimers();

      await metricsCollector.initialize();

      // Create multiple metrics to fill buffer
      const counter = metricsCollector.createCounter({ name: 'test_counter' });

      // Simulate many metrics being recorded
      for (let i = 0; i < 1000; i++) {
        counter.inc();
      }

      // Fast-forward timers to trigger flush
      jest.advanceTimersByTime(60000);

      jest.useRealTimers();
    });
  });

  describe('export functionality', () => {
    it('should export metrics data', async () => {
      await metricsCollector.initialize();

      // Create and record some metrics
      const counter = metricsCollector.createCounter({ name: 'test_counter' });
      counter.inc(5);

      const gauge = metricsCollector.createGauge({ name: 'test_gauge' });
      gauge.set(42);

      const result = await metricsCollector.export();

      expect(result.success).toBe(true);
      expect(result.exported).toBeGreaterThan(0);
      expect(result.metrics.counters).toBe(1);
      expect(result.metrics.gauges).toBe(1);
    });
  });
});