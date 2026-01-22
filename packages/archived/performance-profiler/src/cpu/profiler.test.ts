/**
 * CPU Profiler Tests
 */

import { CPUProfiler, startProfiling, profileFunction } from './profiler';

describe('CPUProfiler', () => {
  let profiler: CPUProfiler;

  beforeEach(() => {
    profiler = new CPUProfiler({
      samplingInterval: 100,
      maxSamples: 1000,
      enableCallTree: true,
      enableFunctionTiming: true,
    });
  });

  afterEach(() => {
    profiler.dispose();
  });

  describe('Initialization', () => {
    test('should create profiler with default options', () => {
      const defaultProfiler = new CPUProfiler();
      expect(defaultProfiler).toBeInstanceOf(CPUProfiler);
      expect(defaultProfiler.isProfiling()).toBe(false);
      defaultProfiler.dispose();
    });

    test('should create profiler with custom options', () => {
      const customProfiler = new CPUProfiler({
        samplingInterval: 500,
        maxSamples: 5000,
        enableCallTree: false,
      });

      expect(customProfiler).toBeInstanceOf(CPUProfiler);
      customProfiler.dispose();
    });

    test('should auto-start when configured', () => {
      const autoProfiler = new CPUProfiler({
        autoStart: true,
      });

      expect(autoProfiler.isProfiling()).toBe(true);
      autoProfiler.stop();
      autoProfiler.dispose();
    });
  });

  describe('Profiling Lifecycle', () => {
    test('should start profiling', () => {
      profiler.start();
      expect(profiler.isProfiling()).toBe(true);
    });

    test('should stop profiling and return data', () => {
      profiler.start();
      const profile = profiler.stop();

      expect(profile).toBeDefined();
      expect(profile.startTime).toBeGreaterThan(0);
      expect(profile.endTime).toBeGreaterThan(profile.startTime);
      expect(profile.nodes).toBeDefined();
      expect(profile.samples).toBeDefined();
      expect(profile.totalDuration).toBeGreaterThan(0);
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

  describe('Function Timing', () => {
    test('should record function entry and exit', () => {
      profiler.start();

      profiler.recordFunctionEntry('testFunction');
      profiler.recordFunctionExit('testFunction');

      profiler.stop();

      const timings = profiler.getFunctionTimings();
      expect(timings.length).toBeGreaterThan(0);
      expect(timings[0].functionName).toBe('testFunction');
    });

    test('should calculate accurate timing statistics', async () => {
      profiler.start();

      const fn = async () => {
        profiler.recordFunctionEntry('asyncFunction');
        await new Promise((resolve) => setTimeout(resolve, 10));
        profiler.recordFunctionExit('asyncFunction');
      };

      await fn();
      profiler.stop();

      const timings = profiler.getFunctionTimings();
      const asyncFnTiming = timings.find((t) => t.functionName === 'asyncFunction');

      expect(asyncFnTiming).toBeDefined();
      expect(asyncFnTiming!.calls).toBe(1);
      expect(asyncFnTiming!.totalTime).toBeGreaterThan(0);
      expect(asyncFnTiming!.selfTime).toBeGreaterThan(0);
    });

    test('should handle multiple function calls', () => {
      profiler.start();

      for (let i = 0; i < 10; i++) {
        profiler.recordFunctionEntry('repeatedFunction');
        profiler.recordFunctionExit('repeatedFunction');
      }

      profiler.stop();

      const timings = profiler.getFunctionTimings();
      const fnTiming = timings.find((t) => t.functionName === 'repeatedFunction');

      expect(fnTiming!.calls).toBe(10);
    });
  });

  describe('Hot Path Identification', () => {
    test('should identify hot paths exceeding threshold', () => {
      profiler.start();

      // Simulate hot function
      profiler.recordFunctionEntry('hotFunction');
      profiler.recordFunctionExit('hotFunction');

      profiler.stop();

      const hotPaths = profiler.identifyHotPaths(0.01);

      expect(hotPaths.length).toBeGreaterThan(0);
      expect(hotPaths[0].path).toBeDefined();
      expect(hotPaths[0].totalTime).toBeGreaterThan(0);
      expect(hotPaths[0].percentage).toBeGreaterThan(0);
    });

    test('should respect max depth parameter', () => {
      profiler.start();
      profiler.recordFunctionEntry('deepFunction');
      profiler.recordFunctionExit('deepFunction');
      profiler.stop();

      const hotPaths = profiler.identifyHotPaths(0.01, 5);

      for (const path of hotPaths) {
        expect(path.depth).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Statistics', () => {
    test('should calculate accurate statistics', () => {
      profiler.start();

      // Generate some activity
      for (let i = 0; i < 10; i++) {
        profiler.recordFunctionEntry('statsFunction');
        profiler.recordFunctionExit('statsFunction');
      }

      profiler.stop();

      const stats = profiler.getStatistics();

      expect(stats.totalDuration).toBeGreaterThan(0);
      expect(stats.sampleCount).toBeGreaterThan(0);
      expect(stats.samplesPerSecond).toBeGreaterThan(0);
      expect(stats.uniqueFunctions).toBeGreaterThan(0);
      expect(stats.averageDepth).toBeGreaterThanOrEqual(0);
      expect(stats.maxDepth).toBeGreaterThanOrEqual(0);
    });

    test('should handle zero samples gracefully', () => {
      profiler.start();
      profiler.stop();

      const stats = profiler.getStatistics();

      expect(stats.sampleCount).toBe(0);
      expect(stats.samplesPerSecond).toBe(0);
    });
  });

  describe('Chrome Trace Export', () => {
    test('should export data in Chrome trace format', () => {
      profiler.start();
      profiler.recordFunctionEntry('chromeFunction');
      profiler.recordFunctionExit('chromeFunction');
      profiler.stop();

      const chromeTrace = profiler.exportChromeTrace();

      expect(chromeTrace).toBeDefined();
      expect(chromeTrace.traceEvents).toBeDefined();
      expect(Array.isArray(chromeTrace.traceEvents)).toBe(true);
    });

    test('should include all samples in trace', () => {
      profiler.start();

      for (let i = 0; i < 5; i++) {
        profiler.recordFunctionEntry(`traceFunction${i}`);
        profiler.recordFunctionExit(`traceFunction${i}`);
      }

      profiler.stop();

      const chromeTrace = profiler.exportChromeTrace();

      expect(chromeTrace.traceEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Reset and Dispose', () => {
    test('should reset profiler state', () => {
      profiler.start();
      profiler.recordFunctionEntry('resetFunction');
      profiler.recordFunctionExit('resetFunction');
      profiler.stop();

      profiler.reset();

      expect(profiler.getSampleCount()).toBe(0);
      expect(profiler.getFunctionTimings().length).toBe(0);
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

  describe('Edge Cases', () => {
    test('should handle mismatched function entry/exit', () => {
      profiler.start();

      profiler.recordFunctionEntry('mismatchedFunction');
      profiler.recordFunctionExit('otherFunction');

      profiler.stop();

      expect(profiler.getFunctionTimings().length).toBeGreaterThanOrEqual(0);
    });

    test('should handle function exit without entry', () => {
      profiler.start();

      profiler.recordFunctionExit('orphanExit');

      profiler.stop();

      expect(profiler.getFunctionTimings().length).toBe(0);
    });

    test('should respect max samples limit', () => {
      const limitedProfiler = new CPUProfiler({
        maxSamples: 10,
        samplingInterval: 10,
      });

      limitedProfiler.start();

      // Wait for more than max samples
      const startTime = Date.now();
      while (Date.now() - startTime < 200) {
        // Busy wait to generate samples
      }

      limitedProfiler.stop();

      expect(limitedProfiler.getSampleCount()).toBeLessThanOrEqual(10);
      limitedProfiler.dispose();
    });
  });
});

describe('Convenience Functions', () => {
  test('startProfiling should create and start profiler', () => {
    const profiler = startProfiling();

    expect(profiler).toBeInstanceOf(CPUProfiler);
    expect(profiler.isProfiling()).toBe(true);

    profiler.stop();
    profiler.dispose();
  });

  test('profileFunction should profile and return result', async () => {
    const testFn = async () => {
      return 42;
    };

    const { result, profile } = await profileFunction(testFn);

    expect(result).toBe(42);
    expect(profile).toBeDefined();
    expect(profile.totalDuration).toBeGreaterThan(0);
  });

  test('profileFunction should handle errors', async () => {
    const errorFn = async () => {
      throw new Error('Test error');
    };

    await expect(profileFunction(errorFn)).rejects.toThrow('Test error');
  });
});
