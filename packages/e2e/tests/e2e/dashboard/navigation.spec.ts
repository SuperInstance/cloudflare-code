import { test, expect } from '@playwright/test';
import { TestHelpers } from '../../utils/test-helpers';

/**
 * Dashboard Navigation E2E Tests
 *
 * Tests dashboard layout, sidebar navigation, header functionality, and responsive design
 */

test.describe('Dashboard - Layout and Navigation', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
  });

  test('should display dashboard page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="header"]')).toBeVisible();
  });

  test('should display all navigation items', async ({ page }) => {
    const navItems = [
      'Dashboard',
      'Projects',
      'Chat',
      'Code',
      'Analytics',
      'Settings'
    ];

    for (const item of navItems) {
      await expect(page.locator(`[data-testid="nav-${item.toLowerCase()}"]`)).toBeVisible();
    }
  });

  test('should navigate to projects page', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');
    await page.waitForURL(/\/projects/);

    await expect(page.locator('h1')).toContainText('Projects');
  });

  test('should navigate to chat page', async ({ page }) => {
    await page.click('[data-testid="nav-chat"]');
    await page.waitForURL(/\/chat/);

    await expect(page.locator('h1')).toContainText('Chat');
  });

  test('should navigate to code page', async ({ page }) => {
    await page.click('[data-testid="nav-code"]');
    await page.waitForURL(/\/code/);

    await expect(page.locator('h1')).toContainText('Code');
  });

  test('should navigate to analytics page', async ({ page }) => {
    await page.click('[data-testid="nav-analytics"]');
    await page.waitForURL(/\/analytics/);

    await expect(page.locator('h1')).toContainText('Analytics');
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.click('[data-testid="nav-settings"]');
    await page.waitForURL(/\/settings/);

    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('should highlight active navigation item', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');

    const activeNavItem = page.locator('[data-testid="nav-projects"]');
    await expect(activeNavItem).toHaveClass(/active/);
  });

  test('should collapse sidebar', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"]');

    // Check initial state
    await expect(sidebar).toBeVisible();

    // Click collapse button
    await page.click('[data-testid="sidebar-toggle"]');

    // Check collapsed state
    await expect(sidebar).toHaveClass(/collapsed/);
  });

  test('should expand sidebar', async ({ page }) => {
    await page.click('[data-testid="sidebar-toggle"]');

    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toHaveClass(/collapsed/);

    // Click to expand
    await page.click('[data-testid="sidebar-toggle"]');

    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('should display user menu', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');

    await expect(page.locator('[data-testid="user-dropdown"]')).toBeVisible();
    await expect(page.locator('button:has-text("Profile")')).toBeVisible();
    await expect(page.locator('button:has-text("Settings")')).toBeVisible();
    await expect(page.locator('button:has-text("Logout")')).toBeVisible();
  });

  test('should close user menu when clicking outside', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await expect(page.locator('[data-testid="user-dropdown"]')).toBeVisible();

    await page.click('body');
    await expect(page.locator('[data-testid="user-dropdown"]')).not.toBeVisible();
  });

  test('should display notifications bell', async ({ page }) => {
    await expect(page.locator('[data-testid="notifications"]')).toBeVisible();
  });

  test('should show notification dropdown', async ({ page }) => {
    await page.click('[data-testid="notifications"]');

    await expect(page.locator('[data-testid="notifications-dropdown"]')).toBeVisible();
  });

  test('should display search input', async ({ page }) => {
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
  });

  test('should perform search', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'test query');
    await page.press('[data-testid="search-input"]', 'Enter');

    await page.waitForURL(/search=/);
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should display breadcrumb navigation', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');
    await page.click('[data-testid="project-card"]:first-child');

    await expect(page.locator('[data-testid="breadcrumb"]')).toBeVisible();
    await expect(page.locator('[data-testid="breadcrumb"]')).toContainText('Projects');
  });

  test('should navigate using breadcrumbs', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');
    await page.click('[data-testid="project-card"]:first-child');

    await page.click('[data-testid="breadcrumb"] a:has-text("Projects")');

    await expect(page).toHaveURL(/\/projects/);
  });
});

test.describe('Dashboard - Responsive Design', () => {
  test('should work on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    // Sidebar should be hidden by default on mobile
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();

    // Hamburger menu should be visible
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
  });

  test('should show mobile menu when toggled', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    await page.click('[data-testid="mobile-menu-toggle"]');

    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });

  test('should hide mobile menu when item clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    await page.click('[data-testid="mobile-menu-toggle"]');
    await page.click('[data-testid="nav-projects"]');

    await expect(page.locator('[data-testid="mobile-menu"]')).not.toBeVisible();
  });

  test('should adjust layout on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    // Layout should be visible but optimized
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
  });

  test('should work on large screens', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    // Full layout should be visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="header"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
  });
});

