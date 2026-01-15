export interface Message {
  id: string;
  topic: string;
  payload: any;
  headers: MessageHeaders;
  timestamp: number;
  retryCount: number;
  ttl?: number;
}

export interface MessageHeaders {
  contentType?: string;
  correlationId?: string;
  replyTo?: string;
  messageId?: string;
  traceId?: string;
  priority?: MessagePriority;
  compression?: CompressionType;
  encoding?: string;
  [key: string]: any;
}

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export type CompressionType = 'none' | 'gzip' | 'deflate';

export interface Topic {
  id: string;
  name: string;
  pattern?: TopicPattern;
  partitions: number;
  replicationFactor: number;
  retention?: TopicRetention;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, any>;
}

export type TopicPattern = 'wildcard' | 'regex' | 'prefix' | 'exact';

export interface TopicRetention {
  duration?: number; // milliseconds
  size?: number; // bytes
  count?: number; // message count
}

export interface Subscription {
  id: string;
  topic: string;
  subscriber: string;
  filter?: SubscriptionFilter;
  deliveryGuarantee: DeliveryGuarantee;
  batchSize?: number;
  batchSizeBytes?: number;
  maxConcurrency?: number;
  retryPolicy: RetryPolicy;
  deadLetterQueue?: string;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, any>;
}

export interface SubscriptionFilter {
  topicPattern?: string;
  headerFilters?: Record<string, any>;
  payload?: any;
  contentType?: string;
}

export type DeliveryGuarantee = 'at-most-once' | 'at-least-once' | 'exactly-once';

export interface RetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface DeliveryResult {
  success: boolean;
  messageId: string;
  subscriber: string;
  timestamp: number;
  error?: string;
  retryAttempt?: number;
}

export interface TopicStats {
  messageCount: number;
  byteSize: number;
  producerCount: number;
  consumerCount: number;
  messageRate: number;
  errorRate: number;
  lastMessageTime: number;
}

export interface BrokerStats {
  totalTopics: number;
  totalSubscriptions: number;
  totalMessages: number;
  messageRate: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  uptime: number;
}

export interface RoutingRule {
  id: string;
  name: string;
  pattern: string;
  type: RoutingRuleType;
  actions: RoutingAction[];
  priority: number;
  enabled: boolean;
  createdAt: number;
}

export type RoutingRuleType = 'wildcard' | 'regex' | 'header' | 'content';

export interface RoutingAction {
  type: RoutingActionType;
  target?: string;
  transform?: any;
  filter?: any;
  metadata?: Record<string, any>;
}

export type RoutingActionType = 'forward' | 'transform' | 'filter' | 'dead-letter';

export interface SubscriberHealth {
  subscriber: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: number;
  responseTime: number;
  errorRate: number;
  connected: boolean;
  metadata: Record<string, any>;
}

export interface DeadLetterMessage {
  id: string;
  originalMessage: Message;
  error: string;
  attempts: number;
  timestamp: number;
  metadata: Record<string, any>;
}