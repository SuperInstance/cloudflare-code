/**
 * DAG (Directed Acyclic Graph) implementation for workflow execution
 */

import type {
  DAG,
  Node,
  NodeId,
  Connection,
  TopologicalSortResult,
  ExecutionPlan
} from '../types';

export class DAGManager {
  private dag: DAG;

  constructor(nodes: Node[], connections: Connection[]) {
    this.dag = this.buildDAG(nodes, connections);
  }

  /**
   * Build DAG from nodes and connections
   */
  private buildDAG(nodes: Node[], connections: Connection[]): DAG {
    const nodeMap = new Map<NodeId, Node>();
    const edges = new Map<NodeId, Set<NodeId>>();
    const reverseEdges = new Map<NodeId, Set<NodeId>>();
    const levels = new Map<NodeId, number>();

    // Populate node map
    for (const node of nodes) {
      nodeMap.set(node.id, node);
      edges.set(node.id, new Set());
      reverseEdges.set(node.id, new Set());
    }

    // Build edges
    for (const conn of connections) {
      const targets = edges.get(conn.sourceNodeId);
      const sources = reverseEdges.get(conn.targetNodeId);

      if (targets && sources) {
        targets.add(conn.targetNodeId);
        sources.add(conn.sourceNodeId);
      }
    }

    // Calculate levels using BFS
    for (const node of nodes) {
      if (reverseEdges.get(node.id)?.size === 0) {
        this.calculateLevel(node.id, edges, levels, 0);
      }
    }

    return {
      nodes: nodeMap,
      edges,
      reverseEdges,
      levels
    };
  }

  /**
   * Calculate the level of each node using DFS
   */
  private calculateLevel(
    nodeId: NodeId,
    edges: Map<NodeId, Set<NodeId>>,
    levels: Map<NodeId, number>,
    currentLevel: number
  ): void {
    const existingLevel = levels.get(nodeId);
    if (existingLevel !== undefined && existingLevel >= currentLevel) {
      return;
    }

    levels.set(nodeId, currentLevel);

    const children = edges.get(nodeId);
    if (children) {
      for (const childId of children) {
        this.calculateLevel(childId, edges, levels, currentLevel + 1);
      }
    }
  }

