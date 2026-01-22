/**
 * Durable Object Memory Manager
 *
 * Advanced memory management for Durable Objects to ensure
 * we stay within the 128MB limit while maximizing performance.
 *
 * Features:
 * - LRU eviction strategy
 * - Memory monitoring and alerts
 * - Automatic compression
 * - Smart cache promotion/demotion
 */

import type { DurableObjectState } from '@cloudflare/workers-types';

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  /** Current memory usage in bytes */
  used: number;
  /** Maximum allowed memory in bytes */
  max: number;
  /** Usage percentage */
  percentage: number;
  /** Number of items in memory */
  itemCount: number;
  /** Average item size */
  avgItemSize: number;
  /** Status */
  status: 'healthy' | 'warning' | 'critical';
}

/**
 * Memory entry with metadata
 */
export interface MemoryEntry<T = any> {
  /** The stored value */
  value: T;
  /** Size in bytes */
  size: number;
  /** Last access timestamp */
  lastAccess: number;
  /** Access frequency */
  accessCount: number;
  /** Creation timestamp */
  createdAt: number;
  /** Priority (higher = less likely to evict) */
  priority: number;
  /** Compressed */
  compressed: boolean;
}

/**
 * Eviction strategy
 */
export type EvictionStrategy = 'lru' | 'lfu' | 'priority' | 'adaptive';

/**
 * Memory manager configuration
 */
export interface MemoryManagerConfig {
  /** Maximum memory in bytes (default: 128MB) */
  maxMemory?: number;
  /** Warning threshold percentage (default: 80%) */
  warningThreshold?: number;
  /** Critical threshold percentage (default: 90%) */
  criticalThreshold?: number;
  /** Target usage percentage for eviction (default: 75%) */
  targetUsage?: number;
  /** Eviction strategy */
  evictionStrategy?: EvictionStrategy;
  /** Enable automatic compression */
  enableCompression?: boolean;
  /** Compression threshold (bytes) */
  compressionThreshold?: number;
}

/**
 * Durable Object Memory Manager
 */
export class DOMemoryManager {
  private state: DurableObjectState;
  private config: Required<MemoryManagerConfig>;
  private entries: Map<string, MemoryEntry>;
  private currentMemory: number;

  constructor(state: DurableObjectState, config: MemoryManagerConfig = {}) {
    this.state = state;
    this.config = {
      maxMemory: config.maxMemory ?? 128 * 1024 * 1024, // 128MB
      warningThreshold: config.warningThreshold ?? 0.8, // 80%
      criticalThreshold: config.criticalThreshold ?? 0.9, // 90%
      targetUsage: config.targetUsage ?? 0.75, // 75%
      evictionStrategy: config.evictionStrategy ?? 'adaptive',
      enableCompression: config.enableCompression ?? true,
      compressionThreshold: config.compressionThreshold ?? 1024, // 1KB
    };

    this.entries = new Map();
    this.currentMemory = 0;

    // Initialize from storage
    this.initializeFromStorage();
  }

  /**
   * Initialize from DO storage
   */
  private async initializeFromStorage(): Promise<void> {
    try {
      const stored = await this.state.storage.get<{
        entries: Record<string, MemoryEntry>;
        currentMemory: number;
      }>('memory-manager');

      if (stored) {
        this.entries = new Map(Object.entries(stored.entries));
        this.currentMemory = stored.currentMemory;
      }
    } catch (error) {
      console.warn('Failed to initialize memory manager from storage:', error);
    }
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): MemoryStats {
    const percentage = this.currentMemory / this.config.maxMemory;
    const itemCount = this.entries.size;
    const avgItemSize = itemCount > 0 ? this.currentMemory / itemCount : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (percentage >= this.config.criticalThreshold) {
      status = 'critical';
    } else if (percentage >= this.config.warningThreshold) {
      status = 'warning';
    }

    return {
      used: this.currentMemory,
      max: this.config.maxMemory,
      percentage,
      itemCount,
      avgItemSize,
      status,
    };
  }

  /**
   * Check memory usage and evict if needed
   */
  async checkMemoryUsage(): Promise<number> {
    const stats = this.getMemoryStats();

    if (stats.percentage >= this.config.targetUsage) {
      await this.evictIfNeeded();
    }

    return this.currentMemory;
  }

  /**
   * Evict entries if memory is high
   */
  async evictIfNeeded(): Promise<void> {
    const targetBytes = this.config.maxMemory * this.config.targetUsage;

    while (this.currentMemory > targetBytes && this.entries.size > 0) {
      await this.evictOne();
    }

    // Persist after eviction
    await this.persist();
  }

