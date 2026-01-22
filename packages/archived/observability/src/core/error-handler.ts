// @ts-nocheck - Complex error handling type issues
import { ObservableConfig } from '../types';
import { LogEntry, LogLevel } from '../types/log-types';

export class ErrorHandler {
  private configManager: any;
  private errorCache: Map<string, ErrorInfo> = new Map();
  private errorCounter = { total: 0, byType: new Map<string, number>() };
  private shutdownHooks: Array<() => Promise<void>> = [];
  private initialized: boolean = false;

  constructor() {
    // This would be injected with ConfigManager in real implementation
    this.configManager = this.getDefaultConfig();
  }

  public async initialize(config: ObservableConfig): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.configManager = config;
    this.setupGlobalHandlers();
    this.initialized = true;
  }

  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    for (const hook of this.shutdownHooks.reverse()) {
      await hook();
    }

    this.initialized = false;
  }

  public setupGlobalHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleUncaughtException(error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      this.handleUnhandledRejection(reason);
    });

    // Handle warnings
    process.on('warning', (warning) => {
      this.handleWarning(warning);
    });

    // Handle exit
    process.on('exit', (code) => {
      this.handleExit(code);
    });

    // Handle signals
    process.on('SIGINT', this.handleSignal.bind(this));
    process.on('SIGTERM', this.handleSignal.bind(this));
  }

  public handleError(error: Error | unknown, context?: string, tags?: Record<string, string>): void {
    const errorInfo = this.createErrorInfo(error, context, tags);

    // Log the error
    this.logError(errorInfo);

    // Update error statistics
    this.updateErrorStats(errorInfo);

    // Cache the error for deduplication
    this.cacheError(errorInfo);

    // Check if we need to escalate
    this.checkErrorEscalation(errorInfo);

    // Emit error event for subscribers
    this.emitErrorEvent(errorInfo);
  }

  private createErrorInfo(error: Error | unknown, context?: string, tags?: Record<string, string>): ErrorInfo {
    if (error instanceof Error) {
      return {
        id: this.generateErrorId(),
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        context,
        tags,
        timestamp: Date.now(),
        severity: this.determineErrorSeverity(error),
        category: this.categorizeError(error)
      };
    }

    return {
      id: this.generateErrorId(),
      name: 'UnknownError',
      message: String(error),
      stack: undefined,
      code: undefined,
      context,
      tags,
      timestamp: Date.now(),
      severity: 'error',
      category: 'unknown'
    };
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineErrorSeverity(error: Error): 'info' | 'warn' | 'error' | 'fatal' {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();

    if (name.includes('fatal') || name.includes('critical')) {
      return 'fatal';
    }

    if (name.includes('timeout') || name.includes('network')) {
      return 'warn';
    }

    if (name.includes('memory') || name.includes('limit')) {
      return 'error';
    }

    return 'error';
  }

  private categorizeError(error: Error): string {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();

    if (name.includes('syntax') || name.includes('parse')) {
      return 'syntax';
    }

    if (name.includes('type') || name.includes('null') || name.includes('undefined')) {
      return 'type';
    }

    if (name.includes('permission') || name.includes('access')) {
      return 'permission';
    }

    if (name.includes('network') || name.includes('connection')) {
      return 'network';
    }

    if (name.includes('timeout') || name.includes('deadline')) {
      return 'timeout';
    }

    if (name.includes('memory') || name.includes('limit')) {
      return 'resource';
    }

    if (name.includes('validation') || name.includes('invalid')) {
      return 'validation';
    }

    return 'unknown';
  }

  private logError(errorInfo: ErrorInfo): void {
    const config = this.configManager.logging;
    const level = this.getLogLevelForSeverity(errorInfo.severity);

    // Create log entry
    const logEntry: LogEntry = {
      level,
      message: `[${errorInfo.name}] ${errorInfo.message}`,
      timestamp: errorInfo.timestamp,
      context: {
        errorId: errorInfo.id,
        category: errorInfo.category,
        context: errorInfo.context,
        ...errorInfo.tags
      },
      error: {
        name: errorInfo.name,
        message: errorInfo.message,
        stack: errorInfo.stack,
        code: errorInfo.code
      }
    };

    // This would be sent to the logging system
    console.error(`[${level.toUpperCase()}] ${logEntry.message}`, {
      error: logEntry.error,
      context: logEntry.context
    });

    // Send to monitoring system if configured
    if (config && config.level !== 'silent') {
      // This would integrate with the telemetry manager
      console.log('Sending error to monitoring system:', logEntry);
    }
  }

  private getLogLevelForSeverity(severity: string): LogLevel {
    switch (severity) {
      case 'info':
        return 'info';
      case 'warn':
        return 'warn';
      case 'error':
        return 'error';
      case 'fatal':
        return 'fatal';
      default:
        return 'error';
    }
  }

  private updateErrorStats(errorInfo: ErrorInfo): void {
    this.errorCounter.total++;
    const category = errorInfo.category;
    const current = this.errorCounter.byType.get(category) || 0;
    this.errorCounter.byType.set(category, current + 1);

    // Check for high error rates
    const recentErrors = this.getRecentErrors(5 * 60 * 1000); // Last 5 minutes
    if (recentErrors.length > 100) {
      console.warn('High error rate detected:', recentErrors.length, 'errors in last 5 minutes');
      // This could trigger an alert
    }
  }

  private cacheError(errorInfo: ErrorInfo): void {
    const key = `${errorInfo.name}:${errorInfo.message}`;
    this.errorCache.set(key, errorInfo);

    // Evict old errors
    if (this.errorCache.size > 1000) {
      const oldestKey = this.errorCache.keys().next().value;
      this.errorCache.delete(oldestKey);
    }
  }

  private checkErrorEscalation(errorInfo: ErrorInfo): void {
    // Check if this is a recurring error
    const key = `${errorInfo.name}:${errorInfo.message}`;
    const cached = this.errorCache.get(key);

    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      console.warn(`Error ${errorInfo.name} has occurred multiple times in the last 5 minutes`);
      // This could trigger an escalation
    }

    // Check for fatal errors
    if (errorInfo.severity === 'fatal') {
      console.error('Fatal error detected, initiating escalation');
      // This could trigger page, send to on-call, etc.
    }
  }

  private emitErrorEvent(errorInfo: ErrorInfo): void {
    // This would emit to the main observability platform
    // platform.emit('error', errorInfo);
  }

  private handleUncaughtException(error: Error): void {
    console.error('Uncaught Exception:', error);
    this.handleError(error, 'uncaught-exception');

    // Exit with error code
    process.exit(1);
  }

  private handleUnhandledRejection(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.error('Unhandled Promise Rejection:', error);
    this.handleError(error, 'unhandled-rejection');

    // Don't exit, but log heavily
  }

  private handleWarning(warning: Error): void {
    this.handleError(warning, 'process-warning', { category: 'warning' });
  }

  private handleExit(code: number): void {
    console.log(`Process exiting with code ${code}`);
    if (code !== 0) {
      this.handleError(new Error(`Process exited with code ${code}`), 'process-exit');
    }
  }

  private handleSignal(signal: string): void {
    console.log(`Received signal: ${signal}`);
    this.handleError(new Error(`Received signal: ${signal}`), 'process-signal', { signal });
  }

  public getErrorStats(): ErrorStats {
    return {
      total: this.errorCounter.total,
      byType: Object.fromEntries(this.errorCounter.byType),
      cacheSize: this.errorCache.size
    };
  }

  public getRecentErrors(timeWindow: number = 60 * 60 * 1000): ErrorInfo[] {
    const cutoff = Date.now() - timeWindow;
    return Array.from(this.errorCache.values())
      .filter(error => error.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public clearErrorCache(): void {
    this.errorCache.clear();
  }

  public setConfig(config: ObservableConfig): void {
    this.configManager = config;
  }

  private getDefaultConfig(): ObservableConfig {
    return {
      tracing: { serviceName: 'claudeflare-service' },
      metrics: { enabled: true },
      logging: { level: 'info' },
      alerting: { enabled: false },
      healthChecks: { enabled: false }
    };
  }

  public addShutdownHook(hook: () => Promise<void>): void {
    this.shutdownHooks.push(hook);
  }
}

interface ErrorInfo {
  id: string;
  name: string;
  message: string;
  stack?: string;
  code?: string;
  context?: string;
  tags?: Record<string, string>;
  timestamp: number;
  severity: 'info' | 'warn' | 'error' | 'fatal';
  category: string;
}

interface ErrorStats {
  total: number;
  byType: Record<string, number>;
  cacheSize: number;
}