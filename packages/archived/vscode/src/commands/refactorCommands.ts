/**
 * Refactoring commands
 */

import * as vscode from 'vscode';
import { ExtensionContext, Uri, Range } from 'vscode';

import { ExtensionState } from '../extension';
import { RefactorType } from '../types';
import { Logger } from '../utils/logger';

export function registerRefactorCommands(context: ExtensionContext, state: ExtensionState): void {
  const logger = new Logger('RefactorCommands');

  // Refactor code
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.refactor', async (uri?: Uri, range?: Range) => {
      logger.info('Refactoring code');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select the code you want to refactor');
        return;
      }

      // Show refactor type picker
      const refactorType = await vscode.window.showQuickPick(
        [
          { label: 'Simplify', description: 'Simplify complex code', value: 'simplify' },
          { label: 'Optimize', description: 'Optimize for performance', value: 'optimize' },
          { label: 'Add Types', description: 'Add type annotations', value: 'type-safe' },
          { label: 'Modernize', description: 'Update to modern syntax', value: 'modernize' },
          { label: 'Extract Function', description: 'Extract to a function', value: 'extract-function' }
        ],
        { placeHolder: 'Select refactoring type' }
      );

      if (!refactorType) {
        return;
      }

      await executeRefactor(state, editor, selection, selectedCode, refactorType.value as RefactorType);
    })
  );

  // Simplify code
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.simplify', async (uri?: Uri, range?: Range) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select the code you want to simplify');
        return;
      }

      await executeRefactor(state, editor, selection, selectedCode, 'simplify');
    })
  );

  // Optimize code
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.optimize', async (uri?: Uri, range?: Range) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select the code you want to optimize');
        return;
      }

      await executeRefactor(state, editor, selection, selectedCode, 'optimize');
    })
  );

  // Add types
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.addTypes', async (uri?: Uri, range?: Range) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select the code to add types to');
        return;
      }

      await executeRefactor(state, editor, selection, selectedCode, 'type-safe');
    })
  );

  // Extract function
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.extractFunction', async (uri?: Uri, range?: Range) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select the code to extract');
        return;
      }

      await executeRefactor(state, editor, selection, selectedCode, 'extract-function');
    })
  );

  // Modernize code
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.modernize', async (uri?: Uri, range?: Range) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select the code to modernize');
        return;
      }

      await executeRefactor(state, editor, selection, selectedCode, 'modernize');
    })
  );
}

/**
 * Execute refactoring
 */
async function executeRefactor(
  state: ExtensionState,
  editor: vscode.TextEditor,
  selection: Range,
  selectedCode: string,
  type: RefactorType
): Promise<void> {
  const logger = new Logger('RefactorCommand');

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `ClaudeFlare: ${getRefactorTitle(type)}...`,
      cancellable: true
    },
    async (progress, token) => {
      try {
        const response = await state.apiClient.refactorCode({
          code: selectedCode,
          language: editor.document.languageId,
          filePath: editor.document.uri.fsPath,
          range: selection,
          type,
          options: {
            preserveComments: true,
            addJSDoc: true
          }
        });

        // Apply the refactoring
        await editor.edit(editBuilder => {
          editBuilder.replace(selection, response.code);
        });

        // Show completion message
        vscode.window.showInformationMessage(
          `ClaudeFlare: ${getRefactorTitle(type)} completed`,
          'View Details'
        ).then(selection => {
          if (selection === 'View Details') {
            showRefactorDetails(response);
          }
        });

        // Track telemetry
        state.telemetry.trackRefactoring({
          type,
          language: editor.document.languageId,
          linesChanged: selectedCode.split('\n').length
        });
      } catch (error) {
        logger.error('Refactoring failed', error);
        vscode.window.showErrorMessage(
          `Refactoring failed: ${error instanceof Error ? error.message : String(error)}`
        );
        state.telemetry.trackError(error as Error, { type });
      }
    }
  );
}

/**
 * Get refactor title
 */
function getRefactorTitle(type: RefactorType): string {
  const titles: Record<RefactorType, string> = {
    'simplify': 'Simplification',
    'optimize': 'Optimization',
    'extract-function': 'Extract Function',
    'extract-variable': 'Extract Variable',
    'inline': 'Inline',
    'rename': 'Rename',
    'reorder': 'Reorder',
    'modernize': 'Modernization',
    'type-safe': 'Add Type Annotations'
  };

  return titles[type] || 'Refactoring';
}

/**
 * Show refactor details
 */
function showRefactorDetails(response: {
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

  panel.webview.html = getRefactorDetailsHtml(response);
}

/**
 * Get refactor details HTML
 */
function getRefactorDetailsHtml(response: {
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
      line-height: 1.6;
    }
    h1, h2 { margin-top: 0; }
    .section { margin-bottom: 24px; }
    .warning { color: var(--vscode-editorWarning-foreground); margin: 8px 0; padding: 8px; background: var(--vscode-editorWarning-background); border-radius: 3px; }
    .change-item { margin: 12px 0; padding: 12px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Refactoring Details</h1>
  <div class="section">
    <h2>Explanation</h2>
    <p>${escapeHtml(response.explanation)}</p>
  </div>
  ${response.warnings && response.warnings.length > 0 ? `
  <div class="section">
    <h2>Warnings</h2>
    ${response.warnings.map(w => `<div class="warning">⚠️ ${escapeHtml(w)}</div>`).join('')}
  </div>
  ` : ''}
  <div class="section">
    <h2>Changes Applied</h2>
    <p>${response.changes.length} change(s) applied to your code.</p>
    ${response.changes.map((change: any) => `
      <div class="change-item">
        <strong>${change.description || 'Change'}</strong>
        <pre><code>${escapeHtml(JSON.stringify(change, null, 2))}</code></pre>
      </div>
    `).join('')}
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
