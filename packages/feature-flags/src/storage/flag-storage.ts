/**
 * Flag Storage - Durable Object implementation for storing and managing feature flags
 * Provides sub-millisecond access with real-time updates
 */

import type {
  Flag,
  FlagRules,
  FlagStorageState,
  Segment,
  Experiment,
  FlagEvaluation,
  Event,
  AnalyticsStorageState,
} from '../types/index.js';

// ============================================================================
// Flag Storage Durable Object
// ============================================================================

export interface FlagStorageEnv {
  FLAGS_DURABLE_OBJECT: DurableObjectNamespace;
  ANALYTICS_DURABLE_OBJECT: DurableObjectNamespace;
}

export class FlagStorageDurableObject {
  private state: DurableObjectState;
  private env: FlagStorageEnv;
  private flagState: FlagStorageState;
  private analyticsState: AnalyticsStorageState;
  private storage: DurableObjectStorage;
  private cachedEvaluations: Map<string, { value: unknown; timestamp: number }>;

  constructor(state: DurableObjectState, env: FlagStorageEnv) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
    this.cachedEvaluations = new Map();

    // Initialize state
    this.flagState = {
      flags: {},
      rules: {},
      segments: {},
      experiments: {},
      version: 0,
      lastUpdated: new Date(),
    };

    this.analyticsState = {
      evaluations: [],
      events: [],
      metrics: {},
      retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    // Set up alarm for periodic cleanup
    this.state.setAlarm(Date.now() + 60_000 * 60, this.cleanupOldEvaluations);
  }

  // ========================================================================
  // Flag Management
  // ========================================================================

  async getFlag(key: string): Promise<Flag | undefined> {
    return this.flagState.flags[key];
  }

  async setFlag(flag: Flag): Promise<void> {
    const existing = this.flagState.flags[flag.key];
    const version = existing ? existing.version + 1 : 1;

    this.flagState.flags[flag.key] = {
      ...flag,
      version,
      updatedAt: new Date(),
      createdAt: existing ? flag.createdAt : new Date(),
    };

    this.flagState.version++;
    this.flagState.lastUpdated = new Date();

    await this.storage.put(
      `flag:${flag.key}`,
      this.flagState.flags[flag.key]
    );
    await this.storage.put('version', this.flagState.version);
  }

  async deleteFlag(key: string): Promise<boolean> {
    if (!this.flagState.flags[key]) {
      return false;
    }

    delete this.flagState.flags[key];
    delete this.flagState.rules[key];

    this.flagState.version++;
    this.flagState.lastUpdated = new Date();

    await this.storage.delete(`flag:${key}`);
    await this.storage.delete(`rules:${key}`);
    await this.storage.put('version', this.flagState.version);

    return true;
  }

  async listFlags(filter?: {
    state?: string;
    tags?: string[];
    type?: string;
  }): Promise<Flag[]> {
    let flags = Object.values(this.flagState.flags);

    if (filter) {
      if (filter.state) {
        flags = flags.filter((f) => f.state === filter.state);
      }
      if (filter.type) {
        flags = flags.filter((f) => f.type === filter.type);
      }
      if (filter.tags && filter.tags.length > 0) {
        flags = flags.filter((f) =>
          filter.tags!.some((tag) => f.tags.includes(tag))
        );
      }
    }

    return flags;
  }

  async getFlagCount(): Promise<number> {
    return Object.keys(this.flagState.flags).length;
  }

  // ========================================================================
  // Rules Management
  // ========================================================================

  async getRules(flagKey: string): Promise<FlagRules | undefined> {
    return this.flagState.rules[flagKey];
  }

  async setRules(rules: FlagRules): Promise<void> {
    const existing = this.flagState.rules[rules.flagId];
    const version = existing ? existing.version + 1 : 1;

    this.flagState.rules[rules.flagId] = {
      ...rules,
      version,
      updatedAt: new Date(),
    };

    await this.storage.put(`rules:${rules.flagId}`, rules);
  }

  async deleteRules(flagKey: string): Promise<boolean> {
    if (!this.flagState.rules[flagKey]) {
      return false;
    }

    delete this.flagState.rules[flagKey];
    await this.storage.delete(`rules:${flagKey}`);

    return true;
  }

  // ========================================================================
  // Segment Management
  // ========================================================================

  async getSegment(id: string): Promise<Segment | undefined> {
    return this.flagState.segments[id];
  }

