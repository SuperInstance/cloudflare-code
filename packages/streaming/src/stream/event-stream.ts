// @ts-nocheck
/**
 * Real-time event streaming implementation
 * Supports SSE, WebSocket, batching, filtering, and multiplexing
 */

import type {
  StreamEvent,
  EventFilter,
  StreamOptions,
  SSEConnection,
  WebSocketConnection,
  SSEEvent,
  StreamStats,
  RetentionPolicy
} from '../types/index.js';
import { generateEventId } from '../utils/id-generator.js';

// ============================================================================
// Event Stream Core
// ============================================================================

export class EventStream {
  private events: Map<string, StreamEvent> = new Map();
  private connections: Map<string, SSEConnection | WebSocketConnection> = new Map();
  private filters: Map<string, EventFilter[]> = new Map();
  private stats: StreamStats;
  private options: Required<StreamOptions>;

  constructor(options: StreamOptions = {}) {
    this.options = {
      batchSize: options.batchSize ?? 100,
      batchTimeout: options.batchTimeout ?? 100,
      compression: options.compression ?? false,
      encryption: options.encryption ?? false,
      retention: options.retention ?? {
        duration: 24 * 60 * 60 * 1000, // 24 hours
        maxEvents: 1000000,
        maxSize: 1024 * 1024 * 1024, // 1GB
      },
    };

    this.stats = {
      eventCount: 0,
      byteSize: 0,
      lastEventTime: 0,
      firstEventTime: 0,
      averageEventRate: 0,
    };

    // Start periodic cleanup
    this.startCleanup();
  }

  // ========================================================================
  // Event Publishing
  // ========================================================================

