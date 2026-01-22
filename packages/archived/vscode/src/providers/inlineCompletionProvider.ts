/**
 * Inline completion provider
 */

import * as vscode from 'vscode';
import {
  InlineCompletionItem,
  InlineCompletionList,
  CancellationToken,
  Position,
  Range
} from 'vscode';

import { ApiClient } from '../services/apiClient';
import { ClaudeFlareConfig, CompletionRequest } from '../types';
import { TelemetryService } from '../services/telemetry';
import { ProjectContextManager } from '../services/projectContext';
import { Logger } from '../utils/logger';
import { InlineDecorator } from '../utils/decorator';

export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private logger: Logger;
  private decorator: InlineDecorator;
  private debounceTimer: NodeJS.Timeout | undefined;
  private currentCompletion: string | undefined;

  constructor(
    private apiClient: ApiClient,
    private config: ClaudeFlareConfig,
    private telemetry: TelemetryService,
    private projectContext: ProjectContextManager
  ) {
    this.logger = new Logger('InlineCompletionProvider');
    this.decorator = new InlineDecorator();
  }

  /**
   * Provide inline completions
   */
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: Position,
    context: vscode.InlineCompletionContext,
    token: CancellationToken
  ): Promise<InlineCompletionItem[] | InlineCompletionList | undefined> {
    if (!this.config.enableCompletion) {
      return undefined;
    }

    const startTime = Date.now();

    try {
      // Debounce the request
      const completion = await this.debouncedInlineCompletion(
        document,
        position,
        context,
        token
      );

      if (!completion) {
        this.currentCompletion = undefined;
        return undefined;
      }

      this.currentCompletion = completion;

      // Track telemetry
      const responseTime = Date.now() - startTime;
      await this.telemetry.trackCompletion({
        language: document.languageId,
        fileLength: document.getText().length,
        responseTime,
        success: true
      });

      // Return inline completion item
      const range = new Range(position, position);
      const inlineCompletion = new InlineCompletionItem(completion, range);

      // Add decoration if enabled
      if (this.config.showInlineAnnotations && vscode.window.activeTextEditor) {
        this.decorator.applyDecoration(
          vscode.window.activeTextEditor,
          range,
          'Accept with Tab'
        );
      }

      return [inlineCompletion];
    } catch (error) {
      this.logger.error('Inline completion failed', error);
      await this.telemetry.trackError(error as Error, {
        document: document.uri.toString(),
        position
      });
      return undefined;
    }
  }

  /**
   * Debounced inline completion
   */
  private debouncedInlineCompletion(
    document: vscode.TextDocument,
    position: Position,
    context: vscode.InlineCompletionContext,
    token: CancellationToken
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        const completion = await this.getInlineCompletion(document, position, token);
        resolve(completion);
      }, this.config.completionDebounce);
    });
  }

  /**
   * Get inline completion from API
   */
  private async getInlineCompletion(
    document: vscode.TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<string | undefined> {
    // Extract context
    const text = document.getText();
    const offset = document.offsetAt(position);
    const prefix = text.substring(0, offset);
    const suffix = text.substring(offset);

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
      let completion = '';

      // Stream the completion
      await this.apiClient.streamCompletion(request, (chunk, done) => {
        if (done) {
          return;
        }
        completion += chunk;
      });

      return completion || undefined;
    } catch (error) {
      if (token.isCancellationRequested) {
        this.logger.debug('Inline completion request cancelled');
        return undefined;
      }

      throw error;
    }
  }

  /**
   * Handle item acceptance
   */
  handleItemAccepted(): void {
    this.decorator.clearDecorations();
    this.currentCompletion = undefined;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.decorator.dispose();
  }
}
