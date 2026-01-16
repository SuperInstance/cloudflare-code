/**
 * Graph visualization for distributed traces
 * Generates visual representations of trace graphs and timelines
 */

import {
  Trace,
  Span,
  SpanId,
} from '../types/trace.types';
import {
  GraphVisualization,
  GraphVisualizationOptions,
  GraphNode,
  GraphEdge,
  TimelineVisualization,
  TimelineSpan,
  VisualizationFormat,
  VisualizationResult,
} from '../types/visualization.types';

/**
 * Graph visualizer class
 */
export class GraphVisualizer {
  /**
   * Create graph visualization from trace
   */
  createGraph(trace: Trace, _options: Partial<GraphVisualizationOptions> = {}): GraphVisualization {
    const nodes = this.buildNodes(trace);
    const edges = this.buildEdges(trace);

    return {
      nodes,
      edges,
      metadata: {
        traceId: trace.traceId,
        totalDuration: trace.duration,
        spanCount: trace.spans.length,
        generatedAt: Date.now(),
      },
    };
  }

  /**
   * Build graph nodes from trace
   */
  private buildNodes(trace: Trace): GraphNode[] {
    const nodeMap = new Map<SpanId, GraphNode>();
    const spanMap = new Map<SpanId, Span>();

    // Create span lookup
    for (const span of trace.spans) {
      spanMap.set(span.spanId, span);
    }

    // Build nodes
    for (const span of trace.spans) {
      const children = this.getChildSpans(span, trace);
      const childNodes = children.map((c) => ({
        id: c.spanId,
        label: c.name,
        service: c.service,
        duration: c.duration || 0,
        hasError: c.status?.code === 2,
        children: [],
        metadata: { span: c },
      }));

      nodeMap.set(span.spanId, {
        id: span.spanId,
        label: span.name,
        service: span.service,
        duration: span.duration || 0,
        hasError: span.status?.code === 2,
        children: childNodes,
        metadata: { span },
      });
    }

    return Array.from(nodeMap.values());
  }

  /**
   * Build graph edges from trace
   */
  private buildEdges(trace: Trace): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const spanMap = new Map<SpanId, Span>();

    for (const span of trace.spans) {
      spanMap.set(span.spanId, span);
    }

