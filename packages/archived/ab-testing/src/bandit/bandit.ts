/**
 * Multi-Armed Bandit - Implements various bandit algorithms for
 * adaptive experimentation and reward optimization
 */

import type {
  ExperimentConfig,
  VariantId,
  BanditParams,
  Assignment
} from '../types/experiment.js';
import { BanditAlgorithmError } from '../types/errors.js';

/**
 * Bandit arm state
 */
export interface BanditArm {
  /** Variant ID */
  variantId: VariantId;
  /** Number of pulls (assignments) */
  pulls: number;
  /** Cumulative reward */
  reward: number;
  /** Average reward */
  averageReward: number;
  /** Alpha parameter (for Thompson sampling) */
  alpha?: number;
  /** Beta parameter (for Thompson sampling) */
  beta?: number;
  /** Last update timestamp */
  lastUpdate: number;
}

/**
 * Bandit state
 */
export interface BanditState {
  /** Algorithm being used */
  algorithm: BanditParams['algorithm'];
  /** Arms (variants) */
  arms: Map<VariantId, BanditArm>;
  /** Total pulls across all arms */
  totalPulls: number;
  /** Exploration parameter */
  epsilon?: number;
  /** Confidence parameter */
  confidence?: number;
  /** Context features (for contextual bandits) */
  contextFeatures?: string[];
  /** State version */
  version: number;
}

/**
 * Selection result
 */
export interface SelectionResult {
  /** Selected variant ID */
  variantId: VariantId;
  /** Selection metadata */
  metadata: {
    /** Algorithm used */
    algorithm: string;
    /** Exploration vs exploitation */
    type: 'exploration' | 'exploitation';
    /** Confidence scores */
    scores: Map<VariantId, number>;
    /** Reason for selection */
    reason: string;
  };
}

/**
 * Update result
 */
export interface UpdateResult {
  /** Updated arm */
  arm: BanditArm;
  /** New average reward */
  newAverage: number;
  /** Change in average */
  change: number;
  /** Whether this is a new best arm */
  isNewBest: boolean;
}

/**
 * Reward calculation options
 */
export interface RewardOptions {
  /** Whether to use binary reward (0 or 1) */
  binary?: boolean;
  /** Reward scaling factor */
  scale?: number;
  /** Minimum reward */
  minReward?: number;
  /** Maximum reward */
  maxReward?: number;
}

/**
 * Multi-Armed Bandit class
 */
export class MultiArmedBandit {
  private state: BanditState;
  private params: Required<BanditParams>;

  constructor(config: ExperimentConfig, params: BanditParams) {
    this.params = {
      algorithm: params.algorithm,
      epsilon: params.epsilon ?? 0.1,
      confidence: params.confidence ?? 0.95,
      alpha: params.alpha ?? 1,
      beta: params.beta ?? 1,
      contextFeatures: params.contextFeatures ?? []
    };

    // Initialize bandit state
    this.state = this.initializeState(config);
  }

  /**
   * Select an arm (variant) using the configured algorithm
   */
  selectArm(context?: Map<string, number>): SelectionResult {
    switch (this.params.algorithm) {
      case 'epsilon_greedy':
        return this.epsilonGreedy();
      case 'ucb':
        return this.upperConfidenceBound();
      case 'thompson_sampling':
        return this.thompsonSampling();
      default:
        throw new BanditAlgorithmError(this.params.algorithm, 'Unknown algorithm');
    }
  }

  /**
   * Update arm state with observed reward
   */
  updateArm(variantId: VariantId, reward: number, options?: RewardOptions): UpdateResult {
    const arm = this.state.arms.get(variantId);

    if (!arm) {
      throw new BanditAlgorithmError(this.params.algorithm, `Arm ${variantId} not found`);
    }

    // Process reward
    let processedReward = reward;
    if (options?.binary) {
      processedReward = reward > 0 ? 1 : 0;
    } else if (options?.scale) {
      processedReward = reward * options.scale;
    }

    // Clamp to range
    if (options?.minReward !== undefined || options?.maxReward !== undefined) {
      const min = options.minReward ?? -Infinity;
      const max = options.maxReward ?? Infinity;
      processedReward = Math.max(min, Math.min(max, processedReward));
    }

    // Update arm state
    const oldAverage = arm.averageReward;
    arm.pulls++;
    arm.reward += processedReward;
    arm.averageReward = arm.reward / arm.pulls;
    arm.lastUpdate = Date.now();

    // Update Thompson sampling parameters
    if (this.params.algorithm === 'thompson_sampling') {
      const successes = Math.round(arm.reward);
      const failures = arm.pulls - successes;
      arm.alpha = (this.params.alpha ?? 1) + successes;
      arm.beta = (this.params.beta ?? 1) + failures;
    }

    this.state.totalPulls++;
    this.state.version++;

    // Find best arm
    const bestArm = this.findBestArm();
    const isNewBest = bestArm?.variantId === variantId;

    return {
      arm,
      newAverage: arm.averageReward,
      change: arm.averageReward - oldAverage,
      isNewBest
    };
  }

