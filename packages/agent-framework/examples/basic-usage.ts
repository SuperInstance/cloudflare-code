/**
 * Basic Agent Framework Usage Example
 *
 * This example demonstrates how to set up and use the agent framework
 * for multi-agent coordination and task execution.
 */

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
  createLogger
} from '../src';

// Initialize logger
const logger = createLogger('Example');

async function main() {
  logger.info('Starting Agent Framework Example');

  // 1. Initialize core components
  const registry = new AgentRegistry({
    heartbeatInterval: 5000,
    heartbeatTimeout: 15000,
    maxAgents: 100
  });

  const messageBroker = new MessageBroker({
    maxQueueSize: 1000,
    defaultTimeout: 5000
  });

  const taskManager = new TaskManager({
    maxConcurrentTasks: 50,
    defaultTimeout: 30000
  });

  const lifecycleManager = new AgentLifecycleManager(registry, {
    healthCheckInterval: 10000,
    maxRestarts: 3
  });

  const orchestrator = new AgentOrchestrator(
    registry,
    taskManager,
    messageBroker,
    {
      maxConcurrentWorkflows: 50,
      defaultTaskTimeout: 30000
    }
  );

  const patternManager = new CollaborationPatternManager(
    messageBroker,
    taskManager,
    {
      defaultTimeout: 30000,
      maxConcurrentSessions: 50
    }
  );

  const toolRegistry = new ToolRegistry({
    enableCache: true,
    defaultTimeout: 30000
  });

  // 2. Register some tools
  toolRegistry.registerTool({
    id: 'code-generator',
    name: 'Code Generator',
    version: '1.0.0',
    description: 'Generates code based on requirements',
    category: 'coding',
    parameters: [
      {
        name: 'language',
        type: 'string',
        required: true,
        description: 'Programming language'
      },
      {
        name: 'requirements',
        type: 'string',
        required: true,
        description: 'Code requirements'
      }
    ],
    returnType: {
      type: 'string',
      description: 'Generated code'
    },
    handler: async (params, context) => {
      logger.info('Generating code', { params, context });
      return {
        success: true,
        data: `// Generated ${params.language} code\n// Requirements: ${params.requirements}`,
        executionTime: 100
      };
    },
    permissions: ['code:write'],
    timeout: 10000,
    metadata: {}
  });

  // 3. Spawn agents
  const workerAgents = await lifecycleManager.bulkSpawnAgents([
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
    }
  ]);

  logger.info('Agents spawned', {
    successful: workerAgents.filter(a => a.success).length,
    failed: workerAgents.filter(a => !a.success).length
  });

  // 4. Grant permissions
  const agentIds = workerAgents.filter(a => a.success).map(a => a.agentId);
  for (const agentId of agentIds) {
    toolRegistry.grantPermission(
      agentId,
      'code-generator',
      ['code:write'],
      'admin'
    );
  }

  // 5. Create and execute tasks
  const tasks = await Promise.all([
    taskManager.createTask({
      type: 'code-generation',
      name: 'Generate API endpoint',
      priority: 1, // NORMAL
      input: {
        data: {
          language: 'typescript',
          framework: 'express',
          endpoint: '/api/users'
        }
      }
    }),
    taskManager.createTask({
      type: 'code-review',
      name: 'Review generated code',
      priority: 1,
      input: {
        data: {
          files: ['src/api/users.ts']
        }
      }
    }),
    taskManager.createTask({
      type: 'testing',
      name: 'Write unit tests',
      priority: 1,
      input: {
        data: {
          target: 'src/api/users.ts'
        }
      }
    })
  ]);

  logger.info('Tasks created', { count: tasks.length });

  // 6. Simulate task execution
  for (const task of tasks) {
    const agent = await orchestrator['selectAgentForTask'](task);
    await taskManager.assignTask(task.id, agent);
    await taskManager.startTask(task.id);

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 100));

    // Complete task
    await taskManager.completeTask(
      task.id,
      {
        data: {
          result: `Task ${task.name} completed successfully`
        }
      },
      agent
    );

    logger.info('Task completed', {
      taskId: task.id,
      agent,
      duration: task.actualDuration
    });
  }

  // 7. Execute workflow with orchestrator
  logger.info('Executing workflow...');

  const workflow = await orchestrator.executeWorkflow(
    [
      {
        type: 'planning',
        name: 'Plan implementation',
        input: { data: { feature: 'user-auth' } }
      },
      {
        type: 'code-generation',
        name: 'Generate auth code',
        input: { data: { language: 'typescript' } }
      },
      {
        type: 'testing',
        name: 'Test auth implementation',
        input: { data: { target: 'auth' } }
      }
    ],
    {
      strategy: 'sequential',
      maxConcurrency: 3
    }
  );

  logger.info('Workflow completed', {
    workflowId: workflow.workflowId,
    status: workflow.status,
    duration: workflow.endTime! - workflow.startTime
  });

  // 8. Execute collaboration pattern
  logger.info('Executing fan-out pattern...');

  const agents = await registry.discoverAgents({
    type: AgentType.WORKER
  });

  const collaborationResult = await patternManager.executeFanOut({
    sourceId: 'orchestrator',
    destinations: agents.map(a => a.id),
    message: {
      id: 'msg-1',
      type: 'notification' as any,
      from: 'orchestrator',
      to: '*',
      payload: {
        type: 'json',
        data: { action: 'health-check' }
      },
      priority: 1,
      timestamp: Date.now(),
      deliveryGuarantee: 'at_least_once' as any,
      routingStrategy: 'broadcast' as any,
      headers: { contentType: 'application/json' },
      metadata: {}
    },
    aggregationStrategy: 'wait_all',
    aggregationTimeout: 5000
  });

  logger.info('Collaboration completed', {
    sessionId: collaborationResult.sessionId,
    status: collaborationResult.status,
    participants: collaborationResult.participants.length
  });

  // 9. Use tool registry
  logger.info('Invoking tool...');

  const toolResult = await toolRegistry.invokeTool(
    'code-generator',
    agentIds[0],
    {
      language: 'python',
      requirements: 'Create a simple REST API'
    },
    {
      metadata: {
        requestId: 'req-123'
      }
    }
  );

  logger.info('Tool result', {
    success: toolResult.success,
    data: toolResult.data,
    executionTime: toolResult.executionTime
  });

  // 10. Get statistics
  const registryStats = registry.getRegistryStats();
  const taskStats = taskManager.getStats();
  const orchestratorMetrics = orchestrator.getMetrics();
  const toolMetrics = toolRegistry.getMetrics();

  logger.info('Statistics', {
    registry: {
      totalAgents: registryStats.totalAgents,
      totalRegistrations: registryStats.totalRegistrations
    },
    tasks: {
      totalTasks: taskStats.totalTasks,
      successRate: taskStats.successRate
    },
    orchestrator: {
      workflowsStarted: orchestratorMetrics.workflowsStarted,
      workflowsCompleted: orchestratorMetrics.workflowsCompleted
    },
    tools: {
      totalInvocations: toolMetrics.totalInvocations,
      successfulInvocations: toolMetrics.successfulInvocations
    }
  });

  // 11. Cleanup
  logger.info('Shutting down...');

  await patternManager.shutdown();
  await lifecycleManager.shutdownAll(true);
  await taskManager.shutdown();
  await messageBroker.shutdown();
  await registry.shutdown();
  await toolRegistry.shutdown();

  logger.info('Example completed successfully');
}

// Run the example
if (require.main === module) {
  main().catch(error => {
    logger.error('Example failed', error);
    process.exit(1);
  });
}

export { main };
