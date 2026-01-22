/**
 * Heap Analyzer
 *
 * Analyzes memory heap for potential leaks and issues
 */

export interface HeapSnapshot {
  nodes: HeapNode[];
  edges: HeapEdge[];
  strings: string[];
}

export interface HeapNode {
  id: number;
  type: string;
  name: string;
  selfSize: number;
  edgeCount: number;
}

export interface HeapEdge {
  from: number;
  to: number;
  type: string;
  name?: string;
}

export interface HeapAnalysisResult {
  totalSize: number;
  nodeCount: number;
  dominantTypes: Array<{
    type: string;
    count: number;
    size: number;
  }>;
  potentialLeaks: Array<{
    type: string;
    description: string;
    count: number;
  }>;
  retentionPaths: Array<{
    node: HeapNode;
    path: HeapEdge[];
  }>;
}

export class HeapAnalyzer {
  /**
   * Analyze heap snapshot
   */
  analyzeHeap(snapshot: HeapSnapshot): HeapAnalysisResult {
    const totalSize = this.calculateTotalSize(snapshot);
    const nodeCount = snapshot.nodes.length;
    const dominantTypes = this.findDominantTypes(snapshot);
    const potentialLeaks = this.detectPotentialLeaks(snapshot);
    const retentionPaths = this.findRetentionPaths(snapshot);

    return {
      totalSize,
      nodeCount,
      dominantTypes,
      potentialLeaks,
      retentionPaths,
    };
  }

  /**
   * Calculate total heap size
   */
  private calculateTotalSize(snapshot: HeapSnapshot): number {
    return snapshot.nodes.reduce((sum, node) => sum + node.selfSize, 0);
  }

