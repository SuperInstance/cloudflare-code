/**
 * A/B Testing Framework
 * Comprehensive framework for designing, running, and analyzing experiments
 */

import {
  Experiment,
  Variant,
  MetricConfig,
  ExperimentStatus,
  StatisticalTest,
  ExperimentResults,
  VariantMetrics,
  MetricResult,
  StatisticalTestResults,
  ConfidenceInterval,
} from '../types/index.js';
import { StatisticalAnalyzer } from './statistical-analyzer.js';
import { TrafficAllocator } from './traffic-allocator.js';
import { ExperimentStorage } from './experiment-storage.js';

export class ABTestingFramework {
  private analyzer: StatisticalAnalyzer;
  private allocator: TrafficAllocator;
  private storage: ExperimentStorage;

  constructor(storage: ExperimentStorage) {
    this.storage = storage;
    this.analyzer = new StatisticalAnalyzer();
    this.allocator = new TrafficAllocator();
  }

  /**
   * Create a new experiment
   */
  async createExperiment(experiment: Omit<Experiment, 'id' | 'status' | 'createdAt'>): Promise<Experiment> {
    const id = this.generateExperimentId(experiment.name);

    // Validate experiment configuration
    this.validateExperiment(experiment);

    // Calculate required sample size
    const sampleSize = await this.calculateSampleSize(experiment);

    const fullExperiment: Experiment = {
      ...experiment,
      id,
      status: 'draft',
      sampleSize,
      createdAt: Date.now(),
    };

    await this.storage.saveExperiment(fullExperiment);

    return fullExperiment;
  }

