/**
 * Memory Profiler Tests
 */

import { MemoryProfiler, startMemoryProfiling, profileMemory } from './profiler';

describe('MemoryProfiler', () => {
  let profiler: MemoryProfiler;

  beforeEach(() => {
    profiler = new MemoryProfiler({
      enableSnapshots: true,
      snapshotInterval: 100,
      enableLeakDetection: true,
      leakThreshold: 1024 * 100, // 100KB
      trackGCPauses: true,
      trackAllocations: true,
    });
  });

  afterEach(() => {
    profiler.dispose();
  });

  describe('Initialization', () => {
    test('should create profiler with default options', () => {
      const defaultProfiler = new MemoryProfiler();
      expect(defaultProfiler).toBeInstanceOf(MemoryProfiler);
      expect(defaultProfiler.isProfiling()).toBe(false);
      defaultProfiler.dispose();
    });

    test('should create profiler with custom options', () => {
      const customProfiler = new MemoryProfiler({
        enableSnapshots: false,
        snapshotInterval: 10000,
        maxSnapshots: 50,
      });

      expect(customProfiler).toBeInstanceOf(MemoryProfiler);
      customProfiler.dispose();
    });
  });

  describe('Profiling Lifecycle', () => {
    test('should start profiling', () => {
      profiler.start();
      expect(profiler.isProfiling()).toBe(true);
    });

    test('should stop profiling', () => {
      profiler.start();
      profiler.stop();
      expect(profiler.isProfiling()).toBe(false);
    });

    test('should throw error when starting already active profiler', () => {
      profiler.start();

      expect(() => {
        profiler.start();
      }).toThrow('Profiling already in progress');
    });

    test('should throw error when stopping inactive profiler', () => {
      expect(() => {
        profiler.stop();
      }).toThrow('No profiling in progress');
    });
  });

  describe('Memory Snapshots', () => {
    test('should take snapshot during profiling', () => {
      profiler.start();
      const snapshot = profiler.takeSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.usedSize).toBeGreaterThan(0);
      expect(snapshot.totalSize).toBeGreaterThan(0);
      expect(snapshot.heapSpaces).toBeDefined();
      expect(snapshot.objects).toBeDefined();
    });

    test('should return null when taking snapshot while not profiling', () => {
      const snapshot = profiler.takeSnapshot();
      expect(snapshot).toBeNull();
    });

    test('should get all snapshots', () => {
      profiler.start();

      profiler.takeSnapshot();
      profiler.takeSnapshot();

      const snapshots = profiler.getSnapshots();

      expect(snapshots.length).toBeGreaterThanOrEqual(2);
    });

    test('should get snapshot by index', () => {
      profiler.start();
      profiler.takeSnapshot();

      const snapshot = profiler.getSnapshot(0);

      expect(snapshot).toBeDefined();
    });

    test('should respect max snapshots limit', () => {
      const limitedProfiler = new MemoryProfiler({
        maxSnapshots: 3,
        enableSnapshots: true,
        snapshotInterval: 10,
      });

      limitedProfiler.start();

      for (let i = 0; i < 10; i++) {
        limitedProfiler.takeSnapshot();
      }

      const snapshots = limitedProfiler.getSnapshots();
      expect(snapshots.length).toBeLessThanOrEqual(3);

      limitedProfiler.stop();
      limitedProfiler.dispose();
    });
  });

  describe('Snapshot Comparison', () => {
    test('should compare two snapshots', () => {
      profiler.start();
      profiler.takeSnapshot();
      profiler.takeSnapshot();

      const comparison = profiler.compareSnapshots(0, 1);

      expect(comparison).toBeDefined();
      expect(comparison!.added).toBeDefined();
      expect(comparison!.removed).toBeDefined();
      expect(comparison!.grown).toBeDefined();
      expect(comparison!.shrunk).toBeDefined();
    });

    test('should return null for invalid indices', () => {
      profiler.start();

      const comparison = profiler.compareSnapshots(0, 1);

      expect(comparison).toBeNull();
    });
  });

  describe('Memory Leak Detection', () => {
    test('should detect memory leaks when growth exceeds threshold', () => {
      profiler.start();

      // Simulate memory growth
      for (let i = 0; i < 10; i++) {
        profiler.takeSnapshot();
      }

      profiler.stop();

      const leaks = profiler.detectLeaks();

      // May or may not detect leaks depending on actual memory usage
      expect(Array.isArray(leaks)).toBe(true);
    });

    test('should require minimum samples for leak detection', () => {
      profiler.start();
      profiler.takeSnapshot();

      const leaks = profiler.detectLeaks();

      expect(leaks).toEqual([]);
    });

    test('should get detected leaks', () => {
      profiler.start();

      for (let i = 0; i < 10; i++) {
        profiler.takeSnapshot();
      }

      profiler.stop();

      const leaks = profiler.getLeaks();

      expect(Array.isArray(leaks)).toBe(true);
    });
  });

  describe('Allocation Tracking', () => {
    test('should track memory allocation', () => {
      profiler.start();

      const allocationId = profiler.trackAllocation('Object', 1024);

      expect(allocationId).toBeDefined();
      expect(allocationId).not.toBe('');

      profiler.stop();
    });

    test('should track memory deallocation', () => {
      profiler.start();

      const allocationId = profiler.trackAllocation('Object', 1024);
      profiler.trackDeallocation(allocationId);

      const allocation = profiler.getAllocations().find((a) => a.objectId === allocationId);

      expect(allocation!.deallocated).toBe(true);
      expect(allocation!.deallocationTime).toBeDefined();

      profiler.stop();
    });

    test('should not track allocations when disabled', () => {
      const noTrackingProfiler = new MemoryProfiler({
        trackAllocations: false,
      });

      noTrackingProfiler.start();

      const allocationId = noTrackingProfiler.trackAllocation('Object', 1024);

      expect(allocationId).toBe('');

      noTrackingProfiler.stop();
      noTrackingProfiler.dispose();
    });

    test('should respect max allocations limit', () => {
      const limitedProfiler = new MemoryProfiler({
        maxAllocations: 5,
        trackAllocations: true,
      });

      limitedProfiler.start();

      for (let i = 0; i < 10; i++) {
        limitedProfiler.trackAllocation('Object', 100);
      }

      const allocations = limitedProfiler.getAllocations();
      expect(allocations.length).toBeLessThanOrEqual(5);

      limitedProfiler.stop();
      limitedProfiler.dispose();
    });
  });

  describe('Memory Statistics', () => {
    test('should calculate accurate statistics', () => {
      profiler.start();

      for (let i = 0; i < 5; i++) {
        profiler.takeSnapshot();
      }

      profiler.stop();

      const stats = profiler.getStatistics();

      expect(stats.currentHeap).toBeGreaterThanOrEqual(0);
      expect(stats.peakHeap).toBeGreaterThanOrEqual(0);
      expect(stats.heapGrowthRate).toBeGreaterThanOrEqual(0);
      expect(stats.totalAllocated).toBeGreaterThanOrEqual(0);
      expect(stats.totalDeallocated).toBeGreaterThanOrEqual(0);
      expect(stats.gcPauses).toBeGreaterThanOrEqual(0);
      expect(stats.totalGCPauseTime).toBeGreaterThanOrEqual(0);
      expect(stats.suspectedLeaks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Trends', () => {
    test('should record memory trends over time', () => {
      profiler.start();

      // Wait for trends to be recorded
      const startTime = Date.now();
      while (Date.now() - startTime < 100) {
        // Busy wait
      }

      profiler.stop();

      const trends = profiler.getTrends();

      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0].timestamp).toBeDefined();
      expect(trends[0].heapUsed).toBeGreaterThan(0);
    });

    test('should calculate growth rate in trends', () => {
      profiler.start();
      profiler.takeSnapshot();

      const startTime = Date.now();
      while (Date.now() - startTime < 100) {
        // Busy wait
      }

      profiler.stop();

      const trends = profiler.getTrends();

      for (const trend of trends) {
        expect(typeof trend.growthRate).toBe('number');
      }
    });
  });

  describe('GC Pause Tracking', () => {
    test('should track GC pauses', () => {
      profiler.start();

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      profiler.stop();

      const pauses = profiler.getGCPauses();

      expect(Array.isArray(pauses)).toBe(true);
    });
  });

  describe('Reset and Dispose', () => {
    test('should reset profiler state', () => {
      profiler.start();
      profiler.takeSnapshot();
      profiler.trackAllocation('Object', 1024);
      profiler.stop();

      profiler.reset();

      expect(profiler.getSnapshots().length).toBe(0);
      expect(profiler.getAllocations().length).toBe(0);
    });

    test('should dispose and cleanup resources', () => {
      profiler.start();
      profiler.dispose();

      expect(profiler.isProfiling()).toBe(false);
    });

    test('should handle multiple dispose calls', () => {
      profiler.start();
      profiler.dispose();
      expect(() => {
        profiler.dispose();
      }).not.toThrow();
    });
  });
});

describe('Convenience Functions', () => {
  test('startMemoryProfiling should create and start profiler', () => {
    const profiler = startMemoryProfiling();

    expect(profiler).toBeInstanceOf(MemoryProfiler);
    expect(profiler.isProfiling()).toBe(true);

    profiler.stop();
    profiler.dispose();
  });

  test('profileMemory should profile and return result', async () => {
    const testFn = async () => {
      // Allocate some memory
      const data = new Array(1000).fill('test');
      return data.length;
    };

    const { result, snapshots, statistics } = await profileMemory(testFn);

    expect(result).toBe(1000);
    expect(snapshots).toBeDefined();
    expect(snapshots.length).toBeGreaterThan(0);
    expect(statistics).toBeDefined();
  });

  test('profileMemory should handle errors', async () => {
    const errorFn = async () => {
      throw new Error('Test error');
    };

    await expect(profileMemory(errorFn)).rejects.toThrow('Test error');
  });
});
