/**
 * Heap snapshot analyzer for detailed memory analysis
 */

import { HeapSnapshot, HeapNode, HeapEdge } from '../types';

export interface HeapStatistics {
  totalSize: number;
  nodeCount: number;
  edgeCount: number;
  byType: Record<string, { count: number; size: number }>;
  dominatorTreeSize: number;
}

export interface ObjectReference {
  nodeId: number;
  type: string;
  name: string;
  retainedSize: number;
  distance: number;
}

export class HeapAnalyzer {
  constructor(private snapshot: HeapSnapshot) {}

  /**
   * Calculate heap statistics
   */
  calculateStatistics(): HeapStatistics {
    const byType: Record<string, { count: number; size: number }> = {};

    for (const node of this.snapshot.nodes) {
      if (!byType[node.type]) {
        byType[node.type] = { count: 0, size: 0 };
      }
      byType[node.type].count++;
      byType[node.type].size += node.selfSize;
    }

    return {
      totalSize: this.snapshot.totalSize,
      nodeCount: this.snapshot.nodes.length,
      edgeCount: this.snapshot.edges.length,
      byType,
      dominatorTreeSize: this.calculateDominatorTreeSize(),
    };
  }

  /**
   * Calculate dominator tree size
   */
  private calculateDominatorTreeSize(): number {
    // Simplified dominator tree calculation
    // In a real implementation, this would use the Lengauer-Tarjan algorithm
    let totalSize = 0;

    for (const node of this.snapshot.nodes) {
      totalSize += node.retainedSize;
    }

    return totalSize;
  }

  /**
   * Find objects by type
   */
  findObjectsByType(type: string): HeapNode[] {
    return this.snapshot.nodes.filter((node) => node.type === type);
  }

  /**
   * Find objects by name pattern
   */
  findObjectsByName(pattern: RegExp): HeapNode[] {
    return this.snapshot.nodes.filter((node) => pattern.test(node.name));
  }

  /**
   * Get largest objects
   */
  getLargestObjects(limit: number = 10): Array<{
    node: HeapNode;
    retainedSize: number;
  }> {
    return this.snapshot.nodes
      .map((node) => ({ node, retainedSize: node.retainedSize }))
      .sort((a, b) => b.retainedSize - a.retainedSize)
      .slice(0, limit);
  }

  /**
   * Find object references
   */
  findReferences(nodeId: number): ObjectReference[] {
    const references: ObjectReference[] = [];
    const visited = new Set<number>();
    const maxDepth = 5;

    const traverse = (currentId: number, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) {
        return;
      }

      visited.add(currentId);

      const node = this.snapshot.nodes.find((n) => n.id === currentId);
      if (!node) {
        return;
      }

      references.push({
        nodeId: currentId,
        type: node.type,
        name: node.name,
        retainedSize: node.retainedSize,
        distance: depth,
      });

      // Follow outgoing edges
      for (const edge of this.snapshot.edges) {
        if (edge.from === currentId) {
          traverse(edge.to, depth + 1);
        }
      }
    };

    traverse(nodeId, 0);

