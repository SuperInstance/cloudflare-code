/**
 * Training Orchestration System
 * Manages distributed training, checkpointing, and hyperparameter tuning
 */

import { Env, StepResult } from '../envs/base.js';
import { DQNAgent } from '../agents/dqn.js';
import { PPOAgent } from '../agents/ppo.js';
import { A3CAgent } from '../agents/a3c.js';
import { SACAgent } from '../agents/sac.js';
import { ReplayBuffer } from '../memory/replay-buffer.js';
import { Transition } from '../memory/replay-buffer.js';

export interface TrainingConfig {
  totalTimesteps: number;
  evaluationFrequency: number;
  checkpointFrequency: number;
  logFrequency: number;
  saveDirectory: string;
  seed?: number;
  device?: 'cpu' | 'cuda';
  numWorkers?: number;
}

export interface TrainingMetrics {
  episodeReward: number;
  episodeLength: number;
  loss: number;
  fps: number;
  evaluationScore: number;
  timestamp: number;
}

export interface CheckpointData {
  timestep: number;
  agentState: any;
  optimizerState: any;
  metrics: TrainingMetrics[];
  hyperparameters: Record<string, any>;
}

/**
 * Distributed Training Orchestrator
 */
export class TrainingOrchestrator {
  private config: TrainingConfig;
  private agent: any;
  private env: Env;
  private evalEnv: Env;
  private replayBuffer: ReplayBuffer;
  private metrics: TrainingMetrics[] = [];
  private currentTimestep: number = 0;
  private checkpointManager: CheckpointManager;
  private logger: TrainingLogger;
  private hyperparameterTuner: HyperparameterTuner;

  constructor(
    config: TrainingConfig,
    agent: any,
    env: Env,
    evalEnv: Env,
    replayBuffer: ReplayBuffer
  ) {
    this.config = config;
    this.agent = agent;
    this.env = env;
    this.evalEnv = evalEnv;
    this.replayBuffer = replayBuffer;
    this.checkpointManager = new CheckpointManager(config.saveDirectory);
    this.logger = new TrainingLogger(config.logFrequency);
    this.hyperparameterTuner = new HyperparameterTuner();
  }

