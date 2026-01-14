/**
 * Diagnostics provider for AI-powered code analysis
 */

import * as vscode from 'vscode';
import {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticCollection,
  DiagnosticTag,
  Range,
  Position,
  CancellationToken,
  TextDocument,
  Uri
} from 'vscode';

import { ApiClient } from '../services/apiClient';
import { ClaudeFlareConfig } from '../types';
import { TelemetryService } from '../services/telemetry';
import { Logger } from '../utils/logger';

export class DiagnosticsProvider implements vscode.DiagnosticProvider {
  private logger: Logger;
  private diagnosticCollection: DiagnosticCollection;
  private diagnosticTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly debounceDelay = 2000;

  constructor(
    private apiClient: ApiClient,
    private config: ClaudeFlareConfig,
    private telemetry: TelemetryService
  ) {
    this.logger = new Logger('DiagnosticsProvider');
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('claudeflare');
  }

  /**
   * Provide diagnostics
   */
  async provideDiagnostics(
    document: TextDocument,
    token: CancellationToken
  ): Promise<Diagnostic[] | undefined> {
    try {
      // Debounce the diagnostics request
      const documentKey = document.uri.toString();
      const existingTimer = this.diagnosticTimers.get(documentKey);

      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      return new Promise((resolve) => {
        const timer = setTimeout(async () => {
          const diagnostics = await this.analyzeDocument(document, token);
          this.diagnosticTimers.delete(documentKey);
          resolve(diagnostics);
        }, this.debounceDelay);

        this.diagnosticTimers.set(documentKey, timer);
      });
    } catch (error) {
      this.logger.error('Diagnostics failed', error);
      return undefined;
    }
  }

  /**
   * Analyze document for issues
   */
  private async analyzeDocument(
    document: TextDocument,
    token: CancellationToken
  ): Promise<Diagnostic[]> {
    try {
      // For now, we'll analyze on-demand or on save
      // In a full implementation, you'd call the API to get AI-powered diagnostics

      const diagnostics: Diagnostic[] = [];

      // Example: Detect potential issues
      const text = document.getText();
      const lines = text.split('\n');

      // Check for common issues (placeholder)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // TODO: Implement actual AI-powered diagnostics
        // This would call the API to get code analysis
      }

      // Update the diagnostic collection
      this.diagnosticCollection.set(document.uri, diagnostics);

      return diagnostics;
    } catch (error) {
      this.logger.error('Document analysis failed', error);
      return [];
    }
  }

  /**
   * Analyze document on demand (e.g., on save)
   */
  async analyzeOnDemand(document: TextDocument): Promise<void> {
    if (!document.uri.scheme === 'file') {
      return;
    }

    try {
      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: 'ClaudeFlare: Analyzing code...',
          cancellable: true
        },
        async (progress, token) => {
          const diagnostics = await this.analyzeDocument(document, token);
          this.diagnosticCollection.set(document.uri, diagnostics);

          if (diagnostics.length > 0) {
            vscode.window.showInformationMessage(
              `ClaudeFlare: Found ${diagnostics.length} issue(s) in ${document.fileName}`
            );
          }
        }
      );
    } catch (error) {
      this.logger.error('On-demand analysis failed', error);
    }
  }

  /**
   * Clear diagnostics for document
   */
  clearDiagnostics(uri: Uri): void {
    this.diagnosticCollection.delete(uri);
  }

  /**
   * Clear all diagnostics
   */
  clearAll(): void {
    this.diagnosticCollection.clear();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.diagnosticCollection.dispose();

    for (const timer of this.diagnosticTimers.values()) {
      clearTimeout(timer);
    }

    this.diagnosticTimers.clear();
  }
}
