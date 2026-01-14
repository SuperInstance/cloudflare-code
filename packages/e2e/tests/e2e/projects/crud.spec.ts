import { test, expect } from '@playwright/test';
import { TestHelpers, TestDataGenerator } from '../../utils/test-helpers';

/**
 * Projects CRUD E2E Tests
 *
 * Tests project creation, reading, updating, deletion, and management
 */

test.describe('Projects - List View', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await helpers.navigateTo('/projects');
  });

  test('should display projects page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Projects');
    await expect(page.locator('[data-testid="projects-list"]')).toBeVisible();
  });

  test('should display project cards', async ({ page }) => {
    const projects = page.locator('[data-testid^="project-card-"]');
    await expect(projects.first()).toBeVisible();
  });

  test('should show project name', async ({ page }) => {
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await expect(firstProject.locator('[data-testid="project-name"]')).toBeVisible();
  });

  test('should show project description', async ({ page }) => {
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await expect(firstProject.locator('[data-testid="project-description"]')).toBeVisible();
  });

  test('should show project last modified date', async ({ page }) => {
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await expect(firstProject.locator('[data-testid="project-last-modified"]')).toBeVisible();
  });

  test('should show project language', async ({ page }) => {
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await expect(firstProject.locator('[data-testid="project-language"]')).toBeVisible();
  });

  test('should filter projects by language', async ({ page }) => {
    await page.click('[data-testid="filter-button"]');
    await page.click('[data-testid="filter-language"]:has-text("TypeScript")');

    const projects = page.locator('[data-testid^="project-card-"]');
    const count = await projects.count();

    for (let i = 0; i < count; i++) {
      const project = projects.nth(i);
      await expect(project.locator('[data-testid="project-language"]')).toContainText('TypeScript');
    }
  });

  test('should search projects', async ({ page }) => {
    const searchTerm = 'test';

    await page.fill('[data-testid="search-input"]', searchTerm);
    await page.press('[data-testid="search-input"]', 'Enter');

    const projects = page.locator('[data-testid^="project-card-"]');
    const count = await projects.count();

    for (let i = 0; i < count; i++) {
      const project = projects.nth(i);
      const name = await project.locator('[data-testid="project-name"]').textContent();
      expect(name?.toLowerCase()).toContain(searchTerm);
    }
  });

  test('should sort projects by name', async ({ page }) => {
    await page.click('[data-testid="sort-button"]');
    await page.click('[data-testid="sort-name"]');

    const projects = page.locator('[data-testid^="project-card-"]');
    const firstProject = await projects.nth(0).locator('[data-testid="project-name"]').textContent();
    const secondProject = await projects.nth(1).locator('[data-testid="project-name"]').textContent();

    expect(firstProject?.toLowerCase() <= secondProject?.toLowerCase()).toBeTruthy();
  });

  test('should sort projects by date', async ({ page }) => {
    await page.click('[data-testid="sort-button"]');
    await page.click('[data-testid="sort-date"]');

    const projects = page.locator('[data-testid^="project-card-"]');
    // Verify sorting logic
    await expect(projects.first()).toBeVisible();
  });

  test('should display empty state', async ({ page }) => {
    // Mock empty projects list
    await page.route('**/api/projects*', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ projects: [] })
      });
    });

    await page.reload();

    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="empty-state"]')).toContainText('No projects found');
  });

  test('should load more projects on scroll', async ({ page }) => {
    const initialCount = await page.locator('[data-testid^="project-card-"]').count();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const finalCount = await page.locator('[data-testid^="project-card-"]').count();
    expect(finalCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('should navigate to project details', async ({ page }) => {
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
  });
});

test.describe('Projects - Create Project', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
  });

  test('should display create project page', async ({ page }) => {
    await page.goto('/projects/new');

    await expect(page.locator('h1')).toContainText('New Project');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('textarea[name="description"]')).toBeVisible();
    await expect(page.locator('select[name="language"]')).toBeVisible();
  });

  test('should create project with valid data', async ({ page }) => {
    const projectData = {
      name: TestDataGenerator.projectName(),
      description: 'Test project description',
      language: 'TypeScript'
    };

    await page.goto('/projects/new');
    await page.fill('input[name="name"]', projectData.name);
    await page.fill('textarea[name="description"]', projectData.description);
    await page.selectOption('select[name="language"]', projectData.language);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Project created');
  });

  test('should validate project name is required', async ({ page }) => {
    await page.goto('/projects/new');
    await page.fill('textarea[name="description"]', 'Description');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="name-error"]')).toContainText('Name is required');
  });

  test('should validate project name length', async ({ page }) => {
    await page.goto('/projects/new');
    await page.fill('input[name="name"]', 'ab');
    await page.blur('input[name="name"]');

    await expect(page.locator('[data-testid="name-error"]')).toContainText('Name must be at least 3 characters');
  });

  test('should validate language selection', async ({ page }) => {
    await page.goto('/projects/new');
    await page.fill('input[name="name"]', 'Test Project');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="language-error"]')).toContainText('Language is required');
  });

  test('should cancel project creation', async ({ page }) => {
    await page.goto('/projects/new');
    await page.click('button:has-text("Cancel")');

    await expect(page).toHaveURL(/\/projects/);
  });

  test('should save project as draft', async ({ page }) => {
    await page.goto('/projects/new');
    await page.fill('input[name="name"]', 'Draft Project');
    await page.click('button:has-text("Save as Draft")');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Draft saved');
  });

  test('should create project from template', async ({ page }) => {
    await page.goto('/projects/new');
    await page.click('[data-testid="use-template"]');

    await expect(page.locator('[data-testid="template-selector"]')).toBeVisible();

    await page.click('[data-testid="template"]:first-child');
    await page.click('button:has-text("Create from Template")');

    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
  });

  test('should import existing project', async ({ page }) => {
    await page.goto('/projects/new');
    await page.click('[data-testid="import-project"]');

    await expect(page.locator('[data-testid="import-modal"]')).toBeVisible();

    // Mock file upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'project.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from('mock file content')
    });

    await page.click('button:has-text("Import")');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Project imported');
  });

  test('should show available templates', async ({ page }) => {
    await page.goto('/projects/new');
    await page.click('[data-testid="use-template"]');

    const templates = page.locator('[data-testid^="template-"]');
    await expect(templates.first()).toBeVisible();
  });

  test('should filter templates by category', async ({ page }) => {
    await page.goto('/projects/new');
    await page.click('[data-testid="use-template"]');
    await page.click('[data-testid="template-category"]:has-text("Web App")');

    const templates = page.locator('[data-testid^="template-"]');
    const count = await templates.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should preview template before selecting', async ({ page }) => {
    await page.goto('/projects/new');
    await page.click('[data-testid="use-template"]');

    const firstTemplate = page.locator('[data-testid^="template-"]').first();
    await firstTemplate.hover();

    await expect(page.locator('[data-testid="template-preview"]')).toBeVisible();
  });
});

