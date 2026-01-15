/**
 * Unified Event Bus
 *
 * Event-driven communication system for inter-package messaging.
 * Supports pub/sub, event filtering, correlation, and persistence.
 */

import type {
  PackageEvent,
  PackageIdentifier,
  EventSubscription,
} from './types';

/**
 * Event filter function
 */
export type EventFilter = (event: PackageEvent) => boolean;

/**
 * Event handler function
 */
export type EventHandler = (event: PackageEvent) => void | Promise<void>;

/**
 * Event subscription options
 */
export interface EventSubscriptionOptions {
  /**
   * Filter events by type
   */
  eventTypes?: string[];

  /**
   * Filter events by source
   */
  sources?: PackageIdentifier[];

  /**
   * Custom filter function
   */
  filter?: EventFilter;

  /**
   * One-time subscription (unsubscribe after first event)
   */
  once?: boolean;

  /**
   * Maximum number of events to receive
   */
  maxEvents?: number;

  /**
   * Subscription ID (auto-generated if not provided)
   */
  id?: string;

  /**
   * Subscription metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Published event status
 */
export interface PublishResult {
  /**
   * Event ID
   */
  eventId: string;

  /**
   * Number of subscribers notified
   */
  notifiedCount: number;

  /**
   * Number of subscribers that failed
   */
  failedCount: number;

  /**
   * Publishing timestamp
   */
  timestamp: number;
}

/**
 * Event bus configuration
 */
export interface EventBusConfig {
  /**
   * Enable event persistence
   */
  enablePersistence?: boolean;

  /**
   * Event retention time in milliseconds
   */
  eventRetention?: number;

  /**
   * Maximum events to retain in memory
   */
  maxEvents?: number;

  /**
   * Enable event replay
   */
  enableReplay?: boolean;

  /**
   * Enable distributed event bus
   */
  enableDistributed?: boolean;

  /**
   * KV namespace for persistence
   */
  kv?: KVNamespace;

  /**
   * Durable Object namespace for distributed coordination
   */
  doNamespace?: DurableObjectNamespace;

  /**
   * Callback for errors
   */
  onError?: (error: Error, context: {
    event?: PackageEvent;
    subscription?: EventSubscription;
  }) => void;
}

/**
 * Event bus statistics
 */
export interface EventBusStats {
  /**
   * Total events published
   */
  totalPublished: number;

  /**
   * Total events received (by all subscribers)
   */
  totalReceived: number;

  /**
   * Total events failed
   */
  totalFailed: number;

  /**
   * Active subscriptions
   */
  activeSubscriptions: number;

  /**
   * Total subscriptions created
   */
  totalSubscriptions: number;

  /**
   * Events by type
   */
  eventsByType: Map<string, number>;

  /**
   * Average processing time in milliseconds
   */
  avgProcessingTime: number;

  /**
   * Current event count in memory
   */
  currentEventCount: number;
}

/**
 * Event replay options
 */
export interface EventReplayOptions {
  /**
   * Replay events from timestamp
   */
  from?: number;

  /**
   * Replay events until timestamp
   */
  to?: number;

  /**
   * Filter by event types
   */
  eventTypes?: string[];

  /**
   * Filter by sources
   */
  sources?: PackageIdentifier[];

  /**
   * Maximum events to replay
   */
  maxEvents?: number;

  /**
   * Replay speed multiplier (1 = real-time, 2 = 2x speed)
   */
  speed?: number;
}

/**
 * Unified Event Bus
 *
 * Manages event-driven communication between packages.
 */
export class EventBus {
  private kv?: KVNamespace;
  private doNamespace?: DurableObjectNamespace;
  private options: Required<Omit<EventBusConfig, 'kv' | 'doNamespace' | 'onError'>> & {
    kv?: KVNamespace;
    doNamespace?: DurableObjectNamespace;
    onError?: EventBusConfig['onError'];
  };

  // Event storage
  private events: PackageEvent[] = [];

