/**
 * End-to-end tests for project workflows
 */

import { test, expect } from '@playwright/test';
import { authenticatedE2eTest } from './runner';
import {
  waitForSelector,
  fillWithRetry,
  clickWithRetry,
  waitForNetworkIdle,
  assertElementCount
} from '../utils/test-helpers';

test.describe('Project Creation Flow', () => {
  authenticatedE2eTest('should create a new project', async (page) => {
    await page.goto('/projects/new');

    // Fill project details
    await fillWithRetry(page, '[name="name"]', 'Test Project');
    await fillWithRetry(page, '[name="description"]', 'A test project for E2E testing');
    await page.selectOption('[name="visibility"]', 'private');

    // Submit form
    await clickWithRetry(page, '[type="submit"]');

    // Should redirect to project page
    await page.waitForURL(/\/projects\/[\w-]+/);

    // Verify project details
    await expect(page.locator('h1')).toContainText('Test Project');
    await expect(page.locator('text=A test project')).toBeVisible();
  });

  authenticatedE2eTest('should validate project name', async (page) => {
    await page.goto('/projects/new');

    // Try to submit without name
    await clickWithRetry(page, '[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=Project name is required')).toBeVisible();
  });

  authenticatedE2eTest('should create project from template', async (page) => {
    await page.goto('/projects/new?template=nextjs');

    // Should pre-fill template details
    await expect(page.locator('[name="name"]')).toHaveValue(/Next.js Project/);
    await expect(page.locator('[name="template"]')).toHaveValue('nextjs');

    // Submit
    await clickWithRetry(page, '[type="submit"]');

    // Should create project with template
    await page.waitForURL(/\/projects\/[\w-]+/);
    await expect(page.locator('text=Next.js')).toBeVisible();
  });
});

test.describe('Project Management', () => {
  authenticatedE2eTest('should list user projects', async (page) => {
    await page.goto('/projects');

    // Verify projects are displayed
    await waitForSelector(page, '[data-testid="project-card"]');

    // Should have at least one project
    const projectCount = await page.locator('[data-testid="project-card"]').count();
    expect(projectCount).toBeGreaterThan(0);
  });

  authenticatedE2eTest('should filter projects by status', async (page) => {
    await page.goto('/projects');

    // Filter by active projects
    await page.selectOption('[name="status"]', 'active');
    await clickWithRetry(page, '[data-testid="apply-filter"]');

    // Wait for filtered results
    await waitForNetworkIdle(page);

    // Verify all shown projects are active
    const projects = page.locator('[data-testid="project-card"]');
    const count = await projects.count();

    for (let i = 0; i < count; i++) {
      await expect(projects.nth(i).locator('[data-testid="project-status"]')).toHaveText('active');
    }
  });

  authenticatedE2eTest('should search projects', async (page) => {
    await page.goto('/projects');

    // Enter search query
    await fillWithRetry(page, '[name="search"]', 'Test Project');
    await clickWithRetry(page, '[data-testid="search-button"]');

    // Wait for results
    await waitForNetworkIdle(page);

    // Verify search results
    await expect(page.locator('text=Test Project')).toBeVisible();
  });

  authenticatedE2eTest('should update project details', async (page) => {
    await page.goto('/projects/test-project/edit');

    // Update project name
    await fillWithRetry(page, '[name="name"]', 'Updated Project Name');
    await fillWithRetry(page, '[name="description"]', 'Updated description');

    // Save changes
    await clickWithRetry(page, '[data-testid="save-project"]');

    // Verify success message
    await expect(page.locator('text=Project updated')).toBeVisible();

    // Go back to project page
    await clickWithRetry(page, '[data-testid="back-to-project"]');

    // Verify updated details
    await expect(page.locator('h1')).toContainText('Updated Project Name');
  });

  authenticatedE2eTest('should delete project', async (page) => {
    // Navigate to project
    await page.goto('/projects/test-project');

    // Click delete button
    await clickWithRetry(page, '[data-testid="delete-project"]');

    // Confirm deletion
    await page.click('button:has-text("Delete")');

    // Should redirect to projects list
    await page.waitForURL('/projects');

    // Verify project is deleted
    await expect(page.locator('text=test-project')).not.toBeVisible();
  });
});

