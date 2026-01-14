/**
 * Event sourcing implementation with CQRS support
 * Supports event versioning, replay, snapshots, and projections
 */

import type {
  StoredEvent,
  EventStream as EventStreamType,
  StreamMetadata,
  Snapshot,
  Projection,
  CQRSCommand,
  CQRSQuery,
  StreamEvent
} from '../types/index.js';
import { generateEventId, generateStreamId, generateCommitId, generateSnapshotId } from '../utils/id-generator.js';

// ============================================================================
// Event Store
// ============================================================================

export class EventStore {
  private streams: Map<string, EventStreamData> = new Map();
  private snapshots: Map<string, Map<number, Snapshot>> = new Map();
  private projections: Map<string, Projection> = new Map();
  private eventLog: StoredEvent[] = [];

  // ========================================================================
  // Event Appending
  // ========================================================================

  /**
   * Append events to a stream
   */
  async appendToStream(
    streamId: string,
    events: Omit<StoredEvent, 'streamId' | 'streamVersion' | 'commitId' | 'committedAt'>[],
    expectedVersion?: number
  ): Promise<AppendResult> {
    const stream = this.getOrCreateStream(streamId);

    // Check expected version for optimistic concurrency
    if (expectedVersion !== undefined && stream.version !== expectedVersion) {
      return {
        success: false,
        currentVersion: stream.version,
        error: new ConcurrencyError(
          `Expected version ${expectedVersion}, but current version is ${stream.version}`
        ),
      };
    }

    const commitId = generateCommitId();
    const committedAt = Date.now();

    const storedEvents: StoredEvent[] = events.map((event, index) => ({
      ...event,
      streamId,
      streamVersion: stream.version + index + 1,
      commitId,
      committedAt,
    }));

    // Store events
    for (const event of storedEvents) {
      this.eventLog.push(event);
    }

    // Update stream
    stream.version += storedEvents.length;
    stream.metadata.updatedAt = committedAt;
    stream.events.push(...storedEvents);

    return {
      success: true,
      currentVersion: stream.version,
      commitId,
      events: storedEvents,
    };
  }

  /**
   * Append single event to a stream
   */
  async appendEvent(
    streamId: string,
    event: Omit<StoredEvent, 'streamId' | 'streamVersion' | 'commitId' | 'committedAt'>,
    expectedVersion?: number
  ): Promise<AppendResult> {
    return this.appendToStream(streamId, [event], expectedVersion);
  }

  // ========================================================================
  // Event Reading
  // ========================================================================

  /**
   * Read events from a stream
   */
  readStream(
    streamId: string,
    options: {
      fromVersion?: number;
      maxCount?: number;
    } = {}
  ): StoredEvent[] {
    const stream = this.streams.get(streamId);

    if (!stream) {
      return [];
    }

    let events = stream.events;

    if (options.fromVersion) {
      events = events.filter(e => e.streamVersion >= options.fromVersion!);
    }

    if (options.maxCount) {
      events = events.slice(0, options.maxCount);
    }

    return events;
  }

  /**
   * Read stream from specific version
   */
  readStreamFrom(streamId: string, version: number): StoredEvent[] {
    return this.readStream(streamId, { fromVersion: version });
  }

  /**
   * Read all events from all streams
   */
  readAllEvents(options: {
    fromPosition?: number;
    maxCount?: number;
  } = {}): StoredEvent[] {
    let events = this.eventLog;

    if (options.fromPosition) {
      events = events.slice(options.fromPosition);
    }

    if (options.maxCount) {
      events = events.slice(0, options.maxCount);
    }

    return events;
  }

  // ========================================================================
  // Stream Management
  // ========================================================================

  /**
   * Create a new event stream
   */
  createStream(streamId: string, type: string, metadata?: Partial<StreamMetadata>): void {
    if (this.streams.has(streamId)) {
      throw new Error(`Stream ${streamId} already exists`);
    }

    const now = Date.now();

    this.streams.set(streamId, {
      id: streamId,
      type,
      version: 0,
      events: [],
      metadata: {
        createdAt: now,
        updatedAt: now,
        ...metadata,
      },
    });
  }

  /**
   * Get or create stream
   */
  private getOrCreateStream(streamId: string, type: string = 'default'): EventStreamData {
    let stream = this.streams.get(streamId);

    if (!stream) {
      this.createStream(streamId, type);
      stream = this.streams.get(streamId)!;
    }

    return stream;
  }

  /**
   * Get stream metadata
   */
  getStreamMetadata(streamId: string): StreamMetadata | undefined {
    return this.streams.get(streamId)?.metadata;
  }