  /**
   * Get current bandit state
   */
  getState(): BanditState {
    return { ...this.state, arms: new Map(this.state.arms) };
  }

  /**
   * Reset bandit state
   */
  reset(): void {
    const arms = new Map<VariantId, BanditArm>();

    for (const [variantId, arm] of this.state.arms.entries()) {
      arms.set(variantId, {
        variantId: arm.variantId,
        pulls: 0,
        reward: 0,
        averageReward: 0,
        alpha: this.params.alpha,
        beta: this.params.beta,
        lastUpdate: Date.now()
      });
    }

    this.state = {
      algorithm: this.params.algorithm,
      arms,
      totalPulls: 0,
      epsilon: this.params.epsilon,
      confidence: this.params.confidence,
      contextFeatures: this.params.contextFeatures,
      version: 0
    };
  }

  /**
   * Get arm statistics
   */
  getArmStats(variantId: VariantId): BanditArm | null {
    return this.state.arms.get(variantId) ?? null;
  }

  /**
   * Get best performing arm
   */
  getBestArm(): BanditArm | null {
    return this.findBestArm();
  }

  /**
   * Calculate regret (opportunity cost)
   */
  calculateRegret(): number {
    const bestArm = this.findBestArm();
    if (!bestArm || this.state.totalPulls === 0) {
      return 0;
    }

    let totalRegret = 0;

    for (const arm of this.state.arms.values()) {
      const regret = (bestArm.averageReward - arm.averageReward) * arm.pulls;
      totalRegret += regret;
    }

    return totalRegret;
  }

  // Private methods

  private initializeState(config: ExperimentConfig): BanditState {
    const arms = new Map<VariantId, BanditArm>();

    for (const variant of config.variants) {
      arms.set(variant.id, {
        variantId: variant.id,
        pulls: 0,
        reward: 0,
        averageReward: 0,
        alpha: this.params.alpha,
        beta: this.params.beta,
        lastUpdate: Date.now()
      });
    }

    return {
      algorithm: this.params.algorithm,
      arms,
      totalPulls: 0,
      epsilon: this.params.epsilon,
      confidence: this.params.confidence,
      contextFeatures: this.params.contextFeatures,
      version: 0
    };
  }

  /**
   * Epsilon-greedy algorithm
   */
  private epsilonGreedy(): SelectionResult {
    const scores = new Map<VariantId, number>();

    // Calculate scores for all arms
    for (const arm of this.state.arms.values()) {
      scores.set(arm.variantId, arm.averageReward);
    }

    // Explore with probability epsilon
    const explore = Math.random() < (this.params.epsilon ?? 0.1);

    let selectedVariantId: VariantId;

    if (explore) {
      // Exploration: random arm
      const armKeys = Array.from(this.state.arms.keys());
      selectedVariantId = armKeys[Math.floor(Math.random() * armKeys.length)];
    } else {
      // Exploitation: best arm
      const bestArm = this.findBestArm();
      if (!bestArm) {
        // No pulls yet, select random
        const armKeys = Array.from(this.state.arms.keys());
        selectedVariantId = armKeys[Math.floor(Math.random() * armKeys.length)];
      } else {
        selectedVariantId = bestArm.variantId;
      }
    }

    return {
      variantId: selectedVariantId,
      metadata: {
        algorithm: 'epsilon_greedy',
        type: explore ? 'exploration' : 'exploitation',
        scores,
        reason: explore
          ? `Exploring with epsilon=${this.params.epsilon?.toFixed(3)}`
          : 'Exploiting best known arm'
      }
    };
  }

  /**
   * Upper Confidence Bound (UCB) algorithm
   */
  private upperConfidenceBound(): SelectionResult {
    const scores = new Map<VariantId, number>();
    const confidence = this.params.confidence ?? 0.95;

    // Calculate UCB for each arm
    for (const arm of this.state.arms.values()) {
      if (arm.pulls === 0) {
        // Unexplored arm gets infinite score
        scores.set(arm.variantId, Infinity);
      } else {
        const explorationBonus =
          Math.sqrt((confidence * Math.log(this.state.totalPulls + 1)) / arm.pulls);
        const ucb = arm.averageReward + explorationBonus;
        scores.set(arm.variantId, ucb);
      }
    }

    // Select arm with highest UCB
    let bestVariantId: VariantId | null = null;
    let bestScore = -Infinity;

    for (const [variantId, score] of scores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestVariantId = variantId;
      }
    }