  async train(): Promise<TrainingMetrics[]> {
    console.log('Starting training...');
    console.log(`Total timesteps: ${this.config.totalTimesteps}`);
    console.log(`Device: ${this.config.device ?? 'cpu'}`);
    console.log(`Workers: ${this.config.numWorkers ?? 1}`);

    const startTime = Date.now();

    while (this.currentTimestep < this.config.totalTimesteps) {
      // Run training episode
      const episodeMetrics = await this.runEpisode();

      // Update metrics
      this.metrics.push(episodeMetrics);

      // Log progress
      this.logger.log(episodeMetrics);

      // Evaluation
      if (this.currentTimestep % this.config.evaluationFrequency === 0) {
        const evalScore = await this.evaluate();
        console.log(`\n=== Evaluation at timestep ${this.currentTimestep} ===`);
        console.log(`Score: ${evalScore.toFixed(2)}\n`);
      }

      // Checkpoint
      if (this.currentTimestep % this.config.checkpointFrequency === 0) {
        await this.saveCheckpoint();
      }

      // Hyperparameter tuning (optional)
      if (this.currentTimestep % (this.config.checkpointFrequency * 5) === 0) {
        await this.hyperparameterTuner.tune(this.agent, this.metrics);
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;
    const fps = this.currentTimestep / totalTime;

    console.log(`\nTraining completed!`);
    console.log(`Total time: ${totalTime.toFixed(2)}s`);
    console.log(`Average FPS: ${fps.toFixed(2)}`);

    // Final checkpoint
    await this.saveCheckpoint();

    return this.metrics;
  }

  private async runEpisode(): Promise<TrainingMetrics> {
    let state = await this.env.reset();
    state = this.stateToVector(state);

    let episodeReward = 0;
    let episodeLength = 0;
    let totalLoss = 0;
    const startTime = Date.now();

    let terminated = false;
    let truncated = false;

    while (!terminated && !truncated) {
      // Select action
      const action = this.selectAction(state);

      // Step environment
      const stepResult = await this.env.step(action);
      const nextState = this.stateToVector(stepResult.observation);

      // Store transition
      const transition: Transition = {
        state,
        action,
        reward: stepResult.reward,
        nextState: stepResult.terminated || stepResult.truncated ? null : nextState,
        terminated: stepResult.terminated,
        truncated: stepResult.truncated,
        info: stepResult.info,
      };

      this.replayBuffer.add(transition);

      // Train agent
      if (this.replayBuffer.size >= this.agent.config?.batchSize ?? 32) {
        const batch = this.replayBuffer.sample(this.agent.config?.batchSize ?? 32);
        const loss = await this.trainAgent(batch);
        totalLoss += loss;
      }

      episodeReward += stepResult.reward;
      episodeLength++;
      this.currentTimestep++;

      state = nextState;
      terminated = stepResult.terminated;
      truncated = stepResult.truncated;

      // Check if we've reached total timesteps
      if (this.currentTimestep >= this.config.totalTimesteps) {
        break;
      }
    }

    const elapsedTime = Date.now() - startTime;
    const fps = episodeLength / (elapsedTime / 1000);

    return {
      episodeReward,
      episodeLength,
      loss: totalLoss / Math.max(1, episodeLength),
      fps,
      evaluationScore: 0,
      timestamp: Date.now(),
    };
  }

  private selectAction(state: number[]): number {
    if (typeof this.agent.selectAction === 'function') {
      return this.agent.selectAction(state, true);
    }
    return Math.floor(Math.random() * this.env.actionSpace.size);
  }

  private async trainAgent(batch: Transition[]): Promise<number> {
    if (typeof this.agent.train === 'function') {
      return await this.agent.train(batch);
    }
    return 0;
  }

  private async evaluate(numEpisodes: number = 10): Promise<number> {
    let totalReward = 0;

    for (let i = 0; i < numEpisodes; i++) {
      const episodeReward = await this.runEvaluationEpisode();
      totalReward += episodeReward;
    }

    return totalReward / numEpisodes;
  }

  private async runEvaluationEpisode(): Promise<number> {
    let state = await this.evalEnv.reset();
    state = this.stateToVector(state);

    let episodeReward = 0;
    let terminated = false;
    let truncated = false;

    while (!terminated && !truncated) {
      const action = this.selectAction(state);
      const stepResult = await this.evalEnv.step(action);

      episodeReward += stepResult.reward;
      state = this.stateToVector(stepResult.observation);

      terminated = stepResult.terminated;
      truncated = stepResult.truncated;
    }

    return episodeReward;
  }

  private async saveCheckpoint(): Promise<void> {
    const checkpointData: CheckpointData = {
      timestep: this.currentTimestep,
      agentState: this.agent,
      optimizerState: null,
      metrics: this.metrics,
      hyperparameters: this.getHyperparameters(),
    };

    await this.checkpointManager.save(checkpointData);
  }

  private async loadCheckpoint(checkpointPath: string): Promise<void> {
    const checkpointData = await this.checkpointManager.load(checkpointPath);

    this.currentTimestep = checkpointData.timestep;
    this.metrics = checkpointData.metrics;
    this.agent = checkpointData.agentState;
  }

  private getHyperparameters(): Record<string, any> {
    if (this.agent.config) {
      return { ...this.agent.config };
    }
    return {};
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

  getMetrics(): TrainingMetrics[] {
    return this.metrics;
  }

  getCurrentTimestep(): number {
    return this.currentTimestep;
  }
}

/**
 * Checkpoint Manager
 */
export class CheckpointManager {
  private saveDirectory: string;

  constructor(saveDirectory: string) {
    this.saveDirectory = saveDirectory;
  }

  async save(checkpointData: CheckpointData): Promise<void> {
    const filename = `${this.saveDirectory}/checkpoint_${checkpointData.timestep}.json`;

    // In production, would save to file
    console.log(`Saving checkpoint to ${filename}`);
    console.log(`Timestep: ${checkpointData.timestep}`);
    console.log(`Metrics: ${checkpointData.metrics.length} entries`);
  }

  async load(checkpointPath: string): Promise<CheckpointData> {
    // In production, would load from file
    console.log(`Loading checkpoint from ${checkpointPath}`);

    return {
      timestep: 0,
      agentState: null,
      optimizerState: null,
      metrics: [],
      hyperparameters: {},
    };
  }

  async listCheckpoints(): Promise<string[]> {
    // In production, would list files
    return [];
  }

  async deleteOldCheckpoints(keepLastN: number = 5): Promise<void> {
    // In production, would delete old checkpoint files
    console.log(`Deleting old checkpoints, keeping last ${keepLastN}`);
  }
}

/**
 * Training Logger
 */
export class TrainingLogger {
  private logFrequency: number;
  private logCount: number = 0;

  constructor(logFrequency: number) {
    this.logFrequency = logFrequency;
  }

  log(metrics: TrainingMetrics): void {
    this.logCount++;

    if (this.logCount % this.logFrequency === 0) {
      console.log(`\n=== Training Progress ===`);
      console.log(`Timestep: ${this.getCurrentTimestep()}`);
      console.log(`Episode Reward: ${metrics.episodeReward.toFixed(2)}`);
      console.log(`Episode Length: ${metrics.episodeLength}`);
      console.log(`Loss: ${metrics.loss.toFixed(4)}`);
      console.log(`FPS: ${metrics.fps.toFixed(2)}`);
      console.log(`========================\n`);
    }
  }

  private getCurrentTimestep(): number {
    return this.logCount;
  }

  logHyperparameters(hyperparameters: Record<string, any>): void {
    console.log('\n=== Hyperparameters ===');
    for (const [key, value] of Object.entries(hyperparameters)) {
      console.log(`${key}: ${value}`);
    }
    console.log('=======================\n');
  }
}

/**
 * Hyperparameter Tuner
 */
export class HyperparameterTuner {
  private searchSpace: Map<string, any[]> = new Map();
  private currentTrial: number = 0;

  registerHyperparameter(name: string, values: any[]): void {
    this.searchSpace.set(name, values);
  }

  async tune(agent: any, metrics: TrainingMetrics[]): Promise<void> {
    console.log('Starting hyperparameter tuning...');

    // Grid search (simplified)
    const combinations = this.generateCombinations();

    for (const combination of combinations) {
      this.currentTrial++;

      console.log(`\nTrial ${this.currentTrial}:`);
      console.log(JSON.stringify(combination, null, 2));

      // Apply hyperparameters
      this.applyHyperparameters(agent, combination);

      // In production, would run evaluation and select best
    }
  }

  private generateCombinations(): Record<string, any>[] {
    const combinations: Record<string, any>[] = [];
    const keys = Array.from(this.searchSpace.keys());

    // Generate all combinations (cartesian product)
    const generate = (index: number, current: Record<string, any>) => {
      if (index >= keys.length) {
        combinations.push({ ...current });
        return;
      }

      const key = keys[index];
      const values = this.searchSpace.get(key) ?? [];

      for (const value of values) {
        current[key] = value;
        generate(index + 1, current);
      }
    };

    generate(0, {});

    return combinations;
  }

  private applyHyperparameters(agent: any, hyperparameters: Record<string, any>): void {
    if (agent.config) {
      for (const [key, value] of Object.entries(hyperparameters)) {
        if (key in agent.config) {
          agent.config[key] = value;
        }
      }
    }
  }

  getCurrentTrial(): number {
    return this.currentTrial;
  }
}

/**
 * Multi-Agent Training Orchestrator
 */
export class MultiAgentTrainingOrchestrator {
  private agents: Map<string, any> = new Map();
  private envs: Map<string, Env> = new Map();
  private orchestrators: Map<string, TrainingOrchestrator> = new Map();

  addAgent(id: string, agent: any, env: Env, evalEnv: Env, replayBuffer: ReplayBuffer): void {
    this.agents.set(id, agent);
    this.envs.set(id, env);

    const config: TrainingConfig = {
      totalTimesteps: 1000000,
      evaluationFrequency: 10000,
      checkpointFrequency: 50000,
      logFrequency: 1000,
      saveDirectory: `./checkpoints/${id}`,
    };

    const orchestrator = new TrainingOrchestrator(config, agent, env, evalEnv, replayBuffer);
    this.orchestrators.set(id, orchestrator);
  }

  async trainAll(): Promise<Map<string, TrainingMetrics[]>> {
    const results = new Map<string, TrainingMetrics[]>();

    // Train all agents in parallel
    const promises = Array.from(this.orchestrators.entries()).map(async ([id, orchestrator]) => {
      const metrics = await orchestrator.train();
      results.set(id, metrics);
    });

    await Promise.all(promises);

    return results;
  }

  async trainSequential(): Promise<Map<string, TrainingMetrics[]>> {
    const results = new Map<string, TrainingMetrics[]>();

    for (const [id, orchestrator] of this.orchestrators) {
      console.log(`\n=== Training agent ${id} ===`);
      const metrics = await orchestrator.train();
      results.set(id, metrics);
    }

    return results;
  }

  getMetrics(id: string): TrainingMetrics[] {
    const orchestrator = this.orchestrators.get(id);
    return orchestrator?.getMetrics() ?? [];
  }
}

/**
 * Distributed Training Coordinator
 */
export class DistributedTrainingCoordinator {
  private workers: Worker[] = [];
  private numWorkers: number;
  private taskQueue: TrainingTask[] = [];
  private results: Map<string, any> = new Map();

  constructor(numWorkers: number) {
    this.numWorkers = numWorkers;
  }

  async initialize(): Promise<void> {
    // Initialize workers
    for (let i = 0; i < this.numWorkers; i++) {
      const worker = new Worker();
      this.workers.push(worker);
    }
  }

  addTask(task: TrainingTask): void {
    this.taskQueue.push(task);
  }

  async executeTasks(): Promise<Map<string, any>> {
    // Distribute tasks to workers
    const promises = this.workers.map((worker, index) => {
      const task = this.taskQueue[index];
      if (task) {
        return this.executeTask(worker, task);
      }
      return Promise.resolve(null);
    });

    const taskResults = await Promise.all(promises);

    for (let i = 0; i < taskResults.length; i++) {
      const task = this.taskQueue[i];
      if (task && taskResults[i]) {
        this.results.set(task.id, taskResults[i]);
      }
    }

    return this.results;
  }

  private async executeTask(worker: Worker, task: TrainingTask): Promise<any> {
    // In production, would send task to worker
    console.log(`Executing task ${task.id} on worker`);
    return null;
  }

  shutdown(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
  }
}

export interface TrainingTask {
  id: string;
  type: 'train' | 'evaluate' | 'tune';
  agentState: any;
  envConfig: any;
  hyperparameters: Record<string, any>;
}

// Simplified Worker class
class Worker {
  terminate(): void {
    // In production, would terminate worker thread
  }
}

/**
 * Training Factory
 */
export class TrainingFactory {
  static createOrchestrator(
    config: TrainingConfig,
    agent: any,
    env: Env,
    evalEnv: Env,
    replayBuffer: ReplayBuffer
  ): TrainingOrchestrator {
    return new TrainingOrchestrator(config, agent, env, evalEnv, replayBuffer);
  }

  static getDefaultConfig(saveDirectory: string = './checkpoints'): TrainingConfig {
    return {
      totalTimesteps: 1000000,
      evaluationFrequency: 10000,
      checkpointFrequency: 50000,
      logFrequency: 1000,
      saveDirectory,
    };
  }
}
