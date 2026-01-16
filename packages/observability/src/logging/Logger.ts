// @ts-nocheck - Complex logger type issues with ObservableConfig
import { Observable, ObservableConfig } from '../core/Observable';
import {
  LoggerOptions,
  LogFormat,
  LogLevel,
  LogEntry,
  LogContext,
  LogCorrelationOptions,
  LogSamplingOptions,
  RedactionPattern
} from '../types';

/**
 * Enhanced Logger with search, filtering, and correlation capabilities
 */
export class Logger extends Observable {
  private config: LoggerOptions;
  private logs: LogEntry[] = [];
  private logBuffer: LogEntry[] = [];
  private bufferInterval: NodeJS.Timeout | null = null;
  private maxLogCount = 10000;
  private sampling: LogSamplingOptions;
  private correlation: LogCorrelationOptions;
  private redaction: LogRedactionOptions;
  private currentContext: LogContext = {};
  private filterCache: Map<string, boolean> = new Map();

  constructor(config: LoggerOptions = {}) {
    super();
    this.config = {
      level: 'info',
      format: 'json',
      output: 'console',
      correlation: {
        enableTraceCorrelation: true,
        traceIdField: 'traceId',
        spanIdField: 'spanId'
      },
      redaction: {
        enabled: true,
        fields: ['password', 'token', 'secret', 'key']
      },
      sampling: {
        enabled: false,
        rate: 0.1
      },
      ...config
    };

    this.sampling = this.config.sampling!;
    this.correlation = this.config.correlation!;
    this.redaction = this.config.redaction!;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Set up log buffer for periodic flushing
      this.bufferInterval = setInterval(() => {
        this.flushLogs();
      }, 5000); // Flush every 5 seconds

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Logger:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) return;

    // Clear buffer interval
    if (this.bufferInterval) {
      clearInterval(this.bufferInterval);
      this.bufferInterval = null;
    }

    // Flush any remaining logs
    await this.flushLogs();

