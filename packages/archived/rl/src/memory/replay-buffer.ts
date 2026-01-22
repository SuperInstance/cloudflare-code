/**
 * Experience Replay Buffer
 * Stores and samples experiences for RL training
 */

export interface Transition {
  state: number[];
  action: number;
  reward: number;
  nextState: number[] | null;
  terminated: boolean;
  truncated: boolean;
  info?: Record<string, any>;
}

export interface PrioritizedTransition extends Transition {
  priority: number;
  index: number;
}

export interface Segment {
  states: number[][];
  actions: number[];
  rewards: number[];
  nextStates: (number[] | null)[];
  terminateds: boolean[];
  truncateds: boolean[];
}

/**
 * Basic Experience Replay Buffer
 */
export class ReplayBuffer {
  private buffer: Transition[] = [];
  private maxSize: number;
  private position: number = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  add(transition: Transition): void {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(transition);
    } else {
      this.buffer[this.position] = transition;
    }
    this.position = (this.position + 1) % this.maxSize;
  }

  addBatch(transitions: Transition[]): void {
    for (const transition of transitions) {
      this.add(transition);
    }
  }

  sample(batchSize: number): Transition[] {
    const indices = this.sampleIndices(batchSize);
    return indices.map(i => this.buffer[i]);
  }

  sampleIndices(batchSize: number): number[] {
    const validSize = Math.min(batchSize, this.buffer.length);
    const indices: number[] = [];

    for (let i = 0; i < validSize; i++) {
      indices.push(Math.floor(Math.random() * this.buffer.length));
    }

    return indices;
  }

  sampleSegment(batchSize: number): Segment {
    const transitions = this.sample(batchSize);

    return {
      states: transitions.map(t => t.state),
      actions: transitions.map(t => t.action),
      rewards: transitions.map(t => t.reward),
      nextStates: transitions.map(t => t.nextState),
      terminateds: transitions.map(t => t.terminated),
      truncateds: transitions.map(t => t.truncated),
    };
  }

  get size(): number {
    return this.buffer.length;
  }

  get capacity(): number {
    return this.maxSize;
  }

  clear(): void {
    this.buffer = [];
    this.position = 0;
  }

  isFull(): boolean {
    return this.buffer.length === this.maxSize;
  }
}

/**
 * Prioritized Experience Replay Buffer
 * Samples transitions based on their TD-error priority
 */
export class PrioritizedReplayBuffer {
  private buffer: PrioritizedTransition[] = [];
  private maxSize: number;
  private position: number = 0;
  private alpha: number;
  private beta: number;
  private betaIncrement: number;
  private epsilon: number;
  private maxPriority: number = 1.0;
  private currentIndex: number = 0;

  constructor(
    maxSize: number,
    options: {
      alpha?: number;
      beta?: number;
      betaIncrement?: number;
      epsilon?: number;
    } = {}
  ) {
    this.maxSize = maxSize;
    this.alpha = options.alpha ?? 0.6;
    this.beta = options.beta ?? 0.4;
    this.betaIncrement = options.betaIncrement ?? 0.001;
    this.epsilon = options.epsilon ?? 1e-6;
  }

  add(transition: Transition): void {
    const priority = this.maxPriority;
    const prioritizedTransition: PrioritizedTransition = {
      ...transition,
      priority,
      index: this.currentIndex,
    };

    if (this.buffer.length < this.maxSize) {
      this.buffer.push(prioritizedTransition);
    } else {
      this.buffer[this.position] = prioritizedTransition;
    }

    this.position = (this.position + 1) % this.maxSize;
    this.currentIndex++;
  }

  addBatch(transitions: Transition[]): void {
    for (const transition of transitions) {
      this.add(transition);
    }
  }

  sample(batchSize: number): {
    transitions: Transition[];
    indices: number[];
    weights: number[];
  } {
    if (this.buffer.length === 0) {
      return { transitions: [], indices: [], weights: [] };
    }

    const probs = this.calculateProbabilities();
    const indices = this.sampleIndicesProportional(batchSize, probs);
    const transitions = indices.map(i => this.buffer[i]);
    const weights = this.calculateImportanceWeights(probs, indices);

    // Update beta
    this.beta = Math.min(1.0, this.beta + this.betaIncrement);

    return {
      transitions: transitions.map(t => ({
        state: t.state,
        action: t.action,
        reward: t.reward,
        nextState: t.nextState,
        terminated: t.terminated,
        truncated: t.truncated,
        info: t.info,
      })),
      indices,
      weights,
    };
  }

