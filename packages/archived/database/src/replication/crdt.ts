/**
 * Conflict-Free Replicated Data Types (CRDTs)
 *
 * Implements CRDTs for conflict-free replication in multi-leader setups
 */

export interface CRDT<T> {
  value(): T;
  merge(other: CRDT<T>): void;
  toJSON(): unknown;
}

/**
 * Last-Write-Wins Register
 */
export class LWWRegister<T> implements CRDT<T> {
  private value_: T;
  private timestamp: number;
  private node: string;

  constructor(node: string, initialValue: T, timestamp: number = Date.now()) {
    this.node = node;
    this.value_ = initialValue;
    this.timestamp = timestamp;
  }

  set(value: T, timestamp?: number): void {
    const ts = timestamp || Date.now();
    if (ts >= this.timestamp) {
      this.value_ = value;
      this.timestamp = ts;
    }
  }

  value(): T {
    return this.value_;
  }

  merge(other: LWWRegister<T>): void {
    if (other.timestamp > this.timestamp) {
      this.value_ = other.value_;
      this.timestamp = other.timestamp;
    } else if (other.timestamp === this.timestamp && other.node > this.node) {
      // Tie-breaker: node ID
      this.value_ = other.value_;
      this.timestamp = other.timestamp;
    }
  }

  toJSON(): unknown {
    return {
      type: 'LWWRegister',
      node: this.node,
      value: this.value_,
      timestamp: this.timestamp,
    };
  }

  static fromJSON<T>(json: { value: T; timestamp: number; node: string }): LWWRegister<T> {
    return new LWWRegister(json.node, json.value, json.timestamp);
  }
}

/**
 * Grow-Only Counter (G-Counter)
 */
export class GCounter implements CRDT<number> {
  private counts: Map<string, number>;

  constructor(initial: Map<string, number> = new Map()) {
    this.counts = new Map(initial);
  }

  increment(node: string, amount: number = 1): void {
    const current = this.counts.get(node) || 0;
    this.counts.set(node, current + amount);
  }

  value(): number {
    let sum = 0;
    for (const count of this.counts.values()) {
      sum += count;
    }
    return sum;
  }

  merge(other: GCounter): void {
    for (const [node, count] of other.counts) {
      const current = this.counts.get(node) || 0;
      this.counts.set(node, Math.max(current, count));
    }
  }

  toJSON(): unknown {
    return {
      type: 'GCounter',
      counts: Object.fromEntries(this.counts),
    };
  }

  static fromJSON(json: { counts: Record<string, number> }): GCounter {
    const counts = new Map<string, number>();
    for (const [node, count] of Object.entries(json.counts)) {
      counts.set(node, count);
    }
    return new GCounter(counts);
  }
}

/**
 * PN-Counter (Positive-Negative Counter)
 */
export class PNCounter implements CRDT<number> {
  private increments: Map<string, number>;
  private decrements: Map<string, number>;

  constructor() {
    this.increments = new Map();
    this.decrements = new Map();
  }

  increment(node: string, amount: number = 1): void {
    const current = this.increments.get(node) || 0;
    this.increments.set(node, current + amount);
  }

  decrement(node: string, amount: number = 1): void {
    const current = this.decrements.get(node) || 0;
    this.decrements.set(node, current + amount);
  }

  value(): number {
    let incSum = 0;
    let decSum = 0;

    for (const count of this.increments.values()) {
      incSum += count;
    }
    for (const count of this.decrements.values()) {
      decSum += count;
    }

    return incSum - decSum;
  }

  merge(other: PNCounter): void {
    for (const [node, count] of other.increments) {
      const current = this.increments.get(node) || 0;
      this.increments.set(node, Math.max(current, count));
    }
    for (const [node, count] of other.decrements) {
      const current = this.decrements.get(node) || 0;
      this.decrements.set(node, Math.max(current, count));
    }
  }

  toJSON(): unknown {
    return {
      type: 'PNCounter',
      increments: Object.fromEntries(this.increments),
      decrements: Object.fromEntries(this.decrements),
    };
  }

  static fromJSON(json: {
    increments: Record<string, number>;
    decrements: Record<string, number>;
  }): PNCounter {
    const counter = new PNCounter();
    for (const [node, count] of Object.entries(json.increments)) {
      counter.increments.set(node, count);
    }
    for (const [node, count] of Object.entries(json.decrements)) {
      counter.decrements.set(node, count);
    }
    return counter;
  }
}