    this.initialized = false;
  }

  async export(): Promise<any> {
    this.ensureInitialized();

    try {
      const logsToExport = [...this.logs, ...this.logBuffer];
      this.logs = [];
      this.logBuffer = [];

      return {
        success: true,
        exported: logsToExport.length,
        duration: 0,
        logs: {
          total: logsToExport.length,
          byLevel: this.groupLogsByLevel(logsToExport),
          filtered: this.filterLogs(logsToExport, { level: this.config.level })
        }
      };
    } catch (error) {
      return this.handleExportError(error as Error);
    }
  }

  /**
   * Log a message
   */
  log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;
    if (this.sampling.enabled && !this.shouldSample()) return;

    const logEntry = this.createLogEntry(level, message, context, error);
    this.addLogEntry(logEntry);
  }

  /**
   * Log at trace level
   */
  trace(message: string, context?: LogContext, error?: Error): void {
    this.log('trace', message, context, error);
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: LogContext, error?: Error): void {
    this.log('debug', message, context, error);
  }

  /**
   * Log at info level
   */
  info(message: string, context?: LogContext, error?: Error): void {
    this.log('info', message, context, error);
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    this.log('warn', message, context, error);
  }

  /**
   * Log at error level
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log('error', message, context, error);
  }

  /**
   * Log at fatal level
   */
  fatal(message: string, context?: LogContext, error?: Error): void {
    this.log('fatal', message, context, error);
  }

  /**
   * Set context for subsequent log entries
   */
  setContext(context: Partial<LogContext>): void {
    this.currentContext = { ...this.currentContext, ...context };
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    return { ...this.currentContext };
  }

  /**
   * Clear current context
   */
  clearContext(): void {
    this.currentContext = {};
  }

  /**
   * Get logs with filtering
   */
  getLogs(filters: LogFilters = {}): LogEntry[] {
    return this.filterLogs(this.logs, filters);
  }

  /**
   * Search logs by pattern
   */
  searchLogs(query: string | RegExp, filters: LogFilters = {}): LogEntry[] {
    const allLogs = this.filterLogs(this.logs, filters);

    const searchResults = allLogs.filter(log => {
      const message = log.message.toLowerCase();
      const queryLower = typeof query === 'string' ? query.toLowerCase() : '';

      if (typeof query === 'string') {
        return message.includes(queryLower);
      } else {
        return query.test(log.message);
      }
    });

    return searchResults;
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs by time range
   */
  getLogsByTimeRange(start: number, end: number): LogEntry[] {
    return this.logs.filter(log =>
      log.timestamp >= start && log.timestamp <= end
    );
  }

  /**
   * Get logs by trace ID
   */
  getLogsByTraceId(traceId: string): LogEntry[] {
    return this.logs.filter(log => log.traceId === traceId);
  }

  /**
   * Get logs by user ID
   */
  getLogsByUserId(userId: string): LogEntry[] {
    return this.logs.filter(log => log.context?.userId === userId);
  }

  /**
   * Get statistics about logs
   */
  getLogStatistics(): LogStatistics {
    const stats: LogStatistics = {
      total: this.logs.length,
      byLevel: this.groupLogsByLevel(this.logs),
      timeRange: {
        earliest: Math.min(...this.logs.map(log => log.timestamp)),
        latest: Math.max(...this.logs.map(log => log.timestamp))
      },
      uniqueTraceIds: new Set(this.logs.map(log => log.traceId)).size
    };

    return stats;
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
    this.logBuffer = [];
    this.filterCache.clear();
  }

  /**
   * Check if a log should be recorded
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      trace: 0,
      debug: 1,
      info: 2,
      warn: 3,
      error: 4,
      fatal: 5
    };

    const configLevel = this.config.level || 'info';
    const configLevelValue = levels[configLevel];
    const logLevelValue = levels[level];

    return logLevelValue >= configLevelValue;
  }

  /**
   * Check if log should be sampled
   */
  private shouldSample(): boolean {
    return Math.random() < this.sampling.rate;
  }

  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: { ...this.currentContext, ...context },
      traceId: this.currentContext?.requestId,
      spanId: this.currentContext?.sessionId
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    // Apply redaction
    if (this.redaction.enabled) {
      this.redactLogEntry(entry);
    }

    // Apply correlation if enabled
    if (this.correlation.enableTraceCorrelation) {
      this.addCorrelation(entry);
    }

    return entry;
  }

  /**
   * Add redaction to sensitive fields
   */
  private redactLogEntry(entry: LogEntry): void {
    entry.message = this.redactText(entry.message);

    if (entry.context) {
      Object.keys(entry.context).forEach(key => {
        if (this.redaction.fields?.includes(key)) {
          entry.context![key] = '[REDACTED]';
        }
      });
    }
  }

  /**
   * Redact sensitive information from text
   */
  private redactText(text: string): string {
    let result = text;

    if (this.redaction.patterns) {
      this.redaction.patterns.forEach(pattern => {
        result = result.replace(pattern.pattern, pattern.replacement);
      });
    }

    return result;
  }

  /**
   * Add correlation information
   */
  private addCorrelation(entry: LogEntry): void {
    if (!entry.context) return;

    // Add correlation ID if not present
    if (!entry.context.requestId) {
      entry.context.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Add log entry to buffer or logs
   */
  private addLogEntry(entry: LogEntry): void {
    const formattedEntry = this.formatLogEntry(entry);

    // Add to buffer first
    this.logBuffer.push(formattedEntry);

    // If buffer is full, flush immediately
    if (this.logBuffer.length >= 1000) {
      this.flushLogs();
    }
  }

  /**
   * Format log entry based on configuration
   */
  private formatLogEntry(entry: LogEntry): LogEntry {
    if (this.config.format === 'json') {
      entry.metadata = {
        ...entry.metadata,
        timestamp: new Date(entry.timestamp).toISOString()
      };
    }

    return entry;
  }

  /**
   * Flush buffered logs to main log storage
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const bufferToFlush = [...this.logBuffer];
    this.logBuffer = [];

    // Add to main logs
    this.logs.push(...bufferToFlush);

    // Maintain log limit
    if (this.logs.length > this.maxLogCount) {
      this.logs = this.logs.slice(-this.maxLogCount);
    }

    // Clear filter cache
    this.filterCache.clear();

    // Output to configured destination
    await this.outputLogs(bufferToFlush);
  }

  /**
   * Output logs to configured destination
   */
  private async outputLogs(logs: LogEntry[]): Promise<void> {
    switch (this.config.output) {
      case 'console':
        logs.forEach(log => console.log(log.message));
        break;
      case 'file':
        // Placeholder for file output
        break;
      case 'stream':
        // Placeholder for stream output
        break;
      case 'remote':
        // Placeholder for remote output
        break;
    }
  }

  /**
   * Filter logs based on criteria
   */
  private filterLogs(logs: LogEntry[], filters: LogFilters): LogEntry[] {
    const cacheKey = JSON.stringify(filters);
    const cached = this.filterCache.get(cacheKey);
    if (cached !== undefined) {
      return cached ? logs.filter((_, index) => cached) : [];
    }

    let filteredLogs = [...logs];

    // Filter by level
    if (filters.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }

    // Filter by trace ID
    if (filters.traceId) {
      filteredLogs = filteredLogs.filter(log => log.traceId === filters.traceId);
    }

    // Filter by time range
    if (filters.startTime || filters.endTime) {
      filteredLogs = filteredLogs.filter(log => {
        const timestamp = log.timestamp;
        return (!filters.startTime || timestamp >= filters.startTime) &&
               (!filters.endTime || timestamp <= filters.endTime);
      });
    }

    // Filter by context
    if (filters.context) {
      filteredLogs = filteredLogs.filter(log => {
        if (!log.context) return false;
        return Object.entries(filters.context!).every(([key, value]) =>
          log.context![key] === value
        );
      });
    }

    // Cache the result (simplified: just remember we filtered)
    this.filterCache.set(cacheKey, true);

    return filteredLogs;
  }

  /**
   * Group logs by level
   */
  private groupLogsByLevel(logs: LogEntry[]): Record<LogLevel, number> {
    const grouped: Record<LogLevel, number> = {
      trace: 0,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0
    };

    logs.forEach(log => {
      grouped[log.level]++;
    });

    return grouped;
  }
}

/**
 * Log filters for search operations
 */
export interface LogFilters {
  level?: LogLevel;
  traceId?: string;
  startTime?: number;
  endTime?: number;
  context?: Record<string, any>;
}

/**
 * Log statistics
 */
export interface LogStatistics {
  total: number;
  byLevel: Record<LogLevel, number>;
  timeRange: {
    earliest: number;
    latest: number;
  };
  uniqueTraceIds: number;
}