/**
 * Allocation Durable Object - Manages user assignments with
 * strong consistency using Cloudflare Workers Durable Objects
 */

import type {
  Assignment,
  ExperimentConfig,
  UserId,
  VariantId
} from '../types/experiment.js';
import { AllocationError } from '../types/errors.js';

/**
 * Allocation state storage
 */
export interface AllocationStorage {
  /** All assignments */
  assignments: Map<string, Assignment>;
  /** Assignment counters per variant */
  counters: Map<string, number>;
  /** Version for optimistic locking */
  version: number;
}

/**
 * Allocation Durable Object
 */
export class AllocationDurableObject {
  private state: DurableObjectState;
  private storage: AllocationStorage;
  private env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.storage = {
      assignments: new Map(),
      counters: new Map(),
      version: 0
    };
  }

  /**
   * Initialize with experiment config
   */
  async init(config: ExperimentConfig): Promise<void> {
    // Initialize counters for all variants
    for (const variant of config.variants) {
      this.storage.counters.set(variant.id, 0);
    }

    await this.persist();
  }

  /**
   * Allocate a user to a variant
   */
  async allocate(
    userId: UserId,
    experimentId: string,
    variantId: VariantId,
    metadata?: Record<string, unknown>
  ): Promise<Assignment> {
    const key = `${experimentId}:${userId}`;

    // Check if already assigned
    if (this.storage.assignments.has(key)) {
      const existing = this.storage.assignments.get(key)!;
      if (existing.variantId !== variantId) {
        throw new AllocationError(userId, experimentId, 'User already assigned to different variant');
      }
      return existing;
    }

    // Create assignment
    const assignment: Assignment = {
      experimentId,
      variantId,
      userId,
      assignedAt: Date.now(),
      metadata
    };

    // Store assignment
    this.storage.assignments.set(key, assignment);

    // Update counter
    const counter = this.storage.counters.get(variantId) ?? 0;
    this.storage.counters.set(variantId, counter + 1);

    this.storage.version++;

    await this.persist();

    return assignment;
  }

  /**
   * Get assignment for a user
   */
  getAssignment(userId: UserId, experimentId: string): Assignment | null {
    const key = `${experimentId}:${userId}`;
    return this.storage.assignments.get(key) ?? null;
  }

  /**
   * Get all assignments for an experiment
   */
  getExperimentAssignments(experimentId: string): Assignment[] {
    const prefix = `${experimentId}:`;
    const assignments: Assignment[] = [];

    for (const [key, assignment] of this.storage.assignments.entries()) {
      if (key.startsWith(prefix)) {
        assignments.push(assignment);
      }
    }

    return assignments;
  }

  /**
   * Get assignment counts per variant
   */
  getCounts(experimentId: string): Map<string, number> {
    const counts = new Map<string, number>();
    const prefix = `${experimentId}:`;

    for (const [key, assignment] of this.storage.assignments.entries()) {
      if (key.startsWith(prefix)) {
        const count = counts.get(assignment.variantId) ?? 0;
        counts.set(assignment.variantId, count + 1);
      }
    }

    return counts;
  }

  /**
   * Reassign a user (with validation)
   */
  async reassign(
    userId: UserId,
    experimentId: string,
    newVariantId: VariantId,
    reason: string,
    metadata?: Record<string, unknown>
  ): Promise<Assignment> {
    const key = `${experimentId}:${userId}`;

    const existing = this.storage.assignments.get(key);
    if (!existing) {
      throw new AllocationError(userId, experimentId, 'User not assigned');
    }

    // Update old counter
    const oldCounter = this.storage.counters.get(existing.variantId) ?? 0;
    this.storage.counters.set(existing.variantId, Math.max(0, oldCounter - 1));

    // Create new assignment
    const newAssignment: Assignment = {
      experimentId,
      variantId: newVariantId,
      userId,
      assignedAt: Date.now(),
      metadata: {
        ...metadata,
        reassignment: {
          from: existing.variantId,
          to: newVariantId,
          reason,
          timestamp: Date.now()
        }
      }
    };

    this.storage.assignments.set(key, newAssignment);

    // Update new counter
    const newCounter = this.storage.counters.get(newVariantId) ?? 0;
    this.storage.counters.set(newVariantId, newCounter + 1);

    this.storage.version++;

    await this.persist();

    return newAssignment;
  }

  /**
   * Remove assignment
   */
  async removeAssignment(userId: UserId, experimentId: string): Promise<boolean> {
    const key = `${experimentId}:${userId}`;

    const assignment = this.storage.assignments.get(key);
    if (!assignment) {
      return false;
    }

    // Update counter
    const counter = this.storage.counters.get(assignment.variantId) ?? 0;
    this.storage.counters.set(assignment.variantId, Math.max(0, counter - 1));

    // Remove assignment
    this.storage.assignments.delete(key);
    this.storage.version++;

    await this.persist();

    return true;
  }

  /**
   * Get statistics
   */
  getStatistics(experimentId: string): {
    totalAssignments: number;
    countsPerVariant: Map<string, number>;
    assignments: Assignment[];
  } {
    const assignments = this.getExperimentAssignments(experimentId);
    const counts = this.getCounts(experimentId);

    return {
      totalAssignments: assignments.length,
      countsPerVariant: counts,
      assignments
    };
  }

  /**
   * Clear all assignments for an experiment
   */
  async clearExperiment(experimentId: string): Promise<void> {
    const prefix = `${experimentId}:`;

    for (const key of this.storage.assignments.keys()) {
      if (key.startsWith(prefix)) {
        this.storage.assignments.delete(key);
      }
    }

    // Reset counters
    for (const variantId of this.storage.counters.keys()) {
      this.storage.counters.set(variantId, 0);
    }

    this.storage.version++;

    await this.persist();
  }

  /**
   * Bulk assign users
   */
  async bulkAllocate(
    allocations: Array<{
      userId: UserId;
      experimentId: string;
      variantId: VariantId;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<Map<UserId, Assignment>> {
    const results = new Map<UserId, Assignment>();

    for (const alloc of allocations) {
      try {
        const assignment = await this.allocate(
          alloc.userId,
          alloc.experimentId,
          alloc.variantId,
          alloc.metadata
        );
        results.set(alloc.userId, assignment);
      } catch (error) {
        // Continue with other allocations
        console.error(`Failed to allocate ${alloc.userId}:`, error);
      }
    }

    return results;
  }

  /**
   * Persist state to storage
   */
  private async persist(): Promise<void> {
    await this.state.storage.put({
      assignments: Array.from(this.storage.assignments.entries()),
      counters: Array.from(this.storage.counters.entries()),
      version: this.storage.version
    });
  }

  /**
   * Load state from storage
   */
  async load(): Promise<void> {
    const data = await this.state.storage.get<any>();

    if (data) {
      this.storage.assignments = new Map(data.assignments ?? []);
      this.storage.counters = new Map(data.counters ?? []);
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
      if (request.method === 'GET') {
        if (path.startsWith('/assignment/')) {
          const parts = path.split('/');
          const experimentId = parts[2];
          const userId = parts[3];

          const assignment = this.getAssignment(userId, experimentId);

          return new Response(
            JSON.stringify({ assignment }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (path.startsWith('/stats/')) {
          const experimentId = path.split('/')[2];

          return new Response(
            JSON.stringify(this.getStatistics(experimentId)),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      if (request.method === 'POST') {
        if (path === '/allocate') {
          const body = await request.json() as {
            userId: UserId;
            experimentId: string;
            variantId: VariantId;
            metadata?: Record<string, unknown>;
          };

          const assignment = await this.allocate(
            body.userId,
            body.experimentId,
            body.variantId,
            body.metadata
          );

          return new Response(
            JSON.stringify({ assignment }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (path === '/bulk-allocate') {
          const body = await request.json() as {
            allocations: Array<{
              userId: UserId;
              experimentId: string;
              variantId: VariantId;
              metadata?: Record<string, unknown>;
            }>;
          };

          const results = await this.bulkAllocate(body.allocations);

          return new Response(
            JSON.stringify({
              assignments: Array.from(results.entries())
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response('Not found', { status: 404 });
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
