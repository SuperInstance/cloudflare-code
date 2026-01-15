/**
 * HNSW (Hierarchical Navigable Small World) Index
 *
 * High-performance approximate nearest neighbor search algorithm.
 * Optimized for in-memory vector search with sub-millisecond latency.
 *
 * Performance Targets:
 * - Insert: <1ms
 * - Search: <1ms for k=10
 * - Memory: ~20 bytes per vector (excluding vector data)
 *
 * References:
 * - Malkov, Y. A., & Yashunin, D. A. (2018). "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs"
 * - https://arxiv.org/abs/1603.09320
 */

export interface HNSWOptions {
  /**
   * Number of bi-directional links for each node (default: 16)
   * Higher M = better recall but more memory
   */
  M?: number;

  /**
   * Size of dynamic candidate list for construction (default: 100)
   * Higher efConstruction = better index quality but slower build
   */
  efConstruction?: number;

  /**
   * Size of dynamic candidate list for search (default: 50)
   * Higher ef = better recall but slower search
   */
  ef?: number;

  /**
   * Number of layers in the hierarchy (default: auto-calculated)
   * If not specified, calculated as log(M) * num_nodes
   */
  maxLayers?: number;

  /**
   * Distance metric (default: 'cosine')
   */
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

export interface SearchResult {
  id: string;
  similarity: number;
  distance: number;
}

export interface VectorNode {
  id: string;
  vector: Float32Array;
  level: number;
  connections: Map<number, Set<string>>; // level -> set of neighbor IDs
}

/**
 * HNSW Index for approximate nearest neighbor search
 *
 * Provides sub-millisecond vector similarity search with
 * high recall rates. Optimized for edge computing environments.
 */
export class HNSWIndex {
  private options: Required<HNSWOptions>;
  private nodes: Map<string, VectorNode>;
  private entryPoint: string | null;
  private nodeCount: number;
  private levelMult: number;
  private maxLevel: number;

  // Metrics
  private totalSearches: number;
  private totalSearchTime: number;

  constructor(options: HNSWOptions = {}) {
    this.options = {
      M: options.M ?? 16,
      efConstruction: options.efConstruction ?? 100,
      ef: options.ef ?? 50,
      maxLayers: options.maxLayers ?? 0, // 0 = auto-calculate
      metric: options.metric ?? 'cosine',
    };

    this.nodes = new Map();
    this.entryPoint = null;
    this.nodeCount = 0;
    this.levelMult = 1 / Math.log(this.options.M);
    this.maxLevel = 0;

    this.totalSearches = 0;
    this.totalSearchTime = 0;
  }

  /**
   * Add vector to index
   *
   * @param vector - Vector to add
   * @param id - Unique identifier for the vector
   *
   * Performance: <1ms
   */
  add(vector: Float32Array, id: string): void {
    const startTime = performance.now();

    // Generate random level for this node
    const level = this.getRandomLevel();

    // Create node
    const node: VectorNode = {
      id,
      vector,
      level,
      connections: new Map(),
    };

    // Initialize empty connections for each level
    for (let l = 0; l <= level; l++) {
      node.connections.set(l, new Set());
    }

    // Add to index
    this.nodes.set(id, node);
    this.nodeCount++;

    // Update entry point if this is the first node or highest level
    if (this.entryPoint === null || level > this.maxLevel) {
      this.entryPoint = id;
      this.maxLevel = level;
    }

    // If first node, nothing to connect
    if (this.nodes.size === 1) {
      return;
    }

    // Find closest neighbors and connect
    const ep = this.entryPoint!;
    let curr = ep;

    // Search from top level down to level 1
    for (let l = Math.min(level, this.maxLevel); l > 0; l--) {
      const results = this.searchLayer(vector, curr, l, 1);
      if (results.length > 0) {
        curr = results[0]!;
      }
    }

    // At level 0, find efConstruction closest neighbors
    const candidates = this.searchLayer(vector, curr, 0, this.options.efConstruction);

    // Select M closest neighbors
    const neighbors = this.selectNeighbors(vector, candidates, this.options.M);

    // Connect bidirectionally
    for (const neighborId of neighbors) {
      this.connect(id, neighborId, 0);
      this.connect(neighborId, id, 0);
    }

    const latency = performance.now() - startTime;
    console.debug(`HNSW add: ${id} - ${latency.toFixed(2)}ms (level ${level})`);
  }

