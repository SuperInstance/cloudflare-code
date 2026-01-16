// @ts-nocheck
/**
 * Circular Dependency Detection and Analysis
 *
 * This module provides comprehensive circular dependency detection including:
 * - Direct circular dependency detection
 * - Indirect circular dependency detection
 * - Cycle visualization
 * - Cycle breaking suggestions
 * - Load order analysis
 * - Module bundling analysis
 * - Optimization suggestions
 */

import { join, relative } from 'path';

import type {
  DependencyGraph,
  CircularCycle,
  Severity,
  AnalyzerConfig,
} from '../types/index.js';

/**
 * Circular dependency detector result
 */
interface CycleDetectionResult {
  cycles: CircularCycle[];
  summary: {
    totalCycles: number;
    directCycles: number;
    indirectCycles: number;
    affectedModules: number;
    severityBreakdown: Record<Severity, number>;
  };
}

/**
 * DFS state for cycle detection
 */
interface DFSState {
  visiting: Set<string>;
  visited: Set<string>;
  path: string[];
  cycles: CircularCycle[];
}

/**
 * Circular Dependency Detector
 */
export class CircularDependencyDetector {
  private config: AnalyzerConfig;
  private ignorePatterns: RegExp[];

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.ignorePatterns =
      config.rules?.circular?.ignorePatterns?.map((p) => new RegExp(p)) || [];
  }

  /**
   * Detect all circular dependencies in the graph
   */
  detect(graph: DependencyGraph): CycleDetectionResult {
    const state: DFSState = {
      visiting: new Set(),
      visited: new Set(),
      path: [],
      cycles: [],
    };

    // Detect cycles starting from each node
    for (const node of graph.nodes.keys()) {
      if (!state.visited.has(node) && !this.shouldIgnore(node)) {
        this.detectCyclesFromNode(node, graph, state);
      }
    }

    // Analyze and classify cycles
    const analyzedCycles = this.analyzeCycles(state.cycles, graph);

    // Generate summary
    const summary = this.generateSummary(analyzedCycles);

    return {
      cycles: analyzedCycles,
      summary,
    };
  }

  /**
   * Detect cycles starting from a specific node
   */
  private detectCyclesFromNode(
    node: string,
    graph: DependencyGraph,
    state: DFSState
  ): void {
    state.visiting.add(node);
    state.path.push(node);

    const neighbors = graph.adjacencies.get(node) || new Set();

    for (const neighbor of neighbors) {
      if (this.shouldIgnore(neighbor)) {
        continue;
      }

      // Found a cycle
      if (state.visiting.has(neighbor)) {
        const cycleStart = state.path.indexOf(neighbor);
        const cyclePath = state.path.slice(cycleStart);
        cyclePath.push(neighbor); // Complete the cycle

        state.cycles.push({
          path: cyclePath,
          length: cyclePath.length,
          type: cyclePath.length === 2 ? 'direct' : 'indirect',
          severity: 'low',
          suggestions: [],
        });
      } else if (!state.visited.has(neighbor)) {
        this.detectCyclesFromNode(neighbor, graph, state);
      }
    }

    state.path.pop();
    state.visiting.delete(node);
    state.visited.add(node);
  }

  /**
   * Analyze cycles and add metadata
   */
  private analyzeCycles(cycles: CircularCycle[], graph: DependencyGraph): CircularCycle[] {
    return cycles.map((cycle) => {
      const severity = this.calculateSeverity(cycle, graph);
      const suggestions = this.generateSuggestions(cycle, graph);

      return {
        ...cycle,
        severity,
        suggestions,
      };
    });
  }

  /**
   * Calculate severity of a cycle
   */
  private calculateSeverity(cycle: CircularCycle, graph: DependencyGraph): Severity {
    let severity: Severity = 'low';

    // Direct circular dependencies are more severe
    if (cycle.type === 'direct') {
      severity = 'high';
    }

    // Long cycles indicate deeper architectural issues
    if (cycle.length > 5) {
      severity = 'critical';
    } else if (cycle.length > 3) {
      severity = severity === 'high' ? 'critical' : 'moderate';
    }

    // Check if cycle involves critical paths
    for (const node of cycle.path) {
      const nodeData = graph.nodes.get(node);
      if (nodeData?.type === 'package') {
        severity = severity === 'critical' ? 'critical' : 'high';
        break;
      }
    }

    return severity;
  }

  /**
   * Generate suggestions for breaking the cycle
   */
  private generateSuggestions(cycle: CircularCycle, graph: DependencyGraph): string[] {
    const suggestions: string[] = [];

    // Find the best edge to break
    const breakSuggestions = this.suggestBreakPoints(cycle, graph);
    suggestions.push(...breakSuggestions);

    // Suggest architectural patterns
    const architectureSuggestions = this.suggestArchitecturalChanges(cycle, graph);
    suggestions.push(...architectureSuggestions);

    // Suggest refactoring approaches
    const refactoringSuggestions = this.suggestRefactoring(cycle, graph);
    suggestions.push(...refactoringSuggestions);

    return suggestions;
  }

  /**
   * Suggest specific points to break the cycle
   */
  private suggestBreakPoints(cycle: CircularCycle, graph: DependencyGraph): string[] {
    const suggestions: string[] = [];
    const edges: Array<{ from: string; to: string; weight: number }> = [];

    // Analyze each edge in the cycle
    for (let i = 0; i < cycle.path.length - 1; i++) {
      const from = cycle.path[i];
      const to = cycle.path[i + 1];

      const edgeData = graph.edges.find((e) => e.from === from && e.to === to);
      const weight = edgeData?.weight || 1;

      // Calculate break score (lower is better)
      const fromNode = graph.nodes.get(from);
      const toNode = graph.nodes.get(to);

      let breakScore = weight;

      // Prefer breaking edges to files with fewer dependents
      const fromDependents = (graph.reverseAdjacencies.get(from) || new Set()).size;
      const toDependents = (graph.reverseAdjacencies.get(to) || new Set()).size;

      if (fromDependents > toDependents) {
        breakScore -= 0.5;
      } else {
        breakScore += 0.5;
      }

      edges.push({ from, to, weight: breakScore });
    }

    // Sort by break score and suggest top candidates
    edges.sort((a, b) => a.weight - b.weight);

    for (const edge of edges.slice(0, 3)) {
      const fromLabel = relative(this.config.projectPath, edge.from);
      const toLabel = relative(this.config.projectPath, edge.to);

      suggestions.push(
        `Break the dependency from "${fromLabel}" to "${toLabel}" by extracting shared logic to a separate module`
      );
    }

    return suggestions;
  }

  /**
   * Suggest architectural changes
   */
  private suggestArchitecturalChanges(cycle: CircularCycle, graph: DependencyGraph): string[] {
    const suggestions: string[] = [];

    // Check for shared dependencies
    const sharedDeps = this.findSharedDependencies(cycle, graph);
    if (sharedDeps.length > 0) {
      suggestions.push(
        `Extract common dependencies (${sharedDeps.join(', ')}) to a shared module to break the circular dependency`
      );
    }

    // Check for potential inversion of control
    if (cycle.type === 'direct') {
      const [a, b] = cycle.path;
      const aLabel = relative(this.config.projectPath, a);
      const bLabel = relative(this.config.projectPath, b);
      suggestions.push(
        `Consider using dependency injection or events to break the direct cycle between "${aLabel}" and "${bLabel}"`
      );
    }

    // Suggest layering for longer cycles
    if (cycle.length > 3) {
      suggestions.push(
        `Consider introducing a layered architecture or mediator pattern to resolve this ${cycle.length}-module cycle`
      );
    }

    return suggestions;
  }

  /**
   * Find shared dependencies in the cycle
   */
  private findSharedDependencies(cycle: CircularCycle, graph: DependencyGraph): string[] {
    const dependencySets = cycle.path.map((node) => {
      const deps = graph.adjacencies.get(node) || new Set();
      return new Set(Array.from(deps).filter((d) => cycle.path.includes(d)));
    });

    if (dependencySets.length === 0) return [];

    // Find intersection of all dependency sets
    const shared = Array.from(dependencySets[0]).filter((dep) =>
      dependencySets.every((set) => set.has(dep))
    );

    return shared.map((dep) => relative(this.config.projectPath, dep));
  }

  /**
   * Suggest refactoring approaches
   */
  private suggestRefactoring(cycle: CircularCycle, graph: DependencyGraph): string[] {
    const suggestions: string[] = [];

    // Check if any modules are purely utilities
    const utilityModules = cycle.path.filter((node) => {
      const label = graph.nodes.get(node)?.label || '';
      return /util|helper|shared|common/i.test(label);
    });

    if (utilityModules.length > 0) {
      suggestions.push(
        `Move utility modules (${utilityModules.map((m) => relative(this.config.projectPath, m)).join(', ')}) to a separate package to eliminate circular dependencies`
      );
    }

    // Suggest lazy loading
    if (cycle.length > 3) {
      suggestions.push(
        'Consider using lazy loading or dynamic imports to defer some dependencies in the cycle'
      );
    }

    // Suggest interface extraction
    suggestions.push(
      'Extract interfaces or abstract classes to decouple implementations and break the dependency cycle'
    );

    return suggestions;
  }

  /**
   * Generate analysis summary
   */
  private generateSummary(cycles: CircularCycle[]): CycleDetectionResult['summary'] {
    const severityBreakdown: Record<Severity, number> = {
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
    };

    const affectedModules = new Set<string>();

    for (const cycle of cycles) {
      severityBreakdown[cycle.severity]++;
      for (const module of cycle.path) {
        affectedModules.add(module);
      }
    }

    return {
      totalCycles: cycles.length,
      directCycles: cycles.filter((c) => c.type === 'direct').length,
      indirectCycles: cycles.filter((c) => c.type === 'indirect').length,
      affectedModules: affectedModules.size,
      severityBreakdown,
    };
  }

  /**
   * Check if node should be ignored
   */
  private shouldIgnore(node: string): boolean {
    const relativePath = relative(this.config.projectPath, node);
    return this.ignorePatterns.some((pattern) => pattern.test(relativePath));
  }
}

