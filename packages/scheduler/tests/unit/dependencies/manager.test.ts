/**
 * Unit tests for DependencyManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyManager } from '../../../src/dependencies/manager';
import { Job, JobStatus, JobResult } from '../../../src/types';
import { createTestJob, createMockLogger } from '../../utils/test-helpers';

describe('DependencyManager', () => {
  let manager: DependencyManager;

  beforeEach(() => {
    manager = new DependencyManager({
      enableCascade: true,
      maxDepth: 100,
      logger: createMockLogger()
    });
  });

  describe('addJob', () => {
    it('should add job to dependency graph', () => {
      const job = createTestJob({ id: 'job1' });
      manager.addJob(job);

      const graph = manager.getDependencyGraph();
      expect(graph.nodes.has('job1')).toBe(true);
    });

    it('should initialize dependency edges', () => {
      const job = createTestJob({
        id: 'job1',
        dependencies: ['job2', 'job3']
      });
      manager.addJob(job);

      const edges = manager.getDependencyGraph().edges.get('job1');
      expect(edges).toBeDefined();
      expect(edges!.has('job2')).toBe(true);
      expect(edges!.has('job3')).toBe(true);
    });
  });

  describe('removeJob', () => {
    it('should remove job from graph', () => {
      const job = createTestJob({ id: 'job1' });
      manager.addJob(job);
      manager.removeJob('job1');

      const graph = manager.getDependencyGraph();
      expect(graph.nodes.has('job1')).toBe(false);
    });

    it('should update dependent jobs', () => {
      const job1 = createTestJob({ id: 'job1' });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);

      manager.removeJob('job1');

      const edges = manager.getDependencyGraph().edges.get('job2');
      expect(edges!.has('job1')).toBe(false);
    });
  });

  describe('addDependency', () => {
    it('should add dependency relationship', () => {
      const job1 = createTestJob({ id: 'job1' });
      const job2 = createTestJob({ id: 'job2' });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addDependency('job2', 'job1', 'hard');

      const edges = manager.getDependencyGraph().edges.get('job2');
      expect(edges!.has('job1')).toBe(true);
    });

    it('should update reverse edges', () => {
      const job1 = createTestJob({ id: 'job1' });
      const job2 = createTestJob({ id: 'job2' });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addDependency('job2', 'job1', 'hard');

      const reverseEdges = manager.getDependencyGraph().reverseEdges.get('job1');
      expect(reverseEdges!.has('job2')).toBe(true);
    });

    it('should throw error for unknown job', () => {
      expect(() => {
        manager.addDependency('unknown-job', 'job1', 'hard');
      }).toThrow();
    });
  });

  describe('removeDependency', () => {
    it('should remove dependency relationship', () => {
      const job1 = createTestJob({ id: 'job1' });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.removeDependency('job2', 'job1');

      const edges = manager.getDependencyGraph().edges.get('job2');
      expect(edges!.has('job1')).toBe(false);
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status', () => {
      const job = createTestJob({ id: 'job1' });
      manager.addJob(job);
      manager.updateJobStatus('job1', JobStatus.RUNNING);

      expect(manager['jobStatuses'].get('job1')).toBe(JobStatus.RUNNING);
    });

    it('should cascade failures for hard dependencies', () => {
      const job1 = createTestJob({ id: 'job1', status: JobStatus.PENDING });
      const job2 = createTestJob({ id: 'job2', status: JobStatus.PENDING, dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addDependency('job2', 'job1', 'hard');

      manager.updateJobStatus('job1', JobStatus.FAILED);

      expect(manager['jobStatuses'].get('job2')).toBe(JobStatus.CANCELLED);
    });

    it('should not cascade failures for soft dependencies', () => {
      const job1 = createTestJob({ id: 'job1', status: JobStatus.PENDING });
      const job2 = createTestJob({ id: 'job2', status: JobStatus.PENDING, dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addDependency('job2', 'job1', 'soft');

      manager.updateJobStatus('job1', JobStatus.FAILED);

      expect(manager['jobStatuses'].get('job2')).not.toBe(JobStatus.CANCELLED);
    });
  });

  describe('areDependenciesSatisfied', () => {
    it('should return true for job with no dependencies', () => {
      const job = createTestJob({ id: 'job1', dependencies: [] });
      manager.addJob(job);

      expect(manager.areDependenciesSatisfied('job1')).toBe(true);
    });

    it('should return true when all dependencies completed', () => {
      const job1 = createTestJob({ id: 'job1', status: JobStatus.COMPLETED });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.updateJobStatus('job1', JobStatus.COMPLETED);

      expect(manager.areDependenciesSatisfied('job2')).toBe(true);
    });

    it('should return false when dependencies not completed', () => {
      const job1 = createTestJob({ id: 'job1', status: JobStatus.PENDING });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);

      expect(manager.areDependenciesSatisfied('job2')).toBe(false);
    });

    it('should return false for failed hard dependencies', () => {
      const job1 = createTestJob({ id: 'job1', status: JobStatus.FAILED });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addDependency('job2', 'job1', 'hard');
      manager.updateJobStatus('job1', JobStatus.FAILED);

      expect(manager.areDependenciesSatisfied('job2')).toBe(false);
    });
  });

  describe('resolveDependencies', () => {
    it('should resolve ready jobs', () => {
      const job1 = createTestJob({ id: 'job1', status: JobStatus.COMPLETED });
      const job2 = createTestJob({ id: 'job2', status: JobStatus.PENDING, dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.updateJobStatus('job1', JobStatus.COMPLETED);

      const resolution = manager.resolveDependencies();
      expect(resolution.readyJobs).toContain('job2');
    });

    it('should identify blocked jobs', () => {
      const job1 = createTestJob({ id: 'job1', status: JobStatus.PENDING });
      const job2 = createTestJob({ id: 'job2', status: JobStatus.PENDING, dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);

      const resolution = manager.resolveDependencies();
      expect(resolution.blockedJobs.has('job2')).toBe(true);
      expect(resolution.blockedJobs.get('job2')).toContain('job1');
    });

    it('should identify jobs with failed dependencies', () => {
      const job1 = createTestJob({ id: 'job1', status: JobStatus.FAILED });
      const job2 = createTestJob({ id: 'job2', status: JobStatus.PENDING, dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addDependency('job2', 'job1', 'hard');
      manager.updateJobStatus('job1', JobStatus.FAILED);

      const resolution = manager.resolveDependencies();
      expect(resolution.failedJobs).toContain('job2');
    });
  });

  describe('topologicalSort', () => {
    it('should sort jobs in topological order', () => {
      const job1 = createTestJob({ id: 'job1' });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });
      const job3 = createTestJob({ id: 'job3', dependencies: ['job2'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addJob(job3);

      const result = manager.topologicalSort();
      expect(result.sortedJobs).toEqual(['job1', 'job2', 'job3']);
    });

    it('should detect circular dependencies', () => {
      const job1 = createTestJob({ id: 'job1', dependencies: ['job2'] });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);

      const result = manager.topologicalSort();
      expect(result.cyclicDependencies.length).toBeGreaterThan(0);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect simple circular dependency', () => {
      const job1 = createTestJob({ id: 'job1', dependencies: ['job2'] });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);

      const cycles = manager.detectCircularDependencies();
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect complex circular dependency', () => {
      const job1 = createTestJob({ id: 'job1', dependencies: ['job3'] });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });
      const job3 = createTestJob({ id: 'job3', dependencies: ['job2'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addJob(job3);

      const cycles = manager.detectCircularDependencies();
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should not detect cycles in acyclic graph', () => {
      const job1 = createTestJob({ id: 'job1' });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });
      const job3 = createTestJob({ id: 'job3', dependencies: ['job2'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addJob(job3);

      const cycles = manager.detectCircularDependencies();
      expect(cycles.length).toBe(0);
    });
  });

  describe('getDependencyDepth', () => {
    it('should calculate dependency depth', () => {
      const job1 = createTestJob({ id: 'job1' });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });
      const job3 = createTestJob({ id: 'job3', dependencies: ['job2'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addJob(job3);

      expect(manager.getDependencyDepth('job1')).toBe(1);
      expect(manager.getDependencyDepth('job2')).toBe(2);
      expect(manager.getDependencyDepth('job3')).toBe(3);
    });

    it('should handle circular dependencies', () => {
      const job1 = createTestJob({ id: 'job1', dependencies: ['job2'] });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);

      // Should not hang on circular dependencies
      const depth = manager.getDependencyDepth('job1');
      expect(depth).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getExecutionOrder', () => {
    it('should return execution order', () => {
      const job1 = createTestJob({ id: 'job1' });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });
      const job3 = createTestJob({ id: 'job3', dependencies: ['job2'] });

      manager.addJob(job1);
      manager.addJob(job2);
      manager.addJob(job3);

      const order = manager.getExecutionOrder();
      expect(order).toEqual(['job1', 'job2', 'job3']);
    });
  });

  describe('validateGraph', () => {
    it('should validate correct graph', () => {
      const job1 = createTestJob({ id: 'job1' });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);

      const validation = manager.validateGraph();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect circular dependencies', () => {
      const job1 = createTestJob({ id: 'job1', dependencies: ['job2'] });
      const job2 = createTestJob({ id: 'job2', dependencies: ['job1'] });

      manager.addJob(job1);
      manager.addJob(job2);

      const validation = manager.validateGraph();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should warn about missing dependencies', () => {
      const job1 = createTestJob({ id: 'job1', dependencies: ['missing-job'] });

      manager.addJob(job1);

      const validation = manager.validateGraph();
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });
});
