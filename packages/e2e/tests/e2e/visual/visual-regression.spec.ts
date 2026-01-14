import { test, expect } from '@playwright/test';

/**
 * Visual Regression E2E Tests
 *
 * Tests visual consistency across browsers and screen sizes
 */

test.describe('Visual Regression - Dashboard', () => {
  test('should match dashboard screenshot @chromium', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixels: 100,
      threshold: 0.2
    });
  });

  test('should match dashboard screenshot @firefox', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-firefox.png', {
      maxDiffPixels: 150,
      threshold: 0.3
    });
  });

  test('should match dashboard screenshot @webkit', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-webkit.png', {
      maxDiffPixels: 150,
      threshold: 0.3
    });
  });
});

test.describe('Visual Regression - Responsive Design', () => {
  test('should match mobile screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-mobile.png');
  });

  test('should match tablet screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-tablet.png');
  });

  test('should match desktop screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-desktop.png');
  });
});

test.describe('Visual Regression - Dark Mode', () => {
  test('should match dark mode screenshot', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Enable dark mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-dark.png');
  });
});

test.describe('Visual Regression - Components', () => {
  test('should match button component', async ({ page }) => {
    await page.goto('/components/button');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('button-component.png');
  });

  test('should match input component', async ({ page }) => {
    await page.goto('/components/input');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('input-component.png');
  });

  test('should match modal component', async ({ page }) => {
    await page.goto('/components/modal');
    await page.waitForLoadState('networkidle');

    await page.click('[data-testid="open-modal"]');

    await expect(page).toHaveScreenshot('modal-component.png');
  });
});
