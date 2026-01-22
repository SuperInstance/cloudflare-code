/**
 * Context view provider - displays project context information
 */

import * as vscode from 'vscode';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, Event, EventEmitter } from 'vscode';

import { ProjectContextManager } from '../services/projectContext';
import { ProjectContext, ProjectFile } from '../types';
import { Logger } from '../utils/logger';

export class ContextViewProvider implements TreeDataProvider<ContextItem> {
  private logger: Logger;
  private _onDidChangeTreeData = new EventEmitter<ContextItem | undefined | null | void>();
  readonly onDidChangeTreeData: Event<ContextItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(
    private context: vscode.ExtensionContext,
    private projectContextManager: ProjectContextManager
  ) {
    this.logger = new Logger('ContextView');
  }

  /**
   * Refresh the tree
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item
   */
  getTreeItem(element: ContextItem): TreeItem {
    return element;
  }

  /**
   * Get children
   */
  async getChildren(element?: ContextItem): Promise<ContextItem[]> {
    if (!element) {
      // Root level - return all projects
      const contexts = this.projectContextManager.getAllContexts();
      return contexts.map(ctx => new ProjectItem(ctx));
    }

    if (element instanceof ProjectItem) {
      const context = element.context;
      return [
        new SummaryItem(context),
        new FilesItem(context.files.length),
        new DependenciesItem(Object.keys(context.dependencies).length),
        new GitItem(context.gitInfo)
      ];
    }

    if (element instanceof FilesItem) {
      // Get the project context
      const contexts = this.projectContextManager.getAllContexts();
      const context = contexts[0]; // Simplified for now
      if (context) {
        return context.files
          .slice(0, 100) // Limit to 100 files
          .map(file => new FileItem(file));
      }
    }

    if (element instanceof DependenciesItem) {
      const contexts = this.projectContextManager.getAllContexts();
      const context = contexts[0];
      if (context) {
        return Object.entries(context.dependencies).map(([name, version]) =>
          new DependencyItem(name, version as string)
        );
      }
    }

    if (element instanceof GitItem) {
      const gitInfo = element.gitInfo;
      if (gitInfo) {
        return [
          new GitInfoItem('Branch', gitInfo.branch),
          new GitInfoItem('Commit', gitInfo.commit.substring(0, 8)),
          new GitStatusItem(gitInfo.status.length)
        ];
      }
    }

    return [];
  }

  /**
   * Get parent
   */
  getParent?(element: ContextItem): vscode.ProviderResult<ContextItem> {
    return null;
  }
}

/**
 * Project item
 */
class ProjectItem extends TreeItem {
  constructor(public context: ProjectContext) {
    super(context.rootPath.split('/').pop() || 'Project', TreeItemCollapsibleState.Collapsed);

    this.description = `${context.files.length} files`;
    this.tooltip = `Root: ${context.rootPath}\nLanguage: ${context.language}`;
    this.iconPath = new vscode.ThemeIcon('folder');
    this.contextValue = 'project';
  }
}

/**
 * Summary item
 */
class SummaryItem extends TreeItem {
  constructor(context: ProjectContext) {
    super('Summary', TreeItemCollapsibleState.None);

    const description = [
      `Language: ${context.language}`,
      context.framework ? `Framework: ${context.framework}` : null,
      context.buildTool ? `Build Tool: ${context.buildTool}` : null
    ].filter(Boolean).join(' | ');

    this.description = description;
    this.tooltip = description;
    this.iconPath = new vscode.ThemeIcon('info');
    this.contextValue = 'summary';
  }
}

/**
 * Files item
 */
class FilesItem extends TreeItem {
  constructor(private fileCount: number) {
    super('Files', TreeItemCollapsibleState.Collapsed);
    this.description = `${fileCount} files`;
    this.iconPath = new vscode.ThemeIcon('files');
    this.contextValue = 'files';
  }
}

/**
 * File item
 */
class FileItem extends TreeItem {
  constructor(private file: ProjectFile) {
    const name = file.path.split('/').pop() || file.path;
    super(name, TreeItemCollapsibleState.None);

    this.description = `${file.language} • ${formatSize(file.size)}`;
    this.tooltip = `Path: ${file.path}\nLanguage: ${file.language}\nSize: ${formatSize(file.size)}\nModified: ${new Date(file.lastModified).toLocaleString()}`;
    this.iconPath = new vscode.ThemeIcon(getFileIcon(file));
    this.contextValue = 'file';
    this.command = {
      command: 'claudeflare.openContextFile',
      title: 'Open File',
      arguments: [file.path]
    };
  }
}

/**
 * Dependencies item
 */
class DependenciesItem extends TreeItem {
  constructor(private depCount: number) {
    super('Dependencies', TreeItemCollapsibleState.Collapsed);
    this.description = `${depCount} packages`;
    this.iconPath = new vscode.ThemeIcon('package');
    this.contextValue = 'dependencies';
  }
}

/**
 * Dependency item
 */
class DependencyItem extends TreeItem {
  constructor(name: string, version: string) {
    super(name, TreeItemCollapsibleState.None);
    this.description = version;
    this.tooltip = `${name}@${version}`;
    this.iconPath = new vscode.ThemeIcon('library');
    this.contextValue = 'dependency';
  }
}

/**
 * Git item
 */
class GitItem extends TreeItem {
  constructor(public gitInfo?: any) {
    super('Git', TreeItemCollapsibleState.Collapsed);
    this.description = gitInfo ? gitInfo.branch : 'Not a git repository';
    this.iconPath = new vscode.ThemeIcon('git-branch');
    this.contextValue = 'git';
  }
}

/**
 * Git info item
 */
class GitInfoItem extends TreeItem {
  constructor(label: string, value: string) {
    super(`${label}: ${value}`, TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('git-commit');
    this.contextValue = 'gitInfo';
  }
}

/**
 * Git status item
 */
class GitStatusItem extends TreeItem {
  constructor(statusCount: number) {
    super(`Changes: ${statusCount}`, TreeItemCollapsibleState.None);
    this.description = `${statusCount} file(s) modified`;
    this.iconPath = new vscode.ThemeIcon('warning');
    this.contextValue = 'gitStatus';
  }
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get file icon based on type
 */
function getFileIcon(file: ProjectFile): string {
  if (file.isTest) return 'beaker';
  if (file.isConfig) return 'gear';

  const icons: Record<string, string> = {
    typescript: 'symbol-type-parameter',
    javascript: 'symbol-event',
    python: 'symbol-snippet',
    go: 'symbol-namespace',
    rust: 'symbol-struct',
    java: 'symbol-class',
    html: 'symbol-interface',
    css: 'symbol-color',
    json: 'symbol-object',
    markdown: 'symbol-misc'
  };

  return icons[file.language] || 'file';
}
