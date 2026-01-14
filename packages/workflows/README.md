# @claudeflare/workflows

Comprehensive workflow automation engine for ClaudeFlare platform on Cloudflare Workers.

## Features

- **Visual Workflow Builder**: Drag-and-drop interface for creating workflows
- **DAG-Based Execution**: Efficient parallel execution with dependency management
- **Event-Driven Triggers**: Webhooks, schedules, and custom events
- **100+ Built-in Actions**: Code, communication, GitHub, AI, data, storage, HTTP, and more
- **Condition Logic**: Advanced branching with if/else, loops, and parallel execution
- **Workflow Templates**: Pre-built templates for common workflows
- **Retry & Error Handling**: Configurable retry policies and error recovery
- **Workflow Versioning**: Track and manage workflow versions

## Installation

```bash
npm install @claudeflare/workflows
```

## Quick Start

```typescript
import {
  WorkflowExecutionEngine,
  TriggerManager,
  ActionRegistry,
  WorkflowBuilder
} from '@claudeflare/workflows';

// Create a workflow
const builder = new WorkflowBuilder();
builder.addNode('action', 'send_slack', { x: 100, y: 100 });
builder.addNode('action', 'send_email', { x: 300, y: 100 });
builder.connectNodes(node1.id, node2.id);

const workflow = builder.getWorkflow();

// Execute workflow
const engine = new WorkflowExecutionEngine();
const execution = await engine.execute(workflow, {
  channel: '#alerts',
  message: 'Hello from workflow!'
}, {
  type: 'manual',
  data: {}
});
```

## Architecture

### Core Components

#### 1. Workflow Execution Engine (`/src/engine`)

- **DAGManager**: Manages workflow graphs, detects cycles, and creates execution plans
- **WorkflowExecutionEngine**: Main orchestrator for workflow execution
- **ActionExecutor**: Executes individual workflow actions
- **ExecutionLogger**: Comprehensive logging during execution

#### 2. Trigger System (`/src/triggers`)

- **TriggerManager**: Central trigger management
- **WebhookHandler**: HTTP webhook triggers with signature validation
- **ScheduleHandler**: Cron and interval-based triggers
- **EventHandler**: Event-driven triggers

#### 3. Action Library (`/src/actions`)

- **ActionRegistry**: Centralized action registry with 100+ actions
- Code Actions: Generate, review, refactor code, run tests, deploy
- Communication Actions: Slack, email, Discord, Teams, Telegram
- GitHub Actions: Issues, PRs, comments, merges
- AI Actions: Chat completion, code generation, summarization
- Data Actions: Fetch, transform, filter, aggregate data
- Storage Actions: KV, R2, D1 operations
- HTTP Actions: GET, POST, PUT, DELETE, PATCH
- Utility Actions: Log, notify, metrics, validation

#### 4. Condition Logic (`/src/conditions`)

- **ConditionEvaluator**: Evaluate complex conditions
- **ConditionBuilder**: Fluent API for building conditions
- Support for: equals, contains, regex, comparisons, logical operators

#### 5. Visual Builder (`/src/builder`)

- **WorkflowBuilder**: Create and manage workflows
- **NodeTemplateRegistry**: Pre-built node templates
- Undo/redo, copy/paste, validation

#### 6. Templates (`/src/templates`)

- **TemplateRegistry**: Workflow template management
- Pre-built templates for:
  - Development: PR workflows, deployment pipelines
  - Monitoring: Error monitoring, alerts
  - Communication: Announcements, notifications
  - Data: ETL pipelines, data processing
  - Integration: GitHub sync, webhooks
  - Automation: Daily reports, scheduled tasks

## Action Categories

### Code Actions
- `generate_code`: Generate code using AI
- `review_code`: Review code for issues
- `refactor_code`: Refactor code
- `run_tests`: Run tests
- `deploy_code`: Deploy code

### Communication Actions
- `send_slack`: Send Slack message
- `send_email`: Send email
- `send_discord`: Send Discord message
- `send_teams`: Send Teams message
- `send_telegram`: Send Telegram message

### GitHub Actions
- `create_issue`: Create GitHub issue
- `create_pr`: Create pull request
- `comment_pr`: Comment on PR
- `merge_pr`: Merge PR
- `update_status`: Update commit status
- `close_issue`: Close issue
- `fork_repo`: Fork repository

### AI Actions
- `chat_completion`: AI chat completion
- `code_generation`: Generate code with AI
- `summarization`: Summarize text
- `translation`: Translate text
- `sentiment_analysis`: Analyze sentiment

### Data Actions
- `fetch_data`: Fetch data from URL
- `transform_data`: Transform data
- `filter_data`: Filter data
- `aggregate_data`: Aggregate data
- `store_data`: Store data

