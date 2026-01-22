/**
 * Tree-of-Thoughts (ToT) Planning System
 *
 * Implements tree-based reasoning with branching exploration,
 * thought evaluation, and intelligent search strategies.
 */

import type {
  ThoughtNode,
  ThoughtEvaluation,
  TreeOfThoughtsConfig,
  TreeOfThoughtsResult,
  TreeEvaluation,
  ReasoningError,
} from '../types';

// ============================================================================
// Tree-of-Thoughts Core Engine
// ============================================================================

export class TreeOfThoughtsEngine {
  private config: Required<TreeOfThoughtsConfig>;
  private nodes: Map<string, ThoughtNode>;
  private rootId: string | null = null;

  constructor(config: TreeOfThoughtsConfig = {}) {
    this.config = {
      maxDepth: config.maxDepth ?? 5,
      branchingFactor: config.branchingFactor ?? 3,
      evaluationMethod: config.evaluationMethod ?? 'value',
      pruningThreshold: config.pruningThreshold ?? 0.3,
      maxNodes: config.maxNodes ?? 100,
      explorationStrategy: config.explorationStrategy ?? 'best-first',
      beamWidth: config.beamWidth ?? 3,
    };
    this.nodes = new Map();
  }

  /**
   * Perform tree-of-thoughts reasoning on a given problem
   */
  async solve(problem: string, context?: string): Promise<TreeOfThoughtsResult> {
    const startTime = Date.now();
    this.nodes.clear();
    this.rootId = null;

    try {
      // Initialize the tree with root node
      this.rootId = this.createRootNode(problem, context);

      // Explore the tree using configured strategy
      await this.exploreTree();

      // Find the best path through the tree
      const bestPath = this.findBestPath();

      // Evaluate the tree
      const evaluation = this.evaluateTree();

      // Get final answer from best path
      const finalAnswer = this.extractAnswerFromPath(bestPath);

      const executionTime = Date.now() - startTime;
      const prunedNodes = this.countPrunedNodes();

      return {
        finalAnswer,
        thoughtTree: Array.from(this.nodes.values()),
        bestPath,
        evaluation,
        metadata: {
          totalNodes: this.nodes.size,
          maxDepthReached: this.getMaxDepth(),
          executionTime,
          prunedNodes,
        },
      };
    } catch (error) {
      throw this.createError(
        'Tree-of-thoughts reasoning failed',
        'TOT_REASONING_FAILED',
        { problem, error }
      );
    }
  }

  /**
   * Create root node with initial problem
   */
  private createRootNode(problem: string, context?: string): string {
    const rootId = this.generateNodeId('root', 0);
    const rootNode: ThoughtNode = {
      id: rootId,
      content: context
        ? `Problem: ${problem}\nContext: ${context}`
        : `Problem: ${problem}`,
      depth: 0,
      parentId: null,
      children: [],
      score: 0.5,
      visited: true,
    };

    this.nodes.set(rootId, rootNode);
    this.rootId = rootId;
    return rootId;
  }

  /**
   * Explore the tree using configured strategy
   */
  private async exploreTree(): Promise<void> {
    switch (this.config.explorationStrategy) {
      case 'breadth':
        await this.breadthFirstSearch();
        break;
      case 'depth':
        await this.depthFirstSearch();
        break;
      case 'best-first':
      default:
        await this.bestFirstSearch();
        break;
    }
  }

  /**
   * Breadth-first search exploration
   */
  private async breadthFirstSearch(): Promise<void> {
    const queue: string[] = [this.rootId!];

    while (queue.length > 0 && this.nodes.size < this.config.maxNodes) {
      const currentId = queue.shift()!;
      const currentNode = this.nodes.get(currentId)!;

      if (currentNode.depth >= this.config.maxDepth) {
        continue;
      }

      // Generate children
      const children = await this.generateChildren(currentNode);
      queue.push(...children);
    }
  }

  /**
   * Depth-first search exploration
   */
  private async depthFirstSearch(): Promise<void> {
    const stack: string[] = [this.rootId!];

    while (stack.length > 0 && this.nodes.size < this.config.maxNodes) {
      const currentId = stack.pop()!;
      const currentNode = this.nodes.get(currentId)!;

      if (currentNode.depth >= this.config.maxDepth) {
        continue;
      }

      // Generate children and add to stack
      const children = await this.generateChildren(currentNode);
      stack.push(...children.reverse()); // Reverse for proper DFS order
    }
  }

