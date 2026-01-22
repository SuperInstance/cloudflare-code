/**
 * Hover provider for code explanations
 */

import * as vscode from 'vscode';
import {
  Hover,
  Position,
  CancellationToken,
  Range,
  MarkedString
} from 'vscode';

import { ApiClient } from '../services/apiClient';
import { ClaudeFlareConfig, CodeExplanationRequest } from '../types';
import { TelemetryService } from '../services/telemetry';
import { Logger } from '../utils/logger';

export class HoverProvider implements vscode.HoverProvider {
  private logger: Logger;
  private cache: Map<string, { explanation: string; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(
    private apiClient: ApiClient,
    private config: ClaudeFlareConfig,
    private telemetry: TelemetryService
  ) {
    this.logger = new Logger('HoverProvider');
  }

  /**
   * Provide hover information
   */
  async provideHover(
    document: vscode.TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<Hover | undefined> {
    const startTime = Date.now();

    try {
      // Get the word at position
      const range = document.getWordRangeAtPosition(position);
      if (!range) {
        return undefined;
      }

      const text = document.getText(range);

      // Check cache first
      const cacheKey = `${document.uri.toString()}:${range.start.toString()}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return new Hover(this.formatExplanation(cached.explanation), range);
      }

      // Extract surrounding context (3 lines before and after)
      const line = document.lineAt(position.line);
      const startLine = Math.max(0, position.line - 3);
      const endLine = Math.min(document.lineCount - 1, position.line + 3);
      const contextRange = new Range(
        startLine,
        0,
        endLine,
        document.lineAt(endLine).text.length
      );
      const context = document.getText(contextRange);

      // Build request
      const request: CodeExplanationRequest = {
        code: context,
        language: document.languageId,
        filePath: document.uri.fsPath,
        range: contextRange,
        detail: 'low'
      };

      // Get explanation from API
      const response = await this.apiClient.explainCode(request);

      // Cache the result
      this.cache.set(cacheKey, {
        explanation: response.explanation,
        timestamp: Date.now()
      });

      // Track telemetry
      const responseTime = Date.now() - startTime;
      await this.telemetry.trackMeasurement('hover_explanation', {
        responseTime
      }, {
        language: document.languageId,
        hasContext: true
      });

      return new Hover(this.formatExplanation(response.explanation), range);
    } catch (error) {
      this.logger.error('Hover failed', error);
      await this.telemetry.trackError(error as Error, {
        document: document.uri.toString(),
        position
      });
      return undefined;
    }
  }

  /**
   * Format explanation for hover display
   */
  private formatExplanation(explanation: string): MarkedString[] {
    // Create markdown formatted explanation
    const markdown = new vscode.MarkdownString();
    markdown.supportHtml = true;
    markdown.appendMarkdown(`**ClaudeFlare Explanation**\n\n`);
    markdown.appendMarkdown(explanation);

    return [markdown];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.cache.clear();
  }
}