/**
 * Observed-Removed Set (OR-Set)
 */
export class ORSet<T> implements CRDT<Set<T>> {
  private elements: Map<T, Set<string>>; // element -> set of nodes that added it
  private tombstones: Map<T, Set<string>>; // element -> set of nodes that removed it

  constructor() {
    this.elements = new Map();
    this.tombstones = new Map();
  }

  add(element: T, node: string): void {
    if (!this.elements.has(element)) {
      this.elements.set(element, new Set());
    }
    this.elements.get(element)!.add(node);
  }

  remove(element: T, node: string): void {
    if (!this.tombstones.has(element)) {
      this.tombstones.set(element, new Set());
    }
    this.tombstones.get(element)!.add(node);
  }

  value(): Set<T> {
    const result = new Set<T>();

    for (const [element, adders] of this.elements) {
      const removers = this.tombstones.get(element) || new Set();
      const allAdders = new Set(adders);

      // Element exists if any node added it and wasn't removed by all adders
      for (const adder of adders) {
        if (!removers.has(adder)) {
          result.add(element);
          break;
        }
      }
    }

    return result;
  }

  merge(other: ORSet<T>): void {
    // Merge elements
    for (const [element, adders] of other.elements) {
      if (!this.elements.has(element)) {
        this.elements.set(element, new Set(adders));
      } else {
        for (const adder of adders) {
          this.elements.get(element)!.add(adder);
        }
      }
    }

    // Merge tombstones
    for (const [element, removers] of other.tombstones) {
      if (!this.tombstones.has(element)) {
        this.tombstones.set(element, new Set(removers));
      } else {
        for (const remover of removers) {
          this.tombstones.get(element)!.add(remover);
        }
      }
    }
  }

  toJSON(): unknown {
    const elements: Record<string, string[]> = {};
    const tombstones: Record<string, string[]> = {};

    for (const [element, adders] of this.elements) {
      elements[String(element)] = Array.from(adders);
    }
    for (const [element, removers] of this.tombstones) {
      tombstones[String(element)] = Array.from(removers);
    }

    return {
      type: 'ORSet',
      elements,
      tombstones,
    };
  }

  static fromJSON<T>(json: {
    elements: Record<string, string[]>;
    tombstones: Record<string, string[]>;
  }): ORSet<T> {
    const set = new ORSet<T>();

    for (const [element, adders] of Object.entries(json.elements)) {
      set.elements.set(element as unknown as T, new Set(adders));
    }
    for (const [element, removers] of Object.entries(json.tombstones)) {
      set.tombstones.set(element as unknown as T, new Set(removers));
    }

    return set;
  }
}

/**
 * Last-Write-Wins Map (LWW-Map)
 */
export class LWWMap<K, V> implements CRDT<Map<K, V>> {
  private data: Map<K, { value: V; timestamp: number; node: string }>;

  constructor() {
    this.data = new Map();
  }

  set(key: K, value: V, node: string, timestamp: number = Date.now()): void {
    const current = this.data.get(key);
    if (!current || timestamp > current.timestamp ||
      (timestamp === current.timestamp && node > current.node)) {
      this.data.set(key, { value, timestamp, node });
    }
  }

  delete(key: K, node: string, timestamp: number = Date.now()): void {
    const current = this.data.get(key);
    // Tombstone with high timestamp
    if (!current || timestamp > current.timestamp) {
      this.data.set(key, { value: null as unknown as V, timestamp, node });
    }
  }

  get(key: K): V | undefined {
    const entry = this.data.get(key);
    return entry?.value;
  }

  has(key: K): boolean {
    const entry = this.data.get(key);
    return entry !== undefined && entry.value !== null;
  }

  value(): Map<K, V> {
    const result = new Map<K, V>();
    for (const [key, entry] of this.data) {
      if (entry.value !== null) {
        result.set(key, entry.value);
      }
    }
    return result;
  }

  merge(other: LWWMap<K, V>): void {
    for (const [key, entry] of other.data) {
      const current = this.data.get(key);
      if (!current ||
        entry.timestamp > current.timestamp ||
        (entry.timestamp === current.timestamp && entry.node > current.node)) {
        this.data.set(key, entry);
      }
    }
  }

