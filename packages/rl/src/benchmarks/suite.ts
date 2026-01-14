/**
 * RL Benchmark Suite
 * Comprehensive benchmarks for evaluating RL agents
 */

import { Env, StepResult } from '../envs/base.js';
import { DQNAgent } from '../agents/dqn.js';
import { PPOAgent } from '../agents/ppo.js';
import { A3CAgent } from '../agents/a3c.js';
import { SACAgent } from '../agents/sac.js';

export interface BenchmarkConfig {
  numEpisodes: number;
  maxStepsPerEpisode: number;
  evaluationEpisodes: number;
  seed?: number;
  render?: boolean;
  saveResults?: boolean;
  outputDirectory?: string;
}

export interface BenchmarkResult {
  agentName: string;
  envName: string;
  meanReward: number;
  stdReward: number;
  maxReward: number;
  minReward: number;
  meanEpisodeLength: number;
  successRate: number;
  trainingTime: number;
  inferenceTime: number;
  metrics: Record<string, number>;
  timestamp: number;
}

export interface BenchmarkComparison {
  results: BenchmarkResult[];
  ranking: BenchmarkResult[];
  statisticalTests: StatisticalTest[];
  summary: string;
}

export interface StatisticalTest {
  name: string;
  pValue: number;
  significant: boolean;
  effectSize: number;
}

/**
 * Benchmark Suite
 */
export class BenchmarkSuite {
  private benchmarks: Map<string, Benchmark> = new Map();
  private results: BenchmarkResult[] = [];

  registerBenchmark(name: string, benchmark: Benchmark): void {
    this.benchmarks.set(name, benchmark);
  }

  async runBenchmark(
    name: string,
    agent: any,
    config: BenchmarkConfig
  ): Promise<BenchmarkResult> {
    const benchmark = this.benchmarks.get(name);

    if (!benchmark) {
      throw new Error(`Benchmark ${name} not found`);
    }

    console.log(`\n=== Running benchmark: ${name} ===`);
    console.log(`Agent: ${agent.constructor.name}`);
    console.log(`Episodes: ${config.numEpisodes}`);

    const result = await benchmark.run(agent, config);

    this.results.push(result);

    console.log(`\n=== Benchmark completed ===`);
    console.log(`Mean Reward: ${result.meanReward.toFixed(2)} ± ${result.stdReward.toFixed(2)}`);
    console.log(`Success Rate: ${(result.successRate * 100).toFixed(1)}%\n`);

    return result;
  }

  async runAllBenchmarks(
    agents: Map<string, any>,
    config: BenchmarkConfig
  ): Promise<Map<string, BenchmarkResult[]>> {
    const allResults = new Map<string, BenchmarkResult[]>();

    for (const [agentName, agent] of agents) {
      const agentResults: BenchmarkResult[] = [];

      for (const [benchmarkName] of this.benchmarks) {
        const result = await this.runBenchmark(benchmarkName, agent, config);
        result.agentName = agentName;
        agentResults.push(result);
      }

      allResults.set(agentName, agentResults);
    }

    return allResults;
  }

  compareResults(results: BenchmarkResult[]): BenchmarkComparison {
    // Rank results by mean reward
    const ranking = [...results].sort((a, b) => b.meanReward - a.meanReward);

    // Perform statistical tests
    const statisticalTests = this.performStatisticalTests(results);

    // Generate summary
    const summary = this.generateSummary(results, ranking, statisticalTests);

    return {
      results,
      ranking,
      statisticalTests,
      summary,
    };
  }

  private performStatisticalTests(results: BenchmarkResult[]): StatisticalTest[] {
    const tests: StatisticalTest[] = [];

    // Pairwise t-tests (simplified)
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const test = this.tTest(results[i], results[j]);
        tests.push(test);
      }
    }

    return tests;
  }

  private tTest(result1: BenchmarkResult, result2: BenchmarkResult): StatisticalTest {
    // Simplified t-test
    const n1 = 100; // Would use actual sample size
    const n2 = 100;

    const pooledStd = Math.sqrt(
      (Math.pow(result1.stdReward, 2) / n1 + Math.pow(result2.stdReward, 2) / n2)
    );

    const tStat = (result1.meanReward - result2.meanReward) / pooledStd;

    // Simplified p-value calculation
    const pValue = 2 * (1 - this.normalCDF(Math.abs(tStat)));

    // Effect size (Cohen's d)
    const effectSize = (result1.meanReward - result2.meanReward) /
                       Math.sqrt((Math.pow(result1.stdReward, 2) + Math.pow(result2.stdReward, 2)) / 2);

    return {
      name: `${result1.agentName} vs ${result2.agentName}`,
      pValue,
      significant: pValue < 0.05,
      effectSize,
    };
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  private generateSummary(
    results: BenchmarkResult[],
    ranking: BenchmarkResult[],
    tests: StatisticalTest[]
  ): string {
    let summary = '\n=== Benchmark Summary ===\n\n';

    summary += 'Rankings:\n';
    for (let i = 0; i < ranking.length; i++) {
      summary += `${i + 1}. ${ranking[i].agentName}: ${ranking[i].meanReward.toFixed(2)}\n`;
    }

    summary += '\nStatistical Tests:\n';
    for (const test of tests) {
      summary += `${test.name}: p=${test.pValue.toFixed(4)}`;
      summary += test.significant ? ' *' : '';
      summary += ` (d=${test.effectSize.toFixed(3)})\n`;
    }

    return summary;
  }

  getResults(): BenchmarkResult[] {
    return this.results;
  }

  exportResults(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.results, null, 2);
    } else {
      // CSV format
      const headers = Object.keys(this.results[0] ?? {}).join(',');
      const rows = this.results.map(r => Object.values(r).join(','));
      return [headers, ...rows].join('\n');
    }
  }
}

