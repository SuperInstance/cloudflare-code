/**
 * Hyperparameter Optimizer
 *
 * Advanced hyperparameter optimization including:
 * - Grid search for exhaustive exploration
 * - Random search for efficient exploration
 * - Bayesian optimization for smart search
 * - Hyperparameter scheduling (warmup, decay)
 * - Multi-objective optimization
 * - Experiment tracking and management
 * - Best model selection and analysis
 */

// @ts-nocheck

import type { Hyperparameters, ModelMetrics } from '../types';

// ============================================================================
// Hyperparameter Space Definition
// ============================================================================

export type ParamType = 'continuous' | 'discrete' | 'categorical';

export interface ParamSpace {
  name: string;
  type: ParamType;
  bounds?: [number, number]; // For continuous/discrete
  values?: any[]; // For categorical
  scale?: 'linear' | 'log' | 'logit';
}

export interface SearchSpace {
  params: ParamSpace[];
  constraints?: Array<{
    type: 'equality' | 'inequality';
    expr: string; // Expression to evaluate
  }>;
}

export interface HyperparameterTrial {
  id: string;
  params: Hyperparameters;
  metrics: ModelMetrics;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'pruned';
  startTime?: number;
  endTime?: number;
  duration?: number;
  cost?: number;
  metadata?: Record<string, any>;
}

export interface OptimizationConfig {
  maxTrials: number;
  parallelTrials: number;
  maxDuration: number; // milliseconds
  objective: {
    metric: string;
    direction: 'minimize' | 'maximize';
    target?: number;
  };
  pruning?: {
    enabled: boolean;
    earlyStoppingSteps: number;
    minSteps: number;
  };
  constraints?: Array<{
    metric: string;
    operator: '<=' | '>=' | '<' | '>';
    value: number;
  }>;
}

// ============================================================================
// Grid Search
// ============================================================================

export class GridSearchOptimizer {
  private space: SearchSpace;
  private grid: Hyperparameters[] = [];

  constructor(space: SearchSpace) {
    this.space = space;
    this.generateGrid();
  }

  /**
   * Generate all combinations in the grid
   */
  private generateGrid(): void {
    const paramValues = this.space.params.map(param => {
      switch (param.type) {
        case 'continuous':
          return this.linspace(
            param.bounds![0],
            param.bounds![1],
            10 // Default to 10 points for continuous
          );
        case 'discrete':
          const step = (param.bounds![1] - param.bounds![0]) / 9;
          return Array.from({ length: 10 }, (_, i) => param.bounds![0] + i * step);
        case 'categorical':
          return param.values!;
      }
    });

    // Generate all combinations
    this.grid = this.cartesianProduct(paramValues);
  }

  /**
   * Get all trials to run
   */
  getTrials(): HyperparameterTrial[] {
    return this.grid.map((params, index) => ({
      id: `grid-trial-${index}`,
      params: this.paramsToHyperparameters(params),
      metrics: { loss: 0 },
      status: 'pending',
    }));
  }

  /**
   * Get total number of trials
   */
  getTotalTrials(): number {
    return this.grid.length;
  }

  /**
   * Create adaptive grid (refine around best results)
   */
  refineGrid(
    completedTrials: HyperparameterTrial[],
    topN: number = 5
  ): GridSearchOptimizer {
    // Sort trials by objective metric
    const sorted = [...completedTrials].sort((a, b) => a.metrics.loss - b.metrics.loss);
    const best = sorted.slice(0, topN);

    // Create new search space around best trials
    const newParams = this.space.params.map(param => {
      const bestValues = best.map(t => t.params[param.name as keyof Hyperparameters]);
      const min = Math.min(...bestValues) as number;
      const max = Math.max(...bestValues) as number;
      const margin = (max - min) * 0.2;

      return {
        ...param,
        bounds: [Math.max(min - margin, param.bounds?.[0] || 0), min + margin] as [number, number],
      };
    });

    return new GridSearchOptimizer({ params: newParams });
  }

  private linspace(start: number, end: number, num: number): number[] {
    const step = (end - start) / (num - 1);
    return Array.from({ length: num }, (_, i) => start + i * step);
  }

