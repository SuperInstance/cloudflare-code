/**
 * Message queue system type definitions
 * Provides comprehensive type safety for all queue operations
 */

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Delivery guarantees
 */
export enum DeliveryGuarantee {
  AT_MOST_ONCE = 'at-most-once',
  AT_LEAST_ONCE = 'at-least-once',
  EXACTLY_ONCE = 'exactly-once'
}

/**
 * Message state tracking
 */
export enum MessageState {
  PENDING = 'pending',
  PROCESSING = 'processing',
  ACKNOWLEDGED = 'acknowledged',
  FAILED = 'failed',
  DEAD_LETTERED = 'dead-lettered'
}

/**
 * Queue types
 */
export enum QueueType {
  FIFO = 'fifo',
  STANDARD = 'standard',
  DELAYED = 'delayed',
  PRIORITY = 'priority'
}

/**
 * Retry policy types
 */
export enum RetryPolicyType {
  FIXED_DELAY = 'fixed-delay',
  EXPONENTIAL_BACKOFF = 'exponential-backoff',
  LINEAR_BACKOFF = 'linear-backoff',
  CUSTOM = 'custom'
}

/**
 * Core message interface
 */
export interface Message<T = unknown> {
  /** Unique message identifier */
  id: string;
  /** Message payload */
  body: T;
  /** Message metadata */
  metadata: MessageMetadata;
  /** Delivery guarantees */
  deliveryGuarantee: DeliveryGuarantee;
  /** Current state */
  state: MessageState;
  /** Retry count */
  retryCount: number;
  /** Timestamps */
  timestamps: MessageTimestamps;
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  /** Content type for serialization */
  contentType?: string;
  /** Message schema version */
  schemaVersion?: string;
  /** Correlation ID for tracing */
  correlationId?: string;
  /** Causation ID for event sourcing */
  causationId?: string;
  /** Message group for FIFO ordering */
  messageGroupId?: string;
  /** Message deduplication ID */
  messageDeduplicationId?: string;
  /** Custom headers */
  headers: Record<string, string>;
  /** Message priority */
  priority: MessagePriority;
  /** Time to live in seconds */
  ttl?: number;
  /** Delay in seconds before delivery */
  delay?: number;
}

/**
 * Message timestamps
 */
export interface MessageTimestamps {
  /** When message was created */
  createdAt: number;
  /** When message was enqueued */
  enqueuedAt?: number;
  /** When message was first received */
  firstReceivedAt?: number;
  /** When message was last received */
  lastReceivedAt?: number;
  /** When message was acknowledged */
  acknowledgedAt?: number;
  /** When message failed */
  failedAt?: number;
  /** Estimated next delivery time */
  nextDeliveryAt?: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Queue name */
  name: string;
  /** Queue type */
  type: QueueType;
  /** Delivery guarantee */
  deliveryGuarantee: DeliveryGuarantee;
  /** Maximum message size in bytes */
  maxMessageSize?: number;
  /** Message time to live in seconds */
  messageTTL?: number;
  /** Maximum receive count before dead letter */
  maxReceiveCount?: number;
  /** Dead letter queue name */
  deadLetterQueue?: string;
  /** Visibility timeout in seconds */
  visibilityTimeout?: number;
  /** Delivery delay in seconds */
  deliveryDelay?: number;
  /** Maximum queue size in bytes */
  maxQueueSize?: number;
  /** Retention period in seconds */
  retentionPeriod?: number;
  /** Consumer configuration */
  consumer?: ConsumerConfig;
  /** Retry policy */
  retryPolicy?: RetryPolicy;
}

/**
 * Consumer configuration
 */
export interface ConsumerConfig {
  /** Consumer group name */
  groupName?: string;
  /** Maximum concurrent messages */
  maxConcurrentMessages?: number;
  /** Batch size for batch consumption */
  batchSize?: number;
  /** Wait time for long polling */
  waitTimeSeconds?: number;
  /** Prefetch count */
  prefetchCount?: number;
  /** Consumer timeout */
  timeout?: number;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Policy type */
  type: RetryPolicyType;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier for exponential */
  backoffMultiplier?: number;
  /** Custom delay calculator */
  customDelay?: (attempt: number) => number;
}

