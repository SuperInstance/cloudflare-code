/**
 * ClaudeFlare Data Pipelines
 * Enterprise-grade data pipeline and ETL system for Cloudflare Workers
 */

// Core types
export * from './types';

// Data ingestion
export {
  DataIngestorFactory,
  DataIngestor,
  MultiSourceIngestor,
  BatchedIngestor,
  FilteredIngestor,
  TransformedIngestor,
  RestApiIngestor,
  GraphQLIngestor,
  WebhookIngestor,
  WebhookManager,
  SSEIngestor,
  SSEManager,
  DatabaseIngestor,
  DatabaseConnectionPool,
  FileIngestor
} from './ingestion';

export type {
  RestApiIngestorConfig,
  GraphQLIngestorConfig,
  WebhookIngestorConfig,
  SSEIngestorConfig,
  DatabaseIngestorConfig,
  FileIngestorConfig
} from './ingestion';

// Stream processing
export {
  StreamProcessor,
  StreamBuilder,
  StreamAggregator,
  StreamJoiner,
  filter,
  filterBy,
  filterByRange,
  map,
  pluck,
  compute,
  count,
  sum,
  average,
  min,
  max,
  groupBy,
  groupByField,
  tumblingWindow,
  slidingWindow,
  innerJoin,
  leftJoin,
  distinct,
  distinctBy,
  sortBy,
  take,
  takeWhile,
  skip,
  batch,
  batchTime,
  toAsyncIterable,
  collect,
  pipe
} from './streaming';

export type { StreamProcessorConfig, AggregateResult } from './streaming';

// Batch processing
export {
  BatchScheduler,
  BatchJobExecutor,
  BatchManager,
  BatchJobBuilder,
  MapReduceJob,
  ParallelBatchProcessor,
  createMapReduceJob
} from './batch';

export type {
  ScheduledJob,
  SchedulerStats,
  BatchExecutorConfig,
  BatchProgress,
  BatchResult,
  BatchRecordResult,
  MapReduceOptions,
  MapReduceResult
} from './batch';

// Data transformation
export {
  TransformDSL,
  TransformPipeline,
  TransformEngine,
  CommonTransforms,
  SchemaRegistry,
  SchemaMigrator,
  SchemaValidator,
  transform,
  executeTransform,
  createSchemaRegistry,
  createSchemaMigrator,
  createSchemaValidator,
  compose,
  pipeline
} from './transform';

export type {
  DSLTransformer,
  DSLPredicate,
  SchemaMigration,
  SchemaChange,
  MigrationStep,
  ValidationResult
} from './transform';

// Data quality
export {
  DataQualityValidator,
  AnomalyDetectionEngine,
  DataProfiler,
  QualityManager,
  QualityRuleBuilder,
  PredefinedRules,
  qualityRule,
  createQualityConfig,
  validateQuality,
  profileData
} from './quality';

export type {
  ValidationResult as QualityValidationResult,
  QualityViolation,
  QualityScore,
  AnomalyDetectionResult,
  ProfileResult,
  FieldProfile,
  NumberStatistics,
  StringStatistics,
  SummaryStatistics,
  QualityProcessResult,
  QualityMetrics
} from './quality';

// Pipeline orchestration
export {
  PipelineOrchestrator,
  PipelineMonitor,
  MetricsCollector,
  HealthChecker,
  WorkflowBuilder,
  PipelineManager,
  workflow,
  createPipelineManager,
  createMonitoringConfig,
  createETLWorkflow,
  createValidationWorkflow,
  createAggregationWorkflow
} from './orchestration';

export type {
  OrchestratorConfig,
  MetricValue,
  Alert,
  DashboardData,
  MetricSummary,
  HealthStatus,
  HealthCheckResult,
  PipelineExecutionResult
} from './orchestration';

// Utilities
export * from './utils';
