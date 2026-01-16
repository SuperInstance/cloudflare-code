/**
 * E2E test runner for ClaudeFlare
 */

// @ts-nocheck
import { Page, test, TestInfo } from '@playwright/test';
import type { E2ETestConfig, TestResult, TestSuite } from '../utils/types';
import { AuthenticatedContextFixture } from '../utils/fixtures';
import { measureTime } from '../utils/test-helpers';

/**
 * E2E test runner class
 */
export class E2ETestRunner {
  private config: E2ETestConfig;
  private results: TestResult[] = [];
  private startTime = 0;
  private endTime = 0;

  constructor(config: E2ETestConfig) {
    this.config = config;
  }

  /**
   * Setup E2E test environment
   */
  async setup(page: Page): Promise<void> {
    this.startTime = Date.now();

    // Navigate to base URL
    await page.goto(this.config.baseUrl);

    // Setup viewport if needed
    if (this.config.browser === 'chromium') {
      await page.setViewportSize({ width: 1920, height: 1080 });
    }
  }

  /**
   * Teardown E2E test environment
   */
  async teardown(page: Page): Promise<void> {
    this.endTime = Date.now();

    // Clear browser data
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Run E2E test
   */
  async runTest(
    testName: string,
    testFn: (page: Page) => Promise<void>,
    page: Page
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      await testFn(page);
      return {
        id: `e2e-${Date.now()}`,
        name: testName,
        status: 'passed',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        id: `e2e-${Date.now()}`,
        name: testName,
        status: 'failed',
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Get test results
   */
  getResults(): TestResult[] {
    return [...this.results];
  }

  /**
   * Get total duration
   */
  getTotalDuration(): number {
    return this.endTime - this.startTime;
  }
}

/**
 * Create authenticated E2E context
 */
export async function createAuthenticatedContext(
  page: Page,
  request: any,
  credentials: { username: string; password: string }
): Promise<AuthenticatedContextFixture> {
  const authFixture = new AuthenticatedContextFixture(page, request);

  // Login with credentials
  await page.goto('/login');
  await page.fill('[name="email"]', credentials.username);
  await page.fill('[name="password"]', credentials.password);
  await page.click('[type="submit"]');

  // Wait for navigation
  await page.waitForURL('/dashboard');

  // Setup authenticated state
  await authFixture.setup();

  return authFixture;
}

/**
 * E2E test helper function
 */
export function e2eTest(name: string, testFn: (page: Page) => Promise<void>) {
  test(name, async ({ page }) => {
    await testFn(page);
  });
}

/**
 * E2E test with authentication
 */
export function authenticatedE2eTest(
  name: string,
  testFn: (page: Page, auth: AuthenticatedContextFixture) => Promise<void>
) {
  test(name, async ({ page, request }) => {
    const credentials = {
      username: 'test@example.com',
      password: 'TestPassword123!'
    };

    const auth = await createAuthenticatedContext(page, request, credentials);
    await testFn(page, auth);
    await auth.cleanup();
  });
}

/**
 * E2E test with retries
 */
export function retryE2eTest(
  name: string,
  retries = 3,
  testFn: (page: Page) => Promise<void>
) {
  test.describe.configure({ retries });

  test(name, async ({ page }) => {
    await testFn(page);
  });
}

/**
 * E2E test with timeout
 */
export function timeoutE2eTest(
  name: string,
  timeout: number,
  testFn: (page: Page) => Promise<void>
) {
  test(name, async ({ page }) => {
    await test.setTimeout(timeout);
    await testFn(page);
  });
}

/**
 * E2E test suite
 */
export function e2eTestSuite(
  suiteName: string,
  tests: Record<string, (page: Page) => Promise<void>>
) {
  test.describe(suiteName, () => {
    for (const [testName, testFn] of Object.entries(tests)) {
      test(testName, async ({ page }) => {
        await testFn(page);
      });
    }
  });
}

/**
 * Measure E2E test performance
 */
export async function measureE2EPerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number; metrics: any }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;

  return {
    result,
    duration,
    metrics: {
      name,
      duration,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Capture E2E test artifacts
 */
export async function captureArtifacts(
  page: Page,
  testInfo: TestInfo,
  testName: string
): Promise<void> {
  // Screenshot
  const screenshotPath = testInfo.outputDir + `/${testName}-screenshot.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Console logs
  const logs = await page.evaluate(() => {
    // @ts-ignore
    return window.consoleLogs || [];
  });

  // Network logs
  const networkLogs = await page.evaluate(() => {
    // @ts-ignore
    return window.networkLogs || [];
  });

  // Store artifacts
  testInfo.attachments.push({
    name: 'screenshot',
    path: screenshotPath,
    contentType: 'image/png'
  });

  testInfo.attachments.push({
    name: 'console-logs',
    body: JSON.stringify(logs, null, 2),
    contentType: 'application/json'
  });

  testInfo.attachments.push({
    name: 'network-logs',
    body: JSON.stringify(networkLogs, null, 2),
    contentType: 'application/json'
  });
}