/**
 * Producer configuration
 */
export interface ProducerConfig {
  /** Enable publisher confirms */
  enableConfirms?: boolean;
  /** Batch size for batch publishing */
  batchSize?: number;
  /** Compression enabled */
  compressionEnabled?: boolean;
  /** Timeout for publish operations */
  timeout?: number;
  /** Maximum retries for failed publishes */
  maxRetries?: number;
}

/**
 * Consumer message handler
 */
export type MessageHandler<T = unknown> = (
  message: Message<T>
) => Promise<void> | void;

/**
 * Batch message handler
 */
export type BatchMessageHandler<T = unknown> = (
  messages: Message<T>[]
) => Promise<void> | void;

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Queue name */
  name: string;
  /** Approximate number of messages */
  approximateMessageCount: number;
  /** Approximate number of messages not visible */
  approximateNotVisibleCount: number;
  /** Approximate number of delayed messages */
  approximateDelayedCount: number;
  /** Number of dead lettered messages */
  deadLetterCount: number;
  /** Message size statistics */
  sizeStats: MessageSizeStats;
  /** Processing statistics */
  processingStats: ProcessingStats;
  /** Timestamp */
  timestamp: number;
}

/**
 * Message size statistics
 */
export interface MessageSizeStats {
  /** Minimum message size */
  min: number;
  /** Maximum message size */
  max: number;
  /** Average message size */
  average: number;
  /** Total size */
  total: number;
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
  /** Total messages processed */
  totalProcessed: number;
  /** Successful messages */
  successful: number;
  /** Failed messages */
  failed: number;
  /** Average processing time */
  averageProcessingTime: number;
  /** Throughput per second */
  throughput: number;
}

/**
 * Queue metrics
 */
export interface QueueMetrics {
  /** Queue name */
  queueName: string;
  /** Producer metrics */
  producer: ProducerMetrics;
  /** Consumer metrics */
  consumer: ConsumerMetrics;
  /** Error metrics */
  errors: ErrorMetrics;
  /** Timestamp */
  timestamp: number;
}

/**
 * Producer metrics
 */
export interface ProducerMetrics {
  /** Total messages published */
  totalPublished: number;
  /** Publish success rate */
  successRate: number;
  /** Average publish latency */
  averageLatency: number;
  /** Bytes published */
  bytesPublished: number;
}

/**
 * Consumer metrics
 */
export interface ConsumerMetrics {
  /** Total messages consumed */
  totalConsumed: number;
  /** Acknowledgment rate */
  acknowledgmentRate: number;
  /** Average processing latency */
  averageProcessingLatency: number;
  /** Active consumers */
  activeConsumers: number;
}

/**
 * Error metrics
 */
export interface ErrorMetrics {
  /** Total errors */
  totalErrors: number;
  /** Error rate */
  errorRate: number;
  /** Errors by type */
  errorsByType: Record<string, number>;
  /** Recent errors */
  recentErrors: ErrorInfo[];
}

/**
 * Error information
 */
export interface ErrorInfo {
  /** Error type */
  type: string;
  /** Error message */
  message: string;
  /** Timestamp */
  timestamp: number;
  /** Context */
  context?: Record<string, unknown>;
}

/**
 * Publish result
 */
export interface PublishResult {
  /** Message ID */
  messageId: string;
  /** Sequence number for FIFO queues */
  sequenceNumber?: string;
  /** Success status */
  success: boolean;
  /** Error if failed */
  error?: Error;
}

/**
 * Batch publish result
 */
export interface BatchPublishResult {
  /** Successful publishes */
  successful: PublishResult[];
  /** Failed publishes */
  failed: PublishResult[];
  /** Total count */
  total: number;
  /** Success count */
  successCount: number;
  /** Failure count */
  failureCount: number;
}