test.describe('Project Collaboration', () => {
  authenticatedE2eTest('should invite team member', async (page) => {
    await page.goto('/projects/test-project/collaborators');

    // Click invite button
    await clickWithRetry(page, '[data-testid="invite-collaborator"]');

    // Enter email
    await fillWithRetry(page, '[name="email"]', 'collaborator@example.com');
    await page.selectOption('[name="role"]', 'editor');

    // Send invitation
    await clickWithRetry(page, '[type="submit"]');

    // Verify invitation sent
    await expect(page.locator('text=Invitation sent')).toBeVisible();

    // Verify collaborator appears in list
    await expect(page.locator('text=collaborator@example.com')).toBeVisible();
  });

  authenticatedE2eTest('should remove team member', async (page) => {
    await page.goto('/projects/test-project/collaborators');

    // Find collaborator and click remove
    await clickWithRetry(page, '[data-testid="remove-collaborator"]');

    // Confirm removal
    await page.click('button:has-text("Remove")');

    // Verify removal
    await expect(page.locator('text=Collaborator removed')).toBeVisible();
  });

  authenticatedE2eTest('should update collaborator role', async (page) => {
    await page.goto('/projects/test-project/collaborators');

    // Click on collaborator role dropdown
    await clickWithRetry(page, '[data-testid="collaborator-role"]');

    // Select new role
    await page.click('text=Admin');

    // Verify role updated
    await expect(page.locator('text=Role updated')).toBeVisible();
  });
});

test.describe('Project Settings', () => {
  authenticatedE2eTest('should update project visibility', async (page) => {
    await page.goto('/projects/test-project/settings');

    // Change visibility to public
    await page.selectOption('[name="visibility"]', 'public');
    await clickWithRetry(page, '[data-testid="save-settings"]');

    // Verify success
    await expect(page.locator('text=Settings saved')).toBeVisible();
  });

  authenticatedE2eTest('should configure project webhooks', async (page) => {
    await page.goto('/projects/test-project/settings/webhooks');

    // Add webhook
    await clickWithRetry(page, '[data-testid="add-webhook"]');

    // Fill webhook details
    await fillWithRetry(page, '[name="url"]', 'https://example.com/webhook');
    await page.check('[name="events"][value="project.updated"]');

    // Save webhook
    await clickWithRetry(page, '[type="submit"]');

    // Verify webhook added
    await expect(page.locator('text=Webhook added')).toBeVisible();
    await expect(page.locator('text=https://example.com/webhook')).toBeVisible();
  });

  authenticatedE2eTest('should manage project API keys', async (page) => {
    await page.goto('/projects/test-project/settings/api-keys');

    // Generate new API key
    await clickWithRetry(page, '[data-testid="generate-key"]');

    // Verify key is generated
    await expect(page.locator('[data-testid="api-key"]')).toBeVisible();

    // Copy key
    await clickWithRetry(page, '[data-testid="copy-key"]');
    await expect(page.locator('text=Copied')).toBeVisible();
  });
});

