/**
 * Bitbucket Adapter for GitOps operations
 */

import { GitRepository } from '../../types';
import { Logger } from '../../utils/logger';
import { GitProviderAdapterBase, GitCommitInfo, GitTree } from './git-provider-adapter';
import axios from 'axios';
import * as yaml from 'yaml';

export class BitbucketAdapter extends GitProviderAdapterBase {
  private client: axios.AxiosInstance;

  constructor(repository: GitRepository, logger: Logger) {
    super(repository, logger);

    const baseUrl = repository.apiUrl || 'https://api.bitbucket.org/2.0';

    this.client = axios.create({
      baseURL: baseUrl,
      auth: {
        username: repository.token,
        password: 'x-token-auth', // Bitbucket App Password authentication
      },
    });
  }

  async validateAccess(): Promise<void> {
    try {
      await this.client.get(
        `/repositories/${this.repository.owner}/${this.repository.repo}`
      );
      this.logger.info('Bitbucket access validated', {
        repository: `${this.repository.owner}/${this.repository.repo}`,
      });
    } catch (error: any) {
      this.logger.error('Bitbucket access validation failed', { error });
      throw new Error(`Failed to access Bitbucket repository: ${error.message}`);
    }
  }

  async fetchCommitInfo(ref?: string): Promise<GitCommitInfo> {
    try {
      const branch = ref || this.repository.branch || 'main';

      const { data } = await this.client.get(
        `/repositories/${this.repository.owner}/${this.repository.repo}/refs/branches/${branch}`
      );

      const target = data.target;
      const commit = target.type === 'commit' ? target : target.target;

      return {
        sha: commit.hash,
        message: commit.message,
        author: commit.author.user?.display_name || commit.author.raw,
        timestamp: new Date(commit.date),
        parentShas: commit.parents?.map((p: any) => p.hash) || [],
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
      const { data } = await this.client.get(
        `/repositories/${this.repository.owner}/${this.repository.repo}/src/${branch}/${path}`
      );

      const manifests: any[] = [];

      // Bitbucket API returns file listings differently
      if (data.values) {
        for (const file of data.values) {
          if (file.type === 'commit_file') {
            try {
              const content = await this.getFile(file.path, ref);

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
        }
      }

      this.logger.info('Fetched manifests from Bitbucket', {
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

    this.logger.info('Started watching Bitbucket repository');

    return () => {
      clearInterval(interval);
      this.logger.info('Stopped watching Bitbucket repository');
    };
  }

  async createCommit(
    message: string,
    files: { path: string; content: string }[],
    branch?: string
  ): Promise<GitCommitInfo> {
    try {
      const targetBranch = branch || this.repository.branch || 'main';

      // Bitbucket requires creating commits for each file
      // This is a simplified version
      for (const file of files) {
        await this.client.post(
          `/repositories/${this.repository.owner}/${this.repository.repo}/src`,
          {
            [file.path]: file.content,
            message,
            branch: targetBranch,
          }
        );
      }

      // Get the resulting commit info
      return this.fetchCommitInfo(targetBranch);
    } catch (error: any) {
      this.logger.error('Failed to create commit', { error });
      throw error;
    }
  }

  async getFile(path: string, ref?: string): Promise<string> {
    try {
      const branch = ref || this.repository.branch || 'main';

      const { data } = await this.client.get(
        `/repositories/${this.repository.owner}/${this.repository.repo}/src/${branch}/${path}`
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
        `/repositories/${this.repository.owner}/${this.repository.repo}/src/${branch}/${path}`
      );

      const entries: any[] = [];

      if (data.values) {
        for (const item of data.values) {
          entries.push({
            path: item.path,
            mode: '100644',
            type: item.type === 'commit_directory' ? 'tree' : 'blob',
            sha: item.hash,
          });
        }
      }

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
