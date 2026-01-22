// @ts-nocheck
/**
 * HNSW (Hierarchical Navigable Small World) Index Implementation
 *
 * Provides high-performance approximate nearest neighbor search using
 * hierarchical graph-based indexing.
 */

import {
  Vector,
  VectorId,
  VectorRecord,
  HNSWConfig,
  DistanceMetric,
  SearchResult,
  IndexStats,
} from '../types/index.js';
import { calculateDistance } from '../utils/vector.js';

interface HNSWNode {
  id: VectorId;
  vector: Vector;
  level: number;
  connections: Map<number, Set<VectorId>>; // level -> set of neighbor IDs
  metadata?: Record<string, any>;
}

interface Candidate {
  id: VectorId;
  distance: number;
}

interface Entry {
  id: VectorId;
  distance: number;
}

/**
 * HNSW Index class
 */
export class HNSWIndex {
  private nodes: Map<VectorId, HNSWNode>;
  private config: HNSWConfig;
  private entryPoint: VectorId | null;
  private maxLevel: number;
  private ml: number; // Normalization factor for level generation
  private distanceMetric: DistanceMetric;
  private dimension: number;
  private vectorCount: number;
  private indexSize: number;

  constructor(config: HNSWConfig) {
    this.config = config;
    this.nodes = new Map();
    this.entryPoint = null;
    this.maxLevel = 0;
    this.distanceMetric = config.metric;
    this.dimension = config.dimension;
    this.vectorCount = 0;
    this.indexSize = 0;

    // Normalize level generation: mL = 1/ln(M)
    this.ml = 1.0 / Math.log(config.M);

    this.validateConfig();
  }

  /**
   * Validate HNSW configuration
   */
  private validateConfig(): void {
    if (this.config.M < 2) {
      throw new Error('M must be at least 2');
    }
    if (this.config.efConstruction < this.config.M) {
      throw new Error('efConstruction must be >= M');
    }
    if (this.config.efSearch < 1) {
      throw new Error('efSearch must be >= 1');
    }
  }

  /**
   * Generate random level for a new node
   */
  private generateRandomLevel(): number {
    const level = Math.floor(-Math.log(Math.random()) * this.ml);
    return Math.min(level, this.maxLevel + 1);
  }

  /**
   * Insert a vector into the index
   */
  async insert(record: VectorRecord): Promise<void> {
    this.validateVector(record.vector);

    const level = this.generateRandomLevel();
    const node: HNSWNode = {
      id: record.id,
      vector: record.vector,
      level,
      connections: new Map(),
      metadata: record.metadata,
    };

    // Initialize empty connection sets for each level
    for (let l = 0; l <= level; l++) {
      node.connections.set(l, new Set());
    }

    this.nodes.set(record.id, node);
    this.vectorCount++;
    this.indexSize += this.calculateNodeSize(node);

    if (this.entryPoint === null || level > this.maxLevel) {
      this.entryPoint = record.id;
      this.maxLevel = level;
    }

    // Add connections
    if (this.entryPoint !== null && this.entryPoint !== record.id) {
      this.addNodeConnections(node);
    }
  }

  /**
   * Add connections for a new node
   */
  private addNodeConnections(node: HNSWNode): void {
    const entryNode = this.nodes.get(this.entryPoint!);
    if (!entryNode) return;

    // Start from top level and work down
    for (let level = Math.min(node.level, this.maxLevel); level >= 0; level--) {
      const candidates = this.searchLayer(
        node.vector,
        level,
        1, // ef = 1 for insertion
        entryNode.id
      );

      const neighbors = this.selectNeighbors(
        node.vector,
        candidates,
        this.config.M,
        level
      );

      // Add bidirectional connections
      for (const neighborId of neighbors) {
        const neighborNode = this.nodes.get(neighborId);
        if (neighborNode) {
          this.addConnection(node, neighborNode, level);
          this.addConnection(neighborNode, node, level);
        }
      }

      // Ensure max connections per node
      this.pruneConnections(node, level, this.config.M);
    }
  }

  /**
   * Search a specific layer for nearest neighbors
   */
  private searchLayer(
    query: Vector,
    level: number,
    ef: number,
    entryPoint: VectorId
  ): Candidate[] {
    const visited = new Set<VectorId>([entryPoint]);
    const candidates: Candidate[] = [];
    const W: Entry[] = [];

    const entryNode = this.nodes.get(entryPoint);
    if (!entryNode) return [];

    const dist = this.calculateDistance(query, entryNode.vector);
    W.push({ id: entryPoint, distance: dist });
    candidates.push({ id: entryPoint, distance: dist });

    while (candidates.length > 0) {
      // Get closest candidate
      candidates.sort((a, b) => a.distance - b.distance);
      const current = candidates.shift()!;

      // Check if we can improve
      if (W.length >= ef && current.distance > W[W.length - 1].distance) {
        break;
      }

      // Get neighbors at this level
      const currentNode = this.nodes.get(current.id);
      if (!currentNode) continue;

      const neighbors = currentNode.connections.get(level) || new Set();

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const neighborDist = this.calculateDistance(query, neighborNode.vector);

        if (W.length < ef || neighborDist < W[W.length - 1].distance) {
          candidates.push({ id: neighborId, distance: neighborDist });
          W.push({ id: neighborId, distance: neighborDist });
          W.sort((a, b) => a.distance - b.distance);

          if (W.length > ef) {
            W.pop();
          }
        }
      }
    }

