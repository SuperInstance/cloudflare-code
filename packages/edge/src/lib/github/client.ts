/**
 * GitHub API Client
 *
 * A comprehensive GitHub API client with rate limiting, retries,
 * and error handling optimized for Cloudflare Workers
 */

import {
  GitHubRepository,
  GitHubContent,
  GitCommit,
  GitReference,
  GitTree,
  GitHubPullRequest,
  GitHubPullRequestReview,
  GitHubPullRequestComment,
  GitHubIssue,
  FileDiff,
  ComparisonResult,
  RateLimitInfo,
  GitHubError,
  GitHubAPIError,
  GitHubRateLimitError,
} from './types';
import { GitHubAppConfig } from './auth';

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * GitHub API Client Options
 */
export interface GitHubClientOptions {
  config: GitHubAppConfig;
  baseUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Request Options
 */
interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number>;
}

// ============================================================================
// Rate Limit Tracking
// ============================================================================

/**
 * Rate Limit State
 */
interface RateLimitState {
  core: RateLimitInfo;
  search: RateLimitInfo;
  graphql: RateLimitInfo;
  lastReset: number;
}

/**
 * Default rate limit state (GitHub defaults)
 */
const DEFAULT_RATE_LIMIT: RateLimitState = {
  core: {
    limit: 5000,
    remaining: 5000,
    reset: 0,
    used: 0,
    resource: 'core',
  },
  search: {
    limit: 30,
    remaining: 30,
    reset: 0,
    used: 0,
    resource: 'search',
  },
  graphql: {
    limit: 5000,
    remaining: 5000,
    reset: 0,
    used: 0,
    resource: 'graphql',
  },
  lastReset: Date.now(),
};

// ============================================================================
// GitHub API Client
// ============================================================================

/**
 * GitHub API Client Class
 *
 * Provides methods for interacting with the GitHub API v3
 * Handles authentication, rate limiting, retries, and error handling
 */
export class GitHubClient {
  private options: Required<GitHubClientOptions>;
  private rateLimitState: RateLimitState;
  private installationId?: number;
  private token?: string;

  constructor(options: GitHubClientOptions) {
    this.options = {
      config: options.config,
      baseUrl: options.baseUrl || 'https://api.github.com',
      maxRetries: options.maxRetries ?? 5,
      retryDelay: options.retryDelay ?? 1000,
      timeout: options.timeout ?? 30000,
    };
    this.rateLimitState = { ...DEFAULT_RATE_LIMIT };
  }

  // ========================================================================
  // Authentication
  // ========================================================================

  /**
   * Set installation context
   *
   * @param installationId - GitHub App installation ID
   */
  async setInstallation(installationId: number): Promise<void> {
    this.installationId = installationId;
    this.token = undefined; // Reset token to force refresh
  }

  /**
   * Get authentication token
   *
   * Lazily creates or retrieves cached installation token
   */
  private async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    if (!this.installationId) {
      throw new Error('Installation ID not set. Call setInstallation() first.');
    }

    // Import here to avoid circular dependency
    const { getOrCreateInstallationToken } = await import('./auth');
    this.token = await getOrCreateInstallationToken(this.installationId, this.options.config);

