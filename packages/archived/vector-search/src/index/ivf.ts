/**
 * IVF (Inverted File Index) Implementation
 *
 * Provides efficient approximate nearest neighbor search using
 * clustering-based partitioning.
 */

import {
  Vector,
  VectorId,
  VectorRecord,
  IVFConfig,
  DistanceMetric,
  SearchResult,
  IndexStats,
} from '../types/index.js';
import { calculateDistance, meanVector, euclideanDistance } from '../utils/vector.js';

interface IVFCluster {
  centroid: Vector;
  vectorIds: Set<VectorId>;
  vectors: Map<VectorId, Vector>;
}

/**
 * IVF Index class
 */
export class IVFIndex {
  private clusters: Map<number, IVFCluster>;
  private vectorToCluster: Map<VectorId, number>;
  private config: IVFConfig;
  private dimension: number;
  private vectorCount: number;
  private indexSize: number;
  private trained: boolean;
  private nprobe: number;

  constructor(config: IVFConfig) {
    this.config = config;
    this.clusters = new Map();
    this.vectorToCluster = new Map();
    this.dimension = config.dimension;
    this.vectorCount = 0;
    this.indexSize = 0;
    this.trained = false;
    this.nprobe = config.nprobe || Math.min(10, config.nlist);

    this.validateConfig();
  }

  /**
   * Validate IVF configuration
   */
  private validateConfig(): void {
    if (this.config.nlist < 1) {
      throw new Error('nlist must be >= 1');
    }
    if (this.config.nprobe !== undefined && this.config.nprobe > this.config.nlist) {
      throw new Error('nprobe must be <= nlist');
    }
  }

  /**
   * Train the index with sample vectors to build clusters
   */
  async train(vectors: Vector[]): Promise<void> {
    if (vectors.length === 0) {
      throw new Error('Cannot train with empty vector set');
    }

    if (vectors.length < this.config.nlist) {
      throw new Error(
        `Need at least ${this.config.nlist} vectors to train, got ${vectors.length}`
      );
    }

    // Initialize clusters using k-means++
    await this.initializeClusters(vectors);

    // Run k-means iterations
    const maxIterations = 20;
    for (let iter = 0; iter < maxIterations; iter++) {
      const converged = await this.assignVectorsToClusters(vectors);
      if (converged) break;
      await this.updateCentroids();
    }

    this.trained = true;
  }

  /**
   * Initialize clusters using k-means++
   */
  private async initializeClusters(vectors: Vector[]): Promise<void> {
    this.clusters.clear();

    // Select first centroid randomly
    const firstIdx = Math.floor(Math.random() * vectors.length);
    this.addCluster(0, vectors[firstIdx]);

    // Select remaining centroids using k-means++ probability distribution
    for (let i = 1; i < this.config.nlist; i++) {
      const distances = new Array<number>(vectors.length);
      let totalDist = 0;

      // Calculate distance to nearest centroid for each vector
      for (let j = 0; j < vectors.length; j++) {
        let minDist = Infinity;
        for (const [clusterId, cluster] of this.clusters.entries()) {
          const dist = euclideanDistance(vectors[j], cluster.centroid);
          if (dist < minDist) {
            minDist = dist;
          }
        }
        distances[j] = minDist * minDist; // Square distance
        totalDist += distances[j];
      }

      // Select next centroid with probability proportional to squared distance
      let random = Math.random() * totalDist;
      for (let j = 0; j < vectors.length; j++) {
        random -= distances[j];
        if (random <= 0) {
          this.addCluster(i, vectors[j]);
          break;
        }
      }
    }
  }

  /**
   * Add a new cluster
   */
  private addCluster(clusterId: number, centroid: Vector): void {
    this.clusters.set(clusterId, {
      centroid: new Float32Array(centroid),
      vectorIds: new Set(),
      vectors: new Map(),
    });
  }

  /**
   * Assign vectors to nearest clusters
   */
  private async assignVectorsToClusters(vectors: Vector[]): Promise<boolean> {
    let totalChanges = 0;

    for (const [clusterId, cluster] of this.clusters.entries()) {
      cluster.vectorIds.clear();
      cluster.vectors.clear();
    }

    for (let i = 0; i < vectors.length; i++) {
      const vector = vectors[i];
      let nearestCluster = 0;
      let minDist = Infinity;

      for (const [clusterId, cluster] of this.clusters.entries()) {
        const dist = euclideanDistance(vector, cluster.centroid);
        if (dist < minDist) {
          minDist = dist;
          nearestCluster = clusterId;
        }
      }

      const cluster = this.clusters.get(nearestCluster)!;
      cluster.vectorIds.add(`train_${i}`);
      cluster.vectors.set(`train_${i}`, vector);
    }

    return totalChanges === 0;
  }

