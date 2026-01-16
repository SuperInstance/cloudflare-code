/**
 * Trace visualization tools
 */

// @ts-nocheck - Complex visualization type issues
import { TraceTreeNode, SpanMetadata } from '../types';

export interface VisualizationOptions {
  width?: number;
  height?: number;
  showWaterfall?: boolean;
  showServiceMap?: boolean;
  groupByService?: boolean;
}

export class TraceVisualizer {
  /**
   * Generate waterfall chart data
   */
  generateWaterfallData(tree: TraceTreeNode): WaterfallData {
    const spans: WaterfallSpan[] = [];
    let maxDepth = 0;

    const traverse = (node: TraceTreeNode, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      spans.push({
        name: node.span.name,
        depth,
        startTime: node.span.startTime,
        duration: node.span.duration || 0,
        selfTime: this.calculateSelfTime(node),
        hasChildren: node.children.length > 0,
        service: node.span.attributes['service.name'] as string,
        status: node.span.status,
      });

      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    };

    traverse(tree, 0);

    const minTime = Math.min(...spans.map((s) => s.startTime));

    return {
      spans: spans.map((span) => ({
        ...span,
        relativeStart: span.startTime - minTime,
      })),
      maxDepth,
      totalDuration: Math.max(...spans.map((s) => s.startTime + s.duration)) - minTime,
    };
  }

  /**
   * Generate flame graph data
   */
  generateFlameGraph(tree: TraceTreeNode): FlameGraphNode {
    return this.buildFlameNode(tree, 0);
  }

  /**
   * Generate Gantt chart data
   */
  generateGanttData(tree: TraceTreeNode): GanttData {
    const tasks: GanttTask[] = [];

    const traverse = (node: TraceTreeNode) => {
      tasks.push({
        id: node.span.attributes['span.id'] as string,
        name: node.span.name,
        service: node.span.attributes['service.name'] as string,
        start: node.span.startTime,
        end: node.span.startTime + (node.span.duration || 0),
        duration: node.span.duration || 0,
        status: node.span.status,
        dependencies: node.children.map(
          (child) => child.span.attributes['span.id'] as string
        ),
      });

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(tree);

    return {
      tasks,
      startTime: Math.min(...tasks.map((t) => t.start)),
      endTime: Math.max(...tasks.map((t) => t.end)),
    };
  }

  /**
   * Calculate span self-time (excluding children)
   */
  private calculateSelfTime(node: TraceTreeNode): number {
    const childrenDuration = node.children.reduce(
      (sum, child) => sum + (child.span.duration || 0),
      0
    );
    return Math.max(0, (node.span.duration || 0) - childrenDuration);
  }

  /**
   * Build flame graph node
   */
  private buildFlameNode(node: TraceTreeNode, depth: number): FlameGraphNode {
    const selfTime = this.calculateSelfTime(node);
    const children = node.children.map((child) =>
      this.buildFlameNode(child, depth + 1)
    );

    return {
      name: node.span.name,
      value: node.span.duration || 0,
      selfTime,
      depth,
      service: node.span.attributes['service.name'] as string,
      children,
    };
  }

  /**
   * Generate trace summary statistics
   */
  generateTraceSummary(tree: TraceTreeNode): TraceSummary {
    let totalSpans = 0;
    let totalDuration = 0;
    let errorCount = 0;
    const serviceCounts = new Map<string, number>();
    const durations: number[] = [];

    const traverse = (node: TraceTreeNode) => {
      totalSpans++;
      totalDuration = Math.max(totalDuration, node.span.duration || 0);
      durations.push(node.span.duration || 0);

      const service = node.span.attributes['service.name'] as string;
      serviceCounts.set(service, (serviceCounts.get(service) || 0) + 1);

      if (node.span.status === 2) {
        // ERROR
        errorCount++;
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(tree);

    return {
      totalSpans,
      totalDuration,
      errorCount,
      errorRate: totalSpans > 0 ? errorCount / totalSpans : 0,
      uniqueServices: serviceCounts.size,
      services: Object.fromEntries(serviceCounts),
      avgDuration: this.average(durations),
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
    };
  }

  /**
   * Generate timeline visualization data
   */
  generateTimeline(tree: TraceTreeNode): TimelineData {
    const events: TimelineEvent[] = [];
    const startTime = tree.span.startTime;

    const traverse = (node: TraceTreeNode) => {
      events.push({
        type: 'span',
        name: node.span.name,
        service: node.span.attributes['service.name'] as string,
        timestamp: node.span.startTime,
        duration: node.span.duration || 0,
        status: node.span.status,
      });

      for (const event of node.span.events) {
        events.push({
          type: 'event',
          name: event.name,
          timestamp: event.timestamp,
          duration: 0,
          status: 1, // OK
        });
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(tree);

    return {
      events: events.sort((a, b) => a.timestamp - b.timestamp),
      startTime,
      endTime: Math.max(...events.map((e) => e.timestamp + e.duration)),
    };
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

/**
 * Waterfall chart data
 */
export interface WaterfallData {
  spans: WaterfallSpan[];
  maxDepth: number;
  totalDuration: number;
}

export interface WaterfallSpan {
  name: string;
  depth: number;
  startTime: number;
  relativeStart: number;
  duration: number;
  selfTime: number;
  hasChildren: boolean;
  service: string;
  status: number;
}

/**
 * Flame graph node
 */
export interface FlameGraphNode {
  name: string;
  value: number;
  selfTime: number;
  depth: number;
  service: string;
  children: FlameGraphNode[];
}

/**
 * Gantt chart data
 */
export interface GanttData {
  tasks: GanttTask[];
  startTime: number;
  endTime: number;
}

export interface GanttTask {
  id: string;
  name: string;
  service: string;
  start: number;
  end: number;
  duration: number;
  status: number;
  dependencies: string[];
}

/**
 * Trace summary
 */
export interface TraceSummary {
  totalSpans: number;
  totalDuration: number;
  errorCount: number;
  errorRate: number;
  uniqueServices: number;
  services: Record<string, number>;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
}

/**
 * Timeline data
 */
export interface TimelineData {
  events: TimelineEvent[];
  startTime: number;
  endTime: number;
}

export interface TimelineEvent {
  type: 'span' | 'event';
  name: string;
  service?: string;
  timestamp: number;
  duration: number;
  status: number;
}
