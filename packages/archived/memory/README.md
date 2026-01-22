# @claudeflare/memory

A comprehensive AI memory and learning system for ClaudeFlare, built on Cloudflare Workers and D1 database.

## Features

### Memory Types

- **Episodic Memory**: Stores specific events, conversations, and experiences with temporal context
- **Semantic Memory**: Manages knowledge using vector embeddings for similarity-based retrieval
- **Procedural Memory**: Tracks execution strategies and problem-solving methods with success rate tracking
- **Working Memory**: Short-term memory with limited capacity and decay

### Knowledge Graph

- Graph-based knowledge representation with nodes and edges
- Path finding and traversal algorithms
- Centrality measures and community detection
- Inference and knowledge consolidation

### Learning Systems

- **Experience Replay**: Reinforcement learning with Q-learning, policy gradients, and actor-critic methods
- **Meta-Learning**: Learn to learn across tasks
- **Pattern Detection**: Automatically identify and learn from patterns
- **Performance Tracking**: Monitor and optimize learning strategies

### Memory Management

- **Consolidation**: Strengthen memories through spacing effect, interleaving, and retrieval practice
- **Pruning**: Remove less important memories using LRU, LFU, importance-based, and temporal strategies
- **Retrieval Optimization**: Multi-tier caching, query optimization, and result ranking

## Installation

```bash
npm install @claudeflare/memory
```

## Quick Start

```typescript
import { createMemoryManager } from '@claudeflare/memory';

// Initialize with D1 database
const manager = await createMemoryManager(db);

// Store episodic memory
const episodicMemory = await manager.storeMemory('episodic', {
  context: 'User asked for help with TypeScript',
  outcome: 'Provided solution with code examples',
  actions: [
    {
      timestamp: new Date(),
      agent: 'assistant',
      action: 'provide_code',
      parameters: { language: 'typescript' },
      result: 'success',
      duration: 5000,
    },
  ],
  importance: 4,
  tags: ['typescript', 'coding', 'help'],
});

// Store semantic memory
const semanticMemory = await manager.storeMemory('semantic', {
  content: 'TypeScript is a typed superset of JavaScript',
  category: 'programming',
  confidence: 0.95,
  source: 'documentation',
  examples: [
    'const x: number = 42;',
    'interface User { name: string; }',
  ],
});

// Retrieve memories
const results = await manager.retrieveMemories({
  query: 'typescript examples',
  type: 'semantic',
  limit: 10,
});

// Learn from experience
await manager.learn(
  'code_review',
  'suggested_refactoring',
  'code_improved',
  0.8,
  { language: 'typescript' },
  { language: 'typescript', refactored: true }
);
```

## Architecture

```
@claudeflare/memory
├── src/
│   ├── memory/           # Memory type implementations
│   │   ├── episodic.ts   # Event and experience storage
│   │   ├── semantic.ts   # Vector-based knowledge storage
│   │   └── procedural.ts # Skill and procedure storage
│   ├── knowledge/        # Knowledge graph system
│   │   └── graph.ts      # Graph operations and inference
│   ├── learning/         # Learning algorithms
│   │   ├── consolidation.ts  # Memory consolidation
│   │   ├── pruning.ts        # Memory pruning
│   │   └── experience.ts     # Experience replay
│   ├── utils/            # Utilities
│   │   └── retrieval.ts  # Retrieval optimization
│   ├── types.ts          # Type definitions
│   ├── config.ts         # Configuration
│   ├── manager.ts        # Unified memory manager
│   └── index.ts          # Main export
```

## Memory Systems

### Episodic Memory

Stores specific events with temporal context:

```typescript
import { EpisodicMemorySystem, D1EpisodicStorage } from '@claudeflare/memory';

const episodic = new EpisodicMemorySystem(
  {
    maxMemories: 10000,
    consolidationInterval: 3600000,
    retentionDays: 365,
    minImportance: 2,
    autoConsolidate: true,
  },
  new D1EpisodicStorage(db)
);

// Create memory
const memory = await episodic.createMemory(
  'Context of the event',
  'Outcome of the event',
  [
    {
      timestamp: new Date(),
      agent: 'system',
      action: 'process',
      parameters: {},
      result: 'success',
      duration: 1000,
    },
  ],
  {
    participants: ['user', 'assistant'],
    emotionalWeight: 0.7,
    importance: 4,
  }
);

// Search memories
const results = await episodic.searchMemories({
  query: 'specific event',
  limit: 10,
});
```

### Semantic Memory

Vector-based knowledge storage with similarity search:

```typescript
import { SemanticMemorySystem, InMemoryVectorDB, D1SemanticStorage } from '@claudeflare/memory';

const semantic = new SemanticMemorySystem(
  {
    maxMemories: 10000,
    vectorStore: {
      dimension: 128,
      metric: 'cosine',
      indexType: 'hnsw',
      maxVectors: 10000,
    },
  },
  new D1SemanticStorage(db),
  new InMemoryVectorDB()
);

// Create semantic memory
const memory = await semantic.createMemory(
  'Content to remember',
  'category',
  {
    confidence: 0.9,
    source: 'documentation',
    examples: ['example1', 'example2'],
  }
);

// Semantic search
const results = await semantic.semanticSearch('search query', {
  topK: 10,
  minScore: 0.7,
  category: 'specific-category',
});
```