/**
 * Benchmark Interface
 */
export interface Benchmark {
  name: string;
  run(agent: any, config: BenchmarkConfig): Promise<BenchmarkResult>;
}

/**
 * Environment Benchmark
 */
export class EnvironmentBenchmark implements Benchmark {
  name: string;
  env: Env;

  constructor(name: string, env: Env) {
    this.name = name;
    this.env = env;
  }

  async run(agent: any, config: BenchmarkConfig): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const rewards: number[] = [];
    const episodeLengths: number[] = [];
    let successes = 0;

    // Training phase
    for (let ep = 0; ep < config.numEpisodes; ep++) {
      const state = await this.env.reset();
      let totalReward = 0;
      let steps = 0;
      let terminated = false;
      let truncated = false;

      while (!terminated && !truncated && steps < config.maxStepsPerEpisode) {
        const action = this.selectAction(agent, state);
        const stepResult = await this.env.step(action);

        totalReward += stepResult.reward;
        steps++;

        state = stepResult.observation;
        terminated = stepResult.terminated;
        truncated = stepResult.truncated;

        if (stepResult.terminated) {
          successes++;
        }
      }

      rewards.push(totalReward);
      episodeLengths.push(steps);
    }

    const trainingTime = (Date.now() - startTime) / 1000;

    // Evaluation phase
    const evalStartTime = Date.now();
    const evalRewards: number[] = [];

    for (let ep = 0; ep < config.evaluationEpisodes; ep++) {
      const state = await this.env.reset();
      let totalReward = 0;
      let steps = 0;
      let terminated = false;
      let truncated = false;

      while (!terminated && !truncated && steps < config.maxStepsPerEpisode) {
        const action = this.selectAction(agent, state, true);
        const stepResult = await this.env.step(action);

        totalReward += stepResult.reward;
        steps++;

        state = stepResult.observation;
        terminated = stepResult.terminated;
        truncated = stepResult.truncated;
      }

      evalRewards.push(totalReward);
    }

    const inferenceTime = (Date.now() - evalStartTime) / 1000;

    // Calculate statistics
    const meanReward = evalRewards.reduce((a, b) => a + b, 0) / evalRewards.length;
    const stdReward = Math.sqrt(
      evalRewards.reduce((sum, r) => sum + Math.pow(r - meanReward, 2), 0) / evalRewards.length
    );
    const maxReward = Math.max(...evalRewards);
    const minReward = Math.min(...evalRewards);
    const meanEpisodeLength = episodeLengths.reduce((a, b) => a + b, 0) / episodeLengths.length;
    const successRate = successes / config.numEpisodes;

    return {
      agentName: agent.constructor.name,
      envName: this.name,
      meanReward,
      stdReward,
      maxReward,
      minReward,
      meanEpisodeLength,
      successRate,
      trainingTime,
      inferenceTime,
      metrics: {
        totalEpisodes: config.numEpisodes,
        evaluationEpisodes: config.evaluationEpisodes,
      },
      timestamp: Date.now(),
    };
  }

  private selectAction(agent: any, state: any, evaluate: boolean = false): any {
    if (typeof agent.selectAction === 'function') {
      return agent.selectAction(state, !evaluate);
    }
    // Random action
    return Math.floor(Math.random() * 10);
  }
}

/**
 * Performance Benchmark
 */
export class PerformanceBenchmark implements Benchmark {
  name: string;
  envFactory: () => Env;

  constructor(name: string, envFactory: () => Env) {
    this.name = name;
    this.envFactory = envFactory;
  }

