export * from './metric-types';
export * from './trace-types';
export * from './log-types';
export * from './alert-types';
export * from './dashboard-types';
export * from './apm-types';
export * from './rum-types';
export * from './business-metrics-types';
export * from './monitoring-types';

// Common utility interfaces
export interface ObservableConfig {
  tracing?: TraceOptions;
  metrics?: {
    enabled: boolean;
    exportInterval?: number;
  };
  logging?: LoggerOptions;
  alerting?: {
    enabled: boolean;
    rules: AlertRule[];
  };
  healthChecks?: {
    enabled: boolean;
    endpoint?: string;
  };
}

export interface ExportResult {
  success: boolean;
  exported: number;
  failed: number;
  duration: number;
  errors?: Error[];
}

export interface TelemetryData {
  traceId?: string;
  metrics: MetricData[];
  logs: LogEntry[];
  metadata: Record<string, unknown>;
}

// System info
export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  uptime: number;
  memoryUsage: MemoryUsage;
  cpuUsage: CpuUsage;
}

export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}

export interface CpuUsage {
  user: number;
  system: number;
  idle: number;
  total: number;
}