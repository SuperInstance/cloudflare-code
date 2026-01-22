/**
 * ML Model Monitoring Storage
 * Persistent storage for model predictions and metrics
 */

import { PredictionRecord, LabeledPrediction, ModelConfig } from './model-monitoring.js';

export class ModelMonitoringStorage {
  private predictions: Map<string, PredictionRecord[]> = new Map();
  private labeledPredictions: Map<string, LabeledPrediction[]> = new Map();
  private modelConfigs: Map<string, ModelConfig> = new Map();
  private featureDistributions: Map<string, Map<string, number[]>> = new Map();
  private trainingData: Map<string, Map<string, number[]>> = new Map();

  /**
   * Save model configuration
   */
  async saveModelConfig(config: ModelConfig): Promise<void> {
    this.modelConfigs.set(config.modelId, config);
  }

  /**
   * Get model configuration
   */
  async getModelConfig(modelId: string): Promise<ModelConfig | null> {
    return this.modelConfigs.get(modelId) || null;
  }

  /**
   * Save prediction
   */
  async savePrediction(record: PredictionRecord): Promise<void> {
    if (!this.predictions.has(record.modelId)) {
      this.predictions.set(record.modelId, []);
    }

    this.predictions.get(record.modelId)!.push(record);

    // Update feature distributions
    for (const [feature, value] of Object.entries(record.features)) {
      if (!this.featureDistributions.has(record.modelId)) {
        this.featureDistributions.set(record.modelId, new Map());
      }
      if (!this.featureDistributions.get(record.modelId)!.has(feature)) {
        this.featureDistributions.get(record.modelId)!.set(feature, []);
      }
      this.featureDistributions.get(record.modelId)!.get(feature)!.push(value);
    }
  }

  /**
   * Save label for prediction
   */
  async saveLabel(modelId: string, predictionId: string, label: any): Promise<void> {
    const predictions = this.predictions.get(modelId) || [];
    const prediction = predictions.find(p => p.predictionId === predictionId);

    if (prediction) {
      const labeled: LabeledPrediction = {
        ...prediction,
        label,
      };

      if (!this.labeledPredictions.has(modelId)) {
        this.labeledPredictions.set(modelId, []);
      }

      this.labeledPredictions.get(modelId)!.push(labeled);
    }
  }

  /**
   * Get predictions
   */
  async getPredictions(modelId: string, startTime: number): Promise<PredictionRecord[]> {
    const predictions = this.predictions.get(modelId) || [];
    return predictions.filter(p => p.timestamp >= startTime);
  }

  /**
   * Get labeled predictions
   */
  async getLabeledPredictions(modelId: string, startTime: number): Promise<LabeledPrediction[]> {
    const predictions = this.labeledPredictions.get(modelId) || [];
    return predictions.filter(p => p.timestamp >= startTime);
  }

  /**
   * Get feature distribution
   */
  async getFeatureDistribution(
    modelId: string,
    feature: string,
    startTime: number
  ): Promise<number[]> {
    const predictions = await this.getPredictions(modelId, startTime);
    return predictions.map(p => p.features[feature] || 0);
  }

  /**
   * Get training feature distribution
   */
  async getTrainingFeatureDistribution(modelId: string, feature: string): Promise<number[]> {
    const config = await this.getModelConfig(modelId);
    if (!config) return [];

    // In real implementation, this would load from training data
    // For now, return stored distribution or empty
    return this.trainingData.get(modelId)?.get(feature) || [];
  }

  /**
   * Set training data distribution
   */
  async setTrainingFeatureDistribution(modelId: string, feature: string, values: number[]): Promise<void> {
    if (!this.trainingData.has(modelId)) {
      this.trainingData.set(modelId, new Map());
    }
    this.trainingData.get(modelId)!.set(feature, values);
  }

