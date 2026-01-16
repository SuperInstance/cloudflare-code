// @ts-nocheck
/**
 * LRU (Least Recently Used) Cache Implementation
 *
 * Provides efficient caching with automatic eviction of least recently used items.
 */

import { CacheEntry } from '../types/index.js';

/**
 * LRU Cache node
 */
interface CacheNode<K, V> {
  key: K;
  value: V;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
  timestamp: number;
  hitCount: number;
}

/**
 * LRU Cache class
 */
export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, CacheNode<K, V>>;
  private head: CacheNode<K, V> | null;
  private tail: CacheNode<K, V> | null;
  private size: number;
  private defaultTTL: number;
  private cleanupInterval: number;
  private cleanupTimer: NodeJS.Timeout | null;

  constructor(
    capacity: number,
    options: {
      defaultTTL?: number;
      cleanupInterval?: number;
    } = {}
  ) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.size = 0;
    this.defaultTTL = options.defaultTTL || 3600000; // 1 hour
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this.cleanupTimer = null;

    this.startCleanupTimer();
  }

  /**
   * Get a value from the cache
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);

    if (!node) {
      return undefined;
    }

    // Check if expired
    if (this.defaultTTL > 0 && Date.now() - node.timestamp > this.defaultTTL) {
      this.delete(key);
      return undefined;
    }

    // Move to front (most recently used)
    this.moveToFront(node);
    node.hitCount++;

    return node.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: K, value: V, ttl?: number): void {
    let node = this.cache.get(key);

    if (node) {
      // Update existing node
      node.value = value;
      node.timestamp = Date.now();
      this.moveToFront(node);
    } else {
      // Create new node
      node = {
        key,
        value,
        prev: null,
        next: null,
        timestamp: Date.now(),
        hitCount: 0,
      };

      this.cache.set(key, node);
      this.addToFront(node);
      this.size++;

      // Evict if over capacity
      if (this.size > this.capacity) {
        this.removeTail();
      }
    }
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean {
    const node = this.cache.get(key);

    if (!node) {
      return false;
    }

    // Check if expired
    if (this.defaultTTL > 0 && Date.now() - node.timestamp > this.defaultTTL) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);

    if (!node) {
      return false;
    }

    this.removeNode(node);
    this.cache.delete(key);
    this.size--;

    return true;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  /**
   * Get the current size of the cache
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Get the capacity of the cache
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Set the capacity of the cache
   */
  setCapacity(capacity: number): void {
    this.capacity = capacity;

    // Evict entries if over new capacity
    while (this.size > this.capacity) {
      this.removeTail();
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    capacity: number;
    hitRate: number;
    totalHits: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    let totalHits = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const node of this.cache.values()) {
      totalHits += node.hitCount;
      if (node.timestamp < oldestTimestamp) {
        oldestTimestamp = node.timestamp;
      }
      if (node.timestamp > newestTimestamp) {
        newestTimestamp = node.timestamp;
      }
    }

    const totalAccesses = totalHits + (this.size - totalHits);
    const hitRate = totalAccesses > 0 ? totalHits / totalAccesses : 0;

    return {
      size: this.size,
      capacity: this.capacity,
      hitRate,
      totalHits,
      oldestEntry: oldestTimestamp === Infinity ? 0 : oldestTimestamp,
      newestEntry,
    };
  }

  /**
   * Get all keys in the cache
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values in the cache
   */
  values(): V[] {
    const values: V[] = [];
    let current = this.head;

    while (current) {
      values.push(current.value);
      current = current.next;
    }

    return values;
  }

  /**
   * Get all entries in the cache
   */
  entries(): Array<[K, V]> {
    const entries: Array<[K, V]> = [];
    let current = this.head;

    while (current) {
      entries.push([current.key, current.value]);
      current = current.next;
    }

    return entries;
  }

  /**
   * Add node to front of list (most recently used)
   */
  private addToFront(node: CacheNode<K, V>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Move node to front of list
   */
  private moveToFront(node: CacheNode<K, V>): void {
    if (node === this.head) {
      return;
    }

    this.removeNode(node);
    this.addToFront(node);
  }

  /**
   * Remove node from list
   */
  private removeNode(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Remove tail node (least recently used)
   */
  private removeTail(): void {
    if (!this.tail) {
      return;
    }

    this.cache.delete(this.tail.key);
    this.removeNode(this.tail);
    this.size--;
  }

  /**
   * Start cleanup timer to remove expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    if (this.defaultTTL <= 0) {
      return;
    }

    const now = Date.now();
    const keysToDelete: K[] = [];

    for (const [key, node] of this.cache.entries()) {
      if (now - node.timestamp > this.defaultTTL) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  /**
   * Export cache for persistence
   */
  export(): Array<{
    key: K;
    value: V;
    timestamp: number;
    hitCount: number;
  }> {
    const entries = [];

    for (const node of this.cache.values()) {
      entries.push({
        key: node.key,
        value: node.value,
        timestamp: node.timestamp,
        hitCount: node.hitCount,
      });
    }

    return entries;
  }

  /**
   * Import cache from persistence
   */
  import(entries: Array<{
    key: K;
    value: V;
    timestamp: number;
    hitCount: number;
  }>): void {
    for (const entry of entries) {
      if (this.size < this.capacity) {
        const node: CacheNode<K, V> = {
          key: entry.key,
          value: entry.value,
          prev: null,
          next: null,
          timestamp: entry.timestamp,
          hitCount: entry.hitCount,
        };

        this.cache.set(entry.key, node);
        this.addToFront(node);
        this.size++;
      }
    }
  }

  /**
   * Destroy the cache and stop timers
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.clear();
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): number {
    let bytes = 0;

    // Map overhead
    bytes += this.cache.size * 100;

    // Node overhead
    bytes += this.size * 200;

    // Value storage (rough estimate)
    for (const node of this.cache.values()) {
      bytes += JSON.stringify(node.value).length * 2;
    }

    return bytes;
  }

  /**
   * Peek at a value without updating LRU order
   */
  peek(key: K): V | undefined {
    const node = this.cache.get(key);

    if (!node) {
      return undefined;
    }

    // Check if expired
    if (this.defaultTTL > 0 && Date.now() - node.timestamp > this.defaultTTL) {
      this.delete(key);
      return undefined;
    }

    return node.value;
  }

  /**
   * Get or set a value
   */
  getOrSet(key: K, factory: () => V, ttl?: number): V {
    const value = this.get(key);

    if (value !== undefined) {
      return value;
    }

    const newValue = factory();
    this.set(key, newValue, ttl);
    return newValue;
  }

  /**
   * Get multiple values
   */
  getMultiple(keys: K[]): Map<K, V> {
    const result = new Map<K, V>();

    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Set multiple values
   */
  setMultiple(entries: Array<[K, V]>, ttl?: number): void {
    for (const [key, value] of entries) {
      this.set(key, value, ttl);
    }
  }

  /**
   * Delete multiple keys
   */
  deleteMultiple(keys: K[]): number {
    let deleted = 0;

    for (const key of keys) {
      if (this.delete(key)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Check if cache is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Check if cache is full
   */
  isFull(): boolean {
    return this.size >= this.capacity;
  }

  /**
   * Resize the cache
   */
  resize(newCapacity: number): void {
    this.setCapacity(newCapacity);
  }

  /**
   * Get cache usage ratio
   */
  getUsageRatio(): number {
    return this.capacity > 0 ? this.size / this.capacity : 0;
  }

  /**
   * Find least recently used item
   */
  getLRU(): { key: K; value: V } | null {
    if (!this.tail) {
      return null;
    }

    return {
      key: this.tail.key,
      value: this.tail.value,
    };
  }

  /**
   * Find most recently used item
   */
  getMRU(): { key: K; value: V } | null {
    if (!this.head) {
      return null;
    }

    return {
      key: this.head.key,
      value: this.head.value,
    };
  }
}

/**
 * Create a specialized vector cache
 */
export class VectorCache extends LRUCache<string, Float32Array> {
  constructor(
    capacity: number,
    dimension: number,
    options: {
      defaultTTL?: number;
      cleanupInterval?: number;
    } = {}
  ) {
    // Estimate memory usage per vector
    const bytesPerVector = dimension * 4; // Float32Array
    const maxMemoryMB = 500; // 500 MB default limit
    const maxVectors = Math.floor((maxMemoryMB * 1024 * 1024) / bytesPerVector);

    // Use smaller of capacity or memory limit
    super(Math.min(capacity, maxVectors), options);
  }

  /**
   * Get memory usage in bytes
   */
  getVectorMemoryUsage(): number {
    let bytes = 0;

    for (const vector of this.values()) {
      bytes += vector.length * 4; // Float32Array
    }

    return bytes;
  }

  /**
   * Get memory usage in MB
   */
  getVectorMemoryUsageMB(): number {
    return this.getVectorMemoryUsage() / (1024 * 1024);
  }

  /**
   * Get cache size in bytes
   */
  getCacheSize(): number {
    return this.getVectorMemoryUsage();
  }
}
