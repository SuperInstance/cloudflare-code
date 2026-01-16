/**
 * Reasoning Visualization System
 *
 * Generates visual representations of reasoning chains, task graphs,
 * execution trees, and progress timelines.
 */

import type {
  VisualizationConfig,
  GraphVisualization,
  GraphNode,
  GraphEdge,
  GraphMetadata,
  NodeStyle,
  EdgeStyle,
  GraphStats,
  TimelineVisualization,
  TimelineEvent,
  TimelineGroup,
  TimelineMetadata,
  ReasoningStep,
  ThoughtNode,
  Task,
  VisualizationError,
} from '../types';

// ============================================================================
// Graph Visualization Engine
// ============================================================================

export class GraphVisualizer {
  private config: VisualizationConfig;

  // @ts-nocheck - VisualizationConfig format property is optional but required
  constructor(config: VisualizationConfig = {} as VisualizationConfig) {
    this.config = {
      format: 'graph',
      includeMetadata: config.includeMetadata ?? true,
      highlightPath: config.highlightPath ?? [],
      collapseThreshold: config.collapseThreshold ?? 10,
      interactive: config.interactive ?? false,
      exportFormat: config.exportFormat ?? 'svg',
    };
  }

  /**
   * Visualize reasoning chain as graph
   */
  visualizeReasoningChain(
    steps: ReasoningStep[]
  ): GraphVisualization {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Create nodes for each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isHighlighted = this.config.highlightPath?.includes(step.id) ?? false;

      const node: GraphNode = {
        id: step.id,
        label: `Step ${i + 1}`,
        type: 'reasoning-step',
        status: step.confidence && step.confidence > 0.7 ? 'high-confidence' : 'normal',
        metadata: {
          content: step.content,
          confidence: step.confidence,
          timestamp: step.timestamp,
        },
        style: this.createNodeStyle(step.confidence ?? 0, isHighlighted),
      };

      nodes.push(node);

      // Create edge from previous step
      if (i > 0) {
        edges.push({
          id: `edge_${steps[i - 1].id}_${step.id}`,
          source: steps[i - 1].id,
          target: step.id,
          type: 'reasoning-flow',
          style: {
            color: isHighlighted ? '#FFD700' : '#999999',
            width: isHighlighted ? 3 : 2,
            style: 'solid',
            arrow: true,
          },
        });
      }
    }

    const metadata = this.config.includeMetadata
      ? this.createGraphMetadata('Reasoning Chain', nodes.length, edges.length)
      : undefined;

