/**
 * Experiment Storage
 * Persistent storage for experiments and assignments
 */

import {
  Experiment,
  ExperimentStatus,
} from '../types/index.js';
import { ExperimentAssignment, ExperimentMetric } from './ab-testing.js';

export interface StorageConfig {
  namespace?: string;
  ttl?: number;
}

export class ExperimentStorage {
  private config: StorageConfig;
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, ExperimentAssignment> = new Map();
  private metrics: Map<string, ExperimentMetric[]> = new Map();

  constructor(config: StorageConfig = {}) {
    this.config = {
      namespace: config.namespace || 'experiments',
      ttl: config.ttl || 30 * 24 * 60 * 60 * 1000, // 30 days
    };
  }

  /**
   * Save experiment
   */
  async saveExperiment(experiment: Experiment): Promise<void> {
    this.experiments.set(experiment.id, experiment);

    // Persist to storage (in real implementation, use KV/D1/R2)
    await this.persistExperiment(experiment);
  }

  /**
   * Get experiment
   */
  async getExperiment(experimentId: string): Promise<Experiment | null> {
    return this.experiments.get(experimentId) || null;
  }

  /**
   * List experiments
   */
  async listExperiments(filters?: {
    status?: ExperimentStatus;
    limit?: number;
    offset?: number;
  }): Promise<Experiment[]> {
    let experiments = Array.from(this.experiments.values());

    if (filters?.status) {
      experiments = experiments.filter(e => e.status === filters.status);
    }

    experiments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (filters?.offset) {
      experiments = experiments.slice(filters.offset);
    }

    if (filters?.limit) {
      experiments = experiments.slice(0, filters.limit);
    }

    return experiments;
  }

  /**
   * Delete experiment
   */
  async deleteExperiment(experimentId: string): Promise<void> {
    this.experiments.delete(experimentId);

    // Delete related data
    this.deleteAssignments(experimentId);
    this.deleteMetrics(experimentId);

    await this.removeExperiment(experimentId);
  }

  /**
   * Save assignment
   */
  async saveAssignment(assignment: ExperimentAssignment): Promise<void> {
    const key = this.getAssignmentKey(assignment.experimentId, assignment.userId);
    this.assignments.set(key, assignment);
    await this.persistAssignment(assignment);
  }

  /**
   * Get assignment
   */
  async getAssignment(experimentId: string, userId: string): Promise<ExperimentAssignment | null> {
    const key = this.getAssignmentKey(experimentId, userId);
    return this.assignments.get(key) || null;
  }

  /**
   * List assignments for experiment
   */
  async listAssignments(experimentId: string): Promise<ExperimentAssignment[]> {
    const assignments: ExperimentAssignment[] = [];

    for (const assignment of this.assignments.values()) {
      if (assignment.experimentId === experimentId) {
        assignments.push(assignment);
      }
    }

    return assignments;
  }

  /**
   * Get assignment counts by variant
   */
  async getAssignmentCounts(experimentId: string): Promise<Record<string, number>> {
    const assignments = await this.listAssignments(experimentId);
    const counts: Record<string, number> = {};

    for (const assignment of assignments) {
      counts[assignment.variantId] = (counts[assignment.variantId] || 0) + 1;
    }

    return counts;
  }

