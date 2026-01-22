/**
 * Core types for the fine-tuning system
 */

// ============================================================================
// Model Types
// ============================================================================

export type ModelProvider = 'openai' | 'anthropic' | 'cohere' | 'custom';

export type ModelStatus = 'available' | 'training' | 'deploying' | 'deployed' | 'failed' | 'archived';

export interface BaseModel {
  id: string;
  provider: ModelProvider;
  name: string;
  version: string;
  contextLength: number;
  description?: string;
}

export interface FineTunedModel {
  id: string;
  baseModel: string;
  name: string;
  version: string;
  status: ModelStatus;
  createdAt: number;
  updatedAt: number;
  trainedAt?: number;
  metrics?: ModelMetrics;
  hyperparameters?: Hyperparameters;
  datasetId: string;
  config: ModelConfig;
  deployment?: DeploymentInfo;
  tags: string[];
  metadata: Record<string, any>;
}

export interface ModelMetrics {
  loss: number;
  accuracy?: number;
  validationLoss?: number;
  validationAccuracy?: number;
  perplexity?: number;
  bleuScore?: number;
  rougeScore?: RougeScore;
  customMetrics?: Record<string, number>;
}

export interface RougeScore {
  rouge1: number;
  rouge2: number;
  rougeL: number;
}

export interface Hyperparameters {
  learningRate: number;
  batchSize: number;
  epochs: number;
  warmupSteps?: number;
  weightDecay?: number;
  gradientAccumulationSteps?: number;
  maxGradNorm?: number;
  loraR?: number;
  loraAlpha?: number;
  loraDropout?: number;
  custom?: Record<string, any>;
}

export interface ModelConfig {
  provider: ModelProvider;
  apiKey: string;
  endpoint?: string;
  region?: string;
  inferenceConfig: InferenceConfig;
  trainingConfig: TrainingConfig;
}

export interface InferenceConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

export interface TrainingConfig {
  method: 'supervised' | 'rlhf' | 'dpo' | 'custom';
  validationSplit: number;
  testSplit: number;
  earlyStoppingPatience?: number;
  checkpointInterval?: number;
  evaluationInterval?: number;
}

export interface DeploymentInfo {
  status: 'pending' | 'active' | 'inactive' | 'failed';
  endpoint?: string;
  deployedAt?: number;
  lastUsedAt?: number;
  requestCount: number;
  averageLatency?: number;
}

// ============================================================================
// Dataset Types
// ============================================================================

export type DatasetSource = 'upload' | 'github' | 'url' | 'database' | 'synthetic';

export type DatasetFormat = 'jsonl' | 'json' | 'csv' | 'parquet' | 'custom';

export type DatasetStatus = 'uploading' | 'validating' | 'ready' | 'processing' | 'error' | 'archived';

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  format: DatasetFormat;
  source: DatasetSource;
  status: DatasetStatus;
  createdAt: number;
  updatedAt: number;
  size: number;
  rowCount: number;
  checksum: string;
  path: string;
  r2Bucket: string;
  r2Key: string;
  schema?: DatasetSchema;
  statistics?: DatasetStatistics;
  splits?: DatasetSplits;
  tags: string[];
  metadata: Record<string, any>;
}

export interface DatasetSchema {
  fields: SchemaField[];
  promptField: string;
  completionField: string;
  metadataFields?: string[];
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description?: string;
}

export interface DatasetStatistics {
  totalTokens: number;
  avgPromptLength: number;
  avgCompletionLength: number;
  minPromptLength: number;
  maxPromptLength: number;
  minCompletionLength: number;
  maxCompletionLength: number;
  tokenDistribution?: TokenDistribution;
}

export interface TokenDistribution {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface DatasetSplits {
  train: number;
  validation: number;
  test: number;
}

export interface DatasetValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: DatasetStatistics;
  sampleRecords?: Array<Record<string, any>>;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  type: string;
  message: string;
  count: number;
  suggestion?: string;
}

// ============================================================================
// Training Job Types
// ============================================================================

export type TrainingStatus = 'queued' | 'preparing' | 'training' | 'validating' | 'completed' | 'failed' | 'cancelled' | 'paused';

