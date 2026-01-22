export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  output?: LogOutput;
  correlation?: LogCorrelationOptions;
  redaction?: LogRedactionOptions;
  sampling?: LogSamplingOptions;
  retention?: LogRetention;
}

export type LogFormat = 'json' | 'text' | 'pretty' | 'csv';

export type LogOutput = 'console' | 'file' | 'stream' | 'remote' | 'memory';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: LogContext;
  error?: ErrorInfo;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  sessionId?: string;
  service?: string;
  version?: string;
  environment?: string;
  [key: string]: unknown;
}

export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  metadata?: Record<string, unknown>;
}

export interface LogCorrelationOptions {
  enableTraceCorrelation: boolean;
  traceIdField?: string;
  spanIdField?: string;
  correlationFields?: string[];
}

export interface LogRedactionOptions {
  enabled: boolean;
  patterns?: RedactionPattern[];
  fields?: string[];
  customPatterns?: Record<string, string>;
}

export interface RedactionPattern {
  pattern: RegExp;
  replacement: string;
  field?: string;
}

export interface LogSamplingOptions {
  enabled: boolean;
  rate?: number;
  minLevel?: LogLevel;
  deterministic?: boolean;
}

export interface LogRetention {
  enabled: boolean;
  maxAge?: number;
  maxSize?: number;
  compression?: boolean;
  rotation?: LogRotation;
}

export interface LogRotation {
  enabled: boolean;
  maxSize?: number;
  maxFiles?: number;
  interval?: string;
}

export interface LogExportOptions {
  format: LogFormat;
  compression?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  filters?: LogFilter[];
}

export interface LogFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startswith' | 'endswith' | 'in';
  value: string | number | string[];
}

export interface LogQuery {
  level?: LogLevel;
  startTime?: number;
  endTime?: number;
  filters?: LogFilter[];
  limit?: number;
  sortBy?: LogSortBy;
  sortOrder?: 'asc' | 'desc';
}

export type LogSortBy = 'timestamp' | 'level' | 'message' | 'custom';

export interface SearchResult {
  total: number;
  logs: LogEntry[];
  hasMore: boolean;
  cursor?: string;
}

export interface LogStream {
  id: string;
  name: string;
  description?: string;
  filters: LogFilter[];
  retention?: LogRetention;
  tags?: string[];
}