  /**
   * Start an experiment
   */
  async startExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== 'draft') {
      throw new Error(`Experiment must be in draft status to start`);
    }

    experiment.status = 'running';
    experiment.startDate = Date.now();

    await this.storage.saveExperiment(experiment);

    return experiment;
  }

  /**
   * Stop an experiment
   */
  async stopExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== 'running') {
      throw new Error(`Experiment must be running to stop`);
    }

    experiment.status = 'completed';
    experiment.endDate = Date.now();

    // Analyze results
    experiment.results = await this.analyzeExperiment(experimentId);

    await this.storage.saveExperiment(experiment);

    return experiment;
  }

  /**
   * Pause an experiment
   */
  async pauseExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== 'running') {
      throw new Error(`Experiment must be running to pause`);
    }

    experiment.status = 'paused';

    await this.storage.saveExperiment(experiment);

    return experiment;
  }

  /**
   * Resume a paused experiment
   */
  async resumeExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== 'paused') {
      throw new Error(`Experiment must be paused to resume`);
    }

    experiment.status = 'running';

    await this.storage.saveExperiment(experiment);

    return experiment;
  }

  /**
   * Assign a user to a variant
   */
  async assignVariant(
    experimentId: string,
    userId: string,
    attributes?: Record<string, any>
  ): Promise<Variant> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== 'running') {
      throw new Error(`Experiment must be running to assign variants`);
    }

    // Check if user is already assigned
    const existingAssignment = await this.storage.getAssignment(experimentId, userId);
    if (existingAssignment) {
      return experiment.variants.find(v => v.id === existingAssignment.variantId)!;
    }

    // Allocate to variant
    const variantId = await this.allocator.allocate(
      experimentId,
      userId,
      experiment.variants,
      experiment.allocationStrategy,
      experiment.trafficAllocation,
      attributes
    );

    // Save assignment
    await this.storage.saveAssignment({
      experimentId,
      userId,
      variantId,
      assignedAt: Date.now(),
      attributes,
    });

    return experiment.variants.find(v => v.id === variantId)!;
  }

  /**
   * Record a metric for an experiment assignment
   */
  async recordMetric(
    experimentId: string,
    userId: string,
    metricName: string,
    value: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const assignment = await this.storage.getAssignment(experimentId, userId);
    if (!assignment) {
      throw new Error(`No assignment found for user ${userId} in experiment ${experimentId}`);
    }

    await this.storage.saveMetric({
      experimentId,
      variantId: assignment.variantId,
      userId,
      metricName,
      value,
      timestamp: Date.now(),
      metadata,
    });
  }

  /**
   * Get experiment results
   */
  async getResults(experimentId: string): Promise<ExperimentResults> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (!experiment.results) {
      experiment.results = await this.analyzeExperiment(experimentId);
      await this.storage.saveExperiment(experiment);
    }

    return experiment.results;
  }

  /**
   * Analyze an experiment
   */
  async analyzeExperiment(experimentId: string): Promise<ExperimentResults> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    // Get metrics for each variant
    const variantMetrics: Record<string, VariantMetrics> = {};

    for (const variant of experiment.variants) {
      const metrics = await this.storage.getVariantMetrics(experimentId, variant.id);
      variantMetrics[variant.id] = await this.analyzeVariantMetrics(variant, metrics);
    }

    // Run statistical tests
    const statisticalTests = await this.runStatisticalTests(experiment, variantMetrics);

    // Determine winner
    const { winner, confidence, recommendation } = await this.determineWinner(
      experiment,
      variantMetrics,
      statisticalTests
    );

    return {
      variantMetrics,
      statisticalTests,
      winner,
      confidence,
      recommendation,
      analysisDate: Date.now(),
    };
  }

  /**
   * Get experiment progress
   */
  async getProgress(experimentId: string): Promise<{
    totalSampleSize: number;
    currentSampleSize: number;
    progress: number;
    estimatedCompletion?: number;
  }> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const currentSampleSize = await this.storage.getTotalSampleSize(experimentId);
    const progress = (currentSampleSize / experiment.sampleSize) * 100;

    let estimatedCompletion: number | undefined;
    if (experiment.startDate && progress < 100) {
      const elapsed = Date.now() - experiment.startDate;
      const rate = currentSampleSize / elapsed;
      const remaining = experiment.sampleSize - currentSampleSize;
      estimatedCompletion = Date.now() + (remaining / rate);
    }

    return {
      totalSampleSize: experiment.sampleSize,
      currentSampleSize,
      progress,
      estimatedCompletion,
    };
  }

  /**
   * List experiments
   */
  async listExperiments(filters?: {
    status?: ExperimentStatus;
    limit?: number;
    offset?: number;
  }): Promise<Experiment[]> {
    return this.storage.listExperiments(filters);
  }

  /**
   * Delete an experiment
   */
  async deleteExperiment(experimentId: string): Promise<void> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.status === 'running') {
      throw new Error(`Cannot delete running experiment`);
    }

    await this.storage.deleteExperiment(experimentId);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private generateExperimentId(name: string): string {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `exp-${normalized}-${random}`;
  }

  private validateExperiment(experiment: Omit<Experiment, 'id' | 'status' | 'createdAt'>): void {
    if (experiment.variants.length < 2) {
      throw new Error(`Experiment must have at least 2 variants`);
    }

    const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`Variant weights must sum to 100, got ${totalWeight}`);
    }

    if (experiment.metrics.length === 0) {
      throw new Error(`Experiment must have at least one metric`);
    }

    const primaryMetrics = experiment.metrics.filter(m => m.type === 'primary');
    if (primaryMetrics.length !== 1) {
      throw new Error(`Experiment must have exactly one primary metric`);
    }

    if (experiment.statisticalConfig.significanceLevel <= 0 ||
        experiment.statisticalConfig.significanceLevel >= 1) {
      throw new Error(`Significance level must be between 0 and 1`);
    }

    if (experiment.statisticalConfig.statisticalPower <= 0 ||
        experiment.statisticalConfig.statisticalPower >= 1) {
      throw new Error(`Statistical power must be between 0 and 1`);
    }
  }

  private async calculateSampleSize(
    experiment: Omit<Experiment, 'id' | 'status' | 'createdAt'>
  ): Promise<number> {
    const primaryMetric = experiment.metrics.find(m => m.type === 'primary')!;
    const control = experiment.variants.find(v => v.isControl) || experiment.variants[0];

    // Use default or configured minimum detectable effect
    const mde = primaryMetric.minDetectableEffect || 0.05; // 5% default
    const baseline = primaryMetric.baselineValue || 0.1; // 10% default baseline

    return this.analyzer.calculateSampleSize({
      baseline,
      minimumDetectableEffect: mde,
      alpha: experiment.statisticalConfig.significanceLevel,
      power: experiment.statisticalConfig.statisticalPower,
      testType: experiment.statisticalConfig.testType,
    });
  }

  private async analyzeVariantMetrics(
    variant: Variant,
    metrics: Array<{ metricName: string; value: number }>
  ): Promise<VariantMetrics> {
    const metricResults: Record<string, MetricResult> = {};

    // Group by metric name
    const grouped = new Map<string, number[]>();
    for (const m of metrics) {
      if (!grouped.has(m.metricName)) {
        grouped.set(m.metricName, []);
      }
      grouped.get(m.metricName)!.push(m.value);
    }

    // Calculate statistics for each metric
    for (const [metricName, values] of grouped.entries()) {
      const count = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / count;
      const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
      const std = Math.sqrt(variance);
      const stdError = std / Math.sqrt(count);

      // 95% confidence interval
      const margin = 1.96 * stdError;

      metricResults[metricName] = {
        value: mean,
        change: 0, // Will be calculated relative to control
        changePercentage: 0,
        confidenceInterval: {
          lower: mean - margin,
          upper: mean + margin,
          level: 0.95,
        },
        significant: false,
      };
    }

    return {
      variantId: variant.id,
      sampleSize: metrics.length,
      metrics: metricResults,
      standardError: 0,
    };
  }

  private async runStatisticalTests(
    experiment: Experiment,
    variantMetrics: Record<string, VariantMetrics>
  ): Promise<StatisticalTestResults[]> {
    const results: StatisticalTestResults[] = [];
    const control = experiment.variants.find(v => v.isControl) || experiment.variants[0];

    for (const metric of experiment.metrics) {
      for (const variant of experiment.variants) {
        if (variant.id === control.id) continue;

        const controlMetrics = variantMetrics[control.id].metrics[metric.name];
        const treatmentMetrics = variantMetrics[variant.id].metrics[metric.name];

        const testResult = await this.analyzer.runTest({
          testType: experiment.statisticalConfig.testType,
          controlValues: [controlMetrics.value],
          treatmentValues: [treatmentMetrics.value],
          alpha: experiment.statisticalConfig.significanceLevel,
        });

        results.push({
          metric: metric.name,
          testType: experiment.statisticalConfig.testType,
          statistic: testResult.statistic,
          pValue: testResult.pValue,
          significant: testResult.pValue < experiment.statisticalConfig.significanceLevel,
          effectSize: testResult.effectSize,
          power: testResult.power,
          confidenceInterval: testResult.confidenceInterval,
        });
      }
    }

    return results;
  }

  private async determineWinner(
    experiment: Experiment,
    variantMetrics: Record<string, VariantMetrics>,
    statisticalTests: StatisticalTestResults[]
  ): Promise<{
    winner: string | undefined;
    confidence: number;
    recommendation: string;
  }> {
    const primaryMetric = experiment.metrics.find(m => m.type === 'primary')!;
    const direction = primaryMetric.improvementDirection;

    // Find variant with best performance on primary metric
    let bestVariant: string | undefined;
    let bestValue = -Infinity;
    let confidence = 0;

    for (const [variantId, metrics] of Object.entries(variantMetrics)) {
      const value = metrics.metrics[primaryMetric.name].value;

      if (direction === 'increase' && value > bestValue) {
        bestValue = value;
        bestVariant = variantId;
      } else if (direction === 'decrease' && value < bestValue) {
        bestValue = value;
        bestVariant = variantId;
      }
    }

    // Check if results are significant
    const primaryTest = statisticalTests.find(t => t.metric === primaryMetric.name);
    if (primaryTest && primaryTest.significant) {
      confidence = (1 - primaryTest.pValue) * 100;
    }

    // Generate recommendation
    let recommendation = 'Continue the experiment';
    if (primaryTest && primaryTest.significant) {
      if (bestVariant) {
        const variant = experiment.variants.find(v => v.id === bestVariant);
        recommendation = `Implement variant "${variant?.name}" - shows statistically significant improvement`;
      }
    } else {
      recommendation = 'No significant difference detected - consider extending experiment or analyzing other metrics';
    }

    return { winner: bestVariant, confidence, recommendation };
  }
}

// ============================================================================
// Supporting Interfaces
// ============================================================================

export interface ExperimentAssignment {
  experimentId: string;
  userId: string;
  variantId: string;
  assignedAt: number;
  attributes?: Record<string, any>;
}

export interface ExperimentMetric {
  experimentId: string;
  variantId: string;
  userId: string;
  metricName: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}