    return references;
  }

  /**
   * Find shortest retaining path
   */
  findShortestRetainingPath(nodeId: number): Array<{
    nodeId: number;
    edge: string;
  }> | null {
    const queue: Array<{ nodeId: number; path: Array<{ nodeId: number; edge: string }> }> = [
      { nodeId, path: [] },
    ];
    const visited = new Set<number>();

    while (queue.length > 0) {
      const { nodeId: currentId, path } = queue.shift()!;

      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      // Check if we reached a GC root (nodeId 0)
      if (currentId === 0) {
        return path;
      }

      // Find incoming edges
      const incomingEdges = this.snapshot.edges.filter((e) => e.to === currentId);

      for (const edge of incomingEdges) {
        queue.push({
          nodeId: edge.from,
          path: [
            ...path,
            { nodeId: edge.from, edge: edge.name || edge.type },
          ],
        });
      }
    }

    return null;
  }

  /**
   * Analyze object clusters
   */
  analyzeClusters(): Array<{
    representativeNode: HeapNode;
    clusterSize: number;
    clusterRetainedSize: number;
  }> {
    const clusters: Map<number, Set<number>> = new Map();
    let clusterId = 0;

    for (const node of this.snapshot.nodes) {
      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, new Set());
      }

      // BFS to find connected nodes
      const visited = new Set<number>();
      const queue = [node.id];
      const cluster = clusters.get(clusterId)!;

      while (queue.length > 0) {
        const currentId = queue.shift()!;

        if (visited.has(currentId)) {
          continue;
        }

        visited.add(currentId);
        cluster.add(currentId);

        // Add neighbors
        const neighbors = this.snapshot.edges
          .filter((e) => e.from === currentId || e.to === currentId)
          .map((e) => (e.from === currentId ? e.to : e.from));

        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }

      clusterId++;
    }

    // Convert to result format
    return Array.from(clusters.entries()).map(([id, nodeIds]) => {
      const nodes = Array.from(nodeIds).map((nid) =>
        this.snapshot.nodes.find((n) => n.id === nid)!
      );
      const representativeNode = nodes[0];

      return {
        representativeNode,
        clusterSize: nodes.length,
        clusterRetainedSize: nodes.reduce((sum, n) => sum + n.retainedSize, 0),
      };
    });
  }

  /**
   * Find dominators
   */
  findDominatorTree(): Map<number, number[]> {
    const dominators = new Map<number, number[]>();

    // In a real implementation, this would use the Lengauer-Tarjan algorithm
    // For now, use a simplified approach based on direct references

    for (const node of this.snapshot.nodes) {
      const dominated: number[] = [];

      for (const edge of this.snapshot.edges) {
        if (edge.from === node.id) {
          dominated.push(edge.to);
        }
      }

      dominators.set(node.id, dominated);
    }

    return dominators;
  }

  /**
   * Calculate distances from GC roots
   */
  calculateDistancesFromRoots(): Map<number, number> {
    const distances = new Map<number, number>();
    const queue: Array<{ nodeId: number; distance: number }> = [
      { nodeId: 0, distance: 0 }, // Start from root
    ];

    while (queue.length > 0) {
      const { nodeId, distance } = queue.shift()!;

      if (distances.has(nodeId)) {
        continue;
      }

      distances.set(nodeId, distance);

      // Add children
      const children = this.snapshot.edges.filter((e) => e.from === nodeId);
      for (const child of children) {
        if (!distances.has(child.to)) {
          queue.push({ nodeId: child.to, distance: distance + 1 });
        }
      }
    }

    return distances;
  }

  /**
   * Find unreachable objects
   */
  findUnreachableObjects(): HeapNode[] {
    const reachable = new Set<number>();
    const queue = [0]; // Start from root

    // BFS to find all reachable nodes
    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (reachable.has(currentId)) {
        continue;
      }

      reachable.add(currentId);

      // Add neighbors
      const neighbors = this.snapshot.edges
        .filter((e) => e.from === currentId)
        .map((e) => e.to);

      for (const neighbor of neighbors) {
        if (!reachable.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    // Find nodes not in reachable set
    return this.snapshot.nodes.filter((node) => !reachable.has(node.id));
  }

  /**
   * Generate heap summary
   */
  generateSummary(): {
    statistics: HeapStatistics;
    topRetainers: Array<{ node: HeapNode; retainedSize: number }>;
    unreachableCount: number;
    distanceDistribution: Record<number, number>;
  } {
    const statistics = this.calculateStatistics();
    const topRetainers = this.getLargestObjects(10);
    const unreachable = this.findUnreachableObjects();
    const distances = this.calculateDistancesFromRoots();

    // Calculate distance distribution
    const distanceDistribution: Record<number, number> = {};
    for (const [nodeId, distance] of distances) {
      distanceDistribution[distance] = (distanceDistribution[distance] || 0) + 1;
    }

    return {
      statistics,
      topRetainers,
      unreachableCount: unreachable.length,
      distanceDistribution,
    };
  }

  /**
   * Export analysis as JSON
   */
  exportAnalysis(): string {
    return JSON.stringify({
      snapshot: {
        id: this.snapshot.id,
        timestamp: this.snapshot.timestamp,
        totalSize: this.snapshot.totalSize,
      },
      summary: this.generateSummary(),
    }, null, 2);
  }
}
