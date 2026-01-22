/**
 * GitLab Adapter for GitOps operations
 */

import { GitRepository } from '../../types';
import { Logger } from '../../utils/logger';
import { GitProviderAdapterBase, GitCommitInfo, GitTree } from './git-provider-adapter';
import axios from 'axios';
import * as yaml from 'yaml';

export class GitLabAdapter extends GitProviderAdapterBase {
  private client: axios.AxiosInstance;
  private projectId: string;

  constructor(repository: GitRepository, logger: Logger) {
    super(repository, logger);

    const baseUrl = repository.apiUrl || 'https://gitlab.com/api/v4';

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'PRIVATE-TOKEN': repository.token,
      },
    });

    this.projectId = encodeURIComponent(`${repository.owner}/${repository.repo}`);
  }

  async validateAccess(): Promise<void> {
    try {
      await this.client.get(`/projects/${this.projectId}`);
      this.logger.info('GitLab access validated', {
        repository: `${this.repository.owner}/${this.repository.repo}`,
      });
    } catch (error: any) {
      this.logger.error('GitLab access validation failed', { error });
      throw new Error(`Failed to access GitLab repository: ${error.message}`);
    }
  }

  async fetchCommitInfo(ref?: string): Promise<GitCommitInfo> {
    try {
      const branch = ref || this.repository.branch || 'main';

      const { data } = await this.client.get(
        `/projects/${this.projectId}/repository/commits/${branch}`
      );

      return {
        sha: data.id,
        message: data.message,
        author: data.author_name || data.author_email,
        timestamp: new Date(data.created_at),
        parentShas: data.parent_ids || [],
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch commit info', { error });
      throw error;
    }
  }

  async fetchManifests(path: string, ref?: string): Promise<any[]> {
    try {
      const branch = ref || this.repository.branch || 'main';

      // Get all files in the repository
      const { data: treeData } = await this.client.get(
        `/projects/${this.projectId}/repository/tree`,
        {
          params: {
            ref: branch,
            recursive: true,
            path,
          },
        }
      );

      const manifests: any[] = [];

      // Filter files in the target path
      const targetFiles = treeData.filter(
        (item: any) => item.type === 'blob' && item.path.startsWith(path)
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

      this.logger.info('Fetched manifests from GitLab', {
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
    const interval = setInterval(async () => {
      try {
        const commitInfo = await this.fetchCommitInfo();
        callback(commitInfo);
      } catch (error: any) {
        this.logger.error('Watch callback error', { error });
      }
    }, 30000);

    this.logger.info('Started watching GitLab repository');

    return () => {
      clearInterval(interval);
      this.logger.info('Stopped watching GitLab repository');
    };
  }

  async createCommit(
    message: string,
    files: { path: string; content: string }[],
    branch?: string
  ): Promise<GitCommitInfo> {
    try {
      const targetBranch = branch || this.repository.branch || 'main';

      const actions = files.map((file) => ({
        action: 'create' as const,
        file_path: file.path,
        content: file.content,
      }));

      const { data } = await this.client.post(
        `/projects/${this.projectId}/repository/commits`,
        {
          branch: targetBranch,
          commit_message: message,
          actions,
        }
      );

      return {
        sha: data.id,
        message: data.message,
        author: data.author_name || data.author_email,
        timestamp: new Date(data.created_at),
        parentShas: data.parent_ids || [],
      };
    } catch (error: any) {
      this.logger.error('Failed to create commit', { error });
      throw error;
    }
  }

  async getFile(path: string, ref?: string): Promise<string> {
    try {
      const branch = ref || this.repository.branch || 'main';

      const { data } = await this.client.get(
        `/projects/${this.projectId}/repository/files/${encodeURIComponent(path)}/raw`,
        {
          params: { ref: branch },
        }
      );

      return data;
    } catch (error: any) {
      this.logger.error('Failed to get file', { path, error });
      throw error;
    }
  }

  async getTree(path: string, ref?: string): Promise<GitTree> {
    try {
      const branch = ref || this.repository.branch || 'main';

      const { data } = await this.client.get(
        `/projects/${this.projectId}/repository/tree`,
        {
          params: {
            ref: branch,
            recursive: true,
            path,
          },
        }
      );

      const entries = data
        .filter((item: any) => item.path.startsWith(path))
        .map((item: any) => ({
          path: item.path,
          mode: item.mode,
          type: item.type as 'blob' | 'tree',
          sha: item.id,
        }));

      return {
        sha: branch,
        entries,
      };
    } catch (error: any) {
      this.logger.error('Failed to get tree', { path, error });
      throw error;
    }
  }
}
