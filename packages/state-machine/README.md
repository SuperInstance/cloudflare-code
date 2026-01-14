# @claudeflare/state-machine

Advanced state machine and workflow orchestration for ClaudeFlare distributed AI coding platform.

## Features

- **State Machine Engine**: Type-safe state machine definition with transitions, guards, and actions
- **Hierarchical States**: Support for nested and compound states
- **Parallel States**: Execute multiple state machines in parallel
- **State Persistence**: Save and restore state machine snapshots
- **Transition Hooks**: Before/after hooks for transitions
- **State Visualization**: Generate Mermaid, DOT, and SVG diagrams
- **Comprehensive Testing**: Path exploration, property-based testing, and coverage analysis
- **Distributed Coordination**: Leader election, state replication, and consensus
- **Analytics & Metrics**: Transition metrics, anomaly detection, and trend analysis

## Installation

```bash
npm install @claudeflare/state-machine
```

## Quick Start

```typescript
import { createStateMachine } from '@claudeflare/state-machine';

// Define your state machine
const definition = {
  initial: 'idle',
  states: {
    idle: {
      onEntry: () => console.log('Entered idle'),
      transitions: [
        { from: 'idle', to: 'running', on: 'START' },
        { from: 'idle', to: 'paused', on: 'PAUSE' },
      ],
    },
    running: {
      transitions: [
        { from: 'running', to: 'paused', on: 'PAUSE' },
        { from: 'running', to: 'idle', on: 'STOP' },
      ],
    },
    paused: {
      transitions: [
        { from: 'paused', to: 'running', on: 'RESUME' },
        { from: 'paused', to: 'idle', on: 'STOP' },
      ],
    },
  },
};

// Create state machine
const machine = createStateMachine(definition);

// Send events to trigger transitions
await machine.send('START');  // idle -> running
await machine.send('PAUSE');  // running -> paused
await machine.send('RESUME'); // paused -> running
await machine.send('STOP');   // running -> idle

console.log(machine.state);   // 'idle'
```

## Core Concepts

### State Definition

States define the possible states of your machine and the transitions between them:

```typescript
const definition = {
  initial: 'idle',  // Starting state
  states: {
    idle: {
      // Executed when entering the state
      onEntry: (ctx) => console.log('Entering idle'),

      // Executed when exiting the state
      onExit: (ctx) => console.log('Exiting idle'),

      // Transitions from this state
      transitions: [
        {
          from: 'idle',
          to: 'running',
          on: 'START',  // Event that triggers transition
          guard: (ctx) => true,  // Condition that must be true
          action: (ctx) => {},  // Action to execute
        },
      ],
    },
    running: {},
  },
};
```

### Guards

Guards are conditions that must be true for a transition to occur:

```typescript
{
  from: 'pending',
  to: 'approved',
  on: 'APPROVE',
  guard: (ctx) => {
    return ctx.data?.approvals >= 2;  // Require 2 approvals
  },
}
```

### Actions

Actions are functions that execute during transitions:

```typescript
{
  from: 'processing',
  to: 'complete',
  on: 'FINISH',
  action: (ctx) => {
    console.log(`Processing complete for ${ctx.data?.itemId}`);
    ctx.data!.completedAt = Date.now();
  },
}
```

### Context Data

Store data associated with your state machine:

```typescript
const definition = {
  initial: 'idle',
  context: {
    counter: 0,
    items: [],
  },
  states: {
    idle: {
      transitions: [
        {
          from: 'idle',
          to: 'running',
          on: 'START',
          action: (ctx) => {
            ctx.data!.counter++;
          },
        },
      ],
    },
  },
};

const machine = createStateMachine(definition);
console.log(machine.context);  // { counter: 0, items: [] }
```

## Advanced Features

### Hierarchical States

Nested states for complex workflows:

```typescript
{
  active: {
    initial: 'running',
    states: {
      running: {
        transitions: [
          { from: 'running', to: 'paused', on: 'PAUSE' },
        ],
      },
      paused: {
        transitions: [
          { from: 'paused', to: 'running', on: 'RESUME' },
        ],
      },
    },
  },
}
```

### State Persistence

Save and restore state machine snapshots:

```typescript
import { StateManager, InMemoryPersistenceAdapter } from '@claudeflare/state-machine';

const machine = createStateMachine(definition);
const persistence = new InMemoryPersistenceAdapter();
const manager = new StateManager(machine, {
  persistenceAdapter: persistence,
  enableVersioning: true,
});

// Save current state
await manager.save('Checkpoint 1');

// Create version checkpoint
await manager.checkpoint('Before important operation');

// Restore from version
await manager.restoreVersion(1);

// Load saved state
await manager.load();
```

