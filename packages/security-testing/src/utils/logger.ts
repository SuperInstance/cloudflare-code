/**
 * Advanced logging utility for security scanning operations
 * Provides structured logging with multiple transports and severity levels
 */

import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import path from 'path';
import fs from 'fs';

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text' | 'both';
  output: 'console' | 'file' | 'both';
  logDir?: string;
  enableColors: boolean;
  enableTimestamp: boolean;
  context?: Record<string, unknown>;
}

export class Logger {
  private logger: WinstonLogger;
  private context: Record<string, unknown>;
  private scanId?: string;

  constructor(config: LoggerConfig) {
    this.context = config.context || {};

    const logFormats = [];

    if (config.format === 'json' || config.format === 'both') {
      logFormats.push(format.json());
    }

    if (config.format === 'text' || config.format === 'both') {
      const textFormat = format.printf(
        ({ level, message, timestamp, ...meta }) => {
          let msg = `${timestamp} [${level.toUpperCase()}]`;
          if (this.scanId) {
            msg += ` [${this.scanId}]`;
          }
          msg += `: ${message}`;
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        }
      );
      logFormats.push(textFormat);
    }

    const loggerTransports = [];

    if (config.output === 'console' || config.output === 'both') {
      loggerTransports.push(
        new transports.Console({
          format: format.combine(
            format.colorize({ all: config.enableColors }),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            ...logFormats
          ),
        })
      );
    }

    if (config.output === 'file' || config.output === 'both') {
      const logDir = config.logDir || path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      loggerTransports.push(
        new transports.File({
          filename: path.join(logDir, 'security-scanner.log'),
          format: format.combine(format.timestamp(), ...logFormats),
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        })
      );

      loggerTransports.push(
        new transports.File({
          filename: path.join(logDir, 'security-scanner-error.log'),
          level: 'error',
          format: format.combine(format.timestamp(), ...logFormats),
          maxsize: 10485760,
          maxFiles: 5,
        })
      );
    }

    this.logger = createLogger({
      level: config.level,
      transports: loggerTransports,
      exitOnError: false,
    });
  }

  public withScanId(scanId: string): Logger {
    this.scanId = scanId;
    return this;
  }

  public withContext(context: Record<string, unknown>): Logger {
    this.context = { ...this.context, ...context };
    return this;
  }

  public debug(message: string, ...args: unknown[]): void {
    this.logger.debug(message, this.buildMeta(args));
  }

  public info(message: string, ...args: unknown[]): void {
    this.logger.info(message, this.buildMeta(args));
  }

  public warn(message: string, ...args: unknown[]): void {
    this.logger.warn(message, this.buildMeta(args));
  }

  public error(message: string, ...args: unknown[]): void {
    this.logger.error(message, this.buildMeta(args));
  }

  public metric(name: string, value: number, labels?: Record<string, string>): void {
    this.logger.info('Metric recorded', {
      metric: name,
      value,
      labels,
      ...this.context,
    });
  }

  public audit(action: string, details: Record<string, unknown>): void {
    this.logger.info('Audit event', {
      action,
      ...details,
      timestamp: new Date().toISOString(),
      ...this.context,
    });
  }

  private buildMeta(args: unknown[]): Record<string, unknown> {
    const meta: Record<string, unknown> = { ...this.context };

    args.forEach((arg, index) => {
      if (typeof arg === 'object' && arg !== null) {
        Object.assign(meta, arg);
      } else if (arg !== undefined) {
        meta[`arg${index}`] = arg;
      }
    });

    return meta;
  }

  public static createDefault(scanId?: string): Logger {
    return new Logger({
      level: process.env.LOG_LEVEL as any || 'info',
      format: 'text',
      output: 'console',
      enableColors: true,
      enableTimestamp: true,
      context: scanId ? { scanId } : undefined,
    });
  }
}

export default Logger;
