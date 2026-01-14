/**
 * Event Handler - handles event-based triggers
 */

import type { Trigger, TriggerCallback, TriggerId, EventTriggerConfig } from '../types';

export class EventHandler {
  private events: Map<TriggerId, EventTriggerConfig>;
  private eventListeners: Map<string, Set<TriggerId>>;
  private callbacks: Map<TriggerId, TriggerCallback>;

  constructor() {
    this.events = new Map();
    this.eventListeners = new Map();
    this.callbacks = new Map();
  }

  /**
   * Register an event trigger
   */
  public async register(
    trigger: Trigger,
    callback: TriggerCallback
  ): Promise<void> {
    const config = trigger.config as EventTriggerConfig;

    this.events.set(trigger.id, config);
    this.callbacks.set(trigger.id, callback);

    // Add to event listeners
    if (!this.eventListeners.has(config.eventType)) {
      this.eventListeners.set(config.eventType, new Set());
    }
    this.eventListeners.get(config.eventType)!.add(trigger.id);
  }

  /**
   * Unregister an event trigger
   */
  public async unregister(triggerId: TriggerId): Promise<void> {
    const config = this.events.get(triggerId);
    if (config) {
      const listeners = this.eventListeners.get(config.eventType);
      if (listeners) {
        listeners.delete(triggerId);
        if (listeners.size === 0) {
          this.eventListeners.delete(config.eventType);
        }
      }
    }

    this.events.delete(triggerId);
    this.callbacks.delete(triggerId);
  }

  /**
   * Emit an event
   */
  public async emit(eventType: string, data: any): Promise<void> {
    const triggerIds = this.eventListeners.get(eventType);

    if (!triggerIds || triggerIds.size === 0) {
      return;
    }

    // Execute all callbacks for this event type
    const executions = Array.from(triggerIds).map(async triggerId => {
      const config = this.events.get(triggerId);
      const callback = this.callbacks.get(triggerId);

      if (config && callback) {
        // Check filters if configured
        if (config.filters && !this.matchFilters(config.filters, data)) {
          return;
        }

        await callback(triggerId, {
          eventType,
          data,
          timestamp: new Date()
        });
      }
    });

    await Promise.all(executions);
  }

  /**
   * Match event data against filters
   */
  private matchFilters(filters: Record<string, any>, data: any): boolean {
    for (const [key, expectedValue] of Object.entries(filters)) {
      const actualValue = this.getNestedValue(data, key);

      if (actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get all registered event types
   */
  public getEventTypes(): string[] {
    return Array.from(this.eventListeners.keys());
  }

  /**
   * Get event statistics
   */
  public getStats(): {
    totalEvents: number;
    eventTypes: string[];
    listenersByType: Record<string, number>;
  } {
    const listenersByType: Record<string, number> = {};

    for (const [eventType, listeners] of this.eventListeners) {
      listenersByType[eventType] = listeners.size;
    }

    return {
      totalEvents: this.events.size,
      eventTypes: this.getEventTypes(),
      listenersByType
    };
  }

  /**
   * Cleanup
   */
  public async cleanup(): Promise<void> {
    this.events.clear();
    this.eventListeners.clear();
    this.callbacks.clear();
  }
}
