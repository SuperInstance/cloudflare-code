/**
 * Security Logger
 * Centralized logging for security events and violations
 */

import type { SecurityViolation, SecurityEvent, SeverityLevel } from '../types';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  violation?: SecurityViolation;
  event?: SecurityEvent;
  metadata?: Record<string, any>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class SecurityLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number;
  private enableConsole: boolean;
  private minLevel: LogLevel;

  constructor(options: {
    maxLogs?: number;
    enableConsole?: boolean;
    minLevel?: LogLevel;
  } = {}) {
    this.maxLogs = options.maxLogs || 10000;
    this.enableConsole = options.enableConsole ?? true;
    this.minLevel = options.minLevel || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private log(level: LogLevel, message: string, data?: {
    violation?: SecurityViolation;
    event?: SecurityEvent;
    metadata?: Record<string, any>;
  }): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      ...data
    };

    this.logs.push(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging
    if (this.enableConsole) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[Security:${level.toUpperCase()}]`, message, data);
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, { metadata });
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, { metadata });
  }

  warn(message: string, violation?: SecurityViolation): void {
    this.log('warn', message, { violation });
  }

  error(message: string, violation?: SecurityViolation): void {
    this.log('error', message, { violation });
  }

  violation(violation: SecurityViolation): void {
    const level: LogLevel = violation.severity === 'critical' || violation.severity === 'high'
      ? 'error'
      : violation.severity === 'medium' ? 'warn' : 'info';
    this.log(level, `Security violation: ${violation.type}`, { violation });
  }

  event(event: SecurityEvent): void {
    const level: LogLevel = event.severity === 'critical' || event.severity === 'high'
      ? 'error'
      : event.severity === 'medium' ? 'warn' : 'info';
    this.log(level, `Security event: ${event.type}`, { event });
  }

  getLogs(filters?: {
    level?: LogLevel;
    type?: string;
    severity?: SeverityLevel;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (filters?.level) {
      filtered = filtered.filter(log => log.level === filters.level);
    }

    if (filters?.type) {
      filtered = filtered.filter(log =>
        log.violation?.type === filters.type || log.event?.type === filters.type
      );
    }

    if (filters?.severity) {
      filtered = filtered.filter(log =>
        log.violation?.severity === filters.severity || log.event?.severity === filters.severity
      );
    }

    if (filters?.startTime) {
      filtered = filtered.filter(log => log.timestamp >= filters.startTime!);
    }

    if (filters?.endTime) {
      filtered = filtered.filter(log => log.timestamp <= filters.endTime!);
    }

    if (filters?.limit) {
      filtered = filtered.slice(-filters.limit);
    }

    return filtered;
  }

  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byType: Record<string, number>;
    bySeverity: Record<SeverityLevel, number>;
  } {
    const stats = {
      total: this.logs.length,
      byLevel: {} as Record<LogLevel, number>,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<SeverityLevel, number>
    };

    for (const log of this.logs) {
      // Count by level
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

      // Count by type
      if (log.violation) {
        stats.byType[log.violation.type] = (stats.byType[log.violation.type] || 0) + 1;
        stats.bySeverity[log.violation.severity] = (stats.bySeverity[log.violation.severity] || 0) + 1;
      } else if (log.event) {
        stats.byType[log.event.type] = (stats.byType[log.event.type] || 0) + 1;
        stats.bySeverity[log.event.severity] = (stats.bySeverity[log.event.severity] || 0) + 1;
      }
    }

    return stats;
  }

  clear(): void {
    this.logs = [];
  }

  export(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    } else if (format === 'csv') {
      const headers = ['timestamp', 'level', 'message', 'type', 'severity', 'blocked'];
      const rows = this.logs.map(log => [
        log.timestamp,
        log.level,
        `"${log.message}"`,
        log.violation?.type || log.event?.type || '',
        log.violation?.severity || log.event?.severity || '',
        log.violation?.blocked ?? ''
      ]);
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
    return '';
  }
}

// Singleton instance
export const securityLogger = new SecurityLogger();
