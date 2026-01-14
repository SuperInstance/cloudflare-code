/**
 * API integration tests for ClaudeFlare
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { IntegrationTestRunner } from './runner';
import { ApiMockInterceptor, DataMockGenerator } from '../utils/mocks';
import { ApiResponseFixture } from '../utils/fixtures';

describe('API Integration Tests', () => {
  let runner: IntegrationTestRunner;
  let mockInterceptor: ApiMockInterceptor;

  beforeAll(async () => {
    runner = new IntegrationTestRunner({
      services: [
        {
          name: 'api',
          baseUrl: 'http://localhost:8787',
          healthCheck: '/health',
          timeout: 5000
        }
      ],
      database: {
        type: 'postgresql',
        connectionString: 'postgresql://localhost:5432/test',
        poolSize: 10,
        timeout: 5000
      },
      storage: {
        type: 'r2',
        bucket: 'test-bucket',
        region: 'auto',
        timeout: 5000
      },
      timeout: 30000
    });

    mockInterceptor = new ApiMockInterceptor('http://localhost:8787');
    await runner.setup();
  });

  afterAll(async () => {
    await runner.teardown();
  });

  beforeEach(() => {
    mockInterceptor = new ApiMockInterceptor('http://localhost:8787');
  });

  describe('Health Check API', () => {
    it('should return healthy status', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/health', {
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });

      const response = await fetch('http://localhost:8787/health');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.version).toBeDefined();
    });

    it('should include service dependencies in health check', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/health', {
        status: 'healthy',
        services: {
          database: 'healthy',
          storage: 'healthy',
          cache: 'healthy'
        }
      });

      const response = await fetch('http://localhost:8787/health');
      const data = await response.json();

      expect(data.services).toBeDefined();
      expect(data.services.database).toBe('healthy');
      expect(data.services.storage).toBe('healthy');
      expect(data.services.cache).toBe('healthy');
    });
  });

  describe('Authentication API', () => {
    it('should register a new user', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePassword123!'
      };

      mockFactory.mockPost('/auth/register', {
        user: {
          id: 'user-123',
          email: userData.email,
          username: userData.username,
          createdAt: new Date().toISOString()
        },
        token: 'mock-token-abc123'
      });

      const response = await fetch('http://localhost:8787/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(userData.email);
      expect(data.token).toBeDefined();
    });

    it('should login with valid credentials', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const credentials = {
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      mockFactory.mockPost('/auth/login', {
        user: {
          id: 'user-123',
          email: credentials.email,
          username: 'testuser'
        },
        token: 'mock-token-xyz789',
        refreshToken: 'mock-refresh-token'
      });

      const response = await fetch('http://localhost:8787/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.token).toBeDefined();
      expect(data.refreshToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      mockFactory.mockPost('/auth/login', ApiResponseFixture.error(
        'Invalid credentials',
        'INVALID_CREDENTIALS',
        401
      ));

      const response = await fetch('http://localhost:8787/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      expect(response.status).toBe(401);
    });

    it('should refresh expired token', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockPost('/auth/refresh', {
        token: 'new-token-abc123',
        refreshToken: 'new-refresh-token'
      });

      const response = await fetch('http://localhost:8787/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-refresh-token'
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBeDefined();
      expect(data.refreshToken).toBeDefined();
    });

    it('should logout and invalidate token', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockPost('/auth/logout', {
        message: 'Logged out successfully'
      });

      const response = await fetch('http://localhost:8787/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      expect(response.status).toBe(200);
    });
  });

  describe('User Management API', () => {
    it('should get current user profile', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/api/users/me', {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        createdAt: new Date().toISOString()
      });

      const response = await fetch('http://localhost:8787/api/users/me', {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('user-123');
      expect(data.email).toBe('test@example.com');
    });

    it('should update user profile', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const updates = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      mockFactory.mockPatch('/api/users/me', {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: updates.firstName,
        lastName: updates.lastName,
        role: 'user',
        updatedAt: new Date().toISOString()
      });

      const response = await fetch('http://localhost:8787/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-abc123'
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.firstName).toBe(updates.firstName);
      expect(data.lastName).toBe(updates.lastName);
    });

    it('should delete user account', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockDelete('/api/users/me', {
        message: 'Account deleted successfully'
      });

      const response = await fetch('http://localhost:8787/api/users/me', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      expect(response.status).toBe(204);
    });

    it('should list all users (admin only)', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/api/users', ApiResponseFixture.paginated([
        { id: 'user-1', email: 'user1@example.com', username: 'user1' },
        { id: 'user-2', email: 'user2@example.com', username: 'user2' },
        { id: 'user-3', email: 'user3@example.com', username: 'user3' }
      ], 1, 10, 3));

      const response = await fetch('http://localhost:8787/api/users?page=1&limit=10', {
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(3);
      expect(data.pagination).toBeDefined();
    });
  });

  describe('Project Management API', () => {
    it('should create a new project', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        visibility: 'private'
      };

      mockFactory.mockPost('/api/projects', {
        id: 'project-123',
        name: projectData.name,
        description: projectData.description,
        visibility: projectData.visibility,
        owner: 'user-123',
        status: 'active',
        createdAt: new Date().toISOString()
      });

      const response = await fetch('http://localhost:8787/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-abc123'
        },
        body: JSON.stringify(projectData)
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe(projectData.name);
      expect(data.owner).toBe('user-123');
    });

    it('should list user projects', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/api/projects', ApiResponseFixture.paginated([
        { id: 'project-1', name: 'Project 1', status: 'active' },
        { id: 'project-2', name: 'Project 2', status: 'active' }
      ], 1, 10, 2));

      const response = await fetch('http://localhost:8787/api/projects', {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toBeDefined();
      expect(data.items.length).toBeGreaterThan(0);
    });

    it('should get project by ID', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const projectId = 'project-123';

      mockFactory.mockGet(`/api/projects/${projectId}`, {
        id: projectId,
        name: 'Test Project',
        description: 'A test project',
        owner: 'user-123',
        status: 'active',
        createdAt: new Date().toISOString()
      });

      const response = await fetch(`http://localhost:8787/api/projects/${projectId}`, {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(projectId);
    });

    it('should update project', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const projectId = 'project-123';
      const updates = {
        name: 'Updated Project Name',
        description: 'Updated description'
      };

      mockFactory.mockPatch(`/api/projects/${projectId}`, {
        id: projectId,
        ...updates,
        updatedAt: new Date().toISOString()
      });

      const response = await fetch(`http://localhost:8787/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-abc123'
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe(updates.name);
    });

    it('should delete project', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const projectId = 'project-123';

      mockFactory.mockDelete(`/api/projects/${projectId}`, null);

      const response = await fetch(`http://localhost:8787/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      expect(response.status).toBe(204);
    });
  });

  describe('File Storage API', () => {
    it('should upload a file', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const fileData = {
        name: 'test-file.txt',
        size: 1024,
        type: 'text/plain'
      };

      mockFactory.mockPost('/api/files/upload', {
        id: 'file-123',
        name: fileData.name,
        size: fileData.size,
        type: fileData.type,
        url: 'https://storage.example.com/files/test-file.txt',
        createdAt: new Date().toISOString()
      });

      const formData = new FormData();
      formData.append('file', new Blob(['test content']), fileData.name);

      const response = await fetch('http://localhost:8787/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        },
        body: formData
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe(fileData.name);
      expect(data.url).toBeDefined();
    });

    it('should list files', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/api/files', ApiResponseFixture.paginated([
        { id: 'file-1', name: 'file1.txt', size: 1024 },
        { id: 'file-2', name: 'file2.txt', size: 2048 }
      ], 1, 10, 2));

      const response = await fetch('http://localhost:8787/api/files', {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toBeDefined();
    });

    it('should delete a file', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const fileId = 'file-123';

      mockFactory.mockDelete(`/api/files/${fileId}`, null);

      const response = await fetch(`http://localhost:8787/api/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      expect(response.status).toBe(204);
    });
  });

  describe('Webhook API', () => {
    it('should create a webhook', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const webhookData = {
        url: 'https://example.com/webhooks/test',
        events: ['user.created', 'user.updated']
      };

      mockFactory.mockPost('/api/webhooks', {
        id: 'webhook-123',
        url: webhookData.url,
        events: webhookData.events,
        secret: 'webhook-secret-abc',
        active: true,
        createdAt: new Date().toISOString()
      });

      const response = await fetch('http://localhost:8787/api/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-abc123'
        },
        body: JSON.stringify(webhookData)
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.url).toBe(webhookData.url);
      expect(data.events).toEqual(webhookData.events);
    });

    it('should list webhooks', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/api/webhooks', [
        { id: 'webhook-1', url: 'https://example.com/webhook1', active: true },
        { id: 'webhook-2', url: 'https://example.com/webhook2', active: true }
      ]);

      const response = await fetch('http://localhost:8787/api/webhooks', {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should delete a webhook', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      const webhookId = 'webhook-123';

      mockFactory.mockDelete(`/api/webhooks/${webhookId}`, null);

      const response = await fetch(`http://localhost:8787/api/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      expect(response.status).toBe(204);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent resources', async () => {
      const response = await fetch('http://localhost:8787/api/non-existent', {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthorized requests', async () => {
      const response = await fetch('http://localhost:8787/api/users/me');

      expect(response.status).toBe(401);
    });

    it('should return 403 for forbidden requests', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockDelete('/api/admin/users/user-123', ApiResponseFixture.error(
        'Forbidden',
        'FORBIDDEN',
        403
      ));

      const response = await fetch('http://localhost:8787/api/admin/users/user-123', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer user-token'
        }
      });

      expect(response.status).toBe(403);
    });

    it('should return 422 for validation errors', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockPost('/auth/register', ApiResponseFixture.validationError({
        email: ['Email is required'],
        password: ['Password must be at least 8 characters']
      }));

      const response = await fetch('http://localhost:8787/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '', password: 'short' })
      });

      expect(response.status).toBe(422);
    });

    it('should return 500 for server errors', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/api/error', ApiResponseFixture.error(
        'Internal server error',
        'INTERNAL_ERROR',
        500
      ));

      const response = await fetch('http://localhost:8787/api/error', {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      expect(response.status).toBe(500);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const mockFactory = mockInterceptor.getMockFactory();

      // First 10 requests succeed
      for (let i = 0; i < 10; i++) {
        mockFactory.mockGet('/api/test', { message: 'OK' });
        const response = await fetch('http://localhost:8787/api/test', {
          headers: {
            'Authorization': 'Bearer mock-token-abc123'
          }
        });
        expect(response.status).toBe(200);
      }

      // 11th request fails
      mockFactory.mockGet('/api/test', ApiResponseFixture.error(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429
      ));

      const response = await fetch('http://localhost:8787/api/test', {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      expect(response.status).toBe(429);
    });

    it('should include rate limit headers', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/api/test', {
        message: 'OK'
      }, {
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
          'X-RateLimit-Reset': Date.now().toString()
        }
      });

      const response = await fetch('http://localhost:8787/api/test', {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
    });
  });

  describe('Pagination', () => {
    it('should support pagination parameters', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/api/projects', ApiResponseFixture.paginated(
        Array.from({ length: 10 }, (_, i) => ({
          id: `project-${i}`,
          name: `Project ${i}`
        })),
        1,
        10,
        25
      ));

      const response = await fetch('http://localhost:8787/api/projects?page=1&limit=10', {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(10);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.pageSize).toBe(10);
      expect(data.pagination.total).toBe(25);
      expect(data.pagination.hasNext).toBe(true);
      expect(data.pagination.hasPrev).toBe(false);
    });

    it('should handle pagination boundaries', async () => {
      const mockFactory = mockInterceptor.getMockFactory();
      mockFactory.mockGet('/api/projects?page=3', ApiResponseFixture.paginated(
        Array.from({ length: 5 }, (_, i) => ({
          id: `project-${i + 20}`,
          name: `Project ${i + 20}`
        })),
        3,
        10,
        25
      ));

      const response = await fetch('http://localhost:8787/api/projects?page=3&limit=10', {
        headers: {
          'Authorization': 'Bearer mock-token-abc123'
        }
      });

      const data = await response.json();

      expect(data.items).toHaveLength(5);
      expect(data.pagination.hasNext).toBe(false);
      expect(data.pagination.hasPrev).toBe(true);
    });
  });
});

export {};
