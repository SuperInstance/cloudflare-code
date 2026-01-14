/**
 * Utility functions and helpers for testing
 */

import { randomBytes } from 'crypto';

// ============================================================================
// String Utilities
// ============================================================================

export function generateId(length: number = 16): string {
  return randomBytes(length).toString('hex');
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function randomString(length: number = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function randomEmail(): string {
  return `${randomString(8)}@example.com`;
}

export function randomUrl(): string {
  return `https://${randomString(8)}.com`;
}

// ============================================================================
// Object Utilities
// ============================================================================

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }

  if (obj instanceof Map) {
    const cloned = new Map();
    for (const [key, value] of obj) {
      cloned.set(deepClone(key), deepClone(value));
    }
    return cloned as T;
  }

  if (obj instanceof Set) {
    const cloned = new Set();
    for (const value of obj) {
      cloned.add(deepClone(value));
    }
    return cloned as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      (cloned as any)[key] = deepClone((obj as any)[key]);
    }
  }

  return cloned;
}

export function deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (source === undefined) {
    return target;
  }

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        (target as any)[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        (target as any)[key] = sourceValue;
      }
    }
  }

  return deepMerge(target, ...sources);
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

// ============================================================================
// Async Utilities
// ============================================================================

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: number;
    timeout?: number;
  } = {}
): Promise<T> {
  const { retries = 3, delay: delayMs = 100, backoff = 2, timeout = 30000 } = options;
  let lastError: Error | undefined;

  const startTime = Date.now();

  for (let i = 0; i <= retries; i++) {
    try {
      return await Promise.race([
        fn(),
        timeout
          ? delay(timeout).then(() => {
              throw new Error(`Timeout after ${timeout}ms`);
            })
          : Promise.resolve(),
      ]);
    } catch (error) {
      lastError = error as Error;

      if (i < retries) {
        const waitTime = delayMs * Math.pow(backoff, i);
        await delay(waitTime);
      }

      if (timeout && Date.now() - startTime > timeout) {
        throw new Error(`Retry timeout exceeded after ${timeout}ms`);
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

export async function poll<T>(
  fn: () => Promise<T>,
  condition: (value: T) => boolean,
  options: {
    interval?: number;
    timeout?: number;
  } = {}
): Promise<T> {
  const { interval = 100, timeout = 5000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await fn();
    if (condition(result)) {
      return result;
    }
    await delay(interval);
  }

  throw new Error(`Poll timeout exceeded after ${timeout}ms`);
}

export function promiseAll<T extends unknown[]>(values: readonly [...T]): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  return Promise.all(values) as Promise<{ [K in keyof T]: Awaited<T[K]> }>;
}

export function promiseAllSettled<T extends unknown[]>(
  values: readonly [...T]
): Promise<Array<{ status: 'fulfilled'; value: Awaited<T[number]> } | { status: 'rejected'; reason: unknown }>> {
  return Promise.allSettled(values);
}

export function promiseRace<T extends unknown[]>(values: readonly [...T]): Promise<Awaited<T[number]>> {
  return Promise.race(values);
}

export function promiseAny<T extends unknown[]>(values: readonly [...T]): Promise<Awaited<T[number]>> {
  return Promise.any(values);
}

// ============================================================================
// HTTP Utilities
// ============================================================================

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export function createMockResponse(
  body: unknown,
  init: ResponseInit = {}
): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

export function createMockError(
  message: string,
  status: number = 500
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

// ============================================================================
// Test Data Generators
// ============================================================================

export function generateTestData<T>(schema: {
  [K in keyof T]?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'date' | 'array' | 'object';
}): T {
  const result = {} as T;

  for (const [key, type] of Object.entries(schema)) {
    switch (type) {
      case 'string':
        (result as any)[key] = randomString();
        break;
      case 'number':
        (result as any)[key] = Math.floor(Math.random() * 1000);
        break;
      case 'boolean':
        (result as any)[key] = Math.random() > 0.5;
        break;
      case 'email':
        (result as any)[key] = randomEmail();
        break;
      case 'url':
        (result as any)[key] = randomUrl();
        break;
      case 'uuid':
        (result as any)[key] = generateUUID();
        break;
      case 'date':
        (result as any)[key] = new Date().toISOString();
        break;
      case 'array':
        (result as any)[key] = [];
        break;
      case 'object':
        (result as any)[key] = {};
        break;
      default:
        (result as any)[key] = randomString();
    }
  }

  return result;
}

export function generateArray<T>(
  generator: () => T,
  length: number = Math.floor(Math.random() * 10) + 1
): T[] {
  return Array.from({ length }, generator);
}

// ============================================================================
// Assertion Helpers
// ============================================================================

export function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message || `Expected value to be defined, got ${value}`);
  }
}

export function assertInstanceOf<T>(
  value: unknown,
  constructor: { new (...args: unknown[]): T },
  message?: string
): asserts value is T {
  if (!(value instanceof constructor)) {
    throw new Error(
      message || `Expected value to be instance of ${constructor.name}, got ${value}`
    );
  }
}

// ============================================================================
// Performance Utilities
// ============================================================================

export function measureTime<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { result, duration: end - start };
}

export async function measureTimeAsync<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, duration: end - start };
}

export function measureMemory(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

// ============================================================================
// Environment Utilities
// ============================================================================

export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.JENKINS_HOME
  );
}

export function isDebug(): boolean {
  return process.env.NODE_ENV === 'debug' || process.env.DEBUG === 'true';
}

export function getTestTimeout(defaultTimeout: number = 5000): number {
  const timeout = process.env.TEST_TIMEOUT;
  return timeout ? parseInt(timeout, 10) : defaultTimeout;
}

// ============================================================================
// File System Utilities
// ============================================================================

export async function ensureDir(dir: string): Promise<void> {
  const { mkdir } = await import('fs/promises');
  await mkdir(dir, { recursive: true });
}

export async function clearDir(dir: string): Promise<void> {
  const { rm } = await import('fs/promises');
  await rm(dir, { recursive: true, force: true });
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    const { access } = await import('fs/promises');
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Worker Utilities
// ============================================================================

export function createMockEnv<T extends Record<string, unknown>>(bindings: T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      return bindings[prop as string];
    },
    has(_target, prop) {
      return prop in bindings;
    },
  });
}

export function createMockRequest(
  url: string,
  options: Partial<Request> = {}
): Request {
  return new Request(url, {
    method: 'GET',
    headers: {},
    ...options,
  });
}

export function createMockExecutionContext(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  };
}
