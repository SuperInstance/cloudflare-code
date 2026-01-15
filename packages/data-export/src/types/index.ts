export interface ExportRecord {
  [key: string]: any;
}

export interface ExportOptions {
  format: ExportFormat;
  delimiter?: string;
  prettyPrint?: boolean;
  compression?: CompressionType;
  sheets?: string[];
  includeHeaders?: boolean;
  sheetName?: string;
}

export interface BatchOptions {
  chunkSize: number;
  maxChunks?: number;
  memoryLimit?: number;
  progressInterval?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface SchedulerOptions {
  cronExpression?: string;
  schedule?: ScheduleConfig;
  timezone?: string;
  maxConcurrent?: number;
  cleanupInterval?: number;
}

export interface ScheduleConfig {
  frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

export interface ProcessorOptions {
  filters?: Filter[];
  transformations?: Transformation[];
  schema?: Schema;
  columns?: string[];
  aggregation?: Aggregation;
}

export interface Filter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startsWith' | 'endsWith';
  value: any;
}

export interface Transformation {
  field: string;
  type: 'rename' | 'format' | 'calculate' | 'map' | 'filter' | 'split';
  options: any;
}

export interface Schema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'date' | 'object';
    required?: boolean;
    format?: string;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface Aggregation {
  type: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'group';
  field?: string;
  groupBy?: string[];
}

export interface ExportJob {
  id: string;
  name: string;
  data: ExportRecord[];
  options: ExportOptions;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  result?: ExportResult;
}

export interface ExportResult {
  format: ExportFormat;
  size: number;
  recordCount: number;
  path: string;
  metadata?: Record<string, any>;
}

export interface BatchResult {
  totalRecords: number;
  processedRecords: number;
  chunks: number;
  duration: number;
  results: ExportResult[];
  errors: Error[];
}

export interface ScheduledExport {
  id: string;
  name: string;
  config: SchedulerOptions;
  data: ExportRecord[] | (() => Promise<ExportRecord[]>);
  lastRun?: Date;
  nextRun?: Date;
  status: 'active' | 'paused' | 'completed';
  history: ExportJob[];
}

export type ExportFormat = 'csv' | 'json' | 'parquet' | 'excel';
export type CompressionType = 'none' | 'gzip' | 'snappy' | 'brotli';

export interface FormatEngine {
  export(data: ExportRecord[], options: ExportOptions): Promise<ExportResult>;
  validate(data: ExportRecord[], options: ExportOptions): Promise<boolean>;
  getSupportedFormats(): ExportFormat[];
}

export interface BatchExporter {
  export(data: ExportRecord[], options: ExportOptions, batchOptions?: BatchOptions): Promise<BatchResult>;
  cancel(jobId: string): boolean;
  getStatus(jobId: string): ExportJob | null;
}

export interface Scheduler {
  schedule(config: ScheduledExport): string;
  unschedule(id: string): boolean;
  getSchedule(id: string): ScheduledExport | null;
  listSchedules(): ScheduledExport[];
  pause(id: string): boolean;
  resume(id: string): boolean;
}

export interface DataProcessor {
  process(data: ExportRecord[], options: ProcessorOptions): Promise<ExportRecord[]>;
  validate(data: ExportRecord[], schema: Schema): Promise<boolean>;
  transform(data: ExportRecord[], transformations: Transformation[]): Promise<ExportRecord[]>;
  filter(data: ExportRecord[], filters: Filter[]): Promise<ExportRecord[]>;
}

export interface ExportAnalytics {
  getExportStats(timeRange: 'hour' | 'day' | 'week' | 'month'): Promise<ExportStats>;
  getFormatUsage(): Promise<FormatUsageStats>;
  getErrorReports(): Promise<ErrorReport[]>;
}

export interface ExportStats {
  totalExports: number;
  totalRecords: number;
  averageProcessingTime: number;
  successRate: number;
  formatBreakdown: Record<ExportFormat, number>;
}

export interface FormatUsageStats {
  [key in ExportFormat]: {
    count: number;
    totalSize: number;
    averageSize: number;
  };
}

export interface ErrorReport {
  timestamp: Date;
  errorType: string;
  errorMessage: string;
  jobId: string;
  format: ExportFormat;
  recordCount: number;
}

export interface NotificationConfig {
  webhook?: string;
  email?: {
    to: string[];
    subject?: string;
    template?: string;
  };
  slack?: {
    webhook: string;
    channel?: string;
  };
  discord?: {
    webhook: string;
    channel?: string;
  };
}

export interface ExportNotification {
  jobId: string;
  status: 'completed' | 'failed' | 'cancelled';
  recordCount: number;
  fileSize: number;
  duration: number;
  error?: string;
  notifications: NotificationConfig;
}