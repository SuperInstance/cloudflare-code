/**
 * R2 storage implementation for event persistence
 */

// @ts-nocheck - Cloudflare Workers R2 types not fully available
import type {
  EventEnvelope,
  StoredEvent,
  Snapshot,
  QueueMessage,
  DeadLetterEntry,
} from '../types';

// ============================================================================
// R2 Storage Interface
// ============================================================================

export interface R2StorageOptions {
  bucket: R2Bucket;
  prefix?: string;
}

export class R2EventStorage {
  private prefix: string;

  constructor(private options: R2StorageOptions) {
    this.prefix = options.prefix ?? 'events';
  }

  // ============================================================================
  // Event Storage
  // ============================================================================

  /**
   * Store an event
   */
  async storeEvent(event: EventEnvelope): Promise<void> {
    const key = this.getEventKey(event.metadata.eventId);
    const data = JSON.stringify(event);
    await this.options.bucket.put(key, data);
  }

  /**
   * Store multiple events
   */
  async storeEvents(events: EventEnvelope[]): Promise<void> {
    const promises = events.map((event) => this.storeEvent(event));
    await Promise.all(promises);
  }

  /**
   * Get an event by ID
   */
  async getEvent(eventId: string): Promise<EventEnvelope | null> {
    const key = this.getEventKey(eventId);
    const object = await this.options.bucket.get(key);

    if (!object) {
      return null;
    }

    const data = await object.text();
    return JSON.parse(data);
  }