  /**
   * Search for k nearest neighbors
   *
   * @param query - Query vector
   * @param k - Number of neighbors to return
   * @returns Array of search results sorted by similarity
   *
   * Performance: <1ms for k=10
   */
  search(query: Float32Array, k: number): SearchResult[] {
    const startTime = performance.now();

    if (this.nodes.size === 0) {
      return [];
    }

    if (this.entryPoint === null) {
      return [];
    }

    // Start from entry point
    let curr = this.entryPoint;

    // Search from top level down to level 1
    for (let l = this.maxLevel; l > 0; l--) {
      const results = this.searchLayer(query, curr, l, 1);
      if (results.length > 0) {
        curr = results[0]!;
      }
    }

    // At level 0, search for ef closest neighbors
    const candidates = this.searchLayer(query, curr, 0, Math.max(this.options.ef, k));

    // Select top k results
    const results = candidates.slice(0, k).map(id => {
      const node = this.nodes.get(id)!;
      const similarity = this.calculateSimilarity(query, node.vector);
      const distance = 1 - similarity;

      return {
        id,
        similarity,
        distance,
      };
    });

    // Sort by similarity (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    const latency = performance.now() - startTime;
    this.totalSearches++;
    this.totalSearchTime += latency;

    console.debug(`HNSW search: k=${k} - ${latency.toFixed(2)}ms`);

    return results;
  }

  /**
   * Remove vector from index
   *
   * @param id - Vector identifier to remove
   */
  remove(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }

    // Remove connections from all neighbors
    for (const [level, neighbors] of node.connections.entries()) {
      for (const neighborId of neighbors) {
        const neighbor = this.nodes.get(neighborId);
        if (neighbor) {
          neighbor.connections.get(level)?.delete(id);
        }
      }
    }

    // Remove node
    this.nodes.delete(id);
    this.nodeCount--;

    // Update entry point if needed
    if (this.entryPoint === id) {
      // Find new entry point (highest level node)
      let maxLevel = -1;
      for (const [nodeId, node] of this.nodes.entries()) {
        if (node.level > maxLevel) {
          maxLevel = node.level;
          this.entryPoint = nodeId;
        }
      }
      if (maxLevel === -1) {
        this.entryPoint = null;
      }
    }

    return true;
  }

  /**
   * Check if vector exists in index
   *
   * @param id - Vector identifier
   */
  has(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Get vector by ID
   *
   * @param id - Vector identifier
   */
  get(id: string): Float32Array | null {
    const node = this.nodes.get(id);
    return node?.vector ?? null;
  }

  /**
   * Get number of vectors in index
   */
  size(): number {
    return this.nodeCount;
  }

  /**
   * Get estimated memory usage in bytes
   */
  getSize(): number {
    let size = 0;

    for (const [_, node] of this.nodes) {
      // Vector data (float32)
      size += node.vector.length * 4;

      // Connections (approximate)
      for (const [_, neighbors] of node.connections) {
        size += neighbors.size * 8; // Assume 8 bytes per ID
      }

      // Metadata
      size += 64;
    }

    return size;
  }

  /**
   * Clear all vectors from index
   */
  clear(): void {
    this.nodes.clear();
    this.entryPoint = null;
    this.nodeCount = 0;
    this.maxLevel = 0;
  }

  /**
   * Get index statistics
   */
  getStats(): {
    nodeCount: number;
    maxLevel: number;
    entryPoint: string | null;
    avgConnections: number;
    totalSearches: number;
    avgSearchTime: number;
    memoryUsage: number;
  } {
    let totalConnections = 0;

    for (const [_, node] of this.nodes) {
      for (const [_, neighbors] of node.connections) {
        totalConnections += neighbors.size;
      }
    }

    const avgConnections = this.nodeCount > 0 ? totalConnections / this.nodeCount : 0;
    const avgSearchTime = this.totalSearches > 0 ? this.totalSearchTime / this.totalSearches : 0;

    return {
      nodeCount: this.nodeCount,
      maxLevel: this.maxLevel,
      entryPoint: this.entryPoint,
      avgConnections,
      totalSearches: this.totalSearches,
      avgSearchTime,
      memoryUsage: this.getSize(),
    };
  }

  /**
   * Generate random level for new node
   *
   * @private
   */
  private getRandomLevel(): number {
    if (this.options.maxLayers > 0) {
      return Math.min(
        Math.floor(-Math.log(Math.random()) * this.levelMult),
        this.options.maxLayers
      );
    }

    return Math.floor(-Math.log(Math.random()) * this.levelMult);
  }

  /**
   * Search layer for closest neighbors
   *
   * @private
   */
  private searchLayer(query: Float32Array, entryPoint: string, level: number, ef: number): string[] {
    const visited = new Set<string>();
    const candidates: Array<{ id: string; distance: number }> = [];
    const w: Array<{ id: string; distance: number }> = [];

    const entryNode = this.nodes.get(entryPoint);
    if (!entryNode) {
      return [];
    }

    const entryDist = 1 - this.calculateSimilarity(query, entryNode.vector);
    candidates.push({ id: entryPoint, distance: entryDist });
    w.push({ id: entryPoint, distance: entryDist });
    visited.add(entryPoint);

    while (candidates.length > 0) {
      // Sort candidates by distance (ascending)
      candidates.sort((a, b) => a.distance - b.distance);
      const current = candidates.shift()!;

      // Check if we can improve
      const furthest = w[w.length - 1];
      if (furthest && current.distance > furthest.distance && w.length >= ef) {
        break;
      }

      const currentNode = this.nodes.get(current.id);
      if (!currentNode) continue;

      const neighbors = currentNode.connections.get(level);
      if (!neighbors) continue;

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;

        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const neighborDist = 1 - this.calculateSimilarity(query, neighborNode.vector);

        if (w.length < ef || (furthest && neighborDist < furthest.distance)) {
          candidates.push({ id: neighborId, distance: neighborDist });
          w.push({ id: neighborId, distance: neighborDist });

          // Keep only ef closest
          w.sort((a, b) => a.distance - b.distance);
          if (w.length > ef) {
            w.pop();
          }
        }
      }
    }

    return w.map(x => x.id);
  }

