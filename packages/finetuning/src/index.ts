/**
 * ClaudeFlare Fine-tuning System
 * Main entry point and exports
 */

// Export types
export * from './types';

// Export dataset management
export {
  DatasetManager,
  DataIngestor,
  DataValidator,
  DataCleaner,
  DataAugmenter,
  DatasetSplitter,
  DatasetVersionManager,
  FormatConverter,
} from './dataset/manager';
export type {
  DatasetConfig,
  DataSource,
  ValidationResult,
  DatasetVersion,
  VersionChange,
  DatasetCreateOptions,
  DatasetProcessResult,
} from './dataset/manager';

// Export training orchestration
export {
  TrainingOrchestrator,
  TrainingQueue,
  ResourceManager,
  TrainingMonitor,
  CheckpointManager,
  EarlyStoppingMonitor,
} from './training/orchestrator';
export type {
  QueuedJob,
  ResourcePool,
  ResourceSpecs,
  ResourceAllocation,
  TrainingMetricsSnapshot,
  MonitoringAlert,
  CheckpointConfig,
  EarlyStoppingConfig,
  TrainingRequest,
  TrainingResult,
} from './training/orchestrator';

// Export hyperparameter optimization
export {
  HyperparameterOptimizer,
  GridSearchOptimizer,
  RandomSearchOptimizer,
  BayesianOptimizer,
  MultiObjectiveOptimizer,
  HyperparameterScheduler,
  ExperimentTracker,
} from './hyperparameter/optimizer';
export type {
  ParamType,
  ParamSpace,
  SearchSpace,
  HyperparameterTrial,
  OptimizationConfig,
  Objective,
  ParetoFront,
  ScheduleConfig,
  Experiment,
  OptimizationRequest,
  OptimizationResult,
} from './hyperparameter/optimizer';

// Export model evaluation
export {
  ModelEvaluator,
  MetricsCalculator,
  ABTester,
  ErrorAnalyzer,
  BenchmarkSuite,
  Leaderboard,
} from './evaluation/evaluator';
export type {
  MetricConfig,
  MetricResult,
  ABTestConfig,
  ABTestResult,
  ErrorAnalysisResult,
  Benchmark,
  LeaderboardEntry,
  EvaluationConfig,
  EvaluationReport,
} from './evaluation/evaluator';

// Export LoRA training
export {
  LoRATrainer,
  LoRALayerManager,
  QLoRAQuantizer,
  MultiAdapterManager,
  MemoryOptimizer,
  LoRAConfigPresets,
} from './lora/trainer';
export type {
  LoRAConfig,
  QLoRAConfig,
  LoRALayer,
  QuantizedWeights,
  AdapterConfig,
  AdapterFusionConfig,
  LoRATrainingConfig,
  LoRATrainingState,
} from './lora/trainer';

// Export pipeline automation
export {
  PipelineAutomation,
  PipelineTemplateManager,
  ScheduledTrainingManager,
  TriggerManager,
  WorkflowOrchestrator,
  NotificationManager,
} from './pipeline/automation';
export type {
  PipelineTemplate,
  TemplateVariable,
  PipelineStage,
  PipelineConfig,
  RetryPolicy,
  ResourceLimits,
  ScheduleConfig,
  TriggerConfig,
  TriggerCondition,
  TriggerEvent,
  WorkflowExecution,
  WorkflowStageExecution,
  NotificationConfig,
  NotificationEvent,
  Notification,
  PipelineAutomationConfig,
} from './pipeline/automation';

// Export distributed training
export {
  DistributedTrainingCoordinator,
  ProcessGroupManager,
  DistributedDataParallel,
  GradientSynchronizer,
  DistributedCheckpointManager,
  FaultToleranceManager,
} from './distributed/coordinator';
export type {
  ProcessGroup,
  ProcessInfo,
  DDPConfig,
  GradientBucket,
  DistributedCheckpoint,
  FaultToleranceConfig,
  NodeStatus,
  DistributedTrainingConfig,
  DistributedTrainingState,
} from './distributed/coordinator';

// Export GPU provider integrations
export {
  GPUProviderManager,
  AWSProvider,
  GCPProvider,
  AzureProvider,
  LambdaProvider,
} from './gpu/providers';
export type {
  GPUProvider,
  GPUInstance,
  GPUInfo,
  InstanceConfig,
  ProvisionedInstance,
  InstanceStatus,
  AWSConfig,
  GCPConfig,
  AzureConfig,
  LambdaConfig,
  ProviderConfig,
} from './gpu/providers';

// Export existing modules
export { TrainingPipelineManager, PipelineOrchestrator } from './pipeline/training';
export { ModelRegistryDO } from './models/registry';
export { DatasetManager as LegacyDatasetManager } from './datasets/manager';
export { MetricsCalculator as LegacyMetricsCalculator, ModelEvaluator as LegacyModelEvaluator, BenchmarkSuite as LegacyBenchmarkSuite } from './evaluation/metrics';
export { JobMonitor, MetricsAggregator, AlertManager } from './monitoring/jobs';
export { createRouter } from './api/routes';

// Export utilities
export {
  MathUtils,
  TimeUtils,
  TokenUtils,
  ValidationUtils,
  HyperparameterUtils,
  ProgressUtils,
  MetricsUtils,
  ErrorUtils,
  AsyncUtils,
  StringUtils,
} from './utils/helpers';

// Re-export commonly used types
export type {
  FineTunedModel,
  TrainingJob,
  Dataset,
  Evaluation,
  ModelMetrics,
  Hyperparameters,
  TrainingProgress,
  Checkpoint,
  Env,
} from './types';
