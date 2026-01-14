/**
 * Git Provider Adapter - Abstract interface for different Git providers
 */

import { GitRepository, GitProvider } from '../../types';
import { Logger } from '../../utils/logger';
import { GitHubAdapter } from './github-adapter';
import { GitLabAdapter } from './gitlab-adapter';
import { BitbucketAdapter } from './bitbucket-adapter';

export interface GitCommitInfo {
  sha: string;
  message: string;
  author: string;
  timestamp: Date;
  treeSha?: string;
  parentShas?: string[];
}

export interface GitFile {
  path: string;
  content: string;
  sha: string;
  size?: number;
}

export interface GitTree {
  sha: string;
  entries: GitTreeEntry[];
}

export interface GitTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
}

/**
 * Abstract base for Git provider adapters
 */
export abstract class GitProviderAdapterBase {
  protected repository: GitRepository;
  protected logger: Logger;

  constructor(repository: GitRepository, logger: Logger) {
    this.repository = repository;
    this.logger = logger;
  }

  /**
   * Validate that we can access the repository
   */
  abstract validateAccess(): Promise<void>;

  /**
   * Fetch commit information
   */
  abstract fetchCommitInfo(ref?: string): Promise<GitCommitInfo>;

  /**
   * Fetch manifests from repository
   */
  abstract fetchManifests(path: string, ref?: string): Promise<any[]>;

  /**
   * Watch for changes
   */
  abstract watch(callback: (commitInfo: GitCommitInfo) => void): Promise<() => void>;

  /**
   * Create a commit
   */
  abstract createCommit(
    message: string,
    files: { path: string; content: string }[],
    branch?: string
  ): Promise<GitCommitInfo>;

  /**
   * Get file content
   */
  abstract getFile(path: string, ref?: string): Promise<string>;

  /**
   * Get repository tree
   */
  abstract getTree(path: string, ref?: string): Promise<GitTree>;
}

/**
 * Git Provider Adapter factory
 */
export class GitProviderAdapter extends GitProviderAdapterBase {
  private adapter: GitProviderAdapterBase;

  constructor(repository: GitRepository, logger: Logger) {
    super(repository, logger);

    switch (repository.provider) {
      case GitProvider.GITHUB:
        this.adapter = new GitHubAdapter(repository, logger);
        break;
      case GitProvider.GITLAB:
        this.adapter = new GitLabAdapter(repository, logger);
        break;
      case GitProvider.BITBUCKET:
        this.adapter = new BitbucketAdapter(repository, logger);
        break;
      default:
        throw new Error(`Unsupported Git provider: ${repository.provider}`);
    }
  }

  async validateAccess(): Promise<void> {
    return this.adapter.validateAccess();
  }

  async fetchCommitInfo(ref?: string): Promise<GitCommitInfo> {
    return this.adapter.fetchCommitInfo(ref);
  }

  async fetchManifests(path: string, ref?: string): Promise<any[]> {
    return this.adapter.fetchManifests(path, ref);
  }

  async watch(
    callback: (commitInfo: GitCommitInfo) => void
  ): Promise<() => void> {
    return this.adapter.watch(callback);
  }

  async createCommit(
    message: string,
    files: { path: string; content: string }[],
    branch?: string
  ): Promise<GitCommitInfo> {
    return this.adapter.createCommit(message, files, branch);
  }

  async getFile(path: string, ref?: string): Promise<string> {
    return this.adapter.getFile(path, ref);
  }

  async getTree(path: string, ref?: string): Promise<GitTree> {
    return this.adapter.getTree(path, ref);
  }
}