  /**
   * Select M closest neighbors from candidates
   *
   * @private
   */
  private selectNeighbors(vector: Float32Array, candidates: string[], M: number): string[] {
    const scored = candidates.map(id => {
      const node = this.nodes.get(id)!;
      const similarity = this.calculateSimilarity(vector, node.vector);
      return { id, similarity };
    });

    // Sort by similarity (descending)
    scored.sort((a, b) => b.similarity - a.similarity);

    // Return top M
    return scored.slice(0, M).map(x => x.id);
  }

  /**
   * Connect two nodes bidirectionally at specified level
   *
   * @private
   */
  private connect(id1: string, id2: string, level: number): void {
    const node1 = this.nodes.get(id1);
    const node2 = this.nodes.get(id2);

    if (!node1 || !node2) return;

    let connections1 = node1.connections.get(level);
    if (!connections1) {
      connections1 = new Set();
      node1.connections.set(level, connections1);
    }

    let connections2 = node2.connections.get(level);
    if (!connections2) {
      connections2 = new Set();
      node2.connections.set(level, connections2);
    }

    // Check if already connected
    if (connections1.has(id2)) return;

    // Add connections (respect M limit)
    if (connections1.size < this.options.M) {
      connections1.add(id2);
    }

    if (connections2.size < this.options.M) {
      connections2.add(id1);
    }
  }

  /**
   * Calculate similarity between two vectors
   *
   * @private
   */
  private calculateSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    switch (this.options.metric) {
      case 'cosine':
        return this.cosineSimilarity(a, b);
      case 'euclidean':
        return this.euclideanSimilarity(a, b);
      case 'dotproduct':
        return this.dotProductSimilarity(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  /**
   * Cosine similarity
   *
   * @private
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Euclidean distance (converted to similarity)
   *
   * @private
   */
  private euclideanSimilarity(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i]! - b[i]!;
      sum += diff * diff;
    }
    const distance = Math.sqrt(sum);
    return 1 / (1 + distance); // Convert to similarity
  }

  /**
   * Dot product similarity
   *
   * @private
   */
  private dotProductSimilarity(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i]! * b[i]!;
    }
    return sum;
  }
}

/**
 * Helper function to create HNSW index
 */
export function createHNSWIndex(options?: HNSWOptions): HNSWIndex {
  return new HNSWIndex(options);
}

/**
 * Default HNSW index instance
 */
export const defaultHNSWIndex = new HNSWIndex();
