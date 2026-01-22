/**
 * Logging utility
 */

import { OutputChannel } from 'vscode';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static outputChannels: Map<string, OutputChannel> = new Map();
  private static globalLevel: LogLevel = LogLevel.INFO;
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Set global log level
   */
  static setLevel(level: LogLevel): void {
    Logger.globalLevel = level;
  }

  /**
   * Get or create output channel
   */
  private getOutputChannel(): OutputChannel {
    let channel = Logger.outputChannels.get(this.context);
    if (!channel) {
      channel = vscode.window.createOutputChannel(`ClaudeFlare: ${this.context}`);
      Logger.outputChannels.set(this.context, channel);
    }
    return channel;
  }

  /**
   * Format log message
   */
  private format(level: string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] [${level}] [${this.context}] ${message}${dataStr}`;
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: unknown): void {
    if (Logger.globalLevel <= LogLevel.DEBUG) {
      const channel = this.getOutputChannel();
      channel.appendLine(this.format('DEBUG', message, data));
    }
  }

  /**
   * Log info message
   */
  info(message: string, data?: unknown): void {
    if (Logger.globalLevel <= LogLevel.INFO) {
      const channel = this.getOutputChannel();
      channel.appendLine(this.format('INFO', message, data));
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: unknown): void {
    if (Logger.globalLevel <= LogLevel.WARN) {
      const channel = this.getOutputChannel();
      channel.appendLine(this.format('WARN', message, data));
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: unknown): void {
    if (Logger.globalLevel <= LogLevel.ERROR) {
      const channel = this.getOutputChannel();
      const errorData = error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error;
      channel.appendLine(this.format('ERROR', message, errorData));
    }
  }

  /**
   * Show output channel
   */
  show(): void {
    this.getOutputChannel().show(true);
  }

  /**
   * Dispose of logger
   */
  dispose(): void {
    const channel = Logger.outputChannels.get(this.context);
    if (channel) {
      channel.dispose();
      Logger.outputChannels.delete(this.context);
    }
  }
}
