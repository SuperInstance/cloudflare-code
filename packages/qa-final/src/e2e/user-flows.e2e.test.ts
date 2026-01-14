/**
 * End-to-end tests for user workflows
 */

import { test, expect, Page } from '@playwright/test';
import { authenticatedE2eTest, e2eTest } from './runner';
import {
  generateTestEmail,
  generateTestPassword,
  waitForSelector,
  fillWithRetry,
  clickWithRetry,
  waitForNetworkIdle,
  takeScreenshot
} from '../utils/test-helpers';

test.describe('User Signup Flow', () => {
  test('should complete full signup process', async ({ page }) => {
    // Navigate to signup page
    await page.goto('/signup');
    await expect(page).toHaveTitle(/Sign Up/);

    // Fill signup form
    const email = generateTestEmail();
    const password = generateTestPassword();

    await fillWithRetry(page, '[name="name"]', 'Test User');
    await fillWithRetry(page, '[name="email"]', email);
    await fillWithRetry(page, '[name="password"]', password);
    await fillWithRetry(page, '[name="confirmPassword"]', password);

    // Submit form
    await clickWithRetry(page, '[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Verify welcome message
    await waitForSelector(page, 'text=Welcome to ClaudeFlare');
    await expect(page.locator('text=Welcome to ClaudeFlare')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/signup');

    await fillWithRetry(page, '[name="email"]', 'invalid-email');
    await clickWithRetry(page, '[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=Please enter a valid email')).toBeVisible();
  });

  test('should validate password strength', async ({ page }) => {
    await page.goto('/signup');

    await fillWithRetry(page, '[name="password"]', 'weak');
    await page.blur('[name="password"]');

    // Should show password strength indicator
    await expect(page.locator('.password-strength')).toBeVisible();
    await expect(page.locator('text=Password is too weak')).toBeVisible();
  });

  test('should show error for existing email', async ({ page }) => {
    await page.goto('/signup');

    const existingEmail = 'existing@example.com';
    await fillWithRetry(page, '[name="email"]', existingEmail);
    await fillWithRetry(page, '[name="password"]', generateTestPassword());
    await clickWithRetry(page, '[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Email already registered')).toBeVisible();
  });
});

test.describe('User Login Flow', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await fillWithRetry(page, '[name="email"]', 'test@example.com');
    await fillWithRetry(page, '[name="password"]', 'TestPassword123!');
    await clickWithRetry(page, '[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await fillWithRetry(page, '[name="email"]', 'test@example.com');
    await fillWithRetry(page, '[name="password"]', 'WrongPassword');
    await clickWithRetry(page, '[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('should remember me functionality', async ({ page }) => {
    await page.goto('/login');

    await fillWithRetry(page, '[name="email"]', 'test@example.com');
    await fillWithRetry(page, '[name="password"]', 'TestPassword123!');
    await page.check('[name="remember"]');
    await clickWithRetry(page, '[type="submit"]');

    // Verify remember me token is set
    const cookies = await page.context().cookies();
    const rememberCookie = cookies.find(c => c.name === 'remember_token');
    expect(rememberCookie).toBeDefined();
  });

  test('should support social login', async ({ page }) => {
    await page.goto('/login');

    // Click Google login button
    await clickWithRetry(page, 'button:has-text("Continue with Google")');

    // Should redirect to OAuth provider
    await expect(page).toHaveURL(/accounts\.google\.com/);
  });
});

