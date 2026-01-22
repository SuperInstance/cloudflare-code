// @ts-nocheck
/**
 * Plugin logger implementation
 */

import type { PluginLogger, PluginId } from '../types';

/**
 * Log level
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  levelName: string;
  message: string;
  args: unknown[];
  pluginId?: PluginId;
  context?: Record<string, unknown>;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  includeTimestamp: boolean;
  includeLevel: boolean;
  includePluginId: boolean;
  colorize: boolean;
  output: 'console' | 'file' | 'custom';
  customOutput?: (entry: LogEntry) => void;
}

/**
 * Plugin logger implementation
 */
export class PluginLoggerImpl implements PluginLogger {
  private entries: LogEntry[] = [];
  private maxEntries = 1000;

  constructor(
    private pluginId: PluginId,
    private config: LoggerConfig = {
      level: LogLevel.INFO,
      includeTimestamp: true,
      includeLevel: true,
      includePluginId: true,
      colorize: false,
      output: 'console',
    }
  ) {}

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, args);
  }

  fatal(message: string, ...args: unknown[]): void {
    this.log(LogLevel.FATAL, message, args);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, args: unknown[]): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      levelName: LogLevel[level],
      message,
      args,
      pluginId: this.pluginId,
    };

    // Store entry
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Output based on configuration
    switch (this.config.output) {
      case 'console':
        this.outputToConsole(entry);
        break;
      case 'custom':
        this.config.customOutput?.(entry);
        break;
    }
  }

  /**
   * Output to console
   */
  private outputToConsole(entry: LogEntry): void {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(`[${entry.timestamp.toISOString()}]`);
    }

    if (this.config.includeLevel) {
      const levelName = this.config.colorize
        ? this.colorizeLevel(entry.levelName)
        : entry.levelName;
      parts.push(`[${levelName}]`);
    }

    if (this.config.includePluginId) {
      parts.push(`[${entry.pluginId}]`);
    }

    parts.push(entry.message);

    const message = parts.join(' ');

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, ...entry.args);
        break;
      case LogLevel.INFO:
        console.info(message, ...entry.args);
        break;
      case LogLevel.WARN:
        console.warn(message, ...entry.args);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message, ...entry.args);
        break;
    }
  }

  /**
   * Colorize log level
   */
  private colorizeLevel(levelName: string): string {
    const colors: Record<string, string> = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m', // Green
      WARN: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m', // Red
      FATAL: '\x1b[35m', // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[levelName] || reset;
    return `${color}${levelName}${reset}`;
  }

  /**
   * Get log entries
   */
  getEntries(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.entries.filter((e) => e.level === level);
    }
    return [...this.entries];
  }

  /**
   * Clear log entries
   */
  clearEntries(): void {
    this.entries = [];
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Get log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }
}

/**
 * Create a logger for a plugin
 */
export function createLogger(
  pluginId: PluginId,
  config?: Partial<LoggerConfig>
): PluginLoggerImpl {
  return new PluginLoggerImpl(pluginId, {
    level: config?.level ?? LogLevel.INFO,
    includeTimestamp: config?.includeTimestamp ?? true,
    includeLevel: config?.includeLevel ?? true,
    includePluginId: config?.includePluginId ?? true,
    colorize: config?.colorize ?? false,
    output: config?.output ?? 'console',
    customOutput: config?.customOutput,
  });
}

/**
 * Global logger factory
 */
export const loggerFactory = {
  create: createLogger,

  /**
   * Create a logger from environment
   */
  fromEnv(pluginId: PluginId): PluginLoggerImpl {
    const level = process.env.LOG_LEVEL === 'debug'
      ? LogLevel.DEBUG
      : process.env.LOG_LEVEL === 'warn'
      ? LogLevel.WARN
      : process.env.LOG_LEVEL === 'error'
      ? LogLevel.ERROR
      : LogLevel.INFO;

    return createLogger(pluginId, { level });
  },
};
