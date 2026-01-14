/**
 * PPO (Proximal Policy Optimization) Agent Implementation
 * State-of-the-art policy gradient method with clipped objective
 */

import { Transition } from '../memory/replay-buffer.js';

export interface PPOConfig {
  stateSize: number;
  actionSize: number;
  learningRate: number;
  gamma: number;
  gaeLambda: number;
  clipRange: number;
  clipRangeVF?: number;
  entropyCoeff: number;
  vfCoeff: number;
  maxGradNorm: number;
  bufferSize: number;
  batchSize: number;
  ppoEpochs: number;
  numMiniBatches: number;
  hiddenLayers: number[];
  activation: 'relu' | 'tanh' | 'sigmoid';
  targetKL: number;
  normalizeAdvantages: boolean;
  normalizeReturns: boolean;
}

export interface RolloutBuffer {
  states: number[][];
  actions: number[];
  logProbs: number[];
  rewards: number[];
  values: number[];
  dones: boolean[];
}

export interface PolicyGradient {
  actor: PolicyNetwork;
  critic: ValueNetwork;
  getAction(state: number[], deterministic: boolean): { action: number; logProb: number };
  evaluateActions(states: number[][], actions: number[]): {
    logProbs: number[];
    values: number[];
    entropy: number;
  };
  getValues(states: number[][]): number[];
}

export interface PolicyNetwork {
  forward(state: number[]): number[];
  forwardBatch(states: number[][]): number[][];
  getLogProb(state: number[], action: number): number;
  getLogProbs(states: number[][], actions: number[]): number[];
  getEntropy(states: number[][]): number;
  train(policyLoss: number, valueLoss?: number): void;
  getWeights(): number[][];
  setWeights(weights: number[][]): void;
}

export interface ValueNetwork {
  forward(state: number[]): number;
  forwardBatch(states: number[][]): number[];
  train(valueLoss: number): void;
  getWeights(): number[][];
  setWeights(weights: number[][]): void;
}

/**
 * PPO Agent
 */
export class PPOAgent {
  protected config: PPOConfig;
  protected policy: PolicyGradient;
  protected rolloutBuffer: RolloutBuffer;
  protected stepCount: number = 0;
  protected epochCount: number = 0;

  constructor(config: PPOConfig, policy: PolicyGradient) {
    this.config = config;
    this.policy = policy;
    this.rolloutBuffer = this.createRolloutBuffer();
  }

  selectAction(state: number[], deterministic: boolean = false): {
    action: number;
    logProb: number;
    value: number;
  } {
    const { action, logProb } = this.policy.getAction(state, deterministic);
    const value = this.policy.critic.forward(state);

    return { action, logProb, value };
  }

  addTransition(
    state: number[],
    action: number,
    logProb: number,
    reward: number,
    value: number,
    done: boolean
  ): void {
    this.rolloutBuffer.states.push(state);
    this.rolloutBuffer.actions.push(action);
    this.rolloutBuffer.logProbs.push(logProb);
    this.rolloutBuffer.rewards.push(reward);
    this.rolloutBuffer.values.push(value);
    this.rolloutBuffer.dones.push(done);

    this.stepCount++;

    if (this.isBufferFull()) {
      this.update();
    }
  }

  protected async update(): Promise<void> {
    // Calculate advantages and returns
    const { advantages, returns } = this.calculateAdvantages();

    // Normalize advantages if configured
    const normalizedAdvantages = this.config.normalizeAdvantages
      ? this.normalize(advantages)
      : advantages;

    // Normalize returns if configured
    const normalizedReturns = this.config.normalizeReturns
      ? this.normalize(returns)
      : returns;

    // PPO update
    for (let epoch = 0; epoch < this.config.ppoEpochs; epoch++) {
      await this.updateEpoch(normalizedAdvantages, normalizedReturns);
    }

    // Clear buffer
    this.rolloutBuffer = this.createRolloutBuffer();
    this.epochCount++;
  }

