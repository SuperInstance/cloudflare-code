import { test, expect } from '@playwright/test';
import { TestHelpers, TestDataGenerator, TestApiClient } from '../../utils/test-helpers';

/**
 * API Testing E2E Tests
 *
 * Tests API endpoints, error handling, rate limiting, and performance
 */

test.describe('API - Authentication Endpoints', () => {
  let apiClient: TestApiClient;

  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    const token = await page.evaluate(() => localStorage.getItem('auth_token') || '');
    apiClient = new TestApiClient(
      process.env.API_BASE_URL || 'http://localhost:8787',
      token
    );
  });

  test('should authenticate user', async () => {
    const response = await apiClient.post('/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });

    expect(response).toHaveProperty('token');
    expect(response).toHaveProperty('user');
  });

  test('should reject invalid credentials', async () => {
    const response = await apiClient.post('/api/auth/login', {
      email: 'test@example.com',
      password: 'wrongpassword'
    }, { skipThrow: true });

    expect(response).toHaveProperty('error');
  });

  test('should refresh token', async () => {
    const response = await apiClient.post('/api/auth/refresh', {});

    expect(response).toHaveProperty('token');
  });

  test('should logout user', async () => {
    const response = await apiClient.post('/api/auth/logout', {});

    expect(response).toHaveProperty('success', true);
  });
});

test.describe('API - Projects Endpoints', () => {
  let apiClient: TestApiClient;

  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    const token = await page.evaluate(() => localStorage.getItem('auth_token') || '');
    apiClient = new TestApiClient(
      process.env.API_BASE_URL || 'http://localhost:8787',
      token
    );
  });

  test('should list projects', async () => {
    const response = await apiClient.get('/api/projects');

    expect(Array.isArray(response.projects)).toBe(true);
  });

  test('should create project', async () => {
    const projectData = {
      name: TestDataGenerator.projectName(),
      description: 'Test project',
      language: 'TypeScript'
    };

    const response = await apiClient.post('/api/projects', projectData);

    expect(response).toHaveProperty('id');
    expect(response.name).toBe(projectData.name);
  });

  test('should get project details', async () => {
    // First create a project
    const createResponse = await apiClient.post('/api/projects', {
      name: 'Test Project',
      language: 'TypeScript'
    });

    const project = await apiClient.get(`/api/projects/${createResponse.id}`);

    expect(project).toHaveProperty('id', createResponse.id);
  });

  test('should update project', async () => {
    const createResponse = await apiClient.post('/api/projects', {
      name: 'Original Name',
      language: 'TypeScript'
    });

    const updateResponse = await apiClient.put(`/api/projects/${createResponse.id}`, {
      name: 'Updated Name'
    });

    expect(updateResponse.name).toBe('Updated Name');
  });

  test('should delete project', async () => {
    const createResponse = await apiClient.post('/api/projects', {
      name: 'To Delete',
      language: 'TypeScript'
    });

    const deleteResponse = await apiClient.delete(`/api/projects/${createResponse.id}`);

    expect(deleteResponse).toHaveProperty('success', true);
  });
});

test.describe('API - Code Generation Endpoints', () => {
  let apiClient: TestApiClient;

  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    const token = await page.evaluate(() => localStorage.getItem('auth_token') || '');
    apiClient = new TestApiClient(
      process.env.API_BASE_URL || 'http://localhost:8787',
      token
    );
  });

  test('should generate code', async () => {
    const response = await apiClient.post('/api/code/generate', {
      prompt: 'Create a function to add two numbers',
      language: 'TypeScript'
    });

    expect(response).toHaveProperty('code');
    expect(response).toHaveProperty('language', 'TypeScript');
  });

  test('should handle code explanation', async () => {
    const response = await apiClient.post('/api/code/explain', {
      code: 'function add(a, b) { return a + b; }',
      language: 'JavaScript'
    });

    expect(response).toHaveProperty('explanation');
  });

  test('should refactor code', async () => {
    const response = await apiClient.post('/api/code/refactor', {
      code: 'function add(a,b){return a+b}',
      language: 'JavaScript'
    });

    expect(response).toHaveProperty('refactoredCode');
  });

  test('should handle code review', async () => {
    const response = await apiClient.post('/api/code/review', {
      code: TestDataGenerator.codeSnippet(),
      language: 'TypeScript'
    });

    expect(response).toHaveProperty('issues');
    expect(response).toHaveProperty('suggestions');
  });
});

test.describe('API - Rate Limiting', () => {
  test('should enforce rate limits', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    const token = await page.evaluate(() => localStorage.getItem('auth_token') || '');
    const apiClient = new TestApiClient(
      process.env.API_BASE_URL || 'http://localhost:8787',
      token
    );

    // Make many requests
    const promises = Array(100).fill(null).map(() =>
      apiClient.get('/api/projects', {}, { skipThrow: true })
    );

    const responses = await Promise.all(promises);

    // At least some should be rate limited
    const rateLimited = responses.filter(r => r?.error?.includes('rate limit')).length;
    expect(rateLimited).toBeGreaterThan(0);
  });
});

test.describe('API - Error Handling', () => {
  let apiClient: TestApiClient;

  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    const token = await page.evaluate(() => localStorage.getItem('auth_token') || '');
    apiClient = new TestApiClient(
      process.env.API_BASE_URL || 'http://localhost:8787',
      token
    );
  });

  test('should return 404 for non-existent resource', async () => {
    const response = await apiClient.get('/api/projects/nonexistent-id', {}, { skipThrow: true });

    expect(response).toHaveProperty('error');
    expect(response.error).toContain('not found');
  });

  test('should return 400 for invalid data', async () => {
    const response = await apiClient.post('/api/projects', {
      name: '', // Invalid: empty name
      language: 'TypeScript'
    }, { skipThrow: true });

    expect(response).toHaveProperty('error');
  });

  test('should return 401 for unauthenticated request', async () => {
    const unauthenticatedClient = new TestApiClient(
      process.env.API_BASE_URL || 'http://localhost:8787',
      'invalid-token'
    );

    const response = await unauthenticatedClient.get('/api/projects', {}, { skipThrow: true });

    expect(response).toHaveProperty('error');
  });

  test('should return 403 for forbidden request', async () => {
    const response = await apiClient.get('/api/admin/users', {}, { skipThrow: true });

    expect(response).toHaveProperty('error');
  });
});

test.describe('API - Performance', () => {
  test('should respond quickly to simple requests', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    const token = await page.evaluate(() => localStorage.getItem('auth_token') || '');
    const apiClient = new TestApiClient(
      process.env.API_BASE_URL || 'http://localhost:8787',
      token
    );

    const startTime = Date.now();
    await apiClient.get('/api/projects');
    const endTime = Date.now();

    const duration = endTime - startTime;

    expect(duration).toBeLessThan(1000); // Should respond in less than 1 second
  });

  test('should handle concurrent requests', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);

    const token = await page.evaluate(() => localStorage.getItem('auth_token') || '');
    const apiClient = new TestApiClient(
      process.env.API_BASE_URL || 'http://localhost:8787',
      token
    );

    const startTime = Date.now();

    const promises = Array(10).fill(null).map(() =>
      apiClient.get('/api/projects')
    );

    await Promise.all(promises);

    const endTime = Date.now();

    const duration = endTime - startTime;

    expect(duration).toBeLessThan(3000); // Should handle 10 concurrent requests in <3s
  });
});
