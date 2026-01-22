/**
 * Event Buffer
 * High-performance in-memory buffer for batching events
 */

import { EnrichedSecurityEvent } from '../types';

export class EventBuffer {
  private buffer: EnrichedSecurityEvent[];
  private capacity: number;
  private count: number = 0;

  constructor(capacity: number) {
    this.buffer = new Array(capacity);
    this.capacity = capacity;
  }

  /**
   * Add an event to the buffer
   */
  public add(event: EnrichedSecurityEvent): void {
    if (this.count >= this.capacity) {
      throw new Error('Buffer capacity exceeded');
    }

    this.buffer[this.count] = event;
    this.count++;
  }

  /**
   * Check if buffer should be flushed
   */
  public shouldFlush(): boolean {
    return this.count >= this.capacity;
  }

  /**
   * Flush all events from buffer
   */
  public flush(): EnrichedSecurityEvent[] {
    const events = this.buffer.slice(0, this.count);
    this.count = 0;
    return events;
  }

  /**
   * Get current buffer size
   */
  public size(): number {
    return this.count;
  }

  /**
   * Get buffer statistics
   */
  public getStats(): BufferStats {
    return {
      size: this.count,
      capacity: this.capacity,
      utilization: this.count / this.capacity,
      available: this.capacity - this.count,
    };
  }

  /**
   * Clear buffer
   */
  public clear(): void {
    this.count = 0;
  }

  /**
   * Peek at events without removing them
   */
  public peek(limit?: number): EnrichedSecurityEvent[] {
    return this.buffer.slice(0, Math.min(limit || this.count, this.count));
  }
}

export interface BufferStats {
  size: number;
  capacity: number;
  utilization: number;
  available: number;
}
