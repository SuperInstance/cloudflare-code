/**
 * Integration Tests for GitHub API
 * These tests would require GitHub credentials and actual API calls
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GitHubClient, createGitHubClient, AuthType } from '../../src/client/client';
import { createRepositoryManager } from '../../src/repo/manager';
import { createPRAutomation } from '../../src/pr/automation';
import { createIssueManager } from '../../src/issues/manager';

describe('GitHub API Integration Tests', () => {
  let client: GitHubClient;
  const testOwner = process.env.GITHUB_TEST_OWNER || 'test-owner';
  const testRepo = process.env.GITHUB_TEST_REPO || 'test-repo';

  beforeAll(() => {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      console.warn('Skipping integration tests - GITHUB_TOKEN not set');
      return;
    }

    client = createGitHubClient({
      auth: {
        type: AuthType.PersonalAccessToken,
        token
      },
      cache: {
        enabled: true,
        ttl: 300000,
        maxSize: 100,
        type: 'memory'
      }
    });
  });

  afterAll(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  describe('Authentication', () => {
    it('should authenticate with PAT', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const user = await client.getAuthenticatedUser();

      expect(user).toBeDefined();
      expect(user.login).toBeDefined();
    });
  });

  describe('Repository Operations', () => {
    it('should fetch repository', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const repoManager = createRepositoryManager(client);
      const repo = await repoManager.getRepository(testOwner, testRepo);

      expect(repo).toBeDefined();
      expect(repo.name).toBe(testRepo);
      expect(repo.owner.login).toBe(testOwner);
    });

    it('should list branches', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const repoManager = createRepositoryManager(client);
      const branches = await repoManager.listBranches(testOwner, testRepo);

      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBeGreaterThan(0);
    });

    it('should get repository analytics', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const repoManager = createRepositoryManager(client);
      const analytics = await repoManager.getRepositoryAnalytics(testOwner, testRepo);

      expect(analytics).toBeDefined();
      expect(analytics.stars).toBeGreaterThanOrEqual(0);
      expect(analytics.watchers).toBeGreaterThanOrEqual(0);
      expect(analytics.forks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pull Request Operations', () => {
    it('should list pull requests', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const prAutomation = createPRAutomation(client);
      const prs = await prAutomation.listPullRequests(testOwner, testRepo);

      expect(Array.isArray(prs)).toBe(true);
    });

    it('should get PR if exists', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const prAutomation = createPRAutomation(client);
      const prs = await prAutomation.listPullRequests(testOwner, testRepo, {
        state: 'open',
        perPage: 1
      });

      if (prs.length > 0) {
        const pr = await prAutomation.getPullRequest(testOwner, testRepo, prs[0].number);
        expect(pr).toBeDefined();
        expect(pr.number).toBe(prs[0].number);
      }
    });
  });

  describe('Issue Operations', () => {
    it('should list issues', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const issueManager = createIssueManager(client);
      const issues = await issueManager.listIssues(testOwner, testRepo);

      expect(Array.isArray(issues)).toBe(true);
    });

    it('should get issue analytics', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const issueManager = createIssueManager(client);
      const analytics = await issueManager.getAnalytics(testOwner, testRepo);

      expect(analytics).toBeDefined();
      expect(analytics.total).toBeGreaterThanOrEqual(0);
      expect(analytics.open).toBeGreaterThanOrEqual(0);
      expect(analytics.closed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limits', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const limits = client.getRateLimits();

      expect(limits).toHaveProperty('core');
      expect(limits).toHaveProperty('search');
      expect(limits).toHaveProperty('graphql');

      expect(limits.core.limit).toBeGreaterThan(0);
      expect(limits.core.remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Caching', () => {
    it('should cache responses', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const cache = client.getCache();

      // First call should cache
      const repo1 = await client.getRepository(testOwner, testRepo);

      // Second call should use cache
      const repo2 = await client.getRepository(testOwner, testRepo);

      expect(repo1.id).toBe(repo2.id);

      const stats = client.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should clear cache', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      await client.clearCache();

      const stats = client.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('GraphQL Operations', () => {
    it('should execute GraphQL query', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const query = `
        query {
          viewer {
            login
            name
          }
        }
      `;

      const result = await client.graphql(query);

      expect(result).toBeDefined();
      expect(result.viewer).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundError for non-existent repository', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const { NotFoundError } = await import('../../src/errors');

      await expect(
        client.getRepository('nonexistent-owner-123456', 'nonexistent-repo-123456')
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle invalid authentication', async () => {
      const invalidClient = createGitHubClient({
        auth: {
          type: AuthType.PersonalAccessToken,
          token: 'invalid-token-12345'
        },
        cache: {
          enabled: false,
          ttl: 0,
          maxSize: 0,
          type: 'memory'
        }
      });

      const { AuthenticationError } = await import('../../src/errors');

      await expect(
        invalidClient.getAuthenticatedUser()
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent requests', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const promises = [
        client.getRepository(testOwner, testRepo),
        client.listRepositories({ perPage: 5 }),
        client.getAuthenticatedUser()
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[2]).toBeDefined();
    });
  });
});
