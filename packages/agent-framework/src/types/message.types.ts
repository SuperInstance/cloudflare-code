/**
 * Message and Communication Type Definitions
 *
 * This file contains all types related to agent communication,
 * including message schemas, protocols, and delivery guarantees.
 */

import type { AgentId, MessageId, ConversationId } from './agent.types';

/**
 * Message types for agent communication
 */
export enum MessageType {
  // Basic message types
  REQUEST = 'request',
  RESPONSE = 'response',
  NOTIFICATION = 'notification',
  ERROR = 'error',
  BROADCAST = 'broadcast',

  // Control messages
  HEARTBEAT = 'heartbeat',
  STATUS_UPDATE = 'status_update',
  STATE_CHANGE = 'state_change',

  // Task-related messages
  TASK_ASSIGNMENT = 'task_assignment',
  TASK_UPDATE = 'task_update',
  TASK_COMPLETION = 'task_completion',
  TASK_CANCELLATION = 'task_cancellation',

  // Collaboration messages
  COLLABORATION_REQUEST = 'collaboration_request',
  COLLABORATION_RESPONSE = 'collaboration_response',
  CONSENSUS_PROPOSAL = 'consensus_proposal',
  VOTE = 'vote',

  // Discovery messages
  DISCOVERY_QUERY = 'discovery_query',
  DISCOVERY_RESPONSE = 'discovery_response',
  CAPABILITY_ANNOUNCEMENT = 'capability_announcement',

  // Lifecycle messages
  AGENT_SPAWNED = 'agent_spawned',
  AGENT_TERMINATED = 'agent_terminated',
  AGENT_READY = 'agent_ready',

  // Streaming messages
  STREAM_START = 'stream_start',
  STREAM_DATA = 'stream_data',
  STREAM_END = 'stream_end',
  STREAM_ERROR = 'stream_error'
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
  CRITICAL = 4
}

/**
 * Delivery guarantees for messages
 */
export enum DeliveryGuarantee {
  AT_MOST_ONCE = 'at_most_once',
  AT_LEAST_ONCE = 'at_least_once',
  EXACTLY_ONCE = 'exactly_once'
}

/**
 * Message routing strategy
 */
export enum RoutingStrategy {
  DIRECT = 'direct',
  BROADCAST = 'broadcast',
  MULTICAST = 'multicast',
  ANYCAST = 'anycast',
  PUBLISH_SUBSCRIBE = 'publish_subscribe'
}

/**
 * Base message interface
 */
export interface Message {
  id: MessageId;
  type: MessageType;
  from: AgentId;
  to: AgentId | AgentId[] | '*';
  payload: MessagePayload;
  priority: MessagePriority;
  timestamp: number;
  correlationId?: string;
  conversationId?: ConversationId;
  replyTo?: MessageId;
  ttl?: number;
  deliveryGuarantee: DeliveryGuarantee;
  routingStrategy: RoutingStrategy;
  headers: MessageHeaders;
  metadata: Record<string, unknown>;
}

/**
 * Message headers for routing and processing
 */
export interface MessageHeaders {
  contentType: string;
  contentEncoding?: string;
  contentLength?: number;
  tracing?: TracingHeaders;
  security?: SecurityHeaders;
  routing?: RoutingHeaders;
  retry?: RetryHeaders;
}

/**
 * Distributed tracing headers
 */
export interface TracingHeaders {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled?: boolean;
  baggage?: Record<string, string>;
}

/**
 * Security headers
 */
export interface SecurityHeaders {
  authenticated?: boolean;
  encrypted?: boolean;
  signature?: string;
  token?: string;
  permissions?: string[];
}

/**
 * Routing headers
 */
export interface RoutingHeaders {
  topic?: string;
  queue?: string;
  exchange?: string;
  routingKey?: string;
}

/**
 * Retry headers
 */
export interface RetryHeaders {
  attempt: number;
  maxAttempts: number;
  initialDelay: number;
  nextRetryAt?: number;
}

/**
 * Message payload variants
 */
export type MessagePayload =
  | StringPayload
  | JsonPayload
  | BinaryPayload
  | StreamPayload
  | TaskPayload
  | ErrorPayload;

