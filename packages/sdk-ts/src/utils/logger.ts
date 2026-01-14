/**
 * Logging utilities for ClaudeFlare SDK
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix: string;
  colorize: boolean;
}

export const defaultLoggerConfig: LoggerConfig = {
  enabled: false,
  level: LogLevel.INFO,
  prefix: '[ClaudeFlare]',
  colorize: true,
};

/**
 * ANSI color codes
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

/**
 * Logger class
 */
export class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultLoggerConfig, ...config };
  }

  /**
   * Update logger configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;

    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Format log message
   */
  private format(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ): string {
    const timestamp = new Date().toISOString();
    const prefix = this.config.colorize
      ? `${colors.cyan}${this.config.prefix}${colors.reset}`
      : this.config.prefix;

    const levelStr = this.config.colorize
      ? `${this.levelColor(level)}${level}${colors.reset}`
      : level;

    let formatted = `${prefix} ${timestamp} ${levelStr}: ${message}`;

    if (meta && Object.keys(meta).length > 0) {
      formatted += ` ${JSON.stringify(meta)}`;
    }

    return formatted;
  }

  /**
   * Get color for log level
   */
  private levelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return colors.dim;
      case LogLevel.INFO:
        return colors.green;
      case LogLevel.WARN:
        return colors.yellow;
      case LogLevel.ERROR:
        return colors.red;
      default:
        return colors.white;
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      // eslint-disable-next-line no-console
      console.debug(this.format(LogLevel.DEBUG, message, meta));
    }
  }

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      // eslint-disable-next-line no-console
      console.info(this.format(LogLevel.INFO, message, meta));
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      // eslint-disable-next-line no-console
      console.warn(this.format(LogLevel.WARN, message, meta));
    }
  }

  /**
   * Log error message
   */
  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      // eslint-disable-next-line no-console
      console.error(this.format(LogLevel.ERROR, message, meta));
    }
  }

  /**
   * Log HTTP request
   */
  logRequest(method: string, url: string, headers?: Record<string, string>): void {
    this.debug('HTTP Request', {
      method,
      url,
      headers: this.sanitizeHeaders(headers),
    });
  }

  /**
   * Log HTTP response
   */
  logResponse(status: number, duration: number, meta?: Record<string, unknown>): void {
    this.debug('HTTP Response', {
      status,
      duration: `${duration}ms`,
      ...meta,
    });
  }

  /**
   * Sanitize headers (remove sensitive data)
   */
  private sanitizeHeaders(
    headers?: Record<string, string>
  ): Record<string, string> | undefined {
    if (!headers) return undefined;

    const sanitized = { ...headers };
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase() === sk)) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}

/**
 * Create a default logger instance
 */
let defaultLogger: Logger | undefined;

export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}

export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}
