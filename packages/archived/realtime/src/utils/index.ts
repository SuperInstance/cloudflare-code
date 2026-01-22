// @ts-nocheck
/**
 * Utility functions for the Real-Time Communication Package
 */

import { ConnectionId, Message, Connection, ChannelInfo, UserPresence } from '../types';

export class IdGenerator {
  private static counter = 0;
  private static readonly chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  private static charsLength = IdGenerator.chars.length;

  static generate(prefix: string = '', length: number = 8): string {
    const timestamp = Date.now().toString(36);
    const random = Array.from({ length }, () =>
      IdGenerator.chars.charAt(Math.floor(Math.random() * IdGenerator.charsLength))
    ).join('');

    return `${prefix}${timestamp}${random}`.slice(0, length);
  }

  static generateConnectionId(namespace: string, userId?: string): ConnectionId {
    return {
      id: IdGenerator.generate('conn_', 16),
      namespace,
      userId
    };
  }

  static generateMessageId(): string {
    return IdGenerator.generate('msg_', 12);
  }

  static generateChannelId(): string {
    return IdGenerator.generate('ch_', 12);
  }
}

export class MessageValidator {
  static isValidMessage(message: any): message is Message {
    return (
      typeof message === 'object' &&
      typeof message.id === 'string' &&
      typeof message.type === 'string' &&
      typeof message.timestamp === 'number' &&
      typeof message.source === 'object' &&
      typeof message.source.id === 'string' &&
      typeof message.source.namespace === 'string' &&
      (message.payload !== undefined)
    );
  }

  static isValidChannelMessage(message: any): message is Message {
    return (
      this.isValidMessage(message) &&
      typeof message.channel === 'string'
    );
  }

  static sanitizeMessage(message: any): any {
    const sanitized = { ...message };

    // Remove sensitive information
    delete sanitized.source?.metadata?.auth;
    delete sanitized.source?.metadata?.session;
    delete sanitized.metadata?.sensitive;

    // Limit payload size
    if (typeof sanitized.payload === 'string' && sanitized.payload.length > 10000) {
      sanitized.payload = sanitized.payload.substring(0, 10000) + '...';
    }

    return sanitized;
  }
}

export class PerformanceTimer {
  private static timers = new Map<string, number>();

  static start(name: string): void {
    PerformanceTimer.timers.set(name, performance.now());
  }

  static end(name: string): number {
    const start = PerformanceTimer.timers.get(name);
    if (!start) {
      throw new Error(`No timer found for ${name}`);
    }

    const duration = performance.now() - start;
    PerformanceTimer.timers.delete(name);

    return duration;
  }

  static async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    PerformanceTimer.start(name);
    try {
      return await fn();
    } finally {
      PerformanceTimer.end(name);
    }
  }

  static measureSync<T>(name: string, fn: () => T): T {
    PerformanceTimer.start(name);
    try {
      return fn();
    } finally {
      PerformanceTimer.end(name);
    }
  }
}

export class RateLimiter {
  private windows = new Map<string, { count: number; resetTime: number }>();
  private readonly config: { windowMs: number; maxRequests: number };

  constructor(config: { windowMs: number; maxRequests: number }) {
    this.config = config;
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const window = this.windows.get(identifier);

    if (!window || now > window.resetTime) {
      this.windows.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs
      });

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: window?.resetTime || now + this.config.windowMs
      };
    }

    window.count++;

    return {
      allowed: window.count <= this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - window.count),
      resetTime: window.resetTime
    };
  }

  reset(identifier: string): void {
    this.windows.delete(identifier);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (now > window.resetTime) {
        this.windows.delete(key);
      }
    }
  }
}

export class LRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private readonly maxSize: number;
  private readonly ttl?: number;

  constructor(maxSize: number, ttl?: number) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  values(): V[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }
}

export class ConnectionPool {
  private connections = new Map<string, Connection>();
  private readonly maxSize: number;
  private readonly cleanupInterval: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(maxSize: number = 10000, cleanupInterval: number = 30000) {
    this.maxSize = maxSize;
    this.cleanupInterval = cleanupInterval;
    this.startCleanup();
  }

  add(connection: Connection): void {
    if (this.connections.size >= this.maxSize) {
      throw new Error('Connection pool is full');
    }

    this.connections.set(connection.id, connection);
  }

  get(id: string): Connection | undefined {
    return this.connections.get(id);
  }