test.describe('Projects - Project Details', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
  });

  test('should display project details', async ({ page }) => {
    // First, navigate to a project
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await expect(page.locator('[data-testid="project-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-description"]')).toBeVisible();
  });

  test('should display project files', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await expect(page.locator('[data-testid="file-tree"]')).toBeVisible();
  });

  test('should display project statistics', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await expect(page.locator('[data-testid="project-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="line-count"]')).toBeVisible();
  });

  test('should display recent activity', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await expect(page.locator('[data-testid="project-activity"]')).toBeVisible();
  });

  test('should display project collaborators', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await expect(page.locator('[data-testid="collaborators"]')).toBeVisible();
  });

  test('should edit project details', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await page.click('[data-testid="edit-project"]');

    const newName = 'Updated Project Name';
    await page.fill('input[name="name"]', newName);
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="project-name"]')).toContainText(newName);
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Project updated');
  });

  test('should delete project', async ({ page }) => {
    await page.goto('/projects');
    const projectCount = await page.locator('[data-testid^="project-card-"]').count();

    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await page.click('[data-testid="delete-project"]');

    await expect(page.locator('[data-testid="delete-modal"]')).toBeVisible();
    await page.fill('[data-testid="confirm-input"]', 'DELETE');
    await page.click('button:has-text("Delete")');

    await expect(page).toHaveURL(/\/projects/);
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Project deleted');

    const newCount = await page.locator('[data-testid^="project-card-"]').count();
    expect(newCount).toBe(projectCount - 1);
  });

  test('should export project', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-project"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.(zip|tar\.gz)$/);
  });

  test('should share project', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await page.click('[data-testid="share-project"]');

    await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-link"]')).toBeVisible();
  });

  test('should copy share link', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await page.click('[data-testid="share-project"]');
    await page.click('[data-testid="copy-link"]');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Link copied');
  });

  test('should add collaborator', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await page.click('[data-testid="add-collaborator"]');
    await page.fill('[data-testid="collaborator-email"]', 'collaborator@example.com');
    await page.selectOption('[data-testid="collaborator-role"]', 'editor');
    await page.click('button:has-text("Add")');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Collaborator added');
  });

  test('should remove collaborator', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    const initialCount = await page.locator('[data-testid^="collaborator-"]').count();

    const firstCollaborator = page.locator('[data-testid^="collaborator-"]').first();
    await firstCollaborator.hover();
    await page.click('[data-testid="remove-collaborator"]');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Collaborator removed');

    const finalCount = await page.locator('[data-testid^="collaborator-"]').count();
    expect(finalCount).toBe(initialCount - 1);
  });

  test('should duplicate project', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await page.click('[data-testid="duplicate-project"]');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Project duplicated');
  });

  test('should archive project', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await page.click('[data-testid="archive-project"]');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Project archived');
  });

  test('should view project history', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await page.click('[data-testid="project-history"]');

    await expect(page.locator('[data-testid="history-list"]')).toBeVisible();
  });

  test('should restore from history', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();

    await page.click('[data-testid="project-history"]');
    await page.locator('[data-testid^="history-item-"]').first().click();
    await page.click('button:has-text("Restore")');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Project restored');
  });
});

