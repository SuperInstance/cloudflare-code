/**
 * Integration tests for the scheduler
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JobScheduler } from '../../src/jobs/scheduler';
import { JobMonitor } from '../../src/monitoring/monitor';
import { DependencyManager } from '../../src/dependencies/manager';
import { CronParser } from '../../src/cron/parser';
import { JobStatus, JobPriority, JobDefinition } from '../../src/types';
import { delay } from '../utils/test-helpers';

describe('Scheduler Integration', () => {
  let scheduler: JobScheduler;
  let monitor: JobMonitor;
  let dependencyManager: DependencyManager;

  beforeAll(() => {
    scheduler = new JobScheduler({
      maxConcurrentJobs: 5,
      queueSizeLimit: 50
    });

    monitor = new JobMonitor({
      retentionDays: 1,
      maxHistorySize: 100
    });

    dependencyManager = new DependencyManager({
      enableCascade: true
    });
  });

  afterAll(async () => {
    await scheduler.shutdown();
    monitor.stop();
  });

  describe('End-to-end job execution', () => {
    it('should execute a simple job', async () => {
      let executed = false;

      const definition: JobDefinition = {
        id: 'simple-job',
        name: 'Simple Job',
        handler: async () => {
          executed = true;
          return { success: true };
        }
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('simple-job');

      await delay(200);

      expect(executed).toBe(true);

      const job = scheduler.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
    });

    it('should handle job with dependencies', async () => {
      const executionOrder: string[] = [];

      const job1Def: JobDefinition = {
        id: 'job1',
        name: 'Job 1',
        handler: async () => {
          executionOrder.push('job1');
          return { result: 'job1' };
        }
      };

      const job2Def: JobDefinition = {
        id: 'job2',
        name: 'Job 2',
        handler: async () => {
          executionOrder.push('job2');
          return { result: 'job2' };
        },
        dependencies: ['job1']
      };

      scheduler.registerJob(job1Def);
      scheduler.registerJob(job2Def);

      const job1Id = scheduler.enqueueJob('job1');
      const job2Id = scheduler.enqueueJob('job2');

      await delay(500);

      expect(executionOrder).toEqual(['job1', 'job2']);
    });

    it('should retry failed jobs', async () => {
      let attempts = 0;

      const definition: JobDefinition = {
        id: 'retry-job',
        name: 'Retry Job',
        handler: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Not ready yet');
          }
          return { success: true };
        },
        retryPolicy: {
          maxRetries: 5,
          initialDelay: 50,
          maxDelay: 500,
          backoffMultiplier: 2
        }
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('retry-job');

      await delay(1000);

      const job = scheduler.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
      expect(attempts).toBe(3);
    });

    it('should enforce job timeouts', async () => {
      const definition: JobDefinition = {
        id: 'timeout-job',
        name: 'Timeout Job',
        handler: async () => {
          await delay(5000);
          return { success: true };
        },
        timeout: {
          duration: 100,
          strategy: 'kill'
        }
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('timeout-job');

      await delay(300);

      const job = scheduler.getJob(jobId);
      expect(job?.status).toBe(JobStatus.TIMEOUT);
    }, 10000);
  });

  describe('Cron scheduling', () => {
    it('should parse and validate cron expressions', () => {
      const validation = CronParser.validate('0 9 * * *');
      expect(validation.valid).toBe(true);
    });

    it('should calculate next execution time', () => {
      const from = new Date('2024-01-01T08:00:00Z');
      const next = CronParser.nextExecution('0 9 * * *', from);

      expect(next.timestamp.getHours()).toBe(9);
      expect(next.timestamp.getMinutes()).toBe(0);
    });

    it('should generate human-readable descriptions', () => {
      const desc = CronParser.describe('0 9 * * *');
      expect(desc.description).toContain('09:00');
    });

    it('should match cron expressions', () => {
      const time = new Date('2024-01-01T09:00:00Z');
      expect(CronParser.matches('0 9 * * *', time)).toBe(true);
      expect(CronParser.matches('30 9 * * *', time)).toBe(false);
    });
  });

  describe('Job monitoring', () => {
    it('should track job execution', async () => {
      const definition: JobDefinition = {
        id: 'monitored-job',
        name: 'Monitored Job',
        handler: async () => {
          return { success: true };
        }
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('monitored-job');

      // Track job in monitor
      const job = scheduler.getJob(jobId);
      if (job) {
        monitor.trackJob(job);
        monitor.updateJobStatus(jobId, JobStatus.RUNNING);
      }

      await delay(200);

      if (job) {
        monitor.updateJobStatus(jobId, JobStatus.COMPLETED);
      }

      const metrics = monitor.getSchedulingMetrics();
      expect(metrics.totalJobs).toBeGreaterThan(0);
    });

    it('should collect job logs', async () => {
      const definition: JobDefinition = {
        id: 'logging-job',
        name: 'Logging Job',
        handler: async (context) => {
          context.logger.info('Job started');
          context.logger.info('Job in progress');
          context.logger.info('Job completed');
          return { success: true };
        }
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('logging-job');

      await delay(200);

      const logs = monitor.getJobLogs(jobId);
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Dependency management', () => {
    it('should resolve job dependencies', () => {
      const job1Def: JobDefinition = {
        id: 'dep-job1',
        name: 'Dependency Job 1',
        handler: async () => ({ result: 'job1' })
      };

      const job2Def: JobDefinition = {
        id: 'dep-job2',
        name: 'Dependency Job 2',
        handler: async () => ({ result: 'job2' }),
        dependencies: ['dep-job1']
      };

      scheduler.registerJob(job1Def);
      scheduler.registerJob(job2Def);

      const job1Id = scheduler.enqueueJob('dep-job1');

      // Add to dependency manager
      const job1 = scheduler.getJob(job1Id);
      if (job1) {
        dependencyManager.addJob(job1);
      }

      const job2 = scheduler.getJob(scheduler.enqueueJob('dep-job2'));
      if (job2) {
        dependencyManager.addJob(job2);
        dependencyManager.updateJobStatus(job1Id, JobStatus.COMPLETED);

        const satisfied = dependencyManager.areDependenciesSatisfied(job2.id);
        expect(satisfied).toBe(true);
      }
    });

    it('should detect circular dependencies', () => {
      const job1Def: JobDefinition = {
        id: 'circular-job1',
        name: 'Circular Job 1',
        handler: async () => ({ result: 'job1' }),
        dependencies: ['circular-job2']
      };

      const job2Def: JobDefinition = {
        id: 'circular-job2',
        name: 'Circular Job 2',
        handler: async () => ({ result: 'job2' }),
        dependencies: ['circular-job1']
      };

      scheduler.registerJob(job1Def);
      scheduler.registerJob(job2Def);

      const job1Id = scheduler.enqueueJob('circular-job1');
      const job2Id = scheduler.enqueueJob('circular-job2');

      const job1 = scheduler.getJob(job1Id);
      const job2 = scheduler.getJob(job2Id);

      if (job1 && job2) {
        dependencyManager.addJob(job1);
        dependencyManager.addJob(job2);

        const cycles = dependencyManager.detectCircularDependencies();
        expect(cycles.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance tests', () => {
    it('should handle multiple concurrent jobs', async () => {
      let completed = 0;

      const definition: JobDefinition = {
        id: 'concurrent-job',
        name: 'Concurrent Job',
        handler: async () => {
          await delay(50);
          completed++;
          return { success: true };
        }
      };

      scheduler.registerJob(definition);

      const jobIds = [];
      for (let i = 0; i < 20; i++) {
        jobIds.push(scheduler.enqueueJob('concurrent-job'));
      }

      await delay(1000);

      expect(completed).toBe(20);
    }, 15000);

    it('should maintain scheduling accuracy', async () => {
      const executionTimes: number[] = [];

      const definition: JobDefinition = {
        id: 'timed-job',
        name: 'Timed Job',
        handler: async () => {
          executionTimes.push(Date.now());
          return { success: true };
        }
      };

      scheduler.registerJob(definition);

      const start = Date.now();
      scheduler.enqueueJob('timed-job');

      await delay(100);

      const executionTime = executionTimes[0] - start;
      expect(executionTime).toBeLessThan(500); // Should execute within 500ms
    });
  });

  describe('Error handling', () => {
    it('should handle job errors gracefully', async () => {
      const definition: JobDefinition = {
        id: 'error-job',
        name: 'Error Job',
        handler: async () => {
          throw new Error('Intentional error');
        },
        retryPolicy: {
          maxRetries: 0,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2
        }
      };

      scheduler.registerJob(definition);
      const jobId = scheduler.enqueueJob('error-job');

      await delay(200);

      const job = scheduler.getJob(jobId);
      expect(job?.status).toBe(JobStatus.FAILED);
      expect(job?.error).toBeDefined();
    });

    it('should cancel jobs on shutdown', async () => {
      const definition: JobDefinition = {
        id: 'shutdown-job',
        name: 'Shutdown Job',
        handler: async () => {
          await delay(5000);
          return { success: true };
        }
      };

      scheduler.registerJob(definition);
      scheduler.enqueueJob('shutdown-job');

      await delay(50);

      const statsBefore = scheduler.getStats();
      expect(statsBefore.runningJobs + statsBefore.queuedJobs).toBeGreaterThan(0);

      await scheduler.shutdown();

      const statsAfter = scheduler.getStats();
      expect(statsAfter.runningJobs).toBe(0);
    });
  });
});
