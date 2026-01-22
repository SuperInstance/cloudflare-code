/**
 * Configuration commands
 */

import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';
import { window } from 'vscode';

import { ExtensionState } from '../extension';
import { ConfigurationManager } from '../services/configuration';
import { Logger } from '../utils/logger';

export function registerConfigCommands(context: ExtensionContext, state: ExtensionState): void {
  const logger = new Logger('ConfigCommands');

  // Configure extension
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.configure', async () => {
      logger.info('Opening configuration');

      const actions = [
        { title: 'Set API Key', action: 'apikey' },
        { title: 'Change Model', action: 'model' },
        { title: 'Adjust Settings', action: 'settings' },
        { title: 'Test Connection', action: 'test' }
      ];

      const selected = await vscode.window.showQuickPick(actions, {
        placeHolder: 'What would you like to configure?'
      });

      if (!selected) {
        return;
      }

      switch (selected.action) {
        case 'apikey':
          await setApiKey(state);
          break;
        case 'model':
          await selectModel(state);
          break;
        case 'settings':
          await vscode.commands.executeCommand('workbench.action.openSettings', 'claudeflare');
          break;
        case 'test':
          await testConnection(state);
          break;
      }
    })
  );

  // Authenticate
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.authenticate', async () => {
      await setApiKey(state);
    })
  );

  // Open settings
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'claudeflare');
    })
  );
}

/**
 * Set API key
 */
async function setApiKey(state: ExtensionState): Promise<void> {
  const configManager = new ConfigurationManager();

  const apiKey = await configManager.promptForApiKey();

  if (apiKey) {
    vscode.window.showInformationMessage('API key updated successfully!');
    state.apiClient.updateConfig(configManager.getConfiguration());
  }
}

/**
 * Select model
 */
async function selectModel(state: ExtensionState): Promise<void> {
  const models = [
    { label: 'Claude Opus 4.5', description: 'Most capable model for complex tasks', value: 'claude-opus-4-5' },
    { label: 'Claude Sonnet 4.5', description: 'Balanced model for most tasks', value: 'claude-sonnet-4-5' },
    { label: 'Claude Haiku 4.5', description: 'Fast model for simple tasks', value: 'claude-haiku-4-5' }
  ];

  const selected = await vscode.window.showQuickPick(models, {
    placeHolder: 'Select AI model'
  });

  if (selected) {
    const configManager = new ConfigurationManager();
    await configManager.updateConfiguration('model', selected.value, true);
    vscode.window.showInformationMessage(`Model changed to ${selected.label}`);
    state.apiClient.updateConfig(configManager.getConfiguration());
  }
}

/**
 * Test connection to API
 */
async function testConnection(state: ExtensionState): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Testing connection to ClaudeFlare API...',
      cancellable: false
    },
    async () => {
      const isHealthy = await state.apiClient.healthCheck();

      if (isHealthy) {
        vscode.window.showInformationMessage('Successfully connected to ClaudeFlare API!');
      } else {
        vscode.window.showErrorMessage(
          'Failed to connect to ClaudeFlare API. Please check your API key and network connection.'
        );
      }
    }
  );
}