test.describe('Dashboard - Stats Cards', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
  });

  test('should display stats cards', async ({ page }) => {
    await expect(page.locator('[data-testid="stats-cards"]')).toBeVisible();

    const cards = page.locator('[data-testid^="stat-card-"]');
    await expect(cards).toHaveCount(4);
  });

  test('should display projects count', async ({ page }) => {
    await expect(page.locator('[data-testid="stat-card-projects"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-card-projects"]')).toContainText('Projects');
  });

  test('should display chat messages count', async ({ page }) => {
    await expect(page.locator('[data-testid="stat-card-messages"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-card-messages"]')).toContainText('Messages');
  });

  test('should display code generations count', async ({ page }) => {
    await expect(page.locator('[data-testid="stat-card-generations"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-card-generations"]')).toContainText('Generations');
  });

  test('should display active sessions count', async ({ page }) => {
    await expect(page.locator('[data-testid="stat-card-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-card-sessions"]')).toContainText('Sessions');
  });

  test('should show trend indicators', async ({ page }) => {
    const trends = page.locator('[data-testid^="trend-"]');
    await expect(trends.first()).toBeVisible();
  });

  test('should navigate to detailed view on card click', async ({ page }) => {
    await page.click('[data-testid="stat-card-projects"]');

    await expect(page).toHaveURL(/\/projects/);
  });
});

test.describe('Dashboard - Recent Activity', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
  });

  test('should display recent activity section', async ({ page }) => {
    await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
  });

  test('should display activity items', async ({ page }) => {
    const activities = page.locator('[data-testid^="activity-item-"]');
    await expect(activities.first()).toBeVisible();
  });

  test('should show activity timestamp', async ({ page }) => {
    const firstActivity = page.locator('[data-testid^="activity-item-"]').first();
    await expect(firstActivity.locator('[data-testid="timestamp"]')).toBeVisible();
  });

  test('should show activity description', async ({ page }) => {
    const firstActivity = page.locator('[data-testid^="activity-item-"]').first();
    await expect(firstActivity.locator('[data-testid="description"]')).toBeVisible();
  });

  test('should link to related resource', async ({ page }) => {
    const firstActivity = page.locator('[data-testid^="activity-item-"]').first();

    await firstActivity.click();

    // Should navigate somewhere
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/dashboard$/);
  });

  test('should load more activities on scroll', async ({ page }) => {
    const initialCount = await page.locator('[data-testid^="activity-item-"]').count();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const finalCount = await page.locator('[data-testid^="activity-item-"]').count();
    expect(finalCount).toBeGreaterThanOrEqual(initialCount);
  });
});

test.describe('Dashboard - Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
  });

  test('should display quick actions', async ({ page }) => {
    await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible();
  });

  test('should have new project button', async ({ page }) => {
    await expect(page.locator('button:has-text("New Project")')).toBeVisible();
  });

  test('should have new chat button', async ({ page }) => {
    await expect(page.locator('button:has-text("New Chat")')).toBeVisible();
  });

  test('should have generate code button', async ({ page }) => {
    await expect(page.locator('button:has-text("Generate Code")')).toBeVisible();
  });

  test('should navigate to new project', async ({ page }) => {
    await page.click('button:has-text("New Project")');

    await expect(page).toHaveURL(/\/projects\/new/);
  });

  test('should navigate to new chat', async ({ page }) => {
    await page.click('button:has-text("New Chat")');

    await expect(page).toHaveURL(/\/chat/);
  });

  test('should navigate to code editor', async ({ page }) => {
    await page.click('button:has-text("Generate Code")');

    await expect(page).toHaveURL(/\/code/);
  });
});

test.describe('Dashboard - Performance', () => {
  test('should load quickly', async ({ page }) => {
    const startTime = Date.now();

    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    const loadTime = Date.now() - startTime;

    // Dashboard should load in less than 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should not have layout shift', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for layout stability (CLS)
    const cls = await page.evaluate(() => {
      return performance.getEntriesByType('layout-shift')
        .reduce((sum: number, entry: any) => sum + entry.value, 0);
    });

    expect(cls).toBeLessThan(0.1);
  });

  test('should have good LCP', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    await page.waitForLoadState('networkidle');

    const lcp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint');
      const lcpEntry = entries[entries.length - 1];
      return lcpEntry ? lcpEntry.startTime : 0;
    });

    // LCP should be less than 2.5 seconds
    expect(lcp).toBeLessThan(2500);
  });
});
