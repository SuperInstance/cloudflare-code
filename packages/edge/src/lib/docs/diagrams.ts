/**
 * Architecture Diagram Generator
 *
 * Generates architecture diagrams from code structure using Mermaid.
 * Supports component diagrams, deployment diagrams, sequence diagrams,
 * flow charts, and class diagrams.
 */

import type {
  ArchitectureDiagram,
  DiagramNode,
  DiagramEdge,
  ParsedDocumentation,
  DocSymbol,
  DiagramGeneratorOptions,
} from './types';

const DEFAULT_OPTIONS: Required<DiagramGeneratorOptions> = {
  type: 'component',
  includeDependencies: true,
  includeTypes: true,
  maxDepth: 5,
  exclude: ['node_modules/**', 'dist/**', 'build/**'],
  groupByModule: true,
  outputFormat: 'mermaid',
};

/**
 * Architecture Diagram Generator
 */
export class DiagramGenerator {
  private options: Required<DiagramGeneratorOptions>;

  constructor(options: DiagramGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate architecture diagram from parsed documentation
   *
   * @param docs - Parsed documentation
   * @returns Architecture diagram
   */
  generateArchitectureDiagram(docs: ParsedDocumentation[]): ArchitectureDiagram {
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const nodeMap = new Map<string, DiagramNode>();

    // Process each file
    for (const doc of docs) {
      for (const symbol of doc.symbols) {
        // Skip if already processed
        if (nodeMap.has(symbol.id)) continue;

        // Create node for symbol
        const node = this.createNodeFromSymbol(symbol);
        nodes.push(node);
        nodeMap.set(symbol.id, node);

        // Add edges for dependencies
        if (this.options.includeDependencies) {
          const depEdges = this.createDependencyEdges(symbol, nodeMap);
          edges.push(...depEdges);
        }

        // Add edges for type relationships
        if (this.options.includeTypes) {
          const typeEdges = this.createTypeEdges(symbol, nodeMap);
          edges.push(...typeEdges);
        }
      }
    }

    // Group nodes by module if enabled
    const groups = this.options.groupByModule
      ? this.groupNodesByModule(nodes)
      : undefined;

    return {
      title: `${this.options.type.charAt(0).toUpperCase() + this.options.type.slice(1)} Diagram`,
      type: this.options.type,
      nodes,
      edges,
      groups,
    };
  }

  /**
   * Generate diagram in Mermaid format
   *
   * @param diagram - Architecture diagram
   * @returns Mermaid diagram source
   */
  generateMermaid(diagram: ArchitectureDiagram): string {
    switch (diagram.type) {
      case 'component':
        return this.generateMermaidComponent(diagram);
      case 'deployment':
        return this.generateMermaidDeployment(diagram);
      case 'sequence':
        return this.generateMermaidSequence(diagram);
      case 'flow':
        return this.generateMermaidFlowchart(diagram);
      case 'class':
        return this.generateMermaidClass(diagram);
      default:
        return this.generateMermaidComponent(diagram);
    }
  }

  /**
   * Generate Mermaid component diagram
   *
   * @private
   */
  private generateMermaidComponent(diagram: ArchitectureDiagram): string {
    const lines: string[] = ['graph TD'];

    // Add subgraphs for groups
    if (diagram.groups) {
      for (const group of diagram.groups) {
        lines.push(`  subgraph ${this.slugify(group.name)}[${group.name}]`);
        for (const nodeId of group.nodes) {
          const node = diagram.nodes.find(n => n.id === nodeId);
          if (node) {
            lines.push(`    ${node.id}[${node.label}]`);
          }
        }
        lines.push('  end');
      }
    }

    // Add ungrouped nodes
    const groupedNodeIds = new Set(
      diagram.groups?.flatMap(g => g.nodes) || []
    );

    for (const node of diagram.nodes) {
      if (groupedNodeIds.has(node.id)) continue;
      lines.push(`  ${node.id}[${node.label}]`);
    }

    // Add edges
    for (const edge of diagram.edges) {
      const style = this.getEdgeStyle(edge);
      lines.push(`  ${edge.from} ${style} ${edge.to}${edge.label ? `|${edge.label}|` : ''}`);
    }

    // Add styling
    lines.push('');
    this.addComponentStyling(lines, diagram);

    return lines.join('\n');
  }

  /**
   * Generate Mermaid deployment diagram
   *
   * @private
   */
  private generateMermaidDeployment(diagram: ArchitectureDiagram): string {
    const lines: string[] = ['graph TD'];

    // Group by node type
    for (const node of diagram.nodes) {
      const icon = this.getNodeIcon(node.type);
      lines.push(`  ${node.id}${icon}${node.label}${icon}`);
    }

    // Add edges
    for (const edge of diagram.edges) {
      lines.push(`  ${edge.from} --> ${edge.to}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate Mermaid sequence diagram
   *
   * @private
   */
  private generateMermaidSequence(diagram: ArchitectureDiagram): string {
    const lines: string[] = ['sequenceDiagram'];

    // Extract participants
    const participants = diagram.nodes.slice(0, 10).map(n => n.id);
    for (const participant of participants) {
      const node = diagram.nodes.find(n => n.id === participant);
      if (node) {
        lines.push(`  participant ${participant} as ${node.label}`);
      }
    }

    // Add interactions
    let fromNode = participants[0];
    for (const edge of diagram.edges) {
      lines.push(`  ${edge.from}->>${edge.to}: ${edge.label || 'uses'}`);
      fromNode = edge.to;
    }

    return lines.join('\n');
  }

  /**
   * Generate Mermaid flowchart
   *
   * @private
   */
  private generateMermaidFlowchart(diagram: ArchitectureDiagram): string {
    const lines: string[] = ['graph LR'];

    // Add nodes
    for (const node of diagram.nodes) {
      const shape = this.getNodeShape(node.type);
      lines.push(`  ${node.id}${shape}${node.label}${shape}`);
    }

    // Add edges
    for (const edge of diagram.edges) {
      const arrow = this.getFlowArrow(edge.type);
      lines.push(`  ${edge.from} ${arrow} ${edge.to}${edge.label ? `|${edge.label}|` : ''}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate Mermaid class diagram
   *
   * @private
   */
  private generateMermaidClass(diagram: ArchitectureDiagram): string {
    const lines: string[] = ['classDiagram'];

    // Add classes
    for (const node of diagram.nodes) {
      if (node.type === 'component') {
        lines.push(`  class ${node.id} {`);
        if (node.description) {
          lines.push(`    <<${node.description}>>`);
        }
        if (node.properties) {
          for (const [key, value] of Object.entries(node.properties)) {
            lines.push(`    ${key}: ${value}`);
          }
        }
        lines.push('  }');
      }
    }

    // Add relationships
    for (const edge of diagram.edges) {
      const relation = this.getClassRelation(edge.type);
      lines.push(`  ${edge.from} ${relation} ${edge.type} : ${edge.label || ''}`);
    }

    return lines.join('\n');
  }

  /**
   * Create node from symbol
   *
   * @private
   */
  private createNodeFromSymbol(symbol: DocSymbol): DiagramNode {
    return {
      id: symbol.id,
      label: symbol.name,
      type: this.getSymbolNodeType(symbol),
      description: symbol.summary,
      properties: {
        kind: symbol.kind,
        exported: symbol.exported.toString(),
      },
    };
  }

  /**
   * Get node type from symbol
   *
   * @private
   */
  private getSymbolNodeType(symbol: DocSymbol): DiagramNode['type'] {
    if (symbol.kind === 'class' || symbol.kind === 'interface') {
      return 'component';
    }
    if (symbol.kind === 'function' || symbol.kind === 'method') {
      return 'service';
    }
    return 'component';
  }

  /**
   * Create dependency edges
   *
   * @private
   */
  private createDependencyEdges(symbol: DocSymbol, nodeMap: Map<string, DiagramNode>): DiagramEdge[] {
    const edges: DiagramEdge[] = [];

    // Check imports
    if (symbol.members) {
      for (const member of symbol.members) {
        if (nodeMap.has(member.id)) {
          edges.push({
            from: symbol.id,
            to: member.id,
            type: 'uses',
            style: 'dashed',
          });
        }
      }
    }

    // Check extends/implements
    if (symbol.extends) {
      for (const base of symbol.extends) {
        // Find base in node map
        for (const [id, node] of nodeMap.entries()) {
          if (node.label === base) {
            edges.push({
              from: symbol.id,
              to: id,
              type: 'extends',
              style: 'solid',
            });
            break;
          }
        }
      }
    }

    if (symbol.implements) {
      for (const iface of symbol.implements) {
        for (const [id, node] of nodeMap.entries()) {
          if (node.label === iface) {
            edges.push({
              from: symbol.id,
              to: id,
              type: 'implements',
              style: 'dashed',
            });
            break;
          }
        }
      }
    }

    return edges;
  }

  /**
   * Create type relationship edges
   *
   * @private
   */
  private createTypeEdges(symbol: DocSymbol, nodeMap: Map<string, DiagramNode>): DiagramEdge[] {
    const edges: DiagramEdge[] = [];

    // Check type parameters
    if (symbol.typeParameters) {
      for (const tp of symbol.typeParameters) {
        if (tp.constraint) {
          for (const [id, node] of nodeMap.entries()) {
            if (node.label === tp.constraint) {
              edges.push({
                from: symbol.id,
                to: id,
                type: 'depends',
                label: `constrained by ${tp.name}`,
                style: 'dotted',
              });
              break;
            }
          }
        }
      }
    }

    // Check return type
    if (symbol.returnType) {
      for (const [id, node] of nodeMap.entries()) {
        if (node.label === symbol.returnType) {
          edges.push({
            from: symbol.id,
            to: id,
            type: 'depends',
            label: 'returns',
            style: 'dotted',
          });
          break;
        }
      }
    }

    return edges;
  }

  /**
   * Group nodes by module
   *
   * @private
   */
  private groupNodesByModule(nodes: DiagramNode[]): Array<{ name: string; nodes: string[] }> {
    const groups = new Map<string, string[]>();

    for (const node of nodes) {
      // Extract module from ID or use default
      const parts = node.id.split(':');
      const module = parts.length > 1 ? parts[0] : 'default';

      if (!groups.has(module)) {
        groups.set(module, []);
      }
      groups.get(module)!.push(node.id);
    }

    return Array.from(groups.entries()).map(([name, nodes]) => ({ name, nodes }));
  }

  /**
   * Get edge style for Mermaid
   *
   * @private
   */
  private getEdgeStyle(edge: DiagramEdge): string {
    switch (edge.style) {
      case 'dashed':
        return '-.->';
      case 'dotted':
        return '-..->';
      default:
        return '-->';
    }
  }

  /**
   * Get flow arrow type
   *
   * @private
   */
  private getFlowArrow(type: DiagramEdge['type']): string {
    switch (type) {
      case 'extends':
        return '--|>';
      case 'implements':
        return '..|>';
      case 'depends':
        return '-..->';
      case 'flows':
        return '==>';
      default:
        return '-->';
    }
  }

  /**
   * Get class relation notation
   *
   * @private
   */
  private getClassRelation(type: DiagramEdge['type']): string {
    switch (type) {
      case 'extends':
        return '--|>';
      case 'implements':
        return '..|>';
      case 'depends':
        return '-->';
      default:
        return '-->';
    }
  }

  /**
   * Get node icon for deployment diagrams
   *
   * @private
   */
  private getNodeIcon(type: DiagramNode['type']): string {
    const icons: Record<DiagramNode['type'], string> = {
      component: '[',
      service: '(',
      database: '[(',
      queue: '>',
      cache: '((',
      external: '[',
    };
    return icons[type] || '[';
  }

  /**
   * Get node shape for flowcharts
   *
   * @private
   */
  private getNodeShape(type: DiagramNode['type']): string {
    const shapes: Record<DiagramNode['type'], string> = {
      component: '[',
      service: '[',
      database: '[(',
      queue: '[',
      cache: '[',
      external: '[',
    };
    return shapes[type] || '[';
  }

  /**
   * Add component styling
   *
   * @private
   */
  private addComponentStyling(lines: string[], diagram: ArchitectureDiagram): void {
    lines.push('classDef componentStyle fill:#e1f5fe,stroke:#01579b,stroke-width:2px');
    lines.push('classDef serviceStyle fill:#f3e5f5,stroke:#4a148c,stroke-width:2px');
    lines.push('classDef databaseStyle fill:#fff3e0,stroke:#e65100,stroke-width:2px');
    lines.push('classDef queueStyle fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px');
    lines.push('classDef cacheStyle fill:#fce4ec,stroke:#880e4f,stroke-width:2px');

    for (const node of diagram.nodes) {
      const styleClass = `${node.id}Style`;
      lines.push(`class ${node.id} ${styleClass}`);
    }
  }

  /**
   * Slugify string for IDs
   *
   * @private
   */
  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Generate PlantUML diagram
   *
   * @param diagram - Architecture diagram
   * @returns PlantUML source
   */
  generatePlantUML(diagram: ArchitectureDiagram): string {
    const lines: string[] = ['@startuml'];

    switch (diagram.type) {
      case 'component':
        lines.push('component "Architecture" {');
        for (const node of diagram.nodes) {
          lines.push(`  [${node.label}] as ${node.id}`);
        }
        for (const edge of diagram.edges) {
          lines.push(`  ${edge.from} --> ${edge.to} : ${edge.label || edge.type}`);
        }
        lines.push('}');
        break;

      case 'class':
        for (const node of diagram.nodes) {
          lines.push(`class ${node.id} {`);
          if (node.description) {
            lines.push(`  ${node.description}`);
          }
          lines.push('}');
        }
        for (const edge of diagram.edges) {
          lines.push(`${edge.from} ${edge.type} ${edge.to}`);
        }
        break;

      default:
        lines.push('component "Architecture" {');
        for (const node of diagram.nodes) {
          lines.push(`  component [${node.label}] as ${node.id}`);
        }
        for (const edge of diagram.edges) {
          lines.push(`  ${edge.from} --> ${edge.to}`);
        }
        lines.push('}');
    }

    lines.push('@enduml');
    return lines.join('\n');
  }

  /**
   * Generate Graphviz DOT diagram
   *
   * @param diagram - Architecture diagram
   * @returns Graphviz DOT source
   */
  generateGraphviz(diagram: ArchitectureDiagram): string {
    const lines: string[] = ['digraph Architecture {'];
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box, style=rounded];');
    lines.push('');

    for (const node of diagram.nodes) {
      const color = this.getNodeColor(node.type);
      lines.push(`  "${node.id}" [label="${node.label}", fillcolor="${color}", style="filled,rounded"];`);
    }

    lines.push('');

    for (const edge of diagram.edges) {
      const style = edge.style === 'dashed' ? 'dashed' : 'solid';
      lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.label || edge.type}", style="${style}"];`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Get node color for Graphviz
   *
   * @private
   */
  private getNodeColor(type: DiagramNode['type']): string {
    const colors: Record<DiagramNode['type'], string> = {
      component: '#e1f5fe',
      service: '#f3e5f5',
      database: '#fff3e0',
      queue: '#e8f5e9',
      cache: '#fce4ec',
      external: '#f5f5f5',
    };
    return colors[type] || '#f5f5f5';
  }
}

/**
 * Create a diagram generator instance
 */
export function createDiagramGenerator(options?: DiagramGeneratorOptions): DiagramGenerator {
  return new DiagramGenerator(options);
}

/**
 * Default diagram generator instance
 */
export const defaultDiagramGenerator = new DiagramGenerator();
