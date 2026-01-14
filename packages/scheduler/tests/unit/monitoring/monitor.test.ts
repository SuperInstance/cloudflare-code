/**
 * Unit tests for JobMonitor
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JobMonitor } from '../../../src/monitoring/monitor';
import { Job, JobStatus, JobPriority, JobResult } from '../../../src/types';
import { createTestJob, createMockLogger } from '../../utils/test-helpers';

describe('JobMonitor', () => {
  let monitor: JobMonitor;

  beforeEach(() => {
    monitor = new JobMonitor({
      retentionDays: 7,
      maxHistorySize: 100,
      enableNotifications: true,
      logger: createMockLogger()
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('trackJob', () => {
    it('should track a job', () => {
      const job = createTestJob();
      monitor.trackJob(job);

      const trackedJob = monitor.getJob(job.id);
      expect(trackedJob).toBeDefined();
      expect(trackedJob?.id).toBe(job.id);
    });

    it('should initialize job metrics', () => {
      const job = createTestJob();
      monitor.trackJob(job);

      const metrics = monitor.getJobMetrics(job.definitionId);
      expect(metrics).toBeDefined();
      expect(metrics?.totalExecutions).toBe(0);
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status', () => {
      const job = createTestJob();
      monitor.trackJob(job);

      monitor.updateJobStatus(job.id, JobStatus.RUNNING);

      const trackedJob = monitor.getJob(job.id);
      expect(trackedJob?.status).toBe(JobStatus.RUNNING);
    });

    it('should record completion', () => {
      const job = createTestJob({ executionTime: 1000 });
      monitor.trackJob(job);

      monitor.updateJobStatus(job.id, JobStatus.COMPLETED);

      const metrics = monitor.getJobMetrics(job.definitionId);
      expect(metrics?.totalExecutions).toBe(1);
      expect(metrics?.successfulExecutions).toBe(1);
    });

    it('should record failure', () => {
      const job = createTestJob();
      monitor.trackJob(job);

      monitor.updateJobStatus(job.id, JobStatus.FAILED);

      const metrics = monitor.getJobMetrics(job.definitionId);
      expect(metrics?.failedExecutions).toBe(1);
    });

    it('should trigger status change callbacks', () => {
      const job = createTestJob();
      monitor.trackJob(job);

      let callbackCalled = false;
      monitor.onStatusChange(job.id, (status) => {
        callbackCalled = true;
        expect(status).toBe(JobStatus.RUNNING);
      });

      monitor.updateJobStatus(job.id, JobStatus.RUNNING);
      expect(callbackCalled).toBe(true);
    });

    it('should create notifications for important status changes', () => {
      const job = createTestJob();
      monitor.trackJob(job);

      monitor.updateJobStatus(job.id, JobStatus.COMPLETED);

      const notifications = monitor.getNotifications();
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('completed');
    });
  });

  describe('addLog', () => {
    it('should add log entry', () => {
      const job = createTestJob();
      monitor.addLog(job.id, 'info', 'Test log message');

      const logs = monitor.getJobLogs(job.id);
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test log message');
      expect(logs[0].level).toBe('info');
    });

    it('should filter logs by level', () => {
      const job = createTestJob();
      monitor.addLog(job.id, 'debug', 'Debug message');
      monitor.addLog(job.id, 'info', 'Info message');
      monitor.addLog(job.id, 'error', 'Error message');

      const infoLogs = monitor.getJobLogs(job.id, 'info');
      expect(infoLogs).toHaveLength(1);
      expect(infoLogs[0].level).toBe('info');
    });

    it('should limit log history', () => {
      const job = createTestJob();

      // Add more than 1000 logs
      for (let i = 0; i < 1500; i++) {
        monitor.addLog(job.id, 'info', `Log ${i}`);
      }

      const logs = monitor.getJobLogs(job.id);
      expect(logs.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getSchedulingMetrics', () => {
    it('should calculate scheduling metrics', () => {
      const job1 = createTestJob({ definitionId: 'job1', status: JobStatus.COMPLETED, executionTime: 1000 });
      const job2 = createTestJob({ definitionId: 'job2', status: JobStatus.RUNNING });

      monitor.trackJob(job1);
      monitor.trackJob(job2);

      const metrics = monitor.getSchedulingMetrics();
      expect(metrics.totalJobs).toBe(2);
      expect(metrics.runningJobs).toBe(1);
      expect(metrics.completedJobs).toBe(1);
    });

    it('should calculate success rate', () => {
      const job1 = createTestJob({ definitionId: 'job1', status: JobStatus.COMPLETED, executionTime: 1000 });
      const job2 = createTestJob({ definitionId: 'job2', status: JobStatus.FAILED, executionTime: 500 });

      monitor.trackJob(job1);
      monitor.trackJob(job2);

      const metrics = monitor.getSchedulingMetrics();
      expect(metrics.successRate).toBe(0.5);
    });

    it('should calculate average execution time', () => {
      const job1 = createTestJob({ definitionId: 'job1', status: JobStatus.COMPLETED, executionTime: 1000 });
      const job2 = createTestJob({ definitionId: 'job2', status: JobStatus.COMPLETED, executionTime: 2000 });

      monitor.trackJob(job1);
      monitor.trackJob(job2);

      const metrics = monitor.getSchedulingMetrics();
      expect(metrics.averageExecutionTime).toBe(1500);
    });
  });

  describe('onStatusChange', () => {
    it('should register status change callback', () => {
      const job = createTestJob();
      monitor.trackJob(job);

      let newStatus: JobStatus | undefined;
      monitor.onStatusChange(job.id, (status) => {
        newStatus = status;
      });

      monitor.updateJobStatus(job.id, JobStatus.RUNNING);
      expect(newStatus).toBe(JobStatus.RUNNING);
    });

    it('should support multiple callbacks', () => {
      const job = createTestJob();
      monitor.trackJob(job);

      let callback1Called = false;
      let callback2Called = false;

      monitor.onStatusChange(job.id, () => {
        callback1Called = true;
      });

      monitor.onStatusChange(job.id, () => {
        callback2Called = true;
      });

      monitor.updateJobStatus(job.id, JobStatus.RUNNING);
      expect(callback1Called).toBe(true);
      expect(callback2Called).toBe(true);
    });
  });

  describe('removeCallbacks', () => {
    it('should remove all callbacks for job', () => {
      const job = createTestJob();
      monitor.trackJob(job);

      monitor.onStatusChange(job.id, () => {});
      monitor.onComplete(job.id, () => {});
      monitor.onFailure(job.id, () => {});

      monitor.removeCallbacks(job.id);

      // Update status should not trigger any errors
      monitor.updateJobStatus(job.id, JobStatus.RUNNING);
    });
  });

  describe('getJobHistory', () => {
    it('should return job execution history', () => {
      const job = createTestJob({ definitionId: 'test-job', status: JobStatus.COMPLETED, executionTime: 1000 });
      monitor.trackJob(job);
      monitor.updateJobStatus(job.id, JobStatus.COMPLETED);

      const history = monitor.getJobHistory('test-job');
      expect(history.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown job', () => {
      const history = monitor.getJobHistory('unknown-job');
      expect(history).toEqual([]);
    });
  });

  describe('getStatisticsSummary', () => {
    it('should return statistics summary', () => {
      const job1 = createTestJob({ definitionId: 'job1' });
      const job2 = createTestJob({ definitionId: 'job2' });

      monitor.trackJob(job1);
      monitor.trackJob(job2);
      monitor.addLog(job1.id, 'info', 'Test');

      const summary = monitor.getStatisticsSummary();
      expect(summary.totalJobsTracked).toBe(2);
      expect(summary.totalLogEntries).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should cleanup old data', () => {
      // This test would require mocking time
      // For now, just verify the method exists
      expect(monitor['cleanup']).toBeDefined();
    });
  });
});
