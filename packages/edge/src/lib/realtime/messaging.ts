/**
 * Message Handler for Real-time Communication
 * Handles message routing, queuing, and delivery guarantees
 */

import type {
  AnyMessage,
  MessageType,
  MessagePriority,
  QueuedMessage,
  MessageDelivery,
  Connection,
  MessageAck,
  SerializationOptions,
} from './types';
import { SerializationFormat } from './types';
import { generateId } from '../utils';

/**
 * Message handler configuration
 */
interface MessageHandlerConfig {
  // Queue settings
  maxQueueSize: number;
  maxRetries: number;
  messageTTL: number;
  retryDelay: number;

  // Delivery
  enableAck: boolean;
  ackTimeout: number;
  deliveryTimeout: number;

  // Batching
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;

  // Serialization
  defaultSerialization: SerializationFormat;
  enableCompression: boolean;

  // Performance
  maxMessageSize: number;
  rateLimitPerSecond: number;
}

/**
 * Message queue item with additional metadata
 */
interface MessageQueueItem extends QueuedMessage {
  createdAt: number;
  nextRetryAt: number;
  serialized?: Uint8Array;
}

/**
 * Message statistics
 */
interface MessageStats {
  sent: number;
  received: number;
  delivered: number;
  failed: number;
  queued: number;
  retried: number;
  bytesSent: number;
  bytesReceived: number;
}

/**
 * Message handler class
 */
export class MessageHandler {
  private messageQueue: Map<string, MessageQueueItem>;
  private pendingAcks: Map<string, { message: AnyMessage; timeout: number }>;
  private deliveryCallbacks: Map<string, Set<(delivery: MessageDelivery) => void>>;
  private stats: MessageStats;
  private config: MessageHandlerConfig;
  private rateLimitCounter: Map<string, { count: number; resetTime: number }>;
  private processingTimer: ReturnType<typeof setInterval> | null;

  constructor(config?: Partial<MessageHandlerConfig>) {
    this.messageQueue = new Map();
    this.pendingAcks = new Map();
    this.deliveryCallbacks = new Map();
    this.rateLimitCounter = new Map();
    this.processingTimer = null;

    this.stats = {
      sent: 0,
      received: 0,
      delivered: 0,
      failed: 0,
      queued: 0,
      retried: 0,
      bytesSent: 0,
      bytesReceived: 0,
    };

    this.config = {
      maxQueueSize: config?.maxQueueSize ?? 10000,
      maxRetries: config?.maxRetries ?? 3,
      messageTTL: config?.messageTTL ?? 60 * 1000, // 1 minute
      retryDelay: config?.retryDelay ?? 1000, // 1 second
      enableAck: config?.enableAck ?? true,
      ackTimeout: config?.ackTimeout ?? 30 * 1000, // 30 seconds
      deliveryTimeout: config?.deliveryTimeout ?? 10 * 1000, // 10 seconds
      enableBatching: config?.enableBatching ?? true,
      batchSize: config?.batchSize ?? 100,
      batchTimeout: config?.batchTimeout ?? 100, // 100ms
      defaultSerialization: config?.defaultSerialization ?? SerializationFormat.JSON,
      enableCompression: config?.enableCompression ?? true,
      maxMessageSize: config?.maxMessageSize ?? 1024 * 1024, // 1MB
      rateLimitPerSecond: config?.rateLimitPerSecond ?? 100,
    };

    // Start processing timer
    this.startProcessing();
  }

  /**
   * Handle incoming message
   */
  async handleMessage(
    message: AnyMessage,
    connection: Connection,
    onMessage: (msg: AnyMessage, conn: Connection) => void | Promise<void>
  ): Promise<void> {
    // Check rate limit
    if (!this.checkRateLimit(connection.connectionId)) {
      throw new Error('Rate limit exceeded');
    }

    // Validate message size
    const size = this.getMessageSize(message);
    if (size > this.config.maxMessageSize) {
      throw new Error('Message too large');
    }

    this.stats.received++;
    this.stats.bytesReceived += size;

    // Process message
    await onMessage(message, connection);

    // Send ack if enabled
    if (this.config.enableAck) {
      await this.sendAck(message, connection);
    }
  }

