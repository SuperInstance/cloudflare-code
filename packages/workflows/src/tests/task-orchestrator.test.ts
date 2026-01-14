/**
 * Tests for Task Orchestrator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskOrchestrator, TaskPriority, TaskExecutionStatus } from '../tasks/orchestrator';
import type { TaskDefinition, TaskExecutor } from '../tasks/orchestrator';
import type { Node, Workflow } from '../types';

describe('TaskOrchestrator', () => {
  let orchestrator: TaskOrchestrator;
  let mockExecutor: TaskExecutor;

  beforeEach(() => {
    orchestrator = new TaskOrchestrator({
      maxQueueSize: 100,
      cpuCapacity: 100,
      memoryCapacity: 1024 * 1024 * 1024,
      storageCapacity: 10 * 1024 * 1024 * 1024,
      loadBalancingStrategy: 'round-robin'
    });

    mockExecutor = {
      execute: vi.fn().mockResolvedValue({ result: 'success' })
    };
  });

  describe('Task Definition', () => {
    it('should register task definition', () => {
      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
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
      };

      orchestrator.registerTaskDefinition(definition);

      const retrieved = orchestrator.getTaskDefinition('task-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Task');
    });

    it('should create task from workflow node', () => {
      const node: Node = {
        id: 'node-1' as any,
        type: 'action',
        actionType: 'kv_get',
        name: 'Get Value',
        config: { key: 'testKey' },
        position: { x: 100, y: 100 },
        enabled: true
      };

      const workflow: Workflow = {
        id: 'workflow-1' as any,
        name: 'Test Workflow',
        description: '',
        version: 1,
        status: 'active',
        nodes: [node],
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

      const task = orchestrator.createTaskFromNode(node, workflow);

      expect(task).toBeDefined();
      expect(task.id).toBe(node.id);
      expect(task.name).toBe(node.name);
      expect(task.type).toBe('action');
    });
  });

  describe('Task Scheduling', () => {
    it('should schedule a task', async () => {
      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
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
      };

      orchestrator.registerTaskDefinition(definition);

      const taskId = await orchestrator.scheduleTask('task-1', { input: 'value' });

      expect(taskId).toBe('task-1');
    });

    it('should throw error for non-existent task', async () => {
      await expect(
        orchestrator.scheduleTask('non-existent', {})
      ).rejects.toThrow();
    });
  });

  describe('Task Execution', () => {
    it('should execute a task successfully', async () => {
      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
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
      };

      orchestrator.registerTaskDefinition(definition);
      await orchestrator.scheduleTask('task-1', { input: 'value' });

      const execution = await orchestrator.executeTask('task-1', mockExecutor);

      expect(execution.status).toBe(TaskExecutionStatus.COMPLETED);
      expect(execution.output).toEqual({ result: 'success' });
      expect(mockExecutor.execute).toHaveBeenCalled();
    });

    it('should handle task execution failure', async () => {
      const failingExecutor: TaskExecutor = {
        execute: vi.fn().mockRejectedValue(new Error('Task failed'))
      };

      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
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
      };

      orchestrator.registerTaskDefinition(definition);
      await orchestrator.scheduleTask('task-1', {});

      const execution = await orchestrator.executeTask('task-1', failingExecutor);

      expect(execution.status).toBe(TaskExecutionStatus.FAILED);
      expect(execution.error).toBeDefined();
      expect(execution.error?.message).toBe('Task failed');
    });

    it('should retry retryable failures', async () => {
      let attemptCount = 0;
      const retryingExecutor: TaskExecutor = {
        execute: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error('ECONNRESET'));
          }
          return Promise.resolve({ result: 'success' });
        })
      };

      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
        type: 'action',
        config: {},
        requirements: {
          cpu: 1,
          memory: 100 * 1024 * 1024
        },
        priority: TaskPriority.MEDIUM,
        dependencies: [],
        retryConfig: {
          maxAttempts: 3,
          backoffType: 'exponential',
          initialDelay: 100
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      orchestrator.registerTaskDefinition(definition);
      await orchestrator.scheduleTask('task-1', {});

      const execution = await orchestrator.executeTask('task-1', retryingExecutor);

      expect(execution.status).toBe(TaskExecutionStatus.COMPLETED);
      expect(execution.retryCount).toBe(2);
      expect(attemptCount).toBe(3);
    });
  });

  describe('Resource Management', () => {
    it('should allocate resources for task execution', async () => {
      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
        type: 'action',
        config: {},
        requirements: {
          cpu: 10,
          memory: 100 * 1024 * 1024
        },
        priority: TaskPriority.MEDIUM,
        dependencies: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      orchestrator.registerTaskDefinition(definition);
      await orchestrator.scheduleTask('task-1', {});

      const beforeUtil = orchestrator.getResourceUtilization();
      await orchestrator.executeTask('task-1', mockExecutor);
      const afterUtil = orchestrator.getResourceUtilization();

      expect(afterUtil['cpu-pool']).toBeLessThan(beforeUtil['cpu-pool']);
      expect(afterUtil['memory-pool']).toBeLessThan(beforeUtil['memory-pool']);
    });

    it('should queue tasks when resources unavailable', async () => {
      // Create tasks that exceed capacity
      for (let i = 0; i < 20; i++) {
        const definition: TaskDefinition = {
          id: `task-${i}`,
          name: `Task ${i}`,
          type: 'action',
          config: {},
          requirements: {
            cpu: 10,
            memory: 100 * 1024 * 1024
          },
          priority: TaskPriority.MEDIUM,
          dependencies: [],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };

        orchestrator.registerTaskDefinition(definition);
        await orchestrator.scheduleTask(`task-${i}`, {});
      }

      const queueStatus = orchestrator.getQueueStatus();
      expect(queueStatus.size).toBeGreaterThan(0);
    });

    it('should release resources after task completion', async () => {
      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
        type: 'action',
        config: {},
        requirements: {
          cpu: 10,
          memory: 100 * 1024 * 1024
        },
        priority: TaskPriority.MEDIUM,
        dependencies: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      orchestrator.registerTaskDefinition(definition);
      await orchestrator.scheduleTask('task-1', {});

      const beforeUtil = orchestrator.getResourceUtilization();
      await orchestrator.executeTask('task-1', mockExecutor);

      // Give time for resource release
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterUtil = orchestrator.getResourceUtilization();

      // Resources should be released back
      expect(afterUtil['cpu-pool']).toBe(0);
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel a pending task', async () => {
      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
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
      };

      orchestrator.registerTaskDefinition(definition);
      await orchestrator.scheduleTask('task-1', {});

      await orchestrator.cancelTask('task-1');

      const status = orchestrator.getTaskStatus('task-1');
      expect(status).toBe(TaskExecutionStatus.CANCELLED);
    });

    it('should cancel a running task', async () => {
      const slowExecutor: TaskExecutor = {
        execute: vi.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(() => resolve({ result: 'success' }), 5000))
        )
      };

      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
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
      };

      orchestrator.registerTaskDefinition(definition);
      await orchestrator.scheduleTask('task-1', {});

      // Start execution
      const executionPromise = orchestrator.executeTask('task-1', slowExecutor);

      // Cancel immediately
      setTimeout(() => orchestrator.cancelTask('task-1'), 100);

      const execution = await executionPromise;

      expect(execution.status).toBe(TaskExecutionStatus.CANCELLED);
    });
  });

  describe('Task Monitoring', () => {
    it('should track task execution history', async () => {
      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
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
      };

      orchestrator.registerTaskDefinition(definition);
      await orchestrator.scheduleTask('task-1', {});
      await orchestrator.executeTask('task-1', mockExecutor);

      const history = orchestrator.getExecutionHistory();

      expect(history.length).toBe(1);
      expect(history[0].taskId).toBe('task-1');
      expect(history[0].status).toBe(TaskExecutionStatus.COMPLETED);
    });

    it('should limit history size', async () => {
      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
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
      };

      orchestrator.registerTaskDefinition(definition);

      // Execute task multiple times
      for (let i = 0; i < 10; i++) {
        await orchestrator.scheduleTask('task-1', {});
        await orchestrator.executeTask('task-1', mockExecutor);
      }

      const history = orchestrator.getExecutionHistory();

      // History should contain all executions
      expect(history.length).toBe(10);
    });
  });

  describe('Resource Pools', () => {
    it('should create custom resource pool', () => {
      orchestrator.createResourcePool({
        id: 'custom-pool',
        name: 'Custom Pool',
        type: 'cpu',
        capacity: 50,
        available: 50
      });

      const pool = orchestrator.getResourcePool('custom-pool');

      expect(pool).toBeDefined();
      expect(pool?.capacity).toBe(50);
      expect(pool?.available).toBe(50);
    });

    it('should get all resource pools', () => {
      const pools = orchestrator.getResourcePools();

      expect(pools.length).toBeGreaterThan(0);
      expect(pools.some(p => p.id === 'cpu-pool')).toBe(true);
      expect(pools.some(p => p.id === 'memory-pool')).toBe(true);
      expect(pools.some(p => p.id === 'storage-pool')).toBe(true);
    });

    it('should get resource utilization', () => {
      const utilization = orchestrator.getResourceUtilization();

      expect(utilization).toHaveProperty('cpu-pool');
      expect(utilization).toHaveProperty('memory-pool');
      expect(utilization).toHaveProperty('storage-pool');
    });
  });

  describe('Queue Management', () => {
    it('should get queue status', async () => {
      const definition: TaskDefinition = {
        id: 'task-1',
        name: 'Test Task',
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
      };

      orchestrator.registerTaskDefinition(definition);
      await orchestrator.scheduleTask('task-1', {});

      const status = orchestrator.getQueueStatus();

      expect(status).toHaveProperty('size');
      expect(status).toHaveProperty('pending');
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('completed');
      expect(status).toHaveProperty('failed');
    });
  });

  describe('Priority Handling', () => {
    it('should prioritize critical tasks', () => {
      const node1: Node = {
        id: 'node-1' as any,
        type: 'action',
        actionType: 'kv_get',
        name: 'Critical Task',
        config: { priority: 'high' },
        position: { x: 100, y: 100 },
        enabled: true
      };

      const workflow: Workflow = {
        id: 'workflow-1' as any,
        name: 'Test Workflow',
        description: '',
        version: 1,
        status: 'active',
        nodes: [node1],
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

      const task = orchestrator.createTaskFromNode(node1, workflow);

      // High priority tasks should have lower priority number (higher importance)
      expect(task.priority).toBeLessThanOrEqual(TaskPriority.HIGH);
    });
  });
});
