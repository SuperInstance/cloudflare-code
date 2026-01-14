/**
 * Logger Utility
 * Provides structured logging for deployment operations
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LoggerOptions {
  component: string;
  level?: LogLevel;
  context?: Record<string, any>;
}

export interface LogEntry {
  level: LogLevel;
  component: string;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export class Logger {
  private component: string;
  private level: LogLevel;
  private context: Record<string, any>;
  private logs: LogEntry[] = [];

  constructor(options: LoggerOptions) {
    this.component = options.component;
    this.level = options.level || LogLevel.INFO;
    this.context = options.context || {};
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log a message at specified level
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // Check if we should log this level
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      component: this.component,
      message,
      timestamp: new Date(),
      context: { ...this.context, ...context },
    };

    this.logs.push(entry);

    // Output to console
    this.output(entry);
  }

  /**
   * Check if we should log at this level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const contextStr = Object.keys(entry.context || {}).length > 0
      ? ` ${JSON.stringify(entry.context)}`
      : '';

    const message = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.component}] ${entry.message}${contextStr}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
        console.error(message);
        break;
    }
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    return new Logger({
      component: this.component,
      level: this.level,
      context: { ...this.context, ...context },
    });
  }
}
