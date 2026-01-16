/**
 * Dead Letter Queue implementation
 */

// @ts-nocheck - Cloudflare Workers DurableObject types not fully available
import type { DeadLetterEntry, QueueMessage } from '../types';
import { generateMessageId } from '../utils/id';

// ============================================================================
// Dead Letter Queue State
// ============================================================================

interface DLQState {
  entries: DeadLetterEntry[];
  bySourceQueue: Record<string, string[]>; // queueName -> entry IDs
  byReason: Record<string, string[]>; // reason -> entry IDs
}

// ============================================================================
// Dead Letter Queue Durable Object
// ============================================================================

export interface DeadLetterQueueEnv {
  R2_BUCKET: R2Bucket;
}

export class DeadLetterQueueDurableObject implements DurableObject {
  private state: DLQState;

  constructor(
    private durableObjectState: DurableObjectState,
    private env: DeadLetterQueueEnv,
    private dlqName: string
  ) {
    this.state = {
      entries: [],
      bySourceQueue: {},
      byReason: {},
    };
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const saved = await this.durableObjectState.storage.get<DLQState>('state');

    if (saved) {
      this.state = saved;
    }
  }

  private async save(): Promise<void> {
    await this.durableObjectState.storage.put('state', this.state);
  }

  // ============================================================================
  // Add Entry
  // ============================================================================

  async enqueueDLQ(
    message: QueueMessage,
    sourceQueue: string,
    reason: string,
    originalError: Error
  ): Promise<string> {
    const entryId = generateMessageId();

    const entry: DeadLetterEntry = {
      originalMessage: message,
      deadLetterAt: Date.now(),
      reason,
      attemptCount: message.metadata.attemptCount,
      originalError,
    };

    this.state.entries.push(entry);

    // Index by source queue
    if (!this.state.bySourceQueue[sourceQueue]) {
      this.state.bySourceQueue[sourceQueue] = [];
    }
    this.state.bySourceQueue[sourceQueue].push(entryId);

    // Index by reason
    if (!this.state.byReason[reason]) {
      this.state.byReason[reason] = [];
    }
    this.state.byReason[reason].push(entryId);

    await this.save();
    return entryId;
  }

  // ============================================================================
  // Read Entries
  // ============================================================================