/**
 * Receive result
 */
export interface ReceiveResult<T = unknown> {
  /** Received messages */
  messages: Message<T>[];
  /** Receipt handles for acknowledgment */
  receiptHandles: string[];
}

/**
 * Acknowledgment result
 */
export interface AckResult {
  /** Success status */
  success: boolean;
  /** Message ID */
  messageId: string;
  /** Error if failed */
  error?: Error;
}

/**
 * Dead letter entry
 */
export interface DeadLetterEntry {
  /** Original message */
  message: Message;
  /** Failure reason */
  reason: string;
  /** Error details */
  error?: Error;
  /** Timestamp */
  timestamp: number;
  /** Original queue */
  originalQueue: string;
  /** Retry count */
  retryCount: number;
  /** Next retry time */
  nextRetryAt?: number;
}

/**
 * Queue filter options
 */
export interface QueueFilterOptions {
  /** Filter by queue type */
  type?: QueueType;
  /** Filter by name pattern */
  namePattern?: string;
  /** Filter by tags */
  tags?: Record<string, string>;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Overall health */
  healthy: boolean;
  /** Queue name */
  queueName: string;
  /** Checks performed */
  checks: HealthCheck[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Individual health check
 */
export interface HealthCheck {
  /** Check name */
  name: string;
  /** Status */
  status: 'pass' | 'fail' | 'warn';
  /** Message */
  message?: string;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Event types for queue monitoring
 */
export enum QueueEventType {
  MESSAGE_PUBLISHED = 'message.published',
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_ACKNOWLEDGED = 'message.acknowledged',
  MESSAGE_FAILED = 'message.failed',
  MESSAGE_DEAD_LETTERED = 'message.dead_lettered',
  QUEUE_CREATED = 'queue.created',
  QUEUE_DELETED = 'queue.deleted',
  QUEUE_PURGED = 'queue.purged',
  CONSUMER_REGISTERED = 'consumer.registered',
  CONSUMER_DEREGISTERED = 'consumer.deregistered'
}

/**
 * Queue event
 */
export interface QueueEvent {
  /** Event type */
  type: QueueEventType;
  /** Queue name */
  queueName: string;
  /** Event data */
  data: unknown;
  /** Timestamp */
  timestamp: number;
  /** Event ID */
  eventId: string;
}

/**
 * Consumer registration
 */
export interface ConsumerRegistration {
  /** Consumer ID */
  consumerId: string;
  /** Queue name */
  queueName: string;
  /** Consumer group */
  groupName?: string;
  /** Registered at */
  registeredAt: number;
  /** Last activity */
  lastActivityAt: number;
  /** Status */
  status: 'active' | 'inactive' | 'disconnected';
}

/**
 * Message batch options
 */
export interface MessageBatchOptions {
  /** Batch size */
  size: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Wait for full batch */
  waitForFullBatch?: boolean;
}

/**
 * Purge options
 */
export interface PurgeOptions {
  /** Purge specific message IDs only */
  messageIds?: string[];
  /** Purge before timestamp */
  beforeTimestamp?: number;
  /** Purge with specific state */
  state?: MessageState;
}

/**
 * Deduplication options
 */
export interface DeduplicationOptions {
  /** Enable deduplication */
  enabled: boolean;
  /** Deduplication window in milliseconds */
  windowMs: number;
  /** Hash function for deduplication */
  hashFunction?: (message: Message) => string;
}

/**
 * Compression options
 */
export interface CompressionOptions {
  /** Enable compression */
  enabled: boolean;
  /** Compression algorithm */
  algorithm: 'gzip' | 'brotli' | 'zstd';
  /** Compression threshold in bytes */
  threshold: number;
  /** Compression level */
  level?: number;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /** Enable metrics collection */
  enableMetrics: boolean;
  /** Metrics retention period in seconds */
  retentionPeriod?: number;
  /** Sampling rate (0-1) */
  samplingRate?: number;
  /** Custom tags */
  tags?: Record<string, string>;
}
