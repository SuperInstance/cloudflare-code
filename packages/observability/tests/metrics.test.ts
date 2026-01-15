import { MetricCollector } from '../src/metrics/metric-collector';
import { Counter, Gauge, Histogram, Summary } from '../src/metrics/custom-metrics';
import { createTestConfig } from './setup';

describe('Metrics Collector', () => {
  let collector: MetricCollector;
  let config: any;

  beforeEach(async () => {
    config = createTestConfig();
    collector = new MetricCollector();
    await collector.initialize();
  });

  afterEach(async () => {
    await collector.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(collector.initialize()).resolves.not.toThrow();
    });

    it('should register metrics', () => {
      const counter = collector.createCounter('test.counter', { description: 'Test counter' });
      expect(counter).toBeDefined();
    });

    it('should list registered metrics', () => {
      collector.createCounter('test.counter');
      collector.createGauge('test.gauge');

      const metrics = collector.list();
      expect(metrics.length).toBe(2);
      expect(metrics.some(m => m.name === 'test.counter')).toBe(true);
      expect(metrics.some(m => m.name === 'test.gauge')).toBe(true);
    });

    it('should get specific metric', () => {
      collector.createCounter('test.counter');
      const metric = collector.get('test.counter');
      expect(metric).toBeDefined();
    });

    it('should return undefined for non-existent metric', () => {
      const metric = collector.get('non-existent');
      expect(metric).toBeUndefined();
    });
  });

  describe('Counter Metrics', () => {
    it('should create and increment counter', () => {
      const counter = collector.createCounter('test.counter');
      counter.update(5, { tag: 'value1' });
      counter.update(3, { tag: 'value2' });

      // Export to check values
      const exported = collector.export();
      const counterMetric = exported.find(m => m.name === 'test.counter');
      expect(counterMetric).toBeDefined();
    });

    it('should handle counter without labels', () => {
      const counter = collector.createCounter('test.counter');
      counter.update(10);
      counter.update(5);

      const exported = collector.export();
      const counterMetric = exported.find(m => m.name === 'test.counter');
      expect(counterMetric).toBeDefined();
    });

    it('should handle negative counter values', () => {
      const counter = collector.createCounter('test.counter');
      counter.update(-5);

      const exported = collector.export();
      const counterMetric = exported.find(m => m.name === 'test.counter');
      expect(counterMetric).toBeDefined();
    });
  });

  describe('Gauge Metrics', () => {
    it('should create and set gauge', () => {
      const gauge = collector.createGauge('test.gauge');
      gauge.set(42.5, { type: 'temperature' });
      gauge.set(36.2, { type: 'cpu' });

      const exported = collector.export();
      const gaugeMetric = exported.find(m => m.name === 'test.gauge');
      expect(gaugeMetric).toBeDefined();
    });

    it('should update gauge values', () => {
      const gauge = collector.createGauge('test.gauge');
      gauge.set(10);
      gauge.set(20);

      const exported = collector.export();
      const gaugeMetric = exported.find(m => m.name === 'test.gauge');
      expect(gaugeMetric).toBeDefined();
    });

    it('should handle negative gauge values', () => {
      const gauge = collector.createGauge('test.gauge');
      gauge.set(-10);

      const exported = collector.export();
      const gaugeMetric = exported.find(m => m.name === 'test.gauge');
      expect(gaugeMetric).toBeDefined();
    });
  });

  describe('Histogram Metrics', () => {
    it('should create and add histogram values', () => {
      const histogram = collector.createHistogram('test.histogram', {
        buckets: [10, 20, 30, 40, 50]
      });

      histogram.update(15);
      histogram.update(25);
      histogram.update(35);
      histogram.update(45);

      const exported = collector.export();
      const histogramMetric = exported.find(m => m.name === 'test.histogram');
      expect(histogramMetric).toBeDefined();
    });

    it('should calculate histogram percentiles', () => {
      const histogram = collector.createHistogram('test.histogram');

      for (let i = 1; i <= 100; i++) {
        histogram.update(i);
      }

      const exported = collector.export();
      const histogramMetric = exported.find(m => m.name === 'test.histogram');
      expect(histogramMetric).toBeDefined();
    });

    it('should handle large histogram datasets', () => {
      const histogram = collector.createHistogram('test.histogram');

      // Add 1000 values
      for (let i = 0; i < 1000; i++) {
        histogram.update(Math.random() * 100);
      }

      expect(collector.getMetricInfo('test.histogram')).toBeDefined();
    });
  });

  describe('Summary Metrics', () => {
    it('should create and add summary values', () => {
      const summary = collector.createSummary('test.summary');

      summary.update(10);
      summary.update(20);
      summary.update(30);
      summary.update(40);

      const exported = collector.export();
      const summaryMetric = exported.find(m => m.name === 'test.summary');
      expect(summaryMetric).toBeDefined();
    });

    it('should calculate summary percentiles', () => {
      const summary = collector.createSummary('test.summary');

      for (let i = 1; i <= 100; i++) {
        summary.update(i);
      }

      const exported = collector.export();
      const summaryMetric = exported.find(m => m.name === 'test.summary');
      expect(summaryMetric).toBeDefined();
    });
  });

  describe('Metric Management', () => {
    it('should enable/disable metrics', () => {
      collector.createCounter('test.counter');
      collector.setEnabled('test.counter', false);

      expect(collector.isEnabled('test.counter')).toBe(false);

      collector.setEnabled('test.counter', true);
      expect(collector.isEnabled('test.counter')).toBe(true);
    });

    it('should reset all metrics', () => {
      collector.createCounter('test.counter');
      collector.createGauge('test.gauge');

      collector.incrementCounter('test.counter', 10);
      collector.setGauge('test.gauge', 42);

      collector.reset();

      const exported = collector.export();
      expect(exported.length).toBe(0);
    });

    it('should get metric information', () => {
      const options = { description: 'Test metric', unit: 'seconds' };
      collector.createCounter('test.counter', options);

      const info = collector.getMetricInfo('test.counter');
      expect(info).toBeDefined();
      expect(info!.description).toBe('Test metric');
      expect(info!.unit).toBe('seconds');
    });

    it('should provide metric counts', () => {
      collector.createCounter('test.counter');
      collector.createGauge('test.gauge');

      expect(collector.getTotalMetricsCount()).toBe(2);

      collector.createHistogram('test.histogram');
      expect(collector.getTotalMetricsCount()).toBe(3);
    });
  });

  describe('Metric Export', () => {
    it('should export metrics correctly', () => {
      collector.createCounter('test.counter');
      collector.incrementCounter('test.counter', 10);
      collector.incrementCounter('test.counter', 5);

      const exported = collector.export();
      expect(exported.length).toBeGreaterThan(0);
    });

    it('should filter disabled metrics during export', () => {
      collector.createCounter('test.counter');
      collector.createCounter('disabled.counter');

      collector.setEnabled('disabled.counter', false);
      collector.incrementCounter('test.counter', 10);

      const exported = collector.export();
      expect(exported.some(m => m.name === 'test.counter')).toBe(true);
      expect(exported.some(m => m.name === 'disabled.counter')).toBe(false);
    });

    it('should handle export with large datasets', () => {
      collector.createHistogram('test.histogram');

      // Add large number of values
      for (let i = 0; i < 10000; i++) {
        collector.addHistogramValue('test.histogram', Math.random() * 1000);
      }

      const exported = collector.export();
      expect(exported.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent metric updates', async () => {
      collector.createCounter('concurrent.counter');

      const promises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve().then(() => {
          collector.incrementCounter('concurrent.counter', 1);
        }));
      }

      await Promise.all(promises);

      const exported = collector.export();
      const counterMetric = exported.find(m => m.name === 'concurrent.counter');
      expect(counterMetric).toBeDefined();
      expect(counterMetric!.value).toBe(100);
    });

    it('should handle mixed metric types concurrently', async () => {
      collector.createCounter('counter');
      collector.createGauge('gauge');
      collector.createHistogram('histogram');

      const promises: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(Promise.resolve().then(() => {
          collector.incrementCounter('counter', 1);
          collector.setGauge('gauge', i);
          collector.addHistogramValue('histogram', i * 2);
        }));
      }

      await Promise.all(promises);

      const exported = collector.export();
      expect(exported.length).toBeGreaterThan(0);
    });
  });
});