  protected async updateEpoch(advantages: number[], returns: number[]): Promise<void> {
    const batchSize = this.rolloutBuffer.states.length;
    const miniBatchSize = Math.floor(batchSize / this.config.numMiniBatches);

    // Generate random indices
    const indices = this.generatePermutation(batchSize);

    for (let start = 0; start < batchSize; start += miniBatchSize) {
      const end = Math.min(start + miniBatchSize, batchSize);
      const miniBatchIndices = indices.slice(start, end);

      await this.updateMiniBatch(miniBatchIndices, advantages, returns);
    }
  }

  protected async updateMiniBatch(
    indices: number[],
    advantages: number[],
    returns: number[]
  ): Promise<void> {
    // Gather mini-batch data
    const states = indices.map(i => this.rolloutBuffer.states[i]);
    const actions = indices.map(i => this.rolloutBuffer.actions[i]);
    const oldLogProbs = indices.map(i => this.rolloutBuffer.logProbs[i]);

    // Evaluate actions
    const { logProbs, values, entropy } = this.policy.evaluateActions(states, actions);

    // Calculate ratio
    const ratio = this.calculateRatio(logProbs, oldLogProbs);

    // Calculate policy loss
    const policyLoss = this.calculatePolicyLoss(ratio, advantages, indices, entropy);

    // Calculate value loss
    const valueLoss = this.calculateValueLoss(values, returns, indices);

    // Train networks
    this.policy.actor.train(policyLoss, valueLoss);
    this.policy.critic.train(valueLoss);
  }

  protected calculatePolicyLoss(
    ratio: number[],
    advantages: number[],
    indices: number[],
    entropy: number
  ): number {
    let policyLoss = 0;

    for (let i = 0; i < ratio.length; i++) {
      const r = ratio[i];
      const adv = advantages[indices[i]];

      // Clipped surrogate objective
      const surr1 = r * adv;
      const surr2 = this.clip(r, 1 - this.config.clipRange, 1 + this.config.clipRange) * adv;

      policyLoss -= Math.min(surr1, surr2);
    }

    // Add entropy bonus
    policyLoss -= this.config.entropyCoeff * entropy;

    return policyLoss / ratio.length;
  }

  protected calculateValueLoss(values: number[], returns: number[], indices: number[]): number {
    let valueLoss = 0;

    for (let i = 0; i < values.length; i++) {
      const idx = indices[i];
      const v = values[i];
      const target = returns[idx];

      // Clipped value loss (if configured)
      if (this.config.clipRangeVF !== undefined) {
        const oldValue = this.rolloutBuffer.values[idx];
        const clippedValue = oldValue + this.clip(v - oldValue, -this.config.clipRangeVF, this.config.clipRangeVF);
        const loss1 = Math.pow(v - target, 2);
        const loss2 = Math.pow(clippedValue - target, 2);
        valueLoss += Math.max(loss1, loss2);
      } else {
        valueLoss += Math.pow(v - target, 2);
      }
    }

    return this.config.vfCoeff * (valueLoss / values.length);
  }

  protected calculateRatio(logProbs: number[], oldLogProbs: number[]): number[] {
    const ratio: number[] = [];

    for (let i = 0; i < logProbs.length; i++) {
      ratio.push(Math.exp(logProbs[i] - oldLogProbs[i]));
    }

    return ratio;
  }

  protected calculateAdvantages(): { advantages: number[]; returns: number[] } {
    const advantages = this.calculateGAE();
    const returns = this.calculateReturns(advantages);

    return { advantages, returns };
  }

  protected calculateGAE(): number[] {
    const advantages: number[] = [];
    let lastAdvantage = 0;

    // Iterate backwards
    for (let i = this.rolloutBuffer.states.length - 1; i >= 0; i--) {
      if (this.rolloutBuffer.dones[i]) {
        lastAdvantage = 0;
      }

      const nextValue = i < this.rolloutBuffer.states.length - 1
        ? this.rolloutBuffer.values[i + 1]
        : 0;

      const delta =
        this.rolloutBuffer.rewards[i] +
        this.config.gamma * nextValue * (1 - Number(this.rolloutBuffer.dones[i])) -
        this.rolloutBuffer.values[i];

      lastAdvantage = delta + this.config.gamma * this.config.gaeLambda * lastAdvantage;
      advantages.unshift(lastAdvantage);
    }

    return advantages;
  }

