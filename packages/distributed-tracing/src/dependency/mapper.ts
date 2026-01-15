/**
 * Dependency Mapper - Service dependency graph and topology analysis
 * Analyzes service relationships, call patterns, and generates topology visualizations
 */

import { EventEmitter } from 'eventemitter3';

import {
  Trace,
  Span,
  ServiceDependency,
  DependencyGraph,
  DependencyNode,
  DependencyGraphMetrics,
  TraceId,
  Duration,
} from '../types/trace.types';
import { calculateDurationStatistics } from '../utils/time.utils';

/**
 * Dependency metrics for a single service pair
 */
interface DependencyMetrics {
  callCount: number;
  latencies: Duration[];
  errorCount: number;
  lastSeen: number;
}

/**
 * Dependency Mapper class
 */
export class DependencyMapper extends EventEmitter {
  private dependencyMap: Map<string, Map<string, DependencyMetrics>>;
  private serviceMetrics: Map<string, ServiceMetrics>;

  constructor() {
    super();
    this.dependencyMap = new Map();
    this.serviceMetrics = new Map();
  }

  /**
   * Process a trace and update dependency map
   */
  processTrace(trace: Trace): void {
    // Process each span to extract dependencies
    for (const span of trace.spans) {
      if (span.parentSpanId) {
        const parent = trace.spans.find((s) => s.spanId === span.parentSpanId);
        if (parent && parent.service !== span.service) {
          this.addDependency(parent.service, span.service, span);
        }
      }

      // Update service metrics
      this.updateServiceMetrics(span);
    }

    this.emit('trace:processed', { traceId: trace.traceId });
  }

  /**
   * Process multiple traces
   */
  processTraces(traces: Trace[]): void {
    for (const trace of traces) {
      this.processTrace(trace);
    }
  }

  /**
   * Add a dependency between services
   */
  private addDependency(from: string, to: string, span: Span): void {
    if (!this.dependencyMap.has(from)) {
      this.dependencyMap.set(from, new Map());
    }

    const fromMap = this.dependencyMap.get(from)!;
    if (!fromMap.has(to)) {
      fromMap.set(to, {
        callCount: 0,
        latencies: [],
        errorCount: 0,
        lastSeen: 0,
      });
    }

    const metrics = fromMap.get(to)!;
    metrics.callCount++;
    if (span.duration) {
      metrics.latencies.push(span.duration);
    }
    if (span.status?.code === 2) {
      // ERROR
      metrics.errorCount++;
    }
    metrics.lastSeen = Math.max(metrics.lastSeen, span.endTime || span.startTime);
  }

  /**
   * Update service-level metrics
   */
  private updateServiceMetrics(span: Span): void {
    if (!this.serviceMetrics.has(span.service)) {
      this.serviceMetrics.set(span.service, {
        totalCalls: 0,
        inboundCalls: 0,
        outboundCalls: 0,
        errors: 0,
        latencies: [],
      });
    }

    const metrics = this.serviceMetrics.get(span.service)!;
    metrics.totalCalls++;
    if (span.duration) {
      metrics.latencies.push(span.duration);
    }
    if (span.status?.code === 2) {
      metrics.errors++;
    }
  }

  /**
   * Get all dependencies
   */
  getDependencies(): ServiceDependency[] {
    const dependencies: ServiceDependency[] = [];

    for (const [from, toMap] of this.dependencyMap.entries()) {
      for (const [to, metrics] of toMap.entries()) {
        const stats = calculateDurationStatistics(metrics.latencies);

        dependencies.push({
          from,
          to,
          callCount: metrics.callCount,
          avgLatency: stats.avg,
          minLatency: stats.min,
          maxLatency: stats.max,
          p95Latency: stats.p95,
          p99Latency: stats.p99,
          errorRate: metrics.errorCount / metrics.callCount,
          lastSeen: metrics.lastSeen,
        });
      }
    }

    return dependencies;
  }

  /**
   * Get dependencies for a specific service
   */
  getServiceDependencies(service: string): ServiceDependency[] {
    return this.getDependencies().filter((d) => d.from === service || d.to === service);
  }

  /**
   * Get inbound dependencies (calls to this service)
   */
  getInboundDependencies(service: string): ServiceDependency[] {
    return this.getDependencies().filter((d) => d.to === service);
  }

  /**
   * Get outbound dependencies (calls from this service)
   */
  getOutboundDependencies(service: string): ServiceDependency[] {
    return this.getDependencies().filter((d) => d.from === service);
  }

  /**
   * Build dependency graph
   */
  buildGraph(): DependencyGraph {
    const nodes = this.buildNodes();
    const edges = this.getDependencies();
    const metrics = this.calculateGraphMetrics(nodes, edges);

    return {
      nodes,
      edges,
      metrics,
    };
  }

