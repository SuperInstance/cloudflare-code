/**
 * Benchmark Runner Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BenchmarkRunner, BenchmarkSuites } from '../src/index.js';

describe('BenchmarkRunner', () => {
  let runner: BenchmarkRunner;

  beforeEach(() => {
    runner = new BenchmarkRunner();
  });

  describe('Suite Registration', () => {
    it('should register a benchmark suite', () => {
      const suite = {
        name: 'test-suite',
        description: 'Test suite',
        benchmarks: [
          {
            name: 'test-bench',
            fn: () => {
              return 42;
            },
          },
        ],
      };

      runner.registerSuite(suite);

      // Should not throw when running
      await expect(runner.runSuite('test-suite')).resolves.toBeDefined();
    });

    it('should register multiple suites', () => {
      const suites = [
        {
          name: 'suite-1',
          description: 'Suite 1',
          benchmarks: [{ name: 'bench-1', fn: () => {} }],
        },
        {
          name: 'suite-2',
          description: 'Suite 2',
          benchmarks: [{ name: 'bench-2', fn: () => {} }],
        },
      ];

      runner.registerSuites(suites);

      const results1 = await runner.runSuite('suite-1');
      const results2 = await runner.runSuite('suite-2');

      expect(results1.length).toBe(1);
      expect(results2.length).toBe(1);
    });

    it('should throw error for unknown suite', async () => {
      await expect(runner.runSuite('unknown')).rejects.toThrow(
        'Benchmark suite not found'
      );
    });
  });

  describe('Benchmark Execution', () => {
    it('should run synchronous benchmark', async () => {
      runner.registerSuite({
        name: 'sync-test',
        description: 'Sync test',
        benchmarks: [
          {
            name: 'addition',
            fn: () => {
              1 + 1;
            },
          },
        ],
      });

      const results = await runner.runSuite('sync-test');

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('addition');
      expect(results[0].iterations).toBeGreaterThan(0);
      expect(results[0].avgTime).toBeGreaterThan(0);
    });

    it('should run async benchmark', async () => {
      runner.registerSuite({
        name: 'async-test',
        description: 'Async test',
        benchmarks: [
          {
            name: 'async-addition',
            fn: async () => {
              await Promise.resolve();
              1 + 1;
            },
          },
        ],
      });

      const results = await runner.runSuite('async-test');

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('async-addition');
      expect(results[0].iterations).toBeGreaterThan(0);
    });

    it('should skip benchmarks marked with skip', async () => {
      runner.registerSuite({
        name: 'skip-test',
        description: 'Skip test',
        benchmarks: [
          {
            name: 'skipped',
            fn: () => {},
            skip: true,
          },
          {
            name: 'not-skipped',
            fn: () => {},
          },
        ],
      });

      const results = await runner.runSuite('skip-test');

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('not-skipped');
    });

    it('should run setup and teardown hooks', async () => {
      let setupRan = false;
      let teardownRan = false;

      runner.registerSuite({
        name: 'hooks-test',
        description: 'Hooks test',
        setup: () => {
          setupRan = true;
        },
        teardown: () => {
          teardownRan = true;
        },
        benchmarks: [
          {
            name: 'test',
            fn: () => {},
          },
        ],
      });

      await runner.runSuite('hooks-test');

      expect(setupRan).toBe(true);
      expect(teardownRan).toBe(true);
    });
  });

  describe('Results', () => {
    it('should calculate benchmark statistics', async () => {
      runner.registerSuite({
        name: 'stats-test',
        description: 'Stats test',
        benchmarks: [
          {
            name: 'fast-operation',
            fn: () => {
              1 + 1;
            },
          },
        ],
      });

      const results = await runner.runSuite('stats-test');
      const result = results[0];

      expect(result.avgTime).toBeGreaterThan(0);
      expect(result.minTime).toBeGreaterThan(0);
      expect(result.maxTime).toBeGreaterThanOrEqual(result.minTime);
      expect(result.opsPerSecond).toBeGreaterThan(0);
      expect(result.samples).toBeDefined();
    });

    it('should store results by suite name', async () => {
      runner.registerSuite({
        name: 'storage-test',
        description: 'Storage test',
        benchmarks: [
          {
            name: 'test',
            fn: () => {},
          },
        ],
      });

      await runner.runSuite('storage-test');

      const stored = runner.getResults('storage-test');

      expect(stored).toBeDefined();
      expect(stored?.length).toBe(1);
    });

    it('should clear all results', async () => {
      runner.registerSuite({
        name: 'clear-test',
        description: 'Clear test',
        benchmarks: [
          {
            name: 'test',
            fn: () => {},
          },
        ],
      });

      await runner.runSuite('clear-test');
      expect(runner.getAllResults().size).toBe(1);

      runner.clearResults();
      expect(runner.getAllResults().size).toBe(0);
    });
  });

  describe('Comparison', () => {
    it('should compare two benchmark runs', async () => {
      const suite = {
        name: 'comparison-test',
        description: 'Comparison test',
        benchmarks: [
          {
            name: 'test',
            fn: () => {
              Math.random();
            },
          },
        ],
      };

      runner.registerSuite(suite);

      const baseline = await runner.runSuite('comparison-test');
      const current = await runner.runSuite('comparison-test');

      const comparison = runner.compare('comparison-test', baseline, current);

      expect(comparison.suite).toBe('comparison-test');
      expect(comparison.comparisons).toBeDefined();
      expect(comparison.summary).toBeDefined();
    });

    it('should calculate improvement percentage', async () => {
      const suite = {
        name: 'improvement-test',
        description: 'Improvement test',
        benchmarks: [
          {
            name: 'test',
            fn: () => {
              Math.random();
            },
          },
        ],
      };

      runner.registerSuite(suite);

      const baseline = await runner.runSuite('improvement-test');
      const current = await runner.runSuite('improvement-test');

      const comparison = runner.compare('improvement-test', baseline, current);

      if (comparison.comparisons.length > 0) {
        const comp = comparison.comparisons[0];
        expect(comp.improvement).toBeDefined();
        expect(comp.isFaster).toBeDefined();
      }
    });
  });

  describe('Report Generation', () => {
    it('should generate markdown report', async () => {
      runner.registerSuite({
        name: 'report-test',
        description: 'Report test',
        benchmarks: [
          {
            name: 'test',
            fn: () => {},
          },
        ],
      });

      await runner.runSuite('report-test');

      const report = runner.generateReport('report-test');

      expect(report).toContain('# Benchmark Report');
      expect(report).toContain('test');
      expect(report).toContain('|');
    });

    it('should export results as JSON', async () => {
      runner.registerSuite({
        name: 'export-test',
        description: 'Export test',
        benchmarks: [
          {
            name: 'test',
            fn: () => {},
          },
        ],
      });

      await runner.runSuite('export-test');

      const json = runner.exportResults('export-test');

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });
});

describe('BenchmarkSuites', () => {
  it('should return all predefined suites', () => {
    const suites = BenchmarkSuites.getAll();

    expect(suites.length).toBeGreaterThan(0);
    expect(suites.every((s) => s.name)).toBe(true);
    expect(suites.every((s) => s.benchmarks)).toBe(true);
  });

  it('should have string operations suite', () => {
    const suite = BenchmarkSuites.stringOperations();

    expect(suite.name).toBe('string-operations');
    expect(suite.benchmarks.length).toBeGreaterThan(0);
  });

  it('should have JSON operations suite', () => {
    const suite = BenchmarkSuites.jsonOperations();

    expect(suite.name).toBe('json-operations');
    expect(suite.benchmarks.length).toBeGreaterThan(0);
  });

  it('should have array operations suite', () => {
    const suite = BenchmarkSuites.arrayOperations();

    expect(suite.name).toBe('array-operations');
    expect(suite.benchmarks.length).toBeGreaterThan(0);
  });
});
