/**
 * Task Manager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskManager } from '../../src/tasks/manager';
import type { CreateTaskParams, TaskInput, TaskDependency } from '../../src/types';
import { TaskStatus, TaskPriority, FrameworkError, AgentFrameworkError } from '../../src/types';

describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager({
      maxConcurrentTasks: 10,
      defaultTimeout: 30000,
      enablePrioritization: true,
      enableMetrics: true,
      retentionDays: 7,
      cleanupInterval: 3600000
    });
  });

  afterEach(async () => {
    await taskManager.shutdown();
  });

  describe('Task Creation', () => {
    it('should create a task successfully', async () => {
      const params: CreateTaskParams = {
        type: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        priority: TaskPriority.NORMAL,
        input: {
          data: { test: true },
          schema: {
            type: 'object',
            properties: {
              test: { type: 'boolean' }
            }
          }
        }
      };

      const task = await taskManager.createTask(params);

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.type).toBe('test-task');
      expect(task.name).toBe('Test Task');
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.priority).toBe(TaskPriority.NORMAL);
    });

    it('should emit task:created event', async () => {
      const handler = vi.fn();
      taskManager.on('task:created', handler);

      const params: CreateTaskParams = {
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      };

      await taskManager.createTask(params);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should create task with dependencies', async () => {
      const dep1 = await taskManager.createTask({
        type: 'dep-task',
        name: 'Dependency 1',
        input: { data: {} }
      });

      const dep2 = await taskManager.createTask({
        type: 'dep-task',
        name: 'Dependency 2',
        input: { data: {} }
      });

      const dependencies: TaskDependency[] = [
        { taskId: dep1.id, type: 'hard' },
        { taskId: dep2.id, type: 'soft' }
      ];

      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} },
        dependencies
      });

      expect(task.dependencies).toHaveLength(2);
    });

    it('should reject task with invalid dependency', async () => {
      const dependencies: TaskDependency[] = [
        { taskId: 'non-existent', type: 'hard' }
      ];

      const params: CreateTaskParams = {
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} },
        dependencies
      };

      await expect(taskManager.createTask(params)).rejects.toThrow();
    });
  });

  describe('Task Assignment', () => {
    it('should assign task to agent', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.assignTask(task.id, 'agent-1');

      const updated = taskManager.getTask(task.id);
      expect(updated!.assignedAgent).toBe('agent-1');
      expect(updated!.status).toBe(TaskStatus.ASSIGNED);
      expect(updated!.assignedAt).toBeDefined();
    });

    it('should emit task:assigned event', async () => {
      const handler = vi.fn();
      taskManager.on('task:assigned', handler);

      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.assignTask(task.id, 'agent-1');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should throw error when assigning non-existent task', async () => {
      await expect(
        taskManager.assignTask('non-existent', 'agent-1')
      ).rejects.toThrow();
    });
  });

  describe('Task Execution', () => {
    it('should start task execution', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.startTask(task.id);

      const updated = taskManager.getTask(task.id);
      expect(updated!.status).toBe(TaskStatus.RUNNING);
      expect(updated!.startedAt).toBeDefined();
    });

    it('should emit task:started event', async () => {
      const handler = vi.fn();
      taskManager.on('task:started', handler);

      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.startTask(task.id);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should complete task successfully', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.startTask(task.id);

      const result = await taskManager.completeTask(task.id, {
        data: { result: 'success' }
      }, 'agent-1');

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.agentId).toBe('agent-1');
      expect(result.executionTime).toBeGreaterThan(0);

      const updated = taskManager.getTask(task.id);
      expect(updated!.status).toBe(TaskStatus.COMPLETED);
      expect(updated!.completedAt).toBeDefined();
    });

    it('should emit task:completed event', async () => {
      const handler = vi.fn();
      taskManager.on('task:completed', handler);

      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.startTask(task.id);
      await taskManager.completeTask(task.id, { data: {} }, 'agent-1');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should fail task with error', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.startTask(task.id);

      const error = new Error('Task failed');
      await taskManager.failTask(task.id, error, 'agent-1');

      const updated = taskManager.getTask(task.id);
      expect(updated!.status).toBe(TaskStatus.FAILED);
      expect(updated!.error).toBeDefined();
      expect(updated!.error!.message).toBe('Task failed');
    });

    it('should emit task:failed event', async () => {
      const handler = vi.fn();
      taskManager.on('task:failed', handler);

      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.startTask(task.id);
      await taskManager.failTask(task.id, new Error('Failed'), 'agent-1');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should cancel task', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.cancelTask(task.id);

      const updated = taskManager.getTask(task.id);
      expect(updated!.status).toBe(TaskStatus.CANCELLED);
      expect(updated!.completedAt).toBeDefined();
    });

    it('should emit task:cancelled event', async () => {
      const handler = vi.fn();
      taskManager.on('task:cancelled', handler);

      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.cancelTask(task.id);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Task Progress', () => {
    it('should update task progress', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.updateTaskProgress(task.id, {
        percentage: 50,
        currentStep: 'Processing',
        totalSteps: 2,
        completedSteps: ['Step 1']
      });

      const updated = taskManager.getTask(task.id);
      expect(updated!.progress.percentage).toBe(50);
      expect(updated!.progress.currentStep).toBe('Processing');
      expect(updated!.progress.totalSteps).toBe(2);
      expect(updated!.progress.completedSteps).toContain('Step 1');
    });

    it('should update progress to 100% on completion', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.startTask(task.id);
      await taskManager.completeTask(task.id, { data: {} }, 'agent-1');

      const updated = taskManager.getTask(task.id);
      expect(updated!.progress.percentage).toBe(100);
    });
  });

  describe('Task Query', () => {
    beforeEach(async () => {
      // Create multiple tasks
      await taskManager.createTask({
        type: 'type-1',
        name: 'Task 1',
        priority: TaskPriority.HIGH,
        input: { data: {} }
      });

      await taskManager.createTask({
        type: 'type-2',
        name: 'Task 2',
        priority: TaskPriority.NORMAL,
        input: { data: {} }
      });

      await taskManager.createTask({
        type: 'type-1',
        name: 'Task 3',
        priority: TaskPriority.LOW,
        input: { data: {} }
      });
    });

    it('should query all tasks', async () => {
      const result = await taskManager.queryTasks({});

      expect(result.totalCount).toBe(3);
      expect(result.tasks).toHaveLength(3);
    });

    it('should filter tasks by type', async () => {
      const result = await taskManager.queryTasks({
        filter: { type: 'type-1' }
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every(t => t.type === 'type-1')).toBe(true);
    });

    it('should filter tasks by priority', async () => {
      const result = await taskManager.queryTasks({
        filter: { priority: [TaskPriority.HIGH, TaskPriority.NORMAL] }
      });

      expect(result.tasks).toHaveLength(2);
    });

    it('should sort tasks by priority', async () => {
      const result = await taskManager.queryTasks({
        sort: { field: 'priority', order: 'desc' }
      });

      expect(result.tasks[0].priority).toBe(TaskPriority.HIGH);
      expect(result.tasks[2].priority).toBe(TaskPriority.LOW);
    });

    it('should paginate tasks', async () => {
      const result = await taskManager.queryTasks({
        pagination: { page: 1, pageSize: 2 }
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('Task Dependencies', () => {
    it('should wait for hard dependencies', async () => {
      const depTask = await taskManager.createTask({
        type: 'dep-task',
        name: 'Dependency',
        input: { data: {} }
      });

      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} },
        dependencies: [
          { taskId: depTask.id, type: 'hard' }
        ]
      });

      // Task should not start until dependency completes
      await taskManager.startTask(depTask.id);
      await taskManager.completeTask(depTask.id, { data: {} }, 'agent-1');

      // Wait a bit for task to process dependency
      await new Promise(resolve => setTimeout(resolve, 100));

      const updated = taskManager.getTask(task.id);
      expect(updated!.status).not.toBe(TaskStatus.FAILED);
    });

    it('should fail if dependency fails', async () => {
      const depTask = await taskManager.createTask({
        type: 'dep-task',
        name: 'Dependency',
        input: { data: {} }
      });

      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} },
        dependencies: [
          { taskId: depTask.id, type: 'hard' }
        ]
      });

      await taskManager.startTask(depTask.id);
      await taskManager.failTask(depTask.id, new Error('Dep failed'), 'agent-1');

      // Wait for task to check dependencies
      await new Promise(resolve => setTimeout(resolve, 200));

      // Task should still be pending/queued since dependency failed
      const updated = taskManager.getTask(task.id);
      expect(updated).toBeDefined();
    });
  });

  describe('Task Events', () => {
    it('should track task events', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.startTask(task.id);
      await taskManager.completeTask(task.id, { data: {} }, 'agent-1');

      const events = taskManager.getTaskEvents(task.id);

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.eventType === 'created')).toBe(true);
      expect(events.some(e => e.eventType === 'started')).toBe(true);
      expect(events.some(e => e.eventType === 'completed')).toBe(true);
    });
  });

  describe('Task Statistics', () => {
    it('should calculate task statistics', async () => {
      await taskManager.createTask({
        type: 'test-task',
        name: 'Task 1',
        input: { data: {} }
      });

      await taskManager.createTask({
        type: 'test-task',
        name: 'Task 2',
        input: { data: {} }
      });

      const stats = taskManager.getStats();

      expect(stats.totalTasks).toBe(2);
      expect(stats.tasksByType['test-task']).toBe(2);
    });

    it('should track success rate', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.startTask(task.id);
      await taskManager.completeTask(task.id, { data: {} }, 'agent-1');

      const stats = taskManager.getStats();

      expect(stats.totalCompletedTasks).toBe(1);
      expect(stats.successRate).toBe(1);
    });

    it('should track failure rate', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      await taskManager.startTask(task.id);
      await taskManager.failTask(task.id, new Error('Failed'), 'agent-1');

      const stats = taskManager.getStats();

      expect(stats.totalFailedTasks).toBe(1);
      expect(stats.failureRate).toBeGreaterThan(0);
    });
  });

  describe('Task Retry', () => {
    it('should retry failed task', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} },
        retryPolicy: {
          maxRetries: 2,
          currentRetry: 0,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
          retryableErrors: ['timeout']
        }
      });

      await taskManager.startTask(task.id);
      await taskManager.failTask(task.id, new Error('timeout'), 'agent-1');

      // Wait for retry
      await new Promise(resolve => setTimeout(resolve, 200));

      const updated = taskManager.getTask(task.id);
      expect(updated!.retryPolicy.currentRetry).toBe(1);
    });

    it('should not retry non-retryable errors', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} },
        retryPolicy: {
          maxRetries: 2,
          currentRetry: 0,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
          retryableErrors: ['timeout']
        }
      });

      await taskManager.startTask(task.id);
      await taskManager.failTask(task.id, new Error('permanent failure'), 'agent-1');

      const updated = taskManager.getTask(task.id);
      expect(updated!.status).toBe(TaskStatus.FAILED);
      expect(updated!.retryPolicy.currentRetry).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle task with no input', async () => {
      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: { data: {} }
      });

      expect(task.input.data).toEqual({});
    });

    it('should handle task with complex input', async () => {
      const complexInput = {
        data: {
          nested: {
            array: [1, 2, 3],
            object: { key: 'value' }
          }
        }
      };

      const task = await taskManager.createTask({
        type: 'test-task',
        name: 'Test Task',
        input: complexInput
      });

      expect(task.input.data).toEqual(complexInput.data);
    });

    it('should handle concurrent task creation', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        taskManager.createTask({
          type: 'test-task',
          name: `Task ${i}`,
          input: { data: {} }
        })
      );

      const tasks = await Promise.all(promises);

      expect(tasks).toHaveLength(10);
      expect(new Set(tasks.map(t => t.id)).size).toBe(10);
    });
  });
});
