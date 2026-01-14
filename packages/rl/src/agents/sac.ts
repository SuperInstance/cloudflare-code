/**
 * SAC (Soft Actor-Critic) Agent Implementation
 * Off-policy actor-critic with entropy regularization
 */

import { Transition } from '../memory/replay-buffer.js';

export interface SACConfig {
  stateSize: number;
  actionSize: number;
  learningRate: number;
  gamma: number;
  tau: number;
  alpha: number;
  autoTuneAlpha: boolean;
  targetEntropy: number;
  bufferSize: number;
  batchSize: number;
  hiddenLayers: number[];
  activation: 'relu' | 'tanh' | 'sigmoid';
  updateFrequency: number;
  targetUpdateFrequency: number;
  initialRandomSteps: number;
}

export interface PolicyOutput {
  mean: number[];
  logStd: number[];
  sample: number[];
  logProb: number[];
}

/**
 * SAC Agent
 * Soft Actor-Critic with automatic temperature tuning
 */
export class SACAgent {
  protected config: SACConfig;
  protected actor: PolicyNetwork;
  protected critic1: QNetwork;
  protected critic2: QNetwork;
  protected targetCritic1: QNetwork;
  protected targetCritic2: QNetwork;
  protected alpha: number;
  protected targetAlpha: number;
  protected logAlpha: number;
  protected stepCount: number = 0;

  constructor(
    config: SACConfig,
    actor: PolicyNetwork,
    critic1: QNetwork,
    critic2: QNetwork
  ) {
    this.config = config;
    this.actor = actor;
    this.critic1 = critic1;
    this.critic2 = critic2;
    this.targetCritic1 = this.createTargetNetwork(critic1);
    this.targetCritic2 = this.createTargetNetwork(critic2);

    this.alpha = config.alpha;
    this.targetAlpha = config.targetEntropy;
    this.logAlpha = Math.log(config.alpha);
  }

  selectAction(state: number[], evaluate: boolean = false): number {
    const action = this.actor.sample(state);

    if (evaluate) {
      // Use mean action for evaluation
      const output = this.actor.forward(state);
      return output.mean[0];
    }

    return action[0];
  }

  async train(batch: Transition[]): Promise<{
    actorLoss: number;
    criticLoss: number;
    alphaLoss: number;
  }> {
    // Update critic
    const criticLoss = await this.updateCritic(batch);

    // Update actor
    const actorLoss = await this.updateActor(batch);

    // Update alpha
    const alphaLoss = this.config.autoTuneAlpha
      ? await this.updateAlpha(batch)
      : 0;

    // Update target networks
    if (this.stepCount % this.config.targetUpdateFrequency === 0) {
      this.softUpdateTargetNetworks();
    }

    this.stepCount++;

    return { actorLoss, criticLoss, alphaLoss };
  }

  protected async updateCritic(batch: Transition[]): Promise<number> {
    const targets = this.calculateTargetValues(batch);

    // Train both critics
    const loss1 = this.critic1.train(batch, targets);
    const loss2 = this.critic2.train(batch, targets);

    return (loss1 + loss2) / 2;
  }

  protected calculateTargetValues(batch: Transition[]): number[] {
    const targets: number[] = [];

    for (const transition of batch) {
      let target = transition.reward;

      if (!transition.terminated && !transition.truncated && transition.nextState) {
        // Sample actions from current policy
        const policyOutput = this.actor.forward(transition.nextState);
        const logProb = this.actor.getLogProb(transition.nextState, policyOutput.sample);

        // Get Q-values from target critics
        const q1 = this.targetCritic1.forward(transition.nextState, policyOutput.sample);
        const q2 = this.targetCritic2.forward(transition.nextState, policyOutput.sample);
        const minQ = Math.min(q1[0], q2[0]);

        // SAC target: r + γ * (Q(s', a') - α * log π(a'|s'))
        target += this.config.gamma * (minQ - this.alpha * logProb);
      }

      targets.push(target);
    }

    return targets;
  }

  protected async updateActor(batch: Transition[]): Promise<number> {
    let actorLoss = 0;

    for (const transition of batch) {
      // Sample actions from current policy
      const policyOutput = this.actor.forward(transition.state);
      const logProb = this.actor.getLogProb(transition.state, policyOutput.sample);

      // Get Q-values from both critics
      const q1 = this.critic1.forward(transition.state, policyOutput.sample);
      const q2 = this.critic2.forward(transition.state, policyOutput.sample);
      const minQ = Math.min(q1[0], q2[0]);

      // SAC actor loss: α * log π(a|s) - Q(s, a)
      actorLoss += (this.alpha * logProb - minQ);
    }

    actorLoss /= batch.length;

    this.actor.train(actorLoss);

    return actorLoss;
  }