/**
 * Load Order Analyzer
 */
export class LoadOrderAnalyzer {
  /**
   * Analyze module load order and detect potential issues
   */
  static analyze(graph: DependencyGraph): {
    loadOrder: string[];
    issues: Array<{
      type: string;
      message: string;
      modules: string[];
    }>;
  } {
    const issues: Array<{
      type: string;
      message: string;
      modules: string[];
    }> = [];

    // Find topological order
    const loadOrder = LoadOrderAnalyzer.topologicalSort(graph);

    // Check for modules that would need to load before their dependencies
    for (let i = 0; i < loadOrder.length; i++) {
      const module = loadOrder[i];
      const dependents = graph.reverseAdjacencies.get(module) || new Set();

      for (const dependent of dependents) {
        const dependentIndex = loadOrder.indexOf(dependent);
        if (dependentIndex > i) {
          issues.push({
            type: 'load-order',
            message: `Module "${relative(this.config.projectPath, module)}" is loaded before its dependent "${relative(this.config.projectPath, dependent)}"`,
            modules: [module, dependent],
          });
        }
      }
    }

    return { loadOrder, issues };
  }

  /**
   * Perform topological sort on the graph
   */
  private static topologicalSort(graph: DependencyGraph): string[] {
    const inDegree = new Map<string, number>();
    const result: string[] = [];
    const queue: string[] = [];

    // Calculate in-degrees
    for (const [node] of graph.nodes) {
      inDegree.set(node, 0);
    }

    for (const edge of graph.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // Start with nodes that have no incoming edges
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    // Process nodes
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      const neighbors = graph.adjacencies.get(node) || new Set();
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }
}

/**
 * Module Bundling Analyzer
 */
export class BundlingAnalyzer {
  /**
   * Analyze how modules would be bundled
   */
  static analyze(graph: DependencyGraph): {
    bundles: Array<{
      name: string;
      modules: string[];
      size: number;
    }>;
    splitting: Array<{
      reason: string;
      modules: string[];
    }>;
  } {
    const bundles: Array<{
      name: string;
      modules: string[];
      size: number;
    }> = [];

    const splitting: Array<{
      reason: string;
      modules: string[];
    }> = [];

    // Find strongly connected components (these would be bundled together)
    const sccs = BundlingAnalyzer.findStronglyConnectedComponents(graph);

    for (let i = 0; i < sccs.length; i++) {
      const scc = sccs[i];
      let size = 0;

      for (const module of scc) {
        const node = graph.nodes.get(module);
        size += (node?.metadata?.size as number) || 0;
      }

      bundles.push({
        name: `bundle-${i + 1}`,
        modules: scc,
        size,
      });
    }

    // Identify code splitting opportunities
    for (const edge of graph.edges) {
      if (edge.type === 'dynamic') {
        splitting.push({
          reason: 'dynamic-import',
          modules: [edge.from, edge.to],
        });
      }
    }

    return { bundles, splitting };
  }