  /**
   * Delete stream
   */
  deleteStream(streamId: string): void {
    this.streams.delete(streamId);
    this.snapshots.delete(streamId);
  }

  /**
   * List all streams
   */
  listStreams(): Array<{ id: string; type: string; version: number }> {
    return Array.from(this.streams.values()).map(s => ({
      id: s.id,
      type: s.type,
      version: s.version,
    }));
  }

  // ========================================================================
  // Snapshots
  // ========================================================================

  /**
   * Create snapshot for a stream
   */
  async createSnapshot(
    streamId: string,
    version: number,
    state: unknown,
    metadata?: Record<string, unknown>
  ): Promise<Snapshot> {
    const stream = this.streams.get(streamId);

    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    if (version > stream.version) {
      throw new Error(`Snapshot version ${version} exceeds stream version ${stream.version}`);
    }

    const snapshot: Snapshot = {
      streamId,
      version,
      state,
      createdAt: Date.now(),
      metadata,
    };

    // Store snapshot
    if (!this.snapshots.has(streamId)) {
      this.snapshots.set(streamId, new Map());
    }

    this.snapshots.get(streamId)!.set(version, snapshot);

    // Update stream metadata
    stream.metadata.snapshotVersion = version;
    stream.metadata.lastSnapshotAt = snapshot.createdAt;

    return snapshot;
  }

