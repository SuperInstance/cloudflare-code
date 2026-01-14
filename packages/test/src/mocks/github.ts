/**
 * GitHub API Mocks
 *
 * Mock responses for GitHub API endpoints
 */

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  bio: string;
  location: string;
  blog: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  type: 'User' | 'Organization';
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  description: string;
  private: boolean;
  fork: boolean;
  language: string;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  clone_url: string;
  homepage: string;
  topics: string[];
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  url: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'tree' | 'blob';
  size?: number;
  sha: string;
  url: string;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  labels: Array<{
    name: string;
    color: string;
  }>;
  assignee?: GitHubUser;
  milestone?: {
    id: number;
    title: string;
  };
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  head: {
    label: string;
    ref: string;
    sha: string;
  };
  base: {
    label: string;
    ref: string;
    sha: string;
  };
  mergeable: boolean;
  merged: boolean;
  comments: number;
  review_comments: number;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  updated_at: string;
  merged_at?: string;
}

/**
 * Mock GitHub user
 */
export const mockGitHubUser: GitHubUser = {
  id: 1,
  login: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  avatar_url: 'https://github.com/images/error/testuser_happy.gif',
  bio: 'Test user for E2E tests',
  location: 'San Francisco',
  blog: 'https://testuser.com',
  public_repos: 10,
  followers: 100,
  following: 50,
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  type: 'User',
};

/**
 * Mock GitHub repository
 */
export const mockGitHubRepository: GitHubRepository = {
  id: 1,
  name: 'test-repo',
  full_name: 'testuser/test-repo',
  owner: mockGitHubUser,
  description: 'Test repository for E2E tests',
  private: false,
  fork: false,
  language: 'TypeScript',
  stargazers_count: 42,
  watchers_count: 42,
  forks_count: 10,
  open_issues_count: 5,
  size: 1024,
  default_branch: 'main',
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  pushed_at: '2024-01-01T00:00:00Z',
  clone_url: 'https://github.com/testuser/test-repo.git',
  homepage: 'https://testuser.github.io/test-repo',
  topics: ['typescript', 'testing', 'e2e'],
};

/**
 * Mock GitHub branches
 */
export const mockGitHubBranches: GitHubBranch[] = [
  {
    name: 'main',
    commit: {
      sha: 'abc123def456',
      url: 'https://api.github.com/repos/testuser/test-repo/commits/abc123def456',
    },
    protected: true,
  },
  {
    name: 'develop',
    commit: {
      sha: 'def456ghi789',
      url: 'https://api.github.com/repos/testuser/test-repo/commits/def456ghi789',
    },
    protected: false,
  },
];

/**
 * Mock GitHub commits
 */
export const mockGitHubCommits: GitHubCommit[] = [
  {
    sha: 'abc123def456',
    url: 'https://api.github.com/repos/testuser/test-repo/commits/abc123def456',
    message: 'Initial commit',
    author: {
      name: 'Test User',
      email: 'test@example.com',
      date: '2024-01-01T00:00:00Z',
    },
    committer: {
      name: 'Test User',
      email: 'test@example.com',
      date: '2024-01-01T00:00:00Z',
    },
  },
  {
    sha: 'def456ghi789',
    url: 'https://api.github.com/repos/testuser/test-repo/commits/def456ghi789',
    message: 'Add new feature',
    author: {
      name: 'Test User',
      email: 'test@example.com',
      date: '2024-01-02T00:00:00Z',
    },
    committer: {
      name: 'Test User',
      email: 'test@example.com',
      date: '2024-01-02T00:00:00Z',
    },
  },
];

/**
 * Mock GitHub tree items
 */
export const mockGitHubTree: GitHubTreeItem[] = [
  {
    path: 'src',
    mode: '040000',
    type: 'tree',
    sha: 'tree123',
    url: 'https://api.github.com/repos/testuser/test-repo/git/trees/tree123',
  },
  {
    path: 'README.md',
    mode: '100644',
    type: 'blob',
    size: 1024,
    sha: 'blob123',
    url: 'https://api.github.com/repos/testuser/test-repo/git/blobs/blob123',
  },
  {
    path: 'package.json',
    mode: '100644',
    type: 'blob',
    size: 512,
    sha: 'blob456',
    url: 'https://api.github.com/repos/testuser/test-repo/git/blobs/blob456',
  },
];

/**
 * Mock GitHub contents
 */
export const mockGitHubContents: GitHubContent[] = [
  {
    name: 'index.ts',
    path: 'src/index.ts',
    sha: 'file123',
    size: 2048,
    url: 'https://api.github.com/repos/testuser/test-repo/contents/src/index.ts',
    html_url: 'https://github.com/testuser/test-repo/blob/main/src/index.ts',
    git_url: 'https://api.github.com/repos/testuser/test-repo/git/blobs/file123',
    download_url: 'https://raw.githubusercontent.com/testuser/test-repo/main/src/index.ts',
    type: 'file',
  },
  {
    name: 'test',
    path: 'src/test',
    sha: 'dir123',
    size: 0,
    url: 'https://api.github.com/repos/testuser/test-repo/contents/src/test',
    html_url: 'https://github.com/testuser/test-repo/tree/main/src/test',
    git_url: 'https://api.github.com/repos/testuser/test-repo/git/trees/dir123',
    download_url: null,
    type: 'dir',
  },
];

