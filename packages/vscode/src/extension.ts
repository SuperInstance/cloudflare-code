/**
 * ClaudeFlare VS Code Extension
 * Main extension entry point and activation logic
 */

import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';

import { ClaudeFlareConfig } from './types';
import { ConfigurationManager } from './services/configuration';
import { ApiClient } from './services/apiClient';
import { TelemetryService } from './services/telemetry';
import { ProjectContextManager } from './services/projectContext';
import { StatusBarManager } from './utils/statusBar';
import { Logger } from './utils/logger';

// Providers
import { CompletionProvider } from './providers/completionProvider';
import { InlineCompletionProvider } from './providers/inlineCompletionProvider';
import { HoverProvider } from './providers/hoverProvider';
import { CodeActionProvider } from './providers/codeActionProvider';
import { DiagnosticsProvider } from './providers/diagnosticsProvider';

// Views
import { ChatWebviewProvider } from './views/chatWebview';
import { AgentsViewProvider } from './views/agentsView';
import { ContextViewProvider } from './views/contextView';
import { HistoryViewProvider } from './views/historyView';

// Commands
import {
  registerChatCommands,
  registerCodeCommands,
  registerRefactorCommands,
  registerTestCommands,
  registerConfigCommands,
  registerDebugCommands,
  registerAgentCommands
} from './commands';

/**
 * Global extension state
 */
interface ExtensionState {
  config: ClaudeFlareConfig;
  apiClient: ApiClient;
  telemetry: TelemetryService;
  projectContext: ProjectContextManager;
  statusBar: StatusBarManager;
  chatWebview: ChatWebviewProvider;
  agentsView: AgentsViewProvider;
  contextView: ContextViewProvider;
  historyView: HistoryViewProvider;
}

let extensionState: ExtensionState | undefined;

/**
 * Activate the extension
 */
export async function activate(context: ExtensionContext): Promise<void> {
  const logger = new Logger('ClaudeFlare');
  logger.info('Activating ClaudeFlare extension...');

  try {
    // Initialize configuration
    const configManager = new ConfigurationManager();
    const config = configManager.getConfiguration();

    // Initialize services
    const apiClient = new ApiClient(config);
    const telemetry = new TelemetryService(config, context);
    const projectContext = new ProjectContextManager(context);

    // Initialize UI components
    const statusBar = new StatusBarManager();
    const chatWebview = new ChatWebviewProvider(context, apiClient, telemetry);
    const agentsView = new AgentsViewProvider(context, apiClient);
    const contextView = new ContextViewProvider(context, projectContext);
    const historyView = new HistoryViewProvider(context, telemetry);

    // Store extension state
    extensionState = {
      config,
      apiClient,
      telemetry,
      projectContext,
      statusBar,
      chatWebview,
      agentsView,
      contextView,
      historyView
    };

    // Register language feature providers
    registerLanguageProviders(context, extensionState);

    // Register view providers
    registerViewProviders(context, extensionState);

    // Register all commands
    registerAllCommands(context, extensionState);

    // Initialize project context
    await projectContext.initialize();

    // Update status bar
    statusBar.update('ClaudeFlare: Ready');

    // Log activation
    logger.info('ClaudeFlare extension activated successfully');
    telemetry.trackEvent('extension_activated', {
      version: context.extension.packageJSON.version,
      vscodeVersion: vscode.version
    });

    // Show welcome message on first activation
    const isFirstActivation = context.globalState.get<boolean>('isFirstActivation', true);
    if (isFirstActivation) {
      await showWelcomeMessage(context);
      await context.globalState.update('isFirstActivation', false);
    }

  } catch (error) {
    const logger = new Logger('ClaudeFlare');
    logger.error('Failed to activate extension', error);
    vscode.window.showErrorMessage(
      `ClaudeFlare activation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Register language feature providers
 */
function registerLanguageProviders(
  context: ExtensionContext,
  state: ExtensionState
): void {
  const { config, apiClient, telemetry, projectContext } = state;

  // Completion provider
  const completionProvider = new CompletionProvider(apiClient, config, telemetry, projectContext);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'typescriptreact', 'javascriptreact'],
      completionProvider,
      '.', ' ', '<', '(', '[', '{', '"', "'", '`'
    )
  );

  // Inline completion provider
  const inlineCompletionProvider = new InlineCompletionProvider(apiClient, config, telemetry, projectContext);
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'typescriptreact', 'javascriptreact'],
      inlineCompletionProvider
    )
  );

  // Hover provider
  const hoverProvider = new HoverProvider(apiClient, config, telemetry);
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      ['typescript', 'javascript', 'python', 'go', 'rust', 'java'],
      hoverProvider
    )
  );

  // Code action provider
  const codeActionProvider = new CodeActionProvider(apiClient, config, telemetry, projectContext);
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      ['typescript', 'javascript', 'python', 'go', 'rust', 'java'],
      codeActionProvider,
      {
        providedCodeActionKinds: [
          vscode.CodeActionKind.QuickFix,
          vscode.CodeActionKind.Refactor,
          vscode.CodeActionKind.Source
        ]
      }
    )
  );

  // Diagnostics provider
  const diagnosticsProvider = new DiagnosticsProvider(apiClient, config, telemetry);
  context.subscriptions.push(
    vscode.languages.registerDiagnosticProvider(
      ['typescript', 'javascript', 'python', 'go', 'rust'],
      diagnosticsProvider
    )
  );
}

