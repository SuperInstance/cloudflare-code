/**
 * End-to-End Tests for GitHub Workflow
 * Tests complete workflows from start to finish
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GitHubClient, createGitHubClient, AuthType } from '../../src/client/client';
import { createRepositoryManager } from '../../src/repo/manager';
import { createPRAutomation } from '../../src/pr/automation';
import { createIssueManager } from '../../src/issues/manager';

describe('GitHub Workflow E2E Tests', () => {
  let client: GitHubClient;
  const testOwner = process.env.GITHUB_TEST_OWNER || 'claudeflare-test';
  const testRepo = `test-repo-${Date.now()}`;

  beforeAll(async () => {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      console.warn('Skipping E2E tests - GITHUB_TOKEN not set');
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
    if (client && process.env.GITHUB_TOKEN) {
      // Clean up test repository
      try {
        await client.deleteRepository(testOwner, testRepo);
      } catch (error) {
        // Repository might not exist
      }

      await client.disconnect();
    }
  });

  describe('Repository Creation Workflow', () => {
    it('should complete full repository creation workflow', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const repoManager = createRepositoryManager(client);

      // 1. Create repository
      const repo = await repoManager.createRepositoryForAuthenticatedUser({
        name: testRepo,
        description: 'Test repository for E2E tests',
        private: true,
        autoInit: true,
        gitignoreTemplate: 'TypeScript'
      });

      expect(repo.name).toBe(testRepo);
      expect(repo.private).toBe(true);

      // 2. Create branch
      const branch = await repoManager.createBranch(testOwner, testRepo, 'feature-branch', 'main');
      expect(branch.name).toBe('feature-branch');

      // 3. Create file
      const file = await repoManager.createFile(testOwner, testRepo, 'README.md', {
        content: '# Test Repository\n\nThis is a test repository.',
        message: 'Initial README'
      });
      expect(file).toBeDefined();

      // 4. Get file
      const retrievedFile = await repoManager.getFile(testOwner, testRepo, 'README.md');
      expect(retrievedFile.name).toBe('README.md');
    });
  });

  describe('Pull Request Workflow', () => {
    it('should complete full PR workflow', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const prAutomation = createPRAutomation(client);
      const repoManager = createRepositoryManager(client);

      // 1. Create feature branch
      await repoManager.createBranch(testOwner, testRepo, 'pr-test-branch', 'main');

      // 2. Make changes
      await repoManager.createFile(testOwner, testRepo, 'test-file.md', {
        content: '# Test File\n\nThis is a test file for PR.',
        message: 'Add test file',
        branch: 'pr-test-branch'
      });

      // 3. Create PR
      const pr = await prAutomation.createPullRequest(testOwner, testRepo, {
        title: 'Test PR',
        body: 'This is a test pull request',
        head: 'pr-test-branch',
        base: 'main',
        labels: ['test'],
        draft: true
      });

      expect(pr.title).toBe('Test PR');
      expect(pr.draft).toBe(true);
      expect(pr.labels.some(l => l.name === 'test')).toBe(true);

      // 4. Update PR
      const updatedPR = await prAutomation.updatePullRequest(testOwner, testRepo, pr.number, {
        title: 'Test PR (updated)'
      });
      expect(updatedPR.title).toBe('Test PR (updated)');

      // 5. Add comment
      const comment = await prAutomation.createComment(testOwner, testRepo, pr.number, 'Test comment');
      expect(comment.body).toBe('Test comment');

      // 6. Close PR
      const closedPR = await prAutomation.updatePullRequest(testOwner, testRepo, pr.number, {
        state: 'closed'
      });
      expect(closedPR.state).toBe('closed');
    });
  });

  describe('Issue Workflow', () => {
    it('should complete full issue workflow', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const issueManager = createIssueManager(client);

      // 1. Create issue
      const issue = await issueManager.createIssue(testOwner, testRepo, {
        title: 'Test Issue',
        body: 'This is a test issue',
        labels: ['bug', 'test'],
        assignees: []
      });

      expect(issue.title).toBe('Test Issue');
      expect(issue.labels.some(l => l.name === 'bug')).toBe(true);

      // 2. Add comment
      const comment = await issueManager.createComment(testOwner, testRepo, issue.number, 'Test comment');
      expect(comment.body).toBe('Test comment');

      // 3. Update labels
      await issueManager.setLabels(testOwner, testRepo, issue.number, ['bug', 'test', 'high-priority']);

      // 4. Create milestone
      const milestone = await issueManager.createMilestone(testOwner, testRepo, 'v1.0.0', {
        description: 'First release',
        state: 'open'
      });

      // 5. Set milestone
      await issueManager.setMilestone(testOwner, testRepo, issue.number, milestone.id);

      // 6. Close issue
      const closedIssue = await issueManager.closeIssue(testOwner, testRepo, issue.number);
      expect(closedIssue.state).toBe('closed');

      // 7. Get analytics
      const analytics = await issueManager.getAnalytics(testOwner, testRepo);
      expect(analytics.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Release Workflow', () => {
    it('should complete full release workflow', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const repoManager = createRepositoryManager(client);

      // 1. Create release
      const release = await repoManager.createRelease(testOwner, testRepo, {
        tagName: 'v1.0.0',
        name: 'v1.0.0',
        body: 'First release',
        draft: true,
        prerelease: false
      });

      expect_release.tagName).toBe('v1.0.0');
      expect(release.draft).toBe(true);

      // 2. Update release
      const updatedRelease = await repoManager.updateRelease(testOwner, testRepo, release.id, {
        name: 'Release v1.0.0',
        draft: false
      });

      expect(updatedRelease.draft).toBe(false);

      // 3. Get latest release
      const latestRelease = await repoManager.getLatestRelease(testOwner, testRepo);
      expect(latestRelease.tagName).toBe('v1.0.0');
    });
  });

  describe('Bulk Operations Workflow', () => {
    it('should handle bulk issue operations', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const issueManager = createIssueManager(client);

      // 1. Create multiple issues
      const issues = await issueManager.createBatchIssues(testOwner, testRepo, [
        { title: 'Bulk Issue 1', body: 'First bulk issue' },
        { title: 'Bulk Issue 2', body: 'Second bulk issue' },
        { title: 'Bulk Issue 3', body: 'Third bulk issue' }
      ]);

      expect(issues.length).toBe(3);

      // 2. Bulk add labels
      await issueManager.bulkAddLabels(
        testOwner,
        testRepo,
        issues.map(i => i.number),
        ['bulk-test']
      );

      // 3. Bulk close
      const closedIssues = await issueManager.bulkClose(
        testOwner,
        testRepo,
        issues.map(i => i.number)
      );

      expect(closedIssues.length).toBe(3);
      expect(closedIssues.every(i => i.state === 'closed')).toBe(true);
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle and recover from errors', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      const repoManager = createRepositoryManager(client);
      const issueManager = createIssueManager(client);

      // 1. Try to get non-existent repository
      try {
        await repoManager.getRepository('nonexistent-owner-123456', 'nonexistent-repo-123456');
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).toBeDefined();
      }

      // 2. Try to get non-existent issue
      try {
        await issueManager.getIssue(testOwner, testRepo, 999999);
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).toBeDefined();
      }

      // 3. Verify client still works after errors
      const repo = await repoManager.getRepository(testOwner, testRepo);
      expect(repo.name).toBe(testRepo);
    });
  });

  describe('Rate Limit Handling Workflow', () => {
    it('should handle rate limits gracefully', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      // 1. Get initial rate limits
      const initialLimits = client.getRateLimits();
      expect(initialLimits.core.remaining).toBeGreaterThan(0);

      // 2. Make multiple requests
      const promises = Array.from({ length: 10 }, () =>
        client.getRepository(testOwner, testRepo)
      );

      await Promise.all(promises);

      // 3. Check rate limits after requests
      const finalLimits = client.getRateLimits();
      expect(finalLimits.core.remaining).toBeLessThanOrEqual(initialLimits.core.remaining);

      // 4. Verify rate limit tracking works
      expect(finalLimits.core.limit).toBe(initialLimits.core.limit);
    });
  });

  describe('Cache Invalidation Workflow', () => {
    it('should handle cache invalidation correctly', async () => {
      if (!process.env.GITHUB_TOKEN) {
        return;
      }

      // 1. Fetch repository (should cache)
      const repo1 = await client.getRepository(testOwner, testRepo);
      const stats1 = client.getCacheStats();

      expect(stats1.hits).toBe(0);
      expect(stats1.misses).toBe(1);

      // 2. Fetch again (should hit cache)
      const repo2 = await client.getRepository(testOwner, testRepo);
      const stats2 = client.getCacheStats();

      expect(stats2.hits).toBe(1);
      expect(stats2.misses).toBe(1);

      // 3. Clear cache
      await client.clearCache();
      const stats3 = client.getCacheStats();

      expect(stats3.hits).toBe(0);
      expect(stats3.misses).toBe(0);

      // 4. Fetch again (should miss cache)
      const repo3 = await client.getRepository(testOwner, testRepo);
      const stats4 = client.getCacheStats();

      expect(stats4.hits).toBe(0);
      expect(stats4.misses).toBe(1);
    });
  });
});