test.describe('Password Reset Flow', () => {
  test('should request password reset', async ({ page }) => {
    await page.goto('/login');
    await clickWithRetry(page, 'a:has-text("Forgot password?")');

    await expect(page).toHaveURL('/forgot-password');

    await fillWithRetry(page, '[name="email"]', 'test@example.com');
    await clickWithRetry(page, '[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('should reset password with valid token', async ({ page }) => {
    // Go to reset page with token
    await page.goto('/reset-password?token=valid-token-123');

    await fillWithRetry(page, '[name="password"]', 'NewPassword123!');
    await fillWithRetry(page, '[name="confirmPassword"]', 'NewPassword123!');
    await clickWithRetry(page, '[type="submit"]');

    // Should redirect to login
    await page.waitForURL('/login');
    await expect(page.locator('text=Password reset successful')).toBeVisible();
  });

  test('should reject invalid reset token', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token');

    await fillWithRetry(page, '[name="password"]', 'NewPassword123!');
    await fillWithRetry(page, '[name="confirmPassword"]', 'NewPassword123!');
    await clickWithRetry(page, '[type="submit"]');

    // Should show error
    await expect(page.locator('text=Invalid or expired token')).toBeVisible();
  });
});

test.describe('User Profile Management', () => {
  authenticatedE2eTest('should view user profile', async (page, auth) => {
    await page.goto('/profile');

    // Verify profile information is displayed
    await expect(page.locator('[data-testid="user-email"]')).toHaveText(auth.getUser().email);
    await expect(page.locator('[data-testid="user-username"]')).toHaveText(auth.getUser().username);
  });

  authenticatedE2eTest('should update user profile', async (page) => {
    await page.goto('/profile/edit');

    await fillWithRetry(page, '[name="firstName"]', 'Updated');
    await fillWithRetry(page, '[name="lastName"]', 'Name');
    await clickWithRetry(page, '[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Profile updated')).toBeVisible();

    // Verify changes
    await expect(page.locator('[data-testid="user-name"]')).toHaveText('Updated Name');
  });

  authenticatedE2eTest('should change password', async (page) => {
    await page.goto('/profile/change-password');

    await fillWithRetry(page, '[name="currentPassword"]', 'TestPassword123!');
    await fillWithRetry(page, '[name="newPassword"]', 'NewPassword123!');
    await fillWithRetry(page, '[name="confirmPassword"]', 'NewPassword123!');
    await clickWithRetry(page, '[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Password changed')).toBeVisible();
  });

  authenticatedE2eTest('should upload profile picture', async (page) => {
    await page.goto('/profile');

    // Click upload button
    await clickWithRetry(page, '[data-testid="upload-avatar"]');

    // Select file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-assets/avatar.png');

    // Wait for upload
    await waitForNetworkIdle(page);

    // Verify image is updated
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });

  authenticatedE2eTest('should delete account', async (page) => {
    await page.goto('/profile/delete');

    // Should require confirmation
    await fillWithRetry(page, '[name="confirmation"]', 'DELETE');
    await clickWithRetry(page, '[type="submit"]');

    // Should redirect to home
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });
});

test.describe('User Settings', () => {
  authenticatedE2eTest('should update notification preferences', async (page) => {
    await page.goto('/settings/notifications');

    // Toggle email notifications
    await page.uncheck('[name="emailNotifications"]');
    await page.check('[name="pushNotifications"]');

    // Save settings
    await clickWithRetry(page, '[data-testid="save-settings"]');

    await expect(page.locator('text=Settings saved')).toBeVisible();
  });

  authenticatedE2eTest('should update privacy settings', async (page) => {
    await page.goto('/settings/privacy');

    // Change profile visibility
    await page.selectOption('[name="profileVisibility"]', 'private');

    // Save settings
    await clickWithRetry(page, '[data-testid="save-settings"]');

    await expect(page.locator('text=Settings saved')).toBeVisible();
  });

  authenticatedE2eTest('should manage API keys', async (page) => {
    await page.goto('/settings/api-keys');

    // Generate new API key
    await clickWithRetry(page, '[data-testid="generate-api-key"]');

    // Should show new key
    await expect(page.locator('[data-testid="api-key-display"]')).toBeVisible();

    // Copy key
    await clickWithRetry(page, '[data-testid="copy-api-key"]');
    await expect(page.locator('text=Copied to clipboard')).toBeVisible();

    // Revoke key
    await clickWithRetry(page, '[data-testid="revoke-api-key"]');
    await expect(page.locator('text=API key revoked')).toBeVisible();
  });

  authenticatedE2eTest('should export user data', async (page) => {
    await page.goto('/settings/data');

    // Request data export
    await clickWithRetry(page, '[data-testid="export-data"]');

    // Should show success message
    await expect(page.locator('text=Export request submitted')).toBeVisible();

    // Should show download link when ready
    await waitForSelector(page, '[data-testid="download-export"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="download-export"]')).toBeVisible();
  });
});

