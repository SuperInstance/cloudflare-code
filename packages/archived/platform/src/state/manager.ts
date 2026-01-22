// @ts-nocheck
/**
 * Shared State Manager
 *
 * Distributed state management with synchronization, transactions, and event emission.
 */

import type {
  StateManager as IStateManager,
  StateScope,
  StateValue,
  StateTransaction,
  StateOperation,
  StateSnapshot,
  StateDiff,
  StateSyncOptions,
} from '../types/state';

import type { EventBus } from '../types/core';

/**
 * State manager implementation
 */
export class StateManager implements IStateManager {
  private state: Map<string, StateValue>;
  private scopes: Map<string, StateScopeImpl>;
  private transactions: Map<string, StateTransactionImpl>;
  private eventBus?: EventBus;
  private listeners: Map<string, Set<(value: unknown) => void>>;
  private deleteListeners: Set<(key: string, value: unknown) => void>;
  private disposed: boolean;

  constructor(eventBus?: EventBus) {
    this.state = new Map();
    this.scopes = new Map();
    this.transactions = new Map();
    this.eventBus = eventBus;
    this.listeners = new Map();
    this.deleteListeners = new Set();
    this.disposed = false;
  }

  /**
   * Get a value from state
   */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    this.assertNotDisposed();

    const entry = this.state.get(key);

    if (!entry) {
      return undefined;
    }

