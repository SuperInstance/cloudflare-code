/**
 * Knowledge Graph System
 *
 * Maintains a graph-based representation of knowledge with nodes and edges
 * for complex relationship tracking and inference.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  GraphIndex,
  GraphTraversal,
  MemoryError,
} from '../types';

export interface KnowledgeGraphConfig {
  maxNodes: number;
  maxEdges: number;
  updateThreshold: number;
  autoIndex: boolean;
  enableInference: boolean;
}

export interface GraphStorage {
  getNode(id: string): Promise<KnowledgeNode | null>;
  saveNode(node: KnowledgeNode): Promise<void>;
  deleteNode(id: string): Promise<void>;
  getEdge(id: string): Promise<KnowledgeEdge | null>;
  saveEdge(edge: KnowledgeEdge): Promise<void>;
  deleteEdge(id: string): Promise<void>;
  getEdgesForNode(nodeId: string): Promise<KnowledgeEdge[]>;
  getAllNodes(): Promise<KnowledgeNode[]>;
  getAllEdges(): Promise<KnowledgeEdge[]>;
  queryNodes(filter: GraphQuery): Promise<KnowledgeNode[]>;
  queryEdges(filter: GraphQuery): Promise<KnowledgeEdge[]>;
}

export interface GraphQuery {
  type?: string;
  label?: string;
  properties?: Record<string, unknown>;
  limit?: number;
}

export interface PathResult {
  path: string[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  weight: number;
}

export class KnowledgeGraphSystem {
  private config: KnowledgeGraphConfig;
  private storage: GraphStorage;
  private graph: KnowledgeGraph;
  private inferenceCache: Map<string, unknown>;

  constructor(config: KnowledgeGraphConfig, storage: GraphStorage) {
    this.config = config;
    this.storage = storage;
    this.graph = this.initializeGraph();
    this.inferenceCache = new Map();
  }

  /**
   * Initialize the knowledge graph
   */
  private initializeGraph(): KnowledgeGraph {
    return {
      nodes: new Map(),
      edges: new Map(),
      adjacencyList: new Map(),
      index: {
        nodeTypeIndex: new Map(),
        labelIndex: new Map(),
        propertyIndex: new Map(),
        fullTextIndex: new Map(),
      },
    };
  }

  /**
   * Add a node to the graph
   */
  async addNode(
    type: KnowledgeNode['type'],
    label: string,
    properties: Record<string, unknown>,
    options: {
      confidence?: number;
      embedding?: number[];
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<KnowledgeNode> {
    const now = new Date();

    const node: KnowledgeNode = {
      id: uuidv4(),
      type,
      label,
      properties,
      embedding: options.embedding,
      confidence: options.confidence ?? 1.0,
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.saveNode(node);
    this.graph.nodes.set(node.id, node);
    this.graph.adjacencyList.set(node.id, new Set());

    // Update index
    if (this.config.autoIndex) {
      this.indexNode(node);
    }

    return node;
  }

  /**
   * Get a node by ID
   */
  async getNode(id: string): Promise<KnowledgeNode | null> {
    if (this.graph.nodes.has(id)) {
      return this.graph.nodes.get(id)!;
    }

    const node = await this.storage.getNode(id);
    if (node) {
      this.graph.nodes.set(id, node);
      if (!this.graph.adjacencyList.has(id)) {
        this.graph.adjacencyList.set(id, new Set());
      }
    }

    return node;
  }

  /**
   * Update a node
   */
  async updateNode(
    id: string,
    updates: Partial<Omit<KnowledgeNode, 'id' | 'createdAt'>>
  ): Promise<void> {
    const node = await this.getNode(id);
    if (!node) {
      throw new MemoryError(`Node not found: ${id}`, 'NOT_FOUND');
    }

    const updatedNode: KnowledgeNode = {
      ...node,
      ...updates,
      updatedAt: new Date(),
    };

    await this.storage.saveNode(updatedNode);
    this.graph.nodes.set(id, updatedNode);

    // Re-index if label or type changed
    if (this.config.autoIndex && (updates.label || updates.type)) {
      this.removeFromIndex(node);
      this.indexNode(updatedNode);
    }
  }

  /**
   * Delete a node and all connected edges
   */
  async deleteNode(id: string): Promise<void> {
    const node = await this.getNode(id);
    if (!node) return;

    // Delete connected edges
    const edges = await this.getEdgesForNode(id);
    for (const edge of edges) {
      await this.deleteEdge(edge.id);
    }

    await this.storage.deleteNode(id);
    this.graph.nodes.delete(id);
    this.graph.adjacencyList.delete(id);

    // Remove from index
    if (this.config.autoIndex) {
      this.removeFromIndex(node);
    }
  }

  /**
   * Add an edge between nodes
   */
  async addEdge(
    sourceId: string,
    targetId: string,
    type: string,
    properties: Record<string, unknown>,
    options: {
      weight?: number;
      confidence?: number;
    } = {}
  ): Promise<KnowledgeEdge> {
    // Verify nodes exist
    const sourceNode = await this.getNode(sourceId);
    const targetNode = await this.getNode(targetId);

    if (!sourceNode) {
      throw new MemoryError(`Source node not found: ${sourceId}`, 'NOT_FOUND');
    }
    if (!targetNode) {
      throw new MemoryError(`Target node not found: ${targetId}`, 'NOT_FOUND');
    }

    // Check edge limit
    if (this.graph.edges.size >= this.config.maxEdges) {
      throw new MemoryError(
        `Maximum edges limit reached: ${this.config.maxEdges}`,
        'LIMIT_EXCEEDED'
      );
    }

    const now = new Date();

    const edge: KnowledgeEdge = {
      id: uuidv4(),
      sourceId,
      targetId,
      type,
      properties,
      weight: options.weight ?? 0.5,
      confidence: options.confidence ?? 1.0,
      createdAt: now,
    };

    await this.storage.saveEdge(edge);

    if (!this.graph.edges.has(sourceId)) {
      this.graph.edges.set(sourceId, []);
    }
    this.graph.edges.get(sourceId)!.push(edge);

    // Update adjacency list
    this.graph.adjacencyList.get(sourceId)!.add(targetId);

    return edge;
  }

  /**
   * Get an edge by ID
   */
  async getEdge(id: string): Promise<KnowledgeEdge | null> {
    for (const edges of this.graph.edges.values()) {
      const edge = edges.find((e) => e.id === id);
      if (edge) return edge;
    }

    // Check storage
    const allEdges = await this.storage.getAllEdges();
    return allEdges.find((e) => e.id === id) ?? null;
  }

  /**
   * Update an edge
   */
  async updateEdge(
    id: string,
    updates: Partial<Omit<KnowledgeEdge, 'id' | 'sourceId' | 'targetId' | 'createdAt'>>
  ): Promise<void> {
    const edge = await this.getEdge(id);
    if (!edge) {
      throw new MemoryError(`Edge not found: ${id}`, 'NOT_FOUND');
    }

    const updatedEdge: KnowledgeEdge = {
      ...edge,
      ...updates,
    };

    await this.storage.saveEdge(updatedEdge);

    // Update in-memory edges
    const edges = this.graph.edges.get(edge.sourceId);
    if (edges) {
      const index = edges.findIndex((e) => e.id === id);
      if (index !== -1) {
        edges[index] = updatedEdge;
      }
    }
  }

  /**
   * Delete an edge
   */
  async deleteEdge(id: string): Promise<void> {
    const edge = await this.getEdge(id);
    if (!edge) return;

    await this.storage.deleteEdge(id);

    // Remove from memory
    const edges = this.graph.edges.get(edge.sourceId);
    if (edges) {
      const index = edges.findIndex((e) => e.id === id);
      if (index !== -1) {
        edges.splice(index, 1);
      }
    }

    // Update adjacency list
    this.graph.adjacencyList.get(edge.sourceId)!.delete(edge.targetId);
  }

  /**
   * Get all edges for a node
   */
  async getEdgesForNode(nodeId: string): Promise<KnowledgeEdge[]> {
    const outgoing = this.graph.edges.get(nodeId) ?? [];

    // Find incoming edges
    const incoming: KnowledgeEdge[] = [];
    for (const [sourceId, edges] of this.graph.edges.entries()) {
      if (sourceId === nodeId) continue;
      for (const edge of edges) {
        if (edge.targetId === nodeId) {
          incoming.push(edge);
        }
      }
    }

    return [...outgoing, ...incoming];
  }

  /**
   * Find shortest path between nodes using BFS
   */
  async findShortestPath(
    startId: string,
    endId: string,
    options: {
      maxDepth?: number;
      edgeTypes?: string[];
    } = {}
  ): Promise<PathResult | null> {
    const startNode = await this.getNode(startId);
    const endNode = await this.getNode(endId);

    if (!startNode || !endNode) {
      return null;
    }

    const maxDepth = options.maxDepth ?? 10;
    const queue: Array<{ nodeId: string; path: string[]; weight: number }> = [
      { nodeId: startId, path: [startId], weight: 0 },
    ];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.nodeId === endId) {
        return this.buildPathResult(current.path);
      }

      if (current.path.length >= maxDepth) continue;

      const neighbors = this.graph.adjacencyList.get(current.nodeId) ?? new Set();
      const edges = this.graph.edges.get(current.nodeId) ?? [];

      let edgeIndex = 0;
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;

        const edge = edges[edgeIndex];
        if (options.edgeTypes && !options.edgeTypes.includes(edge.type)) {
          continue;
        }

        visited.add(neighborId);
        queue.push({
          nodeId: neighborId,
          path: [...current.path, neighborId],
          weight: current.weight + edge.weight,
        });
        edgeIndex++;
      }
    }

    return null;
  }

  /**
   * Find all paths between nodes
   */
  async findAllPaths(
    startId: string,
    endId: string,
    options: {
      maxDepth?: number;
      maxPaths?: number;
      edgeTypes?: string[];
    } = {}
  ): Promise<PathResult[]> {
    const startNode = await this.getNode(startId);
    const endNode = await this.getNode(endId);

    if (!startNode || !endNode) {
      return [];
    }

    const maxDepth = options.maxDepth ?? 5;
    const maxPaths = options.maxPaths ?? 10;
    const paths: PathResult[] = [];

    const dfs = async (
      currentId: string,
      path: string[],
      visited: Set<string>,
      weight: number
    ) => {
      if (paths.length >= maxPaths) return;
      if (path.length > maxDepth) return;

      if (currentId === endId) {
        paths.push(await this.buildPathResult(path));
        return;
      }

      const neighbors = this.graph.adjacencyList.get(currentId) ?? new Set();
      const edges = this.graph.edges.get(currentId) ?? [];

      let edgeIndex = 0;
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;

        const edge = edges[edgeIndex];
        if (options.edgeTypes && !options.edgeTypes.includes(edge.type)) {
          continue;
        }

        visited.add(neighborId);
        await dfs(
          neighborId,
          [...path, neighborId],
          visited,
          weight + edge.weight
        );
        visited.delete(neighborId);
        edgeIndex++;
      }
    };

    await dfs(startId, [startId], new Set([startId]), 0);

    return paths.sort((a, b) => a.weight - b.weight);
  }

  /**
   * Find neighbors within a certain radius
   */
  async findNeighbors(
    nodeId: string,
    radius: number = 1,
    options: {
      edgeTypes?: string[];
      minWeight?: number;
    } = {}
  ): Promise<Map<string, KnowledgeNode>> {
    const startNode = await this.getNode(nodeId);
    if (!startNode) {
      return new Map();
    }

    const neighbors = new Map<string, KnowledgeNode>();
    const queue: Array<{ nodeId: string; depth: number }> = [
      { nodeId, depth: 0 },
    ];
    const visited = new Set<string>([nodeId]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth >= radius) continue;

      const adjacent = this.graph.adjacencyList.get(current.nodeId) ?? new Set();
      const edges = this.graph.edges.get(current.nodeId) ?? [];

      let edgeIndex = 0;
      for (const neighborId of adjacent) {
        if (visited.has(neighborId)) continue;

        const edge = edges[edgeIndex];
        if (options.edgeTypes && !options.edgeTypes.includes(edge.type)) {
          continue;
        }
        if (options.minWeight && edge.weight < options.minWeight) {
          continue;
        }

        visited.add(neighborId);
        const neighbor = await this.getNode(neighborId);
        if (neighbor) {
          neighbors.set(neighborId, neighbor);
          queue.push({ nodeId: neighborId, depth: current.depth + 1 });
        }
        edgeIndex++;
      }
    }

    return neighbors;
  }

  /**
   * Find connected components
   */
  async findConnectedComponents(): Promise<Set<string>[]> {
    const visited = new Set<string>();
    const components: Set<string>[] = [];

    for (const nodeId of this.graph.nodes.keys()) {
      if (visited.has(nodeId)) continue;

      const component = new Set<string>();
      const queue = [nodeId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;

        visited.add(current);
        component.add(current);

        const neighbors = this.graph.adjacencyList.get(current) ?? new Set();
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            queue.push(neighborId);
          }
        }
      }

      components.push(component);
    }

    return components;
  }

  /**
   * Find clusters using community detection
   */
  async findClusters(minClusterSize: number = 3): Promise<Map<string, string[]>> {
    const clusters = new Map<string, string[]>();
    const components = await this.findConnectedComponents();

    for (const component of components) {
      if (component.size >= minClusterSize) {
        const clusterId = uuidv4();
        clusters.set(clusterId, Array.from(component));
      }
    }

    return clusters;
  }

  /**
   * Query nodes
   */
  async queryNodes(query: GraphQuery): Promise<KnowledgeNode[]> {
    let results: KnowledgeNode[] = [];

    // Use index if available
    if (query.type && this.config.autoIndex) {
      const typeIndex = this.graph.index.nodeTypeIndex.get(query.type);
      if (typeIndex) {
        for (const nodeId of typeIndex) {
          const node = await this.getNode(nodeId);
          if (node) results.push(node);
        }
      }
    } else if (query.label && this.config.autoIndex) {
      const labelIndex = this.graph.index.labelIndex.get(query.label.toLowerCase());
      if (labelIndex) {
        for (const nodeId of labelIndex) {
          const node = await this.getNode(nodeId);
          if (node) results.push(node);
        }
      }
    } else {
      // Fallback to storage query
      results = await this.storage.queryNodes(query);
    }

    // Apply property filters
    if (query.properties) {
      results = results.filter((node) =>
        this.matchesProperties(node, query.properties!)
      );
    }

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Infer new knowledge using graph traversal
   */
  async infer(
    nodeId: string,
    rule: InferenceRule
  ): Promise<unknown> {
    if (!this.config.enableInference) {
      throw new MemoryError('Inference is disabled', 'INFERENCE_DISABLED');
    }

    const cacheKey = `${nodeId}-${rule.name}`;
    if (this.inferenceCache.has(cacheKey)) {
      return this.inferenceCache.get(cacheKey);
    }

    const result = await rule.apply(this, nodeId);
    this.inferenceCache.set(cacheKey, result);

    return result;
  }

  /**
   * Calculate centrality measures for nodes
   */
  async calculateCentrality(nodeId: string): Promise<{
    degree: number;
    betweenness: number;
    closeness: number;
  }> {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new MemoryError(`Node not found: ${nodeId}`, 'NOT_FOUND');
    }

    // Degree centrality
    const degree = (this.graph.adjacencyList.get(nodeId) ?? new Set()).size;

    // Betweenness centrality (simplified)
    let betweenness = 0;
    const nodes = Array.from(this.graph.nodes.keys());
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const path = await this.findShortestPath(nodes[i], nodes[j]);
        if (path && path.path.includes(nodeId)) {
          betweenness++;
        }
      }
    }

    // Closeness centrality (simplified)
    let totalDistance = 0;
    let reachableCount = 0;
    for (const otherId of nodes) {
      if (otherId === nodeId) continue;
      const path = await this.findShortestPath(nodeId, otherId);
      if (path) {
        totalDistance += path.path.length - 1;
        reachableCount++;
      }
    }
    const closeness = reachableCount > 0 ? reachableCount / totalDistance : 0;

    return { degree, betweenness, closeness };
  }

  /**
   * Get graph statistics
   */
  async getStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    avgDegree: number;
    density: number;
    connectedComponents: number;
  }> {
    const totalNodes = this.graph.nodes.size;
    let totalEdges = 0;
    for (const edges of this.graph.edges.values()) {
      totalEdges += edges.length;
    }

    const nodesByType: Record<string, number> = {};
    for (const node of this.graph.nodes.values()) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }

    const avgDegree = totalNodes > 0 ? (2 * totalEdges) / totalNodes : 0;
    const maxPossibleEdges = (totalNodes * (totalNodes - 1)) / 2;
    const density = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;

    const components = await this.findConnectedComponents();

    return {
      totalNodes,
      totalEdges,
      nodesByType,
      avgDegree,
      density,
      connectedComponents: components.length,
    };
  }

  /**
   * Build path result
   */
  private async buildPathResult(path: string[]): Promise<PathResult> {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    for (let i = 0; i < path.length; i++) {
      const node = await this.getNode(path[i]);
      if (node) nodes.push(node);

      if (i < path.length - 1) {
        const nodeEdges = this.graph.edges.get(path[i]) ?? [];
        const edge = nodeEdges.find((e) => e.targetId === path[i + 1]);
        if (edge) edges.push(edge);
      }
    }

    // Calculate total weight
    const weight = edges.reduce((sum, edge) => sum + edge.weight, 0);

    return { path, nodes, edges, weight };
  }

  /**
   * Index a node
   */
  private indexNode(node: KnowledgeNode): void {
    // Type index
    if (!this.graph.index.nodeTypeIndex.has(node.type)) {
      this.graph.index.nodeTypeIndex.set(node.type, new Set());
    }
    this.graph.index.nodeTypeIndex.get(node.type)!.add(node.id);

    // Label index
    const labelLower = node.label.toLowerCase();
    if (!this.graph.index.labelIndex.has(labelLower)) {
      this.graph.index.labelIndex.set(labelLower, new Set());
    }
    this.graph.index.labelIndex.get(labelLower)!.add(node.id);

    // Property index
    for (const [key, value] of Object.entries(node.properties)) {
      const propKey = `${key}:${value}`;
      if (!this.graph.index.propertyIndex.has(propKey)) {
        this.graph.index.propertyIndex.set(propKey, new Set());
      }
      this.graph.index.propertyIndex.get(propKey)!.add(node.id);
    }

    // Full-text index (simple word-based)
    const words = node.label.split(/\s+/);
    for (const word of words) {
      const wordLower = word.toLowerCase();
      if (!this.graph.index.fullTextIndex.has(wordLower)) {
        this.graph.index.fullTextIndex.set(wordLower, new Set());
      }
      this.graph.index.fullTextIndex.get(wordLower)!.add(node.id);
    }
  }

  /**
   * Remove node from index
   */
  private removeFromIndex(node: KnowledgeNode): void {
    this.graph.index.nodeTypeIndex.get(node.type)?.delete(node.id);

    const labelLower = node.label.toLowerCase();
    this.graph.index.labelIndex.get(labelLower)?.delete(node.id);

    for (const [key, value] of Object.entries(node.properties)) {
      const propKey = `${key}:${value}`;
      this.graph.index.propertyIndex.get(propKey)?.delete(node.id);
    }

    const words = node.label.split(/\s+/);
    for (const word of words) {
      const wordLower = word.toLowerCase();
      this.graph.index.fullTextIndex.get(wordLower)?.delete(node.id);
    }
  }

  /**
   * Check if node matches property filters
   */
  private matchesProperties(
    node: KnowledgeNode,
    properties: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(properties)) {
      if (node.properties[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Clear inference cache
   */
  clearInferenceCache(): void {
    this.inferenceCache.clear();
  }
}

/**
 * Inference rule interface
 */
export interface InferenceRule {
  name: string;
  description: string;
  apply: (graph: KnowledgeGraphSystem, nodeId: string) => Promise<unknown>;
}

/**
 * D1-based storage for knowledge graph
 */
export class D1GraphStorage implements GraphStorage {
  constructor(private db: D1Database) {
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.db.batch([
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS knowledge_nodes (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          label TEXT NOT NULL,
          properties TEXT NOT NULL,
          embedding TEXT,
          confidence REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS knowledge_edges (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          type TEXT NOT NULL,
          properties TEXT NOT NULL,
          weight REAL NOT NULL,
          confidence REAL NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (source_id) REFERENCES knowledge_nodes(id),
          FOREIGN KEY (target_id) REFERENCES knowledge_nodes(id)
        )
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_nodes_type
        ON knowledge_nodes(type)
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_nodes_label
        ON knowledge_nodes(label)
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_edges_source
        ON knowledge_edges(source_id)
      `),
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_edges_target
        ON knowledge_edges(target_id)
      `),
    ]);
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    const result = await this.db
      .prepare('SELECT * FROM knowledge_nodes WHERE id = ?')
      .bind(id)
      .first();

    if (!result) return null;

    return this.deserializeNode(result);
  }

  async saveNode(node: KnowledgeNode): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO knowledge_nodes
        (id, type, label, properties, embedding, confidence, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        node.id,
        node.type,
        node.label,
        JSON.stringify(node.properties),
        node.embedding ? JSON.stringify(node.embedding) : null,
        node.confidence,
        node.createdAt.toISOString(),
        node.updatedAt.toISOString()
      )
      .run();
  }

  async deleteNode(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM knowledge_nodes WHERE id = ?')
      .bind(id)
      .run();
  }

  async getEdge(id: string): Promise<KnowledgeEdge | null> {
    const result = await this.db
      .prepare('SELECT * FROM knowledge_edges WHERE id = ?')
      .bind(id)
      .first();

    if (!result) return null;

    return this.deserializeEdge(result);
  }

  async saveEdge(edge: KnowledgeEdge): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO knowledge_edges
        (id, source_id, target_id, type, properties, weight, confidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        edge.id,
        edge.sourceId,
        edge.targetId,
        edge.type,
        JSON.stringify(edge.properties),
        edge.weight,
        edge.confidence,
        edge.createdAt.toISOString()
      )
      .run();
  }

  async deleteEdge(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM knowledge_edges WHERE id = ?')
      .bind(id)
      .run();
  }

  async getEdgesForNode(nodeId: string): Promise<KnowledgeEdge[]> {
    const results = await this.db
      .prepare(`
        SELECT * FROM knowledge_edges
        WHERE source_id = ? OR target_id = ?
      `)
      .bind(nodeId, nodeId)
      .all();

    return results.results.map((r) => this.deserializeEdge(r));
  }

  async getAllNodes(): Promise<KnowledgeNode[]> {
    const results = await this.db
      .prepare('SELECT * FROM knowledge_nodes')
      .all();

    return results.results.map((r) => this.deserializeNode(r));
  }

  async getAllEdges(): Promise<KnowledgeEdge[]> {
    const results = await this.db
      .prepare('SELECT * FROM knowledge_edges')
      .all();

    return results.results.map((r) => this.deserializeEdge(r));
  }

  async queryNodes(query: GraphQuery): Promise<KnowledgeNode[]> {
    let sql = 'SELECT * FROM knowledge_nodes WHERE 1=1';
    const params: unknown[] = [];

    if (query.type) {
      sql += ' AND type = ?';
      params.push(query.type);
    }

    if (query.label) {
      sql += ' AND label LIKE ?';
      params.push(`%${query.label}%`);
    }

    if (query.limit) {
      sql += ` LIMIT ${query.limit}`;
    }

    const stmt = this.db.prepare(sql);
    for (let i = 0; i < params.length; i++) {
      stmt.bind(params[i]);
    }

    const results = await stmt.all();
    return results.results.map((r) => this.deserializeNode(r));
  }

  async queryEdges(query: GraphQuery): Promise<KnowledgeEdge[]> {
    let sql = 'SELECT * FROM knowledge_edges WHERE 1=1';
    const params: unknown[] = [];

    if (query.type) {
      sql += ' AND type = ?';
      params.push(query.type);
    }

    if (query.limit) {
      sql += ` LIMIT ${query.limit}`;
    }

    const stmt = this.db.prepare(sql);
    for (let i = 0; i < params.length; i++) {
      stmt.bind(params[i]);
    }

    const results = await stmt.all();
    return results.results.map((r) => this.deserializeEdge(r));
  }

  private deserializeNode(data: any): KnowledgeNode {
    return {
      id: data.id,
      type: data.type,
      label: data.label,
      properties: JSON.parse(data.properties),
      embedding: data.embedding ? JSON.parse(data.embedding) : undefined,
      confidence: data.confidence,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    } as KnowledgeNode;
  }

  private deserializeEdge(data: any): KnowledgeEdge {
    return {
      id: data.id,
      sourceId: data.source_id,
      targetId: data.target_id,
      type: data.type,
      properties: JSON.parse(data.properties),
      weight: data.weight,
      confidence: data.confidence,
      createdAt: new Date(data.created_at),
    } as KnowledgeEdge;
  }
}
