import * as winston from 'winston';
import * as path from 'path';

export class Logger {
  private logger: winston.Logger;

  constructor(private context: string) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
          const contextStr = this.context ? `[${this.context}] ` : '';
          const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          const stackStr = stack ? `\n${stack}` : '';

          if (typeof message === 'object') {
            return `${timestamp} [${level.toUpperCase()}] ${contextStr}${JSON.stringify(message)}${metaStr}${stackStr}`;
          }

          return `${timestamp} [${level.toUpperCase()}] ${contextStr}${message}${metaStr}${stackStr}`;
        })
      ),
      transports: this.getTransports()
    });
  }

  private getTransports(): winston.transport[] {
    const transports: winston.transport[] = [];

    // Console transport
    transports.push(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        this.logger.format
      )
    }));

    // File transports for production
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error',
          format: winston.format.json(),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'combined.log'),
          format: winston.format.json(),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      );
    }

    return transports;
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: any, stack?: string): void {
    this.logger.error(message, meta, stack);
  }

  // Convenience methods with context
  debugWithContext(message: string, context?: string, meta?: any): void {
    this.debug(message, { ...meta, context });
  }

  infoWithContext(message: string, context?: string, meta?: any): void {
    this.info(message, { ...meta, context });
  }

  warnWithContext(message: string, context?: string, meta?: any): void {
    this.warn(message, { ...meta, context });
  }

  errorWithContext(message: string, context?: string, meta?: any, stack?: string): void {
    this.error(message, { ...meta, context }, stack);
  }

  // Static logger instance for global use
  static create(context: string): Logger {
    return new Logger(context);
  }

  // Set log level
  setLevel(level: string): void {
    this.logger.level = level;
  }

  // Add custom transport
  addTransport(transport: winston.transport): void {
    this.logger.add(transport);
  }

  // Remove transport
  removeTransport(transport: winston.transport): void {
    this.logger.remove(transport);
  }
}

// Request-specific logger for HTTP operations
export class RequestLogger {
  private logger: Logger;

  constructor() {
    this.logger = Logger.create('Request');
  }

  logRequest(req: any, meta?: any): void {
    this.logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      ...meta
    });
  }

  logResponse(res: any, duration: number, meta?: any): void {
    this.logger.info('HTTP Response', {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ...meta
    });
  }

  logError(error: any, req?: any, meta?: any): void {
    this.logger.error('HTTP Error', {
      message: error.message,
      stack: error.stack,
      method: req?.method,
      url: req?.url,
      ...meta
    });
  }
}

// Performance logger for monitoring
export class PerformanceLogger {
  private logger: Logger;

  constructor() {
    this.logger = Logger.create('Performance');
  }

  logMetric(metric: string, value: number, tags?: Record<string, string>): void {
    this.logger.info(`Metric: ${metric}`, {
      value,
      tags,
      timestamp: new Date().toISOString()
    });
  }

  logOperation(operation: string, duration: number, success: boolean, meta?: any): void {
    this.logger.info(`Operation: ${operation}`, {
      duration: `${duration}ms`,
      success,
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  logResourceUsage(memory: NodeJS.MemoryUsage, cpu?: number): void {
    this.logger.info('Resource Usage', {
      memory: {
        used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
        external: Math.round(memory.external / 1024 / 1024) + 'MB'
      },
      cpu: cpu ? `${cpu}%` : undefined
    });
  }
}

// Error-specific logger
export class ErrorLogger {
  private logger: Logger;

  constructor() {
    this.logger = Logger.create('Error');
  }

  logError(error: Error, context?: string, meta?: any): void {
    this.logger.error(error.message, {
      context,
      stack: error.stack,
      ...meta
    });
  }

  logValidationError(errors: any[], context?: string): void {
    this.logger.error('Validation Error', {
      context,
      errors,
      count: errors.length
    });
  }

  logSecurityEvent(event: string, details: any): void {
    this.logger.warn('Security Event', {
      event,
      details,
      timestamp: new Date().toISOString()
    });
  }
}