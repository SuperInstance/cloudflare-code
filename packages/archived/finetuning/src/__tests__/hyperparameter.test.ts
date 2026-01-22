/**
 * Hyperparameter Optimizer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HyperparameterOptimizer,
  GridSearchOptimizer,
  RandomSearchOptimizer,
  BayesianOptimizer,
  MultiObjectiveOptimizer,
  HyperparameterScheduler,
  ExperimentTracker,
} from '../hyperparameter/optimizer';
import type { SearchSpace, OptimizationConfig, ParamSpace } from '../hyperparameter/optimizer';

describe('GridSearchOptimizer', () => {
  it('should generate grid trials', () => {
    const space: SearchSpace = {
      params: [
        {
          name: 'learningRate',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
        {
          name: 'batchSize',
          type: 'discrete',
          bounds: [16, 64],
        },
      ],
    };

    const optimizer = new GridSearchOptimizer(space);
    const trials = optimizer.getTrials();

    expect(trials.length).toBeGreaterThan(0);
    expect(trials[0].params).toHaveProperty('learningRate');
    expect(trials[0].params).toHaveProperty('batchSize');
  });

  it('should calculate total trials', () => {
    const space: SearchSpace = {
      params: [
        {
          name: 'lr',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
      ],
    };

    const optimizer = new GridSearchOptimizer(space);
    expect(optimizer.getTotalTrials()).toBe(10); // Default 10 points for continuous
  });
});

describe('RandomSearchOptimizer', () => {
  it('should generate random trials', () => {
    const space: SearchSpace = {
      params: [
        {
          name: 'learningRate',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
        {
          name: 'epochs',
          type: 'discrete',
          bounds: [1, 10],
        },
        {
          name: 'optimizer',
          type: 'categorical',
          values: ['adam', 'sgd', 'adamw'],
        },
      ],
    };

    const optimizer = new RandomSearchOptimizer(space, 42);
    const trials = optimizer.generateTrials(5);

    expect(trials).toHaveLength(5);
    expect(trials[0].params.learningRate).toBeGreaterThanOrEqual(0.001);
    expect(trials[0].params.learningRate).toBeLessThanOrEqual(0.01);
    expect(trials[0].params.epochs).toBeGreaterThanOrEqual(1);
    expect(trials[0].params.epochs).toBeLessThanOrEqual(10);
    expect(['adam', 'sgd', 'adamw']).toContain(trials[0].params.optimizer);
  });

  it('should generate consistent results with same seed', () => {
    const space: SearchSpace = {
      params: [
        {
          name: 'lr',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
      ],
    };

    const optimizer1 = new RandomSearchOptimizer(space, 42);
    const optimizer2 = new RandomSearchOptimizer(space, 42);

    const trial1 = optimizer1.generateTrial('test-1');
    const trial2 = optimizer2.generateTrial('test-2');

    expect(trial1.params.lr).toBe(trial2.params.lr);
  });
});

describe('BayesianOptimizer', () => {
  let optimizer: BayesianOptimizer;
  let space: SearchSpace;

  beforeEach(() => {
    space = {
      params: [
        {
          name: 'learningRate',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
        {
          name: 'batchSize',
          type: 'discrete',
          bounds: [16, 64],
        },
      ],
    };

    optimizer = new BayesianOptimizer(space, {
      acquisitionFunction: 'EI',
      kappa: 2.576,
      xi: 0.01,
      nInitial: 3,
    });
  });

  it('should suggest initial random trials', () => {
    const trial1 = optimizer.suggestTrial();
    const trial2 = optimizer.suggestTrial();
    const trial3 = optimizer.suggestTrial();

    expect(trial1.params).toBeDefined();
    expect(trial2.params).toBeDefined();
    expect(trial3.params).toBeDefined();
  });

  it('should add completed trials', () => {
    const trial = optimizer.suggestTrial();
    trial.metrics = { loss: 0.5 };
    trial.status = 'completed';

    optimizer.addTrial(trial);

    const best = optimizer.getBestTrial();
    expect(best).toBeDefined();
    expect(best?.metrics.loss).toBe(0.5);
  });

  it('should get best trial', () => {
    const trial1 = optimizer.suggestTrial();
    trial1.metrics = { loss: 0.8 };
    trial1.status = 'completed';
    optimizer.addTrial(trial1);

    const trial2 = optimizer.suggestTrial();
    trial2.metrics = { loss: 0.3 };
    trial2.status = 'completed';
    optimizer.addTrial(trial2);

    const best = optimizer.getBestTrial();
    expect(best?.metrics.loss).toBe(0.3);
  });
});

describe('MultiObjectiveOptimizer', () => {
  let optimizer: MultiObjectiveOptimizer;
  let space: SearchSpace;

  beforeEach(() => {
    space = {
      params: [
        {
          name: 'learningRate',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
      ],
    };

    optimizer = new MultiObjectiveOptimizer(space, [
      { name: 'loss', metric: 'loss', direction: 'minimize' },
      { name: 'accuracy', metric: 'accuracy', direction: 'maximize' },
    ]);
  });

  it('should identify Pareto frontier', () => {
    // Add trials
    optimizer.addTrial({
      id: 't1',
      params: { learningRate: 0.001 },
      metrics: { loss: 0.5, accuracy: 0.85 },
      status: 'completed',
    });

    optimizer.addTrial({
      id: 't2',
      params: { learningRate: 0.005 },
      metrics: { loss: 0.3, accuracy: 0.80 },
      status: 'completed',
    });

    optimizer.addTrial({
      id: 't3',
      params: { learningRate: 0.01 },
      metrics: { loss: 0.6, accuracy: 0.90 },
      status: 'completed',
    });

    const pareto = optimizer.getParetoFront();

    expect(pareto.trials.length).toBeGreaterThan(0);
    expect(pareto.nondominated.size).toBeGreaterThan(0);
  });

  it('should calculate hypervolume', () => {
    optimizer.addTrial({
      id: 't1',
      params: { learningRate: 0.001 },
      metrics: { loss: 0.5, accuracy: 0.85 },
      status: 'completed',
    });

    const referencePoint = [1.0, 1.0];
    const hypervolume = optimizer.calculateHypervolume(referencePoint);

    expect(hypervolume).toBeGreaterThan(0);
  });
});

describe('HyperparameterScheduler', () => {
  it('should schedule constant values', () => {
    const scheduler = new HyperparameterScheduler({
      type: 'constant',
      initialValue: 0.001,
      finalValue: 0.001,
      totalSteps: 1000,
    });

    expect(scheduler.getValue(0)).toBe(0.001);
    expect(scheduler.getValue(500)).toBe(0.001);
    expect(scheduler.getValue(1000)).toBe(0.001);
  });

  it('should schedule linear decay', () => {
    const scheduler = new HyperparameterScheduler({
      type: 'linear',
      initialValue: 0.001,
      finalValue: 0.0001,
      totalSteps: 1000,
    });

    const start = scheduler.getValue(0);
    const mid = scheduler.getValue(500);
    const end = scheduler.getValue(1000);

    expect(start).toBeCloseTo(0.001, 4);
    expect(end).toBeCloseTo(0.0001, 4);
    expect(mid).toBeLessThan(start);
    expect(mid).toBeGreaterThan(end);
  });

  it('should schedule cosine decay', () => {
    const scheduler = new HyperparameterScheduler({
      type: 'cosine',
      initialValue: 0.001,
      finalValue: 0.0001,
      totalSteps: 1000,
    });

    const start = scheduler.getValue(0);
    const end = scheduler.getValue(1000);

    expect(start).toBeCloseTo(0.001, 4);
    expect(end).toBeCloseTo(0.0001, 4);
  });

  it('should schedule exponential decay', () => {
    const scheduler = new HyperparameterScheduler({
      type: 'exponential',
      initialValue: 0.001,
      finalValue: 0.0001,
      totalSteps: 1000,
    });

    const values = [0, 250, 500, 750, 1000].map(step => scheduler.getValue(step));

    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });

  it('should apply warmup', () => {
    const scheduler = new HyperparameterScheduler({
      type: 'linear',
      initialValue: 0.001,
      finalValue: 0.0001,
      totalSteps: 1000,
      warmupSteps: 100,
      warmupValue: 0.0001,
    });

    const warmupEnd = scheduler.getValue(100);
    const afterWarmup = scheduler.getValue(200);

    expect(warmupEnd).toBeGreaterThan(0.0001);
    expect(warmupEnd).toBeLessThanOrEqual(0.001);
    expect(afterWarmup).toBeLessThan(warmupEnd);
  });
});

describe('ExperimentTracker', () => {
  let tracker: ExperimentTracker;

  beforeEach(() => {
    tracker = new ExperimentTracker();
  });

  it('should create experiment', () => {
    const space: SearchSpace = {
      params: [
        {
          name: 'lr',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
      ],
    };

    const config: OptimizationConfig = {
      maxTrials: 10,
      parallelTrials: 2,
      maxDuration: 3600000,
      objective: {
        metric: 'loss',
        direction: 'minimize',
      },
    };

    const experiment = tracker.createExperiment(
      'Test Experiment',
      space,
      config,
      'Test description'
    );

    expect(experiment.id).toBeDefined();
    expect(experiment.name).toBe('Test Experiment');
    expect(experiment.status).toBe('pending');
  });

  it('should add trial to experiment', () => {
    const space: SearchSpace = {
      params: [
        {
          name: 'lr',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
      ],
    };

    const config: OptimizationConfig = {
      maxTrials: 10,
      parallelTrials: 2,
      maxDuration: 3600000,
      objective: {
        metric: 'loss',
        direction: 'minimize',
      },
    };

    const experiment = tracker.createExperiment('Test', space, config);

    tracker.addTrial(experiment.id, {
      id: 't1',
      params: { lr: 0.005 },
      metrics: { loss: 0.5 },
      status: 'completed',
    });

    const updated = tracker.getExperiment(experiment.id);
    expect(updated?.trials).toHaveLength(1);
  });

  it('should compare experiments', () => {
    const space: SearchSpace = {
      params: [
        {
          name: 'lr',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
      ],
    };

    const config: OptimizationConfig = {
      maxTrials: 10,
      parallelTrials: 2,
      maxDuration: 3600000,
      objective: {
        metric: 'loss',
        direction: 'minimize',
      },
    };

    const exp1 = tracker.createExperiment('Exp1', space, config);
    const exp2 = tracker.createExperiment('Exp2', space, config);

    tracker.addTrial(exp1.id, {
      id: 't1',
      params: { lr: 0.001 },
      metrics: { loss: 0.5 },
      status: 'completed',
    });

    tracker.addTrial(exp2.id, {
      id: 't2',
      params: { lr: 0.01 },
      metrics: { loss: 0.3 },
      status: 'completed',
    });

    const comparison = tracker.compareExperiments([exp1.id, exp2.id]);

    expect(comparison.bestOverall.experimentId).toBe(exp2.id);
    expect(comparison.comparison).toHaveLength(2);
  });
});

describe('HyperparameterOptimizer', () => {
  it('should run grid search optimization', async () => {
    const optimizer = new HyperparameterOptimizer();

    const space: SearchSpace = {
      params: [
        {
          name: 'lr',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
      ],
    };

    const config: OptimizationConfig = {
      maxTrials: 5,
      parallelTrials: 2,
      maxDuration: 60000,
      objective: {
        metric: 'loss',
        direction: 'minimize',
      },
    };

    const result = await optimizer.optimize({
      searchSpace: space,
      method: 'grid',
      config,
    });

    expect(result.allTrials.length).toBeGreaterThan(0);
    expect(result.bestTrial).toBeDefined();
    expect(result.metrics).toBeDefined();
  });

  it('should run random search optimization', async () => {
    const optimizer = new HyperparameterOptimizer();

    const space: SearchSpace = {
      params: [
        {
          name: 'lr',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
      ],
    };

    const config: OptimizationConfig = {
      maxTrials: 5,
      parallelTrials: 2,
      maxDuration: 60000,
      objective: {
        metric: 'loss',
        direction: 'minimize',
      },
    };

    const result = await optimizer.optimize({
      searchSpace: space,
      method: 'random',
      config,
    });

    expect(result.allTrials.length).toBe(5);
  });

  it('should run Bayesian optimization', async () => {
    const optimizer = new HyperparameterOptimizer();

    const space: SearchSpace = {
      params: [
        {
          name: 'lr',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
      ],
    };

    const config: OptimizationConfig = {
      maxTrials: 5,
      parallelTrials: 1,
      maxDuration: 60000,
      objective: {
        metric: 'loss',
        direction: 'minimize',
      },
    };

    const result = await optimizer.optimize({
      searchSpace: space,
      method: 'bayesian',
      config,
    });

    expect(result.allTrials.length).toBeGreaterThan(0);
  });

  it('should calculate improvement', async () => {
    const optimizer = new HyperparameterOptimizer();

    const space: SearchSpace = {
      params: [
        {
          name: 'lr',
          type: 'continuous',
          bounds: [0.001, 0.01],
        },
      ],
    };

    const config: OptimizationConfig = {
      maxTrials: 10,
      parallelTrials: 2,
      maxDuration: 60000,
      objective: {
        metric: 'loss',
        direction: 'minimize',
      },
    };

    const result = await optimizer.optimize({
      searchSpace: space,
      method: 'random',
      config,
    });

    expect(result.metrics.improvement).toBeDefined();
  });
});
