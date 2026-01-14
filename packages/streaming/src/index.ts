/**
 * ClaudeFlare Streaming Infrastructure
 * Real-time event streaming, message queues, stream processing, and analytics
 */

// ============================================================================
// Core Types
// ============================================================================

export * from './types/index.js';

// ============================================================================
// Event Streaming
// ============================================================================

export {
  EventStream,
  formatSSE,
  parseSSE,
} from './stream/event-stream.js';

// ============================================================================
// Message Queue
// ============================================================================

export {
  MessageQueue,
  PriorityQueue,
  FIFOQueue,
  DelayedQueue,
  QueueManager,
} from './queue/queue.js';

// ============================================================================
// Stream Processing
// ============================================================================

export {
  StreamTransformer,
  WindowOperator,
  StreamAggregator,
  Aggregations,
  StreamJoiner,
  ComplexEventProcessor,
  Patterns,
} from './processing/processor.js';

export type {
  WindowedEvent,
  JoinedEvent,
} from './processing/processor.js';

// ============================================================================
// Event Sourcing
// ============================================================================

export {
  EventStore,
  CQRS,
  createEventStore,
  createCQRS,
} from './sourcing/event-store.js';

export type {
  AppendResult,
  CommandResult,
  QueryResult,
  EventStoreStats,
  ProjectionHandler,
  CommandHandler,
  QueryHandler,
  ConcurrencyError,
} from './sourcing/event-store.js';

// ============================================================================
// Pub/Sub
// ============================================================================

export {
  PubSubBroker,
  createPubSubBroker,
} from './pubsub/broker.js';

export type {
  PubSubStats,
  TopicStats,
} from './pubsub/broker.js';

// ============================================================================
// Analytics
// ============================================================================

export {
  StreamAnalytics,
  PatternRecognizer,
  TrendAnalyzer,
  createStreamAnalytics,
  createPatternRecognizer,
  createTrendAnalyzer,
} from './analytics/analytics.js';

export type {
  Pattern,
  TrendAnalysis,
} from './analytics/analytics.js';

// ============================================================================
// Backpressure
// ============================================================================

export {
  BackpressureController,
  FlowController,
  CircuitBreaker,
  RateLimiter,
  AdaptiveThrottler,
  createBackpressureController,
  createFlowController,
  createCircuitBreaker,
  createRateLimiter,
  createAdaptiveThrottler,
} from './backpressure/controller.js';

export type {
  BackpressureStats,
  BackpressureResult,
} from './backpressure/controller.js';

// ============================================================================
// Utilities
// ============================================================================

export {
  generateEventId,
  generateMessageId,
  generateStreamId,
  generateCommitId,
  generateSnapshotId,
  generateSubscriptionId,
  generateTopicId,
  generateCorrelationId,
  generateCausationId,
  generateJobId,
  generatePartitionKey,
  generateTimeBasedId,
  generateUUID,
  generateSnowflakeId,
} from './utils/id-generator.js';

export {
  delay,
  timeout,
  retry,
  debounce,
  throttle,
  measureTime,
  TokenBucket,
  SlidingWindowRateLimiter,
} from './utils/timing.js';

export {
  validateEvent,
  validateMessage,
  validateQueueOptions,
  validateWindowOptions,
  validateSubscriptionFilter,
  validatePublishOptions,
  validateRetryPolicy,
  validateBackpressureStrategy,
  isStreamEvent,
  isMessage,
  isEventFilter,
} from './utils/validation.js';

export {
  calculatePercentile,
  calculateMovingAverage,
  calculateEMA,
  calculateRate,
  calculateStatistics,
  LatencyTracker,
  ThroughputTracker,
  AnomalyDetector,
  ExponentialHistogram,
} from './utils/metrics.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
