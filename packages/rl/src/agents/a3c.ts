/**
 * A3C (Asynchronous Advantage Actor-Critic) Agent Implementation
 * Distributed training with multiple parallel workers
 */

import { Env, StepResult } from '../envs/base.js';

export interface A3CConfig {
  stateSize: number;
  actionSize: number;
  learningRate: number;
  gamma: number;
  tau: number;
  maxGradNorm: number;
  entropyCoeff: number;
  valueLossCoeff: number;
  numWorkers: number;
  workerUpdateFrequency: number;
  hiddenLayers: number[];
  activation: 'relu' | 'tanh' | 'sigmoid';
  rolloutLength: number;
}

export interface WorkerResult {
  episodeReward: number;
  episodeLength: number;
  loss: number;
}

/**
 * A3C Worker
 * Runs independently and periodically updates global model
 */
export class A3CWorker {
  private id: number;
  private config: A3CConfig;
  private env: Env;
  private actor: LocalNetwork;
  private critic: LocalNetwork;
  private globalActor: GlobalNetwork;
  private globalCritic: GlobalNetwork;

  constructor(
    id: number,
    config: A3CConfig,
    env: Env,
    globalActor: GlobalNetwork,
    globalCritic: GlobalNetwork
  ) {
    this.id = id;
    this.config = config;
    this.env = env;
    this.globalActor = globalActor;
    this.globalCritic = globalCritic;
    this.actor = this.createLocalNetwork(globalActor);
    this.critic = this.createLocalNetwork(globalCritic);
  }

  async run(maxEpisodes: number = Infinity): Promise<WorkerResult> {
    let totalReward = 0;
    let totalLength = 0;
    let totalLoss = 0;
    let episodeCount = 0;

    for (let ep = 0; ep < maxEpisodes; ep++) {
      const state = await this.env.reset();
      const { reward, length, loss } = await this.runEpisode(state);

      totalReward += reward;
      totalLength += length;
      totalLoss += loss;
      episodeCount++;

      if (this.id === 0 && ep % 10 === 0) {
        console.log(`Worker ${this.id} - Episode ${ep}: Avg Reward = ${totalReward / episodeCount}`);
      }
    }

    return {
      episodeReward: totalReward / episodeCount,
      episodeLength: totalLength / episodeCount,
      loss: totalLoss / episodeCount,
    };
  }

  private async runEpisode(initialState: any): Promise<{ reward: number; length: number; loss: number }> {
    let state = this.initialStateToVector(initialState);
    let totalReward = 0;
    let totalLoss = 0;
    let stepCount = 0;
    let terminated = false;
    let truncated = false;

    // Sync with global model
    this.syncWithGlobal();

    while (!terminated && !truncated) {
      const { reward, loss, done } = await this.runRollout(state);

      totalReward += reward;
      totalLoss += loss;
      stepCount++;

      // Get next state
      const action = this.selectAction(state);
      const stepResult = await this.env.step(action);
      state = this.stateToVector(stepResult.observation);
      terminated = stepResult.terminated;
      truncated = stepResult.truncated;

      if (done) {
        break;
      }
    }

    return { reward: totalReward, length: stepCount, loss: totalLoss };
  }

  private async runRollout(state: number[]): Promise<{ reward: number; loss: number; done: boolean }> {
    const states: number[][] = [];
    const actions: number[] = [];
    const rewards: number[] = [];
    const values: number[] = [];
    const logProbs: number[] = [];

    let currentState = state;
    let totalReward = 0;
    let done = false;

    // Collect rollout
    for (let t = 0; t < this.config.rolloutLength; t++) {
      const { action, logProb, value } = this.getAction(currentState);

      states.push(currentState);
      actions.push(action);
      logProbs.push(logProb);
      values.push(value[0]);

      const stepResult = await this.env.step(action);
      rewards.push(stepResult.reward);
      totalReward += stepResult.reward;

      currentState = this.stateToVector(stepResult.observation);

      if (stepResult.terminated || stepResult.truncated) {
        done = true;
        // Compute bootstrap value
        const bootstrapValue = 0;
        rewards.push(bootstrapValue);
        values.push(bootstrapValue);
        break;
      }
    }

    // Calculate returns and advantages
    const { returns, advantages } = this.calculateReturnsAdvantages(rewards, values, done);

    // Update global model
    const loss = await this.updateGlobalModel(states, actions, returns, advantages, logProbs);

    // Sync with global model
    this.syncWithGlobal();

    return { reward: totalReward, loss, done };
  }

