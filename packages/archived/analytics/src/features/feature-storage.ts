/**
 * Feature Flag Storage
 * Persistent storage for feature flags
 */

import {
  FeatureFlag,
  FeatureFlagType,
} from '../types/index.js';

export interface FlagStats {
  evaluations: number;
  trueCount: number;
  falseCount: number;
  variationCounts: Record<string, number>;
}

export class FeatureFlagStorage {
  private flags: Map<string, FeatureFlag> = new Map();
  private stats: Map<string, FlagStats> = new Map();

  /**
   * Save feature flag
   */
  async saveFlag(flag: FeatureFlag): Promise<void> {
    this.flags.set(flag.id, flag);

    // Initialize stats if needed
    if (!this.stats.has(flag.id)) {
      this.stats.set(flag.id, {
        evaluations: 0,
        trueCount: 0,
        falseCount: 0,
        variationCounts: {},
      });
    }

    await this.persistFlag(flag);
  }

  /**
   * Get feature flag
   */
  async getFlag(flagId: string): Promise<FeatureFlag | null> {
    return this.flags.get(flagId) || null;
  }

  /**
   * List feature flags
   */
  async listFlags(filters?: {
    enabled?: boolean;
    type?: FeatureFlagType;
    environment?: string;
  }): Promise<FeatureFlag[]> {
    let flags = Array.from(this.flags.values());

    if (filters?.enabled !== undefined) {
      flags = flags.filter(f => f.enabled === filters.enabled);
    }

    if (filters?.type) {
      flags = flags.filter(f => f.type === filters.type);
    }

    if (filters?.environment) {
      flags = flags.filter(f => {
        switch (filters.environment) {
          case 'development':
            return f.environmentConfig.development;
          case 'staging':
            return f.environmentConfig.staging;
          case 'production':
            return f.environmentConfig.production;
          default:
            return false;
        }
      });
    }

    return flags.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Delete feature flag
   */
  async deleteFlag(flagId: string): Promise<void> {
    this.flags.delete(flagId);
    this.stats.delete(flagId);
    await this.removeFlag(flagId);
  }

  /**
   * Record evaluation
   */
  async recordEvaluation(
    flagId: string,
    value: any,
    variation?: string
  ): Promise<void> {
    const stats = this.stats.get(flagId);
    if (!stats) return;

    stats.evaluations++;

    if (value === true || value === 'true') {
      stats.trueCount++;
    } else if (value === false || value === 'false') {
      stats.falseCount++;
    }

    if (variation) {
      stats.variationCounts[variation] = (stats.variationCounts[variation] || 0) + 1;
    }

    await this.persistStats(flagId, stats);
  }

  /**
   * Get flag statistics
   */
  async getFlagStats(flagId: string): Promise<FlagStats> {
    return this.stats.get(flagId) || {
      evaluations: 0,
      trueCount: 0,
      falseCount: 0,
      variationCounts: {},
    };
  }

  /**
   * Get flag by name
   */
  async getFlagByName(name: string): Promise<FeatureFlag | null> {
    for (const flag of this.flags.values()) {
      if (flag.name === name) {
        return flag;
      }
    }
    return null;
  }

  /**
   * Search flags
   */
  async searchFlags(query: string): Promise<FeatureFlag[]> {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.flags.values()).filter(
      flag =>
        flag.name.toLowerCase().includes(lowerQuery) ||
        flag.description.toLowerCase().includes(lowerQuery)
    );
  }

  // ==========================================================================
  // Persistence Methods
  // ==========================================================================

  protected async persistFlag(flag: FeatureFlag): Promise<void> {
    // Override in actual storage implementation
    console.debug(`Persisting flag: ${flag.id}`);
  }

  protected async removeFlag(flagId: string): Promise<void> {
    // Override in actual storage implementation
    console.debug(`Removing flag: ${flagId}`);
  }

  protected async persistStats(flagId: string, stats: FlagStats): Promise<void> {
    // Override in actual storage implementation
    console.debug(`Persisting stats for flag: ${flagId}`);
  }
}

// ============================================================================
// KV-based Storage Implementation
// ============================================================================

export class KVFeatureFlagStorage extends FeatureFlagStorage {
  private kv: KVNamespace;
  private namespace: string;

  constructor(kv: KVNamespace, namespace: string = 'feature_flags') {
    super();
    this.kv = kv;
    this.namespace = namespace;
  }

  override async persistFlag(flag: FeatureFlag): Promise<void> {
    const key = `${this.namespace}:flag:${flag.id}`;
    await this.kv.put(key, JSON.stringify(flag));
  }

  override async removeFlag(flagId: string): Promise<void> {
    const key = `${this.namespace}:flag:${flagId}`;
    await this.kv.delete(key);
  }

  override async persistStats(flagId: string, stats: FlagStats): Promise<void> {
    const key = `${this.namespace}:stats:${flagId}`;
    await this.kv.put(key, JSON.stringify(stats));
  }

  /**
   * Load flag from KV
   */
  async loadFlag(flagId: string): Promise<FeatureFlag | null> {
    const key = `${this.namespace}:flag:${flagId}`;
    const value = await this.kv.get(key, 'json');

    return value as FeatureFlag | null;
  }

