/**
 * Metrics Collector Tests
 * Comprehensive test suite for the metrics collector
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsCollector, collectMetricsDuring } from '../src/metrics/index.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({
      memory: true,
      cpu: true,
      io: false,
      gc: true,
      eventLoop: true,
      interval: 10,
      maxSamples: 100
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultCollector = new MetricsCollector();
      expect(defaultCollector).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const customCollector = new MetricsCollector({
        memory: false,
        cpu: false,
        interval: 50,
        maxSamples: 200
      });

      expect(customCollector).toBeDefined();
    });
  });

  describe('start and stop', () => {
    it('should start collecting metrics', () => {
      collector.start();
      expect(collector.getSampleNames().length).toBeGreaterThan(0);
      collector.stop();
    });

    it('should stop collecting metrics', () => {
      collector.start();
      collector.stop();

      const sampleCount = collector.getSamples('memory-heap-used')?.length || 0;
      expect(sampleCount).toBeGreaterThan(0);
    });

    it('should handle multiple start/stop cycles', () => {
      collector.start();
      collector.stop();

      collector.start();
      collector.stop();

      expect(collector).toBeDefined();
    });
  });

  describe('collect samples', () => {
    it('should collect memory metrics', async () => {
      collector.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      collector.stop();

      const memorySamples = collector.getSamples('memory-heap-used');
      expect(memorySamples).toBeDefined();
      expect(memorySamples.length).toBeGreaterThan(0);
      expect(memorySamples[0]).toBeGreaterThan(0);
    });

    it('should collect event loop metrics', async () => {
      collector.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      collector.stop();

      const eventLoopSamples = collector.getSamples('event-loop-lag');
      expect(eventLoopSamples).toBeDefined();
      expect(eventLoopSamples.length).toBeGreaterThan(0);
    });
  });

  describe('getMetrics', () => {
    it('should return collected metrics', async () => {
      collector.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      collector.stop();

      const metrics = await collector.getMetrics();

      expect(metrics.memory).toBeDefined();
      expect(metrics.cpu).toBeDefined();
      expect(metrics.io).toBeDefined();
      expect(metrics.gc).toBeDefined();
      expect(metrics.eventLoop).toBeDefined();
      expect(metrics.startTime).toBeGreaterThan(0);
      expect(metrics.endTime).toBeGreaterThan(0);
    });

    it('should calculate memory statistics correctly', async () => {
      collector.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      collector.stop();

      const metrics = await collector.getMetrics();

      expect(metrics.memory.heapUsed).toBeGreaterThan(0);
      expect(metrics.memory.heapTotal).toBeGreaterThan(0);
      expect(metrics.memory.rss).toBeGreaterThan(0);
    });

    it('should calculate event loop statistics correctly', async () => {
      collector.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      collector.stop();

      const metrics = await collector.getMetrics();

      expect(metrics.eventLoop.avgLag).toBeGreaterThanOrEqual(0);
      expect(metrics.eventLoop.maxLag).toBeGreaterThanOrEqual(0);
      expect(metrics.eventLoop.minLag).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getSamples', () => {
    it('should return samples for a specific metric', async () => {
      collector.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      collector.stop();

      const heapUsedSamples = collector.getSamples('memory-heap-used');
      expect(Array.isArray(heapUsedSamples)).toBe(true);
    });

    it('should return empty array for non-existent metric', () => {
      const samples = collector.getSamples('non-existent-metric');
      expect(samples).toEqual([]);
    });
  });

  describe('getSampleNames', () => {
    it('should return all sample names', async () => {
      collector.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      collector.stop();

      const names = collector.getSampleNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset the collector', async () => {
      collector.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      collector.stop();
      collector.reset();

      const samples = collector.getSamples('memory-heap-used');
      expect(samples).toEqual([]);
    });
  });
});

describe('collectMetricsDuring', () => {
  it('should collect metrics during function execution', async () => {
    const { result, metrics } = await collectMetricsDuring(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'test-result';
      },
      { interval: 10 }
    );

    expect(result).toBe('test-result');
    expect(metrics).toBeDefined();
    expect(metrics.memory).toBeDefined();
    expect(metrics.cpu).toBeDefined();
  });

  it('should handle function errors', async () => {
    await expect(
      collectMetricsDuring(
        async () => {
          throw new Error('Test error');
        },
        { interval: 10 }
      )
    ).rejects.toThrow('Test error');
  });

  it('should collect metrics for synchronous operations', async () => {
    const { result, metrics } = await collectMetricsDuring(
      () => {
        let sum = 0;
        for (let i = 0; i < 10000; i++) {
          sum += i;
        }
        return sum;
      },
      { interval: 1 }
    );

    expect(result).toBeDefined();
    expect(metrics).toBeDefined();
  });
});

describe('sampleMetrics and calculateMetricsDelta', () => {
  it('should calculate metrics delta between snapshots', async () => {
    const { snapshotMetrics, calculateMetricsDelta } = await import('../src/metrics/index.js');

    const start = snapshotMetrics();
    await new Promise(resolve => setTimeout(resolve, 50));
    const end = snapshotMetrics();

    const delta = calculateMetricsDelta(start, end);

    expect(delta.memory).toBeDefined();
    expect(delta.cpu).toBeDefined();
    expect(delta.duration).toBeGreaterThan(0);
  });

  it('should track memory changes', async () => {
    const { snapshotMetrics, calculateMetricsDelta } = await import('../src/metrics/index.js');

    const start = snapshotMetrics();

    // Allocate some memory
    const data = new Array(1000).fill('test string data');

    const end = snapshotMetrics();

    const delta = calculateMetricsDelta(start, end);

    expect(delta.memory.heapUsedDelta).toBeGreaterThan(0);

    // Clean up
    data.length = 0;
  });

  it('should track CPU usage', async () => {
    const { snapshotMetrics, calculateMetricsDelta } = await import('../src/metrics/index.js');

    const start = snapshotMetrics();

    // Do some CPU work
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
      sum += i;
    }

    const end = snapshotMetrics();

    const delta = calculateMetricsDelta(start, end);

    expect(delta.cpu.totalDelta).toBeGreaterThanOrEqual(0);
  });
});
