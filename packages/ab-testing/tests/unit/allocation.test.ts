/**
 * Unit tests for Allocation Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AllocationEngine } from '../../src/allocation/engine';
import type { ExperimentConfig } from '../../src/types/experiment';

describe('AllocationEngine', () => {
  let engine: AllocationEngine;
  let experiment: ExperimentConfig;

  beforeEach(() => {
    engine = new AllocationEngine({
      cacheTTL: 60000,
      maxCacheSize: 1000
    });

    experiment = {
      id: 'test-exp',
      name: 'Test Experiment',
      description: 'Test',
      hypothesis: {
        title: 'Test',
        description: 'Test',
        expectedOutcome: 'Test',
        rationale: 'Test',
        expectedEffectSize: 0.05,
        riskAssessment: 'Low'
      },
      variants: [
        {
          id: 'control',
          name: 'Control',
          description: 'Control variant',
          weight: 0.5,
          parameters: {},
          isControl: true
        },
        {
          id: 'treatment',
          name: 'Treatment',
          description: 'Treatment variant',
          weight: 0.5,
          parameters: {}
        }
      ],
      metrics: [
        {
          id: 'conversion',
          name: 'Conversion Rate',
          description: 'Conversion rate',
          type: 'binary',
          direction: 'higher_is_better',
          primary: true,
          minimumDetectableEffect: 0.05,
          power: 0.8,
          alpha: 0.05
        }
      ],
      allocationStrategy: 'equal',
      targetSampleSize: 1000,
      minimumDuration: 7 * 24 * 60 * 60 * 1000,
      maximumDuration: 30 * 24 * 60 * 60 * 1000,
      tags: []
    };
  });

  describe('allocate', () => {
    it('should allocate user to variant', async () => {
      const result = await engine.allocate('user-1', experiment);

      expect(result.variant).toBeDefined();
      expect(result.assignment).toBeDefined();
      expect(result.assignment.userId).toBe('user-1');
      expect(result.assignment.experimentId).toBe('test-exp');
      expect(result.isNewAssignment).toBe(true);
      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return cached assignment on second call', async () => {
      const result1 = await engine.allocate('user-1', experiment);
      const result2 = await engine.allocate('user-1', experiment);

      expect(result2.variant.id).toBe(result1.variant.id);
      expect(result2.isNewAssignment).toBe(false);
    });

    it('should allocate different users consistently', async () => {
      const results = await Promise.all([
        engine.allocate('user-1', experiment),
        engine.allocate('user-2', experiment),
        engine.allocate('user-3', experiment)
      ]);

      // Same user should get same variant
      const result1Again = await engine.allocate('user-1', experiment);
      expect(result1Again.variant.id).toBe(results[0].variant.id);
    });

    it('should work with weighted allocation', async () => {
      experiment.allocationStrategy = 'weighted';
      experiment.variants[0].weight = 0.7;
      experiment.variants[1].weight = 0.3;

      const allocations = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          engine.allocate(`user-${i}`, experiment)
        )
      );

      const controlCount = allocations.filter(
        a => a.variant.id === 'control'
      ).length;

      // With 70% weight, should get roughly 70 control allocations
      expect(controlCount).toBeGreaterThan(50);
      expect(controlCount).toBeLessThan(90);
    });
  });

  describe('getCohortBalance', () => {
    it('should report balance for new experiment', () => {
      const balance = engine.getCohortBalance(experiment);

      expect(balance.currentAllocations.size).toBe(2);
      expect(balance.targetAllocations.size).toBe(2);
      expect(balance.balanceScore).toBeCloseTo(1, 1);
      expect(balance.needsRebalancing).toBe(false);
    });

    it('should detect imbalance', async () => {
      // Allocate many users
      for (let i = 0; i < 100; i++) {
        await engine.allocate(`user-${i}`, experiment);
      }

      const balance = engine.getCohortBalance(experiment);

      expect(balance.currentAllocations.size).toBeGreaterThan(0);
      expect(balance.balanceScore).toBeGreaterThanOrEqual(0);
      expect(balance.balanceScore).toBeLessThanOrEqual(1);
    });
  });

  describe('bulkAllocate', () => {
    it('should allocate multiple users efficiently', async () => {
      const allocations = await engine.bulkAllocate(
        Array.from({ length: 100 }, (_, i) => ({
          userId: `user-${i}`,
          experiment,
          metadata: { batch: i }
        }))
      );

      expect(allocations.size).toBe(100);

      for (const [userId, result] of allocations.entries()) {
        expect(result.assignment.userId).toBe(userId);
        expect(result.variant).toBeDefined();
      }
    });
  });

  describe('getAssignment', () => {
    it('should return null for non-existent user', () => {
      const assignment = engine.getAssignment('non-existent', 'test-exp');
      expect(assignment).toBeNull();
    });

    it('should return existing assignment', async () => {
      await engine.allocate('user-1', experiment);

      const assignment = engine.getAssignment('user-1', 'test-exp');

      expect(assignment).not.toBeNull();
      expect(assignment?.userId).toBe('user-1');
      expect(assignment?.experimentId).toBe('test-exp');
    });
  });

  describe('validateConsistency', () => {
    it('should validate consistent hashing', async () => {
      const result1 = await engine.allocate('user-1', experiment);
      const consistent = engine.validateConsistency('user-1', experiment);

      expect(consistent).toBe(true);
    });
  });

  describe('cache management', () => {
    it('should track cache statistics', async () => {
      await engine.allocate('user-1', experiment);
      await engine.allocate('user-2', experiment);

      const stats = engine.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.expiredCount).toBe(0);
    });

    it('should clear cache', async () => {
      await engine.allocate('user-1', experiment);
      engine.clearCache();

      const stats = engine.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should warm up cache', async () => {
      const assignments = [
        {
          experimentId: 'test-exp',
          variantId: 'control',
          userId: 'user-1',
          assignedAt: Date.now()
        },
        {
          experimentId: 'test-exp',
          variantId: 'treatment',
          userId: 'user-2',
          assignedAt: Date.now()
        }
      ];

      engine.warmUpCache(assignments);

      const assignment1 = engine.getAssignment('user-1', 'test-exp');
      const assignment2 = engine.getAssignment('user-2', 'test-exp');

      expect(assignment1?.variantId).toBe('control');
      expect(assignment2?.variantId).toBe('treatment');
    });
  });

  describe('performance', () => {
    it('should allocate in sub-millisecond time', async () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        await engine.allocate(`user-${i}`, experiment);
      }

      const duration = performance.now() - start;
      const avgTime = duration / 1000;

      // Should average less than 1ms per allocation
      expect(avgTime).toBeLessThan(1);
    });

    it('should handle high concurrency', async () => {
      const start = performance.now();

      const promises = Array.from({ length: 1000 }, (_, i) =>
        engine.allocate(`user-${i}`, experiment)
      );

      await Promise.all(promises);

      const duration = performance.now() - start;

      // Should complete 1000 allocations quickly
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('hash functions', () => {
    it('should produce consistent hashes', async () => {
      const result1 = await engine.allocate('user-1', experiment);
      const result2 = await engine.allocate('user-1', experiment);

      expect(result1.metadata.hash).toBe(result2.metadata.hash);
    });

    it('should distribute users evenly', async () => {
      const allocations = await Promise.all(
        Array.from({ length: 1000 }, (_, i) =>
          engine.allocate(`user-${i}`, experiment)
        )
      );

      const controlCount = allocations.filter(
        a => a.variant.id === 'control'
      ).length;
      const treatmentCount = allocations.filter(
        a => a.variant.id === 'treatment'
      ).length;

      // Should be roughly 50-50 split
      const ratio = controlCount / treatmentCount;
      expect(ratio).toBeGreaterThan(0.8);
      expect(ratio).toBeLessThan(1.2);
    });
  });
});
