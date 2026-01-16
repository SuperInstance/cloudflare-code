/**
 * GitHub Client - REST API v3 and GraphQL API v4
 * Comprehensive client with authentication, rate limiting, and caching
 */

// @ts-nocheck - External dependencies (octokit packages) without type definitions

import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import { createOAuthUserAuth } from '@octokit/auth-oauth-user';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { RequestError } from '@octokit/request-error';
import * as graphql from '@octokit/graphql';

import {
  AuthType,
  AuthConfig,
  GitHubClientConfig,
  RateLimitInfo,
  RateLimitState,
  Repository,
  PullRequest,
  Issue,
  User,
  Branch,
  Commit,
  Release,
  WorkflowRun,
  CodeScanningAlert
} from '../types';

import {
  GitHubError,
  AuthenticationError,
  RateLimitError,
  RequestError as CustomRequestError,
  NotFoundError,
  ValidationError,
  createErrorFromResponse,
  isRetryableError
} from '../errors';

import { CacheProvider, CacheFactory, CacheKeyGenerator } from '../cache/cache';

// ============================================================================
// Octokit with Plugins
// ============================================================================

const OctokitWithPlugins = Octokit.plugin(retry, throttling);

// ============================================================================
// Rate Limit Tracker
// ============================================================================

export class RateLimitTracker {
  private limits: RateLimitState = {
    core: {
      limit: 5000,
      remaining: 5000,
      reset: Math.floor(Date.now() / 1000) + 3600,
      used: 0,
      resource: 'core'
    },
    search: {
      limit: 30,
      remaining: 30,
      reset: Math.floor(Date.now() / 1000) + 3600,
      used: 0,
      resource: 'search'
    },
    graphql: {
      limit: 5000,
      remaining: 5000,
      reset: Math.floor(Date.now() / 1000) + 3600,
      used: 0,
      resource: 'graphql'
    },
    integration_manifest: {
      limit: 10000,
      remaining: 10000,
      reset: Math.floor(Date.now() / 1000) + 3600,
      used: 0,
      resource: 'integration_manifest'
    }
  };

  private listeners: Set<(limits: RateLimitState) => void> = new Set();

  updateFromHeaders(headers: Headers): void {
    const resources = ['core', 'search', 'graphql', 'integration_manifest'] as const;

    for (const resource of resources) {
      const limit = headers.get(`x-ratelimit-${resource}-limit`);
      const remaining = headers.get(`x-ratelimit-${resource}-remaining`);
      const reset = headers.get(`x-ratelimit-${resource}-reset`);
      const used = headers.get(`x-ratelimit-${resource}-used`);

      if (limit || remaining || reset || used) {
        this.limits[resource] = {
          limit: limit ? parseInt(limit, 10) : this.limits[resource].limit,
          remaining: remaining ? parseInt(remaining, 10) : this.limits[resource].remaining,
          reset: reset ? parseInt(reset, 10) : this.limits[resource].reset,
          used: used ? parseInt(used, 10) : this.limits[resource].used,
          resource
        };
      }
    }

    this.notifyListeners();
  }

  getLimits(): RateLimitState {
    return { ...this.limits };
  }

  getLimit(resource: keyof RateLimitState): RateLimitInfo {
    return { ...this.limits[resource] };
  }

  getRemaining(resource: keyof RateLimitState): number {
    return this.limits[resource].remaining;
  }

  getResetTime(resource: keyof RateLimitState): Date {
    return new Date(this.limits[resource].reset * 1000);
  }

  isExhausted(resource: keyof RateLimitState): boolean {
    return this.limits[resource].remaining === 0;
  }

  isNearExhaustion(resource: keyof RateLimitState, threshold: number = 100): boolean {
    return this.limits[resource].remaining < threshold;
  }

  waitForReset(resource: keyof RateLimitState): Promise<void> {
    const resetTime = this.getResetTime(resource);
    const now = Date.now();
    const waitTime = Math.max(0, resetTime.getTime() - now);

    return new Promise(resolve => setTimeout(resolve, waitTime));
  }

