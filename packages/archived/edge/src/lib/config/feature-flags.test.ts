/**
 * Feature Flags System Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FeatureFlagManager,
  createFeatureFlag,
  createPercentageRolloutFlag,
  createUserTargetedFlag,
  createTierTargetedFlag,
} from './feature-flags';
import type { FeatureFlag, EvaluationContext } from './types';

describe('FeatureFlagManager', () => {
  let manager: FeatureFlagManager;

  beforeEach(() => {
    manager = new FeatureFlagManager();
  });

  describe('Basic Operations', () => {
    it('should create a new manager with empty flags', () => {
      expect(manager.getAllFlags()).toHaveLength(0);
    });

    it('should add a feature flag', () => {
      const flag = createFeatureFlag('test-flag', true);
      manager.setFlag(flag);

      expect(manager.getAllFlags()).toHaveLength(1);
      expect(manager.getFlag('test-flag')).toEqual(flag);
    });

    it('should delete a feature flag', () => {
      const flag = createFeatureFlag('test-flag', true);
      manager.setFlag(flag);

      expect(manager.deleteFlag('test-flag')).toBe(true);
      expect(manager.getFlag('test-flag')).toBeUndefined();
    });

    it('should update a feature flag', () => {
      const flag = createFeatureFlag('test-flag', false);
      manager.setFlag(flag);

      const updated = manager.updateFlag('test-flag', { enabled: true });
      expect(updated?.enabled).toBe(true);
      expect(manager.getFlag('test-flag')?.enabled).toBe(true);
    });

    it('should enable/disable a flag', () => {
      const flag = createFeatureFlag('test-flag', false);
      manager.setFlag(flag);

      expect(manager.setFlagEnabled('test-flag', true)).toBe(true);
      expect(manager.isEnabled('test-flag')).toBe(true);

      expect(manager.setFlagEnabled('test-flag', false)).toBe(true);
      expect(manager.isEnabled('test-flag')).toBe(false);
    });
  });

  describe('Flag Evaluation', () => {
    it('should evaluate disabled flag as false', () => {
      const flag = createFeatureFlag('test-flag', false);
      manager.setFlag(flag);

      const result = manager.evaluate('test-flag');
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('should evaluate enabled flag with no targeting as true', () => {
      const flag = createFeatureFlag('test-flag', true);
      manager.setFlag(flag);

      const result = manager.evaluate('test-flag');
      expect(result.enabled).toBe(true);
    });

    it('should evaluate non-existent flag as false', () => {
      const result = manager.evaluate('non-existent');
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('User Targeting', () => {
    it('should enable flag for targeted user', () => {
      const flag = createUserTargetedFlag('test-flag', ['user-123']);
      manager.setFlag(flag);

      const context: EvaluationContext = { userId: 'user-123' };
      expect(manager.isEnabled('test-flag', context)).toBe(true);
    });

    it('should disable flag for non-targeted user', () => {
      const flag = createUserTargetedFlag('test-flag', ['user-123']);
      manager.setFlag(flag);

      const context: EvaluationContext = { userId: 'user-456' };
      expect(manager.isEnabled('test-flag', context)).toBe(false);
    });

    it('should add user to targeting list', () => {
      const flag = createFeatureFlag('test-flag', true);
      manager.setFlag(flag);

      manager.addTargetUser('test-flag', 'user-123');
      expect(flag.targeting.users).toContain('user-123');
    });

    it('should remove user from targeting list', () => {
      const flag = createUserTargetedFlag('test-flag', ['user-123', 'user-456']);
      manager.setFlag(flag);

      manager.removeTargetUser('test-flag', 'user-123');
      expect(flag.targeting.users).not.toContain('user-123');
      expect(flag.targeting.users).toContain('user-456');
    });
  });

  describe('Tier Targeting', () => {
    it('should enable flag for matching tier', () => {
      const flag = createTierTargetedFlag('test-flag', 'pro');
      manager.setFlag(flag);

      const context: EvaluationContext = { tier: 'pro' };
      expect(manager.isEnabled('test-flag', context)).toBe(true);
    });

    it('should disable flag for non-matching tier', () => {
      const flag = createTierTargetedFlag('test-flag', 'pro');
      manager.setFlag(flag);

      const context: EvaluationContext = { tier: 'free' };
      expect(manager.isEnabled('test-flag', context)).toBe(false);
    });

    it('should enable flag for all tiers when tier is "all"', () => {
      const flag = createFeatureFlag('test-flag', true, {
        targeting: { tier: 'all', users: [], percentage: 0, organizations: [] },
      });
      manager.setFlag(flag);

      expect(manager.isEnabled('test-flag', { tier: 'free' })).toBe(true);
      expect(manager.isEnabled('test-flag', { tier: 'pro' })).toBe(true);
      expect(manager.isEnabled('test-flag', { tier: 'enterprise' })).toBe(true);
    });
  });

  describe('Percentage Rollout', () => {
    it('should enable flag for users within percentage', () => {
      const flag = createPercentageRolloutFlag('test-flag', 50);
      manager.setFlag(flag);

      // User 'user-1' should get a consistent bucket
      const context: EvaluationContext = { userId: 'user-1' };
      const result = manager.evaluate('test-flag', context);

      // The user should either be in or out, but consistent
      const firstResult = result.enabled;
      const secondResult = manager.evaluate('test-flag', context).enabled;

      expect(firstResult).toBe(secondResult);
    });

    it('should set percentage rollout', () => {
      const flag = createFeatureFlag('test-flag', true);
      manager.setFlag(flag);

      manager.setPercentageRollout('test-flag', 75);
      expect(flag.targeting.percentage).toBe(75);
    });

    it('should reject invalid percentage', () => {
      const flag = createFeatureFlag('test-flag', true);
      manager.setFlag(flag);

      expect(() => manager.setPercentageRollout('test-flag', 150)).toThrow();
      expect(() => manager.setPercentageRollout('test-flag', -10)).toThrow();
    });

    it('should provide consistent bucket assignment', () => {
      const flag = createPercentageRolloutFlag('test-flag', 100);
      manager.setFlag(flag);

      const context: EvaluationContext = { userId: 'test-user' };

      // Multiple evaluations should return the same result
      const results = Array.from({ length: 10 }, () =>
        manager.evaluate('test-flag', context).enabled
      );

      expect(results.every((r) => r === results[0])).toBe(true);
    });
  });

  describe('Organization Targeting', () => {
    it('should enable flag for targeted organization', () => {
      const flag = createFeatureFlag('test-flag', true, {
        targeting: {
          users: [],
          percentage: 0,
          organizations: ['org-123'],
          tier: 'all',
        },
      });
      manager.setFlag(flag);

      const context: EvaluationContext = { organizationId: 'org-123' };
      expect(manager.isEnabled('test-flag', context)).toBe(true);
    });

    it('should disable flag for non-targeted organization', () => {
      const flag = createFeatureFlag('test-flag', true, {
        targeting: {
          users: [],
          percentage: 0,
          organizations: ['org-123'],
          tier: 'all',
        },
      });
      manager.setFlag(flag);

      const context: EvaluationContext = { organizationId: 'org-456' };
      expect(manager.isEnabled('test-flag', context)).toBe(false);
    });

    it('should add organization to targeting list', () => {
      const flag = createFeatureFlag('test-flag', true);
      manager.setFlag(flag);

      manager.addTargetOrganization('test-flag', 'org-123');
      expect(flag.targeting.organizations).toContain('org-123');
    });

    it('should remove organization from targeting list', () => {
      const flag = createFeatureFlag('test-flag', true, {
        targeting: {
          users: [],
          percentage: 0,
          organizations: ['org-123', 'org-456'],
          tier: 'all',
        },
      });
      manager.setFlag(flag);

      manager.removeTargetOrganization('test-flag', 'org-123');
      expect(flag.targeting.organizations).not.toContain('org-123');
    });
  });

  describe('Custom Targeting', () => {
    it('should evaluate environment targeting', () => {
      const flag = createFeatureFlag('test-flag', true, {
        targeting: {
          users: [],
          percentage: 0,
          organizations: [],
          tier: 'all',
          custom: { environment: 'production' },
        },
      });
      manager.setFlag(flag);

      expect(
        manager.isEnabled('test-flag', { environment: 'production' })
      ).toBe(true);
      expect(
        manager.isEnabled('test-flag', { environment: 'development' })
      ).toBe(false);
    });

    it('should evaluate country targeting', () => {
      const flag = createFeatureFlag('test-flag', true, {
        targeting: {
          users: [],
          percentage: 0,
          organizations: [],
          tier: 'all',
          custom: { country: ['US', 'CA'] },
        },
      });
      manager.setFlag(flag);

      expect(manager.isEnabled('test-flag', { country: 'US' })).toBe(true);
      expect(manager.isEnabled('test-flag', { country: 'UK' })).toBe(false);
    });
  });

  describe('Flag Expiry', () => {
    it('should disable expired flag', () => {
      const flag = createFeatureFlag('test-flag', true, {
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      });
      manager.setFlag(flag);

      const result = manager.evaluate('test-flag');
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should enable non-expired flag', () => {
      const flag = createFeatureFlag('test-flag', true, {
        expiresAt: Date.now() + 100000, // Expires in the future
      });
      manager.setFlag(flag);

      expect(manager.isEnabled('test-flag')).toBe(true);
    });
  });

  describe('Get Flags for User', () => {
    it('should return all flags for a user', () => {
      const flag1 = createFeatureFlag('flag-1', true);
      const flag2 = createFeatureFlag('flag-2', false);
      const flag3 = createPercentageRolloutFlag('flag-3', 100);

      manager.setFlag(flag1);
      manager.setFlag(flag2);
      manager.setFlag(flag3);

      const context: EvaluationContext = { userId: 'user-123' };
      const userFlags = manager.getFlagsForUser(context);

      expect(userFlags.size).toBe(3);
      expect(userFlags.get('flag-1')).toBe(true);
      expect(userFlags.get('flag-2')).toBe(false);
      expect(userFlags.get('flag-3')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should return accurate statistics', () => {
      const flag1 = createFeatureFlag('flag-1', true);
      const flag2 = createFeatureFlag('flag-2', false);
      const flag3 = createPercentageRolloutFlag('flag-3', 50);

      manager.setFlag(flag1);
      manager.setFlag(flag2);
      manager.setFlag(flag3);

      const stats = manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.enabled).toBe(2);
      expect(stats.disabled).toBe(1);
      expect(stats.withRollout).toBe(1);
    });
  });

  describe('Import/Export', () => {
    it('should export all flags', () => {
      const flag1 = createFeatureFlag('flag-1', true);
      const flag2 = createFeatureFlag('flag-2', false);

      manager.setFlag(flag1);
      manager.setFlag(flag2);

      const exported = manager.export();
      expect(exported).toHaveLength(2);
    });

    it('should import flags', () => {
      const flags = [
        createFeatureFlag('flag-1', true),
        createFeatureFlag('flag-2', false),
      ];

      manager.import(flags);

      expect(manager.getAllFlags()).toHaveLength(2);
      expect(manager.isEnabled('flag-1')).toBe(true);
      expect(manager.isEnabled('flag-2')).toBe(false);
    });

    it('should clear existing flags on import', () => {
      manager.setFlag(createFeatureFlag('old-flag', true));

      const flags = [createFeatureFlag('new-flag', true)];
      manager.import(flags);

      expect(manager.getAllFlags()).toHaveLength(1);
      expect(manager.getFlag('new-flag')).toBeDefined();
      expect(manager.getFlag('old-flag')).toBeUndefined();
    });
  });
});

describe('Feature Flag Helpers', () => {
  it('should create basic feature flag', () => {
    const flag = createFeatureFlag('test', true);

    expect(flag.name).toBe('test');
    expect(flag.enabled).toBe(true);
    expect(flag.targeting.users).toEqual([]);
    expect(flag.targeting.percentage).toBe(0);
  });

  it('should create percentage rollout flag', () => {
    const flag = createPercentageRolloutFlag('test', 75);

    expect(flag.enabled).toBe(true);
    expect(flag.targeting.percentage).toBe(75);
  });

  it('should create user-targeted flag', () => {
    const flag = createUserTargetedFlag('test', ['user-1', 'user-2']);

    expect(flag.targeting.users).toEqual(['user-1', 'user-2']);
  });

  it('should create tier-targeted flag', () => {
    const flag = createTierTargetedFlag('test', 'enterprise');

    expect(flag.targeting.tier).toBe('enterprise');
  });

  it('should merge custom options', () => {
    const flag = createFeatureFlag('test', true, {
      description: 'Test flag',
      owner: 'team-a',
    });

    expect(flag.description).toBe('Test flag');
    expect(flag.owner).toBe('team-a');
  });
});
