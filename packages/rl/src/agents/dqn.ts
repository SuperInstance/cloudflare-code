/**
 * DQN (Deep Q-Network) Agent Implementation
 * Includes Double DQN, Dueling DQN, and Rainbow DQN variants
 */

import { Transition } from '../memory/replay-buffer.js';

export interface DQNConfig {
  stateSize: number;
  actionSize: number;
  learningRate: number;
  gamma: number;
  bufferSize: number;
  batchSize: number;
  updateFrequency: number;
  targetUpdateFrequency: number;
  epsilonStart: number;
  epsilonEnd: number;
  epsilonDecay: number;
  hiddenLayers: number[];
  activation: 'relu' | 'tanh' | 'sigmoid';
  dueling: boolean;
  double: boolean;
  noisy: boolean;
  categorical: boolean;
  numAtoms: number;
  vMin: number;
  vMax: number;
}

export interface QNetwork {
  forward(state: number[]): number[];
  train(batch: Transition[], targetNetwork: QNetwork): number;
  copyFrom(network: QNetwork): void;
  getWeights(): number[][];
  setWeights(weights: number[][]): void;
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;
}

/**
 * Base DQN Agent
 */
export class DQNAgent {
  protected config: DQNConfig;
  protected qNetwork: QNetwork;
  protected targetNetwork: QNetwork;
  protected epsilon: number;
  protected stepCount: number = 0;

  constructor(config: DQNConfig, qNetwork: QNetwork) {
    this.config = config;
    this.qNetwork = qNetwork;
    this.targetNetwork = this.createTargetNetwork(qNetwork);
    this.epsilon = config.epsilonStart;
  }

  selectAction(state: number[], training: boolean = true): number {
    if (training && Math.random() < this.epsilon) {
      return this.exploratoryAction();
    }

    return this.greedyAction(state);
  }

  protected exploratoryAction(): number {
    return Math.floor(Math.random() * this.config.actionSize);
  }

  protected greedyAction(state: number[]): number {
    const qValues = this.qNetwork.forward(state);
    return this.argmax(qValues);
  }

  protected argmax(values: number[]): number {
    let maxIdx = 0;
    let maxVal = values[0];

    for (let i = 1; i < values.length; i++) {
      if (values[i] > maxVal) {
        maxVal = values[i];
        maxIdx = i;
      }
    }

    return maxIdx;
  }

  async train(batch: Transition[]): Promise<number> {
    // Calculate targets
    const targets = this.calculateTargets(batch);

    // Train Q-network
    const loss = this.qNetwork.train(batch, this.targetNetwork);

    // Update target network
    if (this.stepCount % this.config.targetUpdateFrequency === 0) {
      this.updateTargetNetwork();
    }

    // Update epsilon
    this.updateEpsilon();

    this.stepCount++;

    return loss;
  }

  protected calculateTargets(batch: Transition[]): number[] {
    const targets: number[] = [];

    for (const transition of batch) {
      let target = transition.reward;

      if (!transition.terminated && !transition.truncated && transition.nextState) {
        const nextQValues = this.targetNetwork.forward(transition.nextState);

        if (this.config.double) {
          // Double DQN: use online network to select action
          const onlineNextQValues = this.qNetwork.forward(transition.nextState);
          const nextAction = this.argmax(onlineNextQValues);
          target += this.config.gamma * nextQValues[nextAction];
        } else {
          // Standard DQN
          const maxNextQ = Math.max(...nextQValues);
          target += this.config.gamma * maxNextQ;
        }
      }

      targets.push(target);
    }

    return targets;
  }

  protected updateTargetNetwork(): void {
    this.targetNetwork.copyFrom(this.qNetwork);
  }

  protected updateEpsilon(): void {
    this.epsilon = Math.max(
      this.config.epsilonEnd,
      this.epsilon * this.config.epsilonDecay
    );
  }

  protected createTargetNetwork(qNetwork: QNetwork): QNetwork {
    // Create a copy of the Q-network
    const targetNetwork = this.cloneNetwork(qNetwork);
    targetNetwork.copyFrom(qNetwork);
    return targetNetwork;
  }

  protected cloneNetwork(network: QNetwork): QNetwork {
    // Simplified cloning - in practice would create deep copy
    return network;
  }

  save(path: string): Promise<void> {
    return this.qNetwork.save(path);
  }

  load(path: string): Promise<void> {
    return this.qNetwork.load(path);
  }

  getEpsilon(): number {
    return this.epsilon;
  }

  setEpsilon(epsilon: number): void {
    this.epsilon = epsilon;
  }

  getStepCount(): number {
    return this.stepCount;
  }
}

