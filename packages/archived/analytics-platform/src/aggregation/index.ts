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
} from './engine.js';

export type {
  PipelineConfig,
  PipelineStage,
  PipelineResult,
  PipelineMetrics,
  PipelineError,
} from './pipeline.js';