describe('Custom Metrics', () => {
  describe('Counter', () => {
    it('should increment counter', () => {
      const counter = new Counter('test.counter');
      counter.inc(5);
      counter.inc();

      expect(counter.getValue()).toBe(6);
    });

    it('should create counter with labels', () => {
      const counter = new Counter('test.counter', { labels: ['method', 'status'] });
      counter.inc(1, { method: 'get', status: '200' });
      counter.inc(2, { method: 'post', status: '200' });

      expect(counter.getValue()).toBe(3);
    });

    it('should handle negative increments', () => {
      const counter = new Counter('test.counter');
      counter.inc(-5);

      expect(counter.getValue()).toBe(-5);
    });
  });

  describe('Gauge', () => {
    it('should set gauge values', () => {
      const gauge = new Gauge('test.gauge');
      gauge.set(42.5);
      gauge.set(36.2);

      expect(gauge.getValue()).toBe(36.2);
    });

    it('should increment gauge', () => {
      const gauge = new Gauge('test.gauge');
      gauge.inc(5);
      gauge.inc(3);

      expect(gauge.getValue()).toBe(8);
    });

    it('should decrement gauge', () => {
      const gauge = new Gauge('test.gauge');
      gauge.inc(10);
      gauge.dec(3);

      expect(gauge.getValue()).toBe(7);
    });
  });

  describe('Histogram', () => {
    it('should observe histogram values', () => {
      const histogram = new Histogram('test.histogram');
      histogram.observe(10);
      histogram.observe(20);
      histogram.observe(30);

      expect(histogram.getCount()).toBe(3);
    });

    it('should calculate percentiles', () => {
      const histogram = new Histogram('test.histogram');

      for (let i = 1; i <= 100; i++) {
        histogram.observe(i);
      }

      expect(histogram.getPercentile(50)).toBe(50);
      expect(histogram.getPercentile(95)).toBe(95);
      expect(histogram.getPercentile(99)).toBe(99);
    });

    it('should handle histogram buckets', () => {
      const histogram = new Histogram('test.histogram', {
        buckets: [10, 20, 30, 40]
      });

      histogram.observe(15);
      histogram.observe(25);
      histogram.observe(35);
      histogram.observe(5);

      expect(histogram.getSum()).toBe(80);
    });
  });

  describe('Summary', () => {
    it('should observe summary values', () => {
      const summary = new Summary('test.summary');
      summary.observe(10);
      summary.observe(20);
      summary.observe(30);

      expect(summary.getCount()).toBe(3);
      expect(summary.getSum()).toBe(60);
    });

    it('should calculate summary percentiles', () => {
      const summary = new Summary('test.summary');

      for (let i = 1; i <= 100; i++) {
        summary.observe(i);
      }

      expect(summary.getPercentile(50)).toBe(50);
      expect(summary.getPercentile(90)).toBe(90);
    });
  });
});