    if (!bestVariantId) {
      throw new BanditAlgorithmError('ucb', 'No arms available');
    }

    return {
      variantId: bestVariantId,
      metadata: {
        algorithm: 'ucb',
        type: 'exploitation',
        scores,
        reason: `Selected arm with highest UCB (${bestScore.toFixed(4)})`
      }
    };
  }

  /**
   * Thompson Sampling algorithm
   */
  private thompsonSampling(): SelectionResult {
    const scores = new Map<VariantId, number>();

    // Sample from each arm's posterior and select highest
    for (const arm of this.state.arms.values()) {
      const alpha = arm.alpha ?? this.params.alpha ?? 1;
      const beta = arm.beta ?? this.params.beta ?? 1;

      // Sample from Beta distribution
      const sample = this.betaSample(alpha, beta);
      scores.set(arm.variantId, sample);
    }

    // Select arm with highest sample
    let bestVariantId: VariantId | null = null;
    let bestScore = -Infinity;

    for (const [variantId, score] of scores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestVariantId = variantId;
      }
    }

    if (!bestVariantId) {
      throw new BanditAlgorithmError('thompson_sampling', 'No arms available');
    }

    return {
      variantId: bestVariantId,
      metadata: {
        algorithm: 'thompson_sampling',
        type: 'exploitation',
        scores,
        reason: `Selected arm with highest Thompson sample (${bestScore.toFixed(4)})`
      }
    };
  }

  /**
   * Sample from Beta distribution
   */
  private betaSample(alpha: number, beta: number): number {
    // Use gamma distribution relation: Beta(alpha, beta) = Gamma(alpha) / (Gamma(alpha) + Gamma(beta))
    const gamma1 = this.gammaSample(alpha);
    const gamma2 = this.gammaSample(beta);

    return gamma1 / (gamma1 + gamma2);
  }

  /**
   * Sample from Gamma distribution
   */
  private gammaSample(alpha: number): number {
    // Marsaglia and Tsang's method for alpha >= 1
    if (alpha >= 1) {
      const d = alpha - 1 / 3;
      const c = 1 / Math.sqrt(9 * d);

      while (true) {
        let x, v;
        do {
          x = this.normalSample();
          v = 1 + c * x;
        } while (v <= 0);

        v = v * v * v;
        const u = Math.random();

        if (u < 1 - 0.0331 * (x * x) * (x * x)) {
          return d * v;
        }

        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
          return d * v;
        }
      }
    }

    // For alpha < 1, use transformation
    return Math.pow(Math.random(), 1 / alpha) * this.gammaSample(alpha + 1);
  }

  /**
   * Sample from standard normal distribution
   */
  private normalSample(): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Find best arm by average reward
   */
  private findBestArm(): BanditArm | null {
    let bestArm: BanditArm | null = null;
    let bestReward = -Infinity;

    for (const arm of this.state.arms.values()) {
      if (arm.pulls > 0 && arm.averageReward > bestReward) {
        bestReward = arm.averageReward;
        bestArm = arm;
      }
    }

    return bestArm;
  }
}

/**
 * Contextual Bandit for personalized selections
 */
export class ContextualBandit extends MultiArmedBandit {
  private contextHistory: Array<{
    context: Map<string, number>;
    variantId: VariantId;
    reward: number;
    timestamp: number;
  }> = [];

  selectArmWithContext(context: Map<string, number>): SelectionResult {
    // Store context for later learning
    // For now, delegate to parent class
    return this.selectArm(context);
  }

  updateWithContext(
    variantId: VariantId,
    reward: number,
    context: Map<string, number>,
    options?: RewardOptions
  ): UpdateResult {
    // Store for offline learning
    this.contextHistory.push({
      context: new Map(context),
      variantId,
      reward,
      timestamp: Date.now()
    });

    // Update arm normally
    return this.updateArm(variantId, reward, options);
  }

  /**
   * Train context policy (simplified)
   */
  trainContextPolicy(): void {
    // In a full implementation, this would train a model
    // to predict best arm based on context
    // For now, this is a placeholder
  }

  /**
   * Get context history
   */
  getContextHistory(): typeof this.contextHistory {
    return [...this.contextHistory];
  }
}

/**
 * Factory function to create bandit instances
 */
export function createBandit(
  config: ExperimentConfig,
  params: BanditParams
): MultiArmedBandit | ContextualBandit {
  if (params.contextFeatures && params.contextFeatures.length > 0) {
    return new ContextualBandit(config, params);
  }

  return new MultiArmedBandit(config, params);
}
