/**
 * Repository Manager
 * Comprehensive repository CRUD, branch management, file operations, and releases
 */

import {
  Repository,
  RepositoryVisibility,
  RepositoryPermission,
  Branch,
  BranchProtection,
  Commit,
  Release,
  File,
  FileChange,
  User,
  License
} from '../types';

import {
  RepositoryError,
  RepositoryNotFoundError,
  BranchNotFoundError,
  ProtectedBranchError,
  ArchivedRepositoryError
} from '../errors';

import { GitHubClient } from '../client/client';

// ============================================================================
// Repository Creation Options
// ============================================================================

export interface CreateRepositoryOptions {
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
  hasIssues?: boolean;
  hasProjects?: boolean;
  hasWiki?: boolean;
  hasDownloads?: boolean;
  isTemplate?: boolean;
}

// ============================================================================
// Repository Update Options
// ============================================================================

export interface UpdateRepositoryOptions {
  name?: string;
  description?: string;
  private?: boolean;
  defaultBranch?: string;
  hasIssues?: boolean;
  hasProjects?: boolean;
  hasWiki?: boolean;
  hasDownloads?: boolean;
  isTemplate?: boolean;
  homepage?: string;
  deleteBranchOnMerge?: boolean;
  allowSquashMerge?: boolean;
  allowMergeCommit?: boolean;
  allowRebaseMerge?: boolean;
}

// ============================================================================
// Branch Protection Options
// ============================================================================

export interface SetBranchProtectionOptions {
  requiredApprovingReviewCount?: number;
  requireCodeOwnerReviews?: boolean;
  dismissStaleReviews?: boolean;
  bypassPullRequestAllowances?: {
    users?: string[];
    teams?: string[];
    apps?: string[];
  };
  restrictions?: {
    users?: string[];
    teams?: string[];
    apps?: string[];
  };
  requiredStatusChecks?: {
    strict?: boolean;
    contexts?: string[];
    checks?: Array<{
      context: string;
      appId?: number;
    }>;
  };
  enforceAdmins?: boolean;
  allowForcePushes?: boolean;
  allowDeletions?: boolean;
  requireLinearHistory?: boolean;
  requiredConversationResolution?: boolean;
  lockBranch?: boolean;
  allowForkSyncing?: boolean;
}

// ============================================================================
// File Operations Options
// ============================================================================

export interface CreateFileOptions {
  content: string;
  message: string;
  branch?: string;
  committer?: {
    name: string;
    email: string;
  };
  author?: {
    name: string;
    email: string;
  };
}

export interface UpdateFileOptions {
  content: string;
  message: string;
  sha: string;
  branch?: string;
  committer?: {
    name: string;
    email: string;
  };
  author?: {
    name: string;
    email: string;
  };
}

export interface DeleteFileOptions {
  message: string;
  sha: string;
  branch?: string;
  committer?: {
    name: string;
    email: string;
  };
}

// ============================================================================
// Release Options
// ============================================================================

export interface CreateReleaseOptions {
  tagName: string;
  targetCommitish?: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  generateReleaseNotes?: boolean;
}

export interface UpdateReleaseOptions {
  tagName?: string;
  targetCommitish?: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
}

// ============================================================================
// Main Repository Manager Class
// ============================================================================

export class RepositoryManager {
  private client: GitHubClient;

  constructor(client: GitHubClient) {
    this.client = client;
  }

  // ============================================================================
  // Repository CRUD
  // ============================================================================

  async createRepository(
    owner: string,
    options: CreateRepositoryOptions
  ): Promise<Repository> {
    const response = await this.client['octokit'].rest.repos.createInOrg({
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
      delete_branch_on_merge: options.deleteBranchOnMerge,
      has_issues: options.hasIssues,
      has_projects: options.hasProjects,
      has_wiki: options.hasWiki,
      has_downloads: options.hasDownloads,
    is_template: options.isTemplate
    });

    return response.data as Repository;
  }

