// @ts-nocheck - External dependencies and type compatibility issues
/**
 * Cost optimization and budget management
 */

import type {
  CostAnalysis,
  CostBreakdown,
  CostOptimization,
  CostOptimizationType,
  OptimizationEffort,
  OptimizationRisk,
  CostPeriod,
  Budget,
  BudgetForecast,
  ResourceType,
  ResourceAllocation
} from '../types/index.js';
// import { Logger } from '@claudeflare/logger';

// Mock Logger for type compatibility
class Logger {
  info(...args: any[]) {}
  warn(...args: any[]) {}
  error(...args: any[]) {}
  debug(...args: any[]) {}
}

export interface CostConfig {
  computeCostPerCore: number;
  computeCostPerCredit: number;
  memoryCostPerGB: number;
  storageCostPerGB: number;
  networkCostPerGB: number;
  requestCostPerMillion: number;
  currency: string;
}

export class CostOptimizer {
  private logger: Logger;
  private config: CostConfig;
  private budgets: Map<string, Budget> = new Map();
  private costHistory: Map<string, CostBreakdown[]> = new Map();

  constructor(config: Partial<CostConfig> = {}) {
    this.logger = new Logger('CostOptimizer');
    this.config = {
      computeCostPerCore: 0.05, // $0.05 per core per hour
      computeCostPerCredit: 0.0001, // $0.0001 per CPU credit
      memoryCostPerGB: 0.005, // $0.005 per GB per hour
      storageCostPerGB: 0.0001, // $0.0001 per GB per hour
      networkCostPerGB: 0.09, // $0.09 per GB
      requestCostPerMillion: 0.5, // $0.50 per million requests
      currency: 'USD',
      ...config
    };
  }

  /**
   * Analyze costs for a resource
   */
  analyzeCosts(resourceId: string, allocation: ResourceAllocation): CostAnalysis {
    const currentCost = this.calculateCost(allocation);

    // Project costs for next period
    const projectedCost = this.projectCost(currentCost);

    // Generate optimization recommendations
    const optimizations = this.generateOptimizations(allocation, currentCost);

    // Calculate potential savings
    const savings = optimizations.reduce((sum, opt) => sum + opt.savings, 0);

    return {
      resourceId,
      resourceType: allocation.resourceType,
      currentCost,
      projectedCost,
      optimization: optimizations,
      savings,
      timestamp: new Date()
    };
  }

  /**
   * Calculate current cost breakdown
   */
  private calculateCost(allocation: ResourceAllocation): CostBreakdown {
    const spec = allocation.allocation;

    // Compute costs
    const computeCost =
      spec.cpu.cores * this.config.computeCostPerCore +
      spec.cpu.credits * this.config.computeCostPerCredit;

    // Memory costs
    const memoryCost = (spec.memory.size / 1024) * this.config.memoryCostPerGB;

    // Storage costs
    const storageCost = (spec.storage.size / 1024) * this.config.storageCostPerGB;

    // Network costs (estimate based on allocation)
    const networkCost = (spec.network.bandwidth / 1024) * this.config.networkCostPerGB;

    // Request costs (estimate)
    const requestCost =
      (spec.network.requestsPerSecond / 1000000) * this.config.requestCostPerMillion;

    const total = computeCost + memoryCost + storageCost + networkCost + requestCost;

    return {
      compute: computeCost,
      storage: storageCost,
      network: networkCost,
      requests: requestCost,
      total,
      period: 'monthly' as const
    };
  }

  /**
   * Project costs for next period
   */
  private projectCost(currentCost: CostBreakdown): CostBreakdown {
    const multiplier = 1.1; // Assume 10% growth

    return {
      compute: currentCost.compute * multiplier,
      storage: currentCost.storage * multiplier,
      network: currentCost.network * multiplier,
      requests: currentCost.requests * multiplier,
      total: currentCost.total * multiplier,
      period: currentCost.period
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateOptimizations(
    allocation: ResourceAllocation,
    currentCost: CostBreakdown
  ): CostOptimization[] {
    const optimizations: CostOptimization[] = [];

    // Check for right-sizing opportunities
    const rightSizing = this.checkRightSizing(allocation, currentCost);
    if (rightSizing) {
      optimizations.push(rightSizing);
    }

    // Check for reserved capacity
    const reservedCapacity = this.checkReservedCapacity(allocation, currentCost);
    if (reservedCapacity) {
      optimizations.push(reservedCapacity);
    }

    // Check for scheduled scaling
    const scheduledScaling = this.checkScheduledScaling(allocation, currentCost);
    if (scheduledScaling) {
      optimizations.push(scheduledScaling);
    }

    // Check for architecture optimizations
    const architecture = this.checkArchitectureOptimizations(allocation, currentCost);
    if (architecture) {
      optimizations.push(architecture);
    }

    // Check for caching opportunities
    const caching = this.checkCachingOpportunities(allocation, currentCost);
    if (caching) {
      optimizations.push(caching);
    }

    return optimizations.sort((a, b) => b.savings - a.savings);
  }

  /**
   * Check for right-sizing opportunities
   */
  private checkRightSizing(
    allocation: ResourceAllocation,
    currentCost: CostBreakdown
  ): CostOptimization | null {
    const cpuUtil = allocation.usage.cpu;
    const memUtil = allocation.usage.memory;

    // Check if over-provisioned
    if (cpuUtil < 30 && memUtil < 30) {
      const reduction = 0.5; // Can reduce by 50%
      const savings = currentCost.total * reduction;

      return {
        type: CostOptimizationType.RIGHT_SIZE,
        description: 'Resource is underutilized. Consider downsizing by 50%.',
        savings,
        effort: OptimizationEffort.LOW,
        risk: OptimizationRisk.LOW,
        implementation: [
          {
            order: 1,
            action: 'Reduce CPU allocation by 50%',
            description: 'Decrease CPU cores from current allocation',
            parameters: { reduction: 0.5 }
          },
          {
            order: 2,
            action: 'Reduce memory allocation by 50%',
            description: 'Decrease memory allocation',
            parameters: { reduction: 0.5 }
          },
          {
            order: 3,
            action: 'Monitor performance for 24 hours',
            description: 'Ensure no performance degradation',
            parameters: {}
          }
        ]
      };
    }

    return null;
  }

  /**
   * Check for reserved capacity opportunities
   */
  private checkReservedCapacity(
    allocation: ResourceAllocation,
    currentCost: CostBreakdown
  ): CostOptimization | null {
    // Reserved instances typically offer 30-50% savings
    const savings = currentCost.total * 0.4;

    return {
      type: CostOptimizationType.RESERVED_CAPACITY,
      description:
        'Commit to reserved capacity for predictable workloads to save up to 40%.',
      savings,
      effort: OptimizationEffort.LOW,
      risk: OptimizationRisk.LOW,
      implementation: [
        {
          order: 1,
          action: 'Analyze workload patterns',
          description: 'Determine baseline resource requirements',
          parameters: {}
        },
        {
          order: 2,
          action: 'Purchase reserved capacity',
          description: 'Commit to 1-year or 3-year reserved instances',
          parameters: { term: '1-year' }
        }
      ]
    };
  }

  /**
   * Check for scheduled scaling opportunities
   */
  private checkScheduledScaling(
    allocation: ResourceAllocation,
    currentCost: CostBreakdown
  ): CostOptimization | null {
    // Scheduled scaling can save 20-30% for workloads with predictable patterns
    const savings = currentCost.total * 0.25;

    return {
      type: CostOptimizationType.SCHEDULED_SCALING,
      description:
        'Implement scheduled scaling based on predictable traffic patterns.',
      savings,
      effort: OptimizationEffort.MEDIUM,
      risk: OptimizationRisk.LOW,
      implementation: [
        {
          order: 1,
          action: 'Analyze traffic patterns',
          description: 'Identify peak and off-peak hours',
          parameters: {}
        },
        {
          order: 2,
          action: 'Configure scaling schedules',
          description: 'Set up scale-down during off-peak hours',
          parameters: { schedule: 'off-peak' }
        },
        {
          order: 3,
          action: 'Configure scale-up schedules',
          description: 'Set up scale-up before peak hours',
          parameters: { schedule: 'peak' }
        }
      ]
    };
  }

  /**
   * Check for architecture optimizations
   */
  private checkArchitectureOptimizations(
    allocation: ResourceAllocation,
    currentCost: CostBreakdown
  ): CostOptimization | null {
    // Architecture changes can save 40-60% but are high effort
    const savings = currentCost.total * 0.5;

    return {
      type: CostOptimizationType.ARCHITECTURE_CHANGE,
      description:
        'Consider architectural changes like serverless migration or microservices.',
      savings,
      effort: OptimizationEffort.HIGH,
      risk: OptimizationRisk.MEDIUM,
      implementation: [
        {
          order: 1,
          action: 'Conduct architecture review',
          description: 'Identify optimization opportunities',
          parameters: {}
        },
        {
          order: 2,
          action: 'Implement proof of concept',
          description: 'Test new architecture pattern',
          parameters: {}
        },
        {
          order: 3,
          action: 'Migrate workload',
          description: 'Gradual migration to new architecture',
          parameters: {}
        }
      ]
    };
  }

  /**
   * Check for caching opportunities
   */
  private checkCachingOpportunities(
    allocation: ResourceAllocation,
    currentCost: CostBreakdown
  ): CostOptimization | null {
    // Caching can reduce compute and network costs by 30-40%
    const savings = (currentCost.compute + currentCost.network) * 0.35;

    return {
      type: CostOptimizationType.CACHING,
      description:
        'Implement caching to reduce compute and network costs.',
      savings,
      effort: OptimizationEffort.MEDIUM,
      risk: OptimizationRisk.LOW,
      implementation: [
        {
          order: 1,
          action: 'Identify cacheable data',
          description: 'Analyze data access patterns',
          parameters: {}
        },
        {
          order: 2,
          action: 'Implement caching layer',
          description: 'Add Redis or Cloudflare KV caching',
          parameters: { backend: 'kv' }
        },
        {
          order: 3,
          action: 'Configure cache invalidation',
          description: 'Set appropriate TTL values',
          parameters: {}
        }
      ]
    };
  }

  /**
   * Create a budget
   */
  createBudget(
    id: string,
    name: string,
    limit: number,
    period: CostPeriod,
    alertThresholds: number[]
  ): Budget {
    const forecast: BudgetForecast = {
      projected: 0,
      confidence: 0,
      overageProbability: 0,
      recommendedActions: []
    };

    const budget: Budget = {
      id,
      name,
      limit,
      period,
      alertThresholds,
      currentSpend: 0,
      forecast,
      tags: {}
    };

    this.budgets.set(id, budget);
    this.logger.info(`Created budget: ${name} with limit ${limit}`);

    return budget;
  }

  /**
   * Update budget spend
   */
  updateBudgetSpend(budgetId: string, spend: number): void {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      return;
    }

    budget.currentSpend = spend;

    // Update forecast
    budget.forecast = this.generateBudgetForecast(budget);

    // Check thresholds
    this.checkBudgetThresholds(budget);
  }

  /**
   * Generate budget forecast
   */
  private generateBudgetForecast(budget: Budget): BudgetForecast {
    const projected = budget.currentSpend * 1.2; // Simple projection
    const remaining = budget.limit - budget.currentSpend;
    const overageProbability = projected > budget.limit ? 0.8 : 0.1;

    const recommendedActions: string[] = [];
    if (projected > budget.limit) {
      recommendedActions.push('Implement cost optimization measures');
      recommendedActions.push('Review and remove unused resources');
      recommendedActions.push('Consider scaling down non-critical services');
    }

    return {
      projected,
      confidence: 0.7,
      overageProbability,
      recommendedActions
    };
  }

  /**
   * Check budget thresholds and alert if needed
   */
  private checkBudgetThresholds(budget: Budget): void {
    const usage = (budget.currentSpend / budget.limit) * 100;

    for (const threshold of budget.alertThresholds) {
      if (usage >= threshold) {
        this.logger.warn(
          `Budget ${budget.name} alert: ${usage.toFixed(1)}% of limit used (threshold: ${threshold}%)`
        );
        // In production, this would send actual alerts
      }
    }
  }

  /**
   * Get budget by ID
   */
  getBudget(budgetId: string): Budget | undefined {
    return this.budgets.get(budgetId);
  }

  /**
   * Get all budgets
   */
  getAllBudgets(): Budget[] {
    return Array.from(this.budgets.values());
  }

  /**
   * Forecast costs for a resource
   */
  forecastCosts(resourceId: string, periods: number): CostBreakdown[] {
    const history = this.costHistory.get(resourceId);
    if (!history || history.length < 2) {
      return [];
    }

    const forecasts: CostBreakdown[] = [];
    const lastCost = history[history.length - 1];

    // Simple trend-based forecast
    const trend = this.calculateTrend(history);

    for (let i = 1; i <= periods; i++) {
      const multiplier = 1 + trend * i;
      forecasts.push({
        compute: lastCost.compute * multiplier,
        storage: lastCost.storage * multiplier,
        network: lastCost.network * multiplier,
        requests: lastCost.requests * multiplier,
        total: lastCost.total * multiplier,
        period: lastCost.period
      });
    }

    return forecasts;
  }

  /**
   * Calculate cost trend
   */
  private calculateTrend(history: CostBreakdown[]): number {
    if (history.length < 2) {
      return 0;
    }

    const recent = history.slice(-10);
    let sumChange = 0;

    for (let i = 1; i < recent.length; i++) {
      const change = (recent[i].total - recent[i - 1].total) / recent[i - 1].total;
      sumChange += change;
    }

    return sumChange / (recent.length - 1);
  }

  /**
   * Record cost for historical tracking
   */
  recordCost(resourceId: string, cost: CostBreakdown): void {
    if (!this.costHistory.has(resourceId)) {
      this.costHistory.set(resourceId, []);
    }

    const history = this.costHistory.get(resourceId)!;
    history.push(cost);

    // Keep last 100 data points
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get cost history
   */
  getCostHistory(resourceId: string): CostBreakdown[] {
    return this.costHistory.get(resourceId) || [];
  }

  /**
   * Get aggregate cost across all resources
   */
  getAggregateCost(period: CostPeriod): CostBreakdown {
    let compute = 0;
    let storage = 0;
    let network = 0;
    let requests = 0;

    for (const history of this.costHistory.values()) {
      if (history.length > 0) {
        const latest = history[history.length - 1];
        if (latest.period === period) {
          compute += latest.compute;
          storage += latest.storage;
          network += latest.network;
          requests += latest.requests;
        }
      }
    }

    const total = compute + storage + network + requests;

    return {
      compute,
      storage,
      network,
      requests,
      total,
      period
    };
  }

  /**
   * Optimize costs across all resources
   */
  async optimizeAllCosts(allocations: ResourceAllocation[]): Promise<CostAnalysis[]> {
    const analyses: CostAnalysis[] = [];

    for (const allocation of allocations) {
      const analysis = this.analyzeCosts(allocation.resourceId, allocation);
      analyses.push(analysis);

      // Record cost for historical tracking
      this.recordCost(allocation.resourceId, analysis.currentCost);
    }

    // Sort by potential savings
    analyses.sort((a, b) => b.savings - a.savings);

    this.logger.info(
      `Cost optimization analysis complete. Total potential savings: $${analyses.reduce((sum, a) => sum + a.savings, 0).toFixed(2)}`
    );

    return analyses;
  }

  /**
   * Get cost recommendations by priority
   */
  getRecommendationsByPriority(
    analyses: CostAnalysis[]
  ): Map<OptimizationEffort, CostOptimization[]> {
    const recommendations = new Map<OptimizationEffort, CostOptimization[]>();

    recommendations.set(OptimizationEffort.LOW, []);
    recommendations.set(OptimizationEffort.MEDIUM, []);
    recommendations.set(OptimizationEffort.HIGH, []);

    for (const analysis of analyses) {
      for (const opt of analysis.optimization) {
        recommendations.get(opt.effort)!.push(opt);
      }
    }

    // Sort by savings within each priority
    for (const [effort, opts] of recommendations) {
      recommendations.set(effort, opts.sort((a, b) => b.savings - a.savings));
    }

    return recommendations;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CostConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Cost optimizer configuration updated', updates);
  }

  /**
   * Get current configuration
   */
  getConfig(): CostConfig {
    return { ...this.config };
  }
}
