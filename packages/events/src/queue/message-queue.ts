/**
 * Message Queue implementation with Durable Objects
 */

import type {
  QueueMessage,
  QueueConfig,
  QueueStats,
  ConsumerGroup,
  ConsumerMember,
  Partition,
  BatchResult,
} from '../types';
import { generateMessageId } from '../utils/id';

// ============================================================================
// Queue State
// ============================================================================

interface QueueState {
  config: QueueConfig;
  messages: QueueMessage[];
  pendingMessages: Map<string, QueueMessage>; // messageId -> message (being processed)
  consumerGroups: Record<string, ConsumerGroup>;
  partitions: Record<number, Partition>;
  stats: {
    enqueuedTotal: number;
    dequeuedTotal: number;
    acknowledgedTotal: number;
    rejectedTotal: number;
  };
}

// ============================================================================
// Message Queue Durable Object
// ============================================================================

export interface MessageQueueEnv {
  R2_BUCKET: R2Bucket;
  DEAD_LETTER_QUEUE?: DurableObjectNamespace;
}

export class MessageQueueDurableObject implements DurableObject {
  private state: QueueState;
  private r2Storage: R2EventStorage;

  constructor(
    private durableObjectState: DurableObjectState,
    private env: MessageQueueEnv,
    private queueName: string
  ) {
    this.r2Storage = new R2EventStorage({
      bucket: env.R2_BUCKET,
      prefix: `queues/${queueName}`,
    });
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const saved = await this.durableObjectState.storage.get<QueueState>('state');

    if (saved) {
      this.state = saved;
      this.state.consumerGroups = saved.consumerGroups ?? {};
      this.state.partitions = saved.partitions ?? {};
    } else {
      this.state = {
        config: {
          name: this.queueName,
          type: 'standard',
          retentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
          maxMessageSize: 256 * 1024, // 256 KB
          maxReceiveCount: 3,
          visibilityTimeoutMs: 30000, // 30 seconds
          deliveryDelayMs: 0,
          priority: false,
        },
        messages: [],
        pendingMessages: new Map(),
        consumerGroups: {},
        partitions: {},
        stats: {
          enqueuedTotal: 0,
          dequeuedTotal: 0,
          acknowledgedTotal: 0,
          rejectedTotal: 0,
        },
      };

      // Initialize partitions
      const partitionCount = this.state.config.type === 'fifo' ? 1 : 10;
      for (let i = 0; i < partitionCount; i++) {
        this.state.partitions[i] = {
          partitionId: i,
          queueName: this.queueName,
          offset: 0,
          lag: 0,
        };
      }

      await this.save();
    }
  }

  private async save(): Promise<void> {
    // Convert Map to plain object for storage
    const toSave = {
      ...this.state,
      pendingMessages: Array.from(this.state.pendingMessages.entries()),
    };

    await this.durableObjectState.storage.put('state', toSave);
  }

  private async load(): Promise<void> {
    const saved = await this.durableObjectState.storage.get<QueueState>('state');
    if (saved) {
      this.state = saved;
      this.state.pendingMessages = new Map(
        saved.pendingMessages as unknown as Array<[string, QueueMessage]>
      );
    }
  }

  // ============================================================================
  // Queue Configuration
  // ============================================================================

  async configure(config: Partial<QueueConfig>): Promise<void> {
    await this.load();

    this.state.config = {
      ...this.state.config,
      ...config,
    };

    await this.save();
  }

