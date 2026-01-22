/**
 * Type definitions for event sourcing
 */

// ============================================================================
// Event Store
// ============================================================================

export interface StoredEvent {
  streamId: string;
  streamVersion: number;
  event: unknown;
  metadata: {
    eventType: string;
    timestamp: number;
    causationId?: string;
    correlationId?: string;
    userId?: string;
  };
  commitId: string;
  committedAt: number;
}

// ============================================================================
// Stream
// ============================================================================

export interface EventStream {
  streamId: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export interface StreamState {
  exists: boolean;
  version: number;
  expectedVersion?: number;
}

// ============================================================================
// Snapshot
// ============================================================================

export interface Snapshot {
  streamId: string;
  version: number;
  state: unknown;
  metadata: {
    timestamp: number;
    schema?: string;
  };
}

export interface SnapshotConfig {
  snapshotEvery: number; // Number of events between snapshots
  compress: boolean;
  ttl: number; // Time to live in milliseconds
}

// ============================================================================
// Aggregate
// ============================================================================

export interface AggregateRoot<TState = unknown> {
  id: string;
  version: number;
  state: TState;
  uncommittedEvents: Array<{
    eventType: string;
    payload: unknown;
    metadata?: Record<string, unknown>;
  }>;

  apply(event: unknown): void;
  commit(): void;
  rollback(): void;
}

// ============================================================================
// Projection
// ============================================================================

export interface Projection<TState = unknown> {
  id: string;
  name: string;
  state: TState;
  lastProcessedEventNumber: number;
  lastProcessedAt: number;

  handle(event: StoredEvent): Promise<void>;
}

export interface QueryModel<TState = unknown> {
  read: (query: unknown) => Promise<TState[]>;
  getById: (id: string) => Promise<TState | null>;
}

// ============================================================================
// CQRS
// ============================================================================

export interface Command {
  commandId: string;
  commandType: string;
  aggregateId: string;
  payload: unknown;
  metadata: {
    timestamp: number;
    userId?: string;
    causationId?: string;
    correlationId?: string;
  };
}

export interface CommandHandler<TCommand = unknown> {
  handle(command: TCommand): Promise<void>;
}

export interface Query {
  queryId: string;
  queryType: string;
  payload: unknown;
  metadata: {
    timestamp: number;
    userId?: string;
  };
}

export interface QueryHandler<TQuery = unknown, TResult = unknown> {
  handle(query: TQuery): Promise<TResult>;
}

// ============================================================================
// Event Replay
// ============================================================================

export interface ReplayConfig {
  fromVersion?: number;
  toVersion?: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  eventTypes?: string[];
  batchSize: number;
  delayMs: number;
}

export interface ReplayStatus {
  replayId: string;
  startedAt: number;
  completedAt?: number;
  progress: number;
  total: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  error?: string;
}

// ============================================================================
// Optimistic Concurrency
// ============================================================================

export interface ConcurrencyConflict {
  expectedVersion: number;
  actualVersion: number;
  streamId: string;
  attemptNumber: number;
}

export type ConflictResolution = 'retry' | 'fail' | 'merge';
