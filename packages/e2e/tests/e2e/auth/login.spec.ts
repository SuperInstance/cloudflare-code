import { test, expect } from '@playwright/test';
import { TestHelpers, TestDataGenerator } from '../../utils/test-helpers';

/**
 * Authentication E2E Tests
 *
 * Tests user login, logout, registration, and session management
 */

test.describe('Authentication - Login Flow', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.locator('h1')).toContainText('Sign In');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';

    await helpers.login(email, password);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show error with invalid email', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error"]')).toContainText('Invalid email');
  });

  test('should show error with empty fields', async ({ page }) => {
    await page.goto('/auth/login');
    await page.click('button[type="submit"]');

    await expect(page.locator('input[name="email"]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('input[name="password"]')).toHaveAttribute('aria-invalid', 'true');
  });

  test('should show error with wrong password', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error"]')).toContainText('Invalid credentials');
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';

    await helpers.login(email, password);

    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should remember me checkbox work', async ({ page }) => {
    await page.goto('/auth/login');

    const rememberCheckbox = page.locator('input[name="remember"]');
    await expect(rememberCheckbox).not.toBeChecked();

    await rememberCheckbox.check();
    await expect(rememberCheckbox).toBeChecked();
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/auth/login');

    const passwordInput = page.locator('input[name="password"]');
    const toggleButton = page.locator('[data-testid="toggle-password"]');

    await expect(passwordInput).toHaveAttribute('type', 'password');

    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should navigate to forgot password', async ({ page }) => {
    await page.goto('/auth/login');
    await page.click('a[href="/auth/forgot-password"');

    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.locator('h1')).toContainText('Forgot Password');
  });

  test('should navigate to registration', async ({ page }) => {
    await page.goto('/auth/login');
    await page.click('a[href="/auth/register"');

    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('h1')).toContainText('Sign Up');
  });

  test('should handle network error gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/auth/login', route => route.abort());

    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error"]')).toContainText('Network error');
  });

  test('should disable submit button during submission', async ({ page }) => {
    // Slow down the response
    await page.route('**/api/auth/login', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.continue();
    });

    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toContainText('Signing in...');
  });
});

test.describe('Authentication - Registration Flow', () => {
  test('should display registration page', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.locator('h1')).toContainText('Sign Up');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
  });

  test('should register with valid data', async ({ page }) => {
    const userData = {
      name: 'Test User',
      email: TestDataGenerator.email(),
      password: TestDataGenerator.password()
    };

    await page.goto('/auth/register');
    await page.fill('input[name="name"]', userData.name);
    await page.fill('input[name="email"]', userData.email);
    await page.fill('input[name="password"]', userData.password);
    await page.fill('input[name="confirmPassword"]', userData.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/auth/register');
    await page.fill('input[name="email"]', 'invalid-email');
    await page.blur('input[name="email"]');

    await expect(page.locator('[data-testid="email-error"]')).toContainText('Invalid email format');
  });

  test('should validate password strength', async ({ page }) => {
    await page.goto('/auth/register');
    await page.fill('input[name="password"]', 'weak');
    await page.blur('input[name="password"]');

    await expect(page.locator('[data-testid="password-error"]')).toContainText('Password is too weak');
  });

  test('should validate password confirmation', async ({ page }) => {
    await page.goto('/auth/register');
    await page.fill('input[name="password"]', 'StrongPass123!');
    await page.fill('input[name="confirmPassword"]', 'DifferentPass123!');
    await page.blur('input[name="confirmPassword"]');

    await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText('Passwords do not match');
  });

  test('should accept terms and conditions checkbox', async ({ page }) => {
    await page.goto('/auth/register');

    const termsCheckbox = page.locator('input[name="terms"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(submitButton).toBeDisabled();

    await termsCheckbox.check();
    await expect(submitButton).toBeEnabled();
  });

  test('should show existing user error', async ({ page }) => {
    const existingEmail = 'existing@example.com';

    await page.goto('/auth/register');
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', existingEmail);
    await page.fill('input[name="password"]', 'StrongPass123!');
    await page.fill('input[name="confirmPassword"]', 'StrongPass123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error"]')).toContainText('User already exists');
  });
});

