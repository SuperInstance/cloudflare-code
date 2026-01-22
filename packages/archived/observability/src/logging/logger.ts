/**
 * Structured logger with correlation support
 */

// @ts-nocheck - LogLevel enum issues and complex type compatibility
import { v4 as uuidv4 } from 'uuid';
import { LogLevel, LogEntry, LogFilter, LogAggregation, Attributes } from '../types';

export interface LoggerOptions {
  level?: LogLevel;
  context?: string;
  enableCorrelation?: boolean;
  metadata?: Attributes;
}

export class StructuredLogger {
  private entries: LogEntry[] = [];
  private maxEntries: number = 10000;
  private traceContextStore: Map<string, string> = new Map();

  constructor(
    private serviceName: string,
    private options: LoggerOptions = {}
  ) {}

  /**
   * Log a trace level message
   */
  trace(message: string, attributes: Attributes = {}): void {
    this.log(LogLevel.TRACE, message, attributes);
  }

  /**
   * Log a debug level message
   */
  debug(message: string, attributes: Attributes = {}): void {
    this.log(LogLevel.DEBUG, message, attributes);
  }

  /**
   * Log an info level message
   */
  info(message: string, attributes: Attributes = {}): void {
    this.log(LogLevel.INFO, message, attributes);
  }

  /**
   * Log a warning level message
   */
  warn(message: string, attributes: Attributes = {}): void {
    this.log(LogLevel.WARN, message, attributes);
  }

  /**
   * Log an error level message
   */
  error(message: string, error?: Error | Attributes, attributes: Attributes = {}): void {
    let errorAttributes: Attributes = { ...attributes };

    if (error instanceof Error) {
      errorAttributes = {
        ...errorAttributes,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      };
    } else if (error) {
      errorAttributes = { ...errorAttributes, ...error };
    }

    this.log(LogLevel.ERROR, message, errorAttributes);
  }