  protected async updateAlpha(batch: Transition[]): Promise<number> {
    // Automatic temperature tuning
    let alphaLoss = 0;

    for (const transition of batch) {
      const policyOutput = this.actor.forward(transition.state);
      const logProb = this.actor.getLogProb(transition.state, policyOutput.sample);

      // α loss: -α * (log π(a|s) + H̄)
      alphaLoss -= this.logAlpha * (logProb + this.targetAlpha);
    }

    alphaLoss /= batch.length;

    // Update log alpha
    this.logAlpha -= this.config.learningRate * alphaLoss * 0.01;
    this.alpha = Math.exp(this.logAlpha);

    return alphaLoss;
  }

  protected softUpdateTargetNetworks(): void {
    this.softUpdate(this.targetCritic1, this.critic1);
    this.softUpdate(this.targetCritic2, this.critic2);
  }

  protected softUpdate(target: QNetwork, source: QNetwork): void {
    const tau = this.config.tau;
    const targetWeights = target.getWeights();
    const sourceWeights = source.getWeights();

    const newWeights = targetWeights.map((layer, i) =>
      layer.map((neuron, j) =>
        neuron.map((weight, k) =>
          tau * sourceWeights[i][j][k] + (1 - tau) * weight
        )
      )
    );

    target.setWeights(newWeights);
  }

  protected createTargetNetwork(network: QNetwork): QNetwork {
    // In practice, would create a copy
    return network;
  }

  save(path: string): Promise<void> {
    return this.actor.save(path);
  }

  load(path: string): Promise<void> {
    return this.actor.load(path);
  }

  getAlpha(): number {
    return this.alpha;
  }

  getStepCount(): number {
    return this.stepCount;
  }
}

/**
 * Policy Network for SAC
 * Outputs mean and log standard deviation for Gaussian policy
 */
export interface PolicyNetwork {
  forward(state: number[]): PolicyOutput;
  sample(state: number[]): number[];
  getLogProb(state: number[], action: number[]): number;
  train(loss: number): void;
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;
}

/**
 * Q-Network for SAC
 */
export interface QNetwork {
  forward(state: number[], action: number[]): number[];
  train(batch: Transition[], targets: number[]): number;
  getWeights(): number[][];
  setWeights(weights: number[][]): void;
}

/**
 * Simple Policy Network Implementation
 */
export class SimpleSACPolicy implements PolicyNetwork {
  private meanNetwork: number[][][][];
  private logStdNetwork: number[][][][];
  private config: {
    stateSize: number;
    actionSize: number;
    hiddenLayers: number[];
    learningRate: number;
    activation: 'relu' | 'tanh' | 'sigmoid';
  };
  private logStdMin: number = -20;
  private logStdMax: number = 2;

  constructor(config: {
    stateSize: number;
    actionSize: number;
    hiddenLayers: number[];
    learningRate: number;
    activation: 'relu' | 'tanh' | 'sigmoid';
  }) {
    this.config = config;
    this.meanNetwork = this.initializeNetwork();
    this.logStdNetwork = this.initializeNetwork();
  }

  private initializeNetwork(): number[][][][] {
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

  forward(state: number[]): PolicyOutput {
    const mean = this.forwardNetwork(state, this.meanNetwork);
    const logStd = this.forwardNetwork(state, this.logStdNetwork);

    // Clamp log std
    const clampedLogStd = logStd.map(l =>
      Math.max(this.logStdMin, Math.min(this.logStdMax, l))
    );

    // Sample actions using reparameterization trick
    const sample: number[] = [];
    for (let i = 0; i < mean.length; i++) {
      const std = Math.exp(clampedLogStd[i]);
      const noise = this.sampleNormal();
      sample.push(mean[i] + std * noise);
    }

    // Squash actions to [-1, 1] using tanh
    const squashedActions = sample.map(a => Math.tanh(a));

    return {
      mean,
      logStd: clampedLogStd,
      sample: squashedActions,
      logProb: [],
    };
  }

  sample(state: number[]): number[] {
    const output = this.forward(state);
    return output.sample;
  }

  getLogProb(state: number[], action: number[]): number {
    const output = this.forward(state);
    let logProb = 0;

    for (let i = 0; i < action.length; i++) {
      const mean = output.mean[i];
      const logStd = output.logStd[i];
      const std = Math.exp(logStd);

      // Log probability of Gaussian
      const gaussianLogProb = -0.5 * Math.pow((action[i] - mean) / std, 2) -
                               logStd -
                               0.5 * Math.log(2 * Math.PI);

      // Correction for tanh squashing
      const squashingCorrection = Math.log(1 - Math.pow(action[i], 2) + 1e-10);

      logProb += gaussianLogProb - squashingCorrection;
    }

    return logProb;
  }

  private forwardNetwork(state: number[], network: number[][][][]): number[] {
    let activations = state;

    for (let i = 0; i < network.length - 1; i++) {
      activations = this.forwardLayer(activations, network[i]);
    }

    // Output layer
    const output: number[] = [];
    const lastLayer = network.length - 1;

    for (let j = 0; j < network[lastLayer].length; j++) {
      let sum = 0;
      for (let k = 0; k < activations.length; k++) {
        sum += network[lastLayer][j][k][0] * activations[k];
      }
      output.push(sum);
    }

    return output;
  }

  private forwardLayer(input: number[], layer: number[][][]): number[] {
    const output: number[] = [];

    for (let i = 0; i < layer.length; i++) {
      let sum = 0;
      for (let j = 0; j < input.length; j++) {
        sum += layer[i][j][0] * input[j];
      }
      output.push(Math.max(0, sum)); // ReLU
    }

    return output;
  }

  private sampleNormal(): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  train(loss: number): void {
    const learningRate = this.config.learningRate;

    // Update mean network
    for (let i = 0; i < this.meanNetwork.length; i++) {
      for (let j = 0; j < this.meanNetwork[i].length; j++) {
        for (let k = 0; k < this.meanNetwork[i][j].length; k++) {
          this.meanNetwork[i][j][k][0] -= learningRate * loss * 0.01;
        }
      }
    }

    // Update log std network
    for (let i = 0; i < this.logStdNetwork.length; i++) {
      for (let j = 0; j < this.logStdNetwork[i].length; j++) {
        for (let k = 0; k < this.logStdNetwork[i][j].length; k++) {
          this.logStdNetwork[i][j][k][0] -= learningRate * loss * 0.01;
        }
      }
    }
  }

  async save(path: string): Promise<void> {
    console.log(`Saving policy to ${path}`);
  }

  async load(path: string): Promise<void> {
    console.log(`Loading policy from ${path}`);
  }
}

/**
 * Simple Q-Network Implementation
 */
export class SimpleSACQNetwork implements QNetwork {
  private network: number[][][][];
  private config: {
    stateSize: number;
    actionSize: number;
    hiddenLayers: number[];
    learningRate: number;
  };

