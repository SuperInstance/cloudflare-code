/**
 * API contract tests for ClaudeFlare
 */

// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ContractTestRunner } from './runner';
import type { ContractTestConfig } from '../utils/types';

describe('API Contract Tests', () => {
  let runner: ContractTestRunner;

  beforeAll(() => {
    const config: ContractTestConfig = {
      providerBaseUrl: 'http://localhost:8787',
      consumerVersions: ['1.0.0'],
      publishContracts: true
    };

    runner = new ContractTestRunner(config);
  });

  describe('User API Contracts', () => {
    it('should define GET /api/users/me contract', async () => {
      const interaction = runner.createGetInteraction(
        'Get current user',
        '/api/users/me',
        {
          status: 200,
          body: {
            id: 'user-123',
            email: 'user@example.com',
            username: 'testuser',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            createdAt: '2024-01-01T00:00:00.000Z'
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });

    it('should define POST /api/auth/register contract', async () => {
      const interaction = runner.createPostInteraction(
        'Register new user',
        '/api/auth/register',
        {
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'SecurePassword123!'
        },
        {
          status: 201,
          body: {
            user: {
              id: 'user-456',
              email: 'newuser@example.com',
              username: 'newuser'
            },
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });

    it('should define POST /api/auth/login contract', async () => {
      const interaction = runner.createPostInteraction(
        'Login user',
        '/api/auth/login',
        {
          email: 'user@example.com',
          password: 'password123'
        },
        {
          status: 200,
          body: {
            user: {
              id: 'user-123',
              email: 'user@example.com'
            },
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });
  });

  describe('Project API Contracts', () => {
    it('should define GET /api/projects contract', async () => {
      const interaction = runner.createGetInteraction(
        'List projects',
        '/api/projects',
        {
          status: 200,
          body: {
            items: [
              {
                id: 'project-1',
                name: 'Project 1',
                description: 'First project',
                status: 'active',
                createdAt: '2024-01-01T00:00:00.000Z'
              }
            ],
            pagination: {
              page: 1,
              pageSize: 10,
              totalPages: 1,
              total: 1,
              hasNext: false,
              hasPrev: false
            }
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });

    it('should define POST /api/projects contract', async () => {
      const interaction = runner.createPostInteraction(
        'Create project',
        '/api/projects',
        {
          name: 'New Project',
          description: 'A new project',
          visibility: 'private'
        },
        {
          status: 201,
          body: {
            id: 'project-2',
            name: 'New Project',
            description: 'A new project',
            visibility: 'private',
            owner: 'user-123',
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z'
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });

    it('should define GET /api/projects/:id contract', async () => {
      const interaction = runner.createGetInteraction(
        'Get project by ID',
        '/api/projects/project-1',
        {
          status: 200,
          body: {
            id: 'project-1',
            name: 'Project 1',
            description: 'First project',
            visibility: 'private',
            owner: 'user-123',
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });

    it('should define PATCH /api/projects/:id contract', async () => {
      const interaction = runner.createPutInteraction(
        'Update project',
        '/api/projects/project-1',
        {
          name: 'Updated Project Name',
          description: 'Updated description'
        },
        {
          status: 200,
          body: {
            id: 'project-1',
            name: 'Updated Project Name',
            description: 'Updated description',
            updatedAt: '2024-01-01T01:00:00.000Z'
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });

    it('should define DELETE /api/projects/:id contract', async () => {
      const interaction = runner.createDeleteInteraction(
        'Delete project',
        '/api/projects/project-1',
        {
          status: 204
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });
  });

  describe('Error Contract Tests', () => {
    it('should define 404 error contract', async () => {
      const interaction = runner.createGetInteraction(
        'Get non-existent resource',
        '/api/projects/non-existent',
        {
          status: 404,
          body: {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Project not found',
              status: 404
            }
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });

    it('should define 401 error contract', async () => {
      const interaction = runner.createGetInteraction(
        'Access protected resource without auth',
        '/api/users/me',
        {
          status: 401,
          body: {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
              status: 401
            }
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });

    it('should define 422 validation error contract', async () => {
      const interaction = runner.createPostInteraction(
        'Submit invalid data',
        '/api/auth/register',
        {
          email: 'invalid-email',
          password: 'weak'
        },
        {
          status: 422,
          body: {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: {
                email: ['Email is invalid'],
                password: ['Password is too weak']
              },
              status: 422
            }
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });

    it('should define 500 error contract', async () => {
      const interaction = runner.createGetInteraction(
        'Server error',
        '/api/error',
        {
          status: 500,
          body: {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'An internal error occurred',
              status: 500
            }
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('frontend', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });
  });

  describe('Webhook Contracts', () => {
    it('should define webhook delivery contract', async () => {
      const interaction = runner.createPostInteraction(
        'Deliver webhook',
        '/api/webhooks/hook-123',
        {
          event: 'user.created',
          timestamp: '2024-01-01T00:00:00.000Z',
          data: {
            user: {
              id: 'user-123',
              email: 'newuser@example.com'
            }
          }
        },
        {
          status: 200,
          body: {
            success: true,
            messageId: 'msg-123'
          }
        }
      );

      runner.addInteraction(interaction);

      const result = await runner.runTests('webhook-consumer', 'claudeflare-api');

      expect(result.passed).toBe(true);
    });
  });
});

export {};