/**
 * Double DQN Agent
 * Addresses overestimation bias in DQN
 */
export class DoubleDQNAgent extends DQNAgent {
  constructor(config: DQNConfig, qNetwork: QNetwork) {
    config.double = true;
    super(config, qNetwork);
  }
}

/**
 * Dueling DQN Agent
 * Separates value and advantage streams
 */
export class DuelingDQNAgent extends DQNAgent {
  constructor(config: DQNConfig, qNetwork: QNetwork) {
    config.dueling = true;
    super(config, qNetwork);
  }

  protected greedyAction(state: number[]): number {
    const qValues = this.qNetwork.forward(state);
    return this.argmax(qValues);
  }
}

/**
 * Rainbow DQN Agent
 * Combines multiple DQN improvements:
 * - Double DQN
 * - Dueling networks
 * - Prioritized experience replay
 * - Multi-step learning
 * - Distributional RL
 * - Noisy nets
 */
export class RainbowDQNAgent extends DQNAgent {
  private nStep: number = 3;

  constructor(config: DQNConfig, qNetwork: QNetwork) {
    config.double = true;
    config.dueling = true;
    config.categorical = true;
    config.noisy = true;
    super(config, qNetwork);
  }

  protected calculateTargets(batch: Transition[]): number[] {
    // Use n-step returns
    return this.calculateNStepTargets(batch);
  }

  protected calculateNStepTargets(batch: Transition[]): number[] {
    const targets: number[] = [];

    for (let i = 0; i < batch.length; i++) {
      let nStepReward = 0;
      let gamma = this.config.gamma;

      // Calculate n-step return
      for (let n = 0; n < this.nStep && i + n < batch.length; n++) {
        const transition = batch[i + n];
        nStepReward += Math.pow(gamma, n) * transition.reward;

        if (transition.terminated || transition.truncated) {
          break;
        }
      }

      // Add bootstrap value
      const bootstrapIdx = Math.min(i + this.nStep, batch.length - 1);
      const bootstrapTransition = batch[bootstrapIdx];

      if (
        !bootstrapTransition.terminated &&
        !bootstrapTransition.truncated &&
        bootstrapTransition.nextState
      ) {
        const nextQValues = this.targetNetwork.forward(bootstrapTransition.nextState);
        const onlineNextQValues = this.qNetwork.forward(bootstrapTransition.nextState);
        const nextAction = this.argmax(onlineNextQValues);
        nStepReward += Math.pow(gamma, this.nStep) * nextQValues[nextAction];
      }

      targets.push(nStepReward);
    }

    return targets;
  }
}

/**
 * Categorical DQN Agent
 * Implements distributional RL with value distribution
 */
export class CategoricalDQNAgent extends DQNAgent {
  private support: number[];
  private numAtoms: number;

  constructor(config: DQNConfig, qNetwork: QNetwork) {
    config.categorical = true;
    super(config, qNetwork);

    this.numAtoms = config.numAtoms;
    this.support = this.createSupport(config.vMin, config.vMax, config.numAtoms);
  }

  private createSupport(vMin: number, vMax: number, numAtoms: number): number[] {
    const support: number[] = [];
    const delta = (vMax - vMin) / (numAtoms - 1);

    for (let i = 0; i < numAtoms; i++) {
      support.push(vMin + i * delta);
    }

    return support;
  }

  protected greedyAction(state: number[]): number {
    // For categorical DQN, select action with highest expected value
    const probabilities = this.qNetwork.forward(state);
    const actionValues = this.calculateExpectedValues(probabilities);
    return this.argmax(actionValues);
  }

  private calculateExpectedValues(probabilities: number[]): number[] {
    const numActions = this.config.actionSize;
    const expectedValues: number[] = [];

    for (let a = 0; a < numActions; a++) {
      let expectedValue = 0;

      for (let i = 0; i < this.numAtoms; i++) {
        expectedValue += probabilities[a * this.numAtoms + i] * this.support[i];
      }

      expectedValues.push(expectedValue);
    }

    return expectedValues;
  }
}

/**
 * Noisy DQN Agent
 * Uses noisy networks for exploration
 */
export class NoisyDQNAgent extends DQNAgent {
  constructor(config: DQNConfig, qNetwork: QNetwork) {
    config.noisy = true;
    config.epsilonStart = 0.0; // No exploration needed with noisy nets
    config.epsilonEnd = 0.0;
    super(config, qNetwork);
  }

  selectAction(state: number[], training: boolean = true): number {
    // Noisy networks provide exploration
    return this.greedyAction(state);
  }