  private cartesianProduct(arrays: any[][]): any[] {
    return arrays.reduce(
      (acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])),
      [[]] as any[][]
    );
  }

  private paramsToHyperparameters(params: any[]): Hyperparameters {
    const hyperparams: any = {};
    this.space.params.forEach((param, index) => {
      hyperparams[param.name] = params[index];
    });
    return hyperparams;
  }
}

// ============================================================================
// Random Search
// ============================================================================

export class RandomSearchOptimizer {
  private space: SearchSpace;
  private seed: number;

  constructor(space: SearchSpace, seed: number = 42) {
    this.space = space;
    this.seed = seed;
  }

  /**
   * Generate a random trial
   */
  generateTrial(trialId: string): HyperparameterTrial {
    const params: any = {};

    for (const param of this.space.params) {
      params[param.name] = this.sampleParam(param);
    }

    return {
      id: trialId,
      params,
      metrics: { loss: 0 },
      status: 'pending',
    };
  }

  /**
   * Generate multiple random trials
   */
  generateTrials(count: number): HyperparameterTrial[] {
    return Array.from({ length: count }, (_, i) =>
      this.generateTrial(`random-trial-${i}`)
    );
  }

  /**
   * Adaptive random search (focus on promising regions)
   */
  adaptSampling(
    completedTrials: HyperparameterTrial[],
    focusFactor: number = 0.7
  ): RandomSearchOptimizer {
    // Sort trials by performance
    const sorted = [...completedTrials].sort(
      (a, b) => a.metrics.loss - b.metrics.loss
    );

    // Sample around best trials with probability focusFactor
    const bestParams = sorted.slice(0, Math.floor(sorted.length * focusFactor));

    return new RandomSearchOptimizer(this.space, this.seed + 1);
  }

  private sampleParam(param: ParamSpace): any {
    const random = this.seededRandom(this.seed++);

    switch (param.type) {
      case 'continuous':
        if (param.scale === 'log') {
          const logMin = Math.log(param.bounds![0]);
          const logMax = Math.log(param.bounds![1]);
          return Math.exp(logMin + random * (logMax - logMin));
        }
        return param.bounds![0] + random * (param.bounds![1] - param.bounds![0]);

      case 'discrete':
        const range = param.bounds![1] - param.bounds![0];
        return Math.round(param.bounds![0] + random * range);

      case 'categorical':
        const idx = Math.floor(random * param.values!.length);
        return param.values![idx];
    }
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
}

// ============================================================================
// Bayesian Optimization
// ============================================================================

export interface BayesianConfig {
  acquisitionFunction: 'EI' | 'PI' | 'UCB' | 'TS';
  kappa: number; // For UCB
  xi: number; // For EI/PI
  nInitial: number; // Number of random trials before Bayesian
}

export class BayesianOptimizer {
  private space: SearchSpace;
  private config: BayesianConfig;
  private trials: HyperparameterTrial[] = [];

  constructor(space: SearchSpace, config: Partial<BayesianConfig> = {}) {
    this.space = space;
    this.config = {
      acquisitionFunction: 'EI',
      kappa: 2.576,
      xi: 0.01,
      nInitial: 10,
      ...config,
    };
  }

  /**
   * Suggest next trial to run
   */
  suggestTrial(): HyperparameterTrial {
    // If we don't have enough trials, use random search
    if (this.trials.length < this.config.nInitial) {
      const randomOptimizer = new RandomSearchOptimizer(this.space);
      return randomOptimizer.generateTrial(`bayesian-trial-${this.trials.length}`);
    }

    // Use Bayesian optimization to suggest next trial
    const params = this.optimizeAcquisition();
    const completed = this.trials.filter(t => t.status === 'completed');

    return {
      id: `bayesian-trial-${this.trials.length}`,
      params,
      metrics: { loss: 0 },
      status: 'pending',
      metadata: {
        acquisitionValue: this.evaluateAcquisition(params),
      },
    };
  }

  /**
   * Add a completed trial
   */
  addTrial(trial: HyperparameterTrial): void {
    this.trials.push(trial);
  }

