/**
 * Cost Optimizer - Track, analyze, and optimize LLM API costs
 */

import { EventEmitter } from 'eventemitter3';
import {
  CostTracking,
  BudgetConfig,
  BudgetAction,
  CostReport,
  CostOptimizationStrategy,
  LLMRequest,
  LLMResponse,
  BudgetExceededError,
  LLMProvider,
} from '../types/index.js';

// ============================================================================
// Cost Optimizer Configuration
// ============================================================================

export interface CostOptimizerConfig {
  enableTracking: boolean;
  enableBudgetEnforcement: boolean;
  enableOptimization: boolean;
  defaultCurrency: string;
  trackingRetentionDays: number;
  alertThreshold: number;
  costUpdateInterval: number;
}

export interface UsageStats {
  model: string;
  provider: LLMProvider;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  avgCostPerRequest: number;
  avgCostPerToken: number;
  lastUsed: Date;
}

// ============================================================================
// Cost Optimizer Class
// ============================================================================

export class CostOptimizer {
  private tracking: Map<string, CostTracking[]>;
  private budgets: Map<string, BudgetConfig>;
  private budgetSpending: Map<string, number>;
  private usageStats: Map<string, UsageStats>;
  private optimizationStrategies: Map<string, CostOptimizationStrategy>;
  private events: EventEmitter;
  private config: Required<CostOptimizerConfig>;
  private costCache: Map<string, number>;

  constructor(config: Partial<CostOptimizerConfig> = {}) {
    this.tracking = new Map();
    this.budgets = new Map();
    this.budgetSpending = new Map();
    this.usageStats = new Map();
    this.optimizationStrategies = new Map();
    this.events = new EventEmitter();
    this.config = {
      enableTracking: config.enableTracking ?? true,
      enableBudgetEnforcement: config.enableBudgetEnforcement ?? true,
      enableOptimization: config.enableOptimization ?? true,
      defaultCurrency: config.defaultCurrency || 'USD',
      trackingRetentionDays: config.trackingRetentionDays ?? 30,
      alertThreshold: config.alertThreshold ?? 0.8,
      costUpdateInterval: config.costUpdateInterval ?? 60000,
    };
    this.costCache = new Map();

    this.initializeDefaultStrategies();
    this.startCostUpdater();
  }

  // ========================================================================
  // Cost Tracking
  // ========================================================================

  public trackRequest(
    request: LLMRequest,
    response: LLMResponse,
    modelPricing: { input: number; output: number },
    userId?: string,
    requestId?: string
  ): CostTracking {
    if (!this.config.enableTracking) {
      throw new Error('Cost tracking is disabled');
    }

    const model = response.model;
    const provider = this.extractProvider(model);
    const inputTokens = response.usage.promptTokens;
    const outputTokens = response.usage.completionTokens;

    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;
    const totalCost = inputCost + outputCost;

    const tracking: CostTracking = {
      model,
      provider,
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      totalCost,
      timestamp: new Date(),
      userId,
      requestId,
      metadata: {
        modelPricing,
      },
    };

    // Store tracking
    const key = this.getTrackingKey(model, userId);
    if (!this.tracking.has(key)) {
      this.tracking.set(key, []);
    }

    const trackingList = this.tracking.get(key)!;
    trackingList.push(tracking);

    // Clean old records
    this.cleanOldTracking(key);

    // Update usage stats
    this.updateUsageStats(tracking);

    // Update budget spending
    this.updateBudgetSpending(userId, totalCost);

    // Check budgets
    this.checkBudgets(userId, totalCost);

    // Emit event
    this.events.emit('cost:tracked', { tracking });

    return tracking;
  }