  async setSegment(segment: Segment): Promise<void> {
    this.flagState.segments[segment.id] = {
      ...segment,
      updatedAt: new Date(),
    };

    await this.storage.put(`segment:${segment.id}`, segment);
  }

  async deleteSegment(id: string): Promise<boolean> {
    if (!this.flagState.segments[id]) {
      return false;
    }

    delete this.flagState.segments[id];
    await this.storage.delete(`segment:${id}`);

    return true;
  }

  async listSegments(): Promise<Segment[]> {
    return Object.values(this.flagState.segments);
  }

  // ========================================================================
  // Experiment Management
  // ========================================================================

  async getExperiment(id: string): Promise<Experiment | undefined> {
    return this.flagState.experiments[id];
  }

  async setExperiment(experiment: Experiment): Promise<void> {
    this.flagState.experiments[experiment.id] = {
      ...experiment,
      updatedAt: new Date(),
    };

    await this.storage.put(`experiment:${experiment.id}`, experiment);
  }

  async deleteExperiment(id: string): Promise<boolean> {
    if (!this.flagState.experiments[id]) {
      return false;
    }

    delete this.flagState.experiments[id];
    await this.storage.delete(`experiment:${id}`);

    return true;
  }

  async listExperiments(filter?: { status?: string }): Promise<Experiment[]> {
    let experiments = Object.values(this.flagState.experiments);

    if (filter?.status) {
      experiments = experiments.filter((e) => e.status === filter.status);
    }

    return experiments;
  }

  // ========================================================================
  // Analytics and Events
  // ========================================================================

  async recordEvaluation(evaluation: FlagEvaluation): Promise<void> {
    this.analyticsState.evaluations.push(evaluation);

    // Update metrics
    if (!this.analyticsState.metrics[evaluation.flagId]) {
      this.analyticsState.metrics[evaluation.flagId] = {
        flagId: evaluation.flagId,
        period: {
          start: new Date(),
          end: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        evaluations: {
          total: 0,
          uniqueUsers: 0,
          trueCount: 0,
          falseCount: 0,
        },
        variants: [],
        errors: {
          total: 0,
          rate: 0,
          types: {},
        },
        performance: {
          avgEvaluationTime: 0,
          p50EvaluationTime: 0,
          p95EvaluationTime: 0,
          p99EvaluationTime: 0,
          cacheHitRate: 0,
        },
      };
    }

    const metrics = this.analyticsState.metrics[evaluation.flagId];
    metrics.evaluations.total++;

    if (evaluation.value === true) {
      metrics.evaluations.trueCount++;
    } else if (evaluation.value === false) {
      metrics.evaluations.falseCount++;
    }

    // Persist periodically
    if (this.analyticsState.evaluations.length % 100 === 0) {
      await this.flushAnalytics();
    }
  }

  async recordEvent(event: Event): Promise<void> {
    this.analyticsState.events.push(event);

    // Persist periodically
    if (this.analyticsState.events.length % 50 === 0) {
      await this.flushAnalytics();
    }
  }

  async getEvaluations(
    flagId: string,
    limit?: number,
    offset?: number
  ): Promise<FlagEvaluation[]> {
    let evaluations = this.analyticsState.evaluations.filter(
      (e) => e.flagId === flagId
    );

    // Sort by timestamp descending
    evaluations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (offset) {
      evaluations = evaluations.slice(offset);
    }

    if (limit) {
      evaluations = evaluations.slice(0, limit);
    }

    return evaluations;
  }

  async getEvents(
    flagId?: string,
    limit?: number
  ): Promise<Event[]> {
    let events = flagId
      ? this.analyticsState.events.filter((e) => e.flagId === flagId)
      : this.analyticsState.events;

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      events = events.slice(0, limit);
    }

    return events;
  }

  async getMetrics(flagId: string): Promise<Record<string, unknown> | undefined> {
    return this.analyticsState.metrics[flagId];
  }

  private async flushAnalytics(): Promise<void> {
    await this.storage.put(
      'analytics:evaluations',
      this.analyticsState.evaluations
    );
    await this.storage.put('analytics:events', this.analyticsState.events);
    await this.storage.put('analytics:metrics', this.analyticsState.metrics);
  }