  /**
   * Queue message for delivery
   */
  queueMessage(
    message: AnyMessage,
    targetConnectionId?: string,
    targetRoomId?: string
  ): string {
    const queueId = generateId('msg');
    const now = Date.now();

    const queueItem: MessageQueueItem = {
      message,
      targetConnectionId,
      targetRoomId,
      expiresAt: now + this.config.messageTTL,
      delivery: {
        messageId: message.id,
        status: 'pending',
        attempts: 0,
      },
      createdAt: now,
      nextRetryAt: now,
      serialized: undefined,
    };

    // Check queue size
    if (this.messageQueue.size >= this.config.maxQueueSize) {
      // Remove oldest expired message
      this.removeExpiredMessages();
    }

    this.messageQueue.set(queueId, queueItem);
    this.stats.queued++;

    return queueId;
  }

  /**
   * Send message to connection
   */
  async sendMessage(
    message: AnyMessage,
    connection: Connection,
    options?: Partial<SerializationOptions>
  ): Promise<boolean> {
    try {
      // Serialize message
      const serialized = this.serializeMessage(message, options);
      const size = serialized.byteLength;

      // Check if connection is ready
      if (connection.socket.readyState !== WebSocket.OPEN) {
        // Queue for later
        this.queueMessage(message, connection.connectionId);
        return false;
      }

      // Send message
      connection.socket.send(serialized);

      this.stats.sent++;
      this.stats.bytesSent += size;

      // Track delivery if ack enabled
      if (this.config.enableAck) {
        this.trackDelivery(message.id, connection);
      }

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      this.stats.failed++;

      // Queue for retry
      if (this.shouldRetry(message)) {
        this.queueMessage(message, connection.connectionId);
      }

      return false;
    }
  }

  /**
   * Broadcast message to multiple connections
   */
  async broadcastMessage(
    message: AnyMessage,
    connections: Connection[],
    options?: Partial<SerializationOptions>
  ): Promise<number> {
    let successCount = 0;

    for (const connection of connections) {
      const sent = await this.sendMessage(message, connection, options);
      if (sent) {
        successCount++;
      }
    }

    return successCount;
  }

  /**
   * Handle message acknowledgement
   */
  handleAck(ack: MessageAck): void {
    const pending = this.pendingAcks.get(ack.messageId);
    if (!pending) {
      return;
    }

    this.pendingAcks.delete(ack.messageId);

    if (ack.processed) {
      this.stats.delivered++;
    }

    // Notify delivery callbacks
    const callbacks = this.deliveryCallbacks.get(ack.messageId);
    if (callbacks) {
      const delivery: MessageDelivery = {
        messageId: ack.messageId,
        status: ack.processed ? 'delivered' : 'failed',
        attempts: 1,
        deliveredAt: ack.timestamp,
        error: ack.error,
      };

      for (const callback of callbacks) {
        try {
          callback(delivery);
        } catch (error) {
          console.error('Error in delivery callback:', error);
        }
      }

      this.deliveryCallbacks.delete(ack.messageId);
    }
  }