  onLimitsChanged(listener: (limits: RateLimitState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const limits = this.getLimits();
    this.listeners.forEach(listener => listener(limits));
  }

  reset(): void {
    this.limits = {
      core: {
        limit: 5000,
        remaining: 5000,
        reset: Math.floor(Date.now() / 1000) + 3600,
        used: 0,
        resource: 'core'
      },
      search: {
        limit: 30,
        remaining: 30,
        reset: Math.floor(Date.now() / 1000) + 3600,
        used: 0,
        resource: 'search'
      },
      graphql: {
        limit: 5000,
        remaining: 5000,
        reset: Math.floor(Date.now() / 1000) + 3600,
        used: 0,
        resource: 'graphql'
      },
      integration_manifest: {
        limit: 10000,
        remaining: 10000,
        reset: Math.floor(Date.now() / 1000) + 3600,
        used: 0,
        resource: 'integration_manifest'
      }
    };
  }
}

// ============================================================================
// GitHub Client Class
// ============================================================================

export class GitHubClient {
  private octokit: Octokit;
  private graphqlClient: ReturnType<typeof graphql.defaults>;
  private auth: AuthConfig;
  private cache: CacheProvider;
  private rateLimitTracker: RateLimitTracker;
  private config: GitHubClientConfig;

  constructor(config: GitHubClientConfig) {
    this.config = config;
    this.auth = config.auth;
    this.rateLimitTracker = new RateLimitTracker();
    this.cache = CacheFactory.create(config.cache || {
      enabled: true,
      ttl: 300000,
      maxSize: 1000,
      type: 'memory'
    });

    this.octokit = this.createOctokit();
    this.graphqlClient = this.createGraphQLClient();

    this.setupInterceptors();
  }

  private createOctokit(): Octokit {
    const authStrategy = this.getAuthStrategy();
    const options: ConstructorParameters<typeof Octokit>[0] = {
      auth: authStrategy,
      userAgent: this.config.userAgent || 'ClaudeFlare-GitHub-Client/1.0.0',
      request: {
        agent: undefined,
        fetch: undefined,
        timeout: this.config.timeout || 30000,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      },
      retry: this.config.retry || {
        maxRetries: 3,
        retryAfter: 1000,
        factor: 2,
        maxTimeout: 30000,
        retryableStatuses: [408, 413, 429, 500, 502, 503, 504]
      },
      throttle: {
        enabled: true,
        factor: this.config.throttle?.factor || 6,
        minTimeout: this.config.throttle?.minTimeout || 1000,
        maxTimeout: this.config.throttle?.maxTimeout || 60000,
        onRateLimit: (retryAfter: number, options: unknown) => {
          this.rateLimitTracker.waitForReset('core');
          return true;
        },
        onSecondaryRateLimit: (retryAfter: number, options: unknown) => {
          return true;
        }
      }
    };

    return new OctokitWithPlugins(options);
  }

