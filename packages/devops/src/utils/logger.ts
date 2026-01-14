/**
 * Logger utility for structured logging
 */

import winston from 'winston';

export interface LoggerConfig {
  service: string;
  level?: string;
  format?: 'json' | 'pretty';
}

export class Logger {
  private logger: winston.Logger;

  constructor(config: LoggerConfig) {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format:
          config.format === 'json'
            ? winston.format.json()
            : winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(
                  ({ level, message, timestamp, ...metadata }) => {
                    let msg = `${timestamp as string} [${config.service}] ${level}: ${message}`;
                    if (Object.keys(metadata).length > 0) {
                      msg += ` ${JSON.stringify(metadata)}`;
                    }
                    return msg;
                  }
                )
              ),
      }),
    ];

    this.logger = winston.createLogger({
      level: config.level || process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true })
      ),
      transports,
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}
