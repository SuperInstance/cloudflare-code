/**
 * GitHub Adapter for GitOps operations
 */

import { GitRepository } from '../../types';
import { Logger } from '../../utils/logger';
import { GitProviderAdapterBase, GitCommitInfo, GitFile, GitTree } from './git-provider-adapter';
import { Octokit } from 'octokit';
import * as yaml from 'yaml';

export class GitHubAdapter extends GitProviderAdapterBase {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(repository: GitRepository, logger: Logger) {
    super(repository, logger);

    this.octokit = new Octokit({
      auth: repository.token,
      baseUrl: repository.apiUrl,
    });

    this.owner = repository.owner;
    this.repo = repository.repo;
  }

  async validateAccess(): Promise<void> {
    try {
      await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      this.logger.info('GitHub access validated', {
        repository: `${this.owner}/${this.repo}`,
      });
    } catch (error: any) {
      this.logger.error('GitHub access validation failed', { error });
      throw new Error(`Failed to access GitHub repository: ${error.message}`);
    }
  }

  async fetchCommitInfo(ref?: string): Promise<GitCommitInfo> {
    try {
      const branch = ref || this.repository.branch || 'main';

      const { data: refData } = await this.octokit.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`,
      });

      const { data: commitData } = await this.octokit.rest.git.getCommit({
        owner: this.owner,
        repo: this.repo,
        commit_sha: refData.object.sha,
      });

      return {
        sha: commitData.sha,
        message: commitData.message,
        author: commitData.author.name || commitData.author.email,
        timestamp: new Date(commitData.author.date),
        treeSha: commitData.tree.sha,
        parentShas: commitData.parents.map((p) => p.sha),
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch commit info', { error });
      throw error;
    }
  }

  async fetchManifests(path: string, ref?: string): Promise<any[]> {
    try {
      const branch = ref || this.repository.branch || 'main';

      // Get tree for the specified path
      const { data: treeData } = await this.octokit.rest.git.getTree({
        owner: this.owner,
        repo: this.repo,
        tree_sha: branch,
        recursive: 'true',
      });

      const manifests: any[] = [];

      // Filter files in the target path
      const targetFiles = treeData.tree.filter(
        (item) =>
          item.type === 'blob' && item.path.startsWith(path)
      );

      for (const file of targetFiles) {
        try {
          const content = await this.getFile(file.path, ref);

          // Parse based on file extension
          const extension = file.path.split('.').pop()?.toLowerCase();

          if (extension === 'yaml' || extension === 'yml') {
            const docs = yaml.parseAllDocuments(content);
            for (const doc of docs) {
              if (doc && typeof doc.toJS === 'function') {
                const manifest = doc.toJS();
                if (manifest && manifest.kind) {
                  manifests.push({
                    ...manifest,
                    metadata: {
                      ...manifest.metadata,
                      annotations: {
                        ...manifest.metadata?.annotations,
                        'claudeflare/source-path': file.path,
                        'claudeflare/source-revision': branch,
                      },
                    },
                  });
                }
              }
            }
          } else if (extension === 'json') {
            const manifest = JSON.parse(content);
            if (manifest && manifest.kind) {
              manifests.push({
                ...manifest,
                metadata: {
                  ...manifest.metadata,
                  annotations: {
                    ...manifest.metadata?.annotations,
                    'claudeflare/source-path': file.path,
                    'claudeflare/source-revision': branch,
                  },
                },
              });
            }
          }
        } catch (parseError: any) {
          this.logger.warn('Failed to parse manifest', {
            path: file.path,
            error: parseError.message,
          });
        }
      }

      this.logger.info('Fetched manifests from GitHub', {
        count: manifests.length,
        path,
        ref: branch,
      });

      return manifests;
    } catch (error: any) {
      this.logger.error('Failed to fetch manifests', { error });
      throw error;
    }
  }

  async watch(
    callback: (commitInfo: GitCommitInfo) => void
  ): Promise<() => void> {
    // GitHub doesn't support long-polling, so we'll use polling
    const interval = setInterval(async () => {
      try {
        const commitInfo = await this.fetchCommitInfo();
        callback(commitInfo);
      } catch (error: any) {
        this.logger.error('Watch callback error', { error });
      }
    }, 30000); // Poll every 30 seconds

    this.logger.info('Started watching GitHub repository');

    return () => {
      clearInterval(interval);
      this.logger.info('Stopped watching GitHub repository');
    };
  }

  async createCommit(
    message: string,
    files: { path: string; content: string }[],
    branch?: string
  ): Promise<GitCommitInfo> {
    try {
      const targetBranch = branch || this.repository.branch || 'main';

      // Get current commit
      const { data: refData } = await this.octokit.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${targetBranch}`,
      });

      const currentCommitSha = refData.object.sha;
      const { data: currentCommit } = await this.octokit.rest.git.getCommit({
        owner: this.owner,
        repo: this.repo,
        commit_sha: currentCommitSha,
      });

      // Create tree blobs
      const tree = await Promise.all(
        files.map(async (file) => {
          const { data: blobData } = await this.octokit.rest.git.createBlob({
            owner: this.owner,
            repo: this.repo,
            content: Buffer.from(file.content).toString('base64'),
            encoding: 'base64',
          });

          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blobData.sha,
          };
        })
      );

      // Create tree
      const { data: newTree } = await this.octokit.rest.git.createTree({
        owner: this.owner,
        repo: this.repo,
        base_tree: currentCommit.tree.sha,
        tree,
      });

      // Create commit
      const { data: newCommit } = await this.octokit.rest.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message,
        tree: newTree.sha,
        parents: [currentCommitSha],
      });

      // Update reference
      await this.octokit.rest.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${targetBranch}`,
        sha: newCommit.sha,
      });

      return {
        sha: newCommit.sha,
        message: newCommit.message,
        author: newCommit.author.name || newCommit.author.email,
        timestamp: new Date(newCommit.author.date),
        treeSha: newCommit.tree.sha,
        parentShas: newCommit.parents.map((p) => p.sha),
      };
    } catch (error: any) {
      this.logger.error('Failed to create commit', { error });
      throw error;
    }
  }

  async getFile(path: string, ref?: string): Promise<string> {
    try {
      const branch = ref || this.repository.branch || 'main';

      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: branch,
      });

      if ('content' in data && data.type === 'file') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      throw new Error(`Not a file: ${path}`);
    } catch (error: any) {
      this.logger.error('Failed to get file', { path, error });
      throw error;
    }
  }

  async getTree(path: string, ref?: string): Promise<GitTree> {
    try {
      const branch = ref || this.repository.branch || 'main';

      const { data } = await this.octokit.rest.git.getTree({
        owner: this.owner,
        repo: this.repo,
        tree_sha: branch,
        recursive: 'true',
      });

      const entries = data.tree
        .filter((item) => item.path.startsWith(path))
        .map((item) => ({
          path: item.path,
          mode: item.mode,
          type: item.type as 'blob' | 'tree',
          sha: item.sha,
        }));

      return {
        sha: data.sha,
        entries,
      };
    } catch (error: any) {
      this.logger.error('Failed to get tree', { path, error });
      throw error;
    }
  }
}
