/**
 * Playwright configuration for E2E tests
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'reports/e2e/html' }],
    ['json', { outputFile: 'reports/e2e/results.json' }],
    ['junit', { outputFile: 'reports/e2e/results.xml' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:8787',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10000,
    navigationTimeout: 30000
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] }
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8787',
    timeout: 120000,
    reuseExistingServer: !process.env.CI
  }
});