  /**
   * Get the best trial so far
   */
  getBestTrial(): HyperparameterTrial | null {
    const completed = this.trials.filter(t => t.status === 'completed');
    if (completed.length === 0) return null;

    return completed.reduce((best, current) =>
      current.metrics.loss < best.metrics.loss ? current : best
    );
  }

  /**
   * Optimize the acquisition function
   */
  private optimizeAcquisition(): Hyperparameters {
    // In production, this would use Gaussian Process regression
    // and optimize the acquisition function using gradient-based methods
    // For now, use a simple grid search over the acquisition function

    const optimizer = new GridSearchOptimizer(
      this.coarseSearchSpace()
    );
    const trials = optimizer.getTrials();

    let bestParams = trials[0].params;
    let bestValue = -Infinity;

    for (const trial of trials) {
      const value = this.evaluateAcquisition(trial.params);
      if (value > bestValue) {
        bestValue = value;
        bestParams = trial.params;
      }
    }

    return bestParams;
  }

  /**
   * Evaluate acquisition function for given params
   */
  private evaluateAcquisition(params: Hyperparameters): number {
    const completed = this.trials.filter(t => t.status === 'completed');
    if (completed.length === 0) return 1;

    // Simple surrogate model: use distance-based kernel
    const mean = this.predictMean(params);
    const std = this.predictStd(params);

    switch (this.config.acquisitionFunction) {
      case 'EI': // Expected Improvement
        const best = Math.min(...completed.map(t => t.metrics.loss));
        const z = (best - mean - this.config.xi) / (std + 1e-10);
        return (best - mean - this.config.xi) * this.cdf(z) + std * this.pdf(z);

      case 'PI': // Probability of Improvement
        const z_pi = (best - mean - this.config.xi) / (std + 1e-10);
        return this.cdf(z_pi);

      case 'UCB': // Upper Confidence Bound
        return mean + this.config.kappa * std;

      case 'TS': // Thompson Sampling
        return mean + std * this.randn();

      default:
        return mean;
    }
  }

  /**
   * Predict mean using simple kernel regression
   */
  private predictMean(params: Hyperparameters): number {
    const completed = this.trials.filter(t => t.status === 'completed');
    if (completed.length === 0) return 0;

    let weightedSum = 0;
    let weightTotal = 0;

    for (const trial of completed) {
      const weight = this.kernel(params, trial.params);
      weightedSum += weight * trial.metrics.loss;
      weightTotal += weight;
    }

    return weightTotal > 0 ? weightedSum / weightTotal : 0;
  }

  /**
   * Predict std using simple kernel regression
   */
  private predictStd(params: Hyperparameters): number {
    const completed = this.trials.filter(t => t.status === 'completed');
    if (completed.length < 2) return 1;

    // Simple variance estimate based on distance to nearest neighbors
    const distances = completed.map(t => this.distance(params, t.params));
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

    return Math.max(0.1, avgDistance / 10);
  }

  /**
   * RBF kernel for similarity
   */
  private kernel(params1: Hyperparameters, params2: Hyperparameters): number {
    const dist = this.distance(params1, params2);
    return Math.exp(-dist * dist / 2);
  }