  delete(id: string): boolean {
    return this.connections.delete(id);
  }

  has(id: string): boolean {
    return this.connections.has(id);
  }

  size(): number {
    return this.connections.size;
  }

  getAll(): Connection[] {
    return Array.from(this.connections.values());
  }

  filter(predicate: (connection: Connection) => boolean): Connection[] {
    return this.getAll().filter(predicate);
  }

  startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [id, connection] of this.connections) {
      if (now - connection.lastActivity > inactiveThreshold) {
        this.connections.delete(id);
      }
    }
  }

  dispose(): void {
    this.stopCleanup();
    this.connections.clear();
  }
}

export class EventBus {
  private listeners = new Map<string, Set<Function>>();
  private maxListeners = 100;

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const eventListeners = this.listeners.get(event)!;

    if (eventListeners.size >= this.maxListeners) {
      console.warn(`Maximum number of listeners (${this.maxListeners}) exceeded for event: ${event}`);
      return;
    }

    eventListeners.add(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);

      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  once(event: string, listener: Function): void {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    this.on(event, onceWrapper);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}

export class Serializer {
  private static readonly BINARY_TYPES = ['ArrayBuffer', 'Blob', 'ArrayBufferView'];

  static serialize(data: any): string | Buffer | ArrayBuffer {
    if (typeof data === 'string') {
      return data;
    }

    if (Buffer.isBuffer(data)) {
      return data;
    }

    if (ArrayBuffer.isView(data)) {
      return data.buffer;
    }

    if (data instanceof ArrayBuffer) {
      return data;
    }

    if (data instanceof Blob) {
      // In a real implementation, you would handle Blob serialization
      // This is a simplified version
      throw new Error('Blob serialization not implemented in this example');
    }

    // Default to JSON serialization
    return JSON.stringify(data);
  }

  static deserialize(data: string | Buffer | ArrayBuffer): any {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }

    if (Buffer.isBuffer(data)) {
      return data.toString();
    }

    if (data instanceof ArrayBuffer) {
      return new TextDecoder().decode(data);
    }

    return data;
  }
}

export class HealthChecker {
  private checks = new Map<string, () => Promise<boolean>>();
  private interval: number;
  private timer?: NodeJS.Timeout;

  constructor(interval: number = 30000) {
    this.interval = interval;
  }

  addCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }

  removeCheck(name: string): void {
    this.checks.delete(name);
  }

  async runAllChecks(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};

    for (const [name, check] of this.checks) {
      try {
        results[name] = await check();
      } catch (error) {
        console.error(`Health check ${name} failed:`, error);
        results[name] = false;
      }
    }

    return results;
  }

  start(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(async () => {
      await this.runAllChecks();
    }, this.interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

export class BackpressureManager {
  private queues = new Map<string, Array<{ message: any; resolve: Function; reject: Function }>>();
  private processing = new Map<string, boolean>();
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number = 100) {
    this.maxConcurrent = maxConcurrent;
  }

  async process<T>(key: string, processor: (message: any) => Promise<T>): Promise<T> {
    if (!this.queues.has(key)) {
      this.queues.set(key, []);
    }

    const queue = this.queues.get(key)!;

    return new Promise((resolve, reject) => {
      queue.push({ message: null, resolve, reject });
    }).then(result => {
      // Remove this task from the queue
      const index = queue.findIndex(item => item.resolve === resolve);
      if (index > -1) {
        queue.splice(index, 1);
      }

      // Process next item in queue
      this.processNext(key, processor);

      return result;
    });
  }

  private async processNext<T>(key: string, processor: (message: any) => Promise<T>): Promise<void> {
    const queue = this.queues.get(key);
    if (!queue || queue.length === 0 || this.processing.get(key)) {
      return;
    }

    // Check concurrent limit
    const activeProcesses = Array.from(this.processing.values()).filter(v => v).length;
    if (activeProcesses >= this.maxConcurrent) {
      return;
    }

    const task = queue.shift()!;
    this.processing.set(key, true);

    try {
      const result = await processor(task.message);
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      this.processing.set(key, false);
      this.processNext(key, processor);
    }
  }

  getQueueSize(key: string): number {
    return this.queues.get(key)?.length || 0;
  }

  clearQueue(key: string): void {
    this.queues.delete(key);
    this.processing.delete(key);
  }
}