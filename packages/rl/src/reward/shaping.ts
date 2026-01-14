/**
 * Reward Shaping System
 * Converts sparse rewards to dense, normalizes rewards, and adds auxiliary rewards
 */

import { Env, StepResult } from '../envs/base.js';

export interface RewardShaper {
  transform(originalReward: number, state: any, action: any, nextState: any): number;
  reset(): void;
}

/**
 * Reward Normalizer
 * Normalizes rewards to have zero mean and unit variance
 */
export class RewardNormalizer implements RewardShaper {
  private mean: number = 0;
  private std: number = 1;
  private count: number = 0;
  private momentum: number = 0.99;
  private epsilon: number = 1e-8;

  transform(originalReward: number): number {
    // Update running statistics
    this.count++;
    const delta = originalReward - this.mean;
    this.mean += delta / this.count;
    const delta2 = originalReward - this.mean;
    this.std = Math.sqrt(
      this.momentum * this.std * this.std +
      (1 - this.momentum) * delta2 * delta2 +
      this.epsilon
    );

    // Normalize reward
    return (originalReward - this.mean) / (this.std + this.epsilon);
  }

  reset(): void {
    this.mean = 0;
    this.std = 1;
    this.count = 0;
  }

  getMean(): number {
    return this.mean;
  }

  getStd(): number {
    return this.std;
  }
}

/**
 * Reward Clipper
 * Clips rewards to a specified range
 */
export class RewardClipper implements RewardShaper {
  private minReward: number;
  private maxReward: number;

  constructor(minReward: number = -10, maxReward: number = 10) {
    this.minReward = minReward;
    this.maxReward = maxReward;
  }

  transform(originalReward: number): number {
    return Math.max(this.minReward, Math.min(this.maxReward, originalReward));
  }

  reset(): void {
    // No state to reset
  }

  setBounds(min: number, max: number): void {
    this.minReward = min;
    this.maxReward = max;
  }
}

/**
 * Reward Scaler
 * Scales rewards by a factor
 */
export class RewardScaler implements RewardShaper {
  private scale: number;

  constructor(scale: number = 1.0) {
    this.scale = scale;
  }

  transform(originalReward: number): number {
    return originalReward * this.scale;
  }

  reset(): void {
    // No state to reset
  }

  setScale(scale: number): void {
    this.scale = scale;
  }
}

/**
 * Sparse to Dense Reward Converter
 * Converts sparse binary rewards to dense shaped rewards
 */
export class SparseToDenseReward implements RewardShaper {
  private rewardPredictor: RewardPredictor;
  private gamma: number;
  private usePotentialBased: boolean;

  constructor(
    gamma: number = 0.99,
    usePotentialBased: boolean = true
  ) {
    this.gamma = gamma;
    this.usePotentialBased = usePotentialBased;
    this.rewardPredictor = new RewardPredictor();
  }

  transform(
    originalReward: number,
    state: any,
    action: any,
    nextState: any
  ): number {
    if (!this.usePotentialBased) {
      // Use predicted reward
      const predictedReward = this.rewardPredictor.predict(state, action);
      return originalReward + predictedReward;
    }

    // Potential-based reward shaping
    const currentPotential = this.calculatePotential(state);
    const nextPotential = this.calculatePotential(nextState);
    const shapedReward = originalReward + this.gamma * nextPotential - currentPotential;

    return shapedReward;
  }

  private calculatePotential(state: any): number {
    // Heuristic potential function
    // Can be overridden for specific environments
    return this.rewardPredictor.predict(state, null);
  }

  reset(): void {
    this.rewardPredictor.reset();
  }
}

/**
 * Reward Predictor
 * Predicts intermediate rewards for sparse reward environments
 */
export class RewardPredictor {
  private predictions: Map<string, number> = new Map();
  private history: { state: any; action: any; reward: number }[] = [];

  predict(state: any, action: any): number {
    const key = this.stateToKey(state, action);

    if (this.predictions.has(key)) {
      return this.predictions.get(key) ?? 0;
    }

    // Use heuristic prediction
    return this.heuristicPrediction(state, action);
  }