    for (const span of trace.spans) {
      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        const parent = spanMap.get(span.parentSpanId)!;
        edges.push({
          from: parent.spanId,
          to: span.spanId,
          duration: span.duration,
          label: span.name,
          metadata: { parent, child: span },
        });
      }
    }

    return edges;
  }

  /**
   * Get child spans for a given span
   */
  private getChildSpans(span: Span, trace: Trace): Span[] {
    return trace.spans.filter((s) => s.parentSpanId === span.spanId);
  }

  /**
   * Create timeline visualization
   */
  createTimeline(trace: Trace): TimelineVisualization {
    const spans: TimelineSpan[] = [];

    // Build span hierarchy
    const spanDepth = new Map<SpanId, number>();
    for (const span of trace.spans) {
      if (!span.parentSpanId) {
        spanDepth.set(span.spanId, 0);
      } else {
        const parentDepth = spanDepth.get(span.parentSpanId) ?? 0;
        spanDepth.set(span.spanId, parentDepth + 1);
      }
    }

    for (const span of trace.spans) {
      spans.push({
        spanId: span.spanId,
        name: span.name,
        service: span.service,
        startTime: span.startTime,
        endTime: span.endTime || span.startTime + (span.duration || 0),
        duration: span.duration || 0,
        depth: spanDepth.get(span.spanId) || 0,
        hasError: span.status?.code === 2,
        parentSpanId: span.parentSpanId,
      });
    }

    return {
      traceId: trace.traceId,
      spans: spans.sort((a, b) => a.startTime - b.startTime),
      startTime: trace.startTime,
      endTime: trace.endTime,
      totalDuration: trace.duration,
    };
  }

  /**
   * Render visualization to specified format
   */
  async render(
    visualization: GraphVisualization | TimelineVisualization,
    format: VisualizationFormat
  ): Promise<VisualizationResult> {
    const data = await this.renderToFormat(visualization, format);

    return {
      format,
      data,
      metadata: {
        generatedAt: Date.now(),
        size: data.length,
        encoding: 'utf-8',
      },
    };
  }

  /**
   * Render to specific format
   */
  private async renderToFormat(
    visualization: GraphVisualization | TimelineVisualization,
    format: VisualizationFormat
  ): Promise<string | Buffer> {
    switch (format) {
      case VisualizationFormat.JSON:
        return JSON.stringify(visualization, null, 2);

      case VisualizationFormat.SVG:
        return this.renderToSVG(visualization);

      case VisualizationFormat.MERMAID:
        return this.renderToMermaid(visualization);

      case VisualizationFormat.DOT:
        return this.renderToDOT(visualization);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Render to SVG
   */
  private renderToSVG(visualization: GraphVisualization | TimelineVisualization): string {
    if ('spans' in visualization) {
      return this.renderTimelineToSVG(visualization);
    }

    const graph = visualization as GraphVisualization;
    const width = 1200;
    const height = Math.max(400, graph.nodes.length * 50);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`;
    svg += `<style>
      .node { fill: #4a90e2; stroke: #2c5aa0; stroke-width: 2; }
      .node-error { fill: #e74c3c; stroke: #c0392b; }
      .edge { stroke: #95a5a6; stroke-width: 2; fill: none; }
      .label { font-family: Arial, sans-serif; font-size: 12px; fill: #333; }
      .duration { font-family: Arial, sans-serif; font-size: 10px; fill: #666; }
    </style>`;

    // Draw edges
    for (const edge of graph.edges) {
      const fromNode = graph.nodes.find((n) => n.id === edge.from);
      const toNode = graph.nodes.find((n) => n.id === edge.to);
      if (fromNode && toNode) {
        const x1 = 100;
        const y1 = graph.nodes.indexOf(fromNode) * 50 + 25;
        const x2 = 300;
        const y2 = graph.nodes.indexOf(toNode) * 50 + 25;
        svg += `<line class="edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
      }
    }

    // Draw nodes
    for (let i = 0; i < graph.nodes.length; i++) {
      const node = graph.nodes[i];
      const x = 100;
      const y = i * 50 + 25;
      const className = node.hasError ? 'node-error' : 'node';

      svg += `<circle class="${className}" cx="${x}" cy="${y}" r="15" />`;
      svg += `<text class="label" x="${x + 25}" y="${y - 5}">${node.label}</text>`;
      svg += `<text class="duration" x="${x + 25}" y="${y + 10}">${node.service}</text>`;
    }

    svg += '</svg>';
    return svg;
  }

  /**
   * Render timeline to SVG
   */
  private renderTimelineToSVG(timeline: TimelineVisualization): string {
    const width = 1200;
    const rowHeight = 30;
    const height = Math.max(400, timeline.spans.length * rowHeight + 50);

    const timeToX = (time: number) => {
      return ((time - timeline.startTime) / timeline.totalDuration) * (width - 200) + 100;
    };

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`;
    svg += `<style>
      .span { fill: #4a90e2; stroke: #2c5aa0; stroke-width: 1; rx: 3; }
      .span-error { fill: #e74c3c; stroke: #c0392b; }
      .label { font-family: Arial, sans-serif; font-size: 11px; fill: #333; }
      .time-label { font-family: Arial, sans-serif; font-size: 10px; fill: #666; }
      .grid-line { stroke: #ddd; stroke-dasharray: 4; }
    </style>`;

    // Draw grid lines
    for (let i = 0; i <= 10; i++) {
      const x = 100 + (width - 200) * (i / 10);
      svg += `<line class="grid-line" x1="${x}" y1="20" x2="${x}" y2="${height - 20}" />`;
      const time = timeline.startTime + (timeline.totalDuration * i) / 10;
      svg += `<text class="time-label" x="${x}" y="${height - 5}">${this.formatTime(time)}</text>`;
    }

    // Draw spans
    for (let i = 0; i < timeline.spans.length; i++) {
      const span = timeline.spans[i];
      const y = i * rowHeight + 30;
      const x = timeToX(span.startTime);
      const w = Math.max(2, timeToX(span.endTime) - x);
      const className = span.hasError ? 'span-error' : 'span';

      svg += `<rect class="${className}" x="${x}" y="${y}" width="${w}" height="${rowHeight - 4}" />`;
      svg += `<text class="label" x="${x + 5}" y="${y + rowHeight / 2 + 3}">${span.name}</text>`;
    }

    svg += '</svg>';
    return svg;
  }

  /**
   * Render to Mermaid format
   */
  private renderToMermaid(visualization: GraphVisualization | TimelineVisualization): string {
    if ('spans' in visualization) {
      return 'gantt\n    title Trace Timeline\n    dateFormat X\n' +
        visualization.spans.map(s =>
          `    ${s.name} : ${s.startTime}, ${s.endTime}`
        ).join('\n');
    }

    const graph = visualization as GraphVisualization;
    let mermaid = 'graph TD\n';

    for (const node of graph.nodes) {
      const nodeId = node.id.substring(0, 8);
      const label = node.hasError ? `${node.label} ❌` : node.label;
      mermaid += `    ${nodeId}[${label}]\n`;
    }

    for (const edge of graph.edges) {
      const fromId = edge.from.substring(0, 8);
      const toId = edge.to.substring(0, 8);
      mermaid += `    ${fromId} --> ${toId}\n`;
    }

    return mermaid;
  }

  /**
   * Render to DOT format (Graphviz)
   */
  private renderToDOT(visualization: GraphVisualization | TimelineVisualization): string {
    if ('spans' in visualization) {
      return 'digraph Timeline {\n' +
        '  node [shape=box];\n' +
        visualization.spans.map(s =>
          `    "${s.spanId}" [label="${s.name}\\n${s.service}"];`
        ).join('\n') +
        '\n}';
    }

    const graph = visualization as GraphVisualization;
    let dot = 'digraph TraceGraph {\n';
    dot += '  node [shape=box, style=rounded];\n';

    for (const node of graph.nodes) {
      const color = node.hasError ? 'red' : 'lightblue';
      dot += `    "${node.id}" [label="${node.label}\\n${node.service}", fillcolor=${color}];\n`;
    }

    for (const edge of graph.edges) {
      dot += `    "${edge.from}" -> "${edge.to}" [label="${edge.label}"];\n`;
    }

    dot += '}';
    return dot;
  }

  /**
   * Format timestamp for display
   */
  private formatTime(timestamp: number): string {
    const date = new Date(timestamp / 1000);
    return date.toISOString().substring(11, 19);
  }

  /**
   * Create flame graph visualization
   */
  createFlameGraph(trace: Trace): any {
    const root = trace.rootSpan;
    return this.buildFlameGraphNode(root, trace);
  }

  /**
   * Build flame graph node recursively
   */
  private buildFlameGraphNode(span: Span, trace: Trace): FlameGraphNode {
    const children = trace.spans.filter((s) => s.parentSpanId === span.spanId);
    return {
      name: span.name,
      value: span.duration || 0,
      children: children.map((c) => this.buildFlameGraphNode(c, trace)),
      metadata: { span },
    };
  }
}

/**
 * Flame graph node interface
 */
interface FlameGraphNode {
  name: string;
  value: number;
  children: FlameGraphNode[];
  metadata: { span: Span };
}

export default GraphVisualizer;
