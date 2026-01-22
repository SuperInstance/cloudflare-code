/**
 * Debugging assistance commands
 */

import * as vscode from 'vscode';
import { ExtensionContext, Uri, Range } from 'vscode';

import { ExtensionState } from '../extension';
import { Logger } from '../utils/logger';

export function registerDebugCommands(context: ExtensionContext, state: ExtensionState): void {
  const logger = new Logger('DebugCommands');

  // Debug issue
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.debugIssue', async (uri?: Uri, range?: Range) => {
      logger.info('Starting debug assistance');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      // Get issue description
      const issueDescription = await vscode.window.showInputBox({
        prompt: 'Describe the issue or error you are experiencing',
        placeHolder: 'e.g., Function returns null when input is empty string'
      });

      if (!issueDescription) {
        return;
      }

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      // Collect context
      const context = {
        issue: issueDescription,
        code: selectedCode,
        filePath: editor.document.uri.fsPath,
        language: editor.document.languageId,
        diagnostics: vscode.languages.getDiagnostics(editor.document.uri)
      };

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Analyzing issue...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            let debugResponse = '';

            const prompt = formatDebugPrompt(context);

            await state.apiClient.streamChatMessage(
              'debug-session',
              prompt,
              [],
              context,
              (chunk, done) => {
                if (done) return;
                debugResponse += chunk;
              }
            );

            // Show debug assistance in new document
            const doc = await vscode.workspace.openTextDocument({
              content: formatDebugResponse(debugResponse, context),
              language: 'markdown'
            });
            await vscode.window.showTextDocument(doc, { preview: false });

            await state.telemetry.trackFeatureUsage('debug_assistance', {
              language: editor.document.languageId
            });
          } catch (error) {
            logger.error('Debug assistance failed', error);
            vscode.window.showErrorMessage(
              `Failed to analyze issue: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );

  // Analyze error
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.analyzeError', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      // Get diagnostics for the current document
      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);

      if (diagnostics.length === 0) {
        vscode.window.showInformationMessage('No errors detected in current file');
        return;
      }

      // Show diagnostics picker
      const selected = await vscode.window.showQuickPick(
        diagnostics.map(d => ({
          label: d.message,
          description: `Line ${d.range.start.line + 1}`,
          detail: d.source,
          diagnostic: d
        })),
        { placeHolder: 'Select an error to analyze' }
      );

      if (!selected) {
        return;
      }

      // Get code around the error
      const errorRange = selected.diagnostic.range;
      const startLine = Math.max(0, errorRange.start.line - 5);
      const endLine = Math.min(editor.document.lineCount - 1, errorRange.end.line + 5);
      const code = editor.document.getText(
        new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length)
      );

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Analyzing error...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            const prompt = `Analyze this error and provide a fix:\n\nError: ${selected.label}\n\nCode:\n\`\`\`\n${code}\n\`\`\`\n\nLanguage: ${editor.document.languageId}`;

            let response = '';
            await state.apiClient.streamChatMessage(
              'error-analysis',
              prompt,
              [],
              { language: editor.document.languageId },
              (chunk, done) => {
                if (done) return;
                response += chunk;
              }
            );

            // Show response
            const doc = await vscode.workspace.openTextDocument({
              content: `# Error Analysis\n\n**Error:** ${selected.label}\n\n**Location:** Line ${errorRange.start.line + 1}\n\n## Analysis\n\n${response}`,
              language: 'markdown'
            });
            await vscode.window.showTextDocument(doc, { preview: false });
          } catch (error) {
            logger.error('Error analysis failed', error);
            vscode.window.showErrorMessage(
              `Failed to analyze error: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );

  // Get stack trace help
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.analyzeStackTrace', async () => {
      // Get stack trace from clipboard
      const clipboardText = await vscode.env.clipboard.readText();

      if (!clipboardText || !clipboardText.includes('Error:') && !clipboardText.includes('at ')) {
        vscode.window.showInformationMessage(
          'Please copy a stack trace to your clipboard first'
        );
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Analyzing stack trace...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            const prompt = `Analyze this stack trace and explain the issue:\n\n\`\`\`\n${clipboardText}\n\`\`\``;

            let response = '';
            await state.apiClient.streamChatMessage(
              'stacktrace-analysis',
              prompt,
              [],
              {},
              (chunk, done) => {
                if (done) return;
                response += chunk;
              }
            );

            // Show response
            const doc = await vscode.workspace.openTextDocument({
              content: `# Stack Trace Analysis\n\n## Stack Trace\n\`\`\`\n${clipboardText}\n\`\`\`\n\n## Analysis\n\n${response}`,
              language: 'markdown'
            });
            await vscode.window.showTextDocument(doc, { preview: false });
          } catch (error) {
            logger.error('Stack trace analysis failed', error);
            vscode.window.showErrorMessage(
              `Failed to analyze stack trace: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );
}

/**
 * Format debug prompt
 */
function formatDebugPrompt(context: {
  issue: string;
  code: string;
  filePath: string;
  language: string;
  diagnostics: vscode.Diagnostic[];
}): string {
  let prompt = `Debug this issue:\n\n**Issue:** ${context.issue}\n\n`;

  if (context.code) {
    prompt += `**Code:**\n\`\`\`\n${context.code}\n\`\`\`\n\n`;
  }

  prompt += `**Language:** ${context.language}\n`;
  prompt += `**File:** ${context.filePath}\n`;

  if (context.diagnostics.length > 0) {
    prompt += `\n**Diagnostics:**\n`;
    context.diagnostics.slice(0, 5).forEach(d => {
      prompt += `- Line ${d.range.start.line + 1}: ${d.message}\n`;
    });
  }

  prompt += `\nPlease analyze this issue and provide:\n1. Root cause analysis\n2. Specific fix recommendations\n3. Code examples showing the fix\n4. Prevention strategies`;

  return prompt;
}

/**
 * Format debug response
 */
function formatDebugResponse(response: string, context: any): string {
  return `# Debug Assistance\n\n**Issue:** ${context.issue}\n\n**File:** ${context.filePath}\n\n## Analysis\n\n${response}`;
}