  private heuristicPrediction(state: any, action: any): number {
    // Default heuristic - can be overridden
    return 0;
  }

  private stateToKey(state: any, action: any): string {
    const stateKey = JSON.stringify(state);
    const actionKey = action !== null ? JSON.stringify(action) : 'null';
    return `${stateKey}_${actionKey}`;
  }

  update(state: any, action: any, reward: number): void {
    const key = this.stateToKey(state, action);

    // Update prediction using exponential moving average
    const oldPrediction = this.predictions.get(key) ?? 0;
    const alpha = 0.1;
    const newPrediction = (1 - alpha) * oldPrediction + alpha * reward;

    this.predictions.set(key, newPrediction);

    // Add to history
    this.history.push({ state, action, reward });

    // Limit history size
    if (this.history.length > 10000) {
      this.history.shift();
    }
  }

  reset(): void {
    this.predictions.clear();
    this.history = [];
  }
}

/**
 * Curiosity-Driven Reward Shaping
 * Adds intrinsic reward for exploring novel states
 */
export class CuriosityReward implements RewardShaper {
  private curiosityModule: CuriosityModule;
  private scalingFactor: number;

  constructor(
    scalingFactor: number = 0.1,
    stateSize: number = 256,
    actionSize: number = 10
  ) {
    this.scalingFactor = scalingFactor;
    this.curiosityModule = new CuriosityModule(stateSize, actionSize);
  }

  transform(
    originalReward: number,
    state: any,
    action: any,
    nextState: any
  ): number {
    const intrinsicReward = this.curiosityModule.getIntrinsicReward(state, action, nextState);
    return originalReward + this.scalingFactor * intrinsicReward;
  }

  reset(): void {
    this.curiosityModule.reset();
  }

  getScalingFactor(): number {
    return this.scalingFactor;
  }

  setScalingFactor(factor: number): void {
    this.scalingFactor = factor;
  }
}

/**
 * Curiosity Module
 * Implements intrinsic motivation through prediction error
 */
export class CuriosityModule {
  private forwardModel: ForwardModel;
  private inverseModel: InverseModel;
  private visitedStates: Set<string> = new Set();

  constructor(stateSize: number, actionSize: number) {
    this.forwardModel = new ForwardModel(stateSize, actionSize);
    this.inverseModel = new InverseModel(stateSize, actionSize);
  }

  getIntrinsicReward(state: any, action: any, nextState: any): number {
    // Prediction error as intrinsic reward
    const predictedNextState = this.forwardModel.predict(state, action);
    const predictionError = this.calculatePredictionError(nextState, predictedNextState);

    // Novelty bonus
    const stateKey = this.stateToKey(nextState);
    const noveltyBonus = this.visitedStates.has(stateKey) ? 0 : 1;
    this.visitedStates.add(stateKey);

    return predictionError + 0.5 * noveltyBonus;
  }

  private calculatePredictionError(actual: any, predicted: any): number {
    // Simplified error calculation
    const actualVec = this.toVector(actual);
    const predictedVec = this.toVector(predicted);

    let error = 0;
    for (let i = 0; i < Math.min(actualVec.length, predictedVec.length); i++) {
      error += Math.pow(actualVec[i] - predictedVec[i], 2);
    }

    return Math.sqrt(error);
  }

  private toVector(state: any): number[] {
    if (Array.isArray(state)) {
      return state as number[];
    }
    if (typeof state === 'object' && state !== null) {
      return Object.values(state).flat();
    }
    return [state];
  }

  private stateToKey(state: any): string {
    const vec = this.toVector(state);
    return vec.map(v => Math.round(v * 100) / 100).join(',');
  }

  reset(): void {
    this.visitedStates.clear();
    this.forwardModel.reset();
    this.inverseModel.reset();
  }
}

/**
 * Forward Model
 * Predicts next state given current state and action
 */
export class ForwardModel {
  private weights: number[][][][];
  private stateSize: number;
  private actionSize: number;

  constructor(stateSize: number, actionSize: number) {
    this.stateSize = stateSize;
    this.actionSize = actionSize;
    this.weights = this.initializeWeights();
  }

