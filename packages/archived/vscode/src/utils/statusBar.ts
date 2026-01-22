/**
 * Status bar management
 */

import * as vscode from 'vscode';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'claudeflare.openChat';
    this.statusBarItem.show();
  }

  /**
   * Update status bar text
   */
  update(text: string, tooltip?: string): void {
    this.statusBarItem.text = text;
    if (tooltip) {
      this.statusBarItem.tooltip = tooltip;
    }
  }

  /**
   * Set loading state
   */
  setLoading(message: string): void {
    this.statusBarItem.text = `$(loading~spin) ${message}`;
    this.statusBarItem.tooltip = 'ClaudeFlare is working...';
  }

  /**
   * Set error state
   */
  setError(message: string): void {
    this.statusBarItem.text = `$(error) ClaudeFlare`;
    this.statusBarItem.tooltip = message;
  }

  /**
   * Set success state
   */
  setSuccess(message: string): void {
    this.statusBarItem.text = `$(check) ${message}`;
    this.statusBarItem.tooltip = message;
  }

  /**
   * Set ready state
   */
  setReady(): void {
    this.statusBarItem.text = `$(comment-discussion) ClaudeFlare`;
    this.statusBarItem.tooltip = 'Open ClaudeFlare Chat';
  }

  /**
   * Dispose of status bar
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