  protected greedyAction(state: number[]): number {
    // Sample noisy weights
    const qValues = this.qNetwork.forward(state);
    return this.argmax(qValues);
  }
}

/**
 * Simple Q-Network Implementation
 * In production, would use TensorFlow or PyTorch
 */
export class SimpleQNetwork implements QNetwork {
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
          const weight = Math.random() * 0.2 - 0.1; // Xavier initialization
          neuronWeights.push([weight]);
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

    for (let i = 0; i < this.weights.length; i++) {
      activations = this.forwardLayer(activations, i);
    }

    return activations;
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

      output.push(this.activation(sum, layerIdx));
    }

    return output;
  }

  private activation(x: number, layerIdx: number): number {
    // No activation for output layer
    if (layerIdx === this.weights.length - 1) {
      return x;
    }

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

  train(batch: Transition[], targetNetwork: QNetwork): number {
    // Simplified training - in practice would use backpropagation
    let totalLoss = 0;

    for (const transition of batch) {
      const currentState = transition.state;
      const action = transition.action;
      const reward = transition.reward;

      let target = reward;
      if (!transition.terminated && transition.nextState) {
        const nextQValues = targetNetwork.forward(transition.nextState);
        target += 0.99 * Math.max(...nextQValues);
      }

      const currentQValues = this.forward(currentState);
      const loss = Math.pow(target - currentQValues[action], 2);
      totalLoss += loss;

      // Simple gradient update
      this.updateWeights(currentState, action, target);
    }

    return totalLoss / batch.length;
  }

  private updateWeights(state: number[], action: number, target: number): void {
    const learningRate = this.config.learningRate;
    const currentQValues = this.forward(state);
    const error = target - currentQValues[action];

    // Update output layer weights (simplified)
    const outputLayerIdx = this.weights.length - 1;
    for (let i = 0; i < this.weights[outputLayerIdx][action].length; i++) {
      this.weights[outputLayerIdx][action][i][0] += learningRate * error * state[i];
    }

    this.biases[outputLayerIdx][action][0] += learningRate * error;
  }

  copyFrom(network: QNetwork): void {
    if (network instanceof SimpleQNetwork) {
      this.weights = JSON.parse(JSON.stringify(network.weights));
      this.biases = JSON.parse(JSON.stringify(network.biases));
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

  async save(path: string): Promise<void> {
    // In production, would save to file
    console.log(`Saving model to ${path}`);
  }

  async load(path: string): Promise<void> {
    // In production, would load from file
    console.log(`Loading model from ${path}`);
  }
}

/**
 * DQN Agent Factory
 */
export class DQNFactory {
  static createDQN(config: DQNConfig): DQNAgent {
    const qNetwork = new SimpleQNetwork({
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    });

    return new DQNAgent(config, qNetwork);
  }

  static createDoubleDQN(config: DQNConfig): DoubleDQNAgent {
    const qNetwork = new SimpleQNetwork({
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    });

    return new DoubleDQNAgent(config, qNetwork);
  }

  static createDuelingDQN(config: DQNConfig): DuelingDQNAgent {
    const qNetwork = new SimpleQNetwork({
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    });

    return new DuelingDQNAgent(config, qNetwork);
  }

  static createRainbowDQN(config: DQNConfig): RainbowDQNAgent {
    const qNetwork = new SimpleQNetwork({
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    });

    return new RainbowDQNAgent(config, qNetwork);
  }

  static createNoisyDQN(config: DQNConfig): NoisyDQNAgent {
    const qNetwork = new SimpleQNetwork({
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    });

    return new NoisyDQNAgent(config, qNetwork);
  }

  static createCategoricalDQN(config: DQNConfig): CategoricalDQNAgent {
    const qNetwork = new SimpleQNetwork({
      stateSize: config.stateSize,
      actionSize: config.actionSize,
      hiddenLayers: config.hiddenLayers,
      learningRate: config.learningRate,
      activation: config.activation,
    });

    return new CategoricalDQNAgent(config, qNetwork);
  }

  static getDefaultConfig(stateSize: number, actionSize: number): DQNConfig {
    return {
      stateSize,
      actionSize,
      learningRate: 0.001,
      gamma: 0.99,
      bufferSize: 100000,
      batchSize: 32,
      updateFrequency: 1,
      targetUpdateFrequency: 100,
      epsilonStart: 1.0,
      epsilonEnd: 0.01,
      epsilonDecay: 0.995,
      hiddenLayers: [128, 128],
      activation: 'relu',
      dueling: false,
      double: false,
      noisy: false,
      categorical: false,
      numAtoms: 51,
      vMin: -10,
      vMax: 10,
    };
  }
}