  public getTracking(
    model?: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): CostTracking[] {
    let results: CostTracking[] = [];

    for (const [key, trackingList] of this.tracking) {
      for (const tracking of trackingList) {
        if (model && tracking.model !== model) continue;
        if (userId && tracking.userId !== userId) continue;
        if (startDate && tracking.timestamp < startDate) continue;
        if (endDate && tracking.timestamp > endDate) continue;

        results.push(tracking);
      }
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // ========================================================================
  // Cost Estimation
  // ========================================================================

  public estimateCost(
    request: LLMRequest,
    modelPricing: { input: number; output: number },
    maxTokens?: number
  ): number {
    const cacheKey = `${JSON.stringify(request)}-${JSON.stringify(modelPricing)}-${maxTokens}`;

    if (this.costCache.has(cacheKey)) {
      return this.costCache.get(cacheKey)!;
    }

    // Estimate input tokens
    const inputText = this.extractInputText(request);
    const estimatedInputTokens = this.estimateTokens(inputText);

    // Estimate output tokens
    const estimatedOutputTokens = maxTokens || Math.min(2048, estimatedInputTokens * 0.5);

    // Calculate cost
    const inputCost = (estimatedInputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (estimatedOutputTokens / 1_000_000) * modelPricing.output;
    const totalCost = inputCost + outputCost;

    this.costCache.set(cacheKey, totalCost);

    return totalCost;
  }

  private extractInputText(request: LLMRequest): string {
    let text = '';

    for (const message of request.messages) {
      if (typeof message.content === 'string') {
        text += message.content + ' ';
      } else if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === 'text') {
            text += part.text + ' ';
          }
        }
      }
    }

    return text;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  // ========================================================================
  // Budget Management
  // ========================================================================

  public createBudget(config: BudgetConfig): void {
    this.budgets.set(config.id, config);
    this.budgetSpending.set(config.id, 0);

    this.events.emit('budget:created', { budgetId: config.id });
  }

  public getBudget(budgetId: string): BudgetConfig | undefined {
    return this.budgets.get(budgetId);
  }

  public getAllBudgets(): BudgetConfig[] {
    return Array.from(this.budgets.values());
  }

  public updateBudget(budgetId: string, updates: Partial<BudgetConfig>): void {
    const budget = this.budgets.get(budgetId);
    if (!budget) return;

    const updated = { ...budget, ...updates };
    this.budgets.set(budgetId, updated);

    this.events.emit('budget:updated', { budgetId, updates });
  }

  public deleteBudget(budgetId: string): boolean {
    const deleted = this.budgets.delete(budgetId);
    if (deleted) {
      this.budgetSpending.delete(budgetId);
      this.events.emit('budget:deleted', { budgetId });
    }
    return deleted;
  }

  public getBudgetSpending(budgetId: string): number {
    return this.budgetSpending.get(budgetId) || 0;
  }

  public getBudgetRemaining(budgetId: string): number {
    const budget = this.budgets.get(budgetId);
    if (!budget) return 0;

    const spent = this.budgetSpending.get(budgetId) || 0;
    return budget.limit - spent;
  }

  public getBudgetUsage(budgetId: string): number {
    const budget = this.budgets.get(budgetId);
    if (!budget) return 0;

    const spent = this.budgetSpending.get(budgetId) || 0;
    return spent / budget.limit;
  }

  private updateBudgetSpending(userId: string | undefined, cost: number): void {
    for (const [budgetId, budget] of this.budgets) {
      let shouldTrack = false;

      switch (budget.scope) {
        case 'global':
          shouldTrack = true;
          break;
        case 'user':
          shouldTrack = budget.scopeId === userId;
          break;
        case 'team':
        case 'project':
          shouldTrack = budget.scopeId === userId;
          break;
      }

      if (shouldTrack) {
        const current = this.budgetSpending.get(budgetId) || 0;
        this.budgetSpending.set(budgetId, current + cost);
      }
    }
  }

  private checkBudgets(userId: string | undefined, cost: number): void {
    for (const [budgetId, budget] of this.budgets) {
      let shouldCheck = false;

      switch (budget.scope) {
        case 'global':
          shouldCheck = true;
          break;
        case 'user':
          shouldCheck = budget.scopeId === userId;
          break;
        case 'team':
        case 'project':
          shouldCheck = budget.scopeId === userId;
          break;
      }

      if (!shouldCheck) continue;

      const spent = this.budgetSpending.get(budgetId) || 0;
      const usage = spent / budget.limit;

      // Check alert threshold
      if (budget.alertThreshold && usage >= budget.alertThreshold) {
        this.events.emit('budget:alert', {
          budgetId,
          usage,
          limit: budget.limit,
          spent,
        });
      }

      // Check hard limit
      if (budget.hardLimit && spent + cost > budget.limit) {
        this.events.emit('budget:exceeded', {
          budgetId,
          limit: budget.limit,
          spent,
        });

        if (this.config.enableBudgetEnforcement) {
          throw new BudgetExceededError(budgetId, budget.limit, spent);
        }
      }

      // Execute budget actions
      if (budget.actions) {
        for (const action of budget.actions) {
          if (usage >= action.threshold) {
            this.executeBudgetAction(budgetId, action);
          }
        }
      }
    }
  }

  private executeBudgetAction(budgetId: string, action: BudgetAction): void {
    switch (action.type) {
      case 'alert':
        this.events.emit('budget:action:alert', {
          budgetId,
          action,
        });
        break;

      case 'throttle':
        this.events.emit('budget:action:throttle', {
          budgetId,
          action,
        });
        break;

      case 'reject':
        this.events.emit('budget:action:reject', {
          budgetId,
          action,
        });
        throw new BudgetExceededError(budgetId, 0, 0);

      case 'downgrade':
        this.events.emit('budget:action:downgrade', {
          budgetId,
          action,
        });
        break;
    }
  }

  // ========================================================================
  // Usage Statistics
  // ========================================================================

  private updateUsageStats(tracking: CostTracking): void {
    const key = `${tracking.model}:${tracking.provider}`;

    if (!this.usageStats.has(key)) {
      this.usageStats.set(key, {
        model: tracking.model,
        provider: tracking.provider,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        avgCostPerRequest: 0,
        avgCostPerToken: 0,
        lastUsed: new Date(),
      });
    }

    const stats = this.usageStats.get(key)!;
    stats.requests++;
    stats.inputTokens += tracking.inputTokens;
    stats.outputTokens += tracking.outputTokens;
    stats.totalTokens += tracking.inputTokens + tracking.outputTokens;
    stats.totalCost += tracking.totalCost;
    stats.avgCostPerRequest = stats.totalCost / stats.requests;
    stats.avgCostPerToken = stats.totalCost / stats.totalTokens;
    stats.lastUsed = new Date();
  }

  public getUsageStats(
    model?: string,
    provider?: LLMProvider
  ): UsageStats[] {
    let results = Array.from(this.usageStats.values());

    if (model) {
      results = results.filter((s) => s.model === model);
    }

    if (provider) {
      results = results.filter((s) => s.provider === provider);
    }

    return results.sort((a, b) => b.totalCost - a.totalCost);
  }

  // ========================================================================
  // Cost Reports
  // ========================================================================

  public generateReport(
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): CostReport {
    const tracking = this.getTracking(undefined, undefined, startDate, endDate);

    const totalCost = tracking.reduce((sum, t) => sum + t.totalCost, 0);

    const byModel: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    for (const t of tracking) {
      byModel[t.model] = (byModel[t.model] || 0) + t.totalCost;
      byProvider[t.provider] = (byProvider[t.provider] || 0) + t.totalCost;
      if (t.userId) {
        byUser[t.userId] = (byUser[t.userId] || 0) + t.totalCost;
      }
    }

    // Calculate trends (would need historical data for proper trend calculation)
    const trends = {
      average: totalCost,
      change: 0,
      changePercent: 0,
    };

    // Generate optimization recommendations
    const optimization = this.generateOptimizationRecommendations(tracking);

    return {
      period: { start: startDate, end: endDate },
      totalCost,
      breakdown: {
        byModel,
        byProvider: byProvider as Record<LLMProvider, number>,
        byUser,
      },
      trends,
      optimization,
    };
  }

  private generateOptimizationRecommendations(
    tracking: CostTracking[]
  ): {
    potentialSavings: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let potentialSavings = 0;

    // Analyze by model
    const byModel = new Map<string, { cost: number; tokens: number }>();
    for (const t of tracking) {
      if (!byModel.has(t.model)) {
        byModel.set(t.model, { cost: 0, tokens: 0 });
      }
      const stats = byModel.get(t.model)!;
      stats.cost += t.totalCost;
      stats.tokens += t.inputTokens + t.outputTokens;
    }

    // Find expensive models
    for (const [model, stats] of byModel) {
      const costPerToken = stats.cost / stats.tokens;
      if (costPerToken > 0.00001) {
        // More than $10 per 1M tokens
        recommendations.push(
          `Consider switching from ${model} to a more cost-effective model for non-critical tasks`
        );
        potentialSavings += stats.cost * 0.3; // Assume 30% savings
      }
    }

    // Check for optimization opportunities
    const avgOutputTokens = tracking.length > 0
      ? tracking.reduce((sum, t) => sum + t.outputTokens, 0) / tracking.length
      : 0;

    if (avgOutputTokens > 1000) {
      recommendations.push(
        'Consider setting lower max_tokens limits to reduce output costs'
      );
      potentialSavings += tracking.reduce((sum, t) => sum + t.totalCost, 0) * 0.15;
    }

    // Check for caching opportunities
    const uniqueRequests = new Set(tracking.map((t) => t.requestId)).size;
    if (uniqueRequests < tracking.length * 0.5) {
      recommendations.push(
        'Enable response caching to reduce duplicate requests'
      );
      potentialSavings += tracking.reduce((sum, t) => sum + t.totalCost, 0) * 0.2;
    }

    return {
      potentialSavings,
      recommendations,
    };
  }

  // ========================================================================
  // Optimization Strategies
  // ========================================================================

  private initializeDefaultStrategies(): void {
    this.registerOptimizationStrategy({
      name: 'caching',
      description: 'Cache responses to avoid duplicate API calls',
      enabled: true,
      parameters: {
        ttl: 3600000, // 1 hour
        maxSize: 1000,
      },
      results: {
        savings: 0,
        tradeoffs: ['Increased memory usage', 'Stale responses possible'],
      },
    });

    this.registerOptimizationStrategy({
      name: 'model-downgrade',
      description: 'Use smaller models for simple tasks',
      enabled: false,
      parameters: {
        simpleTaskThreshold: 0.7,
        downgradeModels: ['gpt-3.5-turbo', 'claude-3-haiku'],
      },
      results: {
        savings: 0,
        tradeoffs: ['Lower quality responses', 'May not handle complex tasks'],
      },
    });

    this.registerOptimizationStrategy({
      name: 'batch-processing',
      description: 'Batch requests to reduce API overhead',
      enabled: false,
      parameters: {
        batchSize: 10,
        maxWaitTime: 5000,
      },
      results: {
        savings: 0,
        tradeoffs: ['Increased latency', 'Complex implementation'],
      },
    });

    this.registerOptimizationStrategy({
      name: 'token-optimization',
      description: 'Optimize prompts to reduce token usage',
      enabled: true,
      parameters: {
        targetReduction: 0.2, // 20% reduction
      },
      results: {
        savings: 0,
        tradeoffs: ['May require prompt engineering', 'Could affect quality'],
      },
    });
  }

  public registerOptimizationStrategy(strategy: CostOptimizationStrategy): void {
    this.optimizationStrategies.set(strategy.name, strategy);
    this.events.emit('strategy:registered', { strategy });
  }

  public getOptimizationStrategy(name: string): CostOptimizationStrategy | undefined {
    return this.optimizationStrategies.get(name);
  }

  public getAllOptimizationStrategies(): CostOptimizationStrategy[] {
    return Array.from(this.optimizationStrategies.values());
  }

  public enableOptimizationStrategy(name: string): void {
    const strategy = this.optimizationStrategies.get(name);
    if (strategy) {
      strategy.enabled = true;
      this.events.emit('strategy:enabled', { name });
    }
  }

  public disableOptimizationStrategy(name: string): void {
    const strategy = this.optimizationStrategies.get(name);
    if (strategy) {
      strategy.enabled = false;
      this.events.emit('strategy:disabled', { name });
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  private extractProvider(model: string): LLMProvider {
    if (model.startsWith('gpt')) return 'openai';
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('gemini')) return 'google';
    if (model.startsWith('llama')) return 'meta';
    if (model.startsWith('mistral')) return 'mistral';
    return 'custom';
  }

  private getTrackingKey(model: string, userId?: string): string {
    return userId ? `${model}:${userId}` : model;
  }

  private cleanOldTracking(key: string): void {
    const trackingList = this.tracking.get(key);
    if (!trackingList) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.trackingRetentionDays);

    const filtered = trackingList.filter((t) => t.timestamp > cutoffDate);
    this.tracking.set(key, filtered);
  }

  private startCostUpdater(): void {
    setInterval(() => {
      this.costCache.clear();
    }, this.config.costUpdateInterval);
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  public on(event: string, listener: (...args: unknown[]) => void): void {
    this.events.on(event, listener);
  }

  public off(event: string, listener: (...args: unknown[]) => void): void {
    this.events.off(event, listener);
  }

  // ========================================================================
  // Analytics
  // ========================================================================

  public getAnalytics() {
    return {
      totalTracked: Array.from(this.tracking.values()).reduce(
        (sum, list) => sum + list.length,
        0
      ),
      totalBudgets: this.budgets.size,
      totalSpending: Array.from(this.budgetSpending.values()).reduce(
        (sum, val) => sum + val,
        0
      ),
      usageStatsCount: this.usageStats.size,
      optimizationStrategies: Array.from(this.optimizationStrategies.values()).map(
        (s) => ({
          name: s.name,
          enabled: s.enabled,
          potentialSavings: s.results?.savings || 0,
        })
      ),
    };
  }
}
