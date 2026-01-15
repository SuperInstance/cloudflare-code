/**
 * Unified Package Integration Layer - Usage Examples
 *
 * This file contains comprehensive examples demonstrating how to use
 * the integration layer for various scenarios.
 */

import {
  createIntegrationManager,
  createPackageRegistry,
  createPackageOrchestrator,
  createEventBus,
  type PackageMetadata,
  type PackageIdentifier,
  type PackageEvent,
} from './index';

// ============================================================================
// Example 1: Basic Setup and Package Registration
// ============================================================================

async function basicSetup() {
  // Create the integration manager
  const manager = createIntegrationManager({
    enableAutoDiscovery: true,
    enableAutoHealthMonitoring: true,
    enableAutoReconnect: true,
  });

  // Start the manager
  await manager.start();

  // Register a streaming package
  const streamingPackage: PackageMetadata = {
    id: {
      name: '@claudeflare/streaming',
      version: '1.0.0',
      instanceId: 'streaming-instance-1',
    },
    type: 'service',
    capabilities: [
      {
        name: 'stream-processing',
        version: '1.0.0',
        description: 'Process real-time data streams',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string' },
            config: { type: 'object' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'string' },
            metrics: { type: 'object' },
          },
        },
        resources: {
          memory: 128,
          cpu: 0.5,
          timeout: 30000,
        },
      },
      {
        name: 'backpressure-control',
        version: '1.0.0',
        description: 'Control backpressure in streaming pipelines',
      },
    ],
    dependencies: ['@claudeflare/observability'],
    healthCheck: '/health',
    location: {
      type: 'local',
    },
    tags: ['streaming', 'real-time', 'data-processing'],
    priority: 100,
  };

  await manager.registerPackage(streamingPackage);

  // Register a vector search package
  const vectorSearchPackage: PackageMetadata = {
    id: {
      name: '@claudeflare/vector-search',
      version: '1.0.0',
      instanceId: 'vector-search-1',
    },
    type: 'durable-object',
    capabilities: [
      {
        name: 'vector-search',
        version: '1.0.0',
        description: 'Search vector embeddings',
        resources: {
          memory: 256,
          timeout: 10000,
        },
      },
      {
        name: 'vector-index',
        version: '1.0.0',
        description: 'Index vector embeddings',
      },
    ],
    dependencies: [],
    location: {
      type: 'durable-object',
      doId: 'vector-index-do',
    },
    tags: ['search', 'embeddings', 'ai'],
    priority: 90,
  };

  await manager.registerPackage(vectorSearchPackage);

  return manager;
}

// ============================================================================
// Example 2: Service Discovery and Invocation
// ============================================================================

async function serviceDiscovery(manager: ReturnType<typeof createIntegrationManager>) {
  const orchestrator = manager.getOrchestrator();
  const registry = manager.getRegistry();

  // Discover packages with stream-processing capability
  const discoveryResult = registry.discover({
    capability: 'stream-processing',
    minHealth: 'healthy',
  });

  console.log('Discovered packages:', discoveryResult.packages.length);
  console.log('Selected package:', discoveryResult.selected?.metadata.id.name);

  // Invoke the capability using discovered package
  const response = await orchestrator.invokeDiscovered(
    'stream-processing',
    {
      data: 'example stream data',
      config: {
        batchSize: 100,
        windowSize: 1000,
      },
    }
  );

  console.log('Invocation result:', response);

  // Alternatively, invoke directly with package ID
  const directResponse = await orchestrator.invoke(
    {
      name: '@claudeflare/streaming',
      version: '1.0.0',
      instanceId: 'streaming-instance-1',
    },
    'stream-processing',
    {
      data: 'direct invocation data',
    }
  );

  console.log('Direct invocation result:', directResponse);
}

// ============================================================================
// Example 3: Event-Driven Communication
// ============================================================================

async function eventDrivenCommunication(manager: ReturnType<typeof createIntegrationManager>) {
  const eventBus = manager.getEventBus();

  // Subscribe to package registration events
  await eventBus.subscribe(
    {
      name: '@claudeflare/monitoring',
      version: '1.0.0',
      instanceId: 'monitoring-1',
    },
    async (event: PackageEvent) => {
      console.log('Package registered:', event.data);

      // Send notification
      await eventBus.publish(
        'monitoring.notification',
        {
          name: '@claudeflare/monitoring',
          version: '1.0.0',
          instanceId: 'monitoring-1',
        },
        {
          message: `Package ${event.type} registered`,
          timestamp: event.timestamp,
        }
      );
    },
    {
      eventTypes: ['integration.package.registered'],
    }
  );

  // Subscribe to all integration events
  await eventBus.subscribe(
    {
      name: '@claudeflare/audit-log',
      version: '1.0.0',
      instanceId: 'audit-1',
    },
    async (event: PackageEvent) => {
      // Log all integration events
      console.log('[AUDIT]', event.type, event.data);
    },
    {
      eventTypes: ['integration.*'],
    }
  );

  // Publish custom events
  await eventBus.publish(
    'custom.event',
    {
      name: '@claudeflare/my-package',
      version: '1.0.0',
      instanceId: 'my-package-1',
    },
    {
      message: 'Custom event data',
      value: 42,
    }
  );
}

