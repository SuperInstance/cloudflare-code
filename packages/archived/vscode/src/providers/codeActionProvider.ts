/**
 * Code action provider for AI-powered refactorings
 */

import * as vscode from 'vscode';
import {
  CodeAction,
  CodeActionContext,
  CodeActionKind,
  Range,
  CancellationToken,
  TextDocument
} from 'vscode';

import { ApiClient } from '../services/apiClient';
import { ClaudeFlareConfig, RefactorRequest, RefactorType } from '../types';
import { TelemetryService } from '../services/telemetry';
import { ProjectContextManager } from '../services/projectContext';
import { Logger } from '../utils/logger';

export class CodeActionProvider implements vscode.CodeActionProvider {
  private logger: Logger;

  constructor(
    private apiClient: ApiClient,
    private config: ClaudeFlareConfig,
    private telemetry: TelemetryService,
    private projectContext: ProjectContextManager
  ) {
    this.logger = new Logger('CodeActionProvider');
  }

  /**
   * Provide code actions
   */
  async provideCodeActions(
    document: TextDocument,
    range: Range,
    context: CodeActionContext,
    token: CancellationToken
  ): Promise<CodeAction[] | undefined> {
    if (!this.config.enableCodeActions) {
      return undefined;
    }

    const actions: CodeAction[] = [];
    const selectedCode = document.getText(range);

    // Only provide actions if there's selected code or diagnostics
    if (!selectedCode && context.diagnostics.length === 0) {
      return undefined;
    }

    // Explain code action
    const explainAction = this.createCodeAction(
      'Explain with ClaudeFlare',
      CodeActionKind.QuickFix,
      'claudeflare.explain',
      document,
      range
    );
    actions.push(explainAction);

    // Refactoring actions (only if code is selected)
    if (selectedCode) {
      // Simplify code
      const simplifyAction = this.createCodeAction(
        'Simplify with ClaudeFlare',
        CodeActionKind.Refactor,
        'claudeflare.simplify',
        document,
        range
      );
      actions.push(simplifyAction);

      // Optimize code
      const optimizeAction = this.createCodeAction(
        'Optimize with ClaudeFlare',
        CodeActionKind.Refactor,
        'claudeflare.optimize',
        document,
        range
      );
      actions.push(optimizeAction);

      // Add types
      const addTypesAction = this.createCodeAction(
        'Add Type Annotations',
        CodeActionKind.Refactor,
        'claudeflare.addTypes',
        document,
        range
      );
      actions.push(addTypesAction);

      // Extract function
      const extractFunctionAction = this.createCodeAction(
        'Extract Function',
        CodeActionKind.RefactorExtract,
        'claudeflare.extractFunction',
        document,
        range
      );
      actions.push(extractFunctionAction);

      // Generate tests
      const generateTestsAction = this.createCodeAction(
        'Generate Tests with ClaudeFlare',
        CodeActionKind.QuickFix,
        'claudeflare.generateTests',
        document,
        range
      );
      actions.push(generateTestsAction);

      // Add documentation
      const addDocsAction = this.createCodeAction(
        'Add Documentation with ClaudeFlare',
        CodeActionKind.QuickFix,
        'claudeflare.addDocs',
        document,
        range
      );
      actions.push(addDocsAction);
    }

    // Fix issues action (if there are diagnostics)
    if (context.diagnostics.length > 0) {
      const fixAction = this.createCodeAction(
        'Fix Issues with ClaudeFlare',
        CodeActionKind.QuickFix,
        'claudeflare.fixIssues',
        document,
        range
      );
      actions.push(fixAction);
    }

    return actions;
  }

  /**
   * Create a code action
   */
  private createCodeAction(
    title: string,
    kind: CodeActionKind,
    commandId: string,
    document: TextDocument,
    range: Range
  ): CodeAction {
    const action = new CodeAction(title, kind);
    action.command = {
      command: commandId,
      title: title,
      arguments: [document.uri, range]
    };
    return action;
  }

  /**
   * Execute refactor action
   */
  async executeRefactor(
    document: TextDocument,
    range: Range,
    type: RefactorType,
    options?: unknown
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
      return;
    }

    const code = document.getText(range);

    try {
      // Show loading indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `ClaudeFlare: ${this.getRefactorTitle(type)}...`,
          cancellable: true
        },
        async (progress, token) => {
          const request: RefactorRequest = {
            code,
            language: document.languageId,
            filePath: document.uri.fsPath,
            range,
            type,
            options: options as any
          };

          const response = await this.apiClient.refactorCode(request);

          if (token.isCancellationRequested) {
            return;
          }

          // Apply the refactoring
          await editor.edit(editBuilder => {
            editBuilder.replace(range, response.code);
          });

          // Track telemetry
          await this.telemetry.trackRefactoring({
            type,
            language: document.languageId,
            linesChanged: code.split('\n').length
          });

          // Show explanation
          vscode.window.showInformationMessage(
            `ClaudeFlare: ${this.getRefactorTitle(type)} completed`,
            'View Details'
          ).then(selection => {
            if (selection === 'View Details') {
              this.showRefactorDetails(response);
            }
          });
        }
      );
    } catch (error) {
      this.logger.error('Refactor failed', error);
      vscode.window.showErrorMessage(
        `ClaudeFlare: Refactoring failed - ${error instanceof Error ? error.message : String(error)}`
      );
      await this.telemetry.trackError(error as Error, {
        type,
        language: document.languageId
      });
    }
  }

  /**
   * Get refactor title
   */
  private getRefactorTitle(type: RefactorType): string {
    const titles: Record<RefactorType, string> = {
      'simplify': 'Simplification',
      'optimize': 'Optimization',
      'extract-function': 'Extract Function',
      'extract-variable': 'Extract Variable',
      'inline': 'Inline',
      'rename': 'Rename',
      'reorder': 'Reorder',
      'modernize': 'Modernization',
      'type-safe': 'Type Safety'
    };

    return titles[type] || 'Refactoring';
  }

  /**
   * Show refactor details
   */
  private showRefactorDetails(response: {
    explanation: string;
    changes: unknown[];
    warnings?: string[];
  }): void {
    const panel = vscode.window.createWebviewPanel(
      'claudeflare.refactorDetails',
      'Refactor Details',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    panel.webview.html = this.getRefactorDetailsWebview(response);
  }

  /**
   * Get refactor details webview content
   */
  private getRefactorDetailsWebview(response: {
    explanation: string;
    changes: unknown[];
    warnings?: string[];
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refactor Details</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
    }
    h2 {
      margin-top: 0;
    }
    .section {
      margin-bottom: 20px;
    }
    .explanation {
      white-space: pre-wrap;
      line-height: 1.5;
    }
    .warning {
      color: var(--vscode-editorWarning-foreground);
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <h2>Refactoring Explanation</h2>
  <div class="section">
    <div class="explanation">${this.escapeHtml(response.explanation)}</div>
  </div>

  ${response.warnings && response.warnings.length > 0 ? `
  <h3>Warnings</h3>
  <div class="section">
    ${response.warnings.map(w => `<div class="warning">⚠️ ${this.escapeHtml(w)}</div>`).join('')}
  </div>
  ` : ''}

  <h3>Changes Applied</h3>
  <div class="section">
    <p>${response.changes.length} change(s) applied to your code.</p>
  </div>
</body>
</html>`;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
