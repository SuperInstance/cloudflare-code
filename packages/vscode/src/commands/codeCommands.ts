/**
 * Code manipulation commands
 */

import * as vscode from 'vscode';
import { ExtensionContext, Uri, Range } from 'vscode';

import { ExtensionState } from '../extension';
import { CodeExplanationRequest } from '../types';
import { Logger } from '../utils/logger';

export function registerCodeCommands(context: ExtensionContext, state: ExtensionState): void {
  const logger = new Logger('CodeCommands');

  // Explain code
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.explainCode', async (uri?: Uri, range?: Range) => {
      logger.info('Explaining code');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select some code to explain');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Explaining code...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            const request: CodeExplanationRequest = {
              code: selectedCode,
              language: editor.document.languageId,
              filePath: editor.document.uri.fsPath,
              range: selection,
              detail: 'high'
            };

            const response = await state.apiClient.explainCode(request);

            // Show explanation in webview or new document
            const doc = await vscode.workspace.openTextDocument({
              content: formatCodeExplanation(response, selectedCode),
              language: 'markdown'
            });
            await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });

            await state.telemetry.trackFeatureUsage('code_explanation', {
              language: editor.document.languageId,
              selectionLength: selectedCode.length
            });
          } catch (error) {
            logger.error('Code explanation failed', error);
            vscode.window.showErrorMessage(
              `Failed to explain code: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );

  // Generate code
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.generateCode', async () => {
      logger.info('Generating code');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      // Get prompt from user
      const prompt = await vscode.window.showInputBox({
        prompt: 'Describe the code you want to generate',
        placeHolder: 'e.g., Create a function that validates email addresses'
      });

      if (!prompt) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Generating code...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            let generatedCode = '';

            // Stream the code generation
            await state.apiClient.streamChatMessage(
              'code-generation',
              `Generate code for: ${prompt}\n\nLanguage: ${editor.document.languageId}`,
              [],
              { language: editor.document.languageId },
              (chunk, done) => {
                if (done) return;
                generatedCode += chunk;
              }
            );

            // Insert generated code at cursor position
            const position = editor.selection.active;
            await editor.edit(editBuilder => {
              editBuilder.insert(position, generatedCode);
            });

            // Format the document
            await vscode.commands.executeCommand('editor.action.formatDocument');

            vscode.window.showInformationMessage('Code generated successfully!');

            await state.telemetry.trackFeatureUsage('code_generation', {
              language: editor.document.languageId,
              promptLength: prompt.length,
              generatedLength: generatedCode.length
            });
          } catch (error) {
            logger.error('Code generation failed', error);
            vscode.window.showErrorMessage(
              `Failed to generate code: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );

  // Fix code
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.fixCode', async (uri?: Uri, range?: Range) => {
      logger.info('Fixing code');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select the code you want to fix');
        return;
      }

      const problemDescription = await vscode.window.showInputBox({
        prompt: 'Describe the issue or error',
        placeHolder: 'e.g., The function throws an error when input is null'
      });

      if (!problemDescription) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Fixing code...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            let fixedCode = '';

            const prompt = `Fix this code:\n\`\`\`\n${selectedCode}\n\`\`\`\n\nIssue: ${problemDescription}\n\nLanguage: ${editor.document.languageId}`;

            await state.apiClient.streamChatMessage(
              'code-fix',
              prompt,
              [],
              { language: editor.document.languageId },
              (chunk, done) => {
                if (done) return;
                fixedCode += chunk;
              }
            );

            // Replace selected code with fixed version
            await editor.edit(editBuilder => {
              editBuilder.replace(selection, extractCodeFromResponse(fixedCode));
            });

            vscode.window.showInformationMessage('Code fixed successfully!');

            await state.telemetry.trackFeatureUsage('code_fix', {
              language: editor.document.languageId
            });
          } catch (error) {
            logger.error('Code fix failed', error);
            vscode.window.showErrorMessage(
              `Failed to fix code: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );

  // Optimize code
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.optimizeCode', async (uri?: Uri, range?: Range) => {
      logger.info('Optimizing code');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select the code you want to optimize');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Optimizing code...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            const response = await state.apiClient.refactorCode({
              code: selectedCode,
              language: editor.document.languageId,
              filePath: editor.document.uri.fsPath,
              range: selection,
              type: 'optimize'
            });

            // Replace selected code with optimized version
            await editor.edit(editBuilder => {
              editBuilder.replace(selection, response.code);
            });

            // Show explanation
            vscode.window.showInformationMessage(
              'Code optimized!',
              'View Details'
            ).then(selection => {
              if (selection === 'View Details') {
                showRefactorDetails(response);
              }
            });

            await state.telemetry.trackFeatureUsage('code_optimization', {
              language: editor.document.languageId
            });
          } catch (error) {
            logger.error('Code optimization failed', error);
            vscode.window.showErrorMessage(
              `Failed to optimize code: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );
}

/**
 * Format code explanation as markdown
 */
function formatCodeExplanation(
  response: { explanation: string; summary: string; concepts: string[]; complexity?: string },
  originalCode: string
): string {
  return `# Code Explanation

## Summary
${response.summary}

## Original Code
\`\`\`javascript
${originalCode}
\`\`\`

## Explanation
${response.explanation}

${response.complexity ? `## Complexity\n\n${response.complexity}\n\n` : ''}

## Key Concepts
${response.concepts.map(c => `- ${c}`).join('\n')}
`;
}

/**
 * Extract code from AI response
 */
function extractCodeFromResponse(response: string): string {
  // Extract code from markdown code blocks
  const codeBlockMatch = response.match(/```[\w]*\n([\s\S]+?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // If no code block found, return the response as-is
  return response.trim();
}

/**
 * Show refactor details in webview
 */
function showRefactorDetails(response: {
  explanation: string;
  changes: unknown[];
  warnings?: string[];
}): void {
  const panel = vscode.window.createWebviewPanel(
    'claudeflare.refactorDetails',
    'Optimization Details',
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
  <title>Optimization Details</title>
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
    .warning { color: var(--vscode-editorWarning-foreground); margin: 8px 0; }
    code { background-color: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Code Optimization</h1>
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
