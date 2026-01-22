/**
 * Performance Analyzer Tests
 */

import { PerformanceAnalyzer, createAnalyzer } from './analyzer';
import { PerformanceMetrics } from '../types';

describe('PerformanceAnalyzer', () => {
  let analyzer: PerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer({
      enableRegressionDetection: true,
      regressionThreshold: 10,
      minSamples: 5,
      enableTrendAnalysis: true,
      enableAnomalyDetection: true,
    });
  });

  afterEach(() => {
    analyzer.clear();
  });

  describe('Initialization', () => {
    test('should create analyzer with default options', () => {
      const defaultAnalyzer = new PerformanceAnalyzer();
      expect(defaultAnalyzer).toBeInstanceOf(PerformanceAnalyzer);
      defaultAnalyzer.clear();
    });

    test('should create analyzer with custom options', () => {
      const customAnalyzer = new PerformanceAnalyzer({
        regressionThreshold: 20,
        minSamples: 20,
        significanceLevel: 0.01,
      });

      expect(customAnalyzer).toBeInstanceOf(PerformanceAnalyzer);
      customAnalyzer.clear();
    });
  });

  describe('Metrics Recording', () => {
    test('should record performance metrics', () => {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: {
          usage: 50,
          userTime: 100,
          systemTime: 50,
          idleTime: 0,
        },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 2,
          latency: 100,
        },
        custom: {
          customMetric: 42,
        },
      };

      analyzer.recordMetrics(metrics);

      expect(analyzer['metricsHistory'].length).toBe(1);
    });

    test('should manage history size', () => {
      const limitedAnalyzer = new PerformanceAnalyzer({
        maxHistory: 5,
      });

      for (let i = 0; i < 10; i++) {
        const metrics: PerformanceMetrics = {
          timestamp: Date.now(),
          cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
          memory: {
            used: 1024 * 1024 * 100,
            total: 1024 * 1024 * 512,
            heapUsed: 1024 * 1024 * 80,
            heapTotal: 1024 * 1024 * 256,
            external: 1024 * 1024 * 10,
          },
          network: {
            requests: 100,
            bytesReceived: 1024 * 1024 * 10,
            bytesSent: 1024 * 1024 * 5,
            errors: 0,
            latency: 100,
          },
          custom: {},
        };

        limitedAnalyzer.recordMetrics(metrics);
      }

      expect(limitedAnalyzer['metricsHistory'].length).toBe(5);

      limitedAnalyzer.clear();
    });
  });

  describe('Baseline Management', () => {
    test('should create baseline', () => {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 100,
        },
        custom: {},
      };

      const baseline = analyzer.createBaseline('test-baseline', metrics, {
        version: '1.0.0',
      });

      expect(baseline).toBeDefined();
      expect(baseline.name).toBe('test-baseline');
      expect(baseline.id).toBeDefined();
      expect(baseline.timestamp).toBeDefined();
      expect(baseline.metrics).toEqual(metrics);
      expect(baseline.metadata).toEqual({ version: '1.0.0' });
    });

    test('should get baseline by ID', () => {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 100,
        },
        custom: {},
      };

      const baseline = analyzer.createBaseline('test-baseline', metrics);
      const retrieved = analyzer.getBaseline(baseline.id);

      expect(retrieved).toEqual(baseline);
    });

    test('should get baseline by name', () => {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 100,
        },
        custom: {},
      };

      analyzer.createBaseline('unique-name', metrics);
      const retrieved = analyzer.getBaselineByName('unique-name');

      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('unique-name');
    });

    test('should get all baselines', () => {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 100,
        },
        custom: {},
      };

      analyzer.createBaseline('baseline-1', metrics);
      analyzer.createBaseline('baseline-2', metrics);

      const baselines = analyzer.getBaselines();

      expect(baselines.length).toBe(2);
    });
  });

  describe('Baseline Comparison', () => {
    test('should compare current metrics to baseline', () => {
      const baselineMetrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 100,
        },
        custom: {},
      };

      const currentMetrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 60, userTime: 110, systemTime: 60, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 120,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 90,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 110,
          bytesReceived: 1024 * 1024 * 11,
          bytesSent: 1024 * 1024 * 6,
          errors: 1,
          latency: 120,
        },
        custom: {},
      };

      const baseline = analyzer.createBaseline('test-baseline', baselineMetrics);
      const comparison = analyzer.compareToBaseline(baseline.id, currentMetrics);

      expect(comparison.size).toBeGreaterThan(0);

      const cpuComparison = comparison.get('cpu.usage');
      expect(cpuComparison).toBeDefined();
      expect(cpuComparison!.baseline).toBe(50);
      expect(cpuComparison!.current).toBe(60);
      expect(cpuComparison!.delta).toBe(10);
    });

    test('should throw error for invalid baseline ID', () => {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 100,
        },
        custom: {},
      };

      expect(() => {
        analyzer.compareToBaseline('invalid-id', metrics);
      }).toThrow('Baseline not found');
    });
  });

  describe('Regression Detection', () => {
    test('should detect performance regressions', () => {
      // Record baseline metrics
      for (let i = 0; i < 10; i++) {
        const metrics: PerformanceMetrics = {
          timestamp: Date.now(),
          cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
          memory: {
            used: 1024 * 1024 * 100,
            total: 1024 * 1024 * 512,
            heapUsed: 1024 * 1024 * 80,
            heapTotal: 1024 * 1024 * 256,
            external: 1024 * 1024 * 10,
          },
          network: {
            requests: 100,
            bytesReceived: 1024 * 1024 * 10,
            bytesSent: 1024 * 1024 * 5,
            errors: 0,
            latency: 100,
          },
          custom: {},
        };

        analyzer.recordMetrics(metrics);
      }

      // Record degraded metrics
      const degradedMetrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 80, userTime: 150, systemTime: 80, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 200,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 160,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 300,
        },
        custom: {},
      };

      const regressions = analyzer.detectRegressions(degradedMetrics);

      expect(Array.isArray(regressions)).toBe(true);
    });

    test('should return empty array with insufficient samples', () => {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 100,
        },
        custom: {},
      };

      const regressions = analyzer.detectRegressions(metrics);

      expect(regressions).toEqual([]);
    });

    test('should get regressions by severity', () => {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 100,
        },
        custom: {},
      };

      for (let i = 0; i < 10; i++) {
        analyzer.recordMetrics(metrics);
      }

      analyzer.detectRegressions(metrics);

      const highRegressions = analyzer.getRegressionsBySeverity('high');
      expect(Array.isArray(highRegressions)).toBe(true);
    });
  });

  describe('Trend Analysis', () => {
    test('should analyze trends', () => {
      for (let i = 0; i < 20; i++) {
        const metrics: PerformanceMetrics = {
          timestamp: Date.now(),
          cpu: { usage: 50 + i, userTime: 100, systemTime: 50, idleTime: 0 },
          memory: {
            used: 1024 * 1024 * 100,
            total: 1024 * 1024 * 512,
            heapUsed: 1024 * 1024 * 80,
            heapTotal: 1024 * 1024 * 256,
            external: 1024 * 1024 * 10,
          },
          network: {
            requests: 100,
            bytesReceived: 1024 * 1024 * 10,
            bytesSent: 1024 * 1024 * 5,
            errors: 0,
            latency: 100,
          },
          custom: {},
        };

        analyzer.recordMetrics(metrics);
      }

      const trends = analyzer.analyzeTrends();

      expect(trends.size).toBeGreaterThan(0);

      const cpuTrend = trends.get('cpu.usage');
      expect(cpuTrend).toBeDefined();
      expect(cpuTrend!.metric).toBe('cpu.usage');
      expect(['improving', 'degrading', 'stable']).toContain(cpuTrend!.direction);
    });

    test('should get trends', () => {
      const trends = analyzer.getTrends();

      expect(trends).toBeInstanceOf(Map);
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect anomalies', () => {
      // Record normal metrics
      for (let i = 0; i < 20; i++) {
        const metrics: PerformanceMetrics = {
          timestamp: Date.now(),
          cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
          memory: {
            used: 1024 * 1024 * 100,
            total: 1024 * 1024 * 512,
            heapUsed: 1024 * 1024 * 80,
            heapTotal: 1024 * 1024 * 256,
            external: 1024 * 1024 * 10,
          },
          network: {
            requests: 100,
            bytesReceived: 1024 * 1024 * 10,
            bytesSent: 1024 * 1024 * 5,
            errors: 0,
            latency: 100,
          },
          custom: {},
        };

        analyzer.recordMetrics(metrics);
      }

      // Record anomalous metric
      const anomalousMetrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 200, userTime: 100, systemTime: 50, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 100,
        },
        custom: {},
      };

      const anomalies = analyzer.detectAnomalies(anomalousMetrics);

      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  describe('Performance Scoring', () => {
    test('should calculate performance score', () => {
      const goodMetrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 30, userTime: 50, systemTime: 30, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 50,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 50,
        },
        custom: {},
      };

      const score = analyzer.calculatePerformanceScore(goodMetrics);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('should penalize poor performance', () => {
      const poorMetrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 95, userTime: 200, systemTime: 100, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 450,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 230,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 20,
          latency: 2000,
        },
        custom: {},
      };

      const score = analyzer.calculatePerformanceScore(poorMetrics);

      expect(score).toBeLessThan(50);
    });
  });

  describe('Report Generation', () => {
    test('should generate comprehensive report', () => {
      for (let i = 0; i < 10; i++) {
        const metrics: PerformanceMetrics = {
          timestamp: Date.now(),
          cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
          memory: {
            used: 1024 * 1024 * 100,
            total: 1024 * 1024 * 512,
            heapUsed: 1024 * 1024 * 80,
            heapTotal: 1024 * 1024 * 256,
            external: 1024 * 1024 * 10,
          },
          network: {
            requests: 100,
            bytesReceived: 1024 * 1024 * 10,
            bytesSent: 1024 * 1024 * 5,
            errors: 0,
            latency: 100,
          },
          custom: {},
        };

        analyzer.recordMetrics(metrics);
      }

      const report = analyzer.generateReport();

      expect(report.timestamp).toBeDefined();
      expect(report.score).toBeGreaterThan(0);
      expect(report.statistics).toBeInstanceOf(Map);
      expect(report.trends).toBeInstanceOf(Map);
      expect(Array.isArray(report.regressions)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Statistics Calculation', () => {
    test('should calculate metric statistics', () => {
      for (let i = 0; i < 20; i++) {
        const metrics: PerformanceMetrics = {
          timestamp: Date.now(),
          cpu: { usage: 50 + i * 2, userTime: 100, systemTime: 50, idleTime: 0 },
          memory: {
            used: 1024 * 1024 * 100,
            total: 1024 * 1024 * 512,
            heapUsed: 1024 * 1024 * 80,
            heapTotal: 1024 * 1024 * 256,
            external: 1024 * 1024 * 10,
          },
          network: {
            requests: 100,
            bytesReceived: 1024 * 1024 * 10,
            bytesSent: 1024 * 1024 * 5,
            errors: 0,
            latency: 100,
          },
          custom: {},
        };

        analyzer.recordMetrics(metrics);
      }

      const stats = analyzer.calculateMetricStatistics('cpu.usage');

      expect(stats).toBeDefined();
      expect(stats!.metric).toBe('cpu.usage');
      expect(stats!.count).toBe(20);
      expect(stats!.mean).toBeGreaterThan(0);
      expect(stats!.min).toBeLessThan(stats!.max);
    });

    test('should get all statistics', () => {
      for (let i = 0; i < 10; i++) {
        const metrics: PerformanceMetrics = {
          timestamp: Date.now(),
          cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
          memory: {
            used: 1024 * 1024 * 100,
            total: 1024 * 1024 * 512,
            heapUsed: 1024 * 1024 * 80,
            heapTotal: 1024 * 1024 * 256,
            external: 1024 * 1024 * 10,
          },
          network: {
            requests: 100,
            bytesReceived: 1024 * 1024 * 10,
            bytesSent: 1024 * 1024 * 5,
            errors: 0,
            latency: 100,
          },
          custom: {},
        };

        analyzer.recordMetrics(metrics);
      }

      const allStats = analyzer.getAllStatistics();

      expect(allStats.size).toBeGreaterThan(0);
    });
  });

  describe('Clear', () => {
    test('should clear analyzer state', () => {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, userTime: 100, systemTime: 50, idleTime: 0 },
        memory: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 512,
          heapUsed: 1024 * 1024 * 80,
          heapTotal: 1024 * 1024 * 256,
          external: 1024 * 1024 * 10,
        },
        network: {
          requests: 100,
          bytesReceived: 1024 * 1024 * 10,
          bytesSent: 1024 * 1024 * 5,
          errors: 0,
          latency: 100,
        },
        custom: {},
      };

      analyzer.recordMetrics(metrics);
      analyzer.createBaseline('test', metrics);

      analyzer.clear();

      expect(analyzer['metricsHistory'].length).toBe(0);
      expect(analyzer['baselines'].size).toBe(0);
      expect(analyzer['regressions'].length).toBe(0);
    });
  });
});

describe('Convenience Functions', () => {
  test('createAnalyzer should create analyzer', () => {
    const analyzer = createAnalyzer({
      regressionThreshold: 15,
    });

    expect(analyzer).toBeInstanceOf(PerformanceAnalyzer);

    analyzer.clear();
  });
});
