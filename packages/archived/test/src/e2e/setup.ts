/**
 * E2E Test Setup
 *
 * Global test configuration and utilities
 */

import { beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { Env } from '@claudeflare/edge';

/**
 * Test environment registry
 */
export interface TestContext {
  env: Env;
  cleanupCallbacks: Array<() => Promise<void>>;
}

const contexts = new Map<string, TestContext>();

/**
 * Create test environment with isolated bindings
 */
export function createTestEnv(id: string = 'default'): Env {
  return {
    // KV Namespaces - isolated per test
    CACHE_KV: {
      get: async (key: string) => null,
      put: async (key: string, value: string) => undefined,
      delete: async (key: string) => undefined,
      list: async () => ({ keys: [], list_complete: true }),
    } as any,

    CONFIG_KV: {
      get: async (key: string) => null,
      put: async (key: string, value: string) => undefined,
      delete: async (key: string) => undefined,
      list: async () => ({ keys: [], list_complete: true }),
    } as any,

    KV: {
      get: async (key: string) => null,
      put: async (key: string, value: string) => undefined,
      delete: async (key: string) => undefined,
      list: async () => ({ keys: [], list_complete: true }),
    } as any,

    AGENTS_KV: {
      get: async (key: string) => null,
      put: async (key: string, value: string) => undefined,
      delete: async (key: string) => undefined,
      list: async () => ({ keys: [], list_complete: true }),
    } as any,

    // Durable Objects - namespaced with test ID
    SESSIONS: {
      idFromName: (name: string) => ({
        toString: () => `${id}-session-${name}`,
      }),
    } as any,

    DIRECTOR_DO: {
      idFromName: (name: string) => ({
        toString: () => `${id}-director-${name}`,
      }),
    } as any,

    PLANNER_DO: {
      idFromName: (name: string) => ({
        toString: () => `${id}-planner-${name}`,
      }),
    } as any,

    EXECUTOR_DO: {
      idFromName: (name: string) => ({
        toString: () => `${id}-executor-${name}`,
      }),
    } as any,

    AGENT_REGISTRY: {
      idFromName: (name: string) => ({
        toString: () => `${id}-registry-${name}`,
      }),
    } as any,

    VECTOR_DB: {
      idFromName: (name: string) => ({
        toString: () => `${id}-vector-${name}`,
      }),
    } as any,

    // R2 Storage
    STORAGE_R2: {
      get: async (key: string) => null,
      put: async (key: string, value: ReadableStream | Uint8Array) => undefined,
      delete: async (key: string) => undefined,
      list: async () => ({ objects: [], truncated: false }),
    } as any,

    // D1 Database
    DB: {
      prepare: (query: string) => ({
        bind: (...args: any[]) => ({
          all: async () => [],
          first: async () => null,
          run: async () => ({ success: true }),
        }),
        all: async () => [],
        first: async () => null,
        run: async () => ({ success: true }),
      }),
      batch: async (statements: any[]) => [],
      dump: async () => new Uint8Array(),
    } as any,

    // Environment
    ENVIRONMENT: 'test',
    API_VERSION: 'v1',

    // API Keys (mock)
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    OPENAI_API_KEY: 'test-openai-key',
    GROQ_API_KEY: 'test-groq-key',
    CEREBRAS_API_KEY: 'test-cerebras-key',
    OPENROUTER_API_KEY: 'test-openrouter-key',
    CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    CLOUDFLARE_API_TOKEN: 'test-api-token',
  };
}

/**
 * Get or create test context
 */
export function getTestContext(id: string = 'default'): TestContext {
  let ctx = contexts.get(id);
  if (!ctx) {
    ctx = {
      env: createTestEnv(id),
      cleanupCallbacks: [],
    };
    contexts.set(id, ctx);
  }
  return ctx;
}

/**
 * Register cleanup callback
 */
export function registerCleanup(id: string, callback: () => Promise<void>) {
  const ctx = getTestContext(id);
  ctx.cleanupCallbacks.push(callback);
}

/**
 * Cleanup test context
 */
export async function cleanupTestContext(id: string = 'default') {
  const ctx = contexts.get(id);
  if (!ctx) return;

  // Run cleanup callbacks in reverse order
  for (const callback of [...ctx.cleanupCallbacks].reverse()) {
    try {
      await callback();
    } catch (error) {
      console.error('Cleanup callback error:', error);
    }
  }

  ctx.cleanupCallbacks = [];
  contexts.delete(id);
}

/**
 * Global beforeAll hook
 */
beforeAll(async () => {
  console.log('[E2E] Initializing test environment...');
});

/**
 * Global afterAll hook
 */
afterAll(async () => {
  console.log('[E2E] Cleaning up all test contexts...');

  // Cleanup all contexts
  const cleanupPromises = Array.from(contexts.keys()).map((id) =>
    cleanupTestContext(id)
  );

  await Promise.all(cleanupPromises);

  console.log('[E2E] Test environment cleanup complete');
});

/**
 * Global beforeEach hook
 */
beforeEach(async (context) => {
  const testId = expect.getState().currentTestName || 'unknown';
  const ctx = getTestContext(testId);

  // Attach context to test
  (context as any).testEnv = ctx.env;
  (context as any).testContext = ctx;
});

/**
 * Global afterEach hook
 */
afterEach(async (context) => {
  const testId = expect.getState().currentTestName || 'unknown';
  await cleanupTestContext(testId);
});

/**
 * Wait for async operations
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry async operation with backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 100,
    backoff = 2,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        await wait(delay * Math.pow(backoff, attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Generate unique test ID
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Console group for test debugging
 */
export function createTestLogger(name: string) {
  return {
    group: () => console.log(`\n[${name}]`),
    log: (message: string, ...args: any[]) =>
      console.log(`[${name}]`, message, ...args),
    error: (message: string, ...args: any[]) =>
      console.error(`[${name}] ERROR:`, message, ...args),
    warn: (message: string, ...args: any[]) =>
      console.warn(`[${name}] WARN:`, message, ...args),
    endGroup: () => console.log(`\n[/${name}]`),
  };
}