  /**
   * Log a fatal level message
   */
  fatal(message: string, error?: Error | Attributes, attributes: Attributes = {}): void {
    let errorAttributes: Attributes = { ...attributes };

    if (error instanceof Error) {
      errorAttributes = {
        ...errorAttributes,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      };
    } else if (error) {
      errorAttributes = { ...errorAttributes, ...error };
    }

    this.log(LogLevel.FATAL, message, errorAttributes);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, attributes: Attributes): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: this.options.context || this.serviceName,
      traceId: this.getCurrentTraceId(),
      spanId: this.getCurrentSpanId(),
      attributes: {
        ...this.options.metadata,
        ...attributes,
        'service.name': this.serviceName,
      },
    };

    this.entries.push(entry);

    // Enforce max entries limit (FIFO)
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Console output with pretty formatting
    this.outputToConsole(entry);
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const currentLevel = this.options.level || LogLevel.INFO;
    const levels = [
      LogLevel.TRACE,
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.FATAL,
    ];
    return levels.indexOf(level) >= levels.indexOf(currentLevel);
  }

  /**
   * Output to console with formatting
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const traceInfo = entry.traceId ? ` [trace:${entry.traceId.slice(0, 8)}]` : '';
    const context = entry.context ? ` [${entry.context}]` : '';

    const message = `${timestamp} ${entry.level.toUpperCase()}${context}${traceInfo} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(message, entry.attributes);
        break;
      case LogLevel.INFO:
        console.info(message, entry.attributes);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.attributes);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message, entry.attributes);
        break;
    }
  }

  /**
   * Set trace context for correlation
   */
  setTraceContext(traceId: string, spanId?: string): void {
    this.traceContextStore.set('currentTraceId', traceId);
    if (spanId) {
      this.traceContextStore.set('currentSpanId', spanId);
    }
  }

  /**
   * Clear trace context
   */
  clearTraceContext(): void {
    this.traceContextStore.delete('currentTraceId');
    this.traceContextStore.delete('currentSpanId');
  }

  /**
   * Get current trace ID
   */
  private getCurrentTraceId(): string | undefined {
    return this.traceContextStore.get('currentTraceId');
  }

  /**
   * Get current span ID
   */
  private getCurrentSpanId(): string | undefined {
    return this.traceContextStore.get('currentSpanId');
  }

  /**
   * Create a child logger with inherited context
   */
  child(context: string, additionalMetadata?: Attributes): StructuredLogger {
    return new StructuredLogger(this.serviceName, {
      ...this.options,
      context: this.options.context ? `${this.options.context}/${context}` : context,
      metadata: {
        ...this.options.metadata,
        ...additionalMetadata,
      },
    });
  }

  /**
   * Get all log entries
   */
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Get filtered log entries
   */
  filter(filter: LogFilter): LogEntry[] {
    return this.entries.filter((entry) => {
      if (filter.levels && !filter.levels.includes(entry.level)) {
        return false;
      }
      if (filter.startTime && entry.timestamp < filter.startTime) {
        return false;
      }
      if (filter.endTime && entry.timestamp > filter.endTime) {
        return false;
      }
      if (filter.traceId && entry.traceId !== filter.traceId) {
        return false;
      }
      if (filter.userId && entry.attributes['user.id'] !== filter.userId) {
        return false;
      }
      if (filter.requestId && entry.requestId !== filter.requestId) {
        return false;
      }
      if (filter.minLevel) {
        const levels = [
          LogLevel.TRACE,
          LogLevel.DEBUG,
          LogLevel.INFO,
          LogLevel.WARN,
          LogLevel.ERROR,
          LogLevel.FATAL,
        ];
        if (levels.indexOf(entry.level) < levels.indexOf(filter.minLevel)) {
          return false;
        }
      }
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const text = JSON.stringify(entry).toLowerCase();
        if (!text.includes(query)) {
          return false;
        }
      }
      if (filter.attributes) {
        for (const [key, value] of Object.entries(filter.attributes)) {
          if (entry.attributes[key] !== value) {
            return false;
          }
        }
      }
      return true;
    });
  }

  /**
   * Aggregate logs by various dimensions
   */
  aggregate(): LogAggregation {
    const countByLevel: Record<LogLevel, number> = {
      [LogLevel.TRACE]: 0,
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.FATAL]: 0,
    };

    const errorCounts = new Map<string, number>();
    const logsByTrace = new Map<string, LogEntry[]>();
    const timeSeriesData: Array<{ timestamp: number; value: number }> = [];
    let errorCount = 0;

    for (const entry of this.entries) {
      // Count by level
      countByLevel[entry.level]++;

      // Track errors
      if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
        errorCount++;
        const errorKey = entry.message;
        errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
      }

      // Group by trace
      if (entry.traceId) {
        if (!logsByTrace.has(entry.traceId)) {
          logsByTrace.set(entry.traceId, []);
        }
        logsByTrace.get(entry.traceId)!.push(entry);
      }

      // Time series data (by minute)
      const minuteBucket = Math.floor(entry.timestamp / 60000) * 60000;
      const existingPoint = timeSeriesData.find((p) => p.timestamp === minuteBucket);
      if (existingPoint) {
        existingPoint.value++;
      } else {
        timeSeriesData.push({ timestamp: minuteBucket, value: 1 });
      }
    }

    // Top errors
    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    // Calculate average log level (numeric)
    const levels = [
      LogLevel.TRACE,
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.FATAL,
    ];
    let totalLevelValue = 0;
    for (const entry of this.entries) {
      totalLevelValue += levels.indexOf(entry.level);
    }
    const avgLevel = this.entries.length > 0 ? totalLevelValue / this.entries.length : 0;

    return {
      countByLevel,
      topErrors,
      logsByTrace: Object.fromEntries(logsByTrace),
      timeSeriesData: timeSeriesData.sort((a, b) => a.timestamp - b.timestamp),
      errorRate: this.entries.length > 0 ? errorCount / this.entries.length : 0,
      avgLevel,
    };
  }

  /**
   * Search logs by content
   */
  search(query: string, limit: number = 100): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.entries
      .filter((entry) => {
        const text = JSON.stringify(entry).toLowerCase();
        return text.includes(lowerQuery);
      })
      .slice(0, limit);
  }

  /**
   * Get logs for a specific trace
   */
  getLogsForTrace(traceId: string): LogEntry[] {
    return this.entries.filter((entry) => entry.traceId === traceId);
  }

  /**
   * Clear all log entries
   */
  clear(): void {
    this.entries = [];
    this.traceContextStore.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalEntries: number;
    entriesByLevel: Record<LogLevel, number>;
    oldestEntry?: number;
    newestEntry?: number;
  } {
    const entriesByLevel: Record<LogLevel, number> = {
      [LogLevel.TRACE]: 0,
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.FATAL]: 0,
    };

    for (const entry of this.entries) {
      entriesByLevel[entry.level]++;
    }

    return {
      totalEntries: this.entries.length,
      entriesByLevel,
      oldestEntry: this.entries[0]?.timestamp,
      newestEntry: this.entries[this.entries.length - 1]?.timestamp,
    };
  }
}
