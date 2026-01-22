/**
 * Internal logger for the distributed logging system
 */

import pino from 'pino';
import { LogLevel, LogMetadata } from '../types';

export interface InternalLoggerConfig {
  level: LogLevel;
  pretty?: boolean;
  destination?: string;
}

let instance: pino.Logger | null = null;

/**
 * Get or create the internal logger instance
 */
export function getInternalLogger(config?: InternalLoggerConfig): pino.Logger {
  if (instance) {
    return instance;
  }

  const options: pino.LoggerOptions = {
    level: config?.level ?? LogLevel[LogLevel.INFO].toLowerCase(),
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  };

  if (config?.pretty) {
    instance = pino(
      options,
      pino.multistream([
        {
          level: 'trace',
          stream: pino.transport({
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }),
        },
      ])
    );
  } else {
    instance = pino(options);
  }

  return instance;
}

/**
 * Log wrapper for structured logging
 */
export class Logger {
  private logger: pino.Logger;
  private context: LogMetadata;

  constructor(logger?: pino.Logger, context: LogMetadata = {}) {
    this.logger = logger ?? getInternalLogger();
    this.context = context;
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogMetadata): Logger {
    const mergedContext = { ...this.context, ...context };
    return new Logger(this.logger.child(mergedContext), mergedContext);
  }

  /**
   * Log at trace level
   */
  trace(msg: string, meta?: LogMetadata): void {
    this.logger.trace({ ...this.context, ...meta }, msg);
  }

  /**
   * Log at debug level
   */
  debug(msg: string, meta?: LogMetadata): void {
    this.logger.debug({ ...this.context, ...meta }, msg);
  }

  /**
   * Log at info level
   */
  info(msg: string, meta?: LogMetadata): void {
    this.logger.info({ ...this.context, ...meta }, msg);
  }

  /**
   * Log at warn level
   */
  warn(msg: string, meta?: LogMetadata): void {
    this.logger.warn({ ...this.context, ...meta }, msg);
  }

  /**
   * Log at error level
   */
  error(msg: string, error?: Error | unknown, meta?: LogMetadata): void {
    const errorMeta = error instanceof Error ? { err: error, ...meta } : { error, ...meta };
    this.logger.error({ ...this.context, ...errorMeta }, msg);
  }

  /**
   * Log at fatal level
   */
  fatal(msg: string, error?: Error | unknown, meta?: LogMetadata): void {
    const errorMeta = error instanceof Error ? { err: error, ...meta } : { error, ...meta };
    this.logger.fatal({ ...this.context, ...errorMeta }, msg);
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(context?: LogMetadata): Logger {
  return new Logger(undefined, context);
}
