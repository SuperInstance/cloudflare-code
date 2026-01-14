/**
 * Cache Metrics Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheMetrics } from '../../src/cache/metrics.js';

describe('CacheMetrics', () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = new CacheMetrics({
      retentionPeriod: 60000,
      sampleInterval: 1000,
      enableRealTime: true,
      enableHistorical: true
    });
  });

  afterEach(() => {
    metrics.destroy();
  });

  describe('Recording Events', () => {
    it('should record cache hit', () => {
      metrics.recordHit(100, 1024);

      const stats = metrics.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should record cache miss', () => {
      metrics.recordMiss(200, 2048);

      const stats = metrics.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });

    it('should record stale hit', () => {
      metrics.recordStaleHit(150, 1024);

      const stats = metrics.getStats();
      expect(stats.staleHits).toBe(1);
    });

    it('should record bypass', () => {
      metrics.recordBypass(50, 512);

      const stats = metrics.getStats();
      expect(stats.bypasses).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should calculate hit rate correctly', () => {
      metrics.recordHit(100, 1024);
      metrics.recordHit(100, 1024);
      metrics.recordHit(100, 1024);
      metrics.recordMiss(200, 2048);

      const stats = metrics.getStats();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(75);
    });

    it('should calculate miss rate correctly', () => {
      metrics.recordHit(100, 1024);
      metrics.recordMiss(200, 2048);
      metrics.recordMiss(200, 2048);
      metrics.recordMiss(200, 2048);

      const stats = metrics.getStats();

      expect(stats.missRate).toBe(75);
    });

    it('should calculate average response time', () => {
      metrics.recordHit(100, 1024);
      metrics.recordHit(200, 1024);
      metrics.recordHit(300, 1024);

      const stats = metrics.getStats();

      expect(stats.avgResponseTime).toBe(200);
    });

    it('should track bandwidth', () => {
      metrics.recordHit(100, 1024);
      metrics.recordMiss(200, 2048);

      const stats = metrics.getStats();

      expect(stats.savedBandwidth).toBe(1024);
      expect(stats.totalBandwidth).toBe(2048);
    });

    it('should calculate compression ratio', () => {
      metrics.recordHit(100, 1024);
      metrics.recordMiss(200, 2048);

      const stats = metrics.getStats();

      expect(stats.compressionRatio).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Percentiles', () => {
    it('should calculate p50 correctly', () => {
      for (let i = 0; i < 100; i++) {
        metrics.recordHit(i * 10, 1024);
      }

      const report = metrics.getReport();

      expect(report.performance.p50).toBeGreaterThan(0);
    });

    it('should calculate p95 correctly', () => {
      for (let i = 0; i < 100; i++) {
        metrics.recordHit(i * 10, 1024);
      }

      const report = metrics.getReport();

      expect(report.performance.p95).toBeGreaterThan(report.performance.p50);
    });

    it('should calculate p99 correctly', () => {
      for (let i = 0; i < 100; i++) {
        metrics.recordHit(i * 10, 1024);
      }

      const report = metrics.getReport();

      expect(report.performance.p99).toBeGreaterThan(report.performance.p95);
    });
  });

  describe('Reports', () => {
    it('should generate metrics report', () => {
      metrics.recordHit(100, 1024);
      metrics.recordMiss(200, 2048);

      const report = metrics.getReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('stats');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('alerts');
    });

    it('should include period in report', () => {
      const report = metrics.getReport();

      expect(report.period.start).toBeInstanceOf(Date);
      expect(report.period.end).toBeInstanceOf(Date);
    });

    it('should detect performance alerts', () => {
      // Record slow responses
      for (let i = 0; i < 10; i++) {
        metrics.recordMiss(1500, 2048);
      }

      const report = metrics.getReport();

      expect(report.alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Snapshots', () => {
    it('should take snapshots', () => {
      metrics.recordHit(100, 1024);

      // Wait for snapshot interval
      return new Promise(resolve => {
        setTimeout(() => {
          const snapshots = metrics.getSnapshots();

          expect(snapshots.length).toBeGreaterThan(0);
          resolve(null);
        }, 1500);
      });
    });

    it('should limit snapshot count', () => {
      metrics.recordHit(100, 1024);

      const snapshots = metrics.getSnapshots(5);

      expect(snapshots.length).toBeLessThanOrEqual(5);
    });

    it('should include snapshot data', () => {
      metrics.recordHit(100, 1024);
      metrics.recordMiss(200, 2048);

      return new Promise(resolve => {
        setTimeout(() => {
          const snapshots = metrics.getSnapshots();

          if (snapshots.length > 0) {
            const snapshot = snapshots[0];

            expect(snapshot).toHaveProperty('timestamp');
            expect(snapshot).toHaveProperty('hits');
            expect(snapshot).toHaveProperty('misses');
            expect(snapshot).toHaveProperty('responseTimes');
          }

          resolve(null);
        }, 1500);
      });
    });
  });

  describe('Trends', () => {
    it('should calculate trends', () => {
      // Generate enough data for trends
      for (let i = 0; i < 25; i++) {
        metrics.recordHit(100 + i, 1024);
      }

      const report = metrics.getReport();

      expect(report.trends).toHaveProperty('hitRate');
      expect(report.trends).toHaveProperty('responseTime');
      expect(report.trends).toHaveProperty('bandwidth');
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      metrics.recordHit(100, 1024);
      metrics.recordMiss(200, 2048);

      metrics.reset();

      const stats = metrics.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.staleHits).toBe(0);
      expect(stats.bypasses).toBe(0);
    });

    it('should clear snapshots on reset', () => {
      metrics.recordHit(100, 1024);

      metrics.reset();

      const snapshots = metrics.getSnapshots();

      expect(snapshots.length).toBe(0);
    });

    it('should emit reset event', () => {
      let emitted = false;

      metrics.on('reset', () => {
        emitted = true;
      });

      metrics.reset();

      expect(emitted).toBe(true);
    });
  });

  describe('Events', () => {
    it('should emit hit event', () => {
      let emitted = false;

      metrics.on('hit', () => {
        emitted = true;
      });

      metrics.recordHit(100, 1024);

      expect(emitted).toBe(true);
    });

    it('should emit miss event', () => {
      let emitted = false;

      metrics.on('miss', () => {
        emitted = true;
      });

      metrics.recordMiss(200, 2048);

      expect(emitted).toBe(true);
    });

    it('should emit snapshot event', () => {
      let emitted = false;

      metrics.on('snapshot', () => {
        emitted = true;
      });

      return new Promise(resolve => {
        setTimeout(() => {
          expect(emitted).toBe(true);
          resolve(null);
        }, 1500);
      });
    });
  });

  describe('Destroy', () => {
    it('should remove all listeners', () => {
      metrics.on('hit', () => {});
      metrics.on('miss', () => {});

      metrics.destroy();

      expect(metrics.listenerCount('hit')).toBe(0);
      expect(metrics.listenerCount('miss')).toBe(0);
    });

    it('should clear snapshots', () => {
      metrics.recordHit(100, 1024);

      metrics.destroy();

      const snapshots = metrics.getSnapshots();

      expect(snapshots.length).toBe(0);
    });
  });
});
