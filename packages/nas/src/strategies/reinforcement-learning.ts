/**
 * Reinforcement Learning Architecture Search
 * RNN controller with policy gradient for neural architecture search
 */

import {
  Architecture,
  SearchStrategyType,
  RLConfig,
  Episode,
  Action,
  State,
  SearchResult,
  SearchStatistics,
  ArchitectureEncoding,
  LayerType,
  Operation,
  LayerParameters,
} from '../types';

// ============================================================================
// RNN Controller
// ============================================================================

export class RNNController {
  private hiddenSize: number[];
  private embedding: Map<string, number[]>;
  private embeddingDim: number;
  private vocabulary: Set<string>;

  constructor(config: any) {
    this.hiddenSize = config.hiddenSize || [128, 64];
    this.embeddingDim = config.embedding?.dimension || 64;
    this.embedding = new Map();
    this.vocabulary = new Set();
  }

  /**
   * Initialize controller with vocabulary
   */
  public initialize(vocab: string[]): void {
    for (const token of vocab) {
      this.vocabulary.add(token);
      this.embedding.set(token, this.randomEmbedding());
    }
  }

  /**
   * Get embedding for a token
   */
  public getEmbedding(token: string): number[] {
    if (!this.embedding.has(token)) {
      this.embedding.set(token, this.randomEmbedding());
      this.vocabulary.add(token);
    }
    return this.embedding.get(token)!;
  }

  /**
   * Forward pass through controller
   */
  public forward(
    input: number[],
    hiddenState: number[][]
  ): { output: number[]; newHidden: number[][] } {
    // Simplified RNN forward pass
    const [h1, h2] = hiddenState;

    // First layer
    const newH1 = this.rnnCell(input, h1, this.hiddenSize[0]);

    // Second layer
    const newH2 = this.rnnCell(newH1, h2, this.hiddenSize[1]);

    // Output projection
    const output = this.projectOutput(newH2);

    return {
      output,
      newHidden: [newH1, newH2],
    };
  }

  private rnnCell(input: number[], hidden: number[], size: number): number[] {
    const newHidden: number[] = [];

    for (let i = 0; i < size; i++) {
      const inputWeight = Math.random() * 2 - 1;
      const hiddenWeight = Math.random() * 2 - 1;
      const value = Math.tanh(
        inputWeight * (input[i % input.length] || 0) +
        hiddenWeight * (hidden[i] || 0)
      );
      newHidden.push(value);
    }

    return newHidden;
  }

  private projectOutput(hidden: number[]): number[] {
    // Project to vocabulary size
    const output: number[] = [];

    for (let i = 0; i < this.vocabulary.size; i++) {
      let sum = 0;
      for (let j = 0; j < hidden.length; j++) {
        sum += hidden[j] * (Math.random() * 2 - 1);
      }
      output.push(sum);
    }

    return output;
  }

  private randomEmbedding(): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < this.embeddingDim; i++) {
      embedding.push((Math.random() - 0.5) * 2);
    }
    return embedding;
  }

  /**
   * Sample action from policy
   */
  public sampleAction(logits: number[], temperature: number = 1.0): { index: number; probability: number } {
    // Apply temperature
    const scaledLogits = logits.map(l => l / temperature);

    // Softmax
    const maxLogit = Math.max(...scaledLogits);
    const expLogits = scaledLogits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((sum, e) => sum + e, 0);
    const probs = expLogits.map(e => e / sumExp);

    // Sample
    let threshold = Math.random();
    let index = 0;
    for (let i = 0; i < probs.length; i++) {
      threshold -= probs[i];
      if (threshold <= 0) {
        index = i;
        break;
      }
    }

    return {
      index,
      probability: probs[index],
    };
  }

  /**
   * Reset hidden state
   */
  public resetHidden(): number[][] {
    return [
      new Array(this.hiddenSize[0]).fill(0),
      new Array(this.hiddenSize[1]).fill(0),
    ];
  }
}

// ============================================================================
// Policy Gradient with Baseline
// ============================================================================

export class PolicyGradient {
  private baseline: number = 0;
  private baselineDecay: number = 0.99;
  private learningRate: number = 0.001;