  /**
   * Update cluster centroids
   */
  private async updateCentroids(): Promise<void> {
    for (const [clusterId, cluster] of this.clusters.entries()) {
      if (cluster.vectors.size === 0) continue;

      const vectors = Array.from(cluster.vectors.values());
      const newCentroid = meanVector(vectors);
      cluster.centroid = newCentroid;
    }
  }

  /**
   * Insert a vector into the index
   */
  async insert(record: VectorRecord): Promise<void> {
    this.validateVector(record.vector);

    if (!this.trained) {
      throw new Error('Index must be trained before inserting vectors');
    }

    // Find nearest cluster
    const nearestCluster = this.findNearestCluster(record.vector);

    // Add to cluster
    const cluster = this.clusters.get(nearestCluster)!;
    cluster.vectorIds.add(record.id);
    cluster.vectors.set(record.id, record.vector);
    this.vectorToCluster.set(record.id, nearestCluster);

    this.vectorCount++;
    this.indexSize += this.calculateRecordSize(record);
  }

  /**
   * Find nearest cluster for a vector
   */
  private findNearestCluster(vector: Vector): number {
    let nearestCluster = 0;
    let minDist = Infinity;

    for (const [clusterId, cluster] of this.clusters.entries()) {
      const dist = euclideanDistance(vector, cluster.centroid);
      if (dist < minDist) {
        minDist = dist;
        nearestCluster = clusterId;
      }
    }

    return nearestCluster;
  }

  /**
   * Search for k-nearest neighbors
   */
  async search(query: Vector, k: number = 10): Promise<SearchResult[]> {
    this.validateVector(query);

    if (!this.trained || this.vectorCount === 0) {
      return [];
    }

    // Find nprobe nearest clusters to query
    const clusterDistances: Array<{ clusterId: number; distance: number }> = [];
    for (const [clusterId, cluster] of this.clusters.entries()) {
      const dist = euclideanDistance(query, cluster.centroid);
      clusterDistances.push({ clusterId, distance: dist });
    }

    clusterDistances.sort((a, b) => a.distance - b.distance);
    const clustersToSearch = clusterDistances.slice(0, this.nprobe);

    // Search within selected clusters
    const candidates: Array<{ id: VectorId; distance: number }> = [];

    for (const { clusterId } of clustersToSearch) {
      const cluster = this.clusters.get(clusterId);
      if (!cluster) continue;

      for (const [id, vector] of cluster.vectors.entries()) {
        const dist = calculateDistance(query, vector, this.config.metric);
        candidates.push({ id, distance: dist });
      }
    }

    // Sort by distance and return top k
    candidates.sort((a, b) => a.distance - b.distance);
    const topK = candidates.slice(0, k);

    return topK.map((c) => ({
      id: c.id,
      score: 1.0 / (1.0 + c.distance),
      distance: c.distance,
    }));
  }

  /**
   * Delete a vector from the index
   */
  async delete(id: VectorId): Promise<boolean> {
    const clusterId = this.vectorToCluster.get(id);
    if (clusterId === undefined) return false;

    const cluster = this.clusters.get(clusterId);
    if (!cluster) return false;

    const vector = cluster.vectors.get(id);
    if (!vector) return false;

    cluster.vectorIds.delete(id);
    cluster.vectors.delete(id);
    this.vectorToCluster.delete(id);

    this.vectorCount--;
    this.indexSize -= this.calculateVectorSize(vector);

    return true;
  }

  /**
   * Get a vector by ID
   */
  async get(id: VectorId): Promise<VectorRecord | null> {
    const clusterId = this.vectorToCluster.get(id);
    if (clusterId === undefined) return null;

    const cluster = this.clusters.get(clusterId);
    if (!cluster) return null;

    const vector = cluster.vectors.get(id);
    if (!vector) return null;

    return {
      id,
      vector,
    };
  }

  /**
   * Check if a vector exists
   */
  async has(id: VectorId): Promise<boolean> {
    return this.vectorToCluster.has(id);
  }

  /**
   * Update a vector in the index
   */
  async update(record: VectorRecord): Promise<boolean> {
    const exists = await this.has(record.id);
    if (!exists) return false;

    await this.delete(record.id);
    await this.insert(record);

    return true;
  }