  private calculateProbabilities(): number[] {
    const priorities = this.buffer.map(t => Math.pow(t.priority + this.epsilon, this.alpha));
    const sum = priorities.reduce((a, b) => a + b, 0);
    return priorities.map(p => p / sum);
  }

  private sampleIndicesProportional(batchSize: number, probs: number[]): number[] {
    const indices: number[] = [];
    const validSize = Math.min(batchSize, this.buffer.length);

    for (let i = 0; i < validSize; i++) {
      let cumulative = 0;
      const rand = Math.random();

      for (let j = 0; j < probs.length; j++) {
        cumulative += probs[j];
        if (rand <= cumulative) {
          indices.push(j);
          break;
        }
      }

      if (indices.length <= i) {
        indices.push(probs.length - 1);
      }
    }

    return indices;
  }

  private calculateImportanceWeights(probs: number[], indices: number[]): number[] {
    const sampledProbs = indices.map(i => probs[i]);
    const minProb = Math.min(...sampledProbs);

    return sampledProbs.map(p => Math.pow(p / minProb, -this.beta));
  }

  updatePriorities(indices: number[], priorities: number[]): void {
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const priority = priorities[i];

      if (index >= 0 && index < this.buffer.length) {
        this.buffer[index].priority = priority;
        this.maxPriority = Math.max(this.maxPriority, priority);
      }
    }
  }

  get size(): number {
    return this.buffer.length;
  }

  get capacity(): number {
    return this.maxSize;
  }

  clear(): void {
    this.buffer = [];
    this.position = 0;
    this.maxPriority = 1.0;
    this.currentIndex = 0;
  }
}

/**
 * Episodic Replay Buffer
 * Stores complete episodes for sequence-based learning
 */
export class EpisodicBuffer {
  private episodes: Transition[][] = [];
  private currentEpisode: Transition[] = [];
  private maxSize: number;
  private maxEpisodeLength: number;

  constructor(
    maxSize: number,
    options: {
      maxEpisodeLength?: number;
    } = {}
  ) {
    this.maxSize = maxSize;
    this.maxEpisodeLength = options.maxEpisodeLength ?? 1000;
  }

  add(transition: Transition): void {
    this.currentEpisode.push(transition);

    if (transition.terminated || transition.truncated) {
      this.endEpisode();
    }
  }

  endEpisode(): void {
    if (this.currentEpisode.length > 0) {
      if (this.episodes.length < this.maxSize) {
        this.episodes.push([...this.currentEpisode]);
      } else {
        // Replace random episode
        const idx = Math.floor(Math.random() * this.episodes.length);
        this.episodes[idx] = [...this.currentEpisode];
      }
      this.currentEpisode = [];
    }
  }

  sample(batchSize: number): Transition[] {
    const episodeIndices = this.sampleEpisodes(batchSize);
    const transitions: Transition[] = [];

    for (const epIdx of episodeIndices) {
      const episode = this.episodes[epIdx];
      const transitionIdx = Math.floor(Math.random() * episode.length);
      transitions.push(episode[transitionIdx]);
    }

    return transitions;
  }

  sampleSequence(sequenceLength: number): Transition[] {
    if (this.episodes.length === 0) {
      return [];
    }

    const episodeIdx = Math.floor(Math.random() * this.episodes.length);
    const episode = this.episodes[episodeIdx];

    if (episode.length < sequenceLength) {
      return episode;
    }

    const startIdx = Math.floor(Math.random() * (episode.length - sequenceLength + 1));
    return episode.slice(startIdx, startIdx + sequenceLength);
  }

  sampleSequences(batchSize: number, sequenceLength: number): Transition[][] {
    const sequences: Transition[][] = [];

    for (let i = 0; i < batchSize; i++) {
      sequences.push(this.sampleSequence(sequenceLength));
    }

    return sequences;
  }

  private sampleEpisodes(batchSize: number): number[] {
    const validSize = Math.min(batchSize, this.episodes.length);
    const indices: number[] = [];

    for (let i = 0; i < validSize; i++) {
      indices.push(Math.floor(Math.random() * this.episodes.length));
    }

    return indices;
  }

  get size(): number {
    return this.episodes.length;
  }

  get capacity(): number {
    return this.maxSize;
  }

  get currentEpisodeLength(): number {
    return this.currentEpisode.length;
  }

  clear(): void {
    this.episodes = [];
    this.currentEpisode = [];
  }
}

/**
 * Hierarchical Replay Buffer
 * Organizes experiences at multiple time scales
 */