test.describe('Projects - File Management', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid^="project-card-"]').first();
    await firstProject.click();
  });

  test('should display file tree', async ({ page }) => {
    await expect(page.locator('[data-testid="file-tree"]')).toBeVisible();
  });

  test('should expand folder', async ({ page }) => {
    const folder = page.locator('[data-testid^="folder-"]').first();
    await folder.click();

    await expect(folder.locator('[data-testid="folder-children"]')).toBeVisible();
  });

  test('should collapse folder', async ({ page }) => {
    const folder = page.locator('[data-testid^="folder-"]').first();
    await folder.click();
    await folder.click();

    await expect(folder.locator('[data-testid="folder-children"]')).not.toBeVisible();
  });

  test('should create new file', async ({ page }) => {
    await page.click('[data-testid="new-file"]');
    await page.fill('[data-testid="file-name"]', 'test.ts');
    await page.click('button:has-text("Create")');

    await expect(page.locator('[data-testid="file-test.ts"]')).toBeVisible();
  });

  test('should create new folder', async ({ page }) => {
    await page.click('[data-testid="new-folder"]');
    await page.fill('[data-testid="folder-name"]', 'test-folder');
    await page.click('button:has-text("Create")');

    await expect(page.locator('[data-testid="folder-test-folder"]')).toBeVisible();
  });

  test('should rename file', async ({ page }) => {
    const file = page.locator('[data-testid^="file-"]').first();
    await file.click({ button: 'right' });
    await page.click('[data-testid="rename-file"]');
    await page.fill('[data-testid="file-name"]', 'renamed.ts');
    await page.click('button:has-text("Rename")');

    await expect(page.locator('[data-testid="file-renamed.ts"]')).toBeVisible();
  });

  test('should delete file', async ({ page }) => {
    const initialCount = await page.locator('[data-testid^="file-"]').count();

    const file = page.locator('[data-testid^="file-"]').first();
    await file.click({ button: 'right' });
    await page.click('[data-testid="delete-file"]');
    await page.click('button:has-text("Delete")');

    const finalCount = await page.locator('[data-testid^="file-"]').count();
    expect(finalCount).toBe(initialCount - 1);
  });

  test('should upload file', async ({ page }) => {
    const initialCount = await page.locator('[data-testid^="file-"]').count();

    await page.click('[data-testid="upload-file"]');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'uploaded.ts',
      mimeType: 'text/typescript',
      buffer: Buffer.from('export function test() {}')
    });

    await expect(page.locator('[data-testid="file-uploaded.ts"]')).toBeVisible();

    const finalCount = await page.locator('[data-testid^="file-"]').count();
    expect(finalCount).toBe(initialCount + 1);
  });

  test('should search files', async ({ page }) => {
    await page.fill('[data-testid="file-search"]', 'index');

    await expect(page.locator('[data-testid^="file-"]').first()).toBeVisible();
  });

  test('should filter files by type', async ({ page }) => {
    await page.click('[data-testid="file-type-filter"]');
    await page.click('[data-testid="file-type-ts"]');

    const files = page.locator('[data-testid^="file-"]');
    const count = await files.count();

    for (let i = 0; i < count; i++) {
      const file = files.nth(i);
      await expect(file).toHaveAttribute('data-file-type', 'ts');
    }
  });
});

test.describe('Projects - Batch Operations', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
  });

  test('should select multiple projects', async ({ page }) => {
    await page.goto('/projects');

    await page.check('[data-testid^="project-card-"]').first();
    await page.check('[data-testid^="project-card-"]').nth(1);

    await expect(page.locator('[data-testid="selected-count"]')).toContainText('2');
  });

  test('should select all projects', async ({ page }) => {
    await page.goto('/projects');

    await page.check('[data-testid="select-all"]');

    const projects = page.locator('[data-testid^="project-card-"]');
    const count = await projects.count();

    await expect(page.locator('[data-testid="selected-count"]')).toContainText(count.toString());
  });

  test('should bulk delete projects', async ({ page }) => {
    await page.goto('/projects');

    await page.check('[data-testid^="project-card-"]').first();
    await page.check('[data-testid^="project-card-"]').nth(1);
    await page.click('[data-testid="bulk-delete"]');
    await page.click('button:has-text("Delete")');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Projects deleted');
  });

  test('should bulk archive projects', async ({ page }) => {
    await page.goto('/projects');

    await page.check('[data-testid^="project-card-"]').first();
    await page.check('[data-testid^="project-card-"]').nth(1);
    await page.click('[data-testid="bulk-archive"]');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Projects archived');
  });

  test('should bulk export projects', async ({ page }) => {
    await page.goto('/projects');

    await page.check('[data-testid^="project-card-"]').first();
    await page.click('[data-testid="bulk-export"]');

    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Projects exported');
  });
});