### Procedural Memory

Tracks execution strategies and skills:

```typescript
import { ProceduralMemorySystem, D1ProceduralStorage } from '@claudeflare/memory';

const procedural = new ProceduralMemorySystem(
  {
    maxProcedures: 1000,
    minSuccessRate: 0.5,
    practiceInterval: 7,
  },
  new D1ProceduralStorage(db)
);

// Create procedure
const procedure = await procedural.createMemory(
  'procedure-name',
  'Description of procedure',
  [
    {
      order: 1,
      description: 'First step',
      action: 'initialize',
      parameters: {},
      expectedOutcome: 'initialized',
      timeout: 5000,
    },
    {
      order: 2,
      description: 'Second step',
      action: 'process',
      parameters: {},
      expectedOutcome: 'processed',
      timeout: 10000,
    },
  ]
);

// Execute procedure
const result = await procedural.executeProcedure(
  procedure.id,
  { context: 'data' },
  { timeout: 30000 }
);
```

## Knowledge Graph

Graph-based knowledge representation:

```typescript
import { KnowledgeGraphSystem, D1GraphStorage } from '@claudeflare/memory';

const graph = new KnowledgeGraphSystem(
  {
    maxNodes: 5000,
    maxEdges: 20000,
    updateThreshold: 0.8,
    autoIndex: true,
    enableInference: true,
  },
  new D1GraphStorage(db)
);

// Add nodes
const node1 = await graph.addNode('concept', 'TypeScript', {
  type: 'programming-language',
});

const node2 = await graph.addNode('concept', 'JavaScript', {
  type: 'programming-language',
});

// Add edge
const edge = await graph.addEdge(
  node1.id,
  node2.id,
  'superset-of',
  { strength: 1.0 }
);

// Find paths
const path = await graph.findShortestPath(node1.id, node2.id);

// Find neighbors
const neighbors = await graph.findNeighbors(node1.id, 2);
```

## Learning

### Experience Replay

Reinforcement learning with experience replay:

```typescript
import { ExperienceReplaySystem, D1ExperienceStorage, D1PatternStorage } from '@claudeflare/memory';

const learning = new ExperienceReplaySystem(
  {
    algorithm: 'q-learning',
    learningRate: 0.1,
    explorationRate: 0.3,
    discountFactor: 0.95,
    replayBufferSize: 10000,
    batchSize: 32,
  },
  new D1ExperienceStorage(db),
  new D1PatternStorage(db)
);

// Record experience
const expId = await learning.recordExperience(
  'task-context',
  'action-taken',
  'outcome',
  0.8, // reward
  { state: 'value' },
  { nextState: 'value' }
);

// Train
const result = await learning.train(100);

// Select action
const { action, exploration } = await learning.selectAction(
  { state: 'value' },
  ['action1', 'action2', 'action3']
);
```

## Consolidation

Memory consolidation algorithms:

```typescript
import { MemoryConsolidationSystem, D1ConsolidationStorage } from '@claudeflare/memory';

const consolidation = new MemoryConsolidationSystem(
  {
    enabled: true,
    interval: 3600000,
    batchSize: 100,
    algorithms: ['spacing_effect', 'interleaving', 'retrieval_practice'],
  },
  new D1ConsolidationStorage(db),
  memoryAccessor
);

// Schedule consolidation
const task = await consolidation.scheduleConsolidation(
  ['memory-id-1', 'memory-id-2'],
  'spacing_effect'
);

// Execute consolidation
const result = await consolidation.executeConsolidation(task.id);
```

## Pruning

Memory management and pruning:

```typescript
import { MemoryPruningSystem, D1PruningStorage } from '@claudeflare/memory';

const pruning = new MemoryPruningSystem(
  {
    enabled: true,
    maxMemorySize: 100000000,
    minImportance: 2,
    maxAge: 365,
    minAccessFrequency: 5,
    pruningThreshold: 0.7,
  },
  new D1PruningStorage(db)
);

// Execute pruning
const result = await pruning.prune('composite');

// Analyze before pruning
const analysis = await pruning.analyzePruning();
```

## Configuration

Configure the memory system:

```typescript
import { MemorySystemConfig } from '@claudeflare/memory';

const config: MemorySystemConfig = {
  episodic: {
    enabled: true,
    maxMemories: 10000,
    consolidationInterval: 3600000,
    retentionDays: 365,
  },
  semantic: {
    enabled: true,
    vectorStore: {
      dimension: 128,
      metric: 'cosine',
      indexType: 'hnsw',
    },
  },
  procedural: {
    enabled: true,
    maxProcedures: 1000,
    minSuccessRate: 0.5,
  },
  learning: {
    enabled: true,
    algorithm: 'q-learning',
    learningRate: 0.1,
    explorationRate: 0.3,
  },
  pruning: {
    enabled: true,
    maxMemorySize: 100000000,
    minImportance: 2,
  },
};
```

## API Reference

See [TypeDoc documentation](./docs/) for complete API reference.

## License

MIT