  /**
   * Best-first search exploration
   */
  private async bestFirstSearch(): Promise<void> {
    const priorityQueue: PrioritizedNode[] = [
      { id: this.rootId!, priority: 0 },
    ];

    while (
      priorityQueue.length > 0 &&
      this.nodes.size < this.config.maxNodes
    ) {
      // Sort by priority (highest first)
      priorityQueue.sort((a, b) => b.priority - a.priority);
      const { id: currentId } = priorityQueue.shift()!;
      const currentNode = this.nodes.get(currentId)!;

      if (currentNode.depth >= this.config.maxDepth) {
        continue;
      }

      // Generate children
      const children = await this.generateChildren(currentNode);

      // Add children to priority queue with their scores as priority
      for (const childId of children) {
        const childNode = this.nodes.get(childId)!;
        priorityQueue.push({
          id: childId,
          priority: childNode.score ?? 0,
        });
      }

      // Apply beam search pruning
      if (priorityQueue.length > this.config.beamWidth) {
        priorityQueue.splice(this.config.beamWidth);
      }
    }
  }

  /**
   * Generate children for a given node
   */
  private async generateChildren(parent: ThoughtNode): Promise<string[]> {
    if (parent.children.length > 0) {
      return parent.children;
    }

    // Generate branch thoughts
    const branchThoughts = await this.generateBranchThoughts(parent);

    const childIds: string[] = [];

    for (let i = 0; i < branchThoughts.length; i++) {
      const thought = branchThoughts[i];

      // Evaluate the thought
      const evaluation = await this.evaluateThought(thought, parent);

      // Check pruning threshold
      if (
        this.config.pruningThreshold > 0 &&
        evaluation.value < this.config.pruningThreshold
      ) {
        continue; // Prune this branch
      }

      // Create child node
      const childId = this.generateNodeId(parent.id, i);
      const childNode: ThoughtNode = {
        id: childId,
        content: thought,
        depth: parent.depth + 1,
        parentId: parent.id,
        children: [],
        score: evaluation.value,
        visited: false,
        evaluation,
      };

      this.nodes.set(childId, childNode);
      parent.children.push(childId);
      childIds.push(childId);
    }

    return childIds;
  }

  /**
   * Generate branching thoughts from parent
   */
  private async generateBranchThoughts(
    parent: ThoughtNode
  ): Promise<string[]> {
    const thoughts: string[] = [];

    // In a real implementation, this would call an LLM
    // For now, we generate placeholder thoughts
    for (let i = 0; i < this.config.branchingFactor; i++) {
      const thought = await this.simulateThoughtGeneration(parent, i);
      thoughts.push(thought);
    }

    return thoughts;
  }

  /**
   * Simulate thought generation (placeholder for actual LLM call)
   */
  private async simulateThoughtGeneration(
    parent: ThoughtNode,
    branchIndex: number
  ): Promise<string> {
    const depth = parent.depth + 1;
    return `Thought at depth ${depth}, branch ${branchIndex + 1}: Exploring potential solution path...`;
  }

  /**
   * Evaluate a thought using configured method
   */
  private async evaluateThought(
    thought: string,
    parent: ThoughtNode
  ): Promise<ThoughtEvaluation> {
    switch (this.config.evaluationMethod) {
      case 'value':
        return this.valueBasedEvaluation(thought, parent);
      case 'vote':
        return this.voteBasedEvaluation(thought, parent);
      case 'comparison':
        return this.comparisonBasedEvaluation(thought, parent);
      default:
        return this.valueBasedEvaluation(thought, parent);
    }
  }

  /**
   * Value-based evaluation
   */
  private async valueBasedEvaluation(
    thought: string,
    parent: ThoughtNode
  ): Promise<ThoughtEvaluation> {
    // Heuristic-based evaluation
    let value = 0.5;

    // Check for positive indicators
    const positiveIndicators = [
      'solution',
      'answer',
      'correct',
      'optimal',
      'best',
      'effective',
      'successful',
    ];

    const negativeIndicators = [
      'wrong',
      'incorrect',
      'failed',
      'error',
      'problematic',
      'impossible',
    ];

    const lowerThought = thought.toLowerCase();

    for (const indicator of positiveIndicators) {
      if (lowerThought.includes(indicator)) {
        value += 0.1;
      }
    }

    for (const indicator of negativeIndicators) {
      if (lowerThought.includes(indicator)) {
        value -= 0.15;
      }
    }

    // Consider depth (prefer deeper thoughts for complex problems)
    value += Math.min(parent.depth * 0.05, 0.2);

    value = Math.max(0, Math.min(1, value));

    return {
      value,
      reasoning: `Evaluated based on keyword analysis and depth`,
      confidence: 0.7,
    };
  }

