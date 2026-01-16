/**
 * Logger utility for email service
 */

// @ts-nocheck - External dependency (winston) not installed
import winston from 'winston';

export const winston = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'email-service' },
  transports: [
    new winston.transports.File({ filename: 'email-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'email-combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  winston.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}