  protected calculateReturns(advantages: number[]): number[] {
    const returns: number[] = [];

    for (let i = 0; i < advantages.length; i++) {
      returns.push(advantages[i] + this.rolloutBuffer.values[i]);
    }

    return returns;
  }

  protected normalize(values: number[]): number[] {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );

    if (std < 1e-8) {
      return values.map(() => 0);
    }

    return values.map(v => (v - mean) / std);
  }

  protected generatePermutation(size: number): number[] {
    const indices = Array.from({ length: size }, (_, i) => i);

    // Fisher-Yates shuffle
    for (let i = size - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    return indices;
  }

  protected clip(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  protected createRolloutBuffer(): RolloutBuffer {
    return {
      states: [],
      actions: [],
      logProbs: [],
      rewards: [],
      values: [],
      dones: [],
    };
  }

  protected isBufferFull(): boolean {
    return this.rolloutBuffer.states.length >= this.config.bufferSize;
  }

  save(path: string): Promise<void> {
    // In production, would save policy and value networks
    return Promise.resolve();
  }

  load(path: string): Promise<void> {
    // In production, would load policy and value networks
    return Promise.resolve();
  }

  getStepCount(): number {
    return this.stepCount;
  }

  getEpochCount(): number {
    return this.epochCount;
  }
}

/**
 * Simple Policy Network Implementation
 */
export class SimplePolicyNetwork implements PolicyNetwork {
  private weights: number[][][][];
  private biases: number[][][];
  private config: {
    stateSize: number;
    actionSize: number;
    hiddenLayers: number[];
    learningRate: number;
    activation: 'relu' | 'tanh' | 'sigmoid';
  };

  constructor(config: {
    stateSize: number;
    actionSize: number;
    hiddenLayers: number[];
    learningRate: number;
    activation: 'relu' | 'tanh' | 'sigmoid';
  }) {
    this.config = config;
    this.weights = this.initializeWeights();
    this.biases = this.initializeBiases();
  }

  private initializeWeights(): number[][][][] {
    const layers = [this.config.stateSize, ...this.config.hiddenLayers, this.config.actionSize];
    const weights: number[][][][] = [];

    for (let i = 0; i < layers.length - 1; i++) {
      const layerWeights: number[][][] = [];
      for (let j = 0; j < layers[i + 1]; j++) {
        const neuronWeights: number[][] = [];
        for (let k = 0; k < layers[i]; k++) {
          neuronWeights.push([Math.random() * 0.2 - 0.1]);
        }
        layerWeights.push(neuronWeights);
      }
      weights.push(layerWeights);
    }

    return weights;
  }

  private initializeBiases(): number[][][] {
    const layers = [...this.config.hiddenLayers, this.config.actionSize];
    const biases: number[][][] = [];

    for (const size of layers) {
      const layerBiases: number[][] = [];
      for (let i = 0; i < size; i++) {
        layerBiases.push([0.0]);
      }
      biases.push(layerBiases);
    }

    return biases;
  }

  forward(state: number[]): number[] {
    // Compute action probabilities
    const logits = this.forwardLayers(state);
    return this.softmax(logits);
  }

  forwardBatch(states: number[][]): number[][] {
    return states.map(state => this.forward(state));
  }

  private forwardLayers(state: number[]): number[] {
    let activations = state;

    for (let i = 0; i < this.weights.length - 1; i++) {
      activations = this.forwardLayer(activations, i);
    }

    // Output layer (no activation)
    const output: number[] = [];
    const lastLayer = this.weights.length - 1;

    for (let j = 0; j < this.weights[lastLayer].length; j++) {
      let sum = this.biases[lastLayer][j][0];
      for (let k = 0; k < activations.length; k++) {
        sum += this.weights[lastLayer][j][k][0] * activations[k];
      }
      output.push(sum);
    }

    return output;
  }

  private forwardLayer(input: number[], layerIdx: number): number[] {
    const weights = this.weights[layerIdx];
    const biases = this.biases[layerIdx];
    const output: number[] = [];

    for (let i = 0; i < weights.length; i++) {
      let sum = biases[i][0];

      for (let j = 0; j < input.length; j++) {
        sum += weights[i][j][0] * input[j];
      }

      output.push(this.activation(sum));
    }

    return output;
  }

  private activation(x: number): number {
    switch (this.config.activation) {
      case 'relu':
        return Math.max(0, x);
      case 'tanh':
        return Math.tanh(x);
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x));
      default:
        return x;
    }
  }

  private softmax(logits: number[]): number[] {
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((a, b) => a + b, 0);

    return expLogits.map(e => e / sumExp);
  }

  getLogProb(state: number[], action: number): number {
    const probs = this.forward(state);
    return Math.log(probs[action] + 1e-10);
  }

  getLogProbs(states: number[][], actions: number[]): number[] {
    return states.map((state, i) => this.getLogProb(state, actions[i]));
  }

  getEntropy(states: number[][]): number {
    let totalEntropy = 0;

    for (const state of states) {
      const probs = this.forward(state);
      let entropy = 0;

      for (const p of probs) {
        if (p > 0) {
          entropy -= p * Math.log(p);
        }
      }

      totalEntropy += entropy;
    }

    return totalEntropy / states.length;
  }

  train(policyLoss: number, valueLoss?: number): void {
    // Simplified training - would use backpropagation in practice
    const learningRate = this.config.learningRate;

    // Simple gradient update
    for (let i = 0; i < this.weights.length; i++) {
      for (let j = 0; j < this.weights[i].length; j++) {
        for (let k = 0; k < this.weights[i][j].length; k++) {
          this.weights[i][j][k][0] -= learningRate * policyLoss * 0.01;
        }
      }
    }
  }

  getWeights(): number[][] {
    return this.weights.map(layer =>
      layer.map(neuron => neuron.map(weights => weights[0]))
    );
  }

  setWeights(weights: number[][]): void {
    // Simplified weight setting
    this.weights = weights.map(layer =>
      layer.map(neuron => neuron.map(weight => [weight]))
    );
  }
}

