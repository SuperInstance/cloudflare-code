/**
 * Log Parser - Parse various log formats into structured log entries
 */

import { LogEntry, LogLevel, LogMetadata, PartialLogEntry } from '../types';
import { createLogger } from '../utils/logger';
import { sanitizeMetadata } from '../utils/helpers';

export interface ParseResult {
  success: boolean;
  entry?: PartialLogEntry;
  error?: string;
}

export interface ParserOptions {
  format?: LogFormat;
  encoding?: BufferEncoding;
  strictMode?: boolean;
  preserveOriginal?: boolean;
}

export enum LogFormat {
  JSON = 'json',
  COMMON_LOG_FORMAT = 'clf',
  COMBINED_LOG_FORMAT = 'combined',
  SYSLOG = 'syslog',
  APACHE = 'apache',
  NGINX = 'nginx',
  TEXT = 'text',
  AUTO = 'auto',
}

/**
 * Log Parser class
 */
export class LogParser {
  private logger = createLogger({ component: 'LogParser' });
  private options: Required<ParserOptions>;

  constructor(options: ParserOptions = {}) {
    this.options = {
      format: options.format ?? LogFormat.AUTO,
      encoding: options.encoding ?? 'utf8',
      strictMode: options.strictMode ?? false,
      preserveOriginal: options.preserveOriginal ?? false,
    };
  }

  /**
   * Parse a log line or object
   */
  public parse(input: string | object | Buffer): ParseResult {
    try {
      // Handle buffer input
      if (Buffer.isBuffer(input)) {
        input = input.toString(this.options.encoding);
      }

      // Handle string input
      if (typeof input === 'string') {
        return this.parseString(input.trim());
      }

      // Handle object input
      if (typeof input === 'object') {
        return this.parseObject(input);
      }

      return {
        success: false,
        error: `Unsupported input type: ${typeof input}`,
      };
    } catch (error) {
      this.logger.error('Failed to parse log', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parse error',
      };
    }
  }

  /**
   * Parse multiple log lines
   */
  public parseMany(inputs: Array<string | object | Buffer>): ParseResult[] {
    return inputs.map((input) => this.parse(input));
  }

  /**
   * Parse a string log line
   */
  private parseString(input: string): ParseResult {
    // Try to detect format if auto
    const format = this.detectFormat(input);

    switch (format) {
      case LogFormat.JSON:
        return this.parseJson(input);
      case LogFormat.COMMON_LOG_FORMAT:
        return this.parseCommonLogFormat(input);
      case LogFormat.COMBINED_LOG_FORMAT:
        return this.parseCombinedLogFormat(input);
      case LogFormat.SYSLOG:
        return this.parseSyslog(input);
      case LogFormat.TEXT:
        return this.parseText(input);
      default:
        return {
          success: false,
          error: `Unknown log format for: ${input.substring(0, 100)}`,
        };
    }
  }

  /**
   * Detect log format from string
   */
  private detectFormat(input: string): LogFormat {
    // Check for JSON
    if (input.startsWith('{') && input.endsWith('}')) {
      return LogFormat.JSON;
    }

    // Check for syslog priority
    if (/^<[0-9]+>/.test(input)) {
      return LogFormat.SYSLOG;
    }

    // Check for common log format
    if (/^\S+ \S+ \S+ \[[^\]]+\] "\S+ \S+ \S+" \d+ \d+$/.test(input)) {
      return LogFormat.COMMON_LOG_FORMAT;
    }

