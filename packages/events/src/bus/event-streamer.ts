/**
 * Event streaming with durable objects for real-time event delivery
 */

// @ts-nocheck - Cloudflare Workers DurableObject types not fully available
import type { EventEnvelope, EventHandler } from '../types';
import { generateEventId } from '../utils/id';

// ============================================================================
// Event Streamer State
// ============================================================================

interface StreamerState {
  streams: Record<string, {
    createdAt: number;
    lastActivity: number;
    subscribers: Set<string>;
  }>;
  pendingEvents: Record<string, EventEnvelope[]>;
}

// ============================================================================
// Event Streamer Durable Object
// ============================================================================

export interface EventStreamerEnv {
  R2_BUCKET: R2Bucket;
}

export class EventStreamerDurableObject implements DurableObject {
  private state: StreamerState = {
    streams: {},
    pendingEvents: {},
  };

  constructor(
    private durableObjectState: DurableObjectState,
    private env: EventStreamerEnv
  ) {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const saved = await this.durableObjectState.storage.get<StreamerState>('state');
    if (saved) {
      this.state = saved;
      // Convert plain objects back to Sets
      for (const streamId in this.state.streams) {
        this.state.streams[streamId].subscribers = new Set(
          this.state.streams[streamId].subscribers as unknown as string[]
        );
      }
    }
  }

  private async save(): Promise<void> {
    // Convert Sets to Arrays for storage
    const toSave: StreamerState = {
      streams: {},
      pendingEvents: this.state.pendingEvents,
    };

    for (const streamId in this.state.streams) {
      toSave.streams[streamId] = {
        ...this.state.streams[streamId],
        subscribers: this.state.streams[streamId].subscribers as unknown as string[],
      };
    }

    await this.durableObjectState.storage.put('state', toSave);
  }

  // ============================================================================
  // Stream Management
  // ============================================================================

  async createStream(streamId: string): Promise<void> {
    if (this.state.streams[streamId]) {
      throw new Error(`Stream already exists: ${streamId}`);
    }

    this.state.streams[streamId] = {
      createdAt: Date.now(),
      lastActivity: Date.now(),
      subscribers: new Set(),
    };
    this.state.pendingEvents[streamId] = [];

    await this.save();
  }

  async deleteStream(streamId: string): Promise<void> {
    delete this.state.streams[streamId];
    delete this.state.pendingEvents[streamId];
    await this.save();
  }

  async getStream(streamId: string): Promise<{
    exists: boolean;
    createdAt: number;
    lastActivity: number;
    subscriberCount: number;
  } | null> {
    const stream = this.state.streams[streamId];
    if (!stream) {
      return null;
    }

    return {
      exists: true,
      createdAt: stream.createdAt,
      lastActivity: stream.lastActivity,
      subscriberCount: stream.subscribers.size,
    };
  }

  async listStreams(): Promise<string[]> {
    return Object.keys(this.state.streams);
  }

  // ============================================================================
  // Subscriber Management
  // ============================================================================

  async subscribe(streamId: string, subscriberId: string): Promise<void> {
    const stream = this.state.streams[streamId];
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    stream.subscribers.add(subscriberId);
    stream.lastActivity = Date.now();

    await this.save();
  }

  async unsubscribe(streamId: string, subscriberId: string): Promise<void> {
    const stream = this.state.streams[streamId];
    if (!stream) {
      return;
    }

    stream.subscribers.delete(subscriberId);
    stream.lastActivity = Date.now();

    await this.save();
  }

  async getSubscribers(streamId: string): Promise<string[]> {
    const stream = this.state.streams[streamId];
    if (!stream) {
      return [];
    }

    return Array.from(stream.subscribers);
  }

  // ============================================================================
  // Event Publishing
  // ============================================================================

  async publish(streamId: string, event: EventEnvelope): Promise<void> {
    const stream = this.state.streams[streamId];
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    // Ensure event has ID
    if (!event.metadata.eventId) {
      event.metadata.eventId = generateEventId();
    }
    if (!event.metadata.timestamp) {
      event.metadata.timestamp = Date.now();
    }

    // Add to pending events
    this.state.pendingEvents[streamId].push(event);
    stream.lastActivity = Date.now();

    await this.save();
  }

  async publishBatch(streamId: string, events: EventEnvelope[]): Promise<void> {
    const stream = this.state.streams[streamId];
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    for (const event of events) {
      if (!event.metadata.eventId) {
        event.metadata.eventId = generateEventId();
      }
      if (!event.metadata.timestamp) {
        event.metadata.timestamp = Date.now();
      }
      this.state.pendingEvents[streamId].push(event);
    }

    stream.lastActivity = Date.now();
    await this.save();
  }

  // ============================================================================
  // Event Consumption
  // ============================================================================

