/**
 * Configuration Management Integration Tests
 *
 * Tests the complete configuration system with all components working together
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FeatureFlagManager,
  DynamicConfigManager,
  ABTestingManager,
  ConfigValidator,
  createFeatureFlag,
  createPercentageRolloutFlag,
  createABTest,
  getDefaultAppConfig,
} from './index';
import type { KVCache } from '../kv';
import type { AppConfig, EvaluationContext } from './types';

// Mock KVCache
class MockKVCache implements Partial<KVCache> {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
}

describe('Configuration Management Integration', () => {
  describe('Feature Flags and Dynamic Config', () => {
    let featureFlags: FeatureFlagManager;
    let dynamicConfig: DynamicConfigManager;
    let defaultConfig: AppConfig;

    beforeEach(() => {
      defaultConfig = getDefaultAppConfig();
      featureFlags = new FeatureFlagManager();
      dynamicConfig = new DynamicConfigManager(defaultConfig);
    });

    it('should integrate feature flags with dynamic config', async () => {
      // Create feature flag
      const flag = createPercentageRolloutFlag('test-feature', 50);
      featureFlags.setFlag(flag);

      // Enable via dynamic config
      const configPath = 'features.testFeature.enabled';
      await dynamicConfig.setValue(configPath, true, 'admin');

      // Both should work independently
      expect(featureFlags.isEnabled('test-feature')).toBe(true);
      expect(dynamicConfig.getValue(configPath)).toBe(true);
    });

    it('should notify subscribers when config changes', async () => {
      const subscriber = vi.fn();
      dynamicConfig.subscribe('test-sub', subscriber);

      await dynamicConfig.setValue('version', '2.0.0', 'admin');

      expect(subscriber).toHaveBeenCalledTimes(1);
      const event = subscriber.mock.calls[0][0];
      expect(event.change.path).toBe('version');
    });

    it('should rollback configuration changes', async () => {
      const initialVersion = dynamicConfig.getValue('version');
      const targetVersion = dynamicConfig.getCurrentVersion();

      // Make changes
      await dynamicConfig.setValue('version', '2.0.0', 'admin');
      await dynamicConfig.setValue('environment', 'staging', 'admin');

      // Rollback
      const result = await dynamicConfig.rollback(targetVersion, 'admin');

      expect(result.valid).toBe(true);
      expect(dynamicConfig.getValue('version')).toBe(initialVersion);
    });
  });

  describe('A/B Testing Integration', () => {
    let abTesting: ABTestingManager;
    let featureFlags: FeatureFlagManager;

    beforeEach(() => {
      abTesting = new ABTestingManager();
      featureFlags = new FeatureFlagManager();
    });

    it('should use feature flags for experiment targeting', () => {
      // Create experiment with targeting
      const experiment = createABTest(
        'ui-color-test',
        { color: 'blue' },
        { color: 'red' },
        ['clicks']
      );

      experiment.enabled = true;
      experiment.targeting.tier = 'pro';
      abTesting.setExperiment(experiment);

      // Create feature flag for pro tier
      const flag = createFeatureFlag('pro-features', true, {
        targeting: {
          users: [],
          percentage: 0,
          organizations: [],
          tier: 'pro',
        },
      });

      featureFlags.setFlag(flag);

      // Test assignment
      const proContext: EvaluationContext = { userId: 'user-1', tier: 'pro' };
      const freeContext: EvaluationContext = { userId: 'user-2', tier: 'free' };

      const proAssignment = abTesting.assignVariant('ui-color-test', proContext);
      const freeAssignment = abTesting.assignVariant('ui-color-test', freeContext);

      expect(proAssignment).not.toBeNull();
      expect(freeAssignment).toBeNull();
    });

    it('should track metrics for experiments', () => {
      const experiment = createABTest(
        'button-test',
        { size: 'large' },
        { size: 'small' },
        ['clicks', 'conversions']
      );

      experiment.enabled = true;
      abTesting.setExperiment(experiment);

      // Record metrics
      const result = abTesting.recordMetric('button-test', 'control', 'clicks', 100);

      expect(result).toBe(true);
    });

    it('should provide experiment statistics', () => {
      const experiment = createABTest(
        'test-exp',
        { variant: 'A' },
        { variant: 'B' },
        ['conversion']
      );

      experiment.enabled = true;
      experiment.requiredSampleSize = 50;
      abTesting.setExperiment(experiment);

      // Assign users
      for (let i = 0; i < 50; i++) {
        const context: EvaluationContext = { userId: `user-${i}` };
        abTesting.assignVariant('test-exp', context);
      }

      const stats = abTesting.getExperimentStats('test-exp');

      expect(stats?.totalAssignments).toBe(50);
      expect(stats?.sampleSizeReached).toBe(true);
      expect(stats?.variantDistribution.size).toBe(2);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate complete configuration', () => {
      const config = getDefaultAppConfig();
      const result = ConfigValidator.validateAppConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        ...getDefaultAppConfig(),
        version: 'invalid-version',
      };

      const result = ConfigValidator.validateAppConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate feature flags', () => {
      const validFlag = createFeatureFlag('test', true);
      const invalidFlag = createFeatureFlag('', true);

      const validResult = ConfigValidator.validateFeatureFlag(validFlag);
      const invalidResult = ConfigValidator.validateFeatureFlag(invalidFlag);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate experiments', () => {
      const validExperiment = createABTest(
        'test',
        { variant: 'A' },
        { variant: 'B' },
        ['metric']
      );

      const invalidExperiment = {
        ...validExperiment,
        variants: [
          { name: 'variant-a', weight: 0.3, config: {} },
          { name: 'variant-b', weight: 0.3, config: {} }, // Weights don't sum to 1
        ],
      };

      const validResult = ConfigValidator.validateExperiment(validExperiment);
      const invalidResult = ConfigValidator.validateExperiment(invalidExperiment);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('End-to-End Workflows', () => {
    it('should handle gradual feature rollout', async () => {
      const featureFlags = new FeatureFlagManager();
      const dynamicConfig = new DynamicConfigManager(getDefaultAppConfig());

      // Start with 0% rollout
      const flag = createPercentageRolloutFlag('new-feature', 0);
      featureFlags.setFlag(flag);

      // No users should have access
      expect(featureFlags.isEnabled('new-feature', { userId: 'user-1' })).toBe(false);

      // Roll out to 10%
      featureFlags.setPercentageRollout('new-feature', 10);

      // Some users should have access
      const context: EvaluationContext = { userId: 'user-123' };
      const result1 = featureFlags.evaluate('new-feature', context);

      // Either enabled or not, but consistent
      const result2 = featureFlags.evaluate('new-feature', context);
      expect(result1.enabled).toBe(result2.enabled);

      // Roll out to 100%
      featureFlags.setPercentageRollout('new-feature', 100);

      // All users should have access
      expect(featureFlags.isEnabled('new-feature', { userId: 'any-user' })).toBe(true);
    });

    it('should handle kill switch for problematic features', async () => {
      const featureFlags = new FeatureFlagManager();
      const dynamicConfig = new DynamicConfigManager(getDefaultAppConfig());

      // Enable feature
      const flag = createFeatureFlag('risky-feature', true);
      featureFlags.setFlag(flag);

      expect(featureFlags.isEnabled('risky-feature')).toBe(true);

      // Problem detected - disable immediately
      featureFlags.setFlagEnabled('risky-feature', false);

      expect(featureFlags.isEnabled('risky-feature')).toBe(false);

      // All subsequent evaluations return false
      const result = featureFlags.evaluate('risky-feature', { userId: 'any-user' });
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('should handle A/B testing with feature flags', async () => {
      const abTesting = new ABTestingManager();
      const featureFlags = new FeatureFlagManager();

      // Create experiment
      const experiment = createABTest(
        'pricing-page',
        { layout: 'A' },
        { layout: 'B' },
        ['conversions', 'revenue']
      );

      experiment.enabled = true;
      abTesting.setExperiment(experiment);

      // Gate experiment behind feature flag
      const flag = createFeatureFlag('pricing-experiment', true);
      featureFlags.setFlag(flag);

      // User gets assigned
      const context: EvaluationContext = { userId: 'user-123' };
      const assignment = abTesting.assignVariant('pricing-page', context);

      expect(assignment).not.toBeNull();
      expect(assignment!.variant).toMatch(/^(control|treatment)$/);

      // Record metrics
      abTesting.recordMetric('pricing-page', assignment!.variant, 'conversions', 1);
      abTesting.recordMetric('pricing-page', assignment!.variant, 'revenue', 99.99);

      // Check stats
      const stats = abTesting.getExperimentStats('pricing-page');
      expect(stats?.totalAssignments).toBe(1);
    });

    it('should handle canary deployments', async () => {
      const featureFlags = new FeatureFlagManager();

      // Create canary flag for internal users
      const flag = createFeatureFlag('new-api-version', true, {
        targeting: {
          users: ['internal-user-1', 'internal-user-2'],
          percentage: 0,
          organizations: [],
          tier: 'all',
        },
      });

      featureFlags.setFlag(flag);

      // Internal users get new version
      expect(
        featureFlags.isEnabled('new-api-version', { userId: 'internal-user-1' })
      ).toBe(true);

      // Regular users don't
      expect(
        featureFlags.isEnabled('new-api-version', { userId: 'regular-user' })
      ).toBe(false);

      // Gradually roll out to 1% of users
      flag.targeting.users = [];
      flag.targeting.percentage = 1;
      featureFlags.setFlag(flag);

      // Some users should now have access
      const context: EvaluationContext = { userId: 'regular-user' };
      const result = featureFlags.evaluate('new-api-version', context);

      // Should be consistent for the same user
      const result2 = featureFlags.evaluate('new-api-version', context);
      expect(result.enabled).toBe(result2.enabled);
    });

    it('should handle emergency configuration changes', async () => {
      const dynamicConfig = new DynamicConfigManager(getDefaultAppConfig());

      // Emergency: Rate limiting needs adjustment
      await dynamicConfig.setValue('rateLimits.free.rpm', 5, 'admin', 'Emergency rate limit adjustment');

      // Verify change
      expect(dynamicConfig.getValue('rateLimits.free.rpm')).toBe(5);

      // Check history
      const history = dynamicConfig.getHistory();
      const emergencyChange = history[0];

      expect(emergencyChange.author).toBe('admin');
      expect(emergencyChange.reason).toContain('Emergency');
      expect(emergencyChange.path).toBe('rateLimits.free.rpm');

      // If needed, rollback
      const previousVersion = dynamicConfig.getCurrentVersion() - 1;
      await dynamicConfig.rollback(previousVersion, 'admin', 'Rollback emergency change');

      expect(dynamicConfig.getValue('rateLimits.free.rpm')).toBe(10); // Default value
    });
  });

  describe('Configuration Export and Import', () => {
    it('should export and import feature flags', () => {
      const manager1 = new FeatureFlagManager();
      const manager2 = new FeatureFlagManager();

      // Create flags in manager1
      const flag1 = createFeatureFlag('flag-1', true);
      const flag2 = createFeatureFlag('flag-2', false);
      manager1.setFlag(flag1);
      manager1.setFlag(flag2);

      // Export
      const exported = manager1.export();

      // Import to manager2
      manager2.import(exported);

      // Verify
      expect(manager2.getAllFlags()).toHaveLength(2);
      expect(manager2.isEnabled('flag-1')).toBe(true);
      expect(manager2.isEnabled('flag-2')).toBe(false);
    });

    it('should export and import configuration', async () => {
      const manager1 = new DynamicConfigManager(getDefaultAppConfig());
      const manager2 = new DynamicConfigManager(getDefaultAppConfig());

      // Make changes in manager1
      await manager1.setValue('version', '2.0.0', 'admin');
      await manager1.setValue('environment', 'staging', 'admin');

      // Export
      const exported = manager1.export();

      // Import to manager2
      await manager2.import(exported, 'admin');

      // Verify
      expect(manager2.getValue('version')).toBe('2.0.0');
      expect(manager2.getValue('environment')).toBe('staging');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of feature flags', () => {
      const manager = new FeatureFlagManager();

      // Create 1000 feature flags
      for (let i = 0; i < 1000; i++) {
        const flag = createFeatureFlag(`flag-${i}`, i % 2 === 0);
        manager.setFlag(flag);
      }

      expect(manager.getAllFlags()).toHaveLength(1000);

      // Evaluation should still be fast
      const start = performance.now();
      const enabled = manager.isEnabled('flag-500');
      const duration = performance.now() - start;

      expect(enabled).toBe(true);
      expect(duration).toBeLessThan(10); // Should be very fast
    });

    it('should handle large numbers of experiment assignments', () => {
      const abTesting = new ABTestingManager();

      const experiment = createABTest(
        'large-test',
        { variant: 'A' },
        { variant: 'B' },
        ['conversion']
      );

      experiment.enabled = true;
      abTesting.setExperiment(experiment);

      // Assign 10,000 users
      for (let i = 0; i < 10000; i++) {
        const context: EvaluationContext = { userId: `user-${i}` };
        abTesting.assignVariant('large-test', context);
      }

      const stats = abTesting.getExperimentStats('large-test');
      expect(stats?.totalAssignments).toBe(10000);
    });

    it('should handle rapid configuration changes', async () => {
      const dynamicConfig = new DynamicConfigManager(getDefaultAppConfig());

      const subscriber = vi.fn();
      dynamicConfig.subscribe('test', subscriber);

      // Make 100 rapid changes
      const changes = [];
      for (let i = 0; i < 100; i++) {
        changes.push(
          dynamicConfig.setValue(`test-field-${i}`, i, 'test-user')
        );
      }

      await Promise.all(changes);

      // All changes should be applied
      expect(subscriber).toHaveBeenCalledTimes(100);
      expect(dynamicConfig.getCurrentVersion()).toBeGreaterThan(100);
    });
  });
});