test.describe('Project Analytics', () => {
  authenticatedE2eTest('should view project analytics', async (page) => {
    await page.goto('/projects/test-project/analytics');

    // Verify analytics dashboard loads
    await waitForSelector(page, '[data-testid="analytics-chart"]');

    // Verify metrics are displayed
    await expect(page.locator('[data-testid="total-requests"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-rate"]')).toBeVisible();
  });

  authenticatedE2eTest('should filter analytics by date range', async (page) => {
    await page.goto('/projects/test-project/analytics');

    // Select date range
    await clickWithRetry(page, '[data-testid="date-range-picker"]');
    await page.click('text=Last 7 days');

    // Wait for data to reload
    await waitForNetworkIdle(page);

    // Verify charts update
    await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible();
  });

  authenticatedE2eTest('should export analytics data', async (page) => {
    await page.goto('/projects/test-project/analytics');

    // Click export button
    await clickWithRetry(page, '[data-testid="export-analytics"]');

    // Select format
    await page.click('text=CSV');

    // Verify download starts
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-export"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});

test.describe('Project Deployment', () => {
  authenticatedE2eTest('should deploy project', async (page) => {
    await page.goto('/projects/test-project/deploy');

    // Click deploy button
    await clickWithRetry(page, '[data-testid="deploy-button"]');

    // Should show deployment status
    await expect(page.locator('[data-testid="deployment-status"]')).toBeVisible();

    // Wait for deployment to complete
    await waitForSelector(page, 'text=Deployment successful', { timeout: 60000 });

    // Verify deployment URL is shown
    await expect(page.locator('[data-testid="deployment-url"]')).toBeVisible();
  });

  authenticatedE2eTest('should view deployment logs', async (page) => {
    await page.goto('/projects/test-project/deploy/logs');

    // Verify logs are displayed
    await waitForSelector(page, '[data-testid="deployment-logs"]');

    // Should have log entries
    const logEntries = await page.locator('[data-testid="log-entry"]').count();
    expect(logEntries).toBeGreaterThan(0);
  });

  authenticatedE2eTest('should rollback deployment', async (page) => {
    await page.goto('/projects/test-project/deploy');

    // Click rollback button
    await clickWithRetry(page, '[data-testid="rollback-button"]');

    // Select previous version
    await page.click('[data-testid="version-2"]');

    // Confirm rollback
    await page.click('button:has-text("Rollback")');

    // Verify rollback success
    await expect(page.locator('text=Rollback successful')).toBeVisible();
  });
});

test.describe('Project Files', () => {
  authenticatedE2eTest('should upload file to project', async (page) => {
    await page.goto('/projects/test-project/files');

    // Click upload button
    await clickWithRetry(page, '[data-testid="upload-file"]');

    // Select file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-assets/sample.txt');

    // Wait for upload
    await waitForNetworkIdle(page);

    // Verify file appears in list
    await expect(page.locator('text=sample.txt')).toBeVisible();
  });

  authenticatedE2eTest('should delete file from project', async (page) => {
    await page.goto('/projects/test-project/files');

    // Find file and click delete
    await clickWithRetry(page, '[data-file="sample.txt"] [data-testid="delete-file"]');

    // Confirm deletion
    await page.click('button:has-text("Delete")');

    // Verify file is deleted
    await expect(page.locator('text=sample.txt')).not.toBeVisible();
  });

  authenticatedE2eTest('should preview file', async (page) => {
    await page.goto('/projects/test-project/files');

    // Click on file to preview
    await clickWithRetry(page, '[data-file="sample.txt"]');

    // Should show preview modal
    await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-content"]')).toBeVisible();
  });
});

test.describe('Project Environment Variables', () => {
  authenticatedE2eTest('should add environment variable', async (page) => {
    await page.goto('/projects/test-project/settings/env-vars');

    // Click add variable button
    await clickWithRetry(page, '[data-testid="add-env-var"]');

    // Fill variable details
    await fillWithRetry(page, '[name="key"]', 'API_KEY');
    await fillWithRetry(page, '[name="value"]', 'test-api-key-123');

    // Save
    await clickWithRetry(page, '[type="submit"]');

    // Verify variable added
    await expect(page.locator('text=API_KEY')).toBeVisible();
  });

  authenticatedE2eTest('should edit environment variable', async (page) => {
    await page.goto('/projects/test-project/settings/env-vars');

    // Click edit on existing variable
    await clickWithRetry(page, '[data-testid="edit-env-var"]');

    // Update value
    await fillWithRetry(page, '[name="value"]', 'updated-api-key-456');
    await clickWithRetry(page, '[type="submit"]');

    // Verify updated
    await expect(page.locator('text=Environment variable updated')).toBeVisible();
  });

  authenticatedE2eTest('should delete environment variable', async (page) => {
    await page.goto('/projects/test-project/settings/env-vars');

    // Click delete on variable
    await clickWithRetry(page, '[data-testid="delete-env-var"]');

    // Confirm
    await page.click('button:has-text("Delete")');

    // Verify deleted
    await expect(page.locator('text=Environment variable deleted')).toBeVisible();
  });
});

test.describe('Project Activity Feed', () => {
  authenticatedE2eTest('should view project activity', async (page) => {
    await page.goto('/projects/test-project/activity');

    // Verify activity feed loads
    await waitForSelector(page, '[data-testid="activity-feed"]');

    // Should have activity entries
    const activities = await page.locator('[data-testid="activity-entry"]').count();
    expect(activities).toBeGreaterThan(0);
  });

  authenticatedE2eTest('should filter activity by type', async (page) => {
    await page.goto('/projects/test-project/activity');

    // Filter by deployments
    await page.selectOption('[name="activityType"]', 'deployment');

    // Wait for filtered results
    await waitForNetworkIdle(page);

    // Verify only deployment activities shown
    const activities = page.locator('[data-testid="activity-entry"]');
    const count = await activities.count();

    for (let i = 0; i < count; i++) {
      await expect(activities.nth(i)).toHaveAttribute('data-type', 'deployment');
    }
  });
});

export {};
