# @claudeflare/platform

**Unified Platform Integration Layer for ClaudeFlare**

A comprehensive service composition, orchestration, and dependency injection framework built for Cloudflare Workers and Durable Objects.

## Overview

The Platform package provides the foundational infrastructure for integrating all ClaudeFlare packages into a cohesive, distributed AI coding platform. It handles service discovery, dependency injection, lifecycle management, event-driven communication, and shared state synchronization across edge computing environments.

## Features

### 🏗️ Service Composition & Orchestration
- **Service Registry** - Centralized registration and discovery of all platform services
- **Service Discovery** - Automatic detection and registration of 50+ services across all packages
- **Orchestration** - Sophisticated dependency resolution with retry policies and error handling
- **Pipeline Processing** - Composable data pipelines with middleware support

### 🔗 Dependency Injection
- **DI Container** - Advanced DI with singleton, scoped, and transient lifecycles
- **Decorators** - TypeScript decorators for `@Injectable()`, `@Inject()`, and more
- **Circular Dependency Detection** - Automatic detection and prevention of circular dependencies
- **Module System** - Organize registrations into logical modules

### 🔄 Lifecycle Management
- **Phased Initialization** - CREATE → CONFIGURE → INITIALIZE → START → STOP → DESTROY
- **Lifecycle Hooks** - Register callbacks at any phase with priority ordering
- **Health Monitoring** - Built-in health checks for all services
- **Graceful Shutdown** - Ordered shutdown respecting dependencies

### 📊 Shared State Management
- **Distributed State** - Synchronized state across Durable Objects
- **State Scopes** - Namespaced state isolation
- **Transactions** - Atomic state operations with rollback support
- **Snapshots** - Point-in-time state capture and restoration

### 📡 Event Bus Integration
- **Unified Events** - Single event bus for all platform events
- **Middleware** - Transform, filter, and enrich events in-flight
- **Event Replay** - Replay historical events for debugging
- **Request/Response** - RPC-style communication over events

### ⚙️ Configuration Management
- **Multi-Source Loading** - Environment variables, files, and remote config
- **Schema Validation** - JSON schema validation for all configuration
- **Hot Reloading** - Watch and reload configuration changes
- **Default Values** - Pre-configured defaults for all services

## Architecture

### Service Registry

The service registry maintains metadata for all 50+ platform services:

```typescript
// Services are automatically discovered
import { serviceDiscovery } from '@claudeflare/platform';

const discoveries = serviceDiscovery.discoverServices();
// Returns services from: edge, events, ai, agents, storage, cache, security, etc.
```

### Dependency Injection

Powerful DI container with decorator support:

```typescript
import { Injectable, Inject, Container } from '@claudeflare/platform';

@Injectable()
class ChatService {
  constructor(
    @Inject('AI_PROVIDER') private ai: AIProvider,
    @Inject('CACHE') private cache: CacheService
  ) {}

  async chat(message: string): Promise<string> {
    // Use injected dependencies
  }
}
```

### Service Composition

Orchestrate multiple services into pipelines:

```typescript
import { ServiceOrchestrator, CompositionBuilder } from '@claudeflare/platform';

const orchestrator = new ServiceOrchestrator();

const builder = new CompositionBuilder(orchestrator)
  .addService('ai:provider')
  .addService('ai:semantic-cache')
  .addService('ai:rag-indexer');

const result = await builder.build('ai-pipeline');
```

### Platform Bootstrap

Initialize the entire platform with one call:

```typescript
import { bootstrapPlatform } from '@claudeflare/platform';

const platform = await bootstrapPlatform({
  environment: {
    mode: 'production',
    debug: false,
  },
  autoStart: true,
  enableDiscovery: true,
});

console.log('Platform started:', platform.started);
```

## Integration Points

### AI Services
- Multi-provider routing (OpenAI, Anthropic, Cohere)
- Agent orchestration and execution
- Semantic caching for embeddings
- RAG indexing and retrieval

### Developer Tools
- CLI command execution
- VS Code extension integration
- Dashboard API and UI
- Developer portal and API keys

### Infrastructure
- KV, R2, D1, and Durable Object storage
- Multi-level caching (L1 memory, L2 persistent)
- Load balancing with circuit breakers
- Monitoring and observability

### Security
- JWT and API key authentication
- RBAC/ABAC authorization
- Encryption at rest and in transit
- Comprehensive audit logging

## API Reference

### Core Classes

