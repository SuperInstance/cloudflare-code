/**
 * Performance Regression Tests
 */

import { describe, it, expect } from 'vitest';
import { RegressionDetector } from '../src/regression/detector.js';
import type { PerformanceBaseline, BaselineMetrics } from '../src/types/index.js';

describe('RegressionDetector', () => {
  it('should create detector instance', () => {
    const detector = new RegressionDetector();
    expect(detector).toBeDefined();
  });

  it('should create baseline', () => {
    const detector = new RegressionDetector();
    const metrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const baseline = detector.createBaseline('test', metrics, 'abc123');

    expect(baseline.id).toBe('test');
    expect(baseline.commit).toBe('abc123');
    expect(baseline.metrics).toEqual(metrics);
    expect(baseline.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('should save and load baseline', async () => {
    const detector = new RegressionDetector({ baselinePath: '/tmp/test-baselines' });

    const metrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const baseline = detector.createBaseline('test-save', metrics);
    await detector.saveBaseline(baseline);

    const loaded = await detector.loadBaseline('test-save');
    expect(loaded).toEqual(baseline);

    await detector.deleteBaseline('test-save');
  });

  it('should detect no regressions for identical metrics', () => {
    const detector = new RegressionDetector();

    const metrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const baseline = detector.createBaseline('test', metrics);
    detector['baselines'].set('test', baseline);

    const result = detector.compare('test', metrics);

    expect(result.detected).toBe(false);
    expect(result.regressions).toHaveLength(0);
  });

  it('should detect CPU regression', () => {
    const detector = new RegressionDetector();

    const baselineMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const currentMetrics: BaselineMetrics = {
      cpu: 0.7, // 40% increase
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const baseline = detector.createBaseline('test', baselineMetrics);
    detector['baselines'].set('test', baseline);

    const result = detector.compare('test', currentMetrics);

    expect(result.detected).toBe(true);
    expect(result.regressions.some(r => r.metric === 'cpu')).toBe(true);
  });

  it('should detect memory regression', () => {
    const detector = new RegressionDetector();

    const baselineMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const currentMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 130 * 1024 * 1024, // 30% increase
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const baseline = detector.createBaseline('test', baselineMetrics);
    detector['baselines'].set('test', baseline);

    const result = detector.compare('test', currentMetrics);

    expect(result.detected).toBe(true);
    expect(result.regressions.some(r => r.metric === 'memory')).toBe(true);
  });

  it('should detect latency regression', () => {
    const detector = new RegressionDetector();

    const baselineMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const currentMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 60, p95: 120, p99: 180 }, // 20% increase
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const baseline = detector.createBaseline('test', baselineMetrics);
    detector['baselines'].set('test', baseline);

    const result = detector.compare('test', currentMetrics);

    expect(result.detected).toBe(true);
    expect(result.regressions.some(r => r.metric.startsWith('latency-'))).toBe(true);
  });

  it('should detect throughput regression', () => {
    const detector = new RegressionDetector();

    const baselineMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const currentMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 800, // 20% decrease
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const baseline = detector.createBaseline('test', baselineMetrics);
    detector['baselines'].set('test', baseline);

    const result = detector.compare('test', currentMetrics);

    expect(result.detected).toBe(true);
    expect(result.regressions.some(r => r.metric === 'throughput')).toBe(true);
  });

  it('should detect bundle size regression', () => {
    const detector = new RegressionDetector();

    const baselineMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const currentMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 600 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 }, // 20% increase
    };

    const baseline = detector.createBaseline('test', baselineMetrics);
    detector['baselines'].set('test', baseline);

    const result = detector.compare('test', currentMetrics);

    expect(result.detected).toBe(true);
    expect(result.regressions.some(r => r.metric === 'bundleSize')).toBe(true);
  });

  it('should detect improvements', () => {
    const detector = new RegressionDetector();

    const baselineMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const currentMetrics: BaselineMetrics = {
      cpu: 0.4, // 20% improvement
      memory: 80 * 1024 * 1024, // 20% improvement
      latency: { p50: 40, p95: 80, p99: 120 }, // 20% improvement
      throughput: 1200, // 20% improvement
      bundleSize: { main: 400 * 1024, gzip: 120 * 1024, brotli: 100 * 1024 }, // 20% improvement
    };

    const baseline = detector.createBaseline('test', baselineMetrics);
    detector['baselines'].set('test', baseline);

    const result = detector.compare('test', currentMetrics);

    expect(result.detected).toBe(false);
    expect(result.improvements.length).toBeGreaterThan(0);
  });

  it('should generate correct summary', () => {
    const detector = new RegressionDetector();

    const baselineMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const currentMetrics: BaselineMetrics = {
      cpu: 0.8, // critical
      memory: 120 * 1024 * 1024, // high
      latency: { p50: 60, p95: 110, p99: 160 }, // medium
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const baseline = detector.createBaseline('test', baselineMetrics);
    detector['baselines'].set('test', baseline);

    const result = detector.compare('test', currentMetrics);

    expect(result.summary.totalIssues).toBeGreaterThan(0);
    expect(result.summary.criticalIssues).toBeGreaterThan(0);
    expect(result.summary.status).toBe('fail');
  });

  it('should generate report', () => {
    const detector = new RegressionDetector();

    const baselineMetrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const currentMetrics: BaselineMetrics = {
      cpu: 0.7,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const baseline = detector.createBaseline('test', baselineMetrics);
    detector['baselines'].set('test', baseline);

    const result = detector.compare('test', currentMetrics);
    const report = detector.generateReport(result);

    expect(report).toContain('Performance Regression Report');
    expect(report).toContain('Regressions');
  });

  it('should get baseline by ID', () => {
    const detector = new RegressionDetector();

    const metrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    const baseline = detector.createBaseline('test-id', metrics);
    detector['baselines'].set('test-id', baseline);

    const retrieved = detector.getBaseline('test-id');
    expect(retrieved).toEqual(baseline);
  });

  it('should get all baselines', () => {
    const detector = new RegressionDetector();

    const metrics: BaselineMetrics = {
      cpu: 0.5,
      memory: 100 * 1024 * 1024,
      latency: { p50: 50, p95: 100, p99: 150 },
      throughput: 1000,
      bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
    };

    detector.createBaseline('test1', metrics);
    detector.createBaseline('test2', metrics);

    const allBaselines = detector.getAllBaselines();
    expect(allBaselines.size).toBe(2);
  });

  it('should update config', () => {
    const detector = new RegressionDetector();

    detector.updateConfig({
      thresholds: {
        cpu: { warning: 0.05, critical: 0.1 },
        memory: { warning: 0.1, critical: 0.2 },
        latency: { warning: 0.05, critical: 0.1 },
        throughput: { warning: -0.05, critical: -0.1 },
        bundleSize: { warning: 0.05, critical: 0.1 },
      },
    });

    const config = detector.getConfig();
    expect(config.thresholds.cpu.warning).toBe(0.05);
  });
});
