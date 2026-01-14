/**
 * State Visualizer
 * Generates state diagrams and visualizations
 */

import { StateMachineEngine } from '../engine/engine.js';
import {
  State,
  StateMachineDefinition,
  StateDefinition,
  Transition,
  VisualizationOptions,
} from '../types/index.js';

/**
 * Visualization data
 */
export interface VisualizationData {
  nodes: VisualNode[];
  edges: VisualEdge[];
  layout: VisualLayout;
}

/**
 * Visual node representation
 */
export interface VisualNode {
  id: State;
  label: string;
  type: 'initial' | 'final' | 'normal' | 'compound' | 'parallel';
  children?: VisualNode[];
  metadata?: Record<string, any>;
  position?: { x: number; y: number };
  style?: NodeStyle;
}

/**
 * Visual edge representation
 */
export interface VisualEdge {
  id: string;
  from: State;
  to: State;
  label?: string;
  events: string[];
  style?: EdgeStyle;
}

/**
 * Visual layout
 */
export interface VisualLayout {
  direction: 'TB' | 'LR' | 'RL';
  rankSpacing: number;
  nodeSpacing: number;
}

/**
 * Node style
 */
export interface NodeStyle {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fontSize?: number;
  shape?: 'circle' | 'ellipse' | 'rect' | 'rounded' | 'diamond';
}

/**
 * Edge style
 */
export interface EdgeStyle {
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  fontSize?: number;
}

/**
 * State visualizer class
 */
export class StateVisualizer<TData = any> {
  private machine: StateMachineEngine<TData>;
  private definition: StateMachineDefinition<TData>;
  private defaultOptions: VisualizationOptions = {
    format: 'svg',
    includeMetadata: false,
    includeLabels: true,
    direction: 'TB',
    fontSize: 14,
  };

  constructor(machine: StateMachineEngine<TData>) {
    this.machine = machine;
    this.definition = (machine as any).definition;
  }

  /**
   * Generate visualization data
   */
  generateVisualization(
    options: VisualizationOptions = {}
  ): VisualizationData {
    const opts = { ...this.defaultOptions, ...options };

    const nodes = this.generateNodes(opts);
    const edges = this.generateEdges(opts);

    // Apply layout
    const layout = this.applyLayout(nodes, edges, opts);

    return {
      nodes,
      edges,
      layout,
    };
  }

  /**
   * Generate Mermaid diagram
   */
  generateMermaid(options: VisualizationOptions = {}): string {
    const opts = { ...this.defaultOptions, ...options };
    const edges = this.generateEdges(opts);

    let mermaid = `stateDiagram-v2\n`;
    mermaid += `    ${opts.direction === 'LR' ? 'direction LR' : 'direction TB'}\n\n`;

    // Add states
    for (const [stateName, stateDef] of Object.entries(this.definition.states)) {
      if (stateDef.initial) {
        mermaid += `    [*] --> ${stateName}\n`;
      }

      if (stateDef.final) {
        mermaid += `    ${stateName} --> [*]\n`;
      }

      // Handle compound states
      if (stateDef.parent) {
        const parentStates = Object.entries(this.definition.states)
          .filter(([_, def]) => def.parent === stateDef.parent)
          .map(([name, _]) => name);

        if (parentStates.length > 0) {
          mermaid += `    state ${stateDef.parent} {\n`;
          for (const child of parentStates) {
            mermaid += `        [*] --> ${child}\n`;
          }
          mermaid += `    }\n`;
        }
      }
    }

    mermaid += '\n';

    // Add transitions
    for (const edge of edges) {
      for (const event of edge.events) {
        const label = opts.includeLabels ? `: ${event}` : '';
        mermaid += `    ${edge.from} --> ${edge.to}${label}\n`;
      }
    }

    return mermaid;
  }