  constructor(config: {
    stateSize: number;
    actionSize: number;
    hiddenLayers: number[];
    learningRate: number;
  }) {
    this.config = config;
    this.network = this.initializeNetwork();
  }

  private initializeNetwork(): number[][][][] {
    const inputSize = this.config.stateSize + this.config.actionSize;
    const layers = [inputSize, ...this.config.hiddenLayers, 1];
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

  forward(state: number[], action: number[]): number[] {
    // Concatenate state and action
    const input = [...state, ...action];

    let activations = input;

    for (let i = 0; i < this.network.length - 1; i++) {
      activations = this.forwardLayer(activations, this.network[i]);
    }

    // Output layer
    const lastLayer = this.network.length - 1;
    let output = 0;

    for (let i = 0; i < activations.length; i++) {
      output += this.network[lastLayer][0][i][0] * activations[i];
    }

    return [output];
  }

  private forwardLayer(input: number[], layer: number[][][]): number[] {
    const output: number[] = [];

    for (let i = 0; i < layer.length; i++) {
      let sum = 0;
      for (let j = 0; j < input.length; j++) {
        sum += layer[i][j][0] * input[j];
      }
      output.push(Math.max(0, sum)); // ReLU
    }

    return output;
  }

  train(batch: Transition[], targets: number[]): number {
    let loss = 0;

    for (let i = 0; i < batch.length; i++) {
      const transition = batch[i];
      const currentQ = this.forward(transition.state, [transition.action])[0];
      const target = targets[i];
      const error = target - currentQ;
      loss += error * error;
    }

    loss /= batch.length;

    // Update network
    const learningRate = this.config.learningRate;

    for (let i = 0; i < this.network.length; i++) {
      for (let j = 0; j < this.network[i].length; j++) {
        for (let k = 0; k < this.network[i][j].length; k++) {
          this.network[i][j][k][0] -= learningRate * loss * 0.01;
        }
      }
    }

    return loss;
  }

  getWeights(): number[][] {
    return this.network.map(layer =>
      layer.map(neuron => neuron.map(weights => weights[0]))
    );
  }

  setWeights(weights: number[][]): void {
    this.network = weights.map(layer =>
      layer.map(neuron => neuron.map(weight => [weight]))
    );
  }
}

/**
 * SAC Factory
 */
export class SACFactory {
  static createSAC(config: SACConfig): SACAgent {
    const actor = new SimpleSACPolicy({
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    });

    const critic1 = new SimpleSACQNetwork({
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
    });

    const critic2 = new SimpleSACQNetwork({
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
    });

    return new SACAgent(config, actor, critic1, critic2);
  }

  static getDefaultConfig(stateSize: number, actionSize: number): SACConfig {
    return {
      stateSize,
      actionSize,
      learningRate: 3e-4,
      gamma: 0.99,
      tau: 0.005,
      alpha: 0.2,
      autoTuneAlpha: true,
      targetEntropy: -actionSize,
      bufferSize: 1000000,
      batchSize: 256,
      hiddenLayers: [256, 256],
      activation: 'relu',
      updateFrequency: 1,
      targetUpdateFrequency: 1,
      initialRandomSteps: 10000,
    };
  }
}