  /**
   * Evict a single entry based on strategy
   */
  private async evictOne(): Promise<void> {
    if (this.entries.size === 0) return;

    let keyToEvict: string | null = null;

    switch (this.config.evictionStrategy) {
      case 'lru':
        keyToEvict = this.evictLRU();
        break;
      case 'lfu':
        keyToEvict = this.evictLFU();
        break;
      case 'priority':
        keyToEvict = this.evictByPriority();
        break;
      case 'adaptive':
        keyToEvict = this.evictAdaptive();
        break;
    }

    if (keyToEvict) {
      await this.remove(keyToEvict);
    }
  }

  /**
   * Evict Least Recently Used entry
   */
  private evictLRU(): string | null {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.entries.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }

    return lruKey;
  }

  /**
   * Evict Least Frequently Used entry
   */
  private evictLFU(): string | null {
    let lfuKey: string | null = null;
    let lfuCount = Infinity;

    for (const [key, entry] of this.entries.entries()) {
      if (entry.accessCount < lfuCount) {
        lfuCount = entry.accessCount;
        lfuKey = key;
      }
    }

    return lfuKey;
  }

  /**
   * Evict by priority (lowest priority first)
   */
  private evictByPriority(): string | null {
    let lowKey: string | null = null;
    let lowPriority = Infinity;

    for (const [key, entry] of this.entries.entries()) {
      if (entry.priority < lowPriority) {
        lowPriority = entry.priority;
        lowKey = key;
      }
    }

    return lowKey;
  }

  /**
   * Adaptive eviction (combines LRU, LFU, and priority)
   */
  private evictAdaptive(): string | null {
    // Score = (time_since_access / 1000) * (1 / access_count) * (1 / priority)
    let worstKey: string | null = null;
    let worstScore = -Infinity;
    const now = Date.now();

    for (const [key, entry] of this.entries.entries()) {
      const timeSinceAccess = now - entry.lastAccess;
      const accessScore = 1 / Math.max(1, entry.accessCount);
      const priorityScore = 1 / Math.max(1, entry.priority);
      const score = (timeSinceAccess / 1000) * accessScore * priorityScore;

      if (score > worstScore) {
        worstScore = score;
        worstKey = key;
      }
    }

    return worstKey;
  }

  /**
   * Set a value in memory
   */
  async set(
    key: string,
    value: any,
    options: {
      priority?: number;
      compress?: boolean;
    } = {}
  ): Promise<void> {
    const size = this.calculateSize(value);

    // Check if we need to evict first
    if (size > this.config.maxMemory * 0.1) {
      // Large item, ensure capacity
      await this.ensureCapacity(size);
    }

    // Compress if enabled and threshold met
    let finalValue = value;
    let compressed = false;

    if (
      this.config.enableCompression &&
      (options.compress ?? size >= this.config.compressionThreshold)
    ) {
      try {
        finalValue = await this.compress(value);
        compressed = true;
      } catch (error) {
        // Compression failed, store uncompressed
      }
    }

    const entry: MemoryEntry = {
      value: finalValue,
      size,
      lastAccess: Date.now(),
      accessCount: 0,
      createdAt: Date.now(),
      priority: options.priority ?? 0,
      compressed,
    };

    // Remove old entry if exists
    const oldEntry = this.entries.get(key);
    if (oldEntry) {
      this.currentMemory -= oldEntry.size;
    }

    // Add new entry
    this.entries.set(key, entry);
    this.currentMemory += size;

    // Ensure capacity
    await this.ensureCapacity(0);

    // Persist
    await this.persist();
  }

  /**
   * Get a value from memory
   */
  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    // Update access metadata
    entry.lastAccess = Date.now();
    entry.accessCount++;

    // Decompress if needed
    if (entry.compressed) {
      try {
        return await this.decompress(entry.value);
      } catch (error) {
        // Decompression failed, return as-is
        return entry.value;
      }
    }

    return entry.value;
  }

  /**
   * Remove a value from memory
   */
  async remove(key: string): Promise<boolean> {
    const entry = this.entries.get(key);

    if (!entry) {
      return false;
    }

    this.currentMemory -= entry.size;
    this.entries.delete(key);

    await this.persist();
    return true;
  }

  /**
   * Ensure capacity for a new item
   */
  private async ensureCapacity(requiredBytes: number): Promise<void> {
    const targetBytes = this.config.maxMemory * this.config.targetUsage;

    while (this.currentMemory + requiredBytes > targetBytes && this.entries.size > 0) {
      await this.evictOne();
    }
  }

  /**
   * Calculate approximate size of a value
   */
  private calculateSize(value: any): number {
    try {
      const json = JSON.stringify(value);
      return json.length * 2; // UTF-16
    } catch (error) {
      // Fallback for non-serializable values
      return 1024; // Assume 1KB
    }
  }

  /**
   * Compress a value
   */
  private async compress(value: any): Promise<any> {
    const json = JSON.stringify(value);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);

    if (typeof CompressionStream === 'undefined') {
      return value;
    }

    try {
      const compressed = new Response(data).body!
        .pipeThrough(new CompressionStream('gzip'));
      const arrayBuffer = await new Response(compressed).arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      return value;
    }
  }

  /**
   * Decompress a value
   */
  private async decompress(compressed: any): Promise<any> {
    if (!(compressed instanceof Uint8Array)) {
      return compressed;
    }

    if (typeof DecompressionStream === 'undefined') {
      return compressed;
    }

    try {
      const decompressed = new Response(compressed).body!
        .pipeThrough(new DecompressionStream('gzip'));
      const arrayBuffer = await new Response(decompressed).arrayBuffer();
      const decoder = new TextDecoder();
      const json = decoder.decode(arrayBuffer);
      return JSON.parse(json);
    } catch (error) {
      return compressed;
    }
  }

  /**
   * Compress old data to free memory
   */
  async compressOldData(maxAge: number = 3600000): Promise<number> {
    const now = Date.now();
    let compressedCount = 0;
    let bytesSaved = 0;

    for (const [key, entry] of this.entries.entries()) {
      // Skip already compressed entries
      if (entry.compressed) continue;

      // Check if entry is old
      if (now - entry.createdAt < maxAge) continue;

      // Check if entry is accessed frequently
      if (entry.accessCount > 10) continue;

      try {
        const originalSize = entry.size;
        const compressedValue = await this.compress(entry.value);

        entry.value = compressedValue;
        entry.compressed = true;

        const newSize = this.calculateSize(compressedValue);
        bytesSaved += originalSize - newSize;
        compressedCount++;
      } catch (error) {
        // Skip on error
      }
    }

    if (compressedCount > 0) {
      await this.persist();
    }

    return bytesSaved;
  }

  /**
   * Persist to DO storage
   */
  private async persist(): Promise<void> {
    try {
      const entriesObj = Object.fromEntries(this.entries.entries());

      await this.state.storage.put('memory-manager', {
        entries: entriesObj,
        currentMemory: this.currentMemory,
      });
    } catch (error) {
      console.warn('Failed to persist memory manager state:', error);
    }
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    this.entries.clear();
    this.currentMemory = 0;
    await this.persist();
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get entry count
   */
  count(): number {
    return this.entries.size;
  }

  /**
   * Get memory manager statistics
   */
  getStats(): {
    memory: MemoryStats;
    entries: number;
    config: MemoryManagerConfig;
  } {
    return {
      memory: this.getMemoryStats(),
      entries: this.entries.size,
      config: this.config,
    };
  }
}

