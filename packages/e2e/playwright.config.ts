import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E Testing Configuration
 *
 * Supports:
 * - Multi-browser testing (Chromium, Firefox, WebKit)
 * - Mobile emulation
 * - Visual regression testing
 * - API testing
 * - Parallel execution
 * - Reporting and metrics
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers on CI
  workers: process.env.CI ? 4 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    ['line'],
    ['github']
  ],

  // Shared settings for all tests
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot configuration
    screenshot: 'only-on-failure',

    // Video configuration
    video: 'retain-on-failure',

    // Browser locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York',

    // Extra HTTP headers
    extraHTTPHeaders: {
      'X-Test-Environment': process.env.TEST_ENV || 'development'
    },

    // Action timeout
    actionTimeout: 10 * 1000,

    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Configure projects for different browsers and devices
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile testing
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },

    // API testing (no browser)
    {
      name: 'api-tests',
      testMatch: /.*\.api\.spec\.ts/,
      use: {},
    },

    // Visual regression tests
    {
      name: 'visual-regression',
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        screenshot: 'only-on-failure',
        video: 'off',
      },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Global setup and teardown
  globalSetup: path.join(__dirname, 'utils/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'utils/global-teardown.ts'),

  // Expect configuration
  expect: {
    // Timeout for expect assertions
    timeout: 5 * 1000,

    // Visual comparison options
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },

    // To match snapshots
    toMatchSnapshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },

  // Output directory
  outputDir: 'test-results/artifacts',

  // Test timeout
  timeout: 60 * 1000,
});
