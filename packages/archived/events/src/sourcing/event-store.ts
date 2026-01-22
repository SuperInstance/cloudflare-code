/**
 * Event Store implementation with R2 and Durable Objects
 */

// @ts-nocheck - Cloudflare Workers DurableObject types not fully available
import type {
  StoredEvent,
  EventStream,
  StreamState,
  Snapshot,
  SnapshotConfig,
} from '../types';
import { generateStreamId, generateCommitId, generateSnapshotId } from '../utils/id';
import { R2EventStorage } from '../storage/r2-storage';

// ============================================================================
// Event Store Durable Object
// ============================================================================

export interface EventStoreEnv {
  R2_BUCKET: R2Bucket;
}

export class EventStoreDurableObject implements DurableObject {
  private r2Storage: R2EventStorage;

  constructor(
    private state: DurableObjectState,
    private env: EventStoreEnv
  ) {
    this.r2Storage = new R2EventStorage({ bucket: env.R2_BUCKET, prefix: 'event-store' });
  }

  // ============================================================================
  // Stream Management
  // ============================================================================

  async createStream(streamId: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const existing = await this.getStream(streamId);
    if (existing.exists) {
      throw new Error(`Stream already exists: ${streamId}`);
    }

    const stream: EventStream = {
      streamId,
      version: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata,
    };

    await this.state.storage.put(`stream:${streamId}`, stream);
  }

  async getStream(streamId: string): Promise<StreamState> {
    const stream = await this.state.storage.get<EventStream>(`stream:${streamId}`);

    if (!stream) {
      return {
        exists: false,
        version: 0,
      };
    }

    return {
      exists: true,
      version: stream.version,
    };
  }

  async deleteStream(streamId: string): Promise<void> {
    await this.state.storage.delete(`stream:${streamId}`);
  }

  // ============================================================================
  // Event Appending
  // ============================================================================

  async appendEvents(
    streamId: string,
    events: Array<{
      eventType: string;
      payload: unknown;
      metadata?: Record<string, unknown>;
    }>,
    expectedVersion?: number
  ): Promise<string> {
    // Check stream exists
    const streamState = await this.getStream(streamId);
    if (!streamState.exists) {
      throw new Error(`Stream does not exist: ${streamId}`);
    }

    // Check version for optimistic concurrency
    if (expectedVersion !== undefined && streamState.version !== expectedVersion) {
      throw new Error(
        `Concurrency conflict: expected version ${expectedVersion}, got ${streamState.version}`
      );
    }

    // Get stream
    const stream = (await this.state.storage.get<EventStream>(`stream:${streamId}`))!;

    // Prepare events
    const commitId = generateCommitId();
    const committedAt = Date.now();
    const storedEvents: StoredEvent[] = [];

    for (const event of events) {
      const storedEvent: StoredEvent = {
        streamId,
        streamVersion: stream.version + 1,
        event: event.payload,
        metadata: {
          eventType: event.eventType,
          timestamp: Date.now(),
          causationId: event.metadata?.causationId as string | undefined,
          correlationId: event.metadata?.correlationId as string | undefined,
          userId: event.metadata?.userId as string | undefined,
        },
        commitId,
        committedAt,
      };

      storedEvents.push(storedEvent);

      // Store in R2
      await this.r2Storage.storeEvent({
        metadata: {
          eventId: `${streamId}_${stream.version + 1}`,
          eventType: event.eventType,
          timestamp: storedEvent.metadata.timestamp,
          causationId: storedEvent.metadata.causationId,
          correlationId: storedEvent.metadata.correlationId,
          version: 1,
          source: streamId,
          userId: storedEvent.metadata.userId,
        },
        payload: event.payload,
      });

      stream.version++;
    }

    // Update stream
    stream.updatedAt = committedAt;
    await this.state.storage.put(`stream:${streamId}`, stream);

    // Store commit metadata
    await this.state.storage.put(`commit:${commitId}`, {
      streamId,
      eventCount: events.length,
      committedAt,
    });

    return commitId;
  }

