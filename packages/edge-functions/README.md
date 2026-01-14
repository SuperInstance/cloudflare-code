# @claudeflare/edge-functions

Advanced edge functions framework for the ClaudeFlare distributed AI coding platform.

## Features

- **Sub-10ms Cold Start**: Optimized for instant function execution
- **Global Edge Deployment**: Deploy to 300+ edge locations worldwide
- **Function Orchestration**: Chain and compose functions into complex workflows
- **Advanced Caching**: Built-in edge caching with stale-while-revalidate
- **Hot Reload**: Deploy updates without downtime
- **Version Management**: Built-in versioning and rollback capabilities
- **Type-Safe**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @claudeflare/edge-functions
```

## Quick Start

```typescript
import { FunctionRuntime, createEdgeFunction, createEdgeRequest } from '@claudeflare/edge-functions';

// Create runtime
const runtime = new FunctionRuntime();

// Define function
const greetFunction = createEdgeFunction(
  'greet',
  'Greeting Function',
  async (input: { name: string }) => {
    return `Hello, ${input.name}!`;
  },
  {
    timeout: 5000,
    cache: {
      enabled: true,
      ttl: 300,
    },
  }
);

// Register function
runtime.registerFunction(greetFunction);

// Execute function
const request = createEdgeRequest('greet', { name: 'World' });
const response = await runtime.execute(request, context);

console.log(response.data); // "Hello, World!"
```

## Core Concepts

### Function Runtime

The `FunctionRuntime` handles execution of edge functions with timeout management, memory limits, and performance tracking.

```typescript
import { FunctionRuntime } from '@claudeflare/edge-functions';

const runtime = new FunctionRuntime({
  defaultTimeout: 30000,
  defaultMemoryLimit: 128,
  enableMetrics: true,
  maxConcurrentExecutions: 100,
});

// Register function
runtime.registerFunction({
  id: 'my-function',
  name: 'My Function',
  handler: async (input) => {
    return { result: 'success' };
  },
  config: {
    timeout: 5000,
    memoryLimit: 64,
  },
  version: '1.0.0',
});

// Execute function
const response = await runtime.execute(request, context);
```

### Cache Layer

Advanced caching with multiple strategies, automatic expiration, and stale-while-revalidate.

```typescript
import { CacheLayer, createCacheLayer } from '@claudeflare/edge-functions';

const cache = createCacheLayer({
  defaultTTL: 60,
  maxSize: 1000,
  enableStaleWhileRevalidate: true,
  staleWhileRevalidate: 60,
});

// Set value
await cache.set('function-id', input, result, {
  ttl: 300,
});

// Get value
const result = await cache.get('function-id', input);

// Clear cache
await cache.clearFunctionCache('function-id');
```

### Orchestration Engine

Compose functions into complex workflows with chaining, parallel execution, and conditional routing.

```typescript
import {
  OrchestrationEngine,
  createWorkflow,
  sequentialStep,
  parallelStep,
} from '@claudeflare/edge-functions';

const engine = new OrchestrationEngine(functions);

// Create workflow
const workflow = createWorkflow('my-workflow', 'My Workflow', [
  sequentialStep('step1', 'fetch-data', {
    input: { id: 1 },
    output: '$.data.userData',
  }),
  parallelStep('step2', 'process-data', {
    input: '$.data.userData',
  }),
  parallelStep('step3', 'enrich-data', {
    input: '$.data.userData',
  }),
]);

// Execute workflow
const result = await engine.execute('my-workflow', input, context);
```

### Deployment Manager

Deploy functions to global edge locations with versioning and rollback.

```typescript
import { DeploymentManager } from '@claudeflare/edge-functions';

const manager = new DeploymentManager({
  autoRollback: true,
  enableHealthChecks: true,
  retainedVersions: 10,
});

// Deploy function
const deployment = await manager.deploy({
  functions: myFunction,
  environment: 'production',
  strategy: 'canary',
  envVars: {
    API_KEY: 'secret',
  },
});

// Rollback if needed
await manager.rollback('function-id', 'previous-version');
```

### Middleware

Add cross-cutting concerns like logging, authentication, and rate limiting.

```typescript
import {
  MiddlewareChain,
  loggingMiddleware,
  timingMiddleware,
  corsMiddleware,
} from '@claudeflare/edge-functions';

const chain = new MiddlewareChain();
chain.use(loggingMiddleware());
chain.use(timingMiddleware());
chain.use(corsMiddleware({
  origin: 'https://example.com',
  credentials: true,
}));

// Apply middleware to requests
const response = await chain.execute(request, context, handler);
```

## API Reference

### FunctionRuntime

| Method | Description |
|--------|-------------|
| `registerFunction(func)` | Register a single function |
| `registerFunctions(funcs)` | Register multiple functions |
| `execute(request, context)` | Execute a function |
| `getFunction(id)` | Get registered function |
| `getMetrics(id)` | Get function metrics |
| `getStatus()` | Get runtime status |

### CacheLayer

| Method | Description |
|--------|-------------|
| `get(functionId, input)` | Get cached value |
| `set(functionId, input, value, config)` | Cache a value |
| `delete(functionId, input)` | Delete cached value |
| `clear()` | Clear all cache |
| `clearFunctionCache(functionId)` | Clear function cache |
| `warmCache(func, inputs, env)` | Warm cache for function |
| `getStats(functionId)` | Get cache statistics |

### OrchestrationEngine

| Method | Description |
|--------|-------------|
| `registerWorkflow(workflow)` | Register a workflow |
| `execute(workflowId, input, context)` | Execute workflow |
| `getWorkflow(workflowId)` | Get workflow |
| `getExecutionState(executionId)` | Get execution state |

### DeploymentManager

| Method | Description |
|--------|-------------|
| `deploy(config)` | Deploy functions |
| `rollback(functionId, version)` | Rollback to version |
| `getVersions(functionId)` | Get function versions |
| `cleanupOldVersions(functionId, retain)` | Cleanup old versions |
| `getDeploymentStatus(deploymentId)` | Get deployment status |

## Configuration

### Runtime Configuration

```typescript
interface RuntimeConfig {
  defaultTimeout?: number;        // Default: 30000 (30s)
  defaultMemoryLimit?: number;    // Default: 128 MB
  enableMetrics?: boolean;        // Default: true
  enableTracing?: boolean;        // Default: false
  maxConcurrentExecutions?: number; // Default: 100
  queueTimeout?: number;          // Default: 5000 (5s)
  shutdownTimeout?: number;       // Default: 10000 (10s)
}
```

### Cache Configuration

```typescript
interface CacheConfig {
  enabled: boolean;
  ttl?: number;                   // Time-to-live in seconds
  keyStrategy?: CacheKeyStrategy; // 'default' | 'input-only' | 'custom'
  staleWhileRevalidate?: number;  // SWR time in seconds
  varyBy?: string[];              // Vary by request headers
  bypassCache?: (input) => boolean;
}
```

### Workflow Configuration

```typescript
interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  onError?: ErrorHandlingStrategy; // 'stop' | 'continue' | 'retry'
  timeout?: number;
}
```

## Performance

- **Cold Start**: <10ms
- **Warm Execution**: <1ms
- **Memory Usage**: <128MB per function
- **Global Coverage**: 300+ edge locations

## Examples

See the `examples/` directory for complete examples:

- [Basic Usage](./examples/basic-usage.ts) - Simple function execution
- [Workflow Orchestration](./examples/workflow-orchestration.ts) - Complex workflows
- [Deployment](./examples/deployment.ts) - Deployment and versioning

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

## License

MIT