    return {
      nodes,
      edges,
      layout: 'hierarchical',
      metadata,
    };
  }

  /**
   * Visualize thought tree as graph
   */
  visualizeThoughtTree(thoughtNodes: ThoughtNode[]): GraphVisualization {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, ThoughtNode>();

    for (const node of thoughtNodes) {
      nodeMap.set(node.id, node);
    }

    // Create nodes
    for (const node of thoughtNodes) {
      const isHighlighted = this.config.highlightPath?.includes(node.id) ?? false;
      const isLeaf = node.children.length === 0;
      const isRoot = node.parentId === null;

      const graphNode: GraphNode = {
        id: node.id,
        label: isRoot
          ? 'Root'
          : isLeaf
          ? `Leaf (${(node.score! * 100).toFixed(0)}%)`
          : `${(node.score! * 100).toFixed(0)}%`,
        type: 'thought-node',
        status: node.visited ? 'visited' : 'unvisited',
        metadata: {
          content: node.content,
          depth: node.depth,
          score: node.score,
        },
        style: this.createThoughtNodeStyle(node, isHighlighted),
      };

      nodes.push(graphNode);

      // Create edge to parent
      if (node.parentId) {
        edges.push({
          id: `edge_${node.parentId}_${node.id}`,
          source: node.parentId,
          target: node.id,
          type: 'thought-edge',
          weight: node.score,
          style: {
            color: isHighlighted ? '#FFD700' : this.getScoreColor(node.score!),
            width: Math.max(1, (node.score ?? 0) * 4),
            style: 'solid',
            arrow: true,
          },
        });
      }
    }

    const metadata = this.config.includeMetadata
      ? this.createGraphMetadata('Thought Tree', nodes.length, edges.length)
      : undefined;

    return {
      nodes,
      edges,
      layout: 'hierarchical',
      metadata,
    };
  }

  /**
   * Visualize task graph
   */
  visualizeTaskGraph(tasks: Task[]): GraphVisualization {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Create nodes for each task
    for (const task of tasks) {
      const isHighlighted = this.config.highlightPath?.includes(task.id) ?? false;

      const node: GraphNode = {
        id: task.id,
        label: task.description.substring(0, 30),
        type: 'task',
        status: task.status,
        metadata: {
          description: task.description,
          priority: task.priority,
          estimatedDuration: task.estimatedDuration,
        },
        style: this.createTaskNodeStyle(task, isHighlighted),
      };

      nodes.push(node);

      // Create edges for dependencies
      for (const depId of task.dependencies) {
        edges.push({
          id: `edge_${depId}_${task.id}`,
          source: depId,
          target: task.id,
          type: 'dependency',
          label: 'depends on',
          style: {
            color: '#666666',
            width: 2,
            style: 'dashed',
            arrow: true,
          },
        });
      }
    }

    const metadata = this.config.includeMetadata
      ? this.createGraphMetadata('Task Graph', nodes.length, edges.length)
      : undefined;

    return {
      nodes,
      edges,
      layout: 'force',
      metadata,
    };
  }

  /**
   * Create node style based on confidence
   */
  private createNodeStyle(
    confidence?: number,
    isHighlighted: boolean = false
  ): NodeStyle {
    let color = '#4A90E2';
    let size = 30;

    if (confidence !== undefined) {
      if (confidence > 0.8) {
        color = '#50C878';
      } else if (confidence > 0.5) {
        color = '#FFD700';
      } else {
        color = '#FF6B6B';
      }
      size = 20 + confidence * 20;
    }

    if (isHighlighted) {
      color = '#FF1493';
      size += 10;
    }

    return {
      color,
      size,
      shape: 'circle',
      border: isHighlighted ? '#FF1493' : '#333333',
      borderWidth: isHighlighted ? 3 : 2,
    };
  }

  /**
   * Create thought node style
   */
  private createThoughtNodeStyle(
    node: ThoughtNode,
    isHighlighted: boolean
  ): NodeStyle {
    const score = node.score ?? 0.5;
    let color = this.getScoreColor(score);
    let size = 25 + score * 15;

    if (node.parentId === null) {
      color = '#9B59B6';
      size = 40;
    } else if (node.children.length === 0) {
      color = '#3498DB';
    }

    if (isHighlighted) {
      size += 10;
    }

    return {
      color,
      size,
      shape: node.parentId === null ? 'rectangle' : 'circle',
      border: isHighlighted ? '#FF1493' : '#333333',
      borderWidth: isHighlighted ? 3 : 2,
    };
  }

  /**
   * Create task node style
   */
  private createTaskNodeStyle(task: Task, isHighlighted: boolean): NodeStyle {
    const priorityColors = {
      critical: '#E74C3C',
      high: '#E67E22',
      medium: '#F39C12',
      low: '#95A5A6',
    };

    const statusShapes = {
      pending: 'circle',
      'in-progress': 'rectangle',
      completed: 'hexagon',
      failed: 'diamond',
      blocked: 'rectangle',
    };

    let color = priorityColors[task.priority];
    let shape = statusShapes[task.status] ?? 'circle';

    if (isHighlighted) {
      color = '#FF1493';
    }

    return {
      color,
      size: 35,
      shape: shape as 'circle' | 'rectangle' | 'diamond' | 'hexagon',
      border: isHighlighted ? '#FF1493' : '#333333',
      borderWidth: isHighlighted ? 3 : 2,
    };
  }

  /**
   * Get color based on score
   */
  private getScoreColor(score: number): string {
    if (score > 0.8) return '#50C878';
    if (score > 0.6) return '#7DCEA0';
    if (score > 0.4) return '#FFD700';
    if (score > 0.2) return '#FFA500';
    return '#FF6B6B';
  }

  /**
   * Create graph metadata
   */
  private createGraphMetadata(
    title: string,
    nodeCount: number,
    edgeCount: number
  ): GraphMetadata {
    return {
      title,
      description: `Visualization with ${nodeCount} nodes and ${edgeCount} edges`,
      legend: [
        {
          label: 'High Confidence/Score',
          type: 'node',
          style: { color: '#50C878', size: 30, shape: 'circle' },
        },
        {
          label: 'Medium Confidence/Score',
          type: 'node',
          style: { color: '#FFD700', size: 25, shape: 'circle' },
        },
        {
          label: 'Low Confidence/Score',
          type: 'node',
          style: { color: '#FF6B6B', size: 20, shape: 'circle' },
        },
        {
          label: 'Highlighted',
          type: 'node',
          style: { color: '#FF1493', size: 35, shape: 'circle' },
        },
      ],
      stats: {
        totalNodes: nodeCount,
        totalEdges: edgeCount,
        maxDepth: 0,
        averageConnections: edgeCount > 0 ? edgeCount / nodeCount : 0,
      },
    };
  }

  /**
   * Export visualization as Mermaid diagram
   */
  exportAsMermaid(graph: GraphVisualization): string {
    let mermaid = 'graph TD\n';

    // Define custom styles
    mermaid += '  classDef highConfidence fill:#50C878,stroke:#333,stroke-width:2px;\n';
    mermaid += '  classDef mediumConfidence fill:#FFD700,stroke:#333,stroke-width:2px;\n';
    mermaid += '  classDef lowConfidence fill:#FF6B6B,stroke:#333,stroke-width:2px;\n';
    mermaid += '  classDef highlighted fill:#FF1493,stroke:#333,stroke-width:3px;\n\n';

    // Add nodes
    for (const node of graph.nodes) {
      const label = this.escapeMermaidLabel(node.label);
      const className = this.getMermaidClassName(node);
      mermaid += `  ${node.id}[${label}]:::${className}\n`;
    }

    // Add edges
    for (const edge of graph.edges) {
      const label = edge.label ? `|${this.escapeMermaidLabel(edge.label)}|` : '';
      mermaid += `  ${edge.source} --> ${label} ${edge.target}\n`;
    }

    return mermaid;
  }

  /**
   * Get Mermaid class name for node
   */
  private getMermaidClassName(node: GraphNode): string {
    if (node.style?.border === '#FF1493') {
      return 'highlighted';
    }
    if (node.style?.color === '#50C878') {
      return 'highConfidence';
    }
    if (node.style?.color === '#FFD700') {
      return 'mediumConfidence';
    }
    return 'lowConfidence';
  }

  /**
   * Escape Mermaid label
   */
  private escapeMermaidLabel(label: string): string {
    return label.replace(/"/g, '\\"').replace(/\n/g, '<br>');
  }

  /**
   * Export visualization as DOT format (Graphviz)
   */
  exportAsDOT(graph: GraphVisualization): string {
    let dot = 'digraph {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box, style=rounded];\n\n';

    // Add nodes
    for (const node of graph.nodes) {
      const label = node.label.replace(/"/g, '\\"');
      const color = node.style?.color ?? '#4A90E2';
      dot += `  "${node.id}" [label="${label}", fillcolor="${color}", style="filled,rounded"];\n`;
    }

    // Add edges
    for (const edge of graph.edges) {
      const color = edge.style?.color ?? '#999999';
      const style = edge.style?.style ?? 'solid';
      dot += `  "${edge.source}" -> "${edge.target}" [color="${color}", style="${style}"];\n`;
    }

    dot += '}';
    return dot;
  }
}

// ============================================================================
// Timeline Visualization Engine
// ============================================================================

export class TimelineVisualizer {
  /**
   * Visualize task execution timeline
   */
  visualizeTaskTimeline(
    tasks: Task[],
    events: Array<{ taskId: string; timestamp: number; type: string }>
  ): TimelineVisualization {
    const timelineEvents: TimelineEvent[] = [];
    const groups: TimelineGroup[] = [];

    // Group tasks by priority
    const priorityGroups = new Map<Task['priority'], string[]>();
    for (const task of tasks) {
      if (!priorityGroups.has(task.priority)) {
        priorityGroups.set(task.priority, []);
      }
      priorityGroups.get(task.priority)!.push(task.id);
    }

    // Create groups
    const groupColors: Record<Task['priority'], string> = {
      critical: '#E74C3C',
      high: '#E67E22',
      medium: '#F39C12',
      low: '#95A5A6',
    };

    for (const [priority, taskIds] of priorityGroups) {
      groups.push({
        id: `group_${priority}`,
        label: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
        events: taskIds,
        color: groupColors[priority],
      });
    }

    // Create events
    for (const task of tasks) {
      const taskEvents = events.filter((e) => e.taskId === task.id);
      const startEvent = taskEvents.find((e) => e.type === 'start');
      const endEvent = taskEvents.find((e) => e.type === 'complete' || e.type === 'fail');

      if (startEvent) {
        const timelineEvent: TimelineEvent = {
          id: `event_${task.id}`,
          label: task.description.substring(0, 50),
          start: startEvent.timestamp,
          end: endEvent?.timestamp,
          status: task.status,
          dependencies: task.dependencies,
          metadata: {
            taskId: task.id,
            priority: task.priority,
          },
        };
        timelineEvents.push(timelineEvent);
      }
    }

    // Calculate metadata
    const startTime = Math.min(...timelineEvents.map((e) => e.start));
    const endTime = Math.max(
      ...timelineEvents.map((e) => e.end ?? e.start)
    );

    const metadata: TimelineMetadata = {
      title: 'Task Execution Timeline',
      startTime,
      endTime,
      totalEvents: timelineEvents.length,
    };

    return {
      events: timelineEvents,
      groups,
      metadata,
    };
  }

  /**
   * Export timeline as Mermaid Gantt chart
   */
  exportAsGantt(timeline: TimelineVisualization): string {
    let mermaid = 'gantt\n';
    mermaid += '    title Task Execution Timeline\n';
    mermaid += '    dateFormat X\n';
    mermaid += '    axisFormat %H:%M:%S\n\n';

    // Add sections for each group
    for (const group of timeline.groups ?? []) {
      mermaid += `    section ${group.label}\n`;

      for (const eventId of group.events) {
        const event = timeline.events.find((e) => e.id === eventId);
        if (event) {
          const label = event.label.replace(/"/g, '\\"').substring(0, 20);
          const duration = event.end
            ? event.end - event.start
            : 1000;

          mermaid += `    ${label} :${event.status}, ${event.start}, ${duration}ms\n`;
        }
      }
    }

    return mermaid;
  }

  /**
   * Export timeline as table
   */
  exportAsTable(timeline: TimelineVisualization): string {
    let table = '| Task | Status | Start | End | Duration |\n';
    table += '|------|--------|-------|-----|----------|\n';

    for (const event of timeline.events) {
      const duration = event.end
        ? `${event.end - event.start}ms`
        : 'In progress';

      table += `| ${event.label} | ${event.status ?? 'N/A'} | ${event.start} | ${event.end ?? 'N/A'} | ${duration} |\n`;
    }

    return table;
  }
}

// ============================================================================
// Progress Visualization Engine
// ============================================================================

export class ProgressVisualizer {
  /**
   * Create progress bar visualization
   */
  createProgressBar(
    current: number,
    total: number,
    width: number = 50
  ): string {
    const percentage = total > 0 ? current / total : 0;
    const filled = Math.round(width * percentage);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentageText = `${(percentage * 100).toFixed(1)}%`;

    return `[${bar}] ${percentageText} (${current}/${total})`;
  }

  /**
   * Create task progress tree
   */
  createTaskProgressTree(task: Task, indent: number = 0): string {
    const prefix = '  '.repeat(indent);
    const statusIcons = {
      pending: '○',
      'in-progress': '◐',
      completed: '●',
      failed: '✗',
      blocked: '⊘',
    };

    const icon = statusIcons[task.status];
    let output = `${prefix}${icon} ${task.description}`;

    if (task.estimatedDuration) {
      const duration = Math.round(task.estimatedDuration / 1000);
      output += ` (${duration}s)`;
    }

    output += '\n';

    if (task.subtasks) {
      for (const subtask of task.subtasks) {
        output += this.createTaskProgressTree(subtask, indent + 1);
      }
    }

    return output;
  }

  /**
   * Create statistics summary
   */
  createStatisticsSummary(tasks: Task[]): string {
    const stats = {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      'in-progress': tasks.filter((t) => t.status === 'in-progress').length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      blocked: tasks.filter((t) => t.status === 'blocked').length,
    };

    let summary = '╔════════════════════════════════╗\n';
    summary += '║      Task Statistics            ║\n';
    summary += '╠════════════════════════════════╣\n';

    for (const [status, count] of Object.entries(stats)) {
      const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
      const bar = '█'.repeat(Math.round(percentage / 5));
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      summary += `║ ${label.padEnd(12)} ${count.toString().padStart(3)} ${bar.padEnd(20)} ${percentage.toFixed(0)}% ║\n`;
    }

    summary += '╚════════════════════════════════╝\n';

    return summary;
  }
}

// ============================================================================
// Export Manager
// ============================================================================

export class VisualizationExportManager {
  /**
   * Export visualization to file
   */
  async exportToFile(
    visualization: GraphVisualization | TimelineVisualization,
    format: 'svg' | 'png' | 'json' | 'html',
    outputPath: string
  ): Promise<void> {
    let content: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(visualization, null, 2);
        break;
      case 'html':
        content = this.generateHTML(visualization);
        break;
      case 'svg':
      case 'png':
        // In a real implementation, this would generate actual SVG/PNG
        content = this.generatePlaceholderImage(format);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // In a real implementation, this would write to file
    // For now, we just return the content
    console.log(`Exported to ${outputPath}:\n${content.substring(0, 200)}...`);
  }

  /**
   * Generate interactive HTML visualization
   */
  private generateHTML(
    visualization: GraphVisualization | TimelineVisualization
  ): string {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reasoning Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
        }
        #visualization {
            width: 100%;
            height: 600px;
            border: 1px solid #ccc;
            background: #f9f9f9;
        }
        .node {
            cursor: pointer;
        }
        .link {
            stroke: #999;
            stroke-opacity: 0.6;
        }
    </style>
</head>
<body>
    <h1>Reasoning Visualization</h1>
    <div id="visualization"></div>
    <script>
        const data = ${JSON.stringify(visualization, null, 2)};

        // D3.js visualization code would go here
        // This is a placeholder for the actual implementation
        console.log('Visualization data:', data);
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Generate placeholder image
   */
  private generatePlaceholderImage(format: 'svg' | 'png'): string {
    if (format === 'svg') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="100%" height="100%" fill="#f9f9f9"/>
    <text x="400" y="300" text-anchor="middle" font-size="24">
        Visualization Placeholder
    </text>
</svg>`;
    }

    return 'PNG export would require additional dependencies';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate visualization configuration
 */
export function validateVisualizationConfig(
  config: VisualizationConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const validFormats = ['graph', 'tree', 'timeline', 'table', 'mermaid'];
  if (!validFormats.includes(config.format)) {
    errors.push(`format must be one of: ${validFormats.join(', ')}`);
  }

  const validExportFormats = ['svg', 'png', 'json', 'html'];
  if (
    config.exportFormat &&
    !validExportFormats.includes(config.exportFormat)
  ) {
    errors.push(
      `exportFormat must be one of: ${validExportFormats.join(', ')}`
    );
  }

  if (
    config.collapseThreshold !== undefined &&
    config.collapseThreshold < 0
  ) {
    errors.push('collapseThreshold must be non-negative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate graph statistics
 */
export function calculateGraphStats(
  graph: GraphVisualization
): GraphStats {
  const totalNodes = graph.nodes.length;
  const totalEdges = graph.edges.length;

  let maxDepth = 0;
  const depthMap = new Map<string, number>();

  // Calculate depths using BFS
  for (const node of graph.nodes) {
    if (!depthMap.has(node.id)) {
      const depth = calculateNodeDepth(node.id, graph);
      depthMap.set(node.id, depth);
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    }
  }

  const averageConnections =
    totalNodes > 0 ? totalEdges / totalNodes : 0;

  return {
    totalNodes,
    totalEdges,
    maxDepth,
    averageConnections,
  };
}

/**
 * Calculate depth of a node in the graph
 */
function calculateNodeDepth(
  nodeId: string,
  graph: GraphVisualization,
  visited: Set<string> = new Set()
): number {
  if (visited.has(nodeId)) {
    return 0;
  }

  visited.add(nodeId);

  const incomingEdges = graph.edges.filter((e) => e.target === nodeId);

  if (incomingEdges.length === 0) {
    return 0;
  }

  let maxParentDepth = 0;
  for (const edge of incomingEdges) {
    const parentDepth = calculateNodeDepth(edge.source, graph, visited);
    if (parentDepth > maxParentDepth) {
      maxParentDepth = parentDepth;
    }
  }

  return maxParentDepth + 1;
}

/**
 * Generate color palette for visualization
 */
export function generateColorPalette(count: number): string[] {
  const colors: string[] = [];
  const hueStep = 360 / count;

  for (let i = 0; i < count; i++) {
    const hue = Math.round(i * hueStep);
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }

  return colors;
}

/**
 * Create error with proper type
 */
function createError(
  message: string,
  code: string,
  details?: Record<string, unknown>
): VisualizationError {
  const error = new Error(message) as VisualizationError;
  error.name = 'VisualizationError';
  error.code = code;
  error.details = details;
  return error;
}