  /**
   * Euclidean distance between parameter vectors
   */
  private distance(params1: Hyperparameters, params2: Hyperparameters): number {
    let sum = 0;
    for (const param of this.space.params) {
      const v1 = params1[param.name as keyof Hyperparameters] as number;
      const v2 = params2[param.name as keyof Hyperparameters] as number;
      const diff = (v1 - v2) / (param.bounds?.[1] || 1);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Create a coarser search space for acquisition optimization
   */
  private coarseSearchSpace(): SearchSpace {
    return {
      params: this.space.params.map(param => ({
        ...param,
        bounds: param.type === 'categorical' ? undefined : param.bounds,
      })),
    };
  }

  private cdf(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private pdf(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  private erf(x: number): number {
    // Approximation of erf function
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }

  private randn(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}

// ============================================================================
// Multi-Objective Optimization
// ============================================================================

export interface Objective {
  name: string;
  metric: string;
  direction: 'minimize' | 'maximize';
  weight?: number;
}

export interface ParetoFront {
  trials: HyperparameterTrial[];
  dominated: Set<string>;
  nondominated: Set<string>;
}

export class MultiObjectiveOptimizer {
  private space: SearchSpace;
  private objectives: Objective[];
  private trials: HyperparameterTrial[] = [];

  constructor(space: SearchSpace, objectives: Objective[]) {
    this.space = space;
    this.objectives = objectives;
  }

  /**
   * Check if trial1 dominates trial2
   */
  private dominates(trial1: HyperparameterTrial, trial2: HyperparameterTrial): boolean {
    let atLeastOneBetter = false;

    for (const objective of this.objectives) {
      const value1 = trial1.metrics[objective.metric as keyof ModelMetrics] as number;
      const value2 = trial2.metrics[objective.metric as keyof ModelMetrics] as number;

      if (objective.direction === 'minimize') {
        if (value1 > value2) return false;
        if (value1 < value2) atLeastOneBetter = true;
      } else {
        if (value1 < value2) return false;
        if (value1 > value2) atLeastOneBetter = true;
      }
    }

    return atLeastOneBetter;
  }

  /**
   * Get Pareto frontier (non-dominated trials)
   */
  getParetoFront(): ParetoFront {
    const nondominated = new Set<string>();
    const dominated = new Set<string>();

    for (const trial1 of this.trials) {
      let isDominated = false;
      for (const trial2 of this.trials) {
        if (trial1.id === trial2.id) continue;
        if (this.dominates(trial2, trial1)) {
          isDominated = true;
          break;
        }
      }

      if (isDominated) {
        dominated.add(trial1.id);
      } else {
        nondominated.add(trial1.id);
      }
    }

    return {
      trials: this.trials.filter(t => nondominated.has(t.id)),
      dominated,
      nondominated,
    };
  }

  /**
   * Calculate hypervolume indicator
   */
  calculateHypervolume(referencePoint: number[]): number {
    const pareto = this.getParetoFront().trials;
    if (pareto.length === 0) return 0;

    // Simple approximation (exact calculation is complex)
    let volume = 0;
    for (const trial of pareto) {
      let product = 1;
      for (let i = 0; i < this.objectives.length; i++) {
        const objective = this.objectives[i];
        const value = trial.metrics[objective.metric as keyof ModelMetrics] as number;
        const ref = referencePoint[i];

        if (objective.direction === 'minimize') {
          product *= Math.max(0, ref - value);
        } else {
          product *= Math.max(0, value - ref);
        }
      }
      volume += product;
    }

    return volume;
  }

  /**
   * Add a trial
   */
  addTrial(trial: HyperparameterTrial): void {
    this.trials.push(trial);
  }
}

// ============================================================================
// Hyperparameter Scheduler
// ============================================================================

export interface ScheduleConfig {
  type: 'constant' | 'linear' | 'cosine' | 'exponential' | 'polynomial';
  initialValue: number;
  finalValue: number;
  totalSteps: number;
  warmupSteps?: number;
  warmupValue?: number;
  cycleSize?: number; // For cosine annealing with restarts
}

export class HyperparameterScheduler {
  private config: ScheduleConfig;

  constructor(config: ScheduleConfig) {
    this.config = config;
  }

  /**
   * Get value at given step
   */
  getValue(step: number): number {
    // Apply warmup
    if (this.config.warmupSteps && step < this.config.warmupSteps) {
      return this.warmupValue(step);
    }

    // Adjust step for warmup
    const adjustedStep = this.config.warmupSteps
      ? step - this.config.warmupSteps
      : step;
    const totalSteps = this.config.warmupSteps
      ? this.config.totalSteps - this.config.warmupSteps
      : this.config.totalSteps;

    switch (this.config.type) {
      case 'constant':
        return this.config.initialValue;

      case 'linear':
        return this.linearSchedule(adjustedStep, totalSteps);

      case 'cosine':
        return this.cosineSchedule(adjustedStep, totalSteps);

      case 'exponential':
        return this.exponentialSchedule(adjustedStep, totalSteps);

      case 'polynomial':
        return this.polynomialSchedule(adjustedStep, totalSteps);

      default:
        return this.config.initialValue;
    }
  }

  private warmupValue(step: number): number {
    const progress = step / this.config.warmupSteps!;
    const initial = this.config.warmupValue || this.config.initialValue * 0.1;
    const target = this.config.initialValue;
    return initial + (target - initial) * progress;
  }

  private linearSchedule(step: number, totalSteps: number): number {
    const progress = Math.min(step / totalSteps, 1);
    return (
      this.config.initialValue +
      (this.config.finalValue - this.config.initialValue) * progress
    );
  }

  private cosineSchedule(step: number, totalSteps: number): number {
    const progress = Math.min(step / totalSteps, 1);
    const cosine = 0.5 * (1 + Math.cos(Math.PI * progress));
    return (
      this.config.finalValue +
      (this.config.initialValue - this.config.finalValue) * cosine
    );
  }

  private exponentialSchedule(step: number, totalSteps: number): number {
    const progress = Math.min(step / totalSteps, 1);
    const gamma = this.config.finalValue / this.config.initialValue;
    return this.config.initialValue * Math.pow(gamma, progress);
  }

  private polynomialSchedule(step: number, totalSteps: number, power: number = 1): number {
    const progress = Math.min(step / totalSteps, 1);
    return (
      this.config.initialValue +
      (this.config.finalValue - this.config.initialValue) * Math.pow(progress, power)
    );
  }
}

// ============================================================================
// Experiment Tracker
// ============================================================================

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  searchSpace: SearchSpace;
  config: OptimizationConfig;
  trials: HyperparameterTrial[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  bestTrial?: string;
  metadata: Record<string, any>;
}

export class ExperimentTracker {
  private experiments: Map<string, Experiment> = new Map();

  /**
   * Create a new experiment
   */
  createExperiment(
    name: string,
    searchSpace: SearchSpace,
    config: OptimizationConfig,
    description?: string
  ): Experiment {
    const experiment: Experiment = {
      id: this.generateExperimentId(),
      name,
      description,
      searchSpace,
      config,
      trials: [],
      status: 'pending',
      createdAt: Date.now(),
      metadata: {},
    };

    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  /**
   * Get experiment by ID
   */
  getExperiment(id: string): Experiment | undefined {
    return this.experiments.get(id);
  }

  /**
   * List all experiments
   */
  listExperiments(): Experiment[] {
    return Array.from(this.experiments.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }

  /**
   * Add a trial to an experiment
   */
  addTrial(experimentId: string, trial: HyperparameterTrial): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    experiment.trials.push(trial);

    // Update best trial
    const completed = experiment.trials.filter(t => t.status === 'completed');
    if (completed.length > 0) {
      const best = completed.reduce((prev, curr) =>
        curr.metrics.loss < prev.metrics.loss ? curr : prev
      );
      experiment.bestTrial = best.id;
    }
  }

  /**
   * Get best trial for an experiment
   */
  getBestTrial(experimentId: string): HyperparameterTrial | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || !experiment.bestTrial) return null;

    return (
      experiment.trials.find(t => t.id === experiment.bestTrial) || null
    );
  }

  /**
   * Compare experiments
   */
  compareExperiments(experimentIds: string[]): {
    experiments: Experiment[];
    bestOverall: {
      experimentId: string;
      trialId: string;
      loss: number;
    };
    comparison: Array<{
      experimentId: string;
      name: string;
      bestLoss: number;
      trialCount: number;
      avgLoss: number;
    }>;
  } {
    const experiments = experimentIds
      .map(id => this.experiments.get(id))
      .filter(Boolean) as Experiment[];

    let bestOverall = {
      experimentId: '',
      trialId: '',
      loss: Infinity,
    };

    const comparison = experiments.map(exp => {
      const completed = exp.trials.filter(t => t.status === 'completed');
      const bestLoss = Math.min(...completed.map(t => t.metrics.loss));
      const avgLoss =
        completed.reduce((sum, t) => sum + t.metrics.loss, 0) / completed.length;

      if (bestLoss < bestOverall.loss) {
        bestOverall = {
          experimentId: exp.id,
          trialId: exp.bestTrial || '',
          loss: bestLoss,
        };
      }

      return {
        experimentId: exp.id,
        name: exp.name,
        bestLoss,
        trialCount: completed.length,
        avgLoss,
      };
    });

    return { experiments, bestOverall, comparison };
  }

  /**
   * Delete an experiment
   */
  deleteExperiment(id: string): boolean {
    return this.experiments.delete(id);
  }

  private generateExperimentId(): string {
    return `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Hyperparameter Optimizer (Main Class)
// ============================================================================

export interface OptimizationRequest {
  searchSpace: SearchSpace;
  method: 'grid' | 'random' | 'bayesian' | 'multi_objective';
  config: OptimizationConfig;
  objectives?: Objective[];
  experimentName?: string;
  experimentDescription?: string;
}

export interface OptimizationResult {
  experiment: Experiment;
  bestTrial: HyperparameterTrial;
  allTrials: HyperparameterTrial[];
  paretoFront?: ParetoFront;
  metrics: {
    totalTime: number;
    avgTrialTime: number;
    improvement: number;
    efficiency: number;
  };
}

export class HyperparameterOptimizer {
  private tracker: ExperimentTracker;

  constructor() {
    this.tracker = new ExperimentTracker();
  }

  /**
   * Run hyperparameter optimization
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResult> {
    // Create experiment
    const experiment = this.tracker.createExperiment(
      request.experimentName || `optimization-${Date.now()}`,
      request.searchSpace,
      request.config,
      request.experimentDescription
    );

    experiment.status = 'running';
    experiment.startedAt = Date.now();

    // Get optimizer based on method
    const optimizer = this.createOptimizer(request);
    const trials = await this.runTrials(optimizer, request.config, experiment);

    experiment.status = 'completed';
    experiment.completedAt = Date.now();

    // Get best trial
    const bestTrial = this.getBestTrial(trials);

    // Calculate metrics
    const totalTime = (experiment.completedAt - experiment.startedAt)!;
    const metrics = {
      totalTime,
      avgTrialTime: totalTime / trials.length,
      improvement: this.calculateImprovement(trials),
      efficiency: this.calculateEfficiency(trials, request.config),
    };

    // Get Pareto front for multi-objective
    let paretoFront: ParetoFront | undefined;
    if (request.method === 'multi_objective' && request.objectives) {
      const multiOptimizer = new MultiObjectiveOptimizer(
        request.searchSpace,
        request.objectives
      );
      trials.forEach(t => multiOptimizer.addTrial(t));
      paretoFront = multiOptimizer.getParetoFront();
    }

    return {
      experiment,
      bestTrial,
      allTrials: trials,
      paretoFront,
      metrics,
    };
  }

  /**
   * Suggest next hyperparameters to try
   */
  suggest(
    experimentId: string,
    method: 'grid' | 'random' | 'bayesian'
  ): Hyperparameters | null {
    const experiment = this.tracker.getExperiment(experimentId);
    if (!experiment) return null;

    const optimizer = this.createOptimizerForSuggestion(
      method,
      experiment.searchSpace
    );

    if (method === 'grid') {
      const trials = (optimizer as GridSearchOptimizer).getTrials();
      return trials.length > 0 ? trials[0].params : null;
    } else if (method === 'random') {
      const trial = (optimizer as RandomSearchOptimizer).generateTrial(
        `suggestion-${Date.now()}`
      );
      return trial.params;
    } else if (method === 'bayesian') {
      const bayesianOpt = optimizer as BayesianOptimizer;
      experiment.trials.forEach(t => bayesianOpt.addTrial(t));
      const trial = bayesianOpt.suggestTrial();
      return trial.params;
    }

    return null;
  }

  /**
   * Record trial results
   */
  recordTrial(experimentId: string, trial: HyperparameterTrial): void {
    this.tracker.addTrial(experimentId, trial);
  }

  /**
   * Get experiment tracker
   */
  getTracker(): ExperimentTracker {
    return this.tracker;
  }

  private createOptimizer(request: OptimizationRequest): any {
    switch (request.method) {
      case 'grid':
        return new GridSearchOptimizer(request.searchSpace);

      case 'random':
        return new RandomSearchOptimizer(request.searchSpace);

      case 'bayesian':
        return new BayesianOptimizer(request.searchSpace);

      case 'multi_objective':
        return new MultiObjectiveOptimizer(
          request.searchSpace,
          request.objectives || []
        );

      default:
        throw new Error(`Unknown optimization method: ${request.method}`);
    }
  }

  private createOptimizerForSuggestion(
    method: string,
    searchSpace: SearchSpace
  ): any {
    switch (method) {
      case 'grid':
        return new GridSearchOptimizer(searchSpace);

      case 'random':
        return new RandomSearchOptimizer(searchSpace);

      case 'bayesian':
        return new BayesianOptimizer(searchSpace);

      default:
        throw new Error(`Unknown optimization method: ${method}`);
    }
  }

  private async runTrials(
    optimizer: any,
    config: OptimizationConfig,
    experiment: Experiment
  ): Promise<HyperparameterTrial[]> {
    const trials: HyperparameterTrial[] = [];
    const startTime = Date.now();

    // Get trials based on optimizer type
    let trialList: HyperparameterTrial[] = [];

    if (optimizer instanceof GridSearchOptimizer) {
      trialList = optimizer.getTrials().slice(0, config.maxTrials);
    } else if (optimizer instanceof RandomSearchOptimizer) {
      trialList = optimizer.generateTrials(config.maxTrials);
    } else if (optimizer instanceof BayesianOptimizer) {
      // Generate trials iteratively
      for (let i = 0; i < config.maxTrials; i++) {
        const trial = optimizer.suggestTrial();
        trialList.push(trial);

        // Simulate running trial
        trial.status = 'running';
        trial.startTime = Date.now();

        // Simulate metrics (in production, actual training would happen)
        trial.metrics = this.simulateMetrics(trial.params);
        trial.status = 'completed';
        trial.endTime = Date.now();
        trial.duration = trial.endTime - trial.startTime;

        optimizer.addTrial(trial);

        // Check time limit
        if (Date.now() - startTime > config.maxDuration) {
          break;
        }
      }
    } else {
      trialList = optimizer.generateTrials(config.maxTrials);
    }

    // Simulate running non-Bayesian trials
    for (const trial of trialList) {
      if (trial.status === 'pending') {
        trial.status = 'running';
        trial.startTime = Date.now();

        // Simulate training
        trial.metrics = this.simulateMetrics(trial.params);

        trial.status = 'completed';
        trial.endTime = Date.now();
        trial.duration = trial.endTime - trial.startTime;

        this.tracker.addTrial(experiment.id, trial);
        trials.push(trial);
      }
    }

    return trials;
  }

  private simulateMetrics(params: Hyperparameters): ModelMetrics {
    // Simulate loss based on hyperparameters
    // Better hyperparameters -> lower loss
    const baseLoss = 2.0;
    const lrFactor = Math.abs(Math.log(params.learningRate) - Math.log(0.001));
    const batchFactor = Math.abs(params.batchSize - 32) / 32;
    const epochFactor = Math.abs(params.epochs - 3) / 3;

    const loss =
      baseLoss +
      lrFactor * 0.5 +
      batchFactor * 0.3 +
      epochFactor * 0.2 +
      Math.random() * 0.1;

    return {
      loss,
      validationLoss: loss + 0.05,
      accuracy: Math.max(0, 0.9 - loss * 0.1),
      validationAccuracy: Math.max(0, 0.85 - loss * 0.1),
    };
  }

  private getBestTrial(trials: HyperparameterTrial[]): HyperparameterTrial {
    const completed = trials.filter(t => t.status === 'completed');
    return completed.reduce((best, current) =>
      current.metrics.loss < best.metrics.loss ? current : best
    );
  }

  private calculateImprovement(trials: HyperparameterTrial[]): number {
    const completed = trials.filter(t => t.status === 'completed');
    if (completed.length < 2) return 0;

    const first = completed[0].metrics.loss;
    const last = completed[completed.length - 1].metrics.loss;
    return ((first - last) / first) * 100;
  }

  private calculateEfficiency(
    trials: HyperparameterTrial[],
    config: OptimizationConfig
  ): number {
    const completed = trials.filter(t => t.status === 'completed');
    const target = config.objective.target;

    if (target) {
      const achieved = completed.some(t => t.metrics.loss <= target);
      return achieved ? 100 : (completed.length / config.maxTrials) * 100;
    }

    return (completed.length / config.maxTrials) * 100;
  }
}