/**
 * Mock GitHub issues
 */
export const mockGitHubIssues: GitHubIssue[] = [
  {
    id: 1,
    number: 1,
    title: 'Test Issue 1',
    body: 'This is a test issue',
    state: 'open',
    user: mockGitHubUser,
    labels: [
      { name: 'bug', color: 'd73a4a' },
      { name: 'priority: high', color: 'b60205' },
    ],
    assignee: mockGitHubUser,
    milestone: {
      id: 1,
      title: 'v1.0.0',
    },
    comments: 5,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    number: 2,
    title: 'Test Issue 2',
    body: 'This is another test issue',
    state: 'closed',
    user: mockGitHubUser,
    labels: [
      { name: 'enhancement', color: 'a2eeef' },
    ],
    comments: 2,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    closed_at: '2024-01-03T00:00:00Z',
  },
];

/**
 * Mock GitHub pull requests
 */
export const mockGitHubPullRequests: GitHubPullRequest[] = [
  {
    id: 1,
    number: 1,
    title: 'Test PR 1',
    body: 'This is a test pull request',
    state: 'open',
    user: mockGitHubUser,
    head: {
      label: 'testuser:feature-branch',
      ref: 'feature-branch',
      sha: 'abc123',
    },
    base: {
      label: 'testuser:main',
      ref: 'main',
      sha: 'def456',
    },
    mergeable: true,
    merged: false,
    comments: 3,
    review_comments: 2,
    additions: 100,
    deletions: 50,
    changed_files: 5,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

/**
 * Mock GitHub API response generator
 */
export class GitHubMockAPI {
  private responses: Map<string, any> = new Map();

  constructor() {
    // Initialize default responses
    this.responses.set('/user', mockGitHubUser);
    this.responses.set('/repos/testuser/test-repo', mockGitHubRepository);
    this.responses.set('/repos/testuser/test-repo/branches', mockGitHubBranches);
    this.responses.set('/repos/testuser/test-repo/commits', mockGitHubCommits);
    this.responses.set('/repos/testuser/test-repo/git/trees/main', { tree: mockGitHubTree });
    this.responses.set('/repos/testuser/test-repo/contents/', mockGitHubContents);
    this.responses.set('/repos/testuser/test-repo/issues', mockGitHubIssues);
    this.responses.set('/repos/testuser/test-repo/pulls', mockGitHubPullRequests);
  }

  /**
   * Set custom response
   */
  setResponse(path: string, response: any): void {
    this.responses.set(path, response);
  }

  /**
   * Get mock response
   */
  getResponse(path: string): any {
    return this.responses.get(path);
  }

  /**
   * Generate fetch mock
   */
  createFetchMock(): typeof fetch {
    const mockAPI = this;

    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const pathname = new URL(url).pathname;

      const response = mockAPI.getResponse(pathname) || {};

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-remaining': '5000',
          'x-ratelimit-limit': '5000',
        },
      });
    };
  }

  /**
   * Create rate limit error response
   */
  createRateLimitError(): Response {
    return new Response(
      JSON.stringify({
        message: 'API rate limit exceeded',
        documentation_url: 'https://docs.github.com/rest/overview/rate-limits-for-the-rest-api',
      }),
      {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }
    );
  }

  /**
   * Create not found error response
   */
  createNotFoundError(): Response {
    return new Response(
      JSON.stringify({
        message: 'Not Found',
        documentation_url: 'https://docs.github.com/rest',
      }),
      {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }
    );
  }

  /**
   * Create unauthorized error response
   */
  createUnauthorizedError(): Response {
    return new Response(
      JSON.stringify({
        message: 'Bad credentials',
        documentation_url: 'https://docs.github.com/rest',
      }),
      {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}

/**
 * Create GitHub mock API
 */
export function createGitHubMockAPI(): GitHubMockAPI {
  return new GitHubMockAPI();
}

/**
 * Mock GitHub webhook events
 */
export interface GitHubWebhookEvent {
  action?: string;
  sender: GitHubUser;
  repository: GitHubRepository;
  organization?: {
    login: string;
    id: number;
  };
}

export const mockPushEvent: GitHubWebhookEvent = {
  action: 'push',
  sender: mockGitHubUser,
  repository: mockGitHubRepository,
};

export const mockPullRequestEvent: GitHubWebhookEvent = {
  action: 'opened',
  sender: mockGitHubUser,
  repository: mockGitHubRepository,
};

export const mockIssueEvent: GitHubWebhookEvent = {
  action: 'opened',
  sender: mockGitHubUser,
  repository: mockGitHubRepository,
};
