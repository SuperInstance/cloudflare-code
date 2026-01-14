/**
 * Test generation commands
 */

import * as vscode from 'vscode';
import { ExtensionContext, Uri, Range } from 'vscode';

import { ExtensionState } from '../extension';
import { TestGenerationRequest, DocumentationRequest } from '../types';
import { Logger } from '../utils/logger';

export function registerTestCommands(context: ExtensionContext, state: ExtensionState): void {
  const logger = new Logger('TestCommands');

  // Generate tests
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.addTests', async (uri?: Uri, range?: Range) => {
      logger.info('Generating tests');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select the code to generate tests for');
        return;
      }

      // Select test framework
      const framework = await vscode.window.showQuickPick(
        getTestFrameworks(editor.document.languageId),
        { placeHolder: 'Select test framework' }
      );

      if (!framework) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Generating tests...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            const request: TestGenerationRequest = {
              code: selectedCode,
              language: editor.document.languageId,
              filePath: editor.document.uri.fsPath,
              framework: framework,
              coverageTarget: 80
            };

            const response = await state.apiClient.generateTests(request);

            // Create test file
            const testFilePath = getTestFilePath(editor.document.uri.fsPath);
            const testUri = vscode.Uri.file(testFilePath);

            // Check if test file exists
            try {
              await vscode.workspace.fs.stat(testUri);
              // File exists, append to it
              const existingContent = await vscode.workspace.fs.readFile(testUri);
              const decoder = new TextDecoder();
              const content = decoder.decode(existingContent) + '\n\n' + response.tests;
              await vscode.workspace.fs.writeFile(testUri, new TextEncoder().encode(content));
            } catch {
              // File doesn't exist, create new
              await vscode.workspace.fs.writeFile(testUri, new TextEncoder().encode(response.tests));
            }

            // Open test file
            const doc = await vscode.workspace.openTextDocument(testUri);
            await vscode.window.showTextDocument(doc, { preview: false });

            vscode.window.showInformationMessage(
              `Tests generated for ${framework}!`,
              'Run Tests'
            ).then(selection => {
              if (selection === 'Run Tests') {
                runTests(editor.document.languageId);
              }
            });

            // Track telemetry
            state.telemetry.trackTestGeneration({
              language: editor.document.languageId,
              framework,
              testCount: response.tests.split('describe').length - 1 || response.tests.split('test').length - 1
            });
          } catch (error) {
            logger.error('Test generation failed', error);
            vscode.window.showErrorMessage(
              `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );

  // Generate documentation
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.addDocumentation', async (uri?: Uri, range?: Range) => {
      logger.info('Generating documentation');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = range || editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode) {
        vscode.window.showInformationMessage('Please select the code to document');
        return;
      }

      // Select documentation format
      const format = await vscode.window.showQuickPick(
        getDocumentationFormats(editor.document.languageId),
        { placeHolder: 'Select documentation format' }
      );

      if (!format) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Generating documentation...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            const request: DocumentationRequest = {
              code: selectedCode,
              language: editor.document.languageId,
              filePath: editor.document.uri.fsPath,
              format: format as any,
              includeExamples: true
            };

            const response = await state.apiClient.generateDocumentation(request);

            // Insert documentation before selection
            const docStart = selection.start;
            await editor.edit(editBuilder => {
              editBuilder.insert(docStart, response.documentation + '\n');
            });

            vscode.window.showInformationMessage('Documentation generated successfully!');

            // Track telemetry
            state.telemetry.trackDocumentation({
              language: editor.document.languageId,
              format,
              symbolCount: selectedCode.split('\n').length
            });
          } catch (error) {
            logger.error('Documentation generation failed', error);
            vscode.window.showErrorMessage(
              `Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );

  // Run tests
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.runTests', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      await runTests(editor.document.languageId);
    })
  );
}

/**
 * Get test frameworks for language
 */
function getTestFrameworks(language: string): string[] {
  const frameworks: Record<string, string[]> = {
    javascript: ['Jest', 'Mocha', 'Vitest', 'Jasmine'],
    typescript: ['Jest', 'Mocha', 'Vitest', 'Jasmine'],
    python: ['pytest', 'unittest', 'nose2'],
    go: ['testing'],
    rust: ['cargo test'],
    java: ['JUnit', 'TestNG'],
    ruby: ['RSpec', 'Minitest']
  };

  return frameworks[language] || ['Standard'];
}

/**
 * Get documentation formats for language
 */
function getDocumentationFormats(language: string): string[] {
  const formats: Record<string, string[]> = {
    javascript: ['JSDoc', 'TSDoc'],
    typescript: ['TSDoc', 'JSDoc'],
    python: ['reStructuredText', 'Google Style', 'NumPy Style'],
    go: ['godoc'],
    rust: ['rustdoc'],
    java: ['Javadoc'],
    ruby: ['YARD'],
    php: ['PHPDoc']
  };

  return formats[language] || ['Standard'];
}

/**
 * Get test file path
 */
function getTestFilePath(sourcePath: string): string {
  const parsed = path.parse(sourcePath);

  // Common test file patterns
  const testPatterns = [
    `${parsed.dir}/${parsed.name}.test${parsed.ext}`,
    `${parsed.dir}/${parsed.name}.spec${parsed.ext}`,
    `${parsed.dir}/__tests__/${parsed.name}${parsed.ext}`,
    `${parsed.dir}/tests/${parsed.name}${parsed.ext}`,
    `${parsed.dir}/test/${parsed.name}${parsed.ext}`
  ];

  // Use the first pattern, in a real implementation you'd check which exists
  return testPatterns[0];
}

/**
 * Run tests for language
 */
async function runTests(language: string): Promise<void> {
  const logger = new Logger('TestRunner');

  const testCommands: Record<string, string> = {
    javascript: 'npm test',
    typescript: 'npm test',
    python: 'pytest',
    go: 'go test',
    rust: 'cargo test',
    java: 'mvn test'
  };

  const command = testCommands[language];

  if (!command) {
    vscode.window.showInformationMessage(`No test runner configured for ${language}`);
    return;
  }

  // Open integrated terminal and run tests
  const terminal = vscode.window.createTerminal('ClaudeFlare Tests');
  terminal.sendText(command);
  terminal.show();
}

// Import path utilities
const path = {
  parse: (p: string) => {
    const parts = p.split('/');
    const name = parts[parts.length - 1];
    const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
    const baseName = ext ? name.replace(ext, '') : name;
    return {
      dir: parts.slice(0, -1).join('/'),
      base: name,
      ext: ext,
      name: baseName
    };
  }
};
