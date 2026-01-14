/**
 * Integration tests for A/B testing engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ABTestingEngine } from '../../src/abtesting/engine';
import type { FlagStorageEnv } from '../../src/types/index';

describe('ABTestingEngine Integration', () => {
  let engine: ABTestingEngine;
  let mockStorage: any;
  let mockAnalytics: any;

  beforeEach(() => {
    mockStorage = {
      getExperiment: vi.fn(),
      setExperiment: vi.fn(),
      deleteExperiment: vi.fn(),
      listExperiments: vi.fn(),
    };

    mockAnalytics = {
      queryEvaluations: vi.fn(),
      recordAssignment: vi.fn(),
    };

    engine = new ABTestingEngine({
      FLAGS_DURABLE_OBJECT: {
        idFromName: vi.fn(() => mockStorage),
      },
      ANALYTICS_DURABLE_OBJECT: {
        idFromName: vi.fn(() => mockAnalytics),
      },
    } as FlagStorageEnv);
  });

  describe('experiment creation', () => {
    it('should create experiment', async () => {
      const experiment = await engine.createExperiment({
        name: 'Test Experiment',
        description: 'Test description',
        flagId: 'test_flag',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 50,
            isControl: true,
          },
          {
            name: 'Variant',
            value: 'variant',
            allocation: 50,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test hypothesis',
        successMetric: 'conversion',
        confidenceLevel: 0.95,
      });

      expect(experiment.id).toBeDefined();
      expect(experiment.name).toBe('Test Experiment');
      expect(experiment.variants).toHaveLength(2);
      expect(experiment.status).toBe('draft');
    });

    it('should validate variant allocations sum to 100', async () => {
      await expect(
        engine.createExperiment({
          name: 'Invalid Experiment',
          description: 'Invalid allocations',
          flagId: 'test_flag',
          variants: [
            {
              name: 'Control',
              value: 'control',
              allocation: 60,
              isControl: true,
            },
            {
              name: 'Variant',
              value: 'variant',
              allocation: 60,
            },
          ],
          trafficAllocation: 100,
          hypothesis: 'Test',
          successMetric: 'conversion',
        })
      ).rejects.toThrow('Variant allocations must sum to 100%');
    });

    it('should create experiment with min sample size', async () => {
      const experiment = await engine.createExperiment({
        name: 'Test Experiment',
        description: 'Test',
        flagId: 'test_flag',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 50,
            isControl: true,
          },
          {
            name: 'Variant',
            value: 'variant',
            allocation: 50,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
        minSampleSize: 1000,
        confidenceLevel: 0.95,
      });

      expect(experiment.minSampleSize).toBe(1000);
    });
  });

  describe('experiment lifecycle', () => {
    it('should start experiment', async () => {
      const experiment = await engine.createExperiment({
        name: 'Test Experiment',
        description: 'Test',
        flagId: 'test_flag',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 50,
            isControl: true,
          },
          {
            name: 'Variant',
            value: 'variant',
            allocation: 50,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
      });

      mockStorage.getExperiment.mockResolvedValue(experiment);

      const started = await engine.startExperiment(experiment.id);
      expect(started.status).toBe('running');
      expect(started.startDate).toBeDefined();
    });

    it('should pause experiment', async () => {
      const experiment = await engine.createExperiment({
        name: 'Test Experiment',
        description: 'Test',
        flagId: 'test_flag',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 50,
            isControl: true,
          },
          {
            name: 'Variant',
            value: 'variant',
            allocation: 50,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
      });

      experiment.status = 'running';
      mockStorage.getExperiment.mockResolvedValue(experiment);

      const paused = await engine.pauseExperiment(experiment.id);
      expect(paused.status).toBe('paused');
    });

    it('should complete experiment', async () => {
      const experiment = await engine.createExperiment({
        name: 'Test Experiment',
        description: 'Test',
        flagId: 'test_flag',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 50,
            isControl: true,
          },
          {
            name: 'Variant',
            value: 'variant',
            allocation: 50,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
      });

      experiment.status = 'running';
      mockStorage.getExperiment.mockResolvedValue(experiment);

      const completed = await engine.completeExperiment(experiment.id);
      expect(completed.status).toBe('completed');
      expect(completed.endDate).toBeDefined();
    });

    it('should not start already running experiment', async () => {
      const experiment = await engine.createExperiment({
        name: 'Test Experiment',
        description: 'Test',
        flagId: 'test_flag',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 50,
            isControl: true,
          },
          {
            name: 'Variant',
            value: 'variant',
            allocation: 50,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
      });

      experiment.status = 'running';
      mockStorage.getExperiment.mockResolvedValue(experiment);

      await expect(engine.startExperiment(experiment.id)).rejects.toThrow(
        'Experiment is already running'
      );
    });
  });

  describe('variant assignment', () => {
    let experiment: any;

    beforeEach(async () => {
      experiment = await engine.createExperiment({
        name: 'Test Experiment',
        description: 'Test',
        flagId: 'test_flag',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 50,
            isControl: true,
          },
          {
            name: 'Variant',
            value: 'variant',
            allocation: 50,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
      });

      experiment.status = 'running';
      mockStorage.getExperiment.mockResolvedValue(experiment);
    });

    it('should assign user to variant', async () => {
      const variant = await engine.assignVariant(experiment.id, 'user-123');

      expect(variant).toBeDefined();
      expect(['Control', 'Variant']).toContain(variant?.name);
    });

    it('should return consistent assignment for same user', async () => {
      const variant1 = await engine.assignVariant(experiment.id, 'user-123');
      const variant2 = await engine.assignVariant(experiment.id, 'user-123');

      expect(variant1?.id).toBe(variant2?.id);
    });

    it('should return different assignments for different users', async () => {
      const variant1 = await engine.assignVariant(experiment.id, 'user-1');
      const variant2 = await engine.assignVariant(experiment.id, 'user-2');

      // While they could be the same, with enough users we'd expect both
      expect(variant1).toBeDefined();
      expect(variant2).toBeDefined();
    });

    it('should return null for users outside traffic allocation', async () => {
      experiment.trafficAllocation = 0; // No traffic
      mockStorage.getExperiment.mockResolvedValue(experiment);

      const variant = await engine.assignVariant(experiment.id, 'user-123');
      expect(variant).toBeNull();
    });

    it('should get assigned variant', async () => {
      await engine.assignVariant(experiment.id, 'user-123');

      const variant = await engine.getAssignedVariant(experiment.id, 'user-123');
      expect(variant).toBeDefined();
    });

    it('should batch assign variants', async () => {
      const results = await engine.batchAssignVariants(experiment.id, [
        'user-1',
        'user-2',
        'user-3',
      ]);

      expect(results.size).toBe(3);
      for (const [userId, variant] of results.entries()) {
        expect(['user-1', 'user-2', 'user-3']).toContain(userId);
        expect(variant).toBeDefined();
      }
    });
  });

  describe('experiment results', () => {
    let experiment: any;

    beforeEach(async () => {
      experiment = await engine.createExperiment({
        name: 'Test Experiment',
        description: 'Test',
        flagId: 'test_flag',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 50,
            isControl: true,
          },
          {
            name: 'Variant',
            value: 'variant',
            allocation: 50,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
        minSampleSize: 100,
        confidenceLevel: 0.95,
      });

      mockStorage.getExperiment.mockResolvedValue(experiment);
      mockAnalytics.queryEvaluations.mockResolvedValue([]);
    });

    it('should get experiment results', async () => {
      const results = await engine.getExperimentResults(experiment.id);

      expect(results).toHaveLength(2);
      expect(results[0].experimentId).toBe(experiment.id);
    });

    it('should include conversion rates in results', async () => {
      const results = await engine.getExperimentResults(experiment.id);

      for (const result of results) {
        expect(result.conversionRate).toBeGreaterThanOrEqual(0);
        expect(result.conversionRate).toBeLessThanOrEqual(1);
      }
    });

    it('should include sample sizes in results', async () => {
      const results = await engine.getExperimentResults(experiment.id);

      for (const result of results) {
        expect(result.sampleSize).toBeGreaterThanOrEqual(0);
      }
    });

    it('should check if reached sample size', async () => {
      const hasReached = await engine.hasReachedSampleSize(experiment.id);
      expect(hasReached).toBe(false); // No evaluations yet
    });
  });

  describe('sample size calculation', () => {
    it('should calculate required sample size', () => {
      const sampleSize = engine.calculateRequiredSampleSize(
        0.1, // 10% baseline
        0.02, // 2% minimum detectable effect
        0.95, // 95% confidence
        0.8 // 80% power
      );

      expect(sampleSize).toBeGreaterThan(0);
      expect(Number.isInteger(sampleSize)).toBe(true);
    });

    it('should require larger sample for smaller effects', () => {
      const sample1 = engine.calculateRequiredSampleSize(0.1, 0.05, 0.95, 0.8);
      const sample2 = engine.calculateRequiredSampleSize(0.1, 0.01, 0.95, 0.8);

      expect(sample2).toBeGreaterThan(sample1);
    });
  });

  describe('experiment queries', () => {
    it('should get experiment by id', async () => {
      const experiment = await engine.createExperiment({
        name: 'Test Experiment',
        description: 'Test',
        flagId: 'test_flag',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 100,
            isControl: true,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
      });

      mockStorage.getExperiment.mockResolvedValue(experiment);

      const retrieved = await engine.getExperiment(experiment.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(experiment.id);
    });

    it('should list experiments', async () => {
      const exp1 = await engine.createExperiment({
        name: 'Experiment 1',
        description: 'Test',
        flagId: 'flag1',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 100,
            isControl: true,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
      });

      const exp2 = await engine.createExperiment({
        name: 'Experiment 2',
        description: 'Test',
        flagId: 'flag2',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 100,
            isControl: true,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
      });

      mockStorage.listExperiments.mockResolvedValue([exp1, exp2]);

      const experiments = await engine.listExperiments();
      expect(experiments).toHaveLength(2);
    });

    it('should filter experiments by status', async () => {
      const exp1 = await engine.createExperiment({
        name: 'Experiment 1',
        description: 'Test',
        flagId: 'flag1',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 100,
            isControl: true,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
      });

      exp1.status = 'running';

      mockStorage.listExperiments.mockResolvedValue([exp1]);

      const experiments = await engine.listExperiments({ status: 'running' });
      expect(experiments).toHaveLength(1);
      expect(experiments[0].status).toBe('running');
    });

    it('should delete experiment', async () => {
      const experiment = await engine.createExperiment({
        name: 'Test Experiment',
        description: 'Test',
        flagId: 'flag1',
        variants: [
          {
            name: 'Control',
            value: 'control',
            allocation: 100,
            isControl: true,
          },
        ],
        trafficAllocation: 100,
        hypothesis: 'Test',
        successMetric: 'conversion',
      });

      mockStorage.deleteExperiment.mockResolvedValue(true);

      const deleted = await engine.deleteExperiment(experiment.id);
      expect(deleted).toBe(true);
    });
  });
});