  // Subscriptions
  private subscriptions: Map<string, EventSubscription>;
  private subscriptionsByType: Map<string, Set<string>>;
  private subscriptionsBySource: Map<string, Set<string>>;

  // Statistics
  private stats: EventBusStats;
  private eventCounter: number;
  private subscriptionCounter: number;

  constructor(config: EventBusConfig = {}) {
    if (config.kv !== undefined) {
      this.kv = config.kv;
    }
    if (config.doNamespace !== undefined) {
      this.doNamespace = config.doNamespace;
    }

    this.options = {
      enablePersistence: config.enablePersistence ?? true,
      eventRetention: config.eventRetention ?? 3600000, // 1 hour
      maxEvents: config.maxEvents ?? 10000,
      enableReplay: config.enableReplay ?? true,
      enableDistributed: config.enableDistributed ?? false,
      kv: config.kv,
      doNamespace: config.doNamespace,
      onError: config.onError,
    };

    this.subscriptions = new Map();
    this.subscriptionsByType = new Map();
    this.subscriptionsBySource = new Map();

    this.stats = {
      totalPublished: 0,
      totalReceived: 0,
      totalFailed: 0,
      activeSubscriptions: 0,
      totalSubscriptions: 0,
      eventsByType: new Map(),
      avgProcessingTime: 0,
      currentEventCount: 0,
    };

    this.eventCounter = 0;
    this.subscriptionCounter = 0;

    // Load persisted state
    this.loadState();

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Publish an event
   */
  async publish(
    type: string,
    source: PackageIdentifier,
    data: unknown,
    metadata?: {
      correlationId?: string;
      causationId?: string;
      version?: string;
    }
  ): Promise<PublishResult> {
    const event: PackageEvent = {
      id: this.generateEventId(),
      type,
      source,
      timestamp: Date.now(),
      data,
      metadata: {
        ...metadata,
        correlationId: metadata?.correlationId ?? this.generateCorrelationId(),
      },
    };

    // Store event
    this.events.push(event);
    this.stats.totalPublished++;
    this.stats.currentEventCount = this.events.length;

    // Track by type
    const typeCount = this.stats.eventsByType.get(type) ?? 0;
    this.stats.eventsByType.set(type, typeCount + 1);

    // Trim events if needed
    if (this.events.length > this.options.maxEvents) {
      this.events.shift();
    }

    // Persist event
    if (this.options.enablePersistence && this.kv) {
      await this.persistEvent(event);
    }

    // Find matching subscriptions
    const matchingSubscriptions = this.findMatchingSubscriptions(event);

    // Notify subscribers
    let notifiedCount = 0;
    let failedCount = 0;

    for (const subscription of matchingSubscriptions) {
      try {
        const startTime = Date.now();

        await subscription.handler(event);

        // Update stats
        this.stats.totalReceived++;
        notifiedCount++;

        // Update processing time
        const processingTime = Date.now() - startTime;
        const currentAvg = this.stats.avgProcessingTime;
        const currentTotal = this.stats.totalReceived;
        this.stats.avgProcessingTime =
          (currentAvg * (currentTotal - 1) + processingTime) / currentTotal;

        // Handle one-time subscriptions
        if (subscription.id.startsWith('once_')) {
          await this.unsubscribe(subscription.id);
        }

        // Handle max events
        const received = (subscription.metadata?.['received'] as number) ?? 0;
        const maxEvents = subscription.metadata?.['maxEvents'] as number | undefined;
        if (maxEvents && received >= maxEvents) {
          await this.unsubscribe(subscription.id);
        } else {
          subscription.metadata = {
            ...subscription.metadata,
            received: received + 1,
          };
        }
      } catch (error) {
        failedCount++;
        this.stats.totalFailed++;

        if (this.options.onError) {
          this.options.onError(error as Error, {
            event,
            subscription,
          });
        }
      }
    }

    return {
      eventId: event.id,
      notifiedCount,
      failedCount,
      timestamp: event.timestamp,
    };
  }

  /**
   * Subscribe to events
   */
  async subscribe(
    subscriber: PackageIdentifier,
    handler: EventHandler,
    options?: EventSubscriptionOptions
  ): Promise<string> {
    const subscriptionId =
      options?.id ??
      (options?.once ? `once_${this.generateSubscriptionId()}` : this.generateSubscriptionId());

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventTypes: options?.eventTypes ?? [],
      subscriber,
      filter: options?.filter,
      handler,
    };

    // Store subscription metadata
    subscription.metadata = {
      ...options?.metadata,
      maxEvents: options?.maxEvents,
      received: 0,
    };

    // Add to subscriptions
    this.subscriptions.set(subscriptionId, subscription);

    // Index by type
    if (options?.eventTypes) {
      for (const eventType of options.eventTypes) {
        let subs = this.subscriptionsByType.get(eventType);
        if (!subs) {
          subs = new Set();
          this.subscriptionsByType.set(eventType, subs);
        }
        subs.add(subscriptionId);
      }
    }

    // Index by source
    if (options?.sources) {
      for (const source of options.sources) {
        const sourceKey = this.getSourceKey(source);
        let subs = this.subscriptionsBySource.get(sourceKey);
        if (!subs) {
          subs = new Set();
          this.subscriptionsBySource.set(sourceKey, subs);
        }
        subs.add(subscriptionId);
      }
    }

    // Update stats
    this.stats.activeSubscriptions = this.subscriptions.size;
    this.stats.totalSubscriptions++;

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Remove from subscriptions
    this.subscriptions.delete(subscriptionId);

    // Remove from type index
    for (const eventType of subscription.eventTypes) {
      const subs = this.subscriptionsByType.get(eventType);
      if (subs) {
        subs.delete(subscriptionId);
        if (subs.size === 0) {
          this.subscriptionsByType.delete(eventType);
        }
      }
    }

    // Remove from source index
    const sourceKey = this.getSourceKey(subscription.subscriber);
    const subs = this.subscriptionsBySource.get(sourceKey);
    if (subs) {
      subs.delete(subscriptionId);
      if (subs.size === 0) {
        this.subscriptionsBySource.delete(sourceKey);
      }
    }

    // Update stats
    this.stats.activeSubscriptions = this.subscriptions.size;

    return true;
  }