export interface TrainingJob {
  id: string;
  modelId: string;
  datasetId: string;
  status: TrainingStatus;
  progress: TrainingProgress;
  config: TrainingJobConfig;
  metrics: TrainingMetrics;
  checkpoints: Checkpoint[];
  logs: TrainingLog[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedCompletionAt?: number;
  error?: TrainingError;
  tags: string[];
  metadata: Record<string, any>;
}

export interface TrainingProgress {
  currentStep: number;
  totalSteps: number;
  currentEpoch: number;
  totalEpochs: number;
  percentage: number;
  eta?: number;
}

export interface TrainingJobConfig {
  hyperparameters: Hyperparameters;
  checkpointConfig: CheckpointConfig;
  evaluationConfig: EvaluationConfig;
  resourceConfig: ResourceConfig;
  notificationConfig?: NotificationConfig;
}

export interface CheckpointConfig {
  enabled: boolean;
  interval: number;
  maxToKeep: number;
  saveBest: boolean;
  metric: string;
}

export interface EvaluationConfig {
  enabled: boolean;
  interval: number;
  metrics: string[];
  testSet: boolean;
}

export interface ResourceConfig {
  gpuType?: string;
  gpuCount: number;
  maxRuntime: number;
  priority: 'low' | 'normal' | 'high';
  spotInstance: boolean;
}

export interface NotificationConfig {
  onCompletion: boolean;
  onFailure: boolean;
  onMilestone: boolean;
  email?: string;
  webhook?: string;
}

export interface TrainingMetrics {
  loss: MetricHistory;
  accuracy?: MetricHistory;
  validationLoss?: MetricHistory;
  validationAccuracy?: MetricHistory;
  learningRate?: MetricHistory;
  gradientNorm?: MetricHistory;
  customMetrics?: Record<string, MetricHistory>;
}

export interface MetricHistory {
  values: Array<{ step: number; value: number; timestamp: number }>;
  current: number;
  best: number;
  average: number;
}

export interface Checkpoint {
  id: string;
  step: number;
  epoch: number;
  loss: number;
  metrics: ModelMetrics;
  path: string;
  r2Key: string;
  size: number;
  createdAt: number;
  isBest: boolean;
}

export interface TrainingLog {
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  step?: number;
  epoch?: number;
  metadata?: Record<string, any>;
}

export interface TrainingError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  retryable: boolean;
}

// ============================================================================
// Evaluation Types
// ============================================================================

export interface Evaluation {
  id: string;
  modelId: string;
  datasetId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  metrics: ModelMetrics;
  config: EvaluationConfig;
  results: EvaluationResult[];
  createdAt: number;
  completedAt?: number;
  comparison?: ModelComparison;
}

export interface EvaluationResult {
  input: string;
  expectedOutput?: string;
  actualOutput: string;
  metrics: Record<string, number>;
  latency: number;
  timestamp: number;
}

export interface ModelComparison {
  baselineModel: string;
  comparison: Array<{
    modelId: string;
    modelName: string;
    metrics: ModelMetrics;
    improvement: Record<string, number>;
    significance?: boolean;
  }>;
  winner: string;
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  config: PipelineConfig;
  status: 'idle' | 'running' | 'paused' | 'error';
  currentStage?: number;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, any>;
}

export type PipelineStageType =
  | 'dataset_validation'
  | 'data_preprocessing'
  | 'tokenization'
  | 'training'
  | 'evaluation'
  | 'deployment'
  | 'custom';

export interface PipelineStage {
  id: string;
  name: string;
  type: PipelineStageType;
  config: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  error?: string;
  dependencies: string[];
  outputs?: Record<string, any>;
}

export interface PipelineConfig {
  concurrency: number;
  retryPolicy: RetryPolicy;
  timeoutPolicy: TimeoutPolicy;
  resourceLimits: ResourceLimits;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export interface TimeoutPolicy {
  stageTimeout: number;
  pipelineTimeout: number;
}

export interface ResourceLimits {
  maxConcurrentJobs: number;
  maxMemoryUsage: number;
  maxStorageUsage: number;
}

// ============================================================================
// API Types
// ============================================================================

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  status?: string;
  provider?: ModelProvider;
  tags?: string[];
  dateFrom?: number;
  dateTo?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: Record<string, any>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface SystemMetrics {
  activeJobs: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  resourceUsage: ResourceUsage;
  throughput: ThroughputMetrics;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  storage: number;
  gpu?: number;
}

export interface ThroughputMetrics {
  requestsPerSecond: number;
  tokensPerSecond: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  category: 'job' | 'system' | 'model' | 'dataset';
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  acknowledged: boolean;
  resolvedAt?: number;
}

// ============================================================================
// Webhook Types
// ============================================================================

export type WebhookEvent =
  | 'training.started'
  | 'training.completed'
  | 'training.failed'
  | 'training.progress'
  | 'model.deployed'
  | 'model.evaluated'
  | 'dataset.validated'
  | 'system.alert';

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  active: boolean;
  createdAt: number;
  lastTriggered?: number;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: number;
  data: Record<string, any>;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface R2Config {
  bucket: string;
  region?: string;
  endpoint?: string;
}

export interface D1Config {
  databaseId: string;
  tableName?: string;
}

export interface DurableObjectConfig {
  className: string;
  id?: string;
}

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // Cloudflare bindings
  R2: R2Bucket;
  DB: D1Database;
  MODEL_REGISTRY: DurableObjectNamespace;
  TRAINING_ORCHESTRATOR: DurableObjectNamespace;
  DATASET_MANAGER: DurableObjectNamespace;

  // API Keys
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  COHERE_API_KEY?: string;

  // Configuration
  R2_BUCKET: string;
  MAX_DATASET_SIZE: number;
  MAX_TRAINING_JOBS: number;
  DEFAULT_CHECKPOINT_INTERVAL: number;

  // Webhooks
  WEBHOOK_SECRET?: string;
  WEBHOOK_URL?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type JsonValue = string | number | boolean | null | JsonArray | JsonObject;
export interface JsonArray extends Array<JsonValue> {}
export interface JsonObject {
  [key: string]: JsonValue;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };
