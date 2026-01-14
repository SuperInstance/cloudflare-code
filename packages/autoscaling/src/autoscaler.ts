/**
 * Main autoscaler orchestrator
 */

import { ScalingPolicyManager } from './policies/scaling-policy.js';
import { CpuScalingPolicy } from './policies/cpu-policy.js';
import { MemoryScalingPolicy } from './policies/memory-policy.js';
import { RequestScalingPolicy } from './policies/request-policy.js';
import { PredictiveScalingEngine } from './prediction/predictive-scaling.js';
import { TimeSeriesForecaster } from './prediction/forecasting.js';
import { ResourceAllocator } from './allocation/resource-allocator.js';
import { CostOptimizer } from './cost/cost-optimizer.js';
import { ScalingMetricsCollector } from './metrics/scaling-metrics.js';
import { ScalingAnalyticsEngine } from './analytics/scaling-analytics.js';
import type {
  ScalingPolicy,
  ScalingMetrics,
  ResourceAllocation,
  AutoscalingConfig,
  ResourceType,
  ScalingEvent,
  ScalingAnalytics,
  TimePeriod,
  CostAnalysis,
  PredictionResult
} from './types/index.js';
import { Logger } from '@claudeflare/logger';

export interface AutoscalerInitConfig {
  config?: Partial<AutoscalingConfig>;
}

export class Autoscaler {
  private logger: Logger;
  private policyManager: ScalingPolicyManager;
  private cpuPolicy: CpuScalingPolicy;
  private memoryPolicy: MemoryScalingPolicy;
  private requestPolicy: RequestScalingPolicy;
  private predictiveEngine: PredictiveScalingEngine;
  private forecaster: TimeSeriesForecaster;
  private resourceAllocator: ResourceAllocator;
  private costOptimizer: CostOptimizer;
  private metricsCollector: ScalingMetricsCollector;
  private analyticsEngine: ScalingAnalyticsEngine;
  private config: AutoscalingConfig;
  private running: boolean = false;
  private evaluationInterval?: NodeJS.Timeout;

  constructor(initConfig: AutoscalerInitConfig = {}) {
    this.logger = new Logger('Autoscaler');
    this.config = this.getDefaultConfig();

    if (initConfig.config) {
      this.config = { ...this.config, ...initConfig.config };
    }

    // Initialize components
    this.policyManager = new ScalingPolicyManager();
    this.cpuPolicy = new CpuScalingPolicy();
    this.memoryPolicy = new MemoryScalingPolicy();
    this.requestPolicy = new RequestScalingPolicy();
    this.predictiveEngine = new PredictiveScalingEngine(this.config.predictiveScaling);
    this.forecaster = new TimeSeriesForecaster();
    this.resourceAllocator = new ResourceAllocator();
    this.costOptimizer = new CostOptimizer();
    this.metricsCollector = new ScalingMetricsCollector(this.config.metrics);
    this.analyticsEngine = new ScalingAnalyticsEngine();

    this.logger.info('Autoscaler initialized');
  }

  /**
   * Start the autoscaler
   */
  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Autoscaler is already running');
      return;
    }

    this.running = true;
    this.logger.info('Autoscaler started');

    // Start periodic evaluation
    this.startPeriodicEvaluation();
  }

  /**
   * Stop the autoscaler
   */
  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn('Autoscaler is not running');
      return;
    }

    this.running = false;

    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = undefined;
    }

    this.logger.info('Autoscaler stopped');
  }

  /**
   * Add a scaling policy for a resource
   */
  addScalingPolicy(resourceId: string, resourceType: ResourceType): ScalingPolicy {
    let policy: ScalingPolicy;

    switch (resourceType) {
      case 'worker':
      case 'durable_object':
        // Use CPU-based policy for compute resources
        policy = this.cpuPolicy.createPolicy(resourceId);
        break;

      case 'kv':
      case 'r2':
        // Use memory-based policy for storage resources
        policy = this.memoryPolicy.createPolicy(resourceId);
        break;

      default:
        // Use request-based policy for others
        policy = this.requestPolicy.createPolicy(resourceId);
    }

    this.policyManager.addPolicy(policy);
    return policy;
  }

  /**
   * Evaluate scaling for a resource
   */
  async evaluateScaling(resourceId: string): Promise<void> {
    if (!this.running) {
      this.logger.warn('Autoscaler is not running, skipping evaluation');
      return;
    }

    try {
      // Collect current metrics
      const metrics = await this.metricsCollector.collectMetrics(resourceId);

      // Get current resource state
      const currentState = await this.getCurrentResourceState(resourceId);

      // Evaluate all policies
      const evaluationResults = await this.policyManager.evaluateAllPolicies(
        metrics,
        currentState
      );

      // Find actions to take
      for (const [policyId, result] of evaluationResults) {
        if (result.shouldScale && result.action) {
          this.logger.info(
            `Scaling action triggered for ${resourceId}: ${result.action} (${result.reason})`
          );

          // Execute scaling action
          await this.executeScalingAction(resourceId, policyId, result.action!);
        }
      }

      // Store metrics for history
      this.policyManager.storeMetrics(resourceId, metrics);

    } catch (error) {
      this.logger.error(`Error evaluating scaling for ${resourceId}:`, error);
    }
  }

  /**
   * Execute a scaling action
   */
  private async executeScalingAction(
    resourceId: string,
    policyId: string,
    action: any
  ): Promise<void> {
    const currentState = await this.getCurrentResourceState(resourceId);

    const result = await this.policyManager.executePolicy(
      policyId,
      {
        id: `action-${Date.now()}`,
        type: action,
        target: resourceId,
        parameters: {},
        order: 1
      },
      currentState
    );

    if (result.success) {
      // Record the event for analytics
      this.analyticsEngine.recordEvent(result.event);

      this.logger.info(
        `Scaling action executed successfully for ${resourceId} in ${result.event.duration}ms`
      );
    } else {
      this.logger.error(`Scaling action failed for ${resourceId}: ${result.error}`);

      // Record failed event for analytics
      this.analyticsEngine.recordEvent(result.event);
    }
  }

  /**
   * Get predictive scaling forecast
   */
  async getForecast(resourceId: string, metric: string, horizon?: number): Promise<PredictionResult> {
    return await this.predictiveEngine.predict(resourceId, metric, horizon);
  }

  /**
   * Get scaling analytics
   */
  getAnalytics(resourceId: string, period: TimePeriod): ScalingAnalytics {
    return this.analyticsEngine.getAnalytics(resourceId, period);
  }

  /**
   * Get cost analysis
   */
  async getCostAnalysis(resourceId: string): Promise<CostAnalysis | null> {
    const allocation = this.resourceAllocator.getAllocation(resourceId);
    if (!allocation) {
      return null;
    }

    return this.costOptimizer.analyzeCosts(resourceId, allocation);
  }

  /**
   * Get scaling recommendations
   */
  getRecommendations(resourceId: string) {
    return this.analyticsEngine.getRecommendations(resourceId);
  }

  /**
   * Add time series data for prediction
   */
  addTimeSeriesData(resourceId: string, data: Array<{ timestamp: Date; value: number }>): void {
    this.predictiveEngine.addTimeSeriesData(resourceId, data);
  }

  /**
   * Create budget
   */
  createBudget(
    id: string,
    name: string,
    limit: number,
    alertThresholds: number[]
  ) {
    return this.costOptimizer.createBudget(id, name, limit, 'monthly' as const, alertThresholds);
  }

  /**
   * Start periodic evaluation
   */
  private startPeriodicEvaluation(): void {
    this.evaluationInterval = setInterval(async () => {
      const enabledPolicies = this.policyManager.getEnabledPolicies();
      const resourceIds = new Set(enabledPolicies.map((p) => p.resourceId));

      for (const resourceId of resourceIds) {
        await this.evaluateScaling(resourceId);
      }
    }, this.config.evaluationInterval);
  }

  /**
   * Get current resource state
   */
  private async getCurrentResourceState(resourceId: string): Promise<any> {
    const allocation = this.resourceAllocator.getAllocation(resourceId);

    return {
      capacity: allocation?.allocation.cpu.cores || 1,
      cpu: allocation?.allocation.cpu.cores || 1,
      memory: allocation?.allocation.memory.size || 512,
      instances: 1,
      cost: 10
    };
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AutoscalingConfig {
    return {
      enabled: true,
      pollingInterval: 60000,
      evaluationInterval: 60000,
      cooldownPeriod: 300000,
      maxScaleUpPercent: 200,
      maxScaleDownPercent: 50,
      targetUtilization: 70,
      scaleUpThreshold: 80,
      scaleDownThreshold: 30,
      predictiveScaling: {
        enabled: true,
        modelType: 'linear_regression' as const,
        predictionHorizon: 60,
        confidenceThreshold: 0.7,
        retrainInterval: 3600000,
        features: ['cpu', 'memory', 'requests', 'latency']
      },
      costOptimization: {
        enabled: true,
        budgetLimit: 1000,
        budgetPeriod: 'monthly' as const,
        rightSizingEnabled: true,
        spotInstanceEnabled: false,
        reservedCapacityEnabled: true,
        optimizationInterval: 3600000
      },
      metrics: {
        retentionDays: 30,
        aggregationLevel: 'average' as const,
        collectionInterval: 60000,
        enabledMetrics: ['cpu', 'memory', 'requests', 'latency', 'cost']
      },
      alerts: {
        enabled: true,
        channels: [],
        severityThresholds: {
          warning: 70,
          critical: 90
        }
      }
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AutoscalingConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Autoscaler configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoscalingConfig {
    return { ...this.config };
  }

  /**
   * Get component instances for advanced usage
   */
  getComponents() {
    return {
      policyManager: this.policyManager,
      cpuPolicy: this.cpuPolicy,
      memoryPolicy: this.memoryPolicy,
      requestPolicy: this.requestPolicy,
      predictiveEngine: this.predictiveEngine,
      forecaster: this.forecaster,
      resourceAllocator: this.resourceAllocator,
      costOptimizer: this.costOptimizer,
      metricsCollector: this.metricsCollector,
      analyticsEngine: this.analyticsEngine
    };
  }

  /**
   * Get scaling status
   */
  getStatus(): {
    running: boolean;
    policiesCount: number;
    enabledPoliciesCount: number;
    config: AutoscalingConfig;
  } {
    return {
      running: this.running,
      policiesCount: this.policyManager.getAllPolicies().length,
      enabledPoliciesCount: this.policyManager.getEnabledPolicies().length,
      config: this.config
    };
  }
}
