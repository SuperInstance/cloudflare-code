# @claudeflare/events

Event-driven architecture for ClaudeFlare - Event bus, sourcing, CQRS, saga orchestration, and message queues built on Cloudflare Workers and Durable Objects.

## Features

- **Event Bus** - Publish/subscribe messaging with Durable Objects
- **Event Sourcing** - Complete event store with snapshot support
- **CQRS** - Command Query Responsibility Segregation with projections
- **Message Queues** - Standard, priority, and delayed delivery queues
- **Event Replay** - Time travel and event replay capabilities
- **Saga Orchestration** - Distributed transaction coordination
- **Event Governance** - Schema registry, validation, and policies

## Installation

```bash
npm install @claudeflare/events
```

## Quick Start

### Event Bus

```typescript
import { EventBusFactory } from '@claudeflare/events';

// Create event bus
const factory = new EventBusFactory(env.EVENT_BUS);
const eventBus = factory.create();

// Publish an event
await eventBus.publish({
  metadata: {
    eventId: 'evt_123',
    eventType: 'UserCreated',
    timestamp: Date.now(),
    version: 1,
    source: 'user-service',
  },
  payload: {
    userId: 'user_123',
    email: 'user@example.com',
  },
});

// Subscribe to events
const subscriptionId = await eventBus.subscribe({
  topic: 'UserCreated',
  subscriptionId: 'sub_123',
  deliverySemantics: 'at-least-once',
  maxRetries: 3,
  retryDelayMs: 1000,
});

// Consume events
const events = await eventBus.consume(subscriptionId, 10);
for (const event of events) {
  console.log('Received:', event);
  await eventBus.acknowledge(subscriptionId, [event.metadata.eventId], {
    messageId: event.metadata.eventId,
    processedAt: Date.now(),
    processingTimeMs: 100,
    consumerId: 'consumer_1',
  });
}
```

### Event Sourcing

```typescript
import { EventStoreFactory, AggregateBase } from '@claudeflare/events';

// Create event store
const factory = new EventStoreFactory(env.EVENT_STORE);
const eventStore = factory.create();

// Create a stream
await eventStore.createStream('user_123');

// Append events
await eventStore.appendEvent('user_123', 'UserCreated', {
  email: 'user@example.com',
  username: 'johndoe',
});

// Read events
const events = await eventStore.readEvents('user_123');

// Create snapshot
await eventStore.createSnapshot('user_123', {
  userId: 'user_123',
  email: 'user@example.com',
  version: 100,
});
```

### Aggregates

```typescript
import { UserAccount } from '@claudeflare/events';

// Create aggregate
const user = new UserAccount('user_123');

// Execute domain logic
user.create('user@example.com', 'johndoe');
user.activate();
user.updateBalance(100);

// Get uncommitted events
const events = user.getUncommittedEvents();

// Commit events
user.commit();
```

### Message Queue

```typescript
import { MessageQueueFactory } from '@claudeflare/events';

// Create queue
const factory = new MessageQueueFactory(env.QUEUE);
const queue = factory.create();

// Enqueue message
const messageId = await queue.enqueue({
  type: 'SendEmail',
  to: 'user@example.com',
  subject: 'Welcome',
});

// Dequeue message
const messages = await queue.dequeue('consumer_1', { maxMessages: 10 });

// Acknowledge processing
await queue.acknowledge(messageId, 'consumer_1');
```

### Saga Orchestration

```typescript
import { SagaOrchestratorFactory } from '@claudeflare/events';

// Define saga
const orderFulfillmentSaga = {
  sagaType: 'OrderFulfillment',
  name: 'Order Fulfillment Saga',
  steps: [
    {
      stepId: 'reserve-inventory',
      action: {
        type: 'invoke',
        target: 'https://inventory.service/reserve',
      },
      compensation: {
        type: 'invoke',
        target: 'https://inventory.service/release',
      },
      timeoutMs: 5000,
      retryPolicy: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        backoffType: 'exponential',
      },
    },
    // ... more steps
  ],
  compensationStrategy: 'automatic',
};

// Register saga
const factory = new SagaOrchestratorFactory(env.SAGA);
const orchestrator = factory.create();
await orchestrator.registerDefinition(orderFulfillmentSaga);

// Start saga instance
const sagaId = await orchestrator.startSaga('OrderFulfillment', {
  correlationId: 'order_123',
  variables: { orderId: 'order_123' },
});

// Monitor saga
const instance = await orchestrator.getSaga(sagaId);
console.log('Saga state:', instance.state);
```

### Event Replay

```typescript
import { EventReplayFactory } from '@claudeflare/events';

// Create replay service
const factory = new EventReplayFactory(env.REPLAY);
const replay = factory.create();

// Start replay
const replayId = await replay.startReplay({
  streamId: 'user_123',
  fromVersion: 1,
  toVersion: 100,
  batchSize: 10,
  delayMs: 100,
  targetHandler: 'user-projection',
});

// Monitor replay
const status = await replay.getReplayStatus(replayId);
console.log('Progress:', status.progress, '/', status.total);

// Time travel
const result = await replay.timeTravel(
  Date.now() - 24 * 60 * 60 * 1000, // 24 hours ago
  'user-projection'
);
```

### Schema Registry

```typescript
import { SchemaRegistryFactory } from '@claudeflare/events';

// Create schema registry
const factory = new SchemaRegistryFactory(env.SCHEMA_REGISTRY);
const registry = factory.create();

// Register schema
await registry.registerSchema({
  eventType: 'UserCreated',
  version: 1,
  schema: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      email: { type: 'string' },
      username: { type: 'string' },
    },
    required: ['userId', 'email', 'username'],
  },
  compatibility: 'backward',
  deprecated: false,
});

// Validate event
const result = await registry.validateEvent('UserCreated', 1, payload);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Evolve schema
const newVersion = await registry.evolveSchema(
  'UserCreated',
  newSchema,
  'backward-compatible'
);
```

## Architecture

### Components

- **Event Bus** - Durable Object-based pub/sub messaging
- **Event Store** - R2-backed event persistence with snapshots
- **Message Queue** - Priority queues with consumer groups
- **Saga Orchestrator** - Distributed transaction coordination
- **Event Replay** - Event replay and time travel
- **Schema Registry** - Event schema management and validation

### Data Flow

```
Producer → Event Bus → Consumer Groups → Event Store → Projections
                ↓
          Message Queue → Consumers
                ↓
          Saga Orchestrator → Compensation
```

## Durable Objects

The system uses several Durable Objects:

- `EventBusDurableObject` - Event routing and delivery
- `EventStoreDurableObject` - Event persistence and retrieval
- `MessageQueueDurableObject` - Queue management
- `SagaOrchestratorDurableObject` - Saga coordination
- `EventReplayDurableObject` - Event replay management
- `SchemaRegistryDurableObject` - Schema and policy management

## Storage

- **R2** - Event persistence, snapshots, dead letter queues
- **Durable Object Storage** - State management, indexes, metadata

## API Reference

See the [TypeScript documentation](./docs/API.md) for detailed API reference.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
