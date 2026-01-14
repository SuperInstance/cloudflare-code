/**
 * Test utilities and helpers
 */

import { Job, JobDefinition, JobStatus, JobPriority, Logger } from '../../src/types';
import { CronParser } from '../../src/cron/parser';

/**
 * Create a mock logger
 */
export function createMockLogger(): Logger {
  const logs: { level: string; message: string; args: any[] }[] = [];

  return {
    debug: (message: string, ...args: any[]) => {
      logs.push({ level: 'debug', message, args });
    },
    info: (message: string, ...args: any[]) => {
      logs.push({ level: 'info', message, args });
    },
    warn: (message: string, ...args: any[]) => {
      logs.push({ level: 'warn', message, args });
    },
    error: (message: string, ...args: any[]) => {
      logs.push({ level: 'error', message, args });
    },
    getLogs: () => logs,
    clear: () => logs.splice(0, logs.length)
  } as any;
}

/**
 * Create a test job
 */
export function createTestJob(overrides?: Partial<Job>): Job {
  return {
    id: 'test-job-1',
    definitionId: 'test-definition',
    name: 'Test Job',
    status: JobStatus.PENDING,
    priority: JobPriority.NORMAL,
    scheduledTime: new Date(),
    attemptNumber: 1,
    maxAttempts: 3,
    dependencies: [],
    dependentJobs: [],
    metadata: {},
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create a test job definition
 */
export function createTestJobDefinition(overrides?: Partial<JobDefinition>): JobDefinition {
  return {
    id: 'test-definition',
    name: 'Test Definition',
    handler: async () => ({ success: true }),
    cronExpression: '0 * * * *',
    priority: JobPriority.NORMAL,
    ...overrides
  };
}

/**
 * Wait for a condition
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Create a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock storage implementation
 */
export function createMockStorage(): DurableObjectStorage {
  const data = new Map<string, any>();

  return {
    get: async (key: string) => data.get(key),
    put: async (key: string, value: any) => data.set(key, value),
    delete: async (key: string) => data.delete(key),
    list: async () => ({
      keys: Array.from(data.keys())
    }),
    getAlarm: async () => null,
    setAlarm: async () => {},
    deleteAlarm: async () => {},
    sync: async () => {},
    transaction: () => {
      throw new Error('Not implemented');
    }
  } as any;
}

/**
 * Validate cron expression helper
 */
export function validateCron(expression: string): boolean {
  const result = CronParser.validate(expression);
  return result.valid;
}

/**
 * Get next execution time helper
 */
export function getNextExecution(expression: string, from?: Date): Date {
  return CronParser.nextExecution(expression, from).timestamp;
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a mock abort controller
 */
export function createMockAbortController(): AbortController & {
  abortHistory: { timestamp: Date; reason: string }[];
} {
  const controller = new AbortController();
  (controller as any).abortHistory = [];

  const originalAbort = controller.abort.bind(controller);
  controller.abort = (reason?: any) => {
    (controller as any).abortHistory.push({
      timestamp: new Date(),
      reason: reason || 'aborted'
    });
    originalAbort(reason);
  };

  return controller as any;
}

/**
 * Measure execution time
 */
export async function measureTime<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

/**
 * Retry function with backoff
 */
export async function retry<T>(
  fn: () => Promise<T> | T,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Create a batch of test jobs
 */
export function createTestJobs(count: number, overrides?: Partial<Job>): Job[] {
  const jobs: Job[] = [];

  for (let i = 0; i < count; i++) {
    jobs.push(
      createTestJob({
        id: `test-job-${i}`,
        ...overrides
      })
    );
  }

  return jobs;
}

/**
 * Assert job status
 */
export function assertJobStatus(job: Job, expectedStatus: JobStatus): void {
  if (job.status !== expectedStatus) {
    throw new Error(
      `Expected job status ${expectedStatus}, got ${job.status}`
    );
  }
}

/**
 * Assert job priority
 */
export function assertJobPriority(job: Job, expectedPriority: JobPriority): void {
  if (job.priority !== expectedPriority) {
    throw new Error(
      `Expected job priority ${expectedPriority}, got ${job.priority}`
    );
  }
}

/**
 * Assert execution time within tolerance
 */
export function assertExecutionTime(
  actual: number,
  expected: number,
  tolerance: number = 100
): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `Expected execution time ${expected}ms ± ${tolerance}ms, got ${actual}ms`
    );
  }
}

/**
 * Create a spy function
 */
export function createSpy<T extends (...args: any[]) => any>(
  fn?: T
): T & { callCount: number; calls: any[][] } {
  const calls: any[][] = [];
  let callCount = 0;

  const spy = ((...args: any[]) => {
    calls.push(args);
    callCount++;
    return fn ? fn(...args) : undefined;
  }) as any;

  spy.callCount = 0;
  spy.calls = calls;

  return spy;
}

/**
 * Mock performance API
 */
export function mockPerformance() {
  const original = global.performance;

  global.performance = {
    ...original,
    now: () => Date.now()
  } as any;

  return () => {
    global.performance = original;
  };
}

/**
 * Create a test context
 */
export function createTestContext() {
  return {
    logger: createMockLogger(),
    storage: createMockStorage(),
    now: () => new Date()
  };
}

/**
 * Clean up test resources
 */
export async function cleanup(...resources: { stop?: () => Promise<void>; close?: () => Promise<void> }[]): Promise<void> {
  for (const resource of resources) {
    if (resource.stop) {
      await resource.stop();
    }
    if (resource.close) {
      await resource.close();
    }
  }
}