/**
 * LRU Cache implementation for DOs
 */
export class LRUCache<T = any> {
  private cache: Map<string, { value: T; lastAccess: number }>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (entry) {
      entry.lastAccess = Date.now();
      return entry.value;
    }

    return undefined;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      lastAccess: Date.now(),
    });
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

/**
 * Memory pool for managing multiple memory managers
 */
export class MemoryPool {
  private managers: Map<string, DOMemoryManager>;

  constructor() {
    this.managers = new Map();
  }

  /**
   * Register a memory manager
   */
  register(name: string, manager: DOMemoryManager): void {
    this.managers.set(name, manager);
  }

  /**
   * Get a memory manager
   */
  get(name: string): DOMemoryManager | undefined {
    return this.managers.get(name);
  }

  /**
   * Get combined memory stats
   */
  getCombinedStats(): {
    totalUsed: number;
    totalMax: number;
    managerCount: number;
    managers: Array<{ name: string; stats: MemoryStats }>;
  } {
    let totalUsed = 0;
    let totalMax = 0;
    const managers: Array<{ name: string; stats: MemoryStats }> = [];

    for (const [name, manager] of this.managers.entries()) {
      const stats = manager.getMemoryStats();
      totalUsed += stats.used;
      totalMax += stats.max;
      managers.push({ name, stats });
    }

    return {
      totalUsed,
      totalMax,
      managerCount: this.managers.size,
      managers,
    };
  }

  /**
   * Evict across all managers if needed
   */
  async evictAllIfNeeded(): Promise<void> {
    await Promise.all(
      Array.from(this.managers.values()).map((m) => m.evictIfNeeded())
    );
  }
}