  /**
   * Generate GraphViz DOT format
   */
  generateDot(options: VisualizationOptions = {}): string {
    const opts = { ...this.defaultOptions, ...options };
    const nodes = this.generateNodes(opts);
    const edges = this.generateEdges(opts);

    let dot = 'digraph StateMachine {\n';

    // Graph settings
    dot += `  rankdir=${opts.direction};\n`;
    dot += '  node [fontname="Arial", fontsize=' + opts.fontSize + '];\n';
    dot += '  edge [fontname="Arial", fontsize=' + (opts.fontSize - 2) + '];\n';
    dot += '\n';

    // Add nodes
    for (const node of nodes) {
      const shape = this.getNodeShape(node);
      const style = node.style?.fillColor ? `, fillcolor="${node.style.fillColor}"` : '';
      dot += `  "${node.id}" [shape=${shape}${style}];\n`;
    }

    dot += '\n';

    // Add edges
    for (const edge of edges) {
      const label = opts.includeLabels && edge.events.length > 0
        ? ` [label="${edge.events.join(', ')}"]`
        : '';
      dot += `  "${edge.from}" -> "${edge.to}"${label};\n`;
    }

    dot += '}';

    return dot;
  }

  /**
   * Generate SVG visualization
   */
  generateSvg(options: VisualizationOptions = {}): string {
    const opts = { ...this.defaultOptions, ...options };
    const data = this.generateVisualization(opts);

    const svg = this.renderSvg(data, opts);
    return svg;
  }