  /**
   * Get prediction distribution
   */
  async getPredictionDistribution(modelId: string, startTime: number): Promise<Record<string, number>> {
    const predictions = await this.getPredictions(modelId, startTime);
    const distribution: Record<string, number> = {};

    for (const pred of predictions) {
      const key = Array.isArray(pred.prediction)
        ? pred.prediction.join(',')
        : String(pred.prediction);
      distribution[key] = (distribution[key] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Get training prediction distribution
   */
  async getTrainingPredictionDistribution(modelId: string): Promise<Record<string, number>> {
    const config = await this.getModelConfig(modelId);
    if (!config) return {};

    // In real implementation, this would load from training data
    return {};
  }

  /**
   * Get label distribution
   */
  async getLabelDistribution(modelId: string, startTime: number): Promise<Record<string, number>> {
    const predictions = await this.getLabeledPredictions(modelId, startTime);
    const distribution: Record<string, number> = {};

    for (const pred of predictions) {
      const key = Array.isArray(pred.label)
        ? pred.label.join(',')
        : String(pred.label);
      distribution[key] = (distribution[key] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Get training label distribution
   */
  async getTrainingLabelDistribution(modelId: string): Promise<Record<string, number>> {
    // In real implementation, this would load from training data
    return {};
  }

  /**
   * Clean up old data
   */
  async cleanup(olderThan: number): Promise<void> {
    for (const [modelId, predictions] of this.predictions.entries()) {
      const filtered = predictions.filter(p => p.timestamp >= olderThan);
      this.predictions.set(modelId, filtered);
    }

    for (const [modelId, predictions] of this.labeledPredictions.entries()) {
      const filtered = predictions.filter(p => p.timestamp >= olderThan);
      this.labeledPredictions.set(modelId, filtered);
    }
  }

  /**
   * Get statistics for a model
   */
  async getModelStats(modelId: string): Promise<{
    totalPredictions: number;
    labeledPredictions: number;
    oldestPrediction: number | null;
    newestPrediction: number | null;
  }> {
    const predictions = this.predictions.get(modelId) || [];
    const labeled = this.labeledPredictions.get(modelId) || [];

    const timestamps = predictions.map(p => p.timestamp);
    const oldestPrediction = timestamps.length > 0 ? Math.min(...timestamps) : null;
    const newestPrediction = timestamps.length > 0 ? Math.max(...timestamps) : null;

    return {
      totalPredictions: predictions.length,
      labeledPredictions: labeled.length,
      oldestPrediction,
      newestPrediction,
    };
  }

  /**
   * Get recent predictions
   */
  async getRecentPredictions(modelId: string, limit: number = 100): Promise<PredictionRecord[]> {
    const predictions = this.predictions.get(modelId) || [];
    return predictions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get predictions by user
   */
  async getPredictionsByUser(
    modelId: string,
    userId: string,
    startTime?: number
  ): Promise<PredictionRecord[]> {
    const predictions = this.predictions.get(modelId) || [];
    let filtered = predictions.filter(p => p.userId === userId);

    if (startTime) {
      filtered = filtered.filter(p => p.timestamp >= startTime);
    }

    return filtered;
  }
}

// ============================================================================
// D1-based Storage Implementation
// ============================================================================

export class D1ModelMonitoringStorage extends ModelMonitoringStorage {
  private db: D1Database;

  constructor(db: D1Database) {
    super();
    this.db = db;
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS model_configs (
        model_id TEXT PRIMARY KEY,
        model_version TEXT NOT NULL,
        features TEXT NOT NULL,
        predictions TEXT NOT NULL,
        baseline_metrics TEXT,
        threshold_config TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS predictions (
        prediction_id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        features TEXT NOT NULL,
        prediction TEXT NOT NULL,
        probability REAL,
        timestamp INTEGER NOT NULL,
        latency REAL NOT NULL,
        user_id TEXT,
        FOREIGN KEY (model_id) REFERENCES model_configs(model_id)
      );

      CREATE TABLE IF NOT EXISTS labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_id TEXT NOT NULL,
        prediction_id TEXT NOT NULL,
        label TEXT NOT NULL,
        labeled_at INTEGER NOT NULL,
        FOREIGN KEY (model_id) REFERENCES model_configs(model_id),
        FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
      );

      CREATE INDEX IF NOT EXISTS idx_predictions_model_id ON predictions(model_id);
      CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON predictions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
      CREATE INDEX IF NOT EXISTS idx_labels_model_id ON labels(model_id);
    `);
  }

  override async saveModelConfig(config: ModelConfig): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO model_configs
      (model_id, model_version, features, predictions, baseline_metrics, threshold_config, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      config.modelId,
      config.modelVersion,
      JSON.stringify(config.features),
      JSON.stringify(config.predictions),
      JSON.stringify(config.baselineMetrics || {}),
      JSON.stringify(config.thresholdConfig || {}),
      Date.now()
    ).run();
  }

  override async savePrediction(record: PredictionRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO predictions
      (prediction_id, model_id, features, prediction, probability, timestamp, latency, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.predictionId,
      record.modelId,
      JSON.stringify(record.features),
      JSON.stringify(record.prediction),
      record.probability || null,
      record.timestamp,
      record.latency,
      record.userId || null
    ).run();
  }

  override async saveLabel(modelId: string, predictionId: string, label: any): Promise<void> {
    await this.db.prepare(`
      INSERT INTO labels
      (model_id, prediction_id, label, labeled_at)
      VALUES (?, ?, ?, ?)
    `).bind(
      modelId,
      predictionId,
      JSON.stringify(label),
      Date.now()
    ).run();
  }

  override async getPredictions(modelId: string, startTime: number): Promise<PredictionRecord[]> {
    const result = await this.db.prepare(`
      SELECT prediction_id, model_id, features, prediction, probability, timestamp, latency, user_id
      FROM predictions
      WHERE model_id = ? AND timestamp >= ?
      ORDER BY timestamp DESC
    `).bind(modelId, startTime).all();

    return (result.results || []).map((row: any) => ({
      predictionId: row.prediction_id,
      modelId: row.model_id,
      features: JSON.parse(row.features),
      prediction: JSON.parse(row.prediction),
      probability: row.probability,
      timestamp: row.timestamp,
      latency: row.latency,
      userId: row.user_id,
    }));
  }

  override async getLabeledPredictions(modelId: string, startTime: number): Promise<LabeledPrediction[]> {
    const result = await this.db.prepare(`
      SELECT p.prediction_id, p.model_id, p.features, p.prediction, p.probability,
             p.timestamp, p.latency, p.user_id, l.label
      FROM predictions p
      INNER JOIN labels l ON p.prediction_id = l.prediction_id
      WHERE p.model_id = ? AND p.timestamp >= ?
      ORDER BY p.timestamp DESC
    `).bind(modelId, startTime).all();

    return (result.results || []).map((row: any) => ({
      predictionId: row.prediction_id,
      modelId: row.model_id,
      features: JSON.parse(row.features),
      prediction: JSON.parse(row.prediction),
      probability: row.probability,
      timestamp: row.timestamp,
      latency: row.latency,
      userId: row.user_id,
      label: JSON.parse(row.label),
    }));
  }

  override async getPredictionsByUser(
    modelId: string,
    userId: string,
    startTime?: number
  ): Promise<PredictionRecord[]> {
    let query = `
      SELECT prediction_id, model_id, features, prediction, probability, timestamp, latency, user_id
      FROM predictions
      WHERE model_id = ? AND user_id = ?
    `;
    const params = [modelId, userId];

    if (startTime) {
      query += ` AND timestamp >= ?`;
      params.push(startTime);
    }

    query += ` ORDER BY timestamp DESC`;

    const result = await this.db.prepare(query).bind(...params).all();

    return (result.results || []).map((row: any) => ({
      predictionId: row.prediction_id,
      modelId: row.model_id,
      features: JSON.parse(row.features),
      prediction: JSON.parse(row.prediction),
      probability: row.probability,
      timestamp: row.timestamp,
      latency: row.latency,
      userId: row.user_id,
    }));
  }

  /**
   * Get time series prediction data
   */
  async getPredictionTimeSeries(
    modelId: string,
    bucketSize: number = 3600000, // 1 hour
    limit: number = 24
  ): Promise<Array<{ timestamp: number; count: number; avgLatency: number }>> {
    const result = await this.db.prepare(`
      SELECT
        (timestamp / ?) * ? as timestamp,
        COUNT(*) as count,
        AVG(latency) as avg_latency
      FROM predictions
      WHERE model_id = ?
      GROUP BY (timestamp / ?) * ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).bind(bucketSize, bucketSize, modelId, bucketSize, bucketSize, limit).all();

    return (result.results || []).map((row: any) => ({
      timestamp: row.timestamp,
      count: row.count,
      avgLatency: row.avg_latency,
    }));
  }

  /**
   * Get feature statistics
   */
  async getFeatureStatistics(
    modelId: string,
    feature: string,
    startTime: number
  ): Promise<{ count: number; mean: number; min: number; max: number; std: number }> {
    const result = await this.db.prepare(`
      SELECT
        COUNT(*) as count,
        AVG(CAST(json_extract(features, '$.${feature}') as REAL)) as mean,
        MIN(CAST(json_extract(features, '$.${feature}') as REAL)) as min,
        MAX(CAST(json_extract(features, '$.${feature}') as REAL)) as max
      FROM predictions
      WHERE model_id = ? AND timestamp >= ?
    `).bind(modelId, startTime).all();

    const row = (result.results || [])[0];

    return {
      count: row.count || 0,
      mean: row.mean || 0,
      min: row.min || 0,
      max: row.max || 0,
      std: 0, // Would need more complex query
    };
  }

  /**
   * Batch import predictions
   */
  async batchImportPredictions(predictions: PredictionRecord[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO predictions
      (prediction_id, model_id, features, prediction, probability, timestamp, latency, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const pred of predictions) {
      await stmt.bind(
        pred.predictionId,
        pred.modelId,
        JSON.stringify(pred.features),
        JSON.stringify(pred.prediction),
        pred.probability || null,
        pred.timestamp,
        pred.latency,
        pred.userId || null
      ).run();
    }
  }
}