// ============================================================================
// Example 4: Health Monitoring and Auto-Recovery
// ============================================================================

async function healthMonitoring(manager: ReturnType<typeof createIntegrationManager>) {
  const registry = manager.getRegistry();

  // Register health change callback
  registry.onHealthChange(
    {
      name: '@claudeflare/streaming',
      version: '1.0.0',
      instanceId: 'streaming-instance-1',
    },
    (health) => {
      console.log('Health status changed:', health.status);

      if (health.status === 'unhealthy') {
        console.log('Package is unhealthy, triggering recovery...');

        // Could trigger automatic recovery actions here
        // such as restarting the package, switching to fallback, etc.
      }
    }
  );

  // Perform manual health check
  const health = await registry.performHealthCheck({
    name: '@claudeflare/streaming',
    version: '1.0.0',
      instanceId: 'streaming-instance-1',
  });

  console.log('Health check result:', health);

  // Get all healthy packages
  const healthyPackages = registry.getAllPackages().filter(
    ({ health }) => health.status === 'healthy'
  );

  console.log('Healthy packages:', healthyPackages.length);
}

// ============================================================================
// Example 5: Advanced Invocation with Fallback and Retry
// ============================================================================

async function advancedInvocation(manager: ReturnType<typeof createIntegrationManager>) {
  const orchestrator = manager.getOrchestrator();

  // Invoke with custom options
  const response = await orchestrator.invokeDiscovered(
    'stream-processing',
    {
      data: 'complex data',
    },
    {
      capability: 'stream-processing',
      minHealth: 'healthy',
      maxResponseTime: 1000,
    },
    {
      timeout: 5000,
      retries: 5,
      enableFallback: true,
      onProgress: (progress) => {
        console.log(`Invocation progress: ${progress.attempt}/${progress.totalAttempts}`);
      },
    }
  );

  if (response.status === 'success') {
    console.log('Success:', response.data);
  } else if (response.status === 'error') {
    console.error('Error:', response.metadata?.error);

    // Check if fallback was used
    if (response.metadata?.fallback) {
      console.log('Fallback used:', response.metadata.fallback);
    }
  }
}

// ============================================================================
// Example 6: Event Replay for Testing and Debugging
// ============================================================================

async function eventReplay(manager: ReturnType<typeof createIntegrationManager>) {
  const eventBus = manager.getEventBus();

  // Replay events from the last hour
  const replayedCount = await eventBus.replay(
    async (event: PackageEvent) => {
      console.log('Replaying event:', event.type, event.timestamp);

      // Process event (e.g., for testing or recovery)
    },
    {
      from: Date.now() - 3600000, // 1 hour ago
      to: Date.now(),
      eventTypes: ['integration.package.registered'],
      speed: 10, // 10x speed for faster replay
    }
  );

  console.log('Replayed events:', replayedCount);
}

// ============================================================================
// Example 7: Statistics and Monitoring
// ============================================================================

async function statistics(manager: ReturnType<typeof createIntegrationManager>) {
  // Get comprehensive statistics
  const stats = manager.getStatistics();

  console.log('Registry stats:', stats.registry);
  console.log('Orchestrator metrics:', stats.orchestrator);
  console.log('Event bus stats:', stats.eventBus);
  console.log('Manager status:', stats.manager);

  // Get manager status
  const status = manager.getStatus();
  console.log('Manager status:', status);

  // Get specific metrics
  const orchestratorMetrics = manager.getOrchestrator().getMetrics();
  console.log('Total invocations:', orchestratorMetrics.total);
  console.log('Success rate:', orchestratorMetrics.successful / orchestratorMetrics.total * 100, '%');
  console.log('Average response time:', orchestratorMetrics.avgResponseTime, 'ms');
}

// ============================================================================
// Example 8: Complete Workflow
// ============================================================================