  async appendEvent(
    streamId: string,
    eventType: string,
    payload: unknown,
    expectedVersion?: number
  ): Promise<string> {
    return this.appendEvents(
      streamId,
      [{ eventType, payload }],
      expectedVersion
    );
  }

  // ============================================================================
  // Event Reading
  // ============================================================================

  async readEvents(
    streamId: string,
    options: {
      fromVersion?: number;
      toVersion?: number;
      limit?: number;
    } = {}
  ): Promise<StoredEvent[]> {
    const stream = await this.getStream(streamId);
    if (!stream.exists) {
      return [];
    }

    const fromVersion = options.fromVersion ?? 1;
    const toVersion = options.toVersion ?? stream.version;
    const limit = options.limit ?? toVersion - fromVersion + 1;

    const events: StoredEvent[] = [];

    for (let version = fromVersion; version <= toVersion && events.length < limit; version++) {
      const eventId = `${streamId}_${version}`;
      const event = await this.r2Storage.getEvent(eventId);

      if (event) {
        events.push({
          streamId,
          streamVersion: version,
          event: event.payload,
          metadata: {
            eventType: event.metadata.eventType,
            timestamp: event.metadata.timestamp,
            causationId: event.metadata.causationId,
            correlationId: event.metadata.correlationId,
            userId: event.metadata.userId,
          },
          commitId: event.metadata.eventId,
          committedAt: event.metadata.timestamp,
        });
      }
    }

    return events;
  }

  async readEvent(streamId: string, version: number): Promise<StoredEvent | null> {
    const events = await this.readEvents(streamId, {
      fromVersion: version,
      toVersion: version,
    });
    return events[0] ?? null;
  }

  async readAllEvents(
    options: {
      fromTimestamp?: number;
      toTimestamp?: number;
      limit?: number;
    } = {}
  ): Promise<StoredEvent[]> {
    // This would typically scan all streams
    // For now, return empty - implement based on your indexing strategy
    return [];
  }

  // ============================================================================
  // Snapshot Management
  // ============================================================================

  async createSnapshot(
    streamId: string,
    state: unknown,
    config?: Partial<SnapshotConfig>
  ): Promise<void> {
    const streamState = await this.getStream(streamId);
    if (!streamState.exists) {
      throw new Error(`Stream does not exist: ${streamId}`);
    }

    const snapshot: Snapshot = {
      streamId,
      version: streamState.version,
      state,
      metadata: {
        timestamp: Date.now(),
      },
    };

    await this.r2Storage.storeSnapshot(snapshot);

    // Update snapshot tracking
    const snapshotKey = generateSnapshotId(streamId, streamState.version);
    await this.state.storage.put(`snapshot:${streamId}:${snapshotKey}`, {
      version: streamState.version,
      timestamp: Date.now(),
    });
  }

  async getLatestSnapshot(streamId: string): Promise<Snapshot | null> {
    return this.r2Storage.getLatestSnapshot(streamId);
  }

  async getSnapshot(streamId: string, version: number): Promise<Snapshot | null> {
    return this.r2Storage.getSnapshot(streamId, version);
  }

  async listSnapshots(streamId: string): Promise<number[]> {
    const prefix = `snapshot:${streamId}:`;
    const keys = await this.state.storage.list({ prefix });
    const versions: number[] = [];

    for (const key of keys.keys) {
      const match = key.name.match(/snapshot:[^:]+:.*_v(\d+)$/);
      if (match) {
        versions.push(parseInt(match[1], 10));
      }
    }

    return versions.sort((a, b) => b - a);
  }

  async deleteOldSnapshots(
    streamId: string,
    keepLatest: number = 1
  ): Promise<number> {
    return this.r2Storage.deleteOldSnapshots(streamId, keepLatest);
  }

  // ============================================================================
  // Stream Metadata
  // ============================================================================