  /**
   * Detect cycles in the DAG using DFS
   */
  public detectCycles(): NodeId[][] {
    const cycles: NodeId[][] = [];
    const visited = new Set<NodeId>();
    const recursionStack = new Set<NodeId>();
    const path: NodeId[] = [];

    const dfs = (nodeId: NodeId): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const children = this.dag.edges.get(nodeId) || new Set();
      for (const childId of children) {
        if (!visited.has(childId)) {
          dfs(childId);
        } else if (recursionStack.has(childId)) {
          // Found a cycle
          const cycleStart = path.indexOf(childId);
          const cycle = path.slice(cycleStart);
          cycles.push([...cycle, childId]);
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const nodeId of this.dag.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Perform topological sort on the DAG
   */
  public topologicalSort(): TopologicalSortResult {
    const cycles = this.detectCycles();

    if (cycles.length > 0) {
      return {
        sorted: [],
        cycles
      };
    }

    const sorted: NodeId[] = [];
    const inDegree = new Map<NodeId, number>();
    const queue: NodeId[] = [];

    // Calculate in-degrees
    for (const [nodeId, node] of this.dag.nodes) {
      inDegree.set(nodeId, this.dag.reverseEdges.get(nodeId)?.size || 0);
      if (inDegree.get(nodeId) === 0) {
        queue.push(nodeId);
      }
    }

    // Kahn's algorithm
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      sorted.push(nodeId);

      const children = this.dag.edges.get(nodeId) || new Set();
      for (const childId of children) {
        const newInDegree = (inDegree.get(childId) || 0) - 1;
        inDegree.set(childId, newInDegree);

        if (newInDegree === 0) {
          queue.push(childId);
        }
      }
    }

    return {
      sorted,
      cycles: []
    };
  }

  /**
   * Create execution plan for parallel execution
   */
  public createExecutionPlan(): ExecutionPlan {
    const { sorted } = this.topologicalSort();

    // Group nodes by level
    const levelGroups = new Map<number, NodeId[]>();
    for (const nodeId of sorted) {
      const level = this.dag.levels.get(nodeId) || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(nodeId);
    }

    // Create levels array
    const levels: NodeId[][] = [];
    for (const level of Array.from(levelGroups.keys()).sort((a, b) => a - b)) {
      levels.push(levelGroups.get(level)!);
    }

    // Calculate parallel executions
    const parallelExecutions = new Map<NodeId, Set<NodeId>>();
    for (const level of levels) {
      for (const nodeId of level) {
        parallelExecutions.set(
          nodeId,
          new Set(level.filter(id => id !== nodeId))
        );
      }
    }

    // Calculate dependencies
    const dependencies = new Map<NodeId, Set<NodeId>>();
    for (const [nodeId, deps] of this.dag.reverseEdges) {
      dependencies.set(nodeId, new Set(deps));
    }

    return {
      levels,
      parallelExecutions,
      dependencies
    };
  }

  /**
   * Get all root nodes (nodes with no dependencies)
   */
  public getRootNodes(): Node[] {
    const roots: Node[] = [];
    for (const [nodeId, node] of this.dag.nodes) {
      const inDegree = this.dag.reverseEdges.get(nodeId)?.size || 0;
      if (inDegree === 0) {
        roots.push(node);
      }
    }
    return roots;
  }

  /**
   * Get all leaf nodes (nodes with no children)
   */
  public getLeafNodes(): Node[] {
    const leaves: Node[] = [];
    for (const [nodeId, node] of this.dag.nodes) {
      const outDegree = this.dag.edges.get(nodeId)?.size || 0;
      if (outDegree === 0) {
        leaves.push(node);
      }
    }
    return leaves;
  }

  /**
   * Get node by ID
   */
  public getNode(nodeId: NodeId): Node | undefined {
    return this.dag.nodes.get(nodeId);
  }

  /**
   * Get children of a node
   */
  public getChildren(nodeId: NodeId): Node[] {
    const childIds = this.dag.edges.get(nodeId) || new Set();
    const children: Node[] = [];
    for (const childId of childIds) {
      const child = this.dag.nodes.get(childId);
      if (child) {
        children.push(child);
      }
    }
    return children;
  }

  /**
   * Get parents of a node
   */
  public getParents(nodeId: NodeId): Node[] {
    const parentIds = this.dag.reverseEdges.get(nodeId) || new Set();
    const parents: Node[] = [];
    for (const parentId of parentIds) {
      const parent = this.dag.nodes.get(parentId);
      if (parent) {
        parents.push(parent);
      }
    }
    return parents;
  }

  /**
   * Get level of a node
   */
  public getLevel(nodeId: NodeId): number {
    return this.dag.levels.get(nodeId) || 0;
  }

  /**
   * Get all nodes at a specific level
   */
  public getNodesAtLevel(level: number): Node[] {
    const nodes: Node[] = [];
    for (const [nodeId, nodeLevel] of this.dag.levels) {
      if (nodeLevel === level) {
        const node = this.dag.nodes.get(nodeId);
        if (node) {
          nodes.push(node);
        }
      }
    }
    return nodes;
  }

  /**
   * Calculate the longest path from start to end
   */
  public getCriticalPath(): NodeId[] {
    const sorted = this.topologicalSort().sorted;
    const distance = new Map<NodeId, number>();
    const predecessor = new Map<NodeId, NodeId>();

    // Initialize distances
    for (const nodeId of sorted) {
      distance.set(nodeId, 0);
    }

    // Calculate longest path
    for (const nodeId of sorted) {
      const children = this.dag.edges.get(nodeId) || new Set();
      for (const childId of children) {
        const newDist = (distance.get(nodeId) || 0) + 1;
        if (newDist > (distance.get(childId) || 0)) {
          distance.set(childId, newDist);
          predecessor.set(childId, nodeId);
        }
      }
    }

    // Find the node with maximum distance
    let maxDistNode = sorted[0];
    for (const nodeId of sorted) {
      if ((distance.get(nodeId) || 0) > (distance.get(maxDistNode) || 0)) {
        maxDistNode = nodeId;
      }
    }

    // Reconstruct path
    const path: NodeId[] = [];
    let current = maxDistNode;
    while (current) {
      path.unshift(current);
      current = predecessor.get(current)!;
    }

    return path;
  }

  /**
   * Validate that the DAG is valid
   */
  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const cycles = this.detectCycles();

    if (cycles.length > 0) {
      errors.push(
        `Cycles detected: ${cycles.map(c => c.join(' -> ')).join('; ')}`
      );
    }

    // Check for orphaned nodes
    for (const [nodeId, node] of this.dag.nodes) {
      const inDegree = this.dag.reverseEdges.get(nodeId)?.size || 0;
      const outDegree = this.dag.edges.get(nodeId)?.size || 0;

      if (inDegree === 0 && outDegree === 0) {
        errors.push(`Node ${nodeId} is orphaned (no connections)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get DAG statistics
   */
  public getStats(): {
    nodeCount: number;
    edgeCount: number;
    maxLevel: number;
    avgChildren: number;
    criticalPathLength: number;
  } {
    let edgeCount = 0;
    let maxLevel = 0;
    let totalChildren = 0;

    for (const [nodeId, children] of this.dag.edges) {
      edgeCount += children.size;
      totalChildren += children.size;
      const level = this.dag.levels.get(nodeId) || 0;
      maxLevel = Math.max(maxLevel, level);
    }

    return {
      nodeCount: this.dag.nodes.size,
      edgeCount,
      maxLevel,
      avgChildren: this.dag.nodes.size > 0 ? totalChildren / this.dag.nodes.size : 0,
      criticalPathLength: this.getCriticalPath().length
    };
  }

  /**
   * Export DAG as DOT format for visualization
   */
  public toDot(): string {
    const lines: string[] = ['digraph Workflow {'];

    // Add nodes
    for (const [nodeId, node] of this.dag.nodes) {
      const label = node.name.replace(/"/g, '\\"');
      lines.push(`  "${nodeId}" [label="${label}"];`);
    }

    // Add edges
    for (const [sourceId, targets] of this.dag.edges) {
      for (const targetId of targets) {
        lines.push(`  "${sourceId}" -> "${targetId}";`);
      }
    }

    lines.push('}');
    return lines.join('\n');
  }
}