  /**
   * Subscribe to delivery status
   */
  onDelivery(messageId: string, callback: (delivery: MessageDelivery) => void): () => void {
    let callbacks = this.deliveryCallbacks.get(messageId);
    if (!callbacks) {
      callbacks = new Set();
      this.deliveryCallbacks.set(messageId, callbacks);
    }

    callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.deliveryCallbacks.delete(messageId);
      }
    };
  }

  /**
   * Serialize message
   */
  serializeMessage(message: AnyMessage, options?: Partial<SerializationOptions>): Uint8Array {
    const serializationOptions: SerializationOptions = {
      format: options?.format ?? this.config.defaultSerialization,
      compressed: options?.compressed ?? this.config.enableCompression,
      binary: options?.binary ?? false,
    };

    let data: string;

    switch (serializationOptions.format) {
      case SerializationFormat.JSON:
        data = JSON.stringify(message);
        break;
      case SerializationFormat.MESSAGE_PACK:
        // Would use MessagePack library in production
        data = JSON.stringify(message);
        break;
      case SerializationFormat.CBOR:
        // Would use CBOR library in production
        data = JSON.stringify(message);
        break;
      default:
        data = JSON.stringify(message);
    }

    let bytes = new TextEncoder().encode(data);

    // Compress if enabled
    if (serializationOptions.compressed) {
      bytes = this.compressBytes(bytes);
    }

    return bytes;
  }

  /**
   * Deserialize message
   */
  deserializeMessage(data: ArrayBuffer | string, format?: SerializationFormat): AnyMessage {
    let bytes: Uint8Array;

    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data);
    } else {
      bytes = new Uint8Array(data);
    }

    // Try to decompress
    try {
      bytes = this.decompressBytes(bytes);
    } catch {
      // Not compressed, continue
    }

    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
  }

  /**
   * Get message queue size
   */
  getQueueSize(): number {
    return this.messageQueue.size;
  }

  /**
   * Get statistics
   */
  getStats(): MessageStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      sent: 0,
      received: 0,
      delivered: 0,
      failed: 0,
      queued: 0,
      retried: 0,
      bytesSent: 0,
      bytesReceived: 0,
    };
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    this.messageQueue.clear();
  }

  /**
   * Destroy message handler
   */
  destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }

    this.clearQueue();
    this.pendingAcks.clear();
    this.deliveryCallbacks.clear();
    this.rateLimitCounter.clear();
  }

  /**
   * Start message processing timer
   */
  private startProcessing(): void {
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, 100);
  }

  /**
   * Process message queue
   */
  private processQueue(): void {
    const now = Date.now();

    for (const [queueId, item] of this.messageQueue.entries()) {
      // Check if expired
      if (now > item.expiresAt) {
        this.messageQueue.delete(queueId);
        this.stats.failed++;
        continue;
      }

      // Check if ready for retry
      if (now < item.nextRetryAt) {
        continue;
      }

      // Attempt delivery
      // In a real implementation, this would get the connection and deliver
      // For now, we'll just update the retry count
      item.delivery.attempts++;

      if (item.delivery.attempts >= this.config.maxRetries) {
        this.messageQueue.delete(queueId);
        this.stats.failed++;
      } else {
        item.nextRetryAt = now + this.config.retryDelay * Math.pow(2, item.delivery.attempts);
        this.stats.retried++;
      }
    }
  }

  /**
   * Check rate limit for connection
   */
  private checkRateLimit(connectionId: string): boolean {
    const now = Date.now();
    let counter = this.rateLimitCounter.get(connectionId);

    if (!counter || now > counter.resetTime) {
      counter = {
        count: 1,
        resetTime: now + 1000, // 1 second window
      };
      this.rateLimitCounter.set(connectionId, counter);
      return true;
    }

    if (counter.count >= this.config.rateLimitPerSecond) {
      return false;
    }

    counter.count++;
    return true;
  }

  /**
   * Remove expired messages from queue
   */
  private removeExpiredMessages(): void {
    const now = Date.now();

    for (const [queueId, item] of this.messageQueue.entries()) {
      if (now > item.expiresAt) {
        this.messageQueue.delete(queueId);
      }
    }
  }

  /**
   * Track message delivery
   */
  private trackDelivery(messageId: string, connection: Connection): void {
    const timeout = Date.now() + this.config.ackTimeout;

    this.pendingAcks.set(messageId, {
      message: {} as AnyMessage,
      timeout,
    });

    // Set timeout for ack
    setTimeout(() => {
      const pending = this.pendingAcks.get(messageId);
      if (pending && pending.timeout === timeout) {
        // Ack timeout
        this.pendingAcks.delete(messageId);
        this.stats.failed++;
      }
    }, this.config.ackTimeout);
  }

  /**
   * Send acknowledgement for message
   */
  private async sendAck(message: AnyMessage, connection: Connection): Promise<void> {
    const ack: MessageAck = {
      messageId: message.id,
      timestamp: Date.now(),
      processed: true,
    };

    // Create ack message
    const ackMessage: AnyMessage = {
      type: 'message_ack' as MessageType,
      id: generateId('msg'),
      timestamp: Date.now(),
      metadata: { ack },
    };

    await this.sendMessage(ackMessage, connection);
  }

  /**
   * Check if message should be retried
   */
  private shouldRetry(message: AnyMessage): boolean {
    // Don't retry certain message types
    const noRetryTypes = ['ping', 'pong', 'disconnect'];
    return !noRetryTypes.includes(message.type);
  }

  /**
   * Get message size in bytes
   */
  private getMessageSize(message: AnyMessage): number {
    const json = JSON.stringify(message);
    return json.length * 2; // UTF-16
  }

  /**
   * Compress bytes
   */
  private compressBytes(bytes: Uint8Array): Uint8Array {
    // In a real implementation, use CompressionStream or a compression library
    // For now, return as-is
    return bytes;
  }

  /**
   * Decompress bytes
   */
  private decompressBytes(bytes: Uint8Array): Uint8Array {
    // In a real implementation, use DecompressionStream or a compression library
    // For now, return as-is
    return bytes;
  }
}

