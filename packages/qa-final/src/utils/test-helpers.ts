/**
 * Test helper utilities for QA framework
 */

import { Page, APIRequestContext, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import type {
  TestContext,
  FixtureRegistry,
  RetryOptions,
  WaitOptions,
  PollOptions,
  TestConfig
} from './types';

/**
 * Create a test context with fixtures and utilities
 */
export async function createTestContext(
  page: Page,
  request: APIRequestContext,
  config: TestConfig
): Promise<TestContext> {
  return {
    page,
    request,
    fixtures: createFixtureRegistry(),
    config,
    metadata: new Map()
  };
}

/**
 * Create a fixture registry for managing test fixtures
 */
export function createFixtureRegistry(): FixtureRegistry {
  const fixtures = new Map<string, unknown>();

  return {
    get<T>(name: string): T {
      if (!this.has(name)) {
        throw new Error(`Fixture '${name}' not found`);
      }
      return fixtures.get(name) as T;
    },
    set<T>(name: string, value: T): void {
      fixtures.set(name, value);
    },
    has(name: string): boolean {
      return fixtures.has(name);
    },
    clear(): void {
      fixtures.clear();
    }
  };
}

/**
 * Retry a function with configurable options
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {
    maxAttempts: 3,
    delay: 1000,
    backoff: 'exponential'
  }
): Promise<T> {
  let lastError: Error | undefined;
  let delay = options.delay;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      options.onRetry?.(attempt, lastError);

      if (attempt < options.maxAttempts) {
        await sleep(delay);
        delay = options.backoff === 'exponential' ? delay * 2 : delay + options.delay;
      }
    }
  }

  throw lastError;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor<T>(
  condition: () => Promise<T> | T,
  options: WaitOptions = {}
): Promise<T> {
  const { timeout = 30000, interval = 100, message } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition();
      return result;
    } catch {
      await sleep(interval);
    }
  }

  throw new Error(message || `Condition not met within ${timeout}ms`);
}

/**
 * Poll for a value that meets a condition
 */
export async function poll<T>(
  fn: () => Promise<T> | T,
  options: PollOptions<T> = {}
): Promise<T> {
  const { condition, timeout = 30000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const value = await fn();
    if (condition(value)) {
      return value;
    }
    await sleep(interval);
  }

  throw new Error('Poll condition not met within timeout');
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${uuidv4()}`;
}

/**
 * Generate a random email for testing
 */
export function generateTestEmail(domain = 'example.com'): string {
  return `test-${uuidv4()}@${domain}`;
}

/**
 * Generate a random username for testing
 */
export function generateTestUsername(prefix = 'user'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Generate a random password for testing
 */
export function generateTestPassword(length = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * Generate random test data
 */
export function generateTestData<T extends object>(schema: Partial<T>): T {
  return schema as T;
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout = 30000,
  idleTime = 2000
): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
  await sleep(idleTime);
}

/**
 * Wait for selector to be visible
 */
export async function waitForSelector(
  page: Page,
  selector: string,
  options: { timeout?: number; state?: 'visible' | 'attached' | 'hidden' | 'detached' } = {}
) {
  const { timeout = 30000, state = 'visible' } = options;
  await page.waitForSelector(selector, { timeout, state });
}

/**
 * Click element with retry
 */
export async function clickWithRetry(
  page: Page,
  selector: string,
  options: { timeout?: number; retries?: number } = {}
): Promise<void> {
  const { timeout = 5000, retries = 3 } = options;

  await retry(async () => {
    await waitForSelector(page, selector, { timeout });
    await page.click(selector);
  }, { maxAttempts: retries, delay: 500 });
}

/**
 * Fill input with retry
 */
export async function fillWithRetry(
  page: Page,
  selector: string,
  value: string,
  options: { timeout?: number; retries?: number } = {}
): Promise<void> {
  const { timeout = 5000, retries = 3 } = options;

  await retry(async () => {
    await waitForSelector(page, selector, { timeout });
    await page.fill(selector, value);
  }, { maxAttempts: retries, delay: 500 });
}

/**
 * Navigate with timeout
 */
export async function navigateWithTimeout(
  page: Page,
  url: string,
  options: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' } = {}
): Promise<void> {
  const { timeout = 30000, waitUntil = 'networkidle' } = options;
  await page.goto(url, { timeout, waitUntil });
}

/**
 * Take screenshot with metadata
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean; path?: string } = {}
): Promise<string> {
  const { fullPage = true } = options;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  const path = options.path || `test-results/screenshots/${filename}`;

  await page.screenshot({ path, fullPage });
  return path;
}

/**
 * Get console logs from page
 */
export async function getConsoleLogs(page: Page): Promise<string[]> {
  const logs: string[] = [];

  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  return logs;
}

/**
 * Mock API response
 */
export function mockApiResponse(
  request: APIRequestContext,
  endpoint: string,
  response: unknown,
  status = 200
): void {
  // This would integrate with a mocking library
  // For now, it's a placeholder
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 30000 } = options;

  await page.waitForResponse(
    response => typeof urlPattern === 'string'
      ? response.url().includes(urlPattern)
      : urlPattern.test(response.url()),
    { timeout }
  );
}

/**
 * Measure execution time
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

/**
 * Assert element text content
 */
export async function assertTextContent(
  page: Page,
  selector: string,
  expectedText: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options;
  await waitForSelector(page, selector, { timeout });
  const element = page.locator(selector);
  await expect(element).toHaveText(expectedText);
}

/**
 * Assert element visibility
 */
export async function assertVisible(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options;
  await waitForSelector(page, selector, { timeout });
  const element = page.locator(selector);
  await expect(element).toBeVisible();
}

/**
 * Assert element is hidden
 */
export async function assertHidden(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options;
  const element = page.locator(selector);
  await expect(element).toBeHidden({ timeout });
}

/**
 * Get element count
 */
export async function getElementCount(
  page: Page,
  selector: string
): Promise<number> {
  return await page.locator(selector).count();
}

/**
 * Assert element count
 */
export async function assertElementCount(
  page: Page,
  selector: string,
  expectedCount: number,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options;

  await waitFor(async () => {
    const count = await getElementCount(page, selector);
    return count === expectedCount;
  }, { timeout, message: `Expected ${expectedCount} elements, found ${await getElementCount(page, selector)}` });
}

/**
 * Clear browser data
 */
export async function clearBrowserData(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.context().clearPermissions();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Set viewport size
 */
export async function setViewport(
  page: Page,
  width: number,
  height: number
): Promise<void> {
  await page.setViewportSize({ width, height });
}

/**
 * Mock geolocation
 */
export async function mockGeolocation(
  page: Page,
  latitude: number,
  longitude: number
): Promise<void> {
  const context = page.context();
  await context.setGeolocation({ latitude, longitude });
}

/**
 * Intercept network requests
 */
export async function interceptRequests(
  page: Page,
  urlPattern: string,
  handler: (route: any) => void
): Promise<void> {
  await page.route(urlPattern, handler);
}

/**
 * Get request metrics
 */
export async function getRequestMetrics(
  page: Page
): Promise<{ count: number; totalSize: number; averageDuration: number }> {
  const metrics = await page.evaluate(() => {
    // @ts-ignore
    const performance = window.performance || { getEntriesByType: () => [] };
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    let totalSize = 0;
    let totalDuration = 0;

    entries.forEach((entry: PerformanceResourceTiming) => {
      totalSize += entry.transferSize || 0;
      totalDuration += entry.duration || 0;
    });

    return {
      count: entries.length,
      totalSize,
      averageDuration: entries.length > 0 ? totalDuration / entries.length : 0
    };
  });

  return metrics;
}

/**
 * Generate test report data
 */
export function generateTestReportData(
  testName: string,
  status: 'passed' | 'failed' | 'skipped',
  duration: number,
  metadata?: Record<string, unknown>
) {
  return {
    id: generateTestId(),
    name: testName,
    status,
    duration,
    timestamp: new Date().toISOString(),
    metadata: metadata || {}
  };
}

/**
 * Batch operations
 */
export async function batch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Parallel execution with concurrency limit
 */
export async function parallel<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = fn(item).then(result => {
      results.push(result);
      // Remove from executing array when done
      executing.splice(executing.indexOf(promise), 1);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}
