// @ts-nocheck
/**
 * State Store
 *
 * Persistent state store using Cloudflare storage backends.
 */

import type {
  StateValue,
  StateSnapshot,
} from '../types/state';

import type { DurableObjectState } from '@cloudflare/workers-types';

/**
 * State store configuration
 */
export interface StateStoreConfig {
  readonly persistence: 'memory' | 'durable-object' | 'kv' | 'r2';
  readonly compression?: boolean;
  readonly encryption?: boolean;
  readonly ttl?: number;
}

/**
 * State store interface
 */
export interface StateStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  snapshot(): Promise<StateSnapshot>;
  restore(snapshot: StateSnapshot): Promise<void>;
}

/**
 * In-memory state store
 */
export class MemoryStateStore implements StateStore {
  private data: Map<string, StateValue>;
  private config: StateStoreConfig;

  constructor(config: StateStoreConfig = { persistence: 'memory' }) {
    this.data = new Map();
    this.config = config;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const entry = this.data.get(key);

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

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const now = Date.now();
    const existing = this.data.get(key);

    const entry: StateValue = {
      value,
      version: existing ? existing.version + 1 : 1,
      created: existing?.created || now,
      updated: now,
      ttl: this.config.ttl ? now + this.config.ttl : undefined,
      metadata: {},
    };

    this.data.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.data.get(key);

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

  async clear(): Promise<void> {
    this.data.clear();
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.data.keys());

    if (prefix) {
      return keys.filter((key) => key.startsWith(prefix));
    }

    return keys;
  }

  async snapshot(): Promise<StateSnapshot> {
    return {
      timestamp: Date.now(),
      version: this.getVersion(),
      state: Object.fromEntries(
        Array.from(this.data.entries()).map(([key, entry]) => [
          key,
          entry.value,
        ])
      ),
    };
  }

  async restore(snapshot: StateSnapshot): Promise<void> {
    this.data.clear();

    const now = Date.now();

    for (const [key, value] of Object.entries(snapshot.state)) {
      this.data.set(key, {
        value,
        version: 1,
        created: now,
        updated: now,
        metadata: {},
      });
    }
  }

  private getVersion(): number {
    let maxVersion = 0;

    for (const entry of this.data.values()) {
      if (entry.version > maxVersion) {
        maxVersion = entry.version;
      }
    }

    return maxVersion;
  }
}

/**
 * Durable Object state store
 */
export class DurableObjectStateStore implements StateStore {
  private state: DurableObjectState;
  private config: StateStoreConfig;

  constructor(state: DurableObjectState, config: StateStoreConfig) {
    this.state = state;
    this.config = config;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const entry = await this.state.storage.get<StateValue>(key);

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

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const existing = await this.state.storage.get<StateValue>(key);
    const now = Date.now();

    const entry: StateValue = {
      value,
      version: existing ? existing.version + 1 : 1,
      created: existing?.created || now,
      updated: now,
      ttl: this.config.ttl ? now + this.config.ttl : undefined,
      metadata: {},
    };

    await this.state.storage.put(key, entry);
  }

  async delete(key: string): Promise<void> {
    await this.state.storage.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = await this.state.storage.get<StateValue>(key);

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

  async clear(): Promise<void> {
    await this.state.storage.deleteAll();
  }

  async list(prefix?: string): Promise<string[]> {
    const list = await this.state.storage.list();

    let keys = list.keys.map((k) => k.name);

    if (prefix) {
      keys = keys.filter((key) => key.startsWith(prefix));
    }

    return keys;
  }

  async snapshot(): Promise<StateSnapshot> {
    const list = await this.state.storage.list();
    const state: Record<string, unknown> = {};

    let maxVersion = 0;

    for (const item of list.values) {
      const entry = item.value as StateValue;
      if (entry.version > maxVersion) {
        maxVersion = entry.version;
      }
      state[item.key.name] = entry.value;
    }

    return {
      timestamp: Date.now(),
      version: maxVersion,
      state,
    };
  }

  async restore(snapshot: StateSnapshot): Promise<void> {
    await this.state.storage.deleteAll();

    const now = Date.now();

    for (const [key, value] of Object.entries(snapshot.state)) {
      const entry: StateValue = {
        value,
        version: 1,
        created: now,
        updated: now,
        metadata: {},
      };

      await this.state.storage.put(key, entry);
    }
  }
}

/**
 * KV namespace state store
 */
export class KVStateStore implements StateStore {
  private kv: KVNamespace;
  private config: StateStoreConfig;

  constructor(kv: KVNamespace, config: StateStoreConfig) {
    this.kv = kv;
    this.config = config;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const value = await this.kv.get(key, 'json');

    if (value === null) {
      return undefined;
    }

    return value as T;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const options: KVNamespacePutOptions = {};

    if (this.config.ttl) {
      options.expirationTtl = this.config.ttl / 1000;
    }

    await this.kv.put(key, JSON.stringify(value), options);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.kv.get(key);
    return value !== null;
  }

  async clear(): Promise<void> {
    const list = await this.kv.list();

    for (const key of list.keys) {
      await this.kv.delete(key.name);
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const list = await this.kv.list({ prefix });

    return list.keys.map((k) => k.name);
  }

  async snapshot(): Promise<StateSnapshot> {
    const list = await this.kv.list();
    const state: Record<string, unknown> = {};

    for (const key of list.keys) {
      const value = await this.kv.get(key.name, 'json');
      if (value !== null) {
        state[key.name] = value;
      }
    }

    return {
      timestamp: Date.now(),
      version: 1,
      state,
    };
  }

  async restore(snapshot: StateSnapshot): Promise<void> {
    await this.clear();

    for (const [key, value] of Object.entries(snapshot.state)) {
      await this.set(key, value);
    }
  }
}

/**
 * State store factory
 */
export class StateStoreFactory {
  /**
   * Create a state store
   */
  static create(
    config: StateStoreConfig,
    context?: DurableObjectState | { kv: KVNamespace }
  ): StateStore {
    switch (config.persistence) {
      case 'memory':
        return new MemoryStateStore(config);

      case 'durable-object':
        if (!context || !('storage' in context)) {
          throw new Error(
            'DurableObjectState required for durable-object persistence'
          );
        }
        return new DurableObjectStateStore(
          context as DurableObjectState,
          config
        );

      case 'kv':
        if (!context || !('kv' in context)) {
          throw new Error('KVNamespace required for kv persistence');
        }
        return new KVStateStore(
          (context as { kv: KVNamespace }).kv,
          config
        );

      default:
        throw new Error(`Unsupported persistence type: ${config.persistence}`);
    }
  }
}
