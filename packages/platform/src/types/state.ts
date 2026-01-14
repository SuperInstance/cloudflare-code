/**
 * State Types
 *
 * Type definitions for shared state management.
 */

/**
 * State value with metadata
 */
export interface StateValue<T = unknown> {
  readonly value: T;
  readonly version: number;
  readonly created: number;
  readonly updated: number;
  readonly ttl?: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * State transaction
 */
export interface StateTransaction {
  readonly id: string;
  readonly startTime: number;
  readonly operations: ReadonlyArray<StateOperation>;
  readonly committed: boolean;
  readonly rolledBack: boolean;

  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * State operation
 */
export interface StateOperation {
  readonly type: 'set' | 'delete' | 'clear';
  readonly key: string;
  readonly value?: unknown;
  readonly previousValue?: unknown;
}

/**
 * State snapshot
 */
export interface StateSnapshot {
  readonly timestamp: number;
  readonly version: number;
  readonly state: Record<string, unknown>;
}

/**
 * State diff
 */
export interface StateDiff {
  readonly added: ReadonlyArray<{ key: string; value: unknown }>;
  readonly modified: ReadonlyArray<{
    key: string;
    previousValue: unknown;
    currentValue: unknown;
  }>;
  readonly deleted: ReadonlyArray<{ key: string; value: unknown }>;
}

/**
 * State sync options
 */
export interface StateSyncOptions {
  readonly conflictResolution: 'last-write-wins' | 'first-write-wins' | 'merge' | 'error';
  readonly syncInterval: number;
  readonly batchSize: number;
  readonly compression: boolean;
}
