/**
 * Performance Profiler Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceProfiler, StatisticalSampler } from '../src/index.js';

describe('PerformanceProfiler', () => {
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler({
      enabled: true,
      sampleInterval: 10,
      maxSamples: 100,
    });
  });

  afterEach(() => {
    profiler.clear();
  });

  describe('Basic Profiling', () => {
    it('should start and stop profiling', () => {
      profiler.start();
      expect(() => profiler.stop()).not.toThrow();
    });

    it('should throw error when stopping without starting', () => {
      expect(() => profiler.stop()).toThrow('No profiling in progress');
    });

    it('should throw error when starting twice', () => {
      profiler.start();
      expect(() => profiler.start()).toThrow('Profiling already in progress');
      profiler.stop();
    });

    it('should capture snapshots', () => {
      profiler.start();
      const snapshot = profiler.captureSnapshot();
      profiler.stop();

      expect(snapshot).toBeDefined();
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.metrics).toBeDefined();
      expect(snapshot.metrics.duration).toBeGreaterThanOrEqual(0);
    });

    it('should limit snapshots to maxSamples', async () => {
      profiler.start();

      for (let i = 0; i < 150; i++) {
        profiler.captureSnapshot();
      }

      profiler.stop();
      const snapshots = profiler.getSnapshots();

      expect(snapshots.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Metrics Capture', () => {
    it('should capture CPU metrics', async () => {
      profiler.start();

      // Do some work
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i);
      }

      const snapshot = profiler.captureSnapshot();
      profiler.stop();

      expect(snapshot.metrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(snapshot.metrics.cpuTime).toBeGreaterThan(0);
    });

    it('should capture memory metrics', () => {
      profiler.start();
      const snapshot = profiler.captureSnapshot();
      profiler.stop();

      expect(snapshot.metrics.memoryUsed).toBeGreaterThan(0);
      expect(snapshot.metrics.memoryTotal).toBeGreaterThan(0);
      expect(snapshot.metrics.memoryPercentage).toBeGreaterThan(0);
      expect(snapshot.metrics.memoryPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Summary', () => {
    it('should generate summary', () => {
      profiler.start();

      for (let i = 0; i < 10; i++) {
        profiler.captureSnapshot();
      }

      profiler.stop();
      const summary = profiler.getSummary();

      expect(summary.totalSnapshots).toBe(10);
      expect(summary.avgCpuUsage).toBeGreaterThanOrEqual(0);
      expect(summary.avgMemoryUsage).toBeGreaterThan(0);
      expect(summary.duration).toBeGreaterThan(0);
    });

    it('should handle empty snapshots', () => {
      const summary = profiler.getSummary();

      expect(summary.totalSnapshots).toBe(0);
      expect(summary.duration).toBe(0);
    });
  });

  describe('Static Methods', () => {
    it('should profile worker function', async () => {
      const testFn = () => {
        return 42;
      };

      const { result, metrics } = await PerformanceProfiler.profileWorker(testFn);

      expect(result).toBe(42);
      expect(metrics).toBeDefined();
      expect(metrics.executionTime).toBeGreaterThan(0);
    });

    it('should handle async worker functions', async () => {
      const testFn = async () => {
        await Promise.resolve(42);
        return 42;
      };

      const { result, metrics } = await PerformanceProfiler.profileWorker(testFn);

      expect(result).toBe(42);
      expect(metrics.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Export', () => {
    it('should export profile as JSON', () => {
      profiler.start();

      for (let i = 0; i < 10; i++) {
        profiler.captureSnapshot();
      }

      profiler.stop();

      const exported = profiler.exportProfile();

      expect(exported).toBeDefined();
      expect(() => JSON.parse(exported)).not.toThrow();

      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('startTime');
      expect(parsed).toHaveProperty('samples');
    });
  });
});

describe('StatisticalSampler', () => {
  describe('Basic Sampling', () => {
    it('should add samples', () => {
      const sampler = new StatisticalSampler<number>({ maxSize: 100 });

      sampler.add(10);
      sampler.add(20);
      sampler.add(30);

      expect(sampler.getSamples().length).toBe(3);
      expect(sampler.getCount()).toBe(3);
    });

    it('should add multiple samples', () => {
      const sampler = new StatisticalSampler<number>({ maxSize: 100 });

      sampler.addAll([1, 2, 3, 4, 5]);

      expect(sampler.getSamples().length).toBe(5);
    });

    it('should limit samples to maxSize', () => {
      const sampler = new StatisticalSampler<number>({ maxSize: 5 });

      for (let i = 0; i < 10; i++) {
        sampler.add(i);
      }

      expect(sampler.getSamples().length).toBeLessThanOrEqual(5);
    });
  });

  describe('Statistics', () => {
    it('should calculate statistics', () => {
      const sampler = new StatisticalSampler<number>({ maxSize: 100 });

      sampler.addAll([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      const stats = sampler.getStatistics();

      expect(stats.count).toBe(10);
      expect(stats.mean).toBe(5.5);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(10);
      expect(stats.median).toBeCloseTo(5.5);
    });

    it('should calculate percentiles', () => {
      const sampler = new StatisticalSampler<number>({ maxSize: 100 });

      for (let i = 1; i <= 100; i++) {
        sampler.add(i);
      }

      const stats = sampler.getStatistics();

      expect(stats.percentile50).toBeCloseTo(50.5, 1);
      expect(stats.percentile95).toBeCloseTo(95, 1);
      expect(stats.percentile99).toBeCloseTo(99, 1);
    });

    it('should detect outliers', () => {
      const sampler = new StatisticalSampler<number>({ maxSize: 100 });

      // Add normal data
      for (let i = 0; i < 20; i++) {
        sampler.add(50);
      }

      // Add outliers
      sampler.add(1);
      sampler.add(100);

      const { outliers } = sampler.detectOutliers();

      expect(outliers.length).toBeGreaterThan(0);
    });

    it('should handle empty samples', () => {
      const sampler = new StatisticalSampler<number>({ maxSize: 100 });
      const stats = sampler.getStatistics();

      expect(stats.count).toBe(0);
      expect(stats.mean).toBe(0);
    });
  });

  describe('Reservoir Sampling', () => {
    it('should use reservoir sampling when exceeding maxSize', () => {
      const sampler = new StatisticalSampler<number>({ maxSize: 10, reservoirSize: 10 });

      for (let i = 0; i < 100; i++) {
        sampler.add(i);
      }

      const samples = sampler.getSamples();
      expect(samples.length).toBeLessThanOrEqual(10);
      expect(sampler.getCount()).toBe(100);
    });
  });

  describe('Export/Import', () => {
    it('should export to CSV', () => {
      const sampler = new StatisticalSampler<number>({ maxSize: 100 });

      sampler.addAll([1, 2, 3, 4, 5]);

      const csv = sampler.toCSV();

      expect(csv).toBe('1\n2\n3\n4\n5');
    });

    it('should import from CSV', () => {
      const csv = '1\n2\n3\n4\n5';
      const sampler = StatisticalSampler.fromCSV(csv, (line) => parseInt(line, 10));

      const samples = sampler.getSamples();
      expect(samples).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
