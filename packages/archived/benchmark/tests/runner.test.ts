/**
 * Benchmark Runner Tests
 * Comprehensive test suite for the benchmark runner
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BenchmarkRunner } from '../src/runner/index.js';

describe('BenchmarkRunner', () => {
  let runner: BenchmarkRunner;

  beforeEach(() => {
    runner = new BenchmarkRunner({
      warmupIterations: 2,
      iterations: 10,
      time: 100
    });
  });

  describe('addBenchmark', () => {
    it('should add a benchmark successfully', () => {
      const benchmark = {
        name: 'test-benchmark',
        fn: () => {}
      };

      runner.addBenchmark(benchmark);
      expect(runner.count()).toBe(1);
    });

    it('should throw when adding duplicate benchmark', () => {
      const benchmark = {
        name: 'test-benchmark',
        fn: () => {}
      };

      runner.addBenchmark(benchmark);
      expect(() => runner.addBenchmark(benchmark)).toThrow();
    });

    it('should add multiple benchmarks', () => {
      const benchmarks = [
        { name: 'bench1', fn: () => {} },
        { name: 'bench2', fn: () => {} },
        { name: 'bench3', fn: () => {} }
      ];

      runner.addBenchmarks(benchmarks);
      expect(runner.count()).toBe(3);
    });
  });

  describe('removeBenchmark', () => {
    it('should remove a benchmark', () => {
      const benchmark = {
        name: 'test-benchmark',
        fn: () => {}
      };

      runner.addBenchmark(benchmark);
      expect(runner.removeBenchmark('test-benchmark')).toBe(true);
      expect(runner.count()).toBe(0);
    });

    it('should return false when removing non-existent benchmark', () => {
      expect(runner.removeBenchmark('non-existent')).toBe(false);
    });
  });

  describe('getBenchmark', () => {
    it('should retrieve a benchmark by name', () => {
      const benchmark = {
        name: 'test-benchmark',
        fn: () => {}
      };

      runner.addBenchmark(benchmark);
      const retrieved = runner.getBenchmark('test-benchmark');
      expect(retrieved).toEqual(benchmark);
    });

    it('should return undefined for non-existent benchmark', () => {
      expect(runner.getBenchmark('non-existent')).toBeUndefined();
    });
  });

  describe('run', () => {
    it('should run all benchmarks and return suite', async () => {
      runner.addBenchmark({
        name: 'sync-benchmark',
        fn: () => {
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            sum += i;
          }
        }
      });

      runner.addBenchmark({
        name: 'async-benchmark',
        fn: async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      });

      const suite = await runner.run();

      expect(suite.name).toBe('benchmark-suite');
      expect(suite.results).toHaveLength(2);
      expect(suite.statistics.totalBenchmarks).toBe(2);
      expect(suite.statistics.successful).toBe(2);
      expect(suite.statistics.failed).toBe(0);
    });

    it('should handle benchmark errors gracefully', async () => {
      runner.addBenchmark({
        name: 'failing-benchmark',
        fn: () => {
          throw new Error('Benchmark failed');
        }
      });

      const suite = await runner.run();

      expect(suite.results).toHaveLength(1);
      expect(suite.results[0].error).toBeInstanceOf(Error);
      expect(suite.statistics.failed).toBe(1);
    });

    it('should execute setup and teardown functions', async () => {
      let setupCalled = false;
      let teardownCalled = false;

      runner.addBenchmark({
        name: 'with-hooks',
        fn: () => {},
        setup: () => { setupCalled = true; },
        teardown: () => { teardownCalled = true; }
      });

      await runner.run();

      expect(setupCalled).toBe(true);
      expect(teardownCalled).toBe(true);
    });

    it('should execute beforeAll and afterAll functions', async () => {
      let beforeAllCalled = false;
      let afterAllCalled = false;

      runner.addBenchmark({
        name: 'with-all-hooks',
        fn: () => {},
        beforeAll: () => { beforeAllCalled = true; },
        afterAll: () => { afterAllCalled = true; }
      });

      await runner.run();

      expect(beforeAllCalled).toBe(true);
      expect(afterAllCalled).toBe(true);
    });
  });

  describe('event handlers', () => {
    it('should emit suite-start event', async () => {
      const handler = vi.fn();
      runner.on(handler);

      runner.addBenchmark({ name: 'test', fn: () => {} });
      await runner.run();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'suite-start' })
      );
    });

    it('should emit suite-end event', async () => {
      const handler = vi.fn();
      runner.on(handler);

      runner.addBenchmark({ name: 'test', fn: () => {} });
      await runner.run();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'suite-end' })
      );
    });

    it('should emit benchmark-start event', async () => {
      const handler = vi.fn();
      runner.on(handler);

      runner.addBenchmark({ name: 'test', fn: () => {} });
      await runner.run();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'benchmark-start',
          data: expect.objectContaining({ name: 'test' })
        })
      );
    });

    it('should emit benchmark-end event', async () => {
      const handler = vi.fn();
      runner.on(handler);

      runner.addBenchmark({ name: 'test', fn: () => {} });
      await runner.run();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'benchmark-end',
          data: expect.objectContaining({ name: 'test' })
        })
      );
    });

    it('should emit benchmark-error event on failure', async () => {
      const handler = vi.fn();
      runner.on(handler);

      runner.addBenchmark({
        name: 'failing',
        fn: () => { throw new Error('Failed'); }
      });

      await runner.run();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'benchmark-error',
          data: expect.objectContaining({ name: 'failing' })
        })
      );
    });

    it('should emit progress events', async () => {
      const handler = vi.fn();
      runner.on(handler);

      runner.addBenchmark({ name: 'test1', fn: () => {} });
      runner.addBenchmark({ name: 'test2', fn: () => {} });
      await runner.run();

      const progressEvents = handler.mock.calls.filter(
        call => call[0].type === 'progress'
      );

      expect(progressEvents.length).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all benchmarks', () => {
      runner.addBenchmark({ name: 'test1', fn: () => {} });
      runner.addBenchmark({ name: 'test2', fn: () => {} });

      runner.clear();
      expect(runner.count()).toBe(0);
    });
  });
});

describe('benchmark convenience function', () => {
  it('should run a single benchmark', async () => {
    const { benchmark } = await import('../src/runner/index.js');

    const result = await benchmark('simple-test', () => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += i;
      }
    }, { iterations: 10 });

    expect(result.name).toBe('simple-test');
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.mean).toBeGreaterThan(0);
  });
});

describe('suite convenience function', () => {
  it('should run multiple benchmarks', async () => {
    const { suite } = await import('../src/runner/index.js');

    const benchmarks = [
      { name: 'bench1', fn: () => {} },
      { name: 'bench2', fn: () => {} }
    ];

    const result = await suite(benchmarks, { iterations: 5 });

    expect(result.results).toHaveLength(2);
    expect(result.statistics.totalBenchmarks).toBe(2);
  });
});
