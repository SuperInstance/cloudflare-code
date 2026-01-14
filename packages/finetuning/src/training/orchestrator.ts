/**
 * Training Orchestrator
 *
 * Manages the complete training lifecycle including:
 * - Training job management and queuing
 * - Resource allocation and optimization
 * - Real-time training monitoring
 * - Automatic checkpointing and recovery
 * - Resume training from checkpoints
 * - Early stopping based on metrics
 * - Training metrics collection and analysis
 * - Multi-GPU and distributed training coordination
 */

import type {
  TrainingJob,
  TrainingStatus,
  TrainingProgress,
  TrainingJobConfig,
  TrainingMetrics,
  Checkpoint,
  TrainingLog,
  TrainingError,
  ModelMetrics,
  Hyperparameters,
  ResourceConfig,
} from '../types';

// ============================================================================
// Training Queue
// ============================================================================

export interface QueuedJob {
  job: TrainingJob;
  priority: number;
  queuedAt: number;
  estimatedStart?: number;
}

export class TrainingQueue {
  private queue: QueuedJob[] = [];
  private running: Set<string> = new Set();
  private maxConcurrent: number = 4;

  constructor(maxConcurrent: number = 4) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a job to the queue
   */
  enqueue(job: TrainingJob, priority: number = 0): void {
    const queuedJob: QueuedJob = {
      job,
      priority,
      queuedAt: Date.now(),
    };

    // Insert in priority order
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priority > this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, queuedJob);
  }

  /**
   * Get next job to run
   */
  dequeue(): TrainingJob | null {
    if (this.queue.length === 0 || this.running.size >= this.maxConcurrent) {
      return null;
    }

    const queuedJob = this.queue.shift()!;
    this.running.add(queuedJob.job.id);
    return queuedJob.job;
  }

  /**
   * Mark a job as complete
   */
  complete(jobId: string): void {
    this.running.delete(jobId);
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queued: number;
    running: number;
    availableSlots: number;
  } {
    return {
      queued: this.queue.length,
      running: this.running.size,
      availableSlots: this.maxConcurrent - this.running.size,
    };
  }

  /**
   * Cancel a queued job
   */
  cancel(jobId: string): boolean {
    const index = this.queue.findIndex(qj => qj.job.id === jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get estimated wait time
   */
  getEstimatedWaitTime(jobId: string): number | null {
    const index = this.queue.findIndex(qj => qj.job.id === jobId);
    if (index === -1) return null;

    // Estimate 30 minutes per job ahead in queue
    return index * 30 * 60 * 1000;
  }
}

// ============================================================================
// Resource Manager
// ============================================================================

export interface ResourcePool {
  id: string;
  type: 'gpu' | 'tpu' | 'cpu';
  provider: 'aws' | 'gcp' | 'azure' | 'lambda' | 'custom';
  available: number;
  total: number;
  specs: ResourceSpecs;
  costPerHour: number;
}

export interface ResourceSpecs {
  memory: number; // GB
  compute: string; // e.g., 'A100', 'V100', 'T4'
  interconnect?: string; // e.g., 'NVLink', 'InfiniBand'
  bandwidth?: number; // GB/s
}

export interface ResourceAllocation {
  jobId: string;
  resources: {
    gpus: number;
    memory: number;
    storage: number;
  };
  poolId: string;
  allocatedAt: number;
  estimatedDuration: number;
}

export class ResourceManager {
  private pools: Map<string, ResourcePool> = new Map();
  private allocations: Map<string, ResourceAllocation> = new Map();

  constructor() {
    this.initializeDefaultPools();
  }

  private initializeDefaultPools(): void {
    // AWS pools
    this.addPool({
      id: 'aws-us-east-1-a100',
      type: 'gpu',
      provider: 'aws',
      available: 8,
      total: 8,
      specs: {
        memory: 80,
        compute: 'A100',
        interconnect: 'NVLink',
        bandwidth: 600,
      },
      costPerHour: 3.06,
    });

    this.addPool({
      id: 'aws-us-east-1-v100',
      type: 'gpu',
      provider: 'aws',
      available: 16,
      total: 16,
      specs: {
        memory: 32,
        compute: 'V100',
        interconnect: 'NVLink',
        bandwidth: 300,
      },
      costPerHour: 2.14,
    });

    // GCP pools
    this.addPool({
      id: 'gcp-us-central1-a100',
      type: 'gpu',
      provider: 'gcp',
      available: 4,
      total: 4,
      specs: {
        memory: 80,
        compute: 'A100',
        interconnect: 'NVLink',
        bandwidth: 600,
      },
      costPerHour: 2.93,
    });

    // Lambda Labs
    this.addPool({
      id: 'lambda-a100-80gb',
      type: 'gpu',
      provider: 'lambda',
      available: 4,
      total: 4,
      specs: {
        memory: 80,
        compute: 'A100',
        interconnect: 'NVLink',
        bandwidth: 600,
      },
      costPerHour: 1.99,
    });
  }

  /**
   * Add a resource pool
   */
  addPool(pool: ResourcePool): void {
    this.pools.set(pool.id, pool);
  }

  /**
   * Allocate resources for a job
   */
  allocate(
    jobId: string,
    requirements: ResourceConfig,
    estimatedDuration: number
  ): ResourceAllocation | null {
    const requiredGPUs = requirements.gpuCount;
    const requiredMemory = this.estimateMemoryRequirements(requirements);

    // Find best pool
    const poolId = this.findBestPool(requiredGPUs, requiredMemory);
    if (!poolId) {
      return null;
    }

    const pool = this.pools.get(poolId)!;

    // Check if resources are available
    if (pool.available < requiredGPUs) {
      return null;
    }

    // Allocate
    pool.available -= requiredGPUs;

    const allocation: ResourceAllocation = {
      jobId,
      resources: {
        gpus: requiredGPUs,
        memory: requiredMemory,
        storage: 1000, // 1TB default
      },
      poolId,
      allocatedAt: Date.now(),
      estimatedDuration,
    };

    this.allocations.set(jobId, allocation);
    return allocation;
  }

  /**
   * Release allocated resources
   */
  release(jobId: string): void {
    const allocation = this.allocations.get(jobId);
    if (!allocation) return;

    const pool = this.pools.get(allocation.poolId);
    if (pool) {
      pool.available += allocation.resources.gpus;
    }

    this.allocations.delete(jobId);
  }

  /**
   * Get resource utilization
   */
  getUtilization(): {
    total: { gpus: number; memory: number };
    used: { gpus: number; memory: number };
    available: { gpus: number; memory: number };
    pools: Array<{
      id: string;
      utilization: number;
      available: number;
      total: number;
    }>;
  } {
    let totalGPUs = 0;
    let availableGPUs = 0;
    const poolStats: Array<{
      id: string;
      utilization: number;
      available: number;
      total: number;
    }> = [];

    for (const pool of this.pools.values()) {
      totalGPUs += pool.total;
      availableGPUs += pool.available;

      poolStats.push({
        id: pool.id,
        utilization: (pool.total - pool.available) / pool.total,
        available: pool.available,
        total: pool.total,
      });
    }

    return {
      total: {
        gpus: totalGPUs,
        memory: totalGPUs * 80, // Estimate
      },
      used: {
        gpus: totalGPUs - availableGPUs,
        memory: (totalGPUs - availableGPUs) * 80,
      },
      available: {
        gpus: availableGPUs,
        memory: availableGPUs * 80,
      },
      pools: poolStats,
    };
  }

  /**
   * Estimate cost for a job
   */
  estimateCost(requirements: ResourceConfig, duration: number): number {
    const hours = duration / (1000 * 60 * 60);
    const poolId = this.findBestPool(requirements.gpuCount, 80);
    if (!poolId) return 0;

    const pool = this.pools.get(poolId)!;
    return pool.costPerHour * requirements.gpuCount * hours;
  }

  private findBestPool(requiredGPUs: number, requiredMemory: number): string | null {
    let bestPool: string | null = null;
    let bestCost = Infinity;

    for (const [id, pool] of this.pools) {
      if (pool.available >= requiredGPUs && pool.specs.memory >= requiredMemory) {
        if (pool.costPerHour < bestCost) {
          bestCost = pool.costPerHour;
          bestPool = id;
        }
      }
    }

    return bestPool;
  }

  private estimateMemoryRequirements(requirements: ResourceConfig): number {
    // Estimate memory based on GPU type and model size
    // This is a simplified calculation
    const baseMemory = 40; // Base memory for models
    const perGPUMemory = requirements.gpuCount > 4 ? 80 : 40;
    return perGPUMemory;
  }
}

// ============================================================================
// Training Monitor
// ============================================================================

export interface TrainingMetricsSnapshot {
  jobId: string;
  timestamp: number;
  step: number;
  epoch: number;
  loss: number;
  learningRate: number;
  gpuUtilization: number;
  memoryUsage: number;
  throughput: number;
  eta: number;
}

export interface MonitoringAlert {
  id: string;
  jobId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export class TrainingMonitor {
  private metricsHistory: Map<string, TrainingMetricsSnapshot[]> = new Map();
  private alerts: Map<string, MonitoringAlert[]> = new Map();
  private thresholds = {
    lossSpike: 2.0, // Loss increased by 2x
    lowGPUUtil: 30, // GPU utilization below 30%
    highMemory: 0.95, // Memory usage above 95%
    stagnation: 100, // No improvement for 100 steps
  };

  /**
   * Record training metrics
   */
  recordMetrics(snapshot: TrainingMetricsSnapshot): void {
    const history = this.metricsHistory.get(snapshot.jobId) || [];
    history.push(snapshot);
    this.metricsHistory.set(snapshot.jobId, history);

    // Check for alerts
    this.checkAlerts(snapshot);
  }

  /**
   * Get metrics history for a job
   */
  getMetricsHistory(jobId: string): TrainingMetricsSnapshot[] {
    return this.metricsHistory.get(jobId) || [];
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics(jobId: string): TrainingMetricsSnapshot | null {
    const history = this.metricsHistory.get(jobId);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get alerts for a job
   */
  getAlerts(jobId: string): MonitoringAlert[] {
    return this.alerts.get(jobId) || [];
  }

  /**
   * Resolve an alert
   */
  resolveAlert(jobId: string, alertId: string): void {
    const alerts = this.alerts.get(jobId) || [];
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  /**
   * Check for conditions that should trigger alerts
   */
  private checkAlerts(snapshot: TrainingMetricsSnapshot): void {
    const alerts = this.alerts.get(snapshot.jobId) || [];
    const history = this.metricsHistory.get(snapshot.jobId) || [];

    // Check for loss spike
    if (history.length > 1) {
      const prevLoss = history[history.length - 2].loss;
      if (snapshot.loss > prevLoss * this.thresholds.lossSpike) {
        alerts.push({
          id: `alert-${Date.now()}`,
          jobId: snapshot.jobId,
          severity: 'warning',
          type: 'loss_spike',
          message: `Loss increased from ${prevLoss.toFixed(4)} to ${snapshot.loss.toFixed(4)}`,
          timestamp: Date.now(),
          resolved: false,
        });
      }
    }

    // Check for low GPU utilization
    if (snapshot.gpuUtilization < this.thresholds.lowGPUUtil) {
      alerts.push({
        id: `alert-${Date.now()}`,
        jobId: snapshot.jobId,
        severity: 'warning',
        type: 'low_gpu_utilization',
        message: `GPU utilization at ${snapshot.gpuUtilization.toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false,
      });
    }

    // Check for high memory usage
    if (snapshot.memoryUsage > this.thresholds.highMemory) {
      alerts.push({
        id: `alert-${Date.now()}`,
        jobId: snapshot.jobId,
        severity: 'error',
        type: 'high_memory_usage',
        message: `Memory usage at ${(snapshot.memoryUsage * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false,
      });
    }

    // Check for stagnation (no improvement)
    if (history.length > this.thresholds.stagnation) {
      const recentLosses = history.slice(-this.thresholds.stagnation).map(h => h.loss);
      const minLoss = Math.min(...recentLosses);
      if (recentLosses[recentLosses.length - 1] > minLoss * 1.01) {
        alerts.push({
          id: `alert-${Date.now()}`,
          jobId: snapshot.jobId,
          severity: 'info',
          type: 'stagnation',
          message: `No improvement in ${this.thresholds.stagnation} steps`,
          timestamp: Date.now(),
          resolved: false,
        });
      }
    }

    this.alerts.set(snapshot.jobId, alerts);
  }

  /**
   * Calculate ETA based on recent progress
   */
  calculateETA(jobId: string): number | null {
    const history = this.metricsHistory.get(jobId);
    if (!history || history.length < 2) return null;

    const recent = history.slice(-10);
    const avgTimePerStep =
      recent[recent.length - 1].timestamp - recent[0].timestamp / recent.length;

    // This would need total steps from the job config
    // For now, return a placeholder
    return avgTimePerStep * 1000; // Placeholder
  }
}

// ============================================================================
// Checkpoint Manager
// ============================================================================

export interface CheckpointConfig {
  enabled: boolean;
  interval: number; // steps
  maxToKeep: number;
  saveBest: boolean;
  metric: string;
  saveOptimizer: boolean;
  saveScheduler: boolean;
}

export class CheckpointManager {
  private checkpoints: Map<string, Checkpoint[]> = new Map();
  private bestMetrics: Map<string, number> = new Map();

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    jobId: string,
    step: number,
    epoch: number,
    loss: number,
    metrics: ModelMetrics,
    r2Key: string
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: `ckpt-${jobId}-${step}`,
      step,
      epoch,
      loss,
      metrics,
      path: `/checkpoints/${jobId}/${step}`,
      r2Key,
      size: 0, // Would be calculated from actual file
      createdAt: Date.now(),
      isBest: false,
    };

    // Check if this is the best checkpoint
    const bestMetric = this.bestMetrics.get(jobId);
    const metricValue = this.getMetricValue(metrics, 'loss');

    if (bestMetric === undefined || metricValue < bestMetric) {
      checkpoint.isBest = true;
      this.bestMetrics.set(jobId, metricValue);
    }

    // Add to history
    const checkpoints = this.checkpoints.get(jobId) || [];
    checkpoints.push(checkpoint);
    this.checkpoints.set(jobId, checkpoints);

    // Clean up old checkpoints
    await this.cleanupOldCheckpoints(jobId);

    return checkpoint;
  }

  /**
   * Get all checkpoints for a job
   */
  getCheckpoints(jobId: string): Checkpoint[] {
    return this.checkpoints.get(jobId) || [];
  }

  /**
   * Get best checkpoint for a job
   */
  getBestCheckpoint(jobId: string): Checkpoint | null {
    const checkpoints = this.checkpoints.get(jobId);
    if (!checkpoints || checkpoints.length === 0) return null;

    return checkpoints.find(cp => cp.isBest) || checkpoints[checkpoints.length - 1];
  }

  /**
   * Get latest checkpoint
   */
  getLatestCheckpoint(jobId: string): Checkpoint | null {
    const checkpoints = this.checkpoints.get(jobId);
    if (!checkpoints || checkpoints.length === 0) return null;

    return checkpoints[checkpoints.length - 1];
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(jobId: string, checkpointId: string): Promise<boolean> {
    const checkpoints = this.checkpoints.get(jobId);
    if (!checkpoints) return false;

    const index = checkpoints.findIndex(cp => cp.id === checkpointId);
    if (index === -1) return false;

    checkpoints.splice(index, 1);
    this.checkpoints.set(jobId, checkpoints);

    // In production, delete from R2
    return true;
  }

  /**
   * Clean up old checkpoints keeping only the best and most recent
   */
  private async cleanupOldCheckpoints(jobId: string): Promise<void> {
    const checkpoints = this.checkpoints.get(jobId);
    if (!checkpoints || checkpoints.length <= 5) return; // Keep at least 5

    // Sort by step, keep best and most recent
    const sorted = [...checkpoints].sort((a, b) => b.step - a.step);
    const toKeep = sorted.slice(0, 5);

    // Find best checkpoint
    const best = sorted.find(cp => cp.isBest);
    if (best && !toKeep.includes(best)) {
      toKeep.push(best);
    }

    this.checkpoints.set(jobId, toKeep);
  }

  private getMetricValue(metrics: ModelMetrics, metricName: string): number {
    switch (metricName) {
      case 'loss':
        return metrics.loss;
      case 'accuracy':
        return metrics.accuracy || 0;
      case 'validationLoss':
        return metrics.validationLoss || metrics.loss;
      default:
        return metrics.loss;
    }
  }
}

// ============================================================================
// Early Stopping
// ============================================================================

export interface EarlyStoppingConfig {
  enabled: boolean;
  patience: number; // steps to wait for improvement
  minDelta: number; // minimum change to qualify as improvement
  mode: 'min' | 'max'; // whether to minimize or maximize the metric
  metric: string;
  restoreBestWeights: boolean;
}

export class EarlyStoppingMonitor {
  private bestScores: Map<string, number> = new Map();
  private waitCounters: Map<string, number> = new Map();
  private bestStates: Map<string, any> = new Map();

  /**
   * Check if training should stop early
   */
  shouldStop(
    jobId: string,
    currentScore: number,
    config: EarlyStoppingConfig
  ): boolean {
    if (!config.enabled) return false;

    const bestScore = this.bestScores.get(jobId);
    const waitCounter = this.waitCounters.get(jobId) || 0;

    if (bestScore === undefined) {
      // First evaluation
      this.bestScores.set(jobId, currentScore);
      this.waitCounters.set(jobId, 0);
      return false;
    }

    // Check if we have improvement
    const hasImprovement = this.hasImprovement(
      currentScore,
      bestScore,
      config
    );

    if (hasImprovement) {
      // Reset wait counter
      this.waitCounters.set(jobId, 0);
      this.bestScores.set(jobId, currentScore);
      return false;
    } else {
      // Increment wait counter
      const newWaitCounter = waitCounter + 1;
      this.waitCounters.set(jobId, newWaitCounter);

      // Check if we should stop
      return newWaitCounter >= config.patience;
    }
  }

  /**
   * Get the number of steps until early stopping
   */
  getStepsUntilStop(jobId: string, patience: number): number {
    const waitCounter = this.waitCounters.get(jobId) || 0;
    return Math.max(0, patience - waitCounter);
  }

  /**
   * Reset the early stopping state for a job
   */
  reset(jobId: string): void {
    this.bestScores.delete(jobId);
    this.waitCounters.delete(jobId);
    this.bestStates.delete(jobId);
  }

  private hasImprovement(
    current: number,
    best: number,
    config: EarlyStoppingConfig
  ): boolean {
    const delta = Math.abs(current - best);

    if (config.mode === 'min') {
      return current < best - config.minDelta;
    } else {
      return current > best + config.minDelta;
    }
  }
}

// ============================================================================
// Training Orchestrator (Main Class)
// ============================================================================

export interface TrainingRequest {
  modelId: string;
  datasetId: string;
  hyperparameters: Hyperparameters;
  checkpointConfig: CheckpointConfig;
  evaluationConfig: any;
  resourceConfig: ResourceConfig;
  notificationConfig?: any;
  metadata?: Record<string, any>;
}

export interface TrainingResult {
  job: TrainingJob;
  status: TrainingStatus;
  metrics?: ModelMetrics;
  checkpoints?: Checkpoint[];
  error?: TrainingError;
}

export class TrainingOrchestrator {
  private queue: TrainingQueue;
  private resources: ResourceManager;
  private monitor: TrainingMonitor;
  private checkpoints: CheckpointManager;
  private earlyStopping: EarlyStoppingMonitor;
  private jobs: Map<string, TrainingJob> = new Map();

  constructor(maxConcurrentJobs: number = 4) {
    this.queue = new TrainingQueue(maxConcurrentJobs);
    this.resources = new ResourceManager();
    this.monitor = new TrainingMonitor();
    this.checkpoints = new CheckpointManager();
    this.earlyStopping = new EarlyStoppingMonitor();
  }

  /**
   * Submit a new training job
   */
  async submitTraining(request: TrainingRequest): Promise<TrainingJob> {
    // Create job
    const job: TrainingJob = {
      id: this.generateJobId(),
      modelId: request.modelId,
      datasetId: request.datasetId,
      status: 'queued',
      progress: {
        currentStep: 0,
        totalSteps: request.hyperparameters.epochs * 1000, // Estimate
        currentEpoch: 0,
        totalEpochs: request.hyperparameters.epochs,
        percentage: 0,
      },
      config: {
        hyperparameters: request.hyperparameters,
        checkpointConfig: request.checkpointConfig,
        evaluationConfig: request.evaluationConfig,
        resourceConfig: request.resourceConfig,
        notificationConfig: request.notificationConfig,
      },
      metrics: {
        loss: { values: [], current: 0, best: 0, average: 0 },
      },
      checkpoints: [],
      logs: [],
      createdAt: Date.now(),
      tags: [],
      metadata: request.metadata || {},
    };

    // Add to queue
    this.queue.enqueue(job, request.resourceConfig.priority === 'high' ? 10 : 0);

    // Store job
    this.jobs.set(job.id, job);

    // Try to start if resources available
    this.processQueue();

    return job;
  }

  /**
   * Get a training job by ID
   */
  getJob(jobId: string): TrainingJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all training jobs
   */
  getJobs(filter?: { status?: TrainingStatus }): TrainingJob[] {
    let jobs = Array.from(this.jobs.values());

    if (filter?.status) {
      jobs = jobs.filter(job => job.status === filter.status);
    }

    return jobs.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Cancel a training job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Cancel in queue if not started
    if (job.status === 'queued') {
      this.queue.cancel(jobId);
      job.status = 'cancelled';
      return true;
    }

    // Stop running job
    if (job.status === 'training' || job.status === 'preparing') {
      job.status = 'cancelled';
      job.completedAt = Date.now();

      // Release resources
      this.resources.release(jobId);
      this.queue.complete(jobId);

      return true;
    }

    return false;
  }

  /**
   * Pause a training job
   */
  async pauseJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'training') return false;

    job.status = 'paused';
    return true;
  }

  /**
   * Resume a paused training job
   */
  async resumeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'paused') return false;

    job.status = 'training';
    return true;
  }

  /**
   * Get training progress
   */
  getProgress(jobId: string): TrainingProgress | null {
    const job = this.jobs.get(jobId);
    return job?.progress || null;
  }

  /**
   * Get training metrics
   */
  getMetrics(jobId: string): TrainingMetrics | null {
    const job = this.jobs.get(jobId);
    return job?.metrics || null;
  }

  /**
   * Get training logs
   */
  getLogs(jobId: string, limit?: number): TrainingLog[] {
    const job = this.jobs.get(jobId);
    if (!job) return [];

    const logs = job.logs;
    return limit ? logs.slice(-limit) : logs;
  }

  /**
   * Get checkpoints for a job
   */
  getJobCheckpoints(jobId: string): Checkpoint[] {
    return this.checkpoints.getCheckpoints(jobId);
  }

  /**
   * Get system status
   */
  getSystemStatus(): {
    queue: ReturnType<TrainingQueue['getStatus']>;
    resources: ReturnType<ResourceManager['getUtilization']>;
    jobs: {
      total: number;
      queued: number;
      running: number;
      completed: number;
      failed: number;
    };
  } {
    const jobs = Array.from(this.jobs.values());

    return {
      queue: this.queue.getStatus(),
      resources: this.resources.getUtilization(),
      jobs: {
        total: jobs.length,
        queued: jobs.filter(j => j.status === 'queued').length,
        running: jobs.filter(j => j.status === 'training').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
      },
    };
  }

  /**
   * Process the training queue
   */
  private processQueue(): void {
    const job = this.queue.dequeue();
    if (!job) return;

    // Allocate resources
    const allocation = this.resources.allocate(
      job.id,
      job.config.resourceConfig,
      job.config.resourceConfig.maxRuntime
    );

    if (!allocation) {
      // No resources available, put back in queue
      this.queue.enqueue(job, 0);
      return;
    }

    // Start training
    this.startTraining(job, allocation);
  }

  /**
   * Start training a job
   */
  private async startTraining(
    job: TrainingJob,
    allocation: ResourceAllocation
  ): Promise<void> {
    job.status = 'preparing';
    job.startedAt = Date.now();
    job.logs.push({
      timestamp: Date.now(),
      level: 'info',
      message: `Job started with ${allocation.resources.gpus} GPUs from ${allocation.poolId}`,
    });

    try {
      // In production, this would trigger actual training on GPU
      job.status = 'training';

      // Simulate training progress
      await this.simulateTraining(job);

      job.status = 'completed';
      job.completedAt = Date.now();
    } catch (error) {
      job.status = 'failed';
      job.completedAt = Date.now();
      job.error = {
        code: 'TRAINING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        retryable: true,
      };
    } finally {
      // Release resources
      this.resources.release(job.id);
      this.queue.complete(job.id);

      // Process next job
      this.processQueue();
    }
  }

  /**
   * Simulate training (for demonstration)
   */
  private async simulateTraining(job: TrainingJob): Promise<void> {
    const totalSteps = job.progress.totalSteps;
    const checkpointInterval = job.config.checkpointConfig.interval || 100;

    for (let step = 0; step <= totalSteps; step++) {
      // Update progress
      job.progress.currentStep = step;
      job.progress.currentEpoch = Math.floor(step / 1000);
      job.progress.percentage = (step / totalSteps) * 100;

      // Simulate loss
      const loss = 2.0 * Math.exp(-step / 1000) + 0.1 + Math.random() * 0.05;
      job.metrics.loss.values.push({
        step,
        value: loss,
        timestamp: Date.now(),
      });
      job.metrics.loss.current = loss;
      job.metrics.loss.best = Math.min(...job.metrics.loss.values.map(v => v.value));
      job.metrics.loss.average =
        job.metrics.loss.values.reduce((sum, v) => sum + v.value, 0) /
        job.metrics.loss.values.length;

      // Record metrics
      this.monitor.recordMetrics({
        jobId: job.id,
        timestamp: Date.now(),
        step,
        epoch: job.progress.currentEpoch,
        loss,
        learningRate: job.config.hyperparameters.learningRate,
        gpuUtilization: 85 + Math.random() * 10,
        memoryUsage: 0.7 + Math.random() * 0.2,
        throughput: 1000 + Math.random() * 200,
        eta: (totalSteps - step) * 100,
      });

      // Create checkpoint
      if (step % checkpointInterval === 0 && step > 0) {
        const checkpoint = await this.checkpoints.createCheckpoint(
          job.id,
          step,
          job.progress.currentEpoch,
          loss,
          { loss, validationLoss: loss + 0.05 },
          `checkpoints/${job.id}/step-${step}.pt`
        );
        job.checkpoints.push(checkpoint);

        job.logs.push({
          timestamp: Date.now(),
          level: 'info',
          message: `Checkpoint created at step ${step}`,
          step,
          epoch: job.progress.currentEpoch,
        });
      }

      // Check early stopping
      if (this.earlyStopping.shouldStop(job.id, loss, {
        enabled: true,
        patience: 100,
        minDelta: 0.001,
        mode: 'min',
        metric: 'loss',
        restoreBestWeights: true,
      })) {
        job.logs.push({
          timestamp: Date.now(),
          level: 'info',
          message: 'Early stopping triggered',
          step,
        });
        break;
      }

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
