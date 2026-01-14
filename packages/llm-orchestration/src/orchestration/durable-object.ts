/**
 * Durable Object for distributed LLM orchestration coordination
 * Provides distributed state management and coordination across multiple instances
 */

import {
  DurableObjectState,
  DurableObjectStorage,
  ModelInfo,
  RateLimitState,
  BudgetConfig,
  RoutingRule,
  Metrics,
} from '../types/index.js';

// ============================================================================
// Durable Object State
// ============================================================================

export interface LLMOrchestrationDOState {
  models: Record<string, ModelInfo>;
  rateLimits: Record<string, RateLimitState>;
  budgets: Record<string, { spent: number; periodStart: number }>;
  cache: Record<string, CachedResponse>;
  metrics: Metrics;
  routingRules: RoutingRule[];
  lastUpdated: number;
}

export interface CachedResponse {
  response: string;
  model: string;
  provider: string;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

// ============================================================================
// LLM Orchestration Durable Object
// ============================================================================

export class LLMOrchestrationDurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private env: unknown;
  private internalState: LLMOrchestrationDOState;

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.internalState = {
      models: {},
      rateLimits: {},
      budgets: {},
      cache: {},
      metrics: this.initializeMetrics(),
      routingRules: [],
      lastUpdated: Date.now(),
    };
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  async initialize(): Promise<void> {
    // Load state from storage
    const stored = await this.storage.get<LLMOrchestrationDOState>('state');
    if (stored) {
      this.internalState = stored;
    } else {
      await this.saveState();
    }

    // Start cleanup timer
    this.startCleanupTimer();
  }

