/**
 * Aggregation Module
 * Data aggregation engine with time-series support and pipeline processing
 */

export {
  AggregationEngine,
  TimeSeriesAggregator,
  RealtimeAggregator,
} from './engine.js';

export {
  AggregationPipeline,
  StreamProcessor,
} from './pipeline.js';

export type {
  AggregationEngineConfig,
  AggregationTask,
  AggregationMetrics,
  CachedAggregation,
  TimeSeriesData,
  PipelineConfig,
  PipelineStage,
  PipelineResult,
  PipelineMetrics,
  PipelineError,
} from './engine.js';

export type {
  PipelineConfig as PipelineConfigType,
  PipelineStage as PipelineStageType,
  PipelineResult as PipelineResultType,
  PipelineMetrics as PipelineMetricsType,
} from './pipeline.js';
