/**
 * IndexedDB wrapper for offline storage
 *
 * Provides a promise-based API for storing data offline.
 */

interface DBSchema {
  projects: {
    key: string;
    value: {
      id: string;
      name: string;
      description?: string;
      lastModified: number;
      data: any;
    };
    indexes: { lastModified: number };
  };
  messages: {
    key: string;
    value: {
      id: string;
      conversationId: string;
      content: string;
      role: 'user' | 'assistant';
      timestamp: number;
      pending: boolean;
    };
    indexes: { conversationId: string; timestamp: number; pending: number };
  };
  cache: {
    key: string;
    value: {
      url: string;
      data: any;
      timestamp: number;
      expires: number;
    };
    indexes: { timestamp: number; expires: number };
  };
}

class OfflineDatabase {
  private db: IDBDatabase | null = null;
  private dbName = 'claudeflare-offline';
  private dbVersion = 1;

  /**
   * Open database connection
   */
  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('lastModified', 'lastModified', { unique: false });
        }

        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('conversationId', 'conversationId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          messageStore.createIndex('pending', 'pending', { unique: false });
        }

        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'url' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
          cacheStore.createIndex('expires', 'expires', { unique: false });
        }
      };
    });
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Add item to store
   */
  async add<T>(storeName: string, item: T): Promise<void> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Put item in store (update or insert)
   */
  async put<T>(storeName: string, item: T): Promise<void> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get item from store
   */
  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all items from store
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete item from store
   */
  async delete(storeName: string, key: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear store
   */
  async clear(storeName: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Query items by index
   */
  async queryByIndex<T>(
    storeName: string,
    indexName: string,
    value: any
  ): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get pending messages for sync
   */
  async getPendingMessages(): Promise<any[]> {
    return this.queryByIndex('messages', 'pending', 1);
  }

  /**
   * Cache API response
   */
  async cacheResponse(url: string, data: any, ttl: number = 5 * 60 * 1000): Promise<void> {
    await this.put('cache', {
      url,
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl,
    });
  }

  /**
   * Get cached response
   */
  async getCachedResponse(url: string): Promise<any | null> {
    const cached = await this.get<any>('cache', url);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expires < Date.now()) {
      await this.delete('cache', url);
      return null;
    }

    return cached.data;
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('cache', 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('expires');
      const request = index.openCursor(IDBKeyRange.upperBound(now));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const offlineDb = new OfflineDatabase();

/**
 * Hook to use offline database in React components
 */
export function useOfflineDB() {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    async function init() {
      await offlineDb.open();
      if (mounted) {
        setIsReady(true);
      }
    }

    init();

    // Clean expired cache on mount
    offlineDb.cleanExpiredCache();

    return () => {
      mounted = false;
      offlineDb.close();
    };
  }, []);

  return {
    isReady,
    db: offlineDb,
  };
}

import React from 'react';