  private initializeWeights(): number[][][][] {
    const inputSize = this.stateSize + this.actionSize;
    const layers = [inputSize, 128, 128, this.stateSize];
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

  predict(state: any, action: any): number[] {
    const stateVec = this.toVector(state);
    const actionVec = this.toVector(action);
    const input = [...stateVec, ...actionVec];

    let activations = input;

    for (let i = 0; i < this.weights.length - 1; i++) {
      activations = this.forwardLayer(activations, this.weights[i]);
    }

    // Output layer
    const output: number[] = [];
    const lastLayer = this.weights.length - 1;

    for (let j = 0; j < this.weights[lastLayer].length; j++) {
      let sum = 0;
      for (let k = 0; k < activations.length; k++) {
        sum += this.weights[lastLayer][j][k][0] * activations[k];
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

  private toVector(x: any): number[] {
    if (Array.isArray(x)) {
      return x as number[];
    }
    if (typeof x === 'object' && x !== null) {
      return Object.values(x).flat();
    }
    return [x];
  }

  train(state: any, action: any, nextState: any): void {
    // Simplified training
    const predicted = this.predict(state, action);
    const actual = this.toVector(nextState);

    const learningRate = 0.001;

    for (let i = 0; i < this.weights.length; i++) {
      for (let j = 0; j < this.weights[i].length; j++) {
        for (let k = 0; k < this.weights[i][j].length; k++) {
          const error = (actual[j] ?? 0) - (predicted[j] ?? 0);
          this.weights[i][j][k][0] -= learningRate * error * 0.01;
        }
      }
    }
  }

  reset(): void {
    this.weights = this.initializeWeights();
  }
}

/**
 * Inverse Model
 * Predicts action given current state and next state
 */
export class InverseModel {
  private weights: number[][][][];
  private stateSize: number;
  private actionSize: number;

  constructor(stateSize: number, actionSize: number) {
    this.stateSize = stateSize;
    this.actionSize = actionSize;
    this.weights = this.initializeWeights();
  }

  private initializeWeights(): number[][][][] {
    const inputSize = this.stateSize * 2;
    const layers = [inputSize, 128, 128, this.actionSize];
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

  predict(state: any, nextState: any): number[] {
    const stateVec = this.toVector(state);
    const nextStateVec = this.toVector(nextState);
    const input = [...stateVec, ...nextStateVec];

    let activations = input;

    for (let i = 0; i < this.weights.length - 1; i++) {
      activations = this.forwardLayer(activations, this.weights[i]);
    }

    // Output layer (softmax for discrete actions)
    const output: number[] = [];
    const lastLayer = this.weights.length - 1;

    for (let j = 0; j < this.weights[lastLayer].length; j++) {
      let sum = 0;
      for (let k = 0; k < activations.length; k++) {
        sum += this.weights[lastLayer][j][k][0] * activations[k];
      }
      output.push(sum);
    }

    return this.softmax(output);
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

  private softmax(logits: number[]): number[] {
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((a, b) => a + b, 0);

    return expLogits.map(e => e / sumExp);
  }

  private toVector(x: any): number[] {
    if (Array.isArray(x)) {
      return x as number[];
    }
    if (typeof x === 'object' && x !== null) {
      return Object.values(x).flat();
    }
    return [x];
  }

  reset(): void {
    this.weights = this.initializeWeights();
  }
}

/**
 * Auxiliary Reward Shaper
 * Adds auxiliary rewards for intermediate objectives
 */
export class AuxiliaryRewardShaper implements RewardShaper {
  private auxiliaryTasks: AuxiliaryTask[] = [];
  private taskWeights: Map<string, number> = new Map();

  addTask(task: AuxiliaryTask, weight: number = 1.0): void {
    this.auxiliaryTasks.push(task);
    this.taskWeights.set(task.name, weight);
  }

  transform(
    originalReward: number,
    state: any,
    action: any,
    nextState: any
  ): number {
    let auxiliaryReward = 0;

    for (const task of this.auxiliaryTasks) {
      const weight = this.taskWeights.get(task.name) ?? 1.0;
      const taskReward = task.computeReward(state, action, nextState);
      auxiliaryReward += weight * taskReward;
    }

    return originalReward + auxiliaryReward;
  }

  reset(): void {
    for (const task of this.auxiliaryTasks) {
      task.reset();
    }
  }

  removeTask(taskName: string): void {
    this.auxiliaryTasks = this.auxiliaryTasks.filter(t => t.name !== taskName);
    this.taskWeights.delete(taskName);
  }

  setTaskWeight(taskName: string, weight: number): void {
    this.taskWeights.set(taskName, weight);
  }
}

/**
 * Auxiliary Task Interface
 */
export interface AuxiliaryTask {
  name: string;
  computeReward(state: any, action: any, nextState: any): number;
  reset(): void;
}

/**
 * Progress Reward
 * Rewards progress toward goal
 */
export class ProgressReward implements AuxiliaryTask {
  name: string = 'progress';
  private goal: any;
  private previousDistance: number = 0;

  constructor(goal: any) {
    this.goal = goal;
  }

  computeReward(state: any, action: any, nextState: any): number {
    const currentDistance = this.distanceToGoal(nextState);
    const progress = this.previousDistance - currentDistance;
    this.previousDistance = currentDistance;

    return progress;
  }

  private distanceToGoal(state: any): number {
    // Simplified distance calculation
    const stateVec = this.toVector(state);
    const goalVec = this.toVector(this.goal);

    let distance = 0;
    for (let i = 0; i < Math.min(stateVec.length, goalVec.length); i++) {
      distance += Math.abs(stateVec[i] - goalVec[i]);
    }

    return distance;
  }

  private toVector(x: any): number[] {
    if (Array.isArray(x)) {
      return x as number[];
    }
    if (typeof x === 'object' && x !== null) {
      return Object.values(x).flat();
    }
    return [x];
  }

  reset(): void {
    this.previousDistance = 0;
  }
}

/**
 * Time Penalty Reward
 * Penalizes long episodes
 */
export class TimePenaltyReward implements AuxiliaryTask {
  name: string = 'time_penalty';
  private penaltyPerStep: number;

  constructor(penaltyPerStep: number = -0.01) {
    this.penaltyPerStep = penaltyPerStep;
  }

  computeReward(state: any, action: any, nextState: any): number {
    return this.penaltyPerStep;
  }

  reset(): void {
    // No state to reset
  }

  setPenalty(penalty: number): void {
    this.penaltyPerStep = penalty;
  }
}

/**
 * Composite Reward Shaper
 * Combines multiple reward shapers
 */
export class CompositeRewardShaper implements RewardShaper {
  private shapers: RewardShaper[] = [];

  addShaper(shaper: RewardShaper): void {
    this.shapers.push(shaper);
  }

  transform(
    originalReward: number,
    state: any,
    action: any,
    nextState: any
  ): number {
    let reward = originalReward;

    for (const shaper of this.shapers) {
      reward = shaper.transform(reward, state, action, nextState);
    }

    return reward;
  }

  reset(): void {
    for (const shaper of this.shapers) {
      shaper.reset();
    }
  }

  removeShaper(shaper: RewardShaper): void {
    this.shapers = this.shapers.filter(s => s !== shaper);
  }
}

/**
 * Reward Shaper Factory
 */
export class RewardShaperFactory {
  static createNormalizer(momentum: number = 0.99): RewardNormalizer {
    return new RewardNormalizer();
  }

  static createClipper(min: number, max: number): RewardClipper {
    return new RewardClipper(min, max);
  }

  static createScaler(scale: number): RewardScaler {
    return new RewardScaler(scale);
  }

  static createSparseToDense(gamma: number = 0.99): SparseToDenseReward {
    return new SparseToDenseReward(gamma);
  }

  static createCuriosity(scalingFactor: number = 0.1, stateSize: number = 256, actionSize: number = 10): CuriosityReward {
    return new CuriosityReward(scalingFactor, stateSize, actionSize);
  }

  static createAuxiliary(): AuxiliaryRewardShaper {
    return new AuxiliaryRewardShaper();
  }

  static createComposite(): CompositeRewardShaper {
    return new CompositeRewardShaper();
  }
}
