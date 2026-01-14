/**
 * Integration tests for flag evaluation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FlagManager, FlagValidator } from '../../src/flags/manager';
import type { Flag, UserAttributes, EvaluationContext } from '../../src/types/index';

describe('Flag Evaluation Integration', () => {
  let flagManager: FlagManager;
  let mockStorage: any;

  beforeEach(() => {
    // Mock storage
    mockStorage = {
      getFlag: vi.fn(),
      setFlag: vi.fn(),
      deleteFlag: vi.fn(),
      listFlags: vi.fn(),
      getFlagCount: vi.fn(),
      getRules: vi.fn(),
      setRules: vi.fn(),
      deleteRules: vi.fn(),
    };

    flagManager = new FlagManager({
      FLAGS_DURABLE_OBJECT: {
        idFromName: vi.fn(() => mockStorage),
      },
      ANALYTICS_DURABLE_OBJECT: {
        idFromName: vi.fn(),
      },
    } as any);
  });

  describe('flag creation and evaluation', () => {
    it('should create and evaluate boolean flag', async () => {
      const flag: Omit<Flag, 'id' | 'createdAt' | 'updatedAt' | 'version'> = {
        key: 'feature_enabled',
        type: 'boolean',
        description: 'Test feature',
        defaultValue: false,
        state: 'active',
        tags: ['test'],
        owner: 'test',
        metadata: {},
      };

      mockStorage.getFlag.mockResolvedValueOnce(undefined);
      mockStorage.setFlag.mockResolvedValueOnce(undefined);
      mockStorage.getRules.mockResolvedValueOnce(undefined);

      const created = await flagManager.createFlag(flag);
      expect(created.key).toBe('feature_enabled');
      expect(created.type).toBe('boolean');
    });

    it('should evaluate flag with rules', async () => {
      const flag: Flag = {
        id: '1',
        key: 'premium_features',
        type: 'boolean',
        description: 'Premium features',
        defaultValue: false,
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        tags: [],
        owner: 'test',
        metadata: {},
      };

      const rules = {
        flagId: 'premium_features',
        rules: [
          {
            id: 'rule1',
            name: 'Premium users',
            conditions: [
              {
                attribute: 'customAttributes.tier',
                operator: 'equals',
                value: 'premium',
              },
            ],
            逻辑: 'AND' as const,
            variant: 'true',
            enabled: true,
            priority: 100,
            rolloutPercentage: 100,
          },
        ],
        updatedAt: new Date(),
        version: 1,
      };

      const context: EvaluationContext = {
        userId: 'user123',
        attributes: {
          userId: 'user123',
          customAttributes: {
            tier: 'premium',
          },
        },
      };

      mockStorage.getFlag.mockResolvedValueOnce(flag);
      mockStorage.getRules.mockResolvedValueOnce(rules);

      const result = await flagManager.evaluateFlag('premium_features', context);
      expect(result.value).toBe(true);
      expect(result.reason).toBe('rule_match');
    });

    it('should evaluate flag with percentage rollout', async () => {
      const flag: Flag = {
        id: '1',
        key: 'new_feature',
        type: 'boolean',
        description: 'New feature',
        defaultValue: false,
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        tags: [],
        owner: 'test',
        metadata: {},
      };

      const rules = {
        flagId: 'new_feature',
        rules: [
          {
            id: 'rule1',
            name: '50% rollout',
            conditions: [],
            逻辑: 'AND' as const,
            enabled: true,
            priority: 100,
            rolloutPercentage: 50,
          },
        ],
        updatedAt: new Date(),
        version: 1,
      };

      const context: EvaluationContext = {
        userId: 'user123',
        attributes: {
          userId: 'user123',
        },
      };

      mockStorage.getFlag.mockResolvedValueOnce(flag);
      mockStorage.getRules.mockResolvedValueOnce(rules);

      const result = await flagManager.evaluateFlag('new_feature', context);
      expect([true, false]).toContain(result.value);
    });
  });

  describe('batch evaluation', () => {
    it('should evaluate multiple flags', async () => {
      const flags: Flag[] = [
        {
          id: '1',
          key: 'flag1',
          type: 'boolean',
          description: 'Flag 1',
          defaultValue: true,
          state: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          tags: [],
          owner: 'test',
          metadata: {},
        },
        {
          id: '2',
          key: 'flag2',
          type: 'boolean',
          description: 'Flag 2',
          defaultValue: false,
          state: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          tags: [],
          owner: 'test',
          metadata: {},
        },
      ];

      const context: EvaluationContext = {
        userId: 'user123',
        attributes: {
          userId: 'user123',
        },
      };

      mockStorage.getFlag.mockImplementation((key: string) => {
        return Promise.resolve(flags.find((f) => f.key === key));
      });
      mockStorage.getRules.mockResolvedValue(undefined);

      const results = await flagManager.batchEvaluateFlags(
        ['flag1', 'flag2'],
        context
      );

      expect(results['flag1']).toBeDefined();
      expect(results['flag2']).toBeDefined();
      expect(results['flag1'].value).toBe(true);
      expect(results['flag2'].value).toBe(false);
    });
  });

  describe('flag updates', () => {
    it('should update flag properties', async () => {
      const existingFlag: Flag = {
        id: '1',
        key: 'my_flag',
        type: 'boolean',
        description: 'Old description',
        defaultValue: false,
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        tags: [],
        owner: 'test',
        metadata: {},
      };

      mockStorage.getFlag.mockResolvedValueOnce(existingFlag);
      mockStorage.setFlag.mockResolvedValueOnce(undefined);

      const updated = await flagManager.updateFlag('my_flag', {
        description: 'New description',
        defaultValue: true,
      });

      expect(updated.description).toBe('New description');
      expect(updated.defaultValue).toBe(true);
      expect(updated.version).toBe(2);
    });
  });

  describe('flag validation', () => {
    it('should validate flag data', () => {
      const validFlag = {
        key: 'valid_flag',
        type: 'boolean' as const,
        description: 'Valid flag',
        defaultValue: true,
        state: 'active' as const,
        tags: [],
        owner: 'test',
        metadata: {},
      };

      const errors = FlagValidator.validateFlag(validFlag);
      expect(errors).toHaveLength(0);
    });

    it('should detect invalid flag data', () => {
      const invalidFlag = {
        key: 'invalid flag!',
        type: 'boolean' as const,
        description: '',
        defaultValue: 'not a boolean',
        state: 'active' as const,
        tags: [],
        owner: 'test',
        metadata: {},
      };

      const errors = FlagValidator.validateFlag(invalidFlag);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
