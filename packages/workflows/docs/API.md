# ClaudeFlare Workflow Engine - Complete API Documentation

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
5. [Advanced Features](#advanced-features)
6. [Examples](#examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Installation

```bash
npm install @claudeflare/workflows
```

---

## Quick Start

### Creating a Simple Workflow

```typescript
import { EnhancedWorkflowEngine } from '@claudeflare/workflows/execution';
import type { Workflow, Node } from '@claudeflare/workflows/types';

// Create a workflow
const workflow: Workflow = {
  id: 'my-workflow' as any,
  name: 'My First Workflow',
  description: 'A simple workflow',
  version: 1,
  status: 'active',
  nodes: [
    {
      id: 'node-1' as any,
      type: 'action',
      actionType: 'http_get',
      name: 'Fetch Data',
      config: {
        url: 'https://api.example.com/data'
      },
      position: { x: 100, y: 100 },
      enabled: true
    }
  ],
  connections: [],
  triggers: [],
  variables: [],
  settings: {
    logLevel: 'info',
    enableMetrics: true,
    enableTracing: false
  },
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date()
};

// Execute the workflow
const engine = new EnhancedWorkflowEngine();
const execution = await engine.execute(workflow, { input: 'data' }, {
  type: 'manual',
  source: 'user'
});

console.log('Execution result:', execution.output);
```

---

## Core Concepts

### Workflow

A workflow is a directed acyclic graph (DAG) of nodes that process data.

```typescript
interface Workflow {
  id: WorkflowId;
  name: string;
  description: string;
  version: number;
  status: WorkflowStatus;
  nodes: Node[];
  connections: Connection[];
  triggers: Trigger[];
  variables: Variable[];
  settings: WorkflowSettings;
  metadata: WorkflowMetadata;
  createdAt: Date;
  updatedAt: Date;
}
```

### Node

A node represents a single operation in the workflow.

```typescript
interface Node {
  id: NodeId;
  type: 'trigger' | 'action' | 'condition' | 'loop' | 'parallel' | 'wait';
  actionType?: ActionType;
  name: string;
  description?: string;
  config: NodeConfig;
  position: Position;
  retryConfig?: RetryConfig;
  timeout?: number;
  enabled: boolean;
}
```

### Connection

Connections define the flow of data between nodes.

```typescript
interface Connection {
  id: string;
  sourceNodeId: NodeId;
  targetNodeId: NodeId;
  sourceOutput?: string;
  targetInput?: string;
  condition?: Condition;
}
```

---

## API Reference

### WorkflowDesigner

The visual workflow designer provides a drag-and-drop interface for building workflows.

```typescript
import { WorkflowDesigner } from '@claudeflare/workflows/designer';

const designer = new WorkflowDesigner({
  canvasWidth: 2000,
  canvasHeight: 1500,
  gridSize: 20,
  snapToGrid: true,
  autoSave: true
});

// Add nodes
const node = designer.addNode('http-request', { x: 100, y: 100 });

// Connect nodes
designer.createConnection(node1.id, node2.id);

// Validate workflow
const validation = designer.getValidation();

// Export workflow
const json = designer.exportToJSON();
```

#### Methods

- `addNode(templateId, position, config?)` - Add a node to the workflow
- `removeNode(nodeId)` - Remove a node from the workflow
- `updateNode(nodeId, updates)` - Update a node's configuration
- `moveNodes(nodeIds, delta)` - Move nodes to new positions
- `createConnection(sourceId, targetId, sourceOutput?, targetInput?)` - Create a connection
- `removeConnection(connectionId)` - Remove a connection
- `selectNodes(nodeIds, addToSelection?)` - Select nodes
- `deleteSelection()` - Delete selected items
- `undo()` - Undo last action
- `redo()` - Redo last action
- `autoLayout()` - Auto-layout the workflow
- `exportToJSON()` - Export workflow to JSON
- `importFromJSON(json)` - Import workflow from JSON
- `getValidation()` - Get validation result

### EnhancedWorkflowEngine

The execution engine runs workflows with support for DAG execution, error recovery, and checkpointing.

```typescript
import { EnhancedWorkflowEngine } from '@claudeflare/workflows/execution';

const engine = new EnhancedWorkflowEngine({
  maxConcurrentExecutions: 100,
  defaultTimeout: 300000,
  enableMetrics: true,
  enableTracing: false,
  maxRetries: 3,
  checkpointInterval: 30000
});

const execution = await engine.execute(workflow, input, trigger);
```

#### Methods

- `execute(workflow, input, trigger)` - Execute a workflow
- `cancelExecution(executionId)` - Cancel a running execution
- `getExecution(executionId)` - Get execution by ID
- `getRunningExecutions()` - Get all running executions
- `getStats()` - Get execution statistics

### TaskOrchestrator

The task orchestrator manages task definitions, dependencies, and resource allocation.

```typescript
import { TaskOrchestrator, TaskPriority } from '@claudeflare/workflows/tasks';

const orchestrator = new TaskOrchestrator({
  maxQueueSize: 10000,
  cpuCapacity: 100,
  memoryCapacity: 1024 * 1024 * 1024,
  loadBalancingStrategy: 'round-robin'
});

// Register task definition
orchestrator.registerTaskDefinition({
  id: 'task-1',
  name: 'My Task',
  type: 'action',
  config: {},
  requirements: {
    cpu: 1,
    memory: 100 * 1024 * 1024
  },
  priority: TaskPriority.MEDIUM,
  dependencies: [],
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date()
  }
});

// Schedule and execute task
await orchestrator.scheduleTask('task-1', { input: 'data' });
const execution = await orchestrator.executeTask('task-1', executor);
```

#### Methods

- `registerTaskDefinition(definition)` - Register a task definition
- `getTaskDefinition(taskId)` - Get task definition
- `createTaskFromNode(node, workflow)` - Create task from workflow node
- `scheduleTask(taskId, input, schedule?)` - Schedule a task for execution
- `executeTask(taskId, executor)` - Execute a task
- `cancelTask(taskId)` - Cancel a task
- `getTaskExecution(taskId)` - Get task execution
- `getResourcePools()` - Get all resource pools
- `getResourceUtilization()` - Get resource utilization
- `getExecutionHistory(limit?)` - Get execution history

### EnhancedConditionEvaluator

The condition evaluator evaluates expressions and conditions.

```typescript
import { EnhancedConditionEvaluator } from '@claudeflare/workflows/conditions';

const evaluator = new EnhancedConditionEvaluator();

// Set variables
const context = evaluator.getContext();
context.variables.set('userRole', 'admin');

// Evaluate condition
const condition = {
  id: 'cond-1',
  operator: 'equals' as const,
  leftOperand: { type: 'variable', path: 'userRole' },
  rightOperand: 'admin'
};

const result = await evaluator.evaluate(condition);
```

#### Methods

- `evaluate(condition, context?)` - Evaluate a condition
- `evaluateExpression(expression, context?)` - Evaluate an expression
- `evaluateStringExpression(expression, context?)` - Evaluate a string expression
- `registerRule(rule)` - Register a rule
- `evaluateRules(ruleIds?, context?)` - Evaluate rules
- `registerDecisionTree(tree)` - Register a decision tree
- `evaluateDecisionTree(treeId, context?)` - Evaluate a decision tree
- `clearCache()` - Clear evaluation cache

### ParallelExecutor

The parallel executor manages concurrent task execution.

```typescript
import { ParallelExecutor } from '@claudeflare/workflows/parallel';

const executor = new ParallelExecutor({
  maxConcurrency: 10,
  timeout: 30000,
  enableDeadlockDetection: true,
  errorHandling: 'continue'
});

const tasks = [
  {
    id: 'task-1',
    name: 'Task 1',
    execute: async () => ({ result: 'success' }),
    priority: 1,
    dependencies: []
  }
];

const summary = await executor.execute(tasks);
```

#### Methods

- `execute(tasks)` - Execute tasks in parallel
- `cancelTask(taskId)` - Cancel a running task
- `cancelAll()` - Cancel all running tasks
- `getStatistics()` - Get execution statistics
- `createMutex(name)` - Create a mutex
- `createSemaphore(name, permits)` - Create a semaphore
- `createBarrier(name, parties)` - Create a barrier
- `shutdown()` - Shutdown the executor

### WorkflowVersioningManager

The versioning manager provides version control and rollback support.

```typescript
import { WorkflowVersioningManager } from '@claudeflare/workflows/versioning';

const manager = new WorkflowVersioningManager();

// Create version
const version = await manager.createVersion(workflow, changelog, metadata);

// Activate version
await manager.activateVersion(version.id);

// Compare versions
const diff = manager.diffVersions(versionAId, versionBId);

// Rollback
const rollbackPlan = manager.createRollbackPlan(workflowId, targetVersionId);
await manager.executeRollback(workflowId, rollbackPlan);
```

#### Methods

- `createVersion(workflow, changelog, metadata?, createdBy?)` - Create a new version
- `getVersion(versionId)` - Get version by ID
- `getActiveVersion(workflowId)` - Get active version for a workflow
- `getWorkflowVersions(workflowId)` - Get all versions for a workflow
- `activateVersion(versionId)` - Activate a version
- `deactivateVersion(workflowId)` - Deactivate a version
- `diffVersions(versionAId, versionBId)` - Compare two versions
- `createRollbackPlan(workflowId, targetVersionId, strategy?)` - Create a rollback plan
- `executeRollback(workflowId, plan)` - Execute a rollback
- `createMigration(fromVersionId, toVersionId, steps)` - Create a migration
- `executeMigration(migrationId)` - Execute a migration
- `rollbackMigration(migrationId)` - Rollback a migration

### EnhancedTemplateLibrary

The template library provides pre-built workflows and templates.

```typescript
import { EnhancedTemplateLibrary } from '@claudeflare/workflows/templates';

const library = new EnhancedTemplateLibrary();

// Search templates
const templates = library.search('deployment');

// Get by category
const devTemplates = library.getByCategory('development');

// Instantiate template
const workflow = library.instantiate('ci-cd-pipeline' as any, {
  repository: 'https://github.com/user/repo',
  branch: 'main'
});
```

#### Methods

- `registerTemplate(template)` - Register a template
- `getTemplate(templateId)` - Get template by ID
- `search(query)` - Search templates
- `getByCategory(category)` - Get templates by category
- `validate(template)` - Validate a template
- `instantiate(templateId, parameters)` - Instantiate a template
- `getAllTemplates()` - Get all templates
- `getCategories()` - Get template categories
- `getByTag(tag)` - Get templates by tag
- `getPopularTemplates(limit?)` - Get popular templates
- `rateTemplate(templateId, rating)` - Rate a template

---

## Advanced Features

### DAG Execution

The workflow engine automatically builds a Directed Acyclic Graph (DAG) from your workflow and executes nodes in topological order, enabling parallel execution of independent nodes.

```typescript
const engine = new EnhancedWorkflowEngine();
const execution = await engine.execute(workflow, input, trigger);
// Nodes at the same level in the DAG are executed in parallel
```

### Error Recovery

Configure retry logic for individual nodes:

```typescript
const node: Node = {
  id: 'node-1',
  type: 'action',
  actionType: 'http_get',
  name: 'Fetch Data',
  config: { url: 'https://api.example.com/data' },
  position: { x: 100, y: 100 },
  enabled: true,
  retryConfig: {
    maxAttempts: 3,
    backoffType: 'exponential',
    initialDelay: 1000,
    maxDelay: 60000
  }
};
```

### Checkpointing

Enable checkpointing for long-running workflows:

```typescript
const engine = new EnhancedWorkflowEngine({
  checkpointInterval: 30000,
  statePersistenceEnabled: true,
  durableObjectId: 'workflow-state'
});
```

### Parallel Execution

Execute multiple tasks in parallel with dependency management:

```typescript
const executor = new ParallelExecutor({
  maxConcurrency: 10,
  enableDeadlockDetection: true
});

const tasks = [
  {
    id: 'task-1',
    name: 'Task 1',
    execute: async () => ({ result: 'success' }),
    priority: 1,
    dependencies: []
  },
  {
    id: 'task-2',
    name: 'Task 2',
    execute: async () => ({ result: 'success' }),
    priority: 1,
    dependencies: ['task-1'] // Depends on task-1
  }
];

const summary = await executor.execute(tasks);
```

### Resource Management

Manage CPU, memory, and storage resources:

```typescript
const orchestrator = new TaskOrchestrator({
  cpuCapacity: 100,
  memoryCapacity: 1024 * 1024 * 1024,
  storageCapacity: 10 * 1024 * 1024 * 1024
});

// Create custom resource pool
orchestrator.createResourcePool({
  id: 'custom-pool',
  name: 'Custom Pool',
  type: 'cpu',
  capacity: 50
});

// Check utilization
const utilization = orchestrator.getResourceUtilization();
console.log('CPU utilization:', utilization['cpu-pool']);
```

### Workflow Versioning

Version and rollback workflows:

```typescript
const manager = new WorkflowVersioningManager();

// Create version
const version = await manager.createVersion(workflow, {
  type: 'major',
  description: 'Initial release',
  changes: [],
  breakingChanges: false
});

// Activate version
await manager.activateVersion(version.id);

// Compare versions
const diff = manager.diffVersions(v1.id, v2.id);
console.log('Breaking changes:', diff.summary.breakingChanges);

// Rollback if needed
const rollbackPlan = manager.createRollbackPlan(workflowId, v1.id);
await manager.executeRollback(workflowId, rollbackPlan);
```

---

## Examples

### CI/CD Pipeline

```typescript
import { EnhancedTemplateLibrary } from '@claudeflare/workflows/templates';

const library = new EnhancedTemplateLibrary();
const workflow = library.instantiate('ci-cd-pipeline' as any, {
  repository: 'https://github.com/user/repo',
  branch: 'main',
  buildCommand: 'npm run build',
  testCommand: 'npm test',
  deployEnvironment: 'production'
});
```

### Data Processing Pipeline

```typescript
const workflow: Workflow = {
  id: 'etl-pipeline',
  name: 'ETL Pipeline',
  version: 1,
  status: 'active',
  nodes: [
    {
      id: 'extract',
      type: 'action',
      actionType: 'http_get',
      name: 'Extract Data',
      config: { url: 'https://api.example.com/data' },
      position: { x: 100, y: 100 },
      enabled: true
    },
    {
      id: 'transform',
      type: 'action',
      actionType: 'transform_data',
      name: 'Transform Data',
      config: {
        transformations: [
          { field: 'date', operation: 'format', value: 'YYYY-MM-DD' }
        ]
      },
      position: { x: 100, y: 250 },
      enabled: true
    },
    {
      id: 'load',
      type: 'action',
      actionType: 'd1_query',
      name: 'Load Data',
      config: {
        query: 'INSERT INTO processed_data VALUES (?)'
      },
      position: { x: 100, y: 400 },
      enabled: true
    }
  ],
  connections: [
    { id: 'c1', sourceNodeId: 'extract', targetNodeId: 'transform' },
    { id: 'c2', sourceNodeId: 'transform', targetNodeId: 'load' }
  ],
  triggers: [],
  variables: [],
  settings: {
    logLevel: 'info',
    enableMetrics: true,
    enableTracing: false
  },
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date()
};
```

---

## Best Practices

### 1. Workflow Design

- Keep workflows simple and focused
- Use descriptive names for nodes and connections
- Add appropriate timeouts and retry logic
- Validate inputs and outputs
- Handle errors gracefully

### 2. Performance

- Use parallel execution for independent tasks
- Set appropriate timeouts
- Optimize node execution order
- Use checkpoints for long-running workflows
- Monitor resource utilization

### 3. Error Handling

- Implement retry logic for transient failures
- Use circuit breakers for external services
- Log errors for debugging
- Set up alerts for critical failures
- Test error scenarios

### 4. Versioning

- Create versions for all workflow changes
- Use semantic versioning
- Document breaking changes
- Test rollbacks before deployment
- Keep a stable baseline version

### 5. Security

- Validate all inputs
- Use secrets for sensitive data
- Implement proper authentication
- Follow principle of least privilege
- Audit workflow executions

---

## Troubleshooting

### Common Issues

#### Workflow Execution Fails

1. Check workflow validation: `designer.getValidation()`
2. Verify all nodes are properly connected
3. Check for circular dependencies
4. Review node configurations
5. Check timeout settings

#### Task Not Executing

1. Verify task is scheduled
2. Check resource availability
3. Review task dependencies
4. Check task priority
5. Monitor queue status

#### Performance Issues

1. Check resource utilization
2. Review parallel execution settings
3. Optimize node order
4. Increase concurrency if needed
5. Profile node execution times

### Debug Mode

Enable debug logging:

```typescript
const engine = new EnhancedWorkflowEngine({
  enableTracing: true
});

workflow.settings.logLevel = 'debug';
```

### Monitoring

Monitor execution statistics:

```typescript
const stats = engine.getStats();
console.log('Running executions:', stats.running);
console.log('Utilization:', stats.utilization);
```

---

## TypeScript Support

The workflow engine is written in TypeScript and provides full type definitions:

```typescript
import type {
  Workflow,
  Node,
  Connection,
  Trigger,
  Execution,
  TaskDefinition,
  ParallelTask
} from '@claudeflare/workflows/types';
```

---

## License

MIT

---

## Support

For issues and questions, please visit the [ClaudeFlare GitHub repository](https://github.com/claudeflare/workflows).