  private createGraphQLClient(): ReturnType<typeof graphql.defaults> {
    const authStrategy = this.getAuthStrategy();

    return graphql.defaults({
      headers: {
        authorization: `${this.auth.type} ${this.auth.token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      request: {
        agent: undefined,
        fetch: undefined,
        timeout: this.config.timeout || 30000
      }
    });
  }

  private getAuthStrategy(): string {
    switch (this.auth.type) {
      case AuthType.PersonalAccessToken:
        return this.auth.token || '';
      case AuthType.OAuth:
        return this.auth.token || '';
      case AuthType.GitHubApp:
        return '';
      case AuthType.Installation:
        return '';
      default:
        return '';
    }
  }

  private setupInterceptors(): void {
    // Add response interceptor for rate limit tracking
    const originalRequest = this.octokit.request;
    this.octokit.request = async (options: unknown) => {
      try {
        const response = await originalRequest(options);
        if (response.headers) {
          this.rateLimitTracker.updateFromHeaders(response.headers as Headers);
        }
        return response;
      } catch (error) {
        if (error instanceof RequestError && error.headers) {
          this.rateLimitTracker.updateFromHeaders(error.headers);
        }
        throw error;
      }
    };
  }

  // ============================================================================
  // Authentication Methods
  // ============================================================================

  async authenticateAsApp(): Promise<void> {
    if (this.auth.type !== AuthType.GitHubApp || !this.auth.appId || !this.auth.privateKey) {
      throw new AuthenticationError('GitHub App credentials are required');
    }

    const appAuth = createAppAuth({
      appId: this.auth.appId,
      privateKey: this.auth.privateKey,
      clientId: this.auth.clientId,
      clientSecret: this.auth.clientSecret
    });

    const authentication = await appAuth({ type: 'app' });
    this.octokit = new OctokitWithPlugins({ auth: authentication.token });
  }

  async authenticateAsInstallation(installationId: number): Promise<void> {
    if (this.auth.type !== AuthType.GitHubApp || !this.auth.appId || !this.auth.privateKey) {
      throw new AuthenticationError('GitHub App credentials are required');
    }

    const appAuth = createAppAuth({
      appId: this.auth.appId,
      privateKey: this.auth.privateKey,
      clientId: this.auth.clientId,
      clientSecret: this.auth.clientSecret
    });

    const authentication = await appAuth({
      type: 'installation',
      installationId
    });

    this.octokit = new OctokitWithPlugins({ auth: authentication.token });
  }

  async authenticateAsOAuthUser(code: string): Promise<void> {
    if (!this.auth.clientId || !this.auth.clientSecret) {
      throw new AuthenticationError('OAuth client credentials are required');
    }

    const oauthAuth = createOAuthUserAuth({
      clientId: this.auth.clientId,
      clientSecret: this.auth.clientSecret,
      code
    });

    const authentication = await oauthAuth();
    this.octokit = new OctokitWithPlugins({ auth: authentication.token });
  }

  // ============================================================================
  // Rate Limit Methods
  // ============================================================================

  getRateLimits(): RateLimitState {
    return this.rateLimitTracker.getLimits();
  }

  async checkRateLimit(resource: keyof RateLimitState = 'core'): Promise<void> {
    if (this.rateLimitTracker.isExhausted(resource)) {
      await this.rateLimitTracker.waitForReset(resource);
    }
  }

  onRateLimitChange(callback: (limits: RateLimitState) => void): () => void {
    return this.rateLimitTracker.onLimitsChanged(callback);
  }

  // ============================================================================
  // Repository Operations
  // ============================================================================

  async getRepository(owner: string, repo: string): Promise<Repository> {
    await this.checkRateLimit('core');

    const cacheKey = CacheKeyGenerator.generateForRepository(owner, repo, 'info');
    const cached = await this.cache.get<Repository>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo
      });

      const repository = response.data as Repository;
      await this.cache.set(cacheKey, repository);
      return repository;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async listRepositories(options?: {
    visibility?: 'all' | 'public' | 'private';
    affiliation?: string;
    type?: 'all' | 'owner' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    perPage?: number;
    page?: number;
  }): Promise<Repository[]> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.repos.listForAuthenticatedUser({
        visibility: options?.visibility || 'all',
        affiliation: options?.affiliation,
        type: options?.type || 'owner',
        sort: options?.sort || 'updated',
        direction: options?.direction || 'desc',
        per_page: options?.perPage || 30,
        page: options?.page || 1
      });

      return response.data as Repository[];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createRepository(
    owner: string,
    options: {
      name: string;
      description?: string;
      private?: boolean;
      autoInit?: boolean;
      gitignoreTemplate?: string;
      licenseTemplate?: string;
      allowSquashMerge?: boolean;
      allowMergeCommit?: boolean;
      allowRebaseMerge?: boolean;
      deleteBranchOnMerge?: boolean;
    }
  ): Promise<Repository> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.repos.createInOrg({
        org: owner,
        name: options.name,
        description: options.description,
        private: options.private || false,
        auto_init: options.autoInit || false,
        gitignore_template: options.gitignoreTemplate,
        license_template: options.licenseTemplate,
        allow_squash_merge: options.allowSquashMerge,
        allow_merge_commit: options.allowMergeCommit,
        allow_rebase_merge: options.allowRebaseMerge,
        delete_branch_on_merge: options.deleteBranchOnMerge
      });

      return response.data as Repository;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateRepository(
    owner: string,
    repo: string,
    options: {
      name?: string;
      description?: string;
      private?: boolean;
      has_issues?: boolean;
      has_projects?: boolean;
      has_wiki?: boolean;
      default_branch?: string;
      delete_branch_on_merge?: boolean;
      allow_squash_merge?: boolean;
      allow_merge_commit?: boolean;
      allow_rebase_merge?: boolean;
    }
  ): Promise<Repository> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.repos.update({
        owner,
        repo,
        ...options
      });

      return response.data as Repository;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteRepository(owner: string, repo: string): Promise<void> {
    await this.checkRateLimit('core');

    try {
      await this.octokit.rest.repos.delete({
        owner,
        repo
      });

      const cacheKey = CacheKeyGenerator.generateForRepository(owner, repo, 'info');
      await this.cache.delete(cacheKey);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Branch Operations
  // ============================================================================

  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    await this.checkRateLimit('core');

    const cacheKey = CacheKeyGenerator.generateForRepository(owner, repo, `branch:${branch}`);
    const cached = await this.cache.get<Branch>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.octokit.rest.repos.getBranch({
        owner,
        repo,
        branch
      });

      const branchData = response.data as Branch;
      await this.cache.set(cacheKey, branchData);
      return branchData;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async listBranches(
    owner: string,
    repo: string,
    options?: {
      protected?: boolean;
      perPage?: number;
      page?: number;
    }
  ): Promise<Branch[]> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
        protected: options?.protected,
        per_page: options?.perPage || 30,
        page: options?.page || 1
      });

      return response.data as Branch[];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createBranch(
    owner: string,
    repo: string,
    branch: string,
    fromBranch: string
  ): Promise<Branch> {
    await this.checkRateLimit('core');

    try {
      const refResponse = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${fromBranch}`
      });

      const response = await this.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: refResponse.data.object.sha
      });

