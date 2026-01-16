/**
 * Real-time log streaming with filters and subscriptions
 */

// @ts-nocheck - LogLevel enum issues
import { LogEntry, LogFilter, LogLevel } from '../types';

export type LogStreamCallback = (entry: LogEntry) => void;
export type LogFilterCallback = (entry: LogEntry) => boolean;

export interface LogSubscription {
  id: string;
  filter: LogFilter | LogFilterCallback;
  callback: LogStreamCallback;
  createdAt: number;
}

export class LogStream {
  private subscriptions: Map<string, LogSubscription> = new Map();
  private buffer: LogEntry[] = [];
  private maxBufferSize: number = 1000;
  private enabled: boolean = true;

  /**
   * Subscribe to log entries
   */
  subscribe(
    filter: LogFilter | LogFilterCallback,
    callback: LogStreamCallback
  ): () => void {
    const subscription: LogSubscription = {
      id: this.generateId(),
      filter,
      callback,
      createdAt: Date.now(),
    };

    this.subscriptions.set(subscription.id, subscription);

    // Send buffered entries that match
    for (const entry of this.buffer) {
      if (this.matchesFilter(entry, filter)) {
        try {
          callback(entry);
        } catch (error) {
          console.error('Error in log stream callback:', error);
        }
      }
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(subscription.id);
    };
  }

  /**
   * Publish a log entry to all matching subscriptions
   */
  publish(entry: LogEntry): void {
    if (!this.enabled) {
      return;
    }

    // Add to buffer
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Notify subscribers
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesFilter(entry, subscription.filter)) {
        try {
          subscription.callback(entry);
        } catch (error) {
          console.error('Error in log stream callback:', error);
        }
      }
    }
  }

  /**
   * Check if an entry matches a filter
   */
  private matchesFilter(
    entry: LogEntry,
    filter: LogFilter | LogFilterCallback
  ): boolean {
    if (typeof filter === 'function') {
      return filter(entry);
    }

    // LogFilter object
    if (filter.levels && !filter.levels.includes(entry.level)) {
      return false;
    }
    if (filter.startTime && entry.timestamp < filter.startTime) {
      return false;
    }
    if (filter.endTime && entry.timestamp > filter.endTime) {
      return false;
    }
    if (filter.traceId && entry.traceId !== filter.traceId) {
      return false;
    }
    if (filter.userId && entry.attributes['user.id'] !== filter.userId) {
      return false;
    }
    if (filter.requestId && entry.requestId !== filter.requestId) {
      return false;
    }
    if (filter.minLevel) {
      const levels = [
        LogLevel.TRACE,
        LogLevel.DEBUG,
        LogLevel.INFO,
        LogLevel.WARN,
        LogLevel.ERROR,
        LogLevel.FATAL,
      ];
      if (levels.indexOf(entry.level) < levels.indexOf(filter.minLevel)) {
        return false;
      }
    }
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const text = JSON.stringify(entry).toLowerCase();
      if (!text.includes(query)) {
        return false;
      }
    }
    if (filter.attributes) {
      for (const [key, value] of Object.entries(filter.attributes)) {
        if (entry.attributes[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Enable or disable streaming
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * Get all subscriptions
   */
  getSubscriptions(): LogSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Remove a subscription
   */
  unsubscribe(id: string): boolean {
    return this.subscriptions.delete(id);
  }

  /**
   * Remove all subscriptions
   */
  unsubscribeAll(): void {
    this.subscriptions.clear();
  }

  /**
   * Get buffer contents
   */
  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    subscriptionCount: number;
    bufferSize: number;
    enabled: boolean;
  } {
    return {
      subscriptionCount: this.subscriptions.size,
      bufferSize: this.buffer.length,
      enabled: this.enabled,
    };
  }
}