/**
 * Message batcher for efficient delivery
 */
export class MessageBatcher {
  private batches: Map<string, AnyMessage[]>;
  private batchTimers: Map<string, ReturnType<typeof setTimeout>>;
  private config: {
    maxSize: number;
    timeout: number;
  };

  constructor(maxSize: number = 100, timeout: number = 100) {
    this.batches = new Map();
    this.batchTimers = new Map();
    this.config = {
      maxSize,
      timeout,
    };
  }

  /**
   * Add message to batch
   */
  add(targetId: string, message: AnyMessage, onBatch: (messages: AnyMessage[]) => void): void {
    let batch = this.batches.get(targetId);

    if (!batch) {
      batch = [];
      this.batches.set(targetId, batch);
    }

    batch.push(message);

    // Check if batch is full
    if (batch.length >= this.config.maxSize) {
      this.flush(targetId, onBatch);
    } else {
      // Set or reset timer
      this.scheduleFlush(targetId, onBatch);
    }
  }

  /**
   * Flush batch for target
   */
  flush(targetId: string, onBatch: (messages: AnyMessage[]) => void): void {
    const batch = this.batches.get(targetId);

    if (!batch || batch.length === 0) {
      return;
    }

    onBatch(batch);
    this.batches.delete(targetId);

    const timer = this.batchTimers.get(targetId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(targetId);
    }
  }

  /**
   * Flush all batches
   */
  flushAll(onBatch: (targetId: string, messages: AnyMessage[]) => void): void {
    for (const [targetId, batch] of this.batches.entries()) {
      if (batch.length > 0) {
        onBatch(targetId, batch);
      }
    }

    this.batches.clear();

    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
  }

  /**
   * Schedule batch flush
   */
  private scheduleFlush(targetId: string, onBatch: (messages: AnyMessage[]) => void): void {
    const existingTimer = this.batchTimers.get(targetId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.flush(targetId, onBatch);
    }, this.config.timeout);

    this.batchTimers.set(targetId, timer);
  }

  /**
   * Get batch size for target
   */
  getBatchSize(targetId: string): number {
    const batch = this.batches.get(targetId);
    return batch ? batch.length : 0;
  }

  /**
   * Clear all batches
   */
  clear(): void {
    this.batches.clear();

    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
  }
}

/**
 * Message priority queue
 */
export class MessagePriorityQueue {
  private queues: Map<MessagePriority, AnyMessage[]>;
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.queues = new Map();
    this.maxSize = maxSize;

    // Initialize queues for each priority
    for (const priority of [0, 1, 2, 3] as MessagePriority[]) {
      this.queues.set(priority, []);
    }
  }

  /**
   * Enqueue message
   */
  enqueue(message: AnyMessage): boolean {
    const priority = message.priority ?? 1; // Default to NORMAL
    const queue = this.queues.get(priority);

    if (!queue) {
      return false;
    }

    // Check size limit
    const totalSize = this.getTotalSize();
    if (totalSize >= this.maxSize) {
      // Remove lowest priority message
      this.dequeue();
    }

    queue.push(message);
    return true;
  }

  /**
   * Dequeue highest priority message
   */
  dequeue(): AnyMessage | null {
    // Check priorities in descending order (URGENT -> LOW)
    for (const priority of [3, 2, 1, 0] as MessagePriority[]) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift() ?? null;
      }
    }

    return null;
  }

  /**
   * Peek at highest priority message without removing
   */
  peek(): AnyMessage | null {
    for (const priority of [3, 2, 1, 0] as MessagePriority[]) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue[0];
      }
    }

    return null;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.getTotalSize();
  }

  /**
   * Clear all queues
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
  }

  /**
   * Get total size across all priorities
   */
  private getTotalSize(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }
}