  /**
   * Clear all vectors from the index
   */
  async clear(): Promise<void> {
    for (const cluster of this.clusters.values()) {
      cluster.vectorIds.clear();
      cluster.vectors.clear();
    }
    this.vectorToCluster.clear();
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

    // Cluster centroids
    bytes += this.clusters.size * this.dimension * 4;

    // Vector data
    bytes += this.vectorCount * this.dimension * 4;

    // ID storage
    for (const cluster of this.clusters.values()) {
      bytes += cluster.vectorIds.size * 20; // Approximate string storage
    }

    return bytes;
  }

  /**
   * Calculate record size in bytes
   */
  private calculateRecordSize(record: VectorRecord): number {
    return this.calculateVectorSize(record.vector) + record.id.length * 2;
  }

  /**
   * Calculate vector size in bytes
   */
  private calculateVectorSize(vector: Vector): number {
    return vector.length * 4; // Float32Array
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
   * Set number of clusters to probe
   */
  setNProbe(nprobe: number): void {
    if (nprobe < 1 || nprobe > this.config.nlist) {
      throw new Error(`nprobe must be between 1 and ${this.config.nlist}`);
    }
    this.nprobe = nprobe;
  }

  /**
   * Get number of clusters to probe
   */
  getNProbe(): number {
    return this.nprobe;
  }

  /**
   * Check if index is trained
   */
  isTrained(): boolean {
    return this.trained;
  }

  /**
   * Get cluster information
   */
  getClusterInfo(): Array<{
    clusterId: number;
    vectorCount: number;
    centroid: number[];
  }> {
    const info = [];
    for (const [clusterId, cluster] of this.clusters.entries()) {
      info.push({
        clusterId,
        vectorCount: cluster.vectorIds.size,
        centroid: Array.from(cluster.centroid),
      });
    }
    return info;
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
    const ids: VectorId[] = [];
    for (const cluster of this.clusters.values()) {
      ids.push(...Array.from(cluster.vectorIds));
    }
    return ids;
  }

  /**
   * Rebuild clusters with current data
   */
  async rebuild(): Promise<void> {
    if (this.vectorCount === 0) {
      return;
    }

    // Collect all vectors
    const allVectors: Vector[] = [];
    const allIds: VectorId[] = [];

    for (const cluster of this.clusters.values()) {
      for (const [id, vector] of cluster.vectors.entries()) {
        allVectors.push(vector);
        allIds.push(id);
      }
    }

    // Clear and retrain
    await this.clear();
    await this.train(allVectors);

    // Re-insert vectors
    for (let i = 0; i < allVectors.length; i++) {
      await this.insert({
        id: allIds[i],
        vector: allVectors[i],
      });
    }
  }

  /**
   * Get the configuration
   */
  getConfig(): IVFConfig {
    return { ...this.config };
  }

  /**
   * Export index to snapshot
   */
  exportSnapshot(): {
    version: string;
    config: IVFConfig;
    trained: boolean;
    clusters: Array<{
      clusterId: number;
      centroid: number[];
      vectorIds: VectorId[];
      vectors: Array<{ id: VectorId; vector: number[] }>;
    }>;
    vectorToCluster: Map<VectorId, number>;
  } {
    const clusters = Array.from(this.clusters.entries()).map(([clusterId, cluster]) => ({
      clusterId,
      centroid: Array.from(cluster.centroid),
      vectorIds: Array.from(cluster.vectorIds),
      vectors: Array.from(cluster.vectors.entries()).map(([id, vector]) => ({
        id,
        vector: Array.from(vector),
      })),
    }));

    return {
      version: '1.0.0',
      config: this.config,
      trained: this.trained,
      clusters,
      vectorToCluster: new Map(this.vectorToCluster),
    };
  }

  /**
   * Import index from snapshot
   */
  importSnapshot(snapshot: {
    version: string;
    config: IVFConfig;
    trained: boolean;
    clusters: Array<{
      clusterId: number;
      centroid: number[];
      vectorIds: VectorId[];
      vectors: Array<{ id: VectorId; vector: number[] }>;
    }>;
    vectorToCluster: Map<VectorId, number>;
  }): void {
    this.clear();
    this.config = snapshot.config;
    this.trained = snapshot.trained;

    for (const clusterData of snapshot.clusters) {
      const cluster: IVFCluster = {
        centroid: new Float32Array(clusterData.centroid),
        vectorIds: new Set(clusterData.vectorIds),
        vectors: new Map(),
      };

      for (const { id, vector } of clusterData.vectors) {
        cluster.vectors.set(id, new Float32Array(vector));
      }

      this.clusters.set(clusterData.clusterId, cluster);
    }

    this.vectorToCluster = new Map(snapshot.vectorToCluster);
    this.vectorCount = this.vectorToCluster.size;
  }
}