/**
 * Register view providers
 */
function registerViewProviders(
  context: ExtensionContext,
  state: ExtensionState
): void {
  const { chatWebview, agentsView, contextView, historyView } = state;

  // Chat webview
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('claudeflare.chatView', chatWebview)
  );

  // Agents view
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('claudeflare.agentsView', agentsView)
  );

  // Context view
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('claudeflare.contextView', contextView)
  );

  // History view
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('claudeflare.historyView', historyView)
  );
}

/**
 * Register all commands
 */
function registerAllCommands(
  context: ExtensionContext,
  state: ExtensionState
): void {
  registerChatCommands(context, state);
  registerCodeCommands(context, state);
  registerRefactorCommands(context, state);
  registerTestCommands(context, state);
  registerConfigCommands(context, state);
  registerDebugCommands(context, state);
  registerAgentCommands(context, state);

  // Register additional utility commands
  registerUtilityCommands(context, state);
}

/**
 * Register utility commands
 */
function registerUtilityCommands(
  context: ExtensionContext,
  state: ExtensionState
): void {
  // Accept suggestion
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.acceptSuggestion', () => {
      vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
    })
  );

  // Dismiss suggestion
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.dismissSuggestion', () => {
      vscode.commands.executeCommand('editor.action.inlineSuggest.hide');
    })
  );

  // Open settings
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'claudeflare');
    })
  );
}

/**
 * Show welcome message
 */
async function showWelcomeMessage(context: ExtensionContext): Promise<void> {
  const result = await vscode.window.showInformationMessage(
    'Welcome to ClaudeFlare! Your AI-powered coding assistant is ready.',
    'Open Chat',
    'Configure',
    'Learn More'
  );

  switch (result) {
    case 'Open Chat':
      vscode.commands.executeCommand('claudeflare.openChat');
      break;
    case 'Configure':
      vscode.commands.executeCommand('claudeflare.configure');
      break;
    case 'Learn More':
      vscode.env.openExternal(vscode.Uri.parse('https://github.com/claudeflare/claudeflare'));
      break;
  }
}

/**
 * Deactivate the extension
 */
export async function deactivate(): Promise<void> {
  const logger = new Logger('ClaudeFlare');
  logger.info('Deactivating ClaudeFlare extension...');

  if (extensionState) {
    // Dispose of resources
    extensionState.apiClient.dispose();
    extensionState.telemetry.dispose();
    extensionState.projectContext.dispose();
    extensionState.statusBar.dispose();
  }

  logger.info('ClaudeFlare extension deactivated');
}

/**
 * Get extension state (for testing)
 */
export function getExtensionState(): ExtensionState | undefined {
  return extensionState;
}
