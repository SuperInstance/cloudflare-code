/**
 * Priority Queue implementation
 */

// @ts-nocheck - Cloudflare Workers DurableObject types not fully available
import type { PrioritizedMessage, QueueMessage } from '../types';
import { generateMessageId } from '../utils/id';

// ============================================================================
// Priority Queue State
// ============================================================================

interface PriorityQueueState {
  messages: PrioritizedMessage[];
  priorityLevels: Map<number, PrioritizedMessage[]>;
}

// ============================================================================
// Priority Queue Durable Object
// ============================================================================

export interface PriorityQueueEnv {
  R2_BUCKET: R2Bucket;
}

export class PriorityQueueDurableObject implements DurableObject {
  private state: PriorityQueueState;

  constructor(
    private durableObjectState: DurableObjectState,
    private env: PriorityQueueEnv,
    private queueName: string
  ) {
    this.state = {
      messages: [],
      priorityLevels: new Map(),
    };
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const saved = await this.durableObjectState.storage.get<PriorityQueueState>('state');

    if (saved) {
      this.state = saved;
      this.state.priorityLevels = new Map(
        Object.entries(saved.priorityLevels).map(([k, v]) => [parseInt(k, 10), v])
      );
    }
  }

  private async save(): Promise<void> {
    const toSave = {
      ...this.state,
      priorityLevels: Object.fromEntries(this.state.priorityLevels),
    };

    await this.durableObjectState.storage.put('state', toSave);
  }

  // ============================================================================
  // Enqueue
  // ============================================================================