  async getStreamMetadata(streamId: string): Promise<Record<string, unknown> | null> {
    const stream = await this.state.storage.get<EventStream>(`stream:${streamId}`);
    return stream?.metadata ?? null;
  }

  async updateStreamMetadata(
    streamId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const stream = await this.state.storage.get<EventStream>(`stream:${streamId}`);
    if (!stream) {
      throw new Error(`Stream does not exist: ${streamId}`);
    }

    stream.metadata = { ...stream.metadata, ...metadata };
    stream.updatedAt = Date.now();
    await this.state.storage.put(`stream:${streamId}`, stream);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getStreamStats(streamId: string): Promise<{
    exists: boolean;
    version: number;
    eventCount: number;
    createdAt: number;
    updatedAt: number;
  } | null> {
    const stream = await this.state.storage.get<EventStream>(`stream:${streamId}`);
    if (!stream) {
      return null;
    }

    return {
      exists: true,
      version: stream.version,
      eventCount: stream.version,
      createdAt: stream.createdAt,
      updatedAt: stream.updatedAt,
    };
  }

  async listStreams(): Promise<string[]> {
    const keys = await this.state.storage.list({ prefix: 'stream:' });
    return keys.keys.map((key) => key.name.substring('stream:'.length));
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async alarm(): Promise<void> {
    // Periodic cleanup tasks
    const streams = await this.listStreams();

    for (const streamId of streams) {
      // Delete old snapshots (keep latest 5)
      await this.deleteOldSnapshots(streamId, 5);
    }
  }
}

// ============================================================================
// Event Store Client
// ============================================================================

export class EventStoreClient {
  constructor(
    private namespace: DurableObjectNamespace,
    private id: DurableObjectId
  ) {}

  private getStub(): EventStoreDurableObjectStub {
    return this.namespace.get(this.id);
  }

  async createStream(streamId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.getStub().createStream(streamId, metadata);
  }

  async getStream(streamId: string): Promise<StreamState> {
    return this.getStub().getStream(streamId);
  }

  async appendEvents(
    streamId: string,
    events: Array<{
      eventType: string;
      payload: unknown;
      metadata?: Record<string, unknown>;
    }>,
    expectedVersion?: number
  ): Promise<string> {
    return this.getStub().appendEvents(streamId, events, expectedVersion);
  }

  async appendEvent(
    streamId: string,
    eventType: string,
    payload: unknown,
    expectedVersion?: number
  ): Promise<string> {
    return this.getStub().appendEvent(streamId, eventType, payload, expectedVersion);
  }

  async readEvents(
    streamId: string,
    options?: { fromVersion?: number; toVersion?: number; limit?: number }
  ): Promise<StoredEvent[]> {
    return this.getStub().readEvents(streamId, options);
  }

  async readEvent(streamId: string, version: number): Promise<StoredEvent | null> {
    return this.getStub().readEvent(streamId, version);
  }

  async createSnapshot(streamId: string, state: unknown): Promise<void> {
    await this.getStub().createSnapshot(streamId, state);
  }

  async getLatestSnapshot(streamId: string): Promise<Snapshot | null> {
    return this.getStub().getLatestSnapshot(streamId);
  }

  async getStreamStats(streamId: string): Promise<{
    exists: boolean;
    version: number;
    eventCount: number;
    createdAt: number;
    updatedAt: number;
  } | null> {
    return this.getStub().getStreamStats(streamId);
  }

  async listStreams(): Promise<string[]> {
    return this.getStub().listStreams();
  }
}

// ============================================================================
// Event Store Factory
// ============================================================================

export class EventStoreFactory {
  constructor(private namespace: DurableObjectNamespace) {}

  create(id: string = 'default'): EventStoreClient {
    const durableObjectId = this.namespace.idFromString(id);
    return new EventStoreClient(this.namespace, durableObjectId);
  }

  createFromName(name: string): EventStoreClient {
    const durableObjectId = this.namespace.idFromName(name);
    return new EventStoreClient(this.namespace, durableObjectId);
  }
}
