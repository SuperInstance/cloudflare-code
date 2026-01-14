/**
 * Telemetry service for tracking usage and performance
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { ClaudeFlareConfig, TelemetryEvent } from '../types';
import { Logger } from '../utils/logger';

export class TelemetryService {
  private logger: Logger;
  private config: ClaudeFlareConfig;
  private context: vscode.ExtensionContext;
  private userId: string;
  private sessionId: string;

  constructor(config: ClaudeFlareConfig, context: vscode.ExtensionContext) {
    this.config = config;
    this.context = context;
    this.logger = new Logger('Telemetry');
    this.userId = this.getUserId();
    this.sessionId = uuidv4();
  }

  /**
   * Get or create user ID
   */
  private getUserId(): string {
    let userId = this.context.globalState.get<string>('claudeflare.userId');
    if (!userId) {
      userId = uuidv4();
      this.context.globalState.update('claudeflare.userId', userId);
    }
    return userId;
  }

  /**
   * Track an event
   */
  async trackEvent(name: string, properties: Record<string, unknown> = {}): Promise<void> {
    if (!this.config.enableTelemetry) {
      return;
    }

    const event: TelemetryEvent = {
      name,
      properties: {
        ...properties,
        userId: this.userId,
        sessionId: this.sessionId,
        extensionVersion: this.context.extension.packageJSON.version,
        vscodeVersion: vscode.version,
        platform: process.platform,
        timestamp: Date.now()
      }
    };

    this.logger.debug('Tracking event', { name, properties });
    await this.sendEvent(event);
  }

  /**
   * Track a measurement
   */
  async trackMeasurement(
    name: string,
    measurements: Record<string, number>,
    properties: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.config.enableTelemetry) {
      return;
    }

    const event: TelemetryEvent = {
      name,
      properties: {
        ...properties,
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: Date.now()
      },
      measurements
    };

    this.logger.debug('Tracking measurement', { name, measurements });
    await this.sendEvent(event);
  }

  /**
   * Track command execution
   */
  async trackCommand(command: string, properties: Record<string, unknown> = {}): Promise<void> {
    await this.trackEvent('command_executed', {
      command,
      ...properties
    });
  }

  /**
   * Track completion request
   */
  async trackCompletion(properties: {
    language: string;
    fileLength: number;
    responseTime: number;
    success: boolean;
  }): Promise<void> {
    await this.trackMeasurement('completion_request', {
      responseTime: properties.responseTime
    }, {
      language: properties.language,
      fileLength: properties.fileLength,
      success: properties.success
    });
  }

  /**
   * Track chat message
   */
  async trackChatMessage(properties: {
    messageLength: number;
    hasContext: boolean;
    hasSelection: boolean;
  }): Promise<void> {
    await this.trackEvent('chat_message', properties);
  }

  /**
   * Track error
   */
  async trackError(error: Error, context?: Record<string, unknown>): Promise<void> {
    await this.trackEvent('error', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context
    });
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(feature: string, details: Record<string, unknown> = {}): Promise<void> {
    await this.trackEvent('feature_used', {
      feature,
      ...details
    });
  }

  /**
   * Track code action
   */
  async trackCodeAction(action: string, properties: Record<string, unknown> = {}): Promise<void> {
    await this.trackEvent('code_action', {
      action,
      ...properties
    });
  }

  /**
   * Track refactoring
   */
  async trackRefactoring(properties: {
    type: string;
    language: string;
    linesChanged: number;
  }): Promise<void> {
    await this.trackEvent('refactoring', properties);
  }

  /**
   * Track test generation
   */
  async trackTestGeneration(properties: {
    language: string;
    framework?: string;
    testCount: number;
  }): Promise<void> {
    await this.trackEvent('test_generation', properties);
  }

  /**
   * Track documentation generation
   */
  async trackDocumentation(properties: {
    language: string;
    format: string;
    symbolCount: number;
  }): Promise<void> {
    await this.trackEvent('documentation_generation', properties);
  }

  /**
   * Track code review
   */
  async trackCodeReview(properties: {
    language: string;
    fileCount: number;
    issueCount: number;
  }): Promise<void> {
    await this.trackEvent('code_review', properties);
  }

  /**
   * Track agent orchestration
   */
  async trackAgentOrchestration(properties: {
    agentCount: number;
    taskType: string;
    duration: number;
    success: boolean;
  }): Promise<void> {
    await this.trackMeasurement('agent_orchestration', {
      duration: properties.duration
    }, {
      agentCount: properties.agentCount,
      taskType: properties.taskType,
      success: properties.success
    });
  }

  /**
   * Flush pending events
   */
  async flush(): Promise<void> {
    this.logger.debug('Flushing telemetry events');
    // Implement batching and sending to backend
  }

  /**
   * Send event to backend
   */
  private async sendEvent(event: TelemetryEvent): Promise<void> {
    // In production, this would send to a telemetry backend
    // For now, we just log locally
    this.logger.debug('Event sent', { name: event.name, properties: event.properties });
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    await this.flush();
  }
}
