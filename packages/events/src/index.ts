/**
 * ClaudeFlare Event-Driven Architecture
 *
 * A comprehensive event-driven architecture system built on Cloudflare Workers
 * and Durable Objects, providing:
 *
 * - Event Bus with pub/sub messaging
 * - Event Sourcing and CQRS
 * - Message Queues (standard, priority, delayed)
 * - Event Replay and Time Travel
 * - Saga Orchestration and Choreography
 * - Event Governance (schema registry, policies)
 *
 * @package @claudeflare/events
 */

// Core types
export * from './types';

// Utilities
export * from './utils';

// Storage layer
export * from './storage';

// Event Bus
export * from './bus';

// Event Sourcing
export * from './sourcing';

// Message Queue
export * from './queue';

// Event Replay
export * from './replay';

// Saga Orchestration
export * from './saga';

// Event Governance
export * from './governance';

// Message Router
export * from './router';

// Event Filter
export * from './filter';

// Event Transformer
export * from './transformer';

// Event Aggregator
export * from './aggregation';

// Dead Letter Handler
export * from './deadletter';

// Re-exports for convenience
export {
  // Event Bus
  EventBusDurableObject,
  EventBusClient,
  EventBusFactory,
  EventStreamerDurableObject,
  EventStreamerClient,
  EventStreamerFactory,

  // Event Sourcing
  EventStoreDurableObject,
  EventStoreClient,
  EventStoreFactory,
  AggregateBase,
  EventSourcedRepository,
  AggregateFactory,
  CommandBus,
  QueryBus,
  ProjectionEngine,
  ReadModel,

  // Message Queue
  MessageQueueDurableObject,
  PriorityQueueDurableObject,
  DeadLetterQueueDurableObject,

  // Event Replay
  EventReplayDurableObject,
  EventReplayClient,
  EventReplayFactory,

  // Saga
  SagaOrchestratorDurableObject,
  SagaOrchestratorClient,
  SagaOrchestratorFactory,
  ChoreographyCoordinatorDurableObject,
  ChoreographyClient,
  ChoreographyFactory,

  // Governance
  SchemaRegistryDurableObject,
  SchemaRegistryClient,
  SchemaRegistryFactory,

  // Message Router
  MessageRouter,
  MessageRouterDurableObject,

  // Event Filter
  EventFilter,

  // Event Transformer
  EventTransformer,

  // Event Aggregator
  EventAggregator,

  // Dead Letter Handler
  DeadLetterHandler,
  DeadLetterQueue,
} from './bus';
