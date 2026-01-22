/**
 * Performance Analyzer and Anomaly Detector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PerformanceAnalyzer,
  AnomalyDetector,
  createPerformanceAnalyzer,
  createAnomalyDetector,
  detectAnomalies,
} from './performance';
import type { MetricSnapshot } from './types';

describe('PerformanceAnalyzer', () => {
  let analyzer: PerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer();
  });

  const createMockMetrics = (overrides?: Partial<MetricSnapshot>): MetricSnapshot => ({
    snapshotId: 'snapshot-1',
    timestamp: Date.now(),
    requests: {
      total: 1000,
      success: 950,
      failed: 50,
      rps: 100,
      avgLatency: 100,
      p50: 80,
      p95: 200,
      p99: 500,
    },
    errors: {
      total: 50,
      errorRate: 0.05,
      byType: {},
      byCategory: {} as any,
    },
    performance: {
      cpuUsage: 50,
      memoryUsage: 512,
      memoryLimit: 1024,
      activeConnections: 10,
      queueDepth: 5,
    },
    resources: {
      heapUsed: 512 * 1024 * 1024,
      heapTotal: 768 * 1024 * 1024,
      heapLimit: 1024 * 1024 * 1024,
      externalMemory: 0,
      arrayBuffers: 0,
    },
    custom: {},
    ...overrides,
  });

  describe('Bottleneck Detection', () => {
    it('should detect slow operations', () => {
      const metrics = createMockMetrics({
        requests: {
          total: 1000,
          success: 950,
          failed: 50,
          rps: 100,
          avgLatency: 100,
          p50: 80,
          p95: 2000, // 2 seconds - exceeds threshold
          p99: 5000,
        },
      });

      const analysis = analyzer.analyzePerformance(metrics);

      expect(analysis.bottlenecks.length).toBeGreaterThan(0);

      const slowBottleneck = analysis.bottlenecks.find(b =>
        b.description.toLowerCase().includes('latency')
      );

      expect(slowBottleneck).toBeDefined();
      expect(slowBottleneck?.severity).toBeDefined();
    });

    it('should detect high error rates', () => {
      const metrics = createMockMetrics({
        errors: {
          total: 100,
          errorRate: 0.1, // 10% error rate
          byType: {},
          byCategory: {} as any,
        },
      });

      const analysis = analyzer.analyzePerformance(metrics);

      const errorBottleneck = analysis.bottlenecks.find(b =>
        b.description.toLowerCase().includes('error rate')
      );

      expect(errorBottleneck).toBeDefined();
      expect(errorBottleneck?.impact).toBeGreaterThan(0);
    });

    it('should detect memory pressure', () => {
      const metrics = createMockMetrics({
        resources: {
          heapUsed: 950 * 1024 * 1024, // 950MB - 95% of limit
          heapTotal: 950 * 1024 * 1024,
          heapLimit: 1024 * 1024 * 1024,
          externalMemory: 0,
          arrayBuffers: 0,
        },
      });

      const analysis = analyzer.analyzePerformance(metrics);

      const memoryBottleneck = analysis.bottlenecks.find(b =>
        b.description.toLowerCase().includes('heap')
      );

      expect(memoryBottleneck).toBeDefined();
      expect(memoryBottleneck?.severity).toBe('critical');
    });

    it('should calculate bottleneck severity correctly', () => {
      const metrics = createMockMetrics({
        requests: {
          total: 1000,
          success: 950,
          failed: 50,
          rps: 100,
          avgLatency: 100,
          p50: 80,
          p95: 5000, // 5x threshold
          p99: 10000,
        },
      });

      const analysis = analyzer.analyzePerformance(metrics);

      const severeBottleneck = analysis.bottlenecks.find(b =>
        b.severity === 'critical' || b.severity === 'high'
      );

      expect(severeBottleneck).toBeDefined();
    });
  });

  describe('Memory Analysis', () => {
    it('should analyze memory usage', () => {
      const metrics = createMockMetrics();

      const analysis = analyzer.analyzePerformance(metrics);

      expect(analysis.memoryAnalysis).toBeDefined();
      expect(analysis.memoryAnalysis.heapUsed).toBeGreaterThan(0);
      expect(analysis.memoryAnalysis.heapLimit).toBeGreaterThan(0);
      expect(analysis.memoryAnalysis.percentage).toBeGreaterThan(0);
      expect(analysis.memoryAnalysis.percentage).toBeLessThanOrEqual(100);
    });

    it('should detect potential memory leaks', () => {
      const metrics = createMockMetrics({
        resources: {
          heapUsed: 900 * 1024 * 1024,
          heapTotal: 950 * 1024 * 1024,
          heapLimit: 1024 * 1024 * 1024,
          externalMemory: 0,
          arrayBuffers: 0,
        },
      });

      const analysis = analyzer.analyzePerformance(metrics);

      expect(analysis.memoryAnalysis.memoryLeaks.length).toBeGreaterThan(0);
      expect(analysis.memoryAnalysis.memoryLeaks[0].confidence).toBeGreaterThan(0);
    });

    it('should detect large allocations', () => {
      const metrics = createMockMetrics({
        resources: {
          heapUsed: 512 * 1024 * 1024,
          heapTotal: 768 * 1024 * 1024,
          heapLimit: 1024 * 1024 * 1024,
          externalMemory: 0,
          arrayBuffers: 2 * 1024 * 1024, // 2MB
        },
      });

      const analysis = analyzer.analyzePerformance(metrics);

      expect(analysis.memoryAnalysis.largeAllocations.length).toBeGreaterThan(0);
      expect(analysis.memoryAnalysis.largeAllocations[0].size).toBe(2 * 1024 * 1024);
    });
  });

  describe('Optimization Suggestions', () => {
    it('should suggest caching for slow operations', () => {
      const metrics = createMockMetrics({
        requests: {
          total: 1000,
          success: 950,
          failed: 50,
          rps: 100,
          avgLatency: 100,
          p50: 80,
          p95: 2000,
          p99: 5000,
        },
      });

      const analysis = analyzer.analyzePerformance(metrics);

      const cacheSuggestion = analysis.optimizations.find(o =>
        o.description.toLowerCase().includes('cache')
      );

      expect(cacheSuggestion).toBeDefined();
      expect(cacheSuggestion?.type).toBe('add_cache');
      expect(cacheSuggestion?.expectedImprovement).toBeGreaterThan(0);
    });

    it('should suggest connection pooling for memory issues', () => {
      const metrics = createMockMetrics({
        resources: {
          heapUsed: 900 * 1024 * 1024,
          heapTotal: 950 * 1024 * 1024,
          heapLimit: 1024 * 1024 * 1024,
          externalMemory: 0,
          arrayBuffers: 0,
        },
      });

      const analysis = analyzer.analyzePerformance(metrics);

      const poolSuggestion = analysis.optimizations.find(o =>
        o.description.toLowerCase().includes('pool')
      );

      expect(poolSuggestion).toBeDefined();
      expect(poolSuggestion?.type).toBe('connection_pool');
    });

    it('should include references for optimizations', () => {
      const metrics = createMockMetrics();

      const analysis = analyzer.analyzePerformance(metrics);

      for (const optimization of analysis.optimizations) {
        expect(optimization.suggestionId).toBeDefined();
        expect(optimization.type).toBeDefined();
        expect(optimization.description).toBeDefined();
        expect(optimization.expectedImprovement).toBeGreaterThanOrEqual(0);
        expect(optimization.expectedImprovement).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Historical Comparison', () => {
    it('should compare with baseline', () => {
      const baseline = createMockMetrics({
        requests: {
          total: 1000,
          success: 950,
          failed: 50,
          rps: 100,
          avgLatency: 100,
          p50: 80,
          p95: 200,
          p99: 500,
        },
      });

      // Add baseline data
      for (let i = 0; i < 100; i++) {
        analyzer.addSnapshot(baseline);
      }

      const current = createMockMetrics({
        requests: {
          total: 1000,
          success: 900,
          failed: 100,
          rps: 100,
          avgLatency: 150, // 50% increase
          p50: 120,
          p95: 300,
          p99: 750,
        },
      });

      const comparison = analyzer.compareWithBaseline(current);

      expect(comparison.latencyChange).toBe(50); // 50% increase
      expect(comparison.errorRateChange).toBeDefined();
      expect(comparison.memoryChange).toBeDefined();
    });

    it('should detect performance regression', () => {
      const baseline = createMockMetrics();

      for (let i = 0; i < 100; i++) {
        analyzer.addSnapshot(baseline);
      }

      const regressed = createMockMetrics({
        requests: {
          total: 1000,
          success: 700,
          failed: 300,
          rps: 100,
          avgLatency: 200, // 100% increase
          p50: 150,
          p95: 400,
          p99: 1000,
        },
      });

      const comparison = analyzer.compareWithBaseline(regressed);

      expect(comparison.isRegression).toBe(true);
    });

    it('should handle no baseline data', () => {
      const current = createMockMetrics();

      const comparison = analyzer.compareWithBaseline(current);

      expect(comparison.latencyChange).toBe(0);
      expect(comparison.errorRateChange).toBe(0);
      expect(comparison.memoryChange).toBe(0);
      expect(comparison.isRegression).toBe(false);
    });
  });

  describe('Custom Thresholds', () => {
    it('should use custom thresholds', () => {
      const customAnalyzer = new PerformanceAnalyzer({
        slowOperationThreshold: 500, // Lower threshold
        slowQueryThreshold: 50,
        memoryLeakThreshold: 5 * 1024 * 1024,
      });

      const metrics = createMockMetrics({
        requests: {
          total: 1000,
          success: 950,
          failed: 50,
          rps: 100,
          avgLatency: 100,
          p50: 80,
          p95: 600, // Exceeds custom threshold
          p99: 1000,
        },
      });

      const analysis = customAnalyzer.analyzePerformance(metrics);

      expect(analysis.bottlenecks.length).toBeGreaterThan(0);
    });
  });
});

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector();
  });

  describe('Training', () => {
    it('should train with baseline data', () => {
      const metrics = new Map<string, number>([
        ['latency', 100],
        ['error_rate', 0.05],
        ['memory', 512],
      ]);

      detector.train(metrics);

      const stats = detector.getStats('latency');

      expect(stats).toBeDefined();
      expect(stats?.mean).toBeDefined();
      expect(stats?.stdDev).toBeDefined();
      expect(stats?.count).toBe(1);
    });

    it('should accumulate baseline data', () => {
      const metrics = new Map<string, number>([
        ['latency', 100],
      ]);

      for (let i = 0; i < 50; i++) {
        detector.train(metrics);
      }

      const stats = detector.getStats('latency');

      expect(stats?.count).toBe(50);
    });

    it('should limit baseline size', () => {
      const metrics = new Map<string, number>([
        ['latency', 100],
      ]);

      for (let i = 0; i < 200; i++) {
        detector.train(metrics);
      }

      const stats = detector.getStats('latency');

      // Should keep only baselineSize (100) values
      expect(stats?.count).toBe(100);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect anomalies in metrics', () => {
      // Train with normal values
      for (let i = 0; i < 50; i++) {
        const metrics = new Map<string, number>([
          ['latency', 100 + Math.random() * 10], // 90-110
        ]);
        detector.train(metrics);
      }

      // Test with anomalous value
      const testMetrics = new Map<string, number>([
        ['latency', 500], // Way outside normal range
      ]);

      const anomalies = detector.detect(testMetrics);

      expect(anomalies.length).toBe(1);
      expect(anomalies[0].isAnomaly).toBe(true);
      expect(anomalies[0].metric).toBe('latency');
      expect(anomalies[0].zScore).toBeGreaterThan(2.5);
    });

    it('should not detect normal values as anomalies', () => {
      // Train with normal values
      for (let i = 0; i < 50; i++) {
        const metrics = new Map<string, number>([
          ['latency', 100 + Math.random() * 10],
        ]);
        detector.train(metrics);
      }

      // Test with normal value
      const testMetrics = new Map<string, number>([
        ['latency', 105],
      ]);

      const anomalies = detector.detect(testMetrics);

      expect(anomalies[0].isAnomaly).toBe(false);
      expect(anomalies[0].zScore).toBeLessThan(2.5);
    });

    it('should calculate z-scores correctly', () => {
      // Train with values: mean = 100, std_dev ≈ 10
      for (let i = 0; i < 50; i++) {
        const metrics = new Map<string, number>([
          ['latency', 100 + Math.random() * 20 - 10],
        ]);
        detector.train(metrics);
      }

      const testMetrics = new Map<string, number>([
        ['latency', 150], // Should be ~5 std devs away
      ]);

      const anomalies = detector.detect(testMetrics);

      expect(anomalies[0].zScore).toBeGreaterThan(2);
      expect(anomalies[0].deviation).toBeGreaterThan(0);
    });

    it('should handle insufficient baseline data', () => {
      // Only train with 5 values
      for (let i = 0; i < 5; i++) {
        const metrics = new Map<string, number>([
          ['latency', 100],
        ]);
        detector.train(metrics);
      }

      const testMetrics = new Map<string, number>([
        ['latency', 500],
      ]);

      const anomalies = detector.detect(testMetrics);

      // Should not detect without sufficient baseline
      expect(anomalies.length).toBe(0);
    });

    it('should handle zero variance', () => {
      // Train with constant values
      for (let i = 0; i < 50; i++) {
        const metrics = new Map<string, number>([
          ['latency', 100],
        ]);
        detector.train(metrics);
      }

      const testMetrics = new Map<string, number>([
        ['latency', 100],
      ]);

      const anomalies = detector.detect(testMetrics);

      // Should skip metrics with zero variance
      expect(anomalies.length).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate baseline statistics', () => {
      for (let i = 0; i < 100; i++) {
        const metrics = new Map<string, number>([
          ['metric1', 100 + i],
        ]);
        detector.train(metrics);
      }

      const stats = detector.getStats('metric1');

      expect(stats).toBeDefined();
      expect(stats?.mean).toBeGreaterThan(100);
      expect(stats?.stdDev).toBeGreaterThan(0);
      expect(stats?.min).toBe(100);
      expect(stats?.max).toBe(199);
      expect(stats?.count).toBe(100);
    });

    it('should return null for unknown metrics', () => {
      const stats = detector.getStats('unknown');

      expect(stats).toBeNull();
    });

    it('should return null when no data', () => {
      const newDetector = new AnomalyDetector();
      const stats = newDetector.getStats('metric');

      expect(stats).toBeNull();
    });
  });

  describe('Clearing', () => {
    it('should clear all baseline data', () => {
      const metrics = new Map<string, number>([
        ['latency', 100],
      ]);

      detector.train(metrics);
      expect(detector.getStats('latency')).toBeDefined();

      detector.clear();
      expect(detector.getStats('latency')).toBeNull();
    });
  });
});

describe('Convenience Functions', () => {
  it('should create performance analyzer', () => {
    const analyzer = createPerformanceAnalyzer();

    expect(analyzer).toBeInstanceOf(PerformanceAnalyzer);
  });

  it('should create anomaly detector', () => {
    const detector = createAnomalyDetector();

    expect(detector).toBeInstanceOf(AnomalyDetector);
  });

  it('should detect anomalies using convenience function', () => {
    const detector = createAnomalyDetector();

    // Train
    for (let i = 0; i < 50; i++) {
      const metrics = new Map<string, number>([
        ['metric', 100],
      ]);
      detector.train(metrics);
    }

    // Detect
    const testMetrics = new Map<string, number>([
      ['metric', 500],
    ]);

    const anomalies = detectAnomalies(detector, testMetrics);

    expect(anomalies).toBeDefined();
    expect(Array.isArray(anomalies)).toBe(true);
  });
});