  private getAction(state: number[]): { action: number; logProb: number; value: number[] } {
    // Get action probabilities from actor
    const actionProbs = this.actor.forward(state);

    // Sample action
    const action = this.sampleCategorical(actionProbs);
    const logProb = Math.log(actionProbs[action] + 1e-10);

    // Get value from critic
    const value = this.critic.forward(state);

    return { action, logProb, value };
  }

  private selectAction(state: number[]): number {
    const actionProbs = this.actor.forward(state);
    return this.sampleCategorical(actionProbs);
  }

  private sampleCategorical(probs: number[]): number {
    const rand = Math.random();
    let cumulative = 0;

    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (rand <= cumulative) {
        return i;
      }
    }

    return probs.length - 1;
  }

  private calculateReturnsAdvantages(
    rewards: number[],
    values: number[],
    done: boolean
  ): { returns: number[]; advantages: number[] } {
    const returns: number[] = [];
    const advantages: number[] = [];

    let R = done ? 0 : values[values.length - 1];

    // Iterate backwards
    for (let t = rewards.length - 1; t >= 0; t--) {
      R = rewards[t] + this.config.gamma * R;
      returns.unshift(R);
      advantages.unshift(R - values[t]);
    }

    return { returns, advantages };
  }

  private async updateGlobalModel(
    states: number[][],
    actions: number[],
    returns: number[],
    advantages: number[],
    oldLogProbs: number[]
  ): Promise<number> {
    // Calculate policy loss
    const policyLoss = this.calculatePolicyLoss(states, actions, advantages, oldLogProbs);

    // Calculate value loss
    const valueLoss = this.calculateValueLoss(states, returns);

    // Update global networks
    await this.globalActor.update(policyLoss, this.id);
    await this.globalCritic.update(valueLoss, this.id);

    return policyLoss + this.config.valueLossCoeff * valueLoss;
  }

  private calculatePolicyLoss(
    states: number[][],
    actions: number[],
    advantages: number[],
    oldLogProbs: number[]
  ): number {
    let policyLoss = 0;
    let entropy = 0;

    for (let i = 0; i < states.length; i++) {
      const actionProbs = this.actor.forward(states[i]);
      const logProb = Math.log(actionProbs[actions[i]] + 1e-10);

      // Policy gradient loss
      policyLoss -= (logProb * advantages[i]);

      // Entropy bonus
      for (const p of actionProbs) {
        if (p > 0) {
          entropy -= p * Math.log(p);
        }
      }
    }

    policyLoss = policyLoss / states.length - this.config.entropyCoeff * (entropy / states.length);

    return policyLoss;
  }

  private calculateValueLoss(states: number[][], returns: number[]): number {
    let valueLoss = 0;

    for (let i = 0; i < states.length; i++) {
      const value = this.critic.forward(states[i])[0];
      const error = returns[i] - value;
      valueLoss += error * error;
    }

    return valueLoss / states.length;
  }

  private syncWithGlobal(): void {
    const actorWeights = this.globalActor.getWeights();
    const criticWeights = this.globalCritic.getWeights();

    this.actor.setWeights(actorWeights);
    this.critic.setWeights(criticWeights);
  }

  private createLocalNetwork(globalNetwork: GlobalNetwork): LocalNetwork {
    // Create local copy of global network
    return new SimpleLocalNetwork(globalNetwork.getConfig());
  }

  private stateToVector(state: any): number[] {
    if (Array.isArray(state)) {
      return state as number[];
    }
    if (typeof state === 'object' && state !== null) {
      return Object.values(state).flat();
    }
    return [state];
  }

  private initialStateToVector(state: any): number[] {
    return this.stateToVector(state);
  }
}

/**
 * Global Network for A3C
 */
export interface GlobalNetwork {
  getWeights(): number[][];
  setWeights(weights: number[][]): void;
  update(loss: number, workerId: number): Promise<void>;
  getConfig(): any;
}

/**
 * Local Network for A3C Worker
 */
export interface LocalNetwork {
  forward(state: number[]): number[];
  getWeights(): number[][];
  setWeights(weights: number[][]): void;
}