/**
 * Simple Value Network Implementation
 */
export class SimpleValueNetwork implements ValueNetwork {
  private weights: number[][][][];
  private biases: number[][][];
  private config: {
    stateSize: number;
    hiddenLayers: number[];
    learningRate: number;
    activation: 'relu' | 'tanh' | 'sigmoid';
  };

  constructor(config: {
    stateSize: number;
    hiddenLayers: number[];
    learningRate: number;
    activation: 'relu' | 'tanh' | 'sigmoid';
  }) {
    this.config = config;
    this.weights = this.initializeWeights();
    this.biases = this.initializeBiases();
  }

  private initializeWeights(): number[][][][] {
    const layers = [this.config.stateSize, ...this.config.hiddenLayers, 1];
    const weights: number[][][][] = [];

    for (let i = 0; i < layers.length - 1; i++) {
      const layerWeights: number[][][] = [];
      for (let j = 0; j < layers[i + 1]; j++) {
        const neuronWeights: number[][] = [];
        for (let k = 0; k < layers[i]; k++) {
          neuronWeights.push([Math.random() * 0.2 - 0.1]);
        }
        layerWeights.push(neuronWeights);
      }
      weights.push(layerWeights);
    }

    return weights;
  }

  private initializeBiases(): number[][][] {
    const layers = [...this.config.hiddenLayers, 1];
    const biases: number[][][] = [];

    for (const size of layers) {
      const layerBiases: number[][] = [];
      for (let i = 0; i < size; i++) {
        layerBiases.push([0.0]);
      }
      biases.push(layerBiases);
    }

    return biases;
  }