  async enqueueWithPriority(
    payload: unknown,
    priority: number,
    orderKey?: string,
    options: {
      delayMs?: number;
      expiresIn?: number;
    } = {}
  ): Promise<string> {
    const messageId = generateMessageId();
    const now = Date.now();

    const message: PrioritizedMessage = {
      messageId,
      queueName: this.queueName,
      payload,
      metadata: {
        enqueueTime: now,
        priority,
        delayUntil: options.delayMs ? now + options.delayMs : undefined,
        expiresAt: options.expiresIn ? now + options.expiresIn : undefined,
        attemptCount: 0,
        maxAttempts: 3,
      },
      priority,
      orderKey: orderKey ?? `${priority}_${now}_${messageId}`,
    };

    // Add to main list
    this.state.messages.push(message);

    // Add to priority level
    if (!this.state.priorityLevels.has(priority)) {
      this.state.priorityLevels.set(priority, []);
    }
    this.state.priorityLevels.get(priority)!.push(message);

    // Sort by order key within priority level
    this.state.priorityLevels.get(priority)!.sort((a, b) =>
      a.orderKey.localeCompare(b.orderKey)
    );

    // Sort main list by priority (descending) and order key
    this.state.messages.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.orderKey.localeCompare(b.orderKey);
    });

    await this.save();
    return messageId;
  }

  // ============================================================================
  // Dequeue
  // ============================================================================

  async dequeue(options: {
    maxMessages?: number;
    minPriority?: number;
    maxPriority?: number;
  } = {}): Promise<PrioritizedMessage[]> {
    const maxMessages = options.maxMessages ?? 1;
    const minPriority = options.minPriority ?? 0;
    const maxPriority = options.maxPriority ?? Number.MAX_SAFE_INTEGER;

    const now = Date.now();

    // Filter available messages
    const available = this.state.messages.filter((m) => {
      // Check priority range
      if (m.priority < minPriority || m.priority > maxPriority) {
        return false;
      }

      // Check delay
      if (m.metadata.delayUntil && m.metadata.delayUntil > now) {
        return false;
      }

      // Check expiration
      if (m.metadata.expiresAt && m.metadata.expiresAt < now) {
        return false;
      }

      return true;
    });

    // Get highest priority messages
    const toDequeue = available.slice(0, maxMessages);

    // Remove from queue
    for (const message of toDequeue) {
      this.removeFromQueue(message.messageId);
    }

    await this.save();
    return toDequeue;
  }

  // ============================================================================
  // Peek
  // ============================================================================

  async peek(options: {
    maxMessages?: number;
    minPriority?: number;
    maxPriority?: number;
  } = {}): Promise<PrioritizedMessage[]> {
    const maxMessages = options.maxMessages ?? 1;
    const minPriority = options.minPriority ?? 0;
    const maxPriority = options.maxPriority ?? Number.MAX_SAFE_INTEGER;

    const now = Date.now();

    return this.state.messages
      .filter((m) => {
        if (m.priority < minPriority || m.priority > maxPriority) {
          return false;
        }

        if (m.metadata.delayUntil && m.metadata.delayUntil > now) {
          return false;
        }

        if (m.metadata.expiresAt && m.metadata.expiresAt < now) {
          return false;
        }

        return true;
      })
      .slice(0, maxMessages);
  }

  // ============================================================================
  // Priority Level Management
  // ============================================================================

  async getPriorityLevel(priority: number): Promise<PrioritizedMessage[]> {
    return this.state.priorityLevels.get(priority) ?? [];
  }

  async listPriorityLevels(): Promise<number[]> {
    return Array.from(this.state.priorityLevels.keys()).sort((a, b) => b - a);
  }

  async getMessagesByPriority(
    priority: number,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PrioritizedMessage[]> {
    const messages = this.state.priorityLevels.get(priority) ?? [];
    const { limit, offset = 0 } = options;

    return messages.slice(offset, limit ? offset + limit : undefined);
  }

  // ============================================================================
  // Update Priority
  // ============================================================================

  async updatePriority(messageId: string, newPriority: number): Promise<void> {
    const message = this.state.messages.find((m) => m.messageId === messageId);

    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    // Remove from old priority level
    const oldMessages = this.state.priorityLevels.get(message.priority);
    if (oldMessages) {
      const index = oldMessages.findIndex((m) => m.messageId === messageId);
      if (index !== -1) {
        oldMessages.splice(index, 1);
      }
    }

    // Update priority
    message.priority = newPriority;
    message.orderKey = `${newPriority}_${Date.now()}_${messageId}`;

    // Add to new priority level
    if (!this.state.priorityLevels.has(newPriority)) {
      this.state.priorityLevels.set(newPriority, []);
    }
    this.state.priorityLevels.get(newPriority)!.push(message);

    // Re-sort
    this.state.messages.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.orderKey.localeCompare(b.orderKey);
    });

    await this.save();
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getStats(): Promise<{
    totalMessages: number;
    messagesByPriority: Record<number, number>;
    highestPriority: number;
    lowestPriority: number;
  }> {
    const messagesByPriority: Record<number, number> = {};

    for (const [priority, messages] of this.state.priorityLevels) {
      messagesByPriority[priority] = messages.length;
    }

    const priorities = await this.listPriorityLevels();

    return {
      totalMessages: this.state.messages.length,
      messagesByPriority,
      highestPriority: priorities[0] ?? 0,
      lowestPriority: priorities[priorities.length - 1] ?? 0,
    };
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async alarm(): Promise<void> {
    const now = Date.now();

    // Remove expired messages
    for (const message of this.state.messages) {
      if (message.metadata.expiresAt && message.metadata.expiresAt < now) {
        this.removeFromQueue(message.messageId);
      }
    }

    await this.save();
  }

  private removeFromQueue(messageId: string): void {
    const index = this.state.messages.findIndex((m) => m.messageId === messageId);
    if (index !== -1) {
      const message = this.state.messages[index];
      this.state.messages.splice(index, 1);

      // Remove from priority level
      const priorityMessages = this.state.priorityLevels.get(message.priority);
      if (priorityMessages) {
        const pIndex = priorityMessages.findIndex((m) => m.messageId === messageId);
        if (pIndex !== -1) {
          priorityMessages.splice(pIndex, 1);
        }
      }
    }
  }

  // ============================================================================
  // Clear
  // ============================================================================

  async clear(): Promise<void> {
    this.state.messages = [];
    this.state.priorityLevels.clear();
    await this.save();
  }

  async clearPriority(priority: number): Promise<number> {
    const messages = this.state.priorityLevels.get(priority) ?? [];
    const count = messages.length;

    for (const message of messages) {
      this.removeFromQueue(message.messageId);
    }

    await this.save();
    return count;
  }
}
