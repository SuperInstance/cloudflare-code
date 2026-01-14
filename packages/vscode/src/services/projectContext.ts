/**
 * Project context management for file tracking and analysis
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ProjectContext, ProjectFile, GitInfo } from '../types';
import { Logger } from '../utils/logger';

export class ProjectContextManager {
  private logger: Logger;
  private context: vscode.ExtensionContext;
  private projectContext: Map<string, ProjectContext> = new Map();
  private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private excludePatterns: string[];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.logger = new Logger('ProjectContext');
    this.excludePatterns = vscode.workspace
      .getConfiguration('claudeflare')
      .get<string[]>('excludePatterns', [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**'
      ]);
  }

  /**
   * Initialize project context
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing project context...');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this.logger.warn('No workspace folders found');
      return;
    }

    for (const folder of workspaceFolders) {
      await this.analyzeProject(folder.uri.fsPath);
      this.setupFileWatcher(folder.uri.fsPath);
    }

    // Watch for workspace changes
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async event => {
        for (const folder of event.added) {
          await this.analyzeProject(folder.uri.fsPath);
          this.setupFileWatcher(folder.uri.fsPath);
        }
        for (const folder of event.removed) {
          this.projectContext.delete(folder.uri.fsPath);
          const watcher = this.fileWatchers.get(folder.uri.fsPath);
          if (watcher) {
            watcher.dispose();
            this.fileWatchers.delete(folder.uri.fsPath);
          }
        }
      })
    );
  }

  /**
   * Analyze project structure
   */
  private async analyzeProject(rootPath: string): Promise<void> {
    this.logger.info(`Analyzing project: ${rootPath}`);

    try {
      const files = await this.scanProject(rootPath);
      const gitInfo = await this.getGitInfo(rootPath);
      const dependencies = await this.getDependencies(rootPath);
      const language = this.detectPrimaryLanguage(files);
      const framework = this.detectFramework(rootPath, files);
      const buildTool = this.detectBuildTool(rootPath);

      const projectContext: ProjectContext = {
        rootPath,
        files,
        dependencies,
        gitInfo,
        language,
        framework,
        buildTool
      };

      this.projectContext.set(rootPath, projectContext);
      this.logger.info(`Project analyzed: ${files.length} files, language: ${language}`);
    } catch (error) {
      this.logger.error('Failed to analyze project', error);
    }
  }

  /**
   * Scan project files
   */
  private async scanProject(rootPath: string): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const maxFiles = 10000; // Prevent scanning massive projects
    let fileCount = 0;

    async function scanDir(dir: string, depth = 0): Promise<void> {
      if (depth > 10 || fileCount > maxFiles) {
        return;
      }

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (fileCount > maxFiles) {
            break;
          }

          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!this.shouldExclude(fullPath)) {
              await scanDir(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            const relativePath = path.relative(rootPath, fullPath);
            if (!this.shouldExclude(relativePath)) {
              const stats = await fs.stat(fullPath);
              files.push({
                path: relativePath,
                language: this.detectLanguage(fullPath),
                size: stats.size,
                lastModified: stats.mtimeMs,
                isTest: this.isTestFile(fullPath),
                isConfig: this.isConfigFile(fullPath)
              });
              fileCount++;
            }
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    }

    await scanDir.call(this, rootPath);
    return files;
  }

  /**
   * Check if path should be excluded
   */
  private shouldExclude(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return this.excludePatterns.some(pattern => {
      const regex = new RegExp(
        pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.')
      );
      return regex.test(normalizedPath);
    });
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.kt': 'kotlin',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.dart': 'dart',
      '.lua': 'lua',
      '.r': 'r',
      '.m': 'objective-c',
      '.mm': 'objective-c++',
      '.sh': 'shell',
      '.sql': 'sql',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.md': 'markdown'
    };

    return languageMap[ext] || 'text';
  }

  /**
   * Detect primary project language
   */
  private detectPrimaryLanguage(files: ProjectFile[]): string {
    const languageCounts: Record<string, number> = {};

    for (const file of files) {
      if (!file.isTest && !file.isConfig) {
        languageCounts[file.language] = (languageCounts[file.language] || 0) + 1;
      }
    }

    let maxCount = 0;
    let primaryLanguage = 'typescript';

    for (const [language, count] of Object.entries(languageCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryLanguage = language;
      }
    }

    return primaryLanguage;
  }

  /**
   * Detect framework
   */
  private detectFramework(rootPath: string, files: ProjectFile[]): string | undefined {
    const packageJsonPath = path.join(rootPath, 'package.json');
    const hasPackageJson = files.some(f => f.path === 'package.json');

    if (hasPackageJson) {
      try {
        const packageJson = JSON.parse(
          require('fs').readFileSync(packageJsonPath, 'utf-8')
        );
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (deps.react && !deps.vue) return 'react';
        if (deps.vue) return 'vue';
        if (deps.angular) return 'angular';
        if (deps.svelte) return 'svelte';
        if (deps.next) return 'next.js';
        if (deps.nuxt || deps['@nuxt/kit']) return 'nuxt';
        if (deps.express) return 'express';
        if (deps.fastify) return 'fastify';
        if (deps.nestjs || deps['@nestjs/core']) return 'nestjs';
      } catch {
        // Ignore
      }
    }

    // Check for other frameworks
    if (files.some(f => f.path.endsWith('requirements.txt'))) {
      try {
        const requirements = require('fs').readFileSync(
          path.join(rootPath, 'requirements.txt'),
          'utf-8'
        );
        if (requirements.includes('django')) return 'django';
        if (requirements.includes('flask')) return 'flask';
        if (requirements.includes('fastapi')) return 'fastapi';
      } catch {
        // Ignore
      }
    }

    return undefined;
  }

  /**
   * Detect build tool
   */
  private detectBuildTool(rootPath: string): string | undefined {
    const files = require('fs').readdirSync(rootPath);

    if (files.includes('webpack.config.js') || files.includes('webpack.config.ts')) {
      return 'webpack';
    }
    if (files.includes('vite.config.js') || files.includes('vite.config.ts')) {
      return 'vite';
    }
    if (files.includes('rollup.config.js') || files.includes('rollup.config.ts')) {
      return 'rollup';
    }
    if (files.includes('tsconfig.json')) {
      return 'typescript';
    }
    if (files.includes('Cargo.toml')) {
      return 'cargo';
    }
    if (files.includes('go.mod')) {
      return 'go';
    }

    return undefined;
  }

  /**
   * Get git information
   */
  private async getGitInfo(rootPath: string): Promise<GitInfo | undefined> {
    try {
      const git = vscode.extensions.getExtension('vscode.git');
      if (!git) {
        return undefined;
      }

      const gitApi = await git.activate();
      const repository = gitApi.getRepository(vscode.Uri.file(rootPath));

      if (!repository) {
        return undefined;
      }

      const head = repository.state.HEAD;
      const status = repository.state.workingTreeChanges.map(change => ({
        path: change.uri.fsPath,
        status: change.status.toLowerCase() as 'modified' | 'added' | 'deleted' | 'renamed'
      }));

      return {
        branch: head?.name || 'unknown',
        commit: head?.commit || 'unknown',
        remote: repository.state.remotes[0]?.name,
        status
      };
    } catch (error) {
      this.logger.debug('Failed to get git info', error);
      return undefined;
    }
  }

  /**
   * Get project dependencies
   */
  private async getDependencies(rootPath: string): Promise<Record<string, string>> {
    const packageJsonPath = path.join(rootPath, 'package.json');

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      return {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
    } catch {
      return {};
    }
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filePath: string): boolean {
    const name = path.basename(filePath).toLowerCase();
    const testPatterns = [
      '.test.',
      '.spec.',
      '__tests__',
      'test_',
      '_test.',
      '_spec.'
    ];
    return testPatterns.some(pattern => name.includes(pattern));
  }

  /**
   * Check if file is a config file
   */
  private isConfigFile(filePath: string): boolean {
    const name = path.basename(filePath).toLowerCase();
    const configPatterns = [
      'config.',
      '.conf.',
      'rc.',
      'tsconfig.json',
      'package.json',
      '.eslintrc',
      '.prettierrc',
      'dockerfile',
      'docker-compose',
      'makefile',
      'cmake',
      '.gitignore'
    ];
    return configPatterns.some(pattern => name.includes(pattern) || name.startsWith(pattern));
  }

  /**
   * Setup file watcher for project
   */
  private setupFileWatcher(rootPath: string): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(rootPath, '**/*')
    );

    watcher.onDidChange(async uri => {
      this.logger.debug(`File changed: ${uri.fsPath}`);
      await this.updateFileContext(rootPath, uri.fsPath);
    });

    watcher.onDidCreate(async uri => {
      this.logger.debug(`File created: ${uri.fsPath}`);
      await this.updateFileContext(rootPath, uri.fsPath);
    });

    watcher.onDidDelete(async uri => {
      this.logger.debug(`File deleted: ${uri.fsPath}`);
      await this.removeFileContext(rootPath, uri.fsPath);
    });

    this.fileWatchers.set(rootPath, watcher);
  }

  /**
   * Update file context
   */
  private async updateFileContext(rootPath: string, filePath: string): Promise<void> {
    const context = this.projectContext.get(rootPath);
    if (!context) {
      return;
    }

    const relativePath = path.relative(rootPath, filePath);
    const existingIndex = context.files.findIndex(f => f.path === relativePath);

    try {
      const stats = await fs.stat(filePath);
      const fileData: ProjectFile = {
        path: relativePath,
        language: this.detectLanguage(filePath),
        size: stats.size,
        lastModified: stats.mtimeMs,
        isTest: this.isTestFile(filePath),
        isConfig: this.isConfigFile(filePath)
      };

      if (existingIndex >= 0) {
        context.files[existingIndex] = fileData;
      } else {
        context.files.push(fileData);
      }
    } catch (error) {
      // File might be deleted
      if (existingIndex >= 0) {
        context.files.splice(existingIndex, 1);
      }
    }
  }

  /**
   * Remove file from context
   */
  private async removeFileContext(rootPath: string, filePath: string): Promise<void> {
    const context = this.projectContext.get(rootPath);
    if (!context) {
      return;
    }

    const relativePath = path.relative(rootPath, filePath);
    const index = context.files.findIndex(f => f.path === relativePath);
    if (index >= 0) {
      context.files.splice(index, 1);
    }
  }

  /**
   * Get context for file
   */
  getContextForFile(filePath: string): ProjectContext | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    if (!workspaceFolder) {
      return undefined;
    }

    return this.projectContext.get(workspaceFolder.uri.fsPath);
  }

  /**
   * Get all project contexts
   */
  getAllContexts(): ProjectContext[] {
    return Array.from(this.projectContext.values());
  }

  /**
   * Refresh project analysis
   */
  async refresh(rootPath?: string): Promise<void> {
    if (rootPath) {
      await this.analyzeProject(rootPath);
    } else {
      for (const path of this.projectContext.keys()) {
        await this.analyzeProject(path);
      }
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    for (const watcher of this.fileWatchers.values()) {
      watcher.dispose();
    }
    this.fileWatchers.clear();
    this.projectContext.clear();
  }
}