### Storage Actions
- `kv_get`: Get value from KV
- `kv_set`: Set value in KV
- `kv_delete`: Delete from KV
- `r2_upload`: Upload to R2
- `r2_download`: Download from R2
- `d1_query`: Query D1 database

### HTTP Actions
- `http_get`: HTTP GET request
- `http_post`: HTTP POST request
- `http_put`: HTTP PUT request
- `http_delete`: HTTP DELETE request
- `http_patch`: HTTP PATCH request

## Trigger Types

### Webhook Triggers
```typescript
{
  type: 'webhook',
  endpoint: '/webhook/my-workflow',
  method: 'POST',
  source: 'github',
  validation: {
    validateSignature: true,
    secret: 'webhook-secret'
  }
}
```

### Schedule Triggers
```typescript
{
  type: 'schedule',
  scheduleType: 'cron',
  cron: '0 * * * *',
  timezone: 'UTC'
}
```

### Event Triggers
```typescript
{
  type: 'event',
  eventType: 'deployment.completed',
  filters: {
    environment: 'production'
  }
}
```

## Condition Logic

```typescript
import { Conditions } from '@claudeflare/workflows';

// Simple condition
const condition = Conditions.equals('status', 'success');

// Complex condition
const complexCondition = Conditions.and(
  Conditions.greaterThan('score', 80),
  Conditions.contains('tags', 'important')
);

// With OR logic
const orCondition = Conditions.or(
  Conditions.equals('type', 'urgent'),
  Conditions.greaterThan('priority', 5)
);
```

## Workflow Templates

```typescript
import { TemplateRegistry } from '@claudeflare/workflows';

const templates = new TemplateRegistry();

// List all templates
const all = templates.getAll();

// Get by category
const devTemplates = templates.getByCategory('development');

// Create workflow from template
const workflow = templates.createFromWorkflow('template-pr-workflow', {
  repoOwner: 'my-org',
  repoName: 'my-repo',
  testFramework: 'jest'
});
```

## Execution

```typescript
const engine = new WorkflowExecutionEngine({
  maxConcurrentExecutions: 100,
  defaultTimeout: 300000,
  enableMetrics: true
});

// Execute workflow
const execution = await engine.execute(workflow, inputData, triggerInfo);

// Monitor execution
console.log('Status:', execution.status);
console.log('Duration:', execution.duration);
console.log('Output:', execution.output);

// Cancel execution
await engine.cancelExecution(execution.id);
```

## Validation

```typescript
import { WorkflowValidator } from '@claudeflare/workflows';

const validator = new WorkflowValidator();
const result = validator.validate(workflow);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

## Serialization

```typescript
import { WorkflowSerializer } from '@claudeflare/workflows';

const serializer = new WorkflowSerializer();

// Serialize
const json = serializer.serialize(workflow);

// Deserialize
const workflow = serializer.deserialize(json);

// Export for sharing
const shared = serializer.exportForSharing(workflow);
```

## API Reference

### WorkflowExecutionEngine

- `execute(workflow, input, trigger)`: Execute a workflow
- `getExecution(executionId)`: Get execution by ID
- `cancelExecution(executionId)`: Cancel running execution
- `getRunningExecutions()`: Get all running executions
- `getStats()`: Get execution statistics

### TriggerManager

- `registerTrigger(trigger, callback)`: Register a trigger
- `unregisterTrigger(triggerId)`: Unregister a trigger
- `enableTrigger(triggerId)`: Enable a trigger
- `disableTrigger(triggerId)`: Disable a trigger
- `triggerManual(triggerId, data, user)`: Trigger manual workflow
- `handleWebhook(endpoint, request)`: Handle incoming webhook
- `emitEvent(eventType, data)`: Emit an event

### ActionRegistry

- `register(action)`: Register a custom action
- `get(type)`: Get action by type
- `getAll()`: Get all actions
- `getByCategory(category)`: Get actions by category
- `search(query)`: Search actions

### WorkflowBuilder

- `addNode(type, actionType, position)`: Add a node
- `updateNode(nodeId, updates)`: Update a node
- `deleteNode(nodeId)`: Delete a node
- `connectNodes(sourceId, targetId)`: Connect nodes
- `deleteConnection(connectionId)`: Delete connection
- `validate()`: Validate workflow
- `exportJSON()`: Export as JSON
- `importJSON(json)`: Import from JSON

### TemplateRegistry

- `register(template)`: Register a template
- `get(id)`: Get template by ID
- `getAll()`: Get all templates
- `getByCategory(category)`: Get by category
- `createFromTemplate(id, parameters)`: Create workflow from template
- `search(query)`: Search templates

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please use the GitHub issue tracker.
