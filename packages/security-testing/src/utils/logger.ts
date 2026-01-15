/**
 * Cloudflare Worker compatible logging utility for security scanning operations
 */

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  enableColors: boolean;
  enableTimestamp: boolean;
  context?: Record<string, unknown>;
}

export class Logger {
  private level: string;
  private context: Record<string, unknown>;
  private scanId?: string;

  constructor(config: LoggerConfig) {
    this.level = config.level;
    this.context = config.context || {};
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
    this.log('debug', message, ...args);
  }

  public info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  private log(level: string, message: string, ...args: unknown[]): void {
    if (this.shouldLog(level)) {
      const logData = {
        level,
        message,
        timestamp: new Date().toISOString(),
        context: this.context,
        scanId: this.scanId,
        ...(args.length > 0 && args[0] && typeof args[0] === 'object' ? args[0] : {})
      };

      if (typeof console !== 'undefined') {
        if (level === 'error') {
          console.error(logData);
        } else if (level === 'warn') {
          console.warn(logData);
        } else if (level === 'debug') {
          console.debug(logData);
        } else {
          console.log(logData);
        }
      }
    }
  }

  private shouldLog(level: string): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level as keyof typeof levels] >= levels[this.level as keyof typeof levels];
  }

  public metric(name: string, value: number, labels?: Record<string, string>): void {
    this.info('Metric recorded', {
      metric: name,
      value,
      labels,
      ...this.context,
    });
  }

  public audit(action: string, details: Record<string, unknown>): void {
    this.info('Audit event', {
      action,
      ...details,
      timestamp: new Date().toISOString(),
      ...this.context,
    });
  }

  public static createDefault(scanId?: string): Logger {
    return new Logger({
      level: 'info',
      format: 'text',
      enableColors: true,
      enableTimestamp: true,
      context: scanId ? { scanId } : undefined,
    });
  }
}

export default Logger;