  /**
   * Vote-based evaluation (simulated multi-voter)
   */
  private async voteBasedEvaluation(
    thought: string,
    parent: ThoughtNode
  ): Promise<ThoughtEvaluation> {
    // Simulate multiple voters
    const votes = 5;
    let positiveVotes = 0;

    for (let i = 0; i < votes; i++) {
      const evaluation = await this.valueBasedEvaluation(thought, parent);
      if (evaluation.value > 0.5) {
        positiveVotes++;
      }
    }

    const value = positiveVotes / votes;

    return {
      value,
      reasoning: `${positiveVotes}/${votes} votes positive`,
      confidence: 0.8,
    };
  }

  /**
   * Comparison-based evaluation
   */
  private async comparisonBasedEvaluation(
    thought: string,
    parent: ThoughtNode
  ): Promise<ThoughtEvaluation> {
    // Compare with sibling thoughts (if they exist)
    const siblings = this.getSiblingThoughts(parent);

    if (siblings.length === 0) {
      return this.valueBasedEvaluation(thought, parent);
    }

    // Evaluate current thought
    const currentEval = await this.valueBasedEvaluation(thought, parent);

    // Compare with siblings
    let betterCount = 0;
    for (const sibling of siblings) {
      const siblingEval = await this.valueBasedEvaluation(sibling, parent);
      if (currentEval.value > siblingEval.value) {
        betterCount++;
      }
    }

    // Adjust score based on comparison
    const comparisonBonus = (betterCount / siblings.length) * 0.2;
    const value = Math.min(1, currentEval.value + comparisonBonus);

    return {
      value,
      reasoning: `Better than ${betterCount}/${siblings.length} alternatives`,
      confidence: currentEval.confidence,
    };
  }

  /**
   * Get sibling thoughts (other children of parent)
   */
  private getSiblingThoughts(parent: ThoughtNode): string[] {
    return parent.children
      .filter((id) => id !== parent.id)
      .map((id) => this.nodes.get(id)!.content);
  }

  /**
   * Find best path through the tree
   */
  private findBestPath(): string[] {
    if (!this.rootId) {
      return [];
    }

    const path: string[] = [];
    let currentId: string | null = this.rootId;

    while (currentId) {
      path.push(currentId);
      const currentNode: ThoughtNode = this.nodes.get(currentId)!;

      // Find best child
      if (currentNode.children.length === 0) {
        break;
      }

      let bestChildId: string | null = null;
      let bestScore = -1;

      for (const childId of currentNode.children) {
        const childNode: ThoughtNode = this.nodes.get(childId)!;
        if ((childNode.score ?? 0) > bestScore) {
          bestScore = childNode.score ?? 0;
          bestChildId = childId;
        }
      }

      currentId = bestChildId;
    }

    return path;
  }

  /**
   * Evaluate the entire tree
   */
  private evaluateTree(): TreeEvaluation {
    let bestNode: ThoughtNode | null = null;
    let totalScore = 0;
    let exploredPaths = 0;
    let successfulPaths = 0;

    for (const node of this.nodes.values()) {
      if (!bestNode || (node.score ?? 0) > (bestNode.score ?? 0)) {
        bestNode = node;
      }

      totalScore += node.score ?? 0;

      if (node.depth > 0) {
        exploredPaths++;
        if ((node.score ?? 0) > 0.7) {
          successfulPaths++;
        }
      }
    }

    const averageScore =
      this.nodes.size > 0 ? totalScore / this.nodes.size : 0;

    return {
      bestNode: bestNode!,
      averageScore,
      exploredPaths,
      successfulPaths,
    };
  }