  forward(state: number[]): number {
    let activations = state;

    for (let i = 0; i < this.weights.length - 1; i++) {
      activations = this.forwardLayer(activations, i);
    }

    // Output layer
    const lastLayer = this.weights.length - 1;
    let output = this.biases[lastLayer][0][0];

    for (let i = 0; i < activations.length; i++) {
      output += this.weights[lastLayer][0][i][0] * activations[i];
    }

    return output;
  }

  forwardBatch(states: number[][]): number[] {
    return states.map(state => this.forward(state));
  }

  private forwardLayer(input: number[], layerIdx: number): number[] {
    const weights = this.weights[layerIdx];
    const biases = this.biases[layerIdx];
    const output: number[] = [];

    for (let i = 0; i < weights.length; i++) {
      let sum = biases[i][0];

      for (let j = 0; j < input.length; j++) {
        sum += weights[i][j][0] * input[j];
      }

      output.push(this.activation(sum));
    }

    return output;
  }

  private activation(x: number): number {
    switch (this.config.activation) {
      case 'relu':
        return Math.max(0, x);
      case 'tanh':
        return Math.tanh(x);
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x));
      default:
        return x;
    }
  }

  train(valueLoss: number): void {
    // Simplified training
    const learningRate = this.config.learningRate;

    for (let i = 0; i < this.weights.length; i++) {
      for (let j = 0; j < this.weights[i].length; j++) {
        for (let k = 0; k < this.weights[i][j].length; k++) {
          this.weights[i][j][k][0] -= learningRate * valueLoss * 0.01;
        }
      }
    }
  }

  getWeights(): number[][] {
    return this.weights.map(layer =>
      layer.map(neuron => neuron.map(weights => weights[0]))
    );
  }

  setWeights(weights: number[][]): void {
    this.weights = weights.map(layer =>
      layer.map(neuron => neuron.map(weight => [weight]))
    );
  }
}

/**
 * PPO Agent Factory
 */
export class PPOFactory {
  static createPPO(config: PPOConfig): PPOAgent {
    const actor = new SimplePolicyNetwork({
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    });

    const critic = new SimpleValueNetwork({
      stateSize: config.stateSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    });

    const policy: PolicyGradient = {
      actor,
      critic,
      getAction(state: number[], deterministic: boolean): { action: number; logProb: number } {
        const probs = actor.forward(state);
        let action: number;

        if (deterministic) {
          action = probs.indexOf(Math.max(...probs));
        } else {
          action = this.sampleCategorical(probs);
        }

        const logProb = actor.getLogProb(state, action);

        return { action, logProb };
      },

      sampleCategorical(probs: number[]): number {
        const rand = Math.random();
        let cumulative = 0;

        for (let i = 0; i < probs.length; i++) {
          cumulative += probs[i];
          if (rand <= cumulative) {
            return i;
          }
        }

        return probs.length - 1;
      },

      evaluateActions(states: number[][], actions: number[]): {
        logProbs: number[];
        values: number[];
        entropy: number;
      } {
        const logProbs = actor.getLogProbs(states, actions);
        const values = critic.forwardBatch(states);
        const entropy = actor.getEntropy(states);

        return { logProbs, values, entropy };
      },

      getValues(states: number[][]): number[] {
        return critic.forwardBatch(states);
      },
    };

    return new PPOAgent(config, policy);
  }

  static getDefaultConfig(stateSize: number, actionSize: number): PPOConfig {
    return {
      stateSize,
      actionSize,
      learningRate: 3e-4,
      gamma: 0.99,
      gaeLambda: 0.95,
      clipRange: 0.2,
      clipRangeVF: undefined,
      entropyCoeff: 0.0,
      vfCoeff: 0.5,
      maxGradNorm: 0.5,
      bufferSize: 2048,
      batchSize: 64,
      ppoEpochs: 10,
      numMiniBatches: 32,
      hiddenLayers: [64, 64],
      activation: 'tanh',
      targetKL: 0.01,
      normalizeAdvantages: true,
      normalizeReturns: true,
    };
  }
}