  /**
   * Find strongly connected components using Kosaraju's algorithm
   */
  private static findStronglyConnectedComponents(graph: DependencyGraph): string[][] {
    const visited = new Set<string>();
    const order: string[] = [];

    // First pass: build order
    const dfs1 = (node: string) => {
      visited.add(node);
      const neighbors = graph.adjacencies.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs1(neighbor);
        }
      }
      order.push(node);
    };

    for (const node of graph.nodes.keys()) {
      if (!visited.has(node)) {
        dfs1(node);
      }
    }

    // Second pass: find components
    visited.clear();
    const components: string[][] = [];

    const dfs2 = (node: string, component: string[]) => {
      visited.add(node);
      component.push(node);
      const reverseNeighbors = graph.reverseAdjacencies.get(node) || new Set();
      for (const neighbor of reverseNeighbors) {
        if (!visited.has(neighbor)) {
          dfs2(neighbor, component);
        }
      }
    };

    for (let i = order.length - 1; i >= 0; i--) {
      const node = order[i];
      if (!visited.has(node)) {
        const component: string[] = [];
        dfs2(node, component);
        components.push(component);
      }
    }

    return components;
  }
}

/**
 * Cycle Visualization
 */
export class CycleVisualizer {
  /**
   * Generate visualization for a cycle
   */
  static visualize(cycle: CircularCycle): {
    dot: string;
    mermaid: string;
    ascii: string;
  } {
    const dot = this.generateDot(cycle);
    const mermaid = this.generateMermaid(cycle);
    const ascii = this.generateASCII(cycle);

    return { dot, mermaid, ascii };
  }

