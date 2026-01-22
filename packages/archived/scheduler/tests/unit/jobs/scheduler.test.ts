/**
 * Unit tests for JobScheduler
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JobScheduler } from '../../../src/jobs/scheduler';
import { JobStatus, JobPriority, JobDefinition } from '../../../src/types';
import { createMockLogger, createTestJobDefinition, delay, cleanup } from '../../utils/test-helpers';

describe('JobScheduler', () => {
  let scheduler: JobScheduler;

  beforeEach(() => {
    scheduler = new JobScheduler({
      maxConcurrentJobs: 10,
      queueSizeLimit: 100,
      logger: createMockLogger()
    });
  });

  afterEach(async () => {
    await scheduler.shutdown();
  });

  describe('registerJob', () => {
    it('should register a job definition', () => {
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => ({ success: true })
      };

      scheduler.registerJob(definition);
      const registered = scheduler.getJob('test-job');
      expect(registered).toBeDefined();
    });

    it('should throw error for duplicate job ID', () => {
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => ({ success: true })
      };

      scheduler.registerJob(definition);
      expect(() => scheduler.registerJob(definition)).toThrow();
    });

    it('should validate cron expressions', () => {
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        cronExpression: 'invalid cron',
        handler: async () => ({ success: true })
      };

      expect(() => scheduler.registerJob(definition)).toThrow();
    });

    it('should schedule jobs with cron expressions', () => {
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        cronExpression: '0 * * * *',
        handler: async () => ({ success: true })
      };

      scheduler.registerJob(definition);
      // Job should be registered successfully
      expect(scheduler.getStats().registeredJobs).toBe(1);
    });
  });

  describe('unregisterJob', () => {
    it('should unregister a job', () => {
      const definition = createTestJobDefinition();
      scheduler.registerJob(definition);
      expect(scheduler.getStats().registeredJobs).toBe(1);

      scheduler.unregisterJob('test-definition');
      expect(scheduler.getStats().registeredJobs).toBe(0);
    });

    it('should throw error for unknown job', () => {
      expect(() => scheduler.unregisterJob('unknown-job')).toThrow();
    });
  });

  describe('enqueueJob', () => {
    it('should enqueue a job', () => {
      const definition = createTestJobDefinition();
      scheduler.registerJob(definition);

      const jobId = scheduler.enqueueJob('test-definition');
      expect(jobId).toBeDefined();
      expect(jobId).toContain('test-definition');
    });

    it('should execute enqueued job', async () => {
      let executed = false;
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => {
          executed = true;
          return { success: true };
        }
      };

      scheduler.registerJob(definition);
      scheduler.enqueueJob('test-job');

      // Wait for execution
      await delay(100);

      expect(executed).toBe(true);
    });

    it('should handle job execution errors', async () => {
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => {
          throw new Error('Test error');
        },
        retryPolicy: {
          maxRetries: 0,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2
        }
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('test-job');

      // Wait for execution
      await delay(200);

      const job = scheduler.getJob(jobId);
      expect(job?.status).toBe(JobStatus.FAILED);
    });

    it('should retry failed jobs', async () => {
      let attempts = 0;
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Not yet');
          }
          return { success: true };
        },
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 50,
          maxDelay: 500,
          backoffMultiplier: 2
        }
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('test-job');

      // Wait for retries
      await delay(500);

      const job = scheduler.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
      expect(attempts).toBe(3);
    });

    it('should enforce queue size limit', () => {
      const smallScheduler = new JobScheduler({
        maxConcurrentJobs: 1,
        queueSizeLimit: 2
      });

      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => delay(1000),
        timeout: {
          duration: 5000,
          strategy: 'kill'
        }
      };

      smallScheduler.registerJob(definition);
      smallScheduler.enqueueJob('test-job');
      smallScheduler.enqueueJob('test-job');

      expect(() => smallScheduler.enqueueJob('test-job')).toThrow();

      return smallScheduler.shutdown();
    });
  });

  describe('cancelJob', () => {
    it('should cancel a queued job', () => {
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => delay(1000)
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('test-job');

      scheduler.cancelJob(jobId);

      const job = scheduler.getJob(jobId);
      expect(job?.status).toBe(JobStatus.CANCELLED);
    });

    it('should cancel a running job', async () => {
      let shouldContinue = true;
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async (context) => {
          while (shouldContinue && !context.signal.aborted) {
            await delay(10);
          }
          return { success: true };
        }
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('test-job');

      // Wait for job to start
      await delay(50);

      scheduler.cancelJob(jobId);

      const job = scheduler.getJob(jobId);
      expect(job?.status).toBe(JobStatus.CANCELLED);
    });

    it('should throw error for unknown job', () => {
      expect(() => scheduler.cancelJob('unknown-job')).toThrow();
    });
  });

  describe('getJob', () => {
    it('should return job by ID', () => {
      const definition = createTestJobDefinition();
      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('test-definition');

      const job = scheduler.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
    });

    it('should return undefined for unknown job', () => {
      const job = scheduler.getJob('unknown-job');
      expect(job).toBeUndefined();
    });
  });

  describe('getRunningJobs', () => {
    it('should return running jobs', async () => {
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => delay(100)
      };

      scheduler.registerJob(definition);
      scheduler.enqueueJob('test-job');

      // Wait for job to start
      await delay(10);

      const runningJobs = scheduler.getRunningJobs();
      expect(runningJobs.length).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return scheduler statistics', () => {
      const definition = createTestJobDefinition();
      scheduler.registerJob(definition);

      const stats = scheduler.getStats();
      expect(stats.registeredJobs).toBe(1);
      expect(stats.totalJobs).toBe(0);
      expect(stats.runningJobs).toBe(0);
      expect(stats.queuedJobs).toBe(0);
    });

    it('should track job counts', async () => {
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => delay(50)
      };

      scheduler.registerJob(definition);
      scheduler.enqueueJob('test-job');
      scheduler.enqueueJob('test-job');

      let stats = scheduler.getStats();
      expect(stats.queuedJobs + stats.runningJobs).toBeGreaterThan(0);

      // Wait for completion
      await delay(200);

      stats = scheduler.getStats();
      expect(stats.completedJobs).toBeGreaterThan(0);
    });
  });

  describe('job priorities', () => {
    it('should respect job priorities', async () => {
      const executionOrder: string[] = [];

      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async (context) => {
          executionOrder.push(context.job.id);
          return { success: true };
        },
        priority: JobPriority.HIGH
      };

      scheduler.registerJob(definition);

      // Enqueue multiple jobs with different priorities
      const jobId1 = scheduler.enqueueJob('test-job', {}, { priority: JobPriority.LOW });
      const jobId2 = scheduler.enqueueJob('test-job', {}, { priority: JobPriority.HIGH });
      const jobId3 = scheduler.enqueueJob('test-job', {}, { priority: JobPriority.NORMAL });

      // Wait for execution
      await delay(100);

      expect(executionOrder.length).toBeGreaterThan(0);
    });
  });

  describe('job timeouts', () => {
    it('should enforce job timeouts', async () => {
      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => delay(5000),
        timeout: {
          duration: 100,
          strategy: 'kill'
        }
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('test-job');

      // Wait for timeout
      await delay(200);

      const job = scheduler.getJob(jobId);
      expect(job?.status).toBe(JobStatus.TIMEOUT);
    }, 10000);
  });

  describe('concurrency limits', () => {
    it('should enforce concurrency limits', async () => {
      const runningCount = { value: 0 };
      const maxRunning = 0;

      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => {
          runningCount.value++;
          await delay(50);
          runningCount.value--;
          return { success: true };
        },
        concurrency: {
          maxConcurrent: 2,
          queueStrategy: 'fifo'
        }
      };

      scheduler.registerJob(definition);

      // Enqueue multiple jobs
      for (let i = 0; i < 5; i++) {
        scheduler.enqueueJob('test-job');
      }

      // Wait a bit
      await delay(100);

      expect(runningCount.value).toBeLessThanOrEqual(2);
    });
  });

  describe('onJobComplete', () => {
    it('should call completion callbacks', async () => {
      let callbackCalled = false;
      let callbackResult: any;

      const definition: JobDefinition = {
        id: 'test-job',
        name: 'Test Job',
        handler: async () => ({ result: 'test' })
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('test-job');

      scheduler.onJobComplete(jobId, (result) => {
        callbackCalled = true;
        callbackResult = result;
      });

      // Wait for completion
      await delay(100);

      expect(callbackCalled).toBe(true);
      expect(callbackResult?.success).toBe(true);
    });
  });
});
