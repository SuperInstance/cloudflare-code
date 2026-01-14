/**
 * Chat-related commands
 */

import * as vscode from 'vscode';
import { ExtensionContext, Uri, Range } from 'vscode';

import { ExtensionState } from '../extension';
import { Logger } from '../utils/logger';

export function registerChatCommands(context: ExtensionContext, state: ExtensionState): void {
  const logger = new Logger('ChatCommands');

  // Open chat
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.openChat', async () => {
      logger.info('Opening chat');
      await vscode.commands.executeCommand('claudeflare.chatView.focus');

      await state.telemetry.trackCommand('claudeflare.openChat');
    })
  );

  // Inline chat
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.chatInline', async (uri?: Uri, range?: Range) => {
      logger.info('Opening inline chat');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = range || editor.selection;
      const selectedText = editor.document.getText(selection);

      // Show input box for user question
      const question = await vscode.window.showInputBox({
        prompt: 'Ask ClaudeFlare about your selection',
        placeHolder: 'What would you like to know?'
      });

      if (!question) {
        return;
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Thinking...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            let response = '';

            await state.apiClient.streamChatMessage(
              'inline-chat',
              `${question}\n\nSelected code:\n\`\`\`\n${selectedText}\n\`\`\``,
              [],
              { selection: selectedText, filePath: editor.document.uri.fsPath },
              (chunk, done) => {
                if (done) {
                  return;
                }
                response += chunk;
              }
            );

            // Show response in new document
            const doc = await vscode.workspace.openTextDocument({
              content: response,
              language: 'markdown'
            });
            await vscode.window.showTextDocument(doc, { preview: false });

            await state.telemetry.trackChatMessage({
              messageLength: question.length,
              hasContext: true,
              hasSelection: !!selectedText
            });
          } catch (error) {
            logger.error('Inline chat failed', error);
            vscode.window.showErrorMessage(
              `ClaudeFlare: ${error instanceof Error ? error.message : 'Failed to get response'}`
            );
          }
        }
      );
    })
  );

  // Clear history
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.clearHistory', async () => {
      logger.info('Clearing chat history');

      const confirmed = await vscode.window.showWarningMessage(
        'Are you sure you want to clear all chat history?',
        'Yes',
        'No'
      );

      if (confirmed === 'Yes') {
        // Clear sessions in chat webview
        await state.context.globalState.update('claudeflare.chatSessions', []);
        vscode.window.showInformationMessage('Chat history cleared');

        await state.telemetry.trackCommand('claudeflare.clearHistory');
      }
    })
  );

  // Ask about code
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.askAboutCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      if (!selectedText) {
        vscode.window.showInformationMessage('Please select some code first');
        return;
      }

      const question = await vscode.window.showInputBox({
        prompt: 'What would you like to know about this code?'
      });

      if (!question) {
        return;
      }

      // Open chat and send message
      await vscode.commands.executeCommand('claudeflare.openChat');

      // Send message to chat (would be handled via webview message)
      logger.info('Question:', question);
    })
  );

  // Explain file
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.explainFile', async (uri?: Uri) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const document = editor.document;
      const fileContent = document.getText();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Analyzing file...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            const response = await state.apiClient.explainCode({
              code: fileContent,
              language: document.languageId,
              filePath: document.uri.fsPath,
              detail: 'high'
            });

            // Show explanation in new document
            const explanationDoc = await vscode.workspace.openTextDocument({
              content: formatExplanation(response),
              language: 'markdown'
            });
            await vscode.window.showTextDocument(explanationDoc, { preview: false });

            await state.telemetry.trackFeatureUsage('file_explanation', {
              language: document.languageId
            });
          } catch (error) {
            logger.error('File explanation failed', error);
            vscode.window.showErrorMessage(
              `Failed to explain file: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );
}

/**
 * Format explanation as markdown
 */
function formatExplanation(response: {
  explanation: string;
  summary: string;
  concepts: string[];
  complexity?: string;
  suggestions?: string[];
}): string {
  let markdown = `# Code Explanation\n\n`;

  if (response.summary) {
    markdown += `## Summary\n\n${response.summary}\n\n`;
  }

  markdown += `## Detailed Explanation\n\n${response.explanation}\n\n`;

  if (response.complexity) {
    markdown += `## Complexity\n\n${response.complexity}\n\n`;
  }

  if (response.concepts && response.concepts.length > 0) {
    markdown += `## Concepts\n\n`;
    response.concepts.forEach(concept => {
      markdown += `- ${concept}\n`;
    });
    markdown += `\n`;
  }

  if (response.suggestions && response.suggestions.length > 0) {
    markdown += `## Suggestions\n\n`;
    response.suggestions.forEach((suggestion, i) => {
      markdown += `${i + 1}. ${suggestion}\n`;
    });
  }

  return markdown;
}