  /**
   * Find dominant object types
   */
  private findDominantTypes(snapshot: HeapSnapshot): Array<{
    type: string;
    count: number;
    size: number;
  }> {
    const typeStats = new Map<string, { count: number; size: number }>();

    for (const node of snapshot.nodes) {
      const stats = typeStats.get(node.type) || { count: 0, size: 0 };
      stats.count++;
      stats.size += node.selfSize;
      typeStats.set(node.type, stats);
    }

    return Array.from(typeStats.entries())
      .map(([type, stats]) => ({
        type,
        count: stats.count,
        size: stats.size,
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
  }

  /**
   * Detect potential memory leaks
   */
  private detectPotentialLeaks(snapshot: HeapSnapshot): Array<{
    type: string;
    description: string;
    count: number;
  }> {
    const leaks: Array<{
      type: string;
      description: string;
      count: number;
    }> = [];

    // Check for detached DOM nodes (if applicable)
    const detachedNodes = snapshot.nodes.filter(
      (node) => node.type === 'HTMLElement' && this.isDetached(node, snapshot)
    );

    if (detachedNodes.length > 100) {
      leaks.push({
        type: 'detached-dom',
        description: 'Many detached DOM nodes detected',
        count: detachedNodes.length,
      });
    }

    // Check for large arrays
    const largeArrays = snapshot.nodes.filter(
      (node) => node.type === 'array' && node.selfSize > 1024 * 1024
    );

    if (largeArrays.length > 10) {
      leaks.push({
        type: 'large-arrays',
        description: 'Many large arrays detected',
        count: largeArrays.length,
      });
    }

    // Check for unclosed closures
    const closures = snapshot.nodes.filter((node) => node.type === 'closure');

    if (closures.length > 1000) {
      leaks.push({
        type: 'closures',
        description: 'Excessive number of closures detected',
        count: closures.length,
      });
    }

    return leaks;
  }

  /**
   * Check if a node is detached from the DOM tree
   */
  private isDetached(node: HeapNode, snapshot: HeapSnapshot): boolean {
    // Simple heuristic: node with no incoming edges from DOM roots
    const hasIncomingFromDOM = snapshot.edges.some(
      (edge) => edge.to === node.id && this.isDOMRootEdge(edge, snapshot)
    );

    return !hasIncomingFromDOM;
  }

  /**
   * Check if edge is from a DOM root
   */
  private isDOMRootEdge(edge: HeapEdge, snapshot: HeapSnapshot): boolean {
    const fromNode = snapshot.nodes.find((n) => n.id === edge.from);
    return fromNode?.type === 'DOMRoot' || false;
  }

  /**
   * Find retention paths for large objects
   */
  private findRetentionPaths(snapshot: HeapSnapshot): Array<{
    node: HeapNode;
    path: HeapEdge[];
  }> {
    const largeNodes = snapshot.nodes
      .filter((node) => node.selfSize > 1024 * 100) // > 100KB
      .sort((a, b) => b.selfSize - a.selfSize)
      .slice(0, 5);

    const paths: Array<{
      node: HeapNode;
      path: HeapEdge[];
    }> = [];

    for (const node of largeNodes) {
      const path = this.findShortestPath(node, snapshot);
      if (path) {
        paths.push({
          node,
          path,
        });
      }
    }

    return paths;
  }

  /**
   * Find shortest path to root using BFS
   */
  private findShortestPath(
    node: HeapNode,
    snapshot: HeapSnapshot
  ): HeapEdge[] | null {
    const visited = new Set<number>();
    const queue: Array<{ nodeId: number; path: HeapEdge[] }> = [
      { nodeId: node.id, path: [] },
    ];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const currentNode = snapshot.nodes.find((n) => n.id === nodeId);
      if (currentNode?.type === 'DOMRoot' || currentNode?.type === 'GCRoot') {
        return path;
      }

      // Find incoming edges
      const incomingEdges = snapshot.edges.filter((e) => e.to === nodeId);

      for (const edge of incomingEdges) {
        queue.push({
          nodeId: edge.from,
          path: [...path, edge],
        });
      }
    }

    return null;
  }

  /**
   * Generate heap analysis report
   */
  generateReport(analysis: HeapAnalysisResult): string {
    let report = '# Heap Analysis Report\n\n';

    report += '## Summary\n\n';
    report += `- Total Size: ${this.formatBytes(analysis.totalSize)}\n`;
    report += `- Node Count: ${analysis.nodeCount}\n`;
    report += `- Potential Leaks: ${analysis.potentialLeaks.length}\n\n`;

    if (analysis.dominantTypes.length > 0) {
      report += '## Dominant Types\n\n';
      report += '| Type | Count | Size |\n';
      report += '|------|-------|------|\n';

      for (const type of analysis.dominantTypes) {
        report += `| ${type.type} | ${type.count} | ${this.formatBytes(type.size)} |\n`;
      }
      report += '\n';
    }

    if (analysis.potentialLeaks.length > 0) {
      report += '## Potential Leaks\n\n';

      for (const leak of analysis.potentialLeaks) {
        report += `### ${leak.type}\n`;
        report += `${leak.description}\n`;
        report += `Count: ${leak.count}\n\n`;
      }
    }

    if (analysis.retentionPaths.length > 0) {
      report += '## Retention Paths\n\n';

      for (const { node, path } of analysis.retentionPaths) {
        report += `### ${node.type} (${this.formatBytes(node.selfSize)})\n`;
        report += 'Path to root:\n';

        for (const edge of path) {
          report += `- ${edge.type}`;
          if (edge.name) {
            report += ` (${edge.name})`;
          }
          report += '\n';
        }
        report += '\n';
      }
    }

    return report;
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)}${units[unitIndex]}`;
  }

  /**
   * Compare two heap snapshots
   */
  compareSnapshots(
    baseline: HeapSnapshot,
    current: HeapSnapshot
  ): HeapComparisonResult {
    const baselineAnalysis = this.analyzeHeap(baseline);
    const currentAnalysis = this.analyzeHeap(current);

    const sizeDiff = currentAnalysis.totalSize - baselineAnalysis.totalSize;
    const sizeDiffPercent = (sizeDiff / baselineAnalysis.totalSize) * 100;

    const nodeDiff = currentAnalysis.nodeCount - baselineAnalysis.nodeCount;
    const nodeDiffPercent = (nodeDiff / baselineAnalysis.nodeCount) * 100;

    return {
      sizeDiff,
      sizeDiffPercent,
      nodeDiff,
      nodeDiffPercent,
      baseline: baselineAnalysis,
      current: currentAnalysis,
    };
  }
}

export interface HeapComparisonResult {
  sizeDiff: number;
  sizeDiffPercent: number;
  nodeDiff: number;
  nodeDiffPercent: number;
  baseline: HeapAnalysisResult;
  current: HeapAnalysisResult;
}

export default HeapAnalyzer;