  private initializeMetrics(): Metrics {
    return {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        cached: 0,
      },
      latency: {
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      },
      tokens: {
        input: 0,
        output: 0,
        total: 0,
      },
      cost: {
        total: 0,
        byModel: {},
      },
      models: {},
    };
  }

  // ========================================================================
  // Model Management
  // ========================================================================

  async registerModel(model: ModelInfo): Promise<void> {
    this.internalState.models[model.metadata.id] = model;
    this.internalState.lastUpdated = Date.now();
    await this.saveState();
  }

  async getModel(modelId: string): Promise<ModelInfo | undefined> {
    return this.internalState.models[modelId];
  }

  async getAllModels(): Promise<ModelInfo[]> {
    return Object.values(this.internalState.models);
  }

  async updateModelStatus(
    modelId: string,
    status: ModelStatus,
    availability: number
  ): Promise<void> {
    const model = this.internalState.models[modelId];
    if (model) {
      model.status = status;
      model.availability = availability;
      model.lastHealthCheck = new Date();
      this.internalState.lastUpdated = Date.now();
      await this.saveState();
    }
  }

  async updateModelLoad(modelId: string, load: number): Promise<void> {
    const model = this.internalState.models[modelId];
    if (model) {
      model.currentLoad = Math.max(0, Math.min(1, load));
      this.internalState.lastUpdated = Date.now();
      await this.saveState();
    }
  }

  // ========================================================================
  // Rate Limiting
  // ========================================================================

  async checkRateLimit(
    quotaId: string,
    requests: number,
    tokens: number,
    window: number
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    let state = this.internalState.rateLimits[quotaId];

    if (!state || now - state.windowStart >= window) {
      state = {
        requests: 0,
        tokens: 0,
        cost: 0,
        windowStart: now,
        lastRequest: now,
      };
      this.internalState.rateLimits[quotaId] = state;
    }

    const requestsExceeded = state.requests + requests > (this.internalState.rateLimits[quotaId]?.maxRequests || Infinity);
    const tokensExceeded = state.tokens + tokens > (this.internalState.rateLimits[quotaId]?.maxTokens || Infinity);

    if (requestsExceeded || tokensExceeded) {
      const resetTime = state.windowStart + window;
      return {
        allowed: false,
        retryAfter: resetTime - now,
      };
    }

    return { allowed: true };
  }

  async recordRateLimitUsage(
    quotaId: string,
    requests: number,
    tokens: number
  ): Promise<void> {
    let state = this.internalState.rateLimits[quotaId];
    if (!state) {
      state = {
        requests: 0,
        tokens: 0,
        cost: 0,
        windowStart: Date.now(),
        lastRequest: Date.now(),
      };
      this.internalState.rateLimits[quotaId] = state;
    }

    state.requests += requests;
    state.tokens += tokens;
    state.lastRequest = Date.now();
    this.internalState.lastUpdated = Date.now();
    await this.saveState();
  }

  async getRateLimitState(quotaId: string): Promise<RateLimitState | undefined> {
    return this.internalState.rateLimits[quotaId];
  }

  // ========================================================================
  // Budget Management
  // ========================================================================

  async createBudget(budget: BudgetConfig): Promise<void> {
    this.internalState.budgets[budget.id] = {
      spent: 0,
      periodStart: Date.now(),
    };
    this.internalState.lastUpdated = Date.now();
    await this.saveState();
  }

  async checkBudget(budgetId: string, cost: number): Promise<{ allowed: boolean; remaining?: number }> {
    const budget = this.internalState.budgets[budgetId];
    if (!budget) {
      return { allowed: true };
    }

    return {
      allowed: budget.spent + cost <= (this.internalState.budgets[budgetId]?.limit || Infinity),
      remaining: (this.internalState.budgets[budgetId]?.limit || 0) - budget.spent,
    };
  }

  async recordBudgetSpending(budgetId: string, cost: number): Promise<void> {
    const budget = this.internalState.budgets[budgetId];
    if (budget) {
      budget.spent += cost;
      this.internalState.lastUpdated = Date.now();
      await this.saveState();
    }
  }

  async getBudgetSpending(budgetId: string): Promise<number | undefined> {
    return this.internalState.budgets[budgetId]?.spent;
  }

  // ========================================================================
  // Caching
  // ========================================================================

  async getFromCache(key: string): Promise<CachedResponse | undefined> {
    const cached = this.internalState.cache[key];
    if (cached && cached.expiresAt > Date.now()) {
      cached.hitCount++;
      await this.saveState();
      return cached;
    }

    if (cached && cached.expiresAt <= Date.now()) {
      delete this.internalState.cache[key];
      await this.saveState();
    }

    return undefined;
  }

  async setCache(
    key: string,
    response: string,
    model: string,
    provider: string,
    ttl: number
  ): Promise<void> {
    this.internalState.cache[key] = {
      response,
      model,
      provider,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      hitCount: 0,
    };
    this.internalState.lastUpdated = Date.now();
    await this.saveState();
  }

  async deleteFromCache(key: string): Promise<void> {
    delete this.internalState.cache[key];
    this.internalState.lastUpdated = Date.now();
    await this.saveState();
  }

  async clearExpiredCache(): Promise<void> {
    const now = Date.now();
    for (const key in this.internalState.cache) {
      if (this.internalState.cache[key].expiresAt <= now) {
        delete this.internalState.cache[key];
      }
    }
    this.internalState.lastUpdated = Date.now();
    await this.saveState();
  }

  // ========================================================================
  // Metrics Collection
  // ========================================================================

  async recordRequest(
    model: string,
    success: boolean,
    latency: number,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    cached: boolean
  ): Promise<void> {
    const metrics = this.internalState.metrics;

    metrics.requests.total++;
    if (success) metrics.requests.successful++;
    else metrics.requests.failed++;
    if (cached) metrics.requests.cached++;

    // Update latency (exponential moving average)
    const alpha = 0.2;
    metrics.latency.avg = metrics.latency.avg * (1 - alpha) + latency * alpha;

    // Update tokens
    metrics.tokens.input += inputTokens;
    metrics.tokens.output += outputTokens;
    metrics.tokens.total += inputTokens + outputTokens;

    // Update cost
    metrics.cost.total += cost;
    metrics.cost.byModel[model] = (metrics.cost.byModel[model] || 0) + cost;

    // Update model-specific metrics
    if (!metrics.models[model]) {
      metrics.models[model] = {
        requests: 0,
        successes: 0,
        failures: 0,
        avgLatency: 0,
        avgTokens: 0,
        totalCost: 0,
        lastUsed: new Date(),
      };
    }

    const modelMetrics = metrics.models[model];
    modelMetrics.requests++;
    if (success) modelMetrics.successes++;
    else modelMetrics.failures++;
    modelMetrics.avgLatency = modelMetrics.avgLatency * (1 - alpha) + latency * alpha;
    modelMetrics.avgTokens = modelMetrics.avgTokens * (1 - alpha) + (inputTokens + outputTokens) * alpha;
    modelMetrics.totalCost += cost;
    modelMetrics.lastUsed = new Date();

    this.internalState.lastUpdated = Date.now();
    await this.saveState();
  }

  async getMetrics(): Promise<Metrics> {
    return this.internalState.metrics;
  }

  async resetMetrics(): Promise<void> {
    this.internalState.metrics = this.initializeMetrics();
    this.internalState.lastUpdated = Date.now();
    await this.saveState();
  }

  // ========================================================================
  // Routing Rules
  // ========================================================================

  async addRoutingRule(rule: RoutingRule): Promise<void> {
    this.internalState.routingRules.push(rule);
    this.internalState.routingRules.sort((a, b) => b.priority - a.priority);
    this.internalState.lastUpdated = Date.now();
    await this.saveState();
  }

  async removeRoutingRule(ruleId: string): Promise<boolean> {
    const index = this.internalState.routingRules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.internalState.routingRules.splice(index, 1);
      this.internalState.lastUpdated = Date.now();
      await this.saveState();
      return true;
    }
    return false;
  }

  async getRoutingRules(): Promise<RoutingRule[]> {
    return this.internalState.routingRules;
  }

  // ========================================================================
  // Distributed Coordination
  // ========================================================================

  async acquireLock(
    resourceId: string,
    ownerId: string,
    ttl: number
  ): Promise<boolean> {
    const lockKey = `lock:${resourceId}`;
    const existing = await this.storage.get<{ ownerId: string; expiresAt: number }>(lockKey);

    if (existing && existing.expiresAt > Date.now()) {
      return false; // Lock is held by another owner
    }

    await this.storage.put(lockKey, {
      ownerId,
      expiresAt: Date.now() + ttl,
    });

    return true;
  }

  async releaseLock(resourceId: string, ownerId: string): Promise<boolean> {
    const lockKey = `lock:${resourceId}`;
    const existing = await this.storage.get<{ ownerId: string; expiresAt: number }>(lockKey);

    if (!existing || existing.ownerId !== ownerId) {
      return false; // Lock not held by this owner
    }

    await this.storage.delete(lockKey);
    return true;
  }

  async extendLock(
    resourceId: string,
    ownerId: string,
    ttl: number
  ): Promise<boolean> {
    const lockKey = `lock:${resourceId}`;
    const existing = await this.storage.get<{ ownerId: string; expiresAt: number }>(lockKey);

    if (!existing || existing.ownerId !== ownerId) {
      return false; // Lock not held by this owner
    }

    await this.storage.put(lockKey, {
      ownerId,
      expiresAt: Date.now() + ttl,
    });

    return true;
  }

  // ========================================================================
  // State Persistence
  // ========================================================================

  private async saveState(): Promise<void> {
    await this.storage.put('state', this.internalState);
  }

  private async loadState(): Promise<void> {
    const stored = await this.storage.get<LLMOrchestrationDOState>('state');
    if (stored) {
      this.internalState = stored;
    }
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanup().catch((error) => {
        console.error('Cleanup error:', error);
      });
    }, 300000);
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();

    // Clean expired cache entries
    for (const key in this.internalState.cache) {
      if (this.internalState.cache[key].expiresAt <= now) {
        delete this.internalState.cache[key];
      }
    }

    // Clean expired rate limit states
    for (const key in this.internalState.rateLimits) {
      const state = this.internalState.rateLimits[key];
      const age = now - state.lastRequest;
      if (age > 3600000) {
        // 1 hour
        delete this.internalState.rateLimits[key];
      }
    }

    // Clean old metrics data (keep last 30 days)
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    // In a real implementation, you'd have timestamped metric data to clean up

    this.internalState.lastUpdated = now;
    await this.saveState();
  }

  // ========================================================================
  // Broadcast and Sync
  // ========================================================================

  async broadcastUpdate(update: {
    type: string;
    data: unknown;
    timestamp: number;
  }): Promise<void> {
    const channel = new BroadcastChannel('llm-orchestration-updates');
    channel.postMessage(update);
    channel.close();
  }

  async syncState(): Promise<LLMOrchestrationDOState> {
    await this.loadState();
    return this.internalState;
  }

  async getState(): Promise<LLMOrchestrationDOState> {
    return this.internalState;
  }

  async setState(state: Partial<LLMOrchestrationDOState>): Promise<void> {
    this.internalState = { ...this.internalState, ...state };
    this.internalState.lastUpdated = Date.now();
    await this.saveState();
  }

  // ========================================================================
  // Health and Status
  // ========================================================================

  async getHealth(): Promise<{
    healthy: boolean;
    uptime: number;
    lastUpdated: number;
    modelCount: number;
    cacheSize: number;
  }> {
    return {
      healthy: true,
      uptime: Date.now() - (this.internalState.lastUpdated || Date.now()),
      lastUpdated: this.internalState.lastUpdated,
      modelCount: Object.keys(this.internalState.models).length,
      cacheSize: Object.keys(this.internalState.cache).length,
    };
  }
}

// ============================================================================
// Type Fixes
// ============================================================================

type ModelStatus = 'available' | 'degraded' | 'unavailable' | 'maintenance';