  private async cleanupOldEvaluations(): Promise<void> {
    const cutoff = Date.now() - this.analyticsState.retentionPeriod;

    this.analyticsState.evaluations =
      this.analyticsState.evaluations.filter(
        (e) => e.timestamp.getTime() > cutoff
      );

    this.analyticsState.events = this.analyticsState.events.filter(
      (e) => e.timestamp.getTime() > cutoff
    );

    await this.flushAnalytics();

    // Schedule next cleanup
    this.state.setAlarm(Date.now() + 60_000 * 60, this.cleanupOldEvaluations);
  }

  // ========================================================================
  // State Management
  // ========================================================================

  async getState(): Promise<FlagStorageState> {
    return { ...this.flagState };
  }

  async getVersion(): Promise<number> {
    return this.flagState.version;
  }

  async initialize(): Promise<void> {
    // Load from storage
    const version = await this.storage.get<number>('version');
    if (version !== undefined) {
      this.flagState.version = version;
    }

    // Load all flags
    const flags = await this.storage.list({ prefix: 'flag:' });
    for (const [key, value] of flags) {
      const flagKey = key.replace('flag:', '');
      this.flagState.flags[flagKey] = value as Flag;
    }

    // Load all rules
    const rules = await this.storage.list({ prefix: 'rules:' });
    for (const [key, value] of rules) {
      const flagKey = key.replace('rules:', '');
      this.flagState.rules[flagKey] = value as FlagRules;
    }

    // Load all segments
    const segments = await this.storage.list({ prefix: 'segment:' });
    for (const [key, value] of segments) {
      const segmentId = key.replace('segment:', '');
      this.flagState.segments[segmentId] = value as Segment;
    }

    // Load all experiments
    const experiments = await this.storage.list({ prefix: 'experiment:' });
    for (const [key, value] of experiments) {
      const experimentId = key.replace('experiment:', '');
      this.flagState.experiments[experimentId] = value as Experiment;
    }

    // Load analytics
    const evaluations = await this.storage.get<FlagEvaluation[]>(
      'analytics:evaluations'
    );
    if (evaluations) {
      this.analyticsState.evaluations = evaluations;
    }

    const events = await this.storage.get<Event[]>('analytics:events');
    if (events) {
      this.analyticsState.events = events;
    }

    const metrics = await this.storage.get<Record<string, unknown>>(
      'analytics:metrics'
    );
    if (metrics) {
      this.analyticsState.metrics = metrics;
    }
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  setCachedEvaluation(key: string, value: unknown, ttl: number = 60_000): void {
    this.cachedEvaluations.set(key, {
      value,
      timestamp: Date.now() + ttl,
    });
  }

  getCachedEvaluation(key: string): unknown | undefined {
    const cached = this.cachedEvaluations.get(key);
    if (!cached) {
      return undefined;
    }

    if (Date.now() > cached.timestamp) {
      this.cachedEvaluations.delete(key);
      return undefined;
    }

    return cached.value;
  }

  clearCache(): void {
    this.cachedEvaluations.clear();
  }

  getCacheSize(): number {
    return this.cachedEvaluations.size;
  }
}

// ============================================================================
// Analytics Storage Durable Object
// ============================================================================

export class AnalyticsStorageDurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private analyticsState: AnalyticsStorageState;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;

    this.analyticsState = {
      evaluations: [],
      events: [],
      metrics: {},
      retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    // Set up alarm for periodic cleanup and aggregation
    this.state.setAlarm(Date.now() + 60_000 * 5, this.processAnalyticsBatch);
  }

  async recordEvaluation(evaluation: FlagEvaluation): Promise<void> {
    this.analyticsState.evaluations.push(evaluation);
    await this.updateMetrics(evaluation);

    // Persist every 100 evaluations
    if (this.analyticsState.evaluations.length % 100 === 0) {
      await this.persistEvaluations();
    }
  }

  async recordEvent(event: Event): Promise<void> {
    this.analyticsState.events.push(event);

    // Persist every 50 events
    if (this.analyticsState.events.length % 50 === 0) {
      await this.persistEvents();
    }
  }

