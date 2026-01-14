/**
 * Platform Event Bus Integration
 *
 * Unified event bus integration for all ClaudeFlare packages.
 */

import type {
  EventBus as IEventBus,
  PlatformEvent,
  EventHandler,
  EventPublishOptions,
} from '../types/events';

import type { EventBusClient } from '@claudeflare/events';

/**
 * Platform event bus
 */
export class PlatformEventBus implements IEventBus {
  private eventBusClient: EventBusClient;
  private localSubscriptions: Map<string, Set<EventHandler>>;
  private wildcardSubscriptions: Set<EventHandler>;
  private middleware: EventMiddleware[];
  private disposed: boolean;

  constructor(eventBusClient: EventBusClient) {
    this.eventBusClient = eventBusClient;
    this.localSubscriptions = new Map();
    this.wildcardSubscriptions = new Set();
    this.middleware = [];
    this.disposed = false;
  }

  /**
   * Publish an event
   */
  async publish<T = unknown>(
    event: string,
    data: T,
    options: EventPublishOptions = {}
  ): Promise<void> {
    this.assertNotDisposed();

    const platformEvent: PlatformEvent<T> = {
      id: this.generateEventId(),
      type: event,
      source: options.metadata?.source || 'platform',
      timestamp: Date.now(),
      data,
      correlationId: options.correlationId,
      causationId: options.causationId,
      metadata: options.metadata || {},
    };

    // Apply middleware
    let processedEvent = platformEvent;
    for (const mw of this.middleware) {
      processedEvent = await mw(processedEvent);
    }

    // Publish to remote event bus
    await this.eventBusClient.publish(event, processedEvent);

    // Execute local subscriptions
    await this.executeLocalSubscriptions(event, processedEvent);

    // Execute wildcard subscriptions
    await this.executeWildcardSubscriptions(processedEvent);
  }