  async createRepositoryForAuthenticatedUser(
    options: CreateRepositoryOptions
  ): Promise<Repository> {
    const response = await this.client['octokit'].rest.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.private || false,
      auto_init: options.autoInit || false,
      gitignore_template: options.gitignoreTemplate,
      license_template: options.licenseTemplate,
      allow_squash_merge: options.allowSquashMerge,
      allow_merge_commit: options.allowMergeCommit,
      allow_rebase_merge: options.allowRebaseMerge,
      delete_branch_on_merge: options.deleteBranchOnMerge,
      has_issues: options.hasIssues,
      has_projects: options.hasProjects,
      has_wiki: options.hasWiki,
      has_downloads: options.hasDownloads,
      is_template: options.isTemplate
    });

    return response.data as Repository;
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    return this.client.getRepository(owner, repo);
  }

  async updateRepository(
    owner: string,
    repo: string,
    options: UpdateRepositoryOptions
  ): Promise<Repository> {
    return this.client.updateRepository(owner, repo, options);
  }

  async deleteRepository(owner: string, repo: string): Promise<void> {
    await this.client.deleteRepository(owner, repo);
  }

  async listRepositories(
    options?: {
      visibility?: 'all' | 'public' | 'private';
      affiliation?: string;
      type?: 'all' | 'owner' | 'member';
      sort?: 'created' | 'updated' | 'pushed' | 'full_name';
      direction?: 'asc' | 'desc';
      perPage?: number;
      page?: number;
    }
  ): Promise<Repository[]> {
    return this.client.listRepositories(options);
  }

  async listOrganizationRepositories(
    org: string,
    options?: {
      type?: 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member';
      sort?: 'created' | 'updated' | 'pushed' | 'full_name';
      direction?: 'asc' | 'desc';
      perPage?: number;
      page?: number;
    }
  ): Promise<Repository[]> {
    const response = await this.client['octokit'].rest.repos.listForOrg({
      org,
      type: options?.type || 'all',
      sort: options?.sort || 'updated',
      direction: options?.direction || 'desc',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data as Repository[];
  }

  async forkRepository(
    owner: string,
    repo: string,
    options?: {
      organization?: string;
      name?: string;
      defaultBranchOnly?: boolean;
    }
  ): Promise<Repository> {
    const response = await this.client['octokit'].rest.repos.createFork({
      owner,
      repo,
      organization: options?.organization,
      name: options?.name,
      default_branch_only: options?.defaultBranchOnly
    });

    return response.data;
  }

  // ============================================================================
  // Branch Management
  // ============================================================================

  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    return this.client.getBranch(owner, repo, branch);
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
    return this.client.listBranches(owner, repo, options);
  }

  async createBranch(
    owner: string,
    repo: string,
    branch: string,
    fromBranch: string
  ): Promise<Branch> {
    return this.client.createBranch(owner, repo, branch, fromBranch);
  }

  async deleteBranch(owner: string, repo: string, branch: string): Promise<void> {
    await this.client.deleteBranch(owner, repo, branch);
  }

  async getBranchProtection(
    owner: string,
    repo: string,
    branch: string
  ): Promise<BranchProtection> {
    const response = await this.client['octokit'].rest.repos.getBranchProtection({
      owner,
      repo,
      branch
    });

    return response.data;
  }

  async setBranchProtection(
    owner: string,
    repo: string,
    branch: string,
    options: SetBranchProtectionOptions
  ): Promise<BranchProtection> {
    const response = await this.client['octokit'].rest.repos.updateBranchProtection({
      owner,
      repo,
      branch,
      required_pull_request_reviews: options.requiredApprovingReviewCount || options.requireCodeOwnerReviews ? {
        dismissal_restrictions: options.bypassPullRequestAllowances ? {
          users: options.bypassPullRequestAllowances.users,
          teams: options.bypassPullRequestAllowances.teams,
          apps: options.bypassPullRequestAllowances.apps
        } : undefined,
        dismiss_stale_reviews: options.dismissStaleReviews,
        require_code_owner_reviews: options.requireCodeOwnerReviews,
        required_approving_review_count: options.requiredApprovingReviewCount
      } : undefined,
      required_status_checks: options.requiredStatusChecks ? {
        strict: options.requiredStatusChecks.strict,
        contexts: options.requiredStatusChecks.contexts,
        checks: options.requiredStatusChecks.checks
      } : undefined,
      enforce_admins: options.enforceAdmins,
      restrictions: options.restrictions ? {
        users: options.restrictions.users,
        teams: options.restrictions.teams,
        apps: options.restrictions.apps
      } : undefined,
      allow_force_pushes: options.allowForcePushes,
      allow_deletions: options.allowDeletions,
      require_linear_history: options.requireLinearHistory,
      required_conversation_resolution: options.requiredConversationResolution,
      lock_branch: options.lockBranch,
      allow_fork_syncing: options.allowForkSyncing
    });

    return response.data;
  }

  async removeBranchProtection(
    owner: string,
    repo: string,
    branch: string
  ): Promise<void> {
    await this.client['octokit'].rest.repos.deleteBranchProtection({
      owner,
      repo,
      branch
    });
  }

  async mergeBranch(
    owner: string,
    repo: string,
    head: string,
    base: string
  ): Promise<Commit> {
    const response = await this.client['octokit'].rest.repos.merge({
      owner,
      repo,
      head,
      base
    });

    return response.data;
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  async getFile(
    owner: string,
    repo: string,
    path: string,
    options?: {
      ref?: string;
    }
  ): Promise<File> {
    const response = await this.client['octokit'].rest.repos.getContent({
      owner,
      repo,
      path,
      ref: options?.ref
    });

    const data = response.data as any;

    if (Array.isArray(data)) {
      throw new RepositoryError('Path is a directory, not a file');
    }

    return data as File;
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    options: CreateFileOptions | UpdateFileOptions
  ): Promise<FileCommit> {
    const existing = await this.getFile(owner, repo, path).catch(() => null);

    if (existing) {
      if ('sha' in options) {
        return this.updateFile(owner, repo, path, options as UpdateFileOptions);
      } else {
        throw new RepositoryError('File exists and SHA is required for update');
      }
    }

    return this.createFile(owner, repo, path, options as CreateFileOptions);
  }

  async createFile(
    owner: string,
    repo: string,
    path: string,
    options: CreateFileOptions
  ): Promise<FileCommit> {
    const content = Buffer.from(options.content).toString('base64');

    const response = await this.client['octokit'].rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: options.message,
      content,
      branch: options.branch,
      committer: options.committer,
      author: options.author
    });

    return response.data;
  }

  async updateFile(
    owner: string,
    repo: string,
    path: string,
    options: UpdateFileOptions
  ): Promise<FileCommit> {
    const content = Buffer.from(options.content).toString('base64');

    const response = await this.client['octokit'].rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: options.message,
      content,
      sha: options.sha,
      branch: options.branch,
      committer: options.committer,
      author: options.author
    });

    return response.data;
  }

  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    options: DeleteFileOptions
  ): Promise<FileCommit> {
    const response = await this.client['octokit'].rest.repos.deleteFile({
      owner,
      repo,
      path,
      message: options.message,
      sha: options.sha,
      branch: options.branch,
      committer: options.committer
    });

    return response.data;
  }

  async getDirectory(
    owner: string,
    repo: string,
    path: string,
    options?: {
      ref?: string;
    }
  ): Promise<File[]> {
    const response = await this.client['octokit'].rest.repos.getContent({
      owner,
      repo,
      path,
      ref: options?.ref
    });

    const data = response.data as any;

    if (!Array.isArray(data)) {
      throw new RepositoryError('Path is a file, not a directory');
    }

    return data;
  }

  // ============================================================================
  // Release Management
  // ============================================================================

  async createRelease(
    owner: string,
    repo: string,
    options: CreateReleaseOptions
  ): Promise<Release> {
    return this.client.createRelease(owner, repo, options);
  }

  async getRelease(
    owner: string,
    repo: string,
    id: number
  ): Promise<Release> {
    return this.client.getRelease(owner, repo, id);
  }

  async getReleaseByTag(
    owner: string,
    repo: string,
    tag: string
  ): Promise<Release> {
    const response = await this.client['octokit'].rest.repos.getReleaseByTag({
      owner,
      repo,
      tag
    });

    return response.data;
  }

  async updateRelease(
    owner: string,
    repo: string,
    id: number,
    options: UpdateReleaseOptions
  ): Promise<Release> {
    const response = await this.client['octokit'].rest.repos.updateRelease({
      owner,
      repo,
      release_id: id,
      tag_name: options.tagName,
      target_commitish: options.targetCommitish,
      name: options.name,
      body: options.body,
      draft: options.draft,
      prerelease: options.prerelease
    });

    return response.data;
  }

  async deleteRelease(
    owner: string,
    repo: string,
    id: number
  ): Promise<void> {
    await this.client['octokit'].rest.repos.deleteRelease({
      owner,
      repo,
      release_id: id
    });
  }

  async listReleases(
    owner: string,
    repo: string,
    options?: {
      perPage?: number;
      page?: number;
    }
  ): Promise<Release[]> {
    return this.client.listReleases(owner, repo, options);
  }

  async getLatestRelease(
    owner: string,
    repo: string
  ): Promise<Release> {
    const response = await this.client['octokit'].rest.repos.getLatestRelease({
      owner,
      repo
    });

    return response.data;
  }

  async uploadReleaseAsset(
    owner: string,
    repo: string,
    id: number,
    name: string,
    data: Buffer,
    contentType: string
  ): Promise<any> {
    const response = await this.client['octokit'].rest.repos.uploadReleaseAsset({
      owner,
      repo,
      release_id: id,
      name,
      data,
      headers: {
        'content-type': contentType
      }
    });

    return response.data;
  }

  // ============================================================================
  // Repository Analytics
  // ============================================================================

  async getRepositoryAnalytics(
    owner: string,
    repo: string
  ): Promise<{
    stars: number;
    watchers: number;
    forks: number;
    openIssues: number;
    openPullRequests: number;
    contributors: number;
    commits: number;
    latestCommit: string;
    languages: Record<string, number>;
  }> {
    const repository = await this.getRepository(owner, repo);

    const [contributors, languages, commits] = await Promise.all([
      this.listContributors(owner, repo),
      this.listLanguages(owner, repo),
      this.listCommits(owner, repo, { perPage: 1 })
    ]);

    return {
      stars: repository.stargazers_count,
      watchers: repository.watchers_count,
      forks: repository.forks_count,
      openIssues: repository.open_issues_count,
      openPullRequests: await this.getOpenPullRequestCount(owner, repo),
      contributors: contributors.length,
      commits: commits.length,
      latestCommit: commits[0]?.sha || '',
      languages
    };
  }

  private async getOpenPullRequestCount(
    owner: string,
    repo: string
  ): Promise<number> {
    const response = await this.client['octokit'].rest.pulls.list({
      owner,
      repo,
      state: 'open',
      per_page: 1
    });

    return response.headers['x-total'] ? parseInt(response.headers['x-total'] as string, 10) : 0;
  }

  async listContributors(
    owner: string,
    repo: string
  ): Promise<User[]> {
    const response = await this.client['octokit'].rest.repos.listContributors({
      owner,
      repo
    });

    return response.data;
  }

  async listLanguages(
    owner: string,
    repo: string
  ): Promise<Record<string, number>> {
    const response = await this.client['octokit'].rest.repos.listLanguages({
      owner,
      repo
    });

    return response.data;
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
    return this.client.listCommits(owner, repo, options);
  }

  async listStargazers(
    owner: string,
    repo: string
  ): Promise<User[]> {
    const response = await this.client['octokit'].rest.activity.listStargazersForRepo({
      owner,
      repo
    });

    return response.data;
  }

  async listForks(
    owner: string,
    repo: string,
    options?: {
      sort?: 'newest' | 'oldest' | 'watchers';
      perPage?: number;
      page?: number;
    }
  ): Promise<Repository[]> {
    const response = await this.client['octokit'].rest.repos.listForks({
      owner,
      repo,
      sort: options?.sort || 'newest',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data;
  }

  // ============================================================================
  // Repository Topics
  // ============================================================================

  async getTopics(owner: string, repo: string): Promise<string[]> {
    const response = await this.client['octokit'].rest.repos.getAllTopics({
      owner,
      repo
    });

    return response.data.names;
  }

  async setTopics(
    owner: string,
    repo: string,
    topics: string[]
  ): Promise<void> {
    await this.client['octokit'].rest.repos.replaceAllTopics({
      owner,
      repo,
      names: topics
    });
  }

  async addTopics(
    owner: string,
    repo: string,
    topics: string[]
  ): Promise<void> {
    const existing = await this.getTopics(owner, repo);
    const all = [...new Set([...existing, ...topics])];

    await this.setTopics(owner, repo, all);
  }

  async removeTopics(
    owner: string,
    repo: string,
    topics: string[]
  ): Promise<void> {
    const existing = await this.getTopics(owner, repo);
    const remaining = existing.filter(t => !topics.includes(t));

    await this.setTopics(owner, repo, remaining);
  }

  // ============================================================================
  // Repository Collaboration
  // ============================================================================

  async addCollaborator(
    owner: string,
    repo: string,
    username: string,
    permission: RepositoryPermission = RepositoryPermission.Write
  ): Promise<void> {
    await this.client['octokit'].rest.repos.addCollaborator({
      owner,
      repo,
      username,
      permission
    });
  }

  async removeCollaborator(
    owner: string,
    repo: string,
    username: string
  ): Promise<void> {
    await this.client['octokit'].rest.repos.removeCollaborator({
      owner,
      repo,
      username
    });
  }

  async listCollaborators(
    owner: string,
    repo: string
  ): Promise<User[]> {
    const response = await this.client['octokit'].rest.repos.listCollaborators({
      owner,
      repo
    });

    return response.data;
  }

  async getCollaboratorPermissionLevel(
    owner: string,
    repo: string,
    username: string
  ): Promise<RepositoryPermission> {
    const response = await this.client['octokit'].rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username
    });

    return response.data.permission as RepositoryPermission;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRepositoryManager(client: GitHubClient): RepositoryManager {
  return new RepositoryManager(client);
}
