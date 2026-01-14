/**
 * Distributed tracing module
 * Exports tracing functionality with OpenTelemetry integration
 */

export { DistributedTracer } from './tracer';
export { TraceExporter } from './trace-exporter';
export { TraceVisualizer } from './visualizer';
export type {
  TraceOptions,
  TraceContext,
  TraceLink,
  TraceExportOptions,
  ServiceDependency,
} from './types';
export type {
  WaterfallData,
  WaterfallSpan,
  FlameGraphNode,
  GanttData,
  GanttTask,
  TraceSummary,
  TimelineData,
  TimelineEvent,
  VisualizationOptions,
} from './visualizer';