async function completeWorkflow() {
  // 1. Create and start manager
  const manager = createIntegrationManager({
    enableAutoDiscovery: true,
    enableAutoHealthMonitoring: true,
    enableAutoReconnect: true,
  });

  await manager.start();

  // 2. Register packages
  const packages: PackageMetadata[] = [
    {
      id: {
        name: '@claudeflare/streaming',
        version: '1.0.0',
        instanceId: 'streaming-1',
      },
      type: 'service',
      capabilities: [
        {
          name: 'stream-processing',
          version: '1.0.0',
          description: 'Process real-time data streams',
        },
      ],
      dependencies: [],
      location: { type: 'local' },
      tags: ['streaming', 'real-time'],
    },
    {
      id: {
        name: '@claudeflare/vector-search',
        version: '1.0.0',
        instanceId: 'vector-1',
      },
      type: 'durable-object',
      capabilities: [
        {
          name: 'vector-search',
          version: '1.0.0',
          description: 'Search vector embeddings',
        },
      ],
      dependencies: [],
      location: { type: 'durable-object', doId: 'vector-do' },
      tags: ['search', 'embeddings'],
    },
  ];

  for (const pkg of packages) {
    await manager.registerPackage(pkg);
  }

  // 3. Set up event subscriptions
  const eventBus = manager.getEventBus();

  await eventBus.subscribe(
    {
      name: '@claudeflare/monitoring',
      version: '1.0.0',
      instanceId: 'monitor-1',
    },
    async (event) => {
      console.log('Event received:', event.type);
    },
    {
      eventTypes: ['integration.*'],
    }
  );

  // 4. Invoke capabilities
  const orchestrator = manager.getOrchestrator();

  const result = await orchestrator.invokeDiscovered(
    'stream-processing',
    {
      data: 'workflow data',
    },
    {
      capability: 'stream-processing',
      minHealth: 'healthy',
    },
    {
      timeout: 10000,
      retries: 3,
      enableFallback: true,
    }
  );

  console.log('Workflow result:', result);

  // 5. Check statistics
  const stats = manager.getStatistics();
  console.log('Workflow statistics:', stats);

  // 6. Cleanup
  await manager.stop();

  return result;
}

// ============================================================================
// Example 9: Using Individual Components
// ============================================================================

async function individualComponents() {
  // Create registry
  const registry = createPackageRegistry({
    enableDiscovery: true,
    enableHealthMonitoring: true,
    healthCheckInterval: 30000,
    persistence: {
      // kv: env.KV, // Would pass in real KV namespace
    },
  });

  // Create orchestrator
  const orchestrator = createPackageOrchestrator(registry, {
    defaultTimeout: 30000,
    defaultRetries: 3,
    enableTracing: true,
    enableMetrics: true,
  });

  // Create event bus
  const eventBus = createEventBus({
    enablePersistence: true,
    eventRetention: 3600000,
    enableReplay: true,
  });

  // Use them independently
  await registry.registerPackage({
    id: {
      name: '@claudeflare/example',
      version: '1.0.0',
      instanceId: 'example-1',
    },
    type: 'service',
    capabilities: [
      {
        name: 'example-capability',
        version: '1.0.0',
        description: 'Example capability',
      },
    ],
    dependencies: [],
  });

  const health = await registry.performHealthCheck({
    name: '@claudeflare/example',
    version: '1.0.0',
    instanceId: 'example-1',
  });

  console.log('Health:', health);
}

// ============================================================================
// Example 10: Error Handling and Recovery
// ============================================================================

async function errorHandling(manager: ReturnType<typeof createIntegrationManager>) {
  const orchestrator = manager.getOrchestrator();

  // Invoke with comprehensive error handling
  try {
    const response = await orchestrator.invokeDiscovered(
      'non-existent-capability',
      {
        data: 'test',
      },
      undefined,
      {
        timeout: 5000,
        retries: 3,
        enableFallback: true,
        onProgress: (progress) => {
          console.log('Attempt', progress.attempt, 'of', progress.totalAttempts);
        },
      }
    );

    if (response.status === 'error') {
      console.error('Invocation failed:', response.metadata?.error);

      // Check for fallback
      if (response.metadata?.fallback) {
        console.log('Fallback was activated from',
          response.metadata.fallback.from, 'to',
          response.metadata.fallback.to);
      }

      // Handle error
      // Could implement retry, circuit breaker, etc.
    }
  } catch (error) {
    console.error('Unexpected error:', error);

    // Implement recovery strategy
    // Could include: logging, alerting, circuit breaker activation, etc.
  }

  // Monitor orchestration events
  orchestrator.onInvocationEvent = (event) => {
    if (event.type === 'error') {
      console.error('Invocation error:', event.error?.message);

      // Implement error handling
      // Could include: retry, fallback, circuit breaker, alerting
    } else if (event.type === 'fallback') {
      console.warn('Fallback activated:', event.request.target);

      // Could log fallback events for monitoring
    }
  };
}

// ============================================================================
// Export examples for use in tests or documentation
// ============================================================================

export const examples = {
  basicSetup,
  serviceDiscovery,
  eventDrivenCommunication,
  healthMonitoring,
  advancedInvocation,
  eventReplay,
  statistics,
  completeWorkflow,
  individualComponents,
  errorHandling,
};

// Example usage in comments:
/*
// Quick start
import { createIntegrationManager } from '@claudeflare/integration';

const manager = createIntegrationManager();
await manager.start();

await manager.registerPackage({
  id: { name: '@my/package', version: '1.0.0', instanceId: 'pkg-1' },
  type: 'service',
  capabilities: [{ name: 'my-capability', version: '1.0.0' }],
  dependencies: [],
});

const result = await manager.getOrchestrator().invokeDiscovered(
  'my-capability',
  { data: 'input' }
);
*/