  /**
   * Extract answer from best path
   */
  private extractAnswerFromPath(path: string[]): string {
    if (path.length === 0) {
      return '';
    }

    // Get the deepest node on the path
    const deepestNode = this.nodes.get(path[path.length - 1]);

    if (!deepestNode) {
      return '';
    }

    // Try to extract answer from the content
    const answerPatterns = [
      /answer:\s*(.+)$/i,
      /solution:\s*(.+)$/i,
      /therefore,?\s*(.+)$/i,
      /thus,?\s*(.+)$/i,
    ];

    for (const pattern of answerPatterns) {
      const match = deepestNode.content.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return deepestNode.content;
  }

  /**
   * Get maximum depth of tree
   */
  private getMaxDepth(): number {
    let maxDepth = 0;
    for (const node of this.nodes.values()) {
      if (node.depth > maxDepth) {
        maxDepth = node.depth;
      }
    }
    return maxDepth;
  }

  /**
   * Count pruned nodes
   */
  private countPrunedNodes(): number {
    // This is a simplified count - in practice, you'd track pruned nodes
    let count = 0;
    for (const node of this.nodes.values()) {
      if (
        this.config.pruningThreshold > 0 &&
        (node.score ?? 0) < this.config.pruningThreshold
      ) {
        count++;
      }
    }
    return count;
  }

  /**
   * Generate unique node ID
   */
  private generateNodeId(parentId: string, index: number): string {
    return `${parentId}_${index}_${Date.now()}`;
  }

  /**
   * Create error with proper type
   */
  private createError(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ): ReasoningError {
    const error = new Error(message) as ReasoningError;
    error.name = 'ReasoningError';
    error.code = code;
    error.details = details;
    return error;
  }
}

// ============================================================================
// Tree Search Algorithms
// ============================================================================

interface PrioritizedNode {
  id: string;
  priority: number;
}

export class TreeSearchAlgorithms {
  /**
   * A* search on thought tree
   */
  static async aStarSearch(
    nodes: Map<string, ThoughtNode>,
    rootId: string,
    heuristic: (node: ThoughtNode) => number,
    goalTest: (node: ThoughtNode) => boolean
  ): Promise<string[]> {
    const openSet: Array<{ id: string; f: number }> = [
      { id: rootId, f: 0 },
    ];
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    gScore.set(rootId, 0);
    fScore.set(rootId, heuristic(nodes.get(rootId)!));

    while (openSet.length > 0) {
      // Get node with lowest fScore
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      const currentNode = nodes.get(current.id)!;

      if (goalTest(currentNode)) {
        return this.reconstructPath(cameFrom, current.id);
      }

      for (const neighborId of currentNode.children) {
        const neighbor = nodes.get(neighborId)!;
        const tentativeGScore = (gScore.get(current.id) ?? 0) + 1;

        if (tentativeGScore < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, current.id);
          gScore.set(neighborId, tentativeGScore);
          fScore.set(
            neighborId,
            tentativeGScore + heuristic(neighbor)
          );

          if (!openSet.find((n) => n.id === neighborId)) {
            openSet.push({ id: neighborId, f: fScore.get(neighborId)! });
          }
        }
      }
    }

    return []; // No path found
  }

  /**
   * Minimax search with alpha-beta pruning
   */
  static minimaxSearch(
    nodes: Map<string, ThoughtNode>,
    nodeId: string,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean
  ): { score: number; path: string[] } {
    const node = nodes.get(nodeId)!;

    if (depth === 0 || node.children.length === 0) {
      return { score: node.score ?? 0, path: [nodeId] };
    }

    let bestPath: string[] = [];

    if (maximizing) {
      let maxEval = -Infinity;
      for (const childId of node.children) {
        const result = this.minimaxSearch(
          nodes,
          childId,
          depth - 1,
          alpha,
          beta,
          false
        );
        if (result.score > maxEval) {
          maxEval = result.score;
          bestPath = [nodeId, ...result.path];
        }
        alpha = Math.max(alpha, result.score);
        if (beta <= alpha) {
          break;
        }
      }
      return { score: maxEval, path: bestPath };
    } else {
      let minEval = Infinity;
      for (const childId of node.children) {
        const result = this.minimaxSearch(
          nodes,
          childId,
          depth - 1,
          alpha,
          beta,
          true
        );
        if (result.score < minEval) {
          minEval = result.score;
          bestPath = [nodeId, ...result.path];
        }
        beta = Math.min(beta, result.score);
        if (beta <= alpha) {
          break;
        }
      }
      return { score: minEval, path: bestPath };
    }
  }

