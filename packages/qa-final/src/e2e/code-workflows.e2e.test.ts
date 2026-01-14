/**
 * End-to-end tests for code generation workflows
 */

import { test, expect } from '@playwright/test';
import { authenticatedE2eTest } from './runner';
import {
  waitForSelector,
  fillWithRetry,
  clickWithRetry,
  waitForNetworkIdle
} from '../utils/test-helpers';

test.describe('Code Generation Workflow', () => {
  authenticatedE2eTest('should generate code from prompt', async (page) => {
    await page.goto('/code/generate');

    // Enter prompt
    await fillWithRetry(page, '[name="prompt"]', 'Create a REST API for user management');

    // Select language
    await page.selectOption('[name="language"]', 'typescript');

    // Generate code
    await clickWithRetry(page, '[data-testid="generate-code"]');

    // Wait for generation
    await waitForSelector(page, '[data-testid="generated-code"]', { timeout: 30000 });

    // Verify code is generated
    const code = await page.locator('[data-testid="generated-code"]').textContent();
    expect(code).toBeTruthy();
    expect(code?.length).toBeGreaterThan(100);
  });

  authenticatedE2eTest('should generate code with context from codebase', async (page) => {
    await page.goto('/projects/test-project/code/generate');

    // Select files for context
    await clickWithRetry(page, '[data-testid="select-context"]');
    await page.check('[data-file="src/utils/api.ts"]');
    await page.check('[data-file="src/types/user.ts"]');
    await clickWithRetry(page, '[data-testid="confirm-selection"]');

    // Enter prompt
    await fillWithRetry(page, '[name="prompt"]', 'Add a delete endpoint');

    // Generate
    await clickWithRetry(page, '[data-testid="generate-code"]');

    // Verify generation uses context
    await expect(page.locator('[data-testid="generated-code"]')).toBeVisible();
    await expect(page.locator('text=Context: 2 files')).toBeVisible();
  });

  authenticatedE2eTest('should iterate on generated code', async (page) => {
    await page.goto('/code/generate/session/abc123');

    // Initial generation
    await fillWithRetry(page, '[name="prompt"]', 'Create a user class');
    await clickWithRetry(page, '[data-testid="generate-code"]');
    await waitForSelector(page, '[data-testid="generated-code"]');

    // Iterate
    await fillWithRetry(page, '[name="prompt"]', 'Add validation to the user class');
    await clickWithRetry(page, '[data-testid="iterate"]');

    // Verify iteration
    await waitForSelector(page, '[data-testid="iteration-2"]', { timeout: 30000 });
  });
});

test.describe('Code Review Workflow', () => {
  authenticatedE2eTest('should review code changes', async (page) => {
    await page.goto('/projects/test-project/pull-requests/1');

    // Navigate to review
    await clickWithRetry(page, '[data-testid="start-review"]');

    // Verify files are shown
    await expect(page.locator('[data-testid="changed-files"]')).toBeVisible();

    // Add comment
    await clickWithRetry(page, '[data-line="10"] [data-testid="add-comment"]');
    await fillWithRetry(page, '[name="comment"]', 'Consider adding error handling here');
    await clickWithRetry(page, '[data-testid="submit-comment"]');

    // Approve changes
    await clickWithRetry(page, '[data-testid="approve-pr"]');
    await expect(page.locator('text=Pull request approved')).toBeVisible();
  });

  authenticatedE2eTest('should request changes', async (page) => {
    await page.goto('/projects/test-project/pull-requests/2');

    await clickWithRetry(page, '[data-testid="start-review"]');
    await clickWithRetry(page, '[data-testid="request-changes"]');

    await fillWithRetry(page, '[name="feedback"]', 'Please update tests');
    await clickWithRetry(page, '[data-testid="submit-feedback"]');

    await expect(page.locator('text=Changes requested')).toBeVisible();
  });
});

test.describe('Collaborative Coding', () => {
  authenticatedE2eTest('should support real-time collaboration', async (page) => {
    await page.goto('/projects/test-project/code/file.ts');

    // Enable collaboration
    await clickWithRetry(page, '[data-testid="enable-collaboration"]');

    // Verify presence indicator
    await expect(page.locator('[data-testid="presence-indicator"]')).toBeVisible();

    // Make edit
    await page.click('[data-line="5"]');
    await page.keyboard.type('const x = 1;');

    // Verify edit is synced
    await expect(page.locator('[data-testid="sync-status"]')).toHaveText('Saved');
  });

  authenticatedE2eTest('should show cursor positions', async (page) => {
    await page.goto('/projects/test-project/code/file.ts?collaborate=true');

    // Should show other users' cursors
    await expect(page.locator('[data-testid="remote-cursor"]')).toBeVisible();
  });
});

test.describe('Code Deployment', () => {
  authenticatedE2eTest('should deploy generated code', async (page) => {
    await page.goto('/projects/test-project/code/deploy');

    // Select deployment target
    await page.selectOption('[name="target"]', 'production');

    // Deploy
    await clickWithRetry(page, '[data-testid="deploy-code"]');

    // Verify deployment starts
    await expect(page.locator('[data-testid="deployment-status"]')).toBeVisible();

    // Wait for completion
    await waitForSelector(page, 'text=Deployment successful', { timeout: 60000 });
  });

  authenticatedE2eTest('should rollback deployment', async (page) => {
    await page.goto('/projects/test-project/code/deploy');

    await clickWithRetry(page, '[data-testid="rollback"]');

    await page.click('[data-version="previous"]');
    await page.click('button:has-text("Confirm Rollback")');

    await expect(page.locator('text=Rollback successful')).toBeVisible();
  });
});

export {};
