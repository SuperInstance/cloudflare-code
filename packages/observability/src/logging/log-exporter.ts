/**
 * Log exporter for various backends
 */

import { LogEntry, LogLevel } from '../types';

export interface LogExportOptions {
  format?: 'json' | 'csv' | 'ndjson';
  compress?: boolean;
  includeMetadata?: boolean;
}

export class LogExporter {
  /**
   * Export logs to JSON format
   */
  exportToJSON(entries: LogEntry[], pretty: boolean = false): string {
    const data = {
      format: 'json',
      version: '1.0.0',
      timestamp: Date.now(),
      count: entries.length,
      entries: entries.map((entry) => this.serializeLogEntry(entry)),
    };

    return JSON.stringify(data, null, pretty ? 2 : 0);
  }

  /**
   * Export logs to newline-delimited JSON (NDJSON)
   */
  exportToNDJSON(entries: LogEntry[]): string {
    return entries
      .map((entry) => JSON.stringify(this.serializeLogEntry(entry)))
      .join('\n');
  }

  /**
   * Export logs to CSV format
   */
  exportToCSV(entries: LogEntry[]): string {
    const headers = [
      'timestamp',
      'level',
      'message',
      'context',
      'traceId',
      'spanId',
      'userId',
      'requestId',
      'attributes',
    ];

    const rows = entries.map((entry) => [
      entry.timestamp,
      entry.level,
      this.escapeCsv(entry.message),
      entry.context || '',
      entry.traceId || '',
      entry.spanId || '',
      entry.attributes['user.id'] || '',
      entry.requestId || '',
      this.escapeCsv(JSON.stringify(entry.attributes)),
    ]);

    const csvRows = [headers.join(','), ...rows.map((row) => row.join(','))];
    return csvRows.join('\n');
  }

  /**
   * Send logs to remote endpoint
   */
  async sendToEndpoint(
    entries: LogEntry[],
    endpoint: string,
    format: 'json' | 'ndjson',
    apiKey?: string
  ): Promise<boolean> {
    try {
      const body =
        format === 'json'
          ? this.exportToJSON(entries)
          : this.exportToNDJSON(entries);

      const headers: Record<string, string> = {
        'Content-Type':
          format === 'json' ? 'application/json' : 'application/x-ndjson',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send logs:', error);
      return false;
    }
  }

  /**
   * Serialize log entry for export
   */
  private serializeLogEntry(entry: LogEntry): any {
    return {
      timestamp: entry.timestamp,
      timestamp_iso: new Date(entry.timestamp).toISOString(),
      level: entry.level,
      message: entry.message,
      context: entry.context,
      trace_id: entry.traceId,
      span_id: entry.spanId,
      user_id: entry.attributes['user.id'],
      request_id: entry.requestId,
      attributes: entry.attributes,
      error: entry.error,
      stack_trace: entry.stackTrace,
    };
  }

  /**
   * Escape CSV value
   */
  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Export logs by time range
   */
  exportByTimeRange(
    entries: LogEntry[],
    startTime: number,
    endTime: number,
    format: 'json' | 'csv' | 'ndjson' = 'json'
  ): string {
    const filtered = entries.filter(
      (entry) => entry.timestamp >= startTime && entry.timestamp <= endTime
    );

    switch (format) {
      case 'json':
        return this.exportToJSON(filtered);
      case 'csv':
        return this.exportToCSV(filtered);
      case 'ndjson':
        return this.exportToNDJSON(filtered);
    }
  }

  /**
   * Export logs by level
   */
  exportByLevel(
    entries: LogEntry[],
    minLevel: LogLevel,
    format: 'json' | 'csv' | 'ndjson' = 'json'
  ): string {
    const levels = [
      LogLevel.TRACE,
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.FATAL,
    ];

    const filtered = entries.filter(
      (entry) => levels.indexOf(entry.level) >= levels.indexOf(minLevel)
    );

    switch (format) {
      case 'json':
        return this.exportToJSON(filtered);
      case 'csv':
        return this.exportToCSV(filtered);
      case 'ndjson':
        return this.exportToNDJSON(filtered);
    }
  }

  /**
   * Export logs by trace
   */
  exportByTrace(
    entries: LogEntry[],
    traceId: string,
    format: 'json' | 'csv' | 'ndjson' = 'json'
  ): string {
    const filtered = entries.filter((entry) => entry.traceId === traceId);

    switch (format) {
      case 'json':
        return this.exportToJSON(filtered);
      case 'csv':
        return this.exportToCSV(filtered);
      case 'ndjson':
        return this.exportToNDJSON(filtered);
    }
  }
}