  toJSON(): unknown {
    const obj: Record<string, unknown> = {};
    for (const [key, entry] of this.data) {
      obj[String(key)] = entry;
    }
    return {
      type: 'LWWMap',
      data: obj,
    };
  }

  static fromJSON<K, V>(json: { data: Record<string, unknown> }): LWWMap<K, V> {
    const map = new LWWMap<K, V>();
    for (const [key, entry] of Object.entries(json.data)) {
      map.data.set(key as unknown as K, entry as { value: V; timestamp: number; node: string });
    }
    return map;
  }
}

/**
 * CRDT Manager for database operations
 */
export class CRDTManager {
  private node: string;
  private registers: Map<string, LWWRegister<unknown>>;
  private counters: Map<string, GCounter>;
  private sets: Map<string, ORSet<unknown>>;
  private maps: Map<string, LWWMap<unknown, unknown>>;

  constructor(node: string) {
    this.node = node;
    this.registers = new Map();
    this.counters = new Map();
    this.sets = new Map();
    this.maps = new Map();
  }

  /**
   * Get or create LWW register
   */
  getRegister<T>(key: string, initialValue: T): LWWRegister<T> {
    if (!this.registers.has(key)) {
      this.registers.set(key, new LWWRegister(this.node, initialValue));
    }
    return this.registers.get(key) as LWWRegister<T>;
  }

  /**
   * Get or create G-counter
   */
  getCounter(key: string): GCounter {
    if (!this.counters.has(key)) {
      this.counters.set(key, new GCounter());
    }
    return this.counters.get(key)!;
  }

  /**
   * Get or create OR-set
   */
  getSet<T>(key: string): ORSet<T> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new ORSet<T>());
    }
    return this.sets.get(key) as ORSet<T>;
  }

  /**
   * Get or create LWW-map
   */
  getMap<K, V>(key: string): LWWMap<K, V> {
    if (!this.maps.has(key)) {
      this.maps.set(key, new LWWMap<K, V>());
    }
    return this.maps.get(key) as LWWMap<K, V>;
  }

  /**
   * Merge all CRDTs from another manager
   */
  merge(other: CRDTManager): void {
    // Merge registers
    for (const [key, reg] of other.registers) {
      const local = this.registers.get(key);
      if (local) {
        local.merge(reg);
      } else {
        this.registers.set(key, reg);
      }
    }

    // Merge counters
    for (const [key, counter] of other.counters) {
      const local = this.counters.get(key);
      if (local) {
        local.merge(counter);
      } else {
        this.counters.set(key, counter);
      }
    }

    // Merge sets
    for (const [key, set] of other.sets) {
      const local = this.sets.get(key);
      if (local) {
        local.merge(set);
      } else {
        this.sets.set(key, set);
      }
    }

    // Merge maps
    for (const [key, map] of other.maps) {
      const local = this.maps.get(key);
      if (local) {
        local.merge(map);
      } else {
        this.maps.set(key, map);
      }
    }
  }

  /**
   * Serialize all CRDTs
   */
  toJSON(): unknown {
    return {
      node: this.node,
      registers: Array.from(this.registers.entries()).map(([k, v]) => [k, v.toJSON()]),
      counters: Array.from(this.counters.entries()).map(([k, v]) => [k, v.toJSON()]),
      sets: Array.from(this.sets.entries()).map(([k, v]) => [k, v.toJSON()]),
      maps: Array.from(this.maps.entries()).map(([k, v]) => [k, v.toJSON()]),
    };
  }

  /**
   * Deserialize CRDTs
   */
  static fromJSON(json: {
    node: string;
    registers: [string, unknown][];
    counters: [string, unknown][];
    sets: [string, unknown][];
    maps: [string, unknown][];
  }): CRDTManager {
    const manager = new CRDTManager(json.node);

    for (const [key, value] of json.registers) {
      manager.registers.set(key, LWWRegister.fromJSON(value as any));
    }
    for (const [key, value] of json.counters) {
      manager.counters.set(key, GCounter.fromJSON(value as any));
    }
    for (const [key, value] of json.sets) {
      manager.sets.set(key, ORSet.fromJSON(value as any));
    }
    for (const [key, value] of json.maps) {
      manager.maps.set(key, LWWMap.fromJSON(value as any));
    }

    return manager;
  }
}