/**
 * String payload
 */
export interface StringPayload {
  type: 'string';
  data: string;
}

/**
 * JSON payload
 */
export interface JsonPayload {
  type: 'json';
  data: Record<string, unknown>;
}

/**
 * Binary payload
 */
export interface BinaryPayload {
  type: 'binary';
  data: ArrayBuffer;
  encoding?: string;
}

/**
 * Streaming payload
 */
export interface StreamPayload {
  type: 'stream';
  streamId: string;
  chunkIndex: number;
  totalChunks: number;
  data: unknown;
  isFinal: boolean;
}

/**
 * Task payload
 */
export interface TaskPayload {
  type: 'task';
  taskId: string;
  taskType: string;
  input: Record<string, unknown>;
  context?: TaskContext;
}

/**
 * Task context for execution
 */
export interface TaskContext {
  userId?: string;
  sessionId?: string;
  conversationId?: ConversationId;
  parentTaskId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Error payload
 */
export interface ErrorPayload {
  type: 'error';
  code: string;
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
}

/**
 * Message delivery status
 */
export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  PROCESSED = 'processed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

/**
 * Message delivery receipt
 */
export interface DeliveryReceipt {
  messageId: MessageId;
  status: DeliveryStatus;
  timestamp: number;
  recipientAgentId?: AgentId;
  error?: string;
  retryCount: number;
  processingTime?: number;
}

/**
 * Message queue entry
 */
export interface QueuedMessage {
  message: Message;
  queuedAt: number;
  attempts: number;
  nextAttemptAt: number;
  priority: MessagePriority;
}

/**
 * Pub/sub subscription
 */
export interface Subscription {
  subscriptionId: string;
  subscriberId: AgentId;
  topic: string;
  filter?: MessageFilter;
  createdAt: number;
  lastMessageAt?: number;
  messageCount: number;
  active: boolean;
}

/**
 * Message filter for subscriptions
 */
export interface MessageFilter {
  types?: MessageType[];
  priorities?: MessagePriority[];
  fromAgents?: AgentId[];
  headers?: Record<string, unknown>;
  payloadSchema?: Record<string, unknown>;
}

/**
 * Pub/sub topic
 */
export interface Topic {
  name: string;
  subscribers: Map<string, Subscription>;
  messageCount: number;
  lastMessageAt?: number;
  createdAt: number;
  retention?: number;
}

/**
 * Message batch
 */
export interface MessageBatch {
  messages: Message[];
  batchId: string;
  timestamp: number;
  size: number;
}

/**
 * Message acknowledgment
 */
export interface MessageAck {
  messageId: MessageId;
  acknowledged: boolean;
  timestamp: number;
  agentId: AgentId;
  error?: string;
}

/**
 * Message statistics
 */
export interface MessageStats {
  totalSent: number;
  totalReceived: number;
  totalDelivered: number;
  totalFailed: number;
  averageLatency: number;
  messagesByType: Record<MessageType, number>;
  messagesByPriority: Record<string, number>;
  deliveryRate: number;
  errorRate: number;
}

/**
 * Stream message for real-time communication
 */
export interface StreamMessage extends Message {
  type: MessageType.STREAM_DATA;
  payload: StreamPayload;
  streamPosition: number;
  isFinal: boolean;
}

/**
 * Request-response pattern
 */
export interface RequestResponse<TRequest = unknown, TResponse = unknown> {
  request: Message & { payload: JsonPayload & { data: TRequest } };
  response?: Message & { payload: JsonPayload & { data: TResponse } };
  timeout: number;
  startTime: number;
  endTime?: number;
  completed: boolean;
}

/**
 * Message builder options
 */
export interface MessageBuilderOptions {
  type: MessageType;
  from: AgentId;
  to: AgentId | AgentId[];
  payload: MessagePayload;
  priority?: MessagePriority;
  ttl?: number;
  deliveryGuarantee?: DeliveryGuarantee;
  conversationId?: ConversationId;
  replyTo?: MessageId;
  correlationId?: string;
  headers?: Partial<MessageHeaders>;
  metadata?: Record<string, unknown>;
}

/**
 * Message validation result
 */
export interface MessageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