  /**
   * Monte Carlo Tree Search (MCTS)
   */
  static async mctsSearch(
    nodes: Map<string, ThoughtNode>,
    rootId: string,
    iterations: number,
    explorationConstant: number = 1.414
  ): Promise<string[]> {
    // Initialize visit counts and values
    const visits = new Map<string, number>();
    const values = new Map<string, number>();

    for (const [id, node] of nodes) {
      visits.set(id, 0);
      values.set(id, node.score ?? 0);
    }

    for (let i = 0; i < iterations; i++) {
      // Selection
      const path = this.select(nodes, rootId, visits, values, explorationConstant);

      // Simulation
      const leafId = path[path.length - 1];
      const reward = await this.simulate(nodes, leafId);

      // Backpropagation
      for (const nodeId of path) {
        const currentVisits = visits.get(nodeId)!;
        const currentValue = values.get(nodeId)!;
        visits.set(nodeId, currentVisits + 1);
        values.set(nodeId, currentValue + (reward - currentValue) / (currentVisits + 1));
      }
    }

    // Return path to most visited child
    return this.getMostVisitedPath(nodes, rootId, visits);
  }

  /**
   * MCTS selection phase
   */
  private static select(
    nodes: Map<string, ThoughtNode>,
    nodeId: string,
    visits: Map<string, number>,
    values: Map<string, number>,
    c: number
  ): string[] {
    const path: string[] = [nodeId];
    let currentId = nodeId;

    while (true) {
      const node = nodes.get(currentId)!;
      if (node.children.length === 0) {
        break;
      }

      // Find unvisited child
      const unvisitedChild = node.children.find(
        (id) => visits.get(id) === 0
      );
      if (unvisitedChild) {
        path.push(unvisitedChild);
        break;
      }

      // UCB1 selection
      let bestChildId: string | null = null;
      let bestUcb1 = -Infinity;

      for (const childId of node.children) {
        const childVisits = visits.get(childId)!;
        const childValue = values.get(childId)!;
        const parentVisits = visits.get(currentId)!;

        const ucb1 =
          childValue +
          c * Math.sqrt(Math.log(parentVisits) / childVisits);

        if (ucb1 > bestUcb1) {
          bestUcb1 = ucb1;
          bestChildId = childId;
        }
      }

      if (!bestChildId) {
        break;
      }

      path.push(bestChildId);
      currentId = bestChildId;
    }

    return path;
  }

  /**
   * MCTS simulation phase
   */
  private static async simulate(
    nodes: Map<string, ThoughtNode>,
    nodeId: string
  ): Promise<number> {
    // Simple simulation: return node's score
    // In practice, this would run a random rollout
    const node = nodes.get(nodeId)!;
    return node.score ?? 0.5;
  }

  /**
   * Get most visited path
   */
  private static getMostVisitedPath(
    nodes: Map<string, ThoughtNode>,
    rootId: string,
    visits: Map<string, number>
  ): string[] {
    const path: string[] = [rootId];
    let currentId = rootId;

    while (true) {
      const node = nodes.get(currentId)!;
      if (node.children.length === 0) {
        break;
      }

      let bestChildId: string | null = null;
      let bestVisits = -1;

      for (const childId of node.children) {
        const childVisits = visits.get(childId)!;
        if (childVisits > bestVisits) {
          bestVisits = childVisits;
          bestChildId = childId;
        }
      }

      if (!bestChildId) {
        break;
      }

      path.push(bestChildId);
      currentId = bestChildId;
    }

    return path;
  }

  /**
   * Reconstruct path from cameFrom map
   */
  private static reconstructPath(
    cameFrom: Map<string, string>,
    currentId: string
  ): string[] {
    const path = [currentId];
    while (cameFrom.has(currentId)) {
      currentId = cameFrom.get(currentId)!;
      path.unshift(currentId);
    }
    return path;
  }
}

// ============================================================================
// Tree Visualization Helpers
// ============================================================================

export class TreeVisualizationHelpers {
  /**
   * Export tree as Mermaid diagram
   */
  static exportAsMermaid(nodes: Map<string, ThoughtNode>): string {
    let mermaid = 'graph TD\n';

    for (const [id, node] of nodes) {
      const label = this.escapeMermaidLabel(
        node.content.substring(0, 50) + '...'
      );
      const score = node.score ? ` (${(node.score * 100).toFixed(0)}%)` : '';
      mermaid += `  ${id}[${label}${score}]\n`;

      for (const childId of node.children) {
        mermaid += `  ${id} --> ${childId}\n`;
      }
    }

    return mermaid;
  }