  /**
   * Get events by topic
   */
  async getEventsByTopic(
    topic: string,
    options: {
      limit?: number;
      fromTimestamp?: number;
      toTimestamp?: number;
    } = {}
  ): Promise<EventEnvelope[]> {
    const prefix = this.getTopicPrefix(topic);
    const events: EventEnvelope[] = [];

    const listed = await this.options.bucket.list({ prefix });
    for (const object of listed.objects) {
      const event = await this.getEventFromObject(object);
      if (event && this.matchesTimeRange(event, options)) {
        events.push(event);
        if (options.limit && events.length >= options.limit) {
          break;
        }
      }
    }

    return events.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<void> {
    const key = this.getEventKey(eventId);
    await this.options.bucket.delete(key);
  }

  /**
   * Delete events older than a timestamp
   */
  async deleteOldEvents(timestamp: number): Promise<number> {
    const listed = await this.options.bucket.list({ prefix: this.prefix });
    let deleted = 0;

    for (const object of listed.objects) {
      const event = await this.getEventFromObject(object);
      if (event && event.metadata.timestamp < timestamp) {
        await this.options.bucket.delete(object.key);
        deleted++;
      }
    }

    return deleted;
  }

  // ============================================================================
  // Snapshot Storage
  // ============================================================================

  /**
   * Store a snapshot
   */
  async storeSnapshot(snapshot: Snapshot): Promise<void> {
    const key = this.getSnapshotKey(snapshot.streamId, snapshot.version);
    const data = JSON.stringify(snapshot);
    await this.options.bucket.put(key, data);
  }

  /**
   * Get the latest snapshot for a stream
   */
  async getLatestSnapshot(streamId: string): Promise<Snapshot | null> {
    const prefix = this.getSnapshotPrefix(streamId);
    const listed = await this.options.bucket.list({ prefix });

    let latestSnapshot: Snapshot | null = null;
    for (const object of listed.objects) {
      const snapshot = await this.getSnapshotFromObject(object);
      if (snapshot && (!latestSnapshot || snapshot.version > latestSnapshot.version)) {
        latestSnapshot = snapshot;
      }
    }

    return latestSnapshot;
  }

  /**
   * Get a snapshot at a specific version
   */
  async getSnapshot(streamId: string, version: number): Promise<Snapshot | null> {
    const key = this.getSnapshotKey(streamId, version);
    const object = await this.options.bucket.get(key);

    if (!object) {
      return null;
    }

    const data = await object.text();
    return JSON.parse(data);
  }

  /**
   * Delete old snapshots
   */
  async deleteOldSnapshots(streamId: string, keepLatest: number = 1): Promise<number> {
    const prefix = this.getSnapshotPrefix(streamId);
    const listed = await this.options.bucket.list({ prefix });

    const snapshots: Array<{ key: string; version: number }> = [];
    for (const object of listed.objects) {
      const match = object.key.match(/snapshot_([^_]+)_v(\d+)$/);
      if (match) {
        snapshots.push({
          key: object.key,
          version: parseInt(match[2], 10),
        });
      }
    }

    // Sort by version descending
    snapshots.sort((a, b) => b.version - a.version);

    // Delete all but the latest N
    const toDelete = snapshots.slice(keepLatest);
    const keys = toDelete.map((s) => s.key);
    if (keys.length > 0) {
      await this.options.bucket.delete(keys);
    }

    return toDelete.length;
  }

  // ============================================================================
  // Queue Message Storage
  // ============================================================================

  /**
   * Enqueue a message
   */
  async enqueue(message: QueueMessage): Promise<void> {
    const key = this.getMessageKey(message.messageId);
    const data = JSON.stringify(message);
    await this.options.bucket.put(key, data);
  }

  /**
   * Dequeue a message
   */
  async dequeue(queueName: string): Promise<QueueMessage | null> {
    const prefix = this.getQueuePrefix(queueName);
    const listed = await this.options.bucket.list({ prefix, limit: 1 });

    if (listed.objects.length === 0) {
      return null;
    }

    const object = listed.objects[0];
    const message = await this.getMessageFromObject(object);

    if (message) {
      await this.options.bucket.delete(object.key);
    }

    return message;
  }

  /**
   * Get queue size
   */
  async getQueueSize(queueName: string): Promise<number> {
    const prefix = this.getQueuePrefix(queueName);
    const listed = await this.options.bucket.list({ prefix });
    return listed.objects.length;
  }

  // ============================================================================
  // Dead Letter Queue Storage
  // ============================================================================

  /**
   * Add to dead letter queue
   */
  async addDeadLetter(entry: DeadLetterEntry): Promise<void> {
    const key = this.getDeadLetterKey(entry.originalMessage.messageId);
    const data = JSON.stringify(entry);
    await this.options.bucket.put(key, data);
  }

  /**
   * Get dead letter entries
   */
  async getDeadLetters(queueName?: string, limit?: number): Promise<DeadLetterEntry[]> {
    const prefix = `${this.prefix}/dlq${queueName ? '/' + queueName : ''}`;
    const listed = await this.options.bucket.list({ prefix, limit });
    const entries: DeadLetterEntry[] = [];

    for (const object of listed.objects) {
      const entry = await this.getDeadLetterFromObject(object);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getEventKey(eventId: string): string {
    return `${this.prefix}/events/${eventId}.json`;
  }

  private getTopicPrefix(topic: string): string {
    return `${this.prefix}/topics/${topic}/`;
  }

  private getSnapshotKey(streamId: string, version: number): string {
    return `${this.prefix}/snapshots/${streamId}/snapshot_${streamId}_v${version}.json`;
  }

  private getSnapshotPrefix(streamId: string): string {
    return `${this.prefix}/snapshots/${streamId}/`;
  }

  private getMessageKey(messageId: string): string {
    return `${this.prefix}/messages/${messageId}.json`;
  }

  private getQueuePrefix(queueName: string): string {
    return `${this.prefix}/queues/${queueName}/`;
  }

  private getDeadLetterKey(messageId: string): string {
    return `${this.prefix}/dlq/${messageId}.json`;
  }

  private async getEventFromObject(object: R2Object): Promise<EventEnvelope | null> {
    try {
      const data = await object.text();
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async getSnapshotFromObject(object: R2Object): Promise<Snapshot | null> {
    try {
      const data = await object.text();
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async getMessageFromObject(object: R2Object): Promise<QueueMessage | null> {
    try {
      const data = await object.text();
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async getDeadLetterFromObject(object: R2Object): Promise<DeadLetterEntry | null> {
    try {
      const data = await object.text();
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private matchesTimeRange(
    event: EventEnvelope,
    options: { fromTimestamp?: number; toTimestamp?: number }
  ): boolean {
    if (options.fromTimestamp && event.metadata.timestamp < options.fromTimestamp) {
      return false;
    }
    if (options.toTimestamp && event.metadata.timestamp > options.toTimestamp) {
      return false;
    }
    return true;
  }
}
