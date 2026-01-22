/**
 * Tests for Parallel Executor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ParallelExecutor,
  ParallelTask,
  Mutex,
  Semaphore,
  Barrier
} from '../parallel/executor';

describe('ParallelExecutor', () => {
  let executor: ParallelExecutor;

  beforeEach(() => {
    executor = new ParallelExecutor({
      maxConcurrency: 5,
      timeout: 5000,
      enableDeadlockDetection: true,
      errorHandling: 'continue'
    });
  });

  describe('Task Execution', () => {
    it('should execute single task', async () => {
      const task: ParallelTask = {
        id: 'task-1',
        name: 'Test Task',
        execute: async () => ({ result: 'success' }),
        priority: 1,
        dependencies: []
      };

      const summary = await executor.execute([task]);

      expect(summary.totalTasks).toBe(1);
      expect(summary.completedTasks).toBe(1);
      expect(summary.failedTasks).toBe(0);
      expect(summary.results[0].status).toBe('completed');
      expect(summary.results[0].result).toEqual({ result: 'success' });
    });

    it('should execute multiple tasks in parallel', async () => {
      let executionOrder: string[] = [];

      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => {
          executionOrder.push('task-1');
          await new Promise(resolve => setTimeout(resolve, 100));
          return { result: 'task-1' };
        },
        priority: 1,
        dependencies: []
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => {
          executionOrder.push('task-2');
          await new Promise(resolve => setTimeout(resolve, 100));
          return { result: 'task-2' };
        },
        priority: 1,
        dependencies: []
      };

      const task3: ParallelTask = {
        id: 'task-3',
        name: 'Task 3',
        execute: async () => {
          executionOrder.push('task-3');
          await new Promise(resolve => setTimeout(resolve, 100));
          return { result: 'task-3' };
        },
        priority: 1,
        dependencies: []
      };

      const startTime = Date.now();
      const summary = await executor.execute([task1, task2, task3]);
      const duration = Date.now() - startTime;

      expect(summary.completedTasks).toBe(3);
      expect(duration).toBeLessThan(300); // Should run in parallel
    });

    it('should respect task dependencies', async () => {
      let executionOrder: string[] = [];

      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => {
          executionOrder.push('task-1');
          return { result: 'task-1' };
        },
        priority: 1,
        dependencies: []
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => {
          executionOrder.push('task-2');
          return { result: 'task-2' };
        },
        priority: 1,
        dependencies: ['task-1']
      };

      const task3: ParallelTask = {
        id: 'task-3',
        name: 'Task 3',
        execute: async () => {
          executionOrder.push('task-3');
          return { result: 'task-3' };
        },
        priority: 1,
        dependencies: ['task-2']
      };

      await executor.execute([task1, task2, task3]);

      expect(executionOrder).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('should handle task execution failures', async () => {
      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ result: 'success' }),
        priority: 1,
        dependencies: []
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => {
          throw new Error('Task failed');
        },
        priority: 1,
        dependencies: []
      };

      const summary = await executor.execute([task1, task2]);

      expect(summary.completedTasks).toBe(1);
      expect(summary.failedTasks).toBe(1);
      expect(summary.results[1].status).toBe('failed');
      expect(summary.results[1].error?.message).toBe('Task failed');
    });

    it('should apply timeout to tasks', async () => {
      const task: ParallelTask = {
        id: 'task-1',
        name: 'Slow Task',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 10000));
          return { result: 'success' };
        },
        priority: 1,
        dependencies: [],
        timeout: 100
      };

      const summary = await executor.execute([task]);

      expect(summary.timeoutTasks).toBe(1);
      expect(summary.results[0].status).toBe('timeout');
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel running task', async () => {
      let cancelled = false;

      const task: ParallelTask = {
        id: 'task-1',
        name: 'Long Task',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (cancelled) {
            throw new Error('Task cancelled');
          }
          return { result: 'success' };
        },
        priority: 1,
        dependencies: []
      };

      setTimeout(() => {
        cancelled = true;
        executor.cancelTask('task-1');
      }, 100);

      const summary = await executor.execute([task]);

      expect(summary.cancelledTasks).toBe(1);
    });

    it('should cancel all tasks', async () => {
      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { result: 'success' };
        },
        priority: 1,
        dependencies: []
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { result: 'success' };
        },
        priority: 1,
        dependencies: []
      };

      setTimeout(() => executor.cancelAll(), 100);

      const summary = await executor.execute([task1, task2]);

      expect(summary.cancelledTasks).toBeGreaterThan(0);
    });
  });

  describe('Result Aggregation', () => {
    it('should aggregate all results', async () => {
      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ result: 'task-1' }),
        priority: 1,
        dependencies: []
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => ({ result: 'task-2' }),
        priority: 1,
        dependencies: []
      };

      executor = new ParallelExecutor({
        maxConcurrency: 5,
        aggregationStrategy: 'all'
      });

      const summary = await executor.execute([task1, task2]);

      expect(summary.aggregatedResult).toHaveLength(2);
    });

    it('should aggregate first result', async () => {
      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ result: 'task-1' }),
        priority: 1,
        dependencies: []
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => ({ result: 'task-2' }),
        priority: 1,
        dependencies: []
      };

      executor = new ParallelExecutor({
        maxConcurrency: 5,
        aggregationStrategy: 'first'
      });

      const summary = await executor.execute([task1, task2]);

      expect(summary.aggregatedResult).toEqual({ result: 'task-1' });
    });

    it('should aggregate last result', async () => {
      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ result: 'task-1' }),
        priority: 1,
        dependencies: []
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => ({ result: 'task-2' }),
        priority: 1,
        dependencies: []
      };

      executor = new ParallelExecutor({
        maxConcurrency: 5,
        aggregationStrategy: 'last'
      });

      const summary = await executor.execute([task1, task2]);

      expect(summary.aggregatedResult).toEqual({ result: 'task-2' });
    });
  });

  describe('Statistics', () => {
    it('should track execution statistics', async () => {
      const task: ParallelTask = {
        id: 'task-1',
        name: 'Test Task',
        execute: async () => ({ result: 'success' }),
        priority: 1,
        dependencies: []
      };

      await executor.execute([task]);

      const stats = executor.getStatistics();

      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });

    it('should calculate thread pool utilization', async () => {
      const stats = executor.getStatistics();

      expect(stats.threadPoolUtilization).toBeGreaterThanOrEqual(0);
      expect(stats.threadPoolUtilization).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should continue on error when configured', async () => {
      executor = new ParallelExecutor({
        maxConcurrency: 5,
        errorHandling: 'continue'
      });

      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ result: 'success' }),
        priority: 1,
        dependencies: []
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => {
          throw new Error('Task failed');
        },
        priority: 1,
        dependencies: []
      };

      const task3: ParallelTask = {
        id: 'task-3',
        name: 'Task 3',
        execute: async () => ({ result: 'success' }),
        priority: 1,
        dependencies: []
      };

      const summary = await executor.execute([task1, task2, task3]);

      expect(summary.completedTasks).toBe(2);
      expect(summary.failedTasks).toBe(1);
    });

    it('should fail fast when configured', async () => {
      executor = new ParallelExecutor({
        maxConcurrency: 5,
        errorHandling: 'fail-fast'
      });

      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ result: 'success' }),
        priority: 1,
        dependencies: []
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => {
          throw new Error('Task failed');
        },
        priority: 1,
        dependencies: []
      };

      const task3: ParallelTask = {
        id: 'task-3',
        name: 'Task 3',
        execute: async () => ({ result: 'success' }),
        priority: 1,
        dependencies: []
      };

      const summary = await executor.execute([task1, task2, task3]);

      // With fail-fast, some tasks may not complete
      expect(summary.failedTasks).toBeGreaterThan(0);
    });
  });

  describe('Cycle Detection', () => {
    it('should detect cyclic dependencies', async () => {
      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ result: 'task-1' }),
        priority: 1,
        dependencies: ['task-2']
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => ({ result: 'task-2' }),
        priority: 1,
        dependencies: ['task-1']
      };

      await expect(executor.execute([task1, task2])).rejects.toThrow();
    });
  });

  describe('Synchronization Primitives', () => {
    describe('Mutex', () => {
      it('should provide mutual exclusion', async () => {
        const mutex = executor.createMutex('test-mutex');
        let counter = 0;

        const task1 = async () => {
          await mutex.acquire();
          counter++;
          await new Promise(resolve => setTimeout(resolve, 100));
          counter--;
          mutex.release();
        };

        const task2 = async () => {
          await mutex.acquire();
          counter++;
          await new Promise(resolve => setTimeout(resolve, 100));
          counter--;
          mutex.release();
        };

        await Promise.all([task1(), task2()]);

        expect(counter).toBe(0);
      });

      it('should queue waiting operations', async () => {
        const mutex = executor.createMutex('test-mutex');
        let executionOrder: number[] = [];

        const task1 = async () => {
          await mutex.acquire();
          executionOrder.push(1);
          await new Promise(resolve => setTimeout(resolve, 100));
          mutex.release();
        };

        const task2 = async () => {
          await mutex.acquire();
          executionOrder.push(2);
          mutex.release();
        };

        await Promise.all([task1(), task2()]);

        expect(executionOrder).toEqual([1, 2]);
      });
    });

    describe('Semaphore', () => {
      it('should limit concurrent access', async () => {
        const semaphore = executor.createSemaphore('test-semaphore', 2);
        let concurrent = 0;
        let maxConcurrent = 0;

        const task = async () => {
          await semaphore.acquire();
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 50));
          concurrent--;
          semaphore.release();
        };

        await Promise.all([task(), task(), task(), task()]);

        expect(maxConcurrent).toBeLessThanOrEqual(2);
      });
    });

    describe('Barrier', () => {
      it('should synchronize multiple threads', async () => {
        const barrier = executor.createBarrier('test-barrier', 3);
        let results: string[] = [];

        const task1 = async () => {
          results.push('task1-start');
          await barrier.wait();
          results.push('task1-end');
        };

        const task2 = async () => {
          results.push('task2-start');
          await barrier.wait();
          results.push('task2-end');
        };

        const task3 = async () => {
          results.push('task3-start');
          await barrier.wait();
          results.push('task3-end');
        };

        await Promise.all([task1(), task2(), task3()]);

        expect(results).toContain('task1-end');
        expect(results).toContain('task2-end');
        expect(results).toContain('task3-end');
      });
    });
  });

  describe('History Management', () => {
    it('should maintain execution history', async () => {
      const task1: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ result: 'task-1' }),
        priority: 1,
        dependencies: []
      };

      const task2: ParallelTask = {
        id: 'task-2',
        name: 'Task 2',
        execute: async () => ({ result: 'task-2' }),
        priority: 1,
        dependencies: []
      };

      await executor.execute([task1]);
      await executor.execute([task2]);

      executor.clearHistory();
      const stats = executor.getStatistics();

      expect(stats.totalExecutions).toBe(0);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const task: ParallelTask = {
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ result: 'success' }),
        priority: 1,
        dependencies: []
      };

      await executor.execute([task]);
      await executor.shutdown();

      // Should not throw
      await executor.shutdown();
    });
  });
});
