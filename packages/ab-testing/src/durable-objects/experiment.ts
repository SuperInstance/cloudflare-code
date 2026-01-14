/**
 * Experiment Durable Object - Manages experiment state
 * using Cloudflare Workers Durable Objects for strong consistency
 */

import type {
  ExperimentConfig,
  ExperimentStatus,
  ExperimentResults,
  VariantStats,
  Event,
  Assignment,
  ExperimentCheckpoint
} from '../types/experiment.js';
import { ExperimentNotFoundError, InvalidExperimentStateError } from '../types/errors.js';

/**
 * Experiment state storage interface
 */
export interface ExperimentStorage {
  /** Experiment configuration */
  config: ExperimentConfig;
  /** Current status */
  status: ExperimentStatus;
  /** Start timestamp */
  startTime?: number;
  /** End timestamp */
  endTime?: number;
  /** All assignments */
  assignments: Map<string, Assignment>;
  /** All events */
  events: Event[];
  /** Current results */
  results?: ExperimentResults;
  /** Checkpoints */
  checkpoints: ExperimentCheckpoint[];
  /** Version for optimistic locking */
  version: number;
}

/**
 * Experiment Durable Object
 */
export class ExperimentDurableObject {
  private state: DurableObjectState;
  private storage: ExperimentStorage;
  private env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.storage = {
      config: {} as ExperimentConfig,
      status: 'draft',
      assignments: new Map(),
      events: [],
      checkpoints: [],
      version: 0
    };
  }

  /**
   * Initialize the Durable Object
   */
  async init(config: ExperimentConfig): Promise<void> {
    this.storage.config = config;
    this.storage.status = 'draft';
    await this.persist();
  }

  /**
   * Start the experiment
   */
  async start(): Promise<void> {
    if (this.storage.status !== 'draft') {
      throw new InvalidExperimentStateError(
        this.storage.config.id,
        this.storage.status,
        ['draft']
      );
    }

    this.storage.status = 'running';
    this.storage.startTime = Date.now();
    await this.persist();
  }

  /**
   * Pause the experiment
   */
  async pause(): Promise<void> {
    if (this.storage.status !== 'running') {
      throw new InvalidExperimentStateError(
        this.storage.config.id,
        this.storage.status,
        ['running']
      );
    }

    this.storage.status = 'paused';
    await this.persist();
  }

  /**
   * Resume the experiment
   */
  async resume(): Promise<void> {
    if (this.storage.status !== 'paused') {
      throw new InvalidExperimentStateError(
        this.storage.config.id,
        this.storage.status,
        ['paused']
      );
    }

    this.storage.status = 'running';
    await this.persist();
  }

  /**
   * Complete the experiment
   */
  async complete(results: ExperimentResults): Promise<void> {
    if (this.storage.status !== 'running' && this.storage.status !== 'paused') {
      throw new InvalidExperimentStateError(
        this.storage.config.id,
        this.storage.status,
        ['running', 'paused']
      );
    }

    this.storage.status = 'completed';
    this.storage.endTime = Date.now();
    this.storage.results = results;
    await this.persist();
  }

  /**
   * Terminate the experiment
   */
  async terminate(reason: string): Promise<void> {
    if (this.storage.status === 'completed' || this.storage.status === 'terminated') {
      throw new InvalidExperimentStateError(
        this.storage.config.id,
        this.storage.status,
        ['draft', 'running', 'paused']
      );
    }

    this.storage.status = 'terminated';
    this.storage.endTime = Date.now();
    await this.persist();
  }

  /**
   * Record an assignment
   */
  async recordAssignment(assignment: Assignment): Promise<void> {
    const key = `${assignment.experimentId}:${assignment.userId}`;
    this.storage.assignments.set(key, assignment);
    await this.persist();
  }

  /**
   * Get assignment for a user
   */
  getAssignment(userId: string): Assignment | null {
    const key = `${this.storage.config.id}:${userId}`;
    return this.storage.assignments.get(key) ?? null;
  }

  /**
   * Record an event
   */
  async recordEvent(event: Event): Promise<void> {
    this.storage.events.push(event);
    await this.persist();
  }

  /**
   * Get all events for a user
   */
  getUserEvents(userId: string): Event[] {
    return this.storage.events.filter(e => e.userId === userId);
  }

  /**
   * Get all assignments
   */
  getAllAssignments(): Assignment[] {
    return Array.from(this.storage.assignments.values());
  }

  /**
   * Get all events
   */
  getAllEvents(): Event[] {
    return [...this.storage.events];
  }

  /**
   * Get experiment configuration
   */
  getConfig(): ExperimentConfig {
    return this.storage.config;
  }

  /**
   * Get experiment status
   */
  getStatus(): ExperimentStatus {
    return this.storage.status;
  }

  /**
   * Get experiment results
   */
  getResults(): ExperimentResults | undefined {
    return this.storage.results;
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(): Promise<ExperimentCheckpoint> {
    const checkpoint: ExperimentCheckpoint = {
      timestamp: Date.now(),
      state: this.storage.config,
      results: this.calculateResults(),
      assignments: new Map(this.storage.assignments)
    };

    this.storage.checkpoints.push(checkpoint);
    await this.persist();

    return checkpoint;
  }

  /**
   * Rollback to a checkpoint
   */
  async rollbackToCheckpoint(checkpointIndex: number): Promise<void> {
    if (checkpointIndex < 0 || checkpointIndex >= this.storage.checkpoints.length) {
      throw new Error('Invalid checkpoint index');
    }

    const checkpoint = this.storage.checkpoints[checkpointIndex];

    this.storage.config = checkpoint.state;
    this.storage.assignments = new Map(checkpoint.assignments);
    this.storage.results = checkpoint.results;

    await this.persist();
  }

  /**
   * Update experiment configuration
   */
  async updateConfig(config: Partial<ExperimentConfig>, expectedVersion: number): Promise<void> {
    if (this.storage.version !== expectedVersion) {
      throw new Error('Concurrent modification detected');
    }

    this.storage.config = { ...this.storage.config, ...config };
    this.storage.version++;
    await this.persist();
  }

  /**
   * Get experiment statistics
   */
  getStatistics(): {
    totalAssignments: number;
    totalEvents: number;
    assignmentsPerVariant: Map<string, number>;
    eventsPerVariant: Map<string, number>;
  } {
    const assignmentsPerVariant = new Map<string, number>();
    const eventsPerVariant = new Map<string, number>();

    for (const assignment of this.storage.assignments.values()) {
      const count = assignmentsPerVariant.get(assignment.variantId) ?? 0;
      assignmentsPerVariant.set(assignment.variantId, count + 1);
    }

    for (const event of this.storage.events) {
      const count = eventsPerVariant.get(event.variantId) ?? 0;
      eventsPerVariant.set(event.variantId, count + 1);
    }

    return {
      totalAssignments: this.storage.assignments.size,
      totalEvents: this.storage.events.length,
      assignmentsPerVariant,
      eventsPerVariant
    };
  }

  /**
   * Calculate current results
   */
  private calculateResults(): ExperimentResults {
    const variantStats = new Map<string, VariantStats>();

    // Initialize variant stats
    for (const variant of this.storage.config.variants) {
      variantStats.set(variant.id, {
        variantId: variant.id,
        sampleSize: 0,
        metrics: {}
      });
    }

    // Count assignments
    for (const assignment of this.storage.assignments.values()) {
      const stats = variantStats.get(assignment.variantId);
      if (stats) {
        stats.sampleSize++;
      }
    }

    // Process events
    for (const event of this.storage.events) {
      const stats = variantStats.get(event.variantId);
      if (stats) {
        for (const [metricName, value] of Object.entries(event.metrics)) {
          if (typeof value === 'number') {
            if (!stats.metrics[metricName]) {
              stats.metrics[metricName] = {
                name: metricName,
                count: 0,
                sum: 0,
                mean: 0,
                variance: 0,
                standardDeviation: 0,
                min: Infinity,
                max: -Infinity,
                percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 }
              };
            }

            const metric = stats.metrics[metricName];
            metric.count++;
            metric.sum += value;
            metric.mean = metric.sum / metric.count;
            metric.min = Math.min(metric.min, value);
            metric.max = Math.max(metric.max, value);
          }
        }
      }
    }

    return {
      experimentId: this.storage.config.id,
      status: this.storage.status,
      variantStats: Array.from(variantStats.values()),
      testResults: {},
      totalParticipants: this.storage.assignments.size,
      timestamp: Date.now()
    };
  }

  /**
   * Persist state to storage
   */
  private async persist(): Promise<void> {
    await this.state.storage.put({
      config: this.storage.config,
      status: this.storage.status,
      startTime: this.storage.startTime,
      endTime: this.storage.endTime,
      assignments: Array.from(this.storage.assignments.entries()),
      events: this.storage.events,
      results: this.storage.results,
      checkpoints: this.storage.checkpoints,
      version: this.storage.version
    });
  }

  /**
   * Load state from storage
   */
  async load(): Promise<void> {
    const data = await this.state.storage.get<any>();

    if (data) {
      this.storage.config = data.config;
      this.storage.status = data.status;
      this.storage.startTime = data.startTime;
      this.storage.endTime = data.endTime;
      this.storage.assignments = new Map(data.assignments ?? []);
      this.storage.events = data.events ?? [];
      this.storage.results = data.results;
      this.storage.checkpoints = data.checkpoints ?? [];
      this.storage.version = data.version ?? 0;
    }
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/start':
          await this.start();
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/pause':
          await this.pause();
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/resume':
          await this.resume();
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/status':
          return new Response(JSON.stringify({
            status: this.storage.status,
            config: this.storage.config
          }), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/stats':
          return new Response(JSON.stringify(this.getStatistics()), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/assignments':
          return new Response(JSON.stringify(this.getAllAssignments()), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/events':
          return new Response(JSON.stringify(this.getAllEvents()), {
            headers: { 'Content-Type': 'application/json' }
          });

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
}
