/**
 * Training Orchestrator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TrainingOrchestrator,
  TrainingQueue,
  ResourceManager,
  TrainingMonitor,
  CheckpointManager,
  EarlyStoppingMonitor,
} from '../training/orchestrator';
import type { TrainingRequest, ResourceConfig } from '../training/orchestrator';

describe('TrainingQueue', () => {
  let queue: TrainingQueue;

  beforeEach(() => {
    queue = new TrainingQueue(2); // max 2 concurrent
  });

  it('should enqueue jobs', () => {
    const job = {
      id: 'job1',
      modelId: 'model1',
      datasetId: 'dataset1',
      status: 'queued' as const,
      progress: { currentStep: 0, totalSteps: 1000, currentEpoch: 0, totalEpochs: 3, percentage: 0 },
      config: {} as any,
      metrics: { loss: { values: [], current: 0, best: 0, average: 0 } },
      checkpoints: [],
      logs: [],
      createdAt: Date.now(),
      tags: [],
      metadata: {},
    };

    queue.enqueue(job, 5);
    const status = queue.getStatus();

    expect(status.queued).toBe(1);
    expect(status.running).toBe(0);
  });

  it('should dequeue jobs up to concurrent limit', () => {
    const job1 = {
      id: 'job1',
      modelId: 'model1',
      datasetId: 'dataset1',
      status: 'queued' as const,
      progress: { currentStep: 0, totalSteps: 1000, currentEpoch: 0, totalEpochs: 3, percentage: 0 },
      config: {} as any,
      metrics: { loss: { values: [], current: 0, best: 0, average: 0 } },
      checkpoints: [],
      logs: [],
      createdAt: Date.now(),
      tags: [],
      metadata: {},
    };

    const job2 = {
      ...job1,
      id: 'job2',
    };

    queue.enqueue(job1, 5);
    queue.enqueue(job2, 5);

    const dequeued1 = queue.dequeue();
    const dequeued2 = queue.dequeue();
    const dequeued3 = queue.dequeue();

    expect(dequeued1).toBeDefined();
    expect(dequeued2).toBeDefined();
    expect(dequeued3).toBeNull(); // Max concurrent reached
  });

  it('should respect priority ordering', () => {
    const job1 = {
      id: 'job1',
      modelId: 'model1',
      datasetId: 'dataset1',
      status: 'queued' as const,
      progress: { currentStep: 0, totalSteps: 1000, currentEpoch: 0, totalEpochs: 3, percentage: 0 },
      config: {} as any,
      metrics: { loss: { values: [], current: 0, best: 0, average: 0 } },
      checkpoints: [],
      logs: [],
      createdAt: Date.now(),
      tags: [],
      metadata: {},
    };

    const job2 = { ...job1, id: 'job2' };

    queue.enqueue(job1, 1); // Lower priority
    queue.enqueue(job2, 10); // Higher priority

    const dequeued = queue.dequeue();
    expect(dequeued?.id).toBe('job2');
  });

  it('should complete jobs and free slots', () => {
    const job = {
      id: 'job1',
      modelId: 'model1',
      datasetId: 'dataset1',
      status: 'queued' as const,
      progress: { currentStep: 0, totalSteps: 1000, currentEpoch: 0, totalEpochs: 3, percentage: 0 },
      config: {} as any,
      metrics: { loss: { values: [], current: 0, best: 0, average: 0 } },
      checkpoints: [],
      logs: [],
      createdAt: Date.now(),
      tags: [],
      metadata: {},
    };

    queue.enqueue(job, 5);
    queue.dequeue();
    queue.complete('job1');

    const status = queue.getStatus();
    expect(status.running).toBe(0);
  });
});

describe('ResourceManager', () => {
  let manager: ResourceManager;

  beforeEach(() => {
    manager = new ResourceManager();
  });

  it('should allocate resources', () => {
    const allocation = manager.allocate('job1', {
      gpuCount: 2,
      maxRuntime: 3600000,
      priority: 'normal',
      spotInstance: false,
    }, 3600000);

    expect(allocation).toBeDefined();
    expect(allocation?.resources.gpus).toBe(2);
    expect(allocation?.poolId).toBeDefined();
  });

  it('should release resources', () => {
    manager.allocate('job1', {
      gpuCount: 2,
      maxRuntime: 3600000,
      priority: 'normal',
      spotInstance: false,
    }, 3600000);

    manager.release('job1');

    const utilization = manager.getUtilization();
    expect(utilization.used.gpus).toBe(0);
  });

  it('should track utilization', () => {
    manager.allocate('job1', { gpuCount: 4, maxRuntime: 3600000, priority: 'normal', spotInstance: false }, 3600000);
    manager.allocate('job2', { gpuCount: 2, maxRuntime: 3600000, priority: 'normal', spotInstance: false }, 3600000);

    const utilization = manager.getUtilization();
    expect(utilization.used.gpus).toBe(6);
    expect(utilization.total.gpus).toBeGreaterThan(0);
  });

  it('should estimate cost', () => {
    const cost = manager.estimateCost(
      { gpuCount: 4, maxRuntime: 3600000, priority: 'normal', spotInstance: false },
      3600000 // 1 hour
    );

    expect(cost).toBeGreaterThan(0);
  });
});

describe('TrainingMonitor', () => {
  let monitor: TrainingMonitor;

  beforeEach(() => {
    monitor = new TrainingMonitor();
  });

  it('should record metrics', () => {
    const snapshot = {
      jobId: 'job1',
      timestamp: Date.now(),
      step: 100,
      epoch: 0,
      loss: 0.5,
      learningRate: 0.001,
      gpuUtilization: 85,
      memoryUsage: 0.7,
      throughput: 1000,
      eta: 100000,
    };

    monitor.recordMetrics(snapshot);

    const history = monitor.getMetricsHistory('job1');
    expect(history).toHaveLength(1);
    expect(history[0].loss).toBe(0.5);
  });

  it('should detect loss spikes', () => {
    const jobId = 'job1';

    monitor.recordMetrics({
      jobId,
      timestamp: Date.now(),
      step: 100,
      epoch: 0,
      loss: 0.5,
      learningRate: 0.001,
      gpuUtilization: 80,
      memoryUsage: 0.7,
      throughput: 1000,
      eta: 100000,
    });

    monitor.recordMetrics({
      jobId,
      timestamp: Date.now() + 1000,
      step: 101,
      epoch: 0,
      loss: 2.0, // Spike
      learningRate: 0.001,
      gpuUtilization: 80,
      memoryUsage: 0.7,
      throughput: 1000,
      eta: 100000,
    });

    const alerts = monitor.getAlerts(jobId);
    expect(alerts.some(a => a.type === 'loss_spike')).toBe(true);
  });

  it('should detect low GPU utilization', () => {
    const jobId = 'job1';

    monitor.recordMetrics({
      jobId,
      timestamp: Date.now(),
      step: 100,
      epoch: 0,
      loss: 0.5,
      learningRate: 0.001,
      gpuUtilization: 20, // Low
      memoryUsage: 0.7,
      throughput: 1000,
      eta: 100000,
    });

    const alerts = monitor.getAlerts(jobId);
    expect(alerts.some(a => a.type === 'low_gpu_utilization')).toBe(true);
  });
});

describe('CheckpointManager', () => {
  let manager: CheckpointManager;

  beforeEach(() => {
    manager = new CheckpointManager();
  });

  it('should create checkpoint', async () => {
    const checkpoint = await manager.createCheckpoint(
      'job1',
      100,
      1,
      0.5,
      { loss: 0.5, validationLoss: 0.55 },
      'checkpoints/job1/step-100.pt'
    );

    expect(checkpoint.id).toBeDefined();
    expect(checkpoint.step).toBe(100);
    expect(checkpoint.loss).toBe(0.5);
  });

  it('should track best checkpoint', async () => {
    await manager.createCheckpoint('job1', 100, 1, 0.5, { loss: 0.5 }, 'ckpt1');
    await manager.createCheckpoint('job1', 200, 2, 0.3, { loss: 0.3 }, 'ckpt2');
    await manager.createCheckpoint('job1', 300, 3, 0.4, { loss: 0.4 }, 'ckpt3');

    const best = manager.getBestCheckpoint('job1');
    expect(best?.step).toBe(200);
    expect(best?.isBest).toBe(true);
  });

  it('should get latest checkpoint', async () => {
    await manager.createCheckpoint('job1', 100, 1, 0.5, { loss: 0.5 }, 'ckpt1');
    await manager.createCheckpoint('job1', 200, 2, 0.3, { loss: 0.3 }, 'ckpt2');

    const latest = manager.getLatestCheckpoint('job1');
    expect(latest?.step).toBe(200);
  });
});

describe('EarlyStoppingMonitor', () => {
  let monitor: EarlyStoppingMonitor;

  beforeEach(() => {
    monitor = new EarlyStoppingMonitor();
  });

  it('should not stop with improvement', () => {
    const shouldStop = monitor.shouldStop('job1', 0.5, {
      enabled: true,
      patience: 5,
      minDelta: 0.01,
      mode: 'min',
      metric: 'loss',
      restoreBestWeights: true,
    });

    expect(shouldStop).toBe(false);
  });

  it('should stop after patience without improvement', () => {
    const config = {
      enabled: true,
      patience: 3,
      minDelta: 0.01,
      mode: 'min' as const,
      metric: 'loss',
      restoreBestWeights: true,
    };

    monitor.shouldStop('job1', 0.5, config);
    monitor.shouldStop('job1', 0.52, config);
    monitor.shouldStop('job1', 0.51, config);
    const shouldStop = monitor.shouldStop('job1', 0.53, config);

    expect(shouldStop).toBe(true);
  });

  it('should reset wait counter on improvement', () => {
    const config = {
      enabled: true,
      patience: 3,
      minDelta: 0.01,
      mode: 'min' as const,
      metric: 'loss',
      restoreBestWeights: true,
    };

    monitor.shouldStop('job1', 0.5, config);
    monitor.shouldStop('job1', 0.52, config);
    monitor.shouldStop('job1', 0.48, config); // Improvement
    const shouldStop = monitor.shouldStop('job1', 0.53, config);

    expect(shouldStop).toBe(false);
  });
});

describe('TrainingOrchestrator', () => {
  let orchestrator: TrainingOrchestrator;

  beforeEach(() => {
    orchestrator = new TrainingOrchestrator(2);
  });

  it('should submit training job', async () => {
    const request: TrainingRequest = {
      modelId: 'model1',
      datasetId: 'dataset1',
      hyperparameters: {
        learningRate: 0.001,
        batchSize: 32,
        epochs: 3,
      },
      checkpointConfig: {
        enabled: true,
        interval: 100,
        maxToKeep: 5,
        saveBest: true,
        metric: 'loss',
      },
      evaluationConfig: {
        enabled: true,
        interval: 500,
        metrics: ['loss', 'accuracy'],
        testSet: false,
      },
      resourceConfig: {
        gpuCount: 2,
        maxRuntime: 3600000,
        priority: 'normal',
        spotInstance: false,
      },
    };

    const job = await orchestrator.submitTraining(request);

    expect(job.id).toBeDefined();
    expect(job.modelId).toBe('model1');
    expect(job.datasetId).toBe('dataset1');
  });

  it('should get job by id', async () => {
    const request: TrainingRequest = {
      modelId: 'model1',
      datasetId: 'dataset1',
      hyperparameters: { learningRate: 0.001, batchSize: 32, epochs: 3 },
      checkpointConfig: { enabled: true, interval: 100, maxToKeep: 5, saveBest: true, metric: 'loss' },
      evaluationConfig: { enabled: true, interval: 500, metrics: ['loss'], testSet: false },
      resourceConfig: { gpuCount: 1, maxRuntime: 3600000, priority: 'normal', spotInstance: false },
    };

    const job = await orchestrator.submitTraining(request);
    const retrieved = orchestrator.getJob(job.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(job.id);
  });

  it('should cancel job', async () => {
    const request: TrainingRequest = {
      modelId: 'model1',
      datasetId: 'dataset1',
      hyperparameters: { learningRate: 0.001, batchSize: 32, epochs: 3 },
      checkpointConfig: { enabled: true, interval: 100, maxToKeep: 5, saveBest: true, metric: 'loss' },
      evaluationConfig: { enabled: true, interval: 500, metrics: ['loss'], testSet: false },
      resourceConfig: { gpuCount: 1, maxRuntime: 3600000, priority: 'low', spotInstance: false },
    };

    const job = await orchestrator.submitTraining(request);
    const cancelled = await orchestrator.cancelJob(job.id);

    expect(cancelled).toBe(true);
    expect(orchestrator.getJob(job.id)?.status).toBe('cancelled');
  });

  it('should get system status', async () => {
    const status = orchestrator.getSystemStatus();

    expect(status.queue).toBeDefined();
    expect(status.resources).toBeDefined();
    expect(status.jobs).toBeDefined();
  });

  it('should filter jobs by status', async () => {
    const request: TrainingRequest = {
      modelId: 'model1',
      datasetId: 'dataset1',
      hyperparameters: { learningRate: 0.001, batchSize: 32, epochs: 3 },
      checkpointConfig: { enabled: true, interval: 100, maxToKeep: 5, saveBest: true, metric: 'loss' },
      evaluationConfig: { enabled: true, interval: 500, metrics: ['loss'], testSet: false },
      resourceConfig: { gpuCount: 1, maxRuntime: 3600000, priority: 'low', spotInstance: false },
    };

    await orchestrator.submitTraining(request);

    const queuedJobs = orchestrator.getJobs({ status: 'queued' });
    expect(queuedJobs.length).toBeGreaterThan(0);
  });
});
