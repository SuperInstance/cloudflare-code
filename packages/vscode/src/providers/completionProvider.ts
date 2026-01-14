/**
 * Code completion provider
 */

import * as vscode from 'vscode';
import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  CancellationToken,
  CompletionContext
} from 'vscode';

import { ApiClient } from '../services/apiClient';
import { ClaudeFlareConfig, CompletionRequest } from '../types';
import { TelemetryService } from '../services/telemetry';
import { ProjectContextManager } from '../services/projectContext';
import { Logger } from '../utils/logger';

export class CompletionProvider implements vscode.CompletionItemProvider {
  private logger: Logger;
  private debounceTimer: NodeJS.Timeout | undefined;
  private pendingRequests: Map<string, CancellationTokenSource> = new Map();

  constructor(
    private apiClient: ApiClient,
    private config: ClaudeFlareConfig,
    private telemetry: TelemetryService,
    private projectContext: ProjectContextManager
  ) {
    this.logger = new Logger('CompletionProvider');
  }

  /**
   * Provide completions
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: CancellationToken,
    context: CompletionContext
  ): Promise<CompletionItem[] | CompletionList | undefined> {
    if (!this.config.enableCompletion) {
      return undefined;
    }

    const startTime = Date.now();

    try {
      // Cancel any pending request for this document
      const requestKey = `${document.uri.toString()}:${position.line}:${position.character}`;
      const existingCancellation = this.pendingRequests.get(requestKey);
      if (existingCancellation) {
        existingCancellation.cancel();
      }

      // Create new cancellation token
      const cancellationSource = new vscode.CancellationTokenSource();
      this.pendingRequests.set(requestKey, cancellationSource);

      // Debounce the request
      const completions = await this.debouncedCompletion(
        document,
        position,
        token,
        context
      );

      // Clean up
      this.pendingRequests.delete(requestKey);

      // Track telemetry
      const responseTime = Date.now() - startTime;
      await this.telemetry.trackCompletion({
        language: document.languageId,
        fileLength: document.getText().length,
        responseTime,
        success: !!completions
      });

      return completions;
    } catch (error) {
      this.logger.error('Completion failed', error);
      await this.telemetry.trackError(error as Error, {
        document: document.uri.toString(),
        position
      });
      return undefined;
    }
  }

  /**
   * Debounced completion
   */
  private debouncedCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: CancellationToken,
    context: CompletionContext
  ): Promise<CompletionItem[] | CompletionList | undefined> {
    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        const completions = await this.getCompletions(document, position, token, context);
        resolve(completions);
      }, this.config.completionDebounce);
    });
  }

  /**
   * Get completions from API
   */
  private async getCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: CancellationToken,
    context: CompletionContext
  ): Promise<CompletionItem[] | undefined> {
    // Extract context
    const text = document.getText();
    const offset = document.offsetAt(position);
    const prefix = text.substring(0, offset);
    const suffix = text.substring(offset);

    // Check if we should provide completion
    if (!this.shouldProvideCompletion(prefix, context)) {
      return undefined;
    }

    // Build request
    const request: CompletionRequest = {
      document,
      position: { line: position.line, character: position.character },
      context: {
        prefix,
        suffix,
        language: document.languageId,
        filePath: document.uri.fsPath,
        projectContext: this.projectContext.getContextForFile(document.uri.fsPath)
      },
      token
    };

    try {
      const response = await this.apiClient.getCompletion(request);

      if (!response.items || response.items.length === 0) {
        return undefined;
      }

      // Convert to VS Code completion items
      const items = response.items.map(item => {
        const completionItem = new CompletionItem(
          item.label || 'Suggestion',
          this.mapCompletionKind(item.kind)
        );

        completionItem.insertText = item.insertText;
        completionItem.detail = item.detail;
        completionItem.documentation = item.documentation;
        completionItem.sortText = item.sortText || '0';
        completionItem.filterText = item.filterText;
        completionItem.preselect = item.preselect;
        completionItem.commitCharacters = item.commitCharacters;

        // Add additional edit if available
        if (item.additionalTextEdits) {
          completionItem.additionalTextEdits = item.additionalTextEdits;
        }

        return completionItem;
      });

      return items;
    } catch (error) {
      if (token.isCancellationRequested) {
        this.logger.debug('Completion request cancelled');
        return undefined;
      }

      throw error;
    }
  }

  /**
   * Check if completion should be provided
   */
  private shouldProvideCompletion(prefix: string, context: CompletionContext): boolean {
    // Don't provide completion if just whitespace
    if (prefix.trim().length === 0 && context.triggerKind === vscode.CompletionTriggerKind.Invoke) {
      return false;
    }

    // Don't provide completion in comments or strings
    const lastChar = prefix.slice(-1);
    if (lastChar === '\n' || lastChar === '\r') {
      return false;
    }

    return true;
  }

  /**
   * Map completion kind
   */
  private mapCompletionKind(kind?: CompletionItemKind): CompletionItemKind {
    if (kind !== undefined) {
      return kind;
    }

    return CompletionItemKind.Text;
  }

  /**
   * Resolve completion item
   */
  async resolveCompletionItem?(
    item: CompletionItem,
    token: CancellationToken
  ): Promise<CompletionItem> {
    // Additional resolution if needed
    return item;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    for (const source of this.pendingRequests.values()) {
      source.cancel();
      source.dispose();
    }

    this.pendingRequests.clear();
  }
}