  async getConfig(): Promise<QueueConfig> {
    await this.load();
    return this.state.config;
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  async enqueue(
    payload: unknown,
    options: {
      delayMs?: number;
      priority?: number;
      deduplicationId?: string;
      expiresIn?: number;
    } = {}
  ): Promise<string> {
    await this.load();

    const messageId = generateMessageId();
    const now = Date.now();

    const message: QueueMessage = {
      messageId,
      queueName: this.queueName,
      payload,
      metadata: {
        enqueueTime: now,
        priority: options.priority ?? 0,
        delayUntil: options.delayMs ? now + options.delayMs : undefined,
        expiresAt: options.expiresIn ? now + options.expiresIn : undefined,
        attemptCount: 0,
        maxAttempts: this.state.config.maxReceiveCount,
        deduplicationId: options.deduplicationId,
      },
    };

    // Check for duplicates if deduplication ID is provided
    if (options.deduplicationId) {
      const existing = this.state.messages.find(
        (m) => m.metadata.deduplicationId === options.deduplicationId
      );
      if (existing) {
        return existing.messageId;
      }
    }

    this.state.messages.push(message);
    this.state.stats.enqueuedTotal++;

    // Store in R2 for persistence
    await this.r2Storage.enqueue(message);

    await this.save();
    return messageId;
  }

  async enqueueBatch(messages: Array<{
    payload: unknown;
    options?: {
      delayMs?: number;
      priority?: number;
      deduplicationId?: string;
    };
  }>): Promise<string[]> {
    const messageIds: string[] = [];

    for (const { payload, options } of messages) {
      const id = await this.enqueue(payload, options ?? {});
      messageIds.push(id);
    }

    return messageIds;
  }

  async dequeue(
    consumerId: string,
    options: {
      maxMessages?: number;
      visibilityTimeoutMs?: number;
    } = {}
  ): Promise<QueueMessage[]> {
    await this.load();

    const maxMessages = options.maxMessages ?? 1;
    const visibilityTimeout = options.visibilityTimeoutMs ?? this.state.config.visibilityTimeoutMs;
    const now = Date.now();

    const availableMessages = this.state.messages.filter((m) => {
      // Check if message is ready for delivery
      if (m.metadata.delayUntil && m.metadata.delayUntil > now) {
        return false;
      }

      // Check if message has expired
      if (m.metadata.expiresAt && m.metadata.expiresAt < now) {
        return false;
      }

      // Check if message is already being processed
      return !this.state.pendingMessages.has(m.messageId);
    });

    // Sort by priority if enabled
    if (this.state.config.priority) {
      availableMessages.sort((a, b) => b.metadata.priority - a.metadata.priority);
    }

    const messagesToDequeue = availableMessages.slice(0, maxMessages);
    const result: QueueMessage[] = [];

    for (const message of messagesToDequeue) {
      // Mark as pending
      message.metadata.attemptCount++;

      // Set visibility timeout
      setTimeout(async () => {
        await this.load();
        if (this.state.pendingMessages.has(message.messageId)) {
          // Message wasn't acknowledged, return to queue
          this.state.pendingMessages.delete(message.messageId);
          await this.save();
        }
      }, visibilityTimeout);

      this.state.pendingMessages.set(message.messageId, message);
      result.push(message);
    }

    this.state.stats.dequeuedTotal += result.length;
    await this.save();

    return result;
  }

  async acknowledge(messageId: string, consumerId: string): Promise<void> {
    await this.load();

    // Remove from pending
    const pending = this.state.pendingMessages.get(messageId);
    if (pending) {
      this.state.pendingMessages.delete(messageId);

      // Remove from queue
      this.state.messages = this.state.messages.filter((m) => m.messageId !== messageId);

      this.state.stats.acknowledgedTotal++;

      await this.save();
    }
  }

  async acknowledgeBatch(messageIds: string[], consumerId: string): Promise<BatchResult> {
    const successful: string[] = [];
    const failed: Array<{
      messageId: string;
      error: Error;
      retry: boolean;
    }> = [];

    for (const messageId of messageIds) {
      try {
        await this.acknowledge(messageId, consumerId);
        successful.push(messageId);
      } catch (error) {
        failed.push({
          messageId,
          error: error as Error,
          retry: false,
        });
      }
    }

    return {
      batchId: generateMessageId(),
      successful,
      failed,
    };
  }

  async negativeAcknowledge(
    messageId: string,
    consumerId: string,
    requeue: boolean = true
  ): Promise<void> {
    await this.load();

    const pending = this.state.pendingMessages.get(messageId);
    if (pending) {
      this.state.pendingMessages.delete(messageId);

      if (requeue && pending.metadata.attemptCount < pending.metadata.maxAttempts) {
        // Message will be available for dequeue again
        this.state.stats.rejectedTotal++;
      } else {
        // Send to dead letter queue
        await this.sendToDeadLetterQueue(pending);
        this.state.messages = this.state.messages.filter((m) => m.messageId !== messageId);
      }

      await this.save();
    }
  }

  // ============================================================================
  // Consumer Groups
  // ============================================================================

  async createConsumerGroup(groupId: string): Promise<void> {
    await this.load();

    if (this.state.consumerGroups[groupId]) {
      throw new Error(`Consumer group already exists: ${groupId}`);
    }

    this.state.consumerGroups[groupId] = {
      groupId,
      queueName: this.queueName,
      members: [],
      leaderId: '',
      generationId: 0,
      rebalanceInProgress: false,
    };

    await this.save();
  }

  async joinConsumerGroup(groupId: string, memberId: string): Promise<void> {
    await this.load();

    const group = this.state.consumerGroups[groupId];
    if (!group) {
      throw new Error(`Consumer group not found: ${groupId}`);
    }

    if (!group.members.includes(memberId)) {
      group.members.push(memberId);

      // If first member, make them leader
      if (group.members.length === 1) {
        group.leaderId = memberId;
      }

      await this.save();
    }
  }

  async leaveConsumerGroup(groupId: string, memberId: string): Promise<void> {
    await this.load();

    const group = this.state.consumerGroups[groupId];
    if (!group) {
      return;
    }

    group.members = group.members.filter((m) => m !== memberId);

    // If leader left, assign new leader
    if (group.leaderId === memberId && group.members.length > 0) {
      group.leaderId = group.members[0];
    }

    await this.save();
  }

  async getConsumerGroup(groupId: string): Promise<ConsumerGroup | null> {
    await this.load();
    return this.state.consumerGroups[groupId] ?? null;
  }

  async listConsumerGroups(): Promise<ConsumerGroup[]> {
    await this.load();
    return Object.values(this.state.consumerGroups);
  }

  // ============================================================================
  // Partitions
  // ============================================================================

  async assignPartition(
    groupId: string,
    partitionId: number,
    memberId: string
  ): Promise<void> {
    await this.load();

    const partition = this.state.partitions[partitionId];
    if (!partition) {
      throw new Error(`Partition not found: ${partitionId}`);
    }

    partition.ownerId = memberId;

    await this.save();
  }

  async getPartition(partitionId: number): Promise<Partition | null> {
    await this.load();
    return this.state.partitions[partitionId] ?? null;
  }

  async listPartitions(): Promise<Partition[]> {
    await this.load();
    return Object.values(this.state.partitions);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getStats(): Promise<QueueStats> {
    await this.load();

    const now = Date.now();

    return {
      name: this.queueName,
      approximateNumberOfMessages: this.state.messages.length,
      approximateNumberOfMessagesDelayed: this.state.messages.filter(
        (m) => m.metadata.delayUntil && m.metadata.delayUntil > now
      ).length,
      approximateNumberOfMessagesNotVisible: this.state.pendingMessages.size,
      createdAt: 0,
      lastModifiedAt: now,
    };
  }

  async getDetailedStats(): Promise<{
    stats: QueueStats;
    enqueuedTotal: number;
    dequeuedTotal: number;
    acknowledgedTotal: number;
    rejectedTotal: number;
    consumerGroupCount: number;
  }> {
    const stats = await this.getStats();

    return {
      stats,
      enqueuedTotal: this.state.stats.enqueuedTotal,
      dequeuedTotal: this.state.stats.dequeuedTotal,
      acknowledgedTotal: this.state.stats.acknowledgedTotal,
      rejectedTotal: this.state.stats.rejectedTotal,
      consumerGroupCount: Object.keys(this.state.consumerGroups).length,
    };
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async alarm(): Promise<void> {
    await this.load();

    const now = Date.now();

    // Remove expired messages
    this.state.messages = this.state.messages.filter((m) => {
      if (m.metadata.expiresAt && m.metadata.expiresAt < now) {
        return false;
      }
      return true;
    });

    // Clean up stale pending messages
    for (const [messageId, message] of this.state.pendingMessages) {
      const visibilityExpiry = message.metadata.enqueueTime + this.state.config.visibilityTimeoutMs;

      if (now > visibilityExpiry) {
        // Return to queue or send to DLQ
        if (message.metadata.attemptCount >= message.metadata.maxAttempts) {
          await this.sendToDeadLetterQueue(message);
        } else {
          // Message will be available for dequeue again
        }

        this.state.pendingMessages.delete(messageId);
      }
    }

    // Remove inactive consumer groups
    for (const [groupId, group] of Object.entries(this.state.consumerGroups)) {
      if (group.members.length === 0) {
        delete this.state.consumerGroups[groupId];
      }
    }

    await this.save();
  }

  private async sendToDeadLetterQueue(message: QueueMessage): Promise<void> {
    if (this.env.DEAD_LETTER_QUEUE) {
      // Send to dead letter queue
      const dlqId = this.env.DEAD_LETTER_QUEUE.idFromName(`${this.queueName}-dlq`);
      const dlqStub = this.env.DEAD_LETTER_QUEUE.get(dlqId);

      await dlqStub.enqueueDLQ(message, this.queueName);
    }
  }

  // ============================================================================
  // Purge
  // ============================================================================

  async purge(): Promise<number> {
    await this.load();

    const count = this.state.messages.length;
    this.state.messages = [];
    this.state.pendingMessages.clear();

    await this.save();
    return count;
  }
}
