// Test setup file
import { ConfigManager } from '../src/core/config-manager';
import { TelemetryManager } from '../src/core/telemetry-manager';
import { ObservabilityPlatform } from '../src/core/observability-platform';

// Global test configuration
global.describe = global.describe || (() => {});
global.it = global.it || (() => {});
global.expect = global.expect || (() => {});

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Helper function to create test config
export function createTestConfig() {
  return {
    tracing: {
      serviceName: 'test-service',
      environment: 'test',
      samplingRate: 0.1,
      exporter: 'console'
    },
    metrics: {
      enabled: true,
      exportInterval: 1000
    },
    logging: {
      level: 'info',
      format: 'json',
      correlation: {
        enableTraceCorrelation: true
      },
      sampling: {
        enabled: true,
        rate: 1
      },
      retention: {
        enabled: true,
        maxAge: 3600000 // 1 hour
      }
    },
    alerting: {
      enabled: true,
      rules: []
    },
    healthChecks: {
      enabled: true,
      endpoint: '/health'
    }
  };
}

// Test database cleanup helper
export async function cleanupTestData() {
  // This would clean up test data from databases
  // For now, just return
  return Promise.resolve();
}

// Performance test helper
export async function measurePerformance<T>(
  fn: () => Promise<T> | T,
  iterations: number = 10
): Promise<{ result: T; averageTime: number; minTime: number; maxTime: number }> {
  const times: number[] = [];
  let result: T;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    result = await fn();
    const end = performance.now();
    times.push(end - start);
  }

  const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return { result, averageTime, minTime, maxTime };
}

// Stress test helper
export async function stressTest<T>(
  fn: () => Promise<T> | T,
  concurrent: number = 100,
  duration: number = 5000
): Promise<{ totalRuns: number; errors: any[]; averageTime: number }> {
  const startTime = Date.now();
  const endTime = startTime + duration;
  const errors: any[] = [];
  let totalRuns = 0;
  const runTimes: number[] = [];

  const promises: Promise<void>[] = [];

  for (let i = 0; i < concurrent; i++) {
    promises.push(
      (async () => {
        while (Date.now() < endTime) {
          try {
            const start = performance.now();
            await fn();
            const end = performance.now();
            runTimes.push(end - start);
            totalRuns++;
          } catch (error) {
            errors.push(error);
          }
        }
      })()
    );
  }

  await Promise.all(promises);

  const averageTime = runTimes.length > 0
    ? runTimes.reduce((a, b) => a + b, 0) / runTimes.length
    : 0;

  return { totalRuns, errors, averageTime };
}