  /**
   * Get all events
   */
  getEvents(filter?: {
    types?: string[];
    sources?: PackageIdentifier[];
    from?: number;
    to?: number;
  }): PackageEvent[] {
    let filtered = this.events;

    if (filter?.types) {
      filtered = filtered.filter((e) => filter.types!.includes(e.type));
    }

    if (filter?.sources) {
      const sourceKeys = new Set(filter.sources.map((s) => this.getSourceKey(s)));
      filtered = filtered.filter((e) => sourceKeys.has(this.getSourceKey(e.source)));
    }

    if (filter?.from) {
      filtered = filtered.filter((e) => e.timestamp >= filter.from!);
    }

    if (filter?.to) {
      filtered = filtered.filter((e) => e.timestamp <= filter.to!);
    }

    return filtered;
  }

  /**
   * Replay events
   */
  async replay(
    handler: EventHandler,
    options?: EventReplayOptions
  ): Promise<number> {
    let events = this.events;

    // Filter by time range
    if (options?.from !== undefined) {
      events = events.filter((e) => e.timestamp >= options.from!);
    }

    if (options?.to !== undefined) {
      events = events.filter((e) => e.timestamp <= options.to!);
    }

    // Filter by types
    if (options?.eventTypes) {
      events = events.filter((e) => options.eventTypes!.includes(e.type));
    }

    // Filter by sources
    if (options?.sources) {
      const sourceKeys = new Set(options.sources.map((s) => this.getSourceKey(s)));
      events = events.filter((e) => sourceKeys.has(this.getSourceKey(e.source)));
    }

    // Limit events
    if (options?.maxEvents) {
      events = events.slice(0, options.maxEvents);
    }

    // Replay events
    let count = 0;
    const speed = options?.speed ?? 1;

    for (const event of events) {
      await handler(event);
      count++;

      // Apply replay speed
      if (speed < 1 && count < events.length) {
        const nextEvent = events[count];
        const delay = (nextEvent.timestamp - event.timestamp) / speed;
        await this.delay(delay);
      }
    }

    return count;
  }

