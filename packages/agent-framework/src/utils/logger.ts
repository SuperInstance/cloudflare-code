/**
 * Logging Utility for Agent Framework
 *
 * Provides structured logging with multiple levels and contexts.
 */

import type { LogLevel, LogEntry } from '../types';

/**
 * Logger class for agent framework
 */
export class Logger {
  private context: string;
  private minLevel: LogLevel;
  private handlers: LogHandler[];

  constructor(context: string, minLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.minLevel = minLevel;
    this.handlers = [];
  }

  /**
   * Add a log handler
   */
  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove a log handler
   */
  removeHandler(handler: LogHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Log at debug level
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log at info level
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log at warn level
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log at error level
   */
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: LogLevel.ERROR,
      message,
      timestamp: Date.now(),
      context: this.context,
      metadata,
      error
    };
    this.emit(entry);
  }

  /**
   * Log at fatal level
   */
  fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: LogLevel.FATAL,
      message,
      timestamp: Date.now(),
      context: this.context,
      metadata,
      error
    };
    this.emit(entry);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: this.context,
      metadata
    };

    this.emit(entry);
  }

  /**
   * Emit log entry to all handlers
   */
  private emit(entry: LogEntry): void {
    for (const handler of this.handlers) {
      try {
        handler(entry);
      } catch (error) {
        // Don't let logging errors break the application
        console.error('Log handler error:', error);
      }
    }
  }

  /**
   * Create a child logger with a sub-context
   */
  child(childContext: string): Logger {
    const newContext = this.context ? `${this.context}:${childContext}` : childContext;
    const childLogger = new Logger(newContext, this.minLevel);
    childLogger.handlers = [...this.handlers];
    return childLogger;
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

/**
 * Log handler function type
 */
export type LogHandler = (entry: LogEntry) => void;

/**
 * Console log handler
 */
export function consoleLogHandler(entry: LogEntry): void {
  const levelName = LogLevel[entry.level];
  const timestamp = new Date(entry.timestamp).toISOString();
  const prefix = `[${timestamp}] [${levelName}] [${entry.context || 'root'}]`;

  const message = entry.error
    ? `${prefix} ${entry.message}\n${entry.error.stack}`
    : `${prefix} ${entry.message}`;

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
    case LogLevel.FATAL:
      console.error(message);
      break;
  }

  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    console.log('Metadata:', JSON.stringify(entry.metadata, null, 2));
  }
}

/**
 * Create a logger instance
 */
export function createLogger(context: string, level?: LogLevel): Logger {
  const logger = new Logger(context, level);
  logger.addHandler(consoleLogHandler);
  return logger;
}
