// @ts-nocheck
/**
 * Git Integration
 *
 * Provides Git operations for safe refactoring.
 */

import { Logger } from './logger';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';

export interface GitOptions {
  autoCommit?: boolean;
  commitMessage?: string;
  createBranch?: boolean;
  branchName?: string;
}

export class GitIntegration {
  private logger: Logger;
  private repoRoot: string | null = null;

  constructor(private options: GitOptions = {}) {
    this.logger = new Logger('info');
  }

  /**
   * Initialize Git integration
   */
  async init(filePath: string): Promise<void> {
    try {
      this.repoRoot = await this.findRepoRoot(filePath);
      this.logger.info(`Git repository found at: ${this.repoRoot}`);
    } catch {
      this.logger.warn('Not in a Git repository');
      this.repoRoot = null;
    }
  }

  /**
   * Get file content from Git
   */
  async getFileContent(filePath: string, revision: string = 'HEAD'): Promise<string> {
    if (!this.repoRoot) {
      return await fs.readFile(filePath, 'utf-8');
    }

    try {
      const relativePath = filePath.replace(this.repoRoot + '/', '');
      return await this.gitCommand(['show', `${revision}:${relativePath}`]);
    } catch {
      return await fs.readFile(filePath, 'utf-8');
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string): Promise<void> {
    if (!this.repoRoot) {
      throw new Error('Not in a Git repository');
    }

    await this.gitCommand(['checkout', '-b', branchName]);
    this.logger.info(`Created branch: ${branchName}`);
  }

  /**
   * Move a file using Git
   */
  async moveFile(
    oldPath: string,
    newPath: string,
    options: { createDirectory?: boolean } = {}
  ): Promise<void> {
    if (options.createDirectory) {
      const dir = require('path').dirname(newPath);
      await fs.mkdir(dir, { recursive: true });
    }

    if (this.repoRoot) {
      await this.gitCommand(['mv', oldPath, newPath]);
    } else {
      await fs.rename(oldPath, newPath);
    }

    this.logger.info(`Moved ${oldPath} to ${newPath}`);
  }

  /**
   * Commit changes
   */
  async commit(message: string, files?: string[]): Promise<void> {
    if (!this.repoRoot) {
      throw new Error('Not in a Git repository');
    }

    if (files) {
      for (const file of files) {
        await this.gitCommand(['add', file]);
      }
    } else {
      await this.gitCommand(['add', '-A']);
    }

    await this.gitCommand(['commit', '-m', message]);
    this.logger.info(`Committed changes: ${message}`);
  }

  /**
   * Rollback changes
   */
  async rollback(commit?: string): Promise<void> {
    if (!this.repoRoot) {
      throw new Error('Not in a Git repository');
    }

    if (commit) {
      await this.gitCommand(['reset', '--hard', commit]);
    } else {
      await this.gitCommand(['reset', '--hard', 'HEAD']);
    }

    this.logger.info('Rolled back changes');
  }

  /**
   * Restore a file to its original state
   */
  async restoreFile(filePath: string, content: string): Promise<void> {
    if (this.repoRoot) {
      const relativePath = filePath.replace(this.repoRoot + '/', '');
      await this.gitCommand(['checkout', '--', relativePath]);
    } else {
      await fs.writeFile(filePath, content);
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    if (!this.repoRoot) {
      return 'no-git';
    }

    try {
      return await this.gitCommand(['rev-parse', '--abbrev-ref', 'HEAD']);
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get diff of changes
   */
  async getDiff(filePath?: string): Promise<string> {
    if (!this.repoRoot) {
      return '';
    }

    const args = ['diff'];
    if (filePath) {
      args.push(filePath);
    }

    return await this.gitCommand(args);
  }

  /**
   * Check if there are uncommitted changes
   */
  async hasChanges(): Promise<boolean> {
    if (!this.repoRoot) {
      return false;
    }

    try {
      const output = await this.gitCommand(['status', '--porcelain']);
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Find repository root
   */
  private async findRepoRoot(filePath: string): Promise<string> {
    let currentPath = filePath;

    while (currentPath !== '/') {
      try {
        await fs.access(`${currentPath}/.git`);
        return currentPath;
      } catch {
        currentPath = require('path').dirname(currentPath);
      }
    }

    throw new Error('Not in a Git repository');
  }

  /**
   * Execute Git command
   */
  private async gitCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: this.repoRoot || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      git.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command failed: ${stderr}`));
        }
      });
    });
  }
}