  /**
   * Subscribe to events
   */
  subscribe<T = unknown>(
    event: string,
    handler: EventHandler<T>
  ): () => void {
    this.assertNotDisposed();

    if (!this.localSubscriptions.has(event)) {
      this.localSubscriptions.set(event, new Set());
    }

    this.localSubscriptions.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      const subscriptions = this.localSubscriptions.get(event);
      if (subscriptions) {
        subscriptions.delete(handler as EventHandler);
        if (subscriptions.size === 0) {
          this.localSubscriptions.delete(event);
        }
      }
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler): () => void {
    this.assertNotDisposed();

    this.wildcardSubscriptions.add(handler);

    return () => {
      this.wildcardSubscriptions.delete(handler);
    };
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(event: string, handler: EventHandler): void {
    const subscriptions = this.localSubscriptions.get(event);

    if (subscriptions) {
      subscriptions.delete(handler);

      if (subscriptions.size === 0) {
        this.localSubscriptions.delete(event);
      }
    }
  }

  /**
   * Request/response pattern
   */
  async request<TRequest = unknown, TResponse = unknown>(
    method: string,
    data: TRequest,
    timeout = 30000
  ): Promise<TResponse> {
    this.assertNotDisposed();

    const correlationId = this.generateEventId();

    return new Promise<TResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      const unsubscribe = this.subscribe<TResponse>(
        `${method}:response`,
        (event) => {
          if (event.data.correlationId === correlationId) {
            clearTimeout(timer);
            unsubscribe();
            resolve(event.data);
          }
        }
      );

      // Publish request
      this.publish(method, { ...data, correlationId } as TRequest).catch(
        (error) => {
          clearTimeout(timer);
          unsubscribe();
          reject(error);
        }
      );
    });
  }

  /**
   * Respond to requests
   */
  respond<TRequest = unknown, TResponse = unknown>(
    method: string,
    handler: (data: TRequest) => TResponse | Promise<TResponse>
  ): () => void {
    const unsubscribe = this.subscribe<TRequest>(
      method,
      async (event) => {
        try {
          const response = await handler(event.data);
          await this.publish(`${method}:response`, {
            ...response,
            correlationId: event.data.correlationId,
          } as TResponse);
        } catch (error) {
          await this.publish(`${method}:response`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            correlationId: event.data.correlationId,
          } as TResponse);
        }
      }
    );

    return unsubscribe;
  }

  /**
   * Add middleware
   */
  use(middleware: EventMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Dispose of event bus
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Clear subscriptions
    this.localSubscriptions.clear();
    this.wildcardSubscriptions.clear();
    this.middleware = [];
  }

  private async executeLocalSubscriptions<T>(
    event: string,
    platformEvent: PlatformEvent<T>
  ): Promise<void> {
    const subscriptions = this.localSubscriptions.get(event);

    if (!subscriptions) {
      return;
    }

    const promises = Array.from(subscriptions).map(async (handler) => {
      try {
        await handler(platformEvent);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  private async executeWildcardSubscriptions<T>(
    platformEvent: PlatformEvent<T>
  ): Promise<void> {
    const promises = Array.from(this.wildcardSubscriptions).map(
      async (handler) => {
        try {
          await handler(platformEvent);
        } catch (error) {
          console.error(
            `Error in wildcard event handler for ${platformEvent.type}:`,
            error
          );
        }
      }
    );

    await Promise.allSettled(promises);
  }

  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('EventBus has been disposed');
    }
  }
}

/**
 * Event middleware
 */
export type EventMiddleware = (
  event: PlatformEvent
) => PlatformEvent | Promise<PlatformEvent>;

/**
 * Event bus aggregator
 */
export class EventBusAggregator {
  private eventBuses: Map<string, PlatformEventBus>;
  private primaryBus: PlatformEventBus;

  constructor(primaryBus: PlatformEventBus) {
    this.primaryBus = primaryBus;
    this.eventBuses = new Map();
    this.eventBuses.set('primary', primaryBus);
  }

  /**
   * Add an event bus
   */
  add(name: string, bus: PlatformEventBus): this {
    this.eventBuses.set(name, bus);
    return this;
  }

  /**
   * Remove an event bus
   */
  remove(name: string): this {
    this.eventBuses.delete(name);
    return this;
  }

  /**
   * Publish to all event buses
   */
  async publish<T = unknown>(
    event: string,
    data: T,
    options?: EventPublishOptions
  ): Promise<void> {
    const promises = Array.from(this.eventBuses.values()).map((bus) =>
      bus.publish(event, data, options)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Subscribe to primary bus
   */
  subscribe<T = unknown>(
    event: string,
    handler: EventHandler<T>
  ): () => void {
    return this.primaryBus.subscribe(event, handler);
  }

  /**
   * Subscribe to all buses
   */
  subscribeAllBuses<T = unknown>(
    event: string,
    handler: EventHandler<T>
  ): () => void {
    const unsubscribers: Array<() => void> = [];

    for (const bus of this.eventBuses.values()) {
      unsubscribers.push(bus.subscribe(event, handler));
    }

    // Return combined unsubscribe
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }

  /**
   * Dispose all buses
   */
  async dispose(): Promise<void> {
    for (const bus of this.eventBuses.values()) {
      await bus.dispose();
    }

    this.eventBuses.clear();
  }
}

/**
 * Event replay buffer
 */
export class EventReplayBuffer {
  private events: PlatformEvent[] = [];
  private maxSize: number;
  private maxAge: number;

  constructor(maxSize = 1000, maxAge = 3600000) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  /**
   * Add an event to the buffer
   */
  add(event: PlatformEvent): void {
    this.events.push(event);
    this.prune();
  }

  /**
   * Get events from buffer
   */
  get(filter?: (event: PlatformEvent) => boolean): PlatformEvent[] {
    let filtered = this.events;

    if (filter) {
      filtered = this.events.filter(filter);
    }

    return [...filtered];
  }

  /**
   * Replay events
   */
  async replay(
    handler: EventHandler,
    filter?: (event: PlatformEvent) => boolean
  ): Promise<void> {
    const events = this.get(filter);

    for (const event of events) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Error replaying event:', error);
      }
    }
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Prune old events
   */
  private prune(): void {
    const now = Date.now();

    // Remove old events
    this.events = this.events.filter(
      (event) => now - event.timestamp < this.maxAge
    );

    // Limit size
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(-this.maxSize);
    }
  }
}

/**
 * Common event middleware
 */
export const EventMiddleware = {
  /**
   * Logging middleware
   */
  logging: (): EventMiddleware => {
    return async (event) => {
      console.log(`[EventBus] ${event.type}:`, event.data);
      return event;
    };
  },

  /**
   * Metrics middleware
   */
  metrics: (metrics: {
    increment: (name: string, value?: number) => void;
  }): EventMiddleware => {
    return async (event) => {
      metrics.increment(`events.${event.type}`);
      metrics.increment('events.total');
      return event;
    };
  },

  /**
   * Validation middleware
   */
  validation: (
    schema: (event: PlatformEvent) => boolean
  ): EventMiddleware => {
    return async (event) => {
      if (!schema(event)) {
        throw new Error(`Event validation failed: ${event.type}`);
      }
      return event;
    };
  },

  /**
   * Transformation middleware
   */
  transform: (
    transform: (event: PlatformEvent) => PlatformEvent
  ): EventMiddleware => {
    return async (event) => {
      return transform(event);
    };
  },

  /**
   * Filtering middleware
   */
  filter: (filter: (event: PlatformEvent) => boolean): EventMiddleware => {
    return async (event) => {
      if (!filter(event)) {
        throw new Error(`Event filtered: ${event.type}`);
      }
      return event;
    };
  },

  /**
   * Enrichment middleware
   */
  enrich: (
    enrich: (event: PlatformEvent) => Record<string, unknown>
  ): EventMiddleware => {
    return async (event) => {
      const metadata = enrich(event);
      return {
        ...event,
        metadata: { ...event.metadata, ...metadata },
      };
    };
  },
};