  async run(agent: any, config: BenchmarkConfig): Promise<BenchmarkResult> {
    const metrics: Record<string, number> = {};

    // Measure memory usage
    const startMemory = this.getMemoryUsage();

    // Measure training throughput
    const env = this.envFactory();
    const startTime = Date.now();
    let steps = 0;

    for (let i = 0; i < config.numEpisodes; i++) {
      const state = await env.reset();
      let terminated = false;
      let truncated = false;

      while (!terminated && !truncated && steps < config.maxStepsPerEpisode) {
        const action = this.selectAction(agent, state);
        const stepResult = await env.step(action);

        steps++;
        state = stepResult.observation;
        terminated = stepResult.terminated;
        truncated = stepResult.truncated;
      }
    }

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;

    const endMemory = this.getMemoryUsage();

    const fps = steps / totalTime;
    const memoryUsed = endMemory - startMemory;

    metrics.fps = fps;
    metrics.memoryUsed = memoryUsed;
    metrics.totalSteps = steps;

    return {
      agentName: agent.constructor.name,
      envName: this.name,
      meanReward: fps,
      stdReward: 0,
      maxReward: fps,
      minReward: fps,
      meanEpisodeLength: 0,
      successRate: 1,
      trainingTime: totalTime,
      inferenceTime: 0,
      metrics,
      timestamp: Date.now(),
    };
  }

  private selectAction(agent: any, state: any): any {
    if (typeof agent.selectAction === 'function') {
      return agent.selectAction(state, true);
    }
    return Math.floor(Math.random() * 10);
  }

  private getMemoryUsage(): number {
    // Simplified memory measurement
    return process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }
}

/**
 * Algorithm Benchmark
 * Compares different RL algorithms
 */
export class AlgorithmBenchmark implements Benchmark {
  name: string = 'algorithm_comparison';
  env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async run(agent: any, config: BenchmarkConfig): Promise<BenchmarkResult> {
    const rewards: number[] = [];

    for (let i = 0; i < config.numEpisodes; i++) {
      const state = await this.env.reset();
      let totalReward = 0;
      let terminated = false;
      let truncated = false;
      let steps = 0;

      while (!terminated && !truncated && steps < config.maxStepsPerEpisode) {
        const action = this.selectAction(agent, state);
        const stepResult = await this.env.step(action);

        totalReward += stepResult.reward;
        steps++;

        state = stepResult.observation;
        terminated = stepResult.terminated;
        truncated = stepResult.truncated;
      }

      rewards.push(totalReward);
    }

    const meanReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const stdReward = Math.sqrt(
      rewards.reduce((sum, r) => sum + Math.pow(r - meanReward, 2), 0) / rewards.length
    );

    return {
      agentName: agent.constructor.name,
      envName: this.name,
      meanReward,
      stdReward,
      maxReward: Math.max(...rewards),
      minReward: Math.min(...rewards),
      meanEpisodeLength: 0,
      successRate: 0,
      trainingTime: 0,
      inferenceTime: 0,
      metrics: {},
      timestamp: Date.now(),
    };
  }

  private selectAction(agent: any, state: any): any {
    if (typeof agent.selectAction === 'function') {
      return agent.selectAction(state, true);
    }
    return Math.floor(Math.random() * 10);
  }
}

/**
 * Benchmark Registry
 */
export class BenchmarkRegistry {
  private static instance: BenchmarkRegistry;
  private benchmarks: Map<string, Benchmark> = new Map();

  private constructor() {}

  static getInstance(): BenchmarkRegistry {
    if (!BenchmarkRegistry.instance) {
      BenchmarkRegistry.instance = new BenchmarkRegistry();
    }
    return BenchmarkRegistry.instance;
  }

  register(name: string, benchmark: Benchmark): void {
    this.benchmarks.set(name, benchmark);
  }

  get(name: string): Benchmark | undefined {
    return this.benchmarks.get(name);
  }

  list(): string[] {
    return Array.from(this.benchmarks.keys());
  }
}

/**
 * Benchmark Factory
 */
export class BenchmarkFactory {
  static createSuite(): BenchmarkSuite {
    return new BenchmarkSuite();
  }

  static createEnvironmentBenchmark(name: string, env: Env): EnvironmentBenchmark {
    return new EnvironmentBenchmark(name, env);
  }

  static createPerformanceBenchmark(name: string, envFactory: () => Env): PerformanceBenchmark {
    return new PerformanceBenchmark(name, envFactory);
  }

  static createAlgorithmBenchmark(env: Env): AlgorithmBenchmark {
    return new AlgorithmBenchmark(env);
  }

  static getDefaultConfig(): BenchmarkConfig {
    return {
      numEpisodes: 100,
      maxStepsPerEpisode: 1000,
      evaluationEpisodes: 20,
      seed: 42,
      render: false,
      saveResults: true,
      outputDirectory: './benchmark_results',
    };
  }

  static createCodeCompletionBenchmark(): BenchmarkSuite {
    const suite = this.createSuite();

    // Register standard code completion benchmarks
    // suite.register('easy_completion', ...);
    // suite.register('medium_completion', ...);
    // suite.register('hard_completion', ...);

    return suite;
  }

  static createDQNBenchmark(): BenchmarkSuite {
    const suite = this.createSuite();

    // Register DQN-specific benchmarks
    // suite.register('dqn_cartpole', ...);
    // suite.register('dqn_pong', ...);

    return suite;
  }
}