### State Visualization

Generate visual diagrams:

```typescript
import { StateVisualizer } from '@claudeflare/state-machine';

const visualizer = new StateVisualizer(machine);

// Generate Mermaid diagram
const mermaid = visualizer.generateMermaid();
console.log(mermaid);

// Generate DOT format for GraphViz
const dot = visualizer.generateDot();

// Generate SVG
const svg = visualizer.generateSvg();

// Create interactive HTML visualization
const html = visualizer.createInteractiveVisualization();
```

### Testing

Test your state machines:

```typescript
import { StateMachineTester } from '@claudeflare/state-machine';

const tester = new StateMachineTester(definition);

// Run test case
const result = await tester.runTestCase({
  name: 'Happy path',
  steps: [
    { event: 'START', expectedState: 'running' },
    { event: 'STOP', expectedState: 'idle' },
  ],
  expectedFinalState: 'idle',
});

console.log(result.passed);  // true/false

// Explore all possible paths
const exploration = await tester.explorePaths({
  maxPathLength: 10,
});

console.log(`Found ${exploration.paths.length} paths`);
console.log(`Coverage: ${exploration.coverage.percentage}%`);

// Property-based testing
const propertyResult = await tester.runPropertyTests(
  (path) => path.states.length <= 10
);
```

### Distributed Coordination

Run state machines across a cluster:

```typescript
import { DistributedStateCoordinator } from '@claudeflare/state-machine';

const coordinator = new DistributedStateCoordinator(machine, {
  nodeId: 'node-1',
  cluster: ['node-1', 'node-2', 'node-3'],
  replicationFactor: 2,
  enableElection: true,
});

// Sync state with cluster
await coordinator.syncState();

// Achieve consensus on state
const result = await coordinator.achieveConsensus('running');

if (result.reached) {
  console.log('Consensus reached on state:', result.state);
}
```

### Analytics

Monitor state machine behavior:

```typescript
import { StateMachineAnalytics } from '@claudeflare/state-machine';

const analytics = new StateMachineAnalytics(machine);

// Get transition metrics
const metrics = analytics.getTransitionMetrics();
console.log(`Total transitions: ${metrics.total}`);
console.log(`Average duration: ${metrics.avgDuration}ms`);

// Get state statistics
const stateStats = analytics.getStateStatistics();

// Detect anomalies
const anomalies = analytics.detectAnomalies();
for (const anomaly of anomalies) {
  console.log(`Anomaly: ${anomaly.description}`);
}

// Analyze trends
const trends = analytics.analyzeTrends();
for (const trend of trends) {
  console.log(`${trend.metric}: ${trend.trend}`);
}

// Generate report
const report = analytics.generateReport();
```

## Event Handling

Listen to state machine events:

```typescript
// State changes
machine.on('state:change', (event) => {
  console.log(`${event.from} -> ${event.to}`);
});

// Transition lifecycle
machine.on('transition:start', (context) => {
  console.log('Transition starting');
});

machine.on('transition:end', (event) => {
  console.log('Transition complete');
});

machine.on('transition:error', (error, context) => {
  console.error('Transition failed:', error);
});

// State lifecycle
machine.on('state:entry', (state, context) => {
  console.log(`Entered ${state}`);
});

machine.on('state:exit', (state, context) => {
  console.log(`Exited ${state}`);
});
```

## Utilities

Helper functions for working with state machines:

```typescript
import {
  validateDefinition,
  findUnreachableStates,
  findDeadEndStates,
  detectCycles,
  calculateComplexity,
  optimizeDefinition,
  findShortestPath,
} from '@claudeflare/state-machine';

// Validate definition
const validation = validateDefinition(definition);
if (!validation.valid) {
  console.error('Errors:', validation.errors);
}

// Find unreachable states
const unreachable = findUnreachableStates(definition);

// Find dead-end states
const deadEnds = findDeadEndStates(definition);

// Detect cycles
const cycles = detectCycles(definition);

// Calculate complexity
const complexity = calculateComplexity(definition);

// Optimize definition
const optimized = optimizeDefinition(definition);

// Find shortest path between states
const path = findShortestPath(definition, 'A', 'C');
```

## Performance

- **Transition overhead**: < 1ms average
- **Memory efficient**: O(n) where n is number of states
- **Scalable**: Supports 1000+ states
- **Type-safe**: Full TypeScript support

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
