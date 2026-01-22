/**
 * Performance E2E Tests
 *
 * Comprehensive performance and benchmark tests
 */

import { describe, it, expect } from 'vitest';
import {
  createBenchmarkSuite,
  createLoadTester,
  createStressTester,
  compareBenchmarks,
  PerformanceAssertions,
} from '../performance/benchmark';
import { TestDataGenerator, StringGenerator } from '../generators/data';

describe('Performance E2E Tests', () => {
  describe('Benchmarks', () => {
    it('should benchmark string generation', async () => {
      const suite = createBenchmarkSuite();

      const result = await suite.run({
        name: 'String Generation',
        fn: () => {
          StringGenerator.random(100);
        },
        iterations: 1000,
      });

      expect(result.avgTime).toBeLessThan(1);
      expect(result.throughput).toBeGreaterThan(1000);
    });

    it('should benchmark JSON serialization', async () => {
      const suite = createBenchmarkSuite();

      const data = TestDataGenerator.forCache(100);

      const result = await suite.run({
        name: 'JSON Serialization',
        fn: () => {
          JSON.stringify(data);
        },
        iterations: 1000,
      });

      expect(result.avgTime).toBeLessThan(10);
    });

    it('should benchmark JSON deserialization', async () => {
      const suite = createBenchmarkSuite();

      const json = JSON.stringify(TestDataGenerator.forCache(100));

      const result = await suite.run({
        name: 'JSON Deserialization',
        fn: () => {
          JSON.parse(json);
        },
        iterations: 1000,
      });

      expect(result.avgTime).toBeLessThan(10);
    });

    it('should benchmark data generation', async () => {
      const suite = createBenchmarkSuite();

      const result = await suite.run({
        name: 'Data Generation',
        fn: () => {
          TestDataGenerator.forRAG(10);
        },
        iterations: 100,
      });

      expect(result.avgTime).toBeLessThan(100);
    });

    it('should compare two functions', async () => {
      const result = await compareBenchmarks(
        'String Random',
        () => StringGenerator.random(10),
        'String UUID',
        () => StringGenerator.uuid(),
        { iterations: 100 }
      );

      expect(result.winner).toBeDefined();
      expect(result.speedup).toBeGreaterThan(0);
    });
  });

  describe('Load Tests', () => {
    it('should sustain 1000 RPS for simple operations', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'Simple Operations',
        fn: async () => {
          StringGenerator.random(10);
        },
        requestsPerSecond: 1000,
        duration: 5000,
        concurrency: 100,
      });

      PerformanceAssertions.assertThroughput(result, 900);
      PerformanceAssertions.assertErrorRate(result, 1);
    });

    it('should sustain 100 RPS for complex operations', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'Complex Operations',
        fn: async () => {
          TestDataGenerator.forRAG(10);
        },
        requestsPerSecond: 100,
        duration: 5000,
        concurrency: 10,
      });

      PerformanceAssertions.assertThroughput(result, 90);
      PerformanceAssertions.assertErrorRate(result, 1);
    });

    it('should handle burst traffic', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'Burst Traffic',
        fn: async () => {
          StringGenerator.uuid();
        },
        requestsPerSecond: 5000,
        duration: 1000,
        concurrency: 500,
      });

      expect(result.totalRequests).toBeGreaterThan(4000);
      PerformanceAssertions.assertErrorRate(result, 5);
    });
  });

  describe('Stress Tests', () => {
    it('should find max sustained concurrency', async () => {
      const tester = createStressTester();

      const result = await tester.run({
        name: 'Max Concurrency',
        fn: async () => {
          StringGenerator.random(100);
        },
        startConcurrency: 10,
        maxConcurrency: 1000,
        stepDuration: 1000,
        stepIncrement: 50,
        maxErrorRate: 5,
      });

      expect(result.maxSustainedConcurrency).toBeGreaterThan(50);
      expect(result.breakpoints.length).toBeGreaterThan(0);
    });

    it('should handle gradual ramp-up', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'Ramp-up Test',
        fn: async () => {
          StringGenerator.paragraph(2);
        },
        requestsPerSecond: 100,
        duration: 10000,
        concurrency: 50,
        rampUp: 5000,
      });

      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.errorRate).toBeLessThan(10);
    });
  });

  describe('Memory Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const suite = createBenchmarkSuite();

      const result = await suite.run({
        name: 'Large Dataset',
        fn: () => {
          const data = TestDataGenerator.forRAG(1000);
          return data;
        },
        iterations: 10,
        collectMemory: true,
      });

      expect(result.avgTime).toBeLessThan(1000);
      if (result.memoryUsage) {
        expect(result.memoryUsage.used).toBeLessThan(100 * 1024 * 1024); // < 100MB
      }
    });

    it('should not leak memory over iterations', async () => {
      const suite = createBenchmarkSuite();

      const result1 = await suite.run({
        name: 'Memory Test 1',
        fn: () => {
          const data = TestDataGenerator.forCache(100);
          return data;
        },
        iterations: 100,
        collectMemory: true,
      });

      const result2 = await suite.run({
        name: 'Memory Test 2',
        fn: () => {
          const data = TestDataGenerator.forCache(100);
          return data;
        },
        iterations: 100,
        collectMemory: true,
      });

      if (result1.memoryUsage && result2.memoryUsage) {
        const ratio = result2.memoryUsage.used / result1.memoryUsage.used;
        expect(ratio).toBeLessThan(2); // Memory should not double
      }
    });
  });

  describe('Concurrency Performance', () => {
    it('should handle concurrent data generation', async () => {
      const suite = createBenchmarkSuite();

      const result = await suite.run({
        name: 'Concurrent Generation',
        fn: async () => {
          const promises = [];
          for (let i = 0; i < 10; i++) {
            promises.push(
              new Promise((resolve) => {
                resolve(TestDataGenerator.forSessions(10));
              })
            );
          }
          await Promise.all(promises);
        },
        iterations: 100,
      });

      expect(result.avgTime).toBeLessThan(1000);
    });

    it('should scale with concurrency', async () => {
      const tester = createLoadTester();

      const result1 = await tester.run({
        name: 'Concurrency 10',
        fn: async () => {
          StringGenerator.paragraph(1);
        },
        requestsPerSecond: 100,
        duration: 3000,
        concurrency: 10,
      });

      const result2 = await tester.run({
        name: 'Concurrency 50',
        fn: async () => {
          StringGenerator.paragraph(1);
        },
        requestsPerSecond: 100,
        duration: 3000,
        concurrency: 50,
      });

      // Higher concurrency should process more requests
      expect(result2.totalRequests).toBeGreaterThan(result1.totalRequests * 0.8);
    });
  });

  describe('Latency Percentiles', () => {
    it('should maintain low p50 latency', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'P50 Latency Test',
        fn: async () => {
          StringGenerator.random(50);
        },
        requestsPerSecond: 100,
        duration: 5000,
        concurrency: 20,
      });

      PerformanceAssertions.assertLatency(result, 100);
      expect(result.p50).toBeLessThan(50);
    });

    it('should maintain low p95 latency', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'P95 Latency Test',
        fn: async () => {
          StringGenerator.random(50);
        },
        requestsPerSecond: 100,
        duration: 5000,
        concurrency: 20,
      });

      expect(result.p95).toBeLessThan(100);
    });

    it('should maintain low p99 latency', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'P99 Latency Test',
        fn: async () => {
          StringGenerator.random(50);
        },
        requestsPerSecond: 100,
        duration: 5000,
        concurrency: 20,
      });

      expect(result.p99).toBeLessThan(200);
    });
  });

  describe('Throughput Tests', () => {
    it('should achieve target throughput', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'Throughput Test',
        fn: async () => {
          StringGenerator.random(10);
        },
        requestsPerSecond: 1000,
        duration: 5000,
        concurrency: 100,
      });

      expect(result.requestsPerSecond).toBeGreaterThan(900);
    });

    it('should scale throughput with concurrency', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'Scalability Test',
        fn: async () => {
          StringGenerator.random(10);
        },
        requestsPerSecond: 2000,
        duration: 3000,
        concurrency: 200,
      });

      expect(result.requestsPerSecond).toBeGreaterThan(1500);
    });
  });

  describe('Long-running Tests', () => {
    it('should sustain performance over time', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'Endurance Test',
        fn: async () => {
          StringGenerator.paragraph(2);
        },
        requestsPerSecond: 100,
        duration: 30000,
        concurrency: 20,
      });

      PerformanceAssertions.assertErrorRate(result, 5);
      expect(result.totalRequests).toBeGreaterThan(2500);
    });

    it('should not degrade under load', async () => {
      const tester = createLoadTester();

      const result = await tester.run({
        name: 'Stability Test',
        fn: async () => {
          StringGenerator.random(100);
        },
        requestsPerSecond: 200,
        duration: 20000,
        concurrency: 50,
      });

      // Error rate should remain low
      PerformanceAssertions.assertErrorRate(result, 5);

      // Average latency should remain reasonable
      expect(result.averageLatency).toBeLessThan(500);
    });
  });
});