      return this.getBranch(owner, repo, branch);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteBranch(owner: string, repo: string, branch: string): Promise<void> {
    await this.checkRateLimit('core');

    try {
      await this.octokit.rest.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branch}`
      });

      const cacheKey = CacheKeyGenerator.generateForRepository(owner, repo, `branch:${branch}`);
      await this.cache.delete(cacheKey);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Pull Request Operations
  // ============================================================================

  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    await this.checkRateLimit('core');

    const cacheKey = CacheKeyGenerator.generateForPullRequest(owner, repo, number, 'info');
    const cached = await this.cache.get<PullRequest>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: number
      });

      const pr = response.data as PullRequest;
      await this.cache.set(cacheKey, pr, { ttl: 60000 });
      return pr;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async listPullRequests(
    owner: string,
    repo: string,
    options?: {
      state?: 'open' | 'closed' | 'all';
      head?: string;
      base?: string;
      sort?: 'created' | 'updated' | 'popularity' | 'long-running';
      direction?: 'asc' | 'desc';
      perPage?: number;
      page?: number;
    }
  ): Promise<PullRequest[]> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: options?.state || 'open',
        head: options?.head,
        base: options?.base,
        sort: options?.sort || 'created',
        direction: options?.direction || 'desc',
        per_page: options?.perPage || 30,
        page: options?.page || 1
      });

      return response.data as PullRequest[];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createPullRequest(
    owner: string,
    repo: string,
    options: {
      title: string;
      body?: string;
      head: string;
      base: string;
      draft?: boolean;
      maintainerCanModify?: boolean;
    }
  ): Promise<PullRequest> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title: options.title,
        body: options.body,
        head: options.head,
        base: options.base,
        draft: options.draft || false,
        maintainer_can_modify: options.maintainerCanModify
      });

      return response.data as PullRequest;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    number: number,
    options: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      base?: string;
      maintainerCanModify?: boolean;
    }
  ): Promise<PullRequest> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: number,
        ...options
      });

      return response.data as PullRequest;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    number: number,
    options?: {
      commitTitle?: string;
      commitMessage?: string;
      mergeMethod?: 'merge' | 'squash' | 'rebase';
      sha?: string;
    }
  ): Promise<Commit> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: number,
        commit_title: options?.commitTitle,
        commit_message: options?.commitMessage,
        merge_method: options?.mergeMethod || 'merge',
        sha: options?.sha
      });

      return response.data as Commit;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Issue Operations
  // ============================================================================

  async getIssue(owner: string, repo: string, number: number): Promise<Issue> {
    await this.checkRateLimit('core');

    const cacheKey = CacheKeyGenerator.generateForIssue(owner, repo, number, 'info');
    const cached = await this.cache.get<Issue>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: number
      });

      const issue = response.data as Issue;
      await this.cache.set(cacheKey, issue, { ttl: 60000 });
      return issue;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async listIssues(
    owner: string,
    repo: string,
    options?: {
      state?: 'open' | 'closed' | 'all';
      milestone?: string | number;
      assignee?: string;
      creator?: string;
      mentioned?: string;
      labels?: string;
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      since?: string;
      perPage?: number;
      page?: number;
    }
  ): Promise<Issue[]> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: options?.state || 'open',
        milestone: options?.milestone?.toString(),
        assignee: options?.assignee,
        creator: options?.creator,
        mentioned: options?.mentioned,
        labels: options?.labels,
        sort: options?.sort || 'created',
        direction: options?.direction || 'desc',
        since: options?.since,
        per_page: options?.perPage || 30,
        page: options?.page || 1
      });

      return response.data as Issue[];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createIssue(
    owner: string,
    repo: string,
    options: {
      title: string;
      body?: string;
      assignees?: string[];
      milestone?: number;
      labels?: string[];
    }
  ): Promise<Issue> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.issues.create({
        owner,
        repo,
        title: options.title,
        body: options.body,
        assignees: options.assignees,
        milestone: options.milestone,
        labels: options.labels
      });

      return response.data as Issue;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateIssue(
    owner: string,
    repo: string,
    number: number,
    options: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      assignees?: string[];
      milestone?: number | null;
      labels?: string[];
    }
  ): Promise<Issue> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.issues.update({
        owner,
        repo,
        issue_number: number,
        ...options
      });

      return response.data as Issue;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async getAuthenticatedUser(): Promise<User> {
    await this.checkRateLimit('core');

    const cacheKey = 'user:authenticated';
    const cached = await this.cache.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      const user = response.data as User;
      await this.cache.set(cacheKey, user, { ttl: 300000 });
      return user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUser(username: string): Promise<User> {
    await this.checkRateLimit('core');

    const cacheKey = `user:${username}`;
    const cached = await this.cache.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.octokit.rest.users.getByUsername({
        username
      });

      const user = response.data as User;
      await this.cache.set(cacheKey, user);
      return user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Commit Operations
  // ============================================================================

  async getCommit(owner: string, repo: string, sha: string): Promise<Commit> {
    await this.checkRateLimit('core');

    const cacheKey = CacheKeyGenerator.generateForRepository(owner, repo, `commit:${sha}`);
    const cached = await this.cache.get<Commit>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha
      });

      const commit = response.data as Commit;
      await this.cache.set(cacheKey, commit);
      return commit;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async listCommits(
    owner: string,
    repo: string,
    options?: {
      sha?: string;
      path?: string;
      since?: string;
      until?: string;
      author?: string;
      perPage?: number;
      page?: number;
    }
  ): Promise<Commit[]> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: options?.sha,
        path: options?.path,
        since: options?.since,
        until: options?.until,
        author: options?.author,
        per_page: options?.perPage || 30,
        page: options?.page || 1
      });

      return response.data as Commit[];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Release Operations
  // ============================================================================

  async getRelease(owner: string, repo: string, id: number): Promise<Release> {
    await this.checkRateLimit('core');

    const cacheKey = CacheKeyGenerator.generateForRepository(owner, repo, `release:${id}`);
    const cached = await this.cache.get<Release>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.octokit.rest.repos.getRelease({
        owner,
        repo,
        release_id: id
      });

      const release = response.data as Release;
      await this.cache.set(cacheKey, release);
      return release;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async listReleases(
    owner: string,
    repo: string,
    options?: {
      perPage?: number;
      page?: number;
    }
  ): Promise<Release[]> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.repos.listReleases({
        owner,
        repo,
        per_page: options?.perPage || 30,
        page: options?.page || 1
      });

      return response.data as Release[];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createRelease(
    owner: string,
    repo: string,
    options: {
      tagName: string;
      targetCommitish?: string;
      name?: string;
      body?: string;
      draft?: boolean;
      prerelease?: boolean;
    }
  ): Promise<Release> {
    await this.checkRateLimit('core');

    try {
      const response = await this.octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: options.tagName,
        target_commitish: options.targetCommitish,
        name: options.name,
        body: options.body,
        draft: options.draft || false,
        prerelease: options.prerelease || false
      });

      return response.data as Release;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // GraphQL Operations
  // ============================================================================

  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    await this.checkRateLimit('graphql');

    const cacheKey = CacheKeyGenerator.generateForGraphQL(query, variables);
    const cached = await this.cache.get<T>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.graphqlClient<T>(query, variables);
      await this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      throw this.handleGraphQLError(error);
    }
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private handleError(error: unknown): GitHubError {
    if (error instanceof GitHubError) {
      return error;
    }

    if (error instanceof RequestError) {
      if (error.status === 401) {
        return new AuthenticationError('Authentication failed', {
          status: error.status,
          requestId: error.headers?.['x-github-request-id'] as string
        });
      }

      if (error.status === 403) {
        if (error.message.toLowerCase().includes('rate limit')) {
          return new RateLimitError(
            0,
            0,
            new Date(Date.now() + 60000),
            'core'
          );
        }
      }

      return createErrorFromResponse(error.status || 500, {
        message: error.message,
        code: 'REQUEST_ERROR',
        documentation_url: error.headers?.['x-github-media-type'] as string
      });
    }

    return new GitHubError(
      error instanceof Error ? error.message : 'Unknown error',
      'UNKNOWN_ERROR',
      null,
      null,
      null,
      false
    );
  }

  private handleGraphQLError(error: unknown): GitHubError {
    if (typeof error === 'object' && error !== null) {
      const err = error as {
        message?: string;
        errors?: Array<{
          message?: string;
          locations?: Array<{ line: number; column: number }>;
          path?: (string | number)[];
          extensions?: Record<string, unknown>;
        }>;
      };

      if (err.errors) {
        return new (
          class extends GitHubError {
            constructor() {
              super(err.message || 'GraphQL Error', 'GRAPHQL_ERROR');
              this.name = 'GraphQLError';
            }
          }
        )();
      }
    }

    return new GitHubError(
      error instanceof Error ? error.message : 'Unknown GraphQL error',
      'GRAPHQL_ERROR',
      null,
      null,
      null,
      false
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  async ping(): Promise<boolean> {
    try {
      await this.octokit.rest.zon.check();
      return true;
    } catch (error) {
      return false;
    }
  }

  getCache(): CacheProvider {
    return this.cache;
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  async disconnect(): Promise<void> {
    await this.cache.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createGitHubClient(config: GitHubClientConfig): GitHubClient {
  return new GitHubClient(config);
}
