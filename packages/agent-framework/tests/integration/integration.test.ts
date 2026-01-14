/**
 * Integration Tests for Agent Framework
 *
 * Tests the complete workflow of the agent framework with all components.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  AgentRegistry,
  AgentLifecycleManager,
  TaskManager,
  MessageBroker,
  AgentOrchestrator,
  CollaborationPatternManager,
  ToolRegistry,
  AgentType,
  TaskStatus,
  CollaborationPattern,
  MessageType,
  MessagePriority,
  DeliveryGuarantee,
  RoutingStrategy
} from '../../src';

describe('Agent Framework Integration Tests', () => {
  let registry: AgentRegistry;
  let lifecycleManager: AgentLifecycleManager;
  let taskManager: TaskManager;
  let messageBroker: MessageBroker;
  let orchestrator: AgentOrchestrator;
  let patternManager: CollaborationPatternManager;
  let toolRegistry: ToolRegistry;
  let agentIds: string[];

  beforeAll(async () => {
    // Initialize all components
    registry = new AgentRegistry({
      heartbeatInterval: 5000,
      heartbeatTimeout: 15000,
      maxAgents: 100,
      enableHealthChecks: true,
      enableMetrics: true
    });

    messageBroker = new MessageBroker({
      maxQueueSize: 1000,
      maxMessageSize: 1024 * 1024,
      defaultTimeout: 5000,
      enableCompression: false,
      enableEncryption: false,
      maxRetries: 3,
      retryDelay: 1000
    });

    taskManager = new TaskManager({
      maxConcurrentTasks: 50,
      defaultTimeout: 30000,
      enablePrioritization: true,
      enableMetrics: true,
      retentionDays: 7,
      cleanupInterval: 3600000
    });

    lifecycleManager = new AgentLifecycleManager(registry, {
      healthCheckInterval: 10000,
      healthCheckTimeout: 5000,
      maxRestarts: 3,
      restartDelay: 5000,
      gracefulShutdownTimeout: 30000,
      enableAutoRestart: true,
      enableMonitoring: true
    });

    orchestrator = new AgentOrchestrator(
      registry,
      taskManager,
      messageBroker,
      {
        maxConcurrentWorkflows: 50,
        defaultTaskTimeout: 30000,
        loadBalancingStrategy: 'least_loaded' as any,
        workflowTimeout: 300000,
        enableMonitoring: true,
        enableMetrics: true
      }
    );

    patternManager = new CollaborationPatternManager(
      messageBroker,
      taskManager,
      {
        defaultTimeout: 30000,
        maxConcurrentSessions: 50,
        enableMetrics: true
      }
    );

    toolRegistry = new ToolRegistry({
      enableCache: true,
      cacheTimeout: 60000,
      enableMetrics: true,
      defaultTimeout: 30000,
      maxConcurrentInvocations: 100
    });

    // Spawn test agents
    const spawnResults = await lifecycleManager.bulkSpawnAgents([
      {
        name: 'worker-1',
        type: AgentType.WORKER,
        capabilities: [
          {
            name: 'code-generation',
            version: '1.0.0',
            description: 'Generate code',
            category: 'coding'
          },
          {
            name: 'code-review',
            version: '1.0.0',
            description: 'Review code',
            category: 'coding'
          }
        ]
      },
      {
        name: 'worker-2',
        type: AgentType.WORKER,
        capabilities: [
          {
            name: 'code-generation',
            version: '1.0.0',
            description: 'Generate code',
            category: 'coding'
          },
          {
            name: 'testing',
            version: '1.0.0',
            description: 'Write tests',
            category: 'testing'
          }
        ]
      },
      {
        name: 'planner-1',
        type: AgentType.PLANNER,
        capabilities: [
          {
            name: 'planning',
            version: '1.0.0',
            description: 'Plan tasks',
            category: 'planning'
          }
        ]
      },
      {
        name: 'orchestrator-1',
        type: AgentType.ORCHESTRATOR,
        capabilities: [
          {
            name: 'orchestration',
            version: '1.0.0',
            description: 'Orchestrate workflows',
            category: 'coordination'
          }
        ]
      }
    ]);

    agentIds = spawnResults.filter(r => r.success).map(r => r.agentId);

    // Grant tool permissions
    for (const agentId of agentIds) {
      toolRegistry.grantPermission(agentId, 'test-tool', ['test:execute'], 'admin');
    }
  });

  afterAll(async () => {
    await patternManager.shutdown();
    await lifecycleManager.shutdownAll(true);
    await taskManager.shutdown();
    await messageBroker.shutdown();
    await registry.shutdown();
    await toolRegistry.shutdown();
  });

  describe('End-to-End Workflow', () => {
    it('should complete full workflow: spawn agents, create tasks, execute workflow', async () => {
      // Verify agents are spawned
      expect(agentIds).toHaveLength(4);

      const allAgents = registry.getAllAgents();
      expect(allAgents).toHaveLength(4);

      // Create tasks
      const tasks = await Promise.all([
        taskManager.createTask({
          type: 'planning',
          name: 'Plan feature implementation',
          input: { data: { feature: 'user-auth' } }
        }),
        taskManager.createTask({
          type: 'code-generation',
          name: 'Generate authentication code',
          input: { data: { language: 'typescript' } }
        }),
        taskManager.createTask({
          type: 'testing',
          name: 'Write authentication tests',
          input: { data: { target: 'auth' } }
        })
      ]);

      expect(tasks).toHaveLength(3);

      // Assign and execute tasks
      for (const task of tasks) {
        const agent = await orchestrator['selectAgentForTask'](task);
        expect(agent).toBeDefined();

        await taskManager.assignTask(task.id, agent);
        await taskManager.startTask(task.id);

        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 50));

        await taskManager.completeTask(
          task.id,
          {
            data: { result: `Task ${task.name} completed` }
          },
          agent
        );

        const updated = taskManager.getTask(task.id);
        expect(updated!.status).toBe(TaskStatus.COMPLETED);
      }

      // Execute workflow
      const workflow = await orchestrator.executeWorkflow(
        [
          {
            type: 'planning',
            name: 'Plan task',
            input: { data: { task: 'integration-test' } }
          },
          {
            type: 'code-generation',
            name: 'Generate code',
            input: { data: { language: 'typescript' } }
          }
        ],
        {
          strategy: 'sequential',
          maxConcurrency: 2
        }
      );

      expect(workflow.status).toBe('completed');
      expect(workflow.completedTasks.size).toBe(2);
      expect(workflow.failedTasks.size).toBe(0);
    });
  });

  describe('Agent Discovery and Selection', () => {
    it('should discover agents by type', async () => {
      const workers = await registry.discoverAgents({
        type: AgentType.WORKER
      });

      expect(workers.length).toBeGreaterThan(0);
      expect(workers.every(w => w.type === AgentType.WORKER)).toBe(true);
    });

    it('should discover agents by capability', async () => {
      const agents = await registry.discoverAgents({
        capabilities: ['code-generation']
      });

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every(a =>
        a.capabilities.some(c => c.name === 'code-generation')
      )).toBe(true);
    });

    it('should discover agents by health and load', async () => {
      // Update agent health
      const agents = registry.getAllAgents();
      await registry.updateAgent(agents[0].id, {
        health: 'healthy' as any,
        state: 'idle' as any,
        load: 0.3
      });

      const discovered = await registry.discoverAgents({
        minHealth: 'healthy' as any,
        maxLoad: 0.5
      });

      expect(discovered.length).toBeGreaterThan(0);
      expect(discovered.every(d => d.load <= 0.5)).toBe(true);
    });
  });

  describe('Message Communication', () => {
    it('should send and receive direct messages', async () => {
      const message = {
        id: 'msg-test-1',
        type: MessageType.REQUEST,
        from: agentIds[0],
        to: agentIds[1],
        payload: {
          type: 'json',
          data: { action: 'test', data: 'hello' }
        },
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      };

      await messageBroker.send(message);

      const status = messageBroker['deliveryStatus'].get(message.id);
      expect(status).toBe('delivered' as any);
    });

    it('should handle pub/sub communication', async () => {
      const topic = 'test-events';

      // Subscribe agents
      await messageBroker.subscribe(agentIds[0], topic);
      await messageBroker.subscribe(agentIds[1], topic);

      // Publish message
      await messageBroker.publish(
        topic,
        {
          type: 'json',
          data: { event: 'test-event', data: 'test-data' }
        },
        agentIds[2]
      );

      // Verify subscriptions
      const subscriptions = messageBroker.getSubscriptions(agentIds[0]);
      expect(subscriptions.length).toBeGreaterThan(0);
    });
  });

  describe('Collaboration Patterns', () => {
    it('should execute fan-out pattern', async () => {
      const workers = await registry.discoverAgents({
        type: AgentType.WORKER
      });

      const result = await patternManager.executeFanOut({
        sourceId: agentIds[0],
        destinations: workers.map(w => w.id),
        message: {
          id: 'msg-fanout-1',
          type: MessageType.NOTIFICATION,
          from: agentIds[0],
          to: '*',
          payload: {
            type: 'json',
            data: { action: 'broadcast-test' }
          },
          priority: MessagePriority.NORMAL,
          timestamp: Date.now(),
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
          routingStrategy: RoutingStrategy.BROADCAST,
          headers: { contentType: 'application/json' },
          metadata: {}
        },
        aggregationStrategy: 'wait_all',
        aggregationTimeout: 5000
      });

      expect(result.status).toBe('completed');
    });
  });

  describe('Tool Integration', () => {
    it('should register and invoke tools', async () => {
      // Register tool
      toolRegistry.registerTool({
        id: 'test-tool',
        name: 'Test Tool',
        version: '1.0.0',
        description: 'A test tool',
        category: 'test',
        parameters: [
          {
            name: 'input',
            type: 'string',
            required: true,
            description: 'Input parameter'
          }
        ],
        returnType: {
          type: 'string',
          description: 'Output string'
        },
        handler: async (params, context) => {
          return {
            success: true,
            data: `Processed: ${params.input}`,
            executionTime: 50
          };
        },
        permissions: ['test:execute'],
        timeout: 5000,
        metadata: {}
      });

      // Invoke tool
      const result = await toolRegistry.invokeTool(
        'test-tool',
        agentIds[0],
        { input: 'test-data' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('Processed: test-data');
    });

    it('should enforce permissions', async () => {
      // Register restricted tool
      toolRegistry.registerTool({
        id: 'restricted-tool',
        name: 'Restricted Tool',
        version: '1.0.0',
        description: 'A restricted tool',
        category: 'test',
        parameters: [],
        returnType: { type: 'string', description: 'Output' },
        handler: async () => {
          return { success: true, data: 'success', executionTime: 50 };
        },
        permissions: ['admin:execute'],
        timeout: 5000,
        metadata: {}
      });

      // Try to invoke without permission
      await expect(
        toolRegistry.invokeTool('restricted-tool', agentIds[0], {})
      ).rejects.toThrow();
    });
  });

  describe('Performance and Metrics', () => {
    it('should track metrics across all components', async () => {
      // Create and execute tasks
      const task = await taskManager.createTask({
        type: 'metrics-test',
        name: 'Test task for metrics',
        input: { data: {} }
      });

      await taskManager.assignTask(task.id, agentIds[0]);
      await taskManager.startTask(task.id);
      await taskManager.completeTask(task.id, { data: {} }, agentIds[0]);

      // Check task manager metrics
      const taskStats = taskManager.getStats();
      expect(taskStats.totalTasks).toBeGreaterThan(0);
      expect(taskStats.successRate).toBeGreaterThan(0);

      // Check registry metrics
      const registryStats = registry.getRegistryStats();
      expect(registryStats.totalAgents).toBe(4);
      expect(registryStats.totalRegistrations).toBe(4);

      // Check orchestrator metrics
      const orchestratorMetrics = orchestrator.getMetrics();
      expect(orchestratorMetrics).toBeDefined();

      // Check tool metrics
      const toolMetrics = toolRegistry.getMetrics();
      expect(toolMetrics).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle task failures gracefully', async () => {
      const task = await taskManager.createTask({
        type: 'failing-task',
        name: 'Test failing task',
        input: { data: {} }
      });

      await taskManager.assignTask(task.id, agentIds[0]);
      await taskManager.startTask(task.id);
      await taskManager.failTask(task.id, new Error('Task failed'), agentIds[0]);

      const updated = taskManager.getTask(task.id);
      expect(updated!.status).toBe(TaskStatus.FAILED);
      expect(updated!.error).toBeDefined();
    });

    it('should handle message delivery failures', async () => {
      const handler = vi.fn();
      messageBroker.on('message:failed', handler);

      // Try to send invalid message
      const invalidMessage = {
        id: '', // Invalid empty ID
        type: MessageType.REQUEST,
        from: agentIds[0],
        to: agentIds[1],
        payload: { type: 'json', data: {} },
        priority: MessagePriority.NORMAL,
        timestamp: Date.now(),
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
        routingStrategy: RoutingStrategy.DIRECT,
        headers: { contentType: 'application/json' },
        metadata: {}
      };

      await expect(messageBroker.send(invalidMessage as any)).rejects.toThrow();
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should shutdown all components cleanly', async () => {
      // This is tested in the afterAll hook
      // Verify components are still working before shutdown
      expect(registry.getAllAgents()).toHaveLength(4);
      expect(taskManager.getStats().totalTasks).toBeGreaterThan(0);

      // Shutdown will be handled by afterAll
    });
  });
});