  /**
   * Build graph nodes
   */
  private buildNodes(): DependencyNode[] {
    const nodes: DependencyNode[] = [];
    const allServices = new Set<string>();

    // Collect all services
    for (const [from] of this.dependencyMap.entries()) {
      allServices.add(from);
      for (const [to] of this.dependencyMap.get(from)!.entries()) {
        allServices.add(to);
      }
    }

    // Build nodes
    for (const service of allServices) {
      const inbound = this.getInboundDependencies(service);
      const outbound = this.getOutboundDependencies(service);
      const serviceMetrics = this.serviceMetrics.get(service);

      const totalCalls = inbound.reduce((sum, d) => sum + d.callCount, 0);
      const totalErrors = inbound.reduce((sum, d) => sum + d.callCount * d.errorRate, 0);
      const avgLatency = serviceMetrics
        ? calculateDurationStatistics(serviceMetrics.latencies).avg
        : inbound.reduce((sum, d) => sum + d.avgLatency, 0) / inbound.length || 0;

      nodes.push({
        service,
        version: undefined, // Could be extracted from spans
        inboundCalls: inbound.reduce((sum, d) => sum + d.callCount, 0),
        outboundCalls: outbound.reduce((sum, d) => sum + d.callCount, 0),
        totalCalls,
        errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
        avgLatency,
      });
    }

    return nodes;
  }

  /**
   * Calculate graph metrics
   */
  private calculateGraphMetrics(nodes: DependencyNode[], edges: ServiceDependency[]): DependencyGraphMetrics {
    const totalServices = nodes.length;
    const totalDependencies = edges.length;

    // Calculate depth (longest path)
    const { avgDepth, maxDepth } = this.calculateDepths(nodes, edges);

    // Find critical path (path with highest latency)
    const criticalPath = this.findCriticalPath(nodes, edges);

    return {
      totalServices,
      totalDependencies,
      avgDepth,
      maxDepth,
      criticalPath,
    };
  }

  /**
   * Calculate graph depths
   */
  private calculateDepths(nodes: DependencyNode[], edges: ServiceDependency[]): {
    avgDepth: number;
    maxDepth: number;
  } {
    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      adjacency.set(node.service, []);
      inDegree.set(node.service, 0);
    }

    for (const edge of edges) {
      adjacency.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // Find root nodes (no incoming edges)
    const roots = Array.from(inDegree.entries())
      .filter(([_, degree]) => degree === 0)
      .map(([service]) => service);

    // Calculate depths using BFS
    const depths = new Map<string, number>();
    for (const root of roots) {
      this.bfsDepth(root, adjacency, depths);
    }

    const depthValues = Array.from(depths.values());
    const maxDepth = Math.max(0, ...depthValues);
    const avgDepth = depthValues.length > 0 ? depthValues.reduce((a, b) => a + b, 0) / depthValues.length : 0;

    return { avgDepth, maxDepth };
  }

  /**
   * BFS to calculate depths
   */
  private bfsDepth(
    start: string,
    adjacency: Map<string, string[]>,
    depths: Map<string, number>
  ): void {
    const queue: Array<{ service: string; depth: number }> = [{ service: start, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { service, depth } = queue.shift()!;

      if (visited.has(service)) continue;
      visited.add(service);

      depths.set(service, Math.max(depths.get(service) || 0, depth));

      for (const neighbor of adjacency.get(service) || []) {
        queue.push({ service: neighbor, depth: depth + 1 });
      }
    }
  }

  /**
   * Find critical path (highest latency path)
   */
  private findCriticalPath(nodes: DependencyNode[], edges: ServiceDependency[]): string[] {
    // Build adjacency with latencies
    const adjacency = new Map<string, Array<{ service: string; latency: number }>>();

    for (const node of nodes) {
      adjacency.set(node.service, []);
    }

    for (const edge of edges) {
      adjacency.get(edge.from)!.push({ service: edge.to, latency: edge.avgLatency });
    }

    // Find path with maximum total latency
    let maxPath: string[] = [];
    let maxLatency = 0;

    for (const startNode of nodes) {
      const path = this.dfsLongestPath(startNode.service, adjacency, new Set());
      const pathLatency = this.calculatePathLatency(path, edges);

      if (pathLatency > maxLatency) {
        maxLatency = pathLatency;
        maxPath = path;
      }
    }

    return maxPath;
  }

  /**
   * DFS to find longest path
   */
  private dfsLongestPath(
    current: string,
    adjacency: Map<string, Array<{ service: string; latency: number }>>,
    visited: Set<string>
  ): string[] {
    visited.add(current);

    const neighbors = adjacency.get(current) || [];
    if (neighbors.length === 0) {
      return [current];
    }

    let longestPath: string[] = [];
    let maxLatency = 0;

    for (const { service } of neighbors) {
      if (!visited.has(service)) {
        const path = this.dfsLongestPath(service, adjacency, new Set(visited));
        const pathLatency = this.calculatePathLatency(path, []);

        if (pathLatency > maxLatency) {
          maxLatency = pathLatency;
          longestPath = path;
        }
      }
    }

    return [current, ...longestPath];
  }

  /**
   * Calculate latency of a path
   */
  private calculatePathLatency(path: string[], edges: ServiceDependency[]): number {
    let totalLatency = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const edge = edges.find((e) => e.from === path[i] && e.to === path[i + 1]);
      if (edge) {
        totalLatency += edge.avgLatency;
      }
    }

    return totalLatency;
  }

