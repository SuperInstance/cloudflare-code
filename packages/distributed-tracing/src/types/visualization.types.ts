/**
 * Visualization types for distributed tracing
 */

import { TraceId, SpanId, Duration } from './trace.types';

/**
 * Visualization format types
 */
export enum VisualizationFormat {
  SVG = 'svg',
  PNG = 'png',
  HTML = 'html',
  JSON = 'json',
  MERMAID = 'mermaid',
  DOT = 'dot',
}

/**
 * Trace graph visualization options
 */
export interface GraphVisualizationOptions {
  format: VisualizationFormat;
  width?: number;
  height?: number;
  showLabels?: boolean;
  showDuration?: boolean;
  showErrors?: boolean;
  colorScheme?: ColorScheme;
  layout?: GraphLayout;
  grouping?: GraphGrouping;
}

/**
 * Color scheme options
 */
export enum ColorScheme {
  DEFAULT = 'default',
  DARK = 'dark',
  LIGHT = 'light',
  HIGH_CONTRAST = 'high_contrast',
  COLORBLIND_SAFE = 'colorblind_safe',
}

/**
 * Graph layout options
 */
export enum GraphLayout {
  TIMELINE = 'timeline',
  TREE = 'tree',
  FLAME = 'flame',
  GANTT = 'gantt',
  DAGRE = 'dagre',
  FORCE = 'force',
  CIRCLE = 'circle',
}

/**
 * Graph grouping options
 */
export enum GraphGrouping {
  NONE = 'none',
  SERVICE = 'service',
  OPERATION = 'operation',
  LAYER = 'layer',
}

/**
 * Graph node representation
 */
export interface GraphNode {
  id: SpanId;
  label: string;
  service: string;
  duration: Duration;
  hasError: boolean;
  children: GraphNode[];
  metadata?: Record<string, unknown>;
}

/**
 * Graph edge representation
 */
export interface GraphEdge {
  from: SpanId;
  to: SpanId;
  duration?: Duration;
  label?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Complete graph visualization
 */
export interface GraphVisualization {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    traceId: TraceId;
    totalDuration: Duration;
    spanCount: number;
    generatedAt: number;
  };
}

/**
 * Timeline visualization
 */
export interface TimelineVisualization {
  traceId: TraceId;
  spans: TimelineSpan[];
  startTime: number;
  endTime: number;
  totalDuration: Duration;
}

/**
 * Single span in timeline
 */
export interface TimelineSpan {
  spanId: SpanId;
  name: string;
  service: string;
  startTime: number;
  endTime: number;
  duration: Duration;
  depth: number;
  hasError: boolean;
  parentSpanId?: SpanId;
}

/**
 * Flame graph representation
 */
export interface FlameGraph {
  name: string;
  value: Duration;
  children: FlameGraph[];
  metadata?: Record<string, unknown>;
}

/**
 * Gantt chart representation
 */
export interface GanttChart {
  traceId: TraceId;
  tasks: GanttTask[];
  startTime: number;
  endTime: number;
}

/**
 * Single task in Gantt chart
 */
export interface GanttTask {
  id: SpanId;
  name: string;
  service: string;
  startTime: number;
  duration: Duration;
  dependencies: SpanId[];
  status: 'success' | 'error' | 'warning';
  metadata?: Record<string, unknown>;
}

/**
 * Service map visualization
 */
export interface ServiceMap {
  nodes: ServiceMapNode[];
  edges: ServiceMapEdge[];
  metadata: ServiceMapMetadata;
}

/**
 * Node in service map
 */
export interface ServiceMapNode {
  id: string;
  service: string;
  version?: string;
  position: { x: number; y: number };
  size: number;
  color: string;
  metrics: {
    requests: number;
    errors: number;
    avgLatency: Duration;
    errorRate: number;
  };
}

/**
 * Edge in service map
 */
export interface ServiceMapEdge {
  from: string;
  to: string;
  label: string;
  value: number;
  color: string;
  metrics: {
    calls: number;
    avgLatency: Duration;
    errorRate: number;
  };
}

/**
 * Service map metadata
 */
export interface ServiceMapMetadata {
  totalServices: number;
  totalConnections: number;
  generatedAt: number;
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * Heatmap data
 */
export interface HeatmapData {
  traceId: TraceId;
  cells: HeatmapCell[];
  xAxis: HeatmapAxis;
  yAxis: HeatmapAxis;
}

/**
 * Single cell in heatmap
 */
export interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  label?: string;
  color?: string;
}

/**
 * Heatmap axis
 */
export interface HeatmapAxis {
  label: string;
  values: string[];
}

/**
 * Metrics chart data
 */
export interface MetricsChart {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  title: string;
  data: ChartData[];
  xAxis?: ChartAxis;
  yAxis?: ChartAxis;
}

/**
 * Chart data point
 */
export interface ChartData {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Chart axis
 */
export interface ChartAxis {
  label: string;
  min: number;
  max: number;
  unit?: string;
}

/**
 * Visualization render result
 */
export interface VisualizationResult {
  format: VisualizationFormat;
  data: string | Buffer;
  metadata: {
    generatedAt: number;
    size: number;
    encoding?: string;
  };
}