  /**
   * Load all flags
   */
  async loadAllFlags(): Promise<FeatureFlag[]> {
    const list = await this.kv.list({
      prefix: `${this.namespace}:flag:`,
    });

    const flags: FeatureFlag[] = [];

    for (const key of list.keys) {
      const value = await this.kv.get(key.name, 'json');
      if (value) {
        flags.push(value as FeatureFlag);
      }
    }

    return flags;
  }
}

// ============================================================================
// D1-based Storage Implementation
// ============================================================================

export class D1FeatureFlagStorage extends FeatureFlagStorage {
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
      CREATE TABLE IF NOT EXISTS feature_flags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        type TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        rules TEXT,
        rollout_strategy TEXT,
        environment_config TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS flag_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flag_id TEXT NOT NULL,
        value TEXT,
        variation TEXT,
        user_id TEXT,
        evaluated_at INTEGER NOT NULL,
        FOREIGN KEY (flag_id) REFERENCES feature_flags(id)
      );

      CREATE TABLE IF NOT EXISTS flag_rules (
        id TEXT PRIMARY KEY,
        flag_id TEXT NOT NULL,
        name TEXT NOT NULL,
        condition TEXT NOT NULL,
        variation TEXT,
        enabled INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        FOREIGN KEY (flag_id) REFERENCES feature_flags(id)
      );

      CREATE INDEX IF NOT EXISTS idx_flags_name ON feature_flags(name);
      CREATE INDEX IF NOT EXISTS idx_flags_enabled ON feature_flags(enabled);
      CREATE INDEX IF NOT EXISTS idx_evaluations_flag_id ON flag_evaluations(flag_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_evaluated_at ON flag_evaluations(evaluated_at);
    `);
  }

  override async persistFlag(flag: FeatureFlag): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO feature_flags
      (id, name, description, type, enabled, rules, rollout_strategy, environment_config, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      flag.id,
      flag.name,
      flag.description,
      flag.type,
      flag.enabled ? 1 : 0,
      JSON.stringify(flag.rules),
      flag.rolloutStrategy,
      JSON.stringify(flag.environmentConfig),
      flag.metadata ? JSON.stringify(flag.metadata) : null,
      flag.createdAt,
      flag.updatedAt
    ).run();

    // Persist rules
    for (const rule of flag.rules) {
      await this.db.prepare(`
        INSERT OR REPLACE INTO flag_rules
        (id, flag_id, name, condition, variation, enabled, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        rule.id,
        flag.id,
        rule.name,
        JSON.stringify(rule.condition),
        rule.variation || null,
        rule.enabled ? 1 : 0,
        rule.priority
      ).run();
    }
  }

  override async removeFlag(flagId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM feature_flags WHERE id = ?`).bind(flagId).run();
    await this.db.prepare(`DELETE FROM flag_rules WHERE flag_id = ?`).bind(flagId).run();
  }

  override async recordEvaluation(
    flagId: string,
    value: any,
    variation?: string,
    userId?: string
  ): Promise<void> {
    await this.db.prepare(`
      INSERT INTO flag_evaluations
      (flag_id, value, variation, user_id, evaluated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      flagId,
      String(value),
      variation || null,
      userId || null,
      Date.now()
    ).run();
  }

  /**
   * Get evaluation history
   */
  async getEvaluationHistory(
    flagId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Array<{ value: string; variation?: string; userId?: string; evaluatedAt: number }>> {
    const result = await this.db.prepare(`
      SELECT value, variation, user_id, evaluated_at
      FROM flag_evaluations
      WHERE flag_id = ?
      ORDER BY evaluated_at DESC
      LIMIT ? OFFSET ?
    `).bind(flagId, limit, offset).all();

    return (result.results || []).map((row: any) => ({
      value: row.value,
      variation: row.variation,
      userId: row.user_id,
      evaluatedAt: row.evaluated_at,
    }));
  }

  /**
   * Get time series evaluation data
   */
  async getEvaluationTimeSeries(
    flagId: string,
    bucketSize: number = 3600000, // 1 hour
    limit: number = 24
  ): Promise<Array<{ timestamp: number; evaluations: number; trueCount: number; falseCount: number }>> {
    const result = await this.db.prepare(`
      SELECT
        (evaluated_at / ?) * ? as timestamp,
        COUNT(*) as evaluations,
        SUM(CASE WHEN value = 'true' THEN 1 ELSE 0 END) as true_count,
        SUM(CASE WHEN value = 'false' THEN 1 ELSE 0 END) as false_count
      FROM flag_evaluations
      WHERE flag_id = ?
      GROUP BY (evaluated_at / ?) * ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).bind(bucketSize, bucketSize, flagId, bucketSize, bucketSize, limit).all();

    return (result.results || []).map((row: any) => ({
      timestamp: row.timestamp,
      evaluations: row.evaluations,
      trueCount: row.true_count,
      falseCount: row.false_count,
    }));
  }
}

// ============================================================================
// Memory-based Storage Implementation (for testing)
// ============================================================================

export class MemoryFeatureFlagStorage extends FeatureFlagStorage {
  constructor() {
    super();
  }

  override async persistFlag(flag: FeatureFlag): Promise<void> {
    // Already stored in memory
  }

  override async removeFlag(flagId: string): Promise<void> {
    // Already removed from memory
  }

  override async persistStats(flagId: string, stats: FlagStats): Promise<void> {
    // Already stored in memory
  }
}