  async queryEvaluations(query: {
    flagId?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<FlagEvaluation[]> {
    let results = this.analyticsState.evaluations;

    if (query.flagId) {
      results = results.filter((e) => e.flagId === query.flagId);
    }

    if (query.userId) {
      results = results.filter((e) => e.userId === query.userId);
    }

    if (query.startTime) {
      results = results.filter((e) => e.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      results = results.filter((e) => e.timestamp <= query.endTime!);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async queryEvents(query: {
    type?: string;
    flagId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<Event[]> {
    let results = this.analyticsState.events;

    if (query.type) {
      results = results.filter((e) => e.type === query.type);
    }

    if (query.flagId) {
      results = results.filter((e) => e.flagId === query.flagId);
    }

    if (query.startTime) {
      results = results.filter((e) => e.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      results = results.filter((e) => e.timestamp <= query.endTime!);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async getAggregatedMetrics(
    flagId: string,
    period: { start: Date; end: Date }
  ): Promise<Record<string, unknown>> {
    const evaluations = this.analyticsState.evaluations.filter(
      (e) => e.flagId === flagId && e.timestamp >= period.start && e.timestamp <= period.end
    );

    const uniqueUsers = new Set(evaluations.map((e) => e.userId)).size;
    const total = evaluations.length;
    const trueCount = evaluations.filter((e) => e.value === true).length;
    const falseCount = evaluations.filter((e) => e.value === false).length;

    // Calculate percentiles
    const evaluationTimes = evaluations.map((e) => e.evaluationDetails.evaluationTime);
    evaluationTimes.sort((a, b) => a - b);

    const p50 = evaluationTimes[Math.floor(evaluationTimes.length * 0.5)] || 0;
    const p95 = evaluationTimes[Math.floor(evaluationTimes.length * 0.95)] || 0;
    const p99 = evaluationTimes[Math.floor(evaluationTimes.length * 0.99)] || 0;
    const avg = evaluationTimes.reduce((a, b) => a + b, 0) / evaluationTimes.length || 0;

    // Variant distribution
    const variantCounts: Record<string, number> = {};
    for (const evaluation of evaluations) {
      const variant = evaluation.evaluationDetails.matchedVariant || 'default';
      variantCounts[variant] = (variantCounts[variant] || 0) + 1;
    }

    return {
      total,
      uniqueUsers,
      trueCount,
      falseCount,
      trueRate: total > 0 ? trueCount / total : 0,
      falseRate: total > 0 ? falseCount / total : 0,
      performance: {
        avgEvaluationTime: avg,
        p50EvaluationTime: p50,
        p95EvaluationTime: p95,
        p99EvaluationTime: p99,
      },
      variants: variantCounts,
      period,
    };
  }

  private async updateMetrics(evaluation: FlagEvaluation): Promise<void> {
    if (!this.analyticsState.metrics[evaluation.flagId]) {
      this.analyticsState.metrics[evaluation.flagId] = {
        flagId: evaluation.flagId,
        period: {
          start: new Date(),
          end: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        evaluations: {
          total: 0,
          uniqueUsers: 0,
          trueCount: 0,
          falseCount: 0,
        },
        variants: [],
        errors: {
          total: 0,
          rate: 0,
          types: {},
        },
        performance: {
          avgEvaluationTime: 0,
          p50EvaluationTime: 0,
          p95EvaluationTime: 0,
          p99EvaluationTime: 0,
          cacheHitRate: 0,
        },
      };
    }
  }

  private async persistEvaluations(): Promise<void> {
    await this.storage.put(
      'analytics:evaluations',
      this.analyticsState.evaluations
    );
  }

  private async persistEvents(): Promise<void> {
    await this.storage.put('analytics:events', this.analyticsState.events);
  }

  private async processAnalyticsBatch(): Promise<void> {
    // Persist all pending data
    await this.persistEvaluations();
    await this.persistEvents();

    // Clean up old data
    const cutoff = Date.now() - this.analyticsState.retentionPeriod;

    this.analyticsState.evaluations = this.analyticsState.evaluations.filter(
      (e) => e.timestamp.getTime() > cutoff
    );

    this.analyticsState.events = this.analyticsState.events.filter(
      (e) => e.timestamp.getTime() > cutoff
    );

    // Schedule next processing
    this.state.setAlarm(Date.now() + 60_000 * 5, this.processAnalyticsBatch);
  }

  async initialize(): Promise<void> {
    // Load from storage
    const evaluations = await this.storage.get<FlagEvaluation[]>(
      'analytics:evaluations'
    );
    if (evaluations) {
      this.analyticsState.evaluations = evaluations;
    }

    const events = await this.storage.get<Event[]>('analytics:events');
    if (events) {
      this.analyticsState.events = events;
    }

    const metrics = await this.storage.get<Record<string, unknown>>(
      'analytics:metrics'
    );
    if (metrics) {
      this.analyticsState.metrics = metrics;
    }
  }
}
