/**
 * Event Replay implementation
 */

// @ts-nocheck - Cloudflare Workers DurableObject types not fully available
import type {
  StoredEvent,
  ReplayConfig,
  ReplayStatus,
  EventHandler,
  EventEnvelope,
} from '../types';
import { generateReplayId } from '../utils/id';

// ============================================================================
// Replay State
// ============================================================================

interface ReplayState {
  replays: Record<string, ReplayStatus>;
}

// ============================================================================
// Event Replay Durable Object
// ============================================================================

export interface EventReplayEnv {
  EVENT_STORE: DurableObjectNamespace;
  EVENT_BUS: DurableObjectNamespace;
}

export class EventReplayDurableObject implements DurableObject {
  private state: ReplayState;

  constructor(
    private durableObjectState: DurableObjectState,
    private env: EventReplayEnv
  ) {
    this.state = {
      replays: {},
    };
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const saved = await this.durableObjectState.storage.get<ReplayState>('state');

    if (saved) {
      this.state = saved;
    }
  }

  private async save(): Promise<void> {
    await this.durableObjectState.storage.put('state', this.state);
  }

  // ============================================================================
  // Start Replay
  // ============================================================================

  async startReplay(
    config: ReplayConfig & {
      targetHandler: string;
      streamId?: string;
    }
  ): Promise<string> {
    const replayId = generateReplayId();

    const status: ReplayStatus = {
      replayId,
      startedAt: Date.now(),
      progress: 0,
      total: 0,
      status: 'running',
    };

    this.state.replays[replayId] = status;
    await this.save();

    // Start replay in background
    this.executeReplay(replayId, config).catch((error) => {
      console.error(`Replay ${replayId} failed:`, error);
      status.status = 'failed';
      status.error = error.message;
      this.save();
    });

    return replayId;
  }

