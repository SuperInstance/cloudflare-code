# @claudeflare/reasoning

Advanced reasoning and planning system for ClaudeFlare AI platform.

## Features

### Reasoning Methods

- **Chain-of-Thought (CoT)**: Multi-step reasoning with intermediate step tracking
- **Tree-of-Thoughts (ToT)**: Tree-based exploration with evaluation and pruning
- **ReAct (Reasoning + Acting)**: Dynamic tool selection and execution
- **Self-Consistency**: Multiple sampling with answer aggregation
- **Multi-Agent Debate**: Collaborative reasoning with multiple perspectives
- **Analogical Reasoning**: Solution transfer from similar problems

### Planning Algorithms

- **Task Decomposition**: Break down complex tasks into manageable subtasks
- **Dependency Resolution**: Analyze and resolve task dependencies
- **Critical Path Analysis**: Identify the critical execution path
- **Resource Allocation**: Optimize resource usage across tasks
- **Timeline Estimation**: Estimate task completion times
- **Risk Assessment**: Identify and mitigate potential risks

### Adaptive Replanning

- **Failure Detection**: Detect and recover from execution failures
- **Strategy Adjustment**: Adapt planning strategies based on context
- **Alternative Path Generation**: Generate alternative execution paths
- **Progress Estimation**: Track and estimate progress metrics
- **Timeout Handling**: Handle and recover from timeouts
- **Resource Optimization**: Dynamically optimize resource allocation

### Visualization

- **Reasoning Graphs**: Visualize reasoning chains and thought trees
- **Execution Trees**: Display task execution hierarchies
- **Dependency Diagrams**: Show task dependency relationships
- **Progress Timelines**: Track progress over time
- **Decision Traces**: Visualize decision-making processes

## Installation

```bash
npm install @claudeflare/reasoning
```

## Usage

### Chain-of-Thought Reasoning

```typescript
import { ChainOfThoughtEngine } from '@claudeflare/reasoning';

const cot = new ChainOfThoughtEngine({
  maxSteps: 10,
  temperature: 0.7,
  includeIntermediateSteps: true,
});

const result = await cot.reason(
  'What is the capital of France?',
  'It is known for the Eiffel Tower.'
);

console.log(result.finalAnswer);
console.log(result.reasoningChain);
```

### Tree-of-Thoughts Planning

```typescript
import { TreeOfThoughtsEngine } from '@claudeflare/reasoning';

const tot = new TreeOfThoughtsEngine({
  maxDepth: 5,
  branchingFactor: 3,
  evaluationMethod: 'value',
  explorationStrategy: 'best-first',
});

const result = await tot.solve('How can I optimize this algorithm?');

console.log(result.finalAnswer);
console.log(result.thoughtTree);
console.log(result.bestPath);
```

### ReAct Agent

```typescript
import { ReActEngine, calculatorTool, searchTool } from '@claudeflare/reasoning';

const react = new ReActEngine(
  {
    maxIterations: 10,
    toolTimeout: 30000,
  },
  [calculatorTool, searchTool]
);

const result = await react.execute('Calculate 15 * 23 + 7');

console.log(result.finalAnswer);
console.log(result.steps);
console.log(result.toolCalls);
```

### Task Decomposition

```typescript
import { TaskDecomposer } from '@claudeflare/reasoning';

const decomposer = new TaskDecomposer({
  maxDepth: 5,
  granularity: 'medium',
  includeTimeEstimates: true,
  includeResourceAnalysis: true,
});

const result = await decomposer.decompose(
  'Build a web application with user authentication'
);

console.log(result.rootTask);
console.log(result.taskGraph);
console.log(result.criticalPath);
console.log(result.timeline);
```

### Adaptive Replanning

```typescript
import { AdaptiveReplanner } from '@claudeflare/reasoning';

const replanner = new AdaptiveReplanner({
  failureThreshold: 0.3,
  timeoutThreshold: 2.0,
  replanningStrategy: 'moderate',
});

replanner.initializePlan(plan);

// During execution
const trigger = await replanner.shouldReplan(currentTaskId);
if (trigger) {
  const result = await replanner.replan(trigger);
  console.log(result.newPlan);
  console.log(result.changes);
}
```

### Visualization

```typescript
import { GraphVisualizer, TimelineVisualizer } from '@claudeflare/reasoning';

const graphViz = new GraphVisualizer({
  format: 'graph',
  includeMetadata: true,
  highlightPath: ['node1', 'node2', 'node3'],
});

const graph = graphViz.visualizeReasoningChain(reasoningSteps);
const mermaid = graphViz.exportAsMermaid(graph);
console.log(mermaid);

const timelineViz = new TimelineVisualizer();
const timeline = timelineViz.visualizeTaskTimeline(tasks, events);
const gantt = timelineViz.exportAsGantt(timeline);
console.log(gantt);
```

## API Reference

### Chain-of-Thought

- `ChainOfThoughtEngine`: Main CoT reasoning engine
- `SelfConsistencyEngine`: Self-consistency sampling
- `StepTracker`: Track intermediate steps

### Tree-of-Thoughts

- `TreeOfThoughtsEngine`: Main ToT reasoning engine
- `TreeSearchAlgorithms`: A*, Minimax, MCTS algorithms
- `TreeVisualizationHelpers`: Tree visualization utilities

### ReAct

- `ReActEngine`: Main ReAct agent
- `ToolRegistry`: Tool registration and management
- `ReActTracer`: Trace execution history

### Planning

- `TaskDecomposer`: Task decomposition engine
- `TaskGraphAnalyzer`: Graph analysis utilities
- `AdaptiveReplanner`: Adaptive replanning engine

### Visualization

- `GraphVisualizer`: Graph visualization
- `TimelineVisualizer`: Timeline visualization
- `ProgressVisualizer`: Progress visualization

## Configuration

All reasoning and planning components accept configuration objects:

```typescript
// Chain-of-Thought configuration
interface ChainOfThoughtConfig {
  maxSteps?: number;
  temperature?: number;
  verbose?: boolean;
  includeIntermediateSteps?: boolean;
  selfConsistencySamples?: number;
  confidenceThreshold?: number;
}

// Tree-of-Thoughts configuration
interface TreeOfThoughtsConfig {
  maxDepth?: number;
  branchingFactor?: number;
  evaluationMethod?: 'value' | 'vote' | 'comparison';
  pruningThreshold?: number;
  maxNodes?: number;
  explorationStrategy?: 'breadth' | 'depth' | 'best-first';
  beamWidth?: number;
}

// ReAct configuration
interface ReActConfig {
  maxIterations?: number;
  toolTimeout?: number;
  verbose?: boolean;
  allowRepeatedActions?: boolean;
  maxToolErrors?: number;
}
```

## License

MIT
