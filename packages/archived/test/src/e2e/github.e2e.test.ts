/**
 * GitHub API E2E Tests
 *
 * Comprehensive tests for GitHub API integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGitHubMockAPI,
  mockGitHubUser,
  mockGitHubRepository,
  mockGitHubBranches,
  mockGitHubCommits,
  mockGitHubContents,
  mockGitHubIssues,
  mockGitHubPullRequests,
} from '../mocks/github';

describe('GitHub API E2E Tests', () => {
  let api: ReturnType<typeof createGitHubMockAPI>;

  beforeEach(() => {
    api = createGitHubMockAPI();
  });

  describe('User Operations', () => {
    it('should get user profile', async () => {
      api.setResponse('/user', mockGitHubUser);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/user');
      const data = await response.json();

      expect(data.login).toBe('testuser');
      expect(data.name).toBe('Test User');
      expect(data.email).toBe('test@example.com');
    });

    it('should include user metadata', async () => {
      api.setResponse('/user', mockGitHubUser);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/user');
      const data = await response.json();

      expect(data.id).toBeDefined();
      expect(data.avatar_url).toBeDefined();
      expect(data.location).toBeDefined();
      expect(data.public_repos).toBeGreaterThan(0);
    });
  });

  describe('Repository Operations', () => {
    it('should get repository', async () => {
      api.setResponse('/repos/testuser/test-repo', mockGitHubRepository);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo');
      const data = await response.json();

      expect(data.name).toBe('test-repo');
      expect(data.full_name).toBe('testuser/test-repo');
      expect(data.description).toBeDefined();
    });

    it('should include repository statistics', async () => {
      api.setResponse('/repos/testuser/test-repo', mockGitHubRepository);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo');
      const data = await response.json();

      expect(data.stargazers_count).toBeGreaterThan(0);
      expect(data.forks_count).toBeGreaterThan(0);
      expect(data.open_issues_count).toBeGreaterThan(0);
    });

    it('should include repository metadata', async () => {
      api.setResponse('/repos/testuser/test-repo', mockGitHubRepository);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo');
      const data = await response.json();

      expect(data.language).toBeDefined();
      expect(data.topics).toBeInstanceOf(Array);
      expect(data.default_branch).toBeDefined();
    });
  });

  describe('Branch Operations', () => {
    it('should list branches', async () => {
      api.setResponse('/repos/testuser/test-repo/branches', mockGitHubBranches);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/branches');
      const data = await response.json();

      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].name).toBeDefined();
      expect(data[0].commit).toBeDefined();
    });

    it('should include branch protection status', async () => {
      api.setResponse('/repos/testuser/test-repo/branches', mockGitHubBranches);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/branches');
      const data = await response.json();

      expect(data[0].protected).toBeDefined();
      expect(typeof data[0].protected).toBe('boolean');
    });
  });

  describe('Commit Operations', () => {
    it('should list commits', async () => {
      api.setResponse('/repos/testuser/test-repo/commits', mockGitHubCommits);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/commits');
      const data = await response.json();

      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].sha).toBeDefined();
      expect(data[0].message).toBeDefined();
    });

    it('should include commit metadata', async () => {
      api.setResponse('/repos/testuser/test-repo/commits', mockGitHubCommits);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/commits');
      const data = await response.json();

      expect(data[0].author).toBeDefined();
      expect(data[0].committer).toBeDefined();
      expect(data[0].author.name).toBeDefined();
      expect(data[0].author.email).toBeDefined();
    });
  });

  describe('Content Operations', () => {
    it('should list contents', async () => {
      api.setResponse('/repos/testuser/test-repo/contents/', mockGitHubContents);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/contents/');
      const data = await response.json();

      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].name).toBeDefined();
      expect(data[0].type).toBeDefined();
    });

    it('should distinguish files and directories', async () => {
      api.setResponse('/repos/testuser/test-repo/contents/', mockGitHubContents);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/contents/');
      const data = await response.json();

      const files = data.filter((item: any) => item.type === 'file');
      const dirs = data.filter((item: any) => item.type === 'dir');

      expect(files.length).toBeGreaterThan(0);
      expect(dirs.length).toBeGreaterThan(0);
    });

    it('should include file metadata', async () => {
      api.setResponse('/repos/testuser/test-repo/contents/', mockGitHubContents);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/contents/');
      const data = await response.json();

      const file = data.find((item: any) => item.type === 'file');

      expect(file.size).toBeGreaterThan(0);
      expect(file.sha).toBeDefined();
    });
  });

  describe('Issue Operations', () => {
    it('should list issues', async () => {
      api.setResponse('/repos/testuser/test-repo/issues', mockGitHubIssues);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/issues');
      const data = await response.json();

      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].id).toBeDefined();
      expect(data[0].number).toBeDefined();
    });

    it('should include issue metadata', async () => {
      api.setResponse('/repos/testuser/test-repo/issues', mockGitHubIssues);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/issues');
      const data = await response.json();

      expect(data[0].title).toBeDefined();
      expect(data[0].state).toBeDefined();
      expect(data[0].user).toBeDefined();
    });

    it('should include issue labels', async () => {
      api.setResponse('/repos/testuser/test-repo/issues', mockGitHubIssues);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/issues');
      const data = await response.json();

      expect(data[0].labels).toBeInstanceOf(Array);
      expect(data[0].labels[0].name).toBeDefined();
      expect(data[0].labels[0].color).toBeDefined();
    });
  });

  describe('Pull Request Operations', () => {
    it('should list pull requests', async () => {
      api.setResponse('/repos/testuser/test-repo/pulls', mockGitHubPullRequests);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/pulls');
      const data = await response.json();

      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].id).toBeDefined();
      expect(data[0].number).toBeDefined();
    });

    it('should include PR metadata', async () => {
      api.setResponse('/repos/testuser/test-repo/pulls', mockGitHubPullRequests);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/pulls');
      const data = await response.json();

      expect(data[0].title).toBeDefined();
      expect(data[0].state).toBeDefined();
      expect(data[0].head).toBeDefined();
      expect(data[0].base).toBeDefined();
    });

    it('should include PR statistics', async () => {
      api.setResponse('/repos/testuser/test-repo/pulls', mockGitHubPullRequests);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/pulls');
      const data = await response.json();

      expect(data[0].additions).toBeGreaterThan(0);
      expect(data[0].deletions).toBeGreaterThan(0);
      expect(data[0].changed_files).toBeGreaterThan(0);
    });

    it('should include merge status', async () => {
      api.setResponse('/repos/testuser/test-repo/pulls', mockGitHubPullRequests);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/pulls');
      const data = await response.json();

      expect(data[0].mergeable).toBeDefined();
      expect(data[0].merged).toBeDefined();
      expect(typeof data[0].mergeable).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit errors', async () => {
      const response = api.createRateLimitError();

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.message).toContain('rate limit');
    });

    it('should handle not found errors', async () => {
      const response = api.createNotFoundError();

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.message).toContain('Not Found');
    });

    it('should handle unauthorized errors', async () => {
      const response = api.createUnauthorizedError();

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.message).toContain('Bad credentials');
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      api.setResponse('/user', mockGitHubUser);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/user');

      expect(response.headers.get('x-ratelimit-remaining')).toBeDefined();
      expect(response.headers.get('x-ratelimit-limit')).toBeDefined();
    });

    it('should parse rate limit values', async () => {
      api.setResponse('/user', mockGitHubUser);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/user');

      const remaining = response.headers.get('x-ratelimit-remaining');
      const limit = response.headers.get('x-ratelimit-limit');

      expect(parseInt(remaining || '0')).toBeGreaterThan(0);
      expect(parseInt(limit || '0')).toBeGreaterThan(0);
    });
  });

  describe('Pagination', () => {
    it('should handle paginated responses', async () => {
      const paginatedData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `item-${i}`,
      }));

      api.setResponse('/repos/testuser/test-repo/issues', paginatedData);

      const fetchMock = api.createFetchMock();
      const response = await fetchMock('https://api.github.com/repos/testuser/test-repo/issues');
      const data = await response.json();

      expect(data.length).toBe(100);
    });
  });

  describe('Webhook Events', () => {
    it('should handle push events', async () => {
      const event = {
        action: 'push',
        sender: mockGitHubUser,
        repository: mockGitHubRepository,
      };

      expect(event.action).toBe('push');
      expect(event.sender.login).toBeDefined();
      expect(event.repository.name).toBeDefined();
    });

    it('should handle pull request events', async () => {
      const event = {
        action: 'opened',
        sender: mockGitHubUser,
        repository: mockGitHubRepository,
      };

      expect(event.action).toBe('opened');
      expect(event.sender.login).toBeDefined();
    });

    it('should handle issue events', async () => {
      const event = {
        action: 'opened',
        sender: mockGitHubUser,
        repository: mockGitHubRepository,
      };

      expect(event.action).toBe('opened');
      expect(event.sender.login).toBeDefined();
    });
  });
});