  /**
   * Save metric
   */
  async saveMetric(metric: ExperimentMetric): Promise<void> {
    const key = `${metric.experimentId}:${metric.variantId}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push(metric);
    await this.persistMetric(metric);
  }

  /**
   * Get metrics for variant
   */
  async getVariantMetrics(
    experimentId: string,
    variantId: string
  ): Promise<Array<{ metricName: string; value: number }>> {
    const key = `${experimentId}:${variantId}`;
    const metrics = this.metrics.get(key) || [];

    return metrics.map(m => ({ metricName: m.metricName, value: m.value }));
  }

  /**
   * Get all metrics for experiment
   */
  async getExperimentMetrics(experimentId: string): Promise<ExperimentMetric[]> {
    const allMetrics: ExperimentMetric[] = [];

    for (const metrics of this.metrics.values()) {
      for (const metric of metrics) {
        if (metric.experimentId === experimentId) {
          allMetrics.push(metric);
        }
      }
    }

    return allMetrics;
  }

  /**
   * Get total sample size for experiment
   */
  async getTotalSampleSize(experimentId: string): Promise<number> {
    const assignments = await this.listAssignments(experimentId);
    return assignments.length;
  }

  /**
   * Get metrics by name
   */
  async getMetricsByName(
    experimentId: string,
    variantId: string,
    metricName: string
  ): Promise<number[]> {
    const metrics = await this.getVariantMetrics(experimentId, variantId);
    return metrics
      .filter(m => m.metricName === metricName)
      .map(m => m.value);
  }

  /**
   * Aggregate metrics
   */
  async aggregateMetrics(
    experimentId: string,
    metricName: string
  ): Promise<Record<string, { sum: number; count: number; avg: number }>> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const result: Record<string, { sum: number; count: number; avg: number }> = {};

    for (const variant of experiment.variants) {
      const values = await this.getMetricsByName(experimentId, variant.id, metricName);
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;

      result[variant.id] = {
        sum,
        count,
        avg: count > 0 ? sum / count : 0,
      };
    }

    return result;
  }

  /**
   * Cleanup old data
   */
  async cleanup(olderThan?: number): Promise<void> {
    const cutoff = olderThan || Date.now() - this.config.ttl!;

    // Clean up old experiments
    for (const [id, experiment] of this.experiments.entries()) {
      if ((experiment.endDate || experiment.createdAt || 0) < cutoff) {
        if (experiment.status !== 'running') {
          await this.deleteExperiment(id);
        }
      }
    }

    // Clean up old assignments
    for (const [key, assignment] of this.assignments.entries()) {
      if (assignment.assignedAt < cutoff) {
        this.assignments.delete(key);
      }
    }

    // Clean up old metrics
    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp >= cutoff);
      this.metrics.set(key, filtered);
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private getAssignmentKey(experimentId: string, userId: string): string {
    return `${experimentId}:${userId}`;
  }

  private deleteAssignments(experimentId: string): void {
    const prefix = `${experimentId}:`;
    for (const key of this.assignments.keys()) {
      if (key.startsWith(prefix)) {
        this.assignments.delete(key);
      }
    }
  }

  private deleteMetrics(experimentId: string): void {
    for (const key of this.metrics.keys()) {
      if (key.startsWith(experimentId)) {
        this.metrics.delete(key);
      }
    }
  }

  // ==========================================================================
  // Persistence Methods (to be implemented with actual storage)
  // ==========================================================================

  private async persistExperiment(experiment: Experiment): Promise<void> {
    // In real implementation, use KV/D1/R2
    console.debug(`Persisting experiment: ${experiment.id}`);
  }

  private async removeExperiment(experimentId: string): Promise<void> {
    // In real implementation, delete from KV/D1/R2
    console.debug(`Removing experiment: ${experimentId}`);
  }

  private async persistAssignment(assignment: ExperimentAssignment): Promise<void> {
    // In real implementation, use KV/D1/R2
    console.debug(`Persisting assignment: ${assignment.experimentId}:${assignment.userId}`);
  }

  private async persistMetric(metric: ExperimentMetric): Promise<void> {
    // In real implementation, use KV/D1/R2
    console.debug(`Persisting metric: ${metric.experimentId}:${metric.variantId}:${metric.metricName}`);
  }
}

// ============================================================================
// KV-based Storage Implementation
// ============================================================================

export class KVExperimentStorage extends ExperimentStorage {
  private kv: KVNamespace;

  constructor(kv: KVNamespace, config?: StorageConfig) {
    super(config);
    this.kv = kv;
  }

  override async persistExperiment(experiment: Experiment): Promise<void> {
    const key = `${this.config.namespace}:experiment:${experiment.id}`;
    await this.kv.put(key, JSON.stringify(experiment));
  }

  override async removeExperiment(experimentId: string): Promise<void> {
    const key = `${this.config.namespace}:experiment:${experimentId}`;
    await this.kv.delete(key);
  }

  override async persistAssignment(assignment: ExperimentAssignment): Promise<void> {
    const key = `${this.config.namespace}:assignment:${assignment.experimentId}:${assignment.userId}`;
    await this.kv.put(key, JSON.stringify(assignment), {
      expirationTtl: Math.floor(this.config.ttl! / 1000),
    });
  }

  override async persistMetric(metric: ExperimentMetric): Promise<void> {
    // For metrics, we might want to batch them or use a different storage
    // This is a simplified implementation
    const key = `${this.config.namespace}:metric:${metric.experimentId}:${metric.variantId}:${Date.now()}`;
    await this.kv.put(key, JSON.stringify(metric), {
      expirationTtl: Math.floor(this.config.ttl! / 1000),
    });
  }

  /**
   * Load experiment from KV
   */
  async loadExperiment(experimentId: string): Promise<Experiment | null> {
    const key = `${this.config.namespace}:experiment:${experimentId}`;
    const value = await this.kv.get(key);

    if (value) {
      return JSON.parse(value) as Experiment;
    }

    return null;
  }

  /**
   * Load assignment from KV
   */
  async loadAssignment(experimentId: string, userId: string): Promise<ExperimentAssignment | null> {
    const key = `${this.config.namespace}:assignment:${experimentId}:${userId}`;
    const value = await this.kv.get(key);

    if (value) {
      return JSON.parse(value) as ExperimentAssignment;
    }

    return null;
  }

  /**
   * Query experiments by status
   */
  async queryByStatus(status: ExperimentStatus): Promise<Experiment[]> {
    const list = await this.kv.list({
      prefix: `${this.config.namespace}:experiment:`,
    });

    const experiments: Experiment[] = [];

    for (const key of list.keys) {
      const value = await this.kv.get(key.name);
      if (value) {
        const experiment = JSON.parse(value) as Experiment;
        if (experiment.status === status) {
          experiments.push(experiment);
        }
      }
    }

    return experiments;
  }
}

// ============================================================================
// D1-based Storage Implementation
// ============================================================================

export class D1ExperimentStorage extends ExperimentStorage {
  private db: D1Database;

  constructor(db: D1Database, config?: StorageConfig) {
    super(config);
    this.db = db;
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        hypothesis TEXT,
        status TEXT NOT NULL,
        start_date INTEGER,
        end_date INTEGER,
        sample_size INTEGER,
        config TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS variants (
        id TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        config TEXT,
        weight REAL NOT NULL,
        is_control INTEGER DEFAULT 0,
        FOREIGN KEY (experiment_id) REFERENCES experiments(id)
      );

      CREATE TABLE IF NOT EXISTS assignments (
        experiment_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        variant_id TEXT NOT NULL,
        assigned_at INTEGER NOT NULL,
        attributes TEXT,
        PRIMARY KEY (experiment_id, user_id),
        FOREIGN KEY (experiment_id) REFERENCES experiments(id),
        FOREIGN KEY (variant_id) REFERENCES variants(id)
      );

      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        experiment_id TEXT NOT NULL,
        variant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (experiment_id) REFERENCES experiments(id),
        FOREIGN KEY (variant_id) REFERENCES variants(id)
      );

      CREATE INDEX IF NOT EXISTS idx_assignments_experiment ON assignments(experiment_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_experiment_variant ON metrics(experiment_id, variant_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
    `);
  }

  override async persistExperiment(experiment: Experiment): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO experiments
      (id, name, description, hypothesis, status, start_date, end_date, sample_size, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      experiment.id,
      experiment.name,
      experiment.description,
      experiment.hypothesis,
      experiment.status,
      experiment.startDate || null,
      experiment.endDate || null,
      experiment.sampleSize,
      JSON.stringify(experiment),
      experiment.createdAt || Date.now(),
      Date.now()
    ).run();

    // Persist variants
    for (const variant of experiment.variants) {
      await this.db.prepare(`
        INSERT OR REPLACE INTO variants
        (id, experiment_id, name, description, config, weight, is_control)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        variant.id,
        experiment.id,
        variant.name,
        variant.description,
        JSON.stringify(variant.config),
        variant.weight,
        variant.isControl ? 1 : 0
      ).run();
    }
  }

  override async removeExperiment(experimentId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM experiments WHERE id = ?`).bind(experimentId).run();
    await this.db.prepare(`DELETE FROM variants WHERE experiment_id = ?`).bind(experimentId).run();
    await this.db.prepare(`DELETE FROM assignments WHERE experiment_id = ?`).bind(experimentId).run();
    await this.db.prepare(`DELETE FROM metrics WHERE experiment_id = ?`).bind(experimentId).run();
  }

  override async persistAssignment(assignment: ExperimentAssignment): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO assignments
      (experiment_id, user_id, variant_id, assigned_at, attributes)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      assignment.experimentId,
      assignment.userId,
      assignment.variantId,
      assignment.assignedAt,
      assignment.attributes ? JSON.stringify(assignment.attributes) : null
    ).run();
  }

  override async persistMetric(metric: ExperimentMetric): Promise<void> {
    await this.db.prepare(`
      INSERT INTO metrics
      (experiment_id, variant_id, user_id, metric_name, value, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metric.experimentId,
      metric.variantId,
      metric.userId,
      metric.metricName,
      metric.value,
      metric.timestamp,
      metric.metadata ? JSON.stringify(metric.metadata) : null
    ).run();
  }

  /**
   * Query with aggregation
   */
  async queryMetrics(
    experimentId: string,
    metricName: string,
    groupBy?: string[]
  ): Promise<any[]> {
    let query = `
      SELECT
        variant_id,
        COUNT(*) as count,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value,
        STDDEV(value) as std_value
      FROM metrics
      WHERE experiment_id = ? AND metric_name = ?
    `;

    const params = [experimentId, metricName];

    if (groupBy && groupBy.length > 0) {
      query += ` GROUP BY variant_id`;
    }

    query += ` ORDER BY variant_id`;

    const result = await this.db.prepare(query).bind(...params).all();
    return result.results || [];
  }

  /**
   * Get time series data
   */
  async getTimeSeries(
    experimentId: string,
    metricName: string,
    bucketSize: number = 3600000 // 1 hour
  ): Promise<Array<{ timestamp: number; variant_id: string; value: number }>> {
    const query = `
      SELECT
        (timestamp / ?) * ? as timestamp,
        variant_id,
        AVG(value) as value
      FROM metrics
      WHERE experiment_id = ? AND metric_name = ?
      GROUP BY (timestamp / ?) * ?, variant_id
      ORDER BY timestamp ASC
    `;

    const result = await this.db.prepare(query)
      .bind(bucketSize, bucketSize, experimentId, metricName, bucketSize, bucketSize)
      .all();

    return (result.results || []).map((row: any) => ({
      timestamp: row.timestamp,
      variant_id: row.variant_id,
      value: row.value,
    }));
  }
}
