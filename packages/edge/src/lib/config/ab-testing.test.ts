/**
 * A/B Testing Framework Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ABTestingManager,
  createExperiment,
  createABTest,
  createMultiVariantTest,
} from './ab-testing';
import type { Experiment, ExperimentVariant, EvaluationContext } from './types';

describe('ABTestingManager', () => {
  let manager: ABTestingManager;

  beforeEach(() => {
    manager = new ABTestingManager();
  });

  describe('Basic Operations', () => {
    it('should create new manager with empty experiments', () => {
      expect(manager.getAllExperiments()).toHaveLength(0);
    });

    it('should add an experiment', () => {
      const variants: ExperimentVariant[] = [
        { name: 'control', weight: 0.5, config: {} },
        { name: 'treatment', weight: 0.5, config: {} },
      ];

      const experiment = createExperiment('test-exp', variants, ['conversion']);
      manager.setExperiment(experiment);

      expect(manager.getAllExperiments()).toHaveLength(1);
      expect(manager.getExperiment('test-exp')).toEqual(experiment);
    });

    it('should delete an experiment', () => {
      const variants: ExperimentVariant[] = [
        { name: 'control', weight: 1.0, config: {} },
      ];

      const experiment = createExperiment('test-exp', variants, ['conversion']);
      manager.setExperiment(experiment);

      expect(manager.deleteExperiment('test-exp')).toBe(true);
      expect(manager.getExperiment('test-exp')).toBeUndefined();
    });

    it('should update an experiment', () => {
      const variants: ExperimentVariant[] = [
        { name: 'control', weight: 1.0, config: {} },
      ];

      const experiment = createExperiment('test-exp', variants, ['conversion']);
      manager.setExperiment(experiment);

      const updated = manager.updateExperiment('test-exp', { enabled: true });
      expect(updated?.enabled).toBe(true);
      expect(manager.getExperiment('test-exp')?.enabled).toBe(true);
    });
  });

  describe('Variant Assignment', () => {
    it('should assign variant to user', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      manager.setExperiment(experiment);

      const context: EvaluationContext = { userId: 'user-123' };
      const assignment = manager.assignVariant('test-ab', context);

      expect(assignment).not.toBeNull();
      expect(assignment?.variant).toMatch(/^(control|treatment)$/);
    });

    it('should return consistent assignment for same user', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      manager.setExperiment(experiment);

      const context: EvaluationContext = { userId: 'user-123' };

      const assignment1 = manager.assignVariant('test-ab', context);
      const assignment2 = manager.assignVariant('test-ab', context);

      expect(assignment1?.variant).toBe(assignment2?.variant);
    });

    it('should return null for disabled experiment', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = false;
      manager.setExperiment(experiment);

      const context: EvaluationContext = { userId: 'user-123' };
      const assignment = manager.assignVariant('test-ab', context);

      expect(assignment).toBeNull();
    });

    it('should return null for non-existent experiment', () => {
      const context: EvaluationContext = { userId: 'user-123' };
      const assignment = manager.assignVariant('non-existent', context);

      expect(assignment).toBeNull();
    });

    it('should return null for expired experiment', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      experiment.endsAt = Date.now() - 1000; // Expired
      manager.setExperiment(experiment);

      const context: EvaluationContext = { userId: 'user-123' };
      const assignment = manager.assignVariant('test-ab', context);

      expect(assignment).toBeNull();
    });

    it('should return null for experiment not started', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      experiment.startedAt = Date.now() + 100000; // In the future
      manager.setExperiment(experiment);

      const context: EvaluationContext = { userId: 'user-123' };
      const assignment = manager.assignVariant('test-ab', context);

      expect(assignment).toBeNull();
    });

    it('should distribute variants according to weights', () => {
      const variants: ExperimentVariant[] = [
        { name: 'variant-a', weight: 0.7, config: {} },
        { name: 'variant-b', weight: 0.3, config: {} },
      ];

      const experiment = createExperiment('test-exp', variants, ['conversion']);
      experiment.enabled = true;
      manager.setExperiment(experiment);

      // Assign many users
      const assignments: Record<string, number> = {};
      const numUsers = 1000;

      for (let i = 0; i < numUsers; i++) {
        const context: EvaluationContext = { userId: `user-${i}` };
        const assignment = manager.assignVariant('test-exp', context);
        if (assignment) {
          assignments[assignment.variant] = (assignments[assignment.variant] || 0) + 1;
        }
      }

      // Check distribution (approximately)
      const ratioA = assignments['variant-a']! / numUsers;
      const ratioB = assignments['variant-b']! / numUsers;

      expect(ratioA).toBeGreaterThan(0.6); // Should be ~0.7
      expect(ratioB).toBeGreaterThan(0.2); // Should be ~0.3
      expect(ratioA).toBeLessThan(0.8);
      expect(ratioB).toBeLessThan(0.4);
    });
  });

  describe('Getting Assignments', () => {
    it('should get existing assignment', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      manager.setExperiment(experiment);

      const context: EvaluationContext = { userId: 'user-123' };
      manager.assignVariant('test-ab', context);

      const assignment = manager.getAssignment('test-ab', 'user-123');

      expect(assignment).not.toBeNull();
      expect(assignment?.variant).toMatch(/^(control|treatment)$/);
    });

    it('should return null for non-existent assignment', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      manager.setExperiment(experiment);

      const assignment = manager.getAssignment('test-ab', 'user-123');

      expect(assignment).toBeNull();
    });

    it('should get all user assignments', () => {
      const exp1 = createABTest('exp-1', {}, {}, ['metric']);
      const exp2 = createABTest('exp-2', {}, {}, ['metric']);

      exp1.enabled = true;
      exp2.enabled = true;

      manager.setExperiment(exp1);
      manager.setExperiment(exp2);

      const context: EvaluationContext = { userId: 'user-123' };
      manager.assignVariant('exp-1', context);
      manager.assignVariant('exp-2', context);

      const assignments = manager.getUserAssignments('user-123');

      expect(assignments.size).toBe(2);
      expect(assignments.has('exp-1')).toBe(true);
      expect(assignments.has('exp-2')).toBe(true);
    });
  });

  describe('Targeting', () => {
    it('should respect tier targeting', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      experiment.targeting.tier = 'pro';
      manager.setExperiment(experiment);

      const proContext: EvaluationContext = { userId: 'user-1', tier: 'pro' };
      const freeContext: EvaluationContext = { userId: 'user-2', tier: 'free' };

      expect(manager.assignVariant('test-ab', proContext)).not.toBeNull();
      expect(manager.assignVariant('test-ab', freeContext)).toBeNull();
    });

    it('should respect user targeting', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      experiment.targeting.users = ['user-123'];
      manager.setExperiment(experiment);

      const targetedContext: EvaluationContext = { userId: 'user-123' };
      const otherContext: EvaluationContext = { userId: 'user-456' };

      expect(manager.assignVariant('test-ab', targetedContext)).not.toBeNull();
      expect(manager.assignVariant('test-ab', otherContext)).toBeNull();
    });

    it('should respect organization targeting', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      experiment.targeting.organizations = ['org-123'];
      manager.setExperiment(experiment);

      const targetedContext: EvaluationContext = {
        userId: 'user-1',
        organizationId: 'org-123',
      };
      const otherContext: EvaluationContext = {
        userId: 'user-2',
        organizationId: 'org-456',
      };

      expect(manager.assignVariant('test-ab', targetedContext)).not.toBeNull();
      expect(manager.assignVariant('test-ab', otherContext)).toBeNull();
    });

    it('should respect percentage rollout', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      experiment.targeting.percentage = 50;
      manager.setExperiment(experiment);

      const context: EvaluationContext = { userId: 'user-123' };
      const assignment = manager.assignVariant('test-ab', context);

      // Should either assign or not, but consistent
      const firstAssignment = assignment;
      const secondAssignment = manager.assignVariant('test-ab', context);

      expect(firstAssignment).toEqual(secondAssignment);
    });
  });

  describe('Metrics Recording', () => {
    it('should record metric for variant', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks', 'conversions']
      );

      experiment.enabled = true;
      manager.setExperiment(experiment);

      const result = manager.recordMetric('test-ab', 'control', 'clicks', 10);

      expect(result).toBe(true);
    });

    it('should reject non-tracked metric', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      manager.setExperiment(experiment);

      const result = manager.recordMetric('test-ab', 'control', 'untracked', 10);

      expect(result).toBe(false);
    });

    it('should return false for non-existent experiment', () => {
      const result = manager.recordMetric('non-existent', 'control', 'clicks', 10);

      expect(result).toBe(false);
    });
  });

  describe('Experiment Statistics', () => {
    it('should return null for non-existent experiment', () => {
      const stats = manager.getExperimentStats('non-existent');

      expect(stats).toBeNull();
    });

    it('should track assignment count', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      experiment.requiredSampleSize = 100;
      manager.setExperiment(experiment);

      // Assign users
      for (let i = 0; i < 10; i++) {
        const context: EvaluationContext = { userId: `user-${i}` };
        manager.assignVariant('test-ab', context);
      }

      const stats = manager.getExperimentStats('test-ab');

      expect(stats?.totalAssignments).toBe(10);
    });

    it('should track variant distribution', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      manager.setExperiment(experiment);

      // Assign users
      for (let i = 0; i < 100; i++) {
        const context: EvaluationContext = { userId: `user-${i}` };
        manager.assignVariant('test-ab', context);
      }

      const stats = manager.getExperimentStats('test-ab');

      expect(stats?.variantDistribution.size).toBe(2);
      expect(stats?.variantDistribution.has('control')).toBe(true);
      expect(stats?.variantDistribution.has('treatment')).toBe(true);
    });

    it('should check if sample size is reached', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      experiment.requiredSampleSize = 10;
      manager.setExperiment(experiment);

      // Assign fewer than required
      for (let i = 0; i < 5; i++) {
        const context: EvaluationContext = { userId: `user-${i}` };
        manager.assignVariant('test-ab', context);
      }

      let stats = manager.getExperimentStats('test-ab');
      expect(stats?.sampleSizeReached).toBe(false);

      // Assign more to reach required
      for (let i = 5; i < 15; i++) {
        const context: EvaluationContext = { userId: `user-${i}` };
        manager.assignVariant('test-ab', context);
      }

      stats = manager.getExperimentStats('test-ab');
      expect(stats?.sampleSizeReached).toBe(true);
    });
  });

  describe('Variant Management', () => {
    it('should add variant to experiment', () => {
      const variants: ExperimentVariant[] = [
        { name: 'control', weight: 1.0, config: {} },
      ];

      const experiment = createExperiment('test-exp', variants, ['conversion']);
      manager.setExperiment(experiment);

      const newVariant: ExperimentVariant = {
        name: 'treatment',
        weight: 0.5,
        config: {},
      };

      const result = manager.addVariant('test-exp', newVariant);

      expect(result).toBe(true);
      expect(manager.getExperiment('test-exp')?.variants).toHaveLength(2);
    });

    it('should remove variant from experiment', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      manager.setExperiment(experiment);

      const result = manager.removeVariant('test-ab', 'control');

      expect(result).toBe(true);
      expect(manager.getExperiment('test-ab')?.variants).toHaveLength(1);
    });

    it('should reject removing last variant', () => {
      const variants: ExperimentVariant[] = [
        { name: 'only', weight: 1.0, config: {} },
      ];

      const experiment = createExperiment('test-exp', variants, ['conversion']);
      manager.setExperiment(experiment);

      expect(() => manager.removeVariant('test-exp', 'only')).toThrow();
    });
  });

  describe('Experiment Lifecycle', () => {
    it('should enable/disable experiment', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = false;
      manager.setExperiment(experiment);

      expect(manager.setExperimentEnabled('test-ab', true)).toBe(true);
      expect(manager.getExperiment('test-ab')?.enabled).toBe(true);

      expect(manager.setExperimentEnabled('test-ab', false)).toBe(true);
      expect(manager.getExperiment('test-ab')?.enabled).toBe(false);
    });

    it('should set start time when enabling', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = false;
      experiment.startedAt = undefined;
      manager.setExperiment(experiment);

      manager.setExperimentEnabled('test-ab', true);

      expect(manager.getExperiment('test-ab')?.startedAt).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should return accurate statistics', () => {
      const exp1 = createABTest('exp-1', {}, {}, ['metric']);
      const exp2 = createABTest('exp-2', {}, {}, ['metric']);

      exp1.enabled = true;
      exp2.enabled = false;

      manager.setExperiment(exp1);
      manager.setExperiment(exp2);

      const stats = manager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
    });

    it('should track completed experiments', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      experiment.endsAt = Date.now() - 1000; // Ended
      manager.setExperiment(experiment);

      const stats = manager.getStats();

      expect(stats.completed).toBe(1);
    });
  });

  describe('Import/Export', () => {
    it('should export all experiments', () => {
      const exp1 = createABTest('exp-1', {}, {}, ['metric']);
      const exp2 = createABTest('exp-2', {}, {}, ['metric']);

      manager.setExperiment(exp1);
      manager.setExperiment(exp2);

      const exported = manager.export();

      expect(exported).toHaveLength(2);
    });

    it('should import experiments', () => {
      const experiments = [
        createABTest('exp-1', {}, {}, ['metric']),
        createABTest('exp-2', {}, {}, ['metric']),
      ];

      manager.import(experiments);

      expect(manager.getAllExperiments()).toHaveLength(2);
    });

    it('should clear assignments on import', () => {
      const experiment = createABTest(
        'test-ab',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      manager.setExperiment(experiment);

      const context: EvaluationContext = { userId: 'user-123' };
      manager.assignVariant('test-ab', context);

      // Re-import should clear assignments
      manager.import([experiment]);

      const assignment = manager.getAssignment('test-ab', 'user-123');
      expect(assignment).toBeNull();
    });
  });
});

describe('Experiment Helpers', () => {
  it('should create basic experiment', () => {
    const variants: ExperimentVariant[] = [
      { name: 'control', weight: 0.5, config: {} },
      { name: 'treatment', weight: 0.5, config: {} },
    ];

    const experiment = createExperiment('test', variants, ['conversion']);

    expect(experiment.name).toBe('test');
    expect(experiment.variants).toHaveLength(2);
    expect(experiment.metrics).toEqual(['conversion']);
  });

  it('should create A/B test', () => {
    const experiment = createABTest(
      'test-ab',
      { variant: 'A' },
      { variant: 'B' },
      ['conversion']
    );

    expect(experiment.variants).toHaveLength(2);
    expect(experiment.variants[0].name).toBe('control');
    expect(experiment.variants[1].name).toBe('treatment');
  });

  it('should create multi-variant test', () => {
    const experiment = createMultiVariantTest(
      'test-multi',
      [
        { name: 'variant-a', config: { value: 'A' } },
        { name: 'variant-b', config: { value: 'B' } },
        { name: 'variant-c', config: { value: 'C' } },
      ],
      ['conversion']
    );

    expect(experiment.variants).toHaveLength(3);
    expect(experiment.variants.every((v) => v.weight === 1 / 3)).toBe(true);
  });

  it('should normalize variant weights', () => {
    const variants: ExperimentVariant[] = [
      { name: 'variant-a', weight: 2, config: {} },
      { name: 'variant-b', weight: 1, config: {} },
    ];

    const experiment = createExperiment('test', variants, ['conversion']);

    expect(experiment.variants[0].weight).toBe(2 / 3);
    expect(experiment.variants[1].weight).toBe(1 / 3);
  });
});