  constructor(config: any) {
    if (config.baselineDecay) {
      this.baselineDecay = config.baselineDecay;
    }
    if (config.learningRate) {
      this.learningRate = config.learningRate;
    }
  }

  /**
   * Update baseline using moving average
   */
  public updateBaseline(reward: number): void {
    this.baseline = this.baselineDecay * this.baseline + (1 - this.baselineDecay) * reward;
  }

  /**
   * Calculate policy gradient loss
   */
  public calculateLoss(
    logProbabilities: number[],
    rewards: number[],
    values?: number[]
  ): { loss: number; policyLoss: number; valueLoss?: number } {
    // Calculate advantages
    const advantages = rewards.map(r => r - this.baseline);

    // Policy loss (negative for gradient ascent)
    const policyLoss = -logProbabilities.reduce(
      (sum, logProb, i) => sum + logProb * advantages[i],
      0
    );

    // Value loss (if using actor-critic)
    let valueLoss = 0;
    if (values) {
      valueLoss = rewards.reduce(
        (sum, r, i) => sum + 0.5 * Math.pow(r - values[i], 2),
        0
      );
    }

    return {
      loss: policyLoss + (valueLoss || 0),
      policyLoss,
      valueLoss,
    };
  }

  /**
   * Calculate gradients
   */
  public calculateGradients(
    logProbabilities: number[],
    rewards: number[]
  ): number[] {
    const advantages = rewards.map(r => r - this.baseline);
    return logProbabilities.map((logProb, i) => -advantages[i]);
  }

  /**
   * Update policy parameters
   */
  public updatePolicy(gradients: number[]): void {
    // Simplified parameter update
    // In practice, this would update neural network weights
    for (let i = 0; i < gradients.length; i++) {
      gradients[i] *= this.learningRate;
    }
  }
}

// ============================================================================
// Reinforcement Learning Search
// ============================================================================

export class ReinforcementLearningSearch {
  private config: RLConfig;
  private controller: RNNController;
  private policyGradient: PolicyGradient;
  private episodeHistory: Episode[] = [];
  private bestArchitecture: Architecture | null = null;
  private bestReward: number = -Infinity;

  constructor(config: RLConfig) {
    this.config = config;
    this.controller = new RNNController(config.controller);
    this.policyGradient = new PolicyGradient(config.policy);

    // Initialize vocabulary
    this.initializeVocabulary();
  }

  // ============================================================================
  // Main Search Loop
  // ============================================================================

  /**
   * Run RL-based architecture search
   */
  public async search(
    evaluate: (arch: Architecture) => Promise<Architecture>
  ): Promise<SearchResult> {
    const startTime = Date.now();
    let iteration = 0;
    let evaluated = 0;

    // Training loop
    for (let epoch = 0; epoch < this.config.training.epochs; epoch++) {
      // Generate episode
      const episode = await this.generateEpisode(evaluate);
      evaluated += episode.architectures.length;

      // Calculate returns
      const returns = this.calculateReturns(episode.rewards);

      // Update policy
      this.updatePolicy(episode, returns);

      // Update baseline
      for (const reward of returns) {
        this.policyGradient.updateBaseline(reward);
      }

      // Track best
      const maxReward = Math.max(...episode.rewards);
      if (maxReward > this.bestReward) {
        const idx = episode.rewards.indexOf(maxReward);
        this.bestArchitecture = episode.architectures[idx];
        this.bestReward = maxReward;
      }

      // Log progress
      this.logProgress(epoch, episode, returns);

      iteration++;

      // Check termination
      if (evaluated >= this.config.budget.limit) {
        break;
      }
    }

    const duration = Date.now() - startTime;

    return {
      strategy: 'reinforcement-learning',
      iterations: iteration,
      bestArchitecture: this.bestArchitecture!,
      paretoFront: this.getParetoFront(),
      history: this.getAllArchitectures(),
      statistics: this.calculateStatistics(evaluated),
      duration,
    };
  }

  // ============================================================================
  // Episode Generation
  // ============================================================================