/**
 * Simple Local Network Implementation
 */
class SimpleLocalNetwork implements LocalNetwork {
  private weights: number[][][][];
  private biases: number[][][];
  private config: any;

  constructor(config: any) {
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
    let activations = state;

    for (let i = 0; i < this.weights.length - 1; i++) {
      activations = this.forwardLayer(activations, i);
    }

    // Output layer
    const output: number[] = [];
    const lastLayer = this.weights.length - 1;

    for (let j = 0; j < this.weights[lastLayer].length; j++) {
      let sum = this.biases[lastLayer][j][0];
      for (let k = 0; k < activations.length; k++) {
        sum += this.weights[lastLayer][j][k][0] * activations[k];
      }
      output.push(sum);
    }

    return this.softmax(output);
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

      output.push(Math.max(0, sum)); // ReLU
    }

    return output;
  }

  private softmax(logits: number[]): number[] {
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((a, b) => a + b, 0);

    return expLogits.map(e => e / sumExp);
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
 * Simple Global Network Implementation
 */
class SimpleGlobalNetwork implements GlobalNetwork {
  private weights: number[][][][];
  private biases: number[][][];
  private config: any;
  private lock: boolean = false;

  constructor(config: any) {
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

  getWeights(): number[][] {
    return this.weights.map(layer =>
      layer.map(neuron => neuron.map(weights => weights[0]))
    );
  }

  setWeights(weights: number[][]): void {
    while (this.lock) {
      // Wait for lock to be released
    }

    this.lock = true;
    this.weights = weights.map(layer =>
      layer.map(neuron => neuron.map(weight => [weight]))
    );
    this.lock = false;
  }

  async update(loss: number, workerId: number): Promise<void> {
    // Wait for lock
    while (this.lock) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    this.lock = true;

    // Apply gradient update
    const learningRate = this.config.learningRate;

    for (let i = 0; i < this.weights.length; i++) {
      for (let j = 0; j < this.weights[i].length; j++) {
        for (let k = 0; k < this.weights[i][j].length; k++) {
          this.weights[i][j][k][0] -= learningRate * loss * 0.01;
        }
      }
    }

    this.lock = false;
  }

  getConfig(): any {
    return this.config;
  }
}

/**
 * A3C Agent
 * Orchestrates multiple workers for distributed training
 */
export class A3CAgent {
  private config: A3CConfig;
  private workers: A3CWorker[] = [];
  private globalActor: GlobalNetwork;
  private globalCritic: GlobalNetwork;
  private envs: Env[];

  constructor(config: A3CConfig, envs: Env[]) {
    this.config = config;
    this.envs = envs;

    // Create global networks
    const actorConfig = {
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    };

    const criticConfig = {
      stateSize: config.stateSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    };

    this.globalActor = new SimpleGlobalNetwork(actorConfig);
    this.globalCritic = new SimpleGlobalNetwork(criticConfig);
  }

  async train(maxEpisodes: number = 1000): Promise<WorkerResult[]> {
    // Create workers
    this.workers = [];

    for (let i = 0; i < this.config.numWorkers; i++) {
      const env = this.envs[i % this.envs.length];
      const worker = new A3CWorker(i, this.config, env, this.globalActor, this.globalCritic);
      this.workers.push(worker);
    }

    // Run workers in parallel
    const results = await Promise.all(
      this.workers.map(worker => worker.run(maxEpisodes))
    );

    return results;
  }

  save(path: string): Promise<void> {
    // In production, would save global networks
    return Promise.resolve();
  }

  load(path: string): Promise<void> {
    // In production, would load global networks
    return Promise.resolve();
  }
}

/**
 * A3C Factory
 */
export class A3CFactory {
  static createA3C(config: A3CConfig, envs: Env[]): A3CAgent {
    return new A3CAgent(config, envs);
  }

  static getDefaultConfig(stateSize: number, actionSize: number): A3CConfig {
    return {
      stateSize,
      actionSize,
      learningRate: 1e-4,
      gamma: 0.99,
      tau: 1.0,
      maxGradNorm: 40,
      entropyCoeff: 0.01,
      valueLossCoeff: 0.5,
      numWorkers: 4,
      workerUpdateFrequency: 5,
      hiddenLayers: [64, 64],
      activation: 'relu',
      rolloutLength: 20,
    };
  }
}