  /**
   * Export tree as indented text
   */
  static exportAsIndentedText(nodes: Map<string, ThoughtNode>, rootId: string): string {
    let output = '';
    const stack: Array<{ id: string; indent: number }> = [
      { id: rootId, indent: 0 },
    ];

    while (stack.length > 0) {
      const { id, indent } = stack.pop()!;
      const node = nodes.get(id)!;

      const prefix = '  '.repeat(indent);
      const score = node.score ? ` [${(node.score * 100).toFixed(0)}%]` : '';
      output += `${prefix}${node.content}${score}\n`;

      // Add children in reverse order for correct indentation
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ id: node.children[i], indent: indent + 1 });
      }
    }

    return output;
  }

  /**
   * Escape Mermaid label
   */
  private static escapeMermaidLabel(label: string): string {
    return label.replace(/"/g, '\\"').replace(/\n/g, '<br>');
  }

  /**
   * Calculate tree statistics
   */
  static calculateTreeStats(nodes: Map<string, ThoughtNode>): {
    totalNodes: number;
    maxDepth: number;
    branchingFactor: number;
    averageScore: number;
    completePaths: number;
  } {
    let maxDepth = 0;
    let totalScore = 0;
    let completePaths = 0;
    let totalChildren = 0;
    let parentCount = 0;

    for (const node of nodes.values()) {
      if (node.depth > maxDepth) {
        maxDepth = node.depth;
      }

      totalScore += node.score ?? 0;

      if (node.children.length === 0) {
        completePaths++;
      }

      if (node.children.length > 0) {
        totalChildren += node.children.length;
        parentCount++;
      }
    }

    const averageBranchingFactor =
      parentCount > 0 ? totalChildren / parentCount : 0;
    const averageScore = nodes.size > 0 ? totalScore / nodes.size : 0;

    return {
      totalNodes: nodes.size,
      maxDepth,
      branchingFactor: averageBranchingFactor,
      averageScore,
      completePaths,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate tree-of-thoughts configuration
 */
export function validateToTConfig(
  config: TreeOfThoughtsConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxDepth !== undefined && config.maxDepth < 1) {
    errors.push('maxDepth must be at least 1');
  }

  if (config.branchingFactor !== undefined && config.branchingFactor < 1) {
    errors.push('branchingFactor must be at least 1');
  }

  if (config.pruningThreshold !== undefined) {
    if (config.pruningThreshold < 0 || config.pruningThreshold > 1) {
      errors.push('pruningThreshold must be between 0 and 1');
    }
  }

  if (config.maxNodes !== undefined && config.maxNodes < 1) {
    errors.push('maxNodes must be at least 1');
  }

  if (config.beamWidth !== undefined && config.beamWidth < 1) {
    errors.push('beamWidth must be at least 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Find common ancestor of two nodes
 */
export function findCommonAncestor(
  nodes: Map<string, ThoughtNode>,
  nodeId1: string,
  nodeId2: string
): string | null {
  const ancestors1 = new Set<string>();
  let currentId = nodeId1;

  while (currentId) {
    ancestors1.add(currentId);
    const node = nodes.get(currentId);
    currentId = node?.parentId ?? '';
  }

  currentId = nodeId2;
  while (currentId) {
    if (ancestors1.has(currentId)) {
      return currentId;
    }
    const node = nodes.get(currentId);
    currentId = node?.parentId ?? '';
  }

  return null;
}

/**
 * Calculate distance between two nodes in tree
 */
export function calculateNodeDistance(
  nodes: Map<string, ThoughtNode>,
  nodeId1: string,
  nodeId2: string
): number {
  const commonAncestor = findCommonAncestor(nodes, nodeId1, nodeId2);

  if (!commonAncestor) {
    return -1; // Nodes are in different trees
  }

  let distance = 0;
  let currentId = nodeId1;

  while (currentId !== commonAncestor) {
    distance++;
    const node = nodes.get(currentId);
    currentId = node?.parentId ?? '';
  }

  currentId = nodeId2;
  while (currentId !== commonAncestor) {
    distance++;
    const node = nodes.get(currentId);
    currentId = node?.parentId ?? '';
  }

  return distance;
}