    // Check TTL
    if (entry.ttl && Date.now() > entry.ttl) {
      await this.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Set a value in state
   */
  async set<T = unknown>(
    key: string,
    value: T,
    options: StateOptions = {}
  ): Promise<void> {
    this.assertNotDisposed();

    const now = Date.now();
    const existing = this.state.get(key);

    const entry: StateValue = {
      value,
      version: existing ? existing.version + 1 : 1,
      created: existing?.created || now,
      updated: now,
      ttl: options.ttl ? now + options.ttl : undefined,
      metadata: options.metadata || {},
    };

    this.state.set(key, entry);

    // Notify listeners
    const listeners = this.listeners.get(key);
    if (listeners) {
      for (const listener of listeners) {
        try {
          await listener(value);
        } catch (error) {
          console.error('Error in state change listener:', error);
        }
      }
    }

    // Emit event
    if (this.eventBus) {
      await this.eventBus.publish('state:changed', {
        key,
        previousValue: existing?.value,
        currentValue: value,
        timestamp: now,
      });
    }
  }

  /**
   * Delete a value from state
   */
  async delete(key: string): Promise<void> {
    this.assertNotDisposed();

    const entry = this.state.get(key);

    if (entry) {
      this.state.delete(key);

      // Notify delete listeners
      for (const listener of this.deleteListeners) {
        try {
          await listener(key, entry.value);
        } catch (error) {
          console.error('Error in state delete listener:', error);
        }
      }

      // Emit event
      if (this.eventBus) {
        await this.eventBus.publish('state:deleted', {
          key,
          value: entry.value,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    this.assertNotDisposed();

    const entry = this.state.get(key);

    if (!entry) {
      return false;
    }

    // Check TTL
    if (entry.ttl && Date.now() > entry.ttl) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all state
   */
  async clear(): Promise<void> {
    this.assertNotDisposed();

    const count = this.state.size;
    this.state.clear();

    // Emit event
    if (this.eventBus) {
      await this.eventBus.publish('state:cleared', {
        count,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get a scoped state manager
   */
  getScope(namespace: string): StateScope {
    this.assertNotDisposed();

    let scope = this.scopes.get(namespace);

    if (!scope) {
      scope = new StateScopeImpl(namespace, this);
      this.scopes.set(namespace, scope);
    }

    return scope;
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (state: StateManager) => Promise<T>
  ): Promise<T> {
    this.assertNotDisposed();

    const transactionId = `txn-${Date.now()}-${Math.random()}`;
    const transaction = new StateTransactionImpl(transactionId, this);

    this.transactions.set(transactionId, transaction);

    try {
      const result = await callback(this);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      this.transactions.delete(transactionId);
    }
  }

  /**
   * Create a snapshot of current state
   */
  async createSnapshot(): Promise<StateSnapshot> {
    this.assertNotDisposed();

    return {
      timestamp: Date.now(),
      version: this.getGlobalVersion(),
      state: Object.fromEntries(
        Array.from(this.state.entries()).map(([key, entry]) => [
          key,
          entry.value,
        ])
      ),
    };
  }

  /**
   * Restore a snapshot
   */
  async restoreSnapshot(snapshot: StateSnapshot): Promise<void> {
    this.assertNotDisposed();

    this.state.clear();

    const now = Date.now();

    for (const [key, value] of Object.entries(snapshot.state)) {
      this.state.set(key, {
        value,
        version: 1,
        created: now,
        updated: now,
        metadata: {},
      });
    }
  }

  /**
   * Compute diff between snapshots
   */
  computeDiff(previous: StateSnapshot, current: StateSnapshot): StateDiff {
    const prevKeys = new Set(Object.keys(previous.state));
    const currKeys = new Set(Object.keys(current.state));

    const added: Array<{ key: string; value: unknown }> = [];
    const modified: Array<{
      key: string;
      previousValue: unknown;
      currentValue: unknown;
    }> = [];
    const deleted: Array<{ key: string; value: unknown }> = [];

    // Find added and modified
    for (const key of currKeys) {
      if (!prevKeys.has(key)) {
        added.push({ key, value: current.state[key] });
      } else if (previous.state[key] !== current.state[key]) {
        modified.push({
          key,
          previousValue: previous.state[key],
          currentValue: current.state[key],
        });
      }
    }

    // Find deleted
    for (const key of prevKeys) {
      if (!currKeys.has(key)) {
        deleted.push({ key, value: previous.state[key] });
      }
    }

    return { added, modified, deleted };
  }

  /**
   * Subscribe to state changes
   */
  on(
    event: 'change' | 'delete',
    handler: (key: string, value: unknown) => void
  ): void {
    if (event === 'change') {
      // Global handler for all changes
      // (Implementation would need to track all keys)
    } else if (event === 'delete') {
      this.deleteListeners.add(handler);
    }
  }

  /**
   * Unsubscribe from state events
   */
  off(
    event: 'change' | 'delete',
    handler: (key: string, value: unknown) => void
  ): void {
    if (event === 'delete') {
      this.deleteListeners.delete(handler);
    }
  }

  /**
   * Subscribe to specific key changes
   */
  subscribe(key: string, handler: (value: unknown) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    this.listeners.get(key)!.add(handler);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(handler);
        if (listeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Dispose of state manager
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Clear all state
    this.state.clear();

    // Clear scopes
    this.scopes.clear();

    // Clear transactions
    this.transactions.clear();

    // Clear listeners
    this.listeners.clear();
    this.deleteListeners.clear();
  }

  private getGlobalVersion(): number {
    let maxVersion = 0;

    for (const entry of this.state.values()) {
      if (entry.version > maxVersion) {
        maxVersion = entry.version;
      }
    }

    return maxVersion;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('StateManager has been disposed');
    }
  }
}

/**
 * State scope implementation
 */
class StateScopeImpl implements StateScope {
  readonly namespace: string;
  private manager: StateManager;
  private prefix: string;

  constructor(namespace: string, manager: StateManager) {
    this.namespace = namespace;
    this.manager = manager;
    this.prefix = `${namespace}:`;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.manager.get<T>(this.prefix + key);
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    return this.manager.set(this.prefix + key, value);
  }

  async delete(key: string): Promise<void> {
    return this.manager.delete(this.prefix + key);
  }

  async has(key: string): Promise<boolean> {
    return this.manager.has(this.prefix + key);
  }

  async clear(): Promise<void> {
    // Clear all keys in this scope
    // (Implementation would need to track keys per scope)
  }
}

/**
 * State transaction implementation
 */
class StateTransactionImpl implements StateTransaction {
  readonly id: string;
  readonly startTime: number;
  private operations: StateOperation[] = [];
  private manager: StateManager;
  private committed = false;
  private rolledBack = false;

  constructor(id: string, manager: StateManager) {
    this.id = id;
    this.startTime = Date.now();
    this.manager = manager;
  }

  get operations(): readonly StateOperation[] {
    return this.operations;
  }

  get committed(): boolean {
    return this.committed;
  }

  get rolledBack(): boolean {
    return this.rolledBack;
  }

  async commit(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already finalized');
    }

    // Apply all operations
    for (const op of this.operations) {
      if (op.type === 'set') {
        await this.manager.set(op.key, op.value);
      } else if (op.type === 'delete') {
        await this.manager.delete(op.key);
      }
    }

    this.committed = true;
  }

  async rollback(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already finalized');
    }

    this.operations = [];
    this.rolledBack = true;
  }

  /**
   * Add a set operation
   */
  set<T = unknown>(key: string, value: T): void {
    this.operations.push({
      type: 'set',
      key,
      value,
    });
  }

  /**
   * Add a delete operation
   */
  delete(key: string): void {
    this.operations.push({
      type: 'delete',
      key,
    });
  }
}

/**
 * State options
 */
interface StateOptions {
  readonly ttl?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Distributed state manager with synchronization
 */
export class DistributedStateManager extends StateManager {
  private syncOptions: StateSyncOptions;
  private syncInterval?: ReturnType<typeof setInterval>;
  private remoteStates: Map<string, StateManager>;

  constructor(
    eventBus?: EventBus,
    syncOptions: Partial<StateSyncOptions> = {}
  ) {
    super(eventBus);

    this.syncOptions = {
      conflictResolution: 'last-write-wins',
      syncInterval: 10000,
      batchSize: 100,
      compression: false,
      ...syncOptions,
    };

    this.remoteStates = new Map();
  }

  /**
   * Add a remote state manager
   */
  addRemote(id: string, state: StateManager): void {
    this.remoteStates.set(id, state);
  }

  /**
   * Remove a remote state manager
   */
  removeRemote(id: string): void {
    this.remoteStates.delete(id);
  }

  /**
   * Start automatic synchronization
   */
  startSync(): void {
    if (this.syncInterval) {
      return;
    }

    this.syncInterval = setInterval(
      () => this.sync(),
      this.syncOptions.syncInterval
    );
  }

  /**
   * Stop automatic synchronization
   */
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  /**
   * Synchronize with remote states
   */
  async sync(): Promise<void> {
    const localSnapshot = await this.createSnapshot();

    for (const [id, remote] of this.remoteStates.entries()) {
      try {
        const remoteSnapshot = await remote.createSnapshot();
        await this.merge(id, remoteSnapshot, localSnapshot);
      } catch (error) {
        console.error(`Sync failed with ${id}:`, error);
      }
    }
  }

  /**
   * Merge remote snapshot
   */
  private async merge(
    sourceId: string,
    remote: StateSnapshot,
    local: StateSnapshot
  ): Promise<void> {
    const diff = this.computeDiff(local, remote);

    for (const item of diff.added) {
      await this.set(item.key, item.value);
    }

    for (const item of diff.modified) {
      switch (this.syncOptions.conflictResolution) {
        case 'last-write-wins':
          if (remote.state[item.key] !== undefined) {
            await this.set(item.key, item.currentValue);
          }
          break;
        case 'first-write-wins':
          // Keep local value
          break;
        case 'merge':
          // Attempt to merge objects
          if (
            typeof item.previousValue === 'object' &&
            typeof item.currentValue === 'object'
          ) {
            const merged = { ...item.previousValue, ...item.currentValue };
            await this.set(item.key, merged);
          }
          break;
        case 'error':
          throw new Error(`Conflict detected for key: ${item.key}`);
      }
    }

    for (const item of diff.deleted) {
      await this.delete(item.key);
    }
  }
}