    // Check for combined log format
    if (/^\S+ \S+ \S+ \[[^\]]+\] "\S+ \S+ \S+" \d+ \d+ "\S*" "\S*"$/.
test(input)) {
      return LogFormat.COMBINED_LOG_FORMAT;
    }

    // Default to text
    return LogFormat.TEXT;
  }

  /**
   * Parse JSON log format
   */
  private parseJson(input: string): ParseResult {
    try {
      const parsed = JSON.parse(input);
      return this.parseObject(parsed);
    } catch (error) {
      return {
        success: false,
        error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse object into log entry
   */
  private parseObject(obj: any): ParseResult {
    try {
      const entry: PartialLogEntry = {};

      // Extract standard fields
      if (obj.message || obj.msg) {
        entry.message = obj.message || obj.msg;
      } else if (obj.text) {
        entry.message = obj.text;
      } else {
        // If no message field, use entire object as message
        entry.message = JSON.stringify(obj);
      }

      // Parse level
      if (obj.level || obj.severity) {
        const levelStr = (obj.level || obj.severity).toString().toLowerCase();
        const levelMap: Record<string, LogLevel> = {
          trace: LogLevel.TRACE,
          debug: LogLevel.DEBUG,
          info: LogLevel.INFO,
          warn: LogLevel.WARN,
          warning: LogLevel.WARN,
          error: LogLevel.ERROR,
          err: LogLevel.ERROR,
          fatal: LogLevel.FATAL,
          critical: LogLevel.FATAL,
        };
        entry.level = levelMap[levelStr] ?? LogLevel.INFO;
      }

      // Parse timestamp
      if (obj.timestamp || obj.time || obj['@timestamp']) {
        const timestamp = obj.timestamp || obj.time || obj['@timestamp'];
        if (typeof timestamp === 'number') {
          entry.timestamp = timestamp;
        } else if (typeof timestamp === 'string') {
          entry.timestamp = new Date(timestamp).getTime();
        }
      }

      // Parse service
      if (obj.service || obj.app || obj.application) {
        entry.service = obj.service || obj.app || obj.application;
      }

      // Parse environment
      if (obj.env || obj.environment) {
        entry.environment = obj.env || obj.environment;
      }

      // Parse host
      if (obj.host || obj.hostname) {
        entry.host = obj.host || obj.hostname;
      }

      // Parse trace context
      if (obj.traceId || obj.trace_id) {
        entry.traceId = obj.traceId || obj.trace_id;
      }
      if (obj.spanId || obj.span_id) {
        entry.spanId = obj.spanId || obj.span_id;
      }

      // Extract remaining fields as metadata
      const metadata: LogMetadata = {};
      const excludeFields = new Set([
        'message',
        'msg',
        'text',
        'level',
        'severity',
        'timestamp',
        'time',
        '@timestamp',
        'service',
        'app',
        'application',
        'env',
        'environment',
        'host',
        'hostname',
        'traceId',
        'trace_id',
        'spanId',
        'span_id',
      ]);

      for (const [key, value] of Object.entries(obj)) {
        if (!excludeFields.has(key)) {
          metadata[key] = value as any;
        }
      }

      if (Object.keys(metadata).length > 0) {
        entry.metadata = sanitizeMetadata(metadata);
      }

      return { success: true, entry };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse object: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse Common Log Format (CLF)
   * Format: host ident authuser date request status bytes
   * Example: 127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326
   */
  private parseCommonLogFormat(input: string): ParseResult {
    const regex =
      /^(\S+) (\S+) (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+)$/;
    const match = input.match(regex);

    if (!match) {
      return {
        success: false,
        error: 'Input does not match Common Log Format',
      };
    }

    const [, host, ident, authuser, date, method, path, protocol, status, bytes] = match;

    return {
      success: true,
      entry: {
        message: `${method} ${path} ${protocol}`,
        level: parseInt(status) >= 400 ? LogLevel.ERROR : LogLevel.INFO,
        timestamp: this.parseHttpDate(date),
        metadata: {
          host,
          ident,
          user: authuser,
          method,
          path,
          protocol,
          status: parseInt(status),
          bytes: parseInt(bytes),
        },
      },
    };
  }

  /**
   * Parse Combined Log Format
   * Format: CLF + "referer" "user-agent"
   * Example: 127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326 "http://www.example.com/start.html" "Mozilla/5.0"
   */
  private parseCombinedLogFormat(input: string): ParseResult {
    const regex =
      /^(\S+) (\S+) (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/;
    const match = input.match(regex);

    if (!match) {
      return {
        success: false,
        error: 'Input does not match Combined Log Format',
      };
    }

    const [, host, ident, authuser, date, method, path, protocol, status, bytes, referer, userAgent] =
      match;

    return {
      success: true,
      entry: {
        message: `${method} ${path} ${protocol}`,
        level: parseInt(status) >= 400 ? LogLevel.ERROR : LogLevel.INFO,
        timestamp: this.parseHttpDate(date),
        metadata: {
          host,
          ident,
          user: authuser,
          method,
          path,
          protocol,
          status: parseInt(status),
          bytes: parseInt(bytes),
          referer: referer !== '-' ? referer : undefined,
          userAgent: userAgent !== '-' ? userAgent : undefined,
        },
      },
    };
  }

  /**
   * Parse Syslog format (RFC 3164)
   * Format: <priority>timestamp hostname tag message
   * Example: <34>Oct 11 22:14:15 mymachine su: 'su root' failed for dbz on /dev/pts/8
   */
  private parseSyslog(input: string): ParseResult {
    const priorityRegex = /^<(\d+)>(.*)$/;
    const priorityMatch = input.match(priorityRegex);

    if (!priorityMatch) {
      return {
        success: false,
        error: 'Invalid syslog format: missing priority',
      };
    }

    const [, priorityStr, rest] = priorityMatch;
    const priority = parseInt(priorityStr);
    const severity = priority & 0x07;
    const facility = priority >> 3;

    // Map syslog severity to log levels
    const severityToLevel: Record<number, LogLevel> = {
      0: LogLevel.ERROR, // Emergency
      1: LogLevel.ERROR, // Alert
      2: LogLevel.ERROR, // Critical
      3: LogLevel.ERROR, // Error
      4: LogLevel.WARN, // Warning
      5: LogLevel.INFO, // Notice
      6: LogLevel.INFO, // Informational
      7: LogLevel.DEBUG, // Debug
    };

    // Parse the rest (simplified)
    const parts = rest.split(' ');
    if (parts.length < 4) {
      return {
        success: false,
        error: 'Invalid syslog format: insufficient fields',
      };
    }

    const timestamp = parts.slice(0, 3).join(' ');
    const hostname = parts[3];
    const tag = parts[4]?.replace(/:$/, '') ?? '';
    const message = parts.slice(5).join(' ');

    return {
      success: true,
      entry: {
        message: message || tag,
        level: severityToLevel[severity] ?? LogLevel.INFO,
        timestamp: this.parseSyslogTimestamp(timestamp),
        host: hostname,
        metadata: {
          facility,
          severity,
          tag,
        },
      },
    };
  }

  /**
   * Parse plain text log
   */
  private parseText(input: string): ParseResult {
    // Extract common patterns
    const levelMatch =
      /\b(trace|debug|info|warn|warning|error|err|fatal|critical)\b/i.exec(input);
    const timestampMatch =
      /\b(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)\b/.exec(input);
    const hostMatch = /\b(host|hostname|server)[:=]\s*(\S+)/i.exec(input);
    const serviceMatch = /\b(service|app|application)[:=]\s*(\S+)/i.exec(input);

    const entry: PartialLogEntry = {
      message: input,
    };

    if (levelMatch) {
      const levelStr = levelMatch[1].toLowerCase();
      const levelMap: Record<string, LogLevel> = {
        trace: LogLevel.TRACE,
        debug: LogLevel.DEBUG,
        info: LogLevel.INFO,
        warn: LogLevel.WARN,
        warning: LogLevel.WARN,
        error: LogLevel.ERROR,
        err: LogLevel.ERROR,
        fatal: LogLevel.FATAL,
        critical: LogLevel.FATAL,
      };
      entry.level = levelMap[levelStr] ?? LogLevel.INFO;
    }

    if (timestampMatch) {
      entry.timestamp = new Date(timestampMatch[1]).getTime();
    }

    if (hostMatch) {
      entry.host = hostMatch[2];
    }

    if (serviceMatch) {
      entry.service = serviceMatch[2];
    }

    return { success: true, entry };
  }

  /**
   * Parse HTTP date format
   */
  private parseHttpDate(dateStr: string): number {
    // Format: 10/Oct/2000:13:55:36 -0700
    const parts = dateStr.split(' ');
    if (parts.length < 2) {
      return Date.now();
    }

    const [date, time, zone] = parts;

    // Parse date (10/Oct/2000)
    const [day, month, year] = date.split('/');
    const monthMap: Record<string, number> = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };

    // Parse time (13:55:36)
    const [hours, minutes, seconds] = time.split(':');

    // Create date
    const parsedDate = new Date(
      parseInt(year),
      monthMap[month] ?? 0,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );

    // Apply timezone
    if (zone) {
      const offset = parseInt(zone);
      parsedDate.setMinutes(parsedDate.getMinutes() - offset);
    }

    return parsedDate.getTime();
  }

  /**
   * Parse syslog timestamp
   */
  private parseSyslogTimestamp(timestampStr: string): number {
    // Format: Oct 11 22:14:15
    const currentYear = new Date().getFullYear();
    const parsed = new Date(`${timestampStr} ${currentYear}`);
    return parsed.getTime();
  }

  /**
   * Update parser options
   */
  public updateOptions(options: Partial<ParserOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  public getOptions(): Required<ParserOptions> {
    return { ...this.options };
  }
}

/**
 * Create a log parser instance
 */
export function createLogParser(options?: ParserOptions): LogParser {
  return new LogParser(options);
}