  /**
   * Get call frequency heatmap
   */
  getCallFrequencyHeatmap(): Map<string, Map<string, number>> {
    const heatmap = new Map<string, Map<string, number>>();

    for (const [from, toMap] of this.dependencyMap.entries()) {
      const row = new Map<string, number>();
      for (const [to, metrics] of toMap.entries()) {
        row.set(to, metrics.callCount);
      }
      heatmap.set(from, row);
    }

    return heatmap;
  }

  /**
   * Get latency heatmap
   */
  getLatencyHeatmap(): Map<string, Map<string, number>> {
    const heatmap = new Map<string, Map<string, number>>();

    for (const [from, toMap] of this.dependencyMap.entries()) {
      const row = new Map<string, number>();
      for (const [to, metrics] of toMap.entries()) {
        const stats = calculateDurationStatistics(metrics.latencies);
        row.set(to, stats.avg);
      }
      heatmap.set(from, row);
    }

    return heatmap;
  }

  /**
   * Get error correlation heatmap
   */
  getErrorCorrelationHeatmap(): Map<string, Map<string, number>> {
    const heatmap = new Map<string, Map<string, number>>();

    for (const [from, toMap] of this.dependencyMap.entries()) {
      const row = new Map<string, number>();
      for (const [to, metrics] of toMap.entries()) {
        row.set(to, metrics.errorCount / metrics.callCount);
      }
      heatmap.set(from, row);
    }

    return heatmap;
  }

  /**
   * Find services with high error rates
   */
  getHighErrorServices(threshold = 0.05): Array<{ service: string; errorRate: number }> {
    const results: Array<{ service: string; errorRate: number }> = [];

    for (const [service, metrics] of this.serviceMetrics) {
      const errorRate = metrics.errors / metrics.totalCalls;
      if (errorRate > threshold) {
        results.push({ service, errorRate });
      }
    }

    return results.sort((a, b) => b.errorRate - a.errorRate);
  }

  /**
   * Find services with high latency
   */
  getHighLatencyServices(threshold = 1000000): Array<{ service: string; avgLatency: number }> {
    const results: Array<{ service: string; avgLatency: number }> = [];

    for (const [service, metrics] of this.serviceMetrics) {
      const stats = calculateDurationStatistics(metrics.latencies);
      if (stats.avg > threshold) {
        results.push({ service, avgLatency: stats.avg });
      }
    }

    return results.sort((a, b) => b.avgLatency - a.avgLatency);
  }

  /**
   * Get service topology in DOT format for Graphviz
   */
  getTopologyDOT(): string {
    const edges = this.getDependencies();
    const nodes = this.buildNodes();

    let dot = 'digraph ServiceTopology {\n';
    dot += '  node [shape=box, style=rounded];\n';

    // Add nodes
    for (const node of nodes) {
      const label = `${node.service}\\nAvg: ${this.formatDuration(node.avgLatency)}\\nErr: ${(node.errorRate * 100).toFixed(1)}%`;
      dot += `  "${node.service}" [label="${label}"];\n`;
    }

    // Add edges
    for (const edge of edges) {
      const label = `${edge.callCount} calls\\n${this.formatDuration(edge.avgLatency)}`;
      dot += `  "${edge.from}" -> "${edge.to}" [label="${label}"];\n`;
    }

    dot += '}';

    return dot;
  }

  /**
   * Format duration for display
   */
  private formatDuration(us: number): string {
    if (us < 1000) return `${us.toFixed(0)}μs`;
    if (us < 1000000) return `${(us / 1000).toFixed(1)}ms`;
    return `${(us / 1000000).toFixed(2)}s`;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.dependencyMap.clear();
    this.serviceMetrics.clear();
    this.emit('cleared');
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalServices: number;
    totalDependencies: number;
    totalCalls: number;
  } {
    let totalCalls = 0;

    for (const [_, toMap] of this.dependencyMap) {
      for (const [_, metrics] of toMap) {
        totalCalls += metrics.callCount;
      }
    }

    return {
      totalServices: this.serviceMetrics.size,
      totalDependencies: this.getDependencies().length,
      totalCalls,
    };
  }
}

/**
 * Service metrics
 */
interface ServiceMetrics {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  errors: number;
  latencies: Duration[];
}

export default DependencyMapper;