  /**
   * Publish an event to the stream
   */
  async publish<T>(type: string, data: T, metadata?: Record<string, unknown>): Promise<StreamEvent<T>> {
    const event: StreamEvent<T> = {
      id: generateEventId(),
      type,
      data,
      timestamp: Date.now(),
      metadata: metadata as any,
    };

    // Store event
    this.events.set(event.id, event);

    // Update stats
    this.updateStats(event);

    // Broadcast to connections
    await this.broadcast(event);

    return event;
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch<T>(events: Array<{ type: string; data: T; metadata?: Record<string, unknown> }>): Promise<StreamEvent<T>[]> {
    const publishedEvents: StreamEvent<T>[] = [];

    for (const { type, data, metadata } of events) {
      const event = await this.publish(type, data, metadata);
      publishedEvents.push(event);
    }

    return publishedEvents;
  }

  // ========================================================================
  // Subscription
  // ========================================================================

  /**
   * Subscribe to the stream with SSE
   */
  subscribeSSE(
    clientId: string,
    filters?: EventFilter[],
    retry: number = 3000
  ): SSEConnection {
    const connection: SSEConnection = {
      id: generateEventId(),
      clientId,
      filters,
      retry,
      connectedAt: Date.now(),
    };

    this.connections.set(connection.id, connection);

    if (filters) {
      this.filters.set(connection.id, filters);
    }

    return connection;
  }

  /**
   * Subscribe to the stream with WebSocket
   */
  subscribeWebSocket(
    clientId: string,
    filters?: EventFilter[],
    subprotocol?: string
  ): WebSocketConnection {
    const connection: WebSocketConnection = {
      id: generateEventId(),
      clientId,
      filters,
      connectedAt: Date.now(),
      subprotocol,
    };

    this.connections.set(connection.id, connection);

    if (filters) {
      this.filters.set(connection.id, filters);
    }

    return connection;
  }

  /**
   * Unsubscribe from the stream
   */
  unsubscribe(connectionId: string): void {
    this.connections.delete(connectionId);
    this.filters.delete(connectionId);
  }

  /**
   * Unsubscribe all connections for a client
   */
  unsubscribeClient(clientId: string): void {
    for (const [id, connection] of this.connections) {
      if (connection.clientId === clientId) {
        this.connections.delete(id);
        this.filters.delete(id);
      }
    }
  }

  // ========================================================================
  // Event Retrieval
  // ========================================================================

  /**
   * Get events by ID
   */
  getEvent(eventId: string): StreamEvent | undefined {
    return this.events.get(eventId);
  }

  /**
   * Get events filtered by criteria
   */
  getEvents(filter: EventFilter, limit?: number): StreamEvent[] {
    let events = Array.from(this.events.values());

    // Apply time range filter
    if (filter.timeRange) {
      events = events.filter(e =>
        e.timestamp >= filter.timeRange!.start &&
        e.timestamp <= filter.timeRange!.end
      );
    }

    // Apply type filter
    if (filter.types && filter.types.length > 0) {
      events = events.filter(e => filter.types!.includes(e.type));
    }

    // Apply source filter
    if (filter.source) {
      events = events.filter(e => e.metadata?.source === filter.source);
    }

    // Apply tags filter
    if (filter.tags && filter.tags.length > 0) {
      events = events.filter(e =>
        filter.tags!.some(tag => e.metadata?.tags?.includes(tag))
      );
    }

    // Apply custom filter
    if (filter.custom) {
      events = events.filter(filter.custom);
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (limit) {
      events = events.slice(0, limit);
    }

    return events;
  }

  /**
   * Get events since a specific time
   */
  getEventsSince(timestamp: number): StreamEvent[] {
    return Array.from(this.events.values())
      .filter(e => e.timestamp > timestamp)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number): StreamEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  // ========================================================================
  // Stream Multiplexing
  // ========================================================================

  /**
   * Create a multiplexed stream with filters
   */
  multiplex(filter: EventFilter): EventStream {
    const multiplexed = new EventStream(this.options);

    // Copy events that match filter
    const filteredEvents = this.getEvents(filter);
    for (const event of filteredEvents) {
      multiplexed.events.set(event.id, event);
    }

    // Forward new events
    this.on('event', async (event: StreamEvent) => {
      if (this.matchesFilter(event, filter)) {
        await multiplexed.publish(event.type, event.data, event.metadata as any);
      }
    });

    return multiplexed;
  }

  // ========================================================================
  // Event Transformation
  // ========================================================================

  /**
   * Transform events with a mapping function
   */
  transform<TInput, TOutput>(
    mapper: (event: StreamEvent<TInput>) => StreamEvent<TOutput> | Promise<StreamEvent<TOutput>>
  ): EventStream<TOutput> {
    const transformed = new EventStream<TOutput>(this.options);

    // Transform existing events
    for (const event of this.events.values()) {
      try {
        const transformedEvent = mapper(event as StreamEvent<TInput>);
        if (transformedEvent instanceof Promise) {
          transformedEvent.then(e => transformed.events.set(e.id, e));
        } else {
          transformed.events.set(transformedEvent.id, transformedEvent);
        }
      } catch {
        // Skip transformation errors
      }
    }

    // Transform new events
    this.on('event', async (event: StreamEvent) => {
      try {
        const transformedEvent = await mapper(event as StreamEvent<TInput>);
        await transformed.publish(transformedEvent.type, transformedEvent.data, transformedEvent.metadata as any);
      } catch {
        // Skip transformation errors
      }
    });

    return transformed;
  }

  /**
   * Filter events with a predicate
   */
  filter(predicate: (event: StreamEvent) => boolean): EventStream {
    return this.multiplex({ custom: predicate });
  }

  /**
   * Batch events into windows
   */
  batch(size: number, duration: number): EventStream<StreamEvent[]> {
    const batched = new EventStream<StreamEvent[]>(this.options);
    let currentBatch: StreamEvent[] = [];
    let lastBatchTime = Date.now();

    const flushBatch = async () => {
      if (currentBatch.length > 0) {
        await batched.publish('batch', currentBatch);
        currentBatch = [];
        lastBatchTime = Date.now();
      }
    };

    this.on('event', async (event: StreamEvent) => {
      currentBatch.push(event);

      const now = Date.now();
      if (currentBatch.length >= size || now - lastBatchTime >= duration) {
        await flushBatch();
      }
    });

    // Periodic flush
    setInterval(flushBatch, duration);

    return batched;
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get current stream statistics
   */
  getStats(): StreamStats {
    return { ...this.stats };
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Update statistics for a new event
   */
  private updateStats(event: StreamEvent): void {
    this.stats.eventCount++;
    this.stats.lastEventTime = event.timestamp;

    if (this.stats.firstEventTime === 0) {
      this.stats.firstEventTime = event.timestamp;
    }

    // Calculate event rate
    const duration = this.stats.lastEventTime - this.stats.firstEventTime;
    if (duration > 0) {
      this.stats.averageEventRate = (this.stats.eventCount / duration) * 1000;
    }

    // Estimate byte size
    this.stats.byteSize += JSON.stringify(event).length;
  }

  // ========================================================================
  // Broadcasting
  // ========================================================================

  /**
   * Broadcast event to all matching connections
   */
  private async broadcast(event: StreamEvent): Promise<void> {
    const sseEvents: Array<{ connection: SSEConnection; event: SSEEvent }> = [];

    for (const [id, connection] of this.connections) {
      const filters = this.filters.get(id);

      if (filters && filters.length > 0) {
        const matches = filters.some(f => this.matchesFilter(event, f));
        if (!matches) continue;
      }

      const sseEvent: SSEEvent = {
        id: event.id,
        event: event.type,
        data: JSON.stringify(event.data),
      };

      sseEvents.push({
        connection: connection as SSEConnection,
        event: sseEvent,
      });
    }

    // In a real implementation, this would send to actual connections
    // For now, we just track them
    return Promise.resolve();
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: StreamEvent, filter: EventFilter): boolean {
    if (filter.types && !filter.types.includes(event.type)) {
      return false;
    }

    if (filter.source && event.metadata?.source !== filter.source) {
      return false;
    }

    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some(tag => event.metadata?.tags?.includes(tag));
      if (!hasTag) return false;
    }

    if (filter.timeRange) {
      if (event.timestamp < filter.timeRange.start || event.timestamp > filter.timeRange.end) {
        return false;
      }
    }

    if (filter.custom && !filter.custom(event)) {
      return false;
    }

    return true;
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  /**
   * Start periodic cleanup based on retention policy
   */
  private startCleanup(): void {
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Cleanup old events based on retention policy
   */
  private cleanup(): void {
    const now = Date.now();
    const retention = this.options.retention;

    // Clean up by duration
    if (retention.duration) {
      const cutoff = now - retention.duration;
      for (const [id, event] of this.events) {
        if (event.timestamp < cutoff) {
          this.events.delete(id);
        }
      }
    }

    // Clean up by max events
    if (retention.maxEvents && this.events.size > retention.maxEvents) {
      const sorted = Array.from(this.events.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = sorted.slice(0, sorted.length - retention.maxEvents);
      for (const [id] of toRemove) {
        this.events.delete(id);
      }
    }

    // Clean up by max size (approximate)
    if (retention.maxSize && this.stats.byteSize > retention.maxSize) {
      const sorted = Array.from(this.events.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      let removedSize = 0;
      for (const [id, event] of sorted) {
        if (this.stats.byteSize - removedSize <= retention.maxSize * 0.8) {
          break;
        }

        const eventSize = JSON.stringify(event).length;
        this.events.delete(id);
        removedSize += eventSize;
      }

      this.stats.byteSize -= removedSize;
    }
  }

  // ========================================================================
  // Event Handlers
  // ========================================================================

  private handlers: Map<string, Array<(data: unknown) => void>> = new Map();

  /**
   * Register an event handler
   */
  on(event: string, handler: (data: unknown) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  /**
   * Emit an event to handlers
   */
  private async emit(event: string, data: unknown): Promise<void> {
    const handlers = this.handlers.get(event);
    if (handlers) {
      await Promise.all(handlers.map(h => h(data)));
    }
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Clear all events and connections
   */
  clear(): void {
    this.events.clear();
    this.connections.clear();
    this.filters.clear();
    this.stats = {
      eventCount: 0,
      byteSize: 0,
      lastEventTime: 0,
      firstEventTime: 0,
      averageEventRate: 0,
    };
  }

  /**
   * Destroy the stream
   */
  destroy(): void {
    this.clear();
    this.handlers.clear();
  }
}

// ============================================================================
// SSE Formatter
// ============================================================================

/**
 * Format event as Server-Sent Event
 */
export function formatSSE(event: SSEEvent): string {
  const lines: string[] = [];

  if (event.id) {
    lines.push(`id: ${event.id}`);
  }

  if (event.event) {
    lines.push(`event: ${event.event}`);
  }

  if (event.retry) {
    lines.push(`retry: ${event.retry}`);
  }

  // Split data into multiple lines if needed
  const dataLines = event.data.split('\n');
  for (const line of dataLines) {
    lines.push(`data: ${line}`);
  }

  lines.push(''); // Empty line to end the event

  return lines.join('\n');
}

/**
 * Parse SSE message
 */
export function parseSSE(message: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = message.split('\n');

  let currentEvent: Partial<SSEEvent> = {};
  let dataLines: string[] = [];

  for (const line of lines) {
    if (line === '') {
      // End of event
      if (dataLines.length > 0) {
        currentEvent.data = dataLines.join('\n');
      }

      if (currentEvent.data || currentEvent.event || currentEvent.id) {
        events.push(currentEvent as SSEEvent);
      }

      currentEvent = {};
      dataLines = [];
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      // Ignore invalid lines
      continue;
    }

    const field = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    switch (field) {
      case 'id':
        currentEvent.id = value;
        break;
      case 'event':
        currentEvent.event = value;
        break;
      case 'data':
        dataLines.push(value);
        break;
      case 'retry':
        currentEvent.retry = parseInt(value, 10);
        break;
    }
  }

  return events;
}