  async consume(
    streamId: string,
    subscriberId: string,
    options: {
      timeoutMs?: number;
      maxMessages?: number;
    } = {}
  ): Promise<EventEnvelope[]> {
    const stream = this.state.streams[streamId];
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    if (!stream.subscribers.has(subscriberId)) {
      throw new Error(`Not subscribed to stream: ${streamId}`);
    }

    const maxMessages = options.maxMessages ?? 10;
    const pending = this.state.pendingEvents[streamId];

    if (pending.length === 0) {
      // If no messages and timeout specified, wait
      if (options.timeoutMs && options.timeoutMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.timeoutMs));
        // Check again after waiting
        if (this.state.pendingEvents[streamId].length === 0) {
          return [];
        }
      }
    }

    // Get messages up to max
    const messages = this.state.pendingEvents[streamId].splice(0, maxMessages);
    stream.lastActivity = Date.now();

    await this.save();
    return messages;
  }

  async readEvents(
    streamId: string,
    options: {
      fromVersion?: number;
      toVersion?: number;
      fromTimestamp?: number;
      toTimestamp?: number;
      limit?: number;
    } = {}
  ): Promise<EventEnvelope[]> {
    const pending = this.state.pendingEvents[streamId] ?? [];
    let filtered = [...pending];

    // Apply filters
    if (options.fromTimestamp !== undefined) {
      filtered = filtered.filter(e => e.metadata.timestamp >= options.fromTimestamp!);
    }
    if (options.toTimestamp !== undefined) {
      filtered = filtered.filter(e => e.metadata.timestamp <= options.toTimestamp!);
    }

    // Sort by timestamp
    filtered.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

    // Apply limit
    if (options.limit !== undefined) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async alarm(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes

    for (const streamId in this.state.streams) {
      const stream = this.state.streams[streamId];

      // Remove stale streams
      if (now - stream.lastActivity > staleThreshold && stream.subscribers.size === 0) {
        delete this.state.streams[streamId];
        delete this.state.pendingEvents[streamId];
      }

      // Limit pending events in memory
      const maxPending = 1000;
      if (this.state.pendingEvents[streamId].length > maxPending) {
        this.state.pendingEvents[streamId] = this.state.pendingEvents[streamId].slice(-maxPending);
      }
    }

    await this.save();
  }

  async getStats(): Promise<{
    streamCount: number;
    totalSubscribers: number;
    totalPendingEvents: number;
  }> {
    let totalSubscribers = 0;
    let totalPendingEvents = 0;

    for (const streamId in this.state.streams) {
      totalSubscribers += this.state.streams[streamId].subscribers.size;
      totalPendingEvents += this.state.pendingEvents[streamId]?.length ?? 0;
    }

    return {
      streamCount: Object.keys(this.state.streams).length,
      totalSubscribers,
      totalPendingEvents,
    };
  }
}

// ============================================================================
// Event Streamer Client
// ============================================================================

export class EventStreamerClient {
  constructor(
    private namespace: DurableObjectNamespace,
    private id: DurableObjectId
  ) {}

  private getStub(): EventStreamerDurableObjectStub {
    return this.namespace.get(this.id);
  }

  async createStream(streamId: string): Promise<void> {
    await this.getStub().createStream(streamId);
  }

  async deleteStream(streamId: string): Promise<void> {
    await this.getStub().deleteStream(streamId);
  }

  async subscribe(streamId: string, subscriberId: string): Promise<void> {
    await this.getStub().subscribe(streamId, subscriberId);
  }

  async unsubscribe(streamId: string, subscriberId: string): Promise<void> {
    await this.getStub().unsubscribe(streamId, subscriberId);
  }

  async publish(streamId: string, event: EventEnvelope): Promise<void> {
    await this.getStub().publish(streamId, event);
  }

  async publishBatch(streamId: string, events: EventEnvelope[]): Promise<void> {
    await this.getStub().publishBatch(streamId, events);
  }

  async consume(
    streamId: string,
    subscriberId: string,
    options?: { timeoutMs?: number; maxMessages?: number }
  ): Promise<EventEnvelope[]> {
    return this.getStub().consume(streamId, subscriberId, options);
  }

  async readEvents(
    streamId: string,
    options?: {
      fromTimestamp?: number;
      toTimestamp?: number;
      limit?: number;
    }
  ): Promise<EventEnvelope[]> {
    return this.getStub().readEvents(streamId, options);
  }
}

// ============================================================================
// Event Streamer Factory
// ============================================================================

export class EventStreamerFactory {
  constructor(private namespace: DurableObjectNamespace) {}

  create(id: string = 'default'): EventStreamerClient {
    const durableObjectId = this.namespace.idFromString(id);
    return new EventStreamerClient(this.namespace, durableObjectId);
  }

  createFromName(name: string): EventStreamerClient {
    const durableObjectId = this.namespace.idFromName(name);
    return new EventStreamerClient(this.namespace, durableObjectId);
  }
}