  /**
   * Get snapshot for a stream
   */
  getSnapshot(streamId: string, version?: number): Snapshot | undefined {
    const snapshots = this.snapshots.get(streamId);

    if (!snapshots || snapshots.size === 0) {
      return undefined;
    }

    if (version) {
      return snapshots.get(version);
    }

    // Get latest snapshot
    const versions = Array.from(snapshots.keys()).sort((a, b) => b - a);
    return snapshots.get(versions[0]);
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(streamId: string): Snapshot | undefined {
    return this.getSnapshot(streamId);
  }

  /**
   * Delete snapshot
   */
  deleteSnapshot(streamId: string, version: number): boolean {
    const snapshots = this.snapshots.get(streamId);
    return snapshots ? snapshots.delete(version) : false;
  }

  // ========================================================================
  // Projections
  // ========================================================================

  /**
   * Create or update projection
   */
  async createProjection(
    id: string,
    name: string,
    handler: ProjectionHandler
  ): Promise<Projection> {
    const projection: Projection = {
      id,
      name,
      lastEventPosition: 0,
      state: null,
      updatedAt: Date.now(),
    };

    this.projections.set(id, projection);

    // Build projection from existing events
    await this.buildProjection(id, handler);

    return projection;
  }

  /**
   * Build projection from events
   */
  async buildProjection(
    projectionId: string,
    handler: ProjectionHandler
  ): Promise<void> {
    const projection = this.projections.get(projectionId);

    if (!projection) {
      throw new Error(`Projection ${projectionId} not found`);
    }

    let state = null;
    let position = 0;

    // Process events from last position
    const events = this.readAllEvents({ fromPosition: projection.lastEventPosition });

    for (const event of events) {
      state = await handler(state, event);
      position++;
    }

    // Update projection
    projection.state = state;
    projection.lastEventPosition = position;
    projection.updatedAt = Date.now();

    this.projections.set(projectionId, projection);
  }

  /**
   * Update projection incrementally
   */
  async updateProjection(
    projectionId: string,
    handler: ProjectionHandler
  ): Promise<void> {
    await this.buildProjection(projectionId, handler);
  }

  /**
   * Get projection
   */
  getProjection(projectionId: string): Projection | undefined {
    return this.projections.get(projectionId);
  }

  /**
   * Get all projections
   */
  getProjections(): Projection[] {
    return Array.from(this.projections.values());
  }

  /**
   * Delete projection
   */
  deleteProjection(projectionId: string): boolean {
    return this.projections.delete(projectionId);
  }

  // ========================================================================
  // Event Replay
  // ========================================================================

  /**
   * Replay events from a stream
   */
  async replayStream(
    streamId: string,
    handler: (event: StoredEvent) => Promise<void>,
    options: {
      fromVersion?: number;
      toVersion?: number;
    } = {}
  ): Promise<void> {
    let events = this.readStream(streamId);

    if (options.fromVersion) {
      events = events.filter(e => e.streamVersion >= options.fromVersion!);
    }

    if (options.toVersion) {
      events = events.filter(e => e.streamVersion <= options.toVersion!);
    }

    for (const event of events) {
      await handler(event);
    }
  }

  /**
   * Replay all events
   */
  async replayAllEvents(
    handler: (event: StoredEvent) => Promise<void>,
    options: {
      fromPosition?: number;
      toPosition?: number;
    } = {}
  ): Promise<void> {
    let events = this.readAllEvents();

    if (options.fromPosition) {
      events = events.slice(options.fromPosition);
    }

    if (options.toPosition) {
      events = events.slice(0, options.toPosition);
    }

    for (const event of events) {
      await handler(event);
    }
  }

  // ========================================================================
  // Event Compaction
  // ========================================================================

  /**
   * Compact a stream by replacing events with snapshot
   */
  async compactStream(
    streamId: string,
    compactionHandler: (events: StoredEvent[]) => unknown
  ): Promise<Snapshot> {
    const events = this.readStream(streamId);
    const state = await compactionHandler(events);
    const version = events.length;

    // Create snapshot
    const snapshot = await this.createSnapshot(streamId, version, state);

    // Remove old events
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.events = [events[events.length - 1]];
    }

    return snapshot;
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get event store statistics
   */
  getStats(): EventStoreStats {
    return {
      totalStreams: this.streams.size,
      totalEvents: this.eventLog.length,
      totalSnapshots: Array.from(this.snapshots.values()).reduce(
        (sum, snaps) => sum + snaps.size,
        0
      ),
      totalProjections: this.projections.size,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.streams.clear();
    this.snapshots.clear();
    this.projections.clear();
    this.eventLog = [];
  }
}

// ============================================================================
// CQRS Implementation
// ============================================================================

export class CQRS {
  private eventStore: EventStore;
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private queryHandlers: Map<string, QueryHandler> = new Map();

  constructor(eventStore?: EventStore) {
    this.eventStore = eventStore ?? new EventStore();
  }

  // ========================================================================
  // Command Handling
  // ========================================================================

  /**
   * Register command handler
   */
  registerCommand(commandType: string, handler: CommandHandler): void {
    this.commandHandlers.set(commandType, handler);
  }

  /**
   * Execute command
   */
  async executeCommand(
    command: CQRSCommand,
    options: {
      expectedVersion?: number;
    } = {}
  ): Promise<CommandResult> {
    const handler = this.commandHandlers.get(command.commandType);

    if (!handler) {
      return {
        success: false,
        error: new Error(`No handler registered for command type: ${command.commandType}`),
      };
    }

    try {
      const result = await handler(
        command.payload,
        this.eventStore,
        command.expectedVersion
      );

      return {
        success: true,
        events: result.events,
        state: result.state,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  // ========================================================================
  // Query Handling
  // ========================================================================

  /**
   * Register query handler
   */
  registerQuery(queryType: string, handler: QueryHandler): void {
    this.queryHandlers.set(queryType, handler);
  }

  /**
   * Execute query
   */
  async executeQuery<T = unknown>(query: CQRSQuery): Promise<QueryResult<T>> {
    const handler = this.queryHandlers.get(query.queryType);

    if (!handler) {
      return {
        success: false,
        error: new Error(`No handler registered for query type: ${query.queryType}`),
      };
    }

    try {
      const result = await handler(query.parameters, this.eventStore);
      return {
        success: true,
        data: result as T,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  // ========================================================================
  // Accessors
  // ========================================================================

  /**
   * Get event store
   */
  getEventStore(): EventStore {
    return this.eventStore;
  }
}

// ============================================================================
// Types
// ============================================================================

interface EventStreamData {
  id: string;
  type: string;
  version: number;
  events: StoredEvent[];
  metadata: StreamMetadata;
}

export interface AppendResult {
  success: boolean;
  currentVersion?: number;
  commitId?: string;
  events?: StoredEvent[];
  error?: Error;
}

export interface CommandResult {
  success: boolean;
  events?: StoredEvent[];
  state?: unknown;
  error?: Error;
}

export interface QueryResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}

export interface EventStoreStats {
  totalStreams: number;
  totalEvents: number;
  totalSnapshots: number;
  totalProjections: number;
}

export type ProjectionHandler = (
  state: unknown,
  event: StoredEvent
) => Promise<unknown>;

export type CommandHandler = (
  payload: unknown,
  eventStore: EventStore,
  expectedVersion?: number
) => Promise<{ events: StoredEvent[]; state?: unknown }>;

export type QueryHandler = (
  parameters: Record<string, unknown>,
  eventStore: EventStore
) => Promise<unknown>;

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create event store with default configuration
 */
export function createEventStore(): EventStore {
  return new EventStore();
}

/**
 * Create CQRS instance with default configuration
 */
export function createCQRS(eventStore?: EventStore): CQRS {
  return new CQRS(eventStore);
}
