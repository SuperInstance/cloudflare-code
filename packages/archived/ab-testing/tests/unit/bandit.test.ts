/**
 * Unit tests for Multi-Armed Bandit
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiArmedBandit,
  ContextualBandit,
  createBandit
} from '../../src/bandit/bandit';
import type { ExperimentConfig } from '../../src/types/experiment';

describe('MultiArmedBandit', () => {
  let bandit: MultiArmedBandit;
  let experiment: ExperimentConfig;

  beforeEach(() => {
    experiment = {
      id: 'bandit-exp',
      name: 'Bandit Experiment',
      description: 'Test bandit',
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
          id: 'arm1',
          name: 'Arm 1',
          description: 'First arm',
          weight: 0.5,
          parameters: {}
        },
        {
          id: 'arm2',
          name: 'Arm 2',
          description: 'Second arm',
          weight: 0.5,
          parameters: {}
        },
        {
          id: 'arm3',
          name: 'Arm 3',
          description: 'Third arm',
          weight: 0.5,
          parameters: {}
        }
      ],
      metrics: [
        {
          id: 'reward',
          name: 'Reward',
          description: 'Reward metric',
          type: 'continuous',
          direction: 'higher_is_better',
          primary: true,
          minimumDetectableEffect: 0.05,
          power: 0.8,
          alpha: 0.05
        }
      ],
      allocationStrategy: 'epsilon_greedy',
      targetSampleSize: 1000,
      minimumDuration: 7 * 24 * 60 * 60 * 1000,
      maximumDuration: 30 * 24 * 60 * 60 * 1000,
      tags: []
    };

    bandit = createBandit(experiment, {
      algorithm: 'epsilon_greedy',
      epsilon: 0.1
    }) as MultiArmedBandit;
  });

  describe('initialization', () => {
    it('should initialize arms', () => {
      const state = bandit.getState();

      expect(state.arms.size).toBe(3);
      expect(state.totalPulls).toBe(0);
      expect(state.algorithm).toBe('epsilon_greedy');
    });

    it('should initialize all arms with zero pulls', () => {
      const state = bandit.getState();

      for (const arm of state.arms.values()) {
        expect(arm.pulls).toBe(0);
        expect(arm.reward).toBe(0);
        expect(arm.averageReward).toBe(0);
      }
    });
  });

  describe('selectArm', () => {
    it('should select an arm', () => {
      const result = bandit.selectArm();

      expect(result.variantId).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.algorithm).toBe('epsilon_greedy');
      expect(result.metadata.type).toMatch(/exploration|exploitation/);
    });

    it('should explore with probability epsilon', () => {
      let explorationCount = 0;
      const trials = 1000;

      for (let i = 0; i < trials; i++) {
        const result = bandit.selectArm();
        if (result.metadata.type === 'exploration') {
          explorationCount++;
        }
      }

      const explorationRate = explorationCount / trials;

      // Should be around 0.1 (epsilon)
      expect(explorationRate).toBeGreaterThan(0.05);
      expect(explorationRate).toBeLessThan(0.15);
    });

    it('should exploit best arm when not exploring', () => {
      // Give arm1 some rewards
      bandit.updateArm('arm1', 1);
      bandit.updateArm('arm1', 1);
      bandit.updateArm('arm1', 1);

      // Give arm2 worse rewards
      bandit.updateArm('arm2', 0);
      bandit.updateArm('arm2', 0);

      let exploitationCount = 0;
      let arm1Selected = 0;
      const trials = 100;

      for (let i = 0; i < trials; i++) {
        const result = bandit.selectArm();
        if (result.metadata.type === 'exploitation') {
          exploitationCount++;
          if (result.variantId === 'arm1') {
            arm1Selected++;
          }
        }
      }

      // Most exploitations should select arm1
      expect(arm1Selected).toBeGreaterThan(exploitationCount * 0.8);
    });
  });

  describe('updateArm', () => {
    it('should update arm with reward', () => {
      const result = bandit.updateArm('arm1', 1);

      expect(result.arm.variantId).toBe('arm1');
      expect(result.arm.pulls).toBe(1);
      expect(result.arm.reward).toBe(1);
      expect(result.arm.averageReward).toBe(1);
      expect(result.change).toBe(1);
    });

    it('should calculate average reward correctly', () => {
      bandit.updateArm('arm1', 1);
      bandit.updateArm('arm1', 0);
      bandit.updateArm('arm1', 1);

      const arm = bandit.getArmStats('arm1');

      expect(arm?.pulls).toBe(3);
      expect(arm?.reward).toBe(2);
      expect(arm?.averageReward).toBeCloseTo(0.667, 2);
    });

    it('should track best arm', () => {
      bandit.updateArm('arm1', 0.5);
      bandit.updateArm('arm2', 0.8);
      bandit.updateArm('arm3', 0.3);

      const bestArm = bandit.getBestArm();

      expect(bestArm?.variantId).toBe('arm2');
    });

    it('should detect new best arm', () => {
      bandit.updateArm('arm1', 0.5);

      const result1 = bandit.updateArm('arm2', 0.8);
      expect(result1.isNewBest).toBe(true);

      const result2 = bandit.updateArm('arm1', 0.9);
      expect(result2.isNewBest).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset bandit state', () => {
      bandit.updateArm('arm1', 1);
      bandit.updateArm('arm2', 0);

      bandit.reset();

      const state = bandit.getState();

      expect(state.totalPulls).toBe(0);
      expect(state.version).toBe(0);

      for (const arm of state.arms.values()) {
        expect(arm.pulls).toBe(0);
        expect(arm.reward).toBe(0);
      }
    });
  });

  describe('calculateRegret', () => {
    it('should calculate zero regret for single arm', () => {
      bandit.updateArm('arm1', 1);
      bandit.updateArm('arm1', 1);

      const regret = bandit.calculateRegret();

      expect(regret).toBe(0);
    });

    it('should calculate regret for suboptimal arms', () => {
      // Best arm
      bandit.updateArm('arm1', 1);
      bandit.updateArm('arm1', 1);

      // Suboptimal arm
      bandit.updateArm('arm2', 0);
      bandit.updateArm('arm2', 0);

      const regret = bandit.calculateRegret();

      expect(regret).toBeGreaterThan(0);
    });

    it('should decrease regret with learning', () => {
      const regrets: number[] = [];

      // Train bandit to prefer arm1
      for (let i = 0; i < 100; i++) {
        bandit.updateArm('arm1', 1);
        bandit.updateArm('arm2', 0);
        bandit.updateArm('arm3', 0);

        // Make selections
        bandit.selectArm();

        regrets.push(bandit.calculateRegret());
      }

      // Regret should stabilize
      expect(regrets[regrets.length - 1]).toBeLessThanOrEqual(regrets[0]);
    });
  });

  describe('UCB algorithm', () => {
    beforeEach(() => {
      bandit = createBandit(experiment, {
        algorithm: 'ucb',
        confidence: 2.0
      }) as MultiArmedBandit;
    });

    it('should explore unexplored arms first', () => {
      // Give arm1 some pulls
      bandit.updateArm('arm1', 0.5);

      // Unexplored arms should be selected
      let unexploredSelected = 0;
      for (let i = 0; i < 10; i++) {
        const result = bandit.selectArm();
        if (result.variantId === 'arm2' || result.variantId === 'arm3') {
          unexploredSelected++;
        }
      }

      expect(unexploredSelected).toBeGreaterThan(0);
    });

    it('should balance exploration and exploitation', () => {
      // Give all arms some data
      bandit.updateArm('arm1', 0.7);
      bandit.updateArm('arm2', 0.5);
      bandit.updateArm('arm3', 0.3);

      const selections = new Map<string, number>();

      for (let i = 0; i < 100; i++) {
        const result = bandit.selectArm();
        selections.set(
          result.variantId,
          (selections.get(result.variantId) ?? 0) + 1
        );
      }

      // arm1 should be selected most often (highest reward)
      expect(selections.get('arm1')).toBeGreaterThan((selections.get('arm2') ?? 0));
      expect(selections.get('arm1')).toBeGreaterThan((selections.get('arm3') ?? 0));
    });
  });

  describe('Thompson Sampling', () => {
    beforeEach(() => {
      bandit = createBandit(experiment, {
        algorithm: 'thompson_sampling',
        alpha: 1,
        beta: 1
      }) as MultiArmedBandit;
    });

    it('should sample from posterior distributions', () => {
      bandit.updateArm('arm1', 1);
      bandit.updateArm('arm1', 1);
      bandit.updateArm('arm1', 0);

      bandit.updateArm('arm2', 0);
      bandit.updateArm('arm2', 0);
      bandit.updateArm('arm2', 0);

      let arm1Selected = 0;
      const trials = 100;

      for (let i = 0; i < trials; i++) {
        const result = bandit.selectArm();
        if (result.variantId === 'arm1') {
          arm1Selected++;
        }
      }

      // arm1 should be selected more often (better performance)
      expect(arm1Selected).toBeGreaterThan(trials * 0.6);
    });

    it('should update beta parameters', () => {
      bandit.updateArm('arm1', 1);
      bandit.updateArm('arm1', 1);
      bandit.updateArm('arm1', 0);

      const arm = bandit.getArmStats('arm1');

      expect(arm?.alpha).toBe(3); // 1 + 2 successes
      expect(arm?.beta).toBe(2); // 1 + 1 failure
    });
  });
});

describe('ContextualBandit', () => {
  let contextualBandit: ContextualBandit;
  let experiment: ExperimentConfig;

  beforeEach(() => {
    experiment = {
      id: 'contextual-exp',
      name: 'Contextual Bandit',
      description: 'Test contextual bandit',
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
          id: 'arm1',
          name: 'Arm 1',
          description: 'First arm',
          weight: 0.5,
          parameters: {}
        },
        {
          id: 'arm2',
          name: 'Arm 2',
          description: 'Second arm',
          weight: 0.5,
          parameters: {}
        }
      ],
      metrics: [
        {
          id: 'reward',
          name: 'Reward',
          description: 'Reward',
          type: 'continuous',
          direction: 'higher_is_better',
          primary: true,
          minimumDetectableEffect: 0.05,
          power: 0.8,
          alpha: 0.05
        }
      ],
      allocationStrategy: 'thompson_sampling',
      targetSampleSize: 1000,
      minimumDuration: 7 * 24 * 60 * 60 * 1000,
      maximumDuration: 30 * 24 * 60 * 60 * 1000,
      tags: []
    };

    contextualBandit = createBandit(experiment, {
      algorithm: 'thompson_sampling',
      contextFeatures: ['device', 'location']
    }) as ContextualBandit;
  });

  describe('selectArmWithContext', () => {
    it('should select arm with context', () => {
      const context = new Map([
        ['device', 'mobile'],
        ['location', 'US']
      ]);

      const result = contextualBandit.selectArmWithContext(context);

      expect(result.variantId).toBeDefined();
    });
  });

  describe('updateWithContext', () => {
    it('should track context history', () => {
      const context = new Map([
        ['device', 'mobile'],
        ['location', 'US']
      ]);

      contextualBandit.updateWithContext('arm1', 1, context);

      const history = contextualBandit.getContextHistory();

      expect(history).toHaveLength(1);
      expect(history[0].variantId).toBe('arm1');
      expect(history[0].reward).toBe(1);
    });
  });
});