  async getEntries(options: {
    sourceQueue?: string;
    reason?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<DeadLetterEntry[]> {
    let entries = [...this.state.entries];

    // Filter by source queue
    if (options.sourceQueue) {
      const entryIds = this.state.bySourceQueue[options.sourceQueue] ?? [];
      const idSet = new Set(entryIds);
      entries = entries.filter((_, index) => idSet.has(index.toString()));
    }

    // Filter by reason
    if (options.reason) {
      const entryIds = this.state.byReason[options.reason] ?? [];
      const idSet = new Set(entryIds);
      entries = entries.filter((_, index) => idSet.has(index.toString()));
    }

    // Sort by dead letter time (newest first)
    entries.sort((a, b) => b.deadLetterAt - a.deadLetterAt);

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? entries.length;

    return entries.slice(offset, offset + limit);
  }

  async getEntry(entryId: string): Promise<DeadLetterEntry | null> {
    const index = parseInt(entryId, 10);
    return this.state.entries[index] ?? null;
  }

  // ============================================================================
  // Retry
  // ============================================================================

  async retryEntry(
    entryId: string,
    targetQueueStub: MessageQueueDurableObjectStub
  ): Promise<void> {
    const entry = await this.getEntry(entryId);

    if (!entry) {
      throw new Error(`Entry not found: ${entryId}`);
    }

    // Reset attempt count
    entry.originalMessage.metadata.attemptCount = 0;

    // Re-enqueue to original queue
    await targetQueueStub.requeueMessage(entry.originalMessage);

    // Remove from DLQ
    await this.removeEntry(entryId);
  }

  async retryBatch(
    entryIds: string[],
    targetQueueStub: MessageQueueDurableObjectStub
  ): Promise<{
    successful: string[];
    failed: Array<{ entryId: string; error: Error }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ entryId: string; error: Error }> = [];

    for (const entryId of entryIds) {
      try {
        await this.retryEntry(entryId, targetQueueStub);
        successful.push(entryId);
      } catch (error) {
        failed.push({
          entryId,
          error: error as Error,
        });
      }
    }

    return { successful, failed };
  }

  // ============================================================================
  // Remove Entry
  // ============================================================================

  async removeEntry(entryId: string): Promise<void> {
    const index = parseInt(entryId, 10);

    if (index < 0 || index >= this.state.entries.length) {
      throw new Error(`Entry not found: ${entryId}`);
    }

    const entry = this.state.entries[index];

    // Remove from entries
    this.state.entries.splice(index, 1);

    // Remove from source queue index
    const sourceQueue = entry.originalMessage.queueName;
    const sourceEntries = this.state.bySourceQueue[sourceQueue];
    if (sourceEntries) {
      const sourceIndex = sourceEntries.indexOf(entryId);
      if (sourceIndex !== -1) {
        sourceEntries.splice(sourceIndex, 1);
      }
    }

    // Remove from reason index
    const reasonEntries = this.state.byReason[entry.reason];
    if (reasonEntries) {
      const reasonIndex = reasonEntries.indexOf(entryId);
      if (reasonIndex !== -1) {
        reasonEntries.splice(reasonIndex, 1);
      }
    }

    await this.save();
  }

  async clearEntries(options: {
    sourceQueue?: string;
    reason?: string;
    olderThan?: number;
  } = {}): Promise<number> {
    let toRemove: number[] = [];

    if (options.olderThan) {
      // Find entries older than specified time
      for (let i = 0; i < this.state.entries.length; i++) {
        if (this.state.entries[i].deadLetterAt < options.olderThan!) {
          toRemove.push(i);
        }
      }
    } else if (options.sourceQueue || options.reason) {
      // Find entries matching filters
      for (let i = 0; i < this.state.entries.length; i++) {
        const entry = this.state.entries[i];

        let match = true;

        if (options.sourceQueue && entry.originalMessage.queueName !== options.sourceQueue) {
          match = false;
        }

        if (options.reason && entry.reason !== options.reason) {
          match = false;
        }

        if (match) {
          toRemove.push(i);
        }
      }
    } else {
      // Clear all
      toRemove = this.state.entries.map((_, i) => i);
    }

    // Remove in reverse order to maintain indices
    for (const index of toRemove.reverse()) {
      await this.removeEntry(index.toString());
    }

    return toRemove.length;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getStats(): Promise<{
    totalEntries: number;
    entriesBySourceQueue: Record<string, number>;
    entriesByReason: Record<string, number>;
    oldestEntry?: DeadLetterEntry;
    newestEntry?: DeadLetterEntry;
  }> {
    const entriesBySourceQueue: Record<string, number> = {};
    const entriesByReason: Record<string, number> = {};

    for (const [sourceQueue, entries] of Object.entries(this.state.bySourceQueue)) {
      entriesBySourceQueue[sourceQueue] = entries.length;
    }

    for (const [reason, entries] of Object.entries(this.state.byReason)) {
      entriesByReason[reason] = entries.length;
    }

    const sorted = [...this.state.entries].sort((a, b) => a.deadLetterAt - b.deadLetterAt);

    return {
      totalEntries: this.state.entries.length,
      entriesBySourceQueue,
      entriesByReason,
      oldestEntry: sorted[0],
      newestEntry: sorted[sorted.length - 1],
    };
  }

  // ============================================================================
  // Analysis
  // ============================================================================

  async analyzePatterns(): Promise<{
    commonReasons: Array<{ reason: string; count: number }>;
    sourceQueuesWithIssues: Array<{ queue: string; count: number }>;
    averageAttemptsBeforeDLQ: number;
    recentTrends: Array<{
      date: string;
      count: number;
    }>;
  }> {
    // Count by reason
    const reasonCounts: Record<string, number> = {};
    for (const entry of this.state.entries) {
      reasonCounts[entry.reason] = (reasonCounts[entry.reason] ?? 0) + 1;
    }

    const commonReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count by source queue
    const sourceQueueCounts: Record<string, number> = {};
    for (const entry of this.state.entries) {
      const queue = entry.originalMessage.queueName;
      sourceQueueCounts[queue] = (sourceQueueCounts[queue] ?? 0) + 1;
    }

    const sourceQueuesWithIssues = Object.entries(sourceQueueCounts)
      .map(([queue, count]) => ({ queue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate average attempts
    const totalAttempts = this.state.entries.reduce(
      (sum, entry) => sum + entry.attemptCount,
      0
    );
    const averageAttemptsBeforeDLQ =
      this.state.entries.length > 0
        ? totalAttempts / this.state.entries.length
        : 0;

    // Recent trends (last 7 days)
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const trends: Record<string, number> = {};

    for (const entry of this.state.entries) {
      const daysAgo = Math.floor((now - entry.deadLetterAt) / dayMs);
      const dateKey = `${daysAgo} days ago`;

      trends[dateKey] = (trends[dateKey] ?? 0) + 1;
    }

    const recentTrends = Object.entries(trends)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => parseInt(a.date) - parseInt(b.date));

    return {
      commonReasons,
      sourceQueuesWithIssues,
      averageAttemptsBeforeDLQ,
      recentTrends,
    };
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async alarm(): Promise<void> {
    // Auto-remove entries older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    await this.clearEntries({ olderThan: thirtyDaysAgo });
  }
}
