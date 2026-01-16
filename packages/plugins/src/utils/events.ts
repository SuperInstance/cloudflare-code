// @ts-nocheck
/**
 * Event emitter implementation
 */

import type { EventEmitter as IEventEmitter } from '../types';

/**
 * Event listener
 */
type EventListener = (...args: unknown[]) => void | Promise<void>;

/**
 * Event entry
 */
interface EventEntry {
  listener: EventListener;
  once: boolean;
}

/**
 * Event emitter implementation
 */
export class EventEmitterImpl implements IEventEmitter {
  private listeners: Map<string, EventEntry[]> = new Map();
  private maxListeners = 100;

  on(event: string, handler: (...args: unknown[]) => void): void {
    this.addListener(event, handler, false);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }

    const index = listeners.findIndex((e) => e.listener === handler);
    if (index !== -1) {
      listeners.splice(index, 1);
    }

    if (listeners.length === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }

    // Create a copy to avoid issues if listeners are modified during emit
    const entries = [...listeners];

    for (const entry of entries) {
      try {
        entry.listener(...args);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }

      if (entry.once) {
        this.off(event, entry.listener);
      }
    }
  }

  once(event: string, handler: (...args: unknown[]) => void): void {
    this.addListener(event, handler, true);
  }

  /**
   * Add listener
   */
  private addListener(event: string, handler: EventListener, once: boolean): void {
    let listeners = this.listeners.get(event);

    if (!listeners) {
      listeners = [];
      this.listeners.set(event, listeners);
    }

    // Check max listeners
    if (listeners.length >= this.maxListeners) {
      console.warn(
        `Max listeners (${this.maxListeners}) reached for event '${event}'. ` +
        'This may indicate a memory leak.'
      );
    }

    listeners.push({ listener: handler, once });
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count
   */
  listenerCount(event?: string): number {
    if (event) {
      return this.listeners.get(event)?.length || 0;
    }

    let total = 0;
    for (const listeners of this.listeners.values()) {
      total += listeners.length;
    }
    return total;
  }

  /**
   * Get event names
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Set max listeners
   */
  setMaxListeners(n: number): void {
    this.maxListeners = n;
  }

  /**
   * Get max listeners
   */
  getMaxListeners(): number {
    return this.maxListeners;
  }

  /**
   * Get listeners for an event
   */
  listeners(event: string): EventListener[] {
    const entries = this.listeners.get(event);
    return entries ? entries.map((e) => e.listener) : [];
  }

  /**
   * Get raw listener entries
   */
  rawListeners(event: string): Array<{ listener: EventListener; once: boolean }> {
    return this.listeners.get(event) || [];
  }
}

/**
 * Create an event emitter
 */
export function createEventEmitter(): EventEmitterImpl {
  return new EventEmitterImpl();
}

/**
 * Typed event emitter
 */
export class TypedEventEmitter<TEvents extends Record<string, unknown[]>> {
  private emitter = new EventEmitterImpl();

  on<TEventName extends keyof TEvents>(
    event: TEventName,
    handler: (...args: TEvents[TEventName]) => void
  ): void {
    this.emitter.on(event as string, handler as (...args: unknown[]) => void);
  }

  off<TEventName extends keyof TEvents>(
    event: TEventName,
    handler: (...args: TEvents[TEventName]) => void
  ): void {
    this.emitter.off(event as string, handler as (...args: unknown[]) => void);
  }

  emit<TEventName extends keyof TEvents>(
    event: TEventName,
    ...args: TEvents[TEventName]
  ): void {
    this.emitter.emit(event as string, ...args);
  }

  once<TEventName extends keyof TEvents>(
    event: TEventName,
    handler: (...args: TEvents[TEventName]) => void
  ): void {
    this.emitter.once(event as string, handler as (...args: unknown[]) => void);
  }

  removeAllListeners(event?: keyof TEvents): void {
    this.emitter.removeAllListeners(event as string);
  }
}