  private async generateEpisode(
    evaluate: (arch: Architecture) => Promise<Architecture>
  ): Promise<Episode> {
    const episode: Episode = {
      id: `episode_${Date.now()}`,
      architectures: [],
      rewards: [],
      actions: [],
      states: [],
      logProbabilities: [],
      values: [],
      totalReward: 0,
    };

    const episodeLength = this.config.training.episodeLength;
    let hiddenState = this.controller.resetHidden();

    for (let step = 0; step < episodeLength; step++) {
      // Sample architecture
      const { architecture, actions, states, logProbs } = await this.sampleArchitecture(
        hiddenState
      );

      // Evaluate architecture
      const evaluated = await evaluate(architecture);

      // Calculate reward
      const reward = this.calculateReward(evaluated);

      // Update episode
      episode.architectures.push(evaluated);
      episode.rewards.push(reward);
      episode.actions.push(...actions);
      episode.states.push(...states);
      episode.logProbabilities.push(...logProbs);

      // Update hidden state
      hiddenState = states[states.length - 1]?.hidden || hiddenState;

      episode.totalReward += reward;
    }

    this.episodeHistory.push(episode);

    return episode;
  }

  /**
   * Sample an architecture from the policy
   */
  private async sampleArchitecture(
    initialHidden: number[][]
  ): Promise<{
    architecture: Architecture;
    actions: Action[];
    states: State[];
    logProbs: number[];
  }> {
    const actions: Action[] = [];
    const states: State[] = [];
    const logProbs: number[] = [];

    let hidden = initialHidden;
    const layers: any[] = [];
    const connections: any[] = [];

    // Sample number of layers
    const numLayers = this.sampleFromPolicy(hidden, 'num_layers');
    const action1: Action = { layerType: 'conv2d', operation: 'conv3x3', parameters: {} };
    actions.push(action1);
    logProbs.push(numLayers.probability);
    hidden = numLayers.hidden;
    states.push({ encoding: { type: 'direct', representation: [], length: 0 }, hidden: hidden[0] });

    // Sample each layer
    for (let i = 0; i < Math.floor(numLayers.index * 5) + 3; i++) {
      const layer = await this.sampleLayer(hidden, i);
      layers.push(layer.layer);
      actions.push(layer.action);
      logProbs.push(layer.logProb);
      states.push(layer.state);
      hidden = layer.hidden;
    }

    // Sample connections
    for (let i = 0; i < layers.length - 1; i++) {
      if (Math.random() < 0.3) {
        connections.push({
          from: layers[i].id,
          to: layers[i + 1].id,
          type: 'direct',
        });
      }

      // Add skip connections
      if (i > 0 && Math.random() < 0.2) {
        connections.push({
          from: layers[i].id,
          to: layers[Math.min(i + 2, layers.length - 1)].id,
          type: 'skip',
        });
      }
    }

    const architecture: Architecture = {
      id: `arch_rl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      genotype: {
        encoding: {
          type: 'direct',
          representation: [],
          length: 0,
        },
        constraints: this.config.constraints,
        searchSpace: {} as any,
      },
      phenotype: {
        layers,
        connections,
        topology: {
          type: 'sequential',
          depth: layers.length,
          width: 1,
          branches: connections.filter(c => c.type === 'skip').length,
        },
      },
      metrics: {
        flops: 0,
        parameters: 0,
        memory: 0,
        latency: 0,
        energy: 0,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        generation: 0,
        source: 'rl-search',
        tags: ['rl-generated'],
      },
    };

    return { architecture, actions, states, logProbs };
  }

  /**
   * Sample a layer from the policy
   */
  private async sampleLayer(
    hidden: number[][],
    index: number
  ): Promise<{
    layer: any;
    action: Action;
    state: State;
    hidden: number[][];
    logProb: number;
  }> {
    // Sample layer type
    const layerTypeResult = this.sampleFromPolicy(hidden, 'layer_type');
    const layerTypes: LayerType[] = ['conv2d', 'depthwise-conv2d', 'separable-conv2d', 'dense'];
    const layerType = layerTypes[layerTypeResult.index % layerTypes.length];

    // Sample operation
    const opResult = this.sampleFromPolicy(layerTypeResult.hidden, 'operation');
    const operations: Operation[] = ['conv3x3', 'conv5x5', 'sep-conv3x3', 'identity'];
    const operation = operations[opResult.index % operations.length];

    // Sample parameters
    const paramResult = this.sampleFromPolicy(opResult.hidden, 'parameters');
    const filters = [32, 64, 128, 256][paramResult.index % 4];
    const kernelSize = [3, 5, 7][Math.floor(paramResult.index / 4) % 3];

    const layer = {
      id: `layer_${index}`,
      type: layerType,
      operation,
      parameters: {
        filters,
        kernelSize,
        strides: 1,
        activation: 'relu',
      } as LayerParameters,
      inputs: [],
      outputs: [],
    };

    const action: Action = {
      layerType,
      operation,
      parameters: layer.parameters,
    };

    const state: State = {
      encoding: { type: 'direct', representation: [], length: 0 },
      hidden: paramResult.hidden[0],
    };

    return {
      layer,
      action,
      state,
      hidden: paramResult.hidden,
      logProb: layerTypeResult.probability * opResult.probability * paramResult.probability,
    };
  }

  /**
   * Sample from policy for a given action type
   */
  private sampleFromPolicy(
    hidden: number[][],
    actionType: string
  ): { index: number; probability: number; hidden: number[][] } {
    // Get embedding for action type
    const input = this.controller.getEmbedding(actionType);

    // Forward pass
    const { output, newHidden } = this.controller.forward(input, hidden);

    // Sample action
    const sampled = this.controller.sampleAction(output, 1.0);

    return {
      index: sampled.index,
      probability: Math.log(sampled.probability + 1e-10),
      hidden: newHidden,
    };
  }

  // ============================================================================
  // Reward Calculation
  // ============================================================================

  private calculateReward(architecture: Architecture): number {
    const rewardConfig = this.config.reward;
    let reward = 0;

    for (let i = 0; i < rewardConfig.metrics.length; i++) {
      const metric = rewardConfig.metrics[i];
      const weight = rewardConfig.weights[i];
      const value = (architecture.metrics as any)[metric] || 0;

      // Normalize and apply weight
      let normalizedValue = 0;

      switch (metric) {
        case 'accuracy':
          normalizedValue = value; // Already 0-1
          break;
        case 'flops':
          // Inverse: lower FLOPs is better
          normalizedValue = 1 - Math.min(value / 1e9, 1);
          break;
        case 'latency':
          // Inverse: lower latency is better
          normalizedValue = 1 - Math.min(value / 100, 1);
          break;
        case 'parameters':
          // Inverse: fewer parameters is better
          normalizedValue = 1 - Math.min(value / 1e7, 1);
          break;
        default:
          normalizedValue = value;
      }

      reward += weight * normalizedValue;
    }

    // Apply normalization if configured
    switch (rewardConfig.normalization) {
      case 'z-score':
        // Z-score normalization would require history
        break;
      case 'min-max':
        // Min-max normalization
        reward = Math.max(0, Math.min(1, reward));
        break;
    }

    return reward;
  }

  /**
   * Calculate discounted returns
   */
  private calculateReturns(rewards: number[]): number[] {
    const returns: number[] = [];
    let cumulative = 0;

    // Discounted return
    for (let i = rewards.length - 1; i >= 0; i--) {
      cumulative = rewards[i] + this.config.training.discount * cumulative;
      returns.unshift(cumulative);
    }

    return returns;
  }

  // ============================================================================
  // Policy Update
  // ============================================================================

  private updatePolicy(episode: Episode, returns: number[]): void {
    // Calculate policy gradient loss
    const { loss, policyLoss } = this.policyGradient.calculateLoss(
      episode.logProbabilities,
      returns
    );

    // Calculate gradients
    const gradients = this.policyGradient.calculateGradients(
      episode.logProbabilities,
      returns
    );

    // Update policy
    this.policyGradient.updatePolicy(gradients);

    // Log update info
    console.log(`Policy update - Loss: ${loss.toFixed(4)}, Policy Loss: ${policyLoss.toFixed(4)}`);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private initializeVocabulary(): void {
    const vocab = [
      'num_layers',
      'layer_type',
      'operation',
      'parameters',
      'filters',
      'kernel_size',
      'strides',
      'activation',
      'skip_connection',
    ];

    this.controller.initialize(vocab);
  }

  private getAllArchitectures(): Architecture[] {
    const architectures: Architecture[] = [];

    for (const episode of this.episodeHistory) {
      architectures.push(...episode.architectures);
    }

    return architectures;
  }

  private getParetoFront(): Architecture[] {
    // Simplified Pareto front calculation
    const all = this.getAllArchitectures();

    // Sort by accuracy descending
    const sorted = [...all].sort((a, b) => {
      const accA = a.metrics.accuracy || 0;
      const accB = b.metrics.accuracy || 0;
      return accB - accA;
    });

    // Return top 10%
    return sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.1)));
  }

  private calculateStatistics(evaluated: number): SearchStatistics {
    const architectures = this.getAllArchitectures();

    return {
      totalEvaluated: evaluated,
      uniqueArchitectures: new Set(architectures.map(a => a.id)).size,
      convergence: this.bestReward,
      diversity: this.calculateDiversity(architectures),
      improvementRate: this.calculateImprovementRate(),
    };
  }

  private calculateDiversity(architectures: Architecture[]): number {
    // Calculate average pairwise distance
    let totalDistance = 0;
    let count = 0;

    for (let i = 0; i < Math.min(architectures.length, 100); i++) {
      for (let j = i + 1; j < Math.min(architectures.length, 100); j++) {
        totalDistance += this.calculateDistance(architectures[i], architectures[j]);
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 0;
  }

  private calculateDistance(arch1: Architecture, arch2: Architecture): number {
    const layers1 = arch1.phenotype.layers;
    const layers2 = arch2.phenotype.layers;

    return Math.abs(layers1.length - layers2.length);
  }

  private calculateImprovementRate(): number {
    if (this.episodeHistory.length < 2) {
      return 0;
    }

    const recentRewards = this.episodeHistory
      .slice(-10)
      .map(ep => ep.totalReward / ep.architectures.length);

    const earlierRewards = this.episodeHistory
      .slice(0, Math.min(10, this.episodeHistory.length - 10))
      .map(ep => ep.totalReward / ep.architectures.length);

    const recentAvg = recentRewards.reduce((sum, r) => sum + r, 0) / recentRewards.length;
    const earlierAvg = earlierRewards.reduce((sum, r) => sum + r, 0) / earlierRewards.length;

    return recentAvg - earlierAvg;
  }

  private logProgress(epoch: number, episode: Episode, returns: number[]): void {
    if (epoch % 10 === 0) {
      console.log(`Epoch ${epoch}:`);
      console.log(`  Episode Reward: ${episode.totalReward.toFixed(4)}`);
      console.log(`  Avg Return: ${returns.reduce((a, b) => a + b, 0) / returns.length}`);
      console.log(`  Best Reward: ${this.bestReward.toFixed(4)}`);
      console.log(`  Baseline: ${this.policyGradient['baseline'].toFixed(4)}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createRLConfig(overrides: Partial<RLConfig> = {}): RLConfig {
  return {
    maxIterations: 100,
    populationSize: 1,
    parallelism: 1,
    budget: {
      type: 'evaluations',
      limit: 1000,
      current: 0,
    },
    objectives: [
      { name: 'accuracy', metric: 'accuracy', direction: 'maximize', weight: 1.0 },
      { name: 'flops', metric: 'flops', direction: 'minimize', weight: 0.5 },
    ],
    constraints: {
      maxLayers: 20,
      minLayers: 3,
      maxParameters: 10000000,
      maxFLOPs: 1000000000,
      maxLatency: 100,
      maxMemory: 1000,
    },
    controller: {
      type: 'rnn',
      hiddenSize: [128, 64],
      attention: false,
      embedding: {
        dimension: 64,
        type: 'learned',
      },
    },
    reward: {
      type: 'multi-objective',
      metrics: ['accuracy', 'flops', 'latency', 'parameters'],
      weights: [1.0, 0.5, 0.3, 0.2],
      baseline: 'moving-average',
      baselineDecay: 0.99,
      normalization: 'min-max',
    },
    policy: {
      algorithm: 'reinforce',
      learningRate: 0.001,
      entropyCoefficient: 0.01,
      valueLossCoefficient: 0.5,
      gradientClip: 5.0,
    },
    training: {
      epochs: 100,
      batchSize: 1,
      optimizer: {
        type: 'adam',
        learningRate: 0.001,
      },
      discount: 0.99,
      episodeLength: 10,
    },
    ...overrides,
  };
}
