/**
 * Logging utilities
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export class Logger {
  private level: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs: number = 10000;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  /**
   * Log critical message
   */
  critical(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.CRITICAL, message, metadata);
  }

  /**
   * Log message at specified level
   */
  log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      metadata
    };

    this.logs.push(entry);

    // Prune old logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console
    this.outputToConsole(entry);
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
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs in time range
   */
  getLogsInTimeRange(startTime: number, endTime: number): LogEntry[] {
    return this.logs.filter(log => log.timestamp >= startTime && log.timestamp <= endTime);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs to JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Export logs to CSV
   */
  exportLogsCSV(): string {
    const headers = ['timestamp', 'level', 'message', 'metadata'];
    const rows = this.logs.map(log => [
      log.timestamp,
      LogLevel[log.level],
      `"${log.message}"`,
      log.metadata ? `"${JSON.stringify(log.metadata)}"` : ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Create child logger with prefix
   */
  child(prefix: string): Logger {
    const childLogger = new Logger(this.level);
    const originalLog = childLogger.log.bind(childLogger);

    childLogger.log = (level: LogLevel, message: string, metadata?: Record<string, unknown>) => {
      originalLog(level, `[${prefix}] ${message}`, metadata);
    };

    return childLogger;
  }

  /**
   * Output to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = LogLevel[entry.level];
    const prefix = `[${timestamp}] [${level}]`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.metadata || '');
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.metadata || '');
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.metadata || '');
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(prefix, entry.message, entry.metadata || '');
        break;
    }
  }
}

// Global logger instance
export const logger = new Logger(LogLevel.INFO);
