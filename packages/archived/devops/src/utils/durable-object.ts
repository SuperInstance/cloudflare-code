/**
 * Durable Object state management for coordination
 */

import { Logger } from './logger';

export interface DurableObjectStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

export class DurableObjectCoordinator {
  private logger: Logger;
  private storage: Map<string, any>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.storage = new Map();
  }

  /**
   * Acquire a distributed lock
   */
  async acquireLock(
    resource: string,
    timeout: number = 30000
  ): Promise<() => Promise<void>> {
    const lockKey = `lock:${resource}`;
    const lockId = `${Date.now()}-${Math.random()}`;

    this.logger.debug('Attempting to acquire lock', { resource, lockId });

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentLock = this.storage.get(lockKey);

      if (!currentLock || Date.now() - currentLock.timestamp > timeout) {
        this.storage.set(lockKey, {
          lockId,
          timestamp: Date.now(),
        });

        this.logger.debug('Lock acquired', { resource, lockId });

        // Return release function
        return async () => {
          const storedLock = this.storage.get(lockKey);
          if (storedLock?.lockId === lockId) {
            this.storage.delete(lockKey);
            this.logger.debug('Lock released', { resource, lockId });
          }
        };
      }

      await this.sleep(100);
    }

    throw new Error(`Failed to acquire lock for ${resource} within ${timeout}ms`);
  }

  /**
   * Get state from storage
   */
  async get(key: string): Promise<any> {
    return this.storage.get(key);
  }

  /**
   * Set state in storage
   */
  async set(key: string, value: any): Promise<void> {
    this.storage.set(key, value);
  }

  /**
   * Delete state from storage
   */
  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  /**
   * List all keys
   */
  async list(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * In-memory storage implementation for development
 */
export class InMemoryStorage implements DurableObjectStorage {
  private storage = new Map<string, any>();

  async get(key: string): Promise<any> {
    return this.storage.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}