- `Platform` - Main platform class for bootstrap and lifecycle
- `ServiceRegistry` - Central service registration and discovery
- `DIContainer` - Dependency injection container
- `StateManager` - Distributed state management
- `PlatformEventBus` - Unified event bus
- `ConfigManager` - Configuration management
- `LifecycleManager` - Service lifecycle control
- `ServiceOrchestrator` - Service composition
- `ServicePipeline` - Data pipeline processing

### Utility Functions

- `bootstrapPlatform()` - Initialize the platform
- `quickStart()` - Quick development startup
- `shutdownPlatform()` - Graceful shutdown
- `retry()` - Retry with exponential backoff
- `parallel()` - Concurrent execution with limits
- `debounce()` - Debounce functions
- `throttle()` - Throttle functions

## Usage Examples

### Basic Platform Initialization

```typescript
import { bootstrapPlatform } from '@claudeflare/platform';

const { context, started, duration } = await bootstrapPlatform({
  autoStart: true,
});

console.log(`Platform started in ${duration}ms`);
```

### Register a Custom Service

```typescript
import { ServiceRegistry, ServiceType } from '@claudeflare/platform';

const registry = new ServiceRegistry();

await registry.register(
  'my-service',
  () => new MyService(),
  {
    type: ServiceType.AI_PROVIDER,
    priority: ServicePriority.HIGH,
    dependencies: ['storage:kv'],
    tags: ['custom', 'ai'],
  }
);

const service = await registry.get('my-service');
```

### Create a Data Pipeline

```typescript
import { ServicePipeline, PipelineMiddleware } from '@claudeflare/platform';

const pipeline = new ServicePipeline(services)
  .addStep({
    name: 'validate',
    serviceId: 'security:validation',
    method: 'validate',
    params: [input],
  })
  .use(PipelineMiddleware.logging())
  .use(PipelineMiddleware.metrics(metrics))
  .use(PipelineMiddleware.retry(3));

const result = await pipeline.execute();
```

### Use Dependency Injection

```typescript
import { DIContainer, Injectable, Inject } from '@claudeflare/platform';

@Injectable()
class MyService {
  constructor(
    @Inject('AI_PROVIDER') private ai: AIProvider,
    @Inject('STORAGE_KV') private kv: KVStorage
  ) {}

  async process(data: string): Promise<string> {
    const cached = await this.kv.get(data);
    if (cached) return cached;

    const result = await this.ai.chat(data);
    await this.kv.set(data, result);
    return result;
  }
}

const container = new DIContainer();
container.registerSingleton('MY_SERVICE', () => new MyService());

const service = await container.resolve('MY_SERVICE');
```

### Subscribe to Platform Events

```typescript
import { getPlatform } from '@claudeflare/platform';

const platform = getPlatform();
const eventBus = platform.getContext().eventBus;

// Subscribe to service events
eventBus.subscribe('service:started', (event) => {
  console.log('Service started:', event.data.serviceId);
});

// Subscribe to AI events
eventBus.subscribe('ai:request', (event) => {
  console.log('AI request:', event.data);
});

// Subscribe to state changes
eventBus.subscribe('state:changed', (event) => {
  console.log('State changed:', event.data.key);
});
```

## Configuration

The platform supports multiple configuration sources:

```typescript
import { ConfigManager, EnvironmentConfigLoader } from '@claudeflare/platform';

const config = new ConfigManager();

// Add loaders
config.addLoader(new EnvironmentConfigLoader());
config.addLoader(new RemoteConfigLoader('https://config.example.com'));

// Watch for changes
config.watch('ai.provider', (value) => {
  console.log('AI provider changed:', value);
});

// Get values
const provider = await config.get('ai.provider');
const model = await config.getOrDefault('ai.model', 'gpt-4');
```

## Health Monitoring

Built-in health checks for all services:

```typescript
import { healthMonitor, healthChecks } from '@claudeflare/platform';

// Register health checks
healthMonitor.registerHealthCheck('api', healthChecks.http('https://api.example.com/health'));
healthMonitor.registerHealthCheck('storage', healthChecks.kv(kv.get, 'health-check'));

// Check health
const health = await healthMonitor.checkHealth('api');
console.log('Status:', health.status);

// Check all services
const allHealth = await healthMonitor.checkAllHealth();
console.log('Unhealthy:', healthMonitor.getUnhealthyServices());

// Start periodic checks
healthMonitor.start();
```

## Performance

The platform is optimized for Cloudflare Workers edge computing:

- **Cold Start Optimization** - Lazy initialization reduces cold start time
- **Memory Efficiency** - Efficient data structures and minimal overhead
- **Concurrent Operations** - Parallel service startup and execution
- **Caching** - Multi-level caching for frequently accessed data
- **Connection Pooling** - Reuse connections across requests

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please use the GitHub issue tracker.