export class HierarchicalReplayBuffer {
  private buffers: ReplayBuffer[] = [];
  private timeScales: number[];
  private maxSize: number;

  constructor(maxSize: number, timeScales: number[] = [1, 5, 10]) {
    this.maxSize = maxSize;
    this.timeScales = timeScales;

    for (const scale of timeScales) {
      this.buffers.push(new ReplayBuffer(Math.floor(maxSize / scale)));
    }
  }

  add(transition: Transition): void {
    // Add to all buffers
    for (const buffer of this.buffers) {
      buffer.add(transition);
    }
  }

  sample(batchSize: number, timeScale?: number): Transition[] {
    if (timeScale !== undefined) {
      const idx = this.timeScales.indexOf(timeScale);
      if (idx >= 0) {
        return this.buffers[idx].sample(batchSize);
      }
    }

    // Sample from random time scale
    const bufferIdx = Math.floor(Math.random() * this.buffers.length);
    return this.buffers[bufferIdx].sample(batchSize);
  }

  sampleMixed(batchSize: number): Transition[] {
    const transitions: Transition[] = [];
    const batchSizePerScale = Math.floor(batchSize / this.buffers.length);

    for (const buffer of this.buffers) {
      transitions.push(...buffer.sample(batchSizePerScale));
    }

    return transitions;
  }

  get size(): number {
    return this.buffers[0].size;
  }

  clear(): void {
    for (const buffer of this.buffers) {
      buffer.clear();
    }
  }
}

/**
 * Distributed Replay Buffer
 * Supports distributed training with sharding
 */
export class DistributedReplayBuffer {
  private shards: ReplayBuffer[] = [];
  private numShards: number;
  private maxSizePerShard: number;

  constructor(numShards: number, maxSizePerShard: number) {
    this.numShards = numShards;
    this.maxSizePerShard = maxSizePerShard;

    for (let i = 0; i < numShards; i++) {
      this.shards.push(new ReplayBuffer(maxSizePerShard));
    }
  }

  add(transition: Transition, shardIndex?: number): void {
    const idx = shardIndex ?? this.selectShard();
    this.shards[idx].add(transition);
  }

  addBatch(transitions: Transition[], shardIndex?: number): void {
    for (const transition of transitions) {
      this.add(transition, shardIndex);
    }
  }

  sample(batchSize: number): Transition[] {
    const transitions: Transition[] = [];
    const batchSizePerShard = Math.floor(batchSize / this.numShards);

    for (const shard of this.shards) {
      transitions.push(...shard.sample(batchSizePerShard));
    }

    // Fill remaining from random shards
    while (transitions.length < batchSize) {
      const shardIdx = Math.floor(Math.random() * this.numShards);
      const shardTransitions = this.shards[shardIdx].sample(1);
      if (shardTransitions.length > 0) {
        transitions.push(shardTransitions[0]);
      }
    }

    return transitions;
  }

  private selectShard(): number {
    return Math.floor(Math.random() * this.numShards);
  }

  get size(): number {
    return this.shards.reduce((sum, shard) => sum + shard.size, 0);
  }

  get capacity(): number {
    return this.numShards * this.maxSizePerShard;
  }

  clear(): void {
    for (const shard of this.shards) {
      shard.clear();
    }
  }

  getShardSizes(): number[] {
    return this.shards.map(shard => shard.size);
  }
}

/**
 * Segment Tree for efficient prioritized sampling
 */
class SumSegmentTree {
  private tree: number[];
  private size: number;

  constructor(capacity: number) {
    this.size = 1;
    while (this.size < capacity) {
      this.size *= 2;
    }
    this.tree = Array(2 * this.size).fill(0);
  }

  update(index: number, value: number): void {
    const treeIndex = index + this.size;
    this.tree[treeIndex] = value;

    let i = treeIndex;
    while (i > 1) {
      i = Math.floor(i / 2);
      this.tree[i] = this.tree[2 * i] + this.tree[2 * i + 1];
    }
  }

  get(index: number): number {
    const treeIndex = index + this.size;
    return this.tree[treeIndex];
  }

  sum(): number {
    return this.tree[1];
  }

  findPrefixSum(prefixSum: number): number {
    let idx = 1;

    while (idx < this.size) {
      if (this.tree[2 * idx] > prefixSum) {
        idx = 2 * idx;
      } else {
        prefixSum -= this.tree[2 * idx];
        idx = 2 * idx + 1;
      }
    }

    return idx - this.size;
  }
}