    return W.map((e) => ({ id: e.id, distance: e.distance }));
  }

  /**
   * Select best neighbors using heuristic
   */
  private selectNeighbors(
    query: Vector,
    candidates: Candidate[],
    M: number,
    level: number
  ): VectorId[] {
    if (candidates.length <= M) {
      return candidates.map((c) => c.id);
    }

    // Sort by distance
    candidates.sort((a, b) => a.distance - b.distance);

    // Select top M neighbors
    return candidates.slice(0, M).map((c) => c.id);
  }

  /**
   * Add a bidirectional connection between two nodes
   */
  private addConnection(node1: HNSWNode, node2: HNSWNode, level: number): void {
    if (!node1.connections.has(level)) {
      node1.connections.set(level, new Set());
    }
    node1.connections.get(level)!.add(node2.id);
  }

  /**
   * Prune connections to maintain max connections per level
   */
  private pruneConnections(node: HNSWNode, level: number, maxConnections: number): void {
    const connections = node.connections.get(level);
    if (!connections || connections.size <= maxConnections) return;

    const neighbors: Array<{ id: VectorId; distance: number }> = [];

    for (const neighborId of connections) {
      const neighborNode = this.nodes.get(neighborId);
      if (neighborNode) {
        const dist = this.calculateDistance(node.vector, neighborNode.vector);
        neighbors.push({ id: neighborId, distance: dist });
      }
    }

    // Sort by distance and keep closest
    neighbors.sort((a, b) => a.distance - b.distance);
    const toKeep = new Set(neighbors.slice(0, maxConnections).map((n) => n.id));

    for (const neighborId of connections) {
      if (!toKeep.has(neighborId)) {
        connections.delete(neighborId);

        // Remove reverse connection
        const neighborNode = this.nodes.get(neighborId);
        if (neighborNode) {
          const reverseConns = neighborNode.connections.get(level);
          if (reverseConns) {
            reverseConns.delete(node.id);
          }
        }
      }
    }
  }

  /**
   * Search for k-nearest neighbors
   */
  async search(query: Vector, k: number = 10): Promise<SearchResult[]> {
    this.validateVector(query);

    if (this.nodes.size === 0) {
      return [];
    }

    if (!this.entryPoint) {
      return [];
    }

    const entryNode = this.nodes.get(this.entryPoint);
    if (!entryNode) return [];

    // Search from top level down to level 1
    let currentClosest = this.entryPoint;
    for (let level = this.maxLevel; level > 0; level--) {
      const result = this.searchLayer(query, level, 1, currentClosest);
      if (result.length > 0) {
        currentClosest = result[0].id;
      }
    }

    // Final search at level 0
    const candidates = this.searchLayer(query, 0, this.config.efSearch, currentClosest);

    // Return top k results
    const results = candidates
      .slice(0, k)
      .map((c) => {
        const node = this.nodes.get(c.id);
        return {
          id: c.id,
          score: 1.0 / (1.0 + c.distance), // Convert to similarity score
          distance: c.distance,
          metadata: node?.metadata,
        };
      });

    return results;
  }

  /**
   * Calculate distance between two vectors
   */
  private calculateDistance(a: Vector, b: Vector): number {
    return calculateDistance(a, b, this.distanceMetric);
  }

  /**
   * Validate vector dimensions
   */
  private validateVector(vector: Vector): void {
    if (vector.length !== this.dimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`
      );
    }
  }

  /**
   * Delete a vector from the index
   */
  async delete(id: VectorId): Promise<boolean> {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove connections from neighbors
    for (let level = 0; level <= node.level; level++) {
      const neighbors = node.connections.get(level) || new Set();
      for (const neighborId of neighbors) {
        const neighborNode = this.nodes.get(neighborId);
        if (neighborNode) {
          const levelConns = neighborNode.connections.get(level);
          if (levelConns) {
            levelConns.delete(id);
          }
        }
      }
    }

    // Remove node
    this.nodes.delete(id);
    this.vectorCount--;
    this.indexSize -= this.calculateNodeSize(node);

    // Update entry point if needed
    if (this.entryPoint === id) {
      this.entryPoint = this.nodes.size > 0 ? this.nodes.keys().next().value : null;
    }

    return true;
  }

  /**
   * Get a vector by ID
   */
  async get(id: VectorId): Promise<VectorRecord | null> {
    const node = this.nodes.get(id);
    if (!node) return null;

    return {
      id: node.id,
      vector: node.vector,
      metadata: node.metadata,
    };
  }

  /**
   * Check if a vector exists
   */
  async has(id: VectorId): Promise<boolean> {
    return this.nodes.has(id);
  }

  /**
   * Update a vector in the index
   */
  async update(record: VectorRecord): Promise<boolean> {
    const exists = await this.has(record.id);
    if (!exists) return false;

    // Delete old and insert new
    await this.delete(record.id);
    await this.insert(record);

    return true;
  }

  /**
   * Clear all vectors from the index
   */
  async clear(): Promise<void> {
    this.nodes.clear();
    this.entryPoint = null;
    this.maxLevel = 0;
    this.vectorCount = 0;
    this.indexSize = 0;
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    return {
      vectorCount: this.vectorCount,
      dimension: this.dimension,
      indexSize: this.indexSize,
      memoryUsage: this.estimateMemoryUsage(),
      lastUpdated: Date.now(),
      indexType: this.config.type,
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let bytes = 0;

    // Node storage
    bytes += this.nodes.size * 100; // Approximate overhead per node

    // Vector data
    bytes += this.vectorCount * this.dimension * 4; // Float32Array

    // Connections
    for (const node of this.nodes.values()) {
      for (const [level, neighbors] of node.connections.entries()) {
        bytes += neighbors.size * 8; // Pointer per connection
      }
    }

    return bytes;
  }

  /**
   * Calculate node size in bytes
   */
  private calculateNodeSize(node: HNSWNode): number {
    let size = 0;

    // ID
    size += node.id.length * 2; // UTF-16

    // Vector
    size += node.vector.length * 4; // Float32

    // Connections
    for (const [level, neighbors] of node.connections.entries()) {
      size += neighbors.size * 8;
    }

    // Level
    size += 4;

    return size;
  }

  /**
   * Get the configuration
   */
  getConfig(): HNSWConfig {
    return { ...this.config };
  }

  /**
   * Set search parameters
   */
  setSearchParams(efSearch: number): void {
    if (efSearch < 1) {
      throw new Error('efSearch must be >= 1');
    }
    this.config.efSearch = efSearch;
  }

  /**
   * Export index to snapshot
   */
  exportSnapshot(): {
    version: string;
    config: HNSWConfig;
    nodes: Array<{
      id: VectorId;
      vector: number[];
      level: number;
      connections: number[][];
      metadata?: Record<string, any>;
    }>;
    entryPoint: VectorId | null;
    maxLevel: number;
  } {
    const nodes = Array.from(this.nodes.values()).map((node) => ({
      id: node.id,
      vector: Array.from(node.vector),
      level: node.level,
      connections: Array.from(node.connections.entries()).map(([level, neighbors]) => [
        level,
        Array.from(neighbors),
      ]),
      metadata: node.metadata,
    }));

    return {
      version: '1.0.0',
      config: this.config,
      nodes,
      entryPoint: this.entryPoint,
      maxLevel: this.maxLevel,
    };
  }

  /**
   * Import index from snapshot
   */
  importSnapshot(snapshot: {
    version: string;
    config: HNSWConfig;
    nodes: Array<{
      id: VectorId;
      vector: number[];
      level: number;
      connections: number[][];
      metadata?: Record<string, any>;
    }>;
    entryPoint: VectorId | null;
    maxLevel: number;
  }): void {
    this.clear();
    this.config = snapshot.config;
    this.entryPoint = snapshot.entryPoint;
    this.maxLevel = snapshot.maxLevel;

    for (const nodeData of snapshot.nodes) {
      const node: HNSWNode = {
        id: nodeData.id,
        vector: new Float32Array(nodeData.vector),
        level: nodeData.level,
        connections: new Map(),
        metadata: nodeData.metadata,
      };

      for (const [level, neighbors] of nodeData.connections) {
        node.connections.set(level, new Set(neighbors as VectorId[]));
      }

      this.nodes.set(node.id, node);
      this.vectorCount++;
      this.indexSize += this.calculateNodeSize(node);
    }
  }

  /**
   * Get number of vectors in index
   */
  size(): number {
    return this.vectorCount;
  }

  /**
   * Check if index is empty
   */
  isEmpty(): boolean {
    return this.vectorCount === 0;
  }

  /**
   * Get all vector IDs
   */
  getIds(): VectorId[] {
    return Array.from(this.nodes.keys());
  }
}
