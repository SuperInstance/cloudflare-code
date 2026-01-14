/**
 * ClaudeFlare Fine-tuning System
 * Main entry point and exports
 */

// Export types
export * from './types';

// Export pipeline
export { TrainingPipelineManager, PipelineOrchestrator } from './pipeline/training';

// Export model registry
export { ModelRegistryDO } from './models/registry';

// Export dataset manager
export { DatasetManager } from './datasets/manager';

// Export evaluation
export { MetricsCalculator, ModelEvaluator, BenchmarkSuite } from './evaluation/metrics';

// Export monitoring
export { JobMonitor, MetricsAggregator, AlertManager } from './monitoring/jobs';

// Export API
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