  /**
   * Export to file (simulate - in real implementation would write to disk)
   */
  async exportToFile(
    format: 'svg' | 'png' | 'mermaid' | 'dot',
    filePath: string,
    options: VisualizationOptions = {}
  ): Promise<void> {
    let content: string;

    switch (format) {
      case 'svg':
        content = this.generateSvg(options);
        break;
      case 'mermaid':
        content = this.generateMermaid(options);
        break;
      case 'dot':
        content = this.generateDot(options);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // In a real implementation, this would write to the file system
    console.log(`Exported to ${filePath}:\n${content}`);
  }

  /**
   * Get state statistics for visualization
   */
  getStateStatistics(): Record<string, any> {
    const stats = {
      totalStates: Object.keys(this.definition.states).length,
      initialStates: 0,
      finalStates: 0,
      compoundStates: 0,
      parallelStates: 0,
      totalTransitions: 0,
      stateDistribution: {} as Record<string, number>,
    };

    for (const [stateName, stateDef] of Object.entries(this.definition.states)) {
      if (stateDef.initial) {
        stats.initialStates++;
      }
      if (stateDef.final) {
        stats.finalStates++;
      }
      if (stateDef.initial && stateDef.transitions) {
        stats.compoundStates++;
      }
      if (stateDef.parallel && stateDef.parallel.length > 0) {
        stats.parallelStates++;
      }
      if (stateDef.transitions) {
        stats.totalTransitions += stateDef.transitions.length;
      }
    }

    return stats;
  }

  /**
   * Generate visual nodes
   */
  private generateNodes(options: VisualizationOptions): VisualNode[] {
    const nodes: VisualNode[] = [];

    for (const [stateName, stateDef] of Object.entries(this.definition.states)) {
      const node: VisualNode = {
        id: stateName,
        label: stateName,
        type: this.getNodeType(stateDef),
        metadata: options.includeMetadata ? stateDef.metadata : undefined,
        style: this.getNodeStyle(stateDef, options),
      };

      // Handle compound/parallel states
      if (stateDef.initial || (stateDef.parallel && stateDef.parallel.length > 0)) {
        node.children = this.getChildNodes(stateName, options);
      }

      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Generate visual edges
   */
  private generateEdges(options: VisualizationOptions): VisualEdge[] {
    const edgesMap = new Map<string, VisualEdge>();
    let edgeId = 0;

    // Process state transitions
    for (const [stateName, stateDef] of Object.entries(this.definition.states)) {
      if (stateDef.transitions) {
        for (const transition of stateDef.transitions) {
          const key = `${stateName}->${transition.to}`;

          if (!edgesMap.has(key)) {
            edgesMap.set(key, {
              id: `edge-${edgeId++}`,
              from: stateName,
              to: transition.to,
              events: [],
              style: this.getEdgeStyle(transition, options),
            });
          }

          const edge = edgesMap.get(key)!;
          if (edge.events.indexOf(transition.on) === -1) {
            edge.events.push(transition.on);
          }
        }
      }
    }

    // Process global transitions
    if (this.definition.transitions) {
      for (const transition of this.definition.transitions) {
        if (transition.from === '*') {
          // Add transitions from all states
          for (const stateName of Object.keys(this.definition.states)) {
            const key = `${stateName}->${transition.to}`;

            if (!edgesMap.has(key)) {
              edgesMap.set(key, {
                id: `edge-${edgeId++}`,
                from: stateName,
                to: transition.to,
                events: [],
                style: this.getEdgeStyle(transition, options),
              });
            }

            const edge = edgesMap.get(key)!;
            if (edge.events.indexOf(transition.on) === -1) {
              edge.events.push(transition.on);
            }
          }
        } else {
          const sources = Array.isArray(transition.from) ? transition.from : [transition.from];

          for (const source of sources) {
            const key = `${source}->${transition.to}`;

            if (!edgesMap.has(key)) {
              edgesMap.set(key, {
                id: `edge-${edgeId++}`,
                from: source,
                to: transition.to,
                events: [],
                style: this.getEdgeStyle(transition, options),
              });
            }

            const edge = edgesMap.get(key)!;
            if (edge.events.indexOf(transition.on) === -1) {
              edge.events.push(transition.on);
            }
          }
        }
      }
    }

    return Array.from(edgesMap.values());
  }

  /**
   * Get child nodes for compound states
   */
  private getChildNodes(
    parentState: State,
    options: VisualizationOptions
  ): VisualNode[] {
    const children: VisualNode[] = [];

    for (const [stateName, stateDef] of Object.entries(this.definition.states)) {
      if (stateDef.parent === parentState) {
        children.push({
          id: stateName,
          label: stateName,
          type: this.getNodeType(stateDef),
          metadata: options.includeMetadata ? stateDef.metadata : undefined,
        });
      }
    }

    return children;
  }

  /**
   * Get node type based on state definition
   */
  private getNodeType(stateDef: StateDefinition): VisualNode['type'] {
    if (stateDef.final) {
      return 'final';
    }
    if (stateDef.parallel && stateDef.parallel.length > 0) {
      return 'parallel';
    }
    if (stateDef.initial) {
      return 'compound';
    }
    return 'normal';
  }

  /**
   * Get node shape for DOT format
   */
  private getNodeShape(node: VisualNode): string {
    switch (node.type) {
      case 'initial':
        return 'circle';
      case 'final':
        return 'doublecircle';
      case 'compound':
        return 'box';
      case 'parallel':
        return 'parallelogram';
      default:
        return 'ellipse';
    }
  }

  /**
   * Get node style
   */
  private getNodeStyle(
    stateDef: StateDefinition,
    options: VisualizationOptions
  ): NodeStyle | undefined {
    const colors = options.colors || {};

    if (stateDef.final && colors.final) {
      return {
        fillColor: colors.final,
        shape: 'doublecircle',
      };
    }

    if (stateDef.initial && colors.initial) {
      return {
        fillColor: colors.initial,
        shape: 'box',
      };
    }

    if (stateDef.parallel && colors.parallel) {
      return {
        fillColor: colors.parallel,
        shape: 'rounded',
      };
    }

    if (this.machine.isIn(stateDef.name) && colors.active) {
      return {
        fillColor: colors.active,
        shape: 'ellipse',
      };
    }

    return undefined;
  }

  /**
   * Get edge style
   */
  private getEdgeStyle(
    transition: Transition,
    options: VisualizationOptions
  ): EdgeStyle | undefined {
    const colors = options.colors || {};

    if (colors.transition) {
      return {
        strokeColor: colors.transition,
        strokeWidth: 2,
      };
    }

    return undefined;
  }

  /**
   * Apply layout to nodes and edges
   */
  private applyLayout(
    nodes: VisualNode[],
    edges: VisualEdge[],
    options: VisualizationOptions
  ): VisualLayout {
    const layout: VisualLayout = {
      direction: options.direction || 'TB',
      rankSpacing: 100,
      nodeSpacing: 50,
    };

    // Simple hierarchical layout
    const levels = new Map<State, number>();
    const visited = new Set<State>();

    // Find initial state(s)
    const initialStates = nodes.filter(n => n.type === 'initial');

    for (const initial of initialStates) {
      this.calculateLevel(initial.id, 0, levels, visited, edges);
    }

    // Assign positions based on levels
    const levelGroups = new Map<number, State[]>();

    for (const [state, level] of levels) {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(state);
    }

    // Calculate positions
    for (const [level, states] of levelGroups) {
      for (let i = 0; i < states.length; i++) {
        const node = nodes.find(n => n.id === states[i]);
        if (node) {
          if (layout.direction === 'TB') {
            node.position = {
              x: i * layout.nodeSpacing,
              y: level * layout.rankSpacing,
            };
          } else {
            node.position = {
              x: level * layout.rankSpacing,
              y: i * layout.nodeSpacing,
            };
          }
        }
      }
    }

    return layout;
  }

  /**
   * Calculate level for hierarchical layout
   */
  private calculateLevel(
    state: State,
    level: number,
    levels: Map<State, number>,
    visited: Set<State>,
    edges: VisualEdge[]
  ): void {
    if (visited.has(state)) {
      return;
    }

    visited.add(state);
    levels.set(state, level);

    // Find outgoing edges
    const outgoing = edges.filter(e => e.from === state);

    for (const edge of outgoing) {
      this.calculateLevel(edge.to, level + 1, levels, visited, edges);
    }
  }

  /**
   * Render SVG from visualization data
   */
  private renderSvg(
    data: VisualizationData,
    options: VisualizationOptions
  ): string {
    const width = 800;
    const height = 600;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;
    svg += '  <defs>\n';
    svg += '    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">\n';
    svg += '      <polygon points="0 0, 10 3.5, 0 7" fill="#333" />\n';
    svg += '    </marker>\n';
    svg += '  </defs>\n';

    // Render edges
    for (const edge of data.edges) {
      const fromNode = data.nodes.find(n => n.id === edge.from);
      const toNode = data.nodes.find(n => n.id === edge.to);

      if (fromNode?.position && toNode?.position) {
        svg += `  <line x1="${fromNode.position.x}" y1="${fromNode.position.y}" `;
        svg += `x2="${toNode.position.x}" y2="${toNode.position.y}" `;
        svg += `stroke="${edge.style?.strokeColor || '#333'}" `;
        svg += `stroke-width="${edge.style?.strokeWidth || 2}" `;
        svg += `marker-end="url(#arrowhead)" />\n`;

        if (options.includeLabels && edge.events.length > 0) {
          const midX = (fromNode.position.x + toNode.position.x) / 2;
          const midY = (fromNode.position.y + toNode.position.y) / 2;
          svg += `  <text x="${midX}" y="${midY}" font-size="12" text-anchor="middle" fill="#666">\n`;
          svg += `    ${edge.events.join(', ')}\n`;
          svg += '  </text>\n';
        }
      }
    }

    // Render nodes
    for (const node of data.nodes) {
      if (!node.position) continue;

      const x = node.position.x;
      const y = node.position.y;
      const fillColor = node.style?.fillColor || '#fff';
      const strokeColor = node.style?.strokeColor || '#333';

      if (node.type === 'initial') {
        svg += `  <circle cx="${x}" cy="${y}" r="15" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" />\n`;
      } else if (node.type === 'final') {
        svg += `  <circle cx="${x}" cy="${y}" r="15" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" />\n`;
        svg += `  <circle cx="${x}" cy="${y}" r="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" />\n`;
      } else {
        svg += `  <rect x="${x - 40}" y="${y - 15}" width="80" height="30" `;
        svg += `fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" rx="5" />\n`;
      }

      svg += `  <text x="${x}" y="${y + 5}" font-size="${options.fontSize}" text-anchor="middle" fill="#000">\n`;
      svg += `    ${node.label}\n`;
      svg += '  </text>\n';
    }

    svg += '</svg>';

    return svg;
  }

  /**
   * Create interactive visualization (returns HTML)
   */
  createInteractiveVisualization(
    options: VisualizationOptions = {}
  ): string {
    const data = this.generateVisualization(options);

    return `
<!DOCTYPE html>
<html>
<head>
  <title>State Machine Visualization</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
    }
    #container {
      position: relative;
      width: 100%;
      height: 600px;
      border: 1px solid #ccc;
      overflow: hidden;
    }
    .node {
      position: absolute;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .node:hover {
      transform: scale(1.1);
    }
    .node-content {
      padding: 10px 15px;
      background: #fff;
      border: 2px solid #333;
      border-radius: 5px;
      white-space: nowrap;
    }
    .node.initial .node-content {
      border-radius: 50%;
      width: 30px;
      height: 30px;
      line-height: 30px;
      text-align: center;
    }
    .node.final .node-content {
      border: 4px double #333;
    }
    .edge {
      position: absolute;
      pointer-events: none;
    }
    .tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 5px 10px;
      border-radius: 3px;
      font-size: 12px;
      display: none;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <h1>State Machine Visualization</h1>
  <div id="container"></div>
  <div id="tooltip" class="tooltip"></div>

  <script>
    const data = ${JSON.stringify(data, null, 2)};

    const container = document.getElementById('container');
    const tooltip = document.getElementById('tooltip');

    // Render edges
    data.edges.forEach(edge => {
      const fromNode = data.nodes.find(n => n.id === edge.from);
      const toNode = data.nodes.find(n => n.id === edge.to);

      if (fromNode?.position && toNode?.position) {
        const line = document.createElement('div');
        line.className = 'edge';
        line.style.left = fromNode.position.x + 'px';
        line.style.top = fromNode.position.y + 'px';

        const length = Math.sqrt(
          Math.pow(toNode.position.x - fromNode.position.x, 2) +
          Math.pow(toNode.position.y - fromNode.position.y, 2)
        );
        const angle = Math.atan2(
          toNode.position.y - fromNode.position.y,
          toNode.position.x - fromNode.position.x
        ) * 180 / Math.PI;

        line.style.width = length + 'px';
        line.style.height = '2px';
        line.style.background = '#333';
        line.style.transformOrigin = '0 50%';
        line.style.transform = 'rotate(' + angle + 'deg)';

        container.appendChild(line);
      }
    });

    // Render nodes
    data.nodes.forEach(node => {
      if (!node.position) return;

      const div = document.createElement('div');
      div.className = 'node ' + node.type;
      div.style.left = (node.position.x - 40) + 'px';
      div.style.top = (node.position.y - 15) + 'px';

      const content = document.createElement('div');
      content.className = 'node-content';
      content.textContent = node.label;
      div.appendChild(content);

      div.addEventListener('mouseenter', (e) => {
        tooltip.textContent = node.id + (node.metadata ? ': ' + JSON.stringify(node.metadata) : '');
        tooltip.style.display = 'block';
        tooltip.style.left = (e.pageX + 10) + 'px';
        tooltip.style.top = (e.pageY + 10) + 'px';
      });

      div.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });

      container.appendChild(div);
    });
  </script>
</body>
</html>
    `;
  }
}

/**
 * Create animated state diagram
 */
export function createAnimatedVisualization<TData = any>(
  machine: StateMachineEngine<TData>,
  options: VisualizationOptions = {}
): string {
  const visualizer = new StateVisualizer(machine);
  const data = visualizer.generateVisualization(options);

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Animated State Machine</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
    }
    #container {
      position: relative;
      width: 100%;
      height: 600px;
      border: 1px solid #ccc;
    }
    .node {
      position: absolute;
      transition: all 0.5s ease-in-out;
      cursor: pointer;
    }
    .node-content {
      padding: 10px 15px;
      background: #fff;
      border: 2px solid #333;
      border-radius: 5px;
    }
    .node.active .node-content {
      background: #4CAF50;
      color: #fff;
    }
    .edge {
      position: absolute;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    .edge.active {
      opacity: 1;
    }
    .edge:not(.active) {
      opacity: 0.3;
    }
  </style>
</head>
<body>
  <h1>Animated State Machine</h1>
  <div id="container"></div>

  <script>
    const data = ${JSON.stringify(data, null, 2)};
    let activeState = '${machine.state}';

    function render() {
      const container = document.getElementById('container');
      container.innerHTML = '';

      // Render edges
      data.edges.forEach(edge => {
        const fromNode = data.nodes.find(n => n.id === edge.from);
        const toNode = data.nodes.find(n => n.id === edge.to);

        if (fromNode?.position && toNode?.position) {
          const line = document.createElement('div');
          line.className = 'edge' + (edge.from === activeState || edge.to === activeState ? ' active' : '');
          // ... line rendering logic
          container.appendChild(line);
        }
      });

      // Render nodes
      data.nodes.forEach(node => {
        if (!node.position) return;

        const div = document.createElement('div');
        div.className = 'node' + (node.id === activeState ? ' active' : '');
        div.style.left = (node.position.x - 40) + 'px';
        div.style.top = (node.position.y - 15) + 'px';

        const content = document.createElement('div');
        content.className = 'node-content';
        content.textContent = node.label;
        div.appendChild(content);

        container.appendChild(div);
      });
    }

    render();

    // Update active state (in real implementation, this would listen to machine events)
    function setActiveState(state) {
      activeState = state;
      render();
    }
  </script>
</body>
</html>
  `;
}
