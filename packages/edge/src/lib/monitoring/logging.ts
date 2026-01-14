/**
 * Structured JSON Logging System
 *
 * Comprehensive logging system with structured JSON output, correlation IDs,
 * and integration with tracing and monitoring systems.
 *
 * Features:
 * - Multiple log levels (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
 * - Structured JSON logging with metadata
 * - Correlation ID tracking across requests
 * - Trace and span integration
 * - Context-aware logging
 * - Log aggregation and export
 * - Cloudflare Workers Analytics integration
 */

import type {
  LogEntry,
  LogLevel,
  LogContext,
  LogError,
  Logger,
} from './types';

/**
 * Logger Configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  includeStackTrace: boolean;
  includeContext: boolean;
  exportToCloudflare: boolean;
  minLevelToExport: LogLevel;
  context?: LogContext;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

/**
 * Log Level Priority
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
};

/**
 * Logger Implementation
 */
export class StructuredLogger implements Logger {
  private config: LoggerConfig;
  private entries: LogEntry[];
  private maxEntries: number;
  private exportTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || 'INFO',
      format: config.format || 'json',
      includeStackTrace: config.includeStackTrace ?? true,
      includeContext: config.includeContext ?? true,
      exportToCloudflare: config.exportToCloudflare ?? false,
      minLevelToExport: config.minLevelToExport || 'WARN',
      context: config.context,
      correlationId: config.correlationId,
      traceId: config.traceId,
      spanId: config.spanId,
      userId: config.userId,
      sessionId: config.sessionId,
      requestId: config.requestId,
    };
    this.entries = [];
    this.maxEntries = 10000;
  }

  /**
   * Log a trace message
   */
  trace(message: string, metadata?: Record<string, any>): void {
    this.log('TRACE', message, metadata);
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('DEBUG', message, metadata);
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('INFO', message, metadata);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('WARN', message, metadata);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorMetadata = error
      ? {
          ...metadata,
          error: this.formatError(error),
        }
      : metadata;

    this.log('ERROR', message, errorMetadata);
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorMetadata = error
      ? {
          ...metadata,
          error: this.formatError(error),
        }
      : metadata;

    this.log('FATAL', message, errorMetadata);
  }

  /**
   * Create a new logger with additional context
   */
  withContext(context: string, metadata?: Record<string, any>): Logger {
    return new StructuredLogger({
      ...this.config,
      context: {
        name: context,
        metadata: {
          ...this.config.context?.metadata,
          ...metadata,
        },
        parent: this.config.context,
      },
    });
  }

  /**
   * Create a new logger with a correlation ID
   */
  withCorrelationId(correlationId: string): Logger {
    return new StructuredLogger({
      ...this.config,
      correlationId,
    });
  }

  /**
   * Create a new logger with trace context
   */
  withTrace(traceId: string, spanId: string): Logger {
    return new StructuredLogger({
      ...this.config,
      traceId,
      spanId,
    });
  }

  /**
   * Create a new logger with user context
   */
  withUser(userId: string): Logger {
    return new StructuredLogger({
      ...this.config,
      userId,
    });
  }

  /**
   * Create a new logger with session context
   */
  withSession(sessionId: string): Logger {
    return new StructuredLogger({
      ...this.config,
      sessionId,
    });
  }

  /**
   * Create a new logger with request context
   */
  withRequest(requestId: string): Logger {
    return new StructuredLogger({
      ...this.config,
      requestId,
    });
  }

  /**
   * Get all log entries
   */
  getEntries(filter?: {
    level?: LogLevel;
    startTime?: number;
    endTime?: number;
    correlationId?: string;
    traceId?: string;
    userId?: string;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.entries];

    if (filter) {
      if (filter.level) {
        filtered = filtered.filter((e) => e.level === filter.level);
      }

      if (filter.startTime) {
        filtered = filtered.filter((e) => e.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        filtered = filtered.filter((e) => e.timestamp <= filter.endTime!);
      }

      if (filter.correlationId) {
        filtered = filtered.filter((e) => e.correlationId === filter.correlationId);
      }

      if (filter.traceId) {
        filtered = filtered.filter((e) => e.traceId === filter.traceId);
      }

      if (filter.userId) {
        filtered = filtered.filter((e) => e.userId === filter.userId);
      }

      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    errorRate: number;
    avgPerMinute: number;
  } {
    const byLevel: Record<LogLevel, number> = {
      TRACE: 0,
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      FATAL: 0,
    };

    for (const entry of this.entries) {
      byLevel[entry.level]++;
    }

    const errorCount = byLevel.ERROR + byLevel.FATAL;
    const errorRate = this.entries.length > 0 ? errorCount / this.entries.length : 0;

    // Calculate logs per minute (last 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentEntries = this.entries.filter((e) => e.timestamp >= fiveMinutesAgo);
    const avgPerMinute = recentEntries.length / 5;

    return {
      total: this.entries.length,
      byLevel,
      errorRate,
      avgPerMinute,
    };
  }

  /**
   * Export logs as JSON
   */
  exportJSON(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Export logs as text
   */
  exportText(): string {
    return this.entries
      .map((entry) => this.formatEntry(entry))
      .join('\n');
  }

  /**
   * Clear all log entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Start automatic log export
   */
  startAutoExport(interval: number = 60000): void {
    if (this.exportTimer) {
      this.stopAutoExport();
    }

    this.exportTimer = setInterval(() => {
      this.exportToCloudflare().catch((err) => {
        console.error('Failed to export logs:', err);
      });
    }, interval);
  }

  /**
   * Stop automatic log export
   */
  stopAutoExport(): void {
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
      this.exportTimer = undefined;
    }
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): void {
    // Check if level is enabled
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context: this.config.context?.name,
      correlationId: this.config.correlationId,
      traceId: this.config.traceId,
      spanId: this.config.spanId,
      userId: this.config.userId,
      sessionId: this.config.sessionId,
      requestId: this.config.requestId,
      metadata: this.mergeMetadata(metadata),
    };

    // Add stack trace if enabled
    if (
      this.config.includeStackTrace &&
      (level === 'ERROR' || level === 'FATAL')
    ) {
      entry.stack = new Error().stack;
    }

    // Add to entries
    this.entries.push(entry);

    // Enforce max entries limit
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Log to console
    this.logToConsole(entry);

    // Export if needed
    if (
      this.config.exportToCloudflare &&
      LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevelToExport]
    ) {
      this.exportToCloudflare().catch((err) => {
        console.error('Failed to export log:', err);
      });
    }
  }

  /**
   * Merge metadata with context metadata
   */
  private mergeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata && !this.config.context?.metadata) {
      return undefined;
    }

    const merged: Record<string, any> = {};

    if (this.config.context?.metadata) {
      Object.assign(merged, this.config.context.metadata);
    }

    if (metadata) {
      Object.assign(merged, metadata);
    }

    return merged;
  }

  /**
   * Format an error for logging
   */
  private formatError(error: Error): LogError {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  /**
   * Format a log entry as text
   */
  private formatEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.padEnd(5);
    const context = entry.context ? `[${entry.context}] ` : '';
    const correlation = entry.correlationId ? `[${entry.correlationId}] ` : '';
    const trace = entry.traceId ? `[trace=${entry.traceId}] ` : '';

    let message = `${timestamp} ${level} ${context}${correlation}${trace}${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += ` ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n  ${entry.error.stack.split('\n').join('\n  ')}`;
      }
    }

    return message;
  }

  /**
   * Log entry to console
   */
  private logToConsole(entry: LogEntry): void {
    const consoleMethod = {
      TRACE: console.trace,
      DEBUG: console.debug,
      INFO: console.info,
      WARN: console.warn,
      ERROR: console.error,
      FATAL: console.error,
    }[entry.level];

    if (this.config.format === 'json') {
      consoleMethod(JSON.stringify(entry));
    } else {
      consoleMethod(this.formatEntry(entry));
    }
  }

  /**
   * Export logs to Cloudflare Analytics
   */
  private async exportToCloudflare(): Promise<void> {
    // In a real implementation, this would send logs to Cloudflare Workers Analytics
    // For now, we'll just log the action
    const exportCount = this.entries.length;
    console.log(`Exporting ${exportCount} log entries to Cloudflare Analytics`);
  }
}

/**
 * Logger factory
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new StructuredLogger(config);
}

/**
 * Create a logger with a correlation ID
 */
export function createLoggerWithCorrelation(correlationId: string): Logger {
  return new StructuredLogger({
    correlationId,
  });
}

/**
 * Create a logger from request headers
 */
export function createLoggerFromRequest(request: Request): Logger {
  const correlationId =
    request.headers.get('x-correlation-id') ||
    request.headers.get('x-request-id') ||
    generateCorrelationId();

  const traceId = request.headers.get('trace-id') || undefined;
  const spanId = request.headers.get('span-id') || undefined;
  const userId = request.headers.get('x-user-id') || undefined;
  const sessionId = request.headers.get('x-session-id') || undefined;

  return new StructuredLogger({
    correlationId,
    traceId,
    spanId,
    userId,
    sessionId,
    requestId: correlationId,
  });
}

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  return `${timestamp}-${random}`;
}

/**
 * Middleware for automatic request logging
 */
export function createLoggingMiddleware(logger: Logger) {
  return async (request: Request): Promise<Response> => {
    const start = Date.now();
    const url = new URL(request.url);
    const method = request.method;

    logger.info('Request started', {
      method,
      path: url.pathname,
      query: url.search,
      userAgent: request.headers.get('user-agent'),
    });

    try {
      const response = await fetch(request);
      const duration = Date.now() - start;

      logger.info('Request completed', {
        method,
        path: url.pathname,
        status: response.status,
        duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Request failed', error as Error, {
        method,
        path: url.pathname,
        duration,
      });

      throw error;
    }
  };
}

/**
 * Log aggregation utility
 */
export class LogAggregator {
  private loggers: Map<string, StructuredLogger>;

  constructor() {
    this.loggers = new Map();
  }

  /**
   * Get or create a logger
   */
  getLogger(name: string, config?: Partial<LoggerConfig>): Logger {
    if (!this.loggers.has(name)) {
      this.loggers.set(name, new StructuredLogger(config));
    }

    return this.loggers.get(name)!;
  }

  /**
   * Get all log entries from all loggers
   */
  getAllEntries(): LogEntry[] {
    const allEntries: LogEntry[] = [];

    for (const logger of this.loggers.values()) {
      allEntries.push(...logger.getEntries());
    }

    // Sort by timestamp
    allEntries.sort((a, b) => a.timestamp - b.timestamp);

    return allEntries;
  }

  /**
   * Get aggregated statistics
   */
  getAggregatedStats(): {
    totalLoggers: number;
    totalEntries: number;
    byLevel: Record<LogLevel, number>;
    byLogger: Record<string, number>;
  } {
    const byLevel: Record<LogLevel, number> = {
      TRACE: 0,
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      FATAL: 0,
    };

    const byLogger: Record<string, number> = {};
    let totalEntries = 0;

    for (const [name, logger] of this.loggers.entries()) {
      const stats = logger.getStats();
      totalEntries += stats.total;
      byLogger[name] = stats.total;

      for (const [level, count] of Object.entries(stats.byLevel)) {
        byLevel[level as LogLevel] += count;
      }
    }

    return {
      totalLoggers: this.loggers.size,
      totalEntries,
      byLevel,
      byLogger,
    };
  }

  /**
   * Clear all loggers
   */
  clearAll(): void {
    for (const logger of this.loggers.values()) {
      logger.clear();
    }
  }

  /**
   * Export all logs as JSON
   */
  exportAllJSON(): LogEntry[] {
    return this.getAllEntries();
  }

  /**
   * Export all logs as text
   */
  exportAllText(): string {
    return this.getAllEntries()
      .map((entry) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const logger = entry.context || 'root';
        return `${timestamp} [${logger}] ${entry.level}: ${entry.message}`;
      })
      .join('\n');
  }
}

/**
 * Create a log aggregator
 */
export function createLogAggregator(): LogAggregator {
  return new LogAggregator();
}