test.describe('Authentication - Logout Flow', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
  });

  test('should logout successfully', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("Logout")');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1')).toContainText('Sign In');
  });

  test('should clear session data on logout', async ({ page }) => {
    // Check localStorage is cleared
    const localStorageBefore = await page.evaluate(() => Object.keys(localStorage));

    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("Logout")');

    const localStorageAfter = await page.evaluate(() => Object.keys(localStorage));

    expect(localStorageAfter.length).toBeLessThan(localStorageBefore.length);
  });

  test('should require login after logout', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("Logout")');

    // Try to access protected route
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Authentication - Session Management', () => {
  test('should persist session across page refresh', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';

    await helpers.login(email, password);

    // Refresh page
    await page.reload();

    // Should still be logged in
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should expire session after timeout', async ({ page, context }) => {
    // This test requires mocking session expiration
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';

    await helpers.login(email, password);

    // Clear cookies to simulate session expiry
    await context.clearCookies();

    await page.reload();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle multiple tabs', async ({ browser }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';

    // Login in first tab
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const helpers1 = new TestHelpers(page1);
    await helpers1.login(email, password);

    // Open second tab
    const page2 = await context.newPage();
    await page2.goto('/dashboard');

    // Should be logged in in second tab
    await expect(page2.locator('[data-testid="user-menu"]')).toBeVisible();

    await context.close();
  });
});

test.describe('Authentication - OAuth Integration', () => {
  test('should show OAuth login options', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.locator('button:has-text("Continue with Google")')).toBeVisible();
    await expect(page.locator('button:has-text("Continue with GitHub")')).toBeVisible();
  });

  test('should redirect to OAuth provider', async ({ page }) => {
    await page.goto('/auth/login');

    const oauthPopup = page.waitForEvent('popup');
    await page.click('button:has-text("Continue with Google")');

    const popup = await oauthPopup;
    await expect(popup.url()).toContain('accounts.google.com');
  });

  test('should complete OAuth flow', async ({ page, context }) => {
    // This test requires actual OAuth integration or mocking
    // Mock implementation
    await page.goto('/auth/login');

    // Mock successful OAuth callback
    await page.route('**/api/auth/oauth/callback', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, token: 'mock-token' })
      });
    });

    await page.click('button:has-text("Continue with GitHub")');

    // Wait for redirect
    await page.waitForURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });
});

test.describe('Authentication - Password Reset', () => {
  test('should display forgot password page', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    await expect(page.locator('h1')).toContainText('Forgot Password');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('should send reset email', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="success"]')).toContainText('Check your email');
  });

  test('should validate email on forgot password', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error"]')).toContainText('Invalid email');
  });

  test('should display reset password page', async ({ page }) => {
    await page.goto('/auth/reset-password?token=valid-token');

    await expect(page.locator('h1')).toContainText('Reset Password');
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
  });

  test('should reset password with valid token', async ({ page }) => {
    await page.goto('/auth/reset-password?token=valid-token');
    const newPassword = TestDataGenerator.password();

    await page.fill('input[name="password"]', newPassword);
    await page.fill('input[name="confirmPassword"]', newPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="success"]')).toContainText('Password reset successful');
  });

  test('should reject invalid reset token', async ({ page }) => {
    await page.goto('/auth/reset-password?token=invalid-token');
    await page.fill('input[name="password"]', 'NewPass123!');
    await page.fill('input[name="confirmPassword"]', 'NewPass123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error"]')).toContainText('Invalid or expired token');
  });
});

test.describe('Authentication - Security', () => {
  test('should rate limit login attempts', async ({ page }) => {
    await page.goto('/auth/login');

    // Attempt multiple failed logins
    for (let i = 0; i < 5; i++) {
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(100);
    }

    // Should show rate limit error
    await expect(page.locator('[data-testid="error"]')).toContainText('Too many attempts');
  });

  test('should protect against XSS', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', '<script>alert("xss")</script>@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should not execute script
    const alerts = page.locator('.alert');
    await expect(alerts).toHaveCount(0);
  });

  test('should use HTTPS in production', async ({ page }) => {
    if (process.env.NODE_ENV === 'production') {
      await page.goto('/auth/login');
      expect(page.url()).toMatch(/^https:/);
    }
  });

  test('should have secure cookies', async ({ page, context }) => {
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'session');

    expect(sessionCookie?.secure).toBe(true);
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe('Strict');
  });
});