  /**
   * Clear old events
   */
  async clearEvents(olderThan?: number): Promise<number> {
    const cutoff = olderThan ?? Date.now() - this.options.eventRetention;
    const beforeCount = this.events.length;

    this.events = this.events.filter((e) => e.timestamp >= cutoff);
    this.stats.currentEventCount = this.events.length;

    const cleared = beforeCount - this.events.length;

    if (cleared > 0 && this.options.enablePersistence && this.kv) {
      await this.saveState();
    }

    return cleared;
  }

  /**
   * Get statistics
   */
  getStats(): EventBusStats {
    return {
      ...this.stats,
      eventsByType: new Map(this.stats.eventsByType),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalPublished: 0,
      totalReceived: 0,
      totalFailed: 0,
      activeSubscriptions: this.subscriptions.size,
      totalSubscriptions: this.stats.totalSubscriptions,
      eventsByType: new Map(),
      avgProcessingTime: 0,
      currentEventCount: this.events.length,
    };
  }

  /**
   * Find subscriptions matching an event
   */
  private findMatchingSubscriptions(event: PackageEvent): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      // Check type filter
      if (
        subscription.eventTypes.length > 0 &&
        !subscription.eventTypes.includes(event.type)
      ) {
        continue;
      }

      // Check custom filter
      if (subscription.filter && !subscription.filter(event)) {
        continue;
      }

      matching.push(subscription);
    }

    return matching;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${++this.eventCounter}`;
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${++this.subscriptionCounter}`;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get source key for indexing
   */
  private getSourceKey(source: PackageIdentifier): string {
    return `${source.name}@${source.version}`;
  }

  /**
   * Persist event to KV
   */
  private async persistEvent(event: PackageEvent): Promise<void> {
    if (!this.kv) return;

    try {
      const key = `event:${event.id}`;
      await this.kv.put(key, JSON.stringify(event), {
        expirationTtl: Math.floor(this.options.eventRetention / 1000),
      });
    } catch (error) {
      console.error('Failed to persist event:', error);
    }
  }

  /**
   * Load state from persistence
   */
  private async loadState(): Promise<void> {
    if (!this.kv || !this.options.enablePersistence) return;

    try {
      // Load recent events
      const list = await this.kv.list({ prefix: 'event:' });
      const events: PackageEvent[] = [];

      for (const key of list.keys.slice(-1000)) {
        const data = await this.kv.get(key.name, 'json');
        if (data) {
          events.push(data as PackageEvent);
        }
      }

      this.events = events.sort((a, b) => a.timestamp - b.timestamp);
      this.stats.currentEventCount = this.events.length;
    } catch (error) {
      console.error('Failed to load event bus state:', error);
    }
  }

  /**
   * Save state to persistence
   */
  private async saveState(): Promise<void> {
    if (!this.kv) return;

    try {
      // Events are already persisted individually
      // Just save subscription state
      await this.kv.put(
        'event-bus-subscriptions',
        JSON.stringify(Array.from(this.subscriptions.entries())),
        {
          expirationTtl: Math.floor(this.options.eventRetention / 1000),
        }
      );
    } catch (error) {
      console.error('Failed to save event bus state:', error);
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    // Clean up old events every 5 minutes
    setInterval(
      () => {
        void this.clearEvents();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Dispose of event bus resources
   */
  dispose(): void {
    this.subscriptions.clear();
    this.subscriptionsByType.clear();
    this.subscriptionsBySource.clear();
    this.events = [];
  }
}

/**
 * Create an event bus
 */
export function createEventBus(config?: EventBusConfig): EventBus {
  return new EventBus(config);
}