  private async executeReplay(
    replayId: string,
    config: ReplayConfig & {
      targetHandler: string;
      streamId?: string;
    }
  ): Promise<void> {
    const status = this.state.replays[replayId];
    if (!status) {
      throw new Error(`Replay not found: ${replayId}`);
    }

    try {
      // Get events to replay
      let events: StoredEvent[] = [];

      if (config.streamId) {
        // Replay specific stream
        const eventStoreStub = this.getEventStoreStub();
        events = await eventStoreStub.readEvents(config.streamId, {
          fromVersion: config.fromVersion,
          toVersion: config.toVersion,
        });
      } else {
        // Replay all streams (with optional filtering)
        events = await this.getAllEvents(config);
      }

      status.total = events.length;

      // Process events in batches
      const batchSize = config.batchSize;
      const delayMs = config.delayMs;

      for (let i = 0; i < events.length; i += batchSize) {
        if (status.status === 'paused') {
          break;
        }

        const batch = events.slice(i, i + batchSize);

        for (const event of batch) {
          // Apply event type filter
          if (config.eventTypes && !config.eventTypes.includes(event.metadata.eventType)) {
            continue;
          }

          // Apply time filter
          if (
            config.fromTimestamp &&
            event.metadata.timestamp < config.fromTimestamp
          ) {
            continue;
          }

          if (
            config.toTimestamp &&
            event.metadata.timestamp > config.toTimestamp
          ) {
            continue;
          }

          // Replay event
          await this.replayEvent(event, config.targetHandler);
        }

        status.progress = Math.min(i + batchSize, events.length);
        await this.save();

        // Delay between batches
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      status.completedAt = Date.now();
      status.status = 'completed';
    } catch (error) {
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : String(error);
    } finally {
      await this.save();
    }
  }

  private async getAllEvents(config: ReplayConfig): Promise<StoredEvent[]> {
    // Get all streams and read events
    const eventStoreStub = this.getEventStoreStub();
    const streamIds = await eventStoreStub.listStreams();

    const allEvents: StoredEvent[] = [];

    for (const streamId of streamIds) {
      const events = await eventStoreStub.readEvents(streamId, {
        fromVersion: config.fromVersion,
        toVersion: config.toVersion,
      });

      allEvents.push(...events);
    }

    // Sort by timestamp
    allEvents.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

    return allEvents;
  }

  private async replayEvent(event: StoredEvent, targetHandler: string): Promise<void> {
    // Convert stored event to envelope
    const envelope: EventEnvelope = {
      metadata: {
        eventId: `${event.streamId}_${event.streamVersion}`,
        eventType: event.metadata.eventType,
        timestamp: event.metadata.timestamp,
        causationId: event.metadata.causationId,
        correlationId: event.metadata.correlationId,
        version: 1,
        source: 'replay',
        userId: event.metadata.userId,
      },
      payload: event.event,
    };

    // Publish to event bus
    const eventBusStub = this.getEventBusStub();
    await eventBusStub.publish(envelope);
  }

  // ============================================================================
  // Replay Control
  // ============================================================================

  async pauseReplay(replayId: string): Promise<void> {
    const status = this.state.replays[replayId];
    if (!status) {
      throw new Error(`Replay not found: ${replayId}`);
    }

    if (status.status !== 'running') {
      throw new Error(`Cannot pause replay with status: ${status.status}`);
    }

    status.status = 'paused';
    await this.save();
  }

  async resumeReplay(replayId: string): Promise<void> {
    const status = this.state.replays[replayId];
    if (!status) {
      throw new Error(`Replay not found: ${replayId}`);
    }

    if (status.status !== 'paused') {
      throw new Error(`Cannot resume replay with status: ${status.status}`);
    }

    status.status = 'running';
    await this.save();
  }

  async cancelReplay(replayId: string): Promise<void> {
    const status = this.state.replays[replayId];
    if (!status) {
      throw new Error(`Replay not found: ${replayId}`);
    }

    status.status = 'failed';
    status.error = 'Cancelled by user';
    await this.save();
  }

  async deleteReplay(replayId: string): Promise<void> {
    delete this.state.replays[replayId];
    await this.save();
  }

  // ============================================================================
  // Replay Status
  // ============================================================================

  async getReplayStatus(replayId: string): Promise<ReplayStatus | null> {
    return this.state.replays[replayId] ?? null;
  }

  async listReplays(): Promise<ReplayStatus[]> {
    return Object.values(this.state.replays);
  }

  async getActiveReplays(): Promise<ReplayStatus[]> {
    return Object.values(this.state.replays).filter(
      (r) => r.status === 'running' || r.status === 'paused'
    );
  }

  // ============================================================================
  // Time Travel
  // ============================================================================

  async timeTravel(
    timestamp: number,
    targetHandler: string
  ): Promise<{
    eventsReplayed: number;
    newState: unknown;
  }> {
    // Get all events up to timestamp
    const config: ReplayConfig & { targetHandler: string } = {
      toTimestamp: timestamp,
      targetHandler,
      batchSize: 100,
      delayMs: 0,
    };

    const replayId = await this.startReplay(config);

    // Wait for replay to complete
    while (true) {
      const status = await this.getReplayStatus(replayId);
      if (!status) {
        throw new Error(`Replay not found: ${replayId}`);
      }

      if (status.status === 'completed') {
        return {
          eventsReplayed: status.total,
          newState: null, // Would be populated by handler
        };
      }

      if (status.status === 'failed') {
        throw new Error(`Replay failed: ${status.error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async getStateAtTime(
    streamId: string,
    timestamp: number
  ): Promise<{
    version: number;
    state: unknown;
  }> {
    const eventStoreStub = this.getEventStoreStub();

    // Get events up to timestamp
    const events = await eventStoreStub.readEvents(streamId, {
      toTimestamp: timestamp,
    });

    if (events.length === 0) {
      return {
        version: 0,
        state: null,
      };
    }

    const latestEvent = events[events.length - 1];

    return {
      version: latestEvent.streamVersion,
      state: latestEvent.event,
    };
  }

  // ============================================================================
  // Projections
  // ============================================================================

  async rebuildProjection(
    projectionId: string,
    options: {
      fromTimestamp?: number;
      toTimestamp?: number;
    } = {}
  ): Promise<string> {
    const config: ReplayConfig & {
      targetHandler: string;
    } = {
      targetHandler: `projection:${projectionId}`,
      fromTimestamp: options.fromTimestamp,
      toTimestamp: options.toTimestamp,
      batchSize: 100,
      delayMs: 0,
    };

    return this.startReplay(config);
  }

  async getProjectionState(
    projectionId: string,
    timestamp: number
  ): Promise<unknown> {
    // This would query the projection's state at a given time
    // Implementation depends on how projections store their state
    return null;
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async alarm(): Promise<void> {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Clean up old completed replays (older than 7 days)
    for (const [replayId, status] of Object.entries(this.state.replays)) {
      if (
        (status.status === 'completed' || status.status === 'failed') &&
        status.completedAt &&
        now - status.completedAt > 7 * dayMs
      ) {
        delete this.state.replays[replayId];
      }
    }

    await this.save();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getEventStoreStub(): EventStoreDurableObjectStub {
    const id = this.env.EVENT_STORE.idFromName('default');
    return this.env.EVENT_STORE.get(id);
  }

  private getEventBusStub(): EventBusDurableObjectStub {
    const id = this.env.EVENT_BUS.idFromName('default');
    return this.env.EVENT_BUS.get(id);
  }
}

// ============================================================================
// Event Replay Client
// ============================================================================

export class EventReplayClient {
  constructor(
    private namespace: DurableObjectNamespace,
    private id: DurableObjectId
  ) {}

  private getStub(): EventReplayDurableObjectStub {
    return this.namespace.get(this.id);
  }

  async startReplay(config: ReplayConfig & {
    targetHandler: string;
    streamId?: string;
  }): Promise<string> {
    return this.getStub().startReplay(config);
  }

  async pauseReplay(replayId: string): Promise<void> {
    return this.getStub().pauseReplay(replayId);
  }

  async resumeReplay(replayId: string): Promise<void> {
    return this.getStub().resumeReplay(replayId);
  }

  async cancelReplay(replayId: string): Promise<void> {
    return this.getStub().cancelReplay(replayId);
  }

  async getReplayStatus(replayId: string): Promise<ReplayStatus | null> {
    return this.getStub().getReplayStatus(replayId);
  }

  async listReplays(): Promise<ReplayStatus[]> {
    return this.getStub().listReplays();
  }

  async timeTravel(timestamp: number, targetHandler: string): Promise<{
    eventsReplayed: number;
    newState: unknown;
  }> {
    return this.getStub().timeTravel(timestamp, targetHandler);
  }

  async getStateAtTime(streamId: string, timestamp: number): Promise<{
    version: number;
    state: unknown;
  }> {
    return this.getStub().getStateAtTime(streamId, timestamp);
  }

  async rebuildProjection(projectionId: string, options?: {
    fromTimestamp?: number;
    toTimestamp?: number;
  }): Promise<string> {
    return this.getStub().rebuildProjection(projectionId, options);
  }
}

// ============================================================================
// Event Replay Factory
// ============================================================================

export class EventReplayFactory {
  constructor(private namespace: DurableObjectNamespace) {}

  create(id: string = 'default'): EventReplayClient {
    const durableObjectId = this.namespace.idFromString(id);
    return new EventReplayClient(this.namespace, durableObjectId);
  }

  createFromName(name: string): EventReplayClient {
    const durableObjectId = this.namespace.idFromName(name);
    return new EventReplayClient(this.namespace, durableObjectId);
  }
}