    return this.token;
  }

  /**
   * Reset token (force refresh on next request)
   */
  resetToken(): void {
    this.token = undefined;
  }

  // ========================================================================
  // HTTP Request Handling
  // ========================================================================

  /**
   * Make authenticated request to GitHub API
   *
   * @param endpoint - API endpoint path
   * @param options - Request options
   * @returns Response data
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      query,
    } = options;

    // Build URL
    let url = `${this.options.baseUrl}${endpoint}`;
    if (query) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        searchParams.append(key, String(value));
      }
      url += `?${searchParams.toString()}`;
    }

    // Get auth token
    const token = await this.getToken();

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ClaudeFlare-GitHub-Integration/1.0',
      ...headers,
    };

    // Build request
    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body) {
      requestInit.body = JSON.stringify(body);
    }

    // Execute request with retries
    return this.requestWithRetry<T>(url, requestInit);
  }

  /**
   * Make request with exponential backoff retry
   *
   * @param url - Request URL
   * @param init - Request init options
   * @returns Response data
   */
  private async requestWithRetry<T>(url: string, init: RequestInit): Promise<T> {
    let lastError: Error | undefined;
    const maxRetries = this.options.maxRetries;
    const baseDelay = this.options.retryDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeRequest<T>(url, init);

        // Update rate limit info from headers
        this.updateRateLimit(response.headers);

        return response.data;
      } catch (error) {
        lastError = error as Error;

        // Don't retry certain errors
        if (error instanceof GitHubAPIError) {
          if (error.status === 404 || error.status === 401 || error.status === 403) {
            throw error;
          }

          // Handle rate limiting
          if (error.status === 429) {
            const retryAfter = this.parseRetryAfter(error.githubError);
            const delay = retryAfter || this.calculateRetryDelay(attempt, baseDelay);

            if (attempt < maxRetries) {
              await this.sleep(delay);
              continue;
            }

            throw new GitHubRateLimitError(
              'Rate limit exceeded and max retries reached',
              delay,
              this.getCurrentRateLimit('core')
            );
          }
        }

        // Retry on server errors or network issues
        if (attempt < maxRetries) {
          const delay = this.calculateRetryDelay(attempt, baseDelay);
          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Execute HTTP request with timeout
   *
   * @param url - Request URL
   * @param init - Request init options
   * @returns Response with data and headers
   */
  private async executeRequest<T>(url: string, init: RequestInit): Promise<{
    data: T;
    headers: Headers;
  }> {
    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle errors
      if (!response.ok) {
        const errorBody = await response.text();
        let githubError: GitHubError | undefined;

        try {
          githubError = JSON.parse(errorBody) as GitHubError;
        } catch {
          // Response is not JSON
        }

        throw new GitHubAPIError(
          githubError?.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          githubError
        );
      }

      // Parse response
      const data = await response.json() as T;

      return { data, headers: response.headers };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.options.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   *
   * @param attempt - Current attempt number
   * @param baseDelay - Base delay in milliseconds
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(attempt: number, baseDelay: number): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = baseDelay * Math.pow(2, attempt);

    // Add jitter: random value between 0-1000ms
    const jitter = Math.random() * 1000;

    return Math.min(exponentialDelay + jitter, 60000); // Cap at 60 seconds
  }

  /**
   * Parse retry-after header or calculate from rate limit reset
   *
   * @param githubError - GitHub error response
   * @returns Retry delay in milliseconds
   */
  private parseRetryAfter(githubError?: GitHubError): number | null {
    if (githubError?.documentation_url) {
      // GitHub often includes retry info in error
      const match = githubError.documentation_url.match(/after=(\d+)/);
      if (match) {
        return parseInt(match[1], 10) * 1000;
      }
    }

    // Calculate from rate limit reset time
    const coreLimit = this.rateLimitState.core;
    if (coreLimit.remaining === 0 && coreLimit.reset > 0) {
      const resetTime = coreLimit.reset * 1000;
      const now = Date.now();
      const delay = resetTime - now;
      return Math.max(delay, 1000); // At least 1 second
    }

    return null;
  }

  /**
   * Sleep for specified milliseconds
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========================================================================
  // Rate Limit Management
  // ========================================================================

  /**
   * Update rate limit state from response headers
   *
   * @param headers - Response headers
   */
  private updateRateLimit(headers: Headers): void {
    // Update core rate limit
    const coreLimit = this.parseRateLimitHeaders(headers, 'x-ratelimit-');
    if (coreLimit) {
      this.rateLimitState.core = coreLimit;
    }

    // Update search rate limit
    const searchLimit = this.parseRateLimitHeaders(headers, 'x-ratelimit-');
    if (searchLimit) {
      this.rateLimitState.search = searchLimit;
    }
  }

  /**
   * Parse rate limit headers
   *
   * @param headers - Response headers
   * @param prefix - Header prefix
   * @returns Rate limit info or undefined
   */
  private parseRateLimitHeaders(headers: Headers, prefix: string): RateLimitInfo | undefined {
    const limit = headers.get(`${prefix}limit`);
    const remaining = headers.get(`${prefix}remaining`);
    const reset = headers.get(`${prefix}reset`);

    if (limit && remaining && reset) {
      return {
        resource: 'core',
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
        used: 0,
      };
    }

    return undefined;
  }

  /**
   * Get current rate limit for a resource
   *
   * @param resource - Resource type ('core', 'search', 'graphql')
   * @returns Rate limit info
   */
  getCurrentRateLimit(resource: 'core' | 'search' | 'graphql'): RateLimitInfo {
    return this.rateLimitState[resource];
  }

  /**
   * Check if rate limit is exceeded
   *
   * @param resource - Resource type
   * @returns True if rate limit exceeded
   */
  isRateLimitExceeded(resource: 'core' | 'search' | 'graphql'): boolean {
    return this.rateLimitState[resource].remaining === 0;
  }

  /**
   * Get time until rate limit reset
   *
   * @param resource - Resource type
   * @returns Milliseconds until reset
   */
  getTimeUntilReset(resource: 'core' | 'search' | 'graphql'): number {
    const resetTime = this.rateLimitState[resource].reset * 1000;
    const now = Date.now();
    return Math.max(0, resetTime - now);
  }

  // ========================================================================
  // Repository Operations
  // ========================================================================

  /**
   * Get repository information
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>(`/repos/${owner}/${repo}`);
  }

  /**
   * List repositories for installation
   *
   * @param page - Page number
   * @param perPage - Results per page
   * @returns List of repositories
   */
  async listRepositories(
    page: number = 1,
    perPage: number = 30
  ): Promise<GitHubRepository[]> {
    return this.request<GitHubRepository[]>(
      `/installation/repositories?page=${page}&per_page=${perPage}`
    ).then(data => (data as unknown as { repositories: GitHubRepository[] }).repositories);
  }

  /**
   * Get file content
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param path - File path
   * @param ref - Git reference (branch, tag, or commit)
   * @returns File content
   */
  async getFile(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<GitHubContent> {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const content = await this.request<GitHubContent>(
      `/repos/${owner}/${repo}/contents/${path}${query}`
    );

    // Decode base64 content if it's a file
    if (content.type === 'file' && content.content) {
      const decoded = atob(content.content);
      return { ...content, decodedContent: decoded };
    }

    return content;
  }

  /**
   * Create or update file
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param path - File path
   * @param content - File content
   * @param message - Commit message
   * @param sha - File SHA for updates (required for updates)
   * @param branch - Branch name
   * @returns Updated file content
   */
  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
    branch?: string
  ): Promise<{ content: GitHubContent; commit: GitCommit }> {
    const body: Record<string, unknown> = {
      message,
      content: btoa(content),
    };

    if (sha) {
      body.sha = sha;
    }

    if (branch) {
      body.branch = branch;
    }

    return this.request<{ content: GitHubContent; commit: GitCommit }>(
      `/repos/${owner}/${repo}/contents/${path}`,
      { method: 'PUT', body }
    );
  }

  /**
   * Delete file
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param path - File path
   * @param message - Commit message
   * @param sha - File SHA
   * @param branch - Branch name
   * @returns Commit information
   */
  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<{ commit: GitCommit }> {
    const body: Record<string, unknown> = {
      message,
      sha,
    };

    if (branch) {
      body.branch = branch;
    }

    return this.request<{ commit: GitCommit }>(
      `/repos/${owner}/${repo}/contents/${path}`,
      { method: 'DELETE', body }
    );
  }

  /**
   * Get archive link (tarball or zipball)
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param format - Archive format ('tarball' or 'zipball')
   * @param ref - Git reference
   * @returns Archive URL
   */
  async getArchiveLink(
    owner: string,
    repo: string,
    format: 'tarball' | 'zipball',
    ref?: string
  ): Promise<string> {
    const refPart = ref ? `/${encodeURIComponent(ref)}` : '';
    return `${this.options.baseUrl}/repos/${owner}/${repo}/${format}${refPart}`;
  }

  // ========================================================================
  // Git Operations
  // ========================================================================

  /**
   * Get reference (branch or tag)
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param ref - Reference name (e.g., 'heads/main')
   * @returns Git reference
   */
  async getReference(
    owner: string,
    repo: string,
    ref: string
  ): Promise<GitReference> {
    return this.request<GitReference>(`/repos/${owner}/${repo}/git/ref/${encodeURIComponent(ref)}`);
  }

  /**
   * Create reference
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param ref - Reference name (e.g., 'refs/heads/feature-branch')
   * @param sha - Commit SHA
   * @returns Created reference
   */
  async createReference(
    owner: string,
    repo: string,
    ref: string,
    sha: string
  ): Promise<GitReference> {
    return this.request<GitReference>(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: { ref, sha },
    });
  }

  /**
   * Update reference
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param ref - Reference name
   * @param sha - New commit SHA
   * @param force - Force update (default: false)
   * @returns Updated reference
   */
  async updateReference(
    owner: string,
    repo: string,
    ref: string,
    sha: string,
    force: boolean = false
  ): Promise<GitReference> {
    return this.request<GitReference>(
      `/repos/${owner}/${repo}/git/refs/${encodeURIComponent(ref)}`,
      {
        method: 'PATCH',
        body: { sha, force },
      }
    );
  }

  /**
   * Delete reference
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param ref - Reference name
   */
  async deleteReference(owner: string, repo: string, ref: string): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/git/refs/${encodeURIComponent(ref)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get commit
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param sha - Commit SHA
   * @returns Commit information
   */
  async getCommit(owner: string, repo: string, sha: string): Promise<GitCommit> {
    return this.request<GitCommit>(`/repos/${owner}/${repo}/commits/${sha}`);
  }

  /**
   * List commits
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param ref - Git reference
   * @param page - Page number
   * @param perPage - Results per page
   * @returns List of commits
   */
  async listCommits(
    owner: string,
    repo: string,
    ref?: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<GitCommit[]> {
    const query = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });

    if (ref) {
      query.append('sha', ref);
    }

    return this.request<GitCommit[]>(`/repos/${owner}/${repo}/commits?${query.toString()}`);
  }

  /**
   * Create commit
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param message - Commit message
   * @param tree - Tree SHA
   * @param parents - Parent commit SHAs
   * @returns Created commit
   */
  async createCommit(
    owner: string,
    repo: string,
    message: string,
    tree: string,
    parents: string[]
  ): Promise<GitCommit> {
    return this.request<GitCommit>(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: { message, tree, parents },
    });
  }

  /**
   * Compare two commits
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param base - Base commit SHA
   * @param head - Head commit SHA
   * @returns Comparison result
   */
  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<ComparisonResult> {
    return this.request<ComparisonResult>(
      `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`
    );
  }

  // ========================================================================
  // Branch Operations
  // ========================================================================

  /**
   * List branches
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param page - Page number
   * @param perPage - Results per page
   * @returns List of branch references
   */
  async listBranches(
    owner: string,
    repo: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<GitReference[]> {
    return this.request<GitReference[]>(
      `/repos/${owner}/${repo}/branches?page=${page}&per_page=${perPage}`
    );
  }

  /**
   * Create branch
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param branch - New branch name
   * @param fromBranch - Source branch name
   * @returns Created branch reference
   */
  async createBranch(
    owner: string,
    repo: string,
    branch: string,
    fromBranch: string
  ): Promise<GitReference> {
    // Get the source branch reference
    const sourceRef = await this.getReference(owner, repo, `heads/${fromBranch}`);

    // Create new branch from source
    return this.createReference(owner, repo, `refs/heads/${branch}`, sourceRef.object.sha);
  }

  // ========================================================================
  // Pull Request Operations
  // ========================================================================

  /**
   * Get pull request
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param number - PR number
   * @returns Pull request
   */
  async getPullRequest(
    owner: string,
    repo: string,
    number: number
  ): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${number}`);
  }

  /**
   * List pull requests
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param state - PR state
   * @param page - Page number
   * @param perPage - Results per page
   * @returns List of pull requests
   */
  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    page: number = 1,
    perPage: number = 30
  ): Promise<GitHubPullRequest[]> {
    return this.request<GitHubPullRequest[]>(
      `/repos/${owner}/${repo}/pulls?state=${state}&page=${page}&per_page=${perPage}`
    );
  }

  /**
   * Create pull request
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param title - PR title
   * @param body - PR body
   * @param head - Head branch
   * @param base - Base branch
   * @param draft - Draft PR
   * @returns Created pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string,
    draft: boolean = false
  ): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: { title, body, head, base, draft },
    });
  }

  /**
   * Update pull request
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param number - PR number
   * @param updates - Updates to apply
   * @returns Updated pull request
   */
  async updatePullRequest(
    owner: string,
    repo: string,
    number: number,
    updates: Partial<{
      title: string;
      body: string;
      state: 'open' | 'closed';
      base: string;
      draft: boolean;
    }>
  ): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${number}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  /**
   * Merge pull request
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param number - PR number
   * @param commitTitle - Merge commit title
   * @param commitMessage - Merge commit message
   * @param mergeMethod - Merge method
   * @returns Merge result
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    number: number,
    commitTitle?: string,
    commitMessage?: string,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge'
  ): Promise<{ merged: boolean; message: string; sha: string }> {
    const body: Record<string, unknown> = { merge_method: mergeMethod };

    if (commitTitle) {
      body.commit_title = commitTitle;
    }

    if (commitMessage) {
      body.commit_message = commitMessage;
    }

    return this.request<{ merged: boolean; message: string; sha: string }>(
      `/repos/${owner}/${repo}/pulls/${number}/merge`,
      { method: 'PUT', body }
    );
  }

  /**
   * List pull request reviews
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param number - PR number
   * @returns List of reviews
   */
  async listPullRequestReviews(
    owner: string,
    repo: string,
    number: number
  ): Promise<GitHubPullRequestReview[]> {
    return this.request<GitHubPullRequestReview[]>(
      `/repos/${owner}/${repo}/pulls/${number}/reviews`
    );
  }

  /**
   * Create pull request review
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param number - PR number
   * @param event - Review event
   * @param body - Review body
   * @param comments - Review comments
   * @returns Created review
   */
  async createPullRequestReview(
    owner: string,
    repo: string,
    number: number,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
    body?: string,
    comments?: Array<{
      path: string;
      position: number;
      body: string;
    }>
  ): Promise<GitHubPullRequestReview> {
    return this.request<GitHubPullRequestReview>(
      `/repos/${owner}/${repo}/pulls/${number}/reviews`,
      {
        method: 'POST',
        body: { event, body, comments },
      }
    );
  }

  /**
   * List pull request comments
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param number - PR number
   * @returns List of comments
   */
  async listPullRequestComments(
    owner: string,
    repo: string,
    number: number
  ): Promise<GitHubPullRequestComment[]> {
    return this.request<GitHubPullRequestComment[]>(
      `/repos/${owner}/${repo}/pulls/${number}/comments`
    );
  }

  /**
   * Create pull request comment
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param number - PR number
   * @param body - Comment body
   * @param commitId - Commit SHA
   * @param path - File path
   * @param position - Line position in diff
   * @returns Created comment
   */
  async createPullRequestComment(
    owner: string,
    repo: string,
    number: number,
    body: string,
    commitId: string,
    path: string,
    position: number
  ): Promise<GitHubPullRequestComment> {
    return this.request<GitHubPullRequestComment>(
      `/repos/${owner}/${repo}/pulls/${number}/comments`,
      {
        method: 'POST',
        body: { body, commit_id: commitId, path, position },
      }
    );
  }

  // ========================================================================
  // Issue Operations
  // ========================================================================

  /**
   * Get issue
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param number - Issue number
   * @returns Issue
   */
  async getIssue(owner: string, repo: string, number: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues/${number}`);
  }

  /**
   * List issues
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param state - Issue state
   * @param page - Page number
   * @param perPage - Results per page
   * @returns List of issues
   */
  async listIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    page: number = 1,
    perPage: number = 30
  ): Promise<GitHubIssue[]> {
    return this.request<GitHubIssue[]>(
      `/repos/${owner}/${repo}/issues?state=${state}&page=${page}&per_page=${perPage}`
    );
  }

  /**
   * Create issue
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param title - Issue title
   * @param body - Issue body
   * @param labels - Issue labels
   * @param assignees - Assignees
   * @returns Created issue
   */
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string,
    labels?: string[],
    assignees?: string[]
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: { title, body, labels, assignees },
    });
  }

  /**
   * Create issue comment
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param number - Issue number
   * @param body - Comment body
   * @returns Created comment
   */
  async createIssueComment(
    owner: string,
    repo: string,
    number: number,
    body: string
  ): Promise<{ id: number; body: string; created_at: string }> {
    return this.request<{ id: number; body: string; created_at: string }>(
      `/repos/${owner}/${repo}/issues/${number}/comments`,
      {
        method: 'POST',
        body: { body },
      }
    );
  }

  // ========================================================================
  // Search Operations
  // ========================================================================

  /**
   * Search code
   *
   * @param query - Search query
   * @param page - Page number
   * @param perPage - Results per page
   * @returns Search results
   */
  async searchCode(
    query: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{
    total_count: number;
    incomplete_results: boolean;
    items: Array<{
      name: string;
      path: string;
      sha: string;
      url: string;
      git_url: string;
      html_url: string;
      repository: GitHubRepository;
    }>;
  }> {
    return this.request(`/search/code?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`);
  }

  /**
   * Search repositories
   *
   * @param query - Search query
   * @param page - Page number
   * @param perPage - Results per page
   * @returns Search results
   */
  async searchRepositories(
    query: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{
    total_count: number;
    incomplete_results: boolean;
    items: GitHubRepository[];
  }> {
    return this.request(`/search/repositories?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`);
  }

  /**
   * Search issues
   *
   * @param query - Search query
   * @param page - Page number
   * @param perPage - Results per page
   * @returns Search results
   */
  async searchIssues(
    query: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{
    total_count: number;
    incomplete_results: boolean;
    items: GitHubIssue[];
  }> {
    return this.request(`/search/issues?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create GitHub API client
 *
 * @param config - GitHub App configuration
 * @param options - Client options
 * @returns GitHub client instance
 */
export function createGitHubClient(
  config: GitHubAppConfig,
  options?: Partial<GitHubClientOptions>
): GitHubClient {
  return new GitHubClient({ config, ...options });
}
