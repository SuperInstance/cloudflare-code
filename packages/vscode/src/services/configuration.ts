/**
 * Configuration management for ClaudeFlare
 */

import * as vscode from 'vscode';
import { ClaudeFlareConfig } from '../types';

export class ConfigurationManager {
  private configChangeListener?: vscode.Disposable;

  /**
   * Get current configuration
   */
  getConfiguration(): ClaudeFlareConfig {
    const config = vscode.workspace.getConfiguration('claudeflare');

    return {
      apiEndpoint: config.get<string>('apiEndpoint', 'https://api.claudeflare.dev'),
      apiKey: config.get<string>('apiKey', ''),
      model: config.get<string>('model', 'claude-opus-4-5'),
      temperature: config.get<number>('temperature', 0.7),
      maxTokens: config.get<number>('maxTokens', 4096),
      enableCompletion: config.get<boolean>('enableCompletion', true),
      enableInlineChat: config.get<boolean>('enableInlineChat', true),
      enableCodeActions: config.get<boolean>('enableCodeActions', true),
      completionDebounce: config.get<number>('completionDebounce', 150),
      contextWindow: config.get<number>('contextWindow', 200000),
      projectContextDepth: config.get<number>('projectContextDepth', 3),
      enableMultiAgent: config.get<boolean>('enableMultiAgent', true),
      enableTelemetry: config.get<boolean>('enableTelemetry', true),
      autoReview: config.get<boolean>('autoReview', false),
      theme: config.get<'auto' | 'light' | 'dark'>('theme', 'auto'),
      streamResponses: config.get<boolean>('streamResponses', true),
      showInlineAnnotations: config.get<boolean>('showInlineAnnotations', true),
      excludePatterns: config.get<string[]>('excludePatterns', [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**'
      ]),
      agentTimeout: config.get<number>('agentTimeout', 30000)
    };
  }

  /**
   * Update a configuration value
   */
  async updateConfiguration<T>(key: string, value: T, global?: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('claudeflare');
    await config.update(key, value, global);
  }

  /**
   * Get API endpoint
   */
  getApiEndpoint(): string {
    return this.getConfiguration().apiEndpoint;
  }

  /**
   * Get API key
   */
  getApiKey(): string {
    return this.getConfiguration().apiKey;
  }

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    const config = this.getConfiguration();
    return !!config.apiKey;
  }

  /**
   * Get model
   */
  getModel(): string {
    return this.getConfiguration().model;
  }

  /**
   * Check if completion is enabled
   */
  isCompletionEnabled(): boolean {
    return this.getConfiguration().enableCompletion;
  }

  /**
   * Check if inline chat is enabled
   */
  isInlineChatEnabled(): boolean {
    return this.getConfiguration().enableInlineChat;
  }

  /**
   * Check if code actions are enabled
   */
  areCodeActionsEnabled(): boolean {
    return this.getConfiguration().enableCodeActions;
  }

  /**
   * Check if telemetry is enabled
   */
  isTelemetryEnabled(): boolean {
    return this.getConfiguration().enableTelemetry;
  }

  /**
   * Check if multi-agent is enabled
   */
  isMultiAgentEnabled(): boolean {
    return this.getConfiguration().enableMultiAgent;
  }

  /**
   * Watch for configuration changes
   */
  onConfigurationChanged(callback: (config: ClaudeFlareConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('claudeflare')) {
        callback(this.getConfiguration());
      }
    });
  }

  /**
   * Validate configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const config = this.getConfiguration();
    const errors: string[] = [];

    if (!config.apiEndpoint) {
      errors.push('API endpoint is not configured');
    } else {
      try {
        new URL(config.apiEndpoint);
      } catch {
        errors.push('API endpoint is not a valid URL');
      }
    }

    if (!config.apiKey) {
      errors.push('API key is not configured');
    }

    if (config.temperature < 0 || config.temperature > 1) {
      errors.push('Temperature must be between 0 and 1');
    }

    if (config.maxTokens < 1 || config.maxTokens > 8192) {
      errors.push('Max tokens must be between 1 and 8192');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Prompt for API key
   */
  async promptForApiKey(): Promise<string | undefined> {
    const result = await vscode.window.showInputBox({
      prompt: 'Enter your ClaudeFlare API key',
      password: true,
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return 'API key cannot be empty';
        }
        return null;
      }
    });

    if (result) {
      await this.updateConfiguration('apiKey', result, true);
    }

    return result;
  }

  /**
   * Get configuration for specific language
   */
  getLanguageConfiguration(language: string): Partial<ClaudeFlareConfig> {
    const config = this.getConfiguration();
    const languageConfig = vscode.workspace.getConfiguration(`claudeflare.languages.${language}`);

    return {
      ...config,
      ...languageConfig
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.configChangeListener) {
      this.configChangeListener.dispose();
    }
  }
}
