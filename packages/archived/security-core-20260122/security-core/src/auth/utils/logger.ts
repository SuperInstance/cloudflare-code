// @ts-nocheck - External dependency (winston) may not be installed

/**
 * Logger Utility for Security Core
 * Provides structured logging with security context
 */

import winston from 'winston';

export class Logger {
  private logger: winston.Logger;

  constructor(context: string) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            context,
            ...meta
          });
        })
      ),
      defaultMeta: { context },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ filename: 'logs/security.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/security-combined.log' })
      ]
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

  security(message: string, severity: 'low' | 'medium' | 'high' | 'critical', meta?: any): void {
    const level = severity === 'critical' ? 'error' : severity;
    this.logger.log(level, message, { ...meta, security: true, severity });
  }

  audit(message: string, userId?: string, action?: string, resource?: string, meta?: any): void {
    this.logger.info(message, {
      ...meta,
      audit: true,
      userId,
      action,
      resource,
      timestamp: new Date().toISOString()
    });
  }

  authentication(message: string, userId?: string, success?: boolean, meta?: any): void {
    this.logger.info(message, {
      ...meta,
      authentication: true,
      userId,
      success,
      timestamp: new Date().toISOString()
    });
  }

  authorization(message: string, userId?: string, resource?: string, permission?: string, allowed?: boolean, meta?: any): void {
    this.logger.info(message, {
      ...meta,
      authorization: true,
      userId,
      resource,
      permission,
      allowed,
      timestamp: new Date().toISOString()
    });
  }
}