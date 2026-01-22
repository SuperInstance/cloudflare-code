/**
 * Regression Detection Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaselineManager, RegressionDetector } from '../src/index.js';
import type { PerformanceBaseline, BenchmarkResult, LoadTestResult } from '../src/types/index.js';

describe('BaselineManager', () => {
  let manager: BaselineManager;

  beforeEach(() => {
    manager = new BaselineManager({
      storagePath: './test-baselines',
      retainCount: 10,
      autoSave: false, // Disable auto-save for tests
    });
  });

  describe('Baseline Creation', () => {
    it('should create a baseline', async () => {
      const benchmarks: BenchmarkResult[] = [
        {
          name: 'test-bench',
          suite: 'test',
          iterations: 1000,
          totalTime: 100,
          avgTime: 0.1,
          minTime: 0.05,
          maxTime: 0.2,
          stdDev: 0.05,
          percentile95: 0.15,
          percentile99: 0.18,
          opsPerSecond: 10000,
          samples: [],
          metrics: {} as any,
          timestamp: Date.now(),
        },
      ];

      const loadTests: LoadTestResult[] = [];

      const baseline = await manager.createBaseline(
        'test',
        benchmarks,
        loadTests,
        { commit: 'abc123' }
      );

      expect(baseline.name).toBe('test');
      expect(baseline.benchmarks.length).toBe(1);
      expect(baseline.commit).toBe('abc123');
      expect(baseline.timestamp).toBeGreaterThan(0);
    });

    it('should extract metrics from results', async () => {
      const benchmarks: BenchmarkResult[] = [
        {
          name: 'fast-bench',
          suite: 'test',
          iterations: 1000,
          totalTime: 100,
          avgTime: 0.1,
          minTime: 0.05,
          maxTime: 0.2,
          stdDev: 0.05,
          percentile95: 0.15,
          percentile99: 0.18,
          opsPerSecond: 10000,
          samples: [],
          metrics: {} as any,
          timestamp: Date.now(),
        },
      ];

      const loadTests: LoadTestResult[] = [];

      const baseline = await manager.createBaseline(
        'test',
        benchmarks,
        loadTests
      );

      expect(baseline.metrics['benchmark.fast-bench.avgTime']).toBe(0.1);
      expect(baseline.metrics['benchmark.fast-bench.opsPerSecond']).toBe(10000);
    });
  });

  describe('Baseline Retrieval', () => {
    it('should get latest baseline', async () => {
      const benchmarks: BenchmarkResult[] = [
        {
          name: 'test',
          suite: 'test',
          iterations: 1000,
          totalTime: 100,
          avgTime: 0.1,
          minTime: 0.05,
          maxTime: 0.2,
          stdDev: 0.05,
          percentile95: 0.15,
          percentile99: 0.18,
          opsPerSecond: 10000,
          samples: [],
          metrics: {} as any,
          timestamp: Date.now(),
        },
      ];

      await manager.createBaseline('test', benchmarks, []);

      const baseline = manager.getBaseline('test');

      expect(baseline).toBeDefined();
      expect(baseline?.name).toBe('test');
    });

    it('should return undefined for non-existent baseline', () => {
      const baseline = manager.getBaseline('non-existent');

      expect(baseline).toBeUndefined();
    });

    it('should get all baselines for a name', async () => {
      const benchmarks: BenchmarkResult[] = [
        {
          name: 'test',
          suite: 'test',
          iterations: 1000,
          totalTime: 100,
          avgTime: 0.1,
          minTime: 0.05,
          maxTime: 0.2,
          stdDev: 0.05,
          percentile95: 0.15,
          percentile99: 0.18,
          opsPerSecond: 10000,
          samples: [],
          metrics: {} as any,
          timestamp: Date.now(),
        },
      ];

      await manager.createBaseline('test', benchmarks, []);
      await manager.createBaseline('test', benchmarks, []);

      const baselines = manager.getBaselines('test');

      expect(baselines.length).toBe(2);
    });
  });

  describe('Baseline Comparison', () => {
    it('should compare two baselines', async () => {
      const benchmarks1: BenchmarkResult[] = [
        {
          name: 'test',
          suite: 'test',
          iterations: 1000,
          totalTime: 100,
          avgTime: 0.1,
          minTime: 0.05,
          maxTime: 0.2,
          stdDev: 0.05,
          percentile95: 0.15,
          percentile99: 0.18,
          opsPerSecond: 10000,
          samples: [],
          metrics: {} as any,
          timestamp: 1000,
        },
      ];

      const benchmarks2: BenchmarkResult[] = [
        {
          name: 'test',
          suite: 'test',
          iterations: 1000,
          totalTime: 100,
          avgTime: 0.15, // Slower
          minTime: 0.05,
          maxTime: 0.25,
          stdDev: 0.05,
          percentile95: 0.2,
          percentile99: 0.23,
          opsPerSecond: 6666,
          samples: [],
          metrics: {} as any,
          timestamp: 2000,
        },
      ];

      await manager.createBaseline('test', benchmarks1, []);
      await manager.createBaseline('test', benchmarks2, []);

      const comparison = manager.compareBaselines('test', 1000, 2000);

      expect(comparison).toBeDefined();
      expect(comparison?.comparisons.length).toBeGreaterThan(0);
    });

    it('should return undefined for non-existent comparison', () => {
      const comparison = manager.compareBaselines('test', 1000, 2000);

      expect(comparison).toBeUndefined();
    });
  });

  describe('Trend Analysis', () => {
    it('should get trend data for a metric', async () => {
      const benchmarks1: BenchmarkResult[] = [
        {
          name: 'test',
          suite: 'test',
          iterations: 1000,
          totalTime: 100,
          avgTime: 0.1,
          minTime: 0.05,
          maxTime: 0.2,
          stdDev: 0.05,
          percentile95: 0.15,
          percentile99: 0.18,
          opsPerSecond: 10000,
          samples: [],
          metrics: {} as any,
          timestamp: 1000,
        },
      ];

      const benchmarks2: BenchmarkResult[] = [
        {
          name: 'test',
          suite: 'test',
          iterations: 1000,
          totalTime: 100,
          avgTime: 0.15, // Slower
          minTime: 0.05,
          maxTime: 0.25,
          stdDev: 0.05,
          percentile95: 0.2,
          percentile99: 0.23,
          opsPerSecond: 6666,
          samples: [],
          metrics: {} as any,
          timestamp: 2000,
        },
      ];

      await manager.createBaseline('test', benchmarks1, []);
      await manager.createBaseline('test', benchmarks2, []);

      const trend = manager.getTrend('test', 'benchmark.test.avgTime');

      expect(trend).toBeDefined();
      expect(trend?.points.length).toBe(2);
      expect(trend?.change).toBeGreaterThan(0); // Increased (worse)
      expect(trend?.direction).toBe('increasing');
    });

    it('should return undefined for non-existent metric', async () => {
      const benchmarks: BenchmarkResult[] = [
        {
          name: 'test',
          suite: 'test',
          iterations: 1000,
          totalTime: 100,
          avgTime: 0.1,
          minTime: 0.05,
          maxTime: 0.2,
          stdDev: 0.05,
          percentile95: 0.15,
          percentile99: 0.18,
          opsPerSecond: 10000,
          samples: [],
          metrics: {} as any,
          timestamp: Date.now(),
        },
      ];

      await manager.createBaseline('test', benchmarks, []);

      const trend = manager.getTrend('test', 'non-existent.metric');

      expect(trend).toBeUndefined();
    });
  });

  describe('Export/Import', () => {
    it('should export baseline to JSON', async () => {
      const benchmarks: BenchmarkResult[] = [
        {
          name: 'test',
          suite: 'test',
          iterations: 1000,
          totalTime: 100,
          avgTime: 0.1,
          minTime: 0.05,
          maxTime: 0.2,
          stdDev: 0.05,
          percentile95: 0.15,
          percentile99: 0.18,
          opsPerSecond: 10000,
          samples: [],
          metrics: {} as any,
          timestamp: Date.now(),
        },
      ];

      await manager.createBaseline('test', benchmarks, []);

      const exported = manager.exportBaseline('test');

      expect(exported).toBeDefined();
      expect(() => JSON.parse(exported!)).not.toThrow();
    });

    it('should import baseline from JSON', async () => {
      const baselineJson = JSON.stringify({
        name: 'imported',
        timestamp: Date.now(),
        metrics: { 'metric1': 100 },
        benchmarks: [],
        loadTests: [],
      });

      const imported = await manager.importBaseline('test', baselineJson);

      expect(imported.name).toBe('imported');
      expect(imported.metrics['metric1']).toBe(100);
    });
  });
});

describe('RegressionDetector', () => {
  let detector: RegressionDetector;

  beforeEach(() => {
    detector = new RegressionDetector();
  });

  describe('Benchmark Comparison', () => {
    it('should detect no regression for similar performance', () => {
      const baseline: PerformanceBaseline = {
        name: 'test',
        timestamp: Date.now(),
        metrics: {},
        benchmarks: [
          {
            name: 'test',
            suite: 'test',
            iterations: 1000,
            totalTime: 100,
            avgTime: 100,
            minTime: 90,
            maxTime: 110,
            stdDev: 5,
            percentile95: 105,
            percentile99: 108,
            opsPerSecond: 10,
            samples: [],
            metrics: {} as any,
            timestamp: Date.now(),
          },
        ],
        loadTests: [],
      };

      const current: PerformanceBaseline = {
        ...baseline,
        benchmarks: [
          {
            ...baseline.benchmarks[0],
            avgTime: 102, // Within threshold
          },
        ],
      };

      const result = detector.detectRegressions(baseline, current);

      expect(result.detected).toBe(false);
    });

    it('should detect regression for degraded performance', () => {
      const baseline: PerformanceBaseline = {
        name: 'test',
        timestamp: Date.now(),
        metrics: {},
        benchmarks: [
          {
            name: 'test',
            suite: 'test',
            iterations: 1000,
            totalTime: 100,
            avgTime: 100,
            minTime: 90,
            maxTime: 110,
            stdDev: 5,
            percentile95: 105,
            percentile99: 108,
            opsPerSecond: 10,
            samples: [],
            metrics: {} as any,
            timestamp: Date.now(),
          },
        ],
        loadTests: [],
      };

      const current: PerformanceBaseline = {
        ...baseline,
        benchmarks: [
          {
            ...baseline.benchmarks[0],
            avgTime: 120, // 20% degradation
          },
        ],
      };

      const result = detector.detectRegressions(baseline, current);

      expect(result.detected).toBe(true);
      expect(result.regressions.length).toBeGreaterThan(0);
    });

    it('should calculate severity correctly', () => {
      const baseline: PerformanceBaseline = {
        name: 'test',
        timestamp: Date.now(),
        metrics: {},
        benchmarks: [
          {
            name: 'test',
            suite: 'test',
            iterations: 1000,
            totalTime: 100,
            avgTime: 100,
            minTime: 90,
            maxTime: 110,
            stdDev: 5,
            percentile95: 105,
            percentile99: 108,
            opsPerSecond: 10,
            samples: [],
            metrics: {} as any,
            timestamp: Date.now(),
          },
        ],
        loadTests: [],
      };

      const current: PerformanceBaseline = {
        ...baseline,
        benchmarks: [
          {
            ...baseline.benchmarks[0],
            avgTime: 160, // 60% degradation - should be critical
          },
        ],
      };

      const result = detector.detectRegressions(baseline, current);

      expect(result.severity).toBe('critical');
    });
  });

  describe('Load Test Comparison', () => {
    it('should detect latency regression', () => {
      const baseline: PerformanceBaseline = {
        name: 'test',
        timestamp: Date.now(),
        metrics: {},
        benchmarks: [],
        loadTests: [
          {
            name: 'load-test',
            target: 'https://example.com',
            timestamp: Date.now(),
            duration: 30,
            requests: {
              total: 1000,
              successful: 1000,
              failed: 0,
              timeout: 0,
            },
            latency: {
              min: 10,
              max: 100,
              mean: 50,
              stdDev: 10,
              percentile95: 80,
              percentile99: 90,
            },
            throughput: {
              mean: 100,
              min: 90,
              max: 110,
            },
            errors: [],
          },
        ],
      };

      const current: PerformanceBaseline = {
        ...baseline,
        loadTests: [
          {
            ...baseline.loadTests[0],
            latency: {
              ...baseline.loadTests[0].latency,
              mean: 70, // 40% increase
            },
          },
        ],
      };

      const result = detector.detectRegressions(baseline, current);

      expect(result.detected).toBe(true);

      const latencyRegression = result.regressions.find(
        (r) => r.metric === 'load-test.load-test.latency'
      );

      expect(latencyRegression).toBeDefined();
    });

    it('should detect throughput regression', () => {
      const baseline: PerformanceBaseline = {
        name: 'test',
        timestamp: Date.now(),
        metrics: {},
        benchmarks: [],
        loadTests: [
          {
            name: 'load-test',
            target: 'https://example.com',
            timestamp: Date.now(),
            duration: 30,
            requests: {
              total: 1000,
              successful: 1000,
              failed: 0,
              timeout: 0,
            },
            latency: {
              min: 10,
              max: 100,
              mean: 50,
              stdDev: 10,
              percentile95: 80,
              percentile99: 90,
            },
            throughput: {
              mean: 100,
              min: 90,
              max: 110,
            },
            errors: [],
          },
        ],
      };

      const current: PerformanceBaseline = {
        ...baseline,
        loadTests: [
          {
            ...baseline.loadTests[0],
            throughput: {
              ...baseline.loadTests[0].throughput,
              mean: 60, // 40% decrease
            },
          },
        ],
      };

      const result = detector.detectRegressions(baseline, current);

      expect(result.detected).toBe(true);

      const throughputRegression = result.regressions.find(
        (r) => r.metric === 'load-test.load-test.throughput'
      );

      expect(throughputRegression).toBeDefined();
    });
  });

  describe('Report Generation', () => {
    it('should generate regression report', () => {
      const baseline: PerformanceBaseline = {
        name: 'test',
        timestamp: Date.now(),
        metrics: {},
        benchmarks: [
          {
            name: 'test',
            suite: 'test',
            iterations: 1000,
            totalTime: 100,
            avgTime: 100,
            minTime: 90,
            maxTime: 110,
            stdDev: 5,
            percentile95: 105,
            percentile99: 108,
            opsPerSecond: 10,
            samples: [],
            metrics: {} as any,
            timestamp: Date.now(),
          },
        ],
        loadTests: [],
      };

      const current: PerformanceBaseline = {
        ...baseline,
        benchmarks: [
          {
            ...baseline.benchmarks[0],
            avgTime: 120,
          },
        ],
      };

      const result = detector.detectRegressions(baseline, current);
      const report = detector.generateReport(result);

      expect(report).toContain('# Performance Regression Report');
      expect(report).toContain('Regressions Detected');
    });
  });

  describe('Configuration', () => {
    it('should allow custom thresholds', () => {
      detector.updateConfig({
        thresholds: {
          critical: 100,
          high: 50,
          medium: 20,
          low: 10,
        },
      });

      const config = detector.getConfig();

      expect(config.thresholds.critical).toBe(100);
      expect(config.thresholds.low).toBe(10);
    });
  });
});
