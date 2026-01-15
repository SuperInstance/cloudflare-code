export interface ImportConfig {
  batchSize?: number;
  timeout?: number;
  maxRetries?: number;
  conflictResolution?: ConflictResolutionStrategy;
  validationRules?: ValidationRule[];
  transformations?: TransformationRule[];
}

export interface ImportJob {
  id: string;
  name: string;
  source: DataSource;
  config: ImportConfig;
  status: JobStatus;
  progress: Progress;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface DataSource {
  type: DataSourceType;
  format: DataFormat;
  path: string;
  options?: Record<string, any>;
}

export interface ImportRecord {
  id: string;
  data: any;
  metadata: Record<string, any>;
  validation?: ValidationResult;
  transformations?: any;
  status: RecordStatus;
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
  value?: any;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  value?: any;
}

export interface TransformationRule {
  target: string;
  source?: string;
  type: 'mapping' | 'conversion' | 'normalization' | 'enrichment';
  options?: Record<string, any>;
}

export interface ValidationRule {
  field: string;
  type: ValidationType;
  required?: boolean;
  options?: Record<string, any>;
  message?: string;
}

export interface Progress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  percentage: number;
  estimatedTimeRemaining?: number;
}

export interface Analytics {
  totalImports: number;
  successfulImports: number;
  failedImports: number;
  averageProcessingTime: number;
  totalRecordsProcessed: number;
  totalRecordsFailed: number;
  formatDistribution: Record<DataFormat, number>;
  errorDistribution: Record<string, number>;
  performanceMetrics: PerformanceMetrics;
}

export interface PerformanceMetrics {
  averageValidationTime: number;
  averageTransformationTime: number;
  averageImportTime: number;
  peakMemoryUsage: number;
  totalProcessingTime: number;
}

export type DataSourceType = 'file' | 'stream' | 'url' | 'api';
export type DataFormat = 'csv' | 'json' | 'parquet' | 'excel' | 'xml';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type RecordStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped';
export type ValidationType = 'string' | 'number' | 'email' | 'date' | 'url' | 'custom' | 'regex' | 'array' | 'object';
export type ConflictResolutionStrategy = 'overwrite' | 'skip' | 'update' | 'merge' | 'error';

export interface FormatDetectionOptions {
  sampleSize?: number;
  strict?: boolean;
}

export interface SchemaInferenceOptions {
  sampleSize?: number;
  confidenceThreshold?: number;
  inferTypes?: boolean;
  detectNulls?: boolean;
}