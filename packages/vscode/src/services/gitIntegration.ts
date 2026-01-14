/**
 * Git integration service for pull request reviews
 */

import * as vscode from 'vscode';
import { CodeReviewRequest, CodeReviewResponse } from '../types';
import { ApiClient } from './apiClient';
import { TelemetryService } from './telemetry';
import { Logger } from '../utils/logger';

export class GitIntegrationService {
  private logger: Logger;
  private gitExtension: any;

  constructor(
    private apiClient: ApiClient,
    private telemetry: TelemetryService,
    private context: vscode.ExtensionContext
  ) {
    this.logger = new Logger('GitIntegration');
    this.initializeGitExtension();
  }

  /**
   * Initialize Git extension
   */
  private async initializeGitExtension(): Promise<void> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (gitExtension) {
        this.gitExtension = await gitExtension.activate();
        this.logger.info('Git extension initialized');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Git extension', error);
    }
  }

  /**
   * Review pull request
   */
  async reviewPullRequest(prNumber?: number): Promise<CodeReviewResponse | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return undefined;
    }

    // Get git repository
    const repository = this.getRepository(editor.document.uri);
    if (!repository) {
      vscode.window.showWarningMessage('No git repository found');
      return undefined;
    }

    // Get changes in the current file
    const changes = this.getFileChanges(repository, editor.document.uri);

    if (changes.length === 0) {
      vscode.window.showInformationMessage('No changes detected in current file');
      return undefined;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ClaudeFlare: Reviewing changes...',
        cancellable: true
      },
      async (progress, token) => {
        try {
          const request: CodeReviewRequest = {
            code: changes.join('\n'),
            language: editor.document.languageId,
            filePath: editor.document.uri.fsPath,
            prNumber,
            context: {
              branch: repository.state.HEAD?.name,
              commit: repository.state.HEAD?.commit,
              fileCount: 1
            }
          };

          const response = await this.apiClient.reviewCode(request);

          // Show review results
          await this.showReviewResults(response, editor.document.uri);

          // Track telemetry
          await this.telemetry.trackCodeReview({
            language: editor.document.languageId,
            fileCount: 1,
            issueCount: response.issues.length
          });

          return response;
        } catch (error) {
          this.logger.error('PR review failed', error);
          vscode.window.showErrorMessage(
            `Review failed: ${error instanceof Error ? error.message : String(error)}`
          );
          return undefined;
        }
      }
    );
  }

  /**
   * Review current changes
   */
  async reviewCurrentChanges(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    const repository = this.getRepository(editor.document.uri);
    if (!repository) {
      vscode.window.showWarningMessage('No git repository found');
      return;
    }

    // Get all changed files
    const changedFiles = this.getAllChangedFiles(repository);

    if (changedFiles.length === 0) {
      vscode.window.showInformationMessage('No changes detected');
      return;
    }

    // Select files to review
    const selectedFiles = await vscode.window.showQuickPick(
      changedFiles.map(f => ({
        label: f.path.split('/').pop() || f.path,
        description: f.status,
        file: f
      })),
      {
        placeHolder: 'Select files to review',
        canPickMany: true
      }
    );

    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `ClaudeFlare: Reviewing ${selectedFiles.length} file(s)...`,
        cancellable: true
      },
      async (progress, token) => {
        try {
          const reviews: CodeReviewResponse[] = [];

          for (const selected of selectedFiles) {
            const fileUri = vscode.Uri.joinPath(repository.rootUri, selected.file.path);
            const document = await vscode.workspace.openTextDocument(fileUri);
            const changes = this.getFileChanges(repository, fileUri);

            const request: CodeReviewRequest = {
              code: changes.join('\n'),
              language: document.languageId,
              filePath: fileUri.fsPath,
              context: {
                branch: repository.state.HEAD?.name,
                commit: repository.state.HEAD?.commit,
                fileCount: selectedFiles.length
              }
            };

            const response = await this.apiClient.reviewCode(request);
            reviews.push(response);

            progress.report({
              message: `Reviewed ${selected.label}`
            });
          }

          // Show combined review results
          await this.showCombinedReviewResults(reviews);

          // Track telemetry
          await this.telemetry.trackCodeReview({
            language: editor.document.languageId,
            fileCount: selectedFiles.length,
            issueCount: reviews.reduce((sum, r) => sum + r.issues.length, 0)
          });
        } catch (error) {
          this.logger.error('Change review failed', error);
          vscode.window.showErrorMessage(
            `Review failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );
  }

  /**
   * Get repository for URI
   */
  private getRepository(uri: vscode.Uri): any {
    if (!this.gitExtension) {
      return undefined;
    }

    const api = this.gitExtension.getAPI(1);
    return api.getRepository(uri);
  }

  /**
   * Get file changes from repository
   */
  private getFileChanges(repository: any, uri: vscode.Uri): string[] {
    const changes: string[] = [];

    try {
      const diff = repository.diffWorkingTree(uri);
      if (diff) {
        changes.push(diff);
      }
    } catch (error) {
      this.logger.debug('Failed to get file changes', error);
    }

    return changes;
  }

  /**
   * Get all changed files
   */
  private getAllChangedFiles(repository: any): Array<{ path: string; status: string }> {
    const files: Array<{ path: string; status: string }> = [];

    try {
      const workingTreeChanges = repository.state.workingTreeChanges;

      for (const change of workingTreeChanges) {
        files.push({
          path: change.uri.fsPath.replace(repository.rootUri.fsPath + '/', ''),
          status: change.status.toLowerCase()
        });
      }
    } catch (error) {
      this.logger.debug('Failed to get changed files', error);
    }

    return files;
  }

  /**
   * Show review results
   */
  private async showReviewResults(response: CodeReviewResponse, fileUri: vscode.Uri): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'claudeflare.codeReview',
      `Code Review - ${fileUri.path.split('/').pop()}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    panel.webview.html = this.getReviewResultsWebview(response);
  }

  /**
   * Show combined review results
   */
  private async showCombinedReviewResults(responses: CodeReviewResponse[]): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'claudeflare.combinedReview',
      'Combined Code Review',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    // Combine results
    const combinedIssues = responses.flatMap(r => r.issues);
    const combinedSuggestions = responses.flatMap(r => r.suggestions);
    const overallScore = responses.reduce((sum, r) => sum + r.overall.score, 0) / responses.length;

    const combinedResponse: CodeReviewResponse = {
      overall: {
        score: overallScore,
        status: overallScore >= 80 ? 'approved' : overallScore >= 50 ? 'commented' : 'changes_requested',
        summary: `Combined review of ${responses.length} file(s)`
      },
      issues: combinedIssues,
      suggestions: combinedSuggestions
    };

    panel.webview.html = this.getReviewResultsWebview(combinedResponse);
  }

  /**
   * Get review results webview HTML
   */
  private getReviewResultsWebview(response: CodeReviewResponse): string {
    const statusColors = {
      approved: '#4caf50',
      changes_requested: '#f44336',
      commented: '#ff9800'
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Review Results</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }
    h1, h2, h3 { margin-top: 0; }
    .summary {
      padding: 16px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
      margin-bottom: 20px;
      border-left: 4px solid ${statusColors[response.overall.status]};
    }
    .score {
      font-size: 48px;
      font-weight: bold;
      color: ${statusColors[response.overall.status]};
      margin: 10px 0;
    }
    .issue {
      padding: 12px;
      border-left: 3px solid;
      margin-bottom: 12px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 3px;
    }
    .issue.error { border-color: var(--vscode-errorForeground); }
    .issue.warning { border-color: var(--vscode-editorWarning-foreground); }
    .issue.info { border-color: var(--vscode-infoForeground); }
    .suggestion {
      padding: 12px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
      margin-bottom: 12px;
    }
    code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
    }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <h1>Code Review Results</h1>

  <div class="summary">
    <div class="score">${Math.round(response.overall.score)}/100</div>
    <h3>${response.overall.status.replace('_', ' ').toUpperCase()}</h3>
    <p>${escapeHtml(response.overall.summary)}</p>
  </div>

  ${response.issues.length > 0 ? `
  <h2>Issues (${response.issues.length})</h2>
  ${response.issues.map(issue => `
    <div class="issue ${issue.severity}">
      <strong>Line ${issue.line}${issue.column ? `:${issue.column}` : ''} - ${issue.severity.toUpperCase()}</strong>
      ${issue.rule ? `<span style="opacity: 0.7">(${escapeHtml(issue.rule)})</span>` : ''}
      <p>${escapeHtml(issue.message)}</p>
      ${issue.fix ? `<pre><code>${escapeHtml(issue.fix)}</code></pre>` : ''}
    </div>
  `).join('')}
  ` : '<h2>No issues found! 🎉</h2>'}

  ${response.suggestions.length > 0 ? `
  <h2>Suggestions (${response.suggestions.length})</h2>
  ${response.suggestions.map(suggestion => `
    <div class="suggestion">
      <strong>${escapeHtml(suggestion.type)}</strong> - Priority: ${suggestion.priority}
      <p>${escapeHtml(suggestion.description)}</p>
      <pre><code>${escapeHtml(suggestion.code)}</code></pre>
      <p><em>${escapeHtml(suggestion.reason)}</em></p>
    </div>
  `).join('')}
  ` : ''}

  ${response.metrics ? `
  <h2>Metrics</h2>
  <ul>
    <li>Complexity: ${response.metrics.complexity}/100</li>
    <li>Maintainability: ${response.metrics.maintainability}/100</li>
    ${response.metrics.testCoverage !== undefined ? `<li>Test Coverage: ${response.metrics.testCoverage}%</li>` : ''}
    <li>Duplications: ${response.metrics.duplications}</li>
    ${response.metrics.security !== undefined ? `<li>Security Score: ${response.metrics.security}/100</li>` : ''}
  </ul>
  ` : ''}
</body>
</html>`;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Cleanup if needed
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