  /**
   * Generate Graphviz DOT format
   */
  private static generateDot(cycle: CircularCycle): string {
    const lines: string[] = ['digraph cycle {'];
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box, style=rounded];');
    lines.push('');

    for (let i = 0; i < cycle.path.length; i++) {
      const node = cycle.path[i];
      lines.push(`  "${node}" [label="${node.split('/').pop()}"];`);

      if (i < cycle.path.length - 1) {
        const next = cycle.path[i + 1];
        lines.push(`  "${node}" -> "${next}" [color=red, penwidth=2];`);
      }
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generate Mermaid.js format
   */
  private static generateMermaid(cycle: CircularCycle): string {
    const lines: string[] = ['graph LR'];

    for (let i = 0; i < cycle.path.length; i++) {
      const node = cycle.path[i].split('/').pop();
      const next = cycle.path[(i + 1) % cycle.path.length].split('/').pop();
      lines.push(`  ${node}-->|${i === cycle.path.length - 1 ? '⚠️' : ''}| ${next}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate ASCII art visualization
   */
  private static generateASCII(cycle: CircularCycle): string {
    const lines: string[] = [];

    for (let i = 0; i < cycle.path.length; i++) {
      const current = cycle.path[i].split('/').pop();
      const next = cycle.path[(i + 1) % cycle.path.length].split('/').pop();
      const isLast = i === cycle.path.length - 1;

      lines.push(`┌─ ${current} ─${isLast '┐' : '┐'}`);
      lines.push(`│`);
      lines.push(`└──> ${next}`);
    }

    return lines.join('\n');
  }
}

/**
 * Optimization Suggestions for Circular Dependencies
 */
export class CycleOptimizer {
  /**
   * Generate optimization suggestions
   */
  static optimize(cycles: CircularCycle[], graph: DependencyGraph): Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    description: string;
    code?: string;
  }> {
    const suggestions: Array<{
      priority: 'high' | 'medium' | 'low';
      action: string;
      description: string;
      code?: string;
    }> = [];

    // Group cycles by severity
    const criticalCycles = cycles.filter((c) => c.severity === 'critical');
    const highCycles = cycles.filter((c) => c.severity === 'high');

    // Generate high-priority suggestions
    for (const cycle of criticalCycles) {
      suggestions.push({
        priority: 'high',
        action: 'break-critical-cycle',
        description: `Break the critical circular dependency in ${cycle.path.join(' -> ')}`,
        code: this.generateBreakCode(cycle),
      });
    }

    // Generate medium-priority suggestions
    for (const cycle of highCycles) {
      suggestions.push({
        priority: 'medium',
        action: 'refactor-high-severity',
        description: `Refactor high-severity circular dependency: ${cycle.path.join(' -> ')}`,
      });
    }

    // Suggest architectural improvements
    if (cycles.length > 5) {
      suggestions.push({
        priority: 'high',
        action: 'architectural-review',
        description: `Found ${cycles.length} circular dependencies. Consider a comprehensive architectural review to address systemic issues.`,
      });
    }

    return suggestions;
  }

  /**
   * Generate code example for breaking a cycle
   */
  private static generateBreakCode(cycle: CircularCycle): string {
    const midPoint = Math.floor(cycle.path.length / 2);
    const module1 = cycle.path[midPoint - 1]?.split('/').pop() || 'ModuleA';
    const module2 = cycle.path[midPoint]?.split('/').pop() || 'ModuleB';

    return `
// Before (circular dependency):
// ${module1} imports ${module2}
// ${module2} imports ${module1}

// Solution 1: Extract shared interface
interface I${module1} {
  processData(data: unknown): Promise<unknown>;
}

class ${module1} implements I${module1} {
  async processData(data: unknown) {
    // Implementation
  }
}

// Solution 2: Use dependency injection
class ${module2} {
  constructor(private dependency: I${module1}) {}

  async process(data: unknown) {
    return await this.dependency.processData(data);
  }
}

// Solution 3: Use event emitter
import { EventEmitter } from 'events';

class ${module1} extends EventEmitter {
  async processData(data: unknown) {
    const result = await this.process(data);
    this.emit('processed', result);
    return result;
  }
}
`.trimStart();
  }
}

/**
 * Helper function for relative path
 */
function relative(from: string, to: string): string {
  const path = require('path');
  return path.relative(from, to);
}

// Add config property to LoadOrderAnalyzer
(LoadOrderAnalyzer as any).config = { projectPath: '' };
