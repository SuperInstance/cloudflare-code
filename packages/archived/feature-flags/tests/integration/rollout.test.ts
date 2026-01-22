/**
 * Integration tests for rollout engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RolloutEngine } from '../../src/rollout/engine';
import type { FlagStorageEnv } from '../../src/types/index';

describe('RolloutEngine Integration', () => {
  let engine: RolloutEngine;
  let mockStorage: any;

  beforeEach(() => {
    mockStorage = {
      getFlag: vi.fn(),
      setFlag: vi.fn(),
      setRules: vi.fn(),
      deleteRules: vi.fn(),
      recordEvent: vi.fn(),
    };

    engine = new RolloutEngine({
      FLAGS_DURABLE_OBJECT: {
        idFromName: vi.fn(() => mockStorage),
      },
      ANALYTICS_DURABLE_OBJECT: {
        idFromName: vi.fn(),
      },
    } as FlagStorageEnv);
  });

  describe('percentage rollout', () => {
    it('should start percentage rollout', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const rolloutId = await engine.startPercentageRollout('test_feature', 20);

      expect(rolloutId).toBeDefined();
      expect(rolloutId).toContain('rollout-');

      const status = engine.getRolloutStatus(rolloutId);
      expect(status).toBeDefined();
      expect(status?.type).toBe('percentage');
    });

    it('should update rollout percentage', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const rolloutId = await engine.startPercentageRollout('test_feature', 20);

      await engine.updatePercentageRollout(rolloutId, 50);

      const status = engine.getRolloutStatus(rolloutId);
      expect(status?.currentPercentage).toBe(50);
    });

    it('should validate percentage bounds', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      await expect(
        engine.startPercentageRollout('test_feature', 150)
      ).rejects.toThrow('Percentage must be between 0 and 100');

      await expect(
        engine.startPercentageRollout('test_feature', -10)
      ).rejects.toThrow('Percentage must be between 0 and 100');
    });
  });

  describe('gradual rollout', () => {
    it('should start gradual rollout with stages', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const rolloutId = await engine.startGradualRollout({
        flagKey: 'test_feature',
        strategy: {
          type: 'gradual',
        },
        gradualConfig: {
          stages: [
            { percentage: 10, duration: 1000 },
            { percentage: 50, duration: 2000 },
            { percentage: 100, duration: 0 },
          ],
          interval: 100,
          autoProgress: false,
        },
      });

      expect(rolloutId).toBeDefined();

      const status = engine.getRolloutStatus(rolloutId);
      expect(status?.type).toBe('gradual');
      expect(status?.stages).toHaveLength(3);
    });

    it('should progress through stages', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const rolloutId = await engine.startGradualRollout({
        flagKey: 'test_feature',
        strategy: {
          type: 'gradual',
        },
        gradualConfig: {
          stages: [
            { percentage: 10, duration: 1000 },
            { percentage: 50, duration: 2000 },
          ],
          interval: 100,
          autoProgress: false,
        },
      });

      await engine.progressGradualRollout(rolloutId);

      const status = engine.getRolloutStatus(rolloutId);
      expect(status?.currentStage).toBe(1);
    });
  });

  describe('canary deployment', () => {
    it('should start canary deployment', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const canaryId = await engine.startCanaryDeployment('test_feature', 10, {
        errorRateThreshold: 0.05,
        latencyThreshold: 500,
      });

      expect(canaryId).toBeDefined();

      const canary = engine['canaryDeployments'].get(canaryId);
      expect(canary).toBeDefined();
      expect(canary?.status).toBe('active');
    });

    it('should increase canary percentage', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const canaryId = await engine.startCanaryDeployment('test_feature', 10, {});

      await engine.increaseCanaryPercentage(canaryId, 20);

      const canary = engine['canaryDeployments'].get(canaryId);
      expect(canary?.percentage).toBe(30);
    });

    it('should promote canary to full rollout', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const canaryId = await engine.startCanaryDeployment('test_feature', 10, {});

      await engine.promoteCanary(canaryId);

      const canary = engine['canaryDeployments'].get(canaryId);
      expect(canary?.status).toBe('completed');
    });

    it('should rollback canary', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const canaryId = await engine.startCanaryDeployment('test_feature', 10, {});

      await engine.rollbackCanary(canaryId);

      const canary = engine['canaryDeployments'].get(canaryId);
      expect(canary?.status).toBe('rolled_back');
    });
  });

  describe('blue-green deployment', () => {
    it('should start blue-green deployment', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const deploymentId = await engine.startBlueGreenDeployment(
        'test_feature',
        'green-variant'
      );

      expect(deploymentId).toBeDefined();

      const status = engine.getRolloutStatus(deploymentId);
      expect(status?.type).toBe('blue_green');
    });

    it('should switch to green', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      mockStorage.setRules.mockResolvedValue(undefined);

      const deploymentId = await engine.startBlueGreenDeployment(
        'test_feature',
        'green-variant'
      );

      await engine.switchToGreen(deploymentId);

      const status = engine.getRolloutStatus(deploymentId);
      expect(status?.isGreenActive).toBe(true);
    });

    it('should switch back to blue', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      mockStorage.deleteRules.mockResolvedValue(undefined);

      const deploymentId = await engine.startBlueGreenDeployment(
        'test_feature',
        'green-variant'
      );

      await engine.switchToGreen(deploymentId);
      await engine.switchToBlue(deploymentId);

      const status = engine.getRolloutStatus(deploymentId);
      expect(status?.isGreenActive).toBe(false);
    });
  });

  describe('rollback', () => {
    it('should rollback percentage rollout', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const rolloutId = await engine.startPercentageRollout('test_feature', 50);

      await engine.rollbackRollout(rolloutId);

      const status = engine.getRolloutStatus(rolloutId);
      expect(status?.status).toBe('rolled_back');
    });

    it('should rollback all rollouts for a flag', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      await engine.startPercentageRollout('test_feature', 20);
      await engine.startPercentageRollout('test_feature', 30);

      await engine.rollbackFlagRollouts('test_feature');

      const activeRollouts = engine.getActiveRollouts();
      expect(activeRollouts).toHaveLength(0);
    });
  });

  describe('status queries', () => {
    it('should get rollout status', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      const rolloutId = await engine.startPercentageRollout('test_feature', 20);

      const status = engine.getRolloutStatus(rolloutId);
      expect(status).toBeDefined();
      expect(status?.id).toBe(rolloutId);
    });

    it('should get active rollouts', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      await engine.startPercentageRollout('test_feature', 20);
      await engine.startPercentageRollout('other_feature', 30);

      const activeRollouts = engine.getActiveRollouts();
      expect(activeRollouts).toHaveLength(2);
    });

    it('should get rollout history for flag', async () => {
      mockStorage.getFlag.mockResolvedValue({
        id: '1',
        key: 'test_feature',
        type: 'boolean',
        defaultValue: false,
        state: 'active',
      });

      await engine.startPercentageRollout('test_feature', 20);
      await engine.startPercentageRollout('test_feature', 30);

      const history = engine.getFlagRolloutHistory('test_feature');
      expect(history).toHaveLength(2);
    });
  });
});