test.describe('User Sessions', () => {
  authenticatedE2eTest('should view active sessions', async (page) => {
    await page.goto('/settings/sessions');

    // Should show current session
    await expect(page.locator('[data-testid="current-session"]')).toBeVisible();

    // Should show session details
    await expect(page.locator('text=Current browser')).toBeVisible();
  });

  authenticatedE2eTest('should revoke other sessions', async (page) => {
    await page.goto('/settings/sessions');

    // Revoke all other sessions
    await clickWithRetry(page, '[data-testid="revoke-all-sessions"]');

    // Should confirm
    await page.click('button:has-text("Confirm")');

    await expect(page.locator('text=All sessions revoked')).toBeVisible();
  });
});

test.describe('Two-Factor Authentication', () => {
  authenticatedE2eTest('should enable 2FA', async (page) => {
    await page.goto('/settings/2fa');

    // Click enable button
    await clickWithRetry(page, '[data-testid="enable-2fa"]');

    // Should show QR code
    await expect(page.locator('[data-testid="qr-code"]')).toBeVisible();

    // Enter verification code (mock)
    await fillWithRetry(page, '[name="code"]', '123456');
    await clickWithRetry(page, '[type="submit"]');

    // Should show backup codes
    await expect(page.locator('[data-testid="backup-codes"]')).toBeVisible();
  });

  authenticatedE2eTest('should disable 2FA', async (page) => {
    await page.goto('/settings/2fa');

    // Click disable button
    await clickWithRetry(page, '[data-testid="disable-2fa"]');

    // Confirm
    await page.click('button:has-text("Confirm")');

    await expect(page.locator('text=2FA disabled')).toBeVisible();
  });

  test('should login with 2FA code', async ({ page }) => {
    await page.goto('/login');

    await fillWithRetry(page, '[name="email"]', '2fa-user@example.com');
    await fillWithRetry(page, '[name="password"]', 'TestPassword123!');
    await clickWithRetry(page, '[type="submit"]');

    // Should show 2FA input
    await waitForSelector(page, '[name="code"]');
    await fillWithRetry(page, '[name="code"]', '123456');
    await clickWithRetry(page, '[type="submit"]');

    // Should login successfully
    await page.waitForURL('/dashboard');
  });
});

test.describe('User Logout', () => {
  authenticatedE2eTest('should logout successfully', async (page) => {
    // Click logout button
    await clickWithRetry(page, '[data-testid="logout-button"]');

    // Should redirect to home
    await page.waitForURL('/');

    // Verify auth token is removed
    const authToken = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(authToken).toBeNull();
  });

  authenticatedE2eTest('should clear all data on logout', async (page) => {
    // Set some data
    await page.evaluate(() => {
      localStorage.setItem('testKey', 'testValue');
      sessionStorage.setItem('testKey', 'testValue');
    });

    // Logout
    await clickWithRetry(page, '[data-testid="logout-button"]');
    await page.waitForURL('/');

    // Verify all data is cleared
    const localStorageData = await page.evaluate(() => JSON.stringify(localStorage));
    const sessionStorageData = await page.evaluate(() => JSON.stringify(sessionStorage));

    expect(localStorageData).toBe('{}');
    expect(sessionStorageData).toBe('{}');
  });
});

export {};
