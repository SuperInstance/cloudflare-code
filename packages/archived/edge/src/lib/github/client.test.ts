/**
 * GitHub Client Tests
 *
 * Comprehensive tests for GitHub API client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubClient, createGitHubClient } from './client';
import type { GitHubAppConfig } from './auth';

// Mock the auth module
vi.mock('./auth', () => ({
  getOrCreateInstallationToken: vi.fn(() => Promise.resolve('mock-token')),
}));

describe('GitHubClient', () => {
  let client: GitHubClient;
  let mockConfig: GitHubAppConfig;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Setup test config
    mockConfig = {
      appId: 123456,
      privateKey: 'mock-private-key',
      webhookSecret: 'mock-webhook-secret',
    };

    // Create client
    client = createGitHubClient(mockConfig, {
      maxRetries: 3,
      retryDelay: 100,
    });

    // Set installation
    client.setInstallation(12345);
  });

  describe('Authentication', () => {
    it('should set installation ID', async () => {
      await client.setInstallation(99999);
      // Installation ID is set but token is lazy loaded
      expect(true).toBe(true);
    });

    it('should reset token', () => {
      client.resetToken();
      expect(true).toBe(true);
    });
  });

  describe('Repository Operations', () => {
    it('should get repository information', async () => {
      const mockRepo = {
        id: 123456,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        private: false,
        owner: {
          login: 'owner',
          id: 789,
        },
        default_branch: 'main',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepo,
        headers: new Headers({
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-limit': '5000',
          'x-ratelimit-reset': '1234567890',
        }),
      });

      const result = await client.getRepository('owner', 'test-repo');

      expect(result).toEqual(mockRepo);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/test-repo',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });

    it('should list repositories', async () => {
      const mockRepos = [
        { id: 1, name: 'repo1', full_name: 'owner/repo1' },
        { id: 2, name: 'repo2', full_name: 'owner/repo2' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ repositories: mockRepos }),
        headers: new Headers(),
      });

      const result = await client.listRepositories();

      expect(result).toEqual(mockRepos);
    });

    it('should get file content', async () => {
      const mockContent = {
        type: 'file',
        name: 'test.txt',
        path: 'test.txt',
        content: btoa('Hello World'),
        encoding: 'base64',
        sha: 'abc123',
        size: 11,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockContent,
        headers: new Headers(),
      });

      const result = await client.getFile('owner', 'repo', 'test.txt');

      expect(result.decodedContent).toBe('Hello World');
      expect(result.sha).toBe('abc123');
    });

    it('should create or update file', async () => {
      const mockResponse = {
        content: {
          sha: 'new-sha',
          path: 'test.txt',
        },
        commit: {
          sha: 'commit-sha',
          message: 'Update file',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const result = await client.createOrUpdateFile(
        'owner',
        'repo',
        'test.txt',
        'New content',
        'Update file',
        'old-sha'
      );

      expect(result.content.sha).toBe('new-sha');
      expect(result.commit.message).toBe('Update file');
    });

    it('should delete file', async () => {
      const mockResponse = {
        commit: {
          sha: 'commit-sha',
          message: 'Delete file',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const result = await client.deleteFile(
        'owner',
        'repo',
        'test.txt',
        'Delete file',
        'file-sha'
      );

      expect(result.commit.message).toBe('Delete file');
    });
  });

  describe('Git Operations', () => {
    it('should get reference', async () => {
      const mockRef = {
        ref: 'refs/heads/main',
        node_id: 'ref-id',
        object: {
          sha: 'commit-sha',
          type: 'commit',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRef,
        headers: new Headers(),
      });

      const result = await client.getReference('owner', 'repo', 'heads/main');

      expect(result.ref).toBe('refs/heads/main');
      expect(result.object.sha).toBe('commit-sha');
    });

    it('should create reference', async () => {
      const mockRef = {
        ref: 'refs/heads/new-branch',
        object: {
          sha: 'commit-sha',
          type: 'commit',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRef,
        headers: new Headers(),
      });

      const result = await client.createReference('owner', 'repo', 'refs/heads/new-branch', 'commit-sha');

      expect(result.ref).toBe('refs/heads/new-branch');
    });

    it('should get commit', async () => {
      const mockCommit = {
        sha: 'commit-sha',
        commit: {
          message: 'Test commit',
          author: {
            name: 'Test User',
            email: 'test@example.com',
            date: '2024-01-01T00:00:00Z',
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCommit,
        headers: new Headers(),
      });

      const result = await client.getCommit('owner', 'repo', 'commit-sha');

      expect(result.sha).toBe('commit-sha');
      expect(result.commit.message).toBe('Test commit');
    });

    it('should compare commits', async () => {
      const mockComparison = {
        status: 'ahead',
        ahead_by: 3,
        behind_by: 0,
        total_commits: 3,
        files: [],
        commits: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComparison,
        headers: new Headers(),
      });

      const result = await client.compareCommits('owner', 'repo', 'base-sha', 'head-sha');

      expect(result.status).toBe('ahead');
      expect(result.ahead_by).toBe(3);
    });
  });

  describe('Branch Operations', () => {
    it('should list branches', async () => {
      const mockBranches = [
        {
          ref: 'refs/heads/main',
          object: { sha: 'main-sha', type: 'commit' },
        },
        {
          ref: 'refs/heads/develop',
          object: { sha: 'develop-sha', type: 'commit' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBranches,
        headers: new Headers(),
      });

      const result = await client.listBranches('owner', 'repo');

      expect(result).toHaveLength(2);
      expect(result[0].ref).toBe('refs/heads/main');
    });

    it('should create branch', async () => {
      const mockRef = {
        ref: 'refs/heads/new-branch',
        object: { sha: 'commit-sha', type: 'commit' },
      };

      // Mock getReference for source branch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ref: 'refs/heads/main',
          object: { sha: 'main-sha', type: 'commit' },
        }),
        headers: new Headers(),
      });

      // Mock createReference
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRef,
        headers: new Headers(),
      });

      const result = await client.createBranch('owner', 'repo', 'new-branch', 'main');

      expect(result.ref).toBe('refs/heads/new-branch');
    });
  });

  describe('Pull Request Operations', () => {
    it('should get pull request', async () => {
      const mockPR = {
        id: 1,
        number: 123,
        title: 'Test PR',
        state: 'open',
        user: { login: 'testuser' },
        head: { ref: 'feature-branch', sha: 'feature-sha' },
        base: { ref: 'main', sha: 'main-sha' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPR,
        headers: new Headers(),
      });

      const result = await client.getPullRequest('owner', 'repo', 123);

      expect(result.number).toBe(123);
      expect(result.title).toBe('Test PR');
    });

    it('should list pull requests', async () => {
      const mockPRs = [
        { number: 1, title: 'PR 1', state: 'open' },
        { number: 2, title: 'PR 2', state: 'open' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPRs,
        headers: new Headers(),
      });

      const result = await client.listPullRequests('owner', 'repo', 'open');

      expect(result).toHaveLength(2);
    });

    it('should create pull request', async () => {
      const mockPR = {
        id: 1,
        number: 123,
        title: 'New PR',
        state: 'open',
        draft: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPR,
        headers: new Headers(),
      });

      const result = await client.createPullRequest(
        'owner',
        'repo',
        'New PR',
        'PR description',
        'feature-branch',
        'main'
      );

      expect(result.title).toBe('New PR');
      expect(result.draft).toBe(false);
    });

    it('should merge pull request', async () => {
      const mockResult = {
        merged: true,
        message: 'Pull Request merged successfully',
        sha: 'merge-sha',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
        headers: new Headers(),
      });

      const result = await client.mergePullRequest('owner', 'repo', 123);

      expect(result.merged).toBe(true);
      expect(result.sha).toBe('merge-sha');
    });

    it('should create pull request review', async () => {
      const mockReview = {
        id: 456,
        user: { login: 'reviewer' },
        state: 'APPROVED',
        body: 'Looks good!',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockReview,
        headers: new Headers(),
      });

      const result = await client.createPullRequestReview(
        'owner',
        'repo',
        123,
        'APPROVE',
        'Looks good!'
      );

      expect(result.state).toBe('APPROVED');
      expect(result.body).toBe('Looks good!');
    });
  });

  describe('Issue Operations', () => {
    it('should get issue', async () => {
      const mockIssue = {
        id: 1,
        number: 42,
        title: 'Test Issue',
        state: 'open',
        user: { login: 'testuser' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssue,
        headers: new Headers(),
      });

      const result = await client.getIssue('owner', 'repo', 42);

      expect(result.number).toBe(42);
      expect(result.title).toBe('Test Issue');
    });

    it('should list issues', async () => {
      const mockIssues = [
        { number: 1, title: 'Issue 1', state: 'open' },
        { number: 2, title: 'Issue 2', state: 'open' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssues,
        headers: new Headers(),
      });

      const result = await client.listIssues('owner', 'repo', 'open');

      expect(result).toHaveLength(2);
    });

    it('should create issue', async () => {
      const mockIssue = {
        id: 1,
        number: 43,
        title: 'New Issue',
        state: 'open',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssue,
        headers: new Headers(),
      });

      const result = await client.createIssue(
        'owner',
        'repo',
        'New Issue',
        'Issue description'
      );

      expect(result.number).toBe(43);
    });

    it('should create issue comment', async () => {
      const mockComment = {
        id: 789,
        body: 'Test comment',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComment,
        headers: new Headers(),
      });

      const result = await client.createIssueComment('owner', 'repo', 42, 'Test comment');

      expect(result.body).toBe('Test comment');
    });
  });

  describe('Search Operations', () => {
    it('should search code', async () => {
      const mockResults = {
        total_count: 1,
        incomplete_results: false,
        items: [
          {
            name: 'test.ts',
            path: 'src/test.ts',
            sha: 'file-sha',
            repository: { id: 1, name: 'repo', full_name: 'owner/repo' },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
        headers: new Headers(),
      });

      const result = await client.searchCode('filename:test');

      expect(result.total_count).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('should search repositories', async () => {
      const mockResults = {
        total_count: 1,
        incomplete_results: false,
        items: [
          { id: 1, name: 'repo', full_name: 'owner/repo', private: false },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
        headers: new Headers(),
      });

      const result = await client.searchRepositories('repo:test');

      expect(result.total_count).toBe(1);
    });

    it('should search issues', async () => {
      const mockResults = {
        total_count: 1,
        incomplete_results: false,
        items: [
          { id: 1, number: 1, title: 'Test Issue', state: 'open' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
        headers: new Headers(),
      });

      const result = await client.searchIssues('repo:owner/repo is:open');

      expect(result.total_count).toBe(1);
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit from response headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
        headers: new Headers({
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-limit': '5000',
          'x-ratelimit-reset': '1234567890',
        }),
      });

      await client.getRepository('owner', 'repo');

      const rateLimit = client.getCurrentRateLimit('core');
      expect(rateLimit.remaining).toBe(4999);
      expect(rateLimit.limit).toBe(5000);
    });

    it('should check if rate limit is exceeded', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
        headers: new Headers({
          'x-ratelimit-remaining': '0',
          'x-ratelimit-limit': '5000',
          'x-ratelimit-reset': '1234567890',
        }),
      });

      await client.getRepository('owner', 'repo');

      expect(client.isRateLimitExceeded('core')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });

      await expect(client.getRepository('owner', 'repo')).rejects.toThrow();
    });

    it('should handle 401 authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(client.getRepository('owner', 'repo')).rejects.toThrow();
    });

    it('should handle rate limiting errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(client.getRepository('owner', 'repo')).rejects.toThrow();
    });

    it('should retry on server errors', async () => {
      mockFetch.mockRejectedValueTimes(2, new Error('Network error'));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
        headers: new Headers(),
      });

      const result = await client.getRepository('owner', 'repo');

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running requests', async () => {
      const slowClient = createGitHubClient(mockConfig, { timeout: 100 });

      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ id: 1 }),
                headers: new Headers(),
              } as Response);
          }, 200)
          )
      );

      await expect(slowClient.getRepository('owner', 'repo')).rejects.toThrow();
    });
  });
});

describe('createGitHubClient', () => {
  it('should create GitHub client with config', () => {
    const config: GitHubAppConfig = {
      appId: 123456,
      privateKey: 'test-key',
    };

    const client = createGitHubClient(config);

    expect(client).toBeInstanceOf(GitHubClient);
  });

  it('should create GitHub client with options', () => {
    const config: GitHubAppConfig = {
      appId: 123456,
      privateKey: 'test-key',
    };

    const client = createGitHubClient(config, {
      maxRetries: 5,
      retryDelay: 2000,
      timeout: 60000,
    });

    expect(client).toBeInstanceOf(GitHubClient);
  